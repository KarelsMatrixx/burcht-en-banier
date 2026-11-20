// DOEL: doeltype C uit het campagneplan, bouwwerken van rood slopen.
//
// Level 6 (The Giant's Spine): Lambrecht Kuyper bouwt Ottgers machines in twee
// bouwloodsen buiten zijn muren. Slecht allebei de loodsen en je wint. Zolang
// ze staan, stuurt hij steeds grotere groepen op je af (de druk loopt op).
// Valt er een loods, dan zakt de druk. Sneuvelt jouw koning, dan verlies je.
//
// In data/campagne.json bij het level:
//   doel: { soort: 'loodsen', aantal: 2, leven: leven per loods,
//           druk: { eerste: seconden tot de eerste golf, waarschuwing: seconden vooraf,
//                   laag: aandeel als er een loods viel, rustig: wachttijd keer zoveel,
//                   golven: [ { naam, wacht: seconden tot de volgende, leger: { soort: aantal } } ] } }
// De laatste golf blijft terugkomen.
//
// De loodsen staan op vaste plekken die uit de kaart volgen (twee flanken van
// het kasteel van rood), zodat herladen dezelfde plekken geeft. Wat gevallen is
// blijft gevallen. De klok en de stand staan in localStorage.

// Sinds 0.74.0 ook voor level 8 (The White Dike): één sluis (object SLUIS) bij het water.
// Extra velden in doel: object ('LOODS' of 'SLUIS'), bijWater (liefst naast water),
// daarna: 'koning' (na het slopen is het nog niet gewonnen: dan moet de rode koning
// vallen; zolang het doel staat, kan hij niet sneuvelen), teksten (zie TEKSTEN hieronder).

import { OBJECT, GROND } from './kaart.js';

const TEKSTEN = {
  naam: 'Lambrecht Kuyper', portret: 'lambrecht', wie: "Lambrecht's",
  begin: 'Two sheds, Karel, and every beam in them becomes a ram for the duke. Each has its own wall and towers, and good men behind them. Come and take them if you dare.',
  eerste: 'My shed! Hold the line, men, the other one must not fall!',
  alles: 'Both siege sheds are in ruins!',
  taak: 'Destroy the siege sheds: {over} of {aantal} left',
  omschrijving: "Your goal: destroy both of Lambrecht's siege sheds. Each stands inside its own fortified post, far from his keep. The longer they stand, the more men he sends. If your king falls, you lose.",
};

const SLEUTEL = 'burcht-banier.doel.';

export function maakLoodsen({ missie, kaart, strijd, wegvinder, toonVerhaal, toonTaak, toonMelding, kaartGewijzigd }) {
  const d = missie.doel;
  const druk = d.druk || {};
  const T = { ...TEKSTEN, ...(d.teksten || {}) };
  const OBJ = OBJECT[d.object || 'LOODS'];
  const tekst = (t) => t.replace('{over}', staand()).replace('{aantal}', aantal);
  const aantal = d.aantal || 2;
  const geheugen = SLEUTEL + missie.id;
  const B = kaart.breedte;
  let s = lees() || nieuw();
  let loopt = false;
  let kijk = 0;

  function nieuw() { return { tijd: 0, golven: 0, volgende: 0, gewaarschuwd: false, loodsen: [], gevallen: [], leven: {}, gemeld: {} }; }
  function lees() {
    try { return JSON.parse(localStorage.getItem(geheugen) || 'null'); } catch (e) { return null; }
  }
  function bewaar() {
    s.leven = {};
    for (const vak of s.loodsen) {
      const l = strijd.schadeOp(vak);
      if (l !== null && !s.gevallen.includes(vak)) s.leven[vak] = Math.round(l);
    }
    try { localStorage.setItem(geheugen, JSON.stringify(s)); } catch (e) { /* niet erg */ }
  }
  const lambrecht = (t) => toonVerhaal({ naam: T.naam, portret: T.portret, tekst: t });
  // Ligt er water direct naast (voor de sluis)?
  const bijWater = (x, y) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < B && yy < kaart.hoogte && kaart.grond[yy * B + xx] === GROND.WATER) return true;
    }
    return false;
  };

  // Is dit vak geschikt voor een loods: droog, leeg, van niemand, met vier vrije
  // buren (zodat je soldaten er omheen kunnen) en voor jou bereikbaar.
  function geschikt(x, y, jij) {
    if (x < 3 || y < 3 || x >= kaart.breedte - 3 || y >= kaart.hoogte - 3) return false;
    const vak = y * B + x;
    if (kaart.object[vak] !== OBJECT.GEEN || kaart.eigenaar[vak] !== 0 || !wegvinder.isVrij(x, y, 0)) return false;
    const buren = [1, -1, B, -B].map((o) => vak + o);
    const vrij = buren.filter((b) => wegvinder.isVrij(b % B, Math.floor(b / B), 0) && wegvinder.isVrij(b % B, Math.floor(b / B), 1)).length;
    // Een sluis staat aan het water: dan zijn twee vrije buren genoeg.
    if (vrij < (d.bijWater ? 2 : 4)) return false;
    return buren.some((b) => wegvinder.verbonden(jij, b, 0));
  }

  // Een vak bij je thuis waar je zelf kunt staan (voor de bereikbaarheidsproef).
  function thuisVak() {
    const st = kaart.start[0];
    for (let r = 2; r < 9; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) if (wegvinder.isVrij(st.x + dx, st.y + dy, 0)) return (st.y + dy) * B + st.x + dx;
      }
    }
    return -1;
  }

  // De plekken: rond het kasteel van rood, op een afstand van ongeveer 11 tegels,
  // verdeeld in een waaier ten opzichte van de richting naar jou.
  function zoekPlekken() {
    const rood = kaart.start[1];
    const jij = kaart.start[0];
    const jijVak = thuisVak();
    const hoek0 = Math.atan2(jij.y - rood.y, jij.x - rood.x);
    const afstand = d.afstand || 11;
    const uitslag = [];
    for (let i = 0; i < aantal; i++) {
      const spreiding = aantal === 1 ? 0 : (i / (aantal - 1) - 0.5) * 2;   // -1 tot 1
      const hoek = hoek0 + spreiding * (d.waaier || 0.9);
      const tx = Math.round(rood.x + Math.cos(hoek) * afstand);
      const ty = Math.round(rood.y + Math.sin(hoek) * afstand);
      let gekozen = -1;
      // Met bijWater eerst een plek naast het water zoeken, anders gewoon de dichtstbijzijnde.
      for (const eis of d.bijWater ? [true, false] : [false]) {
      for (let r = 0; r < 14 && gekozen < 0; r++) {
        for (let dy = -r; dy <= r && gekozen < 0; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = tx + dx;
            const y = ty + dy;
            if (!geschikt(x, y, jijVak) || (eis && !bijWater(x, y))) continue;
            const vak = y * B + x;
            // Niet te dicht bij een eerder gekozen loods.
            if (uitslag.some((v) => Math.max(Math.abs((v % B) - x), Math.abs(Math.floor(v / B) - y)) < 6)) continue;
            gekozen = vak;
            break;
          }
        }
      }
      if (gekozen >= 0) break;
      }
      if (gekozen < 0) throw new Error(`Level ${missie.id}: geen plek voor bouwloods ${i + 1} gevonden`);
      // Zet hem er al neer, zodat de volgende plek er rekening mee houdt.
      kaart.object[gekozen] = OBJ;
      kaart.eigenaar[gekozen] = 2;
      wegvinder.herbereken();
      uitslag.push(gekozen);
    }
    for (const vak of uitslag) { kaart.object[vak] = OBJECT.GEEN; kaart.eigenaar[vak] = 0; }
    wegvinder.herbereken();
    return uitslag;
  }

  // Heeft het kasteelontwerp buitenposten (kaart.posten, js/kaart.js 5f), dan staat elke loods
  // in het midden van een versterkte post, ver van de burcht van rood.
  const postVakken = () => (kaart.posten || []).slice(0, aantal).map((p) => p.vak);

  function zetLoodsen() {
    const posten = postVakken();
    const metPosten = posten.length === aantal;
    // Een bewaarde stand met andere plekken (van een oudere versie) wordt niet gebruikt.
    const klopt = Array.isArray(s.loodsen) && s.loodsen.length === aantal
      && !s.loodsen.some((v) => !Number.isInteger(v) || v < 0 || v >= B * kaart.hoogte)
      && (!metPosten || s.loodsen.every((v, i) => v === posten[i]));
    if (!klopt) {
      s = nieuw();
      s.loodsen = metPosten ? posten : zoekPlekken();
    }
    const gezet = new Set();
    for (const vak of s.loodsen) {
      if (s.gevallen.includes(vak)) continue;
      kaart.object[vak] = OBJ;
      kaart.eigenaar[vak] = 2;
      gezet.add(vak);
    }
    kaartGewijzigd(gezet);
    for (const vak of gezet) strijd.zetLeven(vak, d.leven || 360, (s.leven || {})[vak] || d.leven || 360);
  }

  const staand = () => s.loodsen.filter((v) => !s.gevallen.includes(v)).length;

  // De golven staan vast in data (druk.golven), elk met een naam, een samenstelling
  // en de wachttijd tot de volgende. Eerst verkenners, dan de hoofdmacht, dan
  // machines en tot slot het hele leger. Daarna blijft de laatste golf terugkomen.
  // Is er een loods gevallen, dan zijn de golven kleiner en komen ze later.
  const lijst = () => druk.golven || [];
  const laagNu = () => staand() < aantal;
  function wachtNa(i) {
    const g = lijst()[Math.min(i, lijst().length - 1)];
    return ((g && g.wacht) || druk.tussen || 100) * (laagNu() ? (druk.rustig || 1.6) : 1);
  }
  function stuurGolf() {
    const g = lijst()[Math.min(s.golven, lijst().length - 1)];
    const laag = laagNu();
    const inhoud = {};
    let n = 0;
    for (const [k, c] of Object.entries(g.leger)) {
      const hier = laag ? Math.round(c * (druk.laag || 0.6)) : c;
      if (hier > 0) { inhoud[k] = hier; n += hier; }
    }
    s.golven++;
    s.volgende = s.tijd + wachtNa(s.golven - 1);
    s.gewaarschuwd = false;
    strijd.stuurLeger(inhoud, true);
    toonMelding(`${T.wie} ${g.naam} attacks! Wave ${s.golven}: ${n} soldiers.`);
    bewaar();
  }
  // Een korte waarschuwing voor een golf, zodat je kunt bijsturen.
  function waarschuw() {
    const g = lijst()[Math.min(s.golven, lijst().length - 1)];
    s.gewaarschuwd = true;
    toonMelding(`Scouts report: ${T.wie} ${g.naam} is gathering. It marches in ${druk.waarschuwing || 20} seconds.`);
  }

  zetLoodsen();

  return {
    start() {
      loopt = true;
      if (!s.gemeld.begin) {
        s.gemeld.begin = true;
        lambrecht(T.begin);
        bewaar();
      }
      // Zolang het doel staat, kan de rode koning niet vallen (alleen met daarna: 'koning').
      if (d.daarna === 'koning') strijd.beschermKoning(!s.klaar);
    },
    stap(dt) {
      if (!loopt || strijd.uitslag()) return;
      s.tijd += dt;
      kijk += dt;
      if (kijk < 0.5) return;
      kijk = 0;
      // Wie is er gevallen?
      let nieuwGevallen = 0;
      for (const vak of s.loodsen) {
        if (s.gevallen.includes(vak)) continue;
        if (kaart.object[vak] !== OBJ || kaart.eigenaar[vak] !== 2) { s.gevallen.push(vak); nieuwGevallen++; }
      }
      if (nieuwGevallen) bewaar();
      const over = staand();
      if (s.klaar) return;   // tweede fase: de rode koning moet nog vallen (strijd beslist)
      if (over === 0) {
        toonMelding(T.alles);
        if (d.daarna === 'koning') {
          s.klaar = true;
          strijd.beschermKoning(false);
          toonTaak(T.daarnaTaak || '');
          if (T.daarna) lambrecht(T.daarna);
          bewaar();
          return;
        }
        toonTaak('');
        strijd.beslis('gewonnen');
        try { localStorage.removeItem(geheugen); } catch (e) { /* niet erg */ }
        return;
      }
      toonTaak(tekst(T.taak));
      if (nieuwGevallen && !s.gemeld.eerste) {
        s.gemeld.eerste = true;
        lambrecht(T.eerste);
      }
      if (!s.volgende) s.volgende = druk.eerste || 150;
      if (lijst().length) {
        if (s.tijd >= s.volgende) stuurGolf();
        else if (!s.gewaarschuwd && s.tijd >= s.volgende - (druk.waarschuwing || 20)) waarschuw();
      }
      if (Math.round(s.tijd) % 5 === 0) bewaar();
    },
    // Opnieuw beginnen: klok terug, loodsen terug (op dezelfde plek).
    wis() {
      const plekken = s.loodsen.slice();
      try { localStorage.removeItem(geheugen); } catch (e) { /* niet erg */ }
      s = nieuw();
      s.loodsen = plekken;
      zetLoodsen();
      if (loopt) this.start();
    },
    omschrijving: () => (s.klaar && T.daarnaOmschrijving ? T.daarnaOmschrijving : T.omschrijving),
    klaar: () => !!s.klaar,
    // Voor de tests.
    loodsen: () => s.loodsen.slice(),
    gevallen: () => s.gevallen.slice(),
    stand: () => ({ ...s }),
    zetTijd(t) { s.tijd = t; },
  };
}
