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
  const klapVolk = (open) => {
    el('volkpaneel').hidden = !open;
    el('voorraad').classList.toggle('open', open);
  };
  el('voorraad').addEventListener('click', () => {
    el('legerpaneel').hidden = true;
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
      el('titel-voorpagina').hidden = weergave !== 'voorpagina';
      el('titel-kaart').hidden = weergave !== 'kaart';
      el('titel-verder').hidden = !kanVerder;
    },
    // De levelkaart. levels = [{ id, naam, x, y, staat: 'open'|'gewonnen'|'dicht'|'nu' }].
    toonLevelkaart(levels, opKies, tekst = '') {
      const NS = 'http://www.w3.org/2000/svg';
      const doek = el('kaart-doek');
      doek.replaceChildren();
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 400 200');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      const maak = (naam, attr, tekstInhoud) => {
        const n = document.createElementNS(NS, naam);
        for (const [k, v] of Object.entries(attr)) n.setAttribute(k, v);
        if (tekstInhoud !== undefined) n.textContent = tekstInhoud;
        return n;
      };
      svg.appendChild(maak('rect', { x: 0, y: 0, width: 400, height: 200, class: 'perkament' }));
      // Een paar heuvels en bomen als versiering.
      for (const [x, y, r] of [[60, 150, 26], [140, 170, 20], [330, 150, 30], [250, 60, 18], [350, 40, 22], [90, 40, 20]]) svg.appendChild(maak('ellipse', { cx: x, cy: y, rx: r * 1.4, ry: r * 0.7, class: 'heuvel' }));
      for (const [x, y] of [[40, 110], [200, 140], [290, 110], [120, 90], [370, 100], [210, 30]]) {
        svg.appendChild(maak('rect', { x: x - 1, y: y, width: 2, height: 6, class: 'stam' }));
        svg.appendChild(maak('circle', { cx: x, cy: y - 2, r: 6, class: 'boom' }));
      }
      const pt = (l) => [l.x * 4, l.y * 2];
      if (levels.length > 1) svg.appendChild(maak('polyline', { points: levels.map((l) => pt(l).join(',')).join(' '), class: 'pad' }));
      for (const l of levels) {
        const [x, y] = pt(l);
        const groep = maak('g', { class: `punt ${l.staat}`, 'data-id': l.id, tabindex: 0 });
        groep.appendChild(maak('circle', { cx: x, cy: y, r: 22, class: 'tikvlak' }));
        groep.appendChild(maak('circle', { cx: x, cy: y, r: 15, class: 'rond' }));
        groep.appendChild(maak('text', { x, y: y + 5, class: 'cijfer' }, l.staat === 'dicht' ? '🔒' : l.staat === 'gewonnen' ? '✔' : String(l.id)));
        groep.appendChild(maak('text', { x, y: y + 34, class: 'naam' }, l.naam));
        svg.appendChild(groep);
      }
      svg.addEventListener('click', (e) => {
        const g = e.target.closest('.punt');
        if (g) opKies(Number(g.dataset.id));
      });
      doek.appendChild(svg);
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
      el('leger-tekst').textContent = '';
      for (const regel of regels) {
        const p = document.createElement('div');
        p.textContent = regel;
        el('leger-tekst').appendChild(p);
      }
      const balk = el('leger-opleiden');
      if (!balk.children.length) {
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
