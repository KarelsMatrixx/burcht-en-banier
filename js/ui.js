// UI: de tekst en knoppen bovenop het spel (gewone HTML, geen canvas).

import { CONFIG } from './config.js';

const komma = (getal) => getal.toFixed(1).replace('.', ',');

export function maakUi() {
  const el = (id) => document.getElementById(id);
  let beelden = '';
  let offline = false;

  el('versie').textContent = `stap ${CONFIG.stap} · v${CONFIG.versie}`;

  const werkStatusBij = () => {
    el('status').textContent = [beelden, offline ? 'offline klaar' : 'offline nog niet klaar']
      .filter(Boolean)
      .join(' · ');
  };
  werkStatusBij();

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
  el('voorraad').addEventListener('click', () => {
    el('legerpaneel').hidden = true;
    el('handelpaneel').hidden = true;
    klapVolk(el('volkpaneel').hidden);
  });
  el('volk-sluit').addEventListener('click', () => klapVolk(false));

  // De knop Test klapt het paneel van de prestatietest open en dicht.
  el('knop-test').addEventListener('click', () => {
    el('proef').hidden = !el('proef').hidden;
    el('knop-test').classList.toggle('actief', !el('proef').hidden);
  });

  return {
    toonBeelden(aantal) {
      beelden = `${aantal} beelden/s`;
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
    toonMelding(tekst) {
      const regel = document.createElement('div');
      regel.className = 'plaat melding';
      regel.textContent = tekst;
      el('meldingen').appendChild(regel);
      // Hooguit drie berichten tegelijk: anders zie je de kaart niet meer.
      while (el('meldingen').children.length > 3) el('meldingen').firstChild.remove();
      setTimeout(() => regel.remove(), 8000);
    },
    opNaarStart(functie) {
      el('knop-start').addEventListener('click', functie);
    },
    // De voorraad bovenin: een plaatje en een getal per soort. De namen
    // staan in het paneel dat opent als je de voorraad aantikt.
    //   lijst = [{ naam, aantal, slecht }]   (slecht = in het rood)
    toonVoorraad(lijst) {
      el('voorraad-lijst').textContent = '';
      for (const { naam, aantal, slecht } of lijst) {
        const vak = document.createElement('span');
        vak.className = 'grondstof' + (slecht ? ' slecht' : '');
        vak.dataset.naam = naam;
        vak.title = naam;
        const icoon = document.createElement('i');
        icoon.className = `icoon icoon-${naam.toLowerCase()}`;
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

      // De weg kleurt goud tot het laatst gewonnen level.
      const route = kaartdata.route.map(([x, y]) => `${(x * B).toFixed(1)} ${(y * H).toFixed(1)}`).join(' L ');
      let tot = 0;
      for (let i = 0; i + 1 < levels.length; i++) {
        if (levels[i].staat === 'gewonnen' || (i === 0 && levels[0].staat === 'later')) tot = kaartdata.pos[String(levels[i + 1].id)] ?? tot;
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
    opMenu(functie) {
      el('knop-menu').addEventListener('click', functie);
      el('menu-sluit').addEventListener('click', () => (el('menu').hidden = true));
    },
    opMenuKeuze(functie) {
      el('menu-lijst').addEventListener('click', (e) => {
        const knop = e.target.closest('button');
        if (knop && !knop.disabled) functie(knop.dataset.sleutel);
      });
    },
    // De intro van een missie.
    toonMissie({ open, titel = '', tekst = '' }) {
      el('missie').hidden = !open;
      if (!open) return;
      el('missie-titel').textContent = titel;
      el('missie-tekst').textContent = tekst;
    },
    opMissieBegin(functie) {
      el('missie-begin').addEventListener('click', functie);
    },
    opVolgende(functie) {
      el('einde-volgende').addEventListener('click', functie);
    },
    // Het venster bij winst of verlies. verder = de knop "Verder spelen" tonen.
    toonEinde({ open, titel = '', tekst = '', verder = false, verloren = false, volgende = false }) {
      el('einde').hidden = !open;
      if (!open) return;
      el('einde').classList.toggle('verloren', verloren);
      el('einde-titel').textContent = titel;
      el('einde-tekst').textContent = tekst;
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
      el('leger-balk').hidden = !zichtbaar;
      if (!zichtbaar) el('leger-groepen').hidden = true;
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
      doos.hidden = lijst.length === 0;
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
        `${aantal} figuren · tekenen ${komma(tekenMs)} ms · rekenen ${komma(rekenMs)} ms` +
        (wachtend ? ` · ${wachtend} wachten op route` : '');
    },
    zetAantalKnop(aantal) {
      el('knop-aantal').textContent = `Figuren: ${aantal}`;
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
      const terug = maak('‹ Terug', () => {
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
      }
      toonGroep(null);
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
      el('knop-bevestig').textContent = bevestigTekst || 'Zet neer';
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
        knop.textContent = 'Opnieuw beginnen';
        knop.classList.remove('gevaar');
      };
      knop.addEventListener('click', () => {
        if (zeker) {
          rust();
          functie();
          return;
        }
        knop.textContent = 'Zeker weten? Tik nog eens';
        knop.classList.add('gevaar');
        zeker = setTimeout(rust, 4000);
      });
    },
  };
}
