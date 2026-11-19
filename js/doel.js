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
// begin = mannen in de eerste golf, erbij = zoveel meer per golf, max = hooguit, laatste = grootte van de laatste golf.
//
// Is de tijd om, dan wint je niet meteen: Gesina roept het Stille Volk. Vanuit de linkerbovenhoek
// van de kaart komen vlammenwevers tevoorschijn (doel.versterking), die van jou zijn. De hut hoeft
// dan niet meer te blijven staan. Je wint pas als de rode heer in zijn tentenkamp is verslagen.
//   versterking: { soort, aantal, hoek: { x, y } (instaprand, deel van de kaart 0 tot 1), perBatch, tussen (seconden), loop (tegels naar binnen) }
//
// De klok staat in localStorage, zodat herladen verder telt.

import { OBJECT } from './kaart.js';

const SLEUTEL = 'burcht-banier.doel.';

export function maakDoel({ missie, kaart, bouwer, strijd, wegvinder, leger, kijkNaar, toonVerhaal, toonTaak, toonMelding, toonAanvalKlok, kaartGewijzigd }) {
  const d = missie.doel;
  const g = d.golven || {};
  const geheugen = SLEUTEL + missie.id;
  const B = kaart.breedte;
  let s = { ...nieuw(), ...(lees() || {}) };
  let loopt = false;
  let kijk = 0;

  function nieuw() { return { tijd: 0, golven: 0, gemeld: {}, fase: 0, gekomen: 0 }; }
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
    let n = Math.min(g.max || 12, (g.begin || 4) + (g.erbij || 1) * s.golven);
    // De laatste golf van het level mag een eigen grootte hebben (g.laatste).
    if (g.laatste && s.golven === aantalGolven - 1) n = g.laatste;
    // Een aandeel is een getal, of { aandeel, vanaf }: die soort komt pas mee vanaf golf `vanaf` (begint bij 0).
    const leger = {};
    for (const [k, w] of Object.entries(g.leger || { ridder: 1 })) {
      const aandeel = typeof w === 'number' ? w : w.aandeel;
      const vanaf = typeof w === 'number' ? 0 : w.vanaf || 0;
      if (s.golven >= vanaf && aandeel > 0) leger[k] = aandeel;
    }
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

  // Wanneer de volgende golf komt (seconden), of -1 als er geen golf meer komt voor de tijd om is.
  // Een golf komt zodra s.tijd het moment bereikt, maar niet meer in de laatste 15 seconden (zie stap).
  const eersteGolf = g.eerste || 45;
  const tussenGolf = g.tussen || 55;
  const laatsteMoment = (d.duur || 480) - 15;
  const volgendeGolf = () => {
    const moment = eersteGolf + s.golven * tussenGolf;
    return moment < laatsteMoment ? moment - s.tijd : -1;
  };
  // Hoeveel golven komen er in totaal in dit level.
  const aantalGolven = Math.max(1, Math.ceil((laatsteMoment - eersteGolf) / tussenGolf));
  const toonKlok = () => {
    if (!toonAanvalKlok) return;
    if (s.fase === 1) { toonAanvalKlok(null); return; }
    const nog = volgendeGolf();
    if (nog < 0) { toonAanvalKlok(null); return; }
    toonAanvalKlok({ seconden: Math.max(0, Math.ceil(nog)), golf: Math.min(aantalGolven, s.golven + 1), totaal: aantalGolven });
  };

  // --- Na het ritueel: het Stille Volk komt ------------------------------------------------
  const v = d.versterking || null;
  const hoek = () => {
    const h = (v && v.hoek) || { x: 0.06, y: 0.3 };
    return { x: Math.round(h.x * (kaart.breedte - 1)), y: Math.round(h.y * (kaart.hoogte - 1)) };
  };
  let batchKlok = 0;
  let mislukt = 0;
  const totaal = () => (v ? Math.max(0, v.aantal | 0) : 0);

  function startAanval() {
    s.fase = 1;
    s.gekomen = 0;
    batchKlok = 0;
    mislukt = 0;
    toonTaak('');
    if (toonAanvalKlok) toonAanvalKlok(null);
    strijd.hutVrij();
    const h = hoek();
    if (kijkNaar) { const g = verzamelPlek(); kijkNaar(Math.round((h.x + g.x) / 2), h.y); }
    gesina(`It is done, Karel! The Silent Folk come out of the reeds, ${totaal()} flameweavers, and they are yours. Wait until they have gathered, then tap them and send them at Brandt's camp. Do not let him leave my fen alive.`);
    toonMelding(`The Silent Folk have come: ${totaal()} Flameweavers join you. Defeat Huntmaster Brandt!`);
    bewaar();
  }

  // De Silent Folk komen aanlopen: elke batch stapt aan de rand van de kaart binnen en loopt naar een
  // verzamelplek een stuk verderop (v.loop tegels naar rechts). Daar wachten ze op jouw bevelen.
  // Ze lopen met leger.wandel (telt niet als bevel van de speler), dus jouw keuze blijft zoals die was.
  const verzamelPlek = () => {
    const h = hoek();
    return { x: Math.min(kaart.breedte - 2, h.x + ((v && v.loop) || 14)), y: h.y };
  };
  function loopNaarVerzamelplek(e) {
    const g = verzamelPlek();
    for (let r = 0; r <= 9; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (leger.wandel && leger.wandel(e, g.x + dx, g.y + dy)) return true;
        }
      }
    }
    return false;
  }
  function versterkingStap(dt) {
    if (s.gekomen >= totaal() || !leger) return;
    batchKlok -= dt;
    if (batchKlok > 0) return;
    batchKlok = (v && v.tussen) || 1.5;
    const h = hoek();
    const vak = h.y * B + h.x;
    const n = Math.min((v && v.perBatch) || 5, totaal() - s.gekomen);
    let gelukt = 0;
    for (let i = 0; i < n; i++) {
      const e = leger.geef(v.soort, vak, 18);
      if (!e) continue;
      gelukt++;
      loopNaarVerzamelplek(e);
    }
    s.gekomen += gelukt;
    // Is er geen plek meer (bijvoorbeeld door bomen), dan houden we het hierbij.
    if (!gelukt && ++mislukt >= 3) s.gekomen = totaal();
    bewaar();
  }

  zetHut();

  return {
    start() {
      loopt = true;
      if (s.fase === 1) strijd.hutVrij();   // het ritueel was al klaar (herladen)
      toonKlok();
      if (!s.gemeld.begin) {
        s.gemeld.begin = true;
        gesina(`Keep them away from my door, Karel. I need ${Math.round((d.duur || 480) / 60)} minutes to call the Silent Folk. Brandt's hunters are fast and they hide in the reeds.`);
        bewaar();
      }
    },
    stap(dt) {
      if (!loopt) return;
      if (strijd.uitslag()) { if (toonAanvalKlok) toonAanvalKlok(null); return; }
      if (s.fase === 1) {
        versterkingStap(dt);
        kijk += dt;
        if (kijk < 0.5) return;
        kijk = 0;
        if (strijd.stand().vrede) { toonTaak(''); return; }   // gewonnen en verder gespeeld
        toonTaak(`Defeat Huntmaster Brandt: ${strijd.garnizoen().length} guards left`);
        return;
      }
      s.tijd += dt;
      kijk += dt;
      if (kijk < 0.5) return;
      kijk = 0;
      const over = Math.max(0, (d.duur || 480) - s.tijd);
      toonTaak(`Hold Gesina's hut: ${klok(over)} left`);
      if (s.tijd >= eersteGolf + s.golven * tussenGolf && over > 15) stuurGolf();
      toonKlok();
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
        startAanval();
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
        toonKlok();
      }
    },
    over: () => Math.max(0, (d.duur || 480) - s.tijd),
    fase: () => s.fase,
    // Het level is gewonnen: de klok begint de volgende keer opnieuw.
    klaar() { try { localStorage.removeItem(geheugen); } catch (e) { /* niet erg */ } },
    volgende: volgendeGolf,
    // Voor de tests.
    stand: () => ({ ...s }),
    zetTijd(t) { s.tijd = t; },
  };
}
