// MACHINES: ram, katapult en belegeringstoren, opnieuw ontworpen in dezelfde stijl als heren en
// soldaten (zachte schaduw, donkere omlijning, licht van rechts, teamkleur in huiden, vlag en
// schild). De belegeringstoren is veel hoger dan voorheen: ruim twee keer een muur.
// Zelfde beeldcontract als in kunst.js:
//   ram:              lopen 4, houdingen.sla 2 (balk achter, balk vooruit)
//   katapult:         lopen 4, houdingen.schiet 2 (arm gespannen, arm los)
//   belegeringstoren: lopen 4, houdingen.sla 2 (valbrug dicht, valbrug neer tegen de muur)
// Het ankerpunt ax is het midden van het doek, zodat spiegelen klopt.

import { blok, lijn, vlak, ovaal, tint, lichtBlok } from './heren.js';

const SCHERPTE = 3;
const OMLIJN = '#1b130d';
const HOUT = '#7a5532';
const HOUT_D = '#4e351e';
const HOUT_L = '#9a7448';
const IJZER = '#6d7078';
const IJZER_D = '#3a3b42';

// Bouwt een plaatje: schaduw, omlijning, figuur. teken(ctx) tekent in logische pixels vanaf de
// linkerbovenhoek; schaduw(ctx) tekent de grondschaduw (zonder omlijning).
function maak(b, h, teken, schaduw, spiegel) {
  const w = Math.ceil(b * SCHERPTE), hh = Math.ceil(h * SCHERPTE);
  const nieuw = () => {
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    const x = c.getContext('2d'); x.scale(SCHERPTE, SCHERPTE); return [c, x];
  };
  const [fig, fx] = nieuw(); teken(fx);
  const sil = document.createElement('canvas'); sil.width = w; sil.height = hh;
  const sx = sil.getContext('2d');
  sx.drawImage(fig, 0, 0); sx.globalCompositeOperation = 'source-in'; sx.fillStyle = OMLIJN; sx.fillRect(0, 0, w, hh);
  const uit = document.createElement('canvas'); uit.width = w; uit.height = hh;
  const u = uit.getContext('2d');
  if (spiegel) { u.translate(w, 0); u.scale(-1, 1); }
  u.save(); u.scale(SCHERPTE, SCHERPTE); schaduw(u); u.restore();
  const r = 1.4;
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; u.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r); }
  u.drawImage(fig, 0, 0);
  return uit;
}

// lijst = [[houding, beeld], ...]; extra = { naam: [[houding, beeld], ...] }
function pakket(b, h, ay, teken, schaduw, extra) {
  const set = (lijst) => ({
    rechts: lijst.map(([hd, bd]) => maak(b, h, (c) => teken(c, hd, bd), schaduw, false)),
    links: lijst.map(([hd, bd]) => maak(b, h, (c) => teken(c, hd, bd), schaduw, true)),
    b, h, ax: b / 2, ay,
  });
  const uit = set([['lopen', 0], ['lopen', 1], ['lopen', 2], ['lopen', 3]]);
  uit.houdingen = {};
  for (const [naam, lijst] of Object.entries(extra)) uit.houdingen[naam] = set(lijst);
  return uit;
}

function grondSchaduw(cx, cy, rx) {
  return (ctx) => {
    const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, rx);
    g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(0.7, 'rgba(0,0,0,0.26)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  };
}

// Houtnerf op een vlak
function nerf(ctx, x, y, b, h, n = 3, alfa = 0.16) {
  for (let i = 1; i <= n; i++) blok(ctx, x, y + (h * i) / (n + 1), b, 0.45, `rgba(0,0,0,${alfa})`);
}

// Wiel met ijzeren rand, houten schijf, spaken en naaf. hoek draait mee met het lopen.
function wiel(ctx, x, y, r, hoek) {
  ovaal(ctx, x, y, r + 0.9, r + 0.9, IJZER_D);
  ovaal(ctx, x, y, r, r, HOUT);
  ovaal(ctx, x - r * 0.25, y - r * 0.25, r * 0.8, r * 0.8, 'rgba(255,255,255,0.06)');
  for (let i = 0; i < 4; i++) {
    const a = hoek + (i * Math.PI) / 4;
    lijn(ctx, x - Math.cos(a) * (r - 0.4), y - Math.sin(a) * (r - 0.4), x + Math.cos(a) * (r - 0.4), y + Math.sin(a) * (r - 0.4), HOUT_D, 1.2);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.arc(x, y, r + 0.3, -0.9, 0.5); ctx.stroke();
  ovaal(ctx, x, y, r * 0.3, r * 0.3, IJZER_D);
  ovaal(ctx, x + 0.3, y - 0.3, r * 0.14, r * 0.14, '#9a9ea8');
}

// Vlag in teamkleur aan een paal
function vlag(ctx, x, y, hoogte, K, golf = 0) {
  lijn(ctx, x, y, x, y - hoogte, HOUT_D, 1.1);
  ovaal(ctx, x, y - hoogte - 0.4, 0.8, 0.8, '#d8b24a');
  vlak(ctx, [[x, y - hoogte + 0.6], [x + 7, y - hoogte + 2.2 + golf], [x + 5.6, y - hoogte + 3.6 + golf * 0.5], [x + 7, y - hoogte + 5 + golf], [x, y - hoogte + 5.6]], K);
  vlak(ctx, [[x, y - hoogte + 0.6], [x + 7, y - hoogte + 2.2 + golf], [x, y - hoogte + 2.6]], 'rgba(255,255,255,0.18)');
  vlak(ctx, [[x, y - hoogte + 3.8], [x + 5.6, y - hoogte + 3.6 + golf * 0.5], [x + 7, y - hoogte + 5 + golf], [x, y - hoogte + 5.6]], 'rgba(0,0,0,0.2)');
}

// Rond schild in teamkleur
function schild(ctx, x, y, r, K) {
  ovaal(ctx, x, y, r + 0.5, r + 0.5, '#d8b24a');
  ovaal(ctx, x, y, r, r, K);
  ovaal(ctx, x - r * 0.3, y, r * 0.55, r * 0.9, 'rgba(0,0,0,0.2)');
  ovaal(ctx, x + r * 0.35, y - r * 0.25, r * 0.4, r * 0.4, 'rgba(255,255,255,0.18)');
  ovaal(ctx, x, y, r * 0.28, r * 0.28, '#efe6c8');
}

// ------------------------------------------------------------------ RAM
// Een dekwagen met een zwaar houten dak van huiden, een balk aan kettingen met ijzeren kop.
function ram(def) {
  const K = def.kleur;
  const B = 72, H = 58, AY = 52;
  const teken = (ctx, houding, beeld) => {
    const stoot = houding === 'lopen' ? -1 : houding === 'hoog' ? 0 : 1;
    const balk = stoot === 1 ? 5 : stoot === 0 ? -3 : 0;
    const wip = stoot < 0 && beeld % 2 ? -0.5 : 0;
    ctx.save(); ctx.translate(4, 6 + wip);
    // onderstel
    lichtBlok(ctx, 4, 34, 52, 4.6, HOUT_D, 0.2);
    blok(ctx, 4, 34, 52, 1, 'rgba(255,255,255,0.14)');
    for (const x of [9, 29, 47]) blok(ctx, x, 38.6, 3.4, 2, IJZER_D);
    // staanders
    for (const x of [8, 20, 38, 50]) { lichtBlok(ctx, x, 14, 2.8, 21, HOUT, 0.22); nerf(ctx, x, 14, 2.8, 21, 2, 0.2); }
    blok(ctx, 8, 24.4, 44.6, 1.8, HOUT_D);
    // de balk, hangend aan kettingen, met ijzeren banden en kop
    for (const x of [22, 40]) {
      for (let k = 0; k < 5; k++) ovaal(ctx, x + k * 0.04 * balk, 12 + k * 3.1, 0.8, 1.4, k % 2 ? '#8e929c' : IJZER_D);
    }
    const bx = 7 + balk;
    lichtBlok(ctx, bx, 24.6, 44, 6.4, HOUT_L, 0.24);
    nerf(ctx, bx, 24.6, 44, 6.4, 2, 0.2);
    for (const x of [bx + 5, bx + 21, bx + 36]) { blok(ctx, x, 24.2, 2.2, 7.2, IJZER_D); blok(ctx, x + 0.2, 24.2, 0.7, 7.2, 'rgba(255,255,255,0.3)'); }
    // ijzeren kop met punt
    vlak(ctx, [[bx + 44, 23.6], [bx + 50, 25.2], [bx + 53.4, 27.8], [bx + 50, 30.6], [bx + 44, 32.2]], IJZER);
    vlak(ctx, [[bx + 44, 23.6], [bx + 50, 25.2], [bx + 53.4, 27.8], [bx + 47, 27]], 'rgba(255,255,255,0.3)');
    vlak(ctx, [[bx + 47, 29.4], [bx + 53.4, 27.8], [bx + 50, 30.6], [bx + 44, 32.2]], 'rgba(0,0,0,0.3)');
    lijn(ctx, bx + 45.6, 24.4, bx + 45.6, 31.6, IJZER_D, 0.8);
    // dak van huiden in teamkleur
    const dak = [[1, 17], [30, 3], [59, 17], [55, 20.4], [5, 20.4]];
    vlak(ctx, dak, K);
    vlak(ctx, [[1, 17], [30, 3], [30, 6.4], [5, 20.4]], 'rgba(255,255,255,0.14)');
    vlak(ctx, [[30, 3], [59, 17], [55, 20.4], [30, 6.4]], 'rgba(0,0,0,0.24)');
    for (let i = 0; i < 6; i++) { const t = 0.12 + i * 0.15; const x1 = 1 + 58 * t; const y1 = 17 - 14 * (t < 0.5 ? t * 2 : (1 - t) * 2); lijn(ctx, x1, y1, x1 + (t < 0.5 ? 1.2 : -1.2), 20.2, 'rgba(0,0,0,0.3)', 0.6); }
    for (let i = 0; i < 9; i++) ovaal(ctx, 6 + i * 5.6, 19 - 0.3 * Math.abs(i - 4), 0.45, 0.45, 'rgba(240,230,190,0.55)');
    lijn(ctx, 5, 20.4, 55, 20.4, HOUT_D, 1.6);
    lichtBlok(ctx, 28, 1.6, 4, 3.6, HOUT_D, 0.2);
    vlag(ctx, 30, 2, 5, K, 0.4);
    // wielen
    const hoek = stoot < 0 ? beeld * 0.32 : 0.5;
    for (const x of [14, 30, 46]) wiel(ctx, x, 41.4, 5.2, hoek);
    ctx.restore();
  };
  return pakket(B, H, AY, teken, grondSchaduw(36, 52, 30), { sla: [['hoog', 0], ['slag', 0]] });
}

// ------------------------------------------------------------------ KATAPULT
// Zware balansarm op een schraag, windas achter, steen in de lepel, schild en wimpel.
function katapult(def) {
  const K = def.kleur;
  const B = 64, H = 62, AY = 58;
  const teken = (ctx, houding, beeld) => {
    const gespannen = houding === 'aan';
    const rust = houding === 'lopen';
    const wip = rust && beeld % 2 ? -0.5 : 0;
    ctx.save(); ctx.translate(4, 10 + wip);
    const px = 28, py = 16;
    // onderstel met zware balk
    lichtBlok(ctx, 5, 36, 46, 4.4, HOUT_D, 0.2);
    blok(ctx, 5, 36, 46, 1, 'rgba(255,255,255,0.14)');
    blok(ctx, 8, 40.4, 3, 2, IJZER_D); blok(ctx, 40, 40.4, 3, 2, IJZER_D);
    // schragen (A-vorm, beide zijden overlappen)
    vlak(ctx, [[11.4, 36], [14.4, 36], [29.4, 16], [26.6, 16]], tint(HOUT, -0.15));
    vlak(ctx, [[41.4, 36], [44.6, 36], [29.4, 16], [26.6, 16]], HOUT);
    lijn(ctx, 17, 31, 40, 26, HOUT_D, 1.3);     // kruisverbinding
    lijn(ctx, 40, 31, 17, 26, HOUT_D, 1.3);
    lichtBlok(ctx, 20, 14.4, 16, 3.4, HOUT_D, 0.22);   // as bovenaan
    blok(ctx, 24, 14.4, 8, 0.8, 'rgba(255,255,255,0.18)');
    // windas achter met kruisbalken
    ovaal(ctx, 7, 33, 3.4, 3.4, HOUT_L); ovaal(ctx, 6.4, 32.4, 1.3, 1.3, 'rgba(255,255,255,0.2)');
    lijn(ctx, 4, 30, 10, 36, HOUT_D, 1); lijn(ctx, 10, 30, 4, 36, HOUT_D, 1);
    // arm: richting van het lange eind
    const u = gespannen ? [-0.86, 0.5] : [0.82, -0.57];
    const lang = gespannen ? 26 : 25, kort = 9;
    const ex = px + u[0] * lang, ey = py + u[1] * lang;
    const sx = px - u[0] * kort, sy = py - u[1] * kort;
    const nx = -u[1], ny = u[0];
    vlak(ctx, [[sx + nx * 1.5, sy + ny * 1.5], [ex + nx * 1.1, ey + ny * 1.1], [ex - nx * 1.1, ey - ny * 1.1], [sx - nx * 1.5, sy - ny * 1.5]], HOUT_L);
    vlak(ctx, [[sx - nx * 1.5, sy - ny * 1.5], [ex - nx * 1.1, ey - ny * 1.1], [ex - nx * 0.2, ey - ny * 0.2], [sx - nx * 0.3, sy - ny * 0.3]], 'rgba(0,0,0,0.25)');
    lijn(ctx, px + u[0] * 6, py + u[1] * 6, px + u[0] * 7.6, py + u[1] * 7.6, IJZER_D, 3.2);
    lijn(ctx, px - u[0] * 3, py - u[1] * 3, px - u[0] * 4.4, py - u[1] * 4.4, IJZER_D, 3.2);
    // contragewicht aan het korte eind
    const cw = [sx - 1.8, sy - 1];
    vlak(ctx, [[cw[0], cw[1] + 0.4], [cw[0] + 5.6, cw[1] + 0.4], [cw[0] + 5, cw[1] + 5.6], [cw[0] + 0.6, cw[1] + 5.6]], '#8a8984');
    vlak(ctx, [[cw[0] + 3.6, cw[1] + 0.4], [cw[0] + 5.6, cw[1] + 0.4], [cw[0] + 5, cw[1] + 5.6], [cw[0] + 3.4, cw[1] + 5.6]], 'rgba(0,0,0,0.28)');
    // lepel met steen
    ovaal(ctx, ex + (gespannen ? 0 : 1), ey + 2.8, 3.6, 1.6, HOUT_D);
    if (gespannen) { ovaal(ctx, ex, ey + 1.1, 2.7, 2.7, '#a8a7a0'); ovaal(ctx, ex + 0.7, ey + 0.4, 1, 1, 'rgba(255,255,255,0.4)'); }
    if (gespannen) lijn(ctx, 7, 31, ex, ey + 1, 'rgba(225,215,180,0.9)', 0.6);   // touw van de windas
    // stenen op het onderstel
    for (const [x, y] of [[34, 34.4], [38.4, 34.8], [36, 32.2]]) ovaal(ctx, x, y, 2, 1.7, '#a8a7a0');
    // schild en wimpel in teamkleur
    schild(ctx, 28, 30.2, 3.2, K);
    lijn(ctx, 47, 36, 47, 22, HOUT_D, 1.1);
    vlak(ctx, [[47, 22], [55, 24.6], [47, 27]], K);
    vlak(ctx, [[47, 22], [55, 24.6], [47, 23.6]], 'rgba(255,255,255,0.2)');
    // wielen
    const hoek = rust ? beeld * 0.32 : 0.4;
    for (const x of [12, 40]) wiel(ctx, x, 42, 5.8, hoek);
    ctx.restore();
  };
  return pakket(B, H, AY, teken, grondSchaduw(32, 57, 26), { schiet: [['aan', 0], ['los', 0]] });
}

// ------------------------------------------------------------------ BELEGERINGSTOREN
// Drie verdiepingen van hout, bekleed met huiden in teamkleur, kantelen met schilden, een vlag en
// een valbrug die tegen de muur neerkomt. Veel hoger dan een muur.
function belegeringstoren(def) {
  const K = def.kleur;
  const B = 74, H = 114, AY = 108;
  const teken = (ctx, houding, beeld) => {
    const open = houding === 'slag';
    const wip = houding === 'lopen' && beeld % 2 ? -0.5 : 0;
    ctx.save(); ctx.translate(1, 1 + wip);
    const L0 = 14, R0 = 60;       // romp onder
    const L1 = 19, R1 = 55;       // romp boven
    const yOnder = 90, yBoven = 20;
    const vorm = [[L0, yOnder], [L1, yBoven], [R1, yBoven], [R0, yOnder]];
    const kant = (y) => [L0 + ((L1 - L0) * (yOnder - y)) / (yOnder - yBoven), R0 + ((R1 - R0) * (yOnder - y)) / (yOnder - yBoven)];
    // chassis
    lichtBlok(ctx, 8, 90, 58, 5.4, HOUT_D, 0.2);
    blok(ctx, 8, 90, 58, 1, 'rgba(255,255,255,0.14)');
    for (const x of [14, 36, 58]) blok(ctx, x, 95, 3.4, 2.4, IJZER_D);
    vlak(ctx, vorm, HOUT);
    // onderste verdieping (y 66..90): planken met kruis
    {
      const [a, b] = kant(66);
      vlak(ctx, [[L0, 90], [a, 66], [b, 66], [R0, 90]], tint(HOUT, -0.04));
      vlak(ctx, [[L0, 90], [a, 66], [a + (b - a) * 0.3, 66], [L0 + (R0 - L0) * 0.3, 90]], 'rgba(0,0,0,0.16)');
      vlak(ctx, [[L0 + (R0 - L0) * 0.8, 90], [a + (b - a) * 0.8, 66], [b, 66], [R0, 90]], 'rgba(255,255,255,0.1)');
      for (let y = 69; y < 90; y += 3.6) { const [l, r] = kant(y); blok(ctx, l, y, r - l, 0.5, 'rgba(0,0,0,0.2)'); }
      lijn(ctx, L0 + 1.4, 89, b - 1.4, 67, HOUT_D, 1.6);
      lijn(ctx, R0 - 1.4, 89, a + 1.4, 67, HOUT_D, 1.6);
    }
    // middelste en bovenste verdieping: huiden in teamkleur met naden en schietgleuven
    for (const [y0, y1] of [[20, 43], [43, 66]]) {
      const [l0, r0] = kant(y1); const [l1, r1] = kant(y0);
      vlak(ctx, [[l0, y1], [l1, y0], [r1, y0], [r0, y1]], K);
      vlak(ctx, [[l0, y1], [l1, y0], [l1 + (r1 - l1) * 0.3, y0], [l0 + (r0 - l0) * 0.3, y1]], 'rgba(0,0,0,0.18)');
      vlak(ctx, [[l0 + (r0 - l0) * 0.78, y1], [l1 + (r1 - l1) * 0.78, y0], [r1, y0], [r0, y1]], 'rgba(255,255,255,0.12)');
      for (let i = 1; i < 5; i++) { const t = i / 5; lijn(ctx, l0 + (r0 - l0) * t, y1, l1 + (r1 - l1) * t, y0, 'rgba(0,0,0,0.28)', 0.6); }
      for (let i = 0; i < 6; i++) for (const yy of [y0 + 3, y1 - 3]) { const [l, r] = kant(yy); ovaal(ctx, l + 2 + (r - l - 4) * (i / 5), yy, 0.45, 0.45, 'rgba(240,230,190,0.5)'); }
      const midden = (l0 + r0 + l1 + r1) / 4;
      for (const dx of [-8, 3]) { blok(ctx, midden + dx, (y0 + y1) / 2 - 4.4, 5, 9, '#17100a'); blok(ctx, midden + dx, (y0 + y1) / 2 - 4.4, 5, 1.2, 'rgba(255,255,255,0.1)'); }
    }
    // horizontale balken en staanders
    for (const y of [20, 43, 66, 90]) { const [l, r] = kant(y); blok(ctx, l - 1.2, y - 1.4, r - l + 2.4, 2.6, HOUT_D); blok(ctx, l - 1.2, y - 1.4, r - l + 2.4, 0.6, 'rgba(255,255,255,0.16)'); }
    lijn(ctx, L0, yOnder, L1, yBoven, HOUT_D, 2.6); lijn(ctx, R0, yOnder, R1, yBoven, tint(HOUT_D, -0.15), 2.6);
    lijn(ctx, R0 - 0.8, yOnder, R1 - 0.8, yBoven, 'rgba(255,255,255,0.14)', 0.8);
    for (const y of [43, 66]) for (const x of kant(y)) ovaal(ctx, x, y, 1.3, 1.3, IJZER_D);
    // kantelen en schilden
    blok(ctx, L1 - 2, 14, R1 - L1 + 4, 6.4, HOUT_D);
    blok(ctx, L1 - 2, 14, R1 - L1 + 4, 0.8, 'rgba(255,255,255,0.18)');
    for (let k = 0; k < 5; k++) { const x = L1 - 2 + k * ((R1 - L1) / 4); lichtBlok(ctx, x, 8, 4, 6.4, HOUT, 0.22); }
    for (let k = 0; k < 4; k++) schild(ctx, L1 + 3.5 + k * 9.4, 17.4, 3.2, k % 2 ? K : '#efe6c8');
    vlag(ctx, (L1 + R1) / 2, 9, 7, K, 0.6);
    // valbrug
    if (open) {
      vlak(ctx, [[R1 - 0.5, 27], [R1 + 15, 30.4], [R1 + 15, 34.4], [R1 - 0.5, 31]], HOUT_L);
      vlak(ctx, [[R1 - 0.5, 27], [R1 + 15, 30.4], [R1 + 15, 31.6], [R1 - 0.5, 28.2]], 'rgba(255,255,255,0.2)');
      for (let i = 1; i < 5; i++) lijn(ctx, R1 + i * 3.4, 28.4 + i * 0.6, R1 + i * 3.4, 32.6 + i * 0.6, 'rgba(0,0,0,0.3)', 0.6);
      lijn(ctx, R1 + 14, 30.6, R1 + 5, 20, '#d8cfb4', 0.7);    // ketting
      lijn(ctx, R1 + 14.4, 31, R1 + 13.4, 38, IJZER, 1.6);     // ijzeren haken in de muur
    } else {
      lichtBlok(ctx, R1 - 0.6, 24, 3.8, 26, HOUT_L, 0.24);
      for (let i = 0; i < 4; i++) blok(ctx, R1 - 0.6, 27 + i * 6, 3.8, 0.5, 'rgba(0,0,0,0.25)');
      lijn(ctx, R1 + 2.6, 24, R1 + 2.6, 18, IJZER, 0.9);
    }
    // wielen
    const hoek = houding === 'lopen' ? beeld * 0.32 : 0.5;
    for (const x of [24, 50]) wiel(ctx, x, 99, 7.4, hoek);
    ctx.restore();
  };
  return pakket(B, H, AY, teken, grondSchaduw(38, 108, 32), { sla: [['lopen', 0], ['slag', 0]] });
}

export const MACHINES = {
  ram: (naam, def) => ram(def),
  katapult: (naam, def) => katapult(def),
  belegeringstoren: (naam, def) => belegeringstoren(def),
};
