// FIGURANTEN: dorpelingen en hoofdpersonen die in de proloog rondlopen (naar Karel: veel
// levendigheid). Boeren, kinderen en de priester blijven bij hun dorp; Wessel en Bartholt
// wandelen over het binnenplein en de weg. Ze doen verder niets en tellen nergens mee.
// Bij het avondeten (fase na 'bouw') zijn ze allemaal naar huis en verdwenen.

import { SOORT } from './eenheden.js';
import { FEEST_DORPEN } from './kaart.js';

const STRAAL_DORP = 6;
const STRAAL_BURCHT = 5;
const PER_STAP = 2;           // hooguit zoveel nieuwe routes per stap
const MAX_PAD = 16;           // geen lange omwegen

export function maakFiguranten({ kaart, eenheden, wegvinder, leger, strijd, koningSleutel = 'koning' }) {
  let lijst = [];             // { e, thuis: {x, y}, straal, wacht }
  let aan = false;
  let rng = 12345;
  let gast = null;
  let bartholt = null;        // de vermelding van Bartholt in de lijst: hij gaat mee naar de plek van de les
  let koningWacht = 3;
  const toeval = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };

  function zetFiguur(soort, x, y, straal, snelheid) {
    const vx = Math.round(x);
    const vy = Math.round(y);
    if (vx < 1 || vy < 1 || vx >= kaart.breedte - 1 || vy >= kaart.hoogte - 1) return;
    // Zoek een vrije plek bij de gewenste
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [2, 0], [0, 2]]) {
      if (!wegvinder.isVrij(vx + dx, vy + dy, 0)) continue;
      const e = eenheden.maakWerker((vy + dy) * kaart.breedte + vx + dx, 0, soort, snelheid);
      e.figurant = true;
      lijst.push({ e, thuis: { x: vx, y: vy }, straal, wacht: toeval() * 6 });
      return e;
    }
  }

  function zetAan() {
    const st = kaart.start[0];
    const soorten = [SOORT.DORP1, SOORT.DORP2, SOORT.DORP3, SOORT.DORP4];
    for (const d of FEEST_DORPEN) {
      const cx = st.x + d.dx;
      const cy = st.y + d.dy;
      for (let i = 0; i < d.aantal; i++) {
        const soort = i % 5 === 4 ? SOORT.KIND : soorten[Math.floor(toeval() * soorten.length)];
        zetFiguur(soort, cx + (toeval() - 0.5) * 8, cy + (toeval() - 0.5) * 8, STRAAL_DORP, 0.45 + toeval() * 0.3);
      }
      if (d.priester) zetFiguur(SOORT.PRIESTER, cx, cy - 4, 3, 0.4);
    }
    // Tussen de ringen woont en werkt het volk: in elke strook een paar groepjes
    const stroken = [7, 11, 15];
    for (const d of stroken) {
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0]]) {
        for (let i = 0; i < 2; i++) {
          const soort = i === 1 && toeval() < 0.4 ? SOORT.KIND : soorten[Math.floor(toeval() * soorten.length)];
          zetFiguur(soort, st.x + sx * d * 0.85 + (toeval() - 0.5) * 3, st.y + sy * d * 0.85 + (toeval() - 0.5) * 3, 3, 0.4 + toeval() * 0.3);
        }
      }
    }
    const bart = zetFiguur(SOORT.BARTHOLT, st.x + 3, st.y + 3, STRAAL_BURCHT, 0.55);
    bartholt = bart ? lijst.find((f) => f.e === bart) : null;
    zetFiguur(SOORT.WESSEL, st.x - 2, st.y + 2, STRAAL_BURCHT, 0.7);
    zetFiguur(SOORT.DORP1, st.x + 2, st.y - 3, STRAAL_BURCHT, 0.5);
    zetFiguur(SOORT.DORP3, st.x - 3, st.y - 2, STRAAL_BURCHT, 0.5);
  }

  function zetUit() {
    for (const f of lijst) if (!f.e.gast) eenheden.verwijder(f.e);
    lijst = [];
    gast = null;
  }

  function nieuweRoute(f) {
    const e = f.e;
    const team = 0;   // ook de gast (team 1) loopt over de paden van jouw kasteel
    for (let poging = 0; poging < 4; poging++) {
      const x = Math.round(f.thuis.x + (toeval() * 2 - 1) * f.straal);
      const y = Math.round(f.thuis.y + (toeval() * 2 - 1) * f.straal);
      if (!wegvinder.isVrij(x, y, team)) continue;
      const pad = wegvinder.zoekPad(Math.floor(e.x), Math.floor(e.y), x, y, team);
      if (pad && pad.length && pad.length <= MAX_PAD) {
        e.pad = pad;
        e.stap = 0;
        return true;
      }
    }
    return false;
  }

  // De aanval: iedereen rent terug het kasteel in, naar de burcht, en is daar binnen verdwenen.
  let vluchtTijd = 0;
  let gedood = 0;
  const KLEUREN = ['#a58a5a', '#7a5a3a', '#8a4a3a', '#6a7a4a'];
  function vlucht(dt) {
    vluchtTijd += dt;
    const st = kaart.start[0];
    const vijanden = strijd ? strijd.vijanden().filter((v) => v.wachter === undefined && !v.dood) : [];
    let budget = 24;
    for (let i = lijst.length - 1; i >= 0; i--) {
      const f = lijst[i];
      const e = f.e;
      if (e.gast) { lijst.splice(i, 1); continue; }
      // De vijand maakt geen onderscheid: wie te dichtbij komt, wordt doodgeslagen. Wessel en Bartholt
      // zijn nodig voor het verhaal en ontkomen.
      if (e.soort !== SOORT.WESSEL && e.soort !== SOORT.BARTHOLT && strijd) {
        let geraakt = null;
        for (const v of vijanden) {
          if (Math.abs(v.x - e.x) < 1.4 && Math.abs(v.y - e.y) < 1.4) { geraakt = v; break; }
        }
        if (geraakt && toeval() < 0.45) {
          strijd.vermoord(e.x, e.y, KLEUREN[i % KLEUREN.length]);
          geraakt.pose = 1;
          eenheden.verwijder(e);
          lijst.splice(i, 1);
          gedood++;
          continue;
        }
      }
      const dichtbij = Math.hypot(e.x - st.x - 0.5, e.y - st.y - 0.5) < 3.5;
      if (dichtbij || vluchtTijd > 70) { eenheden.verwijder(e); lijst.splice(i, 1); continue; }
      if (!f.vlucht || (!e.pad && budget > 0)) {
        f.mislukt = f.mislukt || 0;
        if (budget <= 0) continue;
        budget--;
        f.vlucht = true;
        e.snelheid = 1.7 + (i % 5) * 0.05;
        // Naar een vrije tegel bij de burcht
        for (const [dx, dy] of [[2, 2], [-2, 2], [2, -2], [-2, -2], [0, 3], [3, 0], [-3, 0], [0, -3]]) {
          const x = st.x + dx;
          const y = st.y + dy;
          if (!wegvinder.isVrij(x, y, 0)) continue;
          const pad = wegvinder.zoekPad(Math.floor(e.x), Math.floor(e.y), x, y, 0);
          if (pad && pad.length) { e.pad = pad; e.stap = 0; break; }
        }
        // Geen weg naar binnen (bijvoorbeeld door vijanden in de poort): na drie pogingen is hij ergens ondergedoken
        if (!e.pad && ++f.mislukt >= 3) { eenheden.verwijder(e); lijst.splice(i, 1); }
      }
    }
  }

  return {
    // fase: 'bouw' en 'avond' = overdag, ze lopen rond. 'nacht' = aanval: ze vluchten het kasteel in.
    // Daarna (scène) en bij opnieuw beginnen zijn ze weg.
    stap(dt, fase) {
      const overdag = fase === 'bouw' || fase === 'avond';
      if (overdag && !aan) { aan = true; vluchtTijd = 0; gedood = 0; zetAan(); }
      else if (fase === 'nacht' && aan) { vlucht(dt); if (!lijst.length) { aan = false; gast = null; } return; }
      else if (!overdag && aan) { aan = false; zetUit(); return; }
      if (!aan) return;
      // De gast (Reinout, die 's nachts de poort opent) en Karel zelf lopen ook rond.
      if (!gast) {
        const g = eenheden.lijst.find((e) => e.gast);
        if (g) { gast = g; g.snelheid = 0.5; lijst.push({ e: g, thuis: { x: Math.floor(g.x), y: Math.floor(g.y) }, straal: 4, wacht: 2 }); }
      }
      const k = leger.lijst.find((e) => e.soldaat && e.soldaat.sleutel === koningSleutel && !e.dood);
      if (k && !k.pad && !k.opMuur && !leger.gekozen().includes(k)) {
        koningWacht -= dt;
        if (koningWacht <= 0) {
          koningWacht = 4 + toeval() * 8;
          const st = kaart.start[0];
          leger.wandel(k, Math.round(st.x + (toeval() * 2 - 1) * 4), Math.round(st.y + (toeval() * 2 - 1) * 4));
        }
      }
      let budget = PER_STAP;
      for (const f of lijst) {
        const e = f.e;
        if (f.vast) continue;   // Bartholt staat bij de plek van de les
        if (e.pad) continue;
        f.wacht -= dt;
        if (f.wacht > 0 || budget <= 0) continue;
        budget--;
        f.wacht = 1 + toeval() * 5;   // even blijven staan en kletsen
        nieuweRoute(f);
      }
    },
    // Bartholt verschijnt (in een rookwolkje) naast de plek van de les en blijft daar staan
    // tot de volgende les. Geen plek (null): bij de burcht.
    leid(plek) {
      if (!bartholt || !aan || !lijst.includes(bartholt)) return false;
      const st = kaart.start[0];
      const doel = plek || { x: st.x + 2, y: st.y + 3 };
      const e = bartholt.e;
      for (let r = 1; r <= 4; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          // Liefst een tegel naast (niet op) de plek, aan de kant van de burcht
          const x = doel.x + dx;
          const y = doel.y + dy;
          if (!wegvinder.isVrij(x, y, 0)) continue;
          strijd && strijd.rook && strijd.rook(e.x, e.y);
          e.pad = null; e.stap = 0;
          e.x = x + 0.5; e.y = y + 0.5;
          e.kijkt = (doel.x - x) - (doel.y - y) >= 0 ? 1 : -1;
          bartholt.vast = true;
          bartholt.thuis = { x, y };
          strijd && strijd.rook && strijd.rook(e.x, e.y);
          return true;
        }
      }
      return false;
    },
    // Bartholt gaat weer rondlopen
    laatLos() { if (bartholt) { bartholt.vast = false; bartholt.wacht = 2; } },
    aantal: () => lijst.length,
    gedood: () => gedood,
    lijst: () => lijst.map((f) => f.e),
  };
}
