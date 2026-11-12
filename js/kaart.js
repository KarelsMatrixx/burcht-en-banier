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
  HOUTHAKKER: 17, STEENGROEVE: 18, BOOMGAARD: 19, WONING: 20, KAZERNE: 21, VOORRAADKAMER: 22, ZAGERIJ: 23, TARWEVELD: 24, BAKKERIJ: 25, KOPERMIJN: 26,
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
  'werk.houthakker', 'werk.steengroeve', 'werk.boomgaard', 'dorp.woning', 'leger.kazerne', 'dorp.voorraadkamer', 'werk.zagerij', 'werk.tarweveld', 'werk.bakkerij', 'werk.kopermijn',
];

const GROND_TEKST = ['gras', 'gras', 'zand', 'water', 'aarde', 'akker'];
const OBJECT_TEKST = [
  '', 'bos', 'steen', 'kopererts', 'muur', 'toren', 'poort', 'burcht', 'burcht', 'burcht', 'wachttoren',
  'huis', 'hut', 'tent', 'hooiberg', 'waterput', 'vaten', 'houthakkershut', 'steengroeve', 'boomgaard', 'woning', 'kazerne', 'voorraadkamer', 'zagerij', 'tarweveld', 'bakkerij', 'kopermijn',
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

  // Van wie een bouwwerk is: 0 = van niemand (decor), 1 = door de speler
  // gebouwd. Alleen wat je zelf bouwt kun je slopen.
  // 2 = van de rode heer: zijn ringmuur met torens en poort, en zijn burcht.
  const eigenaar = new Uint8Array(aantal);
  for (let dy = -RING; dy <= RING; dy++) {
    for (let dx = -RING; dx <= RING; dx++) {
      const i = (start[1].y + dy) * breedte + start[1].x + dx;
      const soort = object[i];
      const rand = Math.max(Math.abs(dx), Math.abs(dy)) === RING;
      const kern = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;
      const vesting = soort === OBJECT.MUUR || soort === OBJECT.TOREN || soort === OBJECT.WACHTTOREN || soort === OBJECT.POORT;
      if ((rand && vesting) || (kern && (soort === OBJECT.BURCHT || soort === OBJECT.BANIER_ROOD))) eigenaar[i] = 2;
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
    for (const [soort, dx, dy] of [[OBJECT.HOUTHAKKER, -RING - 3, -2], [OBJECT.STEENGROEVE, -RING - 3, 2], [OBJECT.BOOMGAARD, -2, RING + 3]]) {
      let beste = null;
      for (let y = m.y + dy - 4; y <= m.y + dy + 4; y++) {
        for (let x = m.x + dx - 4; x <= m.x + dx + 4; x++) {
          if (!vrij(x, y) || !vrij(x + 1, y) || !vrij(x - 1, y) || !vrij(x, y + 1) || !vrij(x, y - 1)) continue;
          if (Math.max(Math.abs(x - m.x), Math.abs(y - m.y)) <= RING + 1) continue;
          if (gekozen.some(([gx, gy]) => Math.abs(gx - x) <= 2 && Math.abs(gy - y) <= 2)) continue;
          const d = Math.abs(x - (m.x + dx)) + Math.abs(y - (m.y + dy));
          if (!beste || d < beste.d) beste = { x, y, d };
        }
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
    const naar = { x: start[1].x - RING - 1, y: start[1].y };
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
          if (object[i] === OBJECT.BOOM) object[i] = OBJECT.GEEN;
        }
      }
    }
    padGemaakt = !verbonden() ? 'geen' : 'ja';
  }

  // 6. Looproutes voor de wachters op de muur, per kasteel. Elke muur is
  //    in tweeën gedeeld door een wachttoren of de poort.
  const routesRond = (m, teken) => {
    const plek = (dx, dy) => (m.y + teken * dy) * breedte + m.x + teken * dx;
    const routes = [];
    for (const [van, tot] of [[-RING + 1, -1], [1, RING - 1]]) {
      const stukken = [[], [], [], []];
      for (let k = van; k <= tot; k++) {
        stukken[0].push(plek(k, -RING));   // achterste muur
        stukken[1].push(plek(k, RING));    // voorste muur
        stukken[2].push(plek(-RING, k));   // muur links
        stukken[3].push(plek(RING, k));    // muur met de poort
      }
      routes.push(...stukken);
    }
    return routes;
  };
  const kastelen = [
    { team: 0, midden: start[0], routes: [] },   // nog geen muren, dus geen wachters
    { team: 1, midden: start[1], routes: routesRond(start[1], -1) },
  ];

  return { breedte, hoogte, zaad, naam: r.naam || '', grond, object, eigenaar, start, kastelen, verbonden: padGemaakt === 'ja' };
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
