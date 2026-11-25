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
const VEILIG = 6;           // zoveel tegels blijft het verzamelpunt van jouw muren, poorten en torens (daar kunnen schutters op)
const MARGE = 2;            // zoveel tegels blijft rood buiten het echte bereik van jouw schutters en katapulten
const UITWIJK_MAX = 2;      // zo vaak wijkt rood per aanval uit naar een veiliger verzamelpunt
const STORM_DEEL = 0.6;     // onder vuur: is minstens dit deel er, dan valt rood meteen aan in plaats van uit te wijken
const BELEG_TIJD = 60;      // seconden: zo lang beschieten de katapulten de bres voordat de rest opmarcheert
const SCHIJN_MAX = 75;      // seconden: zo lang wacht de hoofdmacht hooguit op de schijnaanval
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
    for (const veld of ['doelkeuze', 'flank', 'scouts', 'tweede', 'thuis', 'tegenzet', 'terugtrek', 'piekElke', 'piekFactor', 'piekRust', 'aanpas', 'aanpasMax', 'hulp']) {
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
      if (kaart.object[v] === OBJECT.TOREN || kaart.object[v] === OBJECT.WACHTTOREN || kaart.object[v] === OBJECT.MOORDGATENTOREN) lijst.push(midden(v));
    }
    return lijst;
  }

  // Hoeveel van jouw schutters op een toren staan, per torenvak.
  function torenBezetting() {
    const n = new Map();
    for (const e of leger.lijst) {
      if (e.dood || !e.soldaat || !e.opMuur || !isSchutter(soorten[e.soldaat.sleutel] || {})) continue;
      const v = vakVan(e);
      const o = kaart.object[v];
      if (kaart.eigenaar[v] !== 1 || !(o === OBJECT.TOREN || o === OBJECT.WACHTTOREN || o === OBJECT.MOORDGATENTOREN)) continue;
      n.set(v, (n.get(v) || 0) + 1);
    }
    return n;
  }
  // De drukst bezette toren van jou bij een punt (binnen straal), met minstens drie schutters erop. -1 als er geen is.
  function drukkeToren(p, straal = 14) {
    let beste = -1;
    let max = 2;
    for (const [v, n] of torenBezetting()) {
      const m = midden(v);
      const d = Math.hypot(m.x - p.x, m.y - p.y);
      if (d > straal) continue;
      const score = n - d * 0.05;
      if (score > max) { max = score; beste = v; }
    }
    return beste;
  }
  // Hoeveel van jouw schutters op muren en torens staan.
  const muurSchutters = () => leger.lijst.filter((e) => !e.dood && e.soldaat && e.opMuur && isSchutter(soorten[e.soldaat.sleutel] || {})).length;

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
  // --- Aanvalsrooster (0.96.0, Karel 23 november) --------------------------------------
  // Geen sparen meer: rood valt aan volgens een vast rooster (rood.rooster in campagne.json).
  // Bij vertrek wordt het leger samengesteld: een basis, een deel van jouw sterkte (wat bij je
  // kasteel staat telt volledig, je veldleger maar half) en groei per aanval. Elke aanval heeft
  // een soort; je krijgt 25 s van tevoren een waarschuwing.
  let soortNu = null;
  let vorigeSoort = null;
  const RO = () => H.rooster || null;
  const NAAM = { bestorming: 'Assault', belegering: 'Siege', overval: 'Raid', brand: 'Fire', schijn: 'Feint', koningsmoord: 'Assassins' };
  const WAARSCHUWING = {
    bestorming: 'Scouts report: Red comes with ladders and a ram. An assault on your walls!',
    belegering: 'Scouts report: catapults are rolling toward your walls. Ride out to stop them!',
    overval: 'Riders spotted along the cliffs! They are after your farms and workers.',
    brand: 'Scouts report: flameweavers march with Red. Your wooden buildings are in danger!',
    schijn: 'Scouts report: Red splits his army. Watch more than one wall!',
    koningsmoord: 'Scouts report: assassins are on the move. Guard your king!',
  };
  function thuisEnVeld() {
    const b = strijd.burcht();
    let thuis = 0, veld = 0;
    for (const e of leger.lijst) {
      if (e.dood || !e.soldaat) continue;
      const d = soorten[e.soldaat.sleutel];
      if (!d || d.koning) continue;
      // Een schutter op de muur of toren weegt zwaarder (verder bereik, halve schade): rooster.muurGewicht.
      const r = H.rooster || {};
      const w = (H.gewicht[e.soldaat.sleutel] || 1.2) * (e.opMuur && isSchutter(d) ? r.muurGewicht || 1 : 1);
      if (b && Math.hypot(e.x - b.x, e.y - b.y) <= 16) thuis += w; else veld += w;
    }
    return { thuis: thuis + jouwTorens().length, veld };
  }
  function aanvalsGrootte(nr) {
    const r = RO();
    const { thuis, veld } = thuisEnVeld();
    const g = (r.basis || 8) + (r.perAanval || 2) * (nr - 1) + (r.thuis ?? 1) * thuis + (r.veld ?? 0.25) * veld;
    // De eerste aanvallen lopen op: 40%, 60%, 80%, daarna alles.
    const aanloop = Math.min(1, 0.4 + (nr - 1) * 0.2);
    return klem(g * aanloop * piek(nr), r.min || 6, r.max || 40);
  }
  function kiesSoort(nr) {
    const r = RO();
    const lijst = (r.soorten || ['bestorming']).filter((s) => NAAM[s]);
    if (nr === 1 || lijst.length < 2) return lijst.includes('bestorming') ? 'bestorming' : lijst[0];
    // Een overval pas vanaf aanval 2, een koningsmoord pas vanaf aanval 3 (rooster.moordVanaf).
    const keuze = lijst.filter((s) => s !== vorigeSoort && !(s === 'overval' && nr < 2) && !(s === 'koningsmoord' && nr < (r.moordVanaf || 3)));
    return keuze[Math.floor(toeval() * keuze.length)];
  }
  // Wat rood meestuurt bij deze soort aanval (in gewichten, ridder = 1).
  function samenstelling(soort, gewicht, nr) {
    const inh = {};
    const voeg = (s, n) => { if (n > 0 && soorten[s]) inh[s] = (inh[s] || 0) + Math.round(n); };
    const w = (s) => H.gewicht[s] || 1.2;
    const mix = Object.entries(H.leger || {}).filter(([s, m]) => soorten[s] && !isMachine(soorten[s]) && (m.vanaf || 0) <= nr - 1);
    const vul = (budget) => {
      let over = budget;
      let n = 0;
      const totaal = mix.reduce((a, [, m]) => a + (m.aandeel || 1), 0) || 1;
      while (over > 0.4 && mix.length && n < 60) {
        let x = toeval() * totaal;
        let gekozen = mix[0][0];
        for (const [s, m] of mix) { x -= m.aandeel || 1; if (x <= 0) { gekozen = s; break; } }
        voeg(gekozen, 1);
        over -= w(gekozen);
        n++;
      }
    };
    const voet = () => Object.entries(inh).filter(([s]) => !isMachine(soorten[s])).reduce((a, [, n]) => a + n, 0);
    if (soort === 'overval') {
      voeg(soorten.ruiter ? 'ruiter' : 'ridder', klem(gewicht * 0.75 / 1.8, 4, 14));
      return inh;
    }
    if (soort === 'koningsmoord') {
      voeg('sluipmoordenaar', klem(gewicht * 0.3 / 1.5, 2, 4));
      vul(gewicht * 0.3);
      voeg('ladder', 2);
      return inh;
    }
    if (soort === 'brand') {
      voeg(soorten.vlammenwever ? 'vlammenwever' : 'boogschutter', klem(gewicht * 0.3 / 2, 2, 7));
      vul(gewicht * 0.6);
      voeg('ladder', klem(voet() / 7, 1, 3));
      return inh;
    }
    if (soort === 'belegering') {
      vul(gewicht * 0.7);
      voeg('katapult', klem(1 + gewicht / 15 + muurSchutters() / 30, 1, 4));
      voeg('ram', 1);
      voeg('ladder', klem(voet() / 8, 1, 3));
      return inh;
    }
    // Staan er veel schutters van jou op de muren, dan neemt rood katapulten mee tegen je torens.
    const geschut = nr >= katapultVanaf(nr) && muurSchutters() >= 12 ? klem(Math.round(muurSchutters() / 20), 1, 3) : 0;
    vul((soort === 'schijn' ? gewicht * 1.1 : gewicht) - geschut * w('katapult'));
    voeg('ladder', klem(voet() / 6, 1, 4));
    if (voet() >= 6) voeg('ram', klem(voet() / 8, 1, 3));
    voeg('katapult', geschut);
    return inh;
  }
  // Een ingang aan de rand van de kaart, ver van jouw veldleger en niet te ver van je kasteel
  // (een bergpas): voor overvallers en sluipmoordenaars. Null als er geen is.
  function zijIngang(minAfstand = 12) {
    // Een plek langs de rotswand, tussen jouw veldleger en je kasteel (Greyford is een kloof zonder
    // zijpas): ver van je soldaten, niet te ver van je kasteel, liefst tegen de rand. Null als er geen is.
    const b = strijd.burcht();
    if (!b) return null;
    const veldMannen = leger.lijst.filter((e) => !e.dood && e.soldaat && Math.hypot(e.x - b.x, e.y - b.y) > 16);
    const legerAf = veldMannen.length ? Math.hypot(veldMannen.reduce((s, e) => s + e.x, 0) / veldMannen.length - b.x, veldMannen.reduce((s, e) => s + e.y, 0) / veldMannen.length - b.y) : Infinity;
    // Waar rood kan komen: vanaf al zijn mannen die nu op de kaart staan (de burcht zelf is ommuurd).
    const rk = strijd.roodKoning ? strijd.roodKoning() : null;
    const zaden = [...strijd.vijanden(), ...(strijd.wachters ? strijd.wachters() : []), ...(rk ? [rk] : [])].filter((e) => e && !e.dood).map(vakVan);
    if (!zaden.length) return null;
    const bereik = strijd.bereikbaar(zaden);
    let beste = null;
    let score = -Infinity;
    for (const v of bereik) {
      const x = v % B, y = Math.floor(v / B);
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < minAfstand || d > 40) continue;
      const leeg = veldMannen.length ? Math.min(...veldMannen.map((e) => Math.hypot(e.x - x, e.y - y))) : 30;
      if (leeg < 9) continue;
      // Tegen de rand: hoeveel vakken in de buurt zijn niet begaanbaar?
      let rots = 0;
      for (const [ax, ay] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (!bereik.has(v + ay * B + ax)) rots++;
      const voorbij = d < legerAf - 4 ? 8 : 0;   // aan jouw kant van je veldleger
      const s = Math.min(leeg, 25) - 0.3 * d + 2 * rots + voorbij;
      if (s > score) { score = s; beste = { x, y }; }
    }
    return beste;
  }
  // Een overval: geen verzamelpunt, recht op jouw boeren, velden en werken af, ver van je soldaten.
  function planOverval(lijst) {
    const mannen = lijst.filter((e) => !e.dood);
    if (!mannen.length) return;
    const bereik = strijd.bereikbaar(mannen.map(vakVan));
    const doelen = economieDoelen(bereik, mannen[0]);
    const g = { id: volgende++, thuis: vakVan(mannen[0]), eenheden: [], hp0: 0, doel: null, vrijNa: strijd.stapNr(), gemeld: false, herstel: [], fase: 'aanval', eind: doelen.length ? midden(doelen[0]) : { x: strijd.burcht().x, y: strijd.burcht().y }, eindVak: doelen[0] ?? -1, rally: -1, start: strijd.stapNr(), stil: new Map(), hoofd: true, leven: new Map(), overval: true };
    mannen.forEach((e, i) => {
      const t = strijd.tak(e);
      t.groep = g.id;
      t.overval = true;
      t.verzamel = -1; t.rem = false; t.mars = false;
      t.doel = doelen.length ? strijd.bouwDoelOp(doelen[Math.floor(i / 2) % doelen.length]) : null;
      g.eenheden.push(e);
      g.hp0 += e.levenMax;
    });
    groepen.push(g);
  }
  // Gebouwen van jou die geen muur, poort, toren of burcht zijn en die rood zonder hakken bereikt.
  const VERDEDIGING = () => new Set([OBJECT.MUUR, OBJECT.POORT, OBJECT.TOREN, OBJECT.WACHTTOREN, OBJECT.BURCHT, OBJECT.MOORDGATENTOREN, OBJECT.BANIER_BLAUW, OBJECT.BANIER_ROOD].filter((x) => x !== undefined));
  function economieDoelen(bereik, van) {
    const nee = VERDEDIGING();
    const lijst = [];
    for (let v = 0; v < B * HOOG; v++) {
      if (kaart.eigenaar[v] !== 1 || !kaart.object[v] || nee.has(kaart.object[v])) continue;
      let buiten = false;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (bereik.has(v + ay * B + ax)) buiten = true;
      if (buiten) lijst.push(v);
    }
    const p = (v) => midden(v);
    lijst.sort((a, b) => Math.hypot(p(a).x - van.x, p(a).y - van.y) - Math.hypot(p(b).x - van.x, p(b).y - van.y));
    return lijst.slice(0, 8);
  }
  // Houten gebouwen van jou dicht bij het doel (de poort eerst) die van buiten in bereik liggen.
  function houtDoelen(bereik, eind) {
    const hout = new Set(['POORT', 'HOUTHAKKER', 'BOOMGAARD', 'ZAGERIJ', 'TARWEVELD', 'STEENGROEVE', 'VOORRAADKAMER', 'WONING', 'KAZERNE', 'STAL', 'BAKKERIJ', 'KOPERMIJN', 'BELEGERINGSWERKPLAATS'].map((n) => OBJECT[n]).filter((x) => x !== undefined));
    const buitenVakken = [...bereik];
    const lijst = [];
    for (let v = 0; v < B * HOOG; v++) {
      if (kaart.eigenaar[v] !== 1 || !hout.has(kaart.object[v])) continue;
      const p = midden(v);
      if (Math.hypot(p.x - eind.x, p.y - eind.y) > 12) continue;
      let dichtbij = false;
      for (let i = 0; i < buitenVakken.length && !dichtbij; i += 3) {
        const w = buitenVakken[i];
        if (Math.abs(w % B - p.x) < 6 && Math.abs(Math.floor(w / B) - p.y) < 6) dichtbij = true;
      }
      if (dichtbij) lijst.push(v);
    }
    lijst.sort((a, b) => (kaart.object[b] === OBJECT.POORT ? 1 : 0) - (kaart.object[a] === OBJECT.POORT ? 1 : 0) || Math.hypot(midden(a).x - eind.x, midden(a).y - eind.y) - Math.hypot(midden(b).x - eind.x, midden(b).y - eind.y));
    return lijst.slice(0, 4);
  }
  // Uitval (0.96.0): staan jouw belegeraars of schutters vlak bij een muur van rood, dan geeft dit
  // het punt waar zijn bezetting uitvalt (aan zijn kant, een paar tegels terug). Anders null.
  function uitvalPunt() {
    const rk = strijd.rood && strijd.rood();
    if (!rk) return null;
    let beste = null;
    for (const e of leger.lijst) {
      if (e.dood || !e.soldaat) continue;
      const d = soorten[e.soldaat.sleutel];
      if (!d || !(d.alleenBouw || d.staand || d.bereik > 2 || d.ladder)) continue;
      // Ligt er een muur of poort van rood binnen 8 tegels?
      const x0 = Math.floor(e.x), y0 = Math.floor(e.y);
      let muur = -1;
      for (let dy = -8; dy <= 8 && muur < 0; dy++) for (let dx = -8; dx <= 8 && muur < 0; dx++) {
        const v = (y0 + dy) * B + x0 + dx;
        if (x0 + dx < 0 || y0 + dy < 0 || x0 + dx >= B || y0 + dy >= HOOG) continue;
        if (kaart.eigenaar[v] === 2 && (kaart.object[v] === OBJECT.MUUR || kaart.object[v] === OBJECT.POORT)) muur = v;
      }
      if (muur < 0) continue;
      // Het uitvalpunt: aan de kant van de rode burcht, 3 tegels achter die muur.
      const m = midden(muur);
      const dx = rk.x - m.x, dy = rk.y - m.y, l = Math.hypot(dx, dy) || 1;
      const p = { x: Math.round(m.x + dx / l * 3), y: Math.round(m.y + dy / l * 3) };
      if (!beste || Math.hypot(e.x - m.x, e.y - m.y) < beste.afstand) beste = { ...p, doel: { x: e.x, y: e.y }, afstand: Math.hypot(e.x - m.x, e.y - m.y) };
    }
    return beste;
  }

  // Is er al een weg naar jouw burcht (geen muur meer tussen rood en de burcht)?
  function open(bereik) {
    const b = strijd.burcht();
    if (!b) return false;
    const x0 = Math.floor(b.x), y0 = Math.floor(b.y);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const v = (y0 + dy) * B + x0 + dx;
      if (bereik.has(v) && Math.hypot(dx, dy) <= 2.9) return true;
    }
    return false;
  }
  // De bres en de stukken muur, poort en toren van jou ernaast die rood van buiten kan raken,
  // dichtstbijzijnde eerst (hooguit drie).
  function werkplekken(bres, bereik) {
    const x0 = bres % B, y0 = Math.floor(bres / B);
    const lijst = [];
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const v = (y0 + dy) * B + x0 + dx;
      if (x0 + dx < 0 || y0 + dy < 0 || x0 + dx >= B || y0 + dy >= HOOG || kaart.eigenaar[v] !== 1) continue;
      const s = kaart.object[v];
      if (s !== OBJECT.MUUR && s !== OBJECT.POORT && s !== OBJECT.TOREN) continue;
      let buiten = false;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (bereik.has(v + ay * B + ax)) buiten = true;
      if (buiten) lijst.push(v);
    }
    lijst.sort((a, b) => Math.hypot(a % B - x0, Math.floor(a / B) - y0) - Math.hypot(b % B - x0, Math.floor(b / B) - y0));
    return lijst.slice(0, 3);
  }

  // Belegering (sinds 0.82.0): heeft de speler muren, dan neemt rood altijd ladders, een ram en
  // genoeg schutters mee. Geeft de soort die hij nu moet kopen, of null.
  function belegNodig(reserve, nr) {
    const I = instelling(nr);
    if (!(I.niveau >= 2)) return null;
    let muren = 0, poort = false;
    for (let v = 0; v < B * HOOG; v++) {
      if (kaart.eigenaar[v] !== 1) continue;
      const s = kaart.object[v];
      if (s === OBJECT.MUUR || s === OBJECT.TOREN) muren++;
      else if (s === OBJECT.POORT) { muren++; poort = true; }
    }
    if (muren < 6) return null;
    let voet = 0, schutters = 0;
    for (const [s, n] of Object.entries(reserve)) {
      const d = soorten[s];
      if (!d || isMachine(d) || isSteun(d)) continue;
      voet += n;
      if (isSchutter(d)) schutters += n;
    }
    const tel = (s) => reserve[s] || 0;
    if (voet >= 4 && tel('ladder') < Math.min(4, Math.max(1, Math.floor(voet / 6)))) return 'ladder';
    if (nr >= 2 && voet >= 6 && tel('ram') < Math.min(3, Math.max(1, Math.floor(voet / 8))) && (poort || muren >= 6)) return 'ram';
    if (voet >= 4 && schutters < voet * 0.25) {
      const kent = Object.keys(H.leger || {}).filter((s) => soorten[s] && isSchutter(soorten[s]) && !(soorten[s].alleenBouw));
      return kent.includes('boogschutter') ? 'boogschutter' : kent[0] || 'boogschutter';
    }
    return null;
  }

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

  // --- Dreiging: waar jouw schutters en katapulten kunnen raken ----------------------------
  // Elke soldaat van jou die van afstand schiet, met zijn echte bereik (op de muur of in een
  // hinderlaag verder) plus MARGE.
  function dreiging() {
    const lijst = [];
    const extra = regels.muurBereik || 0;
    for (const e of leger.lijst) {
      if (e.dood || !e.soldaat) continue;
      const d = soorten[e.soldaat.sleutel];
      if (!d || !(d.bereik > 2)) continue;
      lijst.push({ x: e.x, y: e.y, r: d.bereik + (e.opMuur || e.hinderlaag ? extra : 0) + MARGE });
    }
    return lijst;
  }
  const veilig = (p, dr) => dr.every((s) => Math.abs(s.x - p.x) >= s.r || Math.abs(s.y - p.y) >= s.r || Math.hypot(s.x - p.x, s.y - p.y) >= s.r);

  // Hoe sterk jouw leger is, in de gewichten van rood (een ridder telt 1).
  function jouwSterkte() {
    let som = 0;
    for (const e of leger.lijst) {
      if (e.dood || !e.soldaat) continue;
      const d = soorten[e.soldaat.sleutel];
      if (!d || d.koning) continue;
      som += H.gewicht[e.soldaat.sleutel] || 1;
    }
    return som + jouwTorens().length;
  }
  // Het aanvalsdoel van rood volgens jouw sterkte (0 als het niveau dat niet doet).
  function sterkteDoel(nr) {
    const I = instelling(nr);
    if (!(I.aanpas > 0)) return 0;
    // Het loopt op: de eerste aanval een derde, de tweede twee derde, daarna volledig.
    return Math.min(I.aanpasMax || 36, I.aanpas * Math.min(1, nr / 3) * jouwSterkte());
  }
  // Goud per seconde dat rood bijkrijgt als hij zijn aanval niet kan betalen.
  const hulp = (nr) => instelling(nr).hulp || 0;
  // Een katapult koopt rood vanaf deze aanval (belegering).
  const katapultVanaf = (nr) => instelling(nr).katapultVanaf || Infinity;
  const isBestorming = (nr) => {
    const I = instelling(nr);
    return I.bestormingElke > 0 && nr % I.bestormingElke === 0;
  };

  // --- Het verzamelpunt ----------------------------------------------------------------
  // Een open plek buiten bereik van jouw torens, muren en poorten, ongeveer VERZAMEL_BEST
  // tegels van het doel, aan de kant waar het leger vandaan komt. -1 als er geen is.
  function kiesVerzamel(eind, bereik, van, dr = dreiging(), weg = null) {
    for (const max of [VERZAMEL_MAX, VERZAMEL_MAX + 6, VERZAMEL_MAX + 12]) {
      const v = zoekVerzamel(eind, bereik, van, dr, max, weg);
      if (v >= 0) return v;
    }
    return -1;
  }
  // weg = een plek die we juist verlaten (verder weg van jouw schutters dan die).
  function zoekVerzamel(eind, bereik, van, dr, maxAfstand, weg) {
    const kb = strijd.burcht();
    const veldPunten = leger.lijst.filter((e) => !e.dood && e.soldaat && kb && Math.hypot(e.x - kb.x, e.y - kb.y) > 16).map((e) => ({ x: e.x, y: e.y }));
    const werk = [];
    for (let v = 0; v < B * HOOG; v++) {
      if (kaart.eigenaar[v] !== 1) continue;
      const s = kaart.object[v];
      if (s === OBJECT.MUUR || s === OBJECT.POORT || s === OBJECT.TOREN || s === OBJECT.WACHTTOREN || s === OBJECT.MOORDGATENTOREN) werk.push(midden(v));
    }
    let beste = -1;
    let min = Infinity;
    for (const v of bereik) {
      if (kaart.eigenaar[v] === 1) continue;
      const p = midden(v);
      const d = Math.hypot(p.x - eind.x, p.y - eind.y);
      if (d < VERZAMEL_MIN || d > maxAfstand) continue;
      if (werk.some((w) => Math.abs(w.x - p.x) < VEILIG && Math.abs(w.y - p.y) < VEILIG && Math.hypot(w.x - p.x, w.y - p.y) < VEILIG)) continue;
      if (!veilig(p, dr)) continue;
      if (weg && Math.hypot(p.x - weg.x, p.y - weg.y) < 4) continue;
      // Open genoeg om met z'n allen te staan, en daar ook veilig?
      let open = 0;
      const x = v % B;
      const y = Math.floor(v / B);
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const w = (y + dy) * B + x + dx;
        if (bereik.has(w) && veilig(midden(w), dr)) open++;
      }
      if (open < 14) continue;
      // Liefst rond VERZAMEL_BEST van het doel, aan de kant van het leger, open, en ruim buiten bereik.
      const ruimte = dr.length ? Math.min(...dr.map((s) => Math.hypot(s.x - p.x, s.y - p.y) - s.r)) : 6;
      // Om jouw veldleger heen (0.96.0): liever ver van jouw soldaten buiten het kasteel.
      const veldDicht = veldPunten.length ? Math.min(...veldPunten.map((q) => Math.hypot(q.x - p.x, q.y - p.y))) : 20;
      const score = Math.abs(d - VERZAMEL_BEST) + 0.25 * Math.hypot(p.x - van.x, p.y - van.y) + 0.3 * (25 - open) - 0.3 * Math.min(ruimte, 4) + 0.5 * Math.max(0, 12 - veldDicht);
      if (score < min) {
        min = score;
        beste = v;
      }
    }
    return beste;
  }
  // Voor elke man een eigen vak rond het verzamelpunt (de dichtstbijzijnde vrije vakken).
  function plekkenRond(centrum, n, bereik, dr = dreiging()) {
    const c = midden(centrum);
    const lijst = [];
    const x0 = centrum % B;
    const y0 = Math.floor(centrum / B);
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const v = (y0 + dy) * B + x0 + dx;
        if (x0 + dx < 0 || y0 + dy < 0 || x0 + dx >= B || y0 + dy >= HOOG || !bereik.has(v)) continue;
        if (!veilig(midden(v), dr)) continue;
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
    const I = { ...instelling(golf) };
    // De soort aanval (rooster, 0.96.0) stuurt het plan bij.
    const soort = soortNu;
    soortNu = null;
    if (soort === 'overval') return planOverval(lijst);
    if (soort === 'schijn') { I.flank = 0.4; I.schijn = I.schijn || 20; }
    if (soort === 'belegering') I.belegering = true;
    if (soort === 'koningsmoord') { I.koningsjagers = true; I.scouts = 1; }
    const nu = strijd.stapNr();
    const mannen = lijst.filter((e) => !e.dood && !e.koning);
    if (!mannen.length) return;
    const zaden = mannen.map(vakVan);
    const bereik = strijd.bereikbaar(zaden);

    const machines = mannen.filter((e) => isMachine(def(e)));
    const voet = mannen.filter((e) => !isMachine(def(e)));

    // Verkenners: de snelste mannen, alleen bij een grotere aanval. Sinds 0.81.0 lopen ze met de
    // hoofdmacht mee (ze hakten eerst alleen op een muur). Vanaf niveau 3 zijn het koningsjagers:
    // zodra er een weg naar jouw koning is (bres, open poort, ladder), rennen ze naar hem toe.
    const scouts = [];
    if (I.scouts > 0 && voet.length >= 8) {
      const snel = voet.filter((e) => !isSteun(def(e))).sort((a, b) => def(b).snelheid - def(a).snelheid);
      for (const e of snel.slice(0, klem(Math.ceil(voet.length * I.scouts), 1, 3))) scouts.push(e);
    }
    const rest = voet.filter((e) => !scouts.includes(e));
    // De tweede lijn: gelijkmatig uit de rest gekozen, zodat het mengsel blijft kloppen.
    const tweede = [];
    const hoofdVoet = [];
    // Sinds 0.82.0 alleen bij een groot leger: anders wordt het opgeknipt in groepjes die apart
    // sneuvelen (Karel, 21 november: aanvallen ongeorganiseerd).
    const ft = I.tweede > 0 && rest.length >= 14 ? I.tweede : 0;
    rest.forEach((e, i) => ((Math.floor((i + 1) * ft) > Math.floor(i * ft)) ? tweede : hoofdVoet).push(e));
    // De flank: een deel van de hoofdmacht kiest een andere weg.
    const flank = [];
    const hoofd = [];
    const ff = I.flank > 0 && (hut >= 0 ? hoofdVoet.length >= 6 : hoofdVoet.length >= (soort === 'schijn' ? 8 : 12)) ? I.flank : 0;
    hoofdVoet.forEach((e, i) => ((Math.floor((i + 1) * ff) > Math.floor(i * ff)) ? flank : hoofd).push(e));
    // Een flank (of schijnaanval) van minder dan 5 man heeft geen zin: dan blijft iedereen bij elkaar.
    if (hut < 0 && flank.length < (soort === 'schijn' ? 3 : 5)) hoofd.push(...flank.splice(0));
    for (const e of machines) hoofd.push(e);

    // Doelen: de bres van de hoofdmacht en van de flank.
    let bresA = -1;
    let bresF = -1;
    let omweg = -1;
    if (hut >= 0) {
      if (flank.length) omweg = omwegBijHut(hut, bereik);
    } else if (open(bereik)) {
      // Er is al een weg naar jouw burcht (vernielde poort, gat in de muur): niet hakken, erdoor.
      if (I.niveau >= 2) opMelding('Red pours through the gap in your defences!');
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
    zet(scouts, 'jager', doelA, eindA, 0, -1);
    zet(hoofd, 'hoofd', doelA, eindA, 0, -1);
    // Niet allemaal op één vak (dan lopen ze om het kasteel heen om een plekje te vinden): de
    // voetsoldaten verdelen zich met drie per stuk over de bres en de stukken muur ernaast, de ram
    // neemt liefst de poort. Zo blijven ze bij elkaar en wordt de bres breder.
    const werkA = bresA >= 0 ? werkplekken(bresA, bereik) : [];
    if (werkA.length > 1) {
      let i = 0;
      for (const r of rijen) {
        if (r.soort !== 'hoofd' && r.soort !== 'jager') continue;
        const d = def(r.e);
        if (isMachine(d)) {
          if (d.alleenBouw && !(d.bereik > 2)) {
            const poort = werkA.find((v) => kaart.object[v] === OBJECT.POORT);
            if (poort >= 0) r.doel = strijd.bouwDoelOp(poort);
          }
          continue;
        }
        if (isSchutter(d) || isSteun(d)) continue;
        r.doel = strijd.bouwDoelOp(werkA[Math.floor(i++ / 3) % werkA.length]);
      }
    }
    if (soort === 'koningsmoord') for (const r of rijen) if (!isMachine(def(r.e)) && !isSchutter(def(r.e))) r.soort = 'jager';
    if (soort === 'brand') {
      // Vlammenwevers mikken op wat van hout is: jouw poort, huizen en werken dicht bij de muur.
      const hout = houtDoelen(bereik, eindA);
      let i = 0;
      for (const r of rijen) if (def(r.e).brand && hout.length) r.doel = strijd.bouwDoelOp(hout[i++ % hout.length]);
    }
    zet(tweede, 'tweede', doelA, eindA, I.tweedeNa || 10, -1);
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
    const dr = dreiging();
    const ralA = marcheert ? kiesVerzamel(eindA, bereik, centrum, dr) : -1;
    const ralF = marcheert && flank.length ? (hut >= 0 && omweg >= 0 ? omweg : bresF >= 0 ? kiesVerzamel(eindF, bereik, centrum, dr) : ralA) : -1;
    const bestorming = isBestorming(golf);
    const kloksTijd = I.synchroon === false ? 0 : Math.max(...rijen.map((r) => r.reis - r.voor - r.verschuiving));
    const nieuweGroep = (fase, eind, eindVak, doel, rally) => {
      const g = { id: volgende++, eenheden: [], hp0: 0, doel, vrijNa: nu, gemeld: false, herstel: [], fase, eind, eindVak, rally, start: nu, helftOp: 0, sinds: nu, volgt: 0, na: 0, stil: new Map(), hoofd: false,
        bereik, centrum, uitwijk: 0, leven: new Map(), schijnVan: 0, schijnNa: 0, schijn: false, beleg: !!I.belegering, belegKlaar: false, jagerGemeld: false, bestorming };
      groepen.push(g);
      return g;
    };
    const gHoofd = nieuweGroep(ralA >= 0 ? 'verzamel' : 'aanval', eindA, eindVakA, doelA, ralA);
    gHoofd.hoofd = true;
    const gTweede = ralA >= 0 ? nieuweGroep('verzamel', eindA, eindVakA, doelA, ralA) : gHoofd;
    gTweede.volgt = gHoofd.id;
    // Bij een grote bestorming komt de tweede lijn veel sneller: één doorlopende stormloop.
    gTweede.na = bestorming ? 4 : I.tweedeNa || 10;
    const gFlank = ralF >= 0 ? nieuweGroep('verzamel', eindF, eindVakF, doelF || doelA, ralF) : gHoofd;
    if (gFlank !== gHoofd && I.schijn > 0) {
      // Schijnaanval (niveau 3): de flank valt eerst aan en trekt jouw schutters weg; de
      // hoofdmacht met de ram slaat pas toe als de flank al I.schijn seconden bezig is.
      gFlank.schijn = true;
      gHoofd.schijnVan = gFlank.id;
      gHoofd.schijnNa = I.schijn;
    } else gFlank.volgt = gHoofd.id;
    const groepVan = (r) => (r.soort === 'tweede' ? gTweede : r.soort === 'flank' ? gFlank : gHoofd);
    // Groepen met hetzelfde verzamelpunt delen één lijst plekken (niemand op elkaars vak).
    const opPlek = new Map();
    for (const g of new Set([gHoofd, gTweede, gFlank])) {
      if (g.rally < 0) continue;
      if (!opPlek.has(g.rally)) {
        // Formatie (0.96.0): de vakken het dichtst bij het doel eerst, zodat de voetsoldaten
        // vooraan staan, de belegering in het midden en de schutters achteraan.
        const p = plekkenRond(g.rally, rijen.length, bereik, dr);
        p.sort((a, b) => Math.hypot(midden(a).x - g.eind.x, midden(a).y - g.eind.y) - Math.hypot(midden(b).x - g.eind.x, midden(b).y - g.eind.y));
        opPlek.set(g.rally, p);
      }
    }
    const rang = (e) => { const d = def(e); return isMachine(d) ? 1 : isSchutter(d) ? 3 : isSteun(d) ? 2 : 0; };
    rijen.sort((a, b) => rang(a.e) - rang(b.e));
    for (const r of rijen) {
      const g = groepVan(r);
      const t = strijd.tak(r.e);
      t.groep = g.id;
      t.doel = r.doel;
      t.rem = false;
      // Koningsjagers: bij een koningsmoord altijd, anders pas vanaf aanval 3 (een koning die bij de
      // eerste aanval sneuvelt, voelt oneerlijk).
      t.jager = r.soort === 'jager' && !!I.koningsjagers && (soort === 'koningsmoord' || golf >= 3);
      if (g.fase === 'verzamel') {
        t.verzamel = opPlek.get(g.rally).shift();
        t.slot = t.verzamel;
        t.mars = true;
        t.houdTot = 0;
        t.via = -1;
      } else {
        // De oude rekensom als er geen verzamelpunt is.
        const wacht = I.synchroon === false ? 0 : klem(kloksTijd + r.voor + r.verschuiving - r.reis, 0, MAX_WACHT);
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
    if (bestorming) opMelding('A great assault! Red throws everything at you.');
    if (bresA >= 0 && I.niveau >= 3) {
      opMelding(`Red ${ralA >= 0 ? 'gathers outside' : 'masses at'} your ${richting(bresA)} wall!${bresF >= 0 ? ` A second force circles toward your ${richting(bresF)} side.` : ''}`);
    } else if (omweg >= 0) {
      opMelding('Red hunters circle around to take the hut from two sides!');
    } else if (ralA >= 0) {
      opMelding('The red army gathers before it strikes.');
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
    // Sinds 0.82.0 liefst voetvolk (de goedkoopste eerst): de schutters gaan mee met de aanval,
    // anders hakt rood met zwaarden op jouw muur terwijl jouw schutters ongestoord schieten.
    voet.sort((p, q) => (isSchutter(soorten[p[0]]) ? 1 : 0) - (isSchutter(soorten[q[0]]) ? 1 : 0) || ((soorten[p[0]].kosten || {}).goud || 0) - ((soorten[q[0]].kosten || {}).goud || 0));
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
    if (isBestorming(nr)) return I.bestormingFactor || 1.6;
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
    if (fase === 'beleg') {
      // Alleen de katapulten gaan; de rest blijft op het verzamelpunt.
      const toren = H.rooster && g.doel ? drukkeToren(midden(g.doel.vak)) : -1;   // alleen met een aanvalsrooster (Greyford)
      for (const e of katapulten(g)) {
        const t = takVan(e);
        if (!t) continue;
        t.verzamel = -1;
        t.rem = false;
        t.mars = false;
        if (toren >= 0) t.doel = strijd.bouwDoelOp(toren);
      }
      if (g.hoofd) opMelding(toren >= 0 ? `Red catapults shell your ${richting(toren)} tower and the archers on it!` : 'Red catapults open fire on your walls!');
      return;
    }
    for (const e of g.eenheden) {
      const t = takVan(e);
      if (!t) continue;
      t.verzamel = -1;
      t.rem = false;
      t.mars = fase === 'opmars';
    }
    if (fase === 'opmars' && instelling(Math.max(1, strijd.golfNr())).niveau >= 2) {
      if (g.schijn) opMelding(`Red storms your ${richting(g.eindVak >= 0 ? g.eindVak : vakVan(g.eenheden[0]))} side!`);
      else if (g.hoofd) opMelding(g.schijnVan || g.belegKlaar ? `The main red host advances on your ${richting(g.eindVak >= 0 ? g.eindVak : vakVan(g.eenheden[0]))} wall!` : 'The red army advances!');
    }
  }
  // Is dit vak (de bres) al gevallen?
  const gevallen = (g) => !!g.doel && !(kaart.eigenaar[g.doel.vak] === g.doel.van && kaart.object[g.doel.vak] === g.doel.soort);

  // Wordt de groep beschoten, of staat iemand binnen bereik van jouw schutters?
  function onderVuur(g, dr) {
    let geraakt = false;
    for (const e of g.eenheden) {
      const oud = g.leven.get(e);
      // Alleen wie al op (of vlak bij) zijn verzamelvak staat telt: wie onderweg slaags raakt, is
      // niet "onder vuur op het verzamelpunt".
      const t = takVan(e);
      const opPlek = t && t.verzamel >= 0 && afstand(e, midden(t.verzamel)) <= 4;
      if (opPlek && oud !== undefined && e.leven < oud - 0.5) geraakt = true;
      g.leven.set(e, e.leven);
    }
    if (geraakt) return true;
    // Komen jouw schutters binnen bereik van het verzamelpunt zelf, dan is het ook niet veilig meer.
    if (g.rally >= 0 && !veilig(midden(g.rally), dr)) return true;
    return g.eenheden.some((e) => {
      const t = takVan(e);
      return t && t.verzamel >= 0 && afstand(e, midden(t.verzamel)) <= 2.5 && !veilig(e, dr);
    });
  }
  // Uitwijken: een nieuw verzamelpunt buiten bereik, verder dan het oude.
  function wijkUit(g, dr) {
    const nieuw = kiesVerzamel(g.eind, g.bereik, g.centrum, dr, midden(g.rally));
    if (nieuw < 0) return false;
    const oud = g.rally;
    g.rally = nieuw;
    g.uitwijk++;
    g.helftOp = 0;
    const plekken = plekkenRond(nieuw, g.eenheden.length, g.bereik, dr);
    for (const e of g.eenheden) {
      const t = takVan(e);
      if (!t || t.terug) continue;
      t.verzamel = plekken.shift();
      t.slot = t.verzamel;
    }
    // Groepen die hetzelfde punt deelden (de tweede lijn), gaan mee.
    for (const h of groepen) {
      if (h === g || h.rally !== oud || h.fase !== 'verzamel') continue;
      h.rally = nieuw;
      const p2 = plekkenRond(nieuw, g.eenheden.length + h.eenheden.length, g.bereik, dr).slice(g.eenheden.length);
      for (const e of h.eenheden) {
        const t = takVan(e);
        if (!t || t.terug) continue;
        t.verzamel = p2.shift();
        t.slot = t.verzamel;
      }
    }
    if (g.hoofd) opMelding('Red pulls back out of your archers\' reach.');
    return true;
  }
  // Mag de hoofdmacht al? Bij een schijnaanval pas als de flank een tijdje aanvalt.
  function schijnKlaar(g, nu) {
    if (!g.schijnVan) return true;
    const f = groepMet(g.schijnVan);
    if (!f || !f.eenheden.some((e) => !e.dood)) return true;
    if (nu - g.start >= strijd.stappenVan(VERZAMEL_TIJD + SCHIJN_MAX)) return true;
    return f.fase === 'aanval' && nu - f.sinds >= strijd.stappenVan(g.schijnNa);
  }
  const katapulten = (g) => g.eenheden.filter((e) => { const d = def(e); return d.alleenBouw && d.bereik > 2; });

  function verzamelStap(g, nu) {
    const n = g.eenheden.length;
    const er = g.eenheden.filter((e) => {
      const t = takVan(e);
      return !t || !(t.verzamel >= 0) || afstand(e, midden(t.verzamel)) <= 2.5;
    }).length;
    if (er * 2 >= n && !g.helftOp) g.helftOp = nu;
    // Onder vuur: uitwijken als nog weinig mannen er zijn, anders meteen aanvallen.
    const dr = dreiging();
    if (g.rally >= 0 && onderVuur(g, dr)) {
      if (er < n * STORM_DEEL && g.uitwijk < UITWIJK_MAX && wijkUit(g, dr)) return;
      if (er >= n * STORM_DEEL || g.uitwijk >= UITWIJK_MAX) {
        if (g.hoofd) opMelding('Under fire, the red army charges!');
        g.schijnVan = 0;
        naarFase(g, 'opmars', nu);
        return;
      }
    }
    const klaar = er >= n * KLAAR_DEEL || (g.helftOp && nu - g.helftOp >= strijd.stappenVan(HELFT_WACHT)) || nu - g.start >= strijd.stappenVan(VERZAMEL_TIJD);
    if (!klaar) return;
    if (g.volgt) {
      const leider = groepMet(g.volgt);
      if (leider && leider !== g) {
        if (g.na) {
          // De tweede lijn komt g.na seconden na de hoofdmacht aan (niet pas als die al lang vecht).
          const lEta = leider.fase === 'opmars' ? eta(leider) : leider.fase === 'aanval' ? -(nu - leider.sinds) / perSeconde : Infinity;
          if (!(eta(g) >= lEta + g.na)) return;
        } else if (leider.fase === 'verzamel' || leider.fase === 'beleg') return;
        // De flank vertrekt zo dat hij tegelijk met de hoofdmacht aankomt.
        else if (leider.fase === 'opmars' && eta(leider) > eta(g) + 2) return;
      }
    }
    // Belegering (niveau 4): eerst beschieten de katapulten de bres vanaf afstand.
    if (g.beleg && !g.belegKlaar && g.doel && katapulten(g).length) {
      naarFase(g, 'beleg', nu);
      return;
    }
    if (!schijnKlaar(g, nu)) return;
    naarFase(g, 'opmars', nu);
  }

  // De katapulten beschieten de bres; de rest wacht op het verzamelpunt (buiten bereik).
  function belegStap(g, nu) {
    const k = katapulten(g).filter((e) => !e.dood);
    const lev = g.doel ? strijd.levenOp(g.doel.vak) : null;
    const half = lev && lev.max ? lev.leven / lev.max < 0.5 : false;
    const dr = dreiging();
    const klaar = !k.length || gevallen(g) || half || nu - g.sinds >= strijd.stappenVan(BELEG_TIJD) || onderVuur(g, dr);
    if (!klaar) return;
    g.belegKlaar = true;
    if (!schijnKlaar(g, nu) && nu - g.sinds < strijd.stappenVan(BELEG_TIJD + 30)) return;
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
    // Wie binnen bereik van jouw schutters staat, wacht niet: stilstaan onder vuur is het slechtste (0.82.0).
    const dr = dreiging();
    const onder = (e) => !veilig(e, dr);
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
      zetRem(e, !!(teVer || losVanGroep) && !onder(e));
    }
    for (const e of R.achter) {
      const t = takVan(e);
      const marge = t && t.rem ? 1 : 0;
      const dd = def(e);
      // Dekking: een schutter die zijn bres in bereik heeft, blijft staan en schiet.
      const opBereik = isSchutter(dd) && !dd.brand && !!g.doel && d(e) <= dd.bereik - 0.3;
      zetRem(e, opBereik || (R.melee.length > 0 && d(e) < voorste + 1 + marge && !onder(e)));
    }
  }

  // In de aanval: is er geen enkele soldaat van de groep meer over, dan gaat een machine
  // die nog niet bij de muur is terug naar het verzamelpunt (en sluit aan bij de volgende aanval).
  function aanvalStap(g) {
    const R = rollen(g);
    // Overvallers: is hun doel weg, dan het volgende stuk van jouw economie.
    if (g.overval) {
      for (const e of g.eenheden) {
        const t = takVan(e);
        if (!t || (t.doel && !(kaart.eigenaar[t.doel.vak] === t.doel.van && kaart.object[t.doel.vak] === t.doel.soort))) {
          const nieuw = economieDoelen(strijd.bereikbaar([vakVan(e)]), e);
          if (t) {
            t.doel = nieuw.length ? strijd.bouwDoelOp(nieuw[0]) : null;
            // Niets meer te plunderen: terug naar waar ze binnenkwamen, en aanvallen wat daar komt.
            if (!nieuw.length) { t.overval = false; t.uitval = g.thuis >= 0 ? g.thuis : vakVan(e); }
          }
        }
      }
      return;
    }
    // Schutters geven dekking (0.96.0): op hun bereik van de bres blijven staan en schieten, tot de bres valt.
    for (const e of R.achter) {
      const t = takVan(e);
      const d = def(e);
      if (!t || t.terug || !isSchutter(d) || d.brand) continue;
      t.rem = !gevallen(g) && !!g.doel && afstand(e, g.eind) <= d.bereik - 0.3;
    }
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
    // De opmars wordt drie keer per seconde bijgestuurd (een ladderdrager loopt anders tussen twee
    // controles ruim 2 tegels uit); de rest één keer per seconde.
    if (++teller % Math.max(1, Math.round(perSeconde / 3)) === 0) {
      const nu0 = strijd.stapNr();
      for (const g of groepen) if (g.fase === 'opmars' && teller % perSeconde) { g.eenheden = g.eenheden.filter((e) => !e.dood); if (g.eenheden.length) opmarsStap(g, nu0); }
    }
    if (teller % perSeconde) return;
    groepen = groepen.filter((g) => {
      g.eenheden = g.eenheden.filter((e) => !e.dood);
      return g.eenheden.length > 0;
    });
    const nu = strijd.stapNr();
    for (const g of groepen) {
      // Een katapult van rood waarvan de toren is gevallen, zoekt de volgende volle toren bij de bres.
      if (!H.rooster || g.fase === 'verzamel' || !g.doel || !g.beleg) continue;
      for (const e of katapulten(g)) {
        const t = takVan(e);
        if (!t || t.terug || (t.doel && t.doel.vak !== g.doel.vak && kaart.eigenaar[t.doel.vak] === 1 && kaart.object[t.doel.vak] === t.doel.soort)) continue;
        const toren = drukkeToren(midden(g.doel.vak));
        if (toren >= 0) t.doel = strijd.bouwDoelOp(toren);
      }
    }
    for (const g of groepen) {
      if (g.fase === 'verzamel') verzamelStap(g, nu);
      else if (g.fase === 'beleg') belegStap(g, nu);
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
    sterkteDoel, hulp, katapultVanaf, jouwSterkte, belegNodig, drukkeToren, torenBezetting, muurSchutters,
    rooster: RO, aanvalsGrootte, samenstelling, zijIngang, uitvalPunt, thuisEnVeld,
    kiesSoort, naam: (s) => NAAM[s] || s,
    // De waarschuwing; bij een aanval langs de rotswand met de richting erbij.
    waarschuwing(s, plek = null) {
      if (plek && s === 'overval') return `Riders spotted along the ${richting(Math.floor(plek.y) * B + Math.floor(plek.x))} cliffs! They are after your farms and workers.`;
      if (plek && s === 'koningsmoord') return `Scouts report: assassins are on the move along the ${richting(Math.floor(plek.y) * B + Math.floor(plek.x))} cliffs. Guard your king!`;
      return WAARSCHUWING[s] || '';
    },
    zijAfstand: (s) => (s === 'koningsmoord' ? 26 : 12),
    zetSoort(s) { soortNu = s; vorigeSoort = s; },
    // Een koningsjager heeft een weg naar jouw koning gevonden (eenmaal per groep melden).
    jagerDoor(e) {
      const t = takVan(e);
      const g = t && groepMet(t.groep);
      if (!g || g.jagerGemeld) return;
      g.jagerGemeld = true;
      opMelding('Red king-hunters are through! Protect your king!');
    },
    niveau, instelling,
    groepen: () => groepen.map((g) => ({ id: g.id, aantal: g.eenheden.length, hp0: g.hp0, vrijNa: g.vrijNa, fase: g.fase, rally: g.rally, hoofd: g.hoofd, eind: g.eind })),
    herstel() { groepen = []; teller = 0; },
  };
}
