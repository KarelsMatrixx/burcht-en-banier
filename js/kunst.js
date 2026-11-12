// KUNST: tekent alle plaatjes met code, in de eigen stijl van het spel.
// Dit zijn de plaatjes die het spel gebruikt zolang er geen sprite is.
//
// Vaste afspraken voor de stijl:
//   - Het licht komt van rechts: rechter vlakken zijn licht, linker donker.
//   - Warme kalksteen voor het kasteel, steen voor steen getekend, met
//     verwering en mos onderaan.
//   - Gedempt groen land dat zacht overloopt in zand, aarde en water.
//   - Teamkleur zit in wapenrok, schild, pluim en banier.
//
// Elke functie geeft een plaatje terug met zijn maat (b, h) en ankerpunt
// (ax, ay). Sommige geven meerdere varianten terug, zodat het land er
// niet uitziet als een herhaald stempel.

import { CONFIG } from './config.js';

const TB = CONFIG.tegel.breedte;
const TH = CONFIG.tegel.hoogte;
const HB = TB / 2;
const HH = TH / 2;
const SCHERPTE = 2;   // 2x zo groot tekenen, dan blijft het scherp bij inzoomen

// --- Gereedschap -----------------------------------------------------------

function nieuwDoek(breedte, hoogte) {
  const doek = document.createElement('canvas');
  doek.width = Math.ceil(breedte * SCHERPTE);
  doek.height = Math.ceil(hoogte * SCHERPTE);
  const ctx = doek.getContext('2d');
  ctx.scale(SCHERPTE, SCHERPTE);
  return { doek, ctx };
}

// Vaste toevalsgetallen per naam: een plaatje ziet er elke keer hetzelfde uit.
function toevalVoor(tekst) {
  let h = 2166136261;
  for (let i = 0; i < tekst.length; i++) h = Math.imul(h ^ tekst.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// Maakt een kleur lichter (sterkte boven 0) of donkerder (onder 0).
// De kleur mag "#rrggbb" zijn of een eerdere uitkomst "rgb(r,g,b)".
function tint(kleur, sterkte) {
  let delen;
  if (kleur[0] === '#') {
    const getal = parseInt(kleur.slice(1), 16);
    delen = [(getal >> 16) & 255, (getal >> 8) & 255, getal & 255];
  } else {
    delen = kleur.match(/\d+/g).map(Number);
  }
  const doel = sterkte < 0 ? 0 : 255;
  const deel = Math.min(1, Math.abs(sterkte));
  const meng = (kanaal) => Math.round(kanaal + (doel - kanaal) * deel);
  return `rgb(${meng(delen[0])},${meng(delen[1])},${meng(delen[2])})`;
}

function omtrek(ctx, punten) {
  ctx.beginPath();
  punten.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

function vlak(ctx, punten, kleur) {
  omtrek(ctx, punten);
  ctx.fillStyle = kleur;
  ctx.fill();
}

function ovaal(ctx, x, y, rx, ry, kleur) {
  ctx.fillStyle = kleur;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function blok(ctx, x, y, b, h, kleur) {
  ctx.fillStyle = kleur;
  ctx.fillRect(x, y, b, h);
}

function lijn(ctx, x1, y1, x2, y2, kleur, dikte) {
  ctx.strokeStyle = kleur;
  ctx.lineWidth = dikte;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

const tussen = (P, Q, deel) => [P[0] + (Q[0] - P[0]) * deel, P[1] + (Q[1] - P[1]) * deel];

// --- Land ------------------------------------------------------------------

const AANTAL_GROND = 8;

function grondTegel(naam, def, variant) {
  // Eén pixel groter dan de tegel, zodat er geen kiertjes tussen tegels komen.
  const b = TB + 2;
  const h = TH + 2;
  const { doek, ctx } = nieuwDoek(b, h);
  const T = [b / 2, 0];
  const R = [b, h / 2];
  const B = [b / 2, h];
  const L = [0, h / 2];
  const toeval = toevalVoor(naam + variant);
  const ergens = () => [toeval() * b, toeval() * h];
  vlak(ctx, [T, R, B, L], def.kleur);

  ctx.save();
  omtrek(ctx, [T, R, B, L]);
  ctx.clip();
  const vlekken = (aantal, licht, donker) => {
    for (let i = 0; i < aantal; i++) {
      const [x, y] = ergens();
      ovaal(ctx, x, y, 5 + toeval() * 10, 2.5 + toeval() * 4.5, toeval() < 0.5 ? licht : donker);
    }
  };

  if (def.patroon === 'water') {
    vlekken(4, 'rgba(120,190,210,0.07)', 'rgba(0,20,50,0.12)');
    for (let i = 0; i < 6; i++) {
      const [x, y] = ergens();
      const lang = 4 + toeval() * 9;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + lang / 2, y - 1.6, x + lang, y);
      ctx.stroke();
    }
  } else if (def.patroon === 'akker') {
    // Voren in de lengte van de akker, met halmen ertussen.
    for (let i = 0; i < 8; i++) {
      const a = tussen(T, L, (i + 0.5) / 8);
      const z = tussen(R, B, (i + 0.5) / 8);
      lijn(ctx, a[0], a[1], z[0], z[1], i % 2 ? 'rgba(95,65,15,0.30)' : 'rgba(255,235,150,0.22)', 1.5);
    }
    for (let i = 0; i < 46; i++) {
      const [x, y] = ergens();
      blok(ctx, x, y, 0.8, 2.4, toeval() < 0.6 ? 'rgba(250,225,130,0.55)' : 'rgba(120,85,20,0.35)');
    }
  } else if (def.patroon === 'aarde') {
    vlekken(6, 'rgba(210,190,150,0.10)', 'rgba(40,25,10,0.14)');
    for (let i = 0; i < 12; i++) {
      const [x, y] = ergens();
      ovaal(ctx, x, y, 0.8 + toeval() * 1.2, 0.6 + toeval() * 0.6, toeval() < 0.5 ? 'rgba(200,195,180,0.5)' : 'rgba(50,35,20,0.35)');
    }
    for (let i = 0; i < 10; i++) {
      const [x, y] = ergens();
      blok(ctx, x, y, 2.4, 0.7, 'rgba(215,190,120,0.28)');
    }
  } else if (def.patroon === 'zand') {
    vlekken(5, 'rgba(255,245,210,0.10)', 'rgba(80,60,20,0.09)');
    for (let i = 0; i < 26; i++) {
      const [x, y] = ergens();
      blok(ctx, x, y, 1.5, 0.8, toeval() < 0.5 ? 'rgba(255,250,220,0.22)' : 'rgba(90,65,25,0.18)');
    }
    if (variant % 4 === 3) {
      for (let i = 0; i < 3; i++) {
        const [x, y] = ergens();
        ovaal(ctx, x, y, 1.6, 1.1, 'rgba(150,145,135,0.8)');
      }
    }
  } else {
    // Gras: vlekken, sprietjes en hier en daar bloemen, steentjes of dor gras.
    vlekken(6, 'rgba(255,250,190,0.07)', 'rgba(10,35,0,0.10)');
    if (variant === 7) {
      const [x, y] = ergens();
      ovaal(ctx, x, y, 11, 5, 'rgba(190,170,90,0.22)');
    }
    for (let i = 0; i < 44; i++) {
      const [x, y] = ergens();
      blok(ctx, x, y, 0.8, 1.4 + toeval() * 1.6, toeval() < 0.5 ? 'rgba(235,245,170,0.20)' : 'rgba(0,30,0,0.20)');
    }
    if (variant === 5) {
      for (let i = 0; i < 5; i++) {
        const [x, y] = ergens();
        ovaal(ctx, x, y, 0.9, 0.9, toeval() < 0.5 ? 'rgba(255,255,255,0.85)' : 'rgba(250,220,90,0.9)');
      }
    }
    if (variant === 6) {
      for (let i = 0; i < 3; i++) {
        const [x, y] = ergens();
        ovaal(ctx, x, y + 0.6, 2, 1.2, 'rgba(0,0,0,0.2)');
        ovaal(ctx, x, y, 1.8, 1.2, 'rgba(160,158,150,0.9)');
      }
    }
  }
  ctx.restore();
  return { beeld: doek, b, h, ax: b / 2, ay: h - 1 };
}

// Een zachte rand van deze grondsoort, die over de buurtegel heen valt.
// rand: 0 = rechtsboven, 1 = rechtsonder, 2 = linksonder, 3 = linksboven
// (gezien vanaf de tegel waar de rand OP komt te liggen).
function grondRand(naam, def, rand, variant) {
  const b = TB + 2;
  const h = TH + 2;
  const { doek, ctx } = nieuwDoek(b, h);
  const hoeken = [[b / 2, 0], [b, h / 2], [b / 2, h], [0, h / 2]];
  const P = hoeken[rand];
  const Q = hoeken[(rand + 1) % 4];
  const toeval = toevalVoor(`${naam}rand${rand}${variant}`);

  ctx.save();
  omtrek(ctx, hoeken);
  ctx.clip();
  const bollen = [];
  const aantal = 9;
  for (let i = 0; i < aantal; i++) {
    const [x, y] = tussen(P, Q, (i + 0.15 + toeval() * 0.7) / aantal);
    bollen.push([x, y, 2.6 + toeval() * 5.2]);
  }
  const zoom = def.patroon === 'zand' ? 'rgba(255,255,255,0.40)' : 'rgba(15,10,0,0.22)';
  for (const [x, y, r] of bollen) ovaal(ctx, x, y + 0.9, r + 1.4, (r + 1.4) * 0.6, zoom);
  for (const [x, y, r] of bollen) ovaal(ctx, x, y, r, r * 0.6, def.kleur);
  ctx.restore();
  return { beeld: doek, b, h, ax: b / 2, ay: h - 1 };
}

export function tekenGrond(naam, def) {
  return {
    kies: 'toeval',
    varianten: Array.from({ length: AANTAL_GROND }, (_, v) => grondTegel(naam, def, v)),
    randen: [0, 1, 2, 3].map((rand) => [0, 1].map((v) => grondRand(naam, def, rand, v))),
    rang: def.rang || 0,
    soort: def.soort || naam,
  };
}

function loofboom(naam, def, variant) {
  const b = 76;
  const h = 104;
  const { doek, ctx } = nieuwDoek(b, h);
  const mx = b / 2;
  const voet = h - HH;   // het midden van de tegel
  const groot = [1, 1.14, 0.9][variant % 3];
  const kruin = voet - 29 * groot;
  const kleur = variant === 2 ? tint(def.kleur, -0.1) : def.kleur;

  ovaal(ctx, mx + 3, voet + 1, 18 * groot, 7.5 * groot, 'rgba(0,0,0,0.24)');
  blok(ctx, mx - 2.6, voet - 16 * groot, 5.2, 16 * groot, '#5d4127');
  blok(ctx, mx - 2.6, voet - 16 * groot, 2, 16 * groot, 'rgba(0,0,0,0.25)');

  const bol = ([x, y, r], k) => ovaal(ctx, mx + x * groot, kruin + y * groot, r * groot, r * groot * 0.92, k);
  [[-11, 5, 11], [10, 6, 11], [0, -1, 15], [-7, -11, 10], [8, -10, 10]].forEach((p) => bol(p, tint(kleur, -0.32)));
  [[3, -3, 13], [-6, 2, 8.5], [10, 2, 8.5], [2, -13, 8.5]].forEach((p) => bol(p, kleur));
  [[7, -9, 6], [12, -1, 4.5], [0, -15, 4.5], [-4, -4, 4]].forEach((p) => bol(p, tint(kleur, 0.16)));
  // Lichtvlekjes in het blad
  const toeval = toevalVoor(naam + 'blad' + variant);
  for (let i = 0; i < 16; i++) {
    const hoek = toeval() * Math.PI * 2;
    const ver = toeval() * 13 * groot;
    ovaal(ctx, mx + 3 + Math.cos(hoek) * ver, kruin - 4 + Math.sin(hoek) * ver * 0.9, 1.3, 1, toeval() < 0.6 ? 'rgba(255,255,200,0.16)' : 'rgba(0,20,0,0.16)');
  }
  return { beeld: doek, b, h, ax: b / 2, ay: h };
}

function den(naam, def, variant) {
  const b = 64;
  const h = 100;
  const { doek, ctx } = nieuwDoek(b, h);
  const mx = b / 2;
  const voet = h - HH;
  const groot = variant === 4 ? 1.12 : 1;
  const kleur = tint(def.kleur, -0.2);

  ovaal(ctx, mx + 3, voet + 1, 14 * groot, 6 * groot, 'rgba(0,0,0,0.24)');
  blok(ctx, mx - 2.2, voet - 14, 4.4, 14, '#553b24');

  // Vier lagen takken: [onderkant, halve breedte, hoogte]
  const lagen = [[-8, 15, 22], [-22, 12.5, 20], [-35, 10, 18], [-47, 7, 16]];
  for (const [onder, half, hoog] of lagen) {
    const y = voet + onder * groot;
    const w = half * groot;
    const top = y - hoog * groot;
    vlak(ctx, [[mx - w, y], [mx, top], [mx + w, y], [mx + w * 0.45, y - 2.5], [mx, y + 1.5], [mx - w * 0.45, y - 2.5]], kleur);
    vlak(ctx, [[mx - w, y], [mx, top], [mx, y + 1.5], [mx - w * 0.45, y - 2.5]], 'rgba(0,0,0,0.24)');
    vlak(ctx, [[mx + w * 0.3, y - hoog * groot * 0.45], [mx + w, y], [mx + w * 0.45, y - 2.5]], 'rgba(255,255,220,0.12)');
  }
  return { beeld: doek, b, h, ax: b / 2, ay: h };
}

function struik(naam, def) {
  const b = TB;
  const h = 44;
  const { doek, ctx } = nieuwDoek(b, h);
  const mx = b / 2;
  const voet = h - HH;
  const kleur = tint(def.kleur, -0.06);
  ovaal(ctx, mx + 2, voet + 2, 13, 5.5, 'rgba(0,0,0,0.22)');
  [[-6, -3, 7], [6, -3, 7], [0, -7, 8]].forEach(([x, y, r]) => ovaal(ctx, mx + x, voet + y, r, r * 0.85, tint(kleur, -0.3)));
  [[2, -6, 6.5], [-5, -3, 5], [7, -3, 4.5]].forEach(([x, y, r]) => ovaal(ctx, mx + x, voet + y, r, r * 0.85, kleur));
  [[4, -8, 3], [8, -4, 2.2]].forEach(([x, y, r]) => ovaal(ctx, mx + x, voet + y, r, r * 0.85, tint(kleur, 0.18)));
  return { beeld: doek, b, h, ax: b / 2, ay: h };
}

export function tekenBoom(naam, def) {
  return {
    kies: 'toeval',
    varianten: [
      loofboom(naam, def, 0), loofboom(naam, def, 1), loofboom(naam, def, 2),
      den(naam, def, 3), den(naam, def, 4), loofboom(naam, def, 0), struik(naam, def),
    ],
  };
}

export function tekenRots(naam, def) {
  const b = TB;
  const h = 58;
  const { doek, ctx } = nieuwDoek(b, h);
  const mx = b / 2;
  const voet = h - HH;
  const p = (punten) => punten.map(([x, y]) => [mx + x, voet + y]);

  ovaal(ctx, mx + 2, voet + 3, 21, 8, 'rgba(0,0,0,0.26)');
  vlak(ctx, p([[-17, 1], [-13, -13], [-3, -21], [9, -16], [15, -4], [9, 5], [-8, 6]]), def.kleur);
  vlak(ctx, p([[-13, -13], [-3, -21], [9, -16], [3, -9], [-6, -8]]), 'rgba(255,255,240,0.26)');
  vlak(ctx, p([[-17, 1], [-13, -13], [-6, -8], [-8, 6]]), 'rgba(0,0,0,0.24)');
  vlak(ctx, p([[3, -9], [9, -16], [15, -4], [9, 5]]), 'rgba(255,255,240,0.08)');
  vlak(ctx, p([[6, 5], [9, -6], [17, -9], [22, 0], [17, 7]]), tint(def.kleur, -0.08));
  vlak(ctx, p([[9, -6], [17, -9], [22, 0], [15, -2]]), 'rgba(255,255,240,0.20)');
  vlak(ctx, p([[6, 5], [9, -6], [13, -1], [12, 6]]), 'rgba(0,0,0,0.24)');
  // Barsten en wat mos
  lijn(ctx, mx - 6, voet - 8, mx - 3, voet + 3, 'rgba(0,0,0,0.25)', 0.7);
  lijn(ctx, mx + 3, voet - 9, mx + 6, voet - 1, 'rgba(0,0,0,0.2)', 0.7);
  ovaal(ctx, mx - 9, voet + 3, 5, 1.8, 'rgba(78,104,46,0.5)');

  if (def.accent) {
    // Kopererts: oranje aders met groene vlekjes (patina).
    for (const [x, y, lang] of [[-9, -12, 5], [-2, -5, 6], [4, -12, 5], [11, -3, 5], [-5, -17, 4], [15, -5, 4]]) {
      lijn(ctx, mx + x, voet + y, mx + x + lang, voet + y + 2, def.accent, 2);
      ovaal(ctx, mx + x + lang * 0.5, voet + y + 1, 0.9, 0.9, tint(def.accent, 0.35));
    }
    if (def.patina) for (const [x, y] of [[-6, -9], [7, -14], [12, 0], [-11, -3], [1, -17]]) ovaal(ctx, mx + x, voet + y, 1.6, 1.1, def.patina);
  }
  return { beeld: doek, b, h, ax: b / 2, ay: h };
}

// --- Soldaten --------------------------------------------------------------
// Een soldaat heeft vier beelden van een loopbeweging, naar rechts en
// gespiegeld naar links. Het ankerpunt is de plek van de voeten.
// Vechten heeft twee eigen beelden (houdingen.sla of houdingen.schiet):
// beeld 0 is klaarstaan, beeld 1 is de klap of het schot.

function loopbeelden(tekenBeeld, lijst = [0, 1, 2, 3], b = 26, h = 38, ay = 34) {
  const maak = (beeld, spiegel) => {
    const { doek, ctx } = nieuwDoek(b, h);
    if (spiegel) {
      ctx.translate(b, 0);
      ctx.scale(-1, 1);
    }
    tekenBeeld(ctx, beeld);
    return doek;
  };
  return {
    rechts: lijst.map((f) => maak(f, false)),
    links: lijst.map((f) => maak(f, true)),
    b,
    h,
    ax: b / 2,
    ay,
  };
}

export function tekenRidder(naam, def) {
  const staal = '#c6cbd3';
  // steek: -1 = lopen, 0 = de speer geveld, 1 = de steek.
  const teken = (ctx, beeld, steek) => {
    const vecht = steek >= 0;
    const wip = !vecht && beeld % 2 ? -1 : 0;       // op en neer tijdens het lopen
    const pas = vecht ? 1.9 : [0, 1.7, 0, -1.7][beeld];   // benen naar voren en achteren
    const mx = vecht ? 12 + steek : 13;             // bij de steek leunt hij naar voren

    ovaal(ctx, 13, 34, 7.5, 3, 'rgba(0,0,0,0.32)');
    if (!vecht) {
      // Speer met punt
      lijn(ctx, 19.5, 33, 19.5, 5 + wip, '#4e3a22', 1.3);
      vlak(ctx, [[19.5, 1 + wip], [21.2, 5.6 + wip], [17.8, 5.6 + wip]], '#e3e7ec');
    }
    // Benen met scheenplaten
    blok(ctx, mx - 3.6 + pas, 27 + wip, 2.9, 7 - wip, '#43434c');
    blok(ctx, mx + 0.7 - pas, 27 + wip, 2.9, 7 - wip, '#36363e');
    blok(ctx, mx - 3.6 + pas, 29.5 + wip, 2.9, 2.2, 'rgba(200,205,214,0.55)');
    blok(ctx, mx + 0.7 - pas, 29.5 + wip, 2.9, 2.2, 'rgba(200,205,214,0.4)');
    // Wapenrok in teamkleur
    ovaal(ctx, mx, 17 + wip, 4.7, 2.6, def.kleur);
    blok(ctx, mx - 4.7, 17 + wip, 9.4, 11, def.kleur);
    blok(ctx, mx - 4.7, 17 + wip, 3, 11, 'rgba(0,0,0,0.24)');
    blok(ctx, mx + 2.6, 17 + wip, 2.1, 11, 'rgba(255,255,255,0.14)');
    blok(ctx, mx - 4.7, 23.2 + wip, 9.4, 1.2, 'rgba(0,0,0,0.5)');
    ovaal(ctx, mx + 0.6, 23.8 + wip, 0.9, 0.9, '#d8b24a');
    // Schouders en arm in staal
    ovaal(ctx, mx - 4.2, 18 + wip, 2.3, 2.3, tint(staal, -0.2));
    ovaal(ctx, mx + 4.2, 18 + wip, 2.3, 2.3, staal);
    blok(ctx, mx + 4.6, 18.5 + wip, 2.6, 5.5, staal);
    // Schild
    const s = [[mx - 8.6, 19 + wip], [mx - 1.4, 19 + wip], [mx - 1.4, 24.2 + wip], [mx - 5, 28.4 + wip], [mx - 8.6, 24.2 + wip]];
    vlak(ctx, s, tint(def.kleur, -0.18));
    omtrek(ctx, s);
    ctx.strokeStyle = '#efe6c8';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    blok(ctx, mx - 5.6, 19.9 + wip, 1.2, 6.6, '#efe6c8');
    // Helm met vizier en pluim
    ovaal(ctx, mx, 11.4 + wip, 4.7, 4.7, staal);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(mx, 11.4 + wip, 4.7, 4.7, 0, Math.PI / 2, Math.PI * 1.5);
    ctx.fill();
    ovaal(ctx, mx + 1.6, 9.4 + wip, 1.3, 1, 'rgba(255,255,255,0.55)');
    blok(ctx, mx - 0.6, 10.8 + wip, 4.6, 1.3, '#26262e');
    ovaal(ctx, mx - 0.8, 6 + wip, 2.7, 2, tint(def.kleur, 0.12));
    if (vecht) {
      // De speer geveld, en bij de steek een stuk naar voren.
      const punt = steek ? 25.6 : 22.2;
      lijn(ctx, punt - 16, 23.6, punt - 3, 21.6, '#4e3a22', 1.3);
      vlak(ctx, [[punt, 21.1], [punt - 3.8, 19.9], [punt - 3.3, 23.2]], '#e3e7ec');
      ovaal(ctx, mx + 5.6, 22.6, 1.5, 1.5, staal);
    }
  };
  const beelden = loopbeelden((ctx, beeld) => teken(ctx, beeld, -1));
  beelden.houdingen = { sla: loopbeelden((ctx, beeld) => teken(ctx, 0, beeld), [0, 1]) };
  return beelden;
}

export function tekenBoogschutter(naam, def) {
  // schot: -1 = lopen, 0 = de boog gespannen, 1 = net geschoten.
  const teken = (ctx, beeld, schot) => {
    const vecht = schot >= 0;
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.2 : [0, 1.7, 0, -1.7][beeld];
    const mx = 13;

    ovaal(ctx, mx, 34, 7, 2.8, 'rgba(0,0,0,0.32)');
    // Pijlkoker op de rug
    blok(ctx, mx - 6.8, 15 + wip, 2.4, 8, '#4e3a22');
    blok(ctx, mx - 6.6, 13.4 + wip, 0.7, 2, '#e8e2d0');
    blok(ctx, mx - 5.4, 13.8 + wip, 0.7, 1.6, '#e8e2d0');
    // Benen
    blok(ctx, mx - 3.4 + pas, 27 + wip, 2.8, 7 - wip, '#5a4630');
    blok(ctx, mx + 0.6 - pas, 27 + wip, 2.8, 7 - wip, '#4a3926');
    // Leren jas met riem
    blok(ctx, mx - 4.3, 17.5 + wip, 8.6, 10.5, '#8c6c45');
    blok(ctx, mx - 4.3, 17.5 + wip, 2.8, 10.5, 'rgba(0,0,0,0.24)');
    blok(ctx, mx - 4.3, 23.4 + wip, 8.6, 1.1, 'rgba(0,0,0,0.45)');
    // Schoudermantel en kap in teamkleur
    ovaal(ctx, mx, 17.6 + wip, 5.2, 3, def.kleur);
    ovaal(ctx, mx - 0.5, 10.8 + wip, 4.7, 4.7, def.kleur);
    ovaal(ctx, mx - 1.6, 10.8 + wip, 3.4, 4.4, 'rgba(0,0,0,0.18)');
    ovaal(ctx, mx + 1.2, 11.8 + wip, 2.9, 3, '#e2bd97');
    // Boog met pees
    ctx.strokeStyle = '#3d2c18';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(mx - 1, 20 + wip, 10, -1.0, 1.0);
    ctx.stroke();
    const px = mx - 1 + 10 * Math.cos(1.0);
    const py = 10 * Math.sin(1.0);
    if (schot === 0) {
      // Gespannen: de pees naar achteren en een pijl op de boog.
      lijn(ctx, px, 20 - py, mx - 0.5, 20, 'rgba(240,240,230,0.9)', 0.5);
      lijn(ctx, mx - 0.5, 20, px, 20 + py, 'rgba(240,240,230,0.9)', 0.5);
      lijn(ctx, mx - 0.5, 20, mx + 11.5, 20, '#3d2c18', 0.9);
      vlak(ctx, [[mx + 12.8, 20], [mx + 10.6, 18.9], [mx + 10.6, 21.1]], '#e3e7ec');
      ovaal(ctx, mx - 0.2, 20, 1.3, 1.3, '#e2bd97');
    } else {
      lijn(ctx, px, 20 + wip - py, px, 20 + wip + py, 'rgba(240,240,230,0.9)', 0.5);
    }
  };
  const beelden = loopbeelden((ctx, beeld) => teken(ctx, beeld, -1));
  beelden.houdingen = { schiet: loopbeelden((ctx, beeld) => teken(ctx, 0, beeld), [0, 1]) };
  return beelden;
}

// De bijlridder: breder en lager dan de ridder, met bontkraag, een open
// helm en een grote bijl met halvemaanvormige kop. Teamkleur op de rok.
// zwaai: -1 = lopen (bijl over de schouder), 0 = bijl boven het hoofd, 1 = de slag.
export function tekenBijlridder(naam, def) {
  const staal = '#b9bec6';
  const teken = (ctx, beeld, zwaai) => {
    const vecht = zwaai >= 0;
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 2 : [0, 1.6, 0, -1.6][beeld];
    const mx = vecht ? 12.5 + zwaai : 13;
    ovaal(ctx, 13, 34, 8.2, 3.1, 'rgba(0,0,0,0.32)');
    const kop = (x, y, hoek) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(hoek);
      vlak(ctx, [[0, -1], [3.2, -4.4], [5.4, -2.4], [5.8, 0], [5.4, 2.4], [3.2, 4.4], [0, 1]], '#d7dbe1');
      lijn(ctx, 5.4, -2.4, 5.4, 2.4, 'rgba(255,255,255,0.7)', 0.6);
      ctx.restore();
    };
    if (!vecht) {
      lijn(ctx, mx + 6.5, 27 + wip, mx - 2, 6 + wip, '#5a3d22', 1.5);   // steel over de schouder
      kop(mx - 2.2, 7 + wip, -2.0);
    }
    // Benen, breed
    blok(ctx, mx - 4.2 + pas, 27.5 + wip, 3.3, 6.5 - wip, '#3d3a36');
    blok(ctx, mx + 0.9 - pas, 27.5 + wip, 3.3, 6.5 - wip, '#2f2c29');
    // Rok in teamkleur, lijf in maliën
    blok(ctx, mx - 5.6, 18 + wip, 11.2, 10.5, '#7d8088');
    blok(ctx, mx - 5.6, 23 + wip, 11.2, 5.5, def.kleur);
    blok(ctx, mx - 5.6, 18 + wip, 3.2, 10.5, 'rgba(0,0,0,0.25)');
    for (let r = 0; r < 3; r++) lijn(ctx, mx - 5.4, 19.4 + r * 1.3 + wip, mx + 5.4, 19.4 + r * 1.3 + wip, 'rgba(255,255,255,0.12)', 0.5);
    blok(ctx, mx - 5.6, 22.4 + wip, 11.2, 1.3, '#3a2a1a');
    ovaal(ctx, mx + 0.5, 23 + wip, 1, 0.9, '#c9a24a');
    // Bontkraag
    ovaal(ctx, mx, 17.8 + wip, 6.4, 2.8, '#8b6a46');
    for (const dx of [-4.5, -2, 0.6, 3.2]) ovaal(ctx, mx + dx, 17.2 + wip, 1.4, 1.2, '#a5835c');
    // Armen
    ovaal(ctx, mx - 5.6, 19.5 + wip, 2.2, 2.4, tint(staal, -0.25));
    ovaal(ctx, mx + 5.6, 19.5 + wip, 2.2, 2.4, staal);
    // Hoofd met open helm en baard
    ovaal(ctx, mx + 0.6, 12.6 + wip, 3.4, 3.6, '#d9ae88');
    ovaal(ctx, mx + 0.8, 14.8 + wip, 3, 1.8, '#6a4a2c');
    ctx.fillStyle = staal;
    ctx.beginPath();
    ctx.ellipse(mx, 11.2 + wip, 4.4, 4, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    blok(ctx, mx - 4.4, 11 + wip, 8.8, 1.2, tint(staal, -0.2));
    blok(ctx, mx - 0.4, 7.4 + wip, 0.9, 3.8, tint(staal, 0.1));     // neusstuk en kam
    ovaal(ctx, mx + 1.6, 8.8 + wip, 1.1, 0.8, 'rgba(255,255,255,0.5)');
    ovaal(ctx, mx + 2, 12.4 + wip, 0.5, 0.5, '#2a1d14');
    if (vecht) {
      if (zwaai === 0) {
        // Bijl hoog boven het hoofd
        lijn(ctx, mx + 4.5, 20, mx - 3, 3, '#5a3d22', 1.6);
        kop(mx - 3.2, 3.6, -2.2);
        ovaal(ctx, mx + 3.8, 18.5, 1.5, 1.5, staal);
      } else {
        // De slag: bijl naar voren omlaag
        lijn(ctx, mx + 3, 19.5, mx + 12, 26, '#5a3d22', 1.6);
        kop(mx + 11.4, 25.6, 0.6);
        ovaal(ctx, mx + 4.2, 19.8, 1.5, 1.5, staal);
        lijn(ctx, mx + 6, 10, mx + 14, 20, 'rgba(255,255,255,0.35)', 0.8);   // zwaaispoor
      }
    }
  };
  const beelden = loopbeelden((ctx, beeld) => teken(ctx, beeld, -1));
  beelden.houdingen = { sla: loopbeelden((ctx, beeld) => teken(ctx, 0, beeld), [0, 1]) };
  return beelden;
}

// De kruisboogschutter: kleiner, leren kap, een kruisboog op borsthoogte en
// een koker bolts op de heup. Bruin en donkergroen; teamkleur op de mantel.
// schot: -1 = lopen, 0 = gespannen en gericht, 1 = net geschoten (opspannen).
export function tekenKruisboogschutter(naam, def) {
  const teken = (ctx, beeld, schot) => {
    const vecht = schot >= 0;
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.1 : [0, 1.5, 0, -1.5][beeld];
    const mx = 13;
    ovaal(ctx, mx, 34, 6.6, 2.7, 'rgba(0,0,0,0.32)');
    // Koker met bolts op de heup
    blok(ctx, mx + 3.6, 21 + wip, 2.2, 6.4, '#4e3a22');
    for (const dx of [0.3, 1.2]) blok(ctx, mx + 3.6 + dx, 19.6 + wip, 0.6, 1.6, '#9a8a6a');
    // Benen
    blok(ctx, mx - 3.2 + pas, 27.5 + wip, 2.7, 6.5 - wip, '#4a3a28');
    blok(ctx, mx + 0.5 - pas, 27.5 + wip, 2.7, 6.5 - wip, '#3c2f20');
    // Jas donkergroen met leren riem
    blok(ctx, mx - 4, 18.5 + wip, 8, 9.5, '#3f5a3a');
    blok(ctx, mx - 4, 18.5 + wip, 2.6, 9.5, 'rgba(0,0,0,0.25)');
    blok(ctx, mx - 4, 23.6 + wip, 8, 1.1, '#5a3d22');
    // Korte mantel in teamkleur over de schouders
    ovaal(ctx, mx - 0.5, 18.6 + wip, 5, 2.6, def.kleur);
    blok(ctx, mx - 5, 18.6 + wip, 2.4, 5, tint(def.kleur, -0.2));
    // Leren kap en gezicht
    ovaal(ctx, mx - 0.4, 12.6 + wip, 4.2, 4.4, '#7a5636');
    ovaal(ctx, mx - 1.6, 12.4 + wip, 3, 4, 'rgba(0,0,0,0.2)');
    ovaal(ctx, mx + 1.2, 13.4 + wip, 2.5, 2.7, '#e0b892');
    vlak(ctx, [[mx - 3.5, 10 + wip], [mx - 6, 15 + wip], [mx - 3, 14 + wip]], '#6a4a2c');
    // De kruisboog
    const kb = (x, y, gespannen) => {
      blok(ctx, x - 1, y - 0.7, 9, 1.4, '#5a3d22');            // de lade
      lijn(ctx, x + 6.5, y - 4.5, x + 6.5, y + 4.5, '#3d2c18', 1.3);   // de boog
      lijn(ctx, x + 6.5, y - 4.5, gespannen ? x + 1.5 : x + 6, y, 'rgba(240,240,230,0.9)', 0.5);
      lijn(ctx, x + 6.5, y + 4.5, gespannen ? x + 1.5 : x + 6, y, 'rgba(240,240,230,0.9)', 0.5);
      if (gespannen) {
        lijn(ctx, x + 1.5, y - 0.9, x + 9, y - 0.9, '#2b2118', 0.8);
        vlak(ctx, [[x + 10.2, y - 0.9], [x + 8.6, y - 1.8], [x + 8.6, y]], '#d7dbe1');
      }
    };
    if (!vecht) kb(mx - 3, 21 + wip, false);
    else if (schot === 0) kb(mx - 1, 20, true);
    else {
      kb(mx - 2.5, 22.5, false);
      ovaal(ctx, mx + 6, 18.5, 1.2, 1, 'rgba(255,255,255,0.4)');
    }
    ovaal(ctx, mx + 1, 20.6 + (vecht ? 0 : wip), 1.3, 1.3, '#e0b892');
  };
  const beelden = loopbeelden((ctx, beeld) => teken(ctx, beeld, -1));
  beelden.houdingen = { schiet: loopbeelden((ctx, beeld) => teken(ctx, 0, beeld), [0, 1]) };
  return beelden;
}

// De sluipmoordenaar: slank, licht gebogen, donkere kap met sjaal voor het
// gezicht, twee korte dolken. Donkergrijs met paars accent; de teamkleur
// zit op de sjaal. slag: -1 = lopen, 0 = dolken klaar, 1 = de kruisbeweging.
export function tekenSluipmoordenaar(naam, def) {
  const paars = '#7a4fb8';
  const teken = (ctx, beeld, slag) => {
    const vecht = slag >= 0;
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 2.2 : [0, 2, 0, -2][beeld];
    const mx = vecht ? 12.5 + slag : 13.5;   // licht voorovergebogen
    ovaal(ctx, 13, 34, 6, 2.5, 'rgba(0,0,0,0.3)');
    blok(ctx, mx - 3 + pas, 27.5 + wip, 2.4, 6.5 - wip, '#2a2a30');
    blok(ctx, mx + 0.6 - pas, 27.5 + wip, 2.4, 6.5 - wip, '#202026');
    // Slank lijf in donkere stof, schuin naar voren
    vlak(ctx, [[mx - 3.6, 28 + wip], [mx + 3.6, 28 + wip], [mx + 4.4, 18 + wip], [mx - 2, 17.5 + wip]], '#3a3a44');
    vlak(ctx, [[mx - 3.6, 28 + wip], [mx - 1.4, 28 + wip], [mx - 0.2, 17.6 + wip], [mx - 2, 17.5 + wip]], 'rgba(0,0,0,0.3)');
    blok(ctx, mx - 3.4, 23.2 + wip, 7.4, 1, paars);
    // Kap en sjaal (teamkleur)
    ovaal(ctx, mx + 1, 13.2 + wip, 4, 4.3, '#2c2c34');
    ovaal(ctx, mx + 2.2, 13.6 + wip, 2.2, 2.3, '#1a1a1f');
    blok(ctx, mx + 1.4, 12.6 + wip, 2.6, 0.9, '#d9c0a0');            // ogen in de spleet
    ovaal(ctx, mx + 2.6, 13 + wip, 0.4, 0.4, '#b48cff');
    vlak(ctx, [[mx - 2.4, 15.6 + wip], [mx + 4.8, 15.4 + wip], [mx + 4, 18.2 + wip], [mx - 2.2, 18.4 + wip]], def.kleur);
    vlak(ctx, [[mx - 2.4, 16 + wip], [mx - 5.6, 21 + wip], [mx - 3.4, 21.4 + wip], [mx - 1.2, 17.8 + wip]], tint(def.kleur, -0.2));   // wapperend eind
    const dolk = (x, y, hoek) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(hoek);
      blok(ctx, -0.6, -0.4, 1.6, 0.8, '#4a3020');
      vlak(ctx, [[1, -0.7], [5.2, 0], [1, 0.7]], '#d7dbe1');
      ctx.restore();
    };
    if (!vecht) {
      dolk(mx + 3.6, 22 + wip, 0.5);
      dolk(mx - 3, 22.5 + wip, 2.6);
    } else if (slag === 0) {
      dolk(mx + 4, 19, -0.6);
      dolk(mx + 3, 22, 0.6);
      ovaal(ctx, mx + 3.8, 19.6, 1, 1, '#d9c0a0');
    } else {
      dolk(mx + 5, 21, 0.9);
      dolk(mx + 5, 20, -0.9);
      lijn(ctx, mx + 6, 16, mx + 11, 25, 'rgba(180,140,255,0.5)', 0.7);
      lijn(ctx, mx + 6, 25, mx + 11, 16, 'rgba(180,140,255,0.5)', 0.7);
    }
  };
  const beelden = loopbeelden((ctx, beeld) => teken(ctx, beeld, -1));
  beelden.houdingen = { sla: loopbeelden((ctx, beeld) => teken(ctx, 0, beeld), [0, 1]) };
  return beelden;
}

// De vlammenwever: lange rode en oranje mantel met opstaande kraag, een
// staf met een gloeiende bol, vonken rond de handen. Teamkleur op de sjerp.
// worp: -1 = lopen, 0 = bol klaar in de hand, 1 = de bol gegooid.
export function tekenVlammenwever(naam, def) {
  const teken = (ctx, beeld, worp) => {
    const vecht = worp >= 0;
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const zwier = vecht ? 0 : [0, 1, 0, -1][beeld];
    const mx = 13;
    ovaal(ctx, mx, 34, 7, 2.8, 'rgba(0,0,0,0.3)');
    // Staf met gloeiende bol
    lijn(ctx, mx - 6, 33, mx - 6, 6 + wip, '#4a3020', 1.3);
    ovaal(ctx, mx - 6, 5 + wip, 3.4, 3.4, 'rgba(255,170,60,0.35)');
    ovaal(ctx, mx - 6, 5 + wip, 2, 2, '#ffb347');
    ovaal(ctx, mx - 6.5, 4.4 + wip, 0.8, 0.8, '#fff2c0');
    // Lange mantel tot de grond
    vlak(ctx, [[mx - 5, 18 + wip], [mx + 5, 18 + wip], [mx + 6.5 + zwier, 33], [mx - 5.5 + zwier, 33]], '#b83a22');
    vlak(ctx, [[mx - 1, 19 + wip], [mx + 5, 18 + wip], [mx + 6.5 + zwier, 33], [mx + 1 + zwier, 33]], '#e0702a');
    vlak(ctx, [[mx - 5, 18 + wip], [mx - 2.4, 18 + wip], [mx - 3 + zwier, 33], [mx - 5.5 + zwier, 33]], 'rgba(0,0,0,0.25)');
    blok(ctx, mx - 4.6, 23.5 + wip, 9.6, 1.6, def.kleur);           // sjerp in teamkleur
    // Opstaande kraag en hoofd
    vlak(ctx, [[mx - 5, 18 + wip], [mx - 4, 12 + wip], [mx - 1.5, 16.5 + wip]], '#8a2a18');
    vlak(ctx, [[mx + 5, 18 + wip], [mx + 4, 12 + wip], [mx + 1.5, 16.5 + wip]], '#c84a26');
    ovaal(ctx, mx + 0.4, 13 + wip, 3.2, 3.4, '#e2b896');
    ovaal(ctx, mx + 0.2, 10.4 + wip, 3.6, 2.2, '#3a2418');           // haar
    ovaal(ctx, mx + 1.6, 13 + wip, 0.5, 0.5, '#2a1d14');
    // Hand met vuur
    if (!vecht) {
      ovaal(ctx, mx + 5, 22 + wip, 1.3, 1.3, '#e2b896');
      ovaal(ctx, mx + 5.6, 20.6 + wip, 1, 1, 'rgba(255,200,80,0.8)');
    } else if (worp === 0) {
      ovaal(ctx, mx + 6, 15, 1.4, 1.4, '#e2b896');
      ovaal(ctx, mx + 6.6, 12.8, 3.4, 3.4, 'rgba(255,150,40,0.45)');
      ovaal(ctx, mx + 6.6, 12.8, 2.2, 2.2, '#ffcc55');
      for (const [dx, dy] of [[9, 10], [4, 10.5], [8.5, 15]]) ovaal(ctx, mx + dx, dy, 0.6, 0.6, '#ffe28a');
    } else {
      ovaal(ctx, mx + 8, 19, 1.4, 1.4, '#e2b896');
      lijn(ctx, mx + 9, 18.6, mx + 13, 17.6, 'rgba(255,170,60,0.6)', 1.2);
    }
  };
  const beelden = loopbeelden((ctx, beeld) => teken(ctx, beeld, -1));
  beelden.houdingen = { schiet: loopbeelden((ctx, beeld) => teken(ctx, 0, beeld), [0, 1]) };
  return beelden;
}

// De koning: 130% van een ridder. Staalgrijs harnas, tabbaard in teamkleur
// met een wapen, lange wapperende mantel, smalle gouden kroonband en een
// tweehandig zwaard met gouden pareerstang. Bij de koning van jou een
// zwarte rouwband om de linkerarm.
// slag: -1 = lopen (zwaard op de schouder), 0 = zwaard hoog, 1 = de brede zwaai.
export function tekenKoning(naam, def) {
  const staal = '#c3c8d0';
  const goud = '#e3c04a';
  const teken = (ctx, beeld, slag) => {
    const vecht = slag >= 0;
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 2 : [0, 1.7, 0, -1.7][beeld];
    const wapper = vecht ? 0 : [0, 1.5, 0, -1.5][beeld];
    const mx = 13;
    ovaal(ctx, 13, 34, 8.5, 3.2, 'rgba(0,0,0,0.34)');
    const zwaard = (x1, y1, x2, y2) => {
      lijn(ctx, x1, y1, x2, y2, '#e6e9ee', 1.6);
      lijn(ctx, x1, y1, x2, y2, 'rgba(255,255,255,0.6)', 0.5);
      const hoek = Math.atan2(y2 - y1, x2 - x1);
      const px = Math.cos(hoek + Math.PI / 2) * 2.4;
      const py = Math.sin(hoek + Math.PI / 2) * 2.4;
      lijn(ctx, x1 - px, y1 - py, x1 + px, y1 + py, goud, 1.2);   // pareerstang
      lijn(ctx, x1, y1, x1 - Math.cos(hoek) * 3, y1 - Math.sin(hoek) * 3, '#5a3d22', 1.4);
      ovaal(ctx, x1 - Math.cos(hoek) * 3.4, y1 - Math.sin(hoek) * 3.4, 0.8, 0.8, goud);
    };
    // Mantel achter het lijf, wapperend
    vlak(ctx, [[mx - 5, 17 + wip], [mx + 5, 17 + wip], [mx + 4 - wapper, 32], [mx - 8 - wapper * 1.5, 31.5]], tint(def.kleur, -0.28));
    if (!vecht) zwaard(mx + 4, 21 + wip, mx - 6, 1 + wip);   // op de schouder
    // Benen
    blok(ctx, mx - 3.8 + pas, 27 + wip, 3, 7 - wip, '#4a4a54');
    blok(ctx, mx + 0.8 - pas, 27 + wip, 3, 7 - wip, '#3a3a42');
    blok(ctx, mx - 3.8 + pas, 29.5 + wip, 3, 2, 'rgba(210,215,222,0.5)');
    // Tabbaard in teamkleur met wapen
    blok(ctx, mx - 5, 17 + wip, 10, 11.5, def.kleur);
    blok(ctx, mx - 5, 17 + wip, 3, 11.5, 'rgba(0,0,0,0.22)');
    blok(ctx, mx - 5, 23.4 + wip, 10, 1.2, '#3a2a1a');
    ovaal(ctx, mx + 0.4, 20.6 + wip, 1.8, 2.2, def.wapen || goud);   // het wapen (blad)
    lijn(ctx, mx + 0.4, 18.8 + wip, mx + 0.4, 22.6 + wip, 'rgba(0,0,0,0.35)', 0.4);
    // Schouders en armen in staal
    ovaal(ctx, mx - 4.8, 18 + wip, 2.6, 2.4, tint(staal, -0.2));
    ovaal(ctx, mx + 4.8, 18 + wip, 2.6, 2.4, staal);
    blok(ctx, mx - 6.6, 18.8 + wip, 2.4, 5.2, tint(staal, -0.2));
    if (def.rouwband) blok(ctx, mx - 6.7, 20.6 + wip, 2.6, 1.3, '#141418');
    // Hoofd: kort donker haar, korte baard met grijs, smalle gouden kroonband
    ovaal(ctx, mx + 0.4, 12.4 + wip, 3.8, 4.1, '#ddb48e');
    ovaal(ctx, mx + 0.2, 9.6 + wip, 3.9, 2.4, '#2e241c');
    ovaal(ctx, mx + 0.8, 15 + wip, 3.1, 1.9, '#3a2e24');
    ovaal(ctx, mx + 2, 15.3 + wip, 0.9, 0.6, '#8a8a8a');
    blok(ctx, mx - 3.6, 9.2 + wip, 7.6, 1.3, goud);
    for (const dx of [-2.6, 0.2, 3]) vlak(ctx, [[mx + dx - 0.9, 9.3 + wip], [mx + dx, 7.4 + wip], [mx + dx + 0.9, 9.3 + wip]], goud);
    ovaal(ctx, mx + 1.8, 12.2 + wip, 0.5, 0.5, '#2a1d14');
    if (vecht) {
      if (slag === 0) {
        zwaard(mx + 3.5, 16, mx - 2, -3);   // hoog geheven
        ovaal(ctx, mx + 3.5, 17, 1.6, 1.6, staal);
      } else {
        zwaard(mx + 4, 21, mx + 22, 25);    // brede zwaai opzij
        ovaal(ctx, mx + 4.4, 21, 1.6, 1.6, staal);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.arc(mx + 4, 18, 15, -1.3, 0.35);
        ctx.stroke();
      }
    }
  };
  const groot = (ctx, beeld, slag) => {
    // 130% van de ridder, met de voeten op dezelfde plek
    ctx.translate(17, 44);
    ctx.scale(1.3, 1.3);
    ctx.translate(-13, -34);
    teken(ctx, beeld, slag);
  };
  const beelden = loopbeelden((ctx, beeld) => groot(ctx, beeld, -1), [0, 1, 2, 3], 34, 48, 44);
  beelden.houdingen = { sla: loopbeelden((ctx, beeld) => groot(ctx, 0, beeld), [0, 1], 34, 48, 44) };
  return beelden;
}

// Een stormram: een houten afdak op wielen met een zware balk eronder. Het
// dak is bekleed met huiden in teamkleur. Lopen = de wielen draaien,
// houdingen.sla: beeld 0 = de balk naar achteren, beeld 1 = de stoot.
function rambeelden(tekenBeeld, lijst) {
  const b = 50;
  const h = 40;
  const maak = (beeld, spiegel) => {
    const { doek, ctx } = nieuwDoek(b, h);
    if (spiegel) {
      ctx.translate(b, 0);
      ctx.scale(-1, 1);
    }
    tekenBeeld(ctx, beeld);
    return doek;
  };
  return { rechts: lijst.map((f) => maak(f, false)), links: lijst.map((f) => maak(f, true)), b, h, ax: b / 2, ay: 35 };
}

export function tekenRam(naam, def) {
  const hout = '#7a5532';
  const donker = '#4e351e';
  // stoot: -1 = rijden, 0 = balk achter, 1 = balk vooruit. beeld = stand van de wielen.
  const teken = (ctx, beeld, stoot) => {
    const balk = stoot === 1 ? 6 : stoot === 0 ? -3 : 0;
    ovaal(ctx, 25, 35, 20, 4, 'rgba(0,0,0,0.32)');
    // De balk met ijzeren kop, hangend aan kettingen
    lijn(ctx, 18, 14, 18 + balk * 0.3, 22, '#3a3a40', 0.8);
    lijn(ctx, 32, 14, 32 + balk * 0.3, 22, '#3a3a40', 0.8);
    blok(ctx, 6 + balk, 21, 36, 4.4, hout);
    blok(ctx, 6 + balk, 21, 36, 1.4, 'rgba(255,255,255,0.12)');
    blok(ctx, 6 + balk, 24, 36, 1.4, 'rgba(0,0,0,0.25)');
    vlak(ctx, [[42 + balk, 19.6], [48 + balk, 21], [48 + balk, 25.4], [42 + balk, 26.8]], '#6d7078');
    blok(ctx, 41 + balk, 20, 1.6, 6.4, '#4b4d54');
    // Het onderstel
    blok(ctx, 5, 26, 40, 3, donker);
    blok(ctx, 7, 13, 2.6, 14, hout);
    blok(ctx, 40, 13, 2.6, 14, hout);
    // Het dak met huiden in teamkleur
    const dak = [[3, 15], [25, 4], [47, 15], [44, 17], [6, 17]];
    vlak(ctx, dak, def.kleur);
    vlak(ctx, [[3, 15], [25, 4], [25, 6.5], [6, 17]], 'rgba(255,255,255,0.12)');
    vlak(ctx, [[25, 4], [47, 15], [44, 17], [25, 6.5]], 'rgba(0,0,0,0.22)');
    for (let i = 0; i < 4; i++) lijn(ctx, 9 + i * 9, 13.5 - (i < 2 ? i * 3 : (3 - i) * 3), 11 + i * 9, 16.6, 'rgba(0,0,0,0.3)', 0.7);
    omtrek(ctx, dak);
    ctx.strokeStyle = 'rgba(30,20,10,0.6)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    blok(ctx, 23.6, 2.5, 2.8, 2.6, hout);
    // De wielen, met spaken die draaien
    for (const wx of [12, 38]) {
      ovaal(ctx, wx, 30, 4.6, 4.6, donker);
      ovaal(ctx, wx, 30, 3.4, 3.4, hout);
      const hoek = (beeld * Math.PI) / 4;
      for (let sp = 0; sp < 2; sp++) {
        const a = hoek + (sp * Math.PI) / 2;
        lijn(ctx, wx - Math.cos(a) * 3.4, 30 - Math.sin(a) * 3.4, wx + Math.cos(a) * 3.4, 30 + Math.sin(a) * 3.4, donker, 0.9);
      }
      ovaal(ctx, wx, 30, 1.1, 1.1, '#3a3a40');
    }
  };
  const beelden = rambeelden((ctx, beeld) => teken(ctx, beeld, -1), [0, 1, 2, 3]);
  beelden.houdingen = { sla: rambeelden((ctx, beeld) => teken(ctx, 0, beeld), [0, 1]) };
  return beelden;
}


// Een wagen met een eigen maat, voor de belegeringswerktuigen.
function wagenbeelden(b, h, ay, tekenBeeld, lijst) {
  const maak = (beeld, spiegel) => {
    const { doek, ctx } = nieuwDoek(b, h);
    if (spiegel) {
      ctx.translate(b, 0);
      ctx.scale(-1, 1);
    }
    tekenBeeld(ctx, beeld);
    return doek;
  };
  return { rechts: lijst.map((f) => maak(f, false)), links: lijst.map((f) => maak(f, true)), b, h, ax: b / 2, ay };
}

// Een katapult: een laag onderstel op wielen met een werparm. Lopen = de
// wielen draaien; houdingen.schiet: beeld 0 = de arm gespannen naar achteren,
// beeld 1 = de arm vooruit na de worp.
export function tekenKatapult(naam, def) {
  const hout = '#7a5532';
  const donker = '#4e351e';
  const teken = (ctx, wiel, arm) => {
    ovaal(ctx, 25, 35, 20, 4, 'rgba(0,0,0,0.32)');
    blok(ctx, 5, 24, 40, 4, donker);
    blok(ctx, 5, 24, 40, 1.3, 'rgba(255,255,255,0.12)');
    // twee schragen
    vlak(ctx, [[14, 24], [20, 10], [24, 10], [20, 24]], hout);
    vlak(ctx, [[28, 24], [32, 10], [36, 10], [34, 24]], hout);
    blok(ctx, 18, 9, 20, 3, donker);
    // de werparm: gespannen (arm 0) of vooruit (arm 1)
    const pivot = [28, 10];
    const hoek = arm === 0 ? 2.5 : 0.7;
    const lang = 20;
    const kort = 7;
    const ex = pivot[0] - Math.cos(hoek) * lang;
    const ey = pivot[1] - Math.sin(hoek) * lang * 0.9;
    lijn(ctx, pivot[0] + Math.cos(hoek) * kort, pivot[1] + Math.sin(hoek) * kort * 0.9, ex, ey, hout, 2.6);
    lijn(ctx, pivot[0] + Math.cos(hoek) * kort, pivot[1] + Math.sin(hoek) * kort * 0.9, pivot[0] + Math.cos(hoek) * (kort + 3), pivot[1] + Math.sin(hoek) * (kort + 3) * 0.9, '#6d7078', 4);
    // de lepel met een steen erin (alleen als de arm gespannen is)
    ovaal(ctx, ex, ey, 3.6, 2.2, donker);
    if (arm === 0) ovaal(ctx, ex, ey - 1.6, 2.6, 2.6, '#9a9a94');
    // een vlag in teamkleur
    vlak(ctx, [[10, 22], [10, 15], [17, 18.5]], def.kleur);
    lijn(ctx, 10, 23, 10, 14, '#3a2a18', 1);
    // wielen
    for (const wx of [11, 39]) {
      ovaal(ctx, wx, 30, 4.8, 4.8, donker);
      ovaal(ctx, wx, 30, 3.5, 3.5, hout);
      const w = (wiel * Math.PI) / 4;
      for (let sp = 0; sp < 2; sp++) {
        const a = w + (sp * Math.PI) / 2;
        lijn(ctx, wx - Math.cos(a) * 3.5, 30 - Math.sin(a) * 3.5, wx + Math.cos(a) * 3.5, 30 + Math.sin(a) * 3.5, donker, 0.9);
      }
      ovaal(ctx, wx, 30, 1.1, 1.1, '#3a3a40');
    }
  };
  const beelden = wagenbeelden(50, 40, 35, (ctx, beeld) => teken(ctx, beeld, 1), [0, 1, 2, 3]);
  beelden.houdingen = { schiet: wagenbeelden(50, 40, 35, (ctx, beeld) => teken(ctx, 0, beeld), [0, 1]) };
  return beelden;
}

// Een belegeringstoren: een hoge houten toren op wielen, bekleed met huiden
// in teamkleur, met een luik bovenaan. houdingen.sla: beeld 0 = het luik
// dicht, beeld 1 = het luik neer tegen de muur.
export function tekenBelegeringstoren(naam, def) {
  const hout = '#7a5532';
  const donker = '#4e351e';
  const teken = (ctx, wiel, luik) => {
    ovaal(ctx, 25, 55, 18, 4, 'rgba(0,0,0,0.32)');
    blok(ctx, 8, 44, 34, 4, donker);
    const romp = [[10, 44], [14, 8], [36, 8], [40, 44]];
    vlak(ctx, romp, def.kleur);
    vlak(ctx, [[10, 44], [14, 8], [22, 8], [19, 44]], 'rgba(255,255,255,0.12)');
    vlak(ctx, [[30, 44], [32, 8], [36, 8], [40, 44]], 'rgba(0,0,0,0.25)');
    for (let i = 0; i < 4; i++) lijn(ctx, 11 + i * 0.6, 14 + i * 9, 39 - i * 0.6, 14 + i * 9, donker, 1.2);
    omtrek(ctx, romp);
    ctx.strokeStyle = 'rgba(30,20,10,0.6)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // kantelen en het luik
    for (let k = 0; k < 4; k++) blok(ctx, 13 + k * 6, 4, 3.5, 4.5, hout);
    if (luik === 1) vlak(ctx, [[36, 9], [50, 14], [50, 18], [36, 13]], hout);
    else blok(ctx, 34, 12, 2.2, 14, hout);
    blok(ctx, 22, 20, 6, 8, '#1c150e');   // schietgleuf
    for (const wx of [14, 36]) {
      ovaal(ctx, wx, 50, 5, 5, donker);
      ovaal(ctx, wx, 50, 3.7, 3.7, hout);
      const w = (wiel * Math.PI) / 4;
      for (let sp = 0; sp < 2; sp++) {
        const a = w + (sp * Math.PI) / 2;
        lijn(ctx, wx - Math.cos(a) * 3.7, 50 - Math.sin(a) * 3.7, wx + Math.cos(a) * 3.7, 50 + Math.sin(a) * 3.7, donker, 0.9);
      }
    }
  };
  const beelden = wagenbeelden(52, 60, 55, (ctx, beeld) => teken(ctx, beeld, 0), [0, 1, 2, 3]);
  beelden.houdingen = { sla: wagenbeelden(52, 60, 55, (ctx, beeld) => teken(ctx, 0, beeld), [0, 1]) };
  return beelden;
}

// Een ladderdrager: een lichte soldaat met een lange ladder op zijn
// schouder. houdingen.sla: hij zet de ladder overeind (beeld 0) en tegen
// de muur (beeld 1).
export function tekenLadderdrager(naam, def) {
  const hout = '#9a7444';
  const ladder = (ctx, x1, y1, x2, y2) => {
    // twee bomen en sporten ertussen
    const lengte = Math.hypot(x2 - x1, y2 - y1);
    const nx = -(y2 - y1) / lengte * 1.6;
    const ny = (x2 - x1) / lengte * 1.6;
    lijn(ctx, x1 + nx, y1 + ny, x2 + nx, y2 + ny, hout, 1);
    lijn(ctx, x1 - nx, y1 - ny, x2 - nx, y2 - ny, tint(hout, -0.25), 1);
    const sporten = Math.floor(lengte / 3.2);
    for (let i = 1; i < sporten; i++) {
      const d = i / sporten;
      const px = x1 + (x2 - x1) * d;
      const py = y1 + (y2 - y1) * d;
      lijn(ctx, px + nx, py + ny, px - nx, py - ny, tint(hout, -0.15), 0.7);
    }
  };
  // zet: -1 = lopen, 0 = overeind, 1 = tegen de muur.
  const teken = (ctx, beeld, zet) => {
    const vecht = zet >= 0;
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.2 : [0, 1.7, 0, -1.7][beeld];
    const mx = 12;
    ovaal(ctx, mx, 34, 7, 2.8, 'rgba(0,0,0,0.32)');
    if (zet === 0) ladder(ctx, 17, 34, 19, 1);
    if (zet === 1) ladder(ctx, 18, 34, 25, 3);
    // Benen
    blok(ctx, mx - 3.4 + pas, 27 + wip, 2.8, 7 - wip, '#5a4a3a');
    blok(ctx, mx + 0.6 - pas, 27 + wip, 2.8, 7 - wip, '#4a3c2e');
    // Gewatteerde jas in teamkleur
    blok(ctx, mx - 4.3, 17.5 + wip, 8.6, 10.5, def.kleur);
    blok(ctx, mx - 4.3, 17.5 + wip, 2.8, 10.5, 'rgba(0,0,0,0.24)');
    for (const y of [20, 23, 26]) blok(ctx, mx - 4.3, y + wip, 8.6, 0.6, 'rgba(0,0,0,0.2)');
    // Hoofd met leren kap
    ovaal(ctx, mx + 0.6, 12 + wip, 3.4, 3.6, '#e2bd97');
    ovaal(ctx, mx, 10.4 + wip, 4, 2.8, '#6b5034');
    // Armen omhoog naar de ladder
    if (zet < 0) {
      blok(ctx, mx + 2.6, 13.5 + wip, 2, 5, '#e2bd97');
      ladder(ctx, -1, 14.5 + wip, 27, 11.5 + wip);
    } else {
      lijn(ctx, mx + 2, 18, 18.5, 14 - zet * 4, '#e2bd97', 1.8);
    }
  };
  const beelden = loopbeelden((ctx, beeld) => teken(ctx, beeld, -1));
  beelden.houdingen = { sla: loopbeelden((ctx, beeld) => teken(ctx, 0, beeld), [0, 1]) };
  return beelden;
}

// Een ladder tegen een muur, voor de tekenlaag: wordt op het scherm
// getekend tussen voet (op de grond) en top (boven op de muur).
export function tekenLadderOp(ctx, voetX, voetY, topX, topY, kleur = '#9a7444', breed = 3) {
  const lengte = Math.hypot(topX - voetX, topY - voetY) || 1;
  const nx = (-(topY - voetY) / lengte) * breed;
  const ny = ((topX - voetX) / lengte) * breed;
  ctx.lineCap = 'round';
  lijn(ctx, voetX + nx, voetY + ny, topX + nx, topY + ny, kleur, 1.6);
  lijn(ctx, voetX - nx, voetY - ny, topX - nx, topY - ny, tint(kleur, -0.3), 1.6);
  const sporten = Math.max(3, Math.floor(lengte / 6));
  for (let i = 1; i < sporten; i++) {
    const d = i / sporten;
    const px = voetX + (topX - voetX) * d;
    const py = voetY + (topY - voetY) * d;
    lijn(ctx, px + nx, py + ny, px - nx, py - ny, tint(kleur, -0.15), 1.1);
  }
  ctx.lineCap = 'butt';
}

// Een werker: een boer met een muts in teamkleur. Hij heeft drie
// houdingen: lopen met zijn gereedschap over de schouder, werken (hakken),
// en lopen met zijn vracht. gereedschap is "bijl", "houweel" of "mand" (een
// fruitteler: die plukt in plaats van hakt), vracht is
// "hout" of "steen".
export function tekenWerker(naam, def) {
  const kiel = def.kiel || '#b39a6b';
  const huid = '#e2bd97';
  const steel = '#5a4126';
  const staal = '#c9ced6';
  const stam = '#7a5632';
  const houweel = def.gereedschap === 'houweel';
  const mand = def.gereedschap === 'mand';
  const geen = def.gereedschap === 'geen';   // een boer zonder werk
  const riet = '#a47a45';
  const appel = '#c8402f';

  // Het ijzer aan het eind van de steel. Van (ax, ay) naar (bx, by) loopt de steel.
  const kop = (ctx, ax, ay, bx, by) => {
    const lengte = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / lengte;
    const uy = (by - ay) / lengte;
    if (houweel) {
      // Een smalle punt dwars op de steel, aan beide kanten.
      lijn(ctx, bx - uy * 4.6 - ux * 1.2, by + ux * 4.6 - uy * 1.2, bx, by, staal, 1.7);
      lijn(ctx, bx, by, bx + uy * 4.6 - ux * 1.2, by - ux * 4.6 - uy * 1.2, staal, 1.7);
    } else {
      // Een bijlblad aan één kant.
      vlak(ctx, [
        [bx - ux * 3, by - uy * 3], [bx + ux * 0.6, by + uy * 0.6],
        [bx + ux * 0.9 + uy * 3.8, by + uy * 0.9 - ux * 3.8], [bx - ux * 3.6 + uy * 3.4, by - uy * 3.6 - ux * 3.4],
      ], staal);
    }
  };

  const figuur = (houding) => loopbeelden((ctx, beeld) => {
    const werkt = houding === 'hak';
    const wip = !werkt && beeld % 2 ? -1 : 0;
    const pas = werkt ? 0 : [0, 1.7, 0, -1.7][beeld];
    const neer = werkt && beeld >= 2;               // het gereedschap is neergekomen
    const mx = 13;

    ovaal(ctx, mx, 34, 6.5, 2.6, 'rgba(0,0,0,0.3)');
    if (houding === 'loop' && !mand && !geen) {
      // Gereedschap over de schouder, achter het lijf langs
      lijn(ctx, mx + 2.5, 23 + wip, mx - 6.5, 9.5 + wip, steel, 1.3);
      kop(ctx, mx + 2.5, 23 + wip, mx - 6.5, 9.5 + wip);
    }
    // Benen
    blok(ctx, mx - 3.2 + pas, 27 + wip, 2.7, 7 - wip, '#5b4a34');
    blok(ctx, mx + 0.5 - pas, 27 + wip, 2.7, 7 - wip, '#4b3c2a');
    // Kiel met riem
    ovaal(ctx, mx, 17.8 + wip, 4.6, 2.5, kiel);
    blok(ctx, mx - 4.2, 17.5 + wip, 8.4, 10.5, kiel);
    blok(ctx, mx - 4.2, 17.5 + wip, 2.7, 10.5, 'rgba(0,0,0,0.22)');
    blok(ctx, mx + 2.4, 17.5 + wip, 1.8, 10.5, 'rgba(255,255,255,0.12)');
    blok(ctx, mx - 4.2, 23.4 + wip, 8.4, 1.1, 'rgba(0,0,0,0.45)');
    if (houweel) blok(ctx, mx - 2.6, 19.5 + wip, 5.6, 8.5, 'rgba(70,48,24,0.55)');   // leren schort
    // Gezicht en muts in teamkleur
    ovaal(ctx, mx + 0.8, 11.8 + wip, 3.5, 3.7, huid);
    ctx.fillStyle = def.kleur;
    ctx.beginPath();
    ctx.ellipse(mx + 0.2, 10.6 + wip, 4.3, 3.9, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    blok(ctx, mx - 4.1, 10.2 + wip, 2.6, 3.4, def.kleur);
    blok(ctx, mx - 4.1, 10.2 + wip, 1.3, 3.4, 'rgba(0,0,0,0.2)');

    if (mand && houding === 'last') {
      // Een volle mand appels voor de borst
      for (const [ax, ay] of [[1.6, 17.3], [3.8, 16.5], [6, 17.2], [4.9, 18], [2.8, 18.1]]) ovaal(ctx, mx + ax, ay + wip, 1.3, 1.3, appel);
      vlak(ctx, [[mx - 0.2, 18.4 + wip], [mx + 8, 18.4 + wip], [mx + 7, 23.6 + wip], [mx + 0.8, 23.6 + wip]], riet);
      blok(ctx, mx - 0.5, 18.1 + wip, 8.8, 1.1, tint(riet, -0.22));
      blok(ctx, mx + 0.6, 20.7 + wip, 6.6, 0.6, 'rgba(0,0,0,0.2)');
      blok(ctx, mx + 0.4, 21.8 + wip, 5.4, 1.6, kiel);
      ovaal(ctx, mx + 6.3, 22.6 + wip, 1.2, 1.2, huid);
    } else if (mand && werkt) {
      // Plukken: de mand staat op de grond. Een hand reikt omhoog naar een
      // appel, of legt hem in de mand.
      vlak(ctx, [[mx + 5.4, 29.8], [mx + 12, 29.8], [mx + 11.2, 34], [mx + 6.2, 34]], riet);
      blok(ctx, mx + 5.2, 29.5, 7, 1, tint(riet, -0.22));
      ovaal(ctx, mx + 7.4, 29.2, 1.2, 1.1, appel);
      ovaal(ctx, mx + 9.8, 29.1, 1.2, 1.1, appel);
      if (!neer) {
        blok(ctx, mx + 3, 11.6, 2.2, 8.8, kiel);
        ovaal(ctx, mx + 4.3, 10.6, 1.3, 1.3, huid);
        ovaal(ctx, mx + 5.5, 9, 1.4, 1.4, appel);
      } else {
        blok(ctx, mx + 2.8, 18.4, 2.2, 6.2, kiel);
        ovaal(ctx, mx + 4.5, 25.2, 1.3, 1.3, huid);
        ovaal(ctx, mx + 5.9, 26.4, 1.3, 1.3, appel);
      }
    } else if (mand) {
      // Lege mand aan de arm
      blok(ctx, mx + 2.6, 18.2 + wip, 2.2, 5, kiel);
      ovaal(ctx, mx + 3.6, 23 + wip, 1.3, 1.3, huid);
      vlak(ctx, [[mx + 1.4, 24.2 + wip], [mx + 7.4, 24.2 + wip], [mx + 6.6, 28.2 + wip], [mx + 2.2, 28.2 + wip]], riet);
      blok(ctx, mx + 1.2, 23.9 + wip, 6.4, 0.9, tint(riet, -0.22));
    } else if (houding === 'last' && def.vracht === 'steen') {
      // Een blok steen voor de borst, met twee armen eromheen
      vlak(ctx, [[mx - 0.5, 17.4 + wip], [mx + 8, 17.4 + wip], [mx + 9.4, 15.8 + wip], [mx + 0.9, 15.8 + wip]], '#cfccc3');
      blok(ctx, mx - 0.5, 17.4 + wip, 8.5, 5.6, '#a8a59c');
      vlak(ctx, [[mx + 8, 17.4 + wip], [mx + 9.4, 15.8 + wip], [mx + 9.4, 21.4 + wip], [mx + 8, 23 + wip]], '#8b887f');
      blok(ctx, mx + 0.6, 20.6 + wip, 6, 1.7, kiel);
      ovaal(ctx, mx + 6.9, 21.4 + wip, 1.2, 1.2, huid);
    } else if (houding === 'last' && def.vracht === 'koper') {
      // Een mand met koperbrokken op de rug
      vlak(ctx, [[mx - 3, 12.5 + wip], [mx + 5, 12.5 + wip], [mx + 4, 19 + wip], [mx - 2, 19 + wip]], '#8a6a3c');
      for (let j = 0; j < 3; j++) lijn(ctx, mx - 2.6 + j * 0.3, 14.5 + j * 1.8 + wip, mx + 4.6 - j * 0.3, 14.5 + j * 1.8 + wip, 'rgba(60,40,20,0.45)', 0.5);
      for (const [dx, dy, kl] of [[-1, 12, '#d07a3a'], [1.6, 11.4, '#e09050'], [3.6, 12.2, '#c26a2e'], [0.4, 10.6, '#4fa88a']]) ovaal(ctx, mx + dx, dy + wip, 1.5, 1.2, kl);
    } else if (houding === 'last' && def.vracht === 'tarwe') {
      // Een schoof tarwe onder de arm
      vlak(ctx, [[mx - 1, 14 + wip], [mx + 8, 13 + wip], [mx + 9, 22 + wip], [mx + 1, 23 + wip]], '#d9b44a');
      for (let j = 0; j < 4; j++) lijn(ctx, mx + 0.5 + j * 2, 13.5 + wip, mx + 1 + j * 2, 22.5 + wip, 'rgba(120,90,30,0.45)', 0.5);
      blok(ctx, mx, 18 + wip, 8.5, 1.2, '#8a6a2a');
      blok(ctx, mx + 2.7, 17.6 + wip, 2.3, 3.4, kiel);
      ovaal(ctx, mx + 3.9, 20.6 + wip, 1.3, 1.3, huid);
    } else if (houding === 'last' && def.vracht === 'brood') {
      // Een plank met broden voor de borst
      blok(ctx, mx - 1, 18.8 + wip, 10, 1.4, '#9c7446');
      for (const bx of [0.8, 3.8, 6.8]) ovaal(ctx, mx + bx, 17.6 + wip, 1.6, 1.3, '#b9773a');
      blok(ctx, mx + 0.6, 20.4 + wip, 6, 1.7, kiel);
      ovaal(ctx, mx + 6.9, 21 + wip, 1.2, 1.2, huid);
    } else if (houding === 'last' && def.vracht === 'planken') {
      // Een stapel lichte planken op de schouder
      for (const [hoog, kleur] of [[0, '#c9a36a'], [1.6, '#dbb97f'], [3.2, '#c9a36a']]) {
        blok(ctx, mx - 9, 15.4 - hoog + wip, 17, 1.5, kleur);
        blok(ctx, mx - 9, 16.5 - hoog + wip, 17, 0.4, 'rgba(0,0,0,0.25)');
      }
      blok(ctx, mx + 2.7, 16.8 + wip, 2.3, 3.4, kiel);
      ovaal(ctx, mx + 3.9, 16.6 + wip, 1.3, 1.3, huid);
    } else if (houding === 'last') {
      // Twee stammetjes op de schouder, met een arm eromheen
      for (const [hoog, kleur] of [[0, stam], [2.7, tint(stam, 0.14)]]) {
        blok(ctx, mx - 8.5, 14.6 - hoog + wip, 15.5, 2.7, kleur);
        blok(ctx, mx - 8.5, 16.5 - hoog + wip, 15.5, 0.8, 'rgba(0,0,0,0.25)');
        ovaal(ctx, mx + 7, 15.9 - hoog + wip, 1.2, 1.4, '#d9bb88');
      }
      blok(ctx, mx + 2.7, 16.8 + wip, 2.3, 3.4, kiel);
      ovaal(ctx, mx + 3.9, 16.6 + wip, 1.3, 1.3, huid);
    } else if (werkt && !neer) {
      // Gereedschap geheven
      lijn(ctx, mx + 4.2, 20, mx + 8.6, 6.5, steel, 1.4);
      kop(ctx, mx + 4.2, 20, mx + 8.6, 6.5);
      blok(ctx, mx + 3, 15.6, 2.3, 5, kiel);
      ovaal(ctx, mx + 4.6, 15.2, 1.3, 1.3, huid);
    } else if (werkt) {
      // Gereedschap neergekomen
      lijn(ctx, mx + 4, 20.6, mx + 11.6, 22.8, steel, 1.4);
      kop(ctx, mx + 4, 20.6, mx + 11.6, 22.8);
      blok(ctx, mx + 2.8, 18.6, 4.6, 2.3, kiel);
      ovaal(ctx, mx + 7.2, 20.8, 1.3, 1.3, huid);
    } else {
      // Arm met de hand om de steel
      blok(ctx, mx + 2.6, 18.2 + wip, 2.2, 5, kiel);
      ovaal(ctx, mx + 3.4, 23.2 + wip, 1.3, 1.3, huid);
    }
  });

  const beelden = figuur('loop');
  beelden.houdingen = { last: figuur('last'), hak: figuur('hak') };
  return beelden;
}

// --- Kasteel ---------------------------------------------------------------

// Een schuin zijvlak van losse stenen. P en Q zijn de bovenhoeken, H is de
// hoogte, licht is hoe licht dit vlak is (onder 0 = in de schaduw).
function stenenVlak(ctx, P, Q, H, kleur, licht, toeval) {
  const laag = 7;
  const rijen = Math.ceil(H / laag);
  const lengte = Math.abs(Q[0] - P[0]);
  const op = (deel, zak) => [P[0] + (Q[0] - P[0]) * deel, P[1] + (Q[1] - P[1]) * deel + zak];
  const vorm = [P, Q, [Q[0], Q[1] + H], [P[0], P[1] + H]];

  vlak(ctx, vorm, tint(kleur, licht - 0.24));   // de voegen
  ctx.save();
  omtrek(ctx, vorm);
  ctx.clip();
  for (let rij = 0; rij < rijen; rij++) {
    let x = -toeval() * 9;
    while (x < lengte) {
      const breed = 6.5 + toeval() * 8.5;
      const van = Math.max(0, x + 0.35) / lengte;
      const tot = Math.min(lengte, x + breed - 0.35) / lengte;
      if (tot > van) {
        const toon = licht + (toeval() - 0.5) * 0.15;
        vlak(ctx, [
          op(van, rij * laag + 0.35), op(tot, rij * laag + 0.35),
          op(tot, (rij + 1) * laag - 0.35), op(van, (rij + 1) * laag - 0.35),
        ], tint(kleur, toon));
        // Een smal lichtrandje bovenaan elke steen
        const a = op(van, rij * laag + 0.7);
        const z = op(tot, rij * laag + 0.7);
        lijn(ctx, a[0], a[1], z[0], z[1], 'rgba(255,250,235,0.10)', 0.5);
      }
      x += breed;
    }
  }
  // Verwering: naar beneden toe donkerder, met mos tegen de grond.
  const boven = Math.min(P[1], Q[1]);
  const onder = Math.max(P[1], Q[1]) + H;
  const verloop = ctx.createLinearGradient(0, boven, 0, onder);
  verloop.addColorStop(0, 'rgba(60,45,25,0)');
  verloop.addColorStop(0.5, 'rgba(60,45,25,0.06)');
  verloop.addColorStop(1, 'rgba(45,35,15,0.34)');
  ctx.fillStyle = verloop;
  ctx.fillRect(Math.min(P[0], Q[0]), boven, lengte, onder - boven);
  for (let i = 0; i < 4; i++) {
    const [x, y] = op(toeval(), H - toeval() * 4);
    ovaal(ctx, x, y, 3 + toeval() * 5, 1.4 + toeval() * 2.2, 'rgba(78,104,46,0.42)');
  }
  // Een enkele regenstreep van boven naar beneden
  for (let i = 0; i < 2; i++) {
    const deel = toeval();
    const a = op(deel, 2);
    lijn(ctx, a[0], a[1], a[0], a[1] + H * (0.3 + toeval() * 0.4), 'rgba(40,30,15,0.10)', 1.6);
  }
  ctx.restore();
}

// Een stenen blok. (cx, cy) is het midden van de voet, hb en hh zijn de
// halve breedte en halve hoogte van de voetruit, H is de hoogte.
// Zonder toeval wordt het een glad blok (voor kantelen).
function steenBlok(ctx, cx, cy, hb, hh, H, kleur, toeval) {
  const L = [cx - hb, cy];
  const R = [cx + hb, cy];
  const B = [cx, cy + hh];
  const T = [cx, cy - hh];
  const op = ([x, y]) => [x, y - H];

  if (toeval) {
    stenenVlak(ctx, op(L), op(B), H, kleur, -0.3, toeval);    // links, in de schaduw
    stenenVlak(ctx, op(B), op(R), H, kleur, -0.04, toeval);   // rechts, in het licht
    // De hoek tussen beide vlakken: een rij hoekstenen
    lijn(ctx, B[0], B[1] - H, B[0], B[1], 'rgba(255,250,235,0.16)', 1);
  } else {
    vlak(ctx, [op(L), op(B), B, L], tint(kleur, -0.3));
    vlak(ctx, [op(B), op(R), R, B], tint(kleur, -0.05));
  }

  const boven = [op(T), op(R), op(B), op(L)];
  vlak(ctx, boven, tint(kleur, 0.15));
  if (toeval) {
    // Plaveisel op het bovenvlak
    ctx.save();
    omtrek(ctx, boven);
    ctx.clip();
    for (const deel of [0.25, 0.5, 0.75]) {
      const a = tussen(op(T), op(R), deel);
      const z = tussen(op(L), op(B), deel);
      lijn(ctx, a[0], a[1], z[0], z[1], 'rgba(60,45,25,0.13)', 0.6);
      const c = tussen(op(T), op(L), deel);
      const d = tussen(op(R), op(B), deel);
      lijn(ctx, c[0], c[1], d[0], d[1], 'rgba(60,45,25,0.13)', 0.6);
    }
    for (let i = 0; i < 5; i++) {
      ovaal(ctx, cx + (toeval() - 0.5) * hb * 1.4, cy - H + (toeval() - 0.5) * hh * 1.2, 3 + toeval() * 4, 1.5 + toeval() * 2, 'rgba(60,45,25,0.07)');
    }
    ctx.restore();
  }
  // Een lichte rand langs de voorkant van het bovenvlak
  ctx.strokeStyle = 'rgba(255,250,235,0.4)';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(L[0], L[1] - H);
  ctx.lineTo(B[0], B[1] - H);
  ctx.lineTo(R[0], R[1] - H);
  ctx.stroke();
}

// Kantelen langs de randen van een bovenvlak met midden (tx, ty).
// masker zegt aan welke kanten een buur aansluit; daar komen geen kantelen.
//   1 = buur rechtsboven, 2 = rechtsonder, 4 = linksonder, 8 = linksboven
// schaal maakt het vlak (en de kantelen) kleiner, voor een torentje.
function kantelen(ctx, tx, ty, masker, kleur, schaal = 1) {
  const T = [0, -HH * schaal];
  const R = [HB * schaal, 0];
  const B = [0, HH * schaal];
  const L = [-HB * schaal, 0];
  // Eerst de achterste randen, dan de voorste.
  const randen = [[1, T, R], [8, L, T], [2, R, B], [4, B, L]];
  const delen = schaal < 0.8 ? [0.5] : [0.25, 0.75];
  for (const [bit, P, Q] of randen) {
    if (masker & bit) continue;
    for (const deel of delen) {
      const [x, y] = tussen(P, Q, deel);
      steenBlok(ctx, tx + x * 0.83, ty + y * 0.83, 4.6, 2.3, 8, kleur, null);
    }
  }
  // Hoekkantelen op hoeken waar twee vrije randen samenkomen
  const hoeken = [[1 | 8, T], [1 | 2, R], [2 | 4, B], [4 | 8, L]];
  for (const [bits, H] of hoeken) {
    if (masker & bits) continue;
    steenBlok(ctx, tx + H[0] * 0.8, ty + H[1] * 0.8, 4.6, 2.3, 8, kleur, null);
  }
}

// Een rij donkere gaten vlak onder de rand, zoals bij een weergang.
function kraag(ctx, P, Q, zak) {
  for (let deel = 0.1; deel < 0.95; deel += 0.16) {
    const [x, y] = tussen(P, Q, deel);
    blok(ctx, x - 1.1, y + zak, 2.2, 3.4, 'rgba(30,22,12,0.5)');
  }
}

function schietgat(ctx, x, y) {
  blok(ctx, x - 1.1, y, 2.2, 9, '#1f1810');
  blok(ctx, x - 2.6, y + 3.2, 5.2, 1.6, '#1f1810');
}

function muurTegel(naam, def, masker) {
  const H = def.hoogte;
  const b = TB + 2;
  const h = TH + H + 14;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  steenBlok(ctx, cx, cy, HB + 1, HH + 0.5, H, def.kleur, toevalVoor(naam + masker));
  kantelen(ctx, cx, cy - H, masker, def.kleur);
  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

// Zestien varianten: voor elke combinatie van aansluitende buren één.
export function tekenMuur(naam, def) {
  return { kies: 'masker', varianten: Array.from({ length: 16 }, (_, masker) => muurTegel(naam, def, masker)) };
}

// Een vierkante wachttoren die boven de muur uitsteekt.
export function tekenWachttoren(naam, def) {
  const H = def.hoogte;
  const b = TB + 2;
  const h = TH + H + 14;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  const top = cy - H;
  steenBlok(ctx, cx, cy, HB + 1, HH + 0.5, H, def.kleur, toevalVoor(naam));
  kraag(ctx, [cx - HB, top], [cx, top + HH], 3);
  kraag(ctx, [cx, top + HH], [cx + HB, top], 3);
  schietgat(ctx, cx + 16, top + 8 + 16);
  schietgat(ctx, cx - 16, top + 8 + 16);
  schietgat(ctx, cx + 16, top + 8 + 36);
  kantelen(ctx, cx, top, 0, def.kleur);
  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

export function tekenToren(naam, def) {
  const H = def.hoogte;
  const rx = 26;     // voet van de toren
  const ry = 13;
  const kx = 30;     // de bredere krans bovenaan
  const ky = 15;
  const b = 80;
  const h = TH + H + 28;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  const top = cy - H;
  const toeval = toevalVoor(naam);

  // Hoe licht de ronde wand is op een bepaalde hoek (0 = rechts, pi = links).
  const lichtOp = (hoek) => {
    const zijde = (Math.cos(hoek) + 1) / 2;
    return -0.36 + 0.46 * zijde - 0.16 * Math.max(0, zijde - 0.86) / 0.14;
  };
  const romp = (straalX, straalY, boven, onder) => {
    ctx.beginPath();
    ctx.moveTo(cx - straalX, boven);
    ctx.lineTo(cx - straalX, onder);
    ctx.ellipse(cx, onder, straalX, straalY, 0, Math.PI, 0, true);
    ctx.lineTo(cx + straalX, boven);
    ctx.closePath();
  };
  // Stenen in ringen rond een ronde wand.
  const stenen = (straalX, straalY, boven, onder, laag) => {
    romp(straalX, straalY, boven, onder);
    ctx.fillStyle = tint(def.kleur, -0.5);
    ctx.fill();
    ctx.save();
    romp(straalX, straalY, boven, onder);
    ctx.clip();
    for (let rij = 0; boven + rij * laag < onder + straalY; rij++) {
      const y = boven + rij * laag;
      let hoek = -toeval() * 0.3;
      while (hoek < Math.PI) {
        const breed = 0.26 + toeval() * 0.22;
        const a = Math.max(0, hoek + 0.02);
        const z = Math.min(Math.PI, hoek + breed - 0.02);
        if (z > a) {
          const toon = lichtOp((a + z) / 2) + (toeval() - 0.5) * 0.12;
          const punt = (hk, zak) => [cx + straalX * Math.cos(hk), y + straalY * Math.sin(hk) + zak];
          vlak(ctx, [punt(a, 0.35), punt(z, 0.35), punt(z, laag - 0.35), punt(a, laag - 0.35)], tint(def.kleur, toon));
        }
        hoek += breed;
      }
    }
    ctx.restore();
  };

  // Romp met verwering en mos
  stenen(rx, ry, top, cy, 7);
  ctx.save();
  romp(rx, ry, top, cy);
  ctx.clip();
  const verloop = ctx.createLinearGradient(0, top, 0, cy + ry);
  verloop.addColorStop(0, 'rgba(60,45,25,0)');
  verloop.addColorStop(0.55, 'rgba(60,45,25,0.06)');
  verloop.addColorStop(1, 'rgba(45,35,15,0.36)');
  ctx.fillStyle = verloop;
  ctx.fillRect(cx - rx, top, rx * 2, H + ry);
  for (let i = 0; i < 6; i++) {
    const hoek = 0.2 + toeval() * (Math.PI - 0.4);
    ovaal(ctx, cx + rx * Math.cos(hoek), cy + ry * Math.sin(hoek) - toeval() * 4, 4 + toeval() * 4, 1.6 + toeval() * 2, 'rgba(78,104,46,0.42)');
  }
  ctx.restore();
  schietgat(ctx, cx + 9, top + 34);
  schietgat(ctx, cx - 13, top + 52);

  // Krans: iets breder dan de romp, met gaten eronder
  stenen(kx, ky, top - 2, top + 11, 6.5);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, top + 11, kx, ky, 0, 0, Math.PI);
  ctx.stroke();
  for (let hoek = 0.25; hoek < Math.PI - 0.2; hoek += 0.3) {
    blok(ctx, cx + kx * Math.cos(hoek) - 1, top + 6.5 + ky * Math.sin(hoek), 2, 3.2, 'rgba(30,22,12,0.5)');
  }

  // Bovenvlak met vloer en kantelen rondom
  ovaal(ctx, cx, top - 2, kx, ky, tint(def.kleur, 0.15));
  ovaal(ctx, cx, top - 2, kx - 6, ky - 3, tint(def.kleur, -0.2));
  ovaal(ctx, cx + 3, top - 1, kx - 11, ky - 6, tint(def.kleur, -0.12));
  const aantal = 10;
  const hoeken = Array.from({ length: aantal }, (_, k) => ((k + 0.5) * Math.PI * 2) / aantal);
  hoeken.sort((a, z) => Math.sin(a) - Math.sin(z));   // achterste eerst
  for (const hoek of hoeken) {
    const x = cx + (kx - 3) * Math.cos(hoek);
    const y = top - 2 + (ky - 1.5) * Math.sin(hoek);
    blok(ctx, x - 4, y - 9, 8, 9, tint(def.kleur, lichtOp(hoek) + 0.04));
    blok(ctx, x - 4, y - 9, 2.4, 9, 'rgba(0,0,0,0.14)');
    ovaal(ctx, x, y - 9, 4, 1.8, tint(def.kleur, 0.2));
  }
  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

// De poort bestaat in twee richtingen: met de doorgang in het rechter
// zijvlak (de muur loopt van linksonder naar rechtsboven) of in het
// linker zijvlak (de muur loopt van linksboven naar rechtsonder).
export function tekenPoort(naam, def) {
  return { kies: 'poort', varianten: [poortTegel(naam, def, false), poortTegel(naam, def, true)] };
}

function poortTegel(naam, def, links) {
  const H = def.hoogte;
  const b = TB + 2;
  const h = TH + H + 14;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  const top = cy - H;
  steenBlok(ctx, cx, cy, HB + 1, HH + 0.5, H, def.kleur, toevalVoor(naam));
  kraag(ctx, [cx - HB, top], [cx, top + HH], 3);
  kraag(ctx, [cx, top + HH], [cx + HB, top], 3);

  // Poortboog met valhek in een van de twee zijvlakken. B en R zijn de
  // onderhoeken van dat vlak.
  const B = links ? [cx - HB, cy] : [cx, cy + HH];
  const R = links ? [cx, cy + HH] : [cx + HB, cy];
  const op = (deel, hoog) => [B[0] + (R[0] - B[0]) * deel, B[1] + (R[1] - B[1]) * deel - hoog];
  const boog = (smal) => {
    ctx.beginPath();
    ctx.moveTo(...op(0.2 + smal, 0));
    ctx.lineTo(...op(0.2 + smal, 24));
    ctx.quadraticCurveTo(...op(0.5, 42 - smal * 20), ...op(0.8 - smal, 24));
    ctx.lineTo(...op(0.8 - smal, 0));
    ctx.closePath();
  };
  // Boogstenen eromheen
  boog(-0.05);
  ctx.fillStyle = tint(def.kleur, links ? -0.14 : 0.12);
  ctx.fill();
  boog(0);
  ctx.fillStyle = '#1a140d';
  ctx.fill();
  ctx.save();
  boog(0);
  ctx.clip();
  for (const deel of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    lijn(ctx, ...op(deel, 0), ...op(deel, 42), '#8a7350', 0.9);
  }
  for (const hoog of [7, 15, 23, 31]) {
    lijn(ctx, ...op(0.2, hoog), ...op(0.8, hoog), '#8a7350', 0.9);
  }
  ctx.restore();
  schietgat(ctx, links ? cx + 16 : cx - 16, top + 8 + 14);
  kantelen(ctx, cx, top, 0, def.kleur);
  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

function burchtTegel(naam, def, masker) {
  const H = def.hoogte;
  const metBanier = !!def.banier;
  const b = TB + 2;
  const h = TH + H + 14 + (metBanier ? 84 : 0);
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  const top = cy - H;
  steenBlok(ctx, cx, cy, HB + 1, HH + 0.5, H, def.kleur, toevalVoor(naam + masker));

  // Vensters in de zijvlakken die aan de buitenkant liggen, en een deur
  // in het midden van de rechterkant.
  const venster = (x, y) => {
    blok(ctx, x - 1.5, y, 3, 8.5, '#1f1810');
    ovaal(ctx, x, y, 1.5, 1.7, '#1f1810');
    blok(ctx, x - 2.4, y + 8.5, 4.8, 1, 'rgba(255,250,235,0.25)');
  };
  const rechtsVrij = !(masker & 2);
  const linksVrij = !(masker & 4);
  if (rechtsVrij) kraag(ctx, [cx, top + HH], [cx + HB, top], 3);
  if (linksVrij) kraag(ctx, [cx - HB, top], [cx, top + HH], 3);
  for (const deel of [0.26, 0.56]) {
    if (rechtsVrij) venster(cx + 16, top + 8 + H * deel);
    if (linksVrij) venster(cx - 16, top + 8 + H * deel);
  }
  if (masker === 13) {
    // Houten deur met boog
    const B = [cx, cy + HH];
    const R = [cx + HB, cy];
    const op = (deel, hoog) => [B[0] + (R[0] - B[0]) * deel, B[1] + (R[1] - B[1]) * deel - hoog];
    ctx.beginPath();
    ctx.moveTo(...op(0.3, 0));
    ctx.lineTo(...op(0.3, 15));
    ctx.quadraticCurveTo(...op(0.5, 26), ...op(0.7, 15));
    ctx.lineTo(...op(0.7, 0));
    ctx.closePath();
    ctx.fillStyle = '#5a3d22';
    ctx.fill();
    ctx.strokeStyle = tint(def.kleur, 0.2);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    lijn(ctx, ...op(0.5, 0), ...op(0.5, 20), 'rgba(0,0,0,0.4)', 0.8);
    lijn(ctx, ...op(0.3, 6), ...op(0.7, 6), 'rgba(20,15,10,0.6)', 1);
    lijn(ctx, ...op(0.3, 12), ...op(0.7, 12), 'rgba(20,15,10,0.6)', 1);
  }
  kantelen(ctx, cx, top, masker, def.kleur);

  if (metBanier) {
    // Een tweede verdieping met eigen kantelen, daarop de banier.
    const hoog = 34;
    steenBlok(ctx, cx, top, 21, 10.5, hoog, def.kleur, toevalVoor(naam + 'opbouw'));
    const dak = top - hoog;
    venster(cx + 10, dak + 5 + 12);
    venster(cx - 10, dak + 5 + 12);
    kantelen(ctx, cx, dak, 0, def.kleur, 0.66);
    blok(ctx, cx - 1, dak - 36, 2, 36, '#3a2a1c');
    const vlag = [[cx + 1, dak - 36], [cx + 23, dak - 33], [cx + 17, dak - 28.5], [cx + 23, dak - 24], [cx + 1, dak - 21]];
    vlak(ctx, vlag, def.banier);
    vlak(ctx, [[cx + 1, dak - 31], [cx + 19.4, dak - 29.7], [cx + 18.4, dak - 27.3], [cx + 1, dak - 26.4]], '#efe6c8');
    vlak(ctx, [[cx + 1, dak - 36], [cx + 23, dak - 33], [cx + 21, dak - 31.6], [cx + 1, dak - 33.6]], 'rgba(255,255,255,0.18)');
    ovaal(ctx, cx, dak - 36.5, 1.8, 1.8, '#d8b24a');
  }
  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

export function tekenBurcht(naam, def) {
  return { kies: 'masker', varianten: Array.from({ length: 16 }, (_, masker) => burchtTegel(naam, def, masker)) };
}

// --- Dorp ------------------------------------------------------------------

function huisVariant(naam, def, variant) {
  const hb = 25;
  const hh = 12.5;
  const wand = 15;
  const nok = 16;
  const b = TB + 6;
  const h = TH + wand + nok + 14;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  const toeval = toevalVoor(naam + variant);
  const dakKleur = def.daken[variant % def.daken.length];

  const L = [cx - hb, cy];
  const R = [cx + hb, cy];
  const B = [cx, cy + hh];
  const T = [cx, cy - hh];
  const op = ([x, y], hoog) => [x, y - hoog];
  const Lt = op(L, wand);
  const Rt = op(R, wand);
  const Bt = op(B, wand);
  const Tt = op(T, wand);
  const nokL = op(tussen(Lt, Bt, 0.5), nok);
  const nokR = op(tussen(Rt, Tt, 0.5), nok);

  // Wanden: links in de schaduw, rechts in het licht, en de puntgevel.
  vlak(ctx, [Lt, Bt, B, L], tint(def.wand, -0.3));
  vlak(ctx, [Lt, Bt, nokL], tint(def.wand, -0.3));
  vlak(ctx, [Bt, Rt, R, B], def.wand);

  const balk = '#4a3624';
  const bijLinks = (deel, hoog) => op(tussen(L, B, deel), hoog);
  const bijRechts = (deel, hoog) => op(tussen(B, R, deel), hoog);
  if (def.vakwerk) {
    // Vakwerk: donkere balken over het pleisterwerk.
    for (const deel of [0.03, 0.5, 0.97]) lijn(ctx, ...bijLinks(deel, 0), ...bijLinks(deel, wand), balk, 1.2);
    lijn(ctx, ...bijLinks(0, wand), ...bijLinks(1, wand), balk, 1.2);
    lijn(ctx, ...bijLinks(0.03, 0), ...bijLinks(0.5, wand), balk, 1);
    lijn(ctx, ...bijLinks(0.97, 0), ...bijLinks(0.5, wand), balk, 1);
    lijn(ctx, ...bijLinks(0.5, wand), nokL[0], nokL[1], balk, 1);
    for (const deel of [0.03, 0.36, 0.66, 0.97]) lijn(ctx, ...bijRechts(deel, 0), ...bijRechts(deel, wand), balk, 1.2);
    lijn(ctx, ...bijRechts(0, wand), ...bijRechts(1, wand), balk, 1.2);
    lijn(ctx, ...bijRechts(0.36, wand * 0.55), ...bijRechts(0.97, wand * 0.55), balk, 1);
  } else {
    // Vlechtwerk met leem: rommelige strepen.
    for (let i = 0; i < 14; i++) {
      const deel = toeval();
      const hoog = toeval() * wand;
      const p = toeval() < 0.5 ? bijLinks(deel, hoog) : bijRechts(deel, hoog);
      blok(ctx, p[0], p[1], 3, 0.8, 'rgba(60,40,15,0.25)');
    }
  }
  // Deur en raam in de lichte wand
  vlak(ctx, [bijRechts(0.1, 0), bijRechts(0.28, 0), bijRechts(0.28, 10.5), bijRechts(0.1, 10.5)], '#5a3d22');
  vlak(ctx, [bijRechts(0.5, 5), bijRechts(0.8, 5), bijRechts(0.8, 10.5), bijRechts(0.5, 10.5)], '#2c2318');
  lijn(ctx, ...bijRechts(0.65, 5), ...bijRechts(0.65, 10.5), tint(def.wand, 0.1), 0.7);
  // Een klein raam in de puntgevel
  ovaal(ctx, nokL[0], nokL[1] + nok * 0.62, 1.6, 2, '#2c2318');

  // Dak: het vlak aan onze kant, met overstek en rijen pannen of riet.
  const richting = [(Rt[0] - Bt[0]) / 28, (Rt[1] - Bt[1]) / 28];
  const schuif = ([x, y], ver, zak) => [x + richting[0] * ver, y + richting[1] * ver + zak];
  const dak = [schuif(Bt, -3, 3.2), schuif(Rt, 3, 3.2), schuif(nokR, 3, 0), schuif(nokL, -3, 0)];
  vlak(ctx, dak, dakKleur);
  ctx.save();
  omtrek(ctx, dak);
  ctx.clip();
  for (let rij = 1; rij < 6; rij++) {
    const a = tussen(dak[0], dak[3], rij / 6);
    const z = tussen(dak[1], dak[2], rij / 6);
    lijn(ctx, a[0], a[1], z[0], z[1], 'rgba(0,0,0,0.22)', 0.8);
    if (def.pannen) {
      for (let k = (rij % 2) * 0.04; k < 1; k += 0.08) {
        const p = tussen(a, z, k);
        lijn(ctx, p[0], p[1], p[0] - 0.9, p[1] + 3, 'rgba(0,0,0,0.16)', 0.6);
      }
    }
  }
  for (let i = 0; i < 12; i++) {
    const p = tussen(tussen(dak[0], dak[3], toeval()), tussen(dak[1], dak[2], toeval()), toeval());
    blok(ctx, p[0], p[1], 3.5, 1, toeval() < 0.5 ? 'rgba(255,245,210,0.13)' : 'rgba(0,0,0,0.12)');
  }
  ctx.restore();
  // Nok en dakrand
  lijn(ctx, dak[3][0], dak[3][1], dak[2][0], dak[2][1], tint(dakKleur, 0.25), 1.3);
  lijn(ctx, dak[0][0], dak[0][1], dak[3][0], dak[3][1], tint(dakKleur, -0.4), 1.6);
  lijn(ctx, dak[0][0], dak[0][1], dak[1][0], dak[1][1], tint(dakKleur, -0.35), 1.1);

  if (def.schoorsteen) {
    const voet = tussen(tussen(dak[0], dak[3], 0.62), tussen(dak[1], dak[2], 0.62), 0.74);
    steenBlok(ctx, voet[0], voet[1], 3.2, 1.6, 8, '#9d9484', null);
  }
  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

export function tekenHuis(naam, def) {
  return { kies: 'toeval', varianten: [0, 1, 2].map((v) => huisVariant(naam, def, v)) };
}

// De hut van de houthakker: een houten huisje met een stapel hout tegen
// de wand en een hakblok met bijl voor de deur.
export function tekenHouthakker(naam, def) {
  const hut = huisVariant(naam, def, 0);
  const ctx = hut.beeld.getContext('2d');
  const cx = hut.ax;
  const cy = hut.ay - HH;
  const L = [cx - 25, cy];
  const B = [cx, cy + 12.5];
  const R = [cx + 25, cy];
  const wand = 15;

  // Planken: naden in beide wanden, niet over deur en raam heen.
  for (const deel of [0.14, 0.28, 0.42, 0.58, 0.72, 0.86]) {
    const p = tussen(L, B, deel);
    lijn(ctx, p[0], p[1], p[0], p[1] - wand, 'rgba(30,18,6,0.3)', 0.7);
  }
  for (const deel of [0.36, 0.43, 0.87, 0.94]) {
    const p = tussen(B, R, deel);
    lijn(ctx, p[0], p[1], p[0], p[1] - wand, 'rgba(30,18,6,0.28)', 0.7);
  }
  // Houtstapel tegen de schaduwwand: drie rijen kopse kanten.
  const rijen = [[0.14, 0.74, 6, 1.2], [0.2, 0.68, 5, 4.9], [0.27, 0.6, 4, 8.5]];
  for (const [van, tot, aantal, hoog] of rijen) {
    for (let k = 0; k < aantal; k++) {
      const p = tussen(L, B, van + ((tot - van) * k) / (aantal - 1));
      ovaal(ctx, p[0] - 0.6, p[1] - hoog, 2.3, 2.1, '#4f381f');
      ovaal(ctx, p[0] - 0.6, p[1] - hoog, 1.7, 1.5, '#cfae78');
      ovaal(ctx, p[0] - 0.6, p[1] - hoog, 0.6, 0.5, '#a9844f');
    }
  }
  // Hakblok met een bijl erin, rechts voor de hut.
  const blokX = cx + 22.5;
  const blokY = cy + 3.4;
  ovaal(ctx, blokX, blokY + 0.6, 4, 1.8, 'rgba(0,0,0,0.28)');
  blok(ctx, blokX - 2.6, blokY - 3.6, 5.2, 3.8, '#6b4a2b');
  ovaal(ctx, blokX, blokY + 0.2, 2.6, 1.2, '#6b4a2b');
  ovaal(ctx, blokX, blokY - 3.6, 2.6, 1.2, '#d2b07a');
  lijn(ctx, blokX + 0.4, blokY - 4, blokX + 4.6, blokY - 11, '#5a4126', 1.2);
  vlak(ctx, [[blokX - 1.6, blokY - 5.6], [blokX + 1.2, blokY - 6.2], [blokX + 1.4, blokY - 3.4], [blokX - 1.2, blokY - 3.2]], '#c9ced6');
  return hut;
}

// De steengroeve: uitgehakte blokken steen en een houten driepoot om ze
// op te takelen.
export function tekenSteengroeve(naam, def) {
  const b = TB + 6;
  const h = TH + 48;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  const toeval = toevalVoor(naam);
  const hout = '#6b4a2b';

  // Gruis op de grond
  ovaal(ctx, cx, cy + 1, 27, 12.5, 'rgba(134,128,116,0.6)');
  for (let i = 0; i < 16; i++) {
    const hoek = toeval() * Math.PI * 2;
    const ver = toeval();
    blok(ctx, cx + Math.cos(hoek) * 24 * ver, cy + 1 + Math.sin(hoek) * 11 * ver, 1.6, 1, toeval() < 0.5 ? 'rgba(210,206,196,0.75)' : 'rgba(80,76,68,0.5)');
  }
  // Het grote ruwe blok achteraan, met een kleiner blok erop
  steenBlok(ctx, cx - 10, cy - 3, 13, 6.5, 13, def.kleur, toeval);
  steenBlok(ctx, cx - 13, cy - 16.5, 6.5, 3.2, 6.5, tint(def.kleur, 0.06), null);

  // De driepoot: twee poten achter, het touw met een blok eraan, dan de voorste poot
  const top = [cx + 12, cy - 40];
  lijn(ctx, cx + 3, cy - 6, top[0], top[1], tint(hout, -0.2), 1.8);
  lijn(ctx, cx + 24, cy - 5, top[0], top[1], hout, 1.8);
  lijn(ctx, top[0], top[1] + 2, top[0], cy - 17, '#d8cfb4', 0.8);
  steenBlok(ctx, cx + 12, cy - 9.5, 5, 2.5, 5.5, tint(def.kleur, 0.1), null);
  lijn(ctx, cx + 7.5, cy - 13, cx + 16.5, cy - 13, '#d8cfb4', 0.7);
  lijn(ctx, cx + 13, cy + 3.5, top[0], top[1], tint(hout, 0.15), 2);
  ovaal(ctx, top[0], top[1] + 1, 2, 2, '#3d2c18');

  // Twee afgewerkte blokken vooraan, klaar om weg te dragen
  steenBlok(ctx, cx - 15, cy + 6, 5, 2.5, 4.5, tint(def.kleur, 0.08), null);
  steenBlok(ctx, cx + 1, cy + 9, 5.5, 2.7, 4.5, tint(def.kleur, 0.04), null);
  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

// De kazerne: een stenen gebouw met een banier in jouw kleur, een schild
// aan de wand en een rek met speren.
// De magiertoren (mystieke kazerne): een ronde stenen toren met een spits
// paars dak, een gloeiend raam, lila rook en een banier met een ster.
export function tekenMagiertoren(naam, def) {
  const b = TB + 6;
  const h = TH + 92;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  const r = 15;
  const hoog = 44;
  ovaal(ctx, cx + 3, cy + 3, 26, 11, 'rgba(0,0,0,0.25)');
  // Voet en ronde muur
  ovaal(ctx, cx, cy, r + 3, (r + 3) / 2, tint(def.kleur, -0.2));
  blok(ctx, cx - r, cy - hoog, r * 2, hoog, def.kleur);
  ovaal(ctx, cx, cy, r, r / 2, def.kleur);
  const grad = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0.35)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - hoog, r * 2, hoog);
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r / 2, 0, 0, Math.PI);
  ctx.fill();
  // Stenen voegen
  for (let rij = 1; rij < 8; rij++) {
    const y = cy - rij * 5.5;
    ctx.strokeStyle = 'rgba(40,36,30,0.25)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.ellipse(cx, y, r, r / 2, 0, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }
  // Deur en gloeiende ramen
  ctx.fillStyle = '#2a1d14';
  ctx.beginPath();
  ctx.ellipse(cx + 3, cy + 1, 3.6, 5.5, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  blok(ctx, cx - 0.6, cy + 1, 7.2, 5, '#2a1d14');
  for (const [x, y] of [[cx + 4, cy - 24], [cx - 6, cy - 34]]) {
    ovaal(ctx, x, y, 3.6, 4.4, 'rgba(180,120,255,0.35)');
    blok(ctx, x - 1.5, y - 2.6, 3, 5, '#e8c8ff');
    blok(ctx, x - 0.2, y - 2.6, 0.4, 5, '#5a3a8a');
  }
  // Spits dak
  const top = cy - hoog;
  vlak(ctx, [[cx - r - 3, top + 2], [cx, top - 36], [cx + r + 3, top + 2]], def.dak);
  vlak(ctx, [[cx, top - 36], [cx + r + 3, top + 2], [cx + 4, top + 4]], tint(def.dak, 0.18));
  ovaal(ctx, cx, top + 2, r + 3, 4, tint(def.dak, -0.25));
  // Banier met ster op de punt
  lijn(ctx, cx, top - 36, cx, top - 48, '#2b2118', 1);
  vlak(ctx, [[cx, top - 48], [cx + 10, top - 46], [cx, top - 42]], '#5a3aa8');
  ctx.fillStyle = '#ffe28a';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const hoek = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? 0.9 : 2;
    ctx.lineTo(cx + 4 + Math.cos(hoek) * rr, top - 45.4 + Math.sin(hoek) * rr);
  }
  ctx.fill();
  // Lila rook uit een schoorsteentje
  blok(ctx, cx + 7, top - 14, 2.6, 6, tint(def.kleur, -0.1));
  for (const [dx, dy, rr] of [[8.5, -17, 2], [10, -21, 2.6], [9, -25.5, 3]]) ovaal(ctx, cx + dx, top + dy, rr, rr * 0.85, 'rgba(200,170,255,0.5)');
  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

export function tekenKazerne(naam, def) {
  const huis = huisVariant(naam, def, 0);
  const ctx = huis.beeld.getContext('2d');
  const cx = huis.ax;
  const cy = huis.ay - HH;
  const L = [cx - 25, cy];
  const B = [cx, cy + 12.5];
  const R = [cx + 25, cy];
  const wand = 15;

  // Voegen in de stenen wanden
  for (const hoog of [5, 10]) {
    lijn(ctx, L[0], L[1] - hoog, B[0], B[1] - hoog, 'rgba(40,36,28,0.25)', 0.6);
    lijn(ctx, B[0], B[1] - hoog, R[0], R[1] - hoog, 'rgba(40,36,28,0.2)', 0.6);
  }
  // Rek met drie speren tegen de schaduwwand
  const rekA = tussen(L, B, 0.2);
  const rekB = tussen(L, B, 0.7);
  lijn(ctx, rekA[0], rekA[1] - 6, rekB[0], rekB[1] - 6, '#5a4126', 1.2);
  for (const deel of [0.28, 0.45, 0.62]) {
    const p = tussen(L, B, deel);
    lijn(ctx, p[0] - 1, p[1] + 0.5, p[0] + 1.5, p[1] - wand - 5, '#6b4a2b', 1);
    vlak(ctx, [[p[0] + 0.6, p[1] - wand - 4], [p[0] + 1.9, p[1] - wand - 8.5], [p[0] + 2.8, p[1] - wand - 4.2]], '#cfd4db');
  }
  // Schild in jouw kleur naast de deur
  const schild = tussen(B, R, 0.39);
  ovaal(ctx, schild[0], schild[1] - 8.5, 3.1, 3.6, '#2a2a2a');
  ovaal(ctx, schild[0], schild[1] - 8.5, 2.5, 3, def.kleur);
  blok(ctx, schild[0] - 0.4, schild[1] - 11.2, 0.9, 5.4, '#f1ead6');
  blok(ctx, schild[0] - 2.2, schild[1] - 9, 4.4, 0.9, '#f1ead6');
  // Banier op het dak
  const voet = [cx + 13, cy - wand - 9];
  lijn(ctx, voet[0], voet[1], voet[0], voet[1] - 21, '#3a2c1a', 1.3);
  vlak(ctx, [[voet[0] + 0.6, voet[1] - 21], [voet[0] + 12, voet[1] - 18.4], [voet[0] + 0.6, voet[1] - 12.5]], def.kleur);
  vlak(ctx, [[voet[0] + 0.6, voet[1] - 17.6], [voet[0] + 6.8, voet[1] - 16.6], [voet[0] + 0.6, voet[1] - 15.6]], '#f1ead6');
  ovaal(ctx, voet[0], voet[1] - 21.6, 1.2, 1.2, '#d9b64a');
  return huis;
}

// Een tarweveld: omgeploegde aarde met rijen gouden aren en een laag hek.
export function tekenTarweveld(naam, def) {
  const b = TB + 4;
  const h = TH + 18;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  const toeval = toevalVoor(naam);
  vlak(ctx, [[cx, cy - 15], [cx + 30, cy], [cx, cy + 15], [cx - 30, cy]], '#8a6a3e');
  // Voren en aren, van achter naar voren
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    const P = [cx - 30 + 30 * t, cy - 15 * t];          // linkerrand naar achterhoek
    const Q = [P[0] + 30, P[1] + 15];                    // evenwijdig naar voren rechts
    lijn(ctx, P[0], P[1], Q[0], Q[1], 'rgba(60,40,20,0.35)', 0.8);
    for (let j = 1; j < 9; j++) {
      const s = j / 9;
      const x = P[0] + (Q[0] - P[0]) * s;
      const y = P[1] + (Q[1] - P[1]) * s;
      const hoog = 5 + toeval() * 2.5;
      lijn(ctx, x, y, x + 0.4, y - hoog, tint(def.aar, -0.25), 0.7);
      ovaal(ctx, x + 0.5, y - hoog, 0.9, 1.8, toeval() < 0.5 ? def.aar : tint(def.aar, 0.15));
    }
  }
  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

// Een bakkerij: een huis van rode baksteen met een grote bolle broodoven
// aan de zijkant (met gloed in de opening), rook uit de schoorsteen, een
// uithangbord met een krakeling en een bank met broden voor de deur.
export function tekenBakkerij(naam, def) {
  const huis = huisVariant(naam, def, 0);
  const ctx = huis.beeld.getContext('2d');
  const cx = huis.ax;
  const cy = huis.ay - HH;
  const L = [cx - 25, cy];
  const B = [cx, cy + 12.5];
  const R = [cx + 25, cy];
  const wand = 15;
  const steen = '#a24a32';

  // Voegen: baksteen in rijen over beide wanden
  for (let hoog = 2.5; hoog < wand; hoog += 2.5) {
    lijn(ctx, L[0], L[1] - hoog, B[0], B[1] - hoog, 'rgba(255,230,200,0.18)', 0.5);
    lijn(ctx, B[0], B[1] - hoog, R[0], R[1] - hoog, 'rgba(255,230,200,0.22)', 0.5);
  }

  // De broodoven: een bolle koepel van baksteen tegen de linkerwand
  const o = tussen(L, B, 0.42);
  const ox = o[0] - 3;
  const oy = o[1] + 4;
  ovaal(ctx, ox + 1.5, oy + 1, 11, 4.4, 'rgba(0,0,0,0.25)');
  blok(ctx, ox - 10, oy - 3, 20, 3.2, tint(steen, -0.25));        // voet
  ctx.fillStyle = steen;
  ctx.beginPath();
  ctx.ellipse(ox, oy - 3, 10, 10, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tint(steen, 0.18);
  ctx.beginPath();
  ctx.ellipse(ox + 2.5, oy - 5, 5, 6.5, 0, Math.PI * 1.1, Math.PI * 1.9);
  ctx.fill();
  for (const [dx, dy] of [[-6, -5], [-2, -9], [3, -8], [6, -4], [-4, -10.5], [1, -12]]) blok(ctx, ox + dx, oy + dy, 2.6, 0.6, 'rgba(60,20,10,0.35)');
  // Opening met vuur
  ctx.fillStyle = '#2a140c';
  ctx.beginPath();
  ctx.ellipse(ox - 1, oy - 3, 3.6, 4.2, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  blok(ctx, ox - 4.6, oy - 3, 7.2, 1.2, '#2a140c');
  ovaal(ctx, ox - 1, oy - 3.3, 2.4, 1.5, '#f08a2a');
  ovaal(ctx, ox - 1, oy - 3.6, 1.2, 0.8, '#ffd36a');
  // Ovenpijpje met rook
  blok(ctx, ox + 3, oy - 16, 2.6, 4.5, tint(steen, -0.1));
  for (const [dx, dy, r] of [[4.5, -19, 2], [6, -22.5, 2.6], [5, -26.5, 3.1]]) ovaal(ctx, ox + dx, oy + dy, r, r * 0.85, 'rgba(225,225,225,0.55)');

  // Uithangbord met een krakeling aan de lichte wand
  const hang = tussen(B, R, 0.86);
  const hx = hang[0];
  const hy = hang[1] - wand + 2;
  lijn(ctx, hx, hy, hx + 7, hy - 1, '#2b2118', 1.1);
  lijn(ctx, hx + 6.5, hy - 1, hx + 6.5, hy + 1.6, '#2b2118', 0.6);
  ctx.strokeStyle = '#b8762f';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(hx + 5.2, hy + 4.6, 2.1, 2.1, 0, 0, Math.PI * 2);
  ctx.ellipse(hx + 7.8, hy + 4.6, 2.1, 2.1, 0, 0, Math.PI * 2);
  ctx.stroke();
  lijn(ctx, hx + 4.2, hy + 7, hx + 8.8, hy + 7, '#b8762f', 1.4);

  // Een bank met broden voor de deur en twee meelzakken
  const bank = tussen(B, R, 0.45);
  const bx = bank[0];
  const by = bank[1] + 4;
  blok(ctx, bx - 5, by - 4, 11, 1.6, '#7a5632');
  blok(ctx, bx - 4.5, by - 2.4, 1.2, 3.4, '#5a3d22');
  blok(ctx, bx + 4.2, by - 2.4, 1.2, 3.4, '#5a3d22');
  for (const dx of [-3, 0.4, 3.8]) ovaal(ctx, bx + dx, by - 5, 1.7, 1.2, '#c27e3c');
  for (const dx of [-3, 0.4, 3.8]) lijn(ctx, bx + dx - 0.8, by - 5.4, bx + dx + 0.6, by - 5.6, 'rgba(255,235,190,0.6)', 0.5);
  const zak = tussen(L, B, 0.86);
  for (const [dx, dy] of [[-1, 4], [2.4, 5.6]]) {
    ovaal(ctx, zak[0] + dx, zak[1] + dy, 2.4, 3, '#e9e1cc');
    blok(ctx, zak[0] + dx - 1.2, zak[1] + dy - 3.2, 2.4, 0.8, '#b8a888');
  }
  return huis;
}

// Een kopermijn: een heuvel van rots met een stollenmond van balken,
// rails met een karretje vol oranje erts en een lantaarn.
export function tekenKopermijn(naam, def) {
  const b = TB + 6;
  const h = TH + 40;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  const toeval = toevalVoor(naam);
  const balk = '#5a3d22';
  ovaal(ctx, cx, cy + 1, 28, 12.5, 'rgba(110,96,80,0.55)');
  // De heuvel
  vlak(ctx, [[cx - 27, cy + 1], [cx - 20, cy - 16], [cx - 6, cy - 27], [cx + 9, cy - 24], [cx + 22, cy - 12], [cx + 27, cy + 1], [cx, cy + 10]], def.kleur);
  vlak(ctx, [[cx - 20, cy - 16], [cx - 6, cy - 27], [cx + 9, cy - 24], [cx, cy - 15], [cx - 11, cy - 13]], 'rgba(255,250,235,0.2)');
  vlak(ctx, [[cx - 27, cy + 1], [cx - 20, cy - 16], [cx - 11, cy - 13], [cx - 12, cy + 6]], 'rgba(0,0,0,0.2)');
  for (let i = 0; i < 7; i++) {
    const x = cx - 18 + toeval() * 36;
    const y = cy - 20 + toeval() * 16;
    lijn(ctx, x, y, x + 4, y + 1.5, '#d07a3a', 1.6);
  }
  for (let i = 0; i < 4; i++) ovaal(ctx, cx - 16 + toeval() * 30, cy - 20 + toeval() * 14, 1.4, 1, '#4fa88a');
  // Stollenmond: donker gat met twee stijlen en een bovenbalk
  const mx = cx + 4;
  const my = cy - 2;
  vlak(ctx, [[mx - 7, my], [mx - 7, my - 11], [mx - 4, my - 14], [mx + 4, my - 14], [mx + 7, my - 11], [mx + 7, my]], '#1c1712');
  blok(ctx, mx - 8.5, my - 13, 2.4, 13, balk);
  blok(ctx, mx + 6.1, my - 13, 2.4, 13, balk);
  blok(ctx, mx - 10, my - 15.5, 20, 2.8, tint(balk, 0.15));
  lijn(ctx, mx - 10, my - 12.8, mx + 10, my - 12.8, 'rgba(0,0,0,0.35)', 0.6);
  // Rails naar voren
  lijn(ctx, mx - 3, my, mx - 9, my + 9, '#4a4038', 0.9);
  lijn(ctx, mx + 3, my, mx + 0, my + 10.5, '#4a4038', 0.9);
  for (let i = 1; i < 5; i++) lijn(ctx, mx - 3 - i * 1.5 - 1.2, my + i * 2.3, mx + 3 - i * 0.75 + 1.2, my + i * 2.6, balk, 0.8);
  // Karretje met erts
  const kx = mx - 6;
  const ky = my + 7;
  vlak(ctx, [[kx - 5, ky - 4], [kx + 5, ky - 4], [kx + 4, ky + 1], [kx - 4, ky + 1]], '#6b5a48');
  blok(ctx, kx - 5, ky - 4.4, 10, 1, '#3e342a');
  for (const [dx, kl] of [[-3, '#d07a3a'], [-0.5, '#e39258'], [2.2, '#c26a2e'], [0.8, '#4fa88a']]) ovaal(ctx, kx + dx, ky - 5, 1.7, 1.3, kl);
  ovaal(ctx, kx - 3, ky + 1.6, 1.3, 1.3, '#2a241e');
  ovaal(ctx, kx + 3, ky + 1.6, 1.3, 1.3, '#2a241e');
  // Lantaarn aan de stijl
  lijn(ctx, mx + 8.6, my - 10, mx + 11, my - 10, '#2b2118', 0.7);
  blok(ctx, mx + 10.2, my - 10, 2, 3, '#2b2118');
  ovaal(ctx, mx + 11.2, my - 8.5, 0.8, 1, '#ffd36a');
  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

export function tekenBoomgaard(naam, def) {
  const b = TB + 4;
  const h = TH + 30;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const cy = h - 1 - HH;
  const toeval = toevalVoor(naam);
  const hout = '#6b4a2b';

  // Omgespitte grond onder de bomen
  vlak(ctx, [[cx, cy - 13], [cx + 26, cy], [cx, cy + 13], [cx - 26, cy]], 'rgba(92,72,40,0.32)');

  // Het hek langs de twee achterste randen komt eerst, de bomen staan ervoor.
  const hek = (P, Q) => {
    lijn(ctx, P[0], P[1] - 4, Q[0], Q[1] - 4, hout, 0.9);
    lijn(ctx, P[0], P[1] - 1.8, Q[0], Q[1] - 1.8, tint(hout, -0.1), 0.9);
    for (const deel of [0, 0.25, 0.5, 0.75, 1]) {
      const p = tussen(P, Q, deel);
      blok(ctx, p[0] - 0.7, p[1] - 5.6, 1.4, 5.8, tint(hout, 0.1));
    }
  };
  hek([cx - 28, cy], [cx, cy - 14]);
  hek([cx, cy - 14], [cx + 28, cy]);

  const boom = (x, y, maat) => {
    ovaal(ctx, x + 2, y + 1, 8 * maat, 3 * maat, 'rgba(0,0,0,0.22)');
    blok(ctx, x - 1.1, y - 9 * maat, 2.2, 9 * maat, '#5e4326');
    ovaal(ctx, x, y - 13 * maat, 8.5 * maat, 7.5 * maat, tint(def.blad, -0.2));
    ovaal(ctx, x + 1.4 * maat, y - 14.6 * maat, 6.6 * maat, 5.6 * maat, def.blad);
    ovaal(ctx, x + 2.8 * maat, y - 16.4 * maat, 3.6 * maat, 2.8 * maat, tint(def.blad, 0.16));
    for (let i = 0; i < 6; i++) {
      const hoek = toeval() * Math.PI * 2;
      const ver = 0.35 + toeval() * 0.5;
      ovaal(ctx, x + Math.cos(hoek) * 7 * maat * ver, y - 13 * maat + Math.sin(hoek) * 6 * maat * ver, 1.3, 1.3, def.appel);
    }
  };
  // Van achter naar voren, zodat de voorste boom over de achterste valt.
  boom(cx + 1, cy - 4, 0.92);
  boom(cx - 14, cy + 3, 1);
  boom(cx + 14, cy + 4, 1);

  // Het hek langs de twee voorste randen, en een mand appels bij de ingang.
  hek([cx - 28, cy], [cx - 9, cy + 9.5]);
  hek([cx + 9, cy + 9.5], [cx + 28, cy]);
  vlak(ctx, [[cx - 4.6, cy + 8.4], [cx + 3.6, cy + 8.4], [cx + 2.6, cy + 13], [cx - 3.6, cy + 13]], '#a47a45');
  blok(ctx, cx - 4.9, cy + 8, 8.8, 1.1, '#80603a');
  for (const [ax, ay] of [[-2.6, 7.4], [-0.4, 6.8], [1.8, 7.4], [-1.4, 8], [0.8, 8]]) ovaal(ctx, cx + ax, cy + ay, 1.3, 1.2, def.appel);

  return { beeld: doek, b, h, ax: cx, ay: h - 1 };
}

export function tekenTent(naam, def) {
  const b = TB;
  const h = 58;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const voet = h - HH;
  const top = [cx, voet - 31];
  ovaal(ctx, cx + 2, voet + 3, 20, 8, 'rgba(0,0,0,0.24)');
  vlak(ctx, [top, [cx - 18, voet + 1], [cx, voet + 10]], tint(def.kleur, -0.28));
  vlak(ctx, [top, [cx, voet + 10], [cx + 18, voet + 1]], def.kleur);
  // Banen in het doek
  for (const deel of [0.33, 0.66]) {
    const p = tussen([cx, voet + 10], [cx + 18, voet + 1], deel);
    lijn(ctx, top[0], top[1], p[0], p[1], 'rgba(0,0,0,0.12)', 0.7);
    const q = tussen([cx - 18, voet + 1], [cx, voet + 10], deel);
    lijn(ctx, top[0], top[1], q[0], q[1], 'rgba(0,0,0,0.14)', 0.7);
  }
  // Ingang en gekleurde punt
  vlak(ctx, [[cx + 5.5, voet + 7.2], [cx + 11, voet + 4.4], [cx + 7, voet - 10]], '#2a2118');
  vlak(ctx, [top, [cx - 5.2, voet - 22], [cx, voet - 19], [cx + 5.2, voet - 22]], def.accent);
  blok(ctx, cx - 0.6, top[1] - 8, 1.2, 8, '#3a2a1c');
  vlak(ctx, [[cx + 0.6, top[1] - 8], [cx + 8, top[1] - 6.4], [cx + 0.6, top[1] - 4.2]], def.accent);
  return { beeld: doek, b, h, ax: cx, ay: h };
}

export function tekenHooiberg(naam, def) {
  const b = TB;
  const h = 52;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const voet = h - HH;
  const toeval = toevalVoor(naam);
  ovaal(ctx, cx + 2, voet + 3, 18, 7.5, 'rgba(0,0,0,0.24)');
  const vorm = () => {
    ctx.beginPath();
    ctx.moveTo(cx - 15, voet);
    ctx.quadraticCurveTo(cx - 15, voet - 28, cx, voet - 29);
    ctx.quadraticCurveTo(cx + 15, voet - 28, cx + 15, voet);
    ctx.ellipse(cx, voet, 15, 7, 0, 0, Math.PI);
    ctx.closePath();
  };
  vorm();
  ctx.fillStyle = def.kleur;
  ctx.fill();
  ctx.save();
  vorm();
  ctx.clip();
  blok(ctx, cx - 16, voet - 30, 12, 40, 'rgba(0,0,0,0.2)');
  for (let i = 0; i < 46; i++) {
    const x = cx - 15 + toeval() * 30;
    const y = voet - 28 + toeval() * 34;
    lijn(ctx, x, y, x + (toeval() - 0.5) * 3, y + 3 + toeval() * 3, toeval() < 0.5 ? 'rgba(255,240,170,0.4)' : 'rgba(90,60,10,0.3)', 0.7);
  }
  ctx.restore();
  return { beeld: doek, b, h, ax: cx, ay: h };
}

export function tekenPut(naam, def) {
  const b = TB;
  const h = 56;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const voet = h - HH;
  ovaal(ctx, cx + 2, voet + 3, 15, 6.5, 'rgba(0,0,0,0.24)');
  // Stenen ring
  ctx.fillStyle = tint(def.kleur, -0.2);
  ctx.beginPath();
  ctx.moveTo(cx - 11, voet - 8);
  ctx.lineTo(cx - 11, voet);
  ctx.ellipse(cx, voet, 11, 5.5, 0, Math.PI, 0, true);
  ctx.lineTo(cx + 11, voet - 8);
  ctx.closePath();
  ctx.fill();
  blok(ctx, cx + 2, voet - 8, 9, 12, 'rgba(255,250,235,0.14)');
  for (const y of [voet - 4, voet]) {
    ctx.strokeStyle = 'rgba(40,30,15,0.35)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(cx, y, 11, 5.5, 0, 0, Math.PI);
    ctx.stroke();
  }
  ovaal(ctx, cx, voet - 8, 11, 5.5, tint(def.kleur, 0.12));
  ovaal(ctx, cx, voet - 8, 7.5, 3.6, '#22313a');
  // Houten stellage met dakje en emmer
  blok(ctx, cx - 10.5, voet - 27, 1.8, 20, '#5a4028');
  blok(ctx, cx + 8.7, voet - 27, 1.8, 20, '#4a3420');
  blok(ctx, cx - 10, voet - 21, 20, 1.6, '#3a2a1c');
  lijn(ctx, cx, voet - 20, cx, voet - 12, '#c9b98f', 0.6);
  blok(ctx, cx - 1.8, voet - 12.5, 3.6, 3.4, '#6b4a2b');
  vlak(ctx, [[cx - 14, voet - 26], [cx, voet - 35], [cx + 14, voet - 26], [cx, voet - 23]], def.dak);
  vlak(ctx, [[cx - 14, voet - 26], [cx, voet - 35], [cx, voet - 23]], 'rgba(0,0,0,0.25)');
  return { beeld: doek, b, h, ax: cx, ay: h };
}

export function tekenVaten(naam, def) {
  const b = TB;
  const h = 44;
  const { doek, ctx } = nieuwDoek(b, h);
  const cx = b / 2;
  const voet = h - HH;
  ovaal(ctx, cx + 2, voet + 3, 16, 6.5, 'rgba(0,0,0,0.24)');
  const vat = (x, y) => {
    ctx.fillStyle = def.kleur;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 11);
    ctx.quadraticCurveTo(x - 6.4, y - 5, x - 5, y);
    ctx.ellipse(x, y, 5, 2.4, 0, Math.PI, 0, true);
    ctx.quadraticCurveTo(x + 6.4, y - 5, x + 5, y - 11);
    ctx.closePath();
    ctx.fill();
    blok(ctx, x - 5.6, y - 11, 3, 12, 'rgba(0,0,0,0.22)');
    for (const band of [-8.5, -2.5]) {
      ctx.strokeStyle = '#2f2a26';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y + band, 5.5, 2.4, 0, 0, Math.PI);
      ctx.stroke();
    }
    ovaal(ctx, x, y - 11, 5, 2.4, tint(def.kleur, 0.2));
    ovaal(ctx, x, y - 11, 3.6, 1.6, tint(def.kleur, -0.1));
  };
  vat(cx - 7, voet - 1);
  vat(cx + 3, voet - 4);
  // Een kist ervoor
  steenBlok(ctx, cx + 9, voet + 3, 6.5, 3.2, 7, '#9a7446', null);
  lijn(ctx, cx + 9, voet + 6.2, cx + 9, voet - 0.8, 'rgba(0,0,0,0.3)', 0.7);
  return { beeld: doek, b, h, ax: cx, ay: h };
}
