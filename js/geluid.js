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
  let plek = null;               // (x, y) -> { sx, sy, b, h }: waar dat op het scherm is
  let stand = { aan: true, volume: 0.8 };
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
        });
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

  // Hoe hard klinkt iets op deze plek? 1 in beeld, zachter tot 0 op een halve
  // schermbreedte buiten beeld.
  function sterkteOp(x, y) {
    if (!plek || x === undefined) return 1;
    const p = plek(x, y);
    if (!p) return 1;
    const dx = p.sx < 0 ? -p.sx : p.sx > p.b ? p.sx - p.b : 0;
    const dy = p.sy < 0 ? -p.sy : p.sy > p.h ? p.sy - p.h : 0;
    const buiten = Math.hypot(dx, dy) / (p.b * 0.5);
    let s = Math.max(0, 1 - buiten);
    // Ver uitgezoomd klinkt alles wat zachter (anders is een groot gevecht een muur van lawaai).
    if (p.zoom !== undefined && p.zoom < 1) s *= 0.55 + 0.45 * p.zoom;
    return s;
  }

  function speel(naam, opt = {}) {
    if (!ctx || !stand.aan || !lijst || ctx.state !== 'running') return;
    const g = lijst.geluiden[naam];
    if (!g || !g.bestanden.length) return;
    const nu = performance.now();
    if (nu - (laatst.get(naam) || -1e9) < (g.tussen || 0)) return;
    if (spelend >= (lijst.maxTegelijk || 14)) return;
    const sterkte = sterkteOp(opt.x, opt.y) * (opt.volume === undefined ? 1 : opt.volume);
    if (sterkte < 0.04) return;
    const bestand = g.bestanden[Math.floor(Math.random() * g.bestanden.length)];
    const buf = buffers.get(bestand);
    if (!buf || buf instanceof Promise) { if (!buffers.has(bestand)) buffer(bestand); return; }
    laatst.set(naam, nu);
    try {
      const bron = ctx.createBufferSource();
      bron.buffer = buf;
      // Een beetje hoger of lager, zodat hetzelfde geluid niet als een machine klinkt.
      const t = lijst.toonhoogte || 0;
      bron.playbackRate.value = 1 + (Math.random() * 2 - 1) * t;
      const v = ctx.createGain();
      v.gain.value = (g.volume === undefined ? 1 : g.volume) * sterkte;
      bron.connect(v);
      v.connect(effecten);
      spelend++;
      bron.onended = () => { spelend--; v.disconnect(); };
      bron.start(ctx.currentTime + Math.max(0, (opt.wacht || 0) / 1000));
    } catch (e) { /* een geluid minder */ }
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
    document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); });
  }

  return {
    koppel,
    speel,
    ontgrendel,
    // main.js vertelt hoe een tegel op het scherm uitkomt.
    zetPlek(f) { plek = f; },
    aan: () => stand.aan,
    volume: () => stand.volume,
    zetAan(a) { stand.aan = !!a; bewaar(); zetVolume(); },
    zetVolumeNiveau(v) { stand.volume = Math.max(0, Math.min(1, v)); bewaar(); zetVolume(); },
    // Voor tests
    stand: () => ({ gehoord: [...laatst.keys()], ctx: ctx ? ctx.state : 'geen', geladen: [...buffers.values()].filter((b) => b && !(b instanceof Promise)).length, spelend, aan: stand.aan, volume: stand.volume }),
  };
}

export const geluid = maakGeluid();
