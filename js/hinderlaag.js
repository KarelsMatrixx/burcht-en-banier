// HINDERLAAG: de eerste keer dat de speler soldaten door het smalle stuk van de pas stuurt,
// duiken er aan beide kanten boogschutters op in de rotsen (naar Karel, level 2 Sevenwinds).
// Instelling in data/campagne.json bij het level: "hinderlaag": { "per": 4, "straal": 7, "soort": "boogschutter" }.
// Ze staan in een nis in de rotswand, blijven daar en schieten op wat binnen bereik komt.

import { OBJECT } from './kaart.js';

export function maakHinderlaag({ instelling, kaart, leger, strijd, kaartGewijzigd, toonMelding, toonVerhaal }) {
  const per = instelling.per || 4;
  const straal = instelling.straal || 7;
  const soort = instelling.soort || 'boogschutter';
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const mx = Math.round(B / 2);
  const my = Math.round(H / 2);
  let gebeurd = false;   // niet bewaard: na herladen kan de hinderlaag opnieuw komen
  let nissen = [];       // de rotstegels die voor de schutters zijn weggehaald, om ze bij opnieuw beginnen terug te zetten
  let kijk = 0;

  const isRots = (x, y) => x >= 0 && y >= 0 && x < B && y < H && kaart.object[y * B + x] === OBJECT.STEEN;

  // De plekken: langs de pas (richting x min y), aan beide kanten (richting x plus y) de eerste rotstegel.
  function plekken() {
    const lijst = [];
    const stap = Math.max(2, Math.round((straal * 2) / per));
    for (const kant of [1, -1]) {
      for (let n = 0; n < per; n++) {
        const t = Math.round((n - (per - 1) / 2) * stap);
        let x = mx + t;
        let y = my - t;
        let gevonden = null;
        for (let d = 0; d < 20; d++) {
          if (isRots(x, y)) { gevonden = { x, y }; break; }
          x += kant;
          y += kant;
        }
        if (gevonden) lijst.push(gevonden);
      }
    }
    return lijst;
  }

  function sprongOp() {
    gebeurd = true;
    const lijst = plekken();
    const vakken = new Set();
    // Een nis in de rotswand: de rots maakt plaats voor de schutter.
    for (const p of lijst) {
      const vak = p.y * B + p.x;
      kaart.object[vak] = OBJECT.GEEN;
      vakken.add(vak);
    }
    nissen = [...vakken];
    kaartGewijzigd(vakken);
    let n = 0;
    for (const p of lijst) if (strijd.hinderlaag(soort, p.y * B + p.x)) n++;
    if (toonMelding) toonMelding(`Ambush! ${n} archers rise from the rocks on both sides of the pass.`);
    if (toonVerhaal && instelling.tekst) toonVerhaal(instelling.tekst);
    return n;
  }

  return {
    stap(dt) {
      if (gebeurd) return;
      kijk += dt;
      if (kijk < 0.3) return;
      kijk = 0;
      // Een soldaat van de speler in het smalle stuk van de pas
      if (leger.lijst.some((e) => !e.dood && Math.hypot(e.x - mx, e.y - my) <= straal)) sprongOp();
    },
    gebeurd: () => gebeurd,
    plekken,
    // Opnieuw beginnen: de rotsen staan weer dicht en de hinderlaag kan opnieuw komen.
    // (De schutters zelf verdwijnen met strijd.herstel.)
    wis() {
      const vakken = new Set();
      for (const vak of nissen) {
        if (kaart.object[vak] !== OBJECT.GEEN) continue;   // er staat inmiddels iets anders
        kaart.object[vak] = OBJECT.STEEN;
        vakken.add(vak);
      }
      nissen = [];
      gebeurd = false;
      kijk = 0;
      if (vakken.size) kaartGewijzigd(vakken);
    },
  };
}
