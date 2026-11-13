// LANDSCHAP: tekent de grond (gras, zand, water, aarde) als één doorlopend
// beeld in plaats van als losse ruitvormige tegels.
//
// Waarom: met losse tegels zie je overal de ruitranden, en meren en stranden
// zien eruit als trapjes. Hier wordt de grond per pixel berekend uit een
// vloeiend "veld" dat uit de kaart komt:
//   - de kust is een zachte, onregelmatige lijn (de tegelgrens wordt
//     verschoven met ruis, dus nooit meer een rechte rand);
//   - water wordt dieper naarmate het verder van de kust ligt, met schuim;
//   - waar gras aan water grenst, ligt vanzelf een smal strand;
//   - lichte en donkere graskleuren lopen vloeiend in elkaar;
//   - kleine details (grassprieten, bloemen, steentjes, rimpels) komen
//     van een vast toevalsraster, zodat ze op elke plek hetzelfde blijven.
//
// Het spel verandert hierdoor niet: wat water, zand of land is staat nog
// steeds in kaart.grond. Dit is alleen het plaatje. Akkers blijven
// gewone tegels (die zijn bewust rechthoekig) en worden door de tekenlaag
// zelf getekend.
//
// De grond wordt in stukken van 256 bij 128 wereldpixels getekend, pas als
// ze in beeld komen, en daarna bewaard. In rustige momenten maakt het spel
// de stukken eromheen alvast klaar.

import { GROND } from './kaart.js';
import { HALVE_BREEDTE as HB, HALVE_HOOGTE as HH } from './iso.js';

const R = 8;                 // roosterpunten per tegel in het veld
const CB = 256;              // breedte van een stuk in wereldpixels
const CH = 128;              // hoogte van een stuk
const S = 2;                 // pixels per wereldpixel (scherpte van de afgewerkte stukken)
const S_GROF = 0.5;          // snelle voorlopige versie, tot het scherpe stuk klaar is
const BUDGET_MS = 14;        // zoveel tijd per beeld voor het verscherpen van stukken
const OVERLAP = 2;           // stukken overlappen, zodat er geen naden zijn
const MAX_STUKKEN = 90;      // zoveel stukken bewaren we (ca. 0,5 MB per stuk)
const TEX = 512;             // maat van de korreltextuur (herhaalt na 256 wereldpixels)

// Kleuren (r, g, b)
const GRAS_LICHT = [112, 150, 72];
const GRAS_DONKER = [90, 126, 58];
const ZAND = [208, 190, 138];
const ZAND_NAT = [168, 150, 104];
const AARDE = [140, 117, 84];
const WATER_ONDIEP = [86, 150, 166];
const WATER_DIEP = [42, 88, 124];

// --- Ruis --------------------------------------------------------------------

function hasj(ix, iy, z) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(z, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Vloeiende ruis tussen 0 en 1.
function ruis(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let u = x - ix;
  let v = y - iy;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  const a = hasj(ix, iy, z);
  const b = hasj(ix + 1, iy, z);
  const c = hasj(ix, iy + 1, z);
  const d = hasj(ix + 1, iy + 1, z);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Drie lagen ruis op elkaar, ongeveer tussen -0,5 en 0,5.
function ruis3(x, y, z) {
  return ruis(x, y, z) * 0.55 + ruis(x * 2.1 + 7.3, y * 2.1 + 1.7, z + 1) * 0.3 + ruis(x * 4.3 + 3.1, y * 4.3 + 9.4, z + 2) * 0.15 - 0.5;
}

// Ruis die na 'periode' cellen herhaalt, voor de textuur.
function ruisHerhaal(x, y, periode, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let u = x - ix;
  let v = y - iy;
  u = u * u * (3 - 2 * u);
  v = v * v * (3 - 2 * v);
  const m = (n) => ((n % periode) + periode) % periode;
  const a = hasj(m(ix), m(iy), z);
  const b = hasj(m(ix + 1), m(iy), z);
  const c = hasj(m(ix), m(iy + 1), z);
  const d = hasj(m(ix + 1), m(iy + 1), z);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Twee korreltexturen die naadloos herhalen: fijn (korrel) en vlek (zachte
// vlekken van ca. 20 pixels). Waarden van -127 tot 127.
let FIJN = null;
let VLEK = null;
function maakTexturen() {
  if (FIJN) return;
  FIJN = new Int8Array(TEX * TEX);
  VLEK = new Int8Array(TEX * TEX);
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const korrel = hasj(x, y, 77) - 0.5;
      const zacht = ruisHerhaal(x / 4, y / 4, TEX / 4, 5) - 0.5;
      FIJN[y * TEX + x] = Math.round((korrel * 0.9 + zacht * 0.9) * 127);
      const g = ruisHerhaal(x / 64, y / 64, TEX / 64, 11) * 0.55 + ruisHerhaal(x / 32, y / 32, TEX / 32, 12) * 0.3 + ruisHerhaal(x / 16, y / 16, TEX / 16, 13) * 0.15 - 0.5;
      VLEK[y * TEX + x] = Math.round(Math.max(-1, Math.min(1, g * 2.4)) * 127);
    }
  }
}

const klem = (a, lo, hi) => (a < lo ? lo : a > hi ? hi : a);
const stap = (a, b, x) => {
  const t = klem((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// --- Het veld ------------------------------------------------------------------
// Uit de tegels van de kaart rekenen we een vloeiend veld uit op een fijn
// rooster. Elk kanaal loopt van 0 tot 1 (land ook iets daarbuiten door de ruis).

function vervaag(bron, b, h, straal, keer) {
  let van = Float32Array.from(bron);
  let naar = new Float32Array(van.length);
  for (let k = 0; k < keer; k++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < b; x++) {
        let som = 0;
        let n = 0;
        for (let dy = -straal; dy <= straal; dy++) {
          for (let dx = -straal; dx <= straal; dx++) {
            const xx = klem(x + dx, 0, b - 1);
            const yy = klem(y + dy, 0, h - 1);
            som += van[yy * b + xx];
            n++;
          }
        }
        naar[y * b + x] = som / n;
      }
    }
    [van, naar] = [naar, van];
  }
  return van;
}

function bouwVeld(kaart, zaad) {
  const N = kaart.breedte;
  const M = kaart.hoogte;
  const LB = N * R + 2;
  const LH = M * R + 2;
  const water = new Float32Array(N * M);
  const zand = new Float32Array(N * M);
  const aarde = new Float32Array(N * M);
  const donker = new Float32Array(N * M);
  for (let i = 0; i < N * M; i++) {
    const g = kaart.grond[i];
    water[i] = g === GROND.WATER ? 1 : 0;
    zand[i] = g === GROND.ZAND ? 1 : 0;
    aarde[i] = g === GROND.AARDE ? 1 : 0;
    donker[i] = g === GROND.GRAS_DONKER ? 1 : 0.35;
  }
  const diepTegel = vervaag(water, N, M, 2, 3);
  const veld = {
    N, M, LB, LH,
    land: new Float32Array(LB * LH),
    zand: new Float32Array(LB * LH),
    aarde: new Float32Array(LB * LH),
    donker: new Float32Array(LB * LH),
    diep: new Float32Array(LB * LH),
  };
  // Waarde van een tegelkanaal op een plek in tegelmaat (vloeiend tussen de middens)
  const bij = (kanaal, gx, gy) => {
    const px = gx - 0.5;
    const py = gy - 0.5;
    const x0 = Math.floor(px);
    const y0 = Math.floor(py);
    const u = px - x0;
    const v = py - y0;
    const lees = (x, y) => kanaal[klem(y, 0, M - 1) * N + klem(x, 0, N - 1)];
    return lees(x0, y0) * (1 - u) * (1 - v) + lees(x0 + 1, y0) * u * (1 - v) + lees(x0, y0 + 1) * (1 - u) * v + lees(x0 + 1, y0 + 1) * u * v;
  };
  for (let j = 0; j < LH; j++) {
    for (let i = 0; i < LB; i++) {
      const gx = i / R;
      const gy = j / R;
      const k = j * LB + i;
      veld.land[k] = 1 - bij(water, gx, gy) + ruis3(gx * 1.15, gy * 1.15, zaad) * 0.5;
      veld.zand[k] = bij(zand, gx, gy) + ruis3(gx * 1.3 + 40, gy * 1.3 + 40, zaad + 3) * 0.5;
      veld.aarde[k] = bij(aarde, gx, gy) + ruis3(gx * 1.4 + 80, gy * 1.4 + 20, zaad + 6) * 0.5;
      veld.donker[k] = klem(bij(donker, gx, gy) * 0.8 + ruis3(gx * 0.35 + 5, gy * 0.35 + 9, zaad + 9) * 1.1 - 0.1, 0, 1);
      veld.diep[k] = bij(diepTegel, gx, gy);
    }
  }
  return veld;
}

// --- Het landschap --------------------------------------------------------------

export function maakLandschap(kaart) {
  maakTexturen();
  const zaad = (kaart.zaad | 0) % 1000;
  let veld = null;
  let handtekening = '';
  const stukken = new Map();   // scherpe stukken: sleutel -> { doek, gebruikt }
  const grof = new Map();      // voorlopige stukken (klein, blijven bewaard)
  let teller = 0;
  let timer = 0;

  function kaartHandtekening() {
    let h = kaart.breedte * 31 + kaart.hoogte;
    for (let i = 0; i < kaart.grond.length; i++) h = (Math.imul(h, 31) + kaart.grond[i] + 1) | 0;
    return h + ':' + kaart.zaad;
  }

  // Opnieuw uitrekenen als de grond van de kaart anders is geworden.
  function herbouw() {
    const nieuw = kaartHandtekening();
    if (veld && nieuw === handtekening) return;
    handtekening = nieuw;
    veld = bouwVeld(kaart, zaad);
    stukken.clear();
    grof.clear();
  }
  herbouw();

  // Waarden van het veld op een wereldplek (voor de kleine details).
  function veldOp(wx, wy, uit) {
    const gx = (wx / HB + wy / HH) * 0.5;
    const gy = (wy / HH - wx / HB) * 0.5;
    if (gx < 0 || gy < 0 || gx >= veld.N || gy >= veld.M) return false;
    const fx = gx * R;
    const fy = gy * R;
    const i = fx | 0;
    const j = fy | 0;
    const u = fx - i;
    const v = fy - j;
    const k = j * veld.LB + i;
    const L = veld.LB;
    const w00 = (1 - u) * (1 - v);
    const w10 = u * (1 - v);
    const w01 = (1 - u) * v;
    const w11 = u * v;
    const mix = (a) => a[k] * w00 + a[k + 1] * w10 + a[k + L] * w01 + a[k + L + 1] * w11;
    uit.land = mix(veld.land);
    uit.zand = mix(veld.zand);
    uit.aarde = mix(veld.aarde);
    return true;
  }
  const monster = { land: 0, zand: 0, aarde: 0 };
  // 0 water, 1 zand, 2 aarde, 3 gras, -1 buiten de kaart
  function soortOp(wx, wy) {
    if (!veldOp(wx, wy, monster)) return -1;
    if (monster.land < 0.5) return 0;
    if (monster.land < 0.56 && monster.zand < 0.5) return 1;   // strand langs het water
    if (monster.zand > 0.5) return 1;
    if (monster.aarde > 0.5) return 2;
    return 3;
  }

  // Een stuk van 256 bij 128 wereldpixels tekenen, met schaal S (scherp)
  // of S_GROF (voorlopig, zonder kleine details).
  function maakStuk(cx, cy, S) {
    const x0 = cx * CB;
    const y0 = cy * CH;
    const bw = Math.ceil((CB + OVERLAP) * S);
    const bh = Math.ceil((CH + OVERLAP) * S);
    const doek = document.createElement('canvas');
    doek.width = bw;
    doek.height = bh;
    const c = doek.getContext('2d');
    const beeld = c.createImageData(bw, bh);
    const px32 = new Uint32Array(beeld.data.buffer);
    const { N, M, LB } = veld;
    const vLand = veld.land;
    const vZand = veld.zand;
    const vAarde = veld.aarde;
    const vDonker = veld.donker;
    const vDiep = veld.diep;
    const W = 0.022;   // zachtheid van de kustlijn

    for (let py = 0; py < bh; py++) {
      const wy = y0 + (py + 0.5) / S;
      for (let pxl = 0; pxl < bw; pxl++) {
        const wx = x0 + (pxl + 0.5) / S;
        const gx = (wx / HB + wy / HH) * 0.5;
        const gy = (wy / HH - wx / HB) * 0.5;
        if (gx < 0 || gy < 0 || gx >= N || gy >= M) continue;
        const fx = gx * R;
        const fy = gy * R;
        const i = fx | 0;
        const j = fy | 0;
        const u = fx - i;
        const v = fy - j;
        const k = j * LB + i;
        const w00 = (1 - u) * (1 - v);
        const w10 = u * (1 - v);
        const w01 = (1 - u) * v;
        const w11 = u * v;
        const land = vLand[k] * w00 + vLand[k + 1] * w10 + vLand[k + LB] * w01 + vLand[k + LB + 1] * w11;
        const ti = (Math.floor(wy * 2) & (TEX - 1)) * TEX + (Math.floor(wx * 2) & (TEX - 1));
        const fijn = FIJN[ti] / 127;
        const vlek = VLEK[ti] / 127;
        const fl = land + fijn * 0.02 + vlek * 0.03;

        let r;
        let g;
        let b;
        if (fl < 0.5 + W) {
          // Water: lichter en groenig dichtbij de kust, donkerder in het diepe.
          const diep = vDiep[k] * w00 + vDiep[k + 1] * w10 + vDiep[k + LB] * w01 + vDiep[k + LB + 1] * w11;
          const kust = klem((0.5 - fl) / 0.3, 0, 1);
          const t = klem(0.12 + diep * 0.6 + kust * 0.45, 0, 1);
          const lum = 1 + vlek * 0.05 + fijn * 0.035;
          r = (WATER_ONDIEP[0] + (WATER_DIEP[0] - WATER_ONDIEP[0]) * t) * lum;
          g = (WATER_ONDIEP[1] + (WATER_DIEP[1] - WATER_ONDIEP[1]) * t) * lum;
          b = (WATER_ONDIEP[2] + (WATER_DIEP[2] - WATER_ONDIEP[2]) * t) * lum;
          // Schuim langs de kust
          const schuim = stap(0.41, 0.5, fl) * (0.5 + 0.5 * vlek) * 0.5;
          if (schuim > 0) {
            r += (246 - r) * schuim;
            g += (250 - g) * schuim;
            b += (250 - b) * schuim;
          }
        }
        if (fl > 0.5 - W) {
          // Land
          const zand = vZand[k] * w00 + vZand[k + 1] * w10 + vZand[k + LB] * w01 + vZand[k + LB + 1] * w11;
          const aarde = vAarde[k] * w00 + vAarde[k + 1] * w10 + vAarde[k + LB] * w01 + vAarde[k + LB + 1] * w11;
          const donker = vDonker[k] * w00 + vDonker[k + 1] * w10 + vDonker[k + LB] * w01 + vDonker[k + LB + 1] * w11;
          const sz = stap(0.5 - W, 0.5 + W, zand + fijn * 0.03 + vlek * 0.04);
          const sa = stap(0.5 - W, 0.5 + W, aarde + fijn * 0.03 + vlek * 0.04);
          // Strand: smalle strook zand langs het water, ook waar de kaart gras heeft
          const strook = (1 - stap(0.52, 0.6 + vlek * 0.03, fl)) * 0.92;
          // Nat zand donkerder vlak langs het water
          const nat = (1 - stap(0.5, 0.58, fl)) * 0.75;
          const lumG = 1 + vlek * 0.07 + fijn * 0.045;
          const dk = donker * 0.9;
          let lr = (GRAS_LICHT[0] + (GRAS_DONKER[0] - GRAS_LICHT[0]) * dk) * lumG;
          let lg = (GRAS_LICHT[1] + (GRAS_DONKER[1] - GRAS_LICHT[1]) * dk) * lumG;
          let lb = (GRAS_LICHT[2] + (GRAS_DONKER[2] - GRAS_LICHT[2]) * dk) * lumG;
          const lumA = 1 + vlek * 0.09 + fijn * 0.07;
          const ma = sa * (1 - sz);
          lr += (AARDE[0] * lumA - lr) * ma;
          lg += (AARDE[1] * lumA - lg) * ma;
          lb += (AARDE[2] * lumA - lb) * ma;
          const mz = Math.max(sz, strook * (1 - sa));
          const lumZ = (1 + vlek * 0.05 + fijn * 0.06) * (1 - nat * 0.0);
          const zr = (ZAND[0] + (ZAND_NAT[0] - ZAND[0]) * nat) * lumZ;
          const zg = (ZAND[1] + (ZAND_NAT[1] - ZAND[1]) * nat) * lumZ;
          const zb = (ZAND[2] + (ZAND_NAT[2] - ZAND[2]) * nat) * lumZ;
          lr += (zr - lr) * mz;
          lg += (zg - lg) * mz;
          lb += (zb - lb) * mz;
          // Kustlijn: van water naar land
          const a = stap(0.5 - W, 0.5 + W, fl);
          if (fl >= 0.5 + W) {
            r = lr; g = lg; b = lb;
          } else {
            r += (lr - r) * a;
            g += (lg - g) * a;
            b += (lb - b) * a;
          }
        }
        px32[py * bw + pxl] = (255 << 24) | ((b > 255 ? 255 : b < 0 ? 0 : b) << 16) | ((g > 255 ? 255 : g < 0 ? 0 : g) << 8) | (r > 255 ? 255 : r < 0 ? 0 : r);
      }
    }
    c.putImageData(beeld, 0, 0);
    if (S < 1) return { doek, x0, y0, b: bw / S, h: bh / S };

    // Kleine details op een vast raster van 12 bij 12 pixels, zodat
    // aangrenzende stukken dezelfde details tekenen.
    c.setTransform(S, 0, 0, S, -x0 * S, -y0 * S);
    c.lineCap = 'round';
    const CEL = 12;
    const cMin = Math.floor((x0 - 6) / CEL);
    const cMax = Math.floor((x0 + CB + OVERLAP + 6) / CEL);
    const rMin = Math.floor((y0 - 6) / CEL);
    const rMax = Math.floor((y0 + CH + OVERLAP + 6) / CEL);
    for (let ry = rMin; ry <= rMax; ry++) {
      for (let rx = cMin; rx <= cMax; rx++) {
        const h = (n) => hasj(rx, ry, zaad * 7 + n);
        const x = (rx + h(1)) * CEL;
        const y = (ry + h(2)) * CEL;
        const soort = soortOp(x, y);
        if (soort < 0) continue;
        if (soort === 3) {
          // Gras: pluimpjes en hier en daar een bloem of steen
          for (let n = 0; n < 5; n++) {
            const sx = (rx + h(10 + n * 3)) * CEL;
            const sy = (ry + h(11 + n * 3)) * CEL;
            if (soortOp(sx, sy) !== 3) continue;
            const hoogte = 1.6 + h(12 + n * 3) * 2.2;
            const schuin = (h(30 + n) - 0.5) * 1.4;
            c.strokeStyle = h(40 + n) < 0.55 ? 'rgba(238,246,170,0.34)' : 'rgba(10,45,5,0.30)';
            c.lineWidth = 0.8;
            c.beginPath();
            c.moveTo(sx, sy);
            c.lineTo(sx + schuin, sy - hoogte);
            c.stroke();
          }
          const z = h(60);
          if (z < 0.045) {
            for (let n = 0; n < 4; n++) {
              const bx = x + (h(61 + n) - 0.5) * 7;
              const by = y + (h(65 + n) - 0.5) * 3.5;
              c.fillStyle = h(70) < 0.5 ? 'rgba(255,255,255,0.9)' : 'rgba(250,222,90,0.95)';
              c.beginPath();
              c.arc(bx, by, 0.95, 0, Math.PI * 2);
              c.fill();
            }
          } else if (z > 0.975) {
            c.fillStyle = 'rgba(0,0,0,0.20)';
            c.beginPath();
            c.ellipse(x, y + 0.7, 2.1, 1.2, 0, 0, Math.PI * 2);
            c.fill();
            c.fillStyle = 'rgba(165,162,152,0.95)';
            c.beginPath();
            c.ellipse(x, y, 1.9, 1.15, 0, 0, Math.PI * 2);
            c.fill();
          }
        } else if (soort === 1) {
          // Zand: korreltjes, af en toe een steentje
          for (let n = 0; n < 3; n++) {
            const sx = (rx + h(10 + n * 2)) * CEL;
            const sy = (ry + h(11 + n * 2)) * CEL;
            if (soortOp(sx, sy) !== 1) continue;
            c.fillStyle = h(20 + n) < 0.5 ? 'rgba(255,250,225,0.35)' : 'rgba(110,85,40,0.22)';
            c.fillRect(sx, sy, 1.5, 0.8);
          }
          if (h(60) > 0.97) {
            c.fillStyle = 'rgba(150,145,135,0.9)';
            c.beginPath();
            c.ellipse(x, y, 1.6, 1, 0, 0, Math.PI * 2);
            c.fill();
          }
        } else if (soort === 2) {
          for (let n = 0; n < 3; n++) {
            const sx = (rx + h(10 + n * 2)) * CEL;
            const sy = (ry + h(11 + n * 2)) * CEL;
            if (soortOp(sx, sy) !== 2) continue;
            c.fillStyle = h(20 + n) < 0.5 ? 'rgba(205,195,170,0.45)' : 'rgba(45,30,15,0.32)';
            c.beginPath();
            c.ellipse(sx, sy, 1 + h(25 + n), 0.7, 0, 0, Math.PI * 2);
            c.fill();
          }
        } else if (soort === 0 && h(3) < 0.4) {
          // Water: kleine rimpels, alleen een stukje van de kust af
          veldOp(x, y, monster);
          if (monster.land < 0.36) {
            const lang = 3 + h(4) * 6;
            c.strokeStyle = h(5) < 0.7 ? 'rgba(255,255,255,0.26)' : 'rgba(10,30,60,0.22)';
            c.lineWidth = 0.9;
            c.beginPath();
            c.moveTo(x, y);
            c.quadraticCurveTo(x + lang / 2, y - 1.5, x + lang, y);
            c.stroke();
          }
        }
      }
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    return { doek, x0, y0, b: bw / S, h: bh / S };
  }

  const sleutelVan = (cx, cy) => cy * 4096 + (cx + 2048);

  // Het scherpe stuk, als het er al is.
  function scherp(cx, cy) {
    const s = stukken.get(sleutelVan(cx, cy));
    if (s) s.gebruikt = ++teller;
    return s;
  }

  // Het scherpe stuk nu maken.
  function maakScherp(cx, cy) {
    const s = maakStuk(cx, cy, S);
    s.gebruikt = ++teller;
    stukken.set(sleutelVan(cx, cy), s);
    if (stukken.size > MAX_STUKKEN) {
      // Gooi het stuk weg dat het langst niet gebruikt is
      let oudste = null;
      let oudsteTeller = Infinity;
      for (const [sl, st] of stukken) {
        if (st.gebruikt < oudsteTeller) { oudsteTeller = st.gebruikt; oudste = sl; }
      }
      stukken.delete(oudste);
    }
    return s;
  }

  // Het voorlopige stuk: snel, en altijd meteen beschikbaar.
  function voorlopig(cx, cy) {
    const sl = sleutelVan(cx, cy);
    let s = grof.get(sl);
    if (!s) {
      s = maakStuk(cx, cy, S_GROF);
      grof.set(sl, s);
    }
    return s;
  }

  // Ligt dit stuk (deels) boven de kaart? Zo niet, dan hoeft het niet.
  function opKaart(cx, cy) {
    const hoeken = [[cx * CB, cy * CH], [(cx + 1) * CB, cy * CH], [cx * CB, (cy + 1) * CH], [(cx + 1) * CB, (cy + 1) * CH]];
    let allesLinks = true, allesRechts = true, allesBoven = true, allesOnder = true;
    for (const [wx, wy] of hoeken) {
      const gx = (wx / HB + wy / HH) * 0.5;
      const gy = (wy / HH - wx / HB) * 0.5;
      if (gx >= 0) allesLinks = false;
      if (gx < kaart.breedte) allesRechts = false;
      if (gy >= 0) allesBoven = false;
      if (gy < kaart.hoogte) allesOnder = false;
    }
    return !(allesLinks || allesRechts || allesBoven || allesOnder);
  }

  // Tekent alle stukken die in beeld zijn. Ontbreekt het scherpe stuk nog,
  // dan staat er eerst een vlugge voorlopige versie. Elk beeld verscherpen
  // we binnen een vaste tijd een paar stukken, zodat het spel nooit hapert.
  function teken(ctx, links, boven, rechts, onder) {
    const c0 = Math.floor(links / CB);
    const c1 = Math.floor(rechts / CB);
    const r0 = Math.floor(boven / CH);
    const r1 = Math.floor(onder / CH);
    const middenX = (c0 + c1) / 2;
    const middenY = (r0 + r1) / 2;
    const nodig = [];
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        if (!opKaart(cx, cy)) continue;
        let s = scherp(cx, cy);
        if (!s) {
          s = voorlopig(cx, cy);
          nodig.push([cx, cy, (cx - middenX) * (cx - middenX) + (cy - middenY) * (cy - middenY) * 4]);
        }
        ctx.drawImage(s.doek, s.x0, s.y0, s.b, s.h);
      }
    }
    if (nodig.length) {
      nodig.sort((a, b) => a[2] - b[2]);
      const start = performance.now();
      for (const [cx, cy] of nodig) {
        maakScherp(cx, cy);
        if (performance.now() - start > BUDGET_MS) break;
      }
    } else {
      voorbereiden(Math.floor(middenX), Math.floor(middenY));
    }
  }

  // In rustige momenten: de stukken rond het beeld alvast maken, één per keer.
  function voorbereiden(midX, midY) {
    if (stukken.size >= MAX_STUKKEN - 8 || timer) return;
    let beste = null;
    let afstand = Infinity;
    for (let cy = midY - 4; cy <= midY + 4; cy++) {
      for (let cx = midX - 5; cx <= midX + 5; cx++) {
        if (cy < 0 || stukken.has(sleutelVan(cx, cy)) || !opKaart(cx, cy)) continue;
        const d = (cx - midX) * (cx - midX) + (cy - midY) * (cy - midY) * 4;
        if (d < afstand) { afstand = d; beste = [cx, cy]; }
      }
    }
    if (!beste) return;
    timer = setTimeout(() => {
      timer = 0;
      if (!stukken.has(sleutelVan(beste[0], beste[1]))) maakScherp(beste[0], beste[1]);
    }, 40);
  }

  return { teken, herbouw, aantalStukken: () => stukken.size, soortOp };
}
