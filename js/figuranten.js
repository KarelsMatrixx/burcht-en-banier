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

export function maakFiguranten({ kaart, eenheden, wegvinder }) {
  let lijst = [];             // { e, thuis: {x, y}, straal, wacht }
  let aan = false;
  let rng = 12345;
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
      return;
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
    zetFiguur(SOORT.BARTHOLT, st.x + 3, st.y + 3, STRAAL_BURCHT, 0.55);
    zetFiguur(SOORT.WESSEL, st.x - 2, st.y + 2, STRAAL_BURCHT, 0.7);
    zetFiguur(SOORT.DORP1, st.x + 2, st.y - 3, STRAAL_BURCHT, 0.5);
    zetFiguur(SOORT.DORP3, st.x - 3, st.y - 2, STRAAL_BURCHT, 0.5);
  }

  function zetUit() {
    for (const f of lijst) eenheden.verwijder(f.e);
    lijst = [];
  }

  function nieuweRoute(f) {
    const e = f.e;
    for (let poging = 0; poging < 4; poging++) {
      const x = Math.round(f.thuis.x + (toeval() * 2 - 1) * f.straal);
      const y = Math.round(f.thuis.y + (toeval() * 2 - 1) * f.straal);
      if (!wegvinder.isVrij(x, y, 0)) continue;
      const pad = wegvinder.zoekPad(Math.floor(e.x), Math.floor(e.y), x, y, 0);
      if (pad && pad.length && pad.length <= MAX_PAD) {
        e.pad = pad;
        e.stap = 0;
        return true;
      }
    }
    return false;
  }

  return {
    // fase 'bouw' = overdag: dan lopen ze. Anders zijn ze naar huis.
    stap(dt, overdag) {
      if (overdag && !aan) { aan = true; zetAan(); }
      else if (!overdag && aan) { aan = false; zetUit(); return; }
      if (!aan) return;
      let budget = PER_STAP;
      for (const f of lijst) {
        const e = f.e;
        if (e.pad) continue;
        f.wacht -= dt;
        if (f.wacht > 0 || budget <= 0) continue;
        budget--;
        f.wacht = 1 + toeval() * 5;   // even blijven staan en kletsen
        nieuweRoute(f);
      }
    },
    aantal: () => lijst.length,
    lijst: () => lijst.map((f) => f.e),
  };
}
