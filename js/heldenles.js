// De heldenles (0.125.0): aan het begin van level 9 (Mourngate) leert Bartholt je de helden.
// Rutger staat gratis klaar. Zelfde opzet als de bouwles (js/bouwles.js): stap voor stap met
// de gids, zonder klok; zolang de les loopt staat de oorlog stil. Alleen wat de les vraagt mag.
//   1. kaartje: Rutger is je held, gratis; elke held heeft een ability
//   2. Rutger aantikken (de gouden plek volgt hem)
//   3. de abilityknop Berserker
//   4. kaartje: helden kunnen sneuvelen; de heldenzaal. Bartholt brengt planken en steen
//   5. de heldenzaal bouwen op de gouden plek
//   6. de heldenzaal aantikken: de helden met portret, poppetje, ability en prijs
//   7. kaartje: een held tegelijk, opnieuw kopen kan. Klaar.
// Is de les al gedaan (bewaard), of is Rutger er niet (meer), dan begint hij niet.
import { OBJECT } from './kaart.js';

const BARTHOLT = { naam: 'Bartholt', portret: 'bartholt' };
const el = (id) => document.getElementById(id);
const zichtbaar = (e) => !!e && !e.hidden && !!(e.offsetWidth || e.offsetHeight) && !e.closest('[hidden]');

export function maakHeldenLes({ gids, leger, strijd, bouwer, bouwwerken, kaart, economie, bouwStand, klaarAl = false, opKlaar = () => {}, sluitPanelen = () => {}, glijNaar = () => {} }) {
  const B = kaart.breedte;
  let fase = klaarAl ? 'klaar' : 'wacht';
  let zaal = null;   // de gouden plek voor de heldenzaal
  const werk = bouwwerken.heldenzaal;
  const rutger = () => leger.lijst.find((e) => !e.dood && e.soldaat.sleutel === 'rutger') || null;
  const zelfde = (a, b) => !!a && !!b && a.x === b.x && a.y === b.y;
  const zaalStaat = () => !!zaal && kaart.object[zaal.y * B + zaal.x] === OBJECT.HELDENZAAL && kaart.eigenaar[zaal.y * B + zaal.x] === 1;

  // Een vrije tegel 6 tot 12 tegels van je burcht, zo dicht mogelijk bij 8.
  function kiesZaal() {
    const thuis = kaart.start[0];
    let beste = null;
    for (let y = 2; y < kaart.hoogte - 2; y++) {
      for (let x = 2; x < B - 2; x++) {
        const d = Math.hypot(x - thuis.x, y - thuis.y);
        if (d < 6 || d > 12 || bouwer.waaromNiet(x, y, werk)) continue;
        const score = Math.abs(d - 8);
        if (!beste || score < beste.score) beste = { score, x, y };
      }
    }
    zaal = beste ? { x: beste.x, y: beste.y } : null;
    return !!zaal;
  }

  function naarKaart(tekst, knop, daarna) {
    gids.stop();
    sluitPanelen();
    fase = 'kaart';
    gids.kaart({ ...BARTHOLT, tekst, knop }, daarna);
  }

  function start() {
    const r = rutger();
    if (!r || !werk || !kiesZaal()) { fase = 'klaar'; opKlaar(); return; }   // geen Rutger of geen plek: dan geen les
    fase = 'kaart1';
    sluitPanelen();
    leger.kies([]);
    gids.kaart({ ...BARTHOLT, tekst: 'Rutger keeps his word, Sire. He fights for you now, and it costs you nothing. He is your hero: far stronger than any soldier, and he has a special ability. Let me show you.', knop: 'Show me ›' }, () => {
      glijNaar(r.x, r.y);
      naarKies();
    });
  }

  // Rutger aantikken: de gouden plek staat op hem en loopt met hem mee.
  function naarKies() {
    fase = 'kies';
    gids.richt({
      soort: 'eigen',
      volg: () => { const r = rutger(); return r ? { x: Math.floor(r.x), y: Math.floor(r.y) } : null; },
      plekTekst: 'Tap Rutger',
      eigen: () => ({ e: null, tekst: 'Tap Rutger to choose him.' }),
    });
  }

  function naarAbility() {
    fase = 'ability';
    gids.richt({
      soort: 'eigen',
      eigen: () => {
        const r = rutger();
        if (r && !r.gekozen) return { e: null, tekst: 'Rutger is no longer chosen. Tap him again.' };
        return { e: el('knop-held'), tekst: 'This golden button is his ability. Tap Berserker: for 10 seconds Rutger deals double damage and takes only half.' };
      },
      volg: () => { const r = rutger(); return r && !r.gekozen ? { x: Math.floor(r.x), y: Math.floor(r.y) } : null; },
      plekTekst: 'Tap Rutger',
    });
  }

  function naarZaalKaart() {
    naarKaart('Then it waits a while before he can do it again: the button counts down. A hero can fall too. If Rutger dies, you call a new hero in the Hall of Heroes. I brought planks and stone: let us build one.', 'Next ›', () => {
      for (const [g, a] of Object.entries(werk.kosten || {})) economie.lever(g, a);
      glijNaar(zaal.x + 0.5, zaal.y + 0.5);
      fase = 'zaal';
      gids.richt({ soort: 'bouw', sleutel: 'heldenzaal', plek: zaal, plekTekst: 'Hall of Heroes here' });
    });
  }

  function naarTikZaal() {
    fase = 'tikzaal';
    sluitPanelen();   // de bouwbalk dicht, anders telt een tik op de zaal als nog een keer bouwen
    leger.kies([]);
    gids.richt({
      soort: 'eigen', plek: zaal, plekTekst: 'Tap the hall',
      eigen: () => ({ e: null, tekst: 'Your Hall of Heroes stands. Tap it to see who will fight for you.' }),
    });
  }

  return {
    actief: () => fase !== 'klaar' && fase !== 'wacht',
    klaar: () => fase === 'klaar',
    fase: () => fase,
    zaal: () => zaal,
    // Wat mag er in de bouwbalk (main.js kiesBouw, ui.beperkBouw)? null = niets.
    bouwSleutel: () => (fase === 'zaal' ? 'heldenzaal' : null),
    magTik: (x, y) => fase === 'zaal' && zelfde({ x, y }, zaal),
    magBevestig: () => fase === 'zaal',
    // Mag de speler de heldenzaal openen? Alleen in de stap waarin dat de bedoeling is (en daarna).
    magZaal: () => fase === 'tikzaal' || fase === 'klaar',
    sla() { gids.stop(); gids.verbergKaart(); fase = 'klaar'; opKlaar(); },   // voor tests
    zetOpnieuw() { gids.stop(); gids.verbergKaart(); sluitPanelen(); fase = 'wacht'; },   // Start over: de les begint weer
    stap(dt, magBegin) {
      if (fase === 'wacht') { if (magBegin) start(); return; }
      if (fase === 'klaar') return;
      if (fase === 'kies' || fase === 'ability') {
        const r = rutger();
        if (!r) { gids.stop(); fase = 'klaar'; opKlaar(); return; }
        if (fase === 'kies' && r.gekozen) naarAbility();
        else if (fase === 'ability') { const st = strijd.heldStand(r); if (st && (st.actief || st.wacht > 0)) naarZaalKaart(); }
      } else if (fase === 'zaal' && zaalStaat()) naarTikZaal();
      else if (fase === 'tikzaal' && zichtbaar(el('legerpaneel')) && document.querySelector('#leger-opleiden .held-kaart')) naarKlaarZonderSluiten();
      if (fase !== 'klaar' && fase !== 'kaart' && fase !== 'kaart1') gids.stap(dt);
    },
  };

  // Het heldenpaneel blijft open bij het laatste kaartje: de speler kijkt mee.
  function naarKlaarZonderSluiten() {
    gids.stop();
    fase = 'kaart';
    gids.kaart({ ...BARTHOLT, tekst: 'Every lord you defeated now serves you: Rutger, Mechteld, Lambrecht and Brandt. Tap a hero to read his ability, then Buy. Only one hero at a time, and while Rutger lives you cannot call another. If he falls, come back here.', knop: 'Got it' }, () => {
      fase = 'klaar';
      opKlaar();
    });
  }
}
