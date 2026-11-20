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
//   werkvolk      rode ingenieurs die tussen de werven en het decor lopen en met de hamer werken (standaard 0; level 6)

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
    werkvolk: 0,
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
  const volk = [];         // { e, spots, tot, werkt, slag }: ingenieurs die tussen de werkplekken lopen en werken
  let volkGemaakt = false;
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


  // --- Werkvolk (level 6): ingenieurs die rondlopen en werken -----------------------------------
  const WERKPLEK = new Set([OBJECT.KRAAN, OBJECT.WERKBANK, OBJECT.HOUTSTAPEL, OBJECT.RAMGERAAMTE, OBJECT.STEENHOUWER, OBJECT.KAMPVUUR, OBJECT.VATEN]);
  const volkPlekken = () => {
    const lijst = [];
    for (let i = 0; i < kaart.object.length; i++) {
      if (!WERKPLEK.has(kaart.object[i])) continue;
      const x = i % B;
      const y = Math.floor(i / B);
      if (Math.max(Math.abs(x - midden.x), Math.abs(y - midden.y)) > 36) continue;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1]]) {
        if (!wegvinder.isVrij(x + dx, y + dy, 1)) continue;
        lijst.push({ vak: (y + dy) * B + x + dx, kijk: -dx || 1 });
        break;
      }
    }
    return lijst;
  };
  function maakVolk() {
    volkGemaakt = true;
    const aantal = Math.max(0, Math.min(80, Math.round(c.werkvolk) || 0));
    if (!aantal) return;
    const spots = volkPlekken();
    if (!spots.length) return;
    rng = (kaart.zaad * 17 + 5) >>> 0;
    for (let i = 0; i < aantal; i++) {
      const sp = spots[Math.floor(toeval() * spots.length)];
      let vak = -1;
      for (let poging = 0; poging < 10 && vak < 0; poging++) {
        const x = (sp.vak % B) + Math.round((toeval() * 2 - 1) * 3);
        const y = Math.floor(sp.vak / B) + Math.round((toeval() * 2 - 1) * 3);
        if (wegvinder.isVrij(x, y, 1)) vak = y * B + x;
      }
      if (vak < 0) continue;
      const e = eenheden.maakWerker(vak, 1, SOORT.INGENIEUR, 0.5 + toeval() * 0.25);
      e.burgerVanRood = true;
      volk.push({ e, spots, tot: toeval() * 4, werkt: false, slag: 0 });
    }
  }
  function volkStap(dt) {
    let budget = 3;
    for (const f of volk) {
      const e = f.e;
      if (e.pad) continue;
      if (f.werkt) {
        f.tot -= dt;
        f.slag -= dt;
        if (f.slag <= 0) { e.pose = e.pose ? 0 : 1; f.slag = 0.38; }
        if (f.tot > 0) continue;
        f.werkt = false;
        e.houding = null;
        e.pose = 0;
        f.tot = 0.3 + toeval() * 2;
        continue;
      }
      f.tot -= dt;
      if (f.tot > 0 || budget <= 0) continue;
      budget--;
      const dichtbij = f.spots.filter((q) => Math.hypot((q.vak % B) - e.x, Math.floor(q.vak / B) - e.y) <= 12);
      const keuze = dichtbij.length ? dichtbij : f.spots;
      const sp = keuze[Math.floor(toeval() * keuze.length)];
      const pad = wegvinder.zoekPad(Math.floor(e.x), Math.floor(e.y), sp.vak % B, Math.floor(sp.vak / B), 1);
      if (pad && pad.length && pad.length <= 30) {
        e.pad = pad;
        e.stap = 0;
        f.komtAan = sp;
      } else if (Math.floor(e.x) === sp.vak % B && Math.floor(e.y) === Math.floor(sp.vak / B)) {
        f.komtAan = sp;
      } else { f.tot = 1 + toeval() * 2; continue; }
      f.tot = 0;
      f.naarPlek = true;
    }
    // Wie aangekomen is, gaat aan het werk.
    for (const f of volk) {
      if (f.e.pad || f.werkt || !f.naarPlek) continue;
      f.naarPlek = false;
      f.werkt = true;
      f.tot = 4 + toeval() * 6;
      f.slag = 0;
      if (f.komtAan) f.e.kijkt = f.komtAan.kijk;
      f.e.houding = 'sla';
    }
  }
  const volkWeg = (i) => { eenheden.verwijder(volk[i].e); volk.splice(i, 1); };

  return {
    stap(dt) {
      if (strijd.rood().leven <= 0) return;
      klok += dt;
      if (!volkGemaakt && c.werkvolk > 0) maakVolk();
      volkStap(dt);
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
    burgers: () => burgers.map((f) => f.e).concat(volk.map((f) => f.e)),
    werkvolk: () => volk.map((f) => f.e),
    // Een burger is gedood.
    burgerWeg(e) {
      const i = burgers.findIndex((f) => f.e === e);
      if (i >= 0) wegBurger(i);
      const j = volk.findIndex((f) => f.e === e);
      if (j >= 0) volkWeg(j);
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
      while (volk.length) volkWeg(0);
      volkGemaakt = false;
      stappen = 0;
      klok = 0;
      herstelKlok = 0;
    },
    // Voor de tests.
    zetStappen(k) { for (let i = stappen; i < k; i++) groeiStap(true); },
  };
}
