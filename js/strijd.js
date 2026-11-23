// STRIJD: vechten, de aanvallen van de rode heer, winnen en verliezen.
//
// Wie vecht heet hier een krijger: een soldaat van de speler (gemaakt in
// leger.js) of een vijand (hier gemaakt). Elke krijger heeft leven en
// kiest een paar keer per seconde wat hij doet:
//   - Ziet hij een tegenstander, dan valt hij die aan. Een ridder loopt
//     erheen, een boogschutter schiet van afstand.
//   - Een vijand zonder tegenstander loopt naar je burcht en beukt erop.
//     Is je burcht helemaal ommuurd, dan breekt hij door wat in de weg staat.
//   - Wie op de muur staat, blijft daar staan. Een boogschutter schiet van
//     de muur verder en is half zo goed te raken; een ridder op de grond
//     kan er niet bij.
// De rode heer stuurt zijn mannen in golven, steeds opnieuw. Je wint door
// zijn burcht te laten vallen: breek door zijn poort of zijn muur en beuk
// op zijn burcht. Op zijn muren lopen wachters die schieten, en zijn
// burcht schiet terug. Valt jouw burcht, dan heb je verloren.
// Alle getallen staan in data/economie.json (soldaten en strijd) en
// data/bouwwerken.json (leven).

import { geluid } from './geluid.js';
import { CONFIG } from './config.js';
import { OBJECT, GROND } from './kaart.js';
import { SOORT } from './eenheden.js';
import { BREEK, HOOG } from './wegvinden.js';
import { maakToeval } from './toeval.js';

const SPELER = 0;
const VIJAND = 1;
const DENK = 5;             // om de zoveel rekenstappen kiest een krijger opnieuw wat hij doet
const MAX_EFFECTEN = 260;    // pijlen en gevallenen die tegelijk in beeld kunnen zijn
const MAX_VIJANDEN = 130;   // aanvallers (en het garnizoen van het tentenkamp, level 4)
const MAX_VIJANDEN_PROLOOG = 200;   // de overmacht van de proloog: 80 ineens (naar Karel)
const WRAAK_VER = 12;       // zo ver loopt iemand achter een schutter aan die hem raakte

const ROOD = 2;              // eigenaar van wat de rode heer heeft gebouwd

// opVerandering(): tijd om te bewaren. opStand(): de cijfers in beeld moeten
// mee. opMelding(tekst): een bericht voor de speler. opVerwoest(werk, van):
// er is een bouwwerk vernield (van = 1: van jou, 2: van rood).
// opKaart(vakken): de kaart is veranderd zonder dat er gebouwd is.
// opEinde('gewonnen' of 'verloren').
export function maakStrijd({ regels, kaart, wegvinder, eenheden, leger, bouwer, bouwwerken, opVerandering, opStand, opMelding, opVerwoest, opKaart, opEinde, opTerug = () => {} }) {
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const HB = CONFIG.tegel.breedte / 2;
  const HH = CONFIG.tegel.hoogte / 2;
  const perSeconde = CONFIG.spel.stappenPerSeconde;
  const stappen = (seconden) => Math.max(1, Math.round(seconden * perSeconde));
  const soorten = regels.soldaten;
  const R = regels.strijd;
  const golven = R.golven;
  const herstelNa = stappen(R.herstelNa);
  const herstelElke = stappen(R.herstelElke);
  const toeval = maakToeval(kaart.zaad + 77);

  for (const [nummer, golfje] of golven.entries()) {
    for (const sleutel of Object.keys(golfje)) {
      if (!soorten[sleutel]) throw new Error(`economie.json: onbekende soldaat "${sleutel}" in golf ${nummer + 1}`);
    }
  }
  for (const [sleutel, def] of Object.entries(soorten)) {
    // Een stormram vecht niet (schade 0), een ladderdrager vecht niet en beukt niet.
    const nodig = ['leven', 'slagTijd', 'bereik', 'zicht'];
    // Een banierdrager en een heler (steun) vechten ook niet.
    if (!def.alleenBouw && !def.ladder && !def.steun) nodig.push('schade');
    if (!def.ladder && !def.steun) nodig.push('schadeBouw');
    for (const kolom of nodig) {
      if (!(def[kolom] > 0)) throw new Error(`economie.json: soldaat ${sleutel} mist een goed getal bij ${kolom}`);
    }
  }

  // --- De stand ---------------------------------------------------------------------
  const vijanden = [];
  const effecten = [];          // voor de tekenlaag: pijlen en wie er valt
  const vluchten = [];          // stenen van een trebuchet onderweg: de schade komt pas als de steen er is
  const balken = [];            // voor de tekenlaag: het leven van beschadigde bouwwerken
  const schade = new Map();     // vak -> { leven, soort } van een beschadigd bouwwerk
  let stapNr = 0;
  let golf = 0;                 // hoeveel golven er al gestuurd zijn
  let klok = stappen(R.eersteGolf);   // rekenstappen tot de volgende golf
  let vrede = golven.length === 0;    // gewonnen en verder gespeeld: er komt niemand meer
  let uitslag = null;           // 'gewonnen' of 'verloren': het spel staat stil
  let koningBeschermd = false;   // level 8: de rode koning kan nog niet vallen
  let gestaakt = false;          // level 10: het gevecht is gestaakt (Wessel op de muur); niemand beweegt nog
  let stil = false;             // de test kan de klok van de golven stilzetten
  let burchtGemeld = false;
  let heer = null;              // de rode heer met eigen economie (js/rood.js); die bepaalt dan wanneer er wordt aangevallen
  let veld = null;              // de veldheer van rood (js/veldheer.js): timing, doelkeuze, terugtrekken
  let teller = 0;

  // Elke heer heeft een burcht: drie bij drie tegels rond zijn beginpunt.
  // plekken = de tegels er recht naast: daar staat wie hem aanvalt.
  const isBurcht = (soort) => soort === OBJECT.BURCHT || soort === OBJECT.BANIER_BLAUW || soort === OBJECT.BANIER_ROOD;
  function maakBurcht(team, leven) {
    const m = kaart.start[team];
    const plekken = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = m.x + dx;
        const y = m.y + dy;
        if (!isBurcht(kaart.object[y * B + x])) continue;
        for (const [rx, ry] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const buur = (y + ry) * B + x + rx;
          if (x + rx < 0 || y + ry < 0 || x + rx >= B || y + ry >= H) continue;
          if (Math.abs(x + rx - m.x) <= 1 && Math.abs(y + ry - m.y) <= 1) continue;
          if (!plekken.includes(buur)) plekken.push(buur);
        }
      }
    }
    const x = m.x + 0.5;
    const y = m.y + 0.5;
    return { team, vx: m.x, vy: m.y, vak: m.y * B + m.x, x, y, leven, max: leven, afkoel: 0, rust: 0, plekken, doel: { burcht: true, team, x, y, straal: 1.5 } };
  }
  const burchten = [maakBurcht(SPELER, R.burchtLeven), maakBurcht(VIJAND, R.roodBurchtLeven || R.burchtLeven)];
  const burcht = burchten[SPELER];   // die van jou
  const rood = burchten[VIJAND];     // die van de rode heer
  const thuis = kaart.start[SPELER];
  const thuisVak = burcht.vak;
  const burchtDoel = burcht.doel;
  // --- Doeltype B (level 4): een bouwwerk van jou dat je moet houden ------------------
  // De vijand gaat er eerst op af; valt het, dan heb je verloren.
  let hutVak = -1;
  let hutGevallen = false;
  const hutStaat = () => hutVak >= 0 && kaart.eigenaar[hutVak] === 1 && kaart.object[hutVak] !== OBJECT.GEEN;
  // --- De koningen ------------------------------------------------------------------
  // Eén voor jou (in je leger) en één voor rood. Valt jouw koning, dan heb je
  // verloren; valt die van rood, dan heb je gewonnen.
  const koningSleutel = Object.keys(soorten).find((s) => soorten[s].koning) || null;
  let roodKoning = null;
  const koningVan = (team) => (team === SPELER ? leger.lijst.find((e) => e.soldaat && soorten[e.soldaat.sleutel].koning && !e.dood) || null : roodKoning && !roodKoning.dood ? roodKoning : null);
  const bijThuis = (e, r) => Math.hypot(e.x - burchten[e.team].x, e.y - burchten[e.team].y) <= r;
  function maakRoodKoning(leven) {
    if (!koningSleutel || roodKoning || R.proloog) return;   // in de proloog is er nog geen rode heer
    // Aan de voorkant van de burcht (de kant naar de camera), anders staat de
    // heer achter zijn eigen toren en zie je hem niet.
    const voorkant = [...rood.plekken].sort((a, b) => ((b % B) + Math.floor(b / B)) - ((a % B) + Math.floor(a / B)));
    for (const vak of voorkant) {
      if (!wegvinder.isVrij(vak % B, Math.floor(vak / B), VIJAND)) continue;
      roodKoning = maakVijand(koningSleutel, vak, leven);
      roodKoning.koning = true;
      // Een heer met een boog (Mechteld) schiet pijlen in plaats van te slaan.
      if (R.roodKoningSchiet) roodKoning.krijg.def = { ...roodKoning.krijg.def, ...R.roodKoningSchiet, zwaai: 0, zwaaiAantal: 0 };
      // In de campagne heeft elke heer zijn eigen kracht (stap 32).
      const f = R.roodKoningLeven || 1;
      if (f !== 1) {
        roodKoning.levenMax = Math.max(1, Math.round(soorten[koningSleutel].leven * f));
        roodKoning.leven = Number.isFinite(leven) ? klem(Math.round(leven), 1, roodKoning.levenMax) : roodKoning.levenMax;
      }
      maakLijfwachten(vak);
      return;
    }
  }
  // Lijfwachten (level 5): soldaten die vlak bij de rode heer blijven en hem verdedigen.
  function maakLijfwachten(koningVak) {
    const lw = R.lijfwacht;
    if (!lw || !soorten[lw.soort]) return;
    const x0 = koningVak % B;
    const y0 = Math.floor(koningVak / B);
    let gemaakt = 0;
    for (let r = 1; r <= 4 && gemaakt < lw.aantal; r++) {
      for (let dy = -r; dy <= r && gemaakt < lw.aantal; dy++) {
        for (let dx = -r; dx <= r && gemaakt < lw.aantal; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const vak = (y0 + dy) * B + x0 + dx;
          if (!wegvinder.isVrij(x0 + dx, y0 + dy, VIJAND) || vijanden.some((a) => !a.dood && vakVan(a) === vak)) continue;
          const g = maakVijand(lw.soort, vak);
          g.lijfwacht = true;
          gemaakt++;
        }
      }
    }
  }
  // --- Het garnizoen van rood (level 4: het tentenkamp) -------------------------------
  // Soldaten die in het kamp blijven staan. Komt er iets van jou in zicht, dan gaan ze erop af,
  // maar niet ver van hun post; is het voorbij, dan lopen ze terug. Het garnizoen telt niet
  // mee als aanvaller en komt dus ook niet op je burcht af.
  const GARNIZOEN_KETTING = 9;   // zo ver gaan ze van hun post om iets aan te vallen
  const GARNIZOEN_SLENTER = 3;   // zo ver slenteren ze rond bij hun post
  function maakGarnizoen(lijst) {
    if (R.proloog || !koningSleutel) return 0;
    const nieuwMaken = !Array.isArray(lijst);
    const m = kaart.start[VIJAND];
    let gemaakt = 0;
    if (!nieuwMaken) {
      for (const regel of lijst) {
        if (!Array.isArray(regel)) continue;
        const [sleutel, x, y, leven, post] = regel;
        if (!Object.prototype.hasOwnProperty.call(soorten, sleutel) || !Number.isInteger(x) || !Number.isInteger(y)) continue;
        const vak = vrijBij(y * B + x);
        if (vak < 0) continue;
        const e = maakVijand(sleutel, vak, leven);
        e.garnizoen = true;
        e.post = Number.isInteger(post) && post >= 0 && post < B * H ? post : vak;
        gemaakt++;
      }
      return gemaakt;
    }
    const wens = R.garnizoen;
    if (!wens) return maakExtraGarnizoen();
    const sleutels = [];
    for (const [sleutel, aantal] of Object.entries(wens)) if (soorten[sleutel]) for (let i = 0; i < aantal; i++) sleutels.push(sleutel);
    if (!sleutels.length) return maakExtraGarnizoen();
    // Alle vrije vakken in het kamp die te voet bereikbaar zijn vanaf de ingang van de commandotent.
    const ingang = vrijBij(m.y * B + m.x + 2);
    const plekken = [];
    for (let ver = 8; ver <= 14 && plekken.length < sleutels.length * 2; ver += 3) {
      plekken.length = 0;
      for (let dy = -ver; dy <= ver; dy++) {
        for (let dx = -ver; dx <= ver; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 2) continue;
          const x = m.x + dx;
          const y = m.y + dy;
          if (x < 1 || y < 1 || x >= B - 1 || y >= H - 1 || !wegvinder.isVrij(x, y, VIJAND)) continue;
          if (ingang >= 0 && !wegvinder.verbonden(ingang, y * B + x, VIJAND)) continue;
          plekken.push(y * B + x);
        }
      }
    }
    const schud = (rij) => { for (let i = rij.length - 1; i > 0; i--) { const j = Math.floor(toeval() * (i + 1)); [rij[i], rij[j]] = [rij[j], rij[i]]; } return rij; };
    schud(plekken);
    schud(sleutels);
    for (let i = 0; i < sleutels.length && i < plekken.length; i++) {
      const e = maakVijand(sleutels[i], plekken[i]);
      e.garnizoen = true;
      e.post = plekken[i];
      gemaakt++;
    }
    opStand();
    return gemaakt + maakExtraGarnizoen();
  }
  // Het garnizoen van de buitenposten (kaart.posten, level 6): per post dezelfde samenstelling
  // (rood.postGarnizoen: { soort: aantal }). Wie dicht bij de poort staat, vecht met het zwaard;
  // schutters staan verder naar achteren op het erf, en wie er geen plek meer heeft staat voor de poort.
  const MELEE = new Set(['ridder', 'zwaardvechter', 'bijlridder', 'steenwachter', 'banierdrager', 'hellebaardier']);
  function maakPostGarnizoen() {
    const wens = R.postGarnizoen;
    const posten = kaart.posten || [];
    if (R.proloog || !wens || !posten.length) return 0;
    const sleutels = [];
    for (const [sleutel, aantal] of Object.entries(wens)) if (soorten[sleutel]) for (let i = 0; i < aantal; i++) sleutels.push(sleutel);
    if (!sleutels.length) return 0;
    sleutels.sort((a, b) => (MELEE.has(b) ? 1 : 0) - (MELEE.has(a) ? 1 : 0));   // eerst het zwaardvolk
    let gemaakt = 0;
    for (const p of posten) {
      const M = p.maat;
      const tegels = [];
      for (let dy = -M - 2; dy <= M + 2; dy++) {
        for (let dx = -M - 2; dx <= M + 2; dx++) {
          const rand = Math.max(Math.abs(dx), Math.abs(dy));
          const x = p.x + dx;
          const y = p.y + dy;
          if (x < 1 || y < 1 || x >= B - 1 || y >= H - 1 || rand === M || (dx === 0 && dy === 0)) continue;
          // Buiten de muur alleen het stuk vlak voor de poort.
          if (rand > M && Math.hypot(x - p.poort.x, y - p.poort.y) > 3.2) continue;
          if (!wegvinder.isVrij(x, y, VIJAND)) continue;
          const naarPoort = Math.hypot(x - p.poort.x, y - p.poort.y);
          tegels.push({ vak: y * B + x, binnen: rand < M, afstand: naarPoort });
        }
      }
      // Eerst het erf (dichtbij de poort het eerst), dan pas het stuk buiten de poort.
      tegels.sort((a, b) => (a.binnen === b.binnen ? a.afstand - b.afstand : a.binnen ? -1 : 1));
      for (let i = 0; i < sleutels.length && i < tegels.length; i++) {
        const e = maakVijand(sleutels[i], tegels[i].vak);
        e.garnizoen = true;
        e.post = tegels[i].vak;
        gemaakt++;
      }
    }
    if (gemaakt) opStand();
    return gemaakt;
  }
  // Het slotplein (level 6): soldaten op het erf van het grote kasteel (rood.slotGarnizoen: { soort: aantal }).
  // Ze staan tussen de binnenmuur en het slot en gedragen zich als het garnizoen van het kamp.
  function maakSlotGarnizoen() {
    const wens = R.slotGarnizoen;
    if (R.proloog || !wens || !koningSleutel) return 0;
    const sleutels = [];
    for (const [sleutel, aantal] of Object.entries(wens)) if (soorten[sleutel]) for (let i = 0; i < aantal; i++) sleutels.push(sleutel);
    if (!sleutels.length) return 0;
    sleutels.sort((a, b) => (MELEE.has(b) ? 1 : 0) - (MELEE.has(a) ? 1 : 0));   // zwaardvolk dichtbij de poort, schutters naar het slot
    const m = kaart.start[VIJAND];
    const binnen = (kaart.ringen && kaart.ringen.length ? Math.min(...kaart.ringen.map((r) => r.maat)) : 6) - 1;
    const tegels = [];
    for (let dy = -binnen; dy <= binnen; dy++) {
      for (let dx = -binnen; dx <= binnen; dx++) {
        const rand = Math.hypot(dx, dy);
        if (rand < 2.4 || rand > binnen + 0.2) continue;
        const x = m.x + dx;
        const y = m.y + dy;
        if (x < 1 || y < 1 || x >= B - 1 || y >= H - 1 || !wegvinder.isVrij(x, y, VIJAND)) continue;
        tegels.push(y * B + x);
      }
    }
    // Gelijkmatig over het erf verspreid: om en om uit de gesorteerde lijst, zodat ze niet in een hoop staan.
    tegels.sort((a, b) => Math.atan2(Math.floor(a / B) - m.y, (a % B) - m.x) - Math.atan2(Math.floor(b / B) - m.y, (b % B) - m.x));
    const stap = Math.max(1, Math.floor(tegels.length / sleutels.length));
    let gemaakt = 0;
    for (let i = 0; i < sleutels.length && i * stap < tegels.length; i++) {
      const vak = tegels[i * stap];
      if (vijanden.some((a) => !a.dood && vakVan(a) === vak)) continue;
      const e = maakVijand(sleutels[i], vak);
      e.garnizoen = true;
      e.post = vak;
      gemaakt++;
    }
    if (gemaakt) opStand();
    return gemaakt;
  }
  // De torens van rood (level 6): op de helft een ballista, op een kwart een kruisboogschutter.
  // rood.torens: { ballista: deel, kruisboog: deel } (delen tussen 0 en 1). Ze staan vast op hun toren,
  // schieten alleen op wat binnen bereik komt en hebben geen ingenieur nodig. Valt de toren, dan vallen zij ook.
  // Een schutter of ballista op een rode toren richt minder schade aan dan zijn soortgenoot op de grond (schatting van Claude, na te lezen).
  const TOREN_SCHADE = R.torens && Number.isFinite(R.torens.schade) ? R.torens.schade : 0.6;
  function roodTorenVakken() {
    const m = kaart.start[VIJAND];
    const lijst = [];
    for (let i = 0; i < kaart.object.length; i++) {
      if (kaart.eigenaar[i] !== ROOD || roodWeg.has(i)) continue;
      if (kaart.object[i] !== OBJECT.TOREN && kaart.object[i] !== OBJECT.WACHTTOREN) continue;
      lijst.push(i);
    }
    // Rond het slot gesorteerd, buitenste ring eerst bij gelijke hoek: zo wisselen ze netjes af.
    lijst.sort((a, b) => Math.atan2(Math.floor(a / B) - m.y, (a % B) - m.x) - Math.atan2(Math.floor(b / B) - m.y, (b % B) - m.x));
    return lijst;
  }
  function zetTorenPost(sleutel, vak, leven) {
    const e = maakVijand(sleutel, vak, leven);
    e.torenPost = true;
    e.lagen = false;
    e.opMuur = true;
    e.hoogte = eenheden.hoogteOp(vak);
    e.snelheid = 0;
    return e;
  }
  function maakTorenPosten() {
    const w = R.torens;
    if (R.proloog || !w || typeof w !== 'object' || !koningSleutel) return 0;
    let torens = roodTorenVakken();
    let gemaakt = 0;
    // De torens op het rotseiland (Greyford) hebben altijd bezetting: de eerste een ballista, de tweede een kruisboogschutter, en afwisselend verder.
    const eiland = torens.filter((v) => eilandVakken.has(v));
    eiland.forEach((vak, k) => {
      const sleutel = k % 2 === 0 ? 'ballista' : 'kruisboog';
      if (!soorten[sleutel]) return;
      zetTorenPost(sleutel, vak);
      gemaakt++;
    });
    torens = torens.filter((v) => !eilandVakken.has(v));
    const deelBallista = soorten.ballista ? klem(Number(w.ballista) || 0, 0, 1) : 0;
    const deelKruisboog = soorten.kruisboog ? klem(Number(w.kruisboog) || 0, 0, 1) : 0;
    let balans = 0;
    let balansK = 0;
    for (const vak of torens) {
      balans += deelBallista;
      if (balans >= 1 - 1e-9) {
        balans -= 1;
        zetTorenPost('ballista', vak);
        gemaakt++;
        continue;
      }
      balansK += deelKruisboog / Math.max(0.01, 1 - deelBallista);
      if (balansK >= 1 - 1e-9) {
        balansK -= 1;
        zetTorenPost('kruisboog', vak);
        gemaakt++;
      }
    }
    if (gemaakt) opStand();
    return gemaakt;
  }
  // De ruiterreserve (Greyford): rood.ruiterReserve is een lijst met aantallen, een per plek in kaart.reservePlekken.
  // Zij staan bij hun stal binnen een muur en jagen op een trebuchet, een katapult of een ingenieur die slecht bewaakt wordt
  // (rood.ruiterReserve.bewaking: hoeveel eigen soldaten er hoogstens binnen 7 tegels mogen staan, standaard 3). Daarna gaan ze terug.
  const RESERVE = R.ruiterReserve || null;
  function maakRuiterReserve() {
    const aantallen = RESERVE && Array.isArray(RESERVE.aantallen) ? RESERVE.aantallen : null;
    const plekken = kaart.reservePlekken || [];
    if (R.proloog || !aantallen || !plekken.length || !soorten.ruiter) return 0;
    let gemaakt = 0;
    plekken.forEach((vak0, n) => {
      const x0 = vak0 % B;
      const y0 = Math.floor(vak0 / B);
      let over = aantallen[n] || 0;
      for (let rad = 0; rad <= 5 && over > 0; rad++) {
        for (let dy = -rad; dy <= rad && over > 0; dy++) {
          for (let dx = -rad; dx <= rad && over > 0; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
            const x = x0 + dx;
            const y = y0 + dy;
            if (x < 1 || y < 1 || x >= B - 1 || y >= H - 1 || !wegvinder.isVrij(x, y, VIJAND)) continue;
            const vak = y * B + x;
            if (vijanden.some((a) => !a.dood && vakVan(a) === vak)) continue;
            const e = maakVijand('ruiter', vak);
            e.garnizoen = true;
            e.post = vak;
            e.jager = true;
            gemaakt++;
            over--;
          }
        }
      }
    });
    if (gemaakt) opStand();
    return gemaakt;
  }
  // Tegenbatterij (Greyford): vaste trebuchets van rood achter muur 2 en 3, elk bediend door twee ingenieurs.
  // Ze beschieten jouw bouwwerken binnen bereik; alleen de ingenieurs doden (ruiters, boogschutters) legt ze stil.
  function maakTegenbatterij() {
    const n = R.tegenbatterij || 0;
    const plekken = kaart.batterijPlekken || [];
    if (R.proloog || !n || !plekken.length || !soorten.trebuchet || !soorten.ingenieur) return 0;
    let gemaakt = 0;
    for (const vak of plekken.slice(0, n)) {
      if (!wegvinder.isVrij(vak % B, Math.floor(vak / B), VIJAND) || staandOp(vak)) continue;
      const t = maakVijand('trebuchet', vak);
      t.garnizoen = true;
      t.post = vak;
      let nodig = 2;
      for (let rad = 1; rad <= 3 && nodig > 0; rad++) {
        for (let dy = -rad; dy <= rad && nodig > 0; dy++) {
          for (let dx = -rad; dx <= rad && nodig > 0; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
            const x = (vak % B) + dx;
            const y = Math.floor(vak / B) + dy;
            if (x < 1 || y < 1 || x >= B - 1 || y >= H - 1 || !wegvinder.isVrij(x, y, VIJAND)) continue;
            const v2 = y * B + x;
            if (vijanden.some((a) => !a.dood && vakVan(a) === v2)) continue;
            const ing = maakVijand('ingenieur', v2);
            ing.garnizoen = true;
            ing.post = v2;
            krijgVan(ing).ing = { fase: 'bedien', treb: t };
            nodig--;
          }
        }
      }
      gemaakt++;
    }
    if (gemaakt) opStand();
    return gemaakt;
  }
  // Elke seconde: welke doelen van de speler zijn slecht bewaakt?
  let jagerDoelen = [];
  function jagerStap() {
    if (stapNr % stappen(1) !== 0) return;
    const max = Number.isFinite(RESERVE && RESERVE.bewaking) ? RESERVE.bewaking : 3;
    jagerDoelen = [];
    for (const a of leger.lijst) {
      if (a.dood) continue;
      const sl = a.soldaat && a.soldaat.sleutel;
      if (sl !== 'ingenieur' && sl !== 'trebuchet' && sl !== 'katapult') continue;
      let bewaker = 0;
      for (const b of leger.lijst) {
        if (b.dood || b === a || !b.soldaat) continue;
        const bs = b.soldaat.sleutel;
        if (bs === 'ingenieur' || bs === 'trebuchet' || bs === 'katapult' || bs === 'ladder' || bs === 'ram') continue;
        if (Math.hypot(b.x - a.x, b.y - a.y) <= 7) bewaker++;
      }
      if (bewaker <= max) jagerDoelen.push(a);
    }
  }
  function jagerProoi(e) {
    const bereik = (RESERVE && RESERVE.bereik) || 45;
    let beste = null;
    let bestAfstand = bereik;
    for (const a of jagerDoelen) {
      if (a.dood) continue;
      const d = Math.hypot(a.x - e.x, a.y - e.y);
      // een ingenieur gaat voor: zonder hem schiet de trebuchet niet meer
      const score = a.soldaat && a.soldaat.sleutel === 'ingenieur' ? d * 0.6 : d;
      if (score < bestAfstand) { beste = a; bestAfstand = score; }
    }
    return beste;
  }
  const maakExtraGarnizoen = () => maakSlotGarnizoen() + maakPostGarnizoen() + maakTorenPosten() + maakRuiterReserve() + maakTegenbatterij();
  const garnizoenLijst = () => vijanden.filter((e) => e.garnizoen && !e.dood);
  // Een man van het garnizoen: vecht wat in zicht komt, binnen de ketting, en gaat daarna naar zijn post.
  function garnizoenDenk(e, k, anderen) {
    const px = (e.post % B) + 0.5;
    const py = Math.floor(e.post / B) + 0.5;
    const ver = Math.hypot(e.x - px, e.y - py);
    if (e.jager) {
      const prooi = jagerProoi(e);
      if (prooi) {
        k.doelwit = prooi;
        if (Math.hypot(prooi.x - e.x, prooi.y - e.y) <= bereikVan(e, k) && kanRaken(e, k, prooi)) return;
        jaag(e, k);
        return;
      }
    }
    k.doelwit = kiesDoelwit(e, k, anderen);
    if (k.doelwit) {
      const d = Math.hypot(k.doelwit.x - e.x, k.doelwit.y - e.y);
      if (d <= bereikVan(e, k) && kanRaken(e, k, k.doelwit)) return;   // binnen bereik: slaan of schieten
      if (ver <= (stapNr < (e.alarmTot || 0) ? ALARM_KETTING : GARNIZOEN_KETTING)) { jaag(e, k); return; }
      k.doelwit = null;
    }
    if (e.pad) return;
    if (ver > GARNIZOEN_SLENTER + 1) {   // te ver van zijn post (na een gevecht): terug
      const pad = zoekPad(e, e.post);
      if (pad) zetPad(e, pad);
      return;
    }
    // Rustig heen en weer: om de paar seconden slentert een deel van de soldaten naar een
    // ander plekje bij zijn post en blijft daar even staan. Zo is het kamp levendig.
    if (stapNr < (k.rondNa || 0)) return;
    k.rondNa = stapNr + stappen(2 + toeval() * 6);
    if (toeval() > 0.65) return;
    for (let poging = 0; poging < 8; poging++) {
      const x = Math.round(px - 0.5 + (toeval() * 2 - 1) * GARNIZOEN_SLENTER);
      const y = Math.round(py - 0.5 + (toeval() * 2 - 1) * GARNIZOEN_SLENTER);
      if (x < 1 || y < 1 || x >= B - 1 || y >= H - 1 || (x === Math.floor(e.x) && y === Math.floor(e.y))) continue;
      const vak = y * B + x;
      if (!wegvinder.isVrij(x, y, e.team) || bezetDoorVriend(vak, e)) continue;
      const pad = zoekPad(e, vak);
      if (pad && pad.length && pad.length <= 8) { zetPad(e, pad); return; }
    }
  }
  const inBurcht = (vak, b) => Math.abs((vak % B) - b.vx) <= 1 && Math.abs(Math.floor(vak / B) - b.vy) <= 1 && isBurcht(kaart.object[vak]);

  // Het kasteel van rood zoals het er aan het begin staat, om het bij
  // opnieuw beginnen terug te kunnen zetten. roodWeg = wat er vernield is.
  const roodOrigineel = new Map();
  for (let i = 0; i < B * H; i++) if (kaart.eigenaar[i] === ROOD) roodOrigineel.set(i, kaart.object[i]);
  const roodWeg = new Set();
  const isRodeMuur = (vak) => {
    const soort = kaart.object[vak];
    return kaart.eigenaar[vak] === ROOD && (soort === OBJECT.MUUR || soort === OBJECT.TOREN || soort === OBJECT.WACHTTOREN || soort === OBJECT.MOORDGATENTOREN || soort === OBJECT.POORT);
  };
  // De stukken muur waar een wachter loopt: zoveel als er in economie.json
  // staat (wachters), één per stuk, te beginnen bij de vier halve muren.
  const alleRoutes = (kaart.kastelen[VIJAND] && kaart.kastelen[VIJAND].routes) || [];
  const routes = alleRoutes.slice(0, Number.isInteger(R.wachters) && R.wachters >= 0 ? R.wachters : alleRoutes.length);
  const wachterSoort = soorten[R.wachter] ? R.wachter : null;

  // Hoeveel een bouwwerk kan hebben.
  const werkVan = new Map(Object.values(bouwwerken).map((werk) => [werk.soort, werk]));
  // van = 2: van rood. In de campagne zijn zijn muren sterker of zwakker (stap 33).
  // Greyford (kaart.tolMuren): elke volgende muur is sterker (sterkte per muur), en de torens op het rotseiland zijn extra taai.
  const eilandVakken = new Set(kaart.eilandTorens || []);
  const tolSterkte = (vak) => {
    if (vak === undefined) return 1;
    if (eilandVakken.has(vak)) return kaart.eilandSterkte || 1;
    const y = Math.floor(vak / B);
    for (const w of kaart.tolMuren || []) if (y >= w.rij && y < w.rij + w.lagen) return w.sterkte || 1;
    return 1;
  };
  const maxLeven = (soort, van = 0, vak) => {
    const werk = werkVan.get(soort);
    const basis = (werk && werk.leven) || R.gebouwLeven;
    const m = van === 2 && R.roodMuurFactor ? Math.round(basis * R.roodMuurFactor) : basis;
    return van === 2 ? Math.round(m * tolSterkte(vak)) : m;
  };

  // --- Hulpjes ----------------------------------------------------------------------
  const vakVan = (e) => Math.floor(e.y) * B + Math.floor(e.x);
  const vrijVoor = (vak, team) => wegvinder.isVrij(vak % B, Math.floor(vak / B), team);
  const lijstVan = (team) => (team === SPELER ? leger.lijst : vijanden);
  const houdingVan = (def) => (def.bereik > 2 ? 'schiet' : 'sla');
  const isSchutter = (k) => k.def.bereik > 2;
  // Hoe ver iemand raakt: een schutter op de muur komt verder.
  // Een ballista op een rode toren reikt korter dan die van jou (R.torens.bereik, schatting van Claude, na te lezen): anders bestrijken 15 ballista's heel de omgeving van het kasteel.
  const bereikVan = (e, k) => (e.torenPost && k.def.geschut && R.torens && Number.isFinite(R.torens.bereik) ? Math.min(k.def.bereik, R.torens.bereik) : k.def.bereik) + ((e.opMuur || e.hinderlaag) && isSchutter(k) ? R.muurBereik : 0);   // hoog in de rotsen schiet ook verder
  // Een ridder kan alleen iemand raken die op dezelfde hoogte staat.
  const kanRaken = (e, k, a) => isSchutter(k) || !!a.opMuur === !!e.opMuur;
  // Een soldaat van de speler op de grond mag een vijand op het dak van zijn hoofdkasteel als doel houden: hij klimt erheen.
  const klimtNaar = (e, k, a) => !isSchutter(k) && !k.def.alleenBouw && !k.def.ladder && !!a.opMuur && !e.opMuur && a.team !== e.team && kaart.object[vakVan(a)] === OBJECT.BURCHT;
  const klem = (getal, laag, hoog) => Math.max(laag, Math.min(hoog, getal));
  const verVan = (e, vak) => Math.hypot((vak % B) + 0.5 - e.x, Math.floor(vak / B) + 0.5 - e.y);
  // Het vak waar iemand staat, of waar hij naar op weg is.
  const staVak = (a) => (a.pad && a.pad.length ? a.pad[a.pad.length - 1] % (B * H) : vakVan(a));
  // Een stormram en een ladderdrager vechten niet met soldaten.
  const vreedzaam = (k) => !!(k.def.alleenBouw || k.def.ladder || k.def.steun);
  // Hoeveel van een pijl er doorkomt: een stormram heeft een dak.
  const dekkingVan = (doel) => {
    const d = doel.krijg && doel.krijg.def.pijlDekking;
    return d > 0 && d < 1 ? d : 1;
  };
  // Een sluipmoordenaar die al even niet heeft geslagen, zie je pas van dichtbij.
  const verborgenVoor = (a, d) => {
    if (a.onzichtbaar) return true;   // de verborgen reserve van rood (level 9)
    if (a.gezienDoorZiener) return false;   // een ziener van de andere kant ziet hem
    const ka = krijgVan(a);
    return !!(ka && ka.def.verborgen && stapNr >= (ka.gezienTot || 0) && d > ka.def.verborgen);
  };
  const N = B * H;
  const knoopVan = (e) => vakVan(e) + (e.opMuur ? N : 0);
  // De ladders: vak -> [dx, dy], de kant van de muur waar hij tegenaan staat.
  const ladderKant = new Map();
  const vasteLadders = new Set();   // vakken waar een belegeringstoren zijn ladder zette: die valt niet zo makkelijk om
  const isMuurVan = (vak, team) => vak >= 0 && vak < N && kaart.object[vak] === OBJECT.MUUR && kaart.eigenaar[vak] === team + 1;

  function krijgVan(e, def) {
    if (!e.krijg) {
      e.krijg = {
        def: def || soorten[e.soldaat.sleutel],
        afkoel: 0,                       // rekenstappen tot de volgende klap
        denk: (teller++ % DENK) + 1,     // rekenstappen tot hij opnieuw kiest
        doelwit: null,                   // de tegenstander die hij aanvalt
        bevel: null,                     // de vijand die de speler heeft aangewezen
        wraak: null,                     // wie hem van ver heeft geraakt
        bouw: null,                      // het bouwwerk waar hij op beukt
        bouwBevel: null,                 // het bouwwerk van rood dat de speler heeft aangewezen
        doelVak: -1,                     // waar zijn doelwit stond toen hij de route zocht
        rust: 0,                         // rekenstappen sinds zijn laatste gevecht
        schuif: false,                   // hij stapt opzij voor een ander
        pose: 0,
        negeer: null, negeerTot: 0,      // bij wie hij net niet kon komen
        ladder: -1,                      // het stuk muur waar hij een ladder tegen zet
        klim: -1,                        // het stuk muur waar een sluipmoordenaar op klimt
        ladderKlok: 0,
        duw: 0,                          // hoe lang hij al aan een ladder van rood duwt
        tak: null,                       // het plan van de veldheer van rood (js/veldheer.js)
      };
    }
    return e.krijg;
  }

  // fysiek = alleen wie er nu echt staat telt, niet wie er nog naartoe loopt.
  function bezetDoorVriend(vak, e, fysiek = false) {
    const lijst = lijstVan(e.team);
    for (let i = 0; i < lijst.length; i++) {
      const a = lijst[i];
      if (a === e || a.dood) continue;
      if (fysiek ? vakVan(a) === vak : staVak(a) === vak) return true;
    }
    return false;
  }

  // Te hoog voor een poort (de belegeringstoren): hij ziet elke poort als dicht.
  const hoogBeeld = (e, beeld) => (e.krijg && e.krijg.def.hoog ? beeld + HOOG : beeld);
  function zoekPad(e, naar, beeld = e.team) {
    const van = vakVan(e);
    return wegvinder.zoekPad(van % B, Math.floor(van / B), naar % B, Math.floor(naar / B), hoogBeeld(e, beeld));
  }

  function zetPad(e, pad) {
    e.pad = pad && pad.length ? pad : null;
    e.stap = 0;
  }

  // Op het scherm loopt x naar rechtsonder en y naar linksonder.
  function kijkNaar(e, x, y) {
    const d = (x - e.x) - (y - e.y);
    if (Math.abs(d) > 0.01) e.kijkt = d > 0 ? 1 : -1;
  }

  function zetHouding(e, houding) {
    if (e.houding === houding) return;
    e.houding = houding;
    if (!houding) e.pose = 0;
  }

  // Het vrije vak op r tegels rond een vak dat het dichtst bij deze krijger
  // ligt en waar hij kan komen, of -1.
  function plekRond(e, vak, r, fysiek = false, buiten = null, voor = false, achter = null) {
    const x = vak % B;
    const y = Math.floor(vak / B);
    const hier = vakVan(e);
    let beste = -1;
    let min = Infinity;
    // achter: een punt van de tegenstander; liefst sta je aan de andere kant van het vak (achter je machine)
    let ax = 0;
    let ay = 0;
    if (achter) {
      ax = x - (achter.x || 0);
      ay = y - (achter.y || 0);
      const l = Math.hypot(ax, ay) || 1;
      ax /= l;
      ay /= l;
    }
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const kandidaat = ny * B + nx;
        if ((buiten && buiten.includes(kandidaat)) || !wegvinder.verbonden(hier, kandidaat, e.team) || bezetDoorVriend(kandidaat, e, fysiek)) continue;
        const d = verVan(e, kandidaat) - (voor ? 3 * (dx + dy) : 0) - (achter ? 8 * (dx * ax + dy * ay) : 0);   // voor: aan de voorkant; achter: aan de kant van de machine die van de tegenstander af ligt
        if (d < min) {
          min = d;
          beste = kandidaat;
        }
      }
    }
    return beste;
  }

  // Kan deze krijger naast die ander komen?
  function kanBij(e, a) {
    const hier = vakVan(e);
    const x = Math.floor(a.x);
    const y = Math.floor(a.y);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (x + dx < 0 || y + dy < 0 || x + dx >= B || y + dy >= H) continue;
        if (wegvinder.verbonden(hier, (y + dy) * B + x + dx, e.team)) return true;
      }
    }
    return false;
  }

  // --- Wat je ziet: pijlen, gevallenen en de balkjes boven bouwwerken ------------------
  function effect(wat) {
    if (effecten.length >= MAX_EFFECTEN) { const i = effecten.findIndex((f) => f.soort !== 'ruiter'); effecten.splice(Math.max(0, i), 1); }
    wat.van = performance.now();
    effecten.push(wat);
  }
  const pijl = (x1, y1, h1, x2, y2, h2, steen = false) =>
    effect({ soort: 'pijl', steen, x1, y1, h1, x2, y2, h2, duur: (steen ? 400 : 130) + 45 * Math.hypot(x2 - x1, y2 - y1) });
  const val = (e) => effect({ soort: 'val', x: e.x, y: e.y, team: e.team, duur: 1500 });
  // Een rookwolkje (Bartholt verschijnt of verdwijnt)
  const rook = (x, y) => effect({ soort: 'rook', x, y, duur: 800 });
  // Een ruiter galoppeert langs een route (lijst van [x, y]) en draagt Wessel weg (proloog)
  const ruiter = (route, duur) => effect({ soort: 'ruiter', route, duur });

  function balkenBij() {
    balken.length = 0;
    for (const [vak, s] of schade) {
      balken.push({ x: vak % B, y: Math.floor(vak / B), deel: klem(s.leven / (s.max || maxLeven(s.soort, s.van, vak)), 0, 1) });
    }
    for (const b of burchten) {
      if (b.leven < b.max) balken.push({ x: b.vx, y: b.vy, deel: klem(b.leven / b.max, 0, 1), groot: true });
    }
  }

  // Er is gebouwd of gesloopt: schade aan wat er niet meer staat vervalt.
  function kaartVeranderd() {
    let weg = false;
    for (const [vak, s] of schade) {
      if (kaart.eigenaar[vak] === s.van && kaart.object[vak] === s.soort) continue;
      schade.delete(vak);
      weg = true;
    }
    if (weg) balkenBij();
    // Wat er van het kasteel van rood verdwenen is, onthouden we.
    for (const vak of roodOrigineel.keys()) {
      if (kaart.eigenaar[vak] !== ROOD) roodWeg.add(vak);
    }
    // Een wachter van rood wiens muur weg is, staat op de grond en doet
    // voortaan mee met de aanval. Is alleen zijn route korter geworden,
    // dan loopt hij het stuk dat er nog staat.
    for (const e of vijanden) {
      if (e.torenPost && !e.dood && !isRodeMuur(vakVan(e))) {
        delete e.torenPost;   // zijn toren is weg: hij staat op de grond
        e.snelheid = e.krijg.def.snelheid;
      }
      if (e.wachter === undefined && e.opMuur && !e.dood && !wegvinder.isMuur(Math.floor(e.x), Math.floor(e.y), VIJAND)) {
        // Hij stond op jouw muur en die is weg (of zijn ladder): hij staat weer op de grond.
        e.opMuur = false;
        e.klimt = false;
        e.hoogte = 0;
        e.pad = null;
        e.krijg.bouw = null;
        e.krijg.denk = 1;
      }
      if (e.wachter === undefined || e.dood) continue;
      if (!isRodeMuur(vakVan(e))) {
        delete e.wachter;
        e.opMuur = false;
        e.hoogte = 0;
        e.ronde = null;
        e.pad = null;
        e.snelheid = e.krijg.def.snelheid;
        e.krijg.denk = 1;
      } else if (e.ronde && !e.ronde.every(isRodeMuur)) {
        zetRonde(e, e.ronde);
      }
    }
  }

  // Zet een wachter op het stuk van zijn route dat er nog staat, rond de
  // plek waar hij nu is. Is dat nog maar één tegel, dan blijft hij staan.
  function zetRonde(e, ronde) {
    let bij = 0;
    let min = Infinity;
    for (let i = 0; i < ronde.length; i++) {
      const d = verVan(e, ronde[i]);
      if (d < min) {
        min = d;
        bij = i;
      }
    }
    let a = bij;
    let b = bij;
    while (a > 0 && isRodeMuur(ronde[a - 1])) a--;
    while (b < ronde.length - 1 && isRodeMuur(ronde[b + 1])) b++;
    const stuk = ronde.slice(a, b + 1);
    if (stuk.length < 2 || !isRodeMuur(ronde[bij])) {
      e.ronde = null;
      e.pad = null;
      return;
    }
    e.ronde = stuk;
    e.pad = stuk;
    e.stap = bij - a;
  }

  // --- Raken ------------------------------------------------------------------------
  // Het geluid van een klap of schot, naar het wapen (js/geluid.js).
  const PIJL_GELUID = { kruisboog: 'crossbow_shot' };
  const KLAP_GELUID = { bijlridder: 'axe_hit', steenwachter: 'axe_hit', sluipmoordenaar: 'assassin_stab', saboteur: 'assassin_stab' };
  function klapGeluid(e, k, doel) {
    const sl = k.def.sleutel || '';
    const plek = { x: doel.x, y: doel.y };
    if (k.def.gebied !== undefined) return geluid.speel('fire_cast', { x: e.x, y: e.y });
    if (k.def.windstoot) return;
    if (sl === 'katapult' || sl === 'trebuchet') {   // de trebuchet klinkt als een katapult
      geluid.speel('catapult_launch', { x: e.x, y: e.y });
      return geluid.speel('catapult_impact', { x: doel.x, y: doel.y, wacht: (k.def.staand ? 650 : 400) + (k.def.staand ? 85 : 45) * Math.hypot(doel.x - e.x, doel.y - e.y) });
    }
    if (sl === 'ram') return geluid.speel('ram_hit', plek);
    if (k.def.alleenBouw && !KLAP_GELUID[sl]) return;
    if (isSchutter(k)) return geluid.speel(PIJL_GELUID[sl] || 'arrow_release', { x: e.x, y: e.y });
    // Een zwaard of bijl op een muur of gebouw klinkt als een klap op hout en steen.
    if ((doel.vak !== undefined || doel.burcht) && !KLAP_GELUID[sl]) return geluid.speel('building_hit', plek);
    if (k.def.koning && e.team === SPELER) return geluid.speel('sword_heavy', plek);
    geluid.speel(KLAP_GELUID[sl] || 'sword_hit', plek);
  }
  // Een pijl komt aan: het geluid klinkt pas als hij er is.
  function inslagGeluid(doel, naam, vanX, vanY) {
    const wacht = 130 + 45 * Math.hypot(doel.x - vanX, doel.y - vanY);
    geluid.speel(naam, { x: doel.x, y: doel.y, wacht });
  }

  function slaToe(e, k) {
    k.afkoel = stappen(k.def.slagTijd);
    k.pose = 3;
    e.pose = 1;
    e.schotTijd = performance.now();   // de tekenlaag laat de arm van een trebuchet doorzwaaien
    k.schotStap = stapNr;              // en de ingenieurs halen hem daarna met de windas terug
    k.rust = 0;
  }

  // door = wie de klap uitdeelde (null: de wacht op de burcht).
  // Bloed: rode spettertjes bij een treffer, groter bij een dode, met een plas die blijft liggen.
  function bloed(x, y, h, groot) {
    effect({ soort: 'bloed', x, y, h: h || 0, groot: !!groot, duur: groot ? 800 : 520 });
    if (groot) effect({ soort: 'plas', x, y, duur: 24000 });
  }
  // Een burger of soldaat vermoord: bloed, een plas en een lijk dat een tijdje blijft liggen.
  function vermoord(x, y, kleur) {
    geluid.speel('death_civilian', { x, y });
    bloed(x, y, 6, true);
    effect({ soort: 'lijk', x, y, kleur: kleur || '#8a6a4a', duur: 24000 });
  }

  function raak(doel, hoeveel, door) {
    doel.leven -= hoeveel;
    if (hoeveel > 0) {
      bloed(doel.x, doel.y, (doel.hoogte || 0) + 8, doel.leven <= 0);
      // Een klap van dichtbij: een lichtflits bij het wapen
      if (door && Math.hypot(door.x - doel.x, door.y - doel.y) < 2.6) effect({ soort: 'klap', x: (door.x + doel.x) / 2, y: (door.y + doel.y) / 2, h: (doel.hoogte || 0) + 10, duur: 150 });
    }
    // In de proloog sneuvelt geen koning: het verhaal gaat door.
    if (R.proloog && krijgVan(doel).def.koning && doel.team === SPELER) doel.leven = Math.max(doel.leven, Math.ceil(doel.levenMax / 2));   // naar Karel: niet onder de helft
    // Level 8: zolang de sluis staat, kan de rode koning niet sneuvelen (js/loodsen.js, daarna: 'koning').
    if (koningBeschermd && doel.team === VIJAND && krijgVan(doel).def.koning) doel.leven = Math.max(doel.leven, 1);
    const kd = krijgVan(doel);
    kd.rust = 0;
    if (doel.leven <= 0) {
      if (!doel.dood) geluid.speel(kd.def.koning ? 'king_falls' : 'death_soldier', { x: doel.x, y: doel.y });
      doel.dood = true;
      return;
    }
    if (hoeveel > 0) geluid.speel('blood_splat', { x: doel.x, y: doel.y, volume: 0.8 });
    // Wie van ver wordt geraakt en niets te doen heeft, gaat erop af.
    if (door && !kd.doelwit && !kd.wraak) {
      kd.wraak = door;
      kd.denk = 1;
    }
  }

  const bouwDoel = (vak) => ({ vak, soort: kaart.object[vak], van: kaart.eigenaar[vak], x: (vak % B) + 0.5, y: Math.floor(vak / B) + 0.5, straal: 0.5 });
  const staatNog = (b) => (b.burcht ? burchten[b.team].leven > 0 : b.van !== 0 && kaart.eigenaar[b.vak] === b.van && kaart.object[b.vak] === b.soort);

  const STEEN_GELUID = new Set(['MUUR', 'TOREN', 'POORT', 'WACHTTOREN', 'MOORDGATENTOREN'].map((n) => OBJECT[n]).filter((n) => n !== undefined));
  // Wordt een bouwwerk van rood bij een buitenpost geraakt (rood.postGarnizoen, level 6), dan slaat het
  // garnizoen alarm: het rukt tot 16 tegels van zijn post uit op wie het deed (een katapult buiten hun zicht
  // blijft dus niet ongestraft schieten). Na een half minuutje gaan ze weer terug naar hun post.
  const ALARM_KETTING = 16;
  function alarmPost(b, door) {
    if (!R.postGarnizoen || !door || door.dood || door.team !== SPELER) return;
    for (const g of vijanden) {
      if (!g.garnizoen || g.dood || g.post === undefined) continue;
      if (Math.hypot((g.post % B) - b.x, Math.floor(g.post / B) - b.y) > 12) continue;
      krijgVan(g).wraak = door;
      g.alarmTot = stapNr + stappen(30);
    }
  }
  function raakBouw(b, hoeveel, door = null) {
    // De torens op het rotseiland (Greyford) vallen alleen voor katapulten en trebuchets: soldaten, pijlen en ballista's krassen niet.
    if (!b.burcht && eilandVakken.has(b.vak)) {
      const sk = door && door.krijg && door.krijg.def && door.krijg.def.soort;
      if (sk !== 'KATAPULT' && sk !== 'TREBUCHET') return;
    }
    if (b.burcht) {
      const doel = burchten[b.team];
      // In de proloog valt de burcht van rood niet en de jouwe niet helemaal.
      if (R.proloog && b.team !== SPELER) return;
      // Een hoofdkasteel krijgt nooit schade (jouw kasteel ook niet): het gaat altijd om de koning.
      if (koningSleutel) return;
      doel.leven = Math.max(R.proloog ? 1 : 0, doel.leven - hoeveel);
      doel.rust = 0;
      if (b.team === SPELER && !burchtGemeld) {
        burchtGemeld = true;
        opMelding('Your keep is under attack! Send your soldiers there.');
      }
      balkenBij();
      opStand();
      return;
    }
    let s = schade.get(b.vak);
    if (!s || s.soort !== b.soort) {
      s = { leven: maxLeven(b.soort, b.van, b.vak), soort: b.soort, van: b.van };
      schade.set(b.vak, s);
    }
    s.leven -= hoeveel;
    if (b.van === ROOD && door) alarmPost(b, door);
    if (s.leven <= 0) {
      geluid.speel(b.soort === OBJECT.POORT ? 'gate_break' : STEEN_GELUID.has(b.soort) ? 'wall_collapse' : 'build_demolish', { x: b.x, y: b.y });
      schade.delete(b.vak);
      if (b.van === ROOD && roodOrigineel.has(b.vak)) roodWeg.add(b.vak);   // een bouwloods komt niet terug
      const werk = bouwer.verwoest(b.vak % B, Math.floor(b.vak / B));
      if (werk) opVerwoest(werk, b.van);
    }
    balkenBij();
  }

  // Staat deze krijger dicht genoeg bij het bouwwerk om het te raken?
  function bijBouw(e, k) {
    const b = k.bouw;
    const dx = Math.abs(e.x - b.x);
    const dy = Math.abs(e.y - b.y);
    if (k.def.bereik > 2) {
      const ver = Math.hypot(Math.max(0, dx - b.straal), Math.max(0, dy - b.straal));
      if (k.def.minBereik && ver < k.def.minBereik) return false;   // een trebuchet raakt niets dichtbij (dode zone)
      return ver <= k.def.bereik - 1;
    }
    return Math.max(dx, dy) <= b.straal + 1.2;
  }

  // Dicht genoeg: hij loopt nog door tot het midden van de volgende tegel
  // en blijft daar staan, tenzij daar al een maat van hem staat.
  function stopBijVolgende(e) {
    const stop = e.pad[e.stap];
    if (stop !== undefined && e.pad.length > e.stap + 1 && !bezetDoorVriend(stop, e)) e.pad.length = e.stap + 1;
  }

  // --- Kiezen wie je aanvalt ------------------------------------------------------------
  // Een vijand in de opmars (proloog) die buiten de muren wacht: hij vecht niet en niemand vecht met hem,
  // tot de opmars wordt losgelaten (laatOpmarsLos).
  // Ook een vijand op de aftocht (proloog, na de ontvoering) vecht niet meer en wordt niet meer aangevallen.
  const wachtBuiten = (a) => !!(a.krijg && a.krijg.tak && (a.krijg.tak.houd || a.krijg.tak.aftocht >= 0));
  function kiesDoelwit(e, k, anderen) {
    if (vreedzaam(k)) return null;
    if (k.tak && (k.tak.houd || k.tak.aftocht >= 0)) { k.wraak = null; return null; }
    if (k.bevel && wachtBuiten(k.bevel)) k.bevel = null;
    const schutter = isSchutter(k);
    const bereik = bereikVan(e, k);
    // Een schutter van de speler blijft staan waar je hem neerzet: hij
    // schiet op wat binnen bereik komt en loopt er niet achteraan. Wie op
    // de muur staat, blijft daar ook.
    const blijft = !!e.opMuur || !!e.hinderlaag || (e.team === SPELER && schutter);
    if (k.bevel) {
      if (k.bevel.dood || (!kanRaken(e, k, k.bevel) && !klimtNaar(e, k, k.bevel))) k.bevel = null;
      else if (!e.opMuur || Math.hypot(k.bevel.x - e.x, k.bevel.y - e.y) <= bereik) return k.bevel;
    }
    // De verborgen reserve verraadt zich niet: hij vecht alleen met wie vlak bij hem komt.
    const ver = e.reserveWacht ? Math.min(2.5, bereik + 1) : blijft ? bereik : k.def.zicht;
    let beste = null;
    let min = ver + 0.001;
    for (let i = 0; i < anderen.length; i++) {
      const a = anderen[i];
      if (a.dood || a.klimt || (a === k.negeer && stapNr < k.negeerTot) || wachtBuiten(a)) continue;
      if (k.def.geschut && a.krijg && a.krijg.def.staand) continue;   // een ballista reikt niet tot een trebuchet
      if (!kanRaken(e, k, a) && !klimtNaar(e, k, a)) continue;
      const d = Math.hypot(a.x - e.x, a.y - e.y);
      // De windzanger kiest het liefst iemand boven op een muur of toren (die blaast ze eraf).
      // Rode schutters (0.82.0) mikken liefst op jouw schutters op de muur: die houden de aanval tegen.
      const muurSchutter = e.team === VIJAND && schutter && a.opMuur && d <= bereik && a.krijg && a.krijg.def && a.krijg.def.bereik > 2;
      const score = k.def.windstoot && a.opMuur && d <= bereik ? d - 5 : muurSchutter ? d - 3 : d;
      if (score >= min || d > ver + 0.001 || verborgenVoor(a, d)) continue;
      if (d > bereik && !kanBij(e, a)) continue;   // hij kan er niet bij en niet op schieten
      min = score;
      beste = a;
    }
    if (beste) return beste;
    if (k.wraak) {
      const w = k.wraak;
      const d = w.dood || !kanRaken(e, k, w) ? Infinity : Math.hypot(w.x - e.x, w.y - e.y);
      if (d <= bereik || (!blijft && d <= WRAAK_VER && !(w === k.negeer && stapNr < k.negeerTot) && kanBij(e, w))) return w;
      k.wraak = null;
    }
    return null;
  }

  // Loop naar je doelwit toe: een ridder naar een vrije tegel ernaast, een
  // schutter tot hij binnen bereik is.
  // Staat het doelwit boven op een muur of op het dak van een kasteel, dan gaat wie van dichtbij vecht
  // er via de trap naartoe: de kortste route naar een muurtegel naast het doelwit. Of null.
  function padNaarDoelOpMuur(e, doel) {
    const dv = vakVan(doel);
    const x0 = dv % B;
    const y0 = Math.floor(dv / B);
    const van = vakVan(e) + (e.opMuur ? N : 0);
    let beste = null;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x0 + dx;
        const ny = y0 + dy;
        if (nx < 0 || ny < 0 || nx >= B || ny >= H || !wegvinder.isMuur(nx, ny, e.team)) continue;
        const knoop = N + ny * B + nx;
        if (bezetDoorVriend(knoop, e)) continue;
        const pad = wegvinder.zoekPadLagen(van, knoop, e.team);
        if (pad && (!beste || pad.length < beste.length)) beste = pad;
      }
    }
    return beste;
  }

  function jaag(e, k) {
    const doel = k.doelwit;
    const dv = vakVan(doel);
    if (e.pad && k.doelVak === dv) return;   // hij is al op weg naar waar het doelwit staat
    if (doel.opMuur && !isSchutter(k) && !k.def.alleenBouw && !k.def.ladder) {
      const padOmhoog = padNaarDoelOpMuur(e, doel);
      if (padOmhoog) {
        zetPad(e, padOmhoog);
        k.doelVak = dv;
        k.schuif = false;
        return;
      }
    }
    let naar;
    if (isSchutter(k)) {
      naar = wegvinder.verbonden(vakVan(e), dv, e.team) ? dv : plekRond(e, dv, 1);
    } else {
      naar = plekRond(e, dv, 1);
      if (naar < 0) naar = plekRond(e, dv, 2);
    }
    const pad = naar < 0 ? null : zoekPad(e, naar);
    if (!pad) {
      // Hij kan er niet komen: even iemand anders zoeken.
      k.negeer = doel;
      k.negeerTot = stapNr + 30;
      if (k.bevel === doel) k.bevel = null;
      if (k.wraak === doel) k.wraak = null;
      k.doelwit = null;
      return;
    }
    zetPad(e, pad);
    k.doelVak = dv;
    k.schuif = false;
  }

  function vecht(e, k) {
    const doel = k.doelwit;
    if (Math.hypot(doel.x - e.x, doel.y - e.y) > bereikVan(e, k) || !kanRaken(e, k, doel)) {
      zetHouding(e, null);   // nog onderweg
      return;
    }
    if (e.pad && !k.schuif && !e.ronde) stopBijVolgende(e);
    kijkNaar(e, doel.x, doel.y);
    zetHouding(e, houdingVan(k.def));
    k.rust = 0;
    if (k.afkoel > 0) return;
    slaToe(e, k);
    klapGeluid(e, k, doel);
    let schade = k.def.schade;
    // Wie slaat, laat zich zien.
    if (k.def.verborgen) k.gezienTot = stapNr + stappen(3);
    // De eerste slag op een nieuw doelwit (de sluipmoordenaar).
    if (k.def.eersteSlag && k.laatsteDoel !== doel) schade *= k.def.eersteSlag;
    k.laatsteDoel = doel;
    // Charge (de ruiter): na een loop van genoeg tegels doet de eerste klap veel meer schade.
    if (k.def.charge) {
      if ((k.afgelegd || 0) >= k.def.charge.tegels) {
        schade *= k.def.charge.keer;
        rook(doel.x, doel.y);
        geluid.speel('cavalry_charge', { x: e.x, y: e.y });
      }
      k.afgelegd = 0;
    }
    schade = Math.max(1, Math.round(schade * sterkteVan(e, k) * (e.torenPost ? TOREN_SCHADE : 1)));
    // Sommige wapens doen extra schade tegen een bepaalde soort (bijl tegen steen).
    if (k.def.bonusTegen) {
      const sl = doel.soldaat ? doel.soldaat.sleutel : doel.vijand;
      if (sl && k.def.bonusTegen[sl]) schade = Math.max(1, Math.round(schade * k.def.bonusTegen[sl]));
    }
    if (k.def.windstoot) {
      // De windzanger: een windvlaag. Wie op een muur of toren staat, waait eraf.
      const ver = Math.hypot(doel.x - e.x, doel.y - e.y);
      effect({ soort: 'pijl', wind: true, x1: e.x, y1: e.y, h1: 22 + (e.hoogte || 0), x2: doel.x, y2: doel.y, h2: 16 + (doel.hoogte || 0), duur: 250 + 40 * ver });
      // Geen vrije grond naast de muur (een gracht): hij blijft staan, maar de vlaag smijt hem tegen de kantelen.
      if (doel.opMuur && !doel.klimt) {
        blaasVanMuur(doel, e, k.def.windstoot);
        raak(doel, Math.max(1, Math.round(k.def.windstoot.val * sterkteVan(e, k))), e);
        return;
      }
      raak(doel, schade, e);
      return;
    }
    if (k.def.gebied !== undefined) {
      vuurbal(e, doel.x, doel.y, 16 + (doel.hoogte || 0));
      if (doel.opMuur) schade = Math.max(1, Math.round(schade * R.muurDekking));
      raak(doel, schade, e);
      steekAan(doel, k.def);
      for (const a of lijstVan(doel.team)) {
        if (a === doel || a.dood || Math.hypot(a.x - doel.x, a.y - doel.y) > 1.5) continue;
        raak(a, Math.max(1, Math.round(k.def.schade * k.def.gebied)), e);
        steekAan(a, k.def);
      }
      return;
    }
    if (isSchutter(k)) {
      pijl(e.x, e.y, 20 + (e.hoogte || 0), doel.x, doel.y, 16 + (doel.hoogte || 0));
      inslagGeluid(doel, doel.opMuur || dekkingVan(doel) < 1 ? 'arrow_hit_shield' : 'arrow_hit_flesh', e.x, e.y);
      // Wie op de muur staat, heeft dekking van de kantelen.
      if (doel.opMuur) schade = Math.max(1, Math.round(schade * R.muurDekking));
      if (!k.def.doorboort) schade = Math.max(1, Math.round(schade * dekkingVan(doel)));
    }
    raak(doel, schade, e);
    // Een zwaaiende bijl raakt ook iemand die vlak naast het doelwit staat.
    if (k.def.zwaai > 0) {
      const naast = lijstVan(doel.team).filter((a) => a !== doel && !a.dood && !!a.opMuur === !!doel.opMuur && Math.hypot(a.x - doel.x, a.y - doel.y) <= 1.3);
      for (const a of naast.slice(0, k.def.zwaaiAantal || 1)) raak(a, Math.max(1, Math.round(k.def.schade * k.def.zwaai * sterkteVan(e, k))), e);
    }
  }

  // Blaas een soldaat van de muur naar een vrije tegel op de grond ernaast, aan de kant
  // van de windzanger af. Niet van het dak van een hoofdkasteel (daar staat de koning).
  // Geeft true als het lukte.
  function blaasVanMuur(a, door, stoot) {
    const vx = Math.floor(a.x);
    const vy = Math.floor(a.y);
    if (kaart.object[vy * B + vx] === OBJECT.BURCHT) return false;
    const rx = a.x - door.x;
    const ry = a.y - door.y;
    const lang = Math.hypot(rx, ry) || 1;
    const plekken = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = vx + dx;
        const y = vy + dy;
        if (x < 0 || y < 0 || x >= B || y >= H) continue;
        if (wegvinder.isMuur(x, y, a.team) || wegvinder.isMuur(x, y, door.team)) continue;
        if (!wegvinder.isVrij(x, y, a.team) && !wegvinder.isVrij(x, y, door.team)) continue;
        plekken.push({ x, y, s: (dx * rx + dy * ry) / lang / Math.hypot(dx, dy) });
      }
    }
    if (!plekken.length) return false;
    plekken.sort((p, q) => q.s - p.s);
    const p = plekken[0];
    a.x = p.x + 0.5;
    a.y = p.y + 0.5;
    a.opMuur = false;
    a.klimt = false;
    a.hoogte = 0;
    a.pad = null;
    a.ronde = null;
    const ka = krijgVan(a);
    if (a.wachter !== undefined) {
      delete a.wachter;
      a.snelheid = ka.def.snelheid;
    }
    ka.bouw = null;
    ka.doelwit = null;
    ka.afkoel = Math.max(ka.afkoel || 0, stappen(stoot.verdoofd || 2));
    ka.denk = stappen(stoot.verdoofd || 2);
    rook(a.x, a.y);
    return true;
  }

  // --- De vijand en je burcht -----------------------------------------------------------
  function beuk(e, k) {
    const b = k.bouw;
    if (!staatNog(b)) {
      k.bouw = null;
      k.denk = 1;
      zetHouding(e, null);
      return;
    }
    if (!bijBouw(e, k) || (e.opMuur && !isSchutter(k)) || e.klimt) {
      zetHouding(e, null);
      return;
    }
    if (e.pad && !k.schuif) stopBijVolgende(e);
    kijkNaar(e, b.x, b.y);
    zetHouding(e, houdingVan(k.def));
    k.rust = 0;
    if (k.afkoel > 0) return;
    slaToe(e, k);
    klapGeluid(e, k, b);
    if (k.def.bereik > 2 && k.def.gebied === undefined && !k.def.alleenBouw) inslagGeluid(b, 'arrow_hit_stone', e.x, e.y);
    if (k.def.verborgen) k.gezienTot = stapNr + stappen(3);
    if (k.def.staand) {
      // Een trebuchet gooit een grote steen in een hoge boog; de schade komt pas als hij landt.
      const ms = 650 + 85 * Math.hypot(b.x - e.x, b.y - e.y);
      effect({ soort: 'pijl', steen: true, groot: true, x1: e.x, y1: e.y, h1: 46, x2: b.x, y2: b.y, h2: b.burcht ? 44 : 24, duur: ms });
      vluchten.push({ tot: stapNr + stappen(ms / 1000), b, schade: k.def.schadeBouw * bouwKeer(k.def, b), door: e });
      return;
    }
    if (k.def.gebied !== undefined) {
      vuurbal(e, b.x, b.y, b.burcht ? 44 : 24);
      if (k.def.brand && !b.burcht && HOUT.has(b.soort)) zetBrand(b, k.def.brand);
    } else if (k.def.bereik > 2) pijl(e.x, e.y, 20, b.x, b.y, b.burcht ? 44 : 24, !!k.def.alleenBouw);
    raakBouw(b, k.def.schadeBouw * bouwKeer(k.def, b), e);
  }
  // --- De heler: geneest elke seconde de zwaarst gewonde soldaat bij hem in de buurt.
  // --- De Moordgatentoren (level 7): kokende olie op alles binnen een paar tegels van de toren.
  //     Een toren van rood treft jouw soldaten, een toren van jou treft die van rood. Belegeringstuig krijgt extra.
  //     Geen bereik; de toren hoeft geen bemanning (de ketel staat altijd te koken). Schade is een schatting van Claude.
  const MG = regels_moordgaten();
  function regels_moordgaten() {
    const m = (regels && regels.moordgaten) || {};
    return { straal: m.straal || 2, tijd: m.tijd || 1.5, schade: m.schade || 6, belegering: m.belegering || 1.5 };
  }
  let moordVakken = [];
  function moordStap() {
    if (stapNr % stappen(2) === 0) {
      moordVakken = [];
      for (let i = 0; i < kaart.object.length; i++) {
        if (kaart.object[i] === OBJECT.MOORDGATENTOREN && kaart.eigenaar[i] && !(kaart.eigenaar[i] === ROOD && roodWeg.has(i))) moordVakken.push(i);
      }
    }
    if (!moordVakken.length || stapNr % stappen(MG.tijd) !== 0) return;
    for (const vak of moordVakken) {
      if (kaart.object[vak] !== OBJECT.MOORDGATENTOREN) continue;
      const tx = (vak % B) + 0.5;
      const ty = Math.floor(vak / B) + 0.5;
      const doelen = kaart.eigenaar[vak] === ROOD ? leger.lijst : vijanden;
      let gebruikt = false;
      for (const d of doelen) {
        if (d.dood || d.opMuur) continue;
        if (Math.hypot(d.x - tx, d.y - ty) > MG.straal + 0.5) continue;
        const kd = krijgVan(d);
        const zwaar = kd.def.alleenBouw || kd.def.soort === 'LADDER' || kd.def.soort === 'TOREN';
        raak(d, MG.schade * (zwaar ? MG.belegering : 1), null);
        effect({ soort: 'olie', x: d.x, y: d.y, duur: 1300 });
        gebruikt = true;
      }
      if (gebruikt) rook(tx, ty);
    }
  }
  function helerStap() {
    for (const lijst of [leger.lijst, vijanden]) {
      for (const h of lijst) {
        const hl = !h.dood && h.krijg && h.krijg.def.heelt;
        if (!hl) continue;
        let beste = null;
        let deel = 1;
        for (const a of lijst) {
          if (a === h || a.dood || !a.levenMax || a.leven >= a.levenMax) continue;
          if (Math.hypot(a.x - h.x, a.y - h.y) > hl.bereik) continue;
          const d = a.leven / a.levenMax;
          if (d < deel) { deel = d; beste = a; }
        }
        if (!beste) continue;
        beste.leven = Math.min(beste.levenMax, beste.leven + Math.max(1, Math.round(beste.levenMax * hl.perSeconde)));
        effect({ soort: 'heel', x: beste.x, y: beste.y, h: beste.hoogte || 0, duur: 700 });
        geluid.speel('heal', { x: beste.x, y: beste.y });
      }
    }
  }

  // --- Vuur: de vlammenwever ---------------------------------------------------------
  // Wat van hout is: de poort en de werken. Dat gaat in brand.
  const HOUT = new Set(['POORT', 'HOUTHAKKER', 'BOOMGAARD', 'ZAGERIJ', 'TARWEVELD', 'STEENGROEVE', 'VOORRAADKAMER', 'WONING', 'KAZERNE', 'STAL', 'BAKKERIJ', 'KOPERMIJN', 'BELEGERINGSWERKPLAATS'].map((n) => OBJECT[n]));
  const branden = new Map();   // vak -> { b, tot, per }
  function vuurbal(e, x, y, h) {
    effect({ soort: 'pijl', vuur: true, x1: e.x, y1: e.y, h1: 22 + (e.hoogte || 0), x2: x, y2: y, h2: h, duur: 300 + 50 * Math.hypot(x - e.x, y - e.y) });
    effect({ soort: 'vuur', x, y, duur: 700 + 50 * Math.hypot(x - e.x, y - e.y), wacht: 300 + 50 * Math.hypot(x - e.x, y - e.y) });
  }
  // Een houten belegeringsmachine (ram, ladder, toren, katapult) vat vlam.
  function steekAan(a, def) {
    const ka = krijgVan(a);
    if (!def.brand || !(ka.def.alleenBouw || ka.def.ladder)) return;
    ka.brand = stappen(def.brand.duur);
    ka.brandPer = def.brand.perSeconde;
    ka.brandDoor = null;
  }
  function zetBrand(b, brand) {
    branden.set(b.vak, { b, tot: stapNr + stappen(brand.duur), per: brand.perSeconde });
    geluid.speel('fire_burning', { x: b.x, y: b.y });
    effect({ soort: 'brand', x: b.x, y: b.y, duur: brand.duur * 1000 });
  }
  function brandStap() {
    if (stapNr % perSeconde !== 0) return;
    for (const [vak, br] of branden) {
      if (stapNr > br.tot || !staatNog(br.b)) { branden.delete(vak); continue; }
      raakBouw(br.b, br.per);
    }
    for (const lijst of [vijanden, leger.lijst]) {
      for (const a of lijst) {
        const ka = a.krijg;
        if (!ka || !(ka.brand > 0) || a.dood) continue;
        ka.brand -= perSeconde;
        effect({ soort: 'brand', x: a.x, y: a.y, duur: 1000 });
        raak(a, ka.brandPer, null);
      }
    }
  }

  // Hoe sterk iemand slaat: een koning zonder burcht is zwakker, en een
  // soldaat bij zijn koning doet iets meer (het koninklijk vaandel).
  function sterkteVan(e, k) {
    if (k.def.koning) return burchten[e.team].leven > 0 ? 1 : k.def.zwak || 1;
    // Een vaandel in de buurt (de koning, een banierdrager): de sterkste telt, ze stapelen niet.
    let extra = 0;
    for (const a of lijstVan(e.team)) {
      if (a.dood || a === e) continue;
      const v = a.krijg && a.krijg.def.vaandel;
      if (!v || v.extra <= extra) continue;
      if (Math.hypot(a.x - e.x, a.y - e.y) <= v.bereik) extra = v.extra;
    }
    return 1 + extra;
  }

  // Een bijl doet meer schade aan hout: poorten en houten gebouwen.
  function bouwKeer(def, b) {
    const bonus = def.bouwBonus;
    if (!bonus || b.burcht) return 1;
    return bonus.objecten.some((naam) => OBJECT[naam] === b.soort) ? bonus.keer : 1;
  }

  // De tegels naast een burcht, de dichtstbijzijnde eerst.
  const plekkenBij = (e, b = burcht) => b.plekken.slice().sort((p, q) => verVan(e, p) - verVan(e, q));

  // Voor wie van verre schiet: de verste bereikbare plek waar het doel nog
  // binnen bereik ligt. Zo kan een katapult ook op een gebouw schieten dat
  // achter de muur staat, zonder dat er een weg naartoe is.
  function padOpAfstand(e, k, doel) {
    const straal = doel.straal || 0;
    const reik = k.def.bereik - 1.5;   // iets binnen het bereik, voor de zekerheid
    const mx = Math.floor(doel.x);
    const my = Math.floor(doel.y);
    const hier = vakVan(e);
    const lijst = [];
    const w = Math.ceil(reik + straal);
    for (let dy = -w; dy <= w; dy++) {
      for (let dx = -w; dx <= w; dx++) {
        const nx = mx + dx;
        const ny = my + dy;
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const ver = Math.hypot(Math.max(0, Math.abs(nx + 0.5 - doel.x) - straal), Math.max(0, Math.abs(ny + 0.5 - doel.y) - straal));
        if (ver > reik) continue;
        const vak = ny * B + nx;
        if (!wegvinder.verbonden(hier, vak, e.team) || bezetDoorVriend(vak, e)) continue;
        lijst.push({ vak, ver, loop: verVan(e, vak) });
      }
    }
    // Liefst in de buitenste band van het bereik, en daarvan de dichtstbijzijnde.
    const buiten = lijst.filter((c) => c.ver >= reik - 2).sort((p, q) => p.loop - q.loop);
    const binnen = lijst.filter((c) => c.ver < reik - 2).sort((p, q) => q.ver - p.ver || p.loop - q.loop);
    for (const c of buiten.concat(binnen).slice(0, 6)) {
      const pad = zoekPad(e, c.vak);
      if (pad) return pad;
    }
    return null;
  }

  // Een soldaat van de speler gaat op een bouwwerk van rood af. Geeft
  // terug of hij erbij kan (of er al bij staat).
  function gaNaarBouw(e, k, doel) {
    k.bouw = doel;
    if (e.klimt) return true;   // even wachten tot hij boven of beneden is
    if (bijBouw(e, k) && (!e.opMuur || isSchutter(k))) return true;
    if (!k.def.schadeBouw) {
      k.bouw = null;   // een ladderdrager beukt niet
      return false;
    }
    const hier = vakVan(e);
    let pad = null;
    if (!e.opMuur) {
      if (doel.burcht && k.def.bereik > 2) {
        pad = padOpAfstand(e, k, doel);
      } else if (doel.burcht) {
        for (const vak of plekkenBij(e, burchten[doel.team])) {
          if (!wegvinder.verbonden(hier, vak, e.team) || bezetDoorVriend(vak, e)) continue;
          pad = zoekPad(e, vak);
          if (pad) break;
        }
      } else {
        // Een ridder moet ernaast staan; wie van verre schiet, blijft zo ver
        // mogelijk weg (binnen zijn bereik).
        if (k.def.bereik > 2) pad = padOpAfstand(e, k, doel);
        else {
          for (let r = 1; r <= 2 && !pad; r++) {
            const sta = plekRond(e, doel.vak, r);
            if (sta >= 0) pad = zoekPad(e, sta);
          }
        }
      }
    }
    // Over de grond kan het niet: misschien wel via een ladder over de muur.
    // Een stormram kan geen ladder op.
    if (!pad && e.team === SPELER && !k.def.alleenBouw && !k.def.ladder && wegvinder.aantalOpgangen(SPELER) > 0) {
      const kandidaten = [];
      const vakken = doel.burcht ? burchten[doel.team].plekken : ringVakken(doel.vak, 1);
      for (const vak of vakken) {
        if (vrijVoor(vak, SPELER) && !bezetDoorVriend(vak, e)) kandidaten.push(vak);
      }
      kandidaten.sort((p, q) => verVan(e, p) - verVan(e, q));
      const van = knoopVan(e);
      for (let i = 0; i < kandidaten.length && i < 4 && !pad; i++) {
        pad = wegvinder.zoekPadLagen(van, kandidaten[i], SPELER);
      }
    }
    if (!pad) {
      k.bouw = null;
      return false;
    }
    zetPad(e, pad);
    k.schuif = false;
    return true;
  }

  // De vakken op precies r tegels rond een vak.
  function ringVakken(vak, r) {
    const x = vak % B;
    const y = Math.floor(vak / B);
    const lijst = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (x + dx < 0 || y + dy < 0 || x + dx >= B || y + dy >= H) continue;
        lijst.push((y + dy) * B + x + dx);
      }
    }
    return lijst;
  }

  // --- Ladders ------------------------------------------------------------------------------
  // Een ladderdrager loopt naar de muur, zet de ladder op en blijft daar staan.
  function ladderStap(e, k) {
    const vak = k.ladder;
    const ander = e.team === SPELER ? VIJAND : SPELER;
    if (!isMuurVan(vak, ander) || wegvinder.isLadder(vak, e.team)) {
      k.ladder = -1;
      zetHouding(e, null);
      return;
    }
    const mx = (vak % B) + 0.5;
    const my = Math.floor(vak / B) + 0.5;
    const ver = Math.max(Math.abs(e.x - mx), Math.abs(e.y - my));
    if (ver > 1.3 || e.opMuur) {
      zetHouding(e, null);
      k.ladderKlok = stappen(k.def.slagTijd);
      if (e.pad) return;
      const sta = plekRond(e, vak, 1, true);
      const pad = sta < 0 ? null : zoekPad(e, sta);
      if (!pad) {
        k.ladder = -1;
        if (e.team === SPELER) opMelding(k.def.vast ? 'Your siege tower cannot reach that wall. Try another piece of wall.' : 'Your ladder bearer cannot reach that wall. Try another piece of wall.');
        return;
      }
      zetPad(e, pad);
      return;
    }
    if (e.pad) return;   // hij loopt nog naar het midden van zijn tegel
    kijkNaar(e, mx, my);
    zetHouding(e, 'sla');
    e.pose = k.ladderKlok < stappen(k.def.slagTijd) / 2 ? 1 : 0;
    if (--k.ladderKlok > 0) return;
    // De ladder staat: aan de kant waar de drager staat.
    const dx = e.x - mx;
    const dy = e.y - my;
    const kant = Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
    zetLadder(vak, e.team, kant, !!k.def.vast);
    k.ladder = -1;
    zetHouding(e, null);
    if (k.def.vast) opMelding(e.team === SPELER ? 'The siege tower stands against the red wall. Select soldiers and tap that wall: they will climb onto it.' : 'Red is rolling a siege tower against your wall! Put soldiers on that piece of wall: it takes them a long time to push it over.');
    else if (e.team === SPELER) opMelding('The ladder stands against the red wall. Select soldiers and tap that wall: they will climb onto it.');
    else opMelding('Red is setting a ladder against your wall! Put soldiers on that piece of wall: they will push it over.');
    opVerandering();
  }

  // Een sluipmoordenaar loopt naar de muur, klimt erop (klimMuur seconden)
  // en staat dan boven, zonder ladder.
  function klimStap(e, k) {
    const vak = k.klim;
    const ander = e.team === SPELER ? VIJAND : SPELER;
    const mx = (vak % B) + 0.5;
    const my = Math.floor(vak / B) + 0.5;
    if (!isMuurVan(vak, ander) || e.opMuur) {
      k.klim = -1;
      zetHouding(e, null);
      return;
    }
    const ver = Math.max(Math.abs(e.x - mx), Math.abs(e.y - my));
    if (ver > 1.3) {
      zetHouding(e, null);
      k.klimKlok = stappen(k.def.klimMuur);
      if (e.pad) return;
      const sta = plekRond(e, vak, 1);
      const pad = sta < 0 ? null : zoekPad(e, sta);
      if (!pad) {
        k.klim = -1;
        if (e.team === SPELER) opMelding('Your assassin cannot reach that piece of wall.');
        return;
      }
      zetPad(e, pad);
      return;
    }
    if (e.pad) return;
    kijkNaar(e, mx, my);
    zetHouding(e, 'sla');
    e.pose = k.klimKlok % 4 < 2 ? 1 : 0;
    if (--k.klimKlok > 0) return;
    // Boven: staat er al iemand van zijn eigen kant, dan wacht hij nog even.
    if (lijstVan(e.team).some((a) => a !== e && a.opMuur && vakVan(a) === vak)) {
      k.klimKlok = 2;
      return;
    }
    e.x = e.vorigeX = mx;
    e.y = e.vorigeY = my;
    e.opMuur = true;
    e.hoogte = eenheden.hoogteOp(vak);
    e.pad = null;
    k.klim = -1;
    zetHouding(e, null);
    opVerandering();
  }

  // Deze sluipmoordenaars klimmen op de muur van rood op dat vak.
  function klimBevel(lijst, vak) {
    if (!isMuurVan(vak, VIJAND)) return 0;
    let aantal = 0;
    for (const e of lijst) {
      const k = krijgVan(e);
      if (!k.def.klimMuur || e.opMuur || e.klimt) continue;
      if (plekRond(e, vak, 1) < 0) continue;
      e.soldaat.doel = -1;
      if (e.pad) e.pad.length = Math.min(e.pad.length, e.stap + 1);
      k.klim = vak;
      k.ladder = -1;
      k.bevel = null;
      k.doelwit = null;
      k.bouw = null;
      k.bouwBevel = null;
      aantal++;
    }
    return aantal;
  }

  function haalLadderWeg(vak, team) {
    if (wegvinder.isLadder(vak, team)) geluid.speel('ladder_push', { x: (vak % B) + 0.5, y: Math.floor(vak / B) + 0.5 });
    wegvinder.zetLadder(vak, team, false);
    ladderKant.delete(vak);
    vasteLadders.delete(vak);
    opKaart(new Set([vak]));
    leger.kaartVeranderd();
    kaartVeranderd();
    opVerandering();
  }

  function zetLadder(vak, team, kant, vast = false) {
    geluid.speel('ladder_place', { x: (vak % B) + 0.5, y: Math.floor(vak / B) + 0.5 });
    wegvinder.zetLadder(vak, team, true);
    ladderKant.set(vak, kant);
    if (vast) vasteLadders.add(vak);
    else vasteLadders.delete(vak);
    opKaart(new Set([vak]));
    leger.kaartVeranderd();
  }

  // Deze ladderdragers zetten een ladder tegen de muur van rood op dat vak.
  // Geeft terug hoeveel er gaan. uit (mag ontbreken): hier komen de eenheden in die het bevel kregen.
  function zetLadderBevel(lijst, vak, uit = null) {
    if (!isMuurVan(vak, VIJAND) || wegvinder.isLadder(vak, SPELER)) return 0;
    let aantal = 0;
    for (const e of lijst) {
      const k = krijgVan(e);
      if (!k.def.ladder || e.opMuur || e.klimt) continue;
      if (R.roodMuurHoog && !k.def.vast) continue;   // te hoog voor een ladder: alleen de belegeringstoren
      if (plekRond(e, vak, 1) < 0) continue;
      e.soldaat.doel = -1;
      if (e.pad) e.pad.length = Math.min(e.pad.length, e.stap + 1);
      k.ladder = vak;
      k.ladderKlok = stappen(k.def.slagTijd);
      k.bevel = null;
      k.bouwBevel = null;
      k.bouw = null;
      k.doelwit = null;
      aantal++;
      if (uit) uit.push(e);
      break;   // één ladder is genoeg
    }
    return aantal;
  }

  // Waar de ladders staan, voor de tekenlaag: [{ vak, x, y, dx, dy, team }].
  function ladders() {
    const lijst = [];
    for (let team = 0; team < 2; team++) {
      for (const vak of wegvinder.ladders(team)) {
        const [dx, dy] = ladderKant.get(vak) || [1, 0];
        lijst.push({ vak, x: vak % B, y: Math.floor(vak / B), dx, dy, team, vast: vasteLadders.has(vak) });
      }
    }
    return lijst;
  }

  // --- De tactiek van rood (js/veldheer.js) ----------------------------------------------
  // Elke vijand kan een plan hebben (k.tak): wachten tot een tijdstip, eerst langs
  // een omweg (via), een bouwwerk van jou aanvallen (doel) of terug naar huis.
  function tak(e) {
    const k = krijgVan(e);
    if (!k.tak) k.tak = { houdTot: 0, doel: null, via: -1, terug: false, groep: 0, ladderPoging: 0, aftocht: -1 };
    return k.tak;
  }

  // Alle vrije vakken die vanaf deze zaden te voet bereikbaar zijn voor rood.
  function bereikbaar(zaden) {
    const gezien = new Set();
    const rij = [];
    for (const z of zaden) if (z >= 0 && !gezien.has(z)) { gezien.add(z); rij.push(z); }
    for (let i = 0; i < rij.length; i++) {
      const v = rij[i];
      const x = v % B;
      const y = Math.floor(v / B);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const w = ny * B + nx;
        if (gezien.has(w) || !wegvinder.isVrij(nx, ny, VIJAND)) continue;
        // Een poort van de speler gaat dicht zodra rood nadert: voor de veldheer is die dicht (0.82.0).
        if (kaart.eigenaar[w] === SPELER + 1 && kaart.object[w] === OBJECT.POORT) continue;
        gezien.add(w);
        rij.push(w);
      }
    }
    return gezien;
  }

  // Hoe lang de route van het ene vak naar het andere is voor rood, alsof jouw
  // bouwwerken er niet stonden (zoals bij het doorbreken). null als er geen route is.
  function routeLengte(van, naar) {
    const pad = wegvinder.zoekPad(van % B, Math.floor(van / B), naar % B, Math.floor(naar / B), BREEK);
    if (!pad) return null;
    let som = 0;
    let vx = van % B;
    let vy = Math.floor(van / B);
    for (const v of pad) {
      const w = v % N;
      const x = w % B;
      const y = Math.floor(w / B);
      som += Math.hypot(x - vx, y - vy);   // schuin lopen is langer dan recht
      vx = x;
      vy = y;
    }
    return som;
  }

  // Naar huis: een vrij vak vlak bij de burcht van rood, en daar uitrusten.
  function terugStap(e, k, t) {
    k.doelwit = null;
    k.bouw = null;
    k.ladder = -1;
    if (bijThuis(e, 5)) {
      if (e.pad) e.pad = null;
      zetHouding(e, null);
      return;
    }
    if (e.pad) return;
    for (const r of [3, 4, 2, 5]) {
      const sta = plekRond(e, rood.vak, r);
      if (sta < 0) continue;
      const pad = zoekPad(e, sta);
      if (pad) { zetPad(e, pad); return; }
    }
    t.terug = false;   // er is geen weg naar huis: hij vecht verder
  }

  // Het plan van de veldheer uitvoeren. Geeft terug of de krijger daarmee bezig is
  // (anders gaat hij op de gewone manier naar jouw burcht).
  function tactiek(e, k) {
    const t = k.tak;
    if (!t) return false;
    // Aftocht (proloog): rennen naar het verzamelvak buiten de poort en daar blijven; niet meer vechten.
    if (t.aftocht >= 0) {
      k.doelwit = null; k.bouw = null; k.bevel = null; k.ladder = -1;
      zetHouding(e, null);
      if (verVan(e, t.aftocht) <= 2.5) { if (e.pad) e.pad = null; return true; }
      if (!e.pad && !t.geenWeg) {
        const pad = zoekPad(e, t.aftocht, VIJAND);
        if (pad) zetPad(e, pad);
        else t.geenWeg = true;   // geen weg (bijvoorbeeld op een muur): hij blijft staan en vecht niet meer
      }
      return true;
    }
    // Opmars (proloog): eerst naar zijn plek buiten de muren, dan wachten tot de poort opengaat.
    if (t.houd) {
      if (t.via >= 0) {
        if (verVan(e, t.via) <= 1.6) t.via = -1;
        else {
          if (!e.pad) {
            const pad = zoekPad(e, t.via);
            if (pad) zetPad(e, pad);
            else t.via = -1;
          }
        }
      }
      return true;
    }
    // Uitval (veldheer): wie niets te bevechten heeft, gaat terug naar zijn plek achter de muur.
    if (t.uitval >= 0) {
      // Eerst 30 s op jouw belegeraars af, daarna terug naar zijn plek.
      if (t.uitvalTot === undefined) t.uitvalTot = stapNr + stappen(30);
      const heen = t.uitvalDoel && stapNr < t.uitvalTot ? Math.floor(t.uitvalDoel.y) * B + Math.floor(t.uitvalDoel.x) : t.uitval;
      if (verVan(e, heen) > 1.5) {
        if (!e.pad || e.pad !== k.marsPad || k.marsNaar !== heen) {
          const pad = zoekPad(e, heen) || (heen !== t.uitval ? zoekPad(e, t.uitval) : null);
          if (pad) { zetPad(e, pad); k.marsPad = e.pad; k.marsNaar = heen; } else t.uitval = -1;
        }
      } else if (e.pad) zetPad(e, null);
      return true;
    }
    // Verzamelen (veldheer): naar zijn plek op het verzamelpunt en daar wachten.
    if (t.verzamel >= 0) {
      if (verVan(e, t.verzamel) > 1.2) {
        if (!e.pad || e.pad !== k.marsPad) {
          const pad = zoekPad(e, t.verzamel);
          if (pad) {
            zetPad(e, pad);
            k.marsPad = e.pad;
          } else t.verzamel = -1;
        }
      } else if (e.pad) zetPad(e, null);
      return true;
    }
    // Opmars (veldheer): even stilstaan om in de pas te blijven.
    if (t.rem) {
      if (e.pad) zetPad(e, null);
      return true;
    }
    if (t.houdTot > stapNr) return true;   // wacht op de rest van zijn groep
    if (t.via >= 0) {
      if (verVan(e, t.via) <= 1.6) t.via = -1;
      else {
        if (!e.pad) {
          const pad = zoekPad(e, t.via);
          if (pad) zetPad(e, pad);
          else t.via = -1;
        }
        return true;
      }
    }
    if (!t.doel) return false;
    if (!staatNog(t.doel)) {   // de bres is geslagen: nu naar de burcht
      t.doel = null;
      k.bouw = null;
      return false;
    }
    // Staat er al een ladder van rood, dan klimmen de gewone soldaten daarlangs.
    if (!vreedzaam(k) && e.lagen && wegvinder.ladders(VIJAND).length) return false;
    if (k.def.ladder) {
      // Een ladderdrager of toren zet zijn ladder tegen een gewoon stuk muur bij de bres.
      if (k.ladder >= 0 || t.ladderPoging >= 3) return true;
      let vak = isMuurVan(t.doel.vak, SPELER) ? t.doel.vak : -1;
      for (let r = 1; r <= 4 && vak < 0; r++) {
        for (const c of ringVakken(t.doel.vak, r)) if (isMuurVan(c, SPELER) && !wegvinder.isLadder(c, VIJAND)) { vak = c; break; }
      }
      if (vak < 0 || wegvinder.isLadder(vak, VIJAND)) return false;
      t.ladderPoging++;
      k.ladder = vak;
      k.ladderKlok = stappen(k.def.slagTijd);
      return true;
    }
    if (k.bouw !== t.doel || (!e.pad && !bijBouw(e, k))) {
      if (!gaNaarBouw(e, k, t.doel)) {
        t.doel = null;
        return false;
      }
    }
    return true;
  }

  // De bouwwerken van jou die een machine van rood mag aanvallen. De burcht hoort er niet bij.
  const SPERWERK = new Set([OBJECT.MUUR, OBJECT.POORT, OBJECT.TOREN, OBJECT.WACHTTOREN, OBJECT.MOORDGATENTOREN]);
  const ANDERWERK = new Set([OBJECT.HOUTHAKKER, OBJECT.STEENGROEVE, OBJECT.BOOMGAARD, OBJECT.WONING, OBJECT.KAZERNE, OBJECT.STAL, OBJECT.VOORRAADKAMER, OBJECT.ZAGERIJ, OBJECT.TARWEVELD, OBJECT.BAKKERIJ, OBJECT.KOPERMIJN, OBJECT.MAGIERTOREN, OBJECT.BELEGERINGSWERKPLAATS]);
  function kiesBelegerDoel(e, k) {
    // Eerst op weg naar de burcht: het eerste wat in de weg staat (muur, poort, toren) gaat eraan.
    if (!e.opMuur && !e.klimt) {
      breekDoor(e, k, vakVan(e), plekkenBij(e), null);
      if (k.bouw && isBurcht(k.bouw.soort)) k.bouw = null;
      if (k.bouw || e.pad) return;
    }
    // De weg is vrij (of er is geen route): de overige bouwwerken van jou, de dichtstbijzijnde eerst.
    const kandidaten = [];
    for (let vak = 0; vak < N; vak++) {
      if (kaart.eigenaar[vak] !== SPELER + 1) continue;
      const soort = kaart.object[vak];
      const eerst = SPERWERK.has(soort);
      if (!eerst && !ANDERWERK.has(soort)) continue;
      if (inBurcht(vak, burcht)) continue;
      kandidaten.push({ vak, rang: (eerst ? 0 : 1000) + verVan(e, vak) });
    }
    kandidaten.sort((p, q) => p.rang - q.rang);
    for (const c of kandidaten.slice(0, 6)) {
      if (gaNaarBouw(e, k, bouwDoel(c.vak))) return;
    }
    k.bouw = null;   // niets bereikbaar: hij wacht
  }

  function naarBurcht(e, k) {
    // Rood gaat op je koning af (ook als hij op het dak van je hoofdkasteel staat): dat beslist het level.
    if (koningSleutel && !R.proloog && !vreedzaam(k) && !isSchutter(k) && !hutStaat() && stapNr >= (k.koningPoging || 0)) {
      const ks = koningVan(SPELER);
      if (ks && !ks.dood) {
        k.doelwit = ks;
        jaag(e, k);
        if (k.doelwit === ks) { k.bouw = null; return; }
        k.negeer = null;
        k.koningPoging = stapNr + 20;   // er is nog geen weg: eerst de muren door
      }
    }
    // Een stormram of katapult van rood slaat nooit op het hoofdkasteel zelf: eerst wat
    // de weg versperrt (muur, poort, toren), daarna de overige bouwwerken. Is er niets meer, dan wacht hij.
    if (k.def.alleenBouw && !hutStaat()) {
      if (k.bouw && !k.bouw.burcht && staatNog(k.bouw) && (e.pad || bijBouw(e, k))) return;   // onderweg of bezig
      k.bouw = null;
      k.doelVak = -1;
      k.schuif = false;
      kiesBelegerDoel(e, k);
      return;
    }
    if (k.bouw && staatNog(k.bouw) && (e.pad || bijBouw(e, k))) return;   // onderweg of bezig
    k.bouw = null;
    k.doelVak = -1;
    k.schuif = false;
    const hier = vakVan(e);
    // Level 4: zolang de hut van Gesina staat, gaan ze daarop af.
    if (hutStaat()) {
      const doel = bouwDoel(hutVak);
      const rond = [1, -1, B, -B].map((d) => hutVak + d).filter((v) => v >= 0 && v < B * H).sort((p, q) => verVan(e, p) - verVan(e, q));
      for (const vak of rond) {
        if (!wegvinder.verbonden(hier, vak, VIJAND) || bezetDoorVriend(vak, e)) continue;
        const pad = zoekPad(e, vak);
        if (!pad) continue;
        k.bouw = doel;
        zetPad(e, pad);
        return;
      }
      if (rond.some((v) => vakVan(e) === v)) { k.bouw = doel; return; }
      breekDoor(e, k, hier, rond, doel, hutVak);
      return;
    }
    const plekken = plekkenBij(e);
    if (!e.opMuur) {
      for (const vak of plekken) {
        if (!wegvinder.verbonden(hier, vak, VIJAND) || bezetDoorVriend(vak, e)) continue;
        const pad = zoekPad(e, vak);
        if (!pad) continue;
        k.bouw = burchtDoel;
        zetPad(e, pad);
        return;
      }
    }
    // Staat er een ladder van rood tegen jouw muur, dan gaat hij daarlangs.
    // Een stormram en een ladderdrager klimmen niet.
    if (e.lagen && !vreedzaam(k) && wegvinder.ladders(VIJAND).length) {
      const van = knoopVan(e);
      for (let i = 0; i < plekken.length && i < 3; i++) {
        if (bezetDoorVriend(plekken[i], e)) continue;
        const pad = wegvinder.zoekPadLagen(van, plekken[i], VIJAND);
        if (!pad) continue;
        k.bouw = burchtDoel;
        zetPad(e, pad);
        return;
      }
    }
    if (e.opMuur || e.klimt) return;   // boven op de muur: wachten tot er een weg is
    breekDoor(e, k, hier, plekken);
  }

  // Er is geen vrije weg naar de burcht. Zoek de route alsof de bouwwerken
  // van de speler er niet stonden: het eerste dat in de weg staat gaat eraan.
  function breekDoor(e, k, hier, plekken, doelB = burchtDoel, wachtBij = thuisVak) {   // doelB null: een machine van rood (geen burcht als doel)
    let pad = null;
    for (const vak of plekken) {
      if (!wegvinder.verbonden(hier, vak, hoogBeeld(e, BREEK))) continue;
      pad = zoekPad(e, vak, BREEK);
      if (pad) break;
    }
    if (!pad) return;   // er is geen doorkomen aan: hij wacht
    let j = 0;
    while (j < pad.length && vrijVoor(pad[j], VIJAND)) j++;
    if (j >= pad.length) {
      if (!doelB) {   // een machine van rood: de burcht is geen doel, dus hier valt niets te breken
        k.bouw = null;
        return;
      }
      // De weg is vrij, maar naast de burcht is geen plek meer: wacht vlakbij.
      k.bouw = doelB;
      const wacht = plekRond(e, wachtBij, 3);
      if (wacht >= 0 && wacht !== hier) zetPad(e, zoekPad(e, wacht));
      return;
    }
    const inDeWeg = pad[j];
    if (k.def.ladder) {
      // Een ladderdrager van rood zet een ladder tegen de muur die in de weg staat.
      if (isMuurVan(inDeWeg, SPELER) && !wegvinder.isLadder(inDeWeg, VIJAND)) {
        k.ladder = inDeWeg;
        k.ladderKlok = stappen(k.def.slagTijd);
      }
      return;
    }
    k.bouw = bouwDoel(inDeWeg);
    // Ga ervoor staan: het liefst op de tegel waar de route langs komt.
    let sta = j > 0 ? pad[j - 1] : hier;
    if (sta !== hier && bezetDoorVriend(sta, e)) {
      sta = plekRond(e, inDeWeg, 1);
      if (sta < 0) sta = plekRond(e, inDeWeg, 2);
      if (sta < 0) return;
    }
    if (sta !== hier) zetPad(e, zoekPad(e, sta) || pad.slice(0, j));
  }

  // --- Opzij stappen ----------------------------------------------------------------------
  // Staan er twee op dezelfde tegel, dan stapt de tweede opzij.
  function schuifOp(e, k) {
    if (e.pad || e.opMuur || e.klimt) return;
    const hier = vakVan(e);
    const lijst = lijstVan(e.team);
    let dubbel = false;
    for (let i = 0; i < lijst.length; i++) {
      const a = lijst[i];
      if (a === e) break;
      if (!a.dood && !a.pad && vakVan(a) === hier) {
        dubbel = true;
        break;
      }
    }
    if (!dubbel) return;
    let naar = k.doelwit && k.def.bereik <= 2 ? plekRond(e, vakVan(k.doelwit), 1) : -1;
    if (naar < 0) naar = plekRond(e, hier, 1);
    if (naar < 0) naar = plekRond(e, hier, 2);
    if (naar < 0) return;
    const pad = zoekPad(e, naar);
    if (!pad || !pad.length) return;
    zetPad(e, pad);
    k.schuif = true;
  }

  // De koning van rood zwerft over de kaart (zwerfStraal). Hij valt aan wie dicht bij
  // zijn burcht komt en gaat terug naar zijn hoofdkasteel zodra er onraad is.
  function koningDenk(e, k, anderen) {
    const thuis = burchten[e.team];
    const r = k.def.thuisBereik || 7;
    const dichtbij = anderen.filter((a) => Math.hypot(a.x - thuis.x, a.y - thuis.y) <= r);
    k.doelwit = dichtbij.length ? kiesDoelwit(e, k, dichtbij) : null;
    // Is er onraad? Dan gaat hij terug naar zijn hoofdkasteel: jouw soldaten dichtbij
    // zijn burcht of dichtbij hemzelf, een beschadigde burcht, of hijzelf gewond.
    const zwerfStraal = k.def.zwerfStraal || 0;
    const alarm = k.def.alarmAfstand || 9;
    const bedreigd = thuis.leven < thuis.max || (e.leven < e.levenMax && !bijThuis(e, 4))
      || anderen.some((a) => Math.hypot(a.x - thuis.x, a.y - thuis.y) <= alarm || Math.hypot(a.x - e.x, a.y - e.y) <= alarm);
    // Een route voor de koning: over de grond, en waar nodig over de muur of het kasteel.
    const knoopVan = () => vakVan(e) + (e.opMuur ? N : 0);
    const padNaar = (knoop) => wegvinder.zoekPadLagen(knoopVan(), knoop, e.team);
    const naarHuis = () => {
      for (const vak of plekkenBij(e, thuis)) {
        if (bezetDoorVriend(vak, e)) continue;
        const pad = padNaar(vak);
        if (pad && pad.length) { zetPad(e, pad); return; }
      }
    };
    // Onraad: hij vlucht naar het dak van zijn hoofdkasteel (via de deur), achter zijn binnenmuren.
    // Daar blijft hij en slaat alleen wie binnen zijn bereik komt (naar Karel: niet buiten te vangen).
    const st = kaart.start[e.team];
    const opDak = e.opMuur && kaart.object[vakVan(e)] === OBJECT.BURCHT;
    const naarDak = () => {
      const tegels = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tegels.push((st.y + dy) * B + st.x + dx);
      tegels.sort((a, b) => Math.hypot((a % B) - e.x, Math.floor(a / B) - e.y) - Math.hypot((b % B) - e.x, Math.floor(b / B) - e.y));
      for (const vak of tegels) {
        if (kaart.object[vak] !== OBJECT.BURCHT || bezetDoorVriend(N + vak, e)) continue;
        const pad = padNaar(N + vak);
        if (pad && pad.length) { zetPad(e, pad); return true; }
      }
      return false;
    };
    if (bedreigd) k.schuilTot = stapNr + stappen(25);   // na het gevaar blijft hij nog even binnen
    const schuilt = bedreigd || stapNr < (k.schuilTot || 0);
    if (schuilt && !opDak) {
      k.zwerft = false;
      if (!k.vlucht || !e.pad) {
        k.vlucht = true;
        if (!naarDak()) naarHuis();
      }
      // Onderweg slaat hij alleen terug als iemand hem al raakt (binnen bereik), hij gaat er niet achteraan.
      if (k.doelwit && Math.hypot(k.doelwit.x - e.x, k.doelwit.y - e.y) > bereikVan(e, k)) k.doelwit = null;
      return;
    }
    if (opDak) {
      k.vlucht = false;
      k.zwerft = false;
      if (schuilt) {
        // Op het dak: alleen slaan wat binnen bereik is
        const binnen = anderen.filter((a) => Math.hypot(a.x - e.x, a.y - e.y) <= bereikVan(e, k));
        k.doelwit = binnen.length ? kiesDoelwit(e, k, binnen) : null;
        e.pad = null;
        return;
      }
    }
    k.vlucht = false;
    // Staat hij op een muur en moet hij vechten, dan eerst naar beneden.
    if (e.opMuur && !opDak && k.doelwit && !e.klimt) {
      k.zwerft = false;
      if (!e.pad) naarHuis();
      return;
    }
    if (k.doelwit) {
      if (Math.hypot(k.doelwit.x - e.x, k.doelwit.y - e.y) > bereikVan(e, k)) jaag(e, k);
      return;
    }
    if (e.pad) return;
    if (bijThuis(e, 4.5)) k.zwerft = false;
    // Hij zwerft: om de paar seconden een nieuw doel op de kaart, ver van zijn kasteel,
    // om zijn kasteel heen, op zijn eigen muren en soms even terug over zijn binnenplein.
    if (zwerfStraal > 0 && !bedreigd) {
      if (stapNr < (k.rondNa || 0)) return;
      k.rondNa = stapNr + stappen(4 + toeval() * 7);
      if (bijThuis(e, 4.5) || e.opMuur || toeval() < 0.85) {
        const opMuur = toeval() < (e.opMuur ? 0.4 : 0.25);   // af en toe een stuk muur, toren of het dak van zijn kasteel
        for (let poging = 0; poging < 20; poging++) {
          const hoek = toeval() * Math.PI * 2;
          const ver = (opMuur ? 3 : 5) + toeval() * (zwerfStraal - (opMuur ? 3 : 5));
          const x = Math.round(thuis.vx + Math.cos(hoek) * ver);
          const y = Math.round(thuis.vy + Math.sin(hoek) * ver);
          if (x < 2 || y < 2 || x >= B - 2 || y >= H - 2) continue;
          const vak = y * B + x;
          if (opMuur ? !wegvinder.isMuur(x, y, e.team) : (!wegvinder.isVrij(x, y, e.team) || bezetDoorVriend(vak, e))) continue;
          const pad = padNaar(opMuur ? N + vak : vak);
          if (pad && pad.length) { k.zwerft = true; zetPad(e, pad); return; }
        }
      }
    }
    // Thuis loopt hij rond over zijn binnenplein: om de paar seconden een
    // ander plekje vlak bij zijn burcht.
    if (bijThuis(e, 4.5)) {
      if (stapNr < (k.rondNa || 0)) return;
      k.rondNa = stapNr + stappen(4 + toeval() * 5);
      const plekken = [];
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ring = Math.max(Math.abs(dx), Math.abs(dy));
          if (ring < 2) continue;
          const x = thuis.vx + dx;
          const y = thuis.vy + dy;
          const vak = y * B + x;
          if (!wegvinder.isVrij(x, y, e.team) || bezetDoorVriend(vak, e) || vak === vakVan(e)) continue;
          if (!wegvinder.verbonden(vakVan(e), vak, e.team)) continue;
          plekken.push(vak);
        }
      }
      if (!plekken.length) return;
      const pad = zoekPad(e, plekken[Math.floor(toeval() * plekken.length)]);
      if (pad) zetPad(e, pad);
      return;
    }
    naarHuis();
  }

  // Een lijfwacht blijft vlak bij de heer en slaat toe wie dichtbij komt; is de heer gevallen,
  // dan verdedigt hij de burcht zoals de heer dat deed.
  // De lijfwacht van Karel (proloog): elke man heeft een vaste post rond de koning. Hij vecht alleen
  // met wie binnen 2,5 tegels van zijn post komt en loopt daarna terug naar zijn post.
  let lijfwachtLos = false;   // proloog: zodra Karel zelf aanvalt, vecht zijn hele lijfwacht vrij
  function karelWachtDenk(e, k, anderen) {
    const post = e.karelWacht !== undefined ? e.karelWacht : e.post;   // lijfwacht van Karel, of een soldaat met een vaste post (proloog)
    // Lijfwacht (niet Karel zelf) zolang Karel niet vecht: blijft staan, slaat alleen wie binnen zijn bereik staat
    if (e.karelWacht !== undefined && !(k.def && k.def.koning) && !lijfwachtLos) {
      k.wraak = null;
      k.bevel = null;
      const bereik = bereikVan(e, k);
      const naast = anderen.filter((a) => Math.hypot(a.x - e.x, a.y - e.y) <= bereik + 0.2);
      k.doelwit = naast.length ? kiesDoelwit(e, k, naast) : null;
      if (e.pad) e.pad = null;
      if (!k.doelwit) zetHouding(e, null);
      return;
    }
    const px = (post % B) + 0.5;
    const py = Math.floor(post / B) + 0.5;
    // Geen wraak en geen bevelen: hij laat zich niet weglokken van zijn post (naar Karel)
    k.wraak = null;
    k.bevel = null;
    const vanPost = Math.hypot(px - e.x, py - e.y);
    const dichtbij = anderen.filter((a) => Math.hypot(a.x - px, a.y - py) <= 2.5);
    k.doelwit = dichtbij.length && vanPost <= 3 ? kiesDoelwit(e, k, dichtbij) : null;
    if (k.doelwit && Math.hypot(k.doelwit.x - px, k.doelwit.y - py) > 3) k.doelwit = null;
    if (k.doelwit) {
      e.karelTerug = false;
      if (k.def && k.def.koning && e.karelWacht !== undefined) lijfwachtLos = true;   // Karel valt aan: de lijfwacht gaat los
      if (Math.hypot(k.doelwit.x - e.x, k.doelwit.y - e.y) > bereikVan(e, k)) jaag(e, k);
      return;
    }
    if (vanPost <= 0.7) { if (e.pad) e.pad = null; e.karelTerug = false; zetHouding(e, null); return; }
    // Terug naar de post; een lopende achtervolging eerst afbreken
    if (!e.karelTerug) { e.pad = null; e.karelTerug = true; }
    if (!e.pad) { const pad = zoekPad(e, post); if (pad) zetPad(e, pad); }
  }

  function lijfwachtDenk(e, k, anderen) {
    const heer = roodKoning && !roodKoning.dood ? roodKoning : null;
    const thuis = burchten[e.team];
    const midden = heer || thuis;
    const r = 7;
    const dichtbij = anderen.filter((a) => Math.hypot(a.x - midden.x, a.y - midden.y) <= r);
    k.doelwit = dichtbij.length ? kiesDoelwit(e, k, dichtbij) : null;
    if (k.doelwit) {
      if (Math.hypot(k.doelwit.x - e.x, k.doelwit.y - e.y) > bereikVan(e, k)) jaag(e, k);
      return;
    }
    if (!heer) return;
    const afstandHeer = Math.hypot(heer.x - e.x, heer.y - e.y);
    if (afstandHeer <= 2.2 || (e.pad && afstandHeer <= 5)) return;   // is hij ver weg, dan een nieuwe route, ook onderweg
    const hx = Math.floor(heer.x);
    const hy = Math.floor(heer.y);
    let best = -1;
    let bestD = Infinity;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 1) continue;
        const vak = (hy + dy) * B + hx + dx;
        if (!wegvinder.isVrij(hx + dx, hy + dy, e.team) || bezetDoorVriend(vak, e) || vak === vakVan(roodKoning)) continue;
        if (!wegvinder.verbonden(vakVan(e), vak, e.team)) continue;
        const d = Math.hypot(hx + dx + 0.5 - e.x, hy + dy + 0.5 - e.y);
        if (d < bestD) { bestD = d; best = vak; }
      }
    }
    if (best < 0) return;
    const pad = zoekPad(e, best);
    if (pad) zetPad(e, pad);
  }

  // Jouw koning gaat bij gevaar altijd naar het dak van je hoofdkasteel (net als de koning van rood):
  // zodra er een aanvaller dichtbij je kasteel of dichtbij hemzelf is. Daar slaat hij alleen wat binnen
  // zijn bereik komt. Is het gevaar weg, dan blijft hij nog even binnen.
  function spelerKoningDenk(e, k, anderen) {
    if (R.proloog) return false;
    const thuis = burchten[SPELER];
    const alarm = k.def.alarmAfstand || 9;
    const bedreigd = anderen.some((a) => !a.dood && (Math.hypot(a.x - thuis.x, a.y - thuis.y) <= alarm || Math.hypot(a.x - e.x, a.y - e.y) <= alarm));
    if (bedreigd) k.schuilTot = stapNr + stappen(15);
    if (!bedreigd && stapNr >= (k.schuilTot || 0)) return false;
    const opDak = e.opMuur && kaart.object[vakVan(e)] === OBJECT.BURCHT;
    if (opDak) {
      k.vlucht = false;
      const binnen = anderen.filter((a) => !a.dood && Math.hypot(a.x - e.x, a.y - e.y) <= bereikVan(e, k) && kanRaken(e, k, a));
      k.doelwit = binnen.length ? kiesDoelwit(e, k, binnen) : null;
      if (!e.klimt) e.pad = null;
      return true;
    }
    if (!k.vlucht || !e.pad) {
      k.vlucht = true;
      const st = kaart.start[SPELER];
      const tegels = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) tegels.push((st.y + dy) * B + st.x + dx);
      tegels.sort((a, b) => Math.hypot((a % B) - e.x, Math.floor(a / B) - e.y) - Math.hypot((b % B) - e.x, Math.floor(b / B) - e.y));
      const van = vakVan(e) + (e.opMuur ? N : 0);
      for (const vak of tegels) {
        if (kaart.object[vak] !== OBJECT.BURCHT || bezetDoorVriend(N + vak, e)) continue;
        const pad = wegvinder.zoekPadLagen(van, N + vak, SPELER);
        if (pad && pad.length) { zetPad(e, pad); break; }
      }
    }
    // Onderweg slaat hij alleen terug als iemand hem al raakt.
    k.doelwit = null;
    return true;
  }

  // --- Eén krijger, één rekenstap -----------------------------------------------------------
  // --- Ingenieur en trebuchet (level 6) ----------------------------------------------------
  // Een ingenieur bouwt op een vrij vak een trebuchet en blijft er naast staan om hem te bedienen.
  // De trebuchet staat daarna vast: hij schiet alleen op bouwwerken, tussen minBereik en bereik
  // tegels ver, en alleen zolang er een levende ingenieur van zijn team bij staat.
  const STAAND_MAX = () => R.trebuchetMax || 2;
  const staandVan = (a) => !a.dood && a.krijg && a.krijg.def.staand;
  const aantalStaand = (team) => (team === SPELER ? leger.lijst : vijanden).filter(staandVan).length;
  const staandOp = (vak) => [...leger.lijst, ...vijanden].some((a) => staandVan(a) && vakVan(a) === vak);
  // Een ballista (geschut) staat op een stuk muur of toren van de speler, en schiet op soldaten en belegeringsmachines.
  const geschutVan = (a) => !a.dood && a.krijg && a.krijg.def.geschut;
  const aantalGeschut = (team) => (team === SPELER ? leger.lijst : vijanden).filter(geschutVan).length;
  const geschutOp = (vak) => leger.lijst.some((a) => geschutVan(a) && vakVan(a) === vak);
  const GESCHUT_MAX = () => R.ballistaMax || 4;
  const binnenBereik = (e, k, b) => {
    const was = k.bouw;
    k.bouw = b;
    const r = bijBouw(e, k);
    k.bouw = was;
    return r;
  };
  // Hoeveel ingenieurs hem bedienen (of ernaartoe lopen).
  const bedienerAantal = (t) => {
    const eigen = t.team === SPELER ? leger.lijst : vijanden;
    let n = 0;
    for (const a of eigen) {
      if (a.dood || a === t || !(a.soldaat || a.vijand)) continue;
      const ka = a.krijg;
      if (ka && ka.def.bouwt && ka.ing && ka.ing.treb === t) n++;
    }
    return n;
  };
  // Bediend wordt hij door de ingenieurs die aan hem gekoppeld zijn (ze bouwden hem, en je maakte ze niet los).
  const heeftBediener = (e) => {
    const eigen = e.team === SPELER ? leger.lijst : vijanden;
    for (const a of eigen) {
      if (a.dood || a === e || !(a.soldaat || a.vijand)) continue;
      const ka = krijgVan(a);
      if (ka.def.bouwt && ka.ing && ka.ing.treb === e) return true;
    }
    return false;
  };
  // Het beste bouwwerk van de tegenstander om te raken: eerst muren en torens, dan de rest, het kasteel als laatste.
  function kiesStaandDoel(e, k) {
    const min = k.def.minBereik || 0;
    const max = k.def.bereik - 1;
    const eigVijand = e.team === SPELER ? ROOD : SPELER + 1;
    const vijandBurcht = e.team === SPELER ? rood : burcht;
    const w = Math.ceil(max);
    const mx = Math.floor(e.x);
    const my = Math.floor(e.y);
    let beste = null;
    let rang = Infinity;
    const probeer = (b, extra) => {
      if (!staatNog(b)) return;
      const ver = Math.hypot(Math.max(0, Math.abs(e.x - b.x) - b.straal), Math.max(0, Math.abs(e.y - b.y) - b.straal));
      if (ver < min || ver > max) return;
      if (ver + extra < rang) {
        rang = ver + extra;
        beste = b;
      }
    };
    for (let dy = -w; dy <= w; dy++) {
      for (let dx = -w; dx <= w; dx++) {
        const nx = mx + dx;
        const ny = my + dy;
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const vak = ny * B + nx;
        if (kaart.eigenaar[vak] !== eigVijand || inBurcht(vak, vijandBurcht)) continue;
        const soort = kaart.object[vak];
        const eerst = SPERWERK.has(soort);
        if (!eerst && !ANDERWERK.has(soort)) continue;
        probeer(bouwDoel(vak), eerst ? 0 : 1000);
      }
    }
    if (vijandBurcht.leven > 0) probeer(vijandBurcht.doel, 2000);
    return beste;
  }
  function staandDenk(e, k) {
    if (e.pad) zetPad(e, null);
    k.doelwit = null;
    k.bevel = null;
    if (!heeftBediener(e)) {
      k.bouw = null;
      k.bouwBevel = null;
      zetHouding(e, null);
      return;
    }
    if (k.bouwBevel && staatNog(k.bouwBevel) && binnenBereik(e, k, k.bouwBevel)) {
      k.bouw = k.bouwBevel;
      return;
    }
    k.bouwBevel = null;
    if (k.bouw && staatNog(k.bouw) && binnenBereik(e, k, k.bouw)) return;
    k.bouw = kiesStaandDoel(e, k);
  }
  // Een plek voor een trebuchet van rood: dicht bij de ingenieur, vrij, bereikbaar, en met een bouwwerk van jou
  // op de goede afstand (niet te dicht: de dode zone, niet te ver).
  function kiesTrebuchetPlek(e, k) {
    const treb = soorten[k.def.bouwt];
    const min = treb.minBereik + 1;
    const max = treb.bereik - 2;
    const w = Math.ceil(treb.bereik) + 8;
    const mx = Math.floor(e.x);
    const my = Math.floor(e.y);
    const doelen = [];
    for (let dy = -w; dy <= w; dy++) {
      for (let dx = -w; dx <= w; dx++) {
        const nx = mx + dx;
        const ny = my + dy;
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const vak = ny * B + nx;
        if (kaart.eigenaar[vak] !== SPELER + 1 || inBurcht(vak, burcht)) continue;
        const soort = kaart.object[vak];
        if (SPERWERK.has(soort) || ANDERWERK.has(soort)) doelen.push(bouwDoel(vak));
      }
    }
    if (burcht.leven > 0) doelen.push(burchtDoel);
    if (!doelen.length) return null;
    const kandidaten = [];
    const r = 8;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = mx + dx;
        const ny = my + dy;
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const vak = ny * B + nx;
        if (!vrijVoor(vak, VIJAND) || staandOp(vak) || bezetDoorVriend(vak, e)) continue;
        const x = nx + 0.5;
        const y = ny + 0.5;
        let n = 0;
        for (const d of doelen) {
          const ver = Math.hypot(Math.max(0, Math.abs(x - d.x) - d.straal), Math.max(0, Math.abs(y - d.y) - d.straal));
          if (ver >= min && ver <= max) n++;
        }
        if (n) kandidaten.push({ vak, rang: Math.hypot(x - e.x, y - e.y) - Math.min(n, 6) * 0.5 });
      }
    }
    kandidaten.sort((p, q) => p.rang - q.rang);
    for (const c of kandidaten.slice(0, 4)) {
      const sta = plekRond(e, c.vak, 1);
      if (sta >= 0 && zoekPad(e, sta)) return { vak: c.vak, sta, fase: 'loop', tot: 0, treb: null };
    }
    return null;
  }
  // Een trebuchet bouwen doen twee ingenieurs samen: allebei lopen naar de plek (elk naast het vak),
  // en pas als ze er allebei zijn begint het hameren. Valt er eentje uit of krijgt hij een ander bevel,
  // dan stopt de bouw en krijgt de speler de grondstoffen terug. Daarna blijft er een naast de trebuchet
  // staan om hem te bedienen; de ander is weer vrij.
  const projecten = [];
  const lidGeldig = (l, p) => !l.dood && krijgVan(l).ing && krijgVan(l).ing.proj === p;
  function stopProject(p, melding = true) {
    if (p.klaar || p.gestopt) return;
    p.gestopt = true;
    for (const l of p.leden) {
      const kl = l.krijg;
      if (kl && kl.ing && kl.ing.proj === p) {
        kl.ing = null;
        if (!l.dood) zetHouding(l, null);
      }
    }
    if (p.team === SPELER) {
      opTerug(p.kosten);
      if (melding) opMelding(`The ${p.soort === 'ballista' ? 'ballista' : 'trebuchet'} could not be built. Your wood and stone are returned.`);
    }
  }
  function projectenStap() {
    for (let i = projecten.length - 1; i >= 0; i--) {
      const p = projecten[i];
      if (p.klaar || p.gestopt) {
        projecten.splice(i, 1);
        continue;
      }
      if (!p.leden.every((l) => lidGeldig(l, p))) {
        stopProject(p);
        projecten.splice(i, 1);
      }
    }
  }
  function nieuwProject(team, vak, leden, kosten, soort = null, muur = false) {
    const p = { team, vak, leden, kosten, tot: 0, treb: null, klaar: false, gestopt: false, soort: soort || krijgVan(leden[0]).def.bouwt, muur };
    const gebruikt = [];
    for (const l of leden) {
      const kl = krijgVan(l);
      // Op de muur bouwt hij op zijn eigen plek. Op de grond staan de ingenieurs achter de trebuchet: van de vijand af.
      const vijandVak = team === SPELER ? rood.vak : burcht.vak;
      const sta = muur ? vak : plekRond(l, vak, 1, false, gebruikt, false, { x: (vijandVak % B) + 0.5, y: Math.floor(vijandVak / B) + 0.5 });
      if (sta < 0) return null;
      gebruikt.push(sta);
      l.__sta = sta;
    }
    for (const l of leden) {
      const kl = krijgVan(l);
      kl.ing = { proj: p, vak, sta: l.__sta, fase: 'loop', muur, wachtTot: muur ? stapNr + stappen(45) : 0 };
      delete l.__sta;
      kl.denk = 1;
      kl.doelwit = null;
      kl.bevel = null;
      kl.bouw = null;
      kl.bouwBevel = null;
      kl.ladder = -1;
      if (l.soldaat) l.soldaat.doel = -1;
      if (l.pad) zetPad(l, null);
    }
    projecten.push(p);
    return p;
  }
  // Voor rood: een maat voor de ingenieur, vrij en niet te ver weg.
  function vindMaat(e, k) {
    const eigen = e.team === SPELER ? leger.lijst : vijanden;
    let beste = null;
    let min = 14;
    for (const a of eigen) {
      if (a === e || a.dood || !(a.soldaat || a.vijand)) continue;
      const ka = krijgVan(a);
      if (!ka.def.bouwt) continue;
      if (ka.ing || a.garnizoen || (ka.tak && ka.tak.verzamel >= 0)) continue;
      const d = verVan(e, vakVan(a));
      if (d < min) {
        min = d;
        beste = a;
      }
    }
    return beste;
  }
  // Geeft true als de ingenieur hiermee bezig is (dan doet hij verder niets), false als hij gewoon meedoet.
  function ingenieurDenk(e, k) {
    let ing = k.ing;
    if (!ing && e.team === VIJAND && !(k.tak && k.tak.verzamel >= 0) && !e.garnizoen && aantalStaand(VIJAND) < STAAND_MAX() && stapNr >= (k.ingZoek || 0)) {
      k.ingZoek = stapNr + stappen(2);
      const maat = vindMaat(e, k);
      const plek = maat ? kiesTrebuchetPlek(e, k) : null;
      if (plek && maat) {
        const p = nieuwProject(VIJAND, plek.vak, [e, maat], null);
        ing = k.ing;
        if (!p) ing = null;
      }
    }
    if (!ing) return false;
    if (ing.bemanning) {
      // Op weg naar een trebuchet zonder bedieners: aangekomen, dan bedient hij hem mee.
      if (!ing.treb || ing.treb.dood || (ing.treb.krijg && ing.treb.krijg.stil)) { k.ing = null; if (e.pad) zetPad(e, null); return false; }
      if (ing.fase === 'loop') {
        if (verVan(e, ing.sta) <= 0.9) {
          ing.fase = 'bedien';
          if (e.pad) zetPad(e, null);
        } else {
          if (!e.pad) {
            const pad = zoekPad(e, ing.sta);
            if (!pad) { k.ing = null; return false; }
            zetPad(e, pad);
          }
          return true;
        }
      }
    }
    const p = ing.proj;
    k.doelwit = null;
    k.bouw = null;
    k.bevel = null;
    if (ing.fase === 'loop' && ing.muur) {
      // Naar de muur: het pad is gezet door leger.naarMuur; hij is er als hij op dat stuk muur staat.
      if (e.opMuur && !e.klimt && !e.pad && vakVan(e) === ing.sta) ing.fase = 'wacht';
      else {
        if (!e.pad && !e.klimt && !leger.naarMuur(e, ing.sta)) { stopProject(p); return false; }
        if (stapNr > ing.wachtTot) { stopProject(p); return false; }
        return true;
      }
    }
    if (ing.fase === 'loop') {
      if (verVan(e, ing.sta) <= 0.9) {
        ing.fase = 'wacht';
        if (e.pad) zetPad(e, null);
      } else {
        if (!e.pad) {
          const pad = zoekPad(e, ing.sta);
          if (!pad) {
            stopProject(p);
            return false;
          }
          zetPad(e, pad);
        }
        return true;
      }
    }
    if (ing.fase === 'wacht') {
      kijkNaar(e, (ing.vak % B) + 0.5, Math.floor(ing.vak / B) + 0.5);
      const allebei = p.leden.every((l) => krijgVan(l).ing && krijgVan(l).ing.fase !== 'loop' && krijgVan(l).ing.fase !== undefined && verVan(l, krijgVan(l).ing.sta) <= 1.2);
      if (!allebei) return true;
      if (!p.tot) p.tot = stapNr + stappen(k.def.bouwTijd || 20);
      ing.fase = 'bouw';
    }
    if (ing.fase === 'bouw') {
      kijkNaar(e, (ing.vak % B) + 0.5, Math.floor(ing.vak / B) + 0.5);
      zetHouding(e, 'sla');
      if (!p.tot || stapNr < p.tot) return true;
      zetHouding(e, null);
      if (!p.treb) {
        if (p.klaar) return true;
        if (p.muur ? (geschutOp(ing.vak) || aantalGeschut(e.team) >= GESCHUT_MAX()) : (!vrijVoor(ing.vak, e.team) || staandOp(ing.vak) || aantalStaand(e.team) >= STAAND_MAX())) {
          stopProject(p);
          return false;
        }
        p.treb = p.muur ? leger.zetOp(p.soort, ing.vak, true) : e.team === SPELER ? leger.zetOp(p.soort, ing.vak) : maakVijand(p.soort, ing.vak);
        p.klaar = true;
        opMelding(p.muur ? 'Your ballista is ready. It fires giant bolts at soldiers and siege machines, as long as its engineer stays with it.' : e.team === SPELER ? 'Your trebuchet is ready. It stands fast and hits walls and towers from far away.' : 'The duke\'s engineers have raised a trebuchet! Kill both engineers and it falls silent.');
      }
      ing.treb = p.treb;
      // Allebei blijven ze bij de trebuchet en bedienen hem samen.
      ing.fase = 'bedien';
      return true;
    }
    // bedienen: hij blijft naast zijn trebuchet staan en draait aan de windas zodra die schiet
    const t = ing.treb;
    if (!t || t.dood || Math.hypot(e.x - t.x, e.y - t.y) > 4) {
      zetHouding(e, null);
      k.ing = null;
      return false;
    }
    kijkNaar(e, t.x, t.y);
    const kt = t.krijg;
    // Wat ze doen (0.81.1), gelijk met de arm in de tekenlaag (10 stappen per seconde):
    //   1,8 tot 5,8 s na het schot: samen aan de windas draaien tot de arm weer beneden is;
    //   daarna, met een doel: een nieuwe steen in de slinger leggen (rustiger tempo);
    //   zonder doel: af en toe onderhoud (een paar tikken met de hamer), daartussen even rondkijken.
    const sinds = kt && kt.schotStap !== undefined ? stapNr - kt.schotStap : Infinity;
    const wie = (Math.floor(e.x) + Math.floor(e.y)) % 2;   // de twee ingenieurs werken niet precies tegelijk
    let werk = false;
    let tempo = 4;
    if (sinds >= 18 && sinds < 58) werk = true;
    else if (kt && kt.bouw && heeftBediener(t)) { werk = true; tempo = 7; }
    else {
      const ronde = (stapNr + wie * 37) % 90;
      werk = ronde < 22;
      tempo = 5;
      if (!werk && ronde % 30 === 0) kijkNaar(e, e.x + (wie ? 1 : -1), e.y);
    }
    zetHouding(e, werk ? 'sla' : null);
    if (werk) e.pose = Math.floor((stapNr + wie * 2) / tempo) % 2;
    return true;
  }
  // Een ingenieur die nog vrij is: niet bezig met een bouw en niet aan een trebuchet gekoppeld.
  const vrijeIngenieur = (e) => !e.dood && (e.soldaat || e.vijand) && krijgVan(e).def.bouwt && !krijgVan(e).ing;
  // Het bevel van de speler: een of twee gekozen ingenieurs bouwen op dit vak; is er maar een gekozen, dan helpt de
  // dichtstbijzijnde andere vrije ingenieur van je leger vanzelf mee.
  // 0: kan niet op dit vak, -1: maximum bereikt, -2: er zijn geen twee vrije ingenieurs.
  // Door de speler gekozen ingenieurs op een eigen trebuchet zetten (tik op de trebuchet). Max 2 bedieners per trebuchet.
  function bemanTrebuchet(lijst, vak) {
    const t = leger.lijst.find((a) => staandVan(a) && vakVan(a) === vak);
    if (!t || t.team !== SPELER || t.dood || (t.krijg && t.krijg.stil)) return -1;
    let vrij = 2 - bedienerAantal(t);
    if (vrij <= 0) return -2;
    let n = 0;
    for (const e of lijst) {
      if (vrij <= 0) break;
      const k = e.krijg;
      if (!k || !k.def || !k.def.bouwt || e.team !== SPELER || e.dood || e.opMuur || e.klimt) continue;
      if (k.ing && k.ing.treb === t) continue;
      const vijandVak = rood.vak;
      const sta = plekRond(e, vakVan(t), 1, false, [], false, { x: (vijandVak % B) + 0.5, y: Math.floor(vijandVak / B) + 0.5 });
      if (sta < 0) continue;
      k.ing = { treb: t, vak: vakVan(t), sta, fase: 'loop', muur: false, wachtTot: 0, bemanning: true };
      k.denk = 1; k.doelwit = null; k.bevel = null; k.bouw = null; k.bouwBevel = null;
      if (e.pad) zetPad(e, null);
      if (e.soldaat) e.soldaat.doel = -1;
      n++; vrij--;
    }
    return n;
  }

  function bouwTrebuchet(lijst, vak, kosten = null) {
    const gekozen = lijst.filter(vrijeIngenieur);
    if (vak < 0 || vak >= N || !vrijVoor(vak, SPELER) || staandOp(vak)) return gekozen.length ? 0 : -2;
    if (aantalStaand(SPELER) + projecten.filter((p) => p.team === SPELER && !p.klaar && !p.gestopt).length >= STAAND_MAX()) return -1;   // het maximum is bereikt
    gekozen.sort((p, q) => verVan(p, vak) - verVan(q, vak));
    const leden = gekozen.slice(0, 2);
    if (leden.length < 2) {
      const rest = leger.lijst.filter((e) => !leden.includes(e) && vrijeIngenieur(e)).sort((p, q) => verVan(p, vak) - verVan(q, vak));
      leden.push(...rest.slice(0, 2 - leden.length));
    }
    if (leden.length < 2) return -2;
    return nieuwProject(SPELER, vak, leden, kosten) ? 1 : 0;
  }
  // Een ballista bouwt een ingenieur alleen, op een stuk muur of toren van jou. Staat hij daar nog niet, dan loopt hij erheen
  // (hij klimt via een open poort of trap, net als je soldaten). Ook weer: 1 gelukt, 0 kan hier niet, -1 maximum bereikt,
  // -2 geen vrije ingenieur, -3 hij kan er niet komen.
  function bouwBallista(lijst, vak, kosten = null) {
    if (vak < 0 || vak >= N || !wegvinder.isMuur(vak % B, Math.floor(vak / B), SPELER) || geschutOp(vak)) return 0;
    const vrij = lijst.filter(vrijeIngenieur);
    if (!vrij.length) return -2;
    if (aantalGeschut(SPELER) + projecten.filter((p) => p.team === SPELER && p.muur && !p.klaar && !p.gestopt).length >= GESCHUT_MAX()) return -1;
    vrij.sort((p, q) => (q.opMuur && vakVan(q) === vak) - (p.opMuur && vakVan(p) === vak) || verVan(p, vak) - verVan(q, vak));
    const e = vrij[0];
    const p = nieuwProject(SPELER, vak, [e], kosten, 'ballista', true);
    if (!p) return 0;
    const er = e.opMuur && vakVan(e) === vak;
    if (!er && !leger.naarMuur(e, vak)) {
      // Niet bereikbaar: het project weer ongedaan maken, zonder terugbetaling (er is nog niet betaald).
      p.gestopt = true;
      const ke = krijgVan(e);
      ke.ing = null;
      projecten.splice(projecten.indexOf(p), 1);
      return -3;
    }
    return 1;
  }
  // De ingenieurs van een gekozen trebuchet weer losmaken: ze lopen vrij rond en de trebuchet zwijgt.
  // Eerste keer: de bedieners worden losgemaakt en de trebuchet blijft stil (geen ingenieur neemt hem nog over).
  // Is hij al stil en heeft hij geen bedieners, dan wordt hij afgebroken: dat geeft true terug in sloop.
  function ontkoppel(lijst) {
    let n = 0;
    let sloop = 0;
    for (const t of [...lijst]) {
      if (t.dood || !(staandVan(t) || geschutVan(t))) continue;
      const kt = t.krijg;
      if (staandVan(t) && kt && kt.stil && bedienerAantal(t) === 0) {
        leger.sneuvel(t);
        sloop++;
        continue;
      }
      for (const a of leger.lijst) {
        const ka = a.krijg;
        if (a.dood || !ka || !ka.ing || ka.ing.treb !== t) continue;
        ka.ing = null;
        zetHouding(a, null);
        n++;
      }
      if (kt) { kt.bouw = null; kt.bouwBevel = null; if (staandVan(t)) kt.stil = true; zetHouding(t, null); }
    }
    return { n, sloop };
  }
  // Voor de bereikring bij het plaatsen: welke bouwwerken van rood kan een trebuchet op dit vak raken?
  function trebuchetDoelen(px, py) {
    const def = soorten.trebuchet;
    const min = def.minBereik || 0;
    const max = def.bereik - 1;
    const x0 = px + 0.5;
    const y0 = py + 0.5;
    const w = Math.ceil(max) + 1;
    const uit = [];
    const probeer = (b) => {
      if (!staatNog(b)) return;
      const ver = Math.hypot(Math.max(0, Math.abs(x0 - b.x) - b.straal), Math.max(0, Math.abs(y0 - b.y) - b.straal));
      if (ver >= min && ver <= max) uit.push({ x: Math.floor(b.x), y: Math.floor(b.y), burcht: !!b.burcht });
    };
    for (let dy = -w; dy <= w; dy++) {
      for (let dx = -w; dx <= w; dx++) {
        const nx = px + dx;
        const ny = py + dy;
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const vak = ny * B + nx;
        if (kaart.eigenaar[vak] !== ROOD || inBurcht(vak, rood)) continue;
        const soort = kaart.object[vak];
        if (SPERWERK.has(soort) || ANDERWERK.has(soort)) probeer(bouwDoel(vak));
      }
    }
    if (rood.leven > 0) probeer(rood.doel);
    return uit;
  }
  const trebuchetStand = (team = SPELER) => ({ n: aantalStaand(team), max: STAAND_MAX() });

  function denk(e, k, anderen) {
    if (k.def.geschut && !e.torenPost && !heeftBediener(e)) {
      // Een ballista schiet alleen zolang zijn ingenieur erbij is.
      k.doelwit = null;
      k.bevel = null;
      if (e.pad) zetPad(e, null);
      zetHouding(e, null);
      return;
    }
    if (k.def.staand) {
      staandDenk(e, k);
      return;
    }
    if (k.def.bouwt && ingenieurDenk(e, k)) {
      schuifOp(e, k);
      return;
    }
    if (e.lijfwacht && e.team === VIJAND) {
      lijfwachtDenk(e, k, anderen);
      schuifOp(e, k);
      return;
    }
    if (e.torenPost && e.team === VIJAND) {
      // Een schutter of ballista op een rode toren: nooit lopen, alleen raken wat binnen bereik komt.
      k.bevel = null;
      if (e.pad) zetPad(e, null);
      const bereik = bereikVan(e, k);
      const binnen = anderen.filter((a) => Math.hypot(a.x - e.x, a.y - e.y) <= bereik + 0.2);
      k.doelwit = binnen.length ? kiesDoelwit(e, k, binnen) : null;
      if (!k.doelwit) zetHouding(e, null);
      return;
    }
    if (e.garnizoen && e.team === VIJAND) {
      garnizoenDenk(e, k, anderen);
      schuifOp(e, k);
      return;
    }
    if (e.koning && e.team === VIJAND) {
      koningDenk(e, k, anderen);
      schuifOp(e, k);
      return;
    }
    // Vaste post (proloog: kruisboogschutters op de binnenmuur): nooit lopen, alleen raken wat binnen bereik is
    if (e.team === SPELER && e.vastePost) {
      k.wraak = null;
      k.bevel = null;
      const bereik = bereikVan(e, k);
      const binnen = anderen.filter((a) => Math.hypot(a.x - e.x, a.y - e.y) <= bereik + 0.2);
      k.doelwit = binnen.length ? kiesDoelwit(e, k, binnen) : null;
      if (e.pad) e.pad = null;
      if (!k.doelwit) zetHouding(e, null);
      return;
    }
    // Lijfwacht van Karel die los is (Karel vecht zelf): gewone soldatenlogica, ze gaan vechten
    const losWacht = e.karelWacht !== undefined && lijfwachtLos && !(k.def && k.def.koning);
    if (e.team === SPELER && !losWacht && (e.karelWacht !== undefined || (e.post !== undefined && !e.opMuur))) {
      karelWachtDenk(e, k, anderen);
      schuifOp(e, k);
      return;
    }
    if (e.team === SPELER && koningSleutel && k.def.koning && spelerKoningDenk(e, k, anderen)) {
      schuifOp(e, k);
      return;
    }
    if (e.team === VIJAND && k.tak && k.tak.terug) {
      terugStap(e, k, k.tak);
      schuifOp(e, k);
      return;
    }
    k.doelwit = kiesDoelwit(e, k, anderen);
    // Tijdens verzamelen en opmars jaagt rood niemand ver na: hij blijft bij zijn leger.
    if (k.doelwit && e.team === VIJAND && k.tak && (k.tak.mars || k.tak.verzamel >= 0) && Math.hypot(k.doelwit.x - e.x, k.doelwit.y - e.y) > Math.max(bereikVan(e, k), 1.5) + 1.5) k.doelwit = null;
    // Een uitvaller jaagt niemand verder dan 12 tegels van zijn plek achter de muur.
    if (k.doelwit && e.team === VIJAND && k.tak && k.tak.uitval >= 0) {
      const hx = k.tak.uitval % B + 0.5, hy = Math.floor(k.tak.uitval / B) + 0.5;
      if (Math.hypot(k.doelwit.x - hx, k.doelwit.y - hy) > 12) k.doelwit = null;
    }
    // Koningsjager (veldheer): na de opmars rent hij naar jouw koning zodra daar een weg is
    // (bres, open poort, ladder). Elke 2 seconden kijkt hij opnieuw.
    if (e.team === VIJAND && k.tak && k.tak.jager && !k.tak.mars && !(k.tak.verzamel >= 0) && !k.tak.rem && !k.tak.terug && koningSleutel) {
      const ks = koningVan(SPELER);
      if (ks && !ks.dood) {
        if (k.jaagtKoning && k.doelwit !== ks && stapNr < (k.jagerKijk || 0)) k.doelwit = ks;
        else if (stapNr >= (k.jagerKijk || 0)) {
          k.jagerKijk = stapNr + 20;
          const oud = k.doelwit;
          k.doelwit = ks;
          jaag(e, k);
          k.jaagtKoning = k.doelwit === ks && !!e.pad;
          if (k.jaagtKoning) { if (veld) veld.jagerDoor(e); } else k.doelwit = oud;
        }
      } else k.jaagtKoning = false;
    }
    if (k.doelwit) {
      k.bouw = null;
      if (Math.hypot(k.doelwit.x - e.x, k.doelwit.y - e.y) > bereikVan(e, k) || !kanRaken(e, k, k.doelwit)) {
        if (e.opMuur || e.hinderlaag) k.doelwit = null;   // van de muur (of uit de rotsen) gaat hij er niet achteraan
        else jaag(e, k);
      }
    } else if (e.team === VIJAND) {
      if (!e.opMuur || e.wachter === undefined) {
        if (!tactiek(e, k)) naarBurcht(e, k);
      }
    } else if (k.bouwBevel) {
      // Terug naar het bouwwerk van rood dat de speler heeft aangewezen.
      if (!staatNog(k.bouwBevel)) {
        k.bouwBevel = null;
        k.bouw = null;
      } else if (k.bouw !== k.bouwBevel || (!e.pad && (!bijBouw(e, k) || (e.opMuur && !isSchutter(k))))) {
        gaNaarBouw(e, k, k.bouwBevel);
      }
    }
    schuifOp(e, k);
  }

  // Wie in deze stap dodelijk geraakt is, slaat zelf nog één keer terug:
  // zo hangt de afloop van een tweegevecht niet af van wie er eerst rekent.
  function krijgerStap(e, anderen) {
    const k = krijgVan(e);
    if (k.afkoel > 0) k.afkoel--;
    if (k.pose > 0 && --k.pose === 0) e.pose = 0;
    if (!e.pad) k.schuif = false;
    k.rust++;
    // Een ruiter telt hoeveel tegels hij loopt: na genoeg tegels doet zijn eerste klap veel meer schade (charge).
    if (k.def.charge) {
      const afstand = Math.hypot(e.x - (k.lx === undefined ? e.x : k.lx), e.y - (k.ly === undefined ? e.y : k.ly));
      if (afstand < 2) k.afgelegd = (k.afgelegd || 0) + afstand;   // een sprong (neergezet) telt niet mee
      k.lx = e.x;
      k.ly = e.y;
    }
    // Soldaten van de speler komen na een gevecht langzaam weer op krachten.
    if (k.def.koning) {
      // Een koning geneest alleen bij zijn eigen burcht, en alleen als die nog staat.
      if (e.leven < e.levenMax && burchten[e.team].leven > 0 && bijThuis(e, 4) && k.rust > herstelNa && stapNr % Math.max(1, Math.floor(herstelElke / 3)) === 0) e.leven++;
    } else if (e.team === SPELER && e.leven < e.levenMax && k.rust > herstelNa && stapNr % herstelElke === 0) e.leven++;
    // Wie zich heeft teruggetrokken, rust bij zijn burcht uit (sneller dan jouw soldaten).
    else if (e.team === VIJAND && k.tak && k.tak.terug && e.leven < e.levenMax && bijThuis(e, 6) && stapNr % Math.max(1, Math.floor(herstelElke / 2)) === 0) e.leven++;
    // Een soldaat die op jouw bevel ergens heen loopt, vecht onderweg niet.
    if (e.soldaat && e.soldaat.doel >= 0) {
      k.ladder = -1;
      k.klim = -1;
      k.doelwit = null;
      k.bevel = null;
      k.bouw = null;
      k.bouwBevel = null;
      k.ing = null;
      zetHouding(e, null);
      return;
    }
    if (k.def.verborgen) e.verborgen = stapNr >= (k.gezienTot || 0);
    if (k.ladder >= 0) {
      // In de opmars (veldheer) wacht ook een ladderdrager op de rest; hij is zijn plek niet kwijt.
      if (e.team === VIJAND && k.tak && (k.tak.rem || k.tak.verzamel >= 0) && !e.klimt) {
        if (e.pad) zetPad(e, null);
        if (k.tak.verzamel >= 0) k.ladder = -1;
        return;
      }
      ladderStap(e, k);
      return;
    }
    if (k.klim >= 0) {
      klimStap(e, k);
      return;
    }
    // Een soldaat van jou die op een stuk muur staat waar een ladder van
    // rood tegen staat, duwt die om (als hij niet hoeft te vechten).
    if (e.team === SPELER && e.opMuur && !e.pad && !e.klimt && !k.doelwit && wegvinder.isLadder(vakVan(e), VIJAND)) {
      zetHouding(e, 'sla');
      if (++k.duw >= stappen(vasteLadders.has(vakVan(e)) ? (R.omduwenVast || 10) : (R.omduwen || 3))) {
        k.duw = 0;
        haalLadderWeg(vakVan(e), VIJAND);
        opMelding('Your soldiers pushed over a red ladder.');
      }
    } else {
      k.duw = 0;
    }
    if (k.doelwit && (k.doelwit.dood || verborgenVoor(k.doelwit, Math.hypot(k.doelwit.x - e.x, k.doelwit.y - e.y)))) k.doelwit = null;
    if (--k.denk <= 0) {
      k.denk = DENK;
      denk(e, k, anderen);
    }
    // Een wachter staat stil om te schieten en loopt daarna zijn ronde verder.
    if (e.ronde) {
      if (k.doelwit) e.pad = null;
      else if (!e.pad) zetRonde(e, e.ronde);
    }
    if (k.doelwit) vecht(e, k);
    else if (k.bouw) beuk(e, k);
    else if (k.ing && (k.ing.fase === 'bouw' || k.ing.fase === 'bedien')) { /* de houding komt uit ingenieurDenk: hameren of aan de windas draaien */ }
    else zetHouding(e, null);
  }

  // De wacht op een burcht schiet op de dichtstbijzijnde tegenstander. Na
  // een tijd zonder aanval wordt de burcht langzaam hersteld.
  function burchtStap(b, doelen) {
    if (b.leven <= 0) return;
    b.rust++;
    if (b.afkoel > 0) {
      b.afkoel--;
    } else if (R.burchtSchiet && doelen.length) {
      let beste = null;
      let min = R.burchtBereik + 1.5;
      for (let i = 0; i < doelen.length; i++) {
        const a = doelen[i];
        if (a.dood || a.klimt || wachtBuiten(a)) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < min && !verborgenVoor(a, d)) {
          min = d;
          beste = a;
        }
      }
      if (beste) {
        b.afkoel = stappen(R.burchtSlagTijd);
        pijl(b.x, b.y, 72, beste.x, beste.y, 16 + (beste.hoogte || 0));
        raak(beste, Math.max(1, Math.round(R.burchtSchade * dekkingVan(beste))), null);
      }
    }
    if (b.leven < b.max && b.rust > herstelNa && stapNr % herstelElke === 0) {
      b.leven++;
      balkenBij();
    }
  }

  // --- Vijanden en golven ----------------------------------------------------------------------
  function maakVijand(sleutel, vak, leven) {
    const def = soorten[sleutel];
    const e = eenheden.maakWerker(vak, VIJAND, SOORT[def.soort], def.snelheid);
    e.vijand = sleutel;
    e.lagen = !def.nietKlimmen;   // via een ladder kan hij jouw muur op (een reus niet)
    e.levenMax = def.leven;
    e.leven = Number.isFinite(leven) ? klem(Math.round(leven), 1, def.leven) : def.leven;
    krijgVan(e, def);
    vijanden.push(e);
    return e;
  }

  // Een wachter van rood: een schutter die op zijn muur heen en weer loopt.
  function maakWachter(nummer, leven) {
    // Nummers vanaf routes.length zijn extra wachters die rood in de loop van het level erbij krijgt
    // (js/roodgroei.js): dezelfde muur, maar vanaf de andere kant.
    const extra = nummer >= routes.length;
    const route = routes.length ? routes[nummer % routes.length] : null;
    if (!wachterSoort || !route || !route.length) return null;
    const ronde = (nummer % 2 === 1) !== extra ? route.slice().reverse() : route.slice();
    const begin = ronde.find(isRodeMuur);
    if (begin === undefined) return null;   // zijn muur is er niet meer
    const e = maakVijand(wachterSoort, begin, leven);
    e.wachter = nummer;
    e.lagen = false;   // een wachter loopt een vaste ronde over vakken
    e.opMuur = true;
    e.hoogte = eenheden.hoogteOp(begin);
    e.snelheid = CONFIG.proef.snelheidWachter;
    zetRonde(e, ronde);
    return e;
  }

  function zetWachters(lijst) {
    for (let i = vijanden.length - 1; i >= 0; i--) {
      if (vijanden[i].wachter === undefined) continue;
      eenheden.verwijder(vijanden[i]);
      vijanden.splice(i, 1);
    }
    if (lijst) {
      const gehad = new Set();
      for (const regel of lijst) {
        if (!Array.isArray(regel)) continue;
        const [nummer, leven] = regel;
        if (!Number.isInteger(nummer) || nummer < 0 || nummer >= routes.length || gehad.has(nummer)) continue;
        gehad.add(nummer);
        maakWachter(nummer, leven);
      }
    } else {
      for (let nummer = 0; nummer < routes.length; nummer++) maakWachter(nummer);
    }
  }

  // Wie er op je af komt: alle vijanden behalve de wachters op de muur van rood.
  const aanvallers = () => vijanden.filter((e) => e.wachter === undefined && !e.koning && !e.lijfwacht && !e.garnizoen && !e.torenPost && !e.reserveWacht);
  function aantalAanvallers() {
    let n = 0;
    for (let i = 0; i < vijanden.length; i++) if (vijanden[i].wachter === undefined && !vijanden[i].koning && !vijanden[i].lijfwacht && !vijanden[i].garnizoen && !vijanden[i].torenPost && !vijanden[i].reserveWacht && !staandVan(vijanden[i])) n++;
    return n;
  }

  // De volgende golf vertrekt bij de rode burcht. Na de laatste golf uit de
  // lijst blijft die laatste terugkomen.
  function stuurGolf() {
    if (!golven.length) return 0;
    const n = stuurLeger(golven[Math.min(golf, golven.length - 1)], true);
    klok = stappen(R.tussenGolven);
    return n;
  }

  // Zet een groep vijanden bij de rode burcht neer. telAls: telt dit als een
  // aanval (golf + 1) of is het een uitval van de rode heer?
  // rond en straal: waar ze verschijnen (standaard bij de burcht van rood).
  // binnen: niet dichter dan zoveel tegels bij rond (proloog: niet op de burcht zelf).
  const maxVijanden = () => (R.proloog ? MAX_VIJANDEN_PROLOOG : MAX_VIJANDEN);
  function stuurLeger(inhoud, telAls = true, { rond = kaart.start[VIJAND], straal = 8, binnen = 0, houd = null, traag = 1, plan = false, uitval = null } = {}) {
    const bezet = new Set(vijanden.map(vakVan));
    const nieuw = [];
    let aantal = 0;
    const eigenStart = rond !== kaart.start[VIJAND];
    for (const [sleutel, hoeveel] of Object.entries(inhoud)) {
      if (!soorten[sleutel]) continue;
      for (let i = 0; i < hoeveel && vijanden.length < maxVijanden(); i++) {
        let vak = -1;
        for (let poging = 0; poging < 6; poging++) {
          // Een toren is te hoog voor een poort: hij komt buiten de muren te staan, in het open veld.
          const hoog = !!soorten[sleutel].hoog;
          vak = wegvinder.willekeurigVak(toeval, rond, hoog ? straal + 8 : straal, hoog ? VIJAND + HOOG : VIJAND);
          const ver = vak < 0 ? 0 : Math.max(Math.abs((vak % B) - rond.x), Math.abs(Math.floor(vak / B) - rond.y));
          if (vak >= 0 && !bezet.has(vak) && ver >= binnen) break;
          vak = -1;
        }
        if (vak < 0) continue;
        bezet.add(vak);
        const man = maakVijand(sleutel, vak);
        // Opmars: marcheer naar een plek bij `houd` en wacht daar
        if (houd) {
          const t = tak(man);
          t.houd = true;
          t.via = wegvinder.willekeurigVak(toeval, houd, houd.straal, VIJAND);
          t.snelheid = man.snelheid;
          man.snelheid *= traag;   // langzaam aanmarcheren
        }
        // Uitval (veldheer, 0.96.0): verdedigt het stuk voor zijn muur en keert daarna terug.
        if (uitval) {
          const t = tak(man);
          t.uitval = Math.floor(rond.y) * B + Math.floor(rond.x);
          t.uitvalDoel = uitval;
        }
        nieuw.push(man);
        aantal++;
      }
    }
    if (telAls) {
      if (aantal) geluid.speel('horn_attack');
      golf++;
      burchtGemeld = false;
      if (!heer && !R.proloog) opMelding(`Attack ${golf}! ${aantal} ${aantal === 1 ? 'enemy is' : 'enemies are'} coming at you from the red keep.`);
    }
    // De veldheer maakt er een aanval van: groepen, timing, doelkeuze (alleen bij een echte aanval).
    if (veld && telAls && nieuw.length && (!eigenStart || plan) && !R.proloog && (heer || hutVak >= 0)) veld.plan(nieuw, { golf, hut: hutVak });
    opVerandering();
    opStand();
    return aantal;
  }

  // Een hinderlaag: een vijand op een vaste plek (bijvoorbeeld een nis in de rotsen) die blijft staan en schiet.
  function hinderlaag(sleutel, vak) {
    if (!soorten[sleutel] || vak < 0) return null;
    const e = maakVijand(sleutel, vak);
    e.hinderlaag = true;
    const t = tak(e);
    t.houd = true;
    t.via = -1;
    opVerandering();
    opStand();
    return e;
  }

  // Een vijand die uit het niets opduikt (level 4, js/sluipers.js): gewoon een aanvaller, geen vaste post.
  function duikOp(sleutel, vak) {
    if (!soorten[sleutel] || vak < 0) return null;
    const e = maakVijand(sleutel, vak);
    opVerandering();
    opStand();
    return e;
  }

  // De verborgen reserve van rood (level 9, js/reserve.js): wacht onzichtbaar op een vaste plek.
  // Je ziet ze pas van heel dichtbij, of als er een ziener van jou in de buurt is.
  function reserveSoldaat(sleutel, vak) {
    if (!soorten[sleutel] || vak < 0) return null;
    const e = maakVijand(sleutel, vak);
    e.reserveWacht = true;
    e.onzichtbaar = true;
    const t = tak(e);
    t.houd = true;
    t.via = -1;
    opVerandering();
    opStand();
    return e;
  }
  // Wie kan de reserve zien? Een soldaat van jou heel dichtbij, of een ziener binnen zijn zicht.
  function reserveZicht() {
    const zieners = leger.lijst.filter((a) => !a.dood && krijgVan(a).def.ziener);
    for (const e of vijanden) {
      if (!e.reserveWacht || e.dood) continue;
      let gezien = false;
      for (const z of zieners) if (Math.hypot(z.x - e.x, z.y - e.y) <= krijgVan(z).def.ziener) { gezien = true; break; }
      if (!gezien) for (const a of leger.lijst) if (!a.dood && Math.hypot(a.x - e.x, a.y - e.y) <= 2.2) { gezien = true; break; }
      e.onzichtbaar = !gezien;
    }
  }
  // De ziener (beloning van level 9): een sluipmoordenaar of saboteur van de andere kant
  // binnen zijn zicht kan zich niet meer verbergen.
  function zienerZicht() {
    for (const [mijn, ander] of [[leger.lijst, vijanden], [vijanden, leger.lijst]]) {
      const zieners = mijn.filter((a) => !a.dood && krijgVan(a).def.ziener);
      for (const e of ander) {
        if (e.dood || !krijgVan(e).def.verborgen) continue;
        e.gezienDoorZiener = zieners.some((z) => Math.hypot(z.x - e.x, z.y - e.y) <= krijgVan(z).def.ziener);
      }
    }
  }

  // De reserve valt aan: iedereen zichtbaar en op weg naar jou.
  function laatReserveLos() {
    let n = 0;
    for (const e of vijanden) {
      if (!e.reserveWacht || e.dood) continue;
      e.reserveWacht = false;
      e.onzichtbaar = false;
      const k = krijgVan(e);
      if (k.tak) k.tak.houd = false;
      e.pad = null;
      k.denk = 1;
      n++;
    }
    return n;
  }

  // De opmars is klaar: iedereen die wachtte, gaat naar de burcht.
  function laatOpmarsLos() {
    let n = 0;
    for (const e of vijanden) {
      const k = krijgVan(e);
      if (!k.tak || !k.tak.houd) continue;
      k.tak.houd = false;
      k.tak.via = -1;
      if (k.tak.snelheid) e.snelheid = k.tak.snelheid;   // weer op gewone snelheid
      e.pad = null;
      n++;
    }
    return n;
  }
  // Voor tests: iedereen van de opmars staat meteen op zijn wachtplek
  function opmarsDirect() {
    for (const e of vijanden) {
      const k = krijgVan(e);
      if (!k.tak || !k.tak.houd || k.tak.via < 0) continue;
      e.x = (k.tak.via % B) + 0.5;
      e.y = Math.floor(k.tak.via / B) + 0.5;
      e.pad = null;
      k.tak.via = -1;
    }
  }
  // Hoeveel mannen staan er klaar (aangekomen) en hoeveel zijn er in totaal onderweg of klaar?
  function opmarsStand() {
    let totaal = 0;
    let klaar = 0;
    for (const e of vijanden) {
      if (e.dood) continue;
      const k = krijgVan(e);
      if (!k.tak || !k.tak.houd) continue;
      totaal++;
      if (k.tak.via < 0) klaar++;
    }
    return { totaal, klaar };
  }

  // Wie gevallen is, verdwijnt van de kaart.
  function ruimOp() {
    let iets = false;
    for (let i = vijanden.length - 1; i >= 0; i--) {
      const e = vijanden[i];
      if (!e.dood) continue;
      vijanden.splice(i, 1);
      eenheden.verwijder(e);
      val(e);
      iets = true;
    }
    const eigen = leger.lijst;
    for (let i = eigen.length - 1; i >= 0; i--) {
      const e = eigen[i];
      if (!e.dood) continue;
      val(e);
      leger.sneuvel(e);
      iets = true;
    }
    if (iets) {
      opVerandering();
      opStand();
    }
  }

  function einde(wat) {
    uitslag = wat;
    opVerandering();
    opStand();
    opEinde(wat);
  }

  // Eén rekenstap van het hele gevecht.
  function stap() {
    if (uitslag) return;
    stapNr++;
    if (gestaakt) return;
    if (!stil && !vrede && golven.length && !R.proloog) {
      if (heer) {
        if (rood.leven > 0) heer.stap();
      } else if (--klok <= 0) {
        stuurGolf();
      }
    }
    if (veld && !R.proloog) veld.stap();
    // Stenen van een trebuchet die aankomen
    projectenStap();
    for (let i = vluchten.length - 1; i >= 0; i--) {
      const v = vluchten[i];
      if (stapNr < v.tot) continue;
      vluchten.splice(i, 1);
      if (staatNog(v.b)) raakBouw(v.b, v.schade, v.door);
    }
    const eigen = leger.lijst;
    for (let i = 0; i < vijanden.length; i++) krijgerStap(vijanden[i], eigen);
    for (let i = 0; i < eigen.length; i++) krijgerStap(eigen[i], vijanden);
    burchtStap(burcht, vijanden);
    if (!R.proloog) burchtStap(rood, eigen);
    if (stapNr % stappen(1) === 0) helerStap();
    moordStap();
    jagerStap();
    if (stapNr % stappen(0.5) === 0 && vijanden.some((e) => e.reserveWacht)) reserveZicht();
    if (stapNr % stappen(0.5) === 0) zienerZicht();   // in de proloog staat er geen kasteel van rood
    brandStap();
    ruimOp();
    if (R.proloog) {
      // De proloog heeft geen winst of verlies: het verhaal beslist (js/proloog.js).
    } else if (hutVak >= 0 && !hutStaat()) {
      hutGevallen = true;
      einde('verloren');
      return;
    } else if (koningSleutel ? !koningVan(SPELER) : burcht.leven <= 0) {
      einde('verloren');
      return;
    }
    if (!R.proloog && !vrede && (koningSleutel ? !koningVan(VIJAND) : rood.leven <= 0)) {
      // De rode heer is verslagen: zijn mannen geven het op.
      for (const e of vijanden) e.dood = true;
      ruimOp();
      einde('gewonnen');
      return;
    }
    // Een burcht die net is gevallen: dat merkt de koning.
    for (const b of burchten) {
      if (b.leven > 0 || b.gemeldKapot) continue;
      b.gemeldKapot = true;
      if (koningSleutel) opMelding(b.team === SPELER ? 'Your keep is destroyed! Your king is weaker now and no longer heals. Protect him.' : 'The red keep is destroyed: their king is weaker. Defeat him!');
    }
    if (stapNr % perSeconde === 0) opStand();
  }

  // Na de winst verder spelen: er komen geen aanvallen meer.
  function gaVerder() {
    if (uitslag !== 'gewonnen') return;
    uitslag = null;
    vrede = true;
    opVerandering();
    opStand();
  }

  // --- Bevelen van de speler -------------------------------------------------------------------
  // De vijand onder een punt in de wereld (in pixels), of null.
  function vindVijand(wx, wy, marge = 0) {
    let beste = null;
    let afstand = Infinity;
    for (const e of vijanden) {
      const dx = Math.abs(wx - (e.x - e.y) * HB);
      const dy = wy - ((e.x + e.y) * HH - 16 - (e.hoogte || 0));
      if (dx > 12 + marge || dy < -22 - marge || dy > 20 + marge) continue;
      if (dx + Math.abs(dy) < afstand) {
        afstand = dx + Math.abs(dy);
        beste = e;
      }
    }
    return beste;
  }

  // Is dit vak een bouwwerk van rood dat je kunt aanvallen?
  // Het hoofdkasteel van rood hoort er niet bij: dat kun je niet aanvallen, alleen op klimmen. Winnen doe je door zijn koning te verslaan.
  const isVanRood = (vak) => vak >= 0 && vak < B * H && kaart.eigenaar[vak] === ROOD && !inBurcht(vak, rood);

  // Deze soldaten vallen het bouwwerk van rood op dat vak aan: zijn muur,
  // zijn poort of zijn burcht. Geeft terug hoeveel er gaan. uit (mag ontbreken): hier komen de eenheden in die het bevel kregen.
  function valBouwAan(lijst, vak, uit = null) {
    if (!isVanRood(vak)) return 0;
    const doel = inBurcht(vak, rood) ? rood.doel : bouwDoel(vak);
    let aantal = 0;
    for (const e of lijst) {
      const k = krijgVan(e);
      if (k.def.geschut) continue;   // een ballista schiet alleen op soldaten en machines
      if (k.def.staand) {
        // Een trebuchet loopt niet: hij schiet alleen als het bouwwerk binnen zijn bereik ligt.
        if (!heeftBediener(e) || !binnenBereik(e, k, doel)) continue;
        k.bouwBevel = doel;
        k.bouw = doel;
        aantal++;
        if (uit) uit.push(e);
        continue;
      }
      if (!k.def.schadeBouw) continue;   // een ladderdrager beukt niet
      const was = e.pad;
      if (!gaNaarBouw(e, k, doel)) continue;
      // Hij was ergens heen op weg: dat bevel vervalt.
      if (e.pad === was && e.pad) e.pad.length = Math.min(e.pad.length, e.stap + 1);
      e.soldaat.doel = -1;
      k.bouwBevel = doel;
      k.bevel = null;
      k.doelwit = null;
      k.denk = DENK;
      k.ladder = -1;
      aantal++;
      if (uit) uit.push(e);
    }
    return aantal;
  }

  // Deze soldaten vallen die vijand aan. Geeft terug hoeveel er gaan.
  function valAan(lijst, doel) {
    if (!doel || doel.dood) return 0;
    for (const e of lijst) {
      const k = krijgVan(e);
      if (vreedzaam(k)) continue;
      if (k.def.geschut && doel.krijg && doel.krijg.def.staand) continue;   // een ballista reikt niet tot een trebuchet
      k.ladder = -1;
      e.soldaat.doel = -1;
      if (e.pad) e.pad.length = Math.min(e.pad.length, e.stap + 1);
      k.bevel = doel;
      k.bouw = null;
      k.bouwBevel = null;
      k.doelwit = doel;
      k.doelVak = -1;
      k.negeer = null;
      k.denk = 1;
    }
    return lijst.filter((e) => !vreedzaam(krijgVan(e))).length;
  }

  // Het leven van wat er op dit vak staat: { leven, max, van }, of null.
  // van = 1: van jou, 2: van rood.
  function levenOp(vak) {
    for (const b of burchten) {
      if (inBurcht(vak, b)) return { leven: Math.ceil(b.leven), max: b.max, van: b.team + 1 };
    }
    const van = kaart.eigenaar[vak];
    if (!van) return null;
    const max = maxLeven(kaart.object[vak], van, vak);
    const s = schade.get(vak);
    return { leven: s && s.soort === kaart.object[vak] ? Math.ceil(s.leven) : max, max, van };
  }

  // Voor de cijfers in beeld.
  const stand = () => ({
    golf,
    golven: golven.length,
    klok: Math.ceil(klok / perSeconde),
    heer: heer ? heer.stand() : null,
    vijanden: aantalAanvallers(),
    wachters: vijanden.length - aantalAanvallers(),
    burcht: Math.ceil(burcht.leven),
    burchtMax: burcht.max,
    rood: Math.ceil(rood.leven),
    roodMax: rood.max,
    vrede,
    uitslag,
  });

  // --- Bewaren en terugzetten ---------------------------------------------------------------------
  const bewaarStand = () => ({
    golf,
    klok: Math.ceil(klok / perSeconde),
    burcht: Math.round(burcht.leven),
    vrede: vrede ? 1 : 0,
    heer: heer ? heer.bewaar() : undefined,
    koningRood: koningSleutel ? (koningVan(VIJAND) ? Math.max(1, Math.round(roodKoning.leven)) : 0) : undefined,
    schade: [...schade].map(([vak, s]) => [vak, Math.max(1, Math.round(s.leven))]),
    vijanden: aanvallers().map((e) => [e.vijand, Math.floor(e.x), Math.floor(e.y), Math.max(1, Math.round(e.leven))]),
    torenPosten: vijanden.filter((e) => e.torenPost && !e.dood).map((e) => [e.vijand, vakVan(e), Math.max(1, Math.round(e.leven))]),
    garnizoen: garnizoenLijst().map((e) => [e.vijand, Math.floor(e.x), Math.floor(e.y), Math.max(1, Math.round(e.leven)), e.post]),
    // Het kasteel van rood: zijn burcht, wat er vernield is en wie er nog op de muur loopt.
    rood: {
      burcht: Math.round(rood.leven),
      weg: [...roodWeg],
      wachters: vijanden.filter((e) => e.wachter !== undefined).map((e) => [e.wachter, Math.max(1, Math.round(e.leven))]),
    },
    // Jouw ladders tegen de muur van rood: [vak, dx, dy].
    // De ladders tegen een muur: [vak, dx, dy, team] (team 1 = van rood, tegen jouw muur).
    ladders: [SPELER, VIJAND].flatMap((team) => wegvinder.ladders(team).map((vak) => [vak, ...(ladderKant.get(vak) || [1, 0]), team, vasteLadders.has(vak) ? 1 : 0])),
  });

  // Zet een bewaarde stand terug (na de bouwwerken). Wat niet klopt wordt
  // overgeslagen.
  function zetStand(s) {
    if (!s || typeof s !== 'object') return;
    if (Number.isInteger(s.golf)) golf = klem(s.golf, 0, 9999);
    // Eerst het kasteel van rood: wat vernield was is weer weg.
    const r = s.rood && typeof s.rood === 'object' ? s.rood : null;
    if (r) {
      const weg = new Set();
      for (const vak of Array.isArray(r.weg) ? r.weg : []) {
        if (!Number.isInteger(vak) || vak < 0 || vak >= B * H || kaart.eigenaar[vak] !== ROOD || inBurcht(vak, rood)) continue;
        kaart.object[vak] = OBJECT.GEEN;
        kaart.eigenaar[vak] = 0;
        roodWeg.add(vak);
        weg.add(vak);
      }
      if (weg.size) opKaart(weg);
      if (Number.isFinite(r.burcht)) rood.leven = klem(Math.round(r.burcht), 0, rood.max);
      zetWachters(Array.isArray(r.wachters) ? r.wachters : null);
    }
    if (Array.isArray(s.ladders)) {
      const gezet = new Set();
      for (const regel of s.ladders) {
        if (!Array.isArray(regel)) continue;
        const [vak, dx, dy, van, vast] = regel;
        const team = van === VIJAND ? VIJAND : SPELER;
        if (!Number.isInteger(vak) || !isMuurVan(vak, team === SPELER ? VIJAND : SPELER)) continue;
        const kant = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([a, b]) => a === dx && b === dy) || [1, 0];
        wegvinder.zetLadder(vak, team, true);
        ladderKant.set(vak, kant);
        if (vast === 1) vasteLadders.add(vak);
        gezet.add(vak);
      }
      if (gezet.size) {
        opKaart(gezet);
        leger.kaartVeranderd();
      }
    }
    if (Number.isFinite(s.klok) && s.klok > 0) klok = Math.min(stappen(s.klok), stappen(Math.max(R.eersteGolf, R.tussenGolven)));
    if (heer) heer.zet(s.heer);
    if (Number.isFinite(s.burcht)) burcht.leven = klem(Math.round(s.burcht), 0, burcht.max);
    vrede = golven.length === 0 || s.vrede === 1 || s.vrede === true;
    if (Array.isArray(s.schade)) {
      for (const regel of s.schade) {
        if (!Array.isArray(regel)) continue;
        const [vak, leven] = regel;
        if (!Number.isInteger(vak) || vak < 0 || vak >= B * H || !kaart.eigenaar[vak]) continue;
        if (inBurcht(vak, burcht) || inBurcht(vak, rood)) continue;
        const max = maxLeven(kaart.object[vak], kaart.eigenaar[vak], vak);
        if (!Number.isFinite(leven) || leven <= 0 || leven >= max) continue;
        schade.set(vak, { leven: Math.round(leven), soort: kaart.object[vak], van: kaart.eigenaar[vak] });
      }
    }
    if (Array.isArray(s.vijanden)) {
      for (const regel of s.vijanden) {
        if (vijanden.length >= maxVijanden()) break;
        if (!Array.isArray(regel)) continue;
        const [sleutel, x, y, leven] = regel;
        if (!Object.prototype.hasOwnProperty.call(soorten, sleutel)) continue;
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= B || y >= H) continue;
        const vak = vrijBij(y * B + x);
        if (vak >= 0) maakVijand(sleutel, vak, leven);
      }
    }
    // Het garnizoen van het kamp: zoals bewaard (ook als het al is verslagen), of nieuw bij een oudere bewaarde stand.
    if (Array.isArray(s.torenPosten)) {
      for (const regel of s.torenPosten) {
        if (!Array.isArray(regel)) continue;
        const [sleutel, vak, leven] = regel;
        if (!Object.prototype.hasOwnProperty.call(soorten, sleutel) || !Number.isInteger(vak) || vak < 0 || vak >= N || !isRodeMuur(vak)) continue;
        zetTorenPost(sleutel, vak, leven);
      }
    }
    if (Array.isArray(s.garnizoen)) maakGarnizoen(s.garnizoen);
    else if (!(s.vrede === 1 || s.vrede === true) && s.koningRood !== 0) maakGarnizoen();
    balkenBij();
    opStand();
    // De koning van rood: met zijn bewaarde leven, of nieuw.
    if (koningSleutel) {
      const rk = s.koningRood;
      if (rk !== 0 && !R.proloog) maakRoodKoning(Number.isFinite(rk) ? rk : undefined);
    }
    if (R.proloog) return;
    if (koningSleutel ? s.koningRood === 0 && !vrede : rood.leven <= 0 && !vrede) einde('gewonnen');
    else if (!koningSleutel && burcht.leven <= 0) einde('verloren');
  }

  // Het dichtstbijzijnde vak waar een vijand kan staan, of -1.
  function vrijBij(vak) {
    const x = vak % B;
    const y = Math.floor(vak / B);
    for (let r = 0; r <= 6; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (wegvinder.isVrij(x + dx, y + dy, VIJAND)) return (y + dy) * B + x + dx;
        }
      }
    }
    return -1;
  }

  // Opnieuw beginnen: geen vijanden, de burcht heel, de eerste golf moet nog komen.
  function herstel() {
    gestaakt = false;
    vluchten.length = 0;
    projecten.length = 0;
    koningBeschermd = false;
    for (const e of vijanden) eenheden.verwijder(e);
    vijanden.length = 0;
    roodKoning = null;
    effecten.length = 0;
    schade.clear();
    branden.clear();
    golf = 0;
    klok = stappen(R.eersteGolf);
    if (heer) heer.herstel();
    if (veld) veld.herstel();
    maakRoodKoning();
    maakGarnizoen();
    for (const b of burchten) {
      b.leven = b.max;
      b.gemeldKapot = false;
      b.afkoel = 0;
      b.rust = 0;
    }
    burchtGemeld = false;
    for (let team = 0; team < 2; team++) for (const vak of wegvinder.ladders(team)) wegvinder.zetLadder(vak, team, false);
    ladderKant.clear();
    vasteLadders.clear();
    // Het kasteel van rood staat er weer, met een wachter op elk stuk muur.
    if (roodWeg.size) {
      for (const vak of roodWeg) {
        kaart.object[vak] = roodOrigineel.get(vak);
        kaart.eigenaar[vak] = ROOD;
      }
      const terug = new Set(roodWeg);
      roodWeg.clear();
      opKaart(terug);
    } else {
      opKaart(new Set());
    }
    zetWachters(null);
    vrede = golven.length === 0;
    uitslag = null;
    balkenBij();
    opStand();
  }

  zetWachters(null);   // rood begint met een wachter op elk stuk muur

  return {
    beschermKoning: (aan) => { koningBeschermd = !!aan; },
    // Level 10: het gevecht staken. Iedereen blijft staan waar hij staat, niemand vecht nog.
    // Proloog: het hele leger van rood trekt zich terug naar een vak buiten de poort (de ruiter heeft Wessel).
    trekTerug(vak) {
      for (const e of eenheden.lijst) {
        if (e.dood || e.team !== VIJAND || e.wachter !== undefined || !e.krijg) continue;   // alleen krijgers (geen werktuigen)
        const t = tak(e);
        t.houd = false; t.terug = false; t.doel = null; t.via = -1;
        t.aftocht = vak;
        e.pad = null;
        const k = krijgVan(e);
        k.doelwit = null; k.wraak = null; k.bevel = null;
      }
    },
    lijfwachtLos: () => lijfwachtLos,
    staak() {
      gestaakt = true;
      for (const e of [...vijanden, ...leger.lijst]) {
        e.pad = null;
        const k = krijgVan(e);
        k.doelwit = null;
        k.bouw = null;
        k.bevel = null;
        zetHouding(e, null);
      }
    },
    gestaakt: () => gestaakt,
    reserveSoldaat, laatReserveLos, reserveZicht,
    reserve: () => vijanden.filter((e) => e.reserveWacht && !e.dood),
    koningBeschermd: () => koningBeschermd,
    stap, stand, effecten, balken, kaartVeranderd, bloed, vermoord, rook, ruiter, laatOpmarsLos, opmarsDirect, opmarsStand, hinderlaag, duikOp,
    projectenAantal: () => projecten.length, vindVijand, valAan, valBouwAan, isVanRood, levenOp, gaVerder, bemanTrebuchet, bouwTrebuchet, bouwBallista, ontkoppel, trebuchetDoelen, trebuchetPlekOk: (vak) => vak >= 0 && vak < N && vrijVoor(vak, SPELER) && !staandOp(vak), ballistaPlekOk: (vak) => vak >= 0 && vak < N && wegvinder.isMuur(vak % B, Math.floor(vak / B), SPELER) && !geschutOp(vak), ballistaBereik: () => soorten.ballista.bereik + R.muurBereik, geschutStand: (team = SPELER) => ({ n: aantalGeschut(team), max: GESCHUT_MAX() }), trebuchetStand,
    // Voor de tests: hoeveel harder deze soldaat slaat (vaandel van koning of banierdrager).
    sterkteVan: (e) => sterkteVan(e, krijgVan(e)),
    zetLadderBevel, ladders,
    zetLadderVoor: (vak, team, dx = 1, dy = 0, vast = false) => zetLadder(vak, team, [dx, dy], vast),
    klimBevel,
    isRodeMuur: (vak) => isMuurVan(vak, VIJAND),
    muurTeHoog: () => !!R.roodMuurHoog,
    isRodeMuurZonderLadder: (vak) => isMuurVan(vak, VIJAND) && !wegvinder.isLadder(vak, SPELER),
    // Het dichtstbijzijnde stuk gewone muur van rood zonder ladder, binnen r tegels.
    dichtsteRodeMuur(vak, r = 3) {
      const x = vak % B;
      const y = Math.floor(vak / B);
      let beste = -1;
      let min = Infinity;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
          const v = ny * B + nx;
          if (!isMuurVan(v, VIJAND) || wegvinder.isLadder(v, SPELER)) continue;
          const d = dx * dx + dy * dy;
          if (d < min) { min = d; beste = v; }
        }
      }
      return beste;
    },
    bewaarStand, zetStand, herstel,
    uitslag: () => uitslag,
    aantalVijanden: aantalAanvallers,
    vijanden: aanvallers,
    wachters: () => vijanden.filter((e) => e.wachter !== undefined),
    torenPosten: () => vijanden.filter((e) => e.torenPost && !e.dood),
    lijfwachten: () => vijanden.filter((e) => e.lijfwacht && !e.dood),
    roodKoning: () => roodKoning,
    rood: () => ({ leven: rood.leven, max: rood.max, x: rood.vx, y: rood.vy, plekken: rood.plekken.slice(), weg: [...roodWeg] }),
    koning: (team = SPELER) => koningVan(team),
    maakRoodKoning,
    zetRood(leven) {
      rood.leven = klem(leven, 0, rood.max);
      balkenBij();
      opStand();
    },
    // De rode heer met eigen economie (js/rood.js).
    koppelHeer(h) {
      heer = h;
      opStand();
    },
    stuurLeger,
    // De veldheer van rood (js/veldheer.js) en wat hij nodig heeft.
    koppelVeld(v) { veld = v; },
    tak, bereikbaar, routeLengte,
    thuisPlekken: () => burcht.plekken.slice(),
    bouwDoelOp: bouwDoel,
    golfNr: () => golf,
    hutVakNr: () => hutVak,
    stappenVan: stappen,
    roodWeg: () => [...roodWeg].filter((vak) => !inBurcht(vak, rood)),
    origineelVan: (vak) => roodOrigineel.get(vak),
    // Rood zet een stuk van zijn kasteel terug. Lukt niet als er iets staat.
    // Rood bouwt erbij (groei): een nieuw gebouw van rood op een lege tegel, dat hij later ook herbouwt.
    zetRoodBouw(vak, soort) {
      if (!Number.isInteger(vak) || vak < 0 || vak >= B * H || kaart.object[vak] !== OBJECT.GEEN || kaart.grond[vak] === GROND.WATER) return false;
      kaart.object[vak] = soort;
      kaart.eigenaar[vak] = ROOD;
      roodOrigineel.set(vak, soort);
      opKaart(new Set([vak]));
      leger.kaartVeranderd();
      kaartVeranderd();
      return true;
    },
    // En weg bij opnieuw beginnen.
    haalRoodBouwWeg(vak) {
      roodOrigineel.delete(vak);
      roodWeg.delete(vak);
      if (kaart.eigenaar[vak] === ROOD && kaart.object[vak] !== OBJECT.GEEN) {
        kaart.object[vak] = OBJECT.GEEN;
        kaart.eigenaar[vak] = 0;
        opKaart(new Set([vak]));
      }
    },
    // Extra wachters op de muur van rood (groei).
    aantalExtraWachters: () => vijanden.filter((e) => e.wachter !== undefined && e.wachter >= routes.length).length,
    maxExtraWachters: () => routes.length,
    voegExtraWachterToe() {
      if (!routes.length) return null;
      const gebruikt = new Set(vijanden.filter((e) => e.wachter !== undefined).map((e) => e.wachter));
      for (let n = routes.length; n < routes.length * 2; n++) {
        if (!gebruikt.has(n)) return maakWachter(n);
      }
      return null;
    },
    herbouwVak(vak) {
      if (!roodWeg.has(vak) || inBurcht(vak, rood) || kaart.object[vak] !== OBJECT.GEEN) return false;
      kaart.object[vak] = roodOrigineel.get(vak);
      kaart.eigenaar[vak] = ROOD;
      roodWeg.delete(vak);
      schade.delete(vak);
      opKaart(new Set([vak]));
      leger.kaartVeranderd();
      balkenBij();
      opVerandering();
      return true;
    },
    // Voor het testen.
    stuurGolf,
    pauzeer(stilte) {
      stil = !!stilte;
    },
    spoel(seconden) {
      klok = Math.max(1, klok - stappen(seconden));
    },
    zetVijand(sleutel, x, y, leven) {
      if (!soorten[sleutel] || !wegvinder.isVrij(x, y, VIJAND)) return null;
      const e = maakVijand(sleutel, y * B + x, leven);
      opStand();
      return e;
    },
    // Level 4: dit vak is de hut die je moet houden, met zoveel leven.
    // Stond er al schade (bewaarde stand), dan blijft die.
    zetHut(vak, max) {
      hutVak = vak;
      hutGevallen = false;
      const s = schade.get(vak);
      if (s && s.soort === kaart.object[vak]) s.max = max;
      else schade.set(vak, { leven: max, max, soort: kaart.object[vak], van: kaart.eigenaar[vak] });
      balkenBij();
    },
    // Een doelgebouw (bouwloods) krijgt zijn eigen leven; stond er al schade, dan blijft die.
    zetLeven(vak, max, leven = max) {
      schade.set(vak, { leven: klem(Math.round(leven), 1, max), max, soort: kaart.object[vak], van: kaart.eigenaar[vak] });
      balkenBij();
    },
    hut: () => (hutVak < 0 ? null : { vak: hutVak, staat: hutStaat(), gevallen: hutGevallen, leven: hutStaat() ? Math.max(0, Math.round((schade.get(hutVak) || {}).leven || 0)) : 0, max: (schade.get(hutVak) || {}).max || 0 }),
    // Het doel van het level is gehaald (de hut gehouden): gewonnen.
    beslis(wat, opties = {}) {
      if (uitslag) return;
      if (wat === 'gewonnen' && !opties.staak) for (const e of vijanden) e.dood = true;
      ruimOp();
      einde(wat);
    },
    // Level 4: het ritueel van Gesina is af. De hut hoeft niet meer te blijven staan en de jagers
    // gaan niet meer op de hut af; de rode heer verslaan is nu het doel.
    hutVrij() { hutVak = -1; hutGevallen = false; },
    maakGarnizoen,
    garnizoen: garnizoenLijst,
    zetBurcht(leven) {
      burcht.leven = klem(leven, 0, burcht.max);
      balkenBij();
      opStand();
    },
    burcht: () => ({ leven: burcht.leven, max: burcht.max, x: thuis.x, y: thuis.y }),
    stappen: () => stapNr,
    stapNr: () => stapNr,
    schadeOp: (vak) => (schade.has(vak) ? schade.get(vak).leven : null),
  };
}
