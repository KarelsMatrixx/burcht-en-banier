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
  LOODS: 29,     // bouwloods van rood (level 6): een doel dat je moet slopen
  CEL: 30,       // gevangenencel van Broeder Ludolf (level 5), decor
  CEL_OPEN: 31,  // dezelfde cel na de bevrijding
  KERK: 32,      // dorpskerk (proloog), decor
  STAL: 33,      // stal: hier leid je ruiters op, met een paardenboer
  MIJNGANG: 34,  // mijningang met rokende schacht (IJzerbroek, level 3), decor
  STEENHOUWER: 35,   // steenhouwer met bewegende hamer (level 3), decor
  SMEDERIJ: 36,  // smederij met gloeiende vuurplaats (IJzerbroek, level 3), decor
  IJZERPOORT: 37,   // vrijstaand poortgebouw met ijzeren valhek (level 3), decor
  KAMPVUUR: 38,  // kampvuur met driepoot en rook (tentenkamp van Brandt, level 4), decor
  JAGERSTENT: 39,   // olijfgroene jagerstent met gewei (tentenkamp van Brandt, level 4), decor
  BELEGERINGSWERKPLAATS: 40,   // de aparte kazerne voor ram, katapult en belegeringstoren
  KRAAN: 44,     // houten hijskraan met een stam (werven van level 6), decor
  WERKBANK: 45,  // werkbank met een stam die wordt gezaagd (level 6), decor
  HOUTSTAPEL: 46,   // stapel stammen en planken (level 6), decor
  RAMGERAAMTE: 47,  // half gebouwde stormram op schragen (level 6), decor
  HAMERVLAG: 48,    // hoge paal met het hamerbanier van Lambrecht (level 6), decor
  STEIGER: 49,      // houten steiger tegen een muur (level 6), decor
  RAAFTOREN: 43, // de Raaftoren van Mournkeep (level 10): hier zit Wessel; onkwetsbaar, decor
  SLUIS: 42,     // de sluis van de Witte Dijk (level 8): een doel dat je moet slopen
  GRAF: 41,      // grafstenen en kruisen van een begraafplaats (level 10, bij de kerk), decor
  MOORDGATENTOREN: 50,   // toren met moordgaten (level 7): kokende olie op alles binnen 2 tegels
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
  'werk.houthakker', 'werk.steengroeve', 'werk.boomgaard', 'dorp.woning', 'leger.kazerne', 'dorp.voorraadkamer', 'werk.zagerij', 'werk.tarweveld', 'werk.bakkerij', 'werk.kopermijn', 'leger.magiertoren', 'dorp.vlaggen', 'werk.loods', 'dorp.cel', 'dorp.cel_open', 'dorp.kerk', 'leger.stal', 'dorp.mijngang', 'dorp.steenhouwer', 'dorp.smederij', 'dorp.ijzerpoort', 'dorp.kampvuur', 'dorp.jagerstent', 'leger.belegering', 'dorp.graf', 'werk.sluis', 'dorp.raaftoren', 'dorp.kraan', 'dorp.werkbank', 'dorp.houtstapel', 'dorp.ramgeraamte', 'dorp.hamervlag', 'dorp.steiger', 'kasteel.moordgatentoren',
];

const GROND_TEKST = ['grass', 'grass', 'sand', 'water', 'earth', 'farmland'];
const OBJECT_TEKST = [
  '', 'forest', 'rock', 'copper ore', 'wall', 'watchtower', 'gate', 'keep', 'keep', 'keep', 'tower',
  'cottage', 'hut', 'tent', 'haystack', 'well', 'barrels', "woodcutter's hut", 'stone mine', 'orchard', 'house', 'barracks', 'storehouse', 'sawmill', 'wheat field', 'bakery', 'copper mine', 'mystic lodge', 'festive flags', 'siege shed', 'prison cell', 'prison cell', 'church', 'stable', 'coal mine', 'stonemason', 'smithy', 'iron gatehouse', 'campfire', "hunter's tent", 'siege workshop', 'graveyard', 'sluice', 'Raven Tower', 'timber crane', 'workbench', 'timber stack', 'half-built ram', 'hammer banner', 'scaffolding',
];

// Hoe ver de ringmuur van het proefkasteel van het midden af ligt.
const RING = 5;

const isBurcht = (soort) =>
  soort === OBJECT.BURCHT || soort === OBJECT.BANIER_BLAUW || soort === OBJECT.BANIER_ROOD;
const isVesting = (soort) => (soort >= OBJECT.MUUR && soort <= OBJECT.WACHTTOREN) || soort === OBJECT.MOORDGATENTOREN;

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
// Meer dorpen op de proloogkaart (naar Karel: veel levendigheid). Allemaal ruim buiten het
// bouwgebied van 14 tegels rond jouw burcht, zodat daar plek blijft om te bouwen.
// Een gehucht heeft een put in het midden, huizen en hutten eromheen, hooibergen en vaten.
const GEHUCHT = [
  [0, 0, O.PUT], [-3, -2, O.HUIS], [3, -2, O.HUIS], [-3, 2, O.HUIS], [3, 2, O.HUIS], [0, -4, O.HUIS],
  [-5, 0, O.HUT], [5, 0, O.HUT], [1, 4, O.HUT], [-2, 5, O.HOOIBERG], [6, 3, O.HOOIBERG], [2, 1, O.VATEN], [0, 2, O.VLAGGEN],
];
const GEHUCHT_SPIEGEL = GEHUCHT.map(([dx, dy, soort]) => [-dx, dy, soort === O.HUIS ? O.HUT : soort === O.HUT ? O.HUIS : soort]);
const op = (mx, my, lijst) => lijst.map(([dx, dy, soort]) => [mx + dx, my + dy, soort]);
// Het grote dorp met kerk en marktplein, ten oosten van het kasteel
const DORP_OOST = [
  [0, -5, O.KERK],
  [-2, -2, O.TENT], [2, -2, O.TENT], [-2, 2, O.TENT], [2, 2, O.TENT], [0, 0, O.PUT],
  [-3, 0, O.VLAGGEN], [3, 0, O.VLAGGEN], [0, -2, O.VLAGGEN], [0, 2, O.VLAGGEN],
  [-4, -6, O.HUIS], [-6, -3, O.HUIS], [4, -7, O.HUIS], [6, -5, O.HUT], [7, -2, O.HUIS], [7, 3, O.HUIS], [5, 5, O.HUT],
  [-5, 5, O.HUIS], [-7, 2, O.HUT], [-3, 7, O.HUIS], [2, 7, O.HUIS], [8, 0, O.HOOIBERG], [-8, -1, O.VATEN], [4, -3, O.VATEN],
  [-8, 5, O.HUT], [9, 5, O.HUIS], [9, -5, O.HUT], [-1, 9, O.HOOIBERG],
];
FEEST.push(
  ...op(27, 0, DORP_OOST),
  ...op(6, -22, GEHUCHT),
  ...op(3, 21, GEHUCHT_SPIEGEL),
  ...op(-21, -1, GEHUCHT),
  ...op(28, -22, GEHUCHT_SPIEGEL),
  ...op(31, 19, GEHUCHT),
  ...op(-18, 19, GEHUCHT_SPIEGEL),
  ...op(15, -22, GEHUCHT.slice(0, 9)),
  ...op(16, 22, GEHUCHT_SPIEGEL.slice(0, 9)),
);
// Waar de dorpelingen wonen en lopen (voor js/figuranten.js): midden van elk dorp, ten opzichte van jouw burcht.
export const FEEST_DORPEN = [
  { dx: 27, dy: 0, aantal: 12, priester: true },
  { dx: 6, dy: -22, aantal: 5 }, { dx: 3, dy: 21, aantal: 5 }, { dx: -21, dy: -1, aantal: 5 },
  { dx: 28, dy: -22, aantal: 5 }, { dx: 31, dy: 19, aantal: 5 }, { dx: -18, dy: 19, aantal: 5 },
  { dx: 15, dy: -22, aantal: 3 }, { dx: 16, dy: 22, aantal: 3 },
  { dx: 15, dy: 0, aantal: 5 }, { dx: -9, dy: 0, aantal: 3 }, { dx: -1, dy: 9, aantal: 4 },
];
const FEEST_GROND = [];
// Het marktplein van het grote dorp en de pleintjes van de gehuchten: platgetreden aarde
for (let dy = -2; dy <= 2; dy++) for (let dx = 24; dx <= 30; dx++) FEEST_GROND.push([dx, dy]);
for (const [mx, my] of [[6, -22], [3, 21], [-21, -1], [28, -22], [31, 19], [-18, 19]]) {
  for (let dy = -1; dy <= 3; dy++) for (let dx = -2; dx <= 2; dx++) FEEST_GROND.push([mx + dx, my + dy]);
}
// Wegen van het kasteel naar de dorpen
for (let dx = 14; dx <= 24; dx++) FEEST_GROND.push([dx, 0]);
for (let dy = 6; dy <= 20; dy++) FEEST_GROND.push([Math.round(dy / 8), dy]);
for (let dy = -7; dy >= -21; dy--) FEEST_GROND.push([Math.round(-dy / 3.6), dy]);
for (let dx = -6; dx >= -20; dx--) FEEST_GROND.push([dx, 0]);
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
      const vrijTot = r.kasteel.tol ? Math.max(omvang + 1, RING + 1) : omvang + 1;   // Greyford: ook de gespiegelde ring van het proefkasteel weg
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
      // Een tentenkamp (kamp: true) heeft geen muren: de ring bepaalt alleen hoe groot het vrije erf is.
      for (const ring of (ontwerp.kamp ? [] : ringen)) {
        const M = ring.maat;
        const poorten = new Set((ring.poorten || ['voor']).map((k) => {
          const [px, py] = POORTPLEK[k] || POORTPLEK.voor;
          return `${px * M},${py * M}`;
        }));
        // Een open gat in de ring (level 10: de achterpoort die Reinout opende), 3 tegels breed.
        const gaten = new Set();
        for (const k of ring.open || []) {
          const [px, py] = POORTPLEK[k] || POORTPLEK.voor;
          for (let t = -1; t <= 1; t++) gaten.add(px ? `${px * M},${t}` : `${t},${py * M}`);
        }
        // Een ronde ring (ring.rond): de tegels op afstand M van het midden (aaneensluitend, een achthoek in het raster);
        // de torens staan op 8 (of 4) plekken rondom, tussen de poorten in.
        const torenTegels = new Set();
        if (ring.rond) {
          const n = ring.torens || 8;
          for (let k = 0; k < n; k++) {
            const a = ((k + 0.5) * 2 * Math.PI) / n;   // een halve stap verschoven: de poorten liggen op de assen
            torenTegels.add(`${Math.round(M * Math.cos(a))},${Math.round(M * Math.sin(a))}`);
          }
        }
        for (let dy = -M; dy <= M; dy++) {
          for (let dx = -M; dx <= M; dx++) {
            if (ring.rond) {
              const d = Math.hypot(dx, dy);
              if (d < M - 0.62 || d >= M + 0.62) continue;
            } else if (Math.max(Math.abs(dx), Math.abs(dy)) !== M) continue;
            const i = plek(dx, dy);
            if (i < 0) continue;
            if (gaten.has(`${dx},${dy}`)) { object[i] = OBJECT.GEEN; grond[i] = GROND.AARDE; continue; }
            const hoek = ring.rond ? torenTegels.has(`${dx},${dy}`) : Math.abs(dx) === M && Math.abs(dy) === M;
            const midden = !ring.rond && (dx === 0 || dy === 0);
            let soort = OBJECT.MUUR;
            if (hoek) soort = ring.moord ? OBJECT.MOORDGATENTOREN : OBJECT.TOREN;
            else if (poorten.has(`${dx},${dy}`)) soort = OBJECT.POORT;
            else if (midden) soort = ring.moord ? OBJECT.MOORDGATENTOREN : ring.middenTorens ? OBJECT.TOREN : OBJECT.WACHTTOREN;
            object[i] = soort;
            grond[i] = GROND.GRAS_DONKER;
          }
        }
      }
      // Steigers en hamerbanieren langs de binnenkant van een ring (ring.steigers en ring.vlaggen: hoeken in graden;
      // 0 is de poort naar jou toe). Alleen op een lege tegel.
      for (const ring of (ontwerp.kamp ? [] : ringen)) {
        for (const [lijst, soort] of [[ring.steigers, OBJECT.STEIGER], [ring.vlaggen, OBJECT.HAMERVLAG]]) {
          for (const gr of lijst || []) {
            const a = (gr * Math.PI) / 180;
            const dx = Math.round((ring.maat - 1) * Math.cos(a));
            const dy = Math.round((ring.maat - 1) * Math.sin(a));
            const i = plek(dx, dy);
            if (i < 0 || object[i] !== OBJECT.GEEN || grond[i] === GROND.WATER || Math.max(Math.abs(dx), Math.abs(dy)) <= 1) continue;
            object[i] = soort;
          }
        }
      }
      // Decor binnen en buiten de muren (detailronde): [naam, dx, dy] in dezelfde maat als de ringen.
      // Alleen op een lege tegel zonder water; het pad naar de poort blijft vrij omdat het ontwerp dat bewaakt.
      const DECOR = { tent: OBJECT.TENT, hooiberg: OBJECT.HOOIBERG, put: OBJECT.PUT, vaten: OBJECT.VATEN, huis: OBJECT.HUIS, hut: OBJECT.HUT, boom: OBJECT.BOOM, steen: OBJECT.STEEN, vlaggen: OBJECT.VLAGGEN, mijn: OBJECT.MIJNGANG, houwer: OBJECT.STEENHOUWER, smederij: OBJECT.SMEDERIJ, ijzerpoort: OBJECT.IJZERPOORT, jagerstent: OBJECT.JAGERSTENT, kampvuur: OBJECT.KAMPVUUR, kraan: OBJECT.KRAAN, werkbank: OBJECT.WERKBANK, houtstapel: OBJECT.HOUTSTAPEL, ramgeraamte: OBJECT.RAMGERAAMTE, hamervlag: OBJECT.HAMERVLAG, steiger: OBJECT.STEIGER, stal: OBJECT.STAL, kerk: OBJECT.KERK, graf: OBJECT.GRAF, raaftoren: OBJECT.RAAFTOREN };
      // Moerasplekjes midden in het kamp ([dx, dy]): water op een lege tegel buiten de burcht.
      for (const [dx, dy] of ontwerp.water || []) {
        const i = plek(dx, dy);
        if (i < 0 || Math.max(Math.abs(dx), Math.abs(dy)) <= 1 || object[i] !== OBJECT.GEEN) continue;
        grond[i] = GROND.WATER;
      }
      for (const [naam, dx, dy] of ontwerp.decor || []) {
        const i = plek(dx, dy);
        // Kerk en graven mogen een open plek in het bos kappen (level 10: kerkhof tussen de dode bomen).
        const kapt = (naam === 'kerk' || naam === 'graf') && object[i] === OBJECT.BOOM;
        if (i < 0 || !DECOR[naam] || (object[i] !== OBJECT.GEEN && !kapt) || grond[i] === GROND.WATER) continue;
        object[i] = DECOR[naam];
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
      const vesting = soort === OBJECT.MUUR || soort === OBJECT.TOREN || soort === OBJECT.WACHTTOREN || soort === OBJECT.MOORDGATENTOREN || soort === OBJECT.POORT;
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

  // 5b2. De omgeving van een tentenkamp (ontwerp.omgeving, level 4): veel bomen en moerasplassen
  //      rondom het kamp, behalve op een brede laan naar jouw kant en rond de werken van rood.
  //      van/tot: vanaf hoeveel tegels van het midden tot waar; bomen: kans op een boom;
  //      plassen: hoe nat (0.3 weinig, 0.45 veel); laan: halve breedte van de open laan.
  //      Daarna worden vakjes die van het kamp af onbereikbaar zijn bos, zodat niemand opgesloten raakt.
  if (r.kasteel && r.kasteel.omgeving) {
    const om = r.kasteel.omgeving;
    const m = start[1];
    const van = om.van || omvang + 2;
    const tot = om.tot || van + 8;
    const laan = om.laan || 2.5;
    const naarJou = { x: eigen.x - m.x, y: eigen.y - m.y };
    const lengte = Math.hypot(naarJou.x, naarJou.y) || 1;
    const ux = naarJou.x / lengte;
    const uy = naarJou.y / lengte;
    const opLaan = (ox, oy) => ox * ux + oy * uy > 0 && Math.abs(ox * uy - oy * ux) < laan;
    const bijWerk = (x, y) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < breedte && ny < hoogte && eigenaar[ny * breedte + nx] === 2 && object[ny * breedte + nx] !== OBJECT.GEEN) return true;
      }
      return false;
    };
    // Eerst het gespiegelde dorp van jouw kant weg (huizen, akkers, wegen): rond een kamp is het wildernis.
    const DORP = new Set([OBJECT.HUIS, OBJECT.HUT, OBJECT.TENT, OBJECT.HOOIBERG, OBJECT.PUT, OBJECT.VATEN]);
    for (let y = m.y - tot - 2; y <= m.y + tot + 2; y++) {
      for (let x = m.x - tot - 2; x <= m.x + tot + 2; x++) {
        if (x < 1 || y < 1 || x >= breedte - 1 || y >= hoogte - 1) continue;
        const i = y * breedte + x;
        if (eigenaar[i]) continue;
        const d = Math.max(Math.abs(x - m.x), Math.abs(y - m.y));
        if (d < van) continue;
        if (DORP.has(object[i])) object[i] = OBJECT.GEEN;
        if (grond[i] === GROND.AKKER || grond[i] === GROND.AARDE) grond[i] = GROND.GRAS;
      }
    }
    for (let y = m.y - tot; y <= m.y + tot; y++) {
      for (let x = m.x - tot; x <= m.x + tot; x++) {
        if (x < 1 || y < 1 || x >= breedte - 1 || y >= hoogte - 1) continue;
        const d = Math.max(Math.abs(x - m.x), Math.abs(y - m.y));
        if (d < van || d > tot) continue;
        const i = y * breedte + x;
        if (eigenaar[i] || opLaan(x - m.x, y - m.y) || bijWerk(x, y)) continue;
        const nat = grof(x, y) * 0.5 + fijn(x, y) * 0.5;
        if (nat < (om.plassen || 0.4) && fijn(x, y) < 0.6 && d > van && object[i] !== OBJECT.STEEN && object[i] !== OBJECT.IJZER) {
          grond[i] = GROND.WATER;
          object[i] = OBJECT.GEEN;
        } else if (object[i] === OBJECT.GEEN && grond[i] !== GROND.WATER && toeval() < (om.bomen || 0.55)) {
          object[i] = OBJECT.BOOM;
          if (grond[i] === GROND.ZAND || grond[i] === GROND.AARDE) grond[i] = GROND.GRAS_DONKER;
        }
      }
    }
    // Wat van het kamp af niet te bereiken is, wordt bos.
    const vrij = (x, y) => x >= 0 && y >= 0 && x < breedte && y < hoogte && grond[y * breedte + x] !== GROND.WATER && object[y * breedte + x] === OBJECT.GEEN;
    const gezien = new Uint8Array(aantal);
    const rij = [];
    let gestart = false;
    // Begin bij de deur van de commandotent: die tegel is altijd vrij.
    if (vrij(m.x + 2, m.y)) { rij.push(m.y * breedte + m.x + 2); gezien[rij[0]] = 1; gestart = true; }
    while (rij.length) {
      const i = rij.pop();
      const x = i % breedte;
      const y = (i - x) / breedte;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (y + dy) * breedte + x + dx;
        if (!vrij(x + dx, y + dy) || gezien[j]) continue;
        gezien[j] = 1;
        rij.push(j);
      }
    }
    for (let y = m.y - tot; y <= m.y + tot; y++) {
      for (let x = m.x - tot; x <= m.x + tot; x++) {
        if (x < 1 || y < 1 || x >= breedte - 1 || y >= hoogte - 1) continue;
        const i = y * breedte + x;
        if (gestart && vrij(x, y) && !gezien[i] && Math.max(Math.abs(x - m.x), Math.abs(y - m.y)) >= van) object[i] = OBJECT.BOOM;
      }
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
          if (object[i] === OBJECT.BOOM || ((omvang > RING || ontwerp.kamp) && object[i] !== OBJECT.GEEN)) object[i] = OBJECT.GEEN;
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
    // Eén ring (gewoon spel) of meer ringen (proloog: vier ringen, naar Karel). Alle poorten
    // aan de oostkant, op één lijn: dat is de weg naar het dorp.
    const maten = Array.isArray(r.eigenRingen) && r.eigenRingen.length ? r.eigenRingen : [RING];
    for (const M of maten) {
      for (let dy = -M; dy <= M; dy++) {
        for (let dx = -M; dx <= M; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== M) continue;
          const hoek = Math.abs(dx) === M && Math.abs(dy) === M;
          let soort = OBJECT.MUUR;
          if (hoek) soort = OBJECT.TOREN;
          else if (dx === M && dy === 0) soort = OBJECT.POORT;
          else if (r.bouwveld && dx === -M && dy === 0) soort = OBJECT.POORT;   // ook een poort naar het bouwveld in het westen
          else if (dx === 0 || dy === 0) soort = OBJECT.WACHTTOREN;
          const x = eigen.x + dx;
          const y = eigen.y + dy;
          if (x < 1 || y < 1 || x >= breedte - 1 || y >= hoogte - 1) continue;
          const i = y * breedte + x;
          object[i] = soort;
          eigenaar[i] = 1;
          if (maten.length > 1 && (grond[i] === GROND.WATER || grond[i] === GROND.ZAND)) grond[i] = GROND.GRAS_DONKER;
        }
      }
    }
    // Tussen de ringen: huizen, hutten, hooibergen, vaten en tenten, met lege stroken om te lopen en te bouwen.
    if (maten.length > 1) {
      const SOORTEN = [OBJECT.HUIS, OBJECT.HUT, OBJECT.HUIS, OBJECT.HOOIBERG, OBJECT.VATEN, OBJECT.TENT, OBJECT.HUT];
      let teller = 0;
      for (let k = 0; k + 1 < maten.length; k++) {
        const d = maten[k] + Math.round((maten[k + 1] - maten[k]) / 2);   // het midden van de strook
        for (let dy = -d; dy <= d; dy++) {
          for (let dx = -d; dx <= d; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
            if ((dx + 2 * dy + 100) % 3 !== 0) continue;                    // niet elke tegel: er blijft loopruimte
            if (dy >= -1 && dy <= 1 && dx > 0) continue;                    // de weg naar de poort blijft vrij
            if (Math.abs(dx) <= 1 || Math.abs(dy) <= 1) continue;          // en de plek bij de wachttorens
            const x = eigen.x + dx;
            const y = eigen.y + dy;
            if (x < 1 || y < 1 || x >= breedte - 1 || y >= hoogte - 1) continue;
            const i = y * breedte + x;
            if (grond[i] === GROND.WATER || (object[i] !== OBJECT.GEEN && object[i] !== OBJECT.BOOM)) continue;
            object[i] = SOORTEN[teller++ % SOORTEN.length];
          }
        }
      }
      // De weg door de poorten
      for (let dx = 1; dx <= maten[maten.length - 1] + 12; dx++) {
        const i = eigen.y * breedte + eigen.x + dx;
        if (object[i] === OBJECT.GEEN && grond[i] !== GROND.WATER) grond[i] = GROND.AARDE;
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
      const gx = eigen.x + dx;
      const gy = eigen.y + dy;
      if (gx < 1 || gy < 1 || gx >= breedte - 1 || gy >= hoogte - 1) continue;
      const i = gy * breedte + gx;
      if (grond[i] !== GROND.WATER) grond[i] = GROND.AARDE;
    }
  }

  // 5e. Het bouwveld van de proloog (naar Karel): een open stuk gras buiten de muren in het westen
  //     (links boven op het scherm), met rotsen en bomen, bereikbaar door een poort en een weg.
  //     De lessen van Bartholt wijzen hier de plekken aan.
  if (r.bouwveld) {
    const bv = r.bouwveld;
    const maten = Array.isArray(r.eigenRingen) && r.eigenRingen.length ? r.eigenRingen : [RING];
    const buiten = maten[maten.length - 1];
    const veldIn = (dx, dy) => dx >= bv.dx0 && dx <= bv.dx1 && dy >= bv.dy0 && dy <= bv.dy1;
    for (let dy = bv.dy0; dy <= bv.dy1; dy++) {
      for (let dx = bv.dx0; dx <= bv.dx1; dx++) {
        const x = eigen.x + dx;
        const y = eigen.y + dy;
        if (x < 1 || y < 1 || x >= breedte - 1 || y >= hoogte - 1) continue;
        const i = y * breedte + x;
        object[i] = OBJECT.GEEN;
        eigenaar[i] = 0;
        grond[i] = GROND.GRAS;
      }
    }
    // De weg van de westpoort naar het veld
    for (let dx = -2; dx >= bv.dx1 - 1; dx--) {
      const x = eigen.x + dx;
      const i = eigen.y * breedte + x;
      if (x < 1) break;
      if (object[i] === OBJECT.GEEN || object[i] === OBJECT.BOOM) {
        object[i] = OBJECT.GEEN;
        if (grond[i] !== GROND.WATER) grond[i] = GROND.AARDE;
      }
    }
    // Rotsen (voor de steengroeve) en een groepje bomen (voor de houthakker)
    for (const v of bv.vlekken) {
      for (let dy = -Math.ceil(v.straal); dy <= Math.ceil(v.straal); dy++) {
        for (let dx = -Math.ceil(v.straal); dx <= Math.ceil(v.straal); dx++) {
          if (Math.hypot(dx, dy) > v.straal) continue;
          const gx = v.dx + dx;
          const gy = v.dy + dy;
          if (!veldIn(gx, gy)) continue;
          const x = eigen.x + gx;
          const y = eigen.y + gy;
          if (x < 1 || y < 1 || x >= breedte - 1 || y >= hoogte - 1) continue;
          object[y * breedte + x] = OBJECT[v.soort];
        }
      }
    }
  }

  // 5f. Buitenposten (ontwerp.posten, level 6): kleine versterkte posten van rood ver van zijn burcht,
  //     elk met een eigen ringmuur, hoektorens, wachttorens en een poort naar jouw kant. In het midden
  //     staat later de bouwloods (js/loodsen.js); het erf is vrij voor het garnizoen (js/strijd.js).
  //       aantal: hoeveel posten; afstand: tegels van de burcht van rood; waaier: spreiding (radialen)
  //       om de richting naar jou; maat: halve zijde van de ring (3 = 7 bij 7 tegels, erf van 5 bij 5);
  //       binnen: [soort, dx, dy] decor op het erf. Een post staat nooit op water, rots of in de weg
  //       van het pad tussen de twee burchten, en is voor jou te voet bereikbaar.
  const posten = [];
  if (r.kasteel && r.kasteel.posten && !r.zonderRood) {
    const P = r.kasteel.posten;
    const M = P.maat || 3;
    const aantalP = Math.max(1, P.aantal || 2);
    const m = start[1];
    const hoek0 = Math.atan2(eigen.y - m.y, eigen.x - m.x);
    const afst = P.afstand || 20;
    const van = { x: eigen.x + RING + 1, y: eigen.y };
    const naar = { x: m.x - omvang - 1, y: m.y };
    // Afstand van een punt tot het pad tussen de twee poorten.
    const totPad = (x, y) => {
      const sx = naar.x - van.x;
      const sy = naar.y - van.y;
      const l2 = sx * sx + sy * sy || 1;
      const t = Math.max(0, Math.min(1, ((x - van.x) * sx + (y - van.y) * sy) / l2));
      return Math.hypot(x - (van.x + t * sx), y - (van.y + t * sy));
    };
    // Waar je te voet kunt komen vanaf jouw poort (bomen tellen niet mee: soldaten lopen door het bos).
    const bereikbaar = () => {
      const gezien = new Uint8Array(aantal);
      const rij = [van.y * breedte + van.x];
      gezien[rij[0]] = 1;
      while (rij.length) {
        const i = rij.pop();
        const x = i % breedte;
        const y = (i - x) / breedte;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= breedte || ny >= hoogte) continue;
          const j = ny * breedte + nx;
          if (gezien[j] || grond[j] === GROND.WATER || (object[j] !== OBJECT.GEEN && object[j] !== OBJECT.BOOM)) continue;
          gezien[j] = 1;
          rij.push(j);
        }
      }
      return gezien;
    };
    for (let n = 0; n < aantalP; n++) {
      const spreiding = aantalP === 1 ? 0 : (n / (aantalP - 1) - 0.5) * 2;
      const hoek = hoek0 + spreiding * (P.waaier || 0.8);
      const tx = Math.round(m.x + Math.cos(hoek) * afst);
      const ty = Math.round(m.y + Math.sin(hoek) * afst);
      const bereik = bereikbaar();
      // Een post kijkt naar jou: de poort zit aan de zijde die het dichtst bij jou ligt.
      const richting = (cx, cy) => {
        const dx = eigen.x - cx;
        const dy = eigen.y - cy;
        return Math.abs(dx) >= Math.abs(dy) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dy) || 1];
      };
      const past = (cx, cy) => {
        if (cx < M + 4 || cy < M + 4 || cx >= breedte - M - 4 || cy >= hoogte - M - 4) return false;
        if (Math.max(Math.abs(cx - m.x), Math.abs(cy - m.y)) < omvang + M + 6) return false;
        if (totPad(cx, cy) < M + 3) return false;
        if (posten.some((p) => Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy)) < 2 * M + 8)) return false;
        for (let dy = -M - 1; dy <= M + 1; dy++) {
          for (let dx = -M - 1; dx <= M + 1; dx++) {
            const i = (cy + dy) * breedte + cx + dx;
            if (grond[i] === GROND.WATER || eigenaar[i] || (object[i] !== OBJECT.GEEN && object[i] !== OBJECT.BOOM)) return false;
          }
        }
        const [rx, ry] = richting(cx, cy);
        // Het stuk vlak voor de poort moet voor jou bereikbaar zijn.
        return bereik[(cy + ry * (M + 2)) * breedte + cx + rx * (M + 2)] === 1;
      };
      let gekozen = null;
      for (let rad = 0; rad <= 18 && !gekozen; rad++) {
        for (let dy = -rad; dy <= rad && !gekozen; dy++) {
          for (let dx = -rad; dx <= rad; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
            if (past(tx + dx, ty + dy)) { gekozen = { x: tx + dx, y: ty + dy }; break; }
          }
        }
      }
      if (!gekozen) continue;
      const { x: cx, y: cy } = gekozen;
      const [rx, ry] = richting(cx, cy);
      for (let dy = -M; dy <= M; dy++) {
        for (let dx = -M; dx <= M; dx++) {
          const i = (cy + dy) * breedte + cx + dx;
          const rand = Math.max(Math.abs(dx), Math.abs(dy)) === M;
          if (!rand) { object[i] = OBJECT.GEEN; grond[i] = GROND.AARDE; eigenaar[i] = 0; continue; }
          const hoekPunt = Math.abs(dx) === M && Math.abs(dy) === M;
          const poort = dx === rx * M && dy === ry * M;
          let soort = OBJECT.MUUR;
          if (hoekPunt) soort = OBJECT.TOREN;
          else if (poort) soort = OBJECT.POORT;
          else if (dx === 0 || dy === 0) soort = OBJECT.WACHTTOREN;
          object[i] = soort;
          eigenaar[i] = 2;
          grond[i] = GROND.GRAS_DONKER;
        }
      }
      // Een pad van drie tegels vanaf de poort naar buiten, zonder bomen.
      for (let k = 1; k <= 4; k++) {
        const i = (cy + ry * (M + k)) * breedte + cx + rx * (M + k);
        if (object[i] === OBJECT.BOOM) object[i] = OBJECT.GEEN;
        if (grond[i] !== GROND.WATER) grond[i] = GROND.AARDE;
      }
      // Decor op het erf ([soort, dx, dy] ten opzichte van het midden van de post).
      const DECOR_BINNEN = { tent: OBJECT.TENT, hooiberg: OBJECT.HOOIBERG, put: OBJECT.PUT, vaten: OBJECT.VATEN, steen: OBJECT.STEEN, houwer: OBJECT.STEENHOUWER, kampvuur: OBJECT.KAMPVUUR, kraan: OBJECT.KRAAN, werkbank: OBJECT.WERKBANK, houtstapel: OBJECT.HOUTSTAPEL, ramgeraamte: OBJECT.RAMGERAAMTE };
      for (const [naam, dx, dy] of P.binnen || []) {
        const i = (cy + dy) * breedte + cx + dx;
        if (!DECOR_BINNEN[naam] || Math.max(Math.abs(dx), Math.abs(dy)) >= M || (dx === 0 && dy === 0) || object[i] !== OBJECT.GEEN) continue;
        object[i] = DECOR_BINNEN[naam];
      }
      posten.push({ vak: cy * breedte + cx, x: cx, y: cy, poort: { x: cx + rx * M, y: cy + ry * M }, maat: M });
    }
  }

  // 5g. Werven (ontwerp.werven, level 6): kleine werkplekken verspreid over de kaart, zodat het
  //     landschap op een werkplaats lijkt: steengroeven langs de rots, smidsen, houtwerven.
  //     Alleen decor (van niemand, zonder functie), met eigen toeval zodat de rest van de kaart gelijk blijft.
  //       aantal: hoeveel werven; sjablonen: namen uit WERF_SJABLONEN; naastSteen: liefst naast de rots.
  //       Een werf staat nooit op water, niet in jouw bouwgebied, niet op het pad tussen de burchten
  //       en niet vlak bij een post of bij het kasteel van rood.
  if (r.kasteel && r.kasteel.werven && !r.zonderRood) {
    const W = r.kasteel.werven;
    const rng = maakToeval((zaad || 1) + 7717);
    const SOORT = { houwer: OBJECT.STEENHOUWER, kraan: OBJECT.KRAAN, werkbank: OBJECT.WERKBANK, houtstapel: OBJECT.HOUTSTAPEL, ramgeraamte: OBJECT.RAMGERAAMTE, vaten: OBJECT.VATEN, hooiberg: OBJECT.HOOIBERG, kampvuur: OBJECT.KAMPVUUR, put: OBJECT.PUT, tent: OBJECT.TENT, hut: OBJECT.HUT, steen: OBJECT.STEEN };
    const SJABLONEN = {
      steenwerf: [['kraan', 0, 0], ['houwer', 2, 1], ['houwer', 2, -1], ['houtstapel', -2, 1], ['vaten', -1, -2]],
      zagerij: [['werkbank', 0, 0], ['houtstapel', 2, 1], ['houtstapel', -2, 1], ['vaten', 1, -2], ['kampvuur', -2, -2]],
      ramwerf: [['ramgeraamte', 0, 0], ['houtstapel', 2, 2], ['werkbank', -2, 1], ['hooiberg', 3, -1], ['kampvuur', 0, 3], ['tent', -2, -2]],
    };
    const m = start[1];
    const naamLijst = (W.sjablonen && W.sjablonen.length ? W.sjablonen : Object.keys(SJABLONEN)).filter((n) => SJABLONEN[n]);
    const van = { x: eigen.x + RING + 1, y: eigen.y };
    const naar = { x: m.x - omvang - 1, y: m.y };
    const totPad = (x, y) => {
      const sx = naar.x - van.x;
      const sy = naar.y - van.y;
      const l2 = sx * sx + sy * sy || 1;
      const t = Math.max(0, Math.min(1, ((x - van.x) * sx + (y - van.y) * sy) / l2));
      return Math.hypot(x - (van.x + t * sx), y - (van.y + t * sy));
    };
    const naastSteen = (x, y) => {
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < breedte && ny < hoogte && object[ny * breedte + nx] === OBJECT.STEEN) return true;
      }
      return false;
    };
    const gezet = [];
    const wens = W.aantal || 8;
    for (let poging = 0; poging < 900 && gezet.length < wens; poging++) {
      const cx = 4 + Math.floor(rng() * (breedte - 8));
      const cy = 4 + Math.floor(rng() * (hoogte - 8));
      const sjabloon = SJABLONEN[naamLijst[gezet.length % naamLijst.length]];
      // De eerste helft liefst naast de rots (steengroeven), de rest overal.
      if (W.naastSteen && gezet.length < wens / 2 && !naastSteen(cx, cy)) continue;
      if (Math.max(Math.abs(cx - eigen.x), Math.abs(cy - eigen.y)) < (W.vanThuis || 18)) continue;
      if (Math.max(Math.abs(cx - m.x), Math.abs(cy - m.y)) < omvang + 5) continue;
      if (totPad(cx, cy) < 4) continue;
      if (posten.some((p) => Math.max(Math.abs(p.x - cx), Math.abs(p.y - cy)) < p.maat + 6)) continue;
      if (gezet.some(([gx, gy]) => Math.max(Math.abs(gx - cx), Math.abs(gy - cy)) < (W.afstandTot || 9))) continue;
      let past = true;
      for (const [naam, dx, dy] of sjabloon) {
        const x = cx + dx;
        const y = cy + dy;
        const i = y * breedte + x;
        if (x < 2 || y < 2 || x >= breedte - 2 || y >= hoogte - 2 || grond[i] === GROND.WATER || eigenaar[i] || (object[i] !== OBJECT.GEEN && object[i] !== OBJECT.BOOM)) { past = false; break; }
      }
      if (!past) continue;
      for (const [naam, dx, dy] of sjabloon) {
        const i = (cy + dy) * breedte + cx + dx;
        object[i] = SOORT[naam];
        if (grond[i] !== GROND.WATER) grond[i] = GROND.AARDE;
      }
      gezet.push([cx, cy]);
    }
  }

  // 5h. Greyford (ontwerp.tol, level 7): een zandlopervormige kloof van onder (jij) naar boven (rood), met
  //     drie dikke muren van meerdere lagen achter elkaar en een rotseiland met twee torens voor de laatste muur.
  //     De lagen liggen strak tegen elkaar; alleen de eerste en laatste laag hebben een poort, ertussen loopt een
  //     smalle gang. Dit gebeurt na het spiegelen: de muren zijn niet symmetrisch.
  const tolRoutes = [];
  const eilandTorens = [];
  const tolMuren = [];
  const reservePlekken = [];
  {
    const T = r.kasteel && r.kasteel.tol;
    if (T) {
      const mid = T.midden;
      const muren = T.muren;
      const halfBij = (y) => {
        let h = 22;
        for (const w of muren) {
          const d = y < w.rij ? w.rij - y : y > w.rij + w.lagen - 1 ? y - (w.rij + w.lagen - 1) : 0;
          h = Math.min(h, w.half + 2 * d);
        }
        return h;
      };
      const natuur = (o) => o === OBJECT.GEEN || o === OBJECT.BOOM || o === OBJECT.STEEN;
      for (let y = 0; y < hoogte; y++) {
        const half = halfBij(y);
        for (let x = 0; x < breedte; x++) {
          const i = y * breedte + x;
          const rand = (fijn(x, y) - 0.5) * 1.6;
          const ver = Math.abs(x - mid);
          if (ver > half + rand && natuur(object[i])) {
            grond[i] = GROND.GRAS_DONKER;
            object[i] = OBJECT.STEEN;
          } else if (ver <= 3 && natuur(object[i])) {
            // De hoofdweg door de kloof blijft altijd open.
            object[i] = OBJECT.GEEN;
            if (grond[i] === GROND.WATER) grond[i] = GROND.ZAND;
          }
        }
      }
      const zetVast = (x, y, soort, ondergrond) => {
        if (x < 0 || y < 0 || x >= breedte || y >= hoogte) return;
        const i = y * breedte + x;
        object[i] = soort;
        grond[i] = ondergrond;
        if (soort === OBJECT.MUUR || soort === OBJECT.TOREN || soort === OBJECT.WACHTTOREN || soort === OBJECT.MOORDGATENTOREN || soort === OBJECT.POORT) eigenaar[i] = 2;
      };
      for (let w = 0; w < muren.length; w++) {
        const m = muren[w];
        const laatste = m.rij + m.lagen - 1;
        tolMuren.push({ rij: m.rij, lagen: m.lagen, half: m.half, sterkte: m.sterkte || 1 });
        for (let y = m.rij; y <= laatste; y++) {
          const rand = y === m.rij || y === laatste;
          for (let x = mid - m.half; x <= mid + m.half; x++) {
            const ver = Math.abs(x - mid);
            let soort = OBJECT.MUUR;
            let ondergrond = GROND.GRAS_DONKER;
            if (ver === 0) {
              if (rand) soort = OBJECT.POORT;
              else { soort = OBJECT.GEEN; ondergrond = GROND.AARDE; }   // de gang tussen de poorten
            } else if (rand && (ver === m.half || ver === m.half - 1)) soort = OBJECT.MOORDGATENTOREN;
            else if (rand && ver === 2) soort = OBJECT.MOORDGATENTOREN;   // naast de poort: de olie reikt tot de poort
            zetVast(x, y, soort, ondergrond);
          }
        }
        // Vóór en achter de poorten een strook aarde.
        for (const y of [m.rij - 1, laatste + 1]) {
          for (let x = mid - 1; x <= mid + 1; x++) {
            const i = y * breedte + x;
            if (object[i] !== OBJECT.MUUR) { grond[i] = GROND.AARDE; if (object[i] !== OBJECT.POORT) object[i] = OBJECT.GEEN; }
          }
        }
        // Wachters lopen op de voorste laag (die naar jou toe), links en rechts van de poort.
        const voor = laatste;
        const links = [];
        const rechts = [];
        for (let x = mid - m.half + 2; x <= mid - 3; x++) links.push(voor * breedte + x);
        for (let x = mid + 3; x <= mid + m.half - 2; x++) rechts.push(voor * breedte + x);
        tolRoutes.push(links, rechts);
      }
      // De tolweg: een strook aarde door de hele kloof en bij elke muur tolloketten (hutjes) en vaten voor de poort.
      for (let y = 12; y < hoogte - 12; y++) {
        for (let x = mid - 1; x <= mid + 1; x++) {
          const i = y * breedte + x;
          if (object[i] === OBJECT.GEEN && grond[i] !== GROND.WATER) grond[i] = GROND.AARDE;
        }
      }
      for (const m of muren) {
        const y1 = m.rij + m.lagen + 1;
        for (const [dx, dy, soort] of [[-4, 0, OBJECT.HUT], [4, 0, OBJECT.HUT], [-3, 1, OBJECT.VATEN], [3, 1, OBJECT.VATEN], [-5, 1, OBJECT.HOOIBERG]]) {
          const i = (y1 + dy) * breedte + mid + dx;
          if (object[i] === OBJECT.GEEN || object[i] === OBJECT.BOOM) { object[i] = soort; eigenaar[i] = 0; }
        }
      }
      // Voorschansen (tol.schansen: [x, y]): kleine versterkte posten in de voorhoven, met poort naar jou toe. Ze gelden als
      // buitenposten (kaart.posten): rood.postGarnizoen bepaalt wie erin staat. Zo kan rood schieten op wie een trebuchet bouwt.
      for (const [cx, cy] of T.schansen || []) {
        const M = 2;
        for (let dy = -M - 1; dy <= M + 1; dy++) {
          for (let dx = -M - 1; dx <= M + 1; dx++) {
            const i = (cy + dy) * breedte + cx + dx;
            const rand = Math.max(Math.abs(dx), Math.abs(dy));
            if (rand > M) { if (object[i] === OBJECT.BOOM) object[i] = OBJECT.GEEN; continue; }
            if (rand < M) { object[i] = OBJECT.GEEN; grond[i] = GROND.AARDE; eigenaar[i] = 0; continue; }
            const hoekPunt = Math.abs(dx) === M && Math.abs(dy) === M;
            zetVast(cx + dx, cy + dy, hoekPunt ? OBJECT.MOORDGATENTOREN : dx === 0 && dy === M ? OBJECT.POORT : OBJECT.MUUR, GROND.GRAS_DONKER);
          }
        }
        for (let k = 1; k <= 3; k++) { const i = (cy + M + k) * breedte + cx; if (object[i] === OBJECT.BOOM) object[i] = OBJECT.GEEN; grond[i] = GROND.AARDE; }
        posten.push({ vak: cy * breedte + cx, x: cx, y: cy, poort: { x: cx, y: cy + M }, maat: M });
      }
      // Stallen van de ruiterreserve (decor) en de plekken waar de ruiters staan.
      for (const [sx, sy] of T.stallen || []) { const i = sy * breedte + sx; if (object[i] === OBJECT.GEEN || object[i] === OBJECT.BOOM) { object[i] = OBJECT.STAL; grond[i] = GROND.AARDE; } }
      for (const [rx, ry] of T.reserve || []) reservePlekken.push(ry * breedte + rx);
      // Het rotseiland met twee torens voor de laatste muur.
      const E = T.eiland;
      if (E) {
        for (let y = E.y - E.straal; y <= E.y + E.straal; y++) {
          for (let x = mid - E.straal - 1; x <= mid + E.straal + 1; x++) {
            if (Math.hypot((x - mid) / 1.25, y - E.y) > E.straal) continue;
            const i = y * breedte + x;
            grond[i] = GROND.GRAS_DONKER;
            object[i] = OBJECT.STEEN;
          }
        }
        for (const dx of E.torens) {
          const i = E.y * breedte + mid + dx;
          object[i] = OBJECT.TOREN;
          eigenaar[i] = 2;
          eilandTorens.push(i);
        }
      }
    }
  }

  // 6. Looproutes voor de wachters op de muur, per kasteel. Elke muur is
  //    in tweeën gedeeld door een wachttoren of de poort.
  //    Bij meer ringen eerst de buitenste: daar staan de wachters het liefst.
  const routesRond = (m, teken, M, rond) => {
    const plek = (dx, dy) => (m.y + teken * dy) * breedte + m.x + teken * dx;
    const routes = [];
    if (rond) {
      // Een ronde ring: de muurtegels op de ring, op hoek gesorteerd, in stukken tussen de torens en poorten.
      const tegels = [];
      for (let dy = -M - 1; dy <= M + 1; dy++) {
        for (let dx = -M - 1; dx <= M + 1; dx++) {
          const d = Math.hypot(dx, dy);
          if (d < M - 0.62 || d >= M + 0.62) continue;
          const i = plek(dx, dy);
          if (i >= 0 && i < aantal && object[i] === OBJECT.MUUR) tegels.push({ i, dx, dy, a: Math.atan2(dy, dx) });
        }
      }
      tegels.sort((p, q) => p.a - q.a);
      let stuk = [];
      let vorige = null;
      for (const t of tegels) {
        if (vorige && Math.max(Math.abs(t.dx - vorige.dx), Math.abs(t.dy - vorige.dy)) > 1) {
          if (stuk.length > 1) routes.push(stuk);
          stuk = [];
        }
        stuk.push(t.i);
        vorige = t;
      }
      if (stuk.length > 1) routes.push(stuk);
      return routes;
    }
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
    { team: 1, midden: start[1], routes: r.zonderRood ? [] : [...ringen.slice().reverse().flatMap((ring) => routesRond(start[1], -1, ring.maat, ring.rond)), ...tolRoutes.filter((rt) => rt.length > 1)] },
  ];

  return { breedte, hoogte, zaad, naam: r.naam || '', grond, object, eigenaar, start, kastelen, omvang, posten, tolMuren, reservePlekken, eilandTorens, eilandSterkte: (r.kasteel && r.kasteel.tol && r.kasteel.tol.eiland && r.kasteel.tol.eiland.sterkte) || 1, verbonden: padGemaakt === 'ja' || !!(r.kasteel && r.kasteel.tol) };
}

export function binnenKaart(kaart, x, y) {
  return x >= 0 && y >= 0 && x < kaart.breedte && y < kaart.hoogte;
}

// Korte omschrijving van een tegel in gewoon Nederlands, voor in beeld.
OBJECT_TEKST[OBJECT.MOORDGATENTOREN] = 'murder-hole tower';
export function beschrijfTegel(kaart, x, y) {
  const i = y * kaart.breedte + x;
  const wat = OBJECT_TEKST[kaart.object[i]];
  return wat || GROND_TEKST[kaart.grond[i]];
}
