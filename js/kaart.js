// KAART: de gegevens van het speelveld (welke grond, wat staat erop).
// Deze module tekent niets. Tekenen gebeurt in tekenaar.js.
//
// Een kaart is een gewoon gegevenspakket: breedte, hoogte, per tegel de
// grondsoort en het object, en de startplekken. Missies kunnen later hun
// eigen kaart in precies deze vorm aanleveren.

import { maakToeval } from './toeval.js';

export const GROND = { GRAS: 0, GRAS_DONKER: 1, ZAND: 2, WATER: 3, AARDE: 4, AKKER: 5 };
export const OBJECT = {
  GEEN: 0, BOOM: 1, STEEN: 2, IJZER: 3,   // IJZER is kopererts (de naam bleef om oude opslag niet te breken)
  MUUR: 4, TOREN: 5, POORT: 6, BURCHT: 7, BANIER_BLAUW: 8, BANIER_ROOD: 9, WACHTTOREN: 10,
  HUIS: 11, HUT: 12, TENT: 13, HOOIBERG: 14, PUT: 15, VATEN: 16,
  HOUTHAKKER: 17, STEENGROEVE: 18, BOOMGAARD: 19, WONING: 20, KAZERNE: 21, VOORRAADKAMER: 22, ZAGERIJ: 23, TARWEVELD: 24, BAKKERIJ: 25, KOPERMIJN: 26, MAGIERTOREN: 27,
  VLAGGEN: 28,   // feestvlaggen (proloog), decor
};

// Namen waarmee de tekenlaag het juiste plaatje opzoekt in data/assets.json.
export const GROND_ASSET = [
  'grond.gras', 'grond.gras_donker', 'grond.zand', 'grond.water', 'grond.aarde', 'grond.akker',
];
export const OBJECT_ASSET = [
  null, 'object.boom', 'object.steen', 'object.ijzer',
  'kasteel.muur', 'kasteel.toren', 'kasteel.poort', 'kasteel.burcht',
  'kasteel.banier_blauw', 'kasteel.banier_rood', 'kasteel.wachttoren',
  'dorp.huis', 'dorp.hut', 'dorp.tent', 'dorp.hooiberg', 'dorp.put', 'dorp.vaten',
  'werk.houthakker', 'werk.steengroeve', 'werk.boomgaard', 'dorp.woning', 'leger.kazerne', 'dorp.voorraadkamer', 'werk.zagerij', 'werk.tarweveld', 'werk.bakkerij', 'werk.kopermijn', 'leger.magiertoren', 'dorp.vlaggen',
];

const GROND_TEKST = ['grass', 'grass', 'sand', 'water', 'earth', 'farmland'];
const OBJECT_TEKST = [
  '', 'forest', 'rock', 'copper ore', 'wall', 'tower', 'gate', 'keep', 'keep', 'keep', 'watchtower',
  'cottage', 'hut', 'tent', 'haystack', 'well', 'barrels', "woodcutter's hut", 'stone mine', 'orchard', 'house', 'barracks', 'storehouse', 'sawmill', 'wheat field', 'bakery', 'copper mine', 'mage tower', 'festive flags',
];

// Hoe ver de ringmuur van het proefkasteel van het midden af ligt.
const RING = 5;

const isBurcht = (soort) =>
  soort === OBJECT.BURCHT || soort === OBJECT.BANIER_BLAUW || soort === OBJECT.BANIER_ROOD;
const isVesting = (soort) => soort >= OBJECT.MUUR && soort <= OBJECT.WACHTTOREN;

// Zegt aan welke kanten van een kasteeldeel een buur aansluit. Daar tekent
// het spel geen kantelen, zodat muren één geheel vormen.
//   1 = buur rechtsboven (y - 1), 2 = rechtsonder (x + 1),
//   4 = linksonder (y + 1),       8 = linksboven (x - 1)
// Een burcht is hoger dan een muur en sluit daarom alleen aan op burcht.
//
// alsSoort en ookHier zijn voor de schim tijdens het bouwen: reken alsof
// hier al een bouwwerk van die soort staat, en tel de tegels van de schim
// mee als buur.
export function aansluiting(kaart, x, y, alsSoort, ookHier) {
  const zelf = alsSoort !== undefined ? alsSoort : kaart.object[y * kaart.breedte + x];
  const past = isBurcht(zelf) ? isBurcht : isVesting;
  const buur = (bx, by) =>
    bx >= 0 && by >= 0 && bx < kaart.breedte && by < kaart.hoogte &&
    (past(kaart.object[by * kaart.breedte + bx]) || (!!ookHier && ookHier(bx, by)));
  return (buur(x, y - 1) ? 1 : 0) | (buur(x + 1, y) ? 2 : 0) | (buur(x, y + 1) ? 4 : 0) | (buur(x - 1, y) ? 8 : 0);
}

// Vloeiende ruis: een waarde tussen 0 en 1 die van tegel tot tegel
// geleidelijk verandert. Zo ontstaan natuurlijke vlekken (meer, bos).
function maakRuis(toeval, breedte, hoogte, celgrootte) {
  const kolommen = Math.ceil(breedte / celgrootte) + 2;
  const rijen = Math.ceil(hoogte / celgrootte) + 2;
  const punten = new Float32Array(kolommen * rijen);
  for (let i = 0; i < punten.length; i++) punten[i] = toeval();
  const zacht = (t) => t * t * (3 - 2 * t);

  return (x, y) => {
    const gx = x / celgrootte;
    const gy = y / celgrootte;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = zacht(gx - x0);
    const ty = zacht(gy - y0);
    const a = punten[y0 * kolommen + x0];
    const b = punten[y0 * kolommen + x0 + 1];
    const c = punten[(y0 + 1) * kolommen + x0];
    const d = punten[(y0 + 1) * kolommen + x0 + 1];
    return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
  };
}

// Wat er binnen en buiten de muren staat, als [dx, dy, soort] vanaf het
// midden van het kasteel. De poort zit rechts (dx = RING).
const INRICHTING = [
  // Op de binnenplaats, links van de burcht
  [-3, 2, OBJECT.HUIS], [-4, 3, OBJECT.HUT], [-2, 3, OBJECT.HOOIBERG], [-4, 2, OBJECT.VATEN], [-2, 4, OBJECT.PUT],
  // Op de binnenplaats, rechts van de burcht
  [2, -3, OBJECT.HUIS], [3, -4, OBJECT.HUT], [4, -3, OBJECT.VATEN], [3, -2, OBJECT.TENT], [4, 2, OBJECT.VATEN],
  // Dorp langs de weg buiten de poort
  [7, -2, OBJECT.HUIS], [9, -2, OBJECT.HUT], [11, -2, OBJECT.HUIS], [8, 2, OBJECT.HUIS], [10, 2, OBJECT.HUT],
  [12, 1, OBJECT.PUT], [7, 2, OBJECT.VATEN], [10, -3, OBJECT.HOOIBERG], [12, 6, OBJECT.HOOIBERG], [8, 7, OBJECT.HUT],
  // Legerkamp achter het kasteel
  [-2, -8, OBJECT.TENT], [0, -9, OBJECT.TENT], [2, -8, OBJECT.TENT], [1, -7, OBJECT.VATEN], [-1, -10, OBJECT.TENT],
];

// Het feest in de proloog: extra decor rond jouw kasteel ([dx, dy, soort]).
// Wat op water of op iets anders dan bos valt, wordt overgeslagen.
const O = OBJECT;
const FEEST = [
  // Vlaggen op de binnenplaats en bij de poort
  [-3, -3, O.VLAGGEN], [3, 3, O.VLAGGEN], [-3, 0, O.VLAGGEN], [6, -1, O.VLAGGEN], [6, 1, O.VLAGGEN],
  // Langs de weg naar het dorp
  [9, -1, O.VLAGGEN], [12, -1, O.VLAGGEN], [11, 3, O.VLAGGEN],
  // Het feestplein in het dorp: tenten en vlaggen
  [14, -3, O.TENT], [16, -3, O.TENT], [15, 3, O.TENT], [17, 1, O.VLAGGEN], [14, 2, O.VLAGGEN], [16, -1, O.PUT],
  // Meer huisjes in het dorp
  [13, -5, O.HUIS], [15, -6, O.HUIS], [17, -5, O.HUT], [18, -2, O.HUIS], [18, 3, O.HUIS], [13, 5, O.HUIS], [16, 6, O.HUT], [14, 8, O.HUIS],
  [9, -5, O.HUT], [11, -6, O.HUIS], [19, 0, O.HOOIBERG], [12, 9, O.HOOIBERG], [17, 8, O.VATEN],
  // Een tweede gehucht ten zuiden van het kasteel
  [-4, 8, O.HUIS], [-2, 9, O.HUIS], [0, 8, O.HUT], [-5, 10, O.HUT], [-1, 11, O.HUIS], [1, 10, O.HOOIBERG], [-3, 11, O.PUT], [2, 8, O.VLAGGEN],
  // Een gehucht ten westen
  [-9, -2, O.HUIS], [-10, 0, O.HUT], [-9, 2, O.HUIS], [-11, -1, O.HOOIBERG], [-8, 0, O.VLAGGEN], [-11, 2, O.VATEN],
  // Bij het legerkamp
  [3, -9, O.VLAGGEN], [-3, -9, O.TENT],
];
const FEEST_GROND = [];
for (let dy = -2; dy <= 2; dy++) for (let dx = 13; dx <= 17; dx++) FEEST_GROND.push([dx, dy]);
for (let dy = 8; dy <= 11; dy++) for (let dx = -5; dx <= 2; dx++) if ((dx + dy) % 3 === 0) FEEST_GROND.push([dx, dy]);
for (let dx = 6; dx <= 13; dx++) FEEST_GROND.push([dx, 0]);

// Maakt een kaart voor vrij spel: twee startplekken, water, bos, steen
// en ijzer. De kaart is gespiegeld door het midden, zodat beide spelers
// dezelfde kansen hebben.
// Het recept staat in data/kaarten.json; zonder recept komt de standaardkaart.
const STANDAARD = {
  water: 0.3, zand: 0.36, bos: 0.62, start: [0.22, 0.78],
  vindplaatsen: [
    { soort: 'STEEN', dx: -9, dy: -10, straal: 2.6 },
    { soort: 'IJZER', dx: 4, dy: 10, straal: 2.2 },
    { soort: 'BOOM', dx: -10, dy: 3, straal: 3.5 },
  ],
  midden: [{ soort: 'IJZER', dx: -4, dy: 3, straal: 2.4 }],
};

// De kasteelontwerpen voor rood (stap 33).
export async function laadKastelen() {
  const antwoord = await fetch('data/kastelen.json');
  if (!antwoord.ok) throw new Error('Kon data/kastelen.json niet laden.');
  const alles = await antwoord.json();
  const k = alles.kastelen;
  const materialen = alles.materialen || {};
  for (const [naam, o] of Object.entries(k)) {
    if (o.materiaal && !materialen[o.materiaal]) throw new Error(`kastelen.json: ${naam} kent geen materiaal ${o.materiaal}`);
    if (!Array.isArray(o.ringen) || !o.ringen.length) throw new Error(`kastelen.json: ${naam} heeft geen ringen`);
    for (const r of o.ringen) {
      if (!(r.maat >= 3 && r.maat <= 10)) throw new Error(`kastelen.json: ${naam} heeft een ring met maat ${r.maat} (3 tot 10)`);
      for (const p of r.poorten || []) if (!['voor', 'achter', 'links', 'rechts'].includes(p)) throw new Error(`kastelen.json: ${naam} kent geen poort ${p}`);
    }
  }
  return { kastelen: k, materialen };
}

export async function laadKaarten() {
  const antwoord = await fetch('data/kaarten.json');
  if (!antwoord.ok) throw new Error('Kon data/kaarten.json niet laden.');
  const k = await antwoord.json();
  for (const [naam, r] of Object.entries(k.kaarten)) {
    if (!(r.breedte >= 40 && r.hoogte >= 40 && r.breedte <= 96 && r.hoogte <= 96)) throw new Error(`kaarten.json: kaart ${naam} moet tussen 40 en 96 tegels groot zijn`);
    for (const v of [...(r.vindplaatsen || []), ...(r.midden || [])]) if (OBJECT[v.soort] === undefined) throw new Error(`kaarten.json: kaart ${naam} kent geen ${v.soort}`);
  }
  return k.kaarten;
}

export function maakKaart(recept) {
  const r = { ...STANDAARD, ...recept };
  const { breedte, hoogte, zaad } = r;
  const toeval = maakToeval(zaad);
  const aantal = breedte * hoogte;
  const grond = new Uint8Array(aantal);
  const object = new Uint8Array(aantal);

  const eigen = { x: Math.round(breedte * r.start[0]), y: Math.round(hoogte * r.start[1]) };
  const start = [eigen, { x: breedte - 1 - eigen.x, y: hoogte - 1 - eigen.y }];

  const grof = maakRuis(toeval, breedte, hoogte, 12);
  const fijn = maakRuis(toeval, breedte, hoogte, 5);
  const bos = maakRuis(toeval, breedte, hoogte, 7);
  const afstand = (x, y, p) => Math.hypot(x - p.x, y - p.y);

  // 1. Grond en bos uit ruis. Rond de startplekken blijft het vrij.
  for (let y = 0; y < hoogte; y++) {
    for (let x = 0; x < breedte; x++) {
      const i = y * breedte + x;
      const naarStart = Math.min(afstand(x, y, start[0]), afstand(x, y, start[1]));
      const nat = grof(x, y) * 0.7 + fijn(x, y) * 0.3;

      if (naarStart > 13 && nat < r.water) grond[i] = GROND.WATER;
      else if (naarStart > 11 && nat < r.zand) grond[i] = GROND.ZAND;
      else grond[i] = fijn(x, y) > 0.5 ? GROND.GRAS : GROND.GRAS_DONKER;

      if (grond[i] <= GROND.GRAS_DONKER && naarStart > 7.5) {
        const dichtheid = bos(x, y);
        if (dichtheid > r.bos || (dichtheid > r.bos - 0.1 && toeval() < 0.35)) object[i] = OBJECT.BOOM;
      }
    }
  }

  // 1b. De vorm van het land (stap 34), uit het recept: vorm.soort is
  //     pas      een dal tussen rotswanden langs de lijn tussen de kastelen,
  //              breed bij de kastelen (breed) en smal in het midden (smal)
  //     kloof    hetzelfde, maar het smalle stuk is langer (lang)
  //     rotsrug  een rug van rotsen dwars over het midden, met openingen (gaten)
  //     moeras   veel kleine plassen met smalle paden ertussen (nat)
  //     polder   water aan beide kanten (zee), met een dijk van rotsen ertegen
  //     Afstanden zijn een deel van de kaart (0.1 = een tiende). Rond de
  //     kastelen (vrijRond tegels) blijft het land altijd vrij.
  if (r.vorm) {
    const v = r.vorm;
    const vrijRond = v.vrijRond || 13;
    for (let y = 0; y < hoogte; y++) {
      for (let x = 0; x < breedte; x++) {
        const i = y * breedte + x;
        if (Math.min(afstand(x, y, start[0]), afstand(x, y, start[1])) <= vrijRond) continue;
        const px = x / breedte;
        const py = y / hoogte;
        const dwars = Math.abs(px + py - 1) / Math.SQRT2;   // afstand tot de lijn tussen de kastelen
        const langs = Math.abs(px - py) / Math.SQRT2;       // afstand tot het midden, langs die lijn
        const rand = (fijn(x, y) - 0.5) * 0.05;             // een rafelige rand
        let rots = false;
        let water = false;
        if (v.soort === 'pas' || v.soort === 'kloof') {
          const lang = v.soort === 'kloof' ? v.lang || 0.22 : v.lang || 0.08;
          const deel = Math.min(1, Math.max(0, (langs - lang) / 0.18));   // 0 = in het smalle stuk, 1 = bij de kastelen
          const half = (v.smal || 0.07) + ((v.breed || 0.2) - (v.smal || 0.07)) * deel;
          rots = dwars > half + rand;
        } else if (v.soort === 'rotsrug') {
          const dik = v.dik || 0.035;
          const gaten = v.gaten || [0];
          const opRug = langs < dik + rand;
          const inGat = gaten.some((g) => Math.abs((px + py - 1) / Math.SQRT2 - g) < (v.gat || 0.035));
          rots = opRug && !inGat;
        } else if (v.soort === 'moeras') {
          const nat = grof(x, y) * 0.5 + fijn(x, y) * 0.5;
          water = nat < (v.nat || 0.45) && fijn(x, y) < 0.55;
        } else if (v.soort === 'polder') {
          const zee = v.zee || 0.24;
          water = dwars > zee + rand;
          rots = !water && dwars > zee - 0.02 + rand;   // de dijk
        }
        if (rots) {
          grond[i] = GROND.GRAS_DONKER;
          object[i] = OBJECT.STEEN;
        } else if (water) {
          grond[i] = GROND.WATER;
          object[i] = OBJECT.GEEN;
        }
      }
    }
  }

  // 2. Vaste vindplaatsen bij speler 1. Door het spiegelen krijgt speler 2
  //    precies dezelfde.
  const vlek = (mx, my, straal, soort) => {
    for (let y = Math.floor(my - straal); y <= Math.ceil(my + straal); y++) {
      for (let x = Math.floor(mx - straal); x <= Math.ceil(mx + straal); x++) {
        if (x < 0 || y < 0 || x >= breedte || y >= hoogte) continue;
        if (Math.hypot(x - mx, y - my) > straal - toeval() * 0.8) continue;
        const i = y * breedte + x;
        if (grond[i] === GROND.ZAND || grond[i] === GROND.WATER) grond[i] = GROND.GRAS;
        object[i] = soort;
      }
    }
  };
  for (const v of r.vindplaatsen) vlek(eigen.x + v.dx, eigen.y + v.dy, v.straal, OBJECT[v.soort]);
  // In het midden van de kaart, om over te vechten.
  for (const v of r.midden) vlek(Math.round(breedte / 2) + v.dx, Math.round(hoogte / 2) + v.dy, v.straal, OBJECT[v.soort]);

  // 3. Een kasteel rond de startplek, met een dorp en een legerkamp. Dit
  //    is decor uit de kaartgenerator, zonder functie in het spel.
  const zet = (dx, dy, soort, ondergrond) => {
    const x = eigen.x + dx;
    const y = eigen.y + dy;
    if (x < 0 || y < 0 || x >= breedte || y >= hoogte) return;
    const i = y * breedte + x;
    if (soort !== undefined) object[i] = soort;
    if (ondergrond !== undefined) grond[i] = ondergrond;
    else if (grond[i] === GROND.WATER) grond[i] = GROND.GRAS;
  };
  for (let dy = -RING; dy <= RING; dy++) {
    for (let dx = -RING; dx <= RING; dx++) {
      const rand = Math.max(Math.abs(dx), Math.abs(dy)) === RING;
      const hoek = Math.abs(dx) === RING && Math.abs(dy) === RING;
      const midden = dx === 0 || dy === 0;
      let soort = OBJECT.GEEN;
      if (hoek) soort = OBJECT.TOREN;
      else if (dx === RING && dy === 0) soort = OBJECT.POORT;
      else if (rand && midden) soort = OBJECT.WACHTTOREN;
      else if (rand) soort = OBJECT.MUUR;
      else if (dx === 0 && dy === 0) soort = OBJECT.BANIER_BLAUW;
      else if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) soort = OBJECT.BURCHT;
      zet(dx, dy, soort, rand ? GROND.GRAS_DONKER : GROND.AARDE);
    }
  }
  // Een weg van aarde vanaf de poort, met een knik naar de akkers.
  for (let dx = RING + 1; dx <= RING + 9; dx++) zet(dx, 0, OBJECT.GEEN, GROND.AARDE);
  for (let dy = 1; dy <= 4; dy++) zet(RING + 4, dy, OBJECT.GEEN, GROND.AARDE);
  zet(RING + 2, 1, OBJECT.GEEN, GROND.AARDE);
  zet(RING + 6, -1, OBJECT.GEEN, GROND.AARDE);
  // Akkers
  for (let dy = 4; dy <= 7; dy++) {
    for (let dx = RING + 5; dx <= RING + 8; dx++) zet(dx, dy, OBJECT.GEEN, GROND.AKKER);
  }
  for (let dy = -6; dy <= -4; dy++) {
    for (let dx = RING + 3; dx <= RING + 5; dx++) zet(dx, dy, OBJECT.GEEN, GROND.AKKER);
  }
  // Platgetreden grond in het legerkamp
  for (const [dx, dy] of [[-1, -8], [0, -8], [1, -8], [0, -7], [-1, -9], [1, -9], [0, -10]]) {
    zet(dx, dy, OBJECT.GEEN, GROND.AARDE);
  }
  for (const [dx, dy, soort] of INRICHTING) zet(dx, dy, soort);

  // 4. Spiegelen door het midden: de helft van speler 1 is het origineel.
  //    De banier van speler 2 krijgt zijn eigen kleur.
  for (let i = 0; i < aantal / 2; i++) {
    const j = aantal - 1 - i;
    grond[i] = grond[j];
    object[i] = object[j] === OBJECT.BANIER_BLAUW ? OBJECT.BANIER_ROOD : object[j];
  }

  // 5. Speler 1 bouwt zijn eigen muren. Zijn ringmuur gaat daarom weg; de
  //    burcht, het dorp en het kamp blijven staan. Het kasteel van speler
  //    2 blijft compleet: als voorbeeld en als tegenstander.
  for (let dy = -RING; dy <= RING; dy++) {
    for (let dx = -RING; dx <= RING; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== RING) continue;
      object[(eigen.y + dy) * breedte + eigen.x + dx] = OBJECT.GEEN;
    }
  }
  grond[eigen.y * breedte + eigen.x + RING] = GROND.AARDE;   // waar de poort stond loopt de weg door

  // 5a. Het kasteel van rood volgens een ontwerp (stap 33, data/kastelen.json).
  //     Zonder ontwerp blijft de gespiegelde ringmuur van hierboven staan.
  //     In het ontwerp is "voor" de kant naar jou toe; ringen tellen van
  //     binnen naar buiten. Poorten: voor, achter, links, rechts.
  const ontwerp = r.kasteel || { ringen: [{ maat: RING, poorten: ['voor'] }] };
  const ringen = ontwerp.ringen.slice().sort((p, q) => p.maat - q.maat);
  const buiten = ringen[ringen.length - 1].maat;
  const gracht = ontwerp.gracht || null;
  const grachtVan = gracht ? buiten + (gracht.afstand || 2) : 0;
  const grachtTot = gracht ? grachtVan + (gracht.breedte || 1) - 1 : 0;
  const omvang = gracht ? grachtTot : buiten;   // tot hoever het kasteel reikt
  const POORTPLEK = { voor: [1, 0], achter: [-1, 0], links: [0, -1], rechts: [0, 1] };
  {
    const m = start[1];
    const teken = -1;   // rood staat gespiegeld: zijn "voor" is naar jou toe
    const plek = (dx, dy) => {
      const x = m.x + teken * dx;
      const y = m.y + teken * dy;
      return x >= 0 && y >= 0 && x < breedte && y < hoogte ? y * breedte + x : -1;
    };
    if (r.kasteel) {
      // Eerst alles vrij maken (de gespiegelde ring en het decor), daarna bouwen.
      const vrijTot = omvang + 1;
      for (let dy = -vrijTot; dy <= vrijTot; dy++) {
        for (let dx = -vrijTot; dx <= vrijTot; dx++) {
          const i = plek(dx, dy);
          if (i < 0) continue;
          const kern = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
          if (kern) continue;
          object[i] = OBJECT.GEEN;
          const d = Math.max(Math.abs(dx), Math.abs(dy));
          grond[i] = d < buiten ? GROND.AARDE : grond[i] === GROND.WATER ? GROND.GRAS : grond[i];
        }
      }
      for (const ring of ringen) {
        const M = ring.maat;
        const poorten = new Set((ring.poorten || ['voor']).map((k) => {
          const [px, py] = POORTPLEK[k] || POORTPLEK.voor;
          return `${px * M},${py * M}`;
        }));
        for (let dy = -M; dy <= M; dy++) {
          for (let dx = -M; dx <= M; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== M) continue;
            const i = plek(dx, dy);
            if (i < 0) continue;
            const hoek = Math.abs(dx) === M && Math.abs(dy) === M;
            const midden = dx === 0 || dy === 0;
            let soort = OBJECT.MUUR;
            if (hoek) soort = OBJECT.TOREN;
            else if (poorten.has(`${dx},${dy}`)) soort = OBJECT.POORT;
            else if (midden) soort = ring.middenTorens ? OBJECT.TOREN : OBJECT.WACHTTOREN;
            object[i] = soort;
            grond[i] = GROND.GRAS_DONKER;
          }
        }
      }
      // De gracht: water rondom, met een dam van aarde voor elke poort van de buitenste ring.
      if (gracht) {
        const dammen = (ringen[ringen.length - 1].poorten || ['voor']).map((k) => POORTPLEK[k] || POORTPLEK.voor);
        for (let dy = -grachtTot; dy <= grachtTot; dy++) {
          for (let dx = -grachtTot; dx <= grachtTot; dx++) {
            const d = Math.max(Math.abs(dx), Math.abs(dy));
            if (d < grachtVan || d > grachtTot) continue;
            const i = plek(dx, dy);
            if (i < 0) continue;
            const opDam = dammen.some(([px, py]) => (px ? Math.sign(dx) === px && dy === 0 : Math.sign(dy) === py && dx === 0));
            grond[i] = opDam ? GROND.AARDE : GROND.WATER;
            object[i] = OBJECT.GEEN;
          }
        }
        // Ook de strook tussen muur en gracht, voor de poort, wordt een pad.
        for (const [px, py] of dammen) {
          for (let k = buiten + 1; k < grachtVan; k++) {
            const i = plek(px * k, py * k);
            if (i >= 0) grond[i] = GROND.AARDE;
          }
        }
      }
    }
  }

  // Van wie een bouwwerk is: 0 = van niemand (decor), 1 = door de speler
  // gebouwd. Alleen wat je zelf bouwt kun je slopen.
  // 2 = van de rode heer: zijn ringmuur met torens en poort, en zijn burcht.
  const eigenaar = new Uint8Array(aantal);
  // Alle muren, torens en poorten binnen het kasteel van rood zijn van hem.
  for (let dy = -buiten; dy <= buiten; dy++) {
    for (let dx = -buiten; dx <= buiten; dx++) {
      const x = start[1].x + dx;
      const y = start[1].y + dy;
      if (x < 0 || y < 0 || x >= breedte || y >= hoogte) continue;
      const i = y * breedte + x;
      const soort = object[i];
      const kern = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
      const vesting = soort === OBJECT.MUUR || soort === OBJECT.TOREN || soort === OBJECT.WACHTTOREN || soort === OBJECT.POORT;
      if (vesting || (kern && (soort === OBJECT.BURCHT || soort === OBJECT.BANIER_ROOD))) eigenaar[i] = 2;
    }
  }

  // 5b. De werken van de rode heer, buiten zijn ringmuur: een houthakkershut,
  //     een steengroeve en een boomgaard. Ze geven hem inkomen (js/rood.js) en
  //     je kunt ze vernielen. Plek: de dichtstbijzijnde vrije tegel bij een
  //     vast doel, aan de kant van zijn muur die van jou af ligt.
  {
    const m = start[1];
    const vrij = (x, y) =>
      x >= 1 && y >= 1 && x < breedte - 1 && y < hoogte - 1 &&
      grond[y * breedte + x] !== GROND.WATER && object[y * breedte + x] === OBJECT.GEEN && !eigenaar[y * breedte + x];
    const gekozen = [];
    // Niet op de rechte lijn van jouw poort naar die van rood: daar komt zo
    // nodig het pad (5c), en een werk mag de weg niet versperren.
    const gang = new Set();
    {
      const van = { x: eigen.x + RING + 1, y: eigen.y };
      const naar = { x: m.x - omvang - 1, y: m.y };
      const stappen = Math.max(Math.abs(naar.x - van.x), Math.abs(naar.y - van.y));
      for (let k = 0; k <= stappen; k++) {
        const x = Math.round(van.x + ((naar.x - van.x) * k) / stappen);
        const y = Math.round(van.y + ((naar.y - van.y) * k) / stappen);
        for (let ddy = -1; ddy <= 2; ddy++) for (let ddx = -1; ddx <= 2; ddx++) gang.add((y + ddy) * breedte + x + ddx);
      }
    }
    for (const [soort, dx, dy] of [[OBJECT.HOUTHAKKER, -omvang - 3, -2], [OBJECT.STEENGROEVE, -omvang - 3, 2], [OBJECT.BOOMGAARD, -2, omvang + 3]]) {
      let beste = null;
      // Eerst vlak bij het doel; past het daar niet (een groot kasteel aan de
      // rand van de kaart), dan de dichtstbijzijnde plek rondom het kasteel.
      for (const ruim of [4, omvang + 10]) {
        for (let y = m.y + dy - ruim; y <= m.y + dy + ruim; y++) {
          for (let x = m.x + dx - ruim; x <= m.x + dx + ruim; x++) {
            if (!vrij(x, y) || !vrij(x + 1, y) || !vrij(x - 1, y) || !vrij(x, y + 1) || !vrij(x, y - 1)) continue;
            if (omvang > RING && gang.has(y * breedte + x)) continue;
            const afstand = Math.max(Math.abs(x - m.x), Math.abs(y - m.y));
            if (afstand <= omvang + 1 || (ruim > 4 && afstand > omvang + 9)) continue;
            if (gekozen.some(([gx, gy]) => Math.abs(gx - x) <= 2 && Math.abs(gy - y) <= 2)) continue;
            const d = Math.abs(x - (m.x + dx)) + Math.abs(y - (m.y + dy));
            if (!beste || d < beste.d) beste = { x, y, d };
          }
        }
        if (beste) break;
      }
      if (!beste) continue;
      gekozen.push([beste.x, beste.y]);
      object[beste.y * breedte + beste.x] = soort;
      eigenaar[beste.y * breedte + beste.x] = 2;
    }
  }

  let padGemaakt = 'ja';
  // 5c. Er moet een weg over land zijn van jouw poort naar die van rood.
  //     Is die er niet (te veel water of bos), dan wordt er een pad gemaakt:
  //     water wordt zand (een doorwaadbare plek) en bomen gaan weg. Het pad
  //     loopt van poort naar poort en is dus ook gespiegeld.
  {
    const van = { x: eigen.x + RING + 1, y: eigen.y };
    const naar = { x: start[1].x - omvang - 1, y: start[1].y };   // voor de poort (en de dam) van rood
    const begaanbaar = (i) => grond[i] !== GROND.WATER && (object[i] === OBJECT.GEEN || false);
    const verbonden = () => {
      const gezien = new Uint8Array(aantal);
      const rij = [van.y * breedte + van.x];
      gezien[rij[0]] = 1;
      const doel = naar.y * breedte + naar.x;
      while (rij.length) {
        const i = rij.pop();
        if (i === doel) return true;
        const x = i % breedte;
        const y = (i - x) / breedte;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= breedte || ny >= hoogte) continue;
          const j = ny * breedte + nx;
          if (gezien[j] || !begaanbaar(j)) continue;
          gezien[j] = 1;
          rij.push(j);
        }
      }
      return false;
    };
    if (!verbonden()) {
      const stappen = Math.max(Math.abs(naar.x - van.x), Math.abs(naar.y - van.y));
      for (let k = 0; k <= stappen; k++) {
        const x = Math.round(van.x + ((naar.x - van.x) * k) / stappen);
        const y = Math.round(van.y + ((naar.y - van.y) * k) / stappen);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1]]) {
          const i = (y + dy) * breedte + x + dx;
          if (x + dx >= breedte || y + dy >= hoogte || eigenaar[i]) continue;
          if (grond[i] === GROND.WATER) grond[i] = GROND.ZAND;
          if (object[i] === OBJECT.BOOM || (omvang > RING && object[i] !== OBJECT.GEEN)) object[i] = OBJECT.GEEN;
        }
      }
    }
    padGemaakt = !verbonden() ? 'geen' : 'ja';
  }

  // 5d. De proloog (data/kaarten.json):
  //     zonderRood  geen kasteel, werken of dorp van rood: zijn plek blijft leeg land
  //     eigenMuur   jouw ringmuur met poort staat er al (en is van jou)
  //     feest       meer huisjes, een tweede gehucht, feesttenten en vlaggen
  if (r.zonderRood) {
    for (let i = 0; i < aantal; i++) {
      const x = i % breedte;
      const y = (i - x) / breedte;
      const dichtbij = Math.max(Math.abs(x - start[1].x), Math.abs(y - start[1].y)) <= omvang + 9;
      if (eigenaar[i] === 2 || (dichtbij && object[i] !== OBJECT.BOOM && object[i] !== OBJECT.STEEN && object[i] !== OBJECT.IJZER)) {
        object[i] = OBJECT.GEEN;
        eigenaar[i] = 0;
      }
      if (dichtbij && (grond[i] === GROND.AARDE || grond[i] === GROND.AKKER || grond[i] === GROND.GRAS_DONKER)) grond[i] = GROND.GRAS;
    }
  }
  if (r.eigenMuur) {
    for (let dy = -RING; dy <= RING; dy++) {
      for (let dx = -RING; dx <= RING; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== RING) continue;
        const hoek = Math.abs(dx) === RING && Math.abs(dy) === RING;
        let soort = OBJECT.MUUR;
        if (hoek) soort = OBJECT.TOREN;
        else if (dx === RING && dy === 0) soort = OBJECT.POORT;
        else if (dx === 0 || dy === 0) soort = OBJECT.WACHTTOREN;
        const i = (eigen.y + dy) * breedte + eigen.x + dx;
        object[i] = soort;
        eigenaar[i] = 1;
      }
    }
  }
  if (r.feest) {
    for (const [dx, dy, soort] of FEEST) {
      const x = eigen.x + dx;
      const y = eigen.y + dy;
      if (x < 1 || y < 1 || x >= breedte - 1 || y >= hoogte - 1) continue;
      const i = y * breedte + x;
      if (grond[i] === GROND.WATER || (object[i] !== OBJECT.GEEN && object[i] !== OBJECT.BOOM)) continue;
      object[i] = soort;
    }
    // Platgetreden grond rond het feestplein en het tweede gehucht
    for (const [dx, dy] of FEEST_GROND) {
      const i = (eigen.y + dy) * breedte + eigen.x + dx;
      if (i >= 0 && i < aantal && grond[i] !== GROND.WATER) grond[i] = GROND.AARDE;
    }
  }

  // 6. Looproutes voor de wachters op de muur, per kasteel. Elke muur is
  //    in tweeën gedeeld door een wachttoren of de poort.
  //    Bij meer ringen eerst de buitenste: daar staan de wachters het liefst.
  const routesRond = (m, teken, M) => {
    const plek = (dx, dy) => (m.y + teken * dy) * breedte + m.x + teken * dx;
    const routes = [];
    for (const [van, tot] of [[-M + 1, -1], [1, M - 1]]) {
      const stukken = [[], [], [], []];
      for (let k = van; k <= tot; k++) {
        stukken[0].push(plek(k, -M));   // achterste muur
        stukken[1].push(plek(k, M));    // voorste muur
        stukken[2].push(plek(-M, k));   // muur links
        stukken[3].push(plek(M, k));    // muur met de poort
      }
      routes.push(...stukken.filter((s) => s.length && s.every((i) => i >= 0 && i < aantal && object[i] === OBJECT.MUUR)));
    }
    return routes;
  };
  const kastelen = [
    { team: 0, midden: start[0], routes: [] },   // nog geen muren, dus geen wachters
    { team: 1, midden: start[1], routes: r.zonderRood ? [] : ringen.slice().reverse().flatMap((ring) => routesRond(start[1], -1, ring.maat)) },
  ];

  return { breedte, hoogte, zaad, naam: r.naam || '', grond, object, eigenaar, start, kastelen, omvang, verbonden: padGemaakt === 'ja' };
}

export function binnenKaart(kaart, x, y) {
  return x >= 0 && y >= 0 && x < kaart.breedte && y < kaart.hoogte;
}

// Korte omschrijving van een tegel in gewoon Nederlands, voor in beeld.
export function beschrijfTegel(kaart, x, y) {
  const i = y * kaart.breedte + x;
  const wat = OBJECT_TEKST[kaart.object[i]];
  return wat || GROND_TEKST[kaart.grond[i]];
}
