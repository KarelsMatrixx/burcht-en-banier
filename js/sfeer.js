// Sfeer: alles wat de wereld laat leven zonder dat het spel er iets van merkt.
// Lange schaduwen in de vorm van het echte plaatje, wind in bomen en graan,
// rook uit schoorstenen, glinsterend water en vogels.
// Puur beeld: niets hiervan verandert de spelregels.

import { geluid } from './geluid.js';
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

export function maakSfeer(kaart, landschap, profiel = null) {
  const vogelSoort = (profiel && profiel.vogels) || 'vogels';
  const deeltjes = (profiel && profiel.deeltjes) || 'geen';
  const waas = (profiel && profiel.waas) || null;
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
  // zwaar: dikke donkere mijnrook (IJzerbroek): meer wolken, groter, langer zichtbaar en grijsbruin.
  function tekenRook(ctx, x, y, t, zaad, zwaar) {
    const n = zwaar ? 8 : 5;
    for (let k = 0; k < n; k++) {
      const leeftijd = (t / (zwaar ? 4.2 : 3.2) + k / n + zaad) % 1;
      const px = x - leeftijd * leeftijd * (zwaar ? 24 : 16) + Math.sin(t * 1.5 + k + zaad * 9) * 1.2;
      const py = y - leeftijd * (zwaar ? 38 : 26);
      const straal = (zwaar ? 2.2 : 1.4) + leeftijd * (zwaar ? 7 : 4.2);
      const a = (zwaar ? 0.85 : 0.5) * (1 - leeftijd) * Math.min(1, leeftijd * 6);
      ctx.fillStyle = zwaar ? `rgba(44, 42, 48, ${a})` : `rgba(232, 228, 220, ${a})`;
      ctx.beginPath();
      ctx.arc(px, py, straal, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // --- Steenhouwer ----------------------------------------------------------
  // De arm en hamer van een steenhouwer die op een blok slaat. (x, y) is het midden van de tegel.
  // Bij elke klap springt een paar stofjes weg.
  function tekenHamer(ctx, x, y, t, zaad) {
    const fase = (t * 1.6 + zaad * 7) % 1;                 // 0 tot 1, een klap per ronde
    const slag = fase < 0.55 ? Math.sin((fase / 0.55) * Math.PI * 0.5) : 1 - (fase - 0.55) / 0.45;   // omhoog, dan snel terug
    const hoek = -1.9 + (1 - slag) * 1.7;                  // omhoog gezwaaid naar de klap
    const sx = x - 1.6;
    const sy = y - 11;                                     // schouder
    const hx = sx + 4 * Math.cos(hoek + 0.6);
    const hy = sy + 4 * Math.sin(hoek + 0.6) + 2;          // hand
    ctx.strokeStyle = '#8a7a62';
    ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    const kx = hx + 5.5 * Math.cos(hoek);
    const ky = hy + 5.5 * Math.sin(hoek);
    ctx.strokeStyle = '#5a3d22';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.save();
    ctx.translate(kx, ky);
    ctx.rotate(hoek);
    ctx.fillStyle = '#3a3a42';
    ctx.fillRect(-1.2, -2.2, 2.8, 4.4);
    ctx.restore();
    if (fase > 0.55 && fase < 0.8) {
      const a = 0.6 * (1 - (fase - 0.55) / 0.25);
      ctx.fillStyle = `rgba(200, 200, 205, ${a})`;
      for (let i = 0; i < 3; i++) {
        const u = (fase - 0.55) * 4;
        ctx.fillRect(x + 4 + i * 2 + u * 3, y - 6 - i - u * 4, 1.2, 1.2);
      }
    }
  }

  // --- Windvaan -------------------------------------------------------------
  // Een lichte wimpel op een dunne paal, die altijd met de wind mee wappert.
  // (x, y) is de voet van de paal, bovenop een toren.
  function tekenWimpel(ctx, x, y, t, zaad) {
    const w = wind(x, y, t + zaad);
    const top = y - 15;
    ctx.strokeStyle = '#4a4036';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x - 11 + w * 3, top + 1.5 + w * 1.2);
    ctx.lineTo(x - 17 + w * 5, top + 4 + w * 2);
    ctx.lineTo(x - 11 + w * 3, top + 6.5 + w * 1.2);
    ctx.lineTo(x, top + 6);
    ctx.closePath();
    ctx.fillStyle = '#e9efe4';
    ctx.fill();
    ctx.strokeStyle = 'rgba(60, 80, 55, 0.55)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
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
    if (sterkte <= 0 || vogelSoort === 'geen') return;
    const meeuw = vogelSoort === 'meeuwen';
    const raaf = vogelSoort === 'raven';
    const kleur = meeuw ? '246, 246, 240' : raaf ? '14, 12, 14' : '36, 30, 26';
    const rondje = wereldB + wereldH + 600;
    for (const v of VLUCHTEN) {
      const afstand = (t * v.snel * (raaf ? 0.7 : 1) + v.zaad * rondje) % rondje - 300;
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
        const klap = Math.sin(t * (raaf ? 5 : meeuw ? 6 : 9) + k * 1.7) * (raaf ? 3 : 2.2);
        // Schaduw op de grond
        ctx.strokeStyle = `rgba(20, 16, 10, ${0.22 * sterkte})`;
        ctx.lineWidth = 1.4;
        vleugels(ctx, bx - ZON_X * h, by - ZON_Y * h, klap * 0.5);
        // De vogel zelf
        ctx.strokeStyle = `rgba(${kleur}, ${0.9 * sterkte})`;
        ctx.lineWidth = raaf ? 1.9 : meeuw ? 1.5 : 1.2;
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

  // --- Weer en waas per landschap (versie 0.71.0) ---------------------------
  // In schermmaat, over de wereld heen: stof, wind, as, mist, pluis, sneeuw of
  // storm. Vaste aantallen, posities volgen uit de tijd, dus geen geheugen.
  let mistVlek = null;
  function maakMistVlek() {
    // Een onregelmatige mistbank uit veel zachte bollen, zonder harde randen:
    // elke bol loopt geleidelijk uit naar volledig doorzichtig.
    const d = document.createElement('canvas');
    d.width = 384;
    d.height = 192;
    const c = d.getContext('2d');
    for (let i = 0; i < 18; i++) {
      const z = hash(i * 9.1 + 4);
      const x = 70 + hash(i * 2.7 + 1) * 244;
      const y = 70 + hash(i * 4.3 + 7) * 52 - Math.abs(x - 192) * 0.08;
      const r = 34 + z * 30;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(232,238,234,0.30)');
      g.addColorStop(0.5, 'rgba(232,238,234,0.14)');
      g.addColorStop(1, 'rgba(232,238,234,0)');
      c.fillStyle = g;
      c.save();
      c.translate(x, y);
      c.scale(1.6, 0.8);
      c.translate(-x, -y);
      c.fillRect(x - r, y - r, r * 2, r * 2);
      c.restore();
    }
    return d;
  }

  // Het weer hangt in de wereld, niet op het scherm: als je de camera beweegt,
  // blijft de mist liggen waar hij ligt. De deeltjes staan in tegels van
  // TW bij TH wereldpixels die zich herhalen over de hele kaart.
  // l, b, r, o: wat er van de wereld in beeld is (wereldmaat, transformatie gezet).
  const TW = 1100;
  const TH = 640;
  function tekenWeer(ctx, l, b, r, o, t) {
    if (deeltjes === 'geen') return;
    const rond = (v, m) => ((v % m) + m) % m;
    const marge = deeltjes === 'mist' ? 420 : 40;
    const tx0 = Math.floor((l - marge) / TW);
    const tx1 = Math.floor((r + marge) / TW);
    const ty0 = Math.floor((b - marge) / TH);
    const ty1 = Math.floor((o + marge) / TH);
    if (deeltjes === 'mist') mistVlek = mistVlek || maakMistVlek();
    if (deeltjes === 'wind' || deeltjes === 'storm') ctx.beginPath();
    else if (deeltjes !== 'mist' && deeltjes !== 'stof') ctx.beginPath();
    const blaadjes = [];
    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const ox = tx * TW;
        const oy = ty * TH;
        if (deeltjes === 'mist') {
          // Grote zachte mistbanken die heel langzaam drijven en ademen.
          for (let i = 0; i < 4; i++) {
            const z = hash(i * 3.7 + 1);
            const w = 520 + z * 360;
            const x = ox + rond(z * TW + t * (3 + z * 3), TW);
            const y = oy + hash(i * 5.1 + 2) * TH + Math.sin(t * 0.1 + i) * 8;
            if (x + w / 2 < l || x - w / 2 > r || y + w / 4 < b || y - w / 4 > o) continue;
            ctx.globalAlpha = 0.5 + 0.22 * Math.sin(t * 0.15 + i * 2);
            ctx.drawImage(mistVlek, x - w / 2, y - w / 4, w, w / 2);
          }
          continue;
        }
        if (deeltjes === 'stof') {
          ctx.fillStyle = 'rgba(224, 196, 140, 0.32)';
          ctx.beginPath();
          for (let i = 0; i < 46; i++) {
            const z = hash(i * 7.3 + 4);
            const x = ox + rond(z * TW + t * (24 + z * 30), TW);
            const y = oy + rond(hash(i * 2.9) * TH + Math.sin(t * 0.9 + i) * 10, TH);
            const rr = 0.6 + z * 0.8;
            ctx.moveTo(x + rr, y);
            ctx.ellipse(x, y, rr, rr * 0.7, 0, 0, Math.PI * 2);
          }
          ctx.fill();
          continue;
        }
        if (deeltjes === 'wind' || deeltjes === 'storm') {
          const storm = deeltjes === 'storm';
          const n = storm ? 130 : 22;
          for (let i = 0; i < n; i++) {
            const z = hash(i * 4.1 + 9);
            if (storm) {
              const y = oy + rond(z * TH + t * (420 + z * 140), TH);
              const x = ox + rond(hash(i * 1.7) * TW - (y - oy) * 0.25, TW);
              ctx.moveTo(x, y);
              ctx.lineTo(x - 3.5, y + 12);
            } else {
              const x = ox + rond(z * TW + t * (220 + z * 120), TW);
              const y = oy + hash(i * 6.3) * TH + Math.sin(t * 2 + i) * 4;
              const golf = Math.sin(t * 1.5 + i) * 3;
              ctx.moveTo(x, y);
              ctx.bezierCurveTo(x + 10, y - 3 + golf, x + 22, y + 3 - golf, x + 30 + z * 18, y + golf * 0.5);
              if (i < 7) blaadjes.push(ox + rond(z * 777 + t * (130 + z * 50), TW), oy + hash(i * 3.3) * TH + Math.sin(t * 3 + i) * 10, i);
            }
          }
          continue;
        }
        // Vallende of zwevende deeltjes: as, pluis, sneeuw
        const sneeuw = deeltjes === 'sneeuw';
        const pluis = deeltjes === 'pluis';
        const n = sneeuw ? 120 : pluis ? 22 : 60;
        for (let i = 0; i < n; i++) {
          const z = hash(i * 5.7 + 2);
          const val = sneeuw ? 30 + z * 26 : pluis ? 5 + z * 5 : 10 + z * 9;
          const y = oy + rond(z * TH + t * val * (pluis ? (i % 2 ? 1 : -1) : 1), TH);
          const x = ox + rond(hash(i * 2.3) * TW + t * (sneeuw ? 12 : 7) + Math.sin(t * (0.6 + z) + i) * (pluis ? 16 : 9), TW);
          const rr = sneeuw ? 0.8 + z * 1.3 : pluis ? 1.1 : 0.7 + z * 0.8;
          ctx.moveTo(x + rr, y);
          ctx.arc(x, y, rr, 0, Math.PI * 2);
        }
      }
    }
    ctx.globalAlpha = 1;
    if (deeltjes === 'wind' || deeltjes === 'storm') {
      ctx.lineCap = 'round';
      ctx.lineWidth = deeltjes === 'storm' ? 0.7 : 0.8;
      ctx.strokeStyle = deeltjes === 'storm' ? 'rgba(190, 200, 220, 0.2)' : 'rgba(255, 255, 255, 0.16)';
      ctx.stroke();
      ctx.fillStyle = 'rgba(150, 140, 70, 0.8)';
      for (let i = 0; i < blaadjes.length; i += 3) {
        ctx.save();
        ctx.translate(blaadjes[i], blaadjes[i + 1]);
        ctx.rotate(t * 4 + blaadjes[i + 2]);
        ctx.fillRect(-2, -1, 4, 2);
        ctx.restore();
      }
    } else if (deeltjes !== 'mist' && deeltjes !== 'stof') {
      ctx.fillStyle = deeltjes === 'sneeuw' ? 'rgba(255, 255, 255, 0.85)' : deeltjes === 'pluis' ? 'rgba(255, 255, 248, 0.75)' : 'rgba(70, 66, 64, 0.55)';
      ctx.fill();
    }
  }

  let laatsteFlits = -1;   // welke flits al donder kreeg
  // Over het hele scherm (schermmaat): de kleurwaas, een stofvlaag en de bliksem.
  function tekenWaas(ctx, b, h, t) {
    if (waas) {
      ctx.fillStyle = `rgba(${waas[0]}, ${waas[1]}, ${waas[2]}, ${waas[3]})`;
      ctx.fillRect(0, 0, b, h);
    }
    if (deeltjes === 'stof') {
      const vlaag = Math.max(0, Math.sin(t * 0.13));
      if (vlaag > 0.6) {
        const g = ctx.createLinearGradient(0, h * 0.4, 0, h);
        g.addColorStop(0, 'rgba(214, 180, 120, 0)');
        g.addColorStop(1, `rgba(214, 180, 120, ${(vlaag - 0.6) * 0.25})`);
        ctx.fillStyle = g;
        ctx.fillRect(0, h * 0.4, b, h * 0.6);
      }
    }
    if (deeltjes === 'storm') {
      // Bliksem: ongeveer elke 17 seconden een korte, zachte flits
      const fase = ((t % 17) + 17) % 17;
      // Donder bij elke flits, iets later (het geluid komt na het licht).
      const flits = Math.floor(t / 17);
      if (fase < 0.25 && flits !== laatsteFlits) {
        laatsteFlits = flits;
        geluid.speel('thunder', { wacht: 700 + Math.random() * 900 });
      }
      if (fase < 0.25) {
        ctx.fillStyle = `rgba(220, 225, 255, ${0.16 * (1 - fase / 0.25)})`;
        ctx.fillRect(0, 0, b, h);
      }
    }
  }

  return { herbouw, wind, tekenGlinster, tekenRook, tekenVogels, tekenWimpel, tekenHamer, tekenWeer, tekenWaas };
}
