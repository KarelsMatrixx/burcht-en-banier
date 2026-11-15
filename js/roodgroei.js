// GROEI VAN ROOD: hoe langer je wacht, hoe sterker de rode heer wordt (naar Karel).
//
// Elke zoveel seconden komt er iets bij bij rood, zichtbaar op de kaart:
//   - een nieuw gebouw (huizen, hutten, een houthakkershut, een boomgaard), vlak bij zijn dorp
//     en nooit in de weg van zijn poort;
//   - burgers die bij hun huis rondlopen (en die jouw soldaten kunnen doden, js/slachting.js);
//   - elke tweede stap een extra wachter op zijn muren;
//   - zijn doel voor de volgende aanval stijgt (doelBonus), en de werken geven meer inkomen.
// Het is gebonden aan een maximum, zodat het haalbaar blijft. Een hoger level groeit sneller, langer en harder.
// Alle getallen zijn schattingen van Claude en per level te zetten met rood.groei in campagne.json.
//
//   niveau        het level (1 tot 10); vrij spel telt als 3
//   elke          seconden tussen twee stappen          (standaard 90 min 3 per level)
//   max           hoeveel stappen hooguit               (6 plus 2 per level)
//   doelPerStap   erbij op zijn aanvalsdoel per stap    (0,2 plus 0,06 per level)
//   wachtersMax   extra wachters op zijn muren          (1 plus een per twee levels)
//   burgersMax    burgers van rood op de kaart          (6 plus 2 per level)

import { OBJECT, GROND } from './kaart.js';
import { SOORT } from './eenheden.js';

const BURGER = [SOORT.DORP1, SOORT.DORP2, SOORT.DORP3, SOORT.DORP4];

export function maakGroei({ kaart, strijd, eenheden, wegvinder, niveau = 3, config = null, opWerk = () => {}, opMelding = () => {} }) {
  const n = Math.max(1, Math.min(10, Math.round(niveau)));
  const c = {
    elke: Math.max(30, 90 - 3 * n),
    max: 6 + 2 * n,
    doelPerStap: 0.2 + 0.06 * n,
    wachtersMax: 1 + Math.floor(n / 2),
    burgersMax: 6 + 2 * n,
    ...(config || {}),
  };
  const B = kaart.breedte;
  const midden = kaart.start[1];
  const omvang = kaart.omvang || 5;
  let stappen = 0;
  let klok = 0;
  let herstelKlok = 0;
  const gebouwen = [];     // { vak, soort }
  const burgers = [];      // { e, thuis, wacht }
  let rng = 1;
  const toeval = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };

  const soortVan = (k) => {
    if (k % 3 === 1) return OBJECT.HOUTHAKKER;
    if (k % 6 === 0) return OBJECT.BOOMGAARD;
    return k % 2 === 0 ? OBJECT.HUT : OBJECT.HUIS;
  };

  // Een lege tegel dicht bij het dorp van rood (of anders bij zijn muren), met vrije buren.
  function kiesVak(k) {
    rng = (kaart.zaad * 31 + k * 977) >>> 0;
    const bestaand = [];
    for (let i = 0; i < kaart.object.length; i++) {
      if (kaart.eigenaar[i] === 2 && kaart.object[i] !== OBJECT.GEEN && Math.max(Math.abs((i % B) - midden.x), Math.abs(Math.floor(i / B) - midden.y)) > omvang) bestaand.push(i);
    }
    let beste = -1;
    let besteScore = Infinity;
    for (let dy = -(omvang + 10); dy <= omvang + 10; dy++) {
      for (let dx = -(omvang + 10); dx <= omvang + 10; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        if (d < omvang + 2) continue;
        if (dx === 0 || dy === 0) continue;   // de wegen uit zijn poorten blijven vrij
        const x = midden.x + dx;
        const y = midden.y + dy;
        if (x < 2 || y < 2 || x >= B - 2 || y >= kaart.hoogte - 2) continue;
        const i = y * B + x;
        if (kaart.object[i] !== OBJECT.GEEN || kaart.grond[i] === GROND.WATER || kaart.eigenaar[i] !== 0) continue;
        // Rondom vrij (niet tegen een andere tegel met iets erop): hij moet bereikbaar blijven
        let vrij = true;
        for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const j = (y + ay) * B + x + ax;
          if (kaart.object[j] !== OBJECT.GEEN && kaart.object[j] !== OBJECT.BOOM) vrij = false;
        }
        if (!vrij) continue;
        let score = d * 1.2 + toeval() * 3;
        if (bestaand.length) {
          let naast = Infinity;
          for (const b of bestaand) naast = Math.min(naast, Math.hypot((b % B) - x, Math.floor(b / B) - y));
          score = naast + toeval() * 2.5 + (d > omvang + 7 ? 4 : 0);
        }
        if (score < besteScore) { besteScore = score; beste = i; }
      }
    }
    return beste;
  }

  function maakBurger(vak) {
    if (burgers.length >= c.burgersMax) return;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1]]) {
      const x = (vak % B) + dx;
      const y = Math.floor(vak / B) + dy;
      if (!wegvinder.isVrij(x, y, 1)) continue;
      const e = eenheden.maakWerker(y * B + x, 1, BURGER[burgers.length % 4], 0.45 + toeval() * 0.25);
      e.burgerVanRood = true;
      burgers.push({ e, thuis: { x: vak % B, y: Math.floor(vak / B) }, wacht: toeval() * 5 });
      return;
    }
  }

  // Eén stap van de groei. stil = bij het terugzetten van een bewaard spel: geen melding.
  function groeiStap(stil = false) {
    stappen++;
    const vak = kiesVak(stappen);
    if (vak >= 0) {
      const soort = soortVan(stappen);
      if (strijd.zetRoodBouw(vak, soort)) {
        gebouwen.push({ vak, soort });
        if (soort === OBJECT.HOUTHAKKER) opWerk({ vak, soort, geeft: { hout: 0.5 } });
        else if (soort === OBJECT.BOOMGAARD) opWerk({ vak, soort, geeft: { goud: 0.5 } });
        else { maakBurger(vak); if (soort === OBJECT.HUIS) maakBurger(vak); }
      }
    }
    if (!stil && stappen === 1) opMelding('Red is growing: new buildings, more people and more guards. The longer you wait, the stronger he gets.');
  }

  // Zoveel extra wachters hoort rood nu te hebben.
  const wensWachters = () => Math.min(c.wachtersMax, strijd.maxExtraWachters(), Math.floor(stappen / 2));

  function wegBurger(i) {
    eenheden.verwijder(burgers[i].e);
    burgers.splice(i, 1);
  }

  function nieuweRoute(f) {
    const e = f.e;
    for (let poging = 0; poging < 4; poging++) {
      const x = Math.round(f.thuis.x + (toeval() * 2 - 1) * 4);
      const y = Math.round(f.thuis.y + (toeval() * 2 - 1) * 4);
      if (!wegvinder.isVrij(x, y, 1)) continue;
      const pad = wegvinder.zoekPad(Math.floor(e.x), Math.floor(e.y), x, y, 1);
      if (pad && pad.length && pad.length <= 14) { e.pad = pad; e.stap = 0; return; }
    }
  }

  return {
    stap(dt) {
      if (strijd.rood().leven <= 0) return;
      klok += dt;
      if (klok >= c.elke && stappen < c.max) { klok -= c.elke; groeiStap(); }
      // De wachters: zakt het aantal (gesneuveld), dan komt er elke 45 seconden één bij
      herstelKlok += dt;
      if (herstelKlok >= 45) {
        herstelKlok = 0;
        if (strijd.aantalExtraWachters() < wensWachters()) strijd.voegExtraWachterToe();
      }
      // De burgers lopen rond bij hun huis
      let budget = 2;
      for (const f of burgers) {
        if (f.e.pad) continue;
        f.wacht -= dt;
        if (f.wacht > 0 || budget <= 0) continue;
        budget--;
        f.wacht = 1 + toeval() * 5;
        nieuweRoute(f);
      }
    },
    // Het erbij op zijn aanvalsdoel.
    doelBonus: () => stappen * c.doelPerStap,
    stappen: () => stappen,
    burgers: () => burgers.map((f) => f.e),
    // Een burger is gedood.
    burgerWeg(e) {
      const i = burgers.findIndex((f) => f.e === e);
      if (i >= 0) wegBurger(i);
    },
    config: () => ({ ...c }),
    // Terugzetten van een bewaard spel: dezelfde stappen opnieuw (de plekken liggen vast).
    herstelNaar(aantal) {
      this.wis();
      const k = Math.max(0, Math.min(c.max, Math.floor(aantal) || 0));
      for (let i = 0; i < k; i++) groeiStap(true);
      for (let i = strijd.aantalExtraWachters(); i < wensWachters(); i++) strijd.voegExtraWachterToe();
    },
    // Opnieuw beginnen: alles wat erbij kwam weer weg.
    wis() {
      for (const g of gebouwen) strijd.haalRoodBouwWeg(g.vak);
      gebouwen.length = 0;
      while (burgers.length) wegBurger(0);
      stappen = 0;
      klok = 0;
      herstelKlok = 0;
    },
    // Voor de tests.
    zetStappen(k) { for (let i = stappen; i < k; i++) groeiStap(true); },
  };
}
