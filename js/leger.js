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
  const max = regels.legerMax;
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
  const bezet = (knoop, zonder) => soldaten.some((e) => !(zonder && zonder.includes(e)) && (knoopVan(e) === knoop || e.soldaat.doel === knoop));

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
    e.lagen = true;
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
  // Lege tekst als je deze soldaat kunt opleiden, anders de reden.
  function waaromNiet(sleutel) {
    const def = soorten[sleutel];
    if (!def) return 'die soldaat bestaat niet';
    if (def.koning) return 'er is maar één koning';
    if (soldaten.length >= max) return `je leger is vol (${max} soldaten)`;
    const tekort = economie.tekort(def.kosten);
    if (tekort) return tekort;
    const boeren = def.boeren || 1;
    if (economie.bevolking().vrij < boeren) return boeren > 1 ? `hij kost ${boeren} boeren zonder werk` : 'er is geen boer zonder werk';
    return '';
  }

  // Leidt een soldaat op bij de kazerne op dit vak. Geeft een lege tekst
  // terug als het gelukt is, anders de reden.
  function leidOp(sleutel, kazerneVak) {
    const reden = waaromNiet(sleutel);
    if (reden) return reden;
    const vak = plekBij(kazerneVak, 4);
    if (vak < 0) return 'er is geen plek bij de kazerne';
    economie.betaal(soorten[sleutel].kosten);
    for (let i = soorten[sleutel].boeren || 1; i > 0; i--) economie.boerWeg();
    maak(sleutel, vak);
    opVerandering();
    opLeger();
    return '';
  }

  // --- Kiezen -----------------------------------------------------------------------
  const gekozen = () => soldaten.filter((e) => e.gekozen);

  // Kiest deze soldaten. erbij = wat al gekozen was blijft gekozen.
  function kies(lijst, erbij = false) {
    if (!erbij) for (const e of soldaten) e.gekozen = false;
    for (const e of lijst) e.gekozen = true;
    opLeger();
  }

  // Soldaten in drie groepen: wie van dichtbij vecht, wie van verre schiet
  // en de belegeringsmachines (ram, katapult, toren, ladderdrager).
  const groepVan = (def) => (def.alleenBouw || def.ladder ? 'belegering' : def.bereik > 2 ? 'afstand' : 'melee');
  // De koning valt buiten de groepen en buiten Alle: die stuur je bewust, met zijn eigen knop of een tik.
  const isKoning = (e) => !!soorten[e.soldaat.sleutel].koning;
  const kiesGroep = (groep) => kies(soldaten.filter((e) => !isKoning(e) && groepVan(soorten[e.soldaat.sleutel]) === groep));
  const kiesSoort = (sleutel) => kies(soldaten.filter((e) => e.soldaat.sleutel === sleutel));
  // Hoeveel soldaten er zijn (en gekozen zijn) per groep en per soort.
  function telling() {
    const groepen = {};
    const perSoort = {};
    for (const e of soldaten) {
      const g = groepVan(soorten[e.soldaat.sleutel]);
      const t = isKoning(e) ? { n: 0, gekozen: 0 } : (groepen[g] = groepen[g] || { n: 0, gekozen: 0 });
      const u = (perSoort[e.soldaat.sleutel] = perSoort[e.soldaat.sleutel] || { n: 0, gekozen: 0, groep: g });
      t.n++; u.n++;
      if (e.gekozen) { t.gekozen++; u.gekozen++; }
    }
    return { groepen, perSoort };
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
    if (!grond && soorten[e.soldaat.sleutel].alleenBouw) return false;
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
    const groep = opMuur ? gekozen().filter((e) => !soorten[e.soldaat.sleutel].alleenBouw) : gekozen();
    if (!groep.length || x < 0 || y < 0 || x >= B || y >= H) return 0;
    const doel = y * B + x;
    const plekken = [];
    if (opMuur) {
      if (!isMuur(doel)) return 0;
      const stuk = muurstuk(doel);
      if (!stuk.trap) return 0;   // zonder toren, wachttoren of poort kom je er niet op
      for (const vak of stuk.vakken) {
        if (!bezet(N + vak, groep)) plekken.push(N + vak);
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

  // Eén rekenstap: wie zijn route kwijt is (er is gebouwd), zoekt een nieuwe.
  function stap() {
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
      if (soldaten.length >= max) break;
      if (!Array.isArray(regel)) continue;
      const [sleutel, x, y, leven, boven] = regel;
      if (!Object.prototype.hasOwnProperty.call(soorten, sleutel)) continue;
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
    soorten, max, waaromNiet, leidOp, vind, kies, stuur, stap,
    kiesAlles: () => kies(soldaten.filter((e) => !isKoning(e))),
    zetKoning,
    groepVan, kiesGroep, kiesSoort, telling,
    kiesGeen: () => kies([]),
    bewaarStand, zetStand, herstel, sneuvel, kaartVeranderd,
    isMuur: (x, y) => x >= 0 && y >= 0 && x < B && y < H && isMuur(y * B + x),
    // Zit er aan dit stuk muur een toren, wachttoren of poort vast?
    heeftTrap: (x, y) => x >= 0 && y >= 0 && x < B && y < H && isMuur(y * B + x) && muurstuk(y * B + x).trap,
    lijst: soldaten,           // de lijst zelf (niet aanpassen): strijd.js kijkt hier elke stap in
    gekozen,
    aantal: () => soldaten.length,
    aantalGekozen: () => gekozen().length,
    soldaten: () => soldaten.slice(),
  };
}
