// DOEL: doeltype B uit het campagneplan, een bouwwerk houden tot de tijd om is.
//
// Level 4 (The Fen): Moeder Gesina heeft acht minuten nodig om het Stille
// Volk te roepen. Haar hut staat midden in het moeras en is van jou. De
// jagers van Brandt komen in golven op de hut af (strijd.js: zolang de hut
// staat, gaan vijanden daarop af). Houd je de hut tot de tijd om is, dan win
// je. Valt de hut, dan verlies je. Je koning sneuvelen blijft ook verlies.
//
// In data/campagne.json bij het level:
//   doel: { soort: 'hut', duur: seconden, leven: leven van de hut,
//           golven: { eerste, tussen, begin, erbij, max, leger: { soort: aandeel } } }
// eerste = seconden tot de eerste golf, tussen = seconden tussen golven,
// begin = mannen in de eerste golf, erbij = zoveel meer per golf, max = hooguit.
//
// De klok staat in localStorage, zodat herladen verder telt.

import { OBJECT } from './kaart.js';

const SLEUTEL = 'burcht-banier.doel.';

export function maakDoel({ missie, kaart, bouwer, strijd, wegvinder, toonVerhaal, toonTaak, toonMelding, kaartGewijzigd }) {
  const d = missie.doel;
  const g = d.golven || {};
  const geheugen = SLEUTEL + missie.id;
  const B = kaart.breedte;
  let s = lees() || nieuw();
  let loopt = false;
  let kijk = 0;

  function nieuw() { return { tijd: 0, golven: 0, gemeld: {} }; }
  function lees() {
    try { return JSON.parse(localStorage.getItem(geheugen) || 'null'); } catch (e) { return null; }
  }
  function bewaar() {
    try { localStorage.setItem(geheugen, JSON.stringify(s)); } catch (e) { /* niet erg */ }
  }
  const gesina = (tekst) => toonVerhaal({ naam: 'Mother Gesina', portret: 'gesina', tekst });
  const klok = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

  // De plek van de hut: zo dicht mogelijk bij het midden van de kaart, op
  // droog land, met vier vrije buren. De hut mag geen pad afsluiten: met de
  // hut erop moeten jij en rood elkaar nog kunnen bereiken, en de hut ook.
  const vrijBij = (st, team, van = 2) => {
    for (let r = van; r < van + 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) if (wegvinder.isVrij(st.x + dx, st.y + dy, team)) return (st.y + dy) * B + st.x + dx;
      }
    }
    return -1;
  };
  function zoekPlek() {
    const mx = Math.floor(kaart.breedte / 2);
    const my = Math.floor(kaart.hoogte / 2);
    for (let r = 0; r < 24; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = mx + dx;
          const y = my + dy;
          if (x < 2 || y < 2 || x >= kaart.breedte - 2 || y >= kaart.hoogte - 2) continue;
          const vak = y * B + x;
          if (kaart.object[vak] !== OBJECT.GEEN || kaart.eigenaar[vak] !== 0 || !wegvinder.isVrij(x, y, 0)) continue;
          const buren = [1, -1, B, -B].map((o) => vak + o);
          if (!buren.every((b) => wegvinder.isVrij(b % B, Math.floor(b / B), 0) && wegvinder.isVrij(b % B, Math.floor(b / B), 1))) continue;
          // Proef: zet de hut er even neer en kijk of alles nog bereikbaar is.
          kaart.object[vak] = OBJECT.HUT;
          kaart.eigenaar[vak] = 1;
          wegvinder.herbereken();
          const jij = vrijBij(kaart.start[0], 0);
          const rood0 = vrijBij(kaart.start[1], 0, 7);   // buiten de palen van zijn kamp
          const rood1 = vrijBij(kaart.start[1], 1);
          const goed = jij >= 0 && rood0 >= 0 && rood1 >= 0
            && wegvinder.verbonden(jij, rood0, 0)
            && buren.some((b) => wegvinder.verbonden(jij, b, 0))
            && buren.some((b) => wegvinder.verbonden(rood1, b, 1));
          kaart.object[vak] = OBJECT.GEEN;
          kaart.eigenaar[vak] = 0;
          wegvinder.herbereken();
          if (goed) return vak;
        }
      }
    }
    return -1;
  }

  function zetHut() {
    const vak = zoekPlek();
    if (vak < 0) throw new Error(`Level ${missie.id}: geen plek voor de hut gevonden`);
    bouwer.zetVast(vak, OBJECT.HUT);
    kaartGewijzigd(new Set([vak]));
    strijd.zetHut(vak, d.leven || 900);
    return vak;
  }

  // Een golf jagers: begin + erbij per golf, verdeeld naar aandeel.
  function stuurGolf() {
    const n = Math.min(g.max || 12, (g.begin || 4) + (g.erbij || 1) * s.golven);
    const leger = g.leger || { ridder: 1 };
    const som = Object.values(leger).reduce((a, b) => a + b, 0) || 1;
    const inhoud = {};
    let over = n;
    const soorten = Object.entries(leger);
    soorten.forEach(([k, a], i) => {
      const hier = i === soorten.length - 1 ? over : Math.round((n * a) / som);
      inhoud[k] = Math.max(0, Math.min(over, hier));
      over -= inhoud[k];
    });
    s.golven++;
    strijd.stuurLeger(inhoud, true);
    toonMelding(`Brandt's hunters are coming for the hut! Wave ${s.golven}: ${n} men.`);
    bewaar();
  }

  zetHut();

  return {
    start() {
      loopt = true;
      if (!s.gemeld.begin) {
        s.gemeld.begin = true;
        gesina(`Keep them away from my door, Karel. I need ${Math.round((d.duur || 480) / 60)} minutes to call the Silent Folk. Brandt's hunters are fast and they hide in the reeds.`);
        bewaar();
      }
    },
    stap(dt) {
      if (!loopt || strijd.uitslag()) return;
      s.tijd += dt;
      kijk += dt;
      if (kijk < 0.5) return;
      kijk = 0;
      const over = Math.max(0, (d.duur || 480) - s.tijd);
      toonTaak(`Hold Gesina's hut: ${klok(over)} left`);
      if (s.tijd >= (g.eerste || 45) + s.golven * (g.tussen || 55) && over > 15) stuurGolf();
      const h = strijd.hut();
      if (h && h.staat && h.leven < h.max / 2 && !s.gemeld.half) {
        s.gemeld.half = true;
        gesina('They are at my walls! Send your soldiers to the hut, Karel, quickly.');
      }
      if (over <= 120 && !s.gemeld.twee) {
        s.gemeld.twee = true;
        gesina('The Silent Folk are close. I can feel them in the water. Two more minutes!');
      }
      if (over <= 0) {
        toonTaak('');
        strijd.beslis('gewonnen');
        try { localStorage.removeItem(geheugen); } catch (e) { /* niet erg */ }
        return;
      }
      if (Math.round(s.tijd) % 5 === 0) bewaar();
    },
    // Opnieuw beginnen: klok terug, hut terug.
    wis() {
      s = nieuw();
      try { localStorage.removeItem(geheugen); } catch (e) { /* niet erg */ }
      zetHut();
      if (loopt) {
        s.gemeld.begin = false;
        this.start();
      }
    },
    over: () => Math.max(0, (d.duur || 480) - s.tijd),
    // Voor de tests.
    stand: () => ({ ...s }),
    zetTijd(t) { s.tijd = t; },
  };
}
