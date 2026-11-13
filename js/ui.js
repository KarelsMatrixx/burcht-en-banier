// UI: de tekst en knoppen bovenop het spel (gewone HTML, geen canvas).

import { CONFIG } from './config.js';

const komma = (getal) => getal.toFixed(1).replace('.', ',');

export function maakUi() {
  const el = (id) => document.getElementById(id);
  let beelden = '';
  let offline = false;

  el('versie').textContent = `step ${CONFIG.stap} · v${CONFIG.versie}`;

  // Een portret in een <img>: { portret } is de bestandsnaam in beelden/portretten.
  function zetPortret(id, wie) {
    const img = el(id);
    if (!img) return;
    img.hidden = !wie || !wie.portret;
    if (wie && wie.portret) {
      img.src = `beelden/portretten/${wie.portret}.jpg`;
      img.alt = wie.naam || '';
    }
  }

  // De verhaalbalk: één bericht tegelijk, de rest wacht. Een bericht blijft
  // staan zolang je nodig hebt om het te lezen (minstens 6 seconden).
  const verhaalRij = [];
  let verhaalKlok = null;
  function volgendVerhaal() {
    clearTimeout(verhaalKlok);
    const b = verhaalRij.shift();
    if (!b) { el('verhaal').hidden = true; zetAdviseur(null); return; }
    zetPortret('verhaal-portret', b);
    zetAdviseur(b.portret);
    el('verhaal-wie').textContent = b.naam;
    el('verhaal-tekst').textContent = b.tekst;
    el('verhaal').hidden = false;
    const woorden = b.tekst.split(/\s+/).length;
    verhaalKlok = setTimeout(volgendVerhaal, Math.max(6000, woorden * 400));
  }
  el('verhaal').addEventListener('click', volgendVerhaal);

  const werkStatusBij = () => {
    el('status').textContent = [beelden, offline ? 'offline ready' : 'offline not ready yet']
      .filter(Boolean)
      .join(' · ');
  };
  werkStatusBij();

  // --- De adviseur en het logboek (stap 35) -----------------------------------
  // Elk bericht heeft een soort met een eigen zegel. Alles komt in het logboek;
  // alleen wat dringend is of een antwoord op wat je net deed, komt ook even
  // in beeld (als lint naast de adviseur).
  const SOORTEN = {
    vijand: { naam: 'Enemy', toon: true },
    economie: { naam: 'Economy', toon: false },
    leger: { naam: 'Army', toon: true },
    verhaal: { naam: 'Story', toon: true },
    uitleg: { naam: 'Help', toon: false },
  };
  const logboek = [];             // { tekst, soort, tijd, wie }
  let ongelezen = 0;
  const filter = new Set(Object.keys(SOORTEN));
  const begin = Date.now();
  let speeltijd = () => (Date.now() - begin) / 1000;
  const klok = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const zegel = (soort) => {
    const img = document.createElement('img');
    img.src = `beelden/hud/zegel_${soort}.webp`;
    img.alt = SOORTEN[soort] ? SOORTEN[soort].naam : '';
    img.className = 'zegel';
    return img;
  };

  // Het portret in de adviseur: de verteller, of wie er net praat.
  function zetAdviseur(portret) {
    el('adviseur-portret').src = `beelden/portretten/${portret || 'bartholt'}.jpg`;
  }
  function zetTeller() {
    el('adviseur-teller').hidden = ongelezen === 0 || !el('logboek').hidden;
    el('adviseur-teller').textContent = ongelezen > 9 ? '9+' : String(ongelezen);
  }
  function tekenLogboek() {
    const lijst = el('logboek-lijst');
    lijst.textContent = '';
    const zichtbaar = logboek.filter((r) => filter.has(r.soort));
    if (!zichtbaar.length) {
      const leeg = document.createElement('div');
      leeg.className = 'log-leeg';
      leeg.textContent = 'No messages yet.';
      lijst.appendChild(leeg);
    }
    for (const r of zichtbaar.slice().reverse()) {
      const regel = document.createElement('div');
      regel.className = `log-regel soort-${r.soort}`;
      regel.appendChild(zegel(r.soort));
      const tekst = document.createElement('span');
      tekst.textContent = r.wie ? `${r.wie}: ${r.tekst}` : r.tekst;
      regel.appendChild(tekst);
      const tijd = document.createElement('small');
      tijd.textContent = klok(r.tijd);
      regel.appendChild(tijd);
      lijst.appendChild(regel);
    }
  }
  // De filters bovenaan het logboek: tik een zegel om die soort aan of uit te zetten.
  for (const soort of Object.keys(SOORTEN)) {
    const knop = document.createElement('button');
    knop.type = 'button';
    knop.className = 'log-filter actief';
    knop.dataset.soort = soort;
    knop.setAttribute('aria-label', SOORTEN[soort].naam);
    knop.appendChild(zegel(soort));
    knop.addEventListener('click', () => {
      if (filter.has(soort) && filter.size === Object.keys(SOORTEN).length) {
        filter.clear();
        filter.add(soort);           // eerste tik: alleen deze soort
      } else if (filter.has(soort)) filter.delete(soort);
      else filter.add(soort);
      if (!filter.size) for (const s of Object.keys(SOORTEN)) filter.add(s);
      for (const k of el('logboek-filters').children) if (k.dataset.soort) k.classList.toggle('actief', filter.has(k.dataset.soort));
      zetFilterTekst();
      tekenLogboek();
    });
    el('logboek-filters').appendChild(knop);
  }
  const filterTekst = document.createElement('span');
  filterTekst.className = 'log-filtertekst';
  el('logboek-filters').appendChild(filterTekst);
  function zetFilterTekst() {
    const alle = filter.size === Object.keys(SOORTEN).length;
    filterTekst.textContent = alle ? 'All messages' : [...filter].map((s) => SOORTEN[s].naam).join(', ');
  }
  zetFilterTekst();
  const klapLogboek = (open) => {
    el('logboek').hidden = !open;
    el('adviseur').classList.toggle('open', open);
    if (open) {
      ongelezen = 0;
      tekenLogboek();
      el('meldingen').textContent = '';
    }
    zetTeller();
  };
  el('adviseur').addEventListener('click', () => klapLogboek(el('logboek').hidden));

  // Instellingen achter het tandwiel.
  const klapInstellingen = (open) => {
    el('instellingen').hidden = !open;
    el('knop-instellingen').classList.toggle('actief', open);
  };
  el('knop-instellingen').addEventListener('click', () => klapInstellingen(el('instellingen').hidden));
  el('knop-verder').addEventListener('click', () => klapInstellingen(false));
  el('knop-start').addEventListener('click', () => klapInstellingen(false));
  // Het doel van dit level, achter de rol rechtsonder.
  const klapDoel = (open) => {
    el('doelpaneel').hidden = !open;
    el('knop-menu').classList.toggle('actief', open);
  };
  el('doel-sluit').addEventListener('click', () => klapDoel(false));

  // --- Schuiven met je vinger -------------------------------------------------
  // De pagina staat op touch-action: none (anders zoomt en scrollt Safari mee
  // met de kaart). Daardoor schuift een rij knoppen niet vanzelf: dat doen we
  // hier zelf. Een veeg is geen tik: de knop onder je vinger reageert dan niet.
  function sleepbaar(doos, as = 'x') {
    let start = null;
    let geveegd = false;
    doos.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, y: e.clientY, links: doos.scrollLeft, boven: doos.scrollTop, id: e.pointerId };
      geveegd = false;
    });
    doos.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (!geveegd && Math.abs(as === 'x' ? dx : dy) > 8) {
        geveegd = true;
        try { doos.setPointerCapture(e.pointerId); } catch (fout) { /* niet erg */ }
      }
      if (!geveegd) return;
      if (as === 'x') doos.scrollLeft = start.links - dx;
      else doos.scrollTop = start.boven - dy;
    });
    const los = () => { start = null; };
    doos.addEventListener('pointerup', los);
    doos.addEventListener('pointercancel', los);
    doos.addEventListener('click', (e) => {
      if (!geveegd) return;
      geveegd = false;
      e.stopPropagation();
      e.preventDefault();
    }, true);
  }
  sleepbaar(el('bouw-knoppen'));
  sleepbaar(el('leger-groepen'));
  sleepbaar(el('leger-opleiden'));
  sleepbaar(el('logboek-lijst'), 'y');
  sleepbaar(el('menu-lijst'), 'y');

  // --- De bediening rechtsonder ------------------------------------------------
  // Hamer = bouwpaneel, zwaard = legerpaneel. Er staat er hooguit één open.
  // Wat open stond, onthoudt het spel voor deze sessie.
  let paneel = null;
  try { paneel = sessionStorage.getItem('burcht-banier.paneel') || null; } catch (fout) { /* geen opslag */ }
  let bouwtNu = false;
  let legerStand = { zichtbaar: false };
  function zetPaneel(nieuw) {
    paneel = nieuw;
    try { sessionStorage.setItem('burcht-banier.paneel', paneel || ''); } catch (fout) { /* geen opslag */ }
    el('knop-hamer').classList.toggle('actief', paneel === 'bouw');
    el('knop-zwaard').classList.toggle('actief', paneel === 'leger');
    el('bouw-knoppen').hidden = !(paneel === 'bouw' || bouwtNu);
    const leger = paneel === 'leger' && legerStand.zichtbaar;
    el('leger-balk').hidden = !leger;
    el('leger-groepen').hidden = !leger || el('leger-groepen').dataset.leeg === '1';
    el('leger-leeg').hidden = !(paneel === 'leger' && !legerStand.zichtbaar);
  }
  zetPaneel(paneel);
  el('knop-hamer').addEventListener('click', () => zetPaneel(paneel === 'bouw' ? null : 'bouw'));
  el('knop-zwaard').addEventListener('click', () => zetPaneel(paneel === 'leger' ? null : 'leger'));

  // Tip om de app op het beginscherm te zetten. Alleen als je nog in
  // Safari zit en de tip niet eerder hebt gesloten.
  const alsApp =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  let tipGesloten = false;
  try { tipGesloten = localStorage.getItem('tipGesloten') === '1'; } catch (fout) { /* geen opslag */ }
  if (!alsApp && !tipGesloten) el('tip').hidden = false;
  el('tip-sluit').addEventListener('click', () => {
    el('tip').hidden = true;
    try { localStorage.setItem('tipGesloten', '1'); } catch (fout) { /* geen opslag */ }
  });

  el('uitslag-sluit').addEventListener('click', () => {
    el('uitslag').hidden = true;
  });

  // Welke groep van de bouwbalk openstaat (null = het begin, met de groepen).
  function toonGroep(open) {
    for (const knop of el('bouw-knoppen').children) {
      if (knop.dataset.open) knop.hidden = open !== null;            // een groepknop
      else if (knop.id === 'knop-terug') knop.hidden = open === null;
      else if (knop.dataset.groep) knop.hidden = knop.dataset.groep !== open;
      else knop.hidden = open !== null;                              // Slopen staat bij het begin
    }
  }

  // Tik je bovenin op je voorraad, dan klapt het paneel over je volk open.
  let kiesBelasting = () => {};
  let leidOp = () => {};
  let verkoopActie = () => {};
  const klapVolk = (open) => {
    el('volkpaneel').hidden = !open;
    el('voorraad').classList.toggle('open', open);
  };
  const tikVolk = () => {
    el('legerpaneel').hidden = true;
    el('handelpaneel').hidden = true;
    klapVolk(el('volkpaneel').hidden);
    el('knop-buidel').classList.toggle('actief', !el('volkpaneel').hidden);
  };
  el('voorraad').addEventListener('click', tikVolk);
  el('knop-buidel').addEventListener('click', tikVolk);
  el('volk-sluit').addEventListener('click', () => { klapVolk(false); el('knop-buidel').classList.remove('actief'); });

  // De knop Test klapt het paneel van de prestatietest open en dicht.
  el('knop-test').addEventListener('click', () => {
    klapInstellingen(false);
    el('proef').hidden = !el('proef').hidden;
    el('knop-test').classList.toggle('actief', !el('proef').hidden);
  });

  return {
    toonBeelden(aantal) {
      beelden = `${aantal} fps`;
      werkStatusBij();
    },
    zetOfflineKlaar() {
      offline = true;
      werkStatusBij();
    },
    toonTegel(tekst) {
      el('tegelinfo').textContent = tekst;
      el('tegelinfo').hidden = !tekst;
    },
    // Een bericht. soort = vijand, economie, leger, verhaal of uitleg.
    // toon = true: ook even in beeld, ook als die soort normaal stil is;
    // false: alleen in het logboek.
    toonMelding(tekst, { soort = 'uitleg', toon, wie } = {}) {
      if (!SOORTEN[soort]) soort = 'uitleg';
      logboek.push({ tekst, soort, tijd: speeltijd(), wie: wie || '' });
      if (logboek.length > 60) logboek.shift();
      if (!el('logboek').hidden) tekenLogboek();
      else {
        ongelezen++;
        zetTeller();
      }
      const inBeeld = toon === undefined ? SOORTEN[soort].toon : toon;
      if (!inBeeld || !el('logboek').hidden) return;
      const regel = document.createElement('div');
      regel.className = `melding soort-${soort}`;
      regel.appendChild(zegel(soort));
      const span = document.createElement('span');
      span.textContent = tekst;
      regel.appendChild(span);
      regel.addEventListener('click', () => regel.remove());
      el('meldingen').appendChild(regel);
      // Hooguit twee tegelijk in beeld: anders zie je de kaart niet meer.
      while (el('meldingen').children.length > 2) el('meldingen').firstChild.remove();
      const woorden = tekst.split(/\s+/).length;
      setTimeout(() => regel.remove(), Math.max(3500, woorden * 330));
    },
    // Het logboek, voor de tests: [{ tekst, soort }].
    logboek: () => logboek.map(({ tekst, soort }) => ({ tekst, soort })),
    zetSpeeltijd(functie) { speeltijd = functie; },
    opNaarStart(functie) {
      el('knop-start').addEventListener('click', functie);
    },
    // De voorraad bovenin: een plaatje en een getal per soort. De namen
    // staan in het paneel dat opent als je de voorraad aantikt.
    //   lijst = [{ sleutel, naam, aantal, slecht }]   (slecht = in het rood)
    //   sleutel kiest het plaatje (icoon-hout), naam is de Engelse naam.
    toonVoorraad(lijst) {
      el('voorraad-lijst').textContent = '';
      for (const { sleutel, naam, aantal, slecht } of lijst) {
        const vak = document.createElement('span');
        vak.className = 'grondstof' + (slecht ? ' slecht' : '');
        vak.dataset.naam = naam;
        vak.dataset.sleutel = sleutel || naam.toLowerCase();
        vak.title = naam;
        const icoon = document.createElement('i');
        icoon.className = `icoon icoon-${sleutel || naam.toLowerCase()}`;
        const getal = document.createElement('b');
        getal.textContent = aantal;
        vak.append(icoon, getal);
        el('voorraad-lijst').appendChild(vak);
      }
      el('voorraad').setAttribute('aria-label', lijst.map((g) => `${g.naam} ${g.aantal}`).join(', '));
    },
    // Het paneel over je volk. regels = de zinnen, tarieven = de standen
    // van de belasting [{ naam, uitleg }], gekozen = welke stand aanstaat.
    toonVolk({ regels, tarieven, gekozen }) {
      el('volk-tekst').textContent = '';
      for (const regel of regels) {
        const p = document.createElement('div');
        p.textContent = regel;
        el('volk-tekst').appendChild(p);
      }
      const balk = el('volk-belasting');
      if (!balk.children.length) {
        tarieven.forEach((tarief, stand) => {
          const knop = document.createElement('button');
          knop.type = 'button';
          knop.dataset.stand = stand;
          knop.append(tarief.naam, document.createElement('small'));
          knop.addEventListener('click', () => kiesBelasting(stand));
          balk.appendChild(knop);
        });
      }
      tarieven.forEach((tarief, stand) => {
        balk.children[stand].classList.toggle('actief', stand === gekozen);
        balk.children[stand].lastChild.textContent = tarief.uitleg;
      });
    },
    opBelasting(functie) {
      kiesBelasting = functie;
    },
    // De aanvallen. kort = wat er bovenin achter het vaantje staat (de tijd
    // tot de volgende aanval, of "Aanval!"), lang = de zin in het paneel
    // over je volk, slecht = in het rood.
    toonStrijd({ kort, lang, slecht }) {
      el('strijdinfo').hidden = !kort;
      el('strijdinfo').classList.toggle('slecht', !!slecht);
      el('strijdinfo').title = lang || '';
      if (el('strijd-kort').textContent !== kort) el('strijd-kort').textContent = kort;
      if (el('volk-strijd').textContent !== lang) el('volk-strijd').textContent = lang || '';
    },
    // Het beginscherm. weergave = 'voorpagina' of 'kaart'.
    toonTitel({ open, weergave = 'voorpagina', kanVerder = false }) {
      el('titelscherm').hidden = !open;
      if (!open) return;
      el('titelscherm').classList.toggle('op-kaart', weergave === 'kaart');
      el('titel-beeld').hidden = weergave !== 'voorpagina';
      el('titel-voorpagina').hidden = weergave !== 'voorpagina';
      el('titel-kaart').hidden = weergave !== 'kaart';
      el('titel-verder').hidden = !kanVerder;
    },
    // De levelkaart: het schilderij met de weg, de brug en de punten erbovenop.
    // levels = [{ id, naam, portret, x, y (procenten van het beeld), staat: 'open'|'gewonnen'|'dicht'|'nu'|'later' }].
    // kaartdata = data/levelkaart.json (beeld, route, brug, pos per level).
    toonLevelkaart(levels, opKies, tekst = '', kaartdata) {
      const NS = 'http://www.w3.org/2000/svg';
      const B = kaartdata.breedte, H = kaartdata.hoogte;   // we tekenen in pixels van het schilderij
      const doek = el('kaart-doek');
      doek.replaceChildren();
      const vlak = document.createElement('div');
      vlak.className = 'kaartvlak';
      vlak.style.aspectRatio = `${B} / ${H}`;
      const beeld = document.createElement('img');
      beeld.className = 'kaartbeeld';
      beeld.src = kaartdata.beeld;
      beeld.alt = '';
      beeld.decoding = 'async';
      vlak.appendChild(beeld);
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', `0 0 ${B} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      const maak = (naam, attr, tekstInhoud) => {
        const n = document.createElementNS(NS, naam);
        for (const [k, v] of Object.entries(attr)) n.setAttribute(k, v);
        if (tekstInhoud !== undefined) n.textContent = tekstInhoud;
        return n;
      };
      const R = 62;   // straal van een punt
      const KLEUR = { open: '#e0b94a', gewonnen: '#6ea65a', dicht: '#8b8b82', later: '#8b8b82', nu: '#c8372b' };

      // De brug over de kloof: de weg is daar op het schilderij onderbroken.
      // Hij steekt aan beide kanten een stuk over de rand, zodat je hem ook ziet naast het portret.
      const [ax, ay] = [kaartdata.brug.van[0] * B, kaartdata.brug.van[1] * H];
      const [cx, cy] = [kaartdata.brug.naar[0] * B, kaartdata.brug.naar[1] * H];
      const kaal = Math.hypot(cx - ax, cy - ay);
      const [ux, uy] = [(cx - ax) / kaal, (cy - ay) / kaal];
      const OVER = 46;
      const [bx1, by1] = [ax - ux * OVER, ay - uy * OVER];
      const lengte = kaal + 2 * OVER;
      const hoek = (Math.atan2(cy - ay, cx - ax) * 180) / Math.PI;
      const brug = maak('g', { class: 'brug', transform: `translate(${bx1} ${by1}) rotate(${hoek})` });
      brug.appendChild(maak('rect', { x: -6, y: -22, width: lengte + 12, height: 52, rx: 8, class: 'brug-schaduw' }));
      brug.appendChild(maak('rect', { x: 0, y: -26, width: lengte, height: 52, rx: 6, class: 'brug-dek' }));
      for (let k = 18; k < lengte - 6; k += 24) brug.appendChild(maak('line', { x1: k, y1: -26, x2: k, y2: 26, class: 'brug-plank' }));
      brug.appendChild(maak('rect', { x: -10, y: -34, width: lengte + 20, height: 9, rx: 4, class: 'brug-leuning' }));
      brug.appendChild(maak('rect', { x: -10, y: 25, width: lengte + 20, height: 9, rx: 4, class: 'brug-leuning' }));
      for (const [k, y] of [[-10, -34], [lengte + 4, -34], [-10, 25], [lengte + 4, 25]]) brug.appendChild(maak('rect', { x: k, y: y - 5, width: 12, height: 19, rx: 3, class: 'brug-paal' }));
      svg.appendChild(brug);

      // De weg kleurt goud tot het laatst gewonnen level (ook als je de proloog oversloeg).
      const route = kaartdata.route.map(([x, y]) => `${(x * B).toFixed(1)} ${(y * H).toFixed(1)}`).join(' L ');
      let tot = 0;
      for (let i = 0; i + 1 < levels.length; i++) {
        if (levels[i].staat === 'gewonnen' || (i === 0 && levels[1].staat === 'gewonnen')) tot = kaartdata.pos[String(levels[i + 1].id)] ?? tot;
        else break;
      }
      if (tot > 0) {
        for (const klasse of ['weg-rand', 'weg-goud']) {
          svg.appendChild(maak('path', { d: `M ${route}`, class: klasse, pathLength: 1000, 'stroke-dasharray': `${Math.round(tot * 1000)} 1001` }));
        }
      }

      const defs = maak('defs', {});
      const knip = maak('clipPath', { id: 'rond-portret', clipPathUnits: 'objectBoundingBox' });
      knip.appendChild(maak('circle', { cx: 0.5, cy: 0.5, r: 0.5 }));
      defs.appendChild(knip);
      svg.appendChild(defs);

      for (const l of levels) {
        const x = (l.x / 100) * B, y = (l.y / 100) * H;
        const groep = maak('g', { class: `punt ${l.staat}`, 'data-id': l.id, tabindex: 0 });
        groep.appendChild(maak('circle', { cx: x, cy: y, r: R + 26, class: 'tikvlak' }));
        groep.appendChild(maak('circle', { cx: x, cy: y, r: R + 5, class: 'rand' }));
        groep.appendChild(maak('circle', { cx: x, cy: y, r: R, class: 'rond', stroke: KLEUR[l.staat] || KLEUR.open }));
        if (l.portret) groep.appendChild(maak('image', { href: `beelden/portretten/${l.portret}.jpg`, x: x - (R - 5), y: y - (R - 5), width: 2 * (R - 5), height: 2 * (R - 5), 'clip-path': 'url(#rond-portret)', class: 'gezicht' }));
        // De stand van een punt: een groen zegel met vinkje, of een slot. Geen cijfers.
        if (l.staat === 'gewonnen' || l.staat === 'dicht' || l.staat === 'later') {
          const sx = x + R * 0.74, sy = y + R * 0.74;
          const zegel = maak('g', { class: 'zegel', transform: `translate(${sx} ${sy})` });
          zegel.appendChild(maak('circle', { r: 25, class: 'zegel-rond' }));
          if (l.staat === 'gewonnen') {
            zegel.appendChild(maak('path', { d: 'M -11 1 L -3 9 L 12 -9', class: 'vinkje' }));
          } else {
            zegel.appendChild(maak('path', { d: 'M -6 -2 L -6 -8 A 6 6 0 0 1 6 -8 L 6 -2', class: 'beugel' }));
            zegel.appendChild(maak('rect', { x: -10, y: -3, width: 20, height: 15, rx: 3, class: 'slot' }));
          }
          groep.appendChild(zegel);
        }
        // De naam staat onder het punt; bij Grauwvoort erboven, want onder zit Witte Dijk dichtbij.
        groep.appendChild(maak('text', { x, y: l.id === 7 ? y - R - 22 : y + R + 46, class: 'naam' }, l.naam));
        svg.appendChild(groep);
      }
      svg.addEventListener('click', (e) => {
        const g = e.target.closest('.punt');
        if (g) opKies(Number(g.dataset.id));
      });
      vlak.appendChild(svg);
      doek.appendChild(vlak);
      el('kaart-tekst').textContent = tekst;
    },
    opTitel({ campagne, vrij, verder, terug }) {
      el('titel-campagne').addEventListener('click', campagne);
      el('titel-vrij').addEventListener('click', vrij);
      el('titel-verder').addEventListener('click', verder);
      el('kaart-terug').addEventListener('click', terug);
    },
    // Het menu. items = [{ groep, naam, tekst, sleutel, nu, kan }] (groep zet een kopje neer
    // als hij verschilt van de vorige), nu = tekst bovenaan.
    toonMenu({ open, nu = '', items = [] }) {
      el('menu').hidden = !open;
      if (!open) return;
      el('menu-nu').textContent = nu;
      el('menu-lijst').replaceChildren();
      let groep = null;
      for (const it of items) {
        if (it.groep !== groep) {
          groep = it.groep;
          const kop = document.createElement('div');
          kop.className = 'groep';
          kop.textContent = groep;
          el('menu-lijst').appendChild(kop);
        }
        const knop = document.createElement('button');
        knop.type = 'button';
        knop.dataset.sleutel = it.sleutel;
        knop.disabled = it.kan === false;
        knop.classList.toggle('nu', !!it.nu);
        knop.textContent = it.naam;
        if (it.tekst) {
          const klein = document.createElement('small');
          klein.textContent = it.tekst;
          knop.appendChild(klein);
        }
        el('menu-lijst').appendChild(knop);
      }
    },
    // De rol rechtsonder: functie() geeft { titel, tegen, tekst, taak, portret }.
    opDoel(functie) {
      el('knop-menu').addEventListener('click', () => {
        if (!el('doelpaneel').hidden) { klapDoel(false); return; }
        const d = functie();
        el('doel-titel').textContent = d.titel || '';
        el('doel-tegen').textContent = d.tegen || '';
        el('doel-tegen').hidden = !d.tegen;
        el('doel-tekst').textContent = d.tekst || '';
        el('doel-taak').textContent = d.taak || '';
        el('doel-portret').hidden = !d.portret;
        if (d.portret) el('doel-portret').src = `beelden/portretten/${d.portret}.jpg`;
        klapInstellingen(false);
        klapDoel(true);
      });
    },
    // Proloog: de taak van nu (leeg = weg).
    toonTaak(tekst) {
      el('taak').textContent = tekst || '';
      el('taak').hidden = !tekst;
    },
    // Proloog: een scène van een paar kaarten [{ naam, portret, tekst }].
    // Tik Next voor de volgende; na de laatste roept hij klaar() aan.
    toonScene(kaarten, klaar) {
      let i = 0;
      const toon = () => {
        const k = kaarten[i];
        el('scene-wie').textContent = k.naam || '';
        el('scene-tekst').textContent = k.tekst || '';
        zetPortret('scene-portret', k.portret ? { naam: k.naam, portret: k.portret } : null);
        el('scene-verder').textContent = i === kaarten.length - 1 ? 'To the map' : 'Next';
      };
      el('scene-verder').onclick = () => {
        if (i < kaarten.length - 1) { i++; toon(); return; }
        el('scene').hidden = true;
        klaar();
      };
      toon();
      el('meldingen').textContent = '';   // de scène staat alleen in beeld
      el('scene').hidden = false;
    },
    // De knoppen achter het tandwiel. Na een keuze gaat het menu dicht.
    opMenuActies({ opslaan, levels, hoofdmenu }) {
      el('knop-opslaan').addEventListener('click', () => { klapInstellingen(false); opslaan(); });
      el('knop-levels').addEventListener('click', () => { klapInstellingen(false); levels(); });
      el('knop-hoofdmenu').addEventListener('click', () => { klapInstellingen(false); hoofdmenu(); });
    },
    opMenu(functie) {
      el('knop-levels').addEventListener('click', functie);
      el('menu-sluit').addEventListener('click', () => (el('menu').hidden = true));
    },
    opMenuKeuze(functie) {
      el('menu-lijst').addEventListener('click', (e) => {
        const knop = e.target.closest('button');
        if (knop && !knop.disabled) functie(knop.dataset.sleutel);
      });
    },
    // De intro van een missie.
    // De briefing voor een level. spreker = { naam, portret } van wie vertelt,
    // tegen = { naam, portret } van de heer, extra = regels onder de tekst.
    toonMissie({ open, titel = '', tekst = '', spreker = null, tegen = null, extra = [] }) {
      el('missie').hidden = !open;
      if (!open) return;
      el('missie-titel').textContent = titel;
      el('missie-tekst').textContent = tekst;
      zetPortret('missie-portret', spreker);
      el('missie-wie').textContent = spreker ? spreker.naam : '';
      zetPortret('missie-heer', tegen);
      el('missie-heer-naam').textContent = tegen ? tegen.naam : '';
      el('missie-tegen').hidden = !tegen;
      const lijst = el('missie-extra');
      lijst.textContent = '';
      for (const r of extra) {
        const regel = document.createElement('div');
        regel.textContent = r;
        lijst.appendChild(regel);
      }
    },
    // Een bericht in de verhaalbalk: portret, naam en tekst. Komen er meer
    // tegelijk, dan wachten ze op hun beurt. Tik om het weg te halen.
    toonVerhaal({ naam, portret, tekst }) {
      logboek.push({ tekst, soort: 'verhaal', tijd: speeltijd(), wie: naam });
      if (!el('logboek').hidden) tekenLogboek();
      else { ongelezen++; zetTeller(); }
      verhaalRij.push({ naam, portret, tekst });
      if (el('verhaal').hidden) volgendVerhaal();
    },
    verbergVerhaal() {
      verhaalRij.length = 0;
      clearTimeout(verhaalKlok);
      el('verhaal').hidden = true;
      zetAdviseur(null);
    },
    opMissieBegin(functie) {
      el('missie-begin').addEventListener('click', functie);
    },
    opVolgende(functie) {
      el('einde-volgende').addEventListener('click', functie);
    },
    // Het venster bij winst of verlies. verder = de knop "Verder spelen" tonen.
    // portret = { naam, portret } bij de terugblik; wessel = het voorwerp van
    // Wessel (tekst); erbij = wat je vrijspeelt (tekst).
    toonEinde({ open, titel = '', tekst = '', verder = false, verloren = false, volgende = false, portret = null, wessel = '', erbij = '' }) {
      el('einde').hidden = !open;
      if (!open) return;
      el('einde').classList.toggle('verloren', verloren);
      el('einde-titel').textContent = titel;
      el('einde-tekst').textContent = tekst;
      zetPortret('einde-portret', portret);
      el('einde-wessel').hidden = !wessel;
      el('einde-wessel-tekst').textContent = wessel;
      el('einde-erbij').hidden = !erbij;
      el('einde-erbij').textContent = erbij;
      el('einde-verder').hidden = !verder;
      el('einde-volgende').hidden = !volgende;
    },
    opVerder(functie) {
      el('einde-verder').addEventListener('click', functie);
    },
    opEindeOpnieuw(functie) {
      el('einde-opnieuw').addEventListener('click', functie);
    },
    // Het paneel van de kazerne. open = laten zien, regels = de zinnen,
    // knoppen = [{ sleutel, naam, kost, kan }] (kan = false: dof).
    toonKazerne({ open, regels = [], knoppen = [] }) {
      el('legerpaneel').hidden = !open;
      if (!open) return;
      klapVolk(false);
      el('handelpaneel').hidden = true;
      el('leger-tekst').textContent = '';
      for (const regel of regels) {
        const p = document.createElement('div');
        p.textContent = regel;
        el('leger-tekst').appendChild(p);
      }
      const balk = el('leger-opleiden');
      const teken = knoppen.map((k) => k.sleutel).join();
      if (balk.dataset.teken !== teken) {
        balk.dataset.teken = teken;
        balk.replaceChildren();
        for (const { sleutel, naam } of knoppen) {
          const knop = document.createElement('button');
          knop.type = 'button';
          knop.dataset.soldaat = sleutel;
          knop.append(naam, document.createElement('small'));
          knop.addEventListener('click', () => leidOp(sleutel));
          balk.appendChild(knop);
        }
      }
      knoppen.forEach((k, i) => {
        balk.children[i].lastChild.textContent = k.kost;
        balk.children[i].classList.toggle('kanniet', !k.kan);
      });
    },
    // Het paneel van de voorraadkamer: verkopen voor goud.
    //   knoppen = [{ sleutel, naam, kost, kan }]
    toonHandel({ open, regels = [], knoppen = [] }, opVerkoop) {
      el('handelpaneel').hidden = !open;
      if (!open) return;
      klapVolk(false);
      el('legerpaneel').hidden = true;
      el('handel-tekst').replaceChildren(...regels.map((r) => { const p = document.createElement('div'); p.textContent = r; return p; }));
      const balk = el('handel-knoppen');
      // Dezelfde knoppen bijwerken in plaats van vervangen: anders mis je een
      // tik als de voorraad net verandert terwijl je drukt.
      const teken = knoppen.map((k) => k.sleutel).join();
      if (balk.dataset.teken !== teken) {
        balk.dataset.teken = teken;
        balk.replaceChildren(...knoppen.map((k) => {
          const knop = document.createElement('button');
          knop.type = 'button';
          knop.dataset.verkoop = k.sleutel;
          knop.append(document.createElement('span'), document.createElement('small'));
          knop.addEventListener('click', () => verkoopActie(k.sleutel));
          return knop;
        }));
      }
      verkoopActie = opVerkoop;
      knoppen.forEach((k, i) => {
        const knop = balk.children[i];
        knop.firstChild.textContent = k.naam;
        knop.lastChild.textContent = k.kost;
        knop.classList.toggle('kanniet', !k.kan);
      });
    },
    opHandelSluit(functie) {
      el('handel-sluit').addEventListener('click', functie);
    },
    opOpleiden(functie) {
      leidOp = functie;
    },
    opKazerneSluit(functie) {
      el('leger-sluit').addEventListener('click', functie);
    },
    // De knoppen en de uitleg voor je soldaten.
    //   zichtbaar = de knoppen tonen, hint = de zin erboven,
    //   kader = de knop Kader staat aan, gekozen = er is iemand gekozen
    toonLeger({ zichtbaar, hint, kader, gekozen }) {
      // Kies je soldaten op de kaart, dan gaat het zwaard vanzelf open.
      if (gekozen && !legerStand.gekozen && paneel !== 'bouw') paneel = 'leger';
      legerStand = { zichtbaar, gekozen };
      zetPaneel(paneel);
      el('legerhint').textContent = hint || '';
      el('legerhint').hidden = !hint;
      el('knop-kader').classList.toggle('actief', !!kader);
      el('knop-niets').hidden = !gekozen;
    },
    // De knoppen om een groep of soort te kiezen. lijst = [{ tekst, sleutel, actief }].
    toonGroepen(lijst, opKies) {
      const doos = el('leger-groepen');
      const teken = lijst.map((k) => `${k.sleutel}|${k.tekst}|${k.actief ? 1 : 0}`).join(';');
      if (doos.dataset.teken === teken) return;
      doos.dataset.teken = teken;
      doos.dataset.leeg = lijst.length === 0 ? '1' : '0';
      doos.hidden = lijst.length === 0 || paneel !== 'leger' || !legerStand.zichtbaar;
      doos.textContent = '';
      for (const k of lijst) {
        const knop = document.createElement('button');
        knop.type = 'button';
        knop.textContent = k.tekst;
        if (k.actief) knop.classList.add('actief');
        if (k.klein) knop.classList.add('klein');
        knop.addEventListener('click', () => opKies(k.sleutel));
        doos.appendChild(knop);
      }
    },
    opKader(functie) {
      el('knop-kader').addEventListener('click', functie);
    },
    opAlle(functie) {
      el('knop-alle').addEventListener('click', functie);
    },
    opNiets(functie) {
      el('knop-niets').addEventListener('click', functie);
    },

    // --- De prestatietest ---------------------------------------------------
    toonProef({ aantal, wachtend, tekenMs, rekenMs }) {
      el('proef-cijfers').textContent =
        `${aantal} figures · drawing ${komma(tekenMs)} ms · logic ${komma(rekenMs)} ms` +
        (wachtend ? ` · ${wachtend} waiting for a route` : '');
    },
    zetAantalKnop(aantal) {
      el('knop-aantal').textContent = `Figures: ${aantal}`;
    },
    opAantal(functie) {
      el('knop-aantal').addEventListener('click', functie);
    },
    opMeting(functie) {
      el('knop-meting').addEventListener('click', functie);
    },
    toonVoortgang(tekst) {
      el('voortgang').textContent = tekst;
      el('voortgang').hidden = !tekst;
      el('knop-meting').disabled = !!tekst;
      el('knop-aantal').disabled = !!tekst;
      el('knop-opnieuw').disabled = !!tekst;
      // Tijdens een meting kun je niet bouwen.
      for (const knop of el('bouw-knoppen').children) knop.disabled = !!tekst;
    },
    toonUitslag(tekst) {
      el('uitslag-tekst').textContent = tekst;
      el('uitslag').hidden = false;
    },

    // --- Bouwen ---------------------------------------------------------------
    // Bouwt de bouwbalk op. Eerst zie je de groepen (Kasteel, Werk) en
    // Slopen. Tik je een groep aan, dan zie je wat daarin zit, met een
    // knop om terug te gaan. Zo past de balk altijd op het scherm.
    //   groepen = { sleutel: naam }, knoppen = [{ sleutel, naam, kost, groep }]
    // kost is de prijs als tekst ("2 steen") en staat klein onder de naam.
    maakBouwbalk(groepen, knoppen, opKies, opTerug) {
      const balk = el('bouw-knoppen');
      const maak = (tekst, klik) => {
        const knop = document.createElement('button');
        knop.type = 'button';
        knop.textContent = tekst;
        knop.addEventListener('click', klik);
        balk.appendChild(knop);
        return knop;
      };
      for (const [groep, naam] of Object.entries(groepen)) {
        maak(naam, () => toonGroep(groep)).dataset.open = groep;
      }
      const terug = maak('‹ Back', () => {
        toonGroep(null);
        opTerug();
      });
      terug.id = 'knop-terug';
      for (const { sleutel, naam, kost, groep } of knoppen) {
        const knop = maak(naam, () => opKies(sleutel));
        if (kost) {
          const prijs = document.createElement('small');
          prijs.textContent = kost;
          knop.appendChild(prijs);
        }
        knop.dataset.sleutel = sleutel;
        if (groep) knop.dataset.groep = groep;
        if (sleutel === 'sloop') {
          const img = document.createElement('img');
          img.src = 'beelden/hud/slopen.webp';
          img.alt = '';
          img.className = 'knop-ikoon';
          knop.prepend(img);
        }
      }
      toonGroep(null);
      zetPaneel(paneel);
    },
    // Laat zien waar je mee bezig bent: welke knop actief is, de uitleg
    // erboven, en of je kunt neerzetten.
    zetBouwStand({ actief, hint, bevestigTekst, kanBevestigen }) {
      for (const knop of el('bouw-knoppen').children) {
        const isActief = !!actief && knop.dataset.sleutel === actief;
        knop.classList.toggle('actief', isActief);
        // Zit wat je bouwt in een andere groep dan er openstaat, dan gaat die open.
        if (isActief && knop.hidden) toonGroep(knop.dataset.groep || null);
      }
      el('bouwhint').textContent = hint || '';
      el('bouwhint').hidden = !hint;
      el('bouw-acties').hidden = !actief;
      bouwtNu = !!actief;
      zetPaneel(paneel);
      el('knop-bevestig').textContent = bevestigTekst || 'Place';
      el('knop-bevestig').disabled = !kanBevestigen;
      el('knop-bevestig').classList.toggle('gevaar', actief === 'sloop');
      // Tijdens het bouwen is de ruimte onderin nodig voor de uitleg.
      el('tip').classList.toggle('weg', !!actief);
    },
    opBevestig(functie) {
      el('knop-bevestig').addEventListener('click', functie);
    },
    opKlaar(functie) {
      el('knop-klaar').addEventListener('click', functie);
    },
    // Opnieuw beginnen vraagt om een tweede tik, zodat je niet per ongeluk
    // je kasteel kwijtraakt.
    opOpnieuw(functie) {
      const knop = el('knop-opnieuw');
      let zeker = null;
      const rust = () => {
        clearTimeout(zeker);
        zeker = null;
        knop.textContent = 'Start over';
        knop.classList.remove('gevaar');
      };
      knop.addEventListener('click', () => {
        if (zeker) {
          rust();
          klapInstellingen(false);
          functie();
          return;
        }
        knop.textContent = 'Are you sure? Tap again';
        knop.classList.add('gevaar');
        zeker = setTimeout(rust, 4000);
      });
    },
  };
}
