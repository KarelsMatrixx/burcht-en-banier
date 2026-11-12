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

import { CONFIG } from './config.js';
import { OBJECT } from './kaart.js';
import { SOORT } from './eenheden.js';
import { BREEK } from './wegvinden.js';
import { maakToeval } from './toeval.js';

const SPELER = 0;
const VIJAND = 1;
const DENK = 5;             // om de zoveel rekenstappen kiest een krijger opnieuw wat hij doet
const MAX_EFFECTEN = 80;    // pijlen en gevallenen die tegelijk in beeld kunnen zijn
const MAX_VIJANDEN = 60;
const WRAAK_VER = 12;       // zo ver loopt iemand achter een schutter aan die hem raakte

const ROOD = 2;              // eigenaar van wat de rode heer heeft gebouwd

// opVerandering(): tijd om te bewaren. opStand(): de cijfers in beeld moeten
// mee. opMelding(tekst): een bericht voor de speler. opVerwoest(werk, van):
// er is een bouwwerk vernield (van = 1: van jou, 2: van rood).
// opKaart(vakken): de kaart is veranderd zonder dat er gebouwd is.
// opEinde('gewonnen' of 'verloren').
export function maakStrijd({ regels, kaart, wegvinder, eenheden, leger, bouwer, bouwwerken, opVerandering, opStand, opMelding, opVerwoest, opKaart, opEinde }) {
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
    if (!def.alleenBouw && !def.ladder) nodig.push('schade');
    if (!def.ladder) nodig.push('schadeBouw');
    for (const veld of nodig) {
      if (!(def[veld] > 0)) throw new Error(`economie.json: soldaat ${sleutel} mist een goed getal bij ${veld}`);
    }
  }

  // --- De stand ---------------------------------------------------------------------
  const vijanden = [];
  const effecten = [];          // voor de tekenlaag: pijlen en wie er valt
  const balken = [];            // voor de tekenlaag: het leven van beschadigde bouwwerken
  const schade = new Map();     // vak -> { leven, soort } van een beschadigd bouwwerk
  let stapNr = 0;
  let golf = 0;                 // hoeveel golven er al gestuurd zijn
  let klok = stappen(R.eersteGolf);   // rekenstappen tot de volgende golf
  let vrede = golven.length === 0;    // gewonnen en verder gespeeld: er komt niemand meer
  let uitslag = null;           // 'gewonnen' of 'verloren': het spel staat stil
  let stil = false;             // de test kan de klok van de golven stilzetten
  let burchtGemeld = false;
  let heer = null;              // de rode heer met eigen economie (js/rood.js); die bepaalt dan wanneer er wordt aangevallen
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
  const inBurcht = (vak, b) => Math.abs((vak % B) - b.vx) <= 1 && Math.abs(Math.floor(vak / B) - b.vy) <= 1 && isBurcht(kaart.object[vak]);

  // Het kasteel van rood zoals het er aan het begin staat, om het bij
  // opnieuw beginnen terug te kunnen zetten. roodWeg = wat er vernield is.
  const roodOrigineel = new Map();
  for (let i = 0; i < B * H; i++) if (kaart.eigenaar[i] === ROOD) roodOrigineel.set(i, kaart.object[i]);
  const roodWeg = new Set();
  const isRodeMuur = (vak) => {
    const soort = kaart.object[vak];
    return kaart.eigenaar[vak] === ROOD && (soort === OBJECT.MUUR || soort === OBJECT.TOREN || soort === OBJECT.WACHTTOREN || soort === OBJECT.POORT);
  };
  // De stukken muur waar een wachter loopt: zoveel als er in economie.json
  // staat (wachters), één per stuk, te beginnen bij de vier halve muren.
  const alleRoutes = (kaart.kastelen[VIJAND] && kaart.kastelen[VIJAND].routes) || [];
  const routes = alleRoutes.slice(0, Number.isInteger(R.wachters) && R.wachters >= 0 ? R.wachters : alleRoutes.length);
  const wachterSoort = soorten[R.wachter] ? R.wachter : null;

  // Hoeveel een bouwwerk kan hebben.
  const werkVan = new Map(Object.values(bouwwerken).map((werk) => [werk.soort, werk]));
  const maxLeven = (soort) => {
    const werk = werkVan.get(soort);
    return (werk && werk.leven) || R.gebouwLeven;
  };

  // --- Hulpjes ----------------------------------------------------------------------
  const vakVan = (e) => Math.floor(e.y) * B + Math.floor(e.x);
  const vrijVoor = (vak, team) => wegvinder.isVrij(vak % B, Math.floor(vak / B), team);
  const lijstVan = (team) => (team === SPELER ? leger.lijst : vijanden);
  const houdingVan = (def) => (def.bereik > 2 ? 'schiet' : 'sla');
  const isSchutter = (k) => k.def.bereik > 2;
  // Hoe ver iemand raakt: een schutter op de muur komt verder.
  const bereikVan = (e, k) => k.def.bereik + (e.opMuur && isSchutter(k) ? R.muurBereik : 0);
  // Een ridder kan alleen iemand raken die op dezelfde hoogte staat.
  const kanRaken = (e, k, a) => isSchutter(k) || !!a.opMuur === !!e.opMuur;
  const klem = (getal, laag, hoog) => Math.max(laag, Math.min(hoog, getal));
  const verVan = (e, vak) => Math.hypot((vak % B) + 0.5 - e.x, Math.floor(vak / B) + 0.5 - e.y);
  // Het vak waar iemand staat, of waar hij naar op weg is.
  const staVak = (a) => (a.pad && a.pad.length ? a.pad[a.pad.length - 1] % (B * H) : vakVan(a));
  // Een stormram en een ladderdrager vechten niet met soldaten.
  const vreedzaam = (k) => !!(k.def.alleenBouw || k.def.ladder);
  // Hoeveel van een pijl er doorkomt: een stormram heeft een dak.
  const dekkingVan = (doel) => {
    const d = doel.krijg && doel.krijg.def.pijlDekking;
    return d > 0 && d < 1 ? d : 1;
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
        ladderKlok: 0,
        duw: 0,                          // hoe lang hij al aan een ladder van rood duwt
      };
    }
    return e.krijg;
  }

  function bezetDoorVriend(vak, e) {
    const lijst = lijstVan(e.team);
    for (let i = 0; i < lijst.length; i++) {
      const a = lijst[i];
      if (a !== e && !a.dood && staVak(a) === vak) return true;
    }
    return false;
  }

  function zoekPad(e, naar, beeld = e.team) {
    const van = vakVan(e);
    return wegvinder.zoekPad(van % B, Math.floor(van / B), naar % B, Math.floor(naar / B), beeld);
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
  function plekRond(e, vak, r) {
    const x = vak % B;
    const y = Math.floor(vak / B);
    const hier = vakVan(e);
    let beste = -1;
    let min = Infinity;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const kandidaat = ny * B + nx;
        if (!wegvinder.verbonden(hier, kandidaat, e.team) || bezetDoorVriend(kandidaat, e)) continue;
        const d = verVan(e, kandidaat);
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
    if (effecten.length >= MAX_EFFECTEN) effecten.shift();
    wat.van = performance.now();
    effecten.push(wat);
  }
  const pijl = (x1, y1, h1, x2, y2, h2, steen = false) =>
    effect({ soort: 'pijl', steen, x1, y1, h1, x2, y2, h2, duur: (steen ? 400 : 130) + 45 * Math.hypot(x2 - x1, y2 - y1) });
  const val = (e) => effect({ soort: 'val', x: e.x, y: e.y, team: e.team, duur: 1500 });

  function balkenBij() {
    balken.length = 0;
    for (const [vak, s] of schade) {
      balken.push({ x: vak % B, y: Math.floor(vak / B), deel: klem(s.leven / maxLeven(s.soort), 0, 1) });
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
  function slaToe(e, k) {
    k.afkoel = stappen(k.def.slagTijd);
    k.pose = 3;
    e.pose = 1;
    k.rust = 0;
  }

  // door = wie de klap uitdeelde (null: de wacht op de burcht).
  function raak(doel, hoeveel, door) {
    doel.leven -= hoeveel;
    const kd = krijgVan(doel);
    kd.rust = 0;
    if (doel.leven <= 0) {
      doel.dood = true;
      return;
    }
    // Wie van ver wordt geraakt en niets te doen heeft, gaat erop af.
    if (door && !kd.doelwit && !kd.wraak) {
      kd.wraak = door;
      kd.denk = 1;
    }
  }

  const bouwDoel = (vak) => ({ vak, soort: kaart.object[vak], van: kaart.eigenaar[vak], x: (vak % B) + 0.5, y: Math.floor(vak / B) + 0.5, straal: 0.5 });
  const staatNog = (b) => (b.burcht ? burchten[b.team].leven > 0 : b.van !== 0 && kaart.eigenaar[b.vak] === b.van && kaart.object[b.vak] === b.soort);

  function raakBouw(b, hoeveel) {
    if (b.burcht) {
      const doel = burchten[b.team];
      doel.leven = Math.max(0, doel.leven - hoeveel);
      doel.rust = 0;
      if (b.team === SPELER && !burchtGemeld) {
        burchtGemeld = true;
        opMelding('Je burcht wordt aangevallen! Stuur je soldaten erheen.');
      }
      balkenBij();
      opStand();
      return;
    }
    let s = schade.get(b.vak);
    if (!s || s.soort !== b.soort) {
      s = { leven: maxLeven(b.soort), soort: b.soort, van: b.van };
      schade.set(b.vak, s);
    }
    s.leven -= hoeveel;
    if (s.leven <= 0) {
      schade.delete(b.vak);
      if (b.van === ROOD) roodWeg.add(b.vak);
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
    if (k.def.bereik > 2) return Math.hypot(Math.max(0, dx - b.straal), Math.max(0, dy - b.straal)) <= k.def.bereik - 1;
    return Math.max(dx, dy) <= b.straal + 1.2;
  }

  // Dicht genoeg: hij loopt nog door tot het midden van de volgende tegel
  // en blijft daar staan, tenzij daar al een maat van hem staat.
  function stopBijVolgende(e) {
    const stop = e.pad[e.stap];
    if (stop !== undefined && e.pad.length > e.stap + 1 && !bezetDoorVriend(stop, e)) e.pad.length = e.stap + 1;
  }

  // --- Kiezen wie je aanvalt ------------------------------------------------------------
  function kiesDoelwit(e, k, anderen) {
    if (vreedzaam(k)) return null;
    const schutter = isSchutter(k);
    const bereik = bereikVan(e, k);
    // Een schutter van de speler blijft staan waar je hem neerzet: hij
    // schiet op wat binnen bereik komt en loopt er niet achteraan. Wie op
    // de muur staat, blijft daar ook.
    const blijft = !!e.opMuur || (e.team === SPELER && schutter);
    if (k.bevel) {
      if (k.bevel.dood || !kanRaken(e, k, k.bevel)) k.bevel = null;
      else if (!e.opMuur || Math.hypot(k.bevel.x - e.x, k.bevel.y - e.y) <= bereik) return k.bevel;
    }
    const ver = blijft ? bereik : k.def.zicht;
    let beste = null;
    let min = ver + 0.001;
    for (let i = 0; i < anderen.length; i++) {
      const a = anderen[i];
      if (a.dood || a.klimt || (a === k.negeer && stapNr < k.negeerTot)) continue;
      if (!kanRaken(e, k, a)) continue;
      const d = Math.hypot(a.x - e.x, a.y - e.y);
      if (d >= min) continue;
      if (d > bereik && !kanBij(e, a)) continue;   // hij kan er niet bij en niet op schieten
      min = d;
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
  function jaag(e, k) {
    const doel = k.doelwit;
    const dv = vakVan(doel);
    if (e.pad && k.doelVak === dv) return;   // hij is al op weg naar waar het doelwit staat
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
    if (Math.hypot(doel.x - e.x, doel.y - e.y) > bereikVan(e, k)) {
      zetHouding(e, null);   // nog onderweg
      return;
    }
    if (e.pad && !k.schuif && !e.ronde) stopBijVolgende(e);
    kijkNaar(e, doel.x, doel.y);
    zetHouding(e, houdingVan(k.def));
    k.rust = 0;
    if (k.afkoel > 0) return;
    slaToe(e, k);
    let schade = k.def.schade;
    if (isSchutter(k)) {
      pijl(e.x, e.y, 20 + (e.hoogte || 0), doel.x, doel.y, 16 + (doel.hoogte || 0));
      // Wie op de muur staat, heeft dekking van de kantelen.
      if (doel.opMuur) schade = Math.max(1, Math.round(schade * R.muurDekking));
      schade = Math.max(1, Math.round(schade * dekkingVan(doel)));
    }
    raak(doel, schade, e);
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
    if (k.def.bereik > 2) pijl(e.x, e.y, 20, b.x, b.y, b.burcht ? 44 : 24, !!k.def.alleenBouw);
    raakBouw(b, k.def.schadeBouw);
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
    if (!pad && e.team === SPELER && !k.def.alleenBouw && wegvinder.aantalOpgangen(SPELER) > 0) {
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
      const sta = plekRond(e, vak, 1);
      const pad = sta < 0 ? null : zoekPad(e, sta);
      if (!pad) {
        k.ladder = -1;
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
    if (k.def.vast) opMelding(e.team === SPELER ? 'De belegeringstoren staat tegen de muur van rood. Kies soldaten en tik die muur aan: dan klimmen ze erop.' : 'Rood zet een belegeringstoren tegen je muur! Zet soldaten op dat stuk muur: het duurt lang voor ze hem omduwen.');
    else if (e.team === SPELER) opMelding('De ladder staat tegen de muur van rood. Kies soldaten en tik die muur aan: dan klimmen ze erop.');
    else opMelding('Rood zet een ladder tegen je muur! Zet soldaten op dat stuk muur: zij duwen hem om.');
    opVerandering();
  }

  function haalLadderWeg(vak, team) {
    wegvinder.zetLadder(vak, team, false);
    ladderKant.delete(vak);
    vasteLadders.delete(vak);
    opKaart(new Set([vak]));
    leger.kaartVeranderd();
    kaartVeranderd();
    opVerandering();
  }

  function zetLadder(vak, team, kant, vast = false) {
    wegvinder.zetLadder(vak, team, true);
    ladderKant.set(vak, kant);
    if (vast) vasteLadders.add(vak);
    else vasteLadders.delete(vak);
    opKaart(new Set([vak]));
    leger.kaartVeranderd();
  }

  // Deze ladderdragers zetten een ladder tegen de muur van rood op dat vak.
  // Geeft terug hoeveel er gaan.
  function zetLadderBevel(lijst, vak) {
    if (!isMuurVan(vak, VIJAND) || wegvinder.isLadder(vak, SPELER)) return 0;
    let aantal = 0;
    for (const e of lijst) {
      const k = krijgVan(e);
      if (!k.def.ladder || e.opMuur || e.klimt) continue;
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

  function naarBurcht(e, k) {
    if (k.bouw && staatNog(k.bouw) && (e.pad || bijBouw(e, k))) return;   // onderweg of bezig
    k.bouw = null;
    k.doelVak = -1;
    k.schuif = false;
    const hier = vakVan(e);
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
  function breekDoor(e, k, hier, plekken) {
    let pad = null;
    for (const vak of plekken) {
      if (!wegvinder.verbonden(hier, vak, BREEK)) continue;
      pad = zoekPad(e, vak, BREEK);
      if (pad) break;
    }
    if (!pad) return;   // er is geen doorkomen aan: hij wacht
    let j = 0;
    while (j < pad.length && vrijVoor(pad[j], VIJAND)) j++;
    if (j >= pad.length) {
      // De weg is vrij, maar naast de burcht is geen plek meer: wacht vlakbij.
      k.bouw = burchtDoel;
      const wacht = plekRond(e, thuisVak, 3);
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

  // --- Eén krijger, één rekenstap -----------------------------------------------------------
  function denk(e, k, anderen) {
    k.doelwit = kiesDoelwit(e, k, anderen);
    if (k.doelwit) {
      k.bouw = null;
      if (Math.hypot(k.doelwit.x - e.x, k.doelwit.y - e.y) > bereikVan(e, k)) {
        if (e.opMuur) k.doelwit = null;   // van de muur af gaat hij er niet achteraan
        else jaag(e, k);
      }
    } else if (e.team === VIJAND) {
      if (!e.opMuur || e.wachter === undefined) naarBurcht(e, k);
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
    // Soldaten van de speler komen na een gevecht langzaam weer op krachten.
    if (e.team === SPELER && e.leven < e.levenMax && k.rust > herstelNa && stapNr % herstelElke === 0) e.leven++;
    // Een soldaat die op jouw bevel ergens heen loopt, vecht onderweg niet.
    if (e.soldaat && e.soldaat.doel >= 0) {
      k.ladder = -1;
      k.doelwit = null;
      k.bevel = null;
      k.bouw = null;
      k.bouwBevel = null;
      zetHouding(e, null);
      return;
    }
    if (k.ladder >= 0) {
      ladderStap(e, k);
      return;
    }
    // Een soldaat van jou die op een stuk muur staat waar een ladder van
    // rood tegen staat, duwt die om (als hij niet hoeft te vechten).
    if (e.team === SPELER && e.opMuur && !e.pad && !e.klimt && !k.doelwit && wegvinder.isLadder(vakVan(e), VIJAND)) {
      zetHouding(e, 'sla');
      if (++k.duw >= stappen(vasteLadders.has(vakVan(e)) ? (R.omduwenVast || 10) : (R.omduwen || 3))) {
        k.duw = 0;
        haalLadderWeg(vakVan(e), VIJAND);
        opMelding('Je soldaten hebben een ladder van rood omgeduwd.');
      }
    } else {
      k.duw = 0;
    }
    if (k.doelwit && k.doelwit.dood) k.doelwit = null;
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
    else zetHouding(e, null);
  }

  // De wacht op een burcht schiet op de dichtstbijzijnde tegenstander. Na
  // een tijd zonder aanval wordt de burcht langzaam hersteld.
  function burchtStap(b, doelen) {
    if (b.leven <= 0) return;
    b.rust++;
    if (b.afkoel > 0) {
      b.afkoel--;
    } else if (doelen.length) {
      let beste = null;
      let min = R.burchtBereik + 1.5;
      for (let i = 0; i < doelen.length; i++) {
        const a = doelen[i];
        if (a.dood || a.klimt) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < min) {
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
    e.lagen = true;   // via een ladder kan hij jouw muur op
    e.levenMax = def.leven;
    e.leven = Number.isFinite(leven) ? klem(Math.round(leven), 1, def.leven) : def.leven;
    krijgVan(e, def);
    vijanden.push(e);
    return e;
  }

  // Een wachter van rood: een schutter die op zijn muur heen en weer loopt.
  function maakWachter(nummer, leven) {
    const route = routes[nummer];
    if (!wachterSoort || !route || !route.length) return null;
    const ronde = nummer % 2 ? route.slice().reverse() : route.slice();
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
  const aanvallers = () => vijanden.filter((e) => e.wachter === undefined);
  function aantalAanvallers() {
    let n = 0;
    for (let i = 0; i < vijanden.length; i++) if (vijanden[i].wachter === undefined) n++;
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
  function stuurLeger(inhoud, telAls = true) {
    const bezet = new Set(vijanden.map(vakVan));
    let aantal = 0;
    for (const [sleutel, hoeveel] of Object.entries(inhoud)) {
      if (!soorten[sleutel]) continue;
      for (let i = 0; i < hoeveel && vijanden.length < MAX_VIJANDEN; i++) {
        let vak = -1;
        for (let poging = 0; poging < 6; poging++) {
          vak = wegvinder.willekeurigVak(toeval, kaart.start[VIJAND], 8, VIJAND);
          if (vak >= 0 && !bezet.has(vak)) break;
        }
        if (vak < 0) continue;
        bezet.add(vak);
        maakVijand(sleutel, vak);
        aantal++;
      }
    }
    if (telAls) {
      golf++;
      burchtGemeld = false;
      if (!heer) opMelding(`Aanval ${golf}! ${aantal} ${aantal === 1 ? 'vijand komt' : 'vijanden komen'} van de rode burcht op je af.`);
    }
    opVerandering();
    opStand();
    return aantal;
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
    if (!stil && !vrede && golven.length) {
      if (heer) {
        if (rood.leven > 0) heer.stap();
      } else if (--klok <= 0) {
        stuurGolf();
      }
    }
    const eigen = leger.lijst;
    for (let i = 0; i < vijanden.length; i++) krijgerStap(vijanden[i], eigen);
    for (let i = 0; i < eigen.length; i++) krijgerStap(eigen[i], vijanden);
    burchtStap(burcht, vijanden);
    burchtStap(rood, eigen);
    ruimOp();
    if (burcht.leven <= 0) {
      einde('verloren');
      return;
    }
    if (!vrede && rood.leven <= 0) {
      // De rode heer is verslagen: zijn mannen geven het op.
      for (const e of vijanden) e.dood = true;
      ruimOp();
      einde('gewonnen');
      return;
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
  const isVanRood = (vak) => vak >= 0 && vak < B * H && kaart.eigenaar[vak] === ROOD && (!inBurcht(vak, rood) || rood.leven > 0);

  // Deze soldaten vallen het bouwwerk van rood op dat vak aan: zijn muur,
  // zijn poort of zijn burcht. Geeft terug hoeveel er gaan.
  function valBouwAan(lijst, vak) {
    if (!isVanRood(vak)) return 0;
    const doel = inBurcht(vak, rood) ? rood.doel : bouwDoel(vak);
    let aantal = 0;
    for (const e of lijst) {
      const k = krijgVan(e);
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
    }
    return aantal;
  }

  // Deze soldaten vallen die vijand aan. Geeft terug hoeveel er gaan.
  function valAan(lijst, doel) {
    if (!doel || doel.dood) return 0;
    for (const e of lijst) {
      const k = krijgVan(e);
      if (vreedzaam(k)) continue;
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
    const max = maxLeven(kaart.object[vak]);
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
    schade: [...schade].map(([vak, s]) => [vak, Math.max(1, Math.round(s.leven))]),
    vijanden: aanvallers().map((e) => [e.vijand, Math.floor(e.x), Math.floor(e.y), Math.max(1, Math.round(e.leven))]),
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
        const max = maxLeven(kaart.object[vak]);
        if (!Number.isFinite(leven) || leven <= 0 || leven >= max) continue;
        schade.set(vak, { leven: Math.round(leven), soort: kaart.object[vak], van: kaart.eigenaar[vak] });
      }
    }
    if (Array.isArray(s.vijanden)) {
      for (const regel of s.vijanden) {
        if (vijanden.length >= MAX_VIJANDEN) break;
        if (!Array.isArray(regel)) continue;
        const [sleutel, x, y, leven] = regel;
        if (!Object.prototype.hasOwnProperty.call(soorten, sleutel)) continue;
        if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= B || y >= H) continue;
        const vak = vrijBij(y * B + x);
        if (vak >= 0) maakVijand(sleutel, vak, leven);
      }
    }
    balkenBij();
    opStand();
    if (burcht.leven <= 0) einde('verloren');
    else if (rood.leven <= 0 && !vrede) einde('gewonnen');
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
    for (const e of vijanden) eenheden.verwijder(e);
    vijanden.length = 0;
    effecten.length = 0;
    schade.clear();
    golf = 0;
    klok = stappen(R.eersteGolf);
    if (heer) heer.herstel();
    for (const b of burchten) {
      b.leven = b.max;
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
    stap, stand, effecten, balken, kaartVeranderd,
    vindVijand, valAan, valBouwAan, isVanRood, levenOp, gaVerder,
    zetLadderBevel, ladders,
    zetLadderVoor: (vak, team, dx = 1, dy = 0, vast = false) => zetLadder(vak, team, [dx, dy], vast),
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
    rood: () => ({ leven: rood.leven, max: rood.max, x: rood.vx, y: rood.vy, plekken: rood.plekken.slice(), weg: [...roodWeg] }),
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
    roodWeg: () => [...roodWeg].filter((vak) => !inBurcht(vak, rood)),
    origineelVan: (vak) => roodOrigineel.get(vak),
    // Rood zet een stuk van zijn kasteel terug. Lukt niet als er iets staat.
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
    zetBurcht(leven) {
      burcht.leven = klem(leven, 0, burcht.max);
      balkenBij();
      opStand();
    },
    burcht: () => ({ leven: burcht.leven, max: burcht.max, x: thuis.x, y: thuis.y }),
    stappen: () => stapNr,
    schadeOp: (vak) => (schade.has(vak) ? schade.get(vak).leven : null),
  };
}
