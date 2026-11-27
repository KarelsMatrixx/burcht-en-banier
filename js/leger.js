// LEGER: de soldaten van de speler.
//
// Je leidt soldaten op bij de kazerne: dat kost goud en een boer zonder
// werk. Daarna kies je ze met je vinger en stuur je ze ergens heen.
// Het vechten zelf staat in strijd.js. Wat een soldaat kost, hoe snel hij
// loopt en hoeveel hij kan hebben staat in data/economie.json onder soldaten.
//
// Soldaten kunnen de muur op: via een toren, een wachttoren of een poort,
// en dan over de muurstukken die eraan vastzitten. Waar een soldaat staat
// of heen gaat is een "knoop": het vak op de grond, of vak + N voor
// datzelfde vak boven op de muur.

import { CONFIG } from './config.js';
import { SOORT } from './eenheden.js';
import { OBJECT } from './kaart.js';
import { HOOG } from './wegvinden.js';
import { SPELER as EIGENAAR_SPELER } from './bouwen.js';

const TEAM = 0;   // de speler

// opVerandering(): tijd om te bewaren. opLeger(): het leger of de keuze is
// veranderd, de knoppen in beeld moeten mee.
export function maakLeger({ regels, kaart, wegvinder, eenheden, economie, opVerandering, opLeger }) {
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const N = B * H;
  const HB = CONFIG.tegel.breedte / 2;
  const HH = CONFIG.tegel.hoogte / 2;
  const stappenPerSeconde = CONFIG.spel.stappenPerSeconde;
  const soorten = regels.soldaten;
  const maxLevel = regels.legerMax;                 // harde bovengrens van dit level
  const perKazerne = regels.legerPerKazerne || 0;   // 0: geen kazerneregel (de proloog)
  // Hoeveel soldaten er boven op een toren en een wachttoren passen (data/economie.json torenPlekken).
  const TORENPLEKKEN = {
    [OBJECT.TOREN]: Math.max(1, Math.round((regels.torenPlekken || {}).toren || 2)),
    [OBJECT.WACHTTOREN]: Math.max(1, Math.round((regels.torenPlekken || {}).wachttoren || 2)),
    [OBJECT.MOORDGATENTOREN]: Math.max(1, Math.round((regels.torenPlekken || {}).moordgatentoren || (regels.torenPlekken || {}).wachttoren || 2)),
  };
  const soldaten = [];

  for (const [sleutel, def] of Object.entries(soorten)) {
    def.sleutel = sleutel;
    if (SOORT[def.soort] === undefined) throw new Error(`economie.json: onbekende soort "${def.soort}" bij soldaat ${sleutel}`);
  }

  const vakVan = (e) => Math.floor(e.y) * B + Math.floor(e.x);
  const knoopVan = (e) => vakVan(e) + (e.opMuur ? N : 0);
  const isVrij = (vak) => vak >= 0 && vak < N && wegvinder.isVrij(vak % B, Math.floor(vak / B), TEAM);
  const isMuur = (vak) => vak >= 0 && vak < N && wegvinder.isMuur(vak % B, Math.floor(vak / B), TEAM);
  // Kan een soldaat op deze knoop staan?
  const kanStaan = (knoop) => (knoop >= N ? isMuur(knoop - N) : isVrij(knoop));

  // De vakken rond een vak, van dichtbij naar ver (het vak zelf eerst).
  function* rond(vak, ver) {
    const x = vak % B;
    const y = Math.floor(vak / B);
    yield vak;
    for (let r = 1; r <= ver; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (x + dx < 0 || y + dy < 0 || x + dx >= B || y + dy >= H) continue;
          yield (y + dy) * B + x + dx;
        }
      }
    }
  }

  // Staat op deze knoop een soldaat, of is er een naar onderweg? (behalve wie in "zonder" zit)
  // Op de grond past er een per tegel. Boven op een toren (Watchtower: 7) of wachttoren
  // (Tower: 3) passen er meer, en op het hoofdkasteel (de burcht) samen hooguit vijf, een per tegel.
  const KASTEEL_PLEKKEN = 5;
  const kapaciteit = (knoop) => {
    if (knoop < N) return 1;
    const o = kaart.object[knoop - N];
    return TORENPLEKKEN[o] || 1;
  };
  const isKasteelKnoop = (knoop) => knoop >= N && kaart.object[knoop - N] === OBJECT.BURCHT;
  // Welk hoofdkasteel (0: jouw kasteel, 1: dat van rood) is dit? De vijf plekken gelden per kasteel.
  const kasteelVan = (knoop) => {
    const vak = knoop - N;
    const x = vak % B;
    const y = (vak - x) / B;
    const st = kaart.start;
    return Math.max(Math.abs(x - st[1].x), Math.abs(y - st[1].y)) <= 1 ? 1 : 0;
  };
  const telOp = (knoop, zonder, plan = []) => {
    let n = 0;
    for (const k of plan) if (k === knoop) n++;
    for (const e of soldaten) if (!(zonder && zonder.includes(e)) && (knoopVan(e) === knoop || e.soldaat.doel === knoop)) n++;
    return n;
  };
  // Is deze knoop vol? plan: knopen die al voor anderen zijn uitgekozen.
  function bezet(knoop, zonder, plan = []) {
    if (telOp(knoop, zonder, plan) >= kapaciteit(knoop)) return true;
    if (isKasteelKnoop(knoop)) {
      const kasteel = kasteelVan(knoop);
      const zelfde = (k) => isKasteelKnoop(k) && kasteelVan(k) === kasteel;
      let n = plan.filter(zelfde).length;
      for (const e of soldaten) if (!(zonder && zonder.includes(e)) && (zelfde(knoopVan(e)) || zelfde(e.soldaat.doel))) n++;
      if (n >= KASTEEL_PLEKKEN) return true;
    }
    return false;
  }

  // Het dichtstbijzijnde vak waar een soldaat kan staan, of -1.
  function plekBij(vak, ver, zonder) {
    for (const kandidaat of rond(vak, ver)) {
      if (isVrij(kandidaat) && !bezet(kandidaat, zonder)) return kandidaat;
    }
    return -1;
  }

  function maak(sleutel, vak, leven, opMuur = false) {
    const def = soorten[sleutel];
    const e = eenheden.maakWerker(vak, TEAM, SOORT[def.soort], def.snelheid);
    e.soldaat = { sleutel, doel: -1, wacht: 0, pogingen: 0 };
    e.gekozen = false;
    e.lagen = !def.nietKlimmen;
    e.opMuur = opMuur;
    if (opMuur) e.hoogte = eenheden.hoogteOp(vak);
    e.levenMax = def.leven;
    e.leven = Number.isFinite(leven) ? Math.max(1, Math.min(def.leven, Math.round(leven))) : def.leven;
    soldaten.push(e);
    return e;
  }

  // Een geschenk: een soldaat die erbij komt zonder dat je hem opleidt (level 4: het Stille Volk).
  // Hij telt wel mee in je leger, maar de grens houdt hem niet tegen: die geldt alleen voor wie je zelf opleidt.
  function geef(sleutel, vak, ver = 14) {
    if (!soorten[sleutel] || soorten[sleutel].koning) return null;
    const plek = plekBij(vak, ver);
    if (plek < 0) return null;
    const e = maak(sleutel, plek);
    opVerandering();
    opLeger();
    return e;
  }

  // De koning: er is er altijd één, bij de burcht. Hij wordt niet opgeleid.
  let koningThuis = -1;
  function zetKoning(burchtVak) {
    koningThuis = burchtVak;
    const sleutel = Object.keys(soorten).find((s) => soorten[s].koning);
    if (!sleutel || soldaten.some((e) => e.soldaat.sleutel === sleutel)) return null;
    const vak = plekBij(burchtVak, 6);
    if (vak < 0) return null;
    const e = maak(sleutel, vak);
    opLeger();
    return e;
  }

  // --- Opleiden ---------------------------------------------------------------------
  // Een steenwachter neemt twee plekken in het leger in, de rest een.
  function plekken() {
    let n = 0;
    for (const e of soldaten) n += (soorten[e.soldaat.sleutel].legerPlekken || 1);
    return n;
  }

  // Hoeveel kazernes (en magiertorens en belegeringswerkplaatsen) heeft de speler? Elk geeft plek aan perKazerne soldaten.
  function aantalKazernes() {
    let n = 0;
    for (let i = 0; i < N; i++) {
      if (kaart.eigenaar[i] !== EIGENAAR_SPELER) continue;
      const o = kaart.object[i];
      if (o === OBJECT.KAZERNE || o === OBJECT.MAGIERTOREN || o === OBJECT.BELEGERINGSWERKPLAATS) n++;
    }
    return n;
  }

  // Hoeveel stallen heeft de speler?
  function aantalStallen() {
    let n = 0;
    for (let i = 0; i < N; i++) if (kaart.eigenaar[i] === EIGENAAR_SPELER && kaart.object[i] === OBJECT.STAL) n++;
    return n;
  }

  // Hoeveel plekken heeft je leger nu? Per kazerne perKazerne, nooit meer dan de grens van het level.
  function legerMax() {
    return perKazerne ? Math.min(maxLevel, perKazerne * aantalKazernes()) : maxLevel;
  }

  // Lege tekst als je deze soldaat kunt opleiden, anders de reden.
  function waaromNiet(sleutel) {
    const def = soorten[sleutel];
    if (!def) return 'that soldier does not exist';
    if (def.koning) return 'there is only one king';
    // Een ruiter heeft een stal met een paardenboer nodig: perStal paarden per stal.
    if (def.perStal) {
      const stallen = aantalStallen();
      if (!stallen) return 'you need a stable first';
      const boeren = economie.aantalMetBeroep('paardenboer');
      if (!boeren) return 'your stable has no horse keeper yet; one comes as soon as a peasant is free';
      const levend = soldaten.filter((e) => e.soldaat.sleutel === sleutel).length;
      if (levend >= def.perStal * Math.min(stallen, boeren)) return `every stable place is taken (${def.perStal} horses per stable): build another stable`;
    }
    const grens = legerMax();
    if (plekken() + (def.legerPlekken || 1) > grens) {
      // Staat de grens lager dan die van het level, dan helpt een kazerne erbij.
      return perKazerne && grens < maxLevel
        ? `your army is full (${grens} places). Each barracks holds ${perKazerne}: build another barracks`
        : `your army is full (${grens} places)`;
    }
    const tekort = economie.tekort(def.kosten);
    if (tekort) return tekort;
    const boeren = def.boeren || 1;
    if (economie.bevolking().vrij < boeren) return boeren > 1 ? `he costs ${boeren} idle peasants` : 'there is no idle peasant';
    return '';
  }

  // Leidt een soldaat op bij de kazerne op dit vak. Geeft een lege tekst
  // terug als het gelukt is, anders de reden.
  function leidOp(sleutel, kazerneVak) {
    const reden = waaromNiet(sleutel);
    if (reden) return reden;
    let vak = -1;
    if (soorten[sleutel].hoog) {
      // Te hoog voor een poort: hij moet buiten de muren kunnen staan, anders zit hij vast.
      for (const kandidaat of rond(kazerneVak, 6)) {
        if (isVrij(kandidaat) && !bezet(kandidaat) && wegvinder.inHetVeld(kandidaat, HOOG + TEAM)) { vak = kandidaat; break; }
      }
      if (vak < 0) return 'a siege tower is taller than the gate: build the siege workshop outside your walls';
    } else {
      vak = plekBij(kazerneVak, 4);
    }
    if (vak < 0) return 'there is no room next to this building';
    economie.betaal(soorten[sleutel].kosten);
    for (let i = soorten[sleutel].boeren || 1; i > 0; i--) economie.boerWeg();
    maak(sleutel, vak);
    opVerandering();
    opLeger();
    return '';
  }

  // --- Kiezen -----------------------------------------------------------------------
  const gekozen = () => soldaten.filter((e) => e.gekozen);

  // De ingeboxte groep: na een kader werken Melee, Ranged, Siege en de soorten
  // alleen binnen deze soldaten. Wissen met Alle, Geen of een nieuwe keuze.
  let deelset = null;
  const deel = () => {
    if (!deelset) return null;
    const d = soldaten.filter((e) => deelset.has(e));
    if (!d.length) deelset = null;
    return d.length ? d : null;
  };
  // Kiest de soldaten uit een kader en onthoudt ze als groep (vanaf twee).
  function kiesKader(lijst) {
    deelset = lijst.length > 1 ? new Set(lijst) : null;   // eerst onthouden, dan pas kiezen (kies meldt de knoppen)
    kies(lijst, false, true);
  }

  // Kiest deze soldaten. erbij = wat al gekozen was blijft gekozen.
  // bewaarDeel = de ingeboxte groep (deelset) blijft bestaan; anders wordt hij gewist.
  let kiesFilter = null;   // proloog: wie de speler nu mag kiezen (zetKiesFilter)
  function kies(lijst, erbij = false, bewaarDeel = false) {
    if (!bewaarDeel) deelset = null;
    if (!erbij) for (const e of soldaten) e.gekozen = false;
    for (const e of lijst) if (e.karelWacht === undefined && !e.vastePost && (!kiesFilter || kiesFilter(e))) e.gekozen = true;   // de lijfwacht van Karel (proloog) bestuur je niet
    opLeger();
  }

  // Soldaten in drie groepen: wie van dichtbij vecht, wie van verre schiet
  // en de belegeringsmachines (ram, katapult, toren, ladderdrager).
  // Steun (banierdrager, heler) staat bij Afstand: die blijven achter de linie.
  // Te hoog voor een poort (de belegeringstoren): hij kan er niet door.
  const isHoog = (e) => !!(soorten[e.soldaat.sleutel] && soorten[e.soldaat.sleutel].hoog);
  const isBelegering = (sleutel) => !!(soorten[sleutel] && (soorten[sleutel].alleenBouw || soorten[sleutel].ladder));
  // Wat een ingenieur bouwt staat vast: een trebuchet of een ballista loopt niet.
  const staatVast = (sleutel) => !!(soorten[sleutel] && (soorten[sleutel].staand || soorten[sleutel].geschut));
  // Een ingenieur is een belegeringseenheid, maar hij mag wel de muur op (daar bouwt hij een ballista).
  const magOpMuur = (sleutel) => !isBelegering(sleutel) || !!(soorten[sleutel] && soorten[sleutel].bouwt);
  const groepVan = (def) => (def.alleenBouw || def.ladder ? 'belegering' : def.bereik > 2 || def.steun ? 'afstand' : 'melee');
  // De koning valt buiten de groepen en buiten Alle: die stuur je bewust, met zijn eigen knop of een tik.
  const isKoning = (e) => !!soorten[e.soldaat.sleutel].koning;
  const kiesGroep = (groep) => kies((deel() || soldaten).filter((e) => !isKoning(e) && groepVan(soorten[e.soldaat.sleutel]) === groep), false, true);
  const kiesSoort = (sleutel) => kies((deel() || soldaten).filter((e) => e.soldaat.sleutel === sleutel), false, true);
  // De hele ingeboxte groep opnieuw kiezen.
  const kiesDeel = () => { const d = deel(); if (d) kies(d, false, true); };
  // Hoeveel soldaten er zijn (en gekozen zijn) per groep en per soort.
  function telling() {
    const groepen = {};
    const perSoort = {};
    const d = deel();
    for (const e of d || soldaten) {
      const g = groepVan(soorten[e.soldaat.sleutel]);
      const t = isKoning(e) ? { n: 0, gekozen: 0 } : (groepen[g] = groepen[g] || { n: 0, gekozen: 0 });
      const u = (perSoort[e.soldaat.sleutel] = perSoort[e.soldaat.sleutel] || { n: 0, gekozen: 0, groep: g });
      t.n++; u.n++;
      if (e.gekozen) { t.gekozen++; u.gekozen++; }
    }
    const gek = soldaten.filter((e) => e.gekozen && !staatVast(e.soldaat.sleutel) && !isKoning(e));
    return { groepen, perSoort, deel: d ? d.length : 0, deelGekozen: d ? d.filter((e) => e.gekozen).length : 0, houdbaar: gek.length, houdt: gek.filter((e) => e.houdt).length };
  }

  // De soldaat onder een punt in de wereld (in pixels), of null. marge
  // maakt het raakvlak groter, voor als je ver bent uitgezoomd.
  function vind(wx, wy, marge = 0) {
    let beste = null;
    let afstand = Infinity;
    for (const e of soldaten) {
      if (e.klimt) continue;   // op de trap: niet te zien, dus niet aan te tikken
      const dx = Math.abs(wx - (e.x - e.y) * HB);
      const dy = wy - ((e.x + e.y) * HH - 16 - e.hoogte);   // ten opzichte van het midden van het lijf
      if (dx > 12 + marge || dy < -22 - marge || dy > 20 + marge) continue;
      if (dx + Math.abs(dy) < afstand) {
        afstand = dx + Math.abs(dy);
        beste = e;
      }
    }
    return beste;
  }

  // --- Lopen ------------------------------------------------------------------------
  function loopNaar(e, naar) {
    let van = knoopVan(e);
    let eerst = -1;
    // Is hij op de trap, dan maakt hij die eerst af en gaat vandaar verder.
    if (e.klimt && e.pad && e.stap < e.pad.length) {
      eerst = e.pad[e.stap];
      van = eerst;
    }
    // Kan het gewoon over de grond, dan loopt hij over de grond. Anders
    // zoeken we ook over de muur (een toren of een ladder is ook een
    // doorgang). Een stormram blijft altijd op de grond.
    const beeld = isHoog(e) ? HOOG + TEAM : TEAM;   // een hoge toren ziet alle poorten als dicht
    const grond = van < N && naar < N && wegvinder.verbonden(van, naar, beeld);
    // Belegeringstroepen (ram, katapult, ladder, toren) blijven op de grond: nooit een muur, toren of kasteel op.
    if (!grond && !magOpMuur(e.soldaat.sleutel)) return false;
    const pad = grond
      ? wegvinder.zoekPad(van % B, Math.floor(van / B), naar % B, Math.floor(naar / B), beeld)
      : wegvinder.zoekPadLagen(van, naar, beeld);
    if (!pad) return false;
    e.pad = eerst >= 0 ? [eerst, ...pad] : pad;
    e.stap = 0;
    e.soldaat.doel = naar;
    e.soldaat.wacht = 0;
    e.soldaat.pogingen = 0;
    return true;
  }

  // Het stuk muur waar dit vak bij hoort: alle vakken die eraan vastzitten,
  // van dichtbij naar ver, en of er een trap in zit.
  function muurstuk(doel) {
    const vakken = [doel];
    const gezien = new Set(vakken);
    let trap = false;
    for (let i = 0; i < vakken.length && vakken.length < 600; i++) {
      const x = vakken[i] % B;
      const y = Math.floor(vakken[i] / B);
      if (wegvinder.isOpgang(x, y, TEAM)) trap = true;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const buur = (y + dy) * B + x + dx;
        if (x + dx < 0 || y + dy < 0 || x + dx >= B || y + dy >= H || gezien.has(buur) || !isMuur(buur)) continue;
        gezien.add(buur);
        vakken.push(buur);
      }
    }
    return { vakken, trap };
  }

  // Stuurt de gekozen soldaten naar een tegel. Ze verdelen zich over de
  // vrije tegels eromheen. opMuur = true: de muur op, over het stuk muur
  // waar die tegel bij hoort. Geeft terug hoeveel er op weg zijn gegaan.
  // --- Formaties (0.121.0) -------------------------------------------------------------
  // Naar Karel (25 nov): meer greep op je soldaten. Een bevel op de grond legt de gekozen groep
  // in een formatie: Free (zoals altijd: zo dicht mogelijk bij de tik), Line (een brede rij),
  // Block (een vierkant) of Wide (een vierkant met een tegel ruimte ertussen).
  // In Line en Block staat het voetvolk vooraan (aan de kant van de tik, gezien vanaf waar de
  // groep vandaan komt), de schutters erachter en de belegering achteraan.
  const FORMATIES = ['vrij', 'lijn', 'schild', 'blok', 'wijd'];
  let formatie = 'vrij';
  const rangVan = (e) => { const g = groepVan(soorten[e.soldaat.sleutel]); return g === 'melee' ? 0 : g === 'afstand' ? 1 : 2; };

  // De plekken van een formatie rond (x, y). Geeft [[soldaat, vak], ...] terug; wie geen plek
  // vindt, staat er niet in (die krijgt daarna een gewone plek).
  function formatiePlekken(groep, x, y) {
    const n = groep.length;
    // De richting: van het midden van de groep naar de tik. Staan ze er al bovenop, dan naar boven op het scherm.
    let mx = 0, my = 0;
    for (const e of groep) { mx += e.x; my += e.y; }
    mx /= n; my /= n;
    let dx = x + 0.5 - mx, dy = y + 0.5 - my;
    const lengte = Math.hypot(dx, dy);
    if (lengte < 1.5) { dx = -Math.SQRT1_2; dy = -Math.SQRT1_2; } else { dx /= lengte; dy /= lengte; }
    const zx = -dy, zy = dx;   // zijwaarts
    const ruimte = formatie === 'wijd' ? 2 : 1;
    const breed = formatie === 'lijn' || formatie === 'schild' ? Math.min(n, 16) : Math.ceil(Math.sqrt(n));
    // Op rang (voetvolk vooraan), dan per rij van links naar rechts zodat niemand kruist.
    const volgorde = groep.slice().sort((a, b) => rangVan(a) - rangVan(b) || ((a.x - mx) * dx + (a.y - my) * dy > (b.x - mx) * dx + (b.y - my) * dy ? -1 : 1));
    // De rijen: in Line krijgt elke rang zijn eigen rij (voetvolk, dan schutters, dan belegering),
    // in Block en Wide vullen ze het vierkant op volgorde van rang.
    const rijen = [];
    const inRijen = (deze) => { for (let i = 0; i < deze.length; i += breed) rijen.push(deze.slice(i, i + breed)); };
    if (formatie === 'lijn') {
      for (const rang of [0, 1, 2]) inRijen(volgorde.filter((e) => rangVan(e) === rang));
    } else if (formatie === 'schild') {
      // Shield (Karel, 27 nov): de helft van het voetvolk voor de schutters, de andere helft erachter
      const voet = volgorde.filter((e) => rangVan(e) === 0);
      const voor = Math.ceil(voet.length / 2);
      inRijen(voet.slice(0, voor));
      inRijen(volgorde.filter((e) => rangVan(e) === 1));
      inRijen(voet.slice(voor));
      inRijen(volgorde.filter((e) => rangVan(e) === 2));
    } else for (let i = 0; i < n; i += breed) rijen.push(volgorde.slice(i, i + breed));
    const plan = [];
    const uit = [];
    for (let r = 0; r < rijen.length; r++) {
      const rij = rijen[r];
      rij.sort((a, b) => ((a.x - mx) * zx + (a.y - my) * zy) - ((b.x - mx) * zx + (b.y - my) * zy));
      rij.forEach((e, k) => {
        const zij = (k - (rij.length - 1) / 2) * ruimte;
        const tx = Math.floor(x + 0.5 + zx * zij - dx * r * ruimte);
        const ty = Math.floor(y + 0.5 + zy * zij - dy * r * ruimte);
        if (tx < 0 || ty < 0 || tx >= B || ty >= H) return;
        // Is de plek bezet (een boom, een huis), dan een plek ernaast op dezelfde diepte, zodat de rijen heel blijven.
        const diep = (vx, vy) => (vx + 0.5 - x - 0.5) * dx + (vy + 0.5 - y - 0.5) * dy;
        const dz = -r * ruimte;
        let beste = -1, score = Infinity;
        for (const vak of rond(ty * B + tx, 2)) {
          if (!isVrij(vak) || bezet(vak, groep, plan)) continue;
          const vx = vak % B, vy = Math.floor(vak / B);
          const sc = Math.abs(diep(vx, vy) - dz) * 3 + Math.hypot(vx - tx, vy - ty);
          if (sc < score) { score = sc; beste = vak; }
        }
        if (beste >= 0) { plan.push(beste); uit.push([e, beste]); }
      });
    }
    return uit;
  }

  // Hold (0.121.0): wie vasthoudt, blijft op zijn plek en vecht alleen met wat dichtbij komt
  // (een schutter schiet wat binnen zijn bereik is). Een nieuw bevel op de grond verplaatst
  // de post; een aanval op een vijand heft Hold op. strijd.js karelWachtDenk doet het vechten.
  function zetHoud(aan, lijst = gekozen()) {
    let n = 0;
    for (const e of lijst) {
      if (staatVast(e.soldaat.sleutel) || isKoning(e)) continue;
      if (aan) {
        e.houdt = true;
        if (!e.opMuur) e.post = e.soldaat.doel >= 0 && e.soldaat.doel < N ? e.soldaat.doel : vakVan(e);
      } else { e.houdt = false; delete e.post; }
      n++;
    }
    opLeger();
    return n;
  }

  function stuur(x, y, opMuur = false) {
    // Een stormram kan de muur niet op.
    let groep = (opMuur ? gekozen().filter((e) => magOpMuur(e.soldaat.sleutel)) : gekozen()).filter((e) => !staatVast(e.soldaat.sleutel));   // een trebuchet of ballista staat vast
    if (!groep.length || x < 0 || y < 0 || x >= B || y >= H) return 0;
    for (const e of groep) delete e.post;   // een nieuw bevel: de vaste post (proloog, na Hold) vervalt; wie Hold heeft, krijgt hieronder een nieuwe
    const doel = y * B + x;
    // Een formatie op de grond (niet Free, minstens twee man)
    if (!opMuur && formatie !== 'vrij' && groep.length > 1) {
      const plan = formatiePlekken(groep, x, y);
      let opWeg = 0;
      const gedaan = new Set();
      for (const [e, vak] of plan) {
        if (loopNaar(e, vak)) { opWeg++; gedaan.add(e); if (e.houdt) e.post = vak; }
      }
      // Wie geen plek of geen weg vond: zo dicht mogelijk erbij, zoals altijd.
      const rest = groep.filter((e) => !gedaan.has(e));
      if (rest.length) {
        const vrij = [];
        for (const vak of rond(doel, 10)) {
          if (isVrij(vak) && !bezet(vak, groep, vrij)) vrij.push(vak);
          if (vrij.length >= rest.length * 2) break;
        }
        for (const e of rest) {
          for (let i = 0; i < vrij.length; i++) {
            if (loopNaar(e, vrij[i])) { opWeg++; if (e.houdt) e.post = vrij[i]; vrij.splice(i, 1); break; }
          }
        }
      }
      return opWeg;
    }
    const plekken = [];
    if (opMuur) {
      if (!isMuur(doel)) return 0;
      const stuk = muurstuk(doel);
      // Zonder open poort kom je er niet op, maar wie al op de muur staat, loopt er gewoon overheen.
      if (!stuk.trap) {
        groep = groep.filter((e) => e.opMuur);
        if (!groep.length) return 0;
      }
      for (const vak of stuk.vakken) {
        // Op een toren passen er twee: dan staat dezelfde knoop twee keer in de lijst.
        while (plekken.length < groep.length && !bezet(N + vak, groep, plekken)) plekken.push(N + vak);
        if (plekken.length >= groep.length) break;
      }
    } else {
      for (const vak of rond(doel, 8)) {
        if (isVrij(vak) && !bezet(vak, groep)) plekken.push(vak);
        if (plekken.length >= groep.length) break;
      }
    }
    // Wie het dichtst bij het doel staat, krijgt de plek die er het dichtst bij ligt.
    const ver = (e) => Math.hypot(e.x - x - 0.5, e.y - y - 0.5);
    groep.sort((a, b) => ver(a) - ver(b));
    let opWeg = 0;
    for (let i = 0; i < groep.length && i < plekken.length; i++) {
      if (loopNaar(groep[i], plekken[i])) { opWeg++; if (groep[i].houdt && plekken[i] < N) groep[i].post = plekken[i]; }
    }
    return opWeg;
  }

  // Staan er twee soldaten op een toren, dan staan ze naast elkaar in plaats van op
  // dezelfde plek. Staat er nog maar een, dan staat hij weer in het midden.
  function schikOpTorens() {
    const perKnoop = new Map();
    for (const e of soldaten) {
      if (!e.opMuur || e.pad || e.klimt) continue;
      const knoop = knoopVan(e);
      if (kapaciteit(knoop) < 2) continue;
      if (!perKnoop.has(knoop)) perKnoop.set(knoop, []);
      perKnoop.get(knoop).push(e);
    }
    for (const lijst of perKnoop.values()) {
      lijst.forEach((e, i) => {
        const vak = vakVan(e);
        const mx = (vak % B) + 0.5;
        const my = Math.floor(vak / B) + 0.5;
        // Eén in het midden, twee naast elkaar, meer in een kring (bij zeven: een in het midden en zes eromheen).
        const n = lijst.length;
        let dx = 0;
        let dy = 0;
        if (n === 2) {
          dx = i === 0 ? 0.22 : -0.22;
          dy = -dx;
        } else if (n > 2) {
          const kring = n >= 7 ? n - 1 : n;
          const j = n >= 7 ? i - 1 : i;
          if (j >= 0) {
            const hoek = (j / kring) * Math.PI * 2 + Math.PI / 4;
            dx = Math.cos(hoek) * 0.3;
            dy = Math.sin(hoek) * 0.3;
          }
        }
        const tx = mx + dx;
        const ty = my + dy;
        if (Math.abs(e.x - tx) > 0.005 || Math.abs(e.y - ty) > 0.005) {
          e.x += (tx - e.x) * 0.25;
          e.y += (ty - e.y) * 0.25;
        }
      });
    }
  }

  // Paarden op het erf: bij elke stal met een paardenboer staat een paard voor elke
  // vrije stalplek (perStal per stal, min de ruiters die er al zijn). Ze zijn alleen
  // decor, worden niet bewaard en komen vanzelf terug als een ruiter sneuvelt.
  const erf = [];
  function paardenOpErf() {
    const def = Object.values(soorten).find((d) => d.perStal);
    if (!def) return;
    const keepers = economie.werkers().filter((e) => e.werk.beroep.sleutel === 'paardenboer');
    const stallen = keepers.length ? aantalStallen() : 0;
    const levend = soldaten.filter((e) => e.soldaat.sleutel === def.sleutel).length;
    const doel = Math.max(0, def.perStal * Math.min(stallen, keepers.length) - levend);
    // Wie niet meer past of waar nu iets staat, gaat weg.
    for (let k = erf.length - 1; k >= 0; k--) {
      const p = erf[k];
      const vak = Math.floor(p.y) * B + Math.floor(p.x);
      if (k >= doel || !keepers.some((e) => Math.abs(e.werk.plaats % B - Math.floor(p.x)) <= 4 && Math.abs(Math.floor(e.werk.plaats / B) - Math.floor(p.y)) <= 4) || !wegvinder.isVrij(vak % B, Math.floor(vak / B), 0)) {
        eenheden.verwijder(p);
        erf.splice(k, 1);
      }
    }
    if (erf.length >= doel) return;
    // Eén paard erbij per stap: een vrij vak vlak bij een stal.
    const st = keepers[erf.length % keepers.length].werk.plaats;
    const sx = st % B;
    const sy = Math.floor(st / B);
    for (let r = 1; r <= 3; r++) {
      for (let dy = r; dy >= -r; dy--) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = sx + dx;
          const y = sy + dy;
          if (x < 0 || y < 0 || x >= B || y >= H || !wegvinder.isVrij(x, y, 0)) continue;
          if (erf.some((p) => Math.floor(p.x) === x && Math.floor(p.y) === y)) continue;
          if (eenheden.lijst.some((o) => o !== null && o.zelf && !o.paard && Math.floor(o.x) === x && Math.floor(o.y) === y)) continue;
          const p = eenheden.maakWerker(y * B + x, 0, SOORT.PAARD, 0);
          p.paard = true;
          p.kijkt = (x + y) % 2 ? 1 : -1;
          erf.push(p);
          return;
        }
      }
    }
  }

  // Eén rekenstap: wie zijn route kwijt is (er is gebouwd), zoekt een nieuwe.
  function stap() {
    paardenOpErf();
    schikOpTorens();
    for (const e of soldaten) {
      const s = e.soldaat;
      if (e.pad || s.doel < 0) continue;
      if (knoopVan(e) === s.doel) {
        s.doel = -1;
        continue;
      }
      if (s.wacht > 0) {
        s.wacht--;
        continue;
      }
      // Kan hij er niet meer staan, dan zoekt hij op de grond een plek ernaast.
      const naar = kanStaan(s.doel) ? s.doel : plekBij(s.doel >= N ? s.doel - N : s.doel, 3, [e]);
      const pogingen = s.pogingen + 1;
      if (naar < 0 || !loopNaar(e, naar)) {
        s.pogingen = pogingen;
        s.wacht = stappenPerSeconde;
        if (pogingen >= 5) s.doel = -1;   // het lukt niet: hij blijft staan
      }
    }
  }

  // --- Bewaren en terugzetten ---------------------------------------------------------
  // Per soldaat: wie het is, waar hij staat en hoeveel leven hij nog heeft.
  // Staat hij op de muur, dan komt er een 1 achter.
  const bewaarStand = () => soldaten.map((e) => {
    const regel = [e.soldaat.sleutel, Math.floor(e.x), Math.floor(e.y), Math.max(1, Math.round(e.leven))];
    if (e.opMuur || e.houdt) regel.push(e.opMuur ? 1 : 0);
    if (e.houdt) regel.push(1);   // Hold (0.121.0): hij houdt zijn plek
    return regel;
  });

  // Zet bewaarde soldaten terug. Wat niet klopt wordt overgeslagen.
  function zetStand(lijst) {
    if (!Array.isArray(lijst)) return 0;
    let aantal = 0;
    for (const regel of lijst) {
      if (!Array.isArray(regel)) continue;
      const [sleutel, x, y, leven, boven, houdt] = regel;
      if (!Object.prototype.hasOwnProperty.call(soorten, sleutel)) continue;
      if (plekken() + (soorten[sleutel].legerPlekken || 1) > maxLevel) break;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= B || y >= H) continue;
      // Stond hij op de muur en staat die er nog, dan staat hij er weer op.
      if (boven === 1 && isMuur(y * B + x) && !bezet(N + y * B + x)) {
        const e = maak(sleutel, y * B + x, leven, true);
        if (houdt === 1) e.houdt = true;
        aantal++;
        continue;
      }
      const vak = plekBij(y * B + x, 6);
      if (vak < 0) continue;
      const e = maak(sleutel, vak, leven);
      if (houdt === 1) { e.houdt = true; e.post = vak; }
      aantal++;
    }
    if (aantal) opLeger();
    return aantal;
  }

  function herstel() {
    for (const e of soldaten) eenheden.verwijder(e);
    soldaten.length = 0;
    if (koningThuis >= 0) zetKoning(koningThuis);   // de koning staat weer bij de burcht
    opLeger();
  }

  // Er is gebouwd of gesloopt. Wie op een muur stond die weg is, staat
  // weer op de grond; werd de muur een poort, dan staat hij op de poort.
  function kaartVeranderd() {
    for (const e of soldaten) {
      if (!e.opMuur) continue;
      const vak = vakVan(e);
      if (isMuur(vak)) {
        if (!e.pad) e.hoogte = eenheden.hoogteOp(vak);
        continue;
      }
      e.opMuur = false;
      e.klimt = false;
      e.hoogte = 0;
      e.pad = null;
      e.soldaat.doel = -1;
    }
  }

  // Een soldaat is gesneuveld: hij verdwijnt van de kaart en uit je leger.
  function sneuvel(e) {
    const plek = soldaten.indexOf(e);
    if (plek < 0) return;
    soldaten.splice(plek, 1);
    eenheden.verwijder(e);
    opVerandering();
    opLeger();
  }

  return {
    gekozenHoog: () => gekozen().some(isHoog),
    soorten, get max() { return legerMax(); }, waaromNiet, leidOp, vind, kies, stuur, stap,
    kiesAlles: () => kies(soldaten.filter((e) => !isKoning(e))),
    zetKoning, geef,
    // Een soldaat of machine op een exact vak neerzetten (de ingenieur bouwt zo een trebuchet).
    zetOp: (sleutel, vak, opMuur = false) => { const e = maak(sleutel, vak, undefined, opMuur); opVerandering(); opLeger(); return e; },
    // Een ingenieur naar een stuk muur of toren sturen (om daar een ballista te bouwen). Geeft true als hij onderweg is.
    naarMuur: (e, vak) => {
      if (!isMuur(vak) || !(e.opMuur || muurstuk(vak).trap) || !loopNaar(e, N + vak)) return false;
      e.soldaat.doel = -1;   // geen bevel van de speler: de ingenieur houdt zijn bouwklus (zie strijd.js, ingenieurDenk)
      return true;
    },
    staatVast,
    // Alleen onthouden waar de koning thuishoort, zonder hem neer te zetten (voor een bewaarde, al beslechte stand).
    zetKoningThuis: (burchtVak) => { koningThuis = burchtVak; },
    groepVan, kiesGroep, kiesSoort, kiesKader, kiesDeel, telling,
    kiesGeen: () => kies([]),
    // Formaties en Hold (0.121.0)
    formaties: FORMATIES,
    formatie: () => formatie,
    zetFormatie: (f) => { if (FORMATIES.includes(f)) formatie = f; },
    volgendeFormatie: () => { formatie = FORMATIES[(FORMATIES.indexOf(formatie) + 1) % FORMATIES.length]; return formatie; },
    zetHoud,
    deel,
    zetKiesFilter: (f) => { kiesFilter = f || null; },
    // Een wandelingetje op de grond (voor de koning in de proloog); telt niet als bevel van de speler.
    wandel: (e, x, y) => x >= 0 && y >= 0 && x < B && y < H && isVrij(y * B + x) && !bezet(y * B + x, [e]) ? loopNaar(e, y * B + x) : false,
    bewaarStand, zetStand, herstel, sneuvel, kaartVeranderd,
    isMuur: (x, y) => x >= 0 && y >= 0 && x < B && y < H && isMuur(y * B + x),
    // Zit er aan dit stuk muur een toren, wachttoren of poort vast?
    heeftTrap: (x, y) => x >= 0 && y >= 0 && x < B && y < H && isMuur(y * B + x) && muurstuk(y * B + x).trap,
    lijst: soldaten,           // de lijst zelf (niet aanpassen): strijd.js kijkt hier elke stap in
    gekozen,
    aantal: () => soldaten.length,
    plekken,
    aantalGekozen: () => gekozen().length,
    soldaten: () => soldaten.slice(),
  };
}
