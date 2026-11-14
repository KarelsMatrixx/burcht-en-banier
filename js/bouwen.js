// BOUWEN: de regels voor het plaatsen en slopen van bouwwerken.
//
// Welke bouwwerken er zijn staat in data/bouwwerken.json. Deze module
// beslist of iets ergens mag staan, zet het op de kaart en zorgt dat de
// rest van het spel het weet: looproutes, plaatjes, schaduwen en opslag.
//
// Bouwen kost grondstoffen (zie economie.js). Slopen geeft een deel terug.

import { CONFIG } from './config.js';
import { GROND, OBJECT, binnenKaart, aansluiting } from './kaart.js';

export const SPELER = 1;   // eigenaar van wat de speler zelf bouwt

// Geeft { bouwwerken, groepen } terug: wat je kunt bouwen, en de groepen
// waarin de bouwbalk is verdeeld.
export async function laadBouwwerken() {
  const antwoord = await fetch('data/bouwwerken.json');
  if (!antwoord.ok) throw new Error('Kan data/bouwwerken.json niet laden');
  const gegevens = await antwoord.json();
  const lijst = gegevens.bouwwerken;
  const soortVan = (naam, bij) => {
    if (OBJECT[naam] === undefined) throw new Error(`bouwwerken.json: onbekend object "${naam}" bij ${bij}`);
    return OBJECT[naam];
  };
  for (const [sleutel, werk] of Object.entries(lijst)) {
    werk.sleutel = sleutel;
    werk.soort = soortVan(werk.object, sleutel);
    if (werk.dichtbij) werk.dichtbij.soort = soortVan(werk.dichtbij.object, sleutel);
    if (!gegevens.groepen[werk.groep]) throw new Error(`bouwwerken.json: onbekende groep "${werk.groep}" bij ${sleutel}`);
  }
  return { bouwwerken: lijst, groepen: gegevens.groepen };
}

// opVerandering wordt aangeroepen na elke keer bouwen of slopen, zodat
// het kasteel bewaard kan worden.
export function maakBouwer({ kaart, wegvinder, tekenaar, eenheden, economie, bouwwerken, opVerandering, bouwStraal = 0 }) {
  const B = kaart.breedte;

  // Bij elke soort op de kaart het bouwwerk uit bouwwerken.json.
  const werkVan = new Map(Object.values(bouwwerken).map((werk) => [werk.soort, werk]));

  const isVanSpeler = (x, y) => binnenKaart(kaart, x, y) && kaart.eigenaar[y * B + x] === SPELER;

  // Geeft een lege tekst als dit bouwwerk hier mag staan, anders de reden.
  function waaromNiet(x, y, werk) {
    if (!binnenKaart(kaart, x, y)) return 'this is off the map';
    const i = y * B + x;
    // Je bouwt alleen in de buurt van je eigen burcht (bouwStraal in economie.json).
    const thuis = kaart.start[0];
    if (bouwStraal > 0 && Math.max(Math.abs(x - thuis.x), Math.abs(y - thuis.y)) > bouwStraal) return 'this is too far from your keep';
    if (kaart.grond[i] === GROND.WATER) return 'this is water';
    const staat = kaart.object[i];

    if (werk && werk.inMuur) {
      // Een poort komt in een gat tussen twee stukken muur, of in de
      // plaats van een eigen stuk muur.
      const eigenMuur = staat === OBJECT.MUUR && kaart.eigenaar[i] === SPELER;
      if (staat !== OBJECT.GEEN && !eigenMuur) return 'something is already here';
      if (staat === OBJECT.GEEN && eenheden.staatOp(x, y)) return 'someone is standing here';
      const buren = aansluiting(kaart, x, y, OBJECT.MUUR);
      const ene = (buren & 2) && (buren & 8);     // muur aan beide kanten, de ene richting
      const andere = (buren & 1) && (buren & 4);  // of de andere richting
      if (ene && andere) return 'a gate cannot go on a crossing of walls';
      if (!ene && !andere) return 'a gate must stand between two pieces of wall';
      return '';
    }

    if (staat !== OBJECT.GEEN) return 'something is already here';
    if (eenheden.staatOp(x, y)) return 'someone is standing here';
    if (werk && werk.dichtbij && !isDichtbij(x, y, werk.dichtbij)) return werk.dichtbij.reden;
    return '';
  }

  // Staat er binnen de afstand een object van de gevraagde soort?
  function isDichtbij(x, y, { soort, afstand }) {
    for (let dy = -afstand; dy <= afstand; dy++) {
      for (let dx = -afstand; dx <= afstand; dx++) {
        if (binnenKaart(kaart, x + dx, y + dy) && kaart.object[(y + dy) * B + x + dx] === soort) return true;
      }
    }
    return false;
  }

  // De tegels van een rechte lijn van A naar B. Opeenvolgende tegels
  // raken elkaar altijd met een zijde, zodat een muur dicht is.
  function lijn(ax, ay, bx, by) {
    const dx = Math.abs(bx - ax);
    const dy = Math.abs(by - ay);
    const sx = Math.sign(bx - ax);
    const sy = Math.sign(by - ay);
    const tegels = [{ x: ax, y: ay }];
    let x = ax;
    let y = ay;
    let ix = 0;
    let iy = 0;
    while ((ix < dx || iy < dy) && tegels.length < CONFIG.bouw.langsteLijn) {
      if ((1 + 2 * ix) * dy < (1 + 2 * iy) * dx) {
        x += sx;
        ix++;
      } else {
        y += sy;
        iy++;
      }
      tegels.push({ x, y });
    }
    return tegels;
  }

  // De kaart is veranderd: routes, plaatjes en schaduwen bijwerken.
  function naVerandering(vakken) {
    wegvinder.herbereken();
    tekenaar.kiesPlaatjes();
    eenheden.kaartVeranderd(vakken);
  }

  const bewaar = () => {
    if (opVerandering) opVerandering();
  };

  // Zet het bouwwerk op deze vakken en regelt wat erbij hoort.
  // nieuw = net gebouwd, en niet teruggezet uit de opslag.
  function zetNeer(werk, vakken, nieuw) {
    for (const i of vakken) {
      kaart.object[i] = werk.soort;
      kaart.eigenaar[i] = SPELER;
    }
    naVerandering(vakken);
    if (werk.woont) economie.plekErbij(werk.woont * vakken.size);
    // Een werkplaats krijgt zijn werker pas als de looproutes kloppen.
    if (werk.werker) for (const i of vakken) economie.nieuweWerkplaats(i, werk.werker, nieuw);
  }

  // Zet een bouwwerk op alle tegels waar het mag en betaalt ervoor. Geeft
  // terug hoeveel er geplaatst zijn. Kun je het niet betalen, dan gebeurt
  // er niets.
  function plaats(werk, tegels) {
    const vakken = new Set();
    for (const { x, y } of tegels) {
      if (!waaromNiet(x, y, werk)) vakken.add(y * B + x);
    }
    if (!vakken.size || !economie.betaal(werk.kosten, vakken.size)) return 0;
    zetNeer(werk, vakken, true);
    bewaar();
    return vakken.size;
  }

  // Breekt af wat de speler zelf heeft gebouwd. Je krijgt een deel van
  // de kosten terug.
  // Wat de speler niet mag slopen (de hut van Gesina in level 4).
  const beschermd = new Set();
  function sloop(x, y) {
    if (!isVanSpeler(x, y) || beschermd.has(y * B + x)) return false;
    const i = y * B + x;
    const werk = werkVan.get(kaart.object[i]);
    kaart.object[i] = OBJECT.GEEN;
    kaart.eigenaar[i] = 0;
    naVerandering(new Set([i]));
    // Pas nu de looproutes kloppen: de werker van dit gebouw kan elders verder.
    if (werk && werk.werker) economie.werkplaatsWeg(i);
    if (werk && werk.woont) economie.plekErbij(-werk.woont);
    if (werk) economie.geefTerug(werk.kosten);
    bewaar();
    return true;
  }

  // Dit bouwwerk is kapotgeslagen: het is weg en niemand krijgt iets
  // terug. Dat kan iets van de speler zijn (door de vijand) of iets van
  // rood (door jouw soldaten). Geeft het bouwwerk terug dat er stond, of null.
  function verwoest(x, y) {
    if (!binnenKaart(kaart, x, y)) return null;
    const i = y * B + x;
    const van = kaart.eigenaar[i];
    if (!van) return null;
    const werk = werkVan.get(kaart.object[i]) || null;
    kaart.object[i] = OBJECT.GEEN;
    kaart.eigenaar[i] = 0;
    naVerandering(new Set([i]));
    if (van === SPELER && werk && werk.werker) economie.werkplaatsWeg(i);
    if (van === SPELER && werk && werk.woont) economie.plekErbij(-werk.woont);
    bewaar();
    return werk;
  }

  // Alles wat de speler heeft gebouwd, per bouwwerk een rij getallen:
  // { muur: [x, y, x, y, ...], poort: [x, y] }. Dit is wat er bewaard wordt.
  function eigenBouwwerken() {
    const lijst = {};
    for (let i = 0; i < kaart.eigenaar.length; i++) {
      if (kaart.eigenaar[i] !== SPELER) continue;
      const werk = werkVan.get(kaart.object[i]);
      if (!werk) continue;
      (lijst[werk.sleutel] = lijst[werk.sleutel] || []).push(i % B, Math.floor(i / B));
    }
    return lijst;
  }

  // Zet een bewaard kasteel terug op de kaart, zonder te betalen. Wat
  // niet (meer) past wordt overgeslagen. Geeft terug hoeveel bouwwerken
  // er teruggezet zijn.
  function zetTerug(lijst) {
    let aantal = 0;
    if (!lijst || typeof lijst !== 'object') return 0;
    for (const [sleutel, plekken] of Object.entries(lijst)) {
      const werk = Object.prototype.hasOwnProperty.call(bouwwerken, sleutel) ? bouwwerken[sleutel] : null;
      if (!werk || !Array.isArray(plekken)) continue;
      const vakken = new Set();
      for (let k = 0; k + 1 < plekken.length; k += 2) {
        const x = plekken[k];
        const y = plekken[k + 1];
        if (!Number.isInteger(x) || !Number.isInteger(y) || !binnenKaart(kaart, x, y)) continue;
        const i = y * B + x;
        if (kaart.grond[i] === GROND.WATER || kaart.object[i] !== OBJECT.GEEN) continue;
        vakken.add(i);
      }
      if (vakken.size) zetNeer(werk, vakken, false);
      aantal += vakken.size;
    }
    return aantal;
  }

  // Breekt alles af wat de speler heeft gebouwd, zonder iets terug te
  // geven. Voor opnieuw beginnen.
  function sloopAlles() {
    const vakken = new Set();
    for (let i = 0; i < kaart.eigenaar.length; i++) {
      if (kaart.eigenaar[i] !== SPELER) continue;
      const werk = werkVan.get(kaart.object[i]);
      if (werk && werk.werker) economie.werkplaatsWeg(i);
      kaart.object[i] = OBJECT.GEEN;
      kaart.eigenaar[i] = 0;
      vakken.add(i);
    }
    if (vakken.size) naVerandering(vakken);
    return vakken.size;
  }

  // Het bouwwerk van de speler op deze tegel, of null.
  const werkOp = (x, y) => (isVanSpeler(x, y) ? werkVan.get(kaart.object[y * B + x]) || null : null);

  // Een vast bouwwerk van de speler dat niet in het bouwmenu zit (de hut van
  // Gesina): neerzetten zonder te betalen, en niet te slopen.
  function zetVast(vak, object) {
    kaart.object[vak] = object;
    kaart.eigenaar[vak] = SPELER;
    beschermd.add(vak);
    naVerandering(new Set([vak]));
  }
  return { waaromNiet, lijn, plaats, sloop, verwoest, isVanSpeler, werkOp, eigenBouwwerken, zetTerug, sloopAlles, zetVast };
}
