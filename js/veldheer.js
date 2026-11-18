// DE VELDHEER VAN ROOD: rood stuurt zijn mannen niet meer allemaal tegelijk.
//
// Tot stap 38 verscheen een aanval in één keer bij de rode burcht. Elke soort
// loopt in zijn eigen tempo (ridder 2,0, ram 0,9, toren 0,7 tegels per seconde),
// dus de ridders kwamen als eerste aan, werden neergeschoten, en de machines
// kwamen te laat. De veldheer legt een plan over zo'n aanval. Het plan heeft
// vijf lagen; hoeveel er meedoen hangt af van het niveau (1 tot 5):
//
//   1  Samen aankomen   Sinds 0.71.0: rood verzamelt eerst zichtbaar op een punt
//                       buiten bereik van jouw torens (ongeveer 12 tegels voor de
//                       bres) en marcheert dan als één leger op: ridders voorop,
//                       machines direct erachter, schutters achteraan, in het tempo
//                       van de traagste. Een ram of toren loopt nooit voor de
//                       ridders uit en wacht als er te weinig begeleiding is.
//                       (Tot 0.70 rekende de veldheer wachttijden uit bij vertrek;
//                       dat ging mis zodra iemand onderweg werd opgehouden. Die
//                       rekensom is er nog als reserve, als er geen verzamelpunt is.)
//   2  Golven met rol   Een paar verkenners vooraf, de hoofdmacht, een tweede lijn
//                       die later volgt, en een thuiswacht die achterblijft.
//   3  Doelkeuze        Rood kiest jouw zwakste stuk muur (of poort) als bres, en
//                       valt eventueel van twee kanten aan (flank).
//   4  Tegenzetten      Wat rood koopt hangt af van jouw leger: veel schutters bij
//                       jou betekent schilden, sluipmoordenaars en rammen; veel
//                       ridders betekent boogschutters en vlammenwevers.
//   5  Terugtrekken     Zwaar gewonden mannen trekken zich terug, rusten uit bij de
//                       burcht en komen als groepje terug.
//
// Het niveau begint bij heer.aanval.niveau (per level in data/campagne.json) en
// stijgt elke stijgElke aanvallen met één, tot max. Alle getallen staan in
// data/economie.json onder heer.aanval; de lagen van niveau 1 tot en met n worden
// samengevoegd.
//
// De veldheer stuurt via strijd.js: elke krijger heeft een plan (strijd.tak(e)):
//   houdTot  wacht tot dit rekenstapnummer      doel   het bouwwerk dat hij eerst aanvalt
//   via      eerst naar dit vak (omtrekkende)   terug  naar huis om uit te rusten
//   groep    het nummer van zijn groep
//   verzamel naar dit vak en daar wachten      rem    even stilstaan (mars in de pas)
//   mars     verzamelen of opmars: niemand ver najagen

import { OBJECT } from './kaart.js';
import { maakToeval } from './toeval.js';

const KOMPAS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const MAX_WACHT = 75;       // seconden: zo lang wacht niemand op de rest
const WEGFACTOR = 1.3;      // de echte route is langer dan de rechte lijn (aanname, als er geen route te meten is)
// Verzamelen en opmars (schattingen van Claude):
const VERZAMEL_MIN = 9;     // tegels van de bres: het verzamelpunt ligt hier tussen ...
const VERZAMEL_MAX = 16;    // ... en hier, liefst rond VERZAMEL_BEST
const VERZAMEL_BEST = 12;
const VEILIG = 8;           // zoveel tegels blijft het verzamelpunt van jouw torens, muren en poorten
const VERZAMEL_TIJD = 120;  // seconden: langer verzamelt niemand
const HELFT_WACHT = 25;     // seconden: is de helft er, dan wacht het leger nog zo lang op de rest
const KLAAR_DEEL = 0.85;    // dit deel moet er zijn om op te marcheren
const OPMARS_TIJD = 100;    // seconden: daarna valt iedereen gewoon aan
const VOORSPRONG = 3;       // tegels: zo ver mogen ridders voor de achterste machine uit lopen
const VAST = 10;            // seconden: een machine die zo lang niet beweegt, telt niet meer mee

export function maakVeldheer({ regels, kaart, leger, strijd, perSeconde, opMelding }) {
  const H = regels.heer;
  if (!H) return null;
  const B = kaart.breedte;
  const HOOG = kaart.hoogte;
  const soorten = regels.soldaten;
  const toeval = maakToeval((kaart.zaad || 0) + 313);
  const klem = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const A = () => H.aanval || {};

  // --- Niveau en instellingen ------------------------------------------------------
  // nr = het nummer van de aanval (1 = de eerste).
  function niveau(nr) {
    const a = A();
    const basis = klem(Math.round(a.niveau || 2), 1, 5);
    const stijg = a.stijgElke > 0 ? Math.floor(Math.max(0, nr - 1) / a.stijgElke) : 0;
    return Math.min(klem(Math.round(a.max || 5), 1, 5), basis + stijg);
  }
  function instelling(nr) {
    const a = A();
    const n = niveau(nr);
    const uit = { niveau: n };
    for (let i = 1; i <= n; i++) Object.assign(uit, (a.niveaus || {})[i] || {});
    // Wat het level zelf vastlegt (bijvoorbeeld flank in level 4) gaat voor.
    for (const veld of ['doelkeuze', 'flank', 'scouts', 'tweede', 'thuis', 'tegenzet', 'terugtrek', 'piekElke', 'piekFactor', 'piekRust']) {
      if (a[veld] !== undefined) uit[veld] = a[veld];
    }
    return uit;
  }

  // --- Wat een soort is ----------------------------------------------------------------
  const def = (e) => (e.krijg && e.krijg.def) || soorten[e.vijand || (e.soldaat && e.soldaat.sleutel)];
  const isMachine = (d) => !!(d.alleenBouw || d.ladder);
  const isSteun = (d) => !!d.steun;
  const isSchutter = (d) => d.bereik > 2 && !isMachine(d);
  const vakVan = (e) => Math.floor(e.y) * B + Math.floor(e.x);
  const midden = (vak) => ({ x: (vak % B) + 0.5, y: Math.floor(vak / B) + 0.5 });
  // Hoe lang een soort er over doet om aan te komen, ten opzichte van zijn groep.
  // Machines iets eerder (ze moeten er staan voor de rest), schutters iets later.
  const AANKOMST = { machine: -1.5, melee: 0, steun: 1, schutter: 0.8 };
  const rolVan = (d) => (isMachine(d) ? 'machine' : isSteun(d) ? 'steun' : isSchutter(d) ? 'schutter' : 'melee');

  // --- Kijken naar jouw verdediging -----------------------------------------------------
  function jouwTorens() {
    const lijst = [];
    for (let v = 0; v < B * HOOG; v++) {
      if (kaart.eigenaar[v] !== 1) continue;
      if (kaart.object[v] === OBJECT.TOREN || kaart.object[v] === OBJECT.WACHTTOREN) lijst.push(midden(v));
    }
    return lijst;
  }

  // Hoe zwaar jouw verdediging bij dit vak weegt: soldaten (op de muur zwaarder) en torens.
  function verdediging(vak, soldaten, torens) {
    const p = midden(vak);
    let som = 0;
    for (const e of soldaten) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d > 7) continue;
      const w = (H.gewicht[e.soldaat.sleutel] || 1) * (e.opMuur ? 1.5 : 1);
      som += w * (1 - d / 8);
    }
    for (const t of torens) {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d <= 6) som += 1.2 * (1 - d / 7);
    }
    return som;
  }

  // De bres: het zwakste stuk muur of poort van jou waar rood bij kan.
  // vermijd: een eerdere bres; de nieuwe moet minstens minAfstand tegels verder liggen.
  function kiesBres(bereik, zaden, vermijd = -1, minAfstand = 0) {
    const soldaten = leger.lijst.filter((e) => !e.dood && e.soldaat && !(soorten[e.soldaat.sleutel] || {}).koning);
    const torens = jouwTorens();
    const keep = strijd.burcht();
    const van = zaden.length ? midden(zaden[0]) : null;
    let beste = -1;
    let min = Infinity;
    for (let v = 0; v < B * HOOG; v++) {
      if (kaart.eigenaar[v] !== 1) continue;
      const soort = kaart.object[v];
      if (soort !== OBJECT.MUUR && soort !== OBJECT.POORT) continue;
      const x = v % B;
      const y = Math.floor(v / B);
      const buiten = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < B && y + dy < HOOG && bereik.has((y + dy) * B + x + dx));
      if (!buiten) continue;
      if (vermijd >= 0) {
        const o = midden(vermijd);
        if (Math.hypot(x + 0.5 - o.x, y + 0.5 - o.y) < minAfstand) continue;
      }
      const lev = strijd.levenOp(v);
      const heel = lev && lev.max ? lev.leven / lev.max : 1;
      let score = verdediging(v, soldaten, torens) + 2.5 * heel;
      if (van) score += 0.06 * Math.hypot(x + 0.5 - van.x, y + 0.5 - van.y);
      score += 0.08 * Math.hypot(x + 0.5 - keep.x, y + 0.5 - keep.y);
      score *= 0.9 + 0.2 * toeval();
      if (score < min) {
        min = score;
        beste = v;
      }
    }
    return beste;
  }

  // Een omweg voor de flank bij het doel van level 4: aan de andere kant van de hut.
  function omwegBijHut(hut, bereik) {
    const rood = strijd.rood();
    const ux = hut % B + 0.5 - rood.x;
    const uy = Math.floor(hut / B) + 0.5 - rood.y;
    const ul = Math.hypot(ux, uy) || 1;
    let beste = -1;
    let max = -Infinity;
    const p = midden(hut);
    for (const v of bereik) {
      const m = midden(v);
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d < 4.5 || d > 7.5) continue;
      const dot = ((m.x - p.x) * ux + (m.y - p.y) * uy) / (d * ul);
      if (dot > max) {
        max = dot;
        beste = v;
      }
    }
    return beste;
  }

  const richting = (vak) => {
    const keep = strijd.burcht();
    const p = midden(vak);
    const dx = p.x - keep.x;
    const dy = p.y - keep.y;
    // Op het scherm loopt x naar rechtsonder en y naar linksonder.
    const hoek = Math.atan2(dx + dy, dx - dy);
    return KOMPAS[((Math.round(hoek / (Math.PI / 4)) % 8) + 8) % 8];
  };

  // --- Het verzamelpunt ----------------------------------------------------------------
  // Een open plek buiten bereik van jouw torens, muren en poorten, ongeveer VERZAMEL_BEST
  // tegels van het doel, aan de kant waar het leger vandaan komt. -1 als er geen is.
  function kiesVerzamel(eind, bereik, van) {
    const werk = [];
    for (let v = 0; v < B * HOOG; v++) {
      if (kaart.eigenaar[v] !== 1) continue;
      const s = kaart.object[v];
      if (s === OBJECT.MUUR || s === OBJECT.POORT || s === OBJECT.TOREN || s === OBJECT.WACHTTOREN) werk.push(midden(v));
    }
    let beste = -1;
    let min = Infinity;
    for (const v of bereik) {
      if (kaart.eigenaar[v] === 1) continue;
      const p = midden(v);
      const d = Math.hypot(p.x - eind.x, p.y - eind.y);
      if (d < VERZAMEL_MIN || d > VERZAMEL_MAX) continue;
      if (werk.some((w) => Math.abs(w.x - p.x) < VEILIG && Math.abs(w.y - p.y) < VEILIG && Math.hypot(w.x - p.x, w.y - p.y) < VEILIG)) continue;
      // Open genoeg om met z'n allen te staan?
      let open = 0;
      const x = v % B;
      const y = Math.floor(v / B);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (bereik.has((y + dy) * B + x + dx)) open++;
      if (open < 14) continue;
      const score = Math.abs(d - VERZAMEL_BEST) + 0.25 * Math.hypot(p.x - van.x, p.y - van.y) + 0.3 * (25 - open);
      if (score < min) {
        min = score;
        beste = v;
      }
    }
    return beste;
  }
  // Voor elke man een eigen vak rond het verzamelpunt (de dichtstbijzijnde vrije vakken).
  function plekkenRond(centrum, n, bereik) {
    const c = midden(centrum);
    const lijst = [];
    const x0 = centrum % B;
    const y0 = Math.floor(centrum / B);
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const v = (y0 + dy) * B + x0 + dx;
        if (x0 + dx < 0 || y0 + dy < 0 || x0 + dx >= B || y0 + dy >= HOOG || !bereik.has(v)) continue;
        lijst.push(v);
      }
    }
    lijst.sort((a, b) => Math.hypot(midden(a).x - c.x, midden(a).y - c.y) - Math.hypot(midden(b).x - c.x, midden(b).y - c.y));
    if (!lijst.length) lijst.push(centrum);
    return Array.from({ length: n }, (_, i) => lijst[i % lijst.length]);
  }

  // --- Groepen -------------------------------------------------------------------------
  let groepen = [];
  let teller = 0;
  let volgende = 1;

  // De aanval plannen. lijst = de mannen die net bij de rode burcht staan.
  function plan(lijst, { golf, hut = -1 }) {
    const I = instelling(golf);
    const nu = strijd.stapNr();
    const mannen = lijst.filter((e) => !e.dood && !e.koning);
    if (!mannen.length) return;
    const zaden = mannen.map(vakVan);
    const bereik = strijd.bereikbaar(zaden);

    const machines = mannen.filter((e) => isMachine(def(e)));
    const voet = mannen.filter((e) => !isMachine(def(e)));

    // Verkenners: de snelste mannen, alleen bij een grotere aanval.
    const scouts = [];
    if (I.scouts > 0 && voet.length >= 8) {
      const snel = voet.filter((e) => !isSteun(def(e))).sort((a, b) => def(b).snelheid - def(a).snelheid);
      for (const e of snel.slice(0, klem(Math.ceil(voet.length * I.scouts), 1, 3))) scouts.push(e);
    }
    const rest = voet.filter((e) => !scouts.includes(e));
    // De tweede lijn: gelijkmatig uit de rest gekozen, zodat het mengsel blijft kloppen.
    const tweede = [];
    const hoofdVoet = [];
    const ft = I.tweede > 0 && rest.length >= 6 ? I.tweede : 0;
    rest.forEach((e, i) => ((Math.floor((i + 1) * ft) > Math.floor(i * ft)) ? tweede : hoofdVoet).push(e));
    // De flank: een deel van de hoofdmacht kiest een andere weg.
    const flank = [];
    const hoofd = [];
    const ff = I.flank > 0 && hoofdVoet.length >= 6 ? I.flank : 0;
    hoofdVoet.forEach((e, i) => ((Math.floor((i + 1) * ff) > Math.floor(i * ff)) ? flank : hoofd).push(e));
    for (const e of machines) hoofd.push(e);

    // Doelen: de bres van de hoofdmacht en van de flank.
    let bresA = -1;
    let bresF = -1;
    let omweg = -1;
    if (hut >= 0) {
      if (flank.length) omweg = omwegBijHut(hut, bereik);
    } else if (I.doelkeuze === 'zwakste') {
      bresA = kiesBres(bereik, zaden);
      if (bresA >= 0 && flank.length) bresF = kiesBres(bereik, zaden, bresA, 9);
    }
    const doelA = bresA >= 0 ? strijd.bouwDoelOp(bresA) : null;
    const doelF = bresF >= 0 ? strijd.bouwDoelOp(bresF) : null;
    const keep = strijd.burcht();
    const eindA = bresA >= 0 ? midden(bresA) : hut >= 0 ? midden(hut) : { x: keep.x + 0.5, y: keep.y + 0.5 };
    const eindF = bresF >= 0 ? midden(bresF) : eindA;

    // Wie loopt hoe lang, en wanneer moet hij aankomen?
    const rijen = [];
    const zet = (groep, soort, doel, eind, verschuiving, omwegVak) => {
      for (const e of groep) rijen.push({ e, soort, doel, eind, verschuiving, omwegVak });
    };
    zet(scouts, 'scout', doelA, eindA, -(I.scoutsVroeger || 14), -1);
    zet(hoofd, 'hoofd', doelA, eindA, 0, -1);
    zet(tweede, 'tweede', doelA, eindA, I.tweedeNa || 22, -1);
    zet(flank, 'flank', doelF || doelA, doelF ? eindF : eindA, 4, omweg);
    // De echte route is langer dan de rechte lijn, en vaak veel langer: bij een gracht of
    // ringmuren lopen mannen die binnen de muren beginnen een heel andere weg dan mannen
    // erbuiten. Daarom meten we de route van elk mannetje zelf (één zoektocht per
    // beginvak en bestemming, en alleen voor het eerste stuk bij een omweg).
    const gemeten = new Map();
    const route = (van, naar) => {
      const sleutel = van * 100003 + naar;
      if (!gemeten.has(sleutel)) gemeten.set(sleutel, strijd.routeLengte(van, naar));
      return gemeten.get(sleutel);
    };
    const lengte = (e, naar, eind) => {
      const echt = route(vakVan(e), naar);
      if (echt) return echt;
      return Math.hypot(eind.x - e.x, eind.y - e.y) * WEGFACTOR;
    };
    // Bij de burcht zelf telt de route naar een vrij vak ernaast (de burcht staat niet vrij).
    const plekNaast = () => {
      const lijst = strijd.thuisPlekken();
      const rep = mannen[0];
      return lijst.sort((a, b) => Math.hypot(midden(a).x - rep.x, midden(a).y - rep.y) - Math.hypot(midden(b).x - rep.x, midden(b).y - rep.y))[0];
    };
    const eindVakA = bresA >= 0 ? bresA : hut >= 0 ? hut : plekNaast();
    const eindVakF = bresF >= 0 ? bresF : eindVakA;
    for (const r of rijen) {
      const d = def(r.e);
      const eindVak = r.soort === 'flank' ? eindVakF : eindVakA;
      let afstand;
      if (r.omwegVak >= 0) {
        const o = midden(r.omwegVak);
        afstand = lengte(r.e, r.omwegVak, o) + (route(r.omwegVak, eindVak) || Math.hypot(r.eind.x - o.x, r.eind.y - o.y) * WEGFACTOR);
      } else {
        afstand = lengte(r.e, eindVak, r.eind);
      }
      r.reis = afstand / (r.e.snelheid || d.snelheid || 2);
      r.voor = AANKOMST[rolVan(d)];
    }
    // Machines die bij een eerdere aanval hun begeleiding kwijt zijn, sluiten aan bij dit leger.
    const wezen = [];
    groepen = groepen.filter((g) => {
      const levend = g.eenheden.filter((e) => !e.dood);
      if (!levend.length || levend.some((e) => !isMachine(def(e)))) return true;
      for (const e of levend) wezen.push(e);
      return false;
    });
    for (const e of wezen) rijen.push({ e, soort: 'hoofd', doel: doelA, eind: eindA, verschuiving: 0, omwegVak: -1, reis: 0, voor: 0 });

    // Verzamelen en samen opmarcheren (laag 1). Lukt dat niet (geen geschikte plek), dan
    // de oude manier: wachttijden bij vertrek uitrekenen.
    const centrum = { x: mannen.reduce((s, e) => s + e.x, 0) / mannen.length, y: mannen.reduce((s, e) => s + e.y, 0) / mannen.length };
    const marcheert = I.synchroon !== false;
    const ralA = marcheert ? kiesVerzamel(eindA, bereik, centrum) : -1;
    const ralF = marcheert && flank.length ? (hut >= 0 && omweg >= 0 ? omweg : bresF >= 0 ? kiesVerzamel(eindF, bereik, centrum) : ralA) : -1;
    const kloksTijd = I.synchroon === false ? 0 : Math.max(...rijen.map((r) => r.reis - r.voor - r.verschuiving));
    const nieuweGroep = (fase, eind, eindVak, doel, rally) => {
      const g = { id: volgende++, eenheden: [], hp0: 0, doel, vrijNa: nu, gemeld: false, herstel: [], fase, eind, eindVak, rally, start: nu, helftOp: 0, sinds: nu, volgt: 0, na: 0, stil: new Map(), hoofd: false };
      groepen.push(g);
      return g;
    };
    const gHoofd = nieuweGroep(ralA >= 0 ? 'verzamel' : 'aanval', eindA, eindVakA, doelA, ralA);
    gHoofd.hoofd = true;
    const gScout = nieuweGroep('aanval', eindA, eindVakA, doelA, -1);
    const gTweede = ralA >= 0 ? nieuweGroep('verzamel', eindA, eindVakA, doelA, ralA) : gHoofd;
    gTweede.volgt = gHoofd.id;
    gTweede.na = I.tweedeNa || 22;
    const gFlank = ralF >= 0 ? nieuweGroep('verzamel', eindF, eindVakF, doelF || doelA, ralF) : gHoofd;
    gFlank.volgt = gHoofd.id;
    const groepVan = (r) => (r.soort === 'scout' ? gScout : r.soort === 'tweede' ? gTweede : r.soort === 'flank' ? gFlank : gHoofd);
    // Groepen met hetzelfde verzamelpunt delen één lijst plekken (niemand op elkaars vak).
    const opPlek = new Map();
    for (const g of new Set([gHoofd, gTweede, gFlank])) {
      if (g.rally < 0) continue;
      if (!opPlek.has(g.rally)) opPlek.set(g.rally, plekkenRond(g.rally, rijen.length, bereik));
    }
    for (const r of rijen) {
      const g = groepVan(r);
      const t = strijd.tak(r.e);
      t.groep = g.id;
      t.doel = r.doel;
      t.rem = false;
      if (g.fase === 'verzamel') {
        t.verzamel = opPlek.get(g.rally).shift();
        t.slot = t.verzamel;
        t.mars = true;
        t.houdTot = 0;
        t.via = -1;
      } else {
        // Verkenners, of de oude rekensom als er geen verzamelpunt is.
        const wacht = r.soort === 'scout' || I.synchroon === false ? 0 : klem(kloksTijd + r.voor + r.verschuiving - r.reis, 0, MAX_WACHT);
        t.verzamel = -1;
        t.mars = false;
        t.via = r.omwegVak;
        t.houdTot = wacht > 0.2 ? nu + strijd.stappenVan(wacht) : 0;
        g.vrijNa = Math.max(g.vrijNa, t.houdTot);
      }
      g.eenheden.push(r.e);
      g.hp0 += r.e.levenMax;
    }
    groepen = groepen.filter((g) => g.eenheden.length);
    // Een waarschuwing voor de speler, zodat het niet als vals aanvoelt.
    if (bresA >= 0 && I.niveau >= 3) {
      opMelding(`Red ${ralA >= 0 ? 'gathers outside' : 'masses at'} your ${richting(bresA)} wall!${bresF >= 0 ? ` A second force circles toward your ${richting(bresF)} side.` : ''}`);
    } else if (omweg >= 0) {
      opMelding('Red hunters circle around to take the hut from two sides!');
    } else if (ralA >= 0) {
      opMelding('The red army gathers before it strikes.');
    } else if (scouts.length) {
      opMelding('Red scouts are racing ahead of the main army.');
    }
  }

  // --- Thuiswacht ---------------------------------------------------------------------
  // Een deel van de reserve blijft thuis: voor een uitval en voor de volgende aanval.
  // Haalt die mannen uit inhoud en geeft ze terug.
  function behoud(inhoud, nr) {
    const I = instelling(nr);
    if (!(I.thuis > 0)) return {};
    const voet = Object.entries(inhoud).filter(([s]) => soorten[s] && !isMachine(soorten[s]) && !isSteun(soorten[s]));
    const totaal = voet.reduce((som, [, n]) => som + n, 0);
    if (totaal < 6) return {};
    let wil = Math.min(6, Math.floor(totaal * I.thuis));
    const thuis = {};
    // Liefst schutters (die verdedigen goed), dan de goedkoopste.
    voet.sort((p, q) => (isSchutter(soorten[q[0]]) ? 1 : 0) - (isSchutter(soorten[p[0]]) ? 1 : 0) || ((soorten[p[0]].kosten || {}).goud || 0) - ((soorten[q[0]].kosten || {}).goud || 0));
    for (const [s, n] of voet) {
      const neem = Math.min(n, wil);
      if (neem <= 0) continue;
      thuis[s] = neem;
      inhoud[s] -= neem;
      if (inhoud[s] <= 0) delete inhoud[s];
      wil -= neem;
    }
    return thuis;
  }

  // --- Tegenzetten ------------------------------------------------------------------------
  // Hoeveel schutters en ridders heb jij? (Machines, steun en je koning tellen niet.)
  function leesSpeler() {
    let n = 0;
    let schutters = 0;
    let opMuur = 0;
    for (const e of leger.lijst) {
      if (e.dood || !e.soldaat) continue;
      const d = soorten[e.soldaat.sleutel];
      if (!d || d.koning || isMachine(d) || isSteun(d)) continue;
      n++;
      if (isSchutter(d)) schutters++;
      if (e.opMuur) opMuur++;
    }
    return { n, schutters, opMuur, aandeel: n ? schutters / n : 0 };
  }

  // Hoeveel meer of minder rood van deze soort wil kopen, gegeven jouw leger.
  function tegenFactor(soort, nr) {
    const s = instelling(nr).tegenzet || 0;
    const d = soorten[soort];
    if (!(s > 0) || !d || isMachine(d) || isSteun(d)) return 1;
    const L = leesSpeler();
    if (L.n < 4) return 1;
    let f = 1;
    if (L.aandeel >= 0.35) {
      // Veel schutters bij jou: schilden, sluipmoordenaars; zelf minder schutters.
      if (d.pijlDekking > 0 && d.pijlDekking < 1) f *= 1 + s;
      if (d.verborgen) f *= 1 + 0.8 * s;
      if (isSchutter(d)) f *= 1 - 0.4 * s;
    } else if (L.aandeel <= 0.3) {
      // Vooral ridders bij jou: schutters en vuur.
      if (isSchutter(d) || d.gebied !== undefined) f *= 1 + 0.8 * s;
    }
    return f;
  }
  // Veel schutters bij jou: een ram extra (die krijgt maar een deel van de pijlen).
  function extraRam(nr) {
    if (!(instelling(nr).tegenzet > 0)) return 0;
    const L = leesSpeler();
    return L.n >= 4 && L.aandeel >= 0.35 ? 1 : 0;
  }

  // --- Piek en rust: elke derde aanval is zwaarder, daarna even rust ------------------------
  function piek(nr) {
    const I = instelling(nr);
    return I.piekElke > 0 && nr % I.piekElke === 0 ? I.piekFactor || 1.3 : 1;
  }
  function rust(nr) {
    // De rust na aanval nr.
    const I = instelling(nr);
    return I.piekElke > 0 && nr > 0 && nr % I.piekElke === 0 ? I.piekRust || 1.3 : 1;
  }

  // --- Verzamelen en opmars --------------------------------------------------------------------
  const takVan = (e) => e.krijg && e.krijg.tak;
  const afstand = (e, p) => Math.hypot(e.x - p.x, e.y - p.y);
  const groepMet = (id) => groepen.find((g) => g.id === id);
  function naarFase(g, fase, nu) {
    g.fase = fase;
    g.sinds = nu;
    g.voorste = Infinity;
    g.voorsteSinds = nu;
    for (const e of g.eenheden) {
      const t = takVan(e);
      if (!t) continue;
      t.verzamel = -1;
      t.rem = false;
      t.mars = fase === 'opmars';
    }
    if (fase === 'opmars' && g.hoofd && instelling(Math.max(1, strijd.golfNr())).niveau >= 2) opMelding('The red army advances!');
  }
  // Is dit vak (de bres) al gevallen?
  const gevallen = (g) => !!g.doel && !(kaart.eigenaar[g.doel.vak] === g.doel.van && kaart.object[g.doel.vak] === g.doel.soort);

  function verzamelStap(g, nu) {
    const n = g.eenheden.length;
    const er = g.eenheden.filter((e) => {
      const t = takVan(e);
      return !t || !(t.verzamel >= 0) || afstand(e, midden(t.verzamel)) <= 2.5;
    }).length;
    if (er * 2 >= n && !g.helftOp) g.helftOp = nu;
    const klaar = er >= n * KLAAR_DEEL || (g.helftOp && nu - g.helftOp >= strijd.stappenVan(HELFT_WACHT)) || nu - g.start >= strijd.stappenVan(VERZAMEL_TIJD);
    if (!klaar) return;
    if (g.volgt) {
      const leider = groepMet(g.volgt);
      if (leider && leider !== g) {
        if (g.na) {
          // De tweede lijn: pas als de hoofdmacht al een tijdje aanvalt.
          if (leider.fase !== 'aanval' || nu - leider.sinds < strijd.stappenVan(g.na)) return;
        } else if (leider.fase === 'verzamel') return;
        // De flank vertrekt zo dat hij tegelijk met de hoofdmacht aankomt.
        else if (leider.fase === 'opmars' && eta(leider) > eta(g) + 2) return;
      }
    }
    naarFase(g, 'opmars', nu);
  }

  // Hoe lang de groep nog nodig heeft naar zijn doel (seconden): de traagste telt.
  // Met machines tellen alleen de machines (de ridders lopen met ze mee).
  function eta(g) {
    const ms = g.eenheden.filter((e) => isMachine(def(e)));
    const lijst = ms.length ? ms : g.eenheden;
    let max = 0;
    for (const e of lijst) max = Math.max(max, afstand(e, g.eind) * WEGFACTOR / (e.snelheid || def(e).snelheid || 1));
    return max;
  }

  // Wie is wat in de opmars.
  function rollen(g) {
    const r = { machine: [], melee: [], achter: [] };
    for (const e of g.eenheden) {
      const d = def(e);
      if (isMachine(d)) r.machine.push(e);
      else if (isSchutter(d) || isSteun(d)) r.achter.push(e);
      else r.melee.push(e);
    }
    return r;
  }
  // Machines die al een tijd niet bewegen (vast, of aan het slopen) tellen niet mee voor het tempo.
  function beweegt(g, e, nu) {
    const t = takVan(e);
    const oud = g.stil.get(e);
    if (!oud || Math.hypot(oud.x - e.x, oud.y - e.y) > 0.3 || (t && t.rem)) {
      g.stil.set(e, { x: e.x, y: e.y, sinds: nu });
      return true;
    }
    return nu - oud.sinds < strijd.stappenVan(VAST);
  }
  const zetRem = (e, aan) => {
    const t = takVan(e);
    if (t) t.rem = aan;
  };

  function opmarsStap(g, nu) {
    g.eta = eta(g);
    const R = rollen(g);
    const p = g.eind;
    const d = (e) => afstand(e, p);
    const voet = R.melee.length ? R.melee : R.achter;
    const voorste = voet.length ? Math.min(...voet.map(d)) : Infinity;
    const actief = R.machine.filter((e) => beweegt(g, e, nu));
    const achterste = actief.length ? Math.max(...actief.map(d)) : -Infinity;
    // Lopen de voorste ridders niet meer op (tegen een muur, of in gevecht) en is de
    // achterste machine dichtbij, dan is de opmars ook klaar.
    const kop = voet.length ? voet.reduce((a, e) => (d(e) < d(a) ? e : a)) : null;
    const kopWacht = kop && takVan(kop) && takVan(kop).rem;
    if (!(g.voorste < Infinity) || voorste < g.voorste - 0.5 || kopWacht) {
      g.voorste = voorste;
      g.voorsteSinds = nu;
    }
    const vastgelopen = nu - g.voorsteSinds >= strijd.stappenVan(6) && (!actief.length || achterste <= voorste + VOORSPRONG + 1.5);
    // Klaar met marcheren: de voorste ridders of een machine staan bij het doel.
    // Met machines: pas als ook de achterste machine bij het doel is (de ridders wachten tot dan
    // op een paar tegels). Zonder machines: als de voorste ridders er zijn.
    const daar = actief.length ? achterste <= 4 : voorste <= 3.5;
    if (daar || vastgelopen || gevallen(g) || nu - g.sinds >= strijd.stappenVan(OPMARS_TIJD)) {
      naarFase(g, 'aanval', nu);
      return;
    }
    const middenVoet = voet.length ? voet.map(d).sort((a, b) => a - b)[Math.floor(voet.length / 2)] : 0;
    for (const e of R.machine) {
      const t = takVan(e);
      if (!voet.length) {   // geen begeleiding meer: terug naar het verzamelpunt
        if (t) { t.rem = false; t.verzamel = t.slot >= 0 ? t.slot : -1; }
        continue;
      }
      // Een machine loopt nooit voor de ridders uit. (Begeleiding volgt vanzelf: de ridders
      // blijven binnen VOORSPRONG tegels van de achterste machine.)
      const marge = t && t.rem ? 0.5 : -0.5;      // even wachten voordat hij weer gaat (geen gehaper)
      zetRem(e, d(e) < voorste + marge);
    }
    for (const e of R.melee) {
      const t = takVan(e);
      const marge = t && t.rem ? 1 : 0;
      const teVer = actief.length && d(e) < achterste - VOORSPRONG + marge;
      const losVanGroep = R.melee.length >= 3 && d(e) < middenVoet - VOORSPRONG + marge;
      zetRem(e, !!(teVer || losVanGroep));
    }
    for (const e of R.achter) {
      const t = takVan(e);
      const marge = t && t.rem ? 1 : 0;
      zetRem(e, R.melee.length > 0 && d(e) < voorste + 1 + marge);
    }
  }

  // In de aanval: is er geen enkele soldaat van de groep meer over, dan gaat een machine
  // die nog niet bij de muur is terug naar het verzamelpunt (en sluit aan bij de volgende aanval).
  function aanvalStap(g) {
    const R = rollen(g);
    if (R.melee.length || R.achter.length) return;
    for (const e of R.machine) {
      const t = takVan(e);
      if (!t || t.terug || t.verzamel >= 0) continue;
      if (afstand(e, g.eind) > 3 && t.slot >= 0 && g.rally >= 0) {
        t.rem = false;
        t.verzamel = t.slot;
      }
    }
  }

  // --- Terugtrekken en terugkomen -----------------------------------------------------------
  function stap() {
    if (++teller % perSeconde) return;
    groepen = groepen.filter((g) => {
      g.eenheden = g.eenheden.filter((e) => !e.dood);
      return g.eenheden.length > 0;
    });
    const nu = strijd.stapNr();
    for (const g of groepen) {
      if (g.fase === 'verzamel') verzamelStap(g, nu);
      else if (g.fase === 'opmars') opmarsStap(g, nu);
      else aanvalStap(g);
    }
    for (const g of groepen) {
      const nr = Math.max(1, strijd.golfNr());
      const I = instelling(nr);
      if (!(I.terugtrek > 0) || nu < g.vrijNa) continue;   // in elke fase: ook wie bij het verzamelpunt of in de opmars verliest
      const levend = g.eenheden.reduce((som, e) => som + e.leven, 0);
      const staat = !g.doel || (kaart.eigenaar[g.doel.vak] === g.doel.van && kaart.object[g.doel.vak] === g.doel.soort);
      // De groep verliest: wie zwaar gewond is, trekt zich terug.
      if (levend / g.hp0 < I.terugtrek && staat) {
        let n = 0;
        for (const e of g.eenheden) {
          const d = def(e);
          const t = strijd.tak(e);
          if (isMachine(d) || t.terug || e.leven / e.levenMax >= 0.55) continue;
          t.terug = true;
          t.herstelSinds = nu;
          t.rem = false;
          t.verzamel = -1;
          t.mars = false;
          n++;
        }
        if (n && !g.gemeld) {
          g.gemeld = true;
          opMelding('Red wounded fall back to their keep to recover.');
        }
      }
      // Wie hersteld is, komt als groepje terug (of als de eerste lang genoeg wacht).
      const klaar = g.eenheden.filter((e) => {
        const t = e.krijg && e.krijg.tak;
        return t && t.terug && e.leven / e.levenMax >= 0.85;
      });
      const oudste = klaar.reduce((m, e) => Math.min(m, e.krijg.tak.herstelSinds || nu), nu);
      if (klaar.length >= 3 || (klaar.length && nu - oudste > strijd.stappenVan(20))) {
        for (const e of klaar) {
          const t = e.krijg.tak;
          t.terug = false;
          t.houdTot = 0;
          t.doel = staat ? g.doel : null;
        }
      }
    }
  }

  return {
    plan, behoud, tegenFactor, extraRam, piek, rust, stap,
    niveau, instelling,
    groepen: () => groepen.map((g) => ({ id: g.id, aantal: g.eenheden.length, hp0: g.hp0, vrijNa: g.vrijNa, fase: g.fase, rally: g.rally, hoofd: g.hoofd })),
    herstel() { groepen = []; teller = 0; },
  };
}
