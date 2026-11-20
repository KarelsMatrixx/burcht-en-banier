// GELUID: de geluidseffecten (stap 46).
//
// Eén geluidsmotor voor het hele spel, met Web Audio. De lijst met geluiden
// en hun volume staat in data/geluiden.json, de bestanden in geluid/.
//
// Gebruik: geluid.speel('sword_hit') voor een geluid zonder plek (knoppen),
// of geluid.speel('sword_hit', { x, y }) met een plek op de kaart (tegels):
// dan klinkt het zachter naarmate het verder buiten beeld is.
//
// iPhone: geluid mag pas na de eerste tik van de speler. Daarom maken we de
// audio pas aan bij de eerste aanraking (ontgrendel). Daarvoor is alles stil.
//
// De speler kan geluid aan of uit zetten en het volume kiezen (instellingen,
// achter het tandwiel). Dat bewaren we in localStorage.

const OPSLAG = 'aldervale.geluid';

function maakGeluid() {
  let ctx = null;          // AudioContext, pas na de eerste tik
  let hoofd = null;        // hoofdvolume
  let effecten = null;     // volume van de effecten
  let lijst = null;        // data/geluiden.json
  let laden = null;        // belofte: lijst geladen
  const buffers = new Map();     // bestand -> AudioBuffer (of een belofte)
  const laatst = new Map();      // naam -> tijd van de laatste keer
  let spelend = 0;               // hoeveel er nu klinken
  let stil = null;               // () => true als er geen omgevingsgeluid mag klinken (startscherm)
  let plek = null;               // (x, y) -> { sx, sy, b, h }: waar dat op het scherm is
  let stand = { aan: true, volume: 0.8 };
  let wens = null;               // het omgevingsgeluid dat moet klinken: { naam }
  let lus = null;                // het omgevingsgeluid dat nu klinkt: { naam, bron, v }
  const klokken = [];            // af en toe een geluid (kerkklok): { naam, elke, volgende }
  try { Object.assign(stand, JSON.parse(localStorage.getItem(OPSLAG) || '{}')); } catch (e) { /* geen opslag: standaard */ }

  function bewaar() {
    try { localStorage.setItem(OPSLAG, JSON.stringify(stand)); } catch (e) { /* geen opslag */ }
  }

  function laadLijst() {
    if (!laden) laden = fetch('data/geluiden.json').then((r) => r.json()).then((d) => { lijst = d; return d; }).catch(() => null);
    return laden;
  }

  // Een bestand ophalen en omzetten. Mislukt het, dan blijft dit geluid stil.
  function buffer(bestand) {
    if (buffers.has(bestand)) return buffers.get(bestand);
    const b = fetch('geluid/' + bestand)
      .then((r) => r.arrayBuffer())
      .then((a) => new Promise((ok, mis) => ctx.decodeAudioData(a, ok, mis)))
      .then((buf) => { buffers.set(bestand, buf); return buf; })
      .catch(() => { buffers.set(bestand, null); return null; });
    buffers.set(bestand, b);
    return b;
  }

  // Na de eerste tik: audio aanmaken en alle bestanden vast inladen.
  function ontgrendel() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        hoofd = ctx.createGain();
        effecten = ctx.createGain();
        effecten.connect(hoofd);
        hoofd.connect(ctx.destination);
        zetVolume();
        laadLijst().then((d) => {
          if (!d) return;
          for (const g of Object.values(d.geluiden)) for (const f of g.bestanden) buffer(f);
          startLus();
        });
        setInterval(tik, 1000);
        setInterval(zoomOmgeving, 200);
        setInterval(volgCamera, 100);
      }
      if (ctx.state === 'suspended') ctx.resume();
      // iOS: een heel kort stil geluid zet de audio echt aan.
      const stil = ctx.createBuffer(1, 1, 22050);
      const bron = ctx.createBufferSource();
      bron.buffer = stil;
      bron.connect(ctx.destination);
      bron.start(0);
    } catch (e) { /* geen geluid mogelijk: het spel gaat gewoon door */ }
  }

  function zetVolume() {
    if (!hoofd) return;
    hoofd.gain.value = stand.aan ? stand.volume : 0;
  }

  // Hoe hard klinken geluiden uit de wereld bij deze zoom? Helemaal uitgezoomd
  // niets, vanaf zoom.vol (data/geluiden.json) alles. Daartussen loopt het op.
  function zoomSterkte(zoom) {
    if (zoom === undefined || !lijst) return 1;
    const z = lijst.zoom || { stil: 0.6, vol: 1.6 };
    return Math.max(0, Math.min(1, (zoom - z.stil) / (z.vol - z.stil)));
  }

  // Hoe hard klinkt iets op deze plek? Alleen wat je op je scherm ziet, klinkt.
  // Knoppen en meldingen (zonder plek) klinken altijd.
  function sterkteOp(x, y) {
    if (!plek || x === undefined) return 1;
    const p = plek(x, y);
    if (!p) return 1;
    // Net buiten beeld loopt het geleidelijk af tot stil (geen harde grens).
    const rand = 80;   // pixels
    const dx = p.sx < 0 ? -p.sx : p.sx > p.b ? p.sx - p.b : 0;
    const dy = p.sy < 0 ? -p.sy : p.sy > p.h ? p.sy - p.h : 0;
    const buiten = Math.max(0, 1 - Math.hypot(dx, dy) / rand);
    return buiten * zoomSterkte(p.zoom);
  }

  // Wat er nu klinkt: { prio, gevecht, bron, v, eind }. Hooguit maxTegelijk
  // tegelijk (3); vechtgeluiden mogen erbij tot maxGevecht. Is het vol, dan
  // verdringt een belangrijker geluid het minst belangrijke dat nu klinkt.
  const klinkt = new Set();
  let gestart = 0;     // voor tests: hoeveel geluiden er echt begonnen
  let maxKlonk = 0;    // voor tests: het hoogste aantal tegelijk
  function ruimOp(nu) {
    for (const k of klinkt) if (k.eind <= nu) klinkt.delete(k);
  }
  function stopZacht(k) {
    klinkt.delete(k);
    try {
      k.v.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
      k.bron.stop(ctx.currentTime + 0.6);
    } catch (e) { /* al gestopt */ }
  }
  function zwaksteVan(alleenGewoon) {
    let z = null;
    for (const k of klinkt) {
      if (alleenGewoon && k.gevecht) continue;
      if (!z || k.prio < z.prio || (k.prio === z.prio && k.start < z.start)) z = k;
    }
    return z;
  }
  // Gewone geluiden: hooguit maxTegelijk (3) onder elkaar. Vechtgeluiden mogen
  // erbij, maar alles samen nooit meer dan maxGevecht (6).
  function maakRuimte(prio, gevecht) {
    const max = lijst.maxTegelijk || 3;
    const maxG = Math.max(max, lijst.maxGevecht || max);
    const gewoon = () => { let n = 0; for (const k of klinkt) if (!k.gevecht) n++; return n; };
    if (!gevecht && gewoon() >= max) {
      const z = zwaksteVan(true);
      if (!z || z.prio >= prio) return false;
      stopZacht(z);
    }
    if (klinkt.size >= maxG) {
      const z = zwaksteVan(false);
      if (!z || z.prio >= prio) return false;
      stopZacht(z);
    }
    return klinkt.size < maxG && (gevecht || gewoon() < max);
  }

  function speel(naam, opt = {}) {
    if (!ctx || !stand.aan || !lijst || ctx.state !== 'running') return;
    const g = lijst.geluiden[naam];
    if (!g || !g.bestanden.length) return;
    const nu = performance.now();
    if (nu - (laatst.get(naam) || -1e9) < (g.tussen || 0)) return;
    const sterkte = sterkteOp(opt.x, opt.y) * (opt.volume === undefined ? 1 : opt.volume);
    if (sterkte < 0.04) return;
    const bestand = g.bestanden[Math.floor(Math.random() * g.bestanden.length)];
    const buf = buffers.get(bestand);
    if (!buf || buf instanceof Promise) { if (!buffers.has(bestand)) buffer(bestand); return; }
    const prio = g.prio || 1;
    ruimOp(nu);
    if (!maakRuimte(prio, !!g.gevecht)) return;
    laatst.set(naam, nu);
    try {
      const bron = ctx.createBufferSource();
      bron.buffer = buf;
      // Een beetje hoger of lager, zodat hetzelfde geluid niet als een machine klinkt.
      const t = lijst.toonhoogte || 0;
      const snel = 1 + (Math.random() * 2 - 1) * t;
      bron.playbackRate.value = snel;
      const v = ctx.createGain();
      v.gain.value = (g.volume === undefined ? 1 : g.volume) * sterkte;
      bron.connect(v);
      v.connect(effecten);
      const wacht = Math.max(0, (opt.wacht || 0) / 1000);
      const basis = (g.volume === undefined ? 1 : g.volume) * (opt.volume === undefined ? 1 : opt.volume);
      const k = { prio, gevecht: !!g.gevecht, bron, v, basis, x: opt.x, y: opt.y, start: nu, eind: nu + (wacht + buf.duration / snel) * 1000 };
      klinkt.add(k);
      gestart++;
      maxKlonk = Math.max(maxKlonk, klinkt.size);
      spelend++;
      bron.onended = () => { spelend--; klinkt.delete(k); v.disconnect(); };
      bron.start(ctx.currentTime + wacht);
    } catch (e) { /* een geluid minder */ }
  }

  // Wat al klinkt, volgt de camera: zoom je uit of schuif je weg, dan wordt
  // het geleidelijk zachter (en weer harder als je terugkomt).
  function volgCamera() {
    if (!ctx) return;
    for (const k of klinkt) {
      if (k.x === undefined) continue;
      try { k.v.gain.setTargetAtTime(k.basis * sterkteOp(k.x, k.y), ctx.currentTime, 0.1); } catch (e) { /* weg */ }
    }
  }

  // Het omgevingsgeluid volgt de zoom: uitgezoomd stil, ingezoomd vol.
  function zoomOmgeving() {
    if (!lus || !plek || !lijst) return;
    const p = plek(0, 0);
    if (!p) return;
    const g = lijst.geluiden[lus.naam] || {};
    // Op het startscherm en de levelkaart geen omgevingsgeluid.
    const doel = stil && stil() ? 0 : (g.volume === undefined ? 0.3 : g.volume) * zoomSterkte(p.zoom);
    try { lus.v.gain.setTargetAtTime(doel, ctx.currentTime, 0.25); } catch (e) { /* weg */ }
  }

  // Omgevingsgeluid: een lus die blijft doorklinken (wind, bos, moeras). Zacht in en uit.
  function stopLus(over = 1.5) {
    if (!lus) return;
    const oud = lus;
    lus = null;
    try {
      oud.v.gain.setTargetAtTime(0, ctx.currentTime, over / 3);
      setTimeout(() => { try { oud.bron.stop(); oud.v.disconnect(); } catch (e) { /* al weg */ } }, over * 1000 + 200);
    } catch (e) { /* al weg */ }
  }
  function startLus() {
    if (!ctx || !lijst) return;
    const naam = wens && wens.naam;
    if (lus && lus.naam === naam) return;
    stopLus();
    const g = naam && lijst.geluiden[naam];
    if (!g || !g.bestanden.length) return;
    const bestand = g.bestanden[0];
    const buf = buffers.get(bestand);
    if (!buf || buf instanceof Promise) { buffer(bestand).then(() => startLus()); return; }
    try {
      const bron = ctx.createBufferSource();
      bron.buffer = buf;
      bron.loop = true;
      const v = ctx.createGain();
      v.gain.value = 0;
      v.gain.setTargetAtTime(stil && stil() ? 0 : (g.volume === undefined ? 0.3 : g.volume) * (plek && plek(0, 0) ? zoomSterkte(plek(0, 0).zoom) : 1), ctx.currentTime, 0.8);
      bron.connect(v);
      v.connect(hoofd);
      bron.start();
      lus = { naam, bron, v };
    } catch (e) { /* geen omgeving */ }
  }
  function omgeving(naam) {
    wens = naam ? { naam } : null;
    startLus();
  }
  // Het landschap van dit level (data/geluiden.json, omgeving en afEnToe).
  function zetLandschap(sleutel) {
    laadLijst().then((d) => {
      if (!d) return;
      omgeving((d.omgeving || {})[sleutel] || (d.omgeving || {}).vrij || null);
      const a = (d.afEnToe || {})[sleutel];
      afEnToe(a ? a[0] : null, a ? a[1] : 0);
    });
  }
  // Af en toe een geluid, zoals een kerkklok in de verte. elke = gemiddeld zoveel seconden.
  function afEnToe(naam, elke) {
    klokken.length = 0;
    if (naam) klokken.push({ naam, elke, volgende: elke * (0.3 + Math.random() * 0.7) });
  }
  function tik() {
    for (const k of klokken) {
      if (--k.volgende > 0) continue;
      k.volgende = k.elke * (0.6 + Math.random() * 0.8);
      speel(k.naam, { volume: 0.7 });
    }
  }

  // Overal: de eerste aanraking zet het geluid aan, en elke knop tikt.
  function koppel() {
    laadLijst();
    const eerste = () => ontgrendel();
    window.addEventListener('pointerdown', eerste, { capture: true, passive: true });
    window.addEventListener('touchend', eerste, { capture: true, passive: true });
    window.addEventListener('keydown', eerste, { capture: true, passive: true });
    document.addEventListener('click', (e) => {
      const knop = e.target && e.target.closest && e.target.closest('button');
      if (!knop || knop.disabled || knop.dataset.stil !== undefined) return;
      // Sluit- en terugknoppen klinken anders dan gewone knoppen.
      const terug = /sluit|terug|verder$|close/i.test(knop.id || '') || /^(close|back|resume)$/i.test((knop.textContent || '').trim());
      speel(terug ? 'ui_back' : 'ui_click');
    }, true);
    // Het menu achter het tandwiel: geluid aan of uit en het volume.
    const knop = document.getElementById('knop-geluid');
    const schuif = document.getElementById('geluid-volume');
    const toon = () => {
      if (knop) knop.textContent = stand.aan ? 'Sound: on' : 'Sound: off';
      if (schuif) { schuif.value = Math.round(stand.volume * 100); schuif.disabled = !stand.aan; }
    };
    if (knop) knop.addEventListener('click', () => { stand.aan = !stand.aan; bewaar(); zetVolume(); toon(); if (stand.aan) speel('ui_confirm'); });
    if (schuif) {
      schuif.addEventListener('input', () => { stand.volume = Number(schuif.value) / 100; bewaar(); zetVolume(); });
      schuif.addEventListener('change', () => speel('ui_confirm'));
    }
    toon();
    // Komt de app terug uit de achtergrond, dan staat de audio soms stil.
    // In de achtergrond is het stil (ook het omgevingsgeluid).
    document.addEventListener('visibilitychange', () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend().catch(() => {});
      else if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    });
  }

  return {
    koppel,
    speel,
    ontgrendel,
    // main.js vertelt hoe een tegel op het scherm uitkomt.
    zetPlek(f) { plek = f; },
    zetStil(f) { stil = f; zoomOmgeving(); },
    nulMeting() { maxKlonk = 0; gestart = 0; },
    omgeving,
    afEnToe,
    zetLandschap,
    aan: () => stand.aan,
    volume: () => stand.volume,
    zetAan(a) { stand.aan = !!a; bewaar(); zetVolume(); },
    zetVolumeNiveau(v) { stand.volume = Math.max(0, Math.min(1, v)); bewaar(); zetVolume(); },
    // Voor tests
    stand: () => ({ omgeving: lus ? lus.naam : null, gehoord: [...laatst.keys()], ctx: ctx ? ctx.state : 'geen', geladen: [...buffers.values()].filter((b) => b && !(b instanceof Promise)).length, spelend, klinkt: klinkt.size, volumes: [...klinkt].map((k) => Math.round(k.v.gain.value * 100) / 100), gestart, maxKlonk, zoom: plek && plek(0, 0) ? zoomSterkte(plek(0, 0).zoom) : null, lusVolume: lus ? lus.v.gain.value : null, aan: stand.aan, volume: stand.volume }),
  };
}

export const geluid = maakGeluid();
