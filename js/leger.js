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

  // Hoeveel plekken heeft je leger nu? Per kazerne perKazerne, nooit meer dan de grens van het level.
  function legerMax() {
    return perKazerne ? Math.min(maxLevel, perKazerne * aantalKazernes()) : maxLevel;
  }

  // Lege tekst als je deze soldaat kunt opleiden, anders de reden.
  function waaromNiet(sleutel) {
    const def = soorten[sleutel];
    if (!def) return 'that soldier does not exist';
    if (def.koning) return 'there is only one king';
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
    const vak = plekBij(kazerneVak, 4);
    if (vak < 0) return 'there is no room next to the barracks';
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
  function kies(lijst, erbij = false, bewaarDeel = false) {
    if (!bewaarDeel) deelset = null;
    if (!erbij) for (const e of soldaten) e.gekozen = false;
    for (const e of lijst) e.gekozen = true;
    opLeger();
  }

  // Soldaten in drie groepen: wie van dichtbij vecht, wie van verre schiet
  // en de belegeringsmachines (ram, katapult, toren, ladderdrager).
  // Steun (banierdrager, heler) staat bij Afstand: die blijven achter de linie.
  const isBelegering = (sleutel) => !!(soorten[sleutel] && (soorten[sleutel].alleenBouw || soorten[sleutel].ladder));
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
    return { groepen, perSoort, deel: d ? d.length : 0, deelGekozen: d ? d.filter((e) => e.gekozen).length : 0 };
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
    const grond = van < N && naar < N && wegvinder.verbonden(van, naar, TEAM);
    // Belegeringstroepen (ram, katapult, ladder, toren) blijven op de grond: nooit een muur, toren of kasteel op.
    if (!grond && isBelegering(e.soldaat.sleutel)) return false;
    const pad = grond
      ? wegvinder.zoekPad(van % B, Math.floor(van / B), naar % B, Math.floor(naar / B), TEAM)
      : wegvinder.zoekPadLagen(van, naar, TEAM);
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
  function stuur(x, y, opMuur = false) {
    // Een stormram kan de muur niet op.
    let groep = opMuur ? gekozen().filter((e) => !isBelegering(e.soldaat.sleutel)) : gekozen();
    if (!groep.length || x < 0 || y < 0 || x >= B || y >= H) return 0;
    const doel = y * B + x;
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
      if (loopNaar(groep[i], plekken[i])) opWeg++;
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

  // Eén rekenstap: wie zijn route kwijt is (er is gebouwd), zoekt een nieuwe.
  function stap() {
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
    if (e.opMuur) regel.push(1);
    return regel;
  });

  // Zet bewaarde soldaten terug. Wat niet klopt wordt overgeslagen.
  function zetStand(lijst) {
    if (!Array.isArray(lijst)) return 0;
    let aantal = 0;
    for (const regel of lijst) {
      if (!Array.isArray(regel)) continue;
      const [sleutel, x, y, leven, boven] = regel;
      if (!Object.prototype.hasOwnProperty.call(soorten, sleutel)) continue;
      if (plekken() + (soorten[sleutel].legerPlekken || 1) > maxLevel) break;
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= B || y >= H) continue;
      // Stond hij op de muur en staat die er nog, dan staat hij er weer op.
      if (boven === 1 && isMuur(y * B + x) && !bezet(N + y * B + x)) {
        maak(sleutel, y * B + x, leven, true);
        aantal++;
        continue;
      }
      const vak = plekBij(y * B + x, 6);
      if (vak < 0) continue;
      maak(sleutel, vak, leven);
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
    soorten, get max() { return legerMax(); }, waaromNiet, leidOp, vind, kies, stuur, stap,
    kiesAlles: () => kies(soldaten.filter((e) => !isKoning(e))),
    zetKoning,
    groepVan, kiesGroep, kiesSoort, kiesKader, kiesDeel, telling,
    kiesGeen: () => kies([]),
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
