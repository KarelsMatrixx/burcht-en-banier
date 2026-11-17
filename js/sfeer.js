// Sfeer: alles wat de wereld laat leven zonder dat het spel er iets van merkt.
// Lange schaduwen in de vorm van het echte plaatje, wind in bomen en graan,
// rook uit schoorstenen, glinsterend water, wolkenschaduwen en vogels.
// Puur beeld: niets hiervan verandert de spelregels.

import { HALVE_BREEDTE, HALVE_HOOGTE } from './iso.js';
import { GROND } from './kaart.js';

// De zon staat laag rechts (gouden uur). Per pixel hoogte schuift een
// schaduw ZON_X naar links en ZON_Y omlaag over de grond: zo valt de schaduw
// naar de kijker toe en verdwijnt hij niet achter het gebouw zelf.
export const ZON_X = 0.95;
export const ZON_Y = -0.16;

// Een zwart silhouet van een plaatje, op gewone grootte (de schaduw is toch
// zacht, zo kost het weinig geheugen). Eén keer gemaakt, daarna hergebruikt.
const silhouetten = new WeakMap();
export function silhouet(beeld, b, h) {
  let s = silhouetten.get(beeld);
  if (!s) {
    s = document.createElement('canvas');
    s.width = Math.max(1, Math.ceil(b));
    s.height = Math.max(1, Math.ceil(h));
    const c = s.getContext('2d');
    c.drawImage(beeld, 0, 0, s.width, s.height);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#000';
    c.fillRect(0, 0, s.width, s.height);
    silhouetten.set(beeld, s);
  }
  return s;
}

// Tekent de schaduw van een plaatje (b bij h wereldpixels), waarvan de linkerbovenhoek op (links, boven)
// staat en de voet op hoogte voetY. Alles boven de voet wordt schuin over de
// grond gelegd. De basis (a..f) is de transformatie die al op ctx stond.
export function tekenSchaduw(ctx, basis, beeld, b, h, links, boven, voetY) {
  const a = basis[0], bb = basis[1], c = basis[2], d = basis[3], e = basis[4], f = basis[5];
  // Eerst de schaduwschuiving (in wereldmaat), daarna de basis.
  const sc = ZON_X;
  const sd = ZON_Y;
  const se = -sc * voetY;
  const sf = voetY - sd * voetY;
  ctx.setTransform(a, bb, a * sc + c * sd, bb * sc + d * sd, a * se + c * sf + e, bb * se + d * sf + f);
  ctx.drawImage(silhouet(beeld, b, h), links, boven, b, h);
  ctx.setTransform(a, bb, c, d, e, f);
}

// Kleine vaste toevalsgetallen per plek (0 tot 1).
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function maakSfeer(kaart, landschap) {
  // --- Wind -----------------------------------------------------------------
  // Een golf die over de kaart rolt, met af en toe een vlaag.
  function wind(wx, wy, t) {
    const vlaag = 0.55 + 0.45 * Math.sin(t * 0.23 + wx * 0.0015);
    return (Math.sin(t * 1.9 - wx * 0.018 - wy * 0.03) * 0.75 + Math.sin(t * 3.1 + wx * 0.05) * 0.25) * vlaag;
  }

  // --- Glinsteringen op het water ------------------------------------------
  let glinster = new Float32Array(0);   // x, y, zaad per punt
  function herbouw() {
    const punten = [];
    for (let y = 0; y < kaart.hoogte; y++) {
      for (let x = 0; x < kaart.breedte; x++) {
        if (kaart.grond[y * kaart.breedte + x] !== GROND.WATER) continue;
        for (let k = 0; k < 2; k++) {
          const z = hash(x * 92.7 + y * 13.1 + k * 7.3);
          const rx = x + hash(z * 31 + 1);
          const ry = y + hash(z * 57 + 2);
          const wx = (rx - ry) * HALVE_BREEDTE;
          const wy = (rx + ry) * HALVE_HOOGTE;
          if (landschap.soortOp(wx, wy) !== 0) continue;
          punten.push(wx, wy, z);
        }
      }
    }
    glinster = Float32Array.from(punten);
  }

  // In vier helderheden gebundeld: vier keer vullen per beeld in plaats van
  // één keer per glinstering.
  const BAKJES = 4;
  const paden = [];
  function tekenGlinster(ctx, l, b, r, o, t) {
    for (let k = 0; k < BAKJES; k++) paden[k] = null;
    for (let i = 0; i < glinster.length; i += 3) {
      const x = glinster[i];
      const y = glinster[i + 1];
      if (x < l || x > r || y < b || y > o) continue;
      const z = glinster[i + 2];
      const v = Math.sin(t * (1.3 + z * 1.6) + z * 40);
      if (v < 0.55) continue;
      const sterk = (v - 0.55) / 0.45;
      const k = Math.min(BAKJES - 1, Math.floor(sterk * BAKJES));
      const pad = paden[k] || (paden[k] = new Path2D());
      const lang = 3 + z * 4;
      pad.rect(x - lang / 2 + Math.sin(t * 0.7 + z * 9) * 2, y, lang, 0.9);
      if (k === BAKJES - 1) pad.rect(x - 0.45, y - 1.2, 0.9, 3.3);   // even een sterretje
    }
    ctx.fillStyle = '#fffbe6';
    for (let k = 0; k < BAKJES; k++) {
      if (!paden[k]) continue;
      ctx.globalAlpha = 0.75 * (k + 0.5) / BAKJES;
      ctx.fill(paden[k]);
    }
    ctx.globalAlpha = 1;
  }

  // --- Rook uit een schoorsteen --------------------------------------------
  // (x, y) is de bovenkant van de schoorsteen. Vijf wolkjes die opstijgen,
  // groeien en met de wind mee naar links drijven.
  function tekenRook(ctx, x, y, t, zaad) {
    for (let k = 0; k < 5; k++) {
      const leeftijd = (t / 3.2 + k / 5 + zaad) % 1;
      const px = x - leeftijd * leeftijd * 16 + Math.sin(t * 1.5 + k + zaad * 9) * 1.2;
      const py = y - leeftijd * 26;
      const straal = 1.4 + leeftijd * 4.2;
      const a = 0.5 * (1 - leeftijd) * Math.min(1, leeftijd * 6);
      ctx.fillStyle = `rgba(232, 228, 220, ${a})`;
      ctx.beginPath();
      ctx.arc(px, py, straal, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Wolkenschaduwen ------------------------------------------------------
  // Eén zacht, naadloos doek met donkere vlekken (wereldmaat 1024, op een
  // kwart getekend). Het schuift langzaam over de wereld.
  const WOLK = 1800;
  const WS = 0.08;
  const wolkDoek = document.createElement('canvas');
  wolkDoek.width = WOLK * WS;
  wolkDoek.height = WOLK * WS;
  {
    const c = wolkDoek.getContext('2d');
    const n = WOLK * WS;
    for (let k = 0; k < 5; k++) {
      const cx = hash(k * 3.1) * n;
      const cy = hash(k * 5.7 + 1) * n;
      for (let j = 0; j < 6; j++) {
        const px = cx + (hash(k * 11 + j) - 0.5) * n * 0.3;
        const py = cy + (hash(k * 13 + j + 3) - 0.5) * n * 0.15;
        const rr = n * (0.1 + hash(k * 17 + j) * 0.09);
        // Naadloos: elke vlek ook aan de overkant van de randen.
        for (const ox of [-n, 0, n]) {
          for (const oy of [-n, 0, n]) {
            const g = c.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rr);
            g.addColorStop(0, 'rgba(20, 24, 48, 0.3)');
            g.addColorStop(1, 'rgba(20, 24, 48, 0)');
            c.fillStyle = g;
            c.fillRect(px + ox - rr, py + oy - rr, rr * 2, rr * 2);
          }
        }
      }
    }
  }

  function tekenWolken(ctx, l, b, r, o, t, sterkte) {
    if (sterkte <= 0) return;
    const ox = (-t * 9) % WOLK;     // de wind blaast naar links
    const oy = (-t * 3) % WOLK;
    const x0 = Math.floor((l - ox) / WOLK) * WOLK + ox;
    const y0 = Math.floor((b - oy) / WOLK) * WOLK + oy;
    ctx.globalAlpha = 0.55 * sterkte;
    for (let x = x0; x < r; x += WOLK) {
      for (let y = y0; y < o; y += WOLK) ctx.drawImage(wolkDoek, x, y, WOLK, WOLK);
    }
    ctx.globalAlpha = 1;
  }

  // --- Vogels ---------------------------------------------------------------
  // Twee vluchten die in een lange lus over de kaart trekken, met hun
  // schaduw op de grond.
  const wereldB = (kaart.breedte + kaart.hoogte) * HALVE_BREEDTE;
  const wereldH = (kaart.breedte + kaart.hoogte) * HALVE_HOOGTE;
  const wereldL = -kaart.hoogte * HALVE_BREEDTE;
  const VLUCHTEN = [
    { snel: 26, hoek: 3.4, zaad: 0.13, aantal: 5, hoog: 95 },
    { snel: 19, hoek: 2.6, zaad: 0.61, aantal: 3, hoog: 70 },
  ];
  function tekenVogels(ctx, l, b, r, o, t, sterkte) {
    if (sterkte <= 0) return;
    const rondje = wereldB + wereldH + 600;
    for (const v of VLUCHTEN) {
      const afstand = (t * v.snel + v.zaad * rondje) % rondje - 300;
      const gx = wereldL + wereldB * v.zaad + Math.cos(v.hoek) * afstand;
      const gy = wereldH * 0.5 + Math.sin(v.hoek) * afstand * 0.5;
      for (let k = 0; k < v.aantal; k++) {
        // V-vorm: achter de leider, om en om links en rechts.
        const rij = Math.ceil(k / 2);
        const kant = k % 2 ? 1 : -1;
        const bx = gx - Math.cos(v.hoek) * rij * 9 + kant * rij * 7 * Math.sin(v.hoek);
        const by = gy - Math.sin(v.hoek) * rij * 4.5 - kant * rij * 3.5 * Math.cos(v.hoek);
        const h = v.hoog + Math.sin(t * 0.8 + k) * 4;
        const vx = bx;
        const vy = by - h;
        if (vx < l - 40 || vx > r + 40 || vy < b - 40 || by > o + 40) continue;
        const klap = Math.sin(t * 9 + k * 1.7) * 2.2;
        // Schaduw op de grond
        ctx.strokeStyle = `rgba(20, 16, 10, ${0.22 * sterkte})`;
        ctx.lineWidth = 1.4;
        vleugels(ctx, bx - ZON_X * h, by - ZON_Y * h, klap * 0.5);
        // De vogel zelf
        ctx.strokeStyle = `rgba(36, 30, 26, ${0.85 * sterkte})`;
        ctx.lineWidth = 1.2;
        vleugels(ctx, vx, vy, klap);
      }
    }
  }
  function vleugels(ctx, x, y, klap) {
    ctx.beginPath();
    ctx.moveTo(x - 4, y - klap);
    ctx.quadraticCurveTo(x - 1.8, y - 1.5 - klap * 0.3, x, y);
    ctx.quadraticCurveTo(x + 1.8, y - 1.5 - klap * 0.3, x + 4, y - klap);
    ctx.stroke();
  }

  return { herbouw, wind, tekenGlinster, tekenRook, tekenWolken, tekenVogels };
}
