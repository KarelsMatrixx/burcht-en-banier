// GOLVEN (0.109.0): level 8, The White Dike. Geen kasteel om in te nemen: overleef tien golven.
//
// Aan de overkant ligt het Vikingdorp van Rutger op de witte dijk. Rutger stuurt zijn mannen met
// drakenschepen: de schepen varen van zijn dorp over het water naar een landingsplek bij jouw
// kust, de mannen gaan aan land en vallen aan. In golf 10 komt Rutger zelf mee: een held die
// dertig soldaten aankan. Versla je hem, dan sterft hij niet. Hij geeft zich over en sluit zich
// bij je aan (beloning: Rutger als held vanaf level 9). Dan heb je het level gewonnen.
//
// In data/campagne.json bij het level:
//   doel: { soort: 'golven', aantal, eerste, tussen, begin, erbij, max, leger: { soort: aandeel of { aandeel, vanaf } },
//           perSchip, vaart (seconden over het water), rutger: { golf, sleutel } }
// rood.geenKoning: true (geen rode koning, geen gewone winst; dit bestand beslist).
//
// De stand staat in localStorage, zodat herladen verder telt. Was een golf onderweg, dan vaart hij opnieuw uit.

import { GROND, OBJECT } from './kaart.js';

const SLEUTEL = 'burcht-banier.golven.';
const BUREN = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// De gekke Viking. Na te lezen (Engels).
const RUTGER = {
  begin: 'HA! Karel of Aldervale! I am Rutger, keeper of the White Dike, and the sea is MY road! Build your walls high, little king. I will knock on them ten times!',
  golf: [
    'First wave! Just a little hello from the dike! HAHA!',
    'You are still standing? Good! I hate a short fight!',
    'More boats! More axes! The sea is hungry today!',
    'My grandmother swung an axe harder than your archers, Karel!',
    'Halfway! Are your walls tired yet? Mine never are!',
    'I can smell your fear from here! Or is it your bakery?',
    'Seven! A lucky number! Lucky for ME!',
    'The duke pays my debts, and I pay him in your stones!',
    'Nine waves, and you still hold? Then I come myself next time!',
  ],
  zelf: 'ENOUGH! No more boys in boats. Now RUTGER comes! Thirty of your men, Karel, and I will still be laughing!',
  geland: 'Who wants to dance first?!',
  half: 'Is that all? I have had worse from a cold herring!',
  verslagen: 'HAHAHA... Ha... You beat me, little king. Nobody beats Rutger! I owe the duke money, but I owe YOU a fight. Rutger the Mad joins you! Where do we smash next?',
};

export function maakGolven({ missie, kaart, strijd, wegvinder, toonVerhaal, toonTaak, toonMelding, toonAanvalKlok, kijkNaar }) {
  const d = missie.doel;
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const geheugen = SLEUTEL + missie.id;
  const aantal = d.aantal || 10;
  const heldGolf = (d.rutger && d.rutger.golf) || aantal;
  const heldSleutel = (d.rutger && d.rutger.sleutel) || 'rutger';
  let s = { ...nieuw(), ...(lees() || {}) };
  let loopt = false;
  let kijk = 0;
  const schepen = [];   // { route, pos, snel, terug, lading, landing, golf, eerste }
  let rutgerThuis = null;
  let rutger = null;    // Rutger in de golf
  let eindKlok = -1;
  let golfMannen = [];   // de mannen van de golf die nu aan land is (niet bewaard)
  let herlaad = true;    // net geladen: de mannen van een bezige golf kennen we niet meer bij naam

  function nieuw() { return { tijd: 0, aftel: null, golfBezig: false, golven: 0, geland: 0, onderweg: 0, rutgerGeland: false, rutgerLeven: 0, gemeld: {}, klaar: false }; }
  function lees() { try { return JSON.parse(localStorage.getItem(geheugen) || 'null'); } catch (e) { return null; } }
  function bewaar() { try { localStorage.setItem(geheugen, JSON.stringify(s)); } catch (e) { /* niet erg */ } }
  const zegt = (tekst) => toonVerhaal({ naam: 'Rutger the Mad', portret: 'rutger', tekst });
  const bartholt = (tekst) => toonVerhaal({ naam: 'Bartholt', portret: 'bartholt', tekst });
  const klok = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  const isWater = (x, y) => x >= 0 && y >= 0 && x < B && y < H && kaart.grond[y * B + x] === GROND.WATER;

  // --- De zeeweg: van het water bij het dorp naar landingsplekken bij jouw kust -----------------
  const rood = kaart.start[1];
  const jij = kaart.start[0];
  // Elke haven van rood (decor aan zijn kade) is een startplek. Per haven een eigen zeekaart (breedte eerst),
  // zodat de schepen van veel verschillende kaden vertrekken. Zonder havens: het water rond zijn dorp.
  const bfs = (bronnen) => {
    const vorige = new Int32Array(B * H).fill(-2);
    const rij = [];
    for (const [x, y] of bronnen) {
      if (!isWater(x, y)) continue;
      const i = y * B + x;
      if (vorige[i] !== -2) continue;
      vorige[i] = -1;
      rij.push(i);
    }
    for (let k = 0; k < rij.length; k++) {
      const i = rij[k];
      const x = i % B;
      const y = (i - x) / B;
      for (const [dx, dy] of BUREN) {
        if (!isWater(x + dx, y + dy)) continue;
        const j = (y + dy) * B + x + dx;
        if (vorige[j] !== -2) continue;
        vorige[j] = i;
        rij.push(j);
      }
    }
    return vorige;
  };
  const havens = [];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < B - 1; x++) {
      const i = y * B + x;
      if (kaart.object[i] !== OBJECT.HAVEN || kaart.eigenaar[i]) continue;
      const bron = BUREN.map(([dx, dy]) => [x + dx, y + dy]).filter(([wx, wy]) => isWater(wx, wy));
      if (bron.length) havens.push({ x, y, vorige: bfs(bron) });
    }
  }
  if (!havens.length) {
    const bron = [];
    for (let y = rood.y - 14; y <= rood.y + 14; y++) for (let x = rood.x - 14; x <= rood.x + 14; x++) if (isWater(x, y)) bron.push([x, y]);
    havens.push({ x: rood.x, y: rood.y, vorige: bfs(bron) });
  }
  const routeNaar = (vorige, i) => {
    const r = [];
    for (let k = i; k >= 0 && r.length < 600; k = vorige[k]) r.unshift({ x: (k % B) + 0.5, y: Math.floor(k / B) + 0.5 });
    return r;
  };
  // Landingsplekken: droog land aan bevaarbaar water, 9 tot 22 tegels van jouw burcht, over land
  // bereikbaar voor rood. Tot vijf, ver uit elkaar.
  const landingen = [];
  {
    const thuisVak = (() => {
      for (let r = 2; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (wegvinder.isVrij(jij.x + dx, jij.y + dy, 1)) return (jij.y + dy) * B + jij.x + dx;
      return -1;
    })();
    const kandidaten = [];
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < B - 1; x++) {
        if (isWater(x, y) || !wegvinder.isVrij(x, y, 1)) continue;
        const d = Math.hypot(x - jij.x, y - jij.y);
        if (d < 9 || d > 22) continue;
        const water = BUREN.map(([dx, dy]) => [x + dx, y + dy]).find(([wx, wy]) => isWater(wx, wy) && havens.some((h) => h.vorige[wy * B + wx] !== -2));
        if (!water) continue;
        kandidaten.push({ x, y, d, w: water[1] * B + water[0] });
      }
    }
    kandidaten.sort((a, b) => Math.abs(a.d - 14) - Math.abs(b.d - 14));
    for (const k of kandidaten) {
      if (landingen.length >= 5) break;
      if (landingen.some((l) => Math.hypot(l.x - k.x, l.y - k.y) < 8)) continue;
      if (thuisVak >= 0 && wegvinder.verbonden && !wegvinder.verbonden(k.y * B + k.x, thuisVak, 1)) continue;
      landingen.push({ ...k, routes: havens.map((h) => (h.vorige[k.w] !== -2 ? routeNaar(h.vorige, k.w) : null)) });
    }
  }

  // --- Een golf ------------------------------------------------------------------------------
  function inhoudVan(golf) {
    const n = Math.min(d.max || 40, (d.begin || 8) + (d.erbij || 4) * golf);
    const leger = {};
    for (const [k, w] of Object.entries(d.leger || { ridder: 1 })) {
      const aandeel = typeof w === 'number' ? w : w.aandeel;
      const vanaf = typeof w === 'number' ? 0 : w.vanaf || 0;
      if (golf >= vanaf && aandeel > 0) leger[k] = aandeel;
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
    return inhoud;
  }

  function stuurGolf() {
    const nr = s.golven;   // 0 = de eerste
    const inhoud = inhoudVan(nr);
    const totaal = Object.values(inhoud).reduce((a, b) => a + b, 0);
    const metRutger = nr + 1 === heldGolf;
    const nSchepen = Math.max(1, Math.min(landingen.length * 4, Math.ceil(totaal / (d.perSchip || 10))));
    // De mannen verdelen over de schepen, om en om.
    const ladingen = Array.from({ length: nSchepen }, () => ({}));
    let k = 0;
    for (const [soort, n] of Object.entries(inhoud)) for (let i = 0; i < n; i++) { const l = ladingen[k++ % nSchepen]; l[soort] = (l[soort] || 0) + 1; }
    if (metRutger) ladingen[0][heldSleutel] = 1;
    const T = d.vaart || 40;
    ladingen.forEach((lading, i) => {
      const landing = landingen[(nr + i) % landingen.length];
      // Elk schip vertrekt van een andere kade van rood; is die niet verbonden, dan de eerste die wel kan.
      let h = (nr + i * 3) % havens.length;
      for (let n = 0; n < havens.length && !(landing && landing.routes[h]); n++) h = (h + 1) % havens.length;
      const route = landing && landing.routes[h];
      if (!route || route.length < 2) return;
      schepen.push({ route, pos: 0, snel: (route.length - 1) / (T + i * 1.2), terug: false, lading, landing, golf: nr + 1, eerste: i === 0, rutger: metRutger && i === 0 });
    });
    s.golven++;
    s.aftel = d.tussen || 100;
    s.golfBezig = true;
    herlaad = false;
    s.onderweg = schepen.filter((x) => !x.terug).length;
    if (metRutger) {
      // Rutger verlaat zijn dorp en stapt op het voorste schip.
      if (rutgerThuis && !rutgerThuis.dood) rutgerThuis.dood = true;
      rutgerThuis = null;
      zegt(RUTGER.zelf);
    } else if (RUTGER.golf[nr]) zegt(RUTGER.golf[nr]);
    toonMelding(`Longships on the water! Wave ${s.golven} of ${aantal}: ${totaal}${metRutger ? ' men and Rutger himself' : ' men'}.`);
    bewaar();
  }

  function landAan(sch) {
    const { lading, landing } = sch;
    const zonderHeld = { ...lading };
    delete zonderHeld[heldSleutel];
    const voorLanding = new Set(strijd.alleVijanden());
    strijd.stuurLeger(zonderHeld, sch.eerste, { rond: { x: landing.x, y: landing.y }, straal: 3, plan: true });
    for (const e of strijd.alleVijanden()) if (!voorLanding.has(e)) golfMannen.push(e);
    if (lading[heldSleutel]) {
      rutger = strijd.maakHeld(heldSleutel, vrijBij(landing.x, landing.y));
      if (rutger) { rutger.onsterfelijk = true; s.rutgerGeland = true; zegt(RUTGER.geland); }
    }
    s.geland = Math.max(s.geland, sch.golf);
    s.onderweg = Math.max(0, s.onderweg - 1);
    bewaar();
  }

  // Een vrij vak bij (x, y) voor rood.
  function vrijBij(x, y) {
    for (let r = 0; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (wegvinder.isVrij(x + dx, y + dy, 1)) return (y + dy) * B + x + dx;
    return -1;
  }
  const isHeld = (e) => e.vijand === heldSleutel && !e.dood;
  function zoekRutger() {
    rutger = strijd.alleVijanden().filter(isHeld).find((e) => !e.rutgerThuis) || null;
  }
  // Rutger in zijn dorp, voor golf 10: hij staat voor zijn zaal en zwaait met zijn bijl.
  function zetRutgerThuis() {
    for (const e of strijd.alleVijanden()) if (isHeld(e)) e.dood = true;   // na herladen: opnieuw neerzetten
    // Liefst vooraan op de dijk, het stuk dat het dichtst bij jou ligt: dan zie je hem vanaf jouw kant.
    let voor = null;
    let voorD = Infinity;
    for (let i = 0; i < B * H; i++) {
      if (kaart.object[i] !== OBJECT.DIJK) continue;
      const ix = i % B;
      const iy = (i - ix) / B;
      const dd = Math.hypot(ix - jij.x, iy - jij.y);
      if (dd < voorD) { voorD = dd; voor = { x: ix, y: iy }; }
    }
    if (voor) {
      let beste = null;
      let besteD = Infinity;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        if (!wegvinder.isVrij(voor.x + dx, voor.y + dy, 1)) continue;
        const dd = Math.hypot(voor.x + dx - jij.x, voor.y + dy - jij.y);
        if (dd < besteD) { besteD = dd; beste = (voor.y + dy) * B + voor.x + dx; }
      }
      const e = beste === null ? null : strijd.hinderlaag(heldSleutel, beste);
      if (e) { e.onsterfelijk = true; e.rutgerThuis = true; rutgerThuis = e; return; }
    }
    for (let r = 3; r < 9; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (!wegvinder.isVrij(rood.x + dx, rood.y + dy, 1)) continue;
          const e = strijd.hinderlaag(heldSleutel, (rood.y + dy) * B + rood.x + dx);
          if (e) { e.onsterfelijk = true; e.rutgerThuis = true; rutgerThuis = e; return; }
        }
      }
    }
  }

  // De klok naar de volgende golf telt pas als de laatste man van de vorige golf dood is (0.120.2).
  // s.aftel = seconden tot de volgende golf; s.golfBezig = er zijn nog mannen van de vorige golf.
  const eersteAftel = () => (d.eerste || 150) + s.golven * (d.tussen || 100) - s.tijd;
  if (s.aftel === null || s.aftel === undefined) s.aftel = eersteAftel();   // een oud bewaard spel
  const mannenOpZee = () => schepen.reduce((a, sch) => a + (sch.terug ? 0 : Object.entries(sch.lading).reduce((b, [k, n]) => b + (k === heldSleutel ? 0 : n), 0)), 0);
  const mannenAanLand = () => {
    golfMannen = golfMannen.filter((e) => !e.dood);
    return golfMannen.length;
  };
  const mannenOver = () => mannenOpZee() + mannenAanLand();
  const volgendeGolf = () => (s.golven >= aantal ? Infinity : s.aftel);
  // De klok staat bovenin de voorraadbalk (main.js naStrijd); de aparte klok onder de adviseur is niet meer nodig.
  const toonKlok = () => { if (toonAanvalKlok) toonAanvalKlok(null); };

  function vaarStap(dt) {
    for (let i = schepen.length - 1; i >= 0; i--) {
      const sch = schepen[i];
      const L = sch.route.length - 1;
      if (!sch.terug) {
        sch.pos = Math.min(L, sch.pos + sch.snel * dt);
        if (sch.pos >= L) { landAan(sch); sch.terug = true; sch.wacht = 4; }
      } else if (sch.wacht > 0) sch.wacht -= dt;
      else {
        sch.pos -= sch.snel * 1.3 * dt;
        if (sch.pos <= 0) schepen.splice(i, 1);
      }
    }
  }

  function overwinning() {
    s.klaar = true;
    bewaar();
    zegt(RUTGER.verslagen);
    toonMelding('Rutger the Mad kneels, laughing. He joins you! You have survived the White Dike.');
    eindKlok = 6;
  }

  return {
    start() {
      loopt = true;
      if (!s.klaar && !s.rutgerGeland) zetRutgerThuis();
      else zoekRutger();
      if (s.rutgerGeland && !rutger && !s.klaar) {
        // herladen terwijl Rutger aan land was: hij staat weer bij de laatste landingsplek
        const l = landingen[(heldGolf - 1) % Math.max(1, landingen.length)];
        if (l) { rutger = strijd.maakHeld(heldSleutel, vrijBij(l.x, l.y)); if (rutger) { rutger.onsterfelijk = true; if (s.rutgerLeven) rutger.leven = Math.max(2, s.rutgerLeven); } }
      }
      // Was een golf onderweg toen je herlaadde, dan vaart hij opnieuw uit.
      if (s.onderweg > 0 && s.geland < s.golven) { s.golven = s.geland; s.onderweg = 0; s.golfBezig = false; s.aftel = 0; }
      // Na een herladen weten we niet meer wie van de golf was (rood heeft ook vaste soldaten): de golf telt als voorbij.
      if (s.golfBezig && !schepen.length) { s.golfBezig = false; s.aftel = Math.min(s.aftel, d.tussen || 100); }
      toonKlok();
      if (!s.gemeld.begin) {
        s.gemeld.begin = true;
        zegt(RUTGER.begin);
        bewaar();
      }
    },
    stap(dt) {
      if (!loopt) return;
      if (eindKlok >= 0) {
        eindKlok -= dt;
        if (eindKlok < 0) strijd.beslis('gewonnen');
        return;
      }
      if (strijd.uitslag()) { if (toonAanvalKlok) toonAanvalKlok(null); return; }
      vaarStap(dt);
      s.tijd += dt;
      if (!s.golfBezig) s.aftel -= dt;
      kijk += dt;
      if (kijk < 0.5) return;
      kijk = 0;
      if (s.klaar) return;
      if (rutger && rutger.dood) rutger = null;
      if (rutger) {
        s.rutgerLeven = Math.round(rutger.leven);
        if (rutger.leven < rutger.levenMax / 2 && !s.gemeld.half) { s.gemeld.half = true; zegt(RUTGER.half); }
        if (rutger.verslagen) { overwinning(); return; }
      }
      // De golf is voorbij als niemand meer leeft: dan begint de klok naar de volgende.
      if (s.golfBezig && mannenOver() === 0) { s.golfBezig = false; herlaad = false; bewaar(); if (s.golven < aantal) toonMelding(`Wave ${s.golven} is beaten. The next raid comes in ${klok(s.aftel)}.`); }
      if (s.golven < aantal && !s.golfBezig && volgendeGolf() <= 0) stuurGolf();
      if (s.golven === 0 && volgendeGolf() < 40 && !s.gemeld.waarschuw) { s.gemeld.waarschuw = true; bartholt('Sails on the horizon, Sire! Rutger\'s longships land on our shore. Put archers and soldiers where they come ashore.'); }
      toonKlok();
      const nogTeGaan = aantal - s.golven;
      if (s.golven < aantal) toonTaak(`Survive Rutger's raids: wave ${s.golven} of ${aantal}${nogTeGaan ? (s.golfBezig ? `: ${mannenOver()} raiders left` : `, next in ${klok(Math.max(0, volgendeGolf()))}`) : ''}`);
      else toonTaak(s.rutgerGeland ? 'Defeat Rutger the Mad. He will not die, but he can be beaten.' : 'Rutger is coming! Hold the shore.');
      if (Math.round(s.tijd) % 5 === 0) bewaar();
    },
    wis() {
      s = nieuw();
      s.aftel = eersteAftel();
      golfMannen = [];
      herlaad = false;
      schepen.length = 0;
      rutger = null;
      eindKlok = -1;
      try { localStorage.removeItem(geheugen); } catch (e) { /* niet erg */ }
      if (loopt) { loopt = false; this.start(); }
    },
    omschrijving: () => `Your goal: survive ${aantal} waves. Rutger sends his men across the water in longships, and they come ashore near your keep. In wave ${heldGolf} Rutger the Mad comes himself: beat him (he will not die). If your king falls, you lose.`,
    klaar() { try { localStorage.removeItem(geheugen); } catch (e) { /* niet erg */ } },
    // Wat de tekenaar moet tekenen: de drakenschepen, en een paar die in het dorp liggen te wachten.
    schepen() {
      const lijst = [];
      for (const sch of schepen) {
        const L = sch.route.length - 1;
        const p = Math.max(0, Math.min(L, sch.pos));
        const k = Math.min(L - 1, Math.floor(p));
        const f = p - k;
        const a = sch.route[k];
        const b = sch.route[k + 1] || a;
        const sx = (b.x - b.y) - (a.x - a.y);
        lijst.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f + Math.sin(performance.now() / 700 + k) * 0.04, alpha: sch.terug && p < 3 ? Math.max(0, p / 3) : 1, richting: (sx >= 0) !== sch.terug ? 1 : -1, viking: true });
      }
      return lijst;
    },
    landingen: () => landingen.map(({ x, y, routes }) => ({ x, y, lengte: Math.min(...routes.filter(Boolean).map((r) => r.length)) })),
    havens: () => havens.map(({ x, y }) => ({ x, y })),
    stand: () => ({ ...s, schepen: schepen.length }),
    rutger: () => rutger,
    rutgerThuis: () => rutgerThuis,
    zetTijd(t) { s.tijd = t; s.aftel = eersteAftel(); s.golfBezig = false; herlaad = false; },   // voor tests: spring naar dit moment
    volgende: volgendeGolf,
    mannenOver,
  };
}
