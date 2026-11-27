// De bouwles (0.124.0): aan het begin van level 1 (Witherheath), na de handelles, leert Bartholt
// je een kasteel bouwen: een muur trekken, er een poort in zetten, een toren ernaast, en slopen.
// Zelfde opzet als de handelles (js/handelles.js): stap voor stap met de gids, zonder klok;
// zolang de les loopt staat de oorlog stil. Alleen wat de les vraagt mag (Karel): de bouwbalk
// staat open voor dat ene bouwwerk, en een tik telt alleen op de gouden plek.
//   1. kaartje: muren houden Reinout buiten; Bartholt brengt de steen mee
//   2. muur: tik de eerste gouden plek, dan de tweede, dan de hamer (een lijn van LENGTE stukken)
//   3. kaartje + poort: tik het midden van de muur, een poort komt in de plaats van dat stuk
//   4. kaartje + toren: een Tower aan het eind van de muur, plek voor 3 schutters
//   5. kaartje + slopen: de metselaars zetten een los stuk muur verkeerd; Demolish, aantikken, hamer
//   6. kaartje: de helft terug, alleen wat je zelf bouwde. Klaar.
// Naar Karel: je moet daarna nog genoeg spullen hebben. Bartholt brengt precies de steen en
// planken die de les kost; je houdt alles wat je had (plus de helft van het gesloopte stuk).
// Is de les al gedaan (bewaard), dan begint hij niet opnieuw.
import { OBJECT } from './kaart.js';

const BARTHOLT = { naam: 'Bartholt', portret: 'bartholt' };
const LENGTE = 5;   // stukken muur

export function maakBouwLes({ gids, bouwer, bouwwerken, kaart, economie, bouwStand, klaarAl = false, wachtOp = () => true, opKlaar = () => {}, sluitPanelen = () => {}, glijNaar = () => {} }) {
  const B = kaart.breedte;
  let fase = klaarAl ? 'klaar' : 'wacht';
  let begin = null;   // eerste stuk muur
  let eind = null;    // laatste stuk muur
  let poort = null;   // het middelste stuk: daar komt de poort
  let toren = null;   // achter het eind van de muur
  let los = null;     // het verkeerde stuk muur van de metselaars
  const muur = bouwwerken.muur;
  const vak = (p) => p.y * B + p.x;
  const isEigen = (p, soort) => kaart.object[vak(p)] === soort && kaart.eigenaar[vak(p)] === 1;
  const muurTegels = () => (begin ? bouwer.lijn(begin.x, begin.y, eind.x, eind.y) : []);
  const zelfde = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;

  // Een rechte rij vrije tegels dicht bij je burcht (niet er tegenaan), met plek voor de toren
  // erachter en een los stuk ernaast. Vrij = de muur mag er staan.
  function kiesPlekken() {
    const thuis = kaart.start[0];
    let beste = null;
    for (let y = 4; y < kaart.hoogte - 4; y++) {
      for (let x = 4; x < B - LENGTE - 5; x++) {
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const rij = [];
          for (let i = 0; i <= LENGTE; i++) rij.push({ x: x + dx * i, y: y + dy * i });   // LENGTE stukken + de toren
          if (rij.some((t) => bouwer.waaromNiet(t.x, t.y, muur))) continue;
          const m = rij[Math.floor(LENGTE / 2)];
          const d = Math.hypot(m.x - thuis.x, m.y - thuis.y);
          if (d < 6 || d > 14) continue;
          // Het losse stuk: twee tegels naast het midden, aan de kant van de burcht als dat kan.
          const kant = dx ? [0, Math.sign(thuis.y - y) || 1] : [Math.sign(thuis.x - x) || 1, 0];
          let l = null;
          for (const s of [1, -1]) {
            const t = { x: m.x + kant[0] * 2 * s, y: m.y + kant[1] * 2 * s };
            if (t.x > 0 && t.y > 0 && t.x < B - 1 && t.y < kaart.hoogte - 1 && !bouwer.waaromNiet(t.x, t.y, muur)) { l = t; break; }
          }
          if (!l) continue;
          const score = Math.abs(d - 8);
          if (!beste || score < beste.score) beste = { score, rij, l };
        }
      }
    }
    if (!beste) return false;
    begin = beste.rij[0];
    eind = beste.rij[LENGTE - 1];
    poort = beste.rij[Math.floor(LENGTE / 2)];
    toren = beste.rij[LENGTE];
    los = beste.l;
    return true;
  }

  // Bartholt brengt wat de les kost: de muur, de poort, de toren en het losse stuk.
  function geefSteen() {
    const kost = {};
    const tel = (w, n) => { for (const [g, a] of Object.entries(w.kosten || {})) kost[g] = (kost[g] || 0) + a * n; };
    tel(muur, LENGTE + 1);
    tel(bouwwerken.poort, 1);
    tel(bouwwerken.wachttoren, 1);
    for (const [g, a] of Object.entries(kost)) economie.lever(g, a);
  }

  function naarKaart(tekst, knop, daarna) {
    gids.stop();
    sluitPanelen();
    fase = 'kaart';
    gids.kaart({ ...BARTHOLT, tekst, knop }, daarna);
  }

  function start() {
    if (!kiesPlekken()) { fase = 'klaar'; opKlaar(); return; }   // geen plek op deze kaart: dan geen les
    fase = 'kaart1';
    sluitPanelen();
    gids.kaart({ ...BARTHOLT, tekst: 'One more thing, Sire. Reinout will come for us, and walls keep his men out. I brought stone from the quarry. Let me show you how to raise a wall.', knop: 'Show me ›' }, () => {
      geefSteen();
      glijNaar(poort.x + 0.5, poort.y + 0.5);
      naarMuur();
    });
  }

  // De muur: eerst de eerste gouden plek, dan de tweede, dan de hamer.
  function naarMuur() {
    fase = 'muur';
    gids.richt({
      soort: 'bouw', sleutel: 'muur', plek: begin,
      // Na de eerste tik schuift de gouden plek naar het eind van de muur.
      volg: () => (bouwStand().sleutel === 'muur' && bouwStand().begin ? eind : begin),
      get plekTekst() { return bouwStand().sleutel === 'muur' && bouwStand().begin ? 'Wall ends here' : 'Wall starts here'; },
      eigen: () => {
        const b = bouwStand();
        if (b.sleutel !== 'muur' || !b.begin) return null;
        if (!zelfde(b.eind, eind)) return { e: null, tekst: 'Now tap the second golden spot. The wall runs between the two.' };
        return { e: document.getElementById('knop-hamer'), tekst: `Now tap the glowing hammer to build all ${LENGTE} pieces.` };
      },
    });
  }

  function naarPoort() {
    naarKaart('A wall keeps everyone out, your own people too. Put a gate in it: the gate opens for your men and shuts by itself when the enemy comes near.', 'Next ›', () => {
      fase = 'poort';
      gids.richt({ soort: 'bouw', sleutel: 'poort', plek: poort, plekTekst: 'Gate here' });
    });
  }

  function naarToren() {
    naarKaart('A wall alone does not shoot back. A tower does: put archers on top and they see further and hit harder.', 'Next ›', () => {
      fase = 'toren';
      gids.richt({ soort: 'bouw', sleutel: 'wachttoren', plek: toren, plekTekst: 'Tower here' });
    });
  }

  function naarSloop() {
    // De metselaars zetten een stuk muur op de verkeerde plek (de steen kwam al mee met geefSteen).
    bouwer.plaats(muur, [los]);
    glijNaar(los.x + 0.5, los.y + 0.5);
    naarKaart('Hm. My masons put a piece of wall in the wrong spot. Something built wrong is not lost: tear it down with Demolish.', 'Next ›', () => {
      fase = 'sloop';
      gids.richt({
        soort: 'bouw', sleutel: 'sloop', plek: los, plekTekst: 'Tear this down',
        eigen: () => {
          const b = bouwStand();
          if (b.sleutel !== 'sloop' || !zelfde(b.begin, los)) return null;
          return { e: document.getElementById('knop-hamer'), tekst: 'Now tap the red hammer to tear it down.' };
        },
      });
    });
  }

  function naarKlaar() {
    naarKaart('Gone, and half the stone is back in your storehouse. Demolish only works on what you built yourself. Now build a castle that Reinout cannot break.', 'Got it', () => {
      fase = 'klaar';
      opKlaar();
    });
  }

  return {
    actief: () => fase !== 'klaar' && fase !== 'wacht',
    klaar: () => fase === 'klaar',
    fase: () => fase,
    plekken: () => ({ begin, eind, poort, toren, los }),
    // Welk bouwwerk mag de speler nu kiezen? (main.js kiesBouw, ui.beperkBouw) null = niets.
    bouwSleutel() {
      if (fase === 'muur') return 'muur';
      if (fase === 'poort') return 'poort';
      if (fase === 'toren') return 'wachttoren';
      if (fase === 'sloop') return 'sloop';
      return null;
    },
    // Telt een tik op de kaart tijdens het bouwen? Alleen op de gouden plek.
    magTik(x, y, b) {
      const p = { x, y };
      if (fase === 'muur') return b.begin ? zelfde(p, eind) : zelfde(p, begin);
      if (fase === 'poort') return zelfde(p, poort);
      if (fase === 'toren') return zelfde(p, toren);
      if (fase === 'sloop') return zelfde(p, los);
      return false;
    },
    // Mag de hamer neerzetten? De muur pas als hij van plek tot plek loopt.
    magBevestig(b) {
      if (fase === 'muur') return zelfde(b.begin, begin) && zelfde(b.eind, eind);
      return fase === 'poort' || fase === 'toren' || fase === 'sloop';
    },
    sla() { gids.stop(); gids.verbergKaart(); fase = 'klaar'; opKlaar(); },   // voor tests
    zetOpnieuw() { gids.stop(); gids.verbergKaart(); sluitPanelen(); fase = 'wacht'; },   // Start over: de les begint weer
    // magBegin: het verhaalbeeld en de briefing zijn weg
    stap(dt, magBegin) {
      if (fase === 'wacht') { if (magBegin && wachtOp()) start(); return; }
      if (fase === 'klaar') return;
      if (fase === 'muur' && muurTegels().every((t) => isEigen(t, OBJECT.MUUR))) naarPoort();
      else if (fase === 'poort' && isEigen(poort, OBJECT.POORT)) naarToren();
      else if (fase === 'toren' && isEigen(toren, OBJECT.WACHTTOREN)) naarSloop();
      else if (fase === 'sloop' && kaart.object[vak(los)] !== OBJECT.MUUR) naarKlaar();
      if (fase !== 'klaar' && fase !== 'kaart' && fase !== 'kaart1') gids.stap(dt);
    },
  };
}
