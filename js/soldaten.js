// SOLDATEN EN WERKERS in dezelfde stijl als de heren (heren.js): een zachte
// schaduw, een donkere omlijning rond de hele figuur, licht van rechts en
// duidelijke vormen per soort. Zelfde beeldcontract als in kunst.js:
// { rechts:[4], links:[4], b, h, ax, ay, houdingen:{...} }.
// Teamkleur (blauw of rood) zit in tabbard, kap, sjerp of band en altijd
// ruim zichtbaar. Alles wordt eenmalig voorgetekend (geen kosten per beeld).
//
// Ruimte per figuur: 26 bij 38, voeten op y = 34, midden x = 13 (zoals voorheen).

import { blok, lijn, vlak, ovaal, tint, lichtBlok, hand, benen } from './heren.js';

const SCHERPTE = 3;
const B = 52;          // canvas, logische pixels
const H = 40;
const AX = 26;         // midden van de figuur in het canvas
const AY = 36;         // voeten (figuur y = 34)
const DX = AX - 13;    // verschuiving van de figuurruimte naar het canvas
const DY = AY - 34;
const OMLIJN = '#1b130d';
const HUID = '#e2bd97';
const STAAL = '#c6cbd3';
const HOUT = '#6b4a2a';
const LEER = '#5a4126';

const LOOP = [0, 1.7, 0, -1.7];

function schaduw(ctx, mx, rx = 7.2) {
  const g = ctx.createRadialGradient(mx, 34, 0.5, mx, 34, rx);
  g.addColorStop(0, 'rgba(0,0,0,0.40)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.25)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(mx, 34, rx, rx * 0.38, 0, 0, Math.PI * 2); ctx.fill();
}

// Klein gezicht (past bij een hoofd van ongeveer 7 pixels): twee ogen, neus, optioneel baard.
function gezichtje(ctx, x, y, o = {}) {
  const huid = o.huid || HUID;
  const rx = o.rx || 3.1, ry = o.ry || 3.4;
  ovaal(ctx, x, y, rx, ry, huid);
  ovaal(ctx, x - rx * 0.4, y + 0.3, rx * 0.55, ry * 0.85, 'rgba(0,0,0,0.14)');
  ovaal(ctx, x + rx * 0.5, y - 0.2, rx * 0.4, ry * 0.7, 'rgba(255,255,255,0.12)');
  ovaal(ctx, x - 1.1, y - 0.1, 0.55, 0.5, '#2a1b12');
  ovaal(ctx, x + 1.3, y - 0.1, 0.55, 0.5, '#2a1b12');
  if (o.brauw !== false) {
    lijn(ctx, x - 2, y - 1, x - 0.5, y - 1.2, o.haar || '#3a2a1c', 0.5);
    lijn(ctx, x + 2.2, y - 1, x + 0.7, y - 1.2, o.haar || '#3a2a1c', 0.5);
  }
  lijn(ctx, x + 0.1, y + 0.3, x + 0.4, y + 1.3, 'rgba(90,50,30,0.5)', 0.5);
  if (o.baard) {
    vlak(ctx, [[x - rx, y + 0.8], [x + rx, y + 0.8], [x + rx * 0.7, y + ry + 1.6], [x, y + ry + 2.3], [x - rx * 0.7, y + ry + 1.6]], o.baard);
    ovaal(ctx, x + 0.2, y + 1.9, 1, 0.4, 'rgba(120,50,40,0.55)');
  } else {
    lijn(ctx, x - 0.7, y + 2.1, x + 1, y + 2.1, '#7a3a30', 0.45);
  }
}

// Torso als een rechthoek met licht van rechts en een riem.
function romp(ctx, mx, wip, b, top, hoogte, kleur, riem = '#3a2a1a') {
  lichtBlok(ctx, mx - b / 2, top + wip, b, hoogte, kleur, 0.22);
  blok(ctx, mx - b / 2, top + hoogte * 0.62 + wip, b, 1.1, riem);
  blok(ctx, mx - 0.6, top + hoogte * 0.62 + wip, 1.2, 1.1, '#d8b24a');
}

// Bouwt een plaatje met schaduw, omlijning en figuur.
function maak(teken, houding, beeld, spiegel) {
  const w = B * SCHERPTE, h = H * SCHERPTE;
  const inRuimte = (ctx) => { ctx.scale(SCHERPTE, SCHERPTE); ctx.translate(DX, DY); };
  const fig = document.createElement('canvas'); fig.width = w; fig.height = h;
  const fc = fig.getContext('2d'); fc.save(); inRuimte(fc); teken(fc, houding, beeld); fc.restore();
  const sil = document.createElement('canvas'); sil.width = w; sil.height = h;
  const sc = sil.getContext('2d');
  sc.drawImage(fig, 0, 0);
  sc.globalCompositeOperation = 'source-in';
  sc.fillStyle = OMLIJN; sc.fillRect(0, 0, w, h);
  const uit = document.createElement('canvas'); uit.width = w; uit.height = h;
  const u = uit.getContext('2d');
  if (spiegel) { u.translate(w, 0); u.scale(-1, 1); }
  u.save(); inRuimte(u); schaduw(u, 13); u.restore();
  const r = 1.3;
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; u.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r); }
  u.drawImage(fig, 0, 0);
  return uit;
}

// Bouwt het hele beeldenpakket. lijst = [[houding, beeld], ...]
function pakket(teken, extra = {}) {
  const set = (lijst) => ({
    rechts: lijst.map(([hd, bd]) => maak(teken, hd, bd, false)),
    links: lijst.map(([hd, bd]) => maak(teken, hd, bd, true)),
    b: B, h: H, ax: AX, ay: AY,
  });
  const uit = set([['lopen', 0], ['lopen', 1], ['lopen', 2], ['lopen', 3]]);
  const hd = {};
  for (const [naam, lijst] of Object.entries(extra)) hd[naam] = set(lijst);
  if (Object.keys(hd).length) uit.houdingen = hd;
  return uit;
}
const TWEE = (naam) => [[naam, 0], [naam, 1]];
const VIER = (naam) => [[naam, 0], [naam, 1], [naam, 2], [naam, 3]];

// ---------------------------------------------------------------- ridder
// Speerdrager met helm, wapenrok in teamkleur, vlieger schild en pennant aan de speer.
function ridder(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const steek = houding === 'slag' ? 1 : 0;
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.9 : LOOP[beeld];
    const mx = vecht ? 12 + steek : 13;
    if (!vecht) {
      lijn(ctx, 19.5, 33, 19.5, 5 + wip, HOUT, 1.3);
      vlak(ctx, [[19.5, 1 + wip], [21.1, 5.6 + wip], [17.9, 5.6 + wip]], '#e8ecf1');
      vlak(ctx, [[19.5, 6.2 + wip], [24, 7.6 + wip], [19.5, 9.2 + wip]], K);
    }
    benen(ctx, mx, wip, pas, { top: 27, b: 3.2, sp: 2.2, been: ['#4a4a54', '#3a3a44'], laars: '#2b2b32', laarsH: 3 });
    // maliënrok onder de wapenrok
    blok(ctx, mx - 4.8, 26 + wip, 9.6, 2.4, '#8a909a');
    for (let i = 0; i < 6; i++) blok(ctx, mx - 4.6 + i * 1.6, 27.2 + wip, 0.7, 0.6, 'rgba(0,0,0,0.35)');
    // wapenrok
    romp(ctx, mx, wip, 9.6, 17, 10.2, K);
    blok(ctx, mx - 0.5, 17 + wip, 1, 10.2, '#efe6c8');
    // schouders en rechterarm
    ovaal(ctx, mx - 4.6, 18.2 + wip, 2.4, 2.2, tint(STAAL, -0.25));
    ovaal(ctx, mx + 4.6, 18.2 + wip, 2.5, 2.3, STAAL);
    lijn(ctx, mx + 4.8, 19 + wip, mx + 6, 23.4 + wip, tint(STAAL, -0.1), 2.3);
    // schild
    const s = [[mx - 9.2, 18.4 + wip], [mx - 1.6, 18.4 + wip], [mx - 1.6, 24.4 + wip], [mx - 5.4, 29 + wip], [mx - 9.2, 24.4 + wip]];
    vlak(ctx, s, tint(K, -0.2));
    vlak(ctx, [[mx - 5.4, 18.4 + wip], [mx - 1.6, 18.4 + wip], [mx - 1.6, 24.4 + wip], [mx - 5.4, 29 + wip]], K);
    ctx.strokeStyle = '#efe6c8'; ctx.lineWidth = 0.7;
    ctx.beginPath(); s.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke();
    blok(ctx, mx - 5.9, 19.4 + wip, 1, 8, '#efe6c8');
    blok(ctx, mx - 8.6, 22 + wip, 6.2, 1, '#efe6c8');
    // helm met neusbeugel en pluim
    ovaal(ctx, mx + 0.4, 12.4 + wip, 2.9, 3.1, HUID);
    ovaal(ctx, mx + 0.1, 10.6 + wip, 4.6, 4, STAAL);
    blok(ctx, mx - 4.6, 10.6 + wip, 9.2, 2.2, STAAL);
    blok(ctx, mx - 4.6, 10.6 + wip, 3, 2.2, 'rgba(0,0,0,0.22)');
    blok(ctx, mx - 1.4, 11.4 + wip, 4.2, 1, '#23232a');   // ooggleuf
    blok(ctx, mx + 0.5, 11.4 + wip, 0.9, 4.2, STAAL);      // neusbeugel
    ovaal(ctx, mx + 1.8, 8.6 + wip, 1.4, 1, 'rgba(255,255,255,0.55)');
    vlak(ctx, [[mx - 2.4, 7 + wip], [mx + 2.2, 6.4 + wip], [mx + 3.5, 3.6 + wip], [mx, 4.4 + wip]], K);
    ovaal(ctx, mx + 0.8, 5.1 + wip, 2.4, 1, tint(K, 0.28));
    if (vecht) {
      const punt = steek ? 26.4 : 22.6;
      lijn(ctx, punt - 17, 24, punt - 3, 21.8, HOUT, 1.4);
      vlak(ctx, [[punt, 21.3], [punt - 4, 20], [punt - 3.5, 23.6]], '#e8ecf1');
      vlak(ctx, [[punt - 6, 22.3], [punt - 10.5, 21.6], [punt - 8.5, 24.6]], K);
      hand(ctx, mx + 6.2, 23, STAAL, 1.5);
    }
  };
  return pakket(teken, { sla: [['hoog', 0], ['slag', 0]] });
}

// ------------------------------------------------------------- bijlridder
// Zwaar, breed, open helm met baard, grote tweehandige bijl, sjerp in teamkleur.
function bijlridder(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const hoog = houding === 'hoog';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.6 : LOOP[beeld];
    const mx = 13;
    const bijl = (x1, y1, x2, y2) => {
      lijn(ctx, x1, y1, x2, y2, HOUT, 1.5);
      const l = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / l, uy = (y2 - y1) / l, nx = -uy, ny = ux;
      vlak(ctx, [[x2 - ux * 1, y2 - uy * 1], [x2 + nx * 5.4 + ux * 1.4, y2 + ny * 5.4 + uy * 1.4], [x2 + nx * 5.6 - ux * 3.2, y2 + ny * 5.6 - uy * 3.2], [x2 - ux * 3.6, y2 - uy * 3.6]], '#dfe3e8');
      vlak(ctx, [[x2 - ux * 1, y2 - uy * 1], [x2 + nx * 2.6 + ux * 0.4, y2 + ny * 2.6 + uy * 0.4], [x2 - ux * 3.6, y2 - uy * 3.6]], '#8f96a0');
      vlak(ctx, [[x2 + ux * 1.6, y2 + uy * 1.6], [x2 - nx * 1.4, y2 - ny * 1.4], [x2 - ux * 0.5, y2 - uy * 0.5]], '#c9ced6');
    };
    if (!vecht) bijl(mx - 6.5, 24 + wip, mx - 9.5, 6 + wip);
    benen(ctx, mx, wip, pas, { top: 27, b: 3.6, sp: 2.5, been: ['#4a3c2c', '#3a2e22'], laars: '#2a2018', laarsH: 3.2 });
    // brede wapenrok van leer en maliën, sjerp in teamkleur
    romp(ctx, mx, wip, 11, 16.5, 11.6, '#6e6a62', '#2a1f16');
    for (let y = 18; y < 27; y += 2) blok(ctx, mx - 5.5, y + wip, 11, 0.4, 'rgba(0,0,0,0.22)');
    vlak(ctx, [[mx - 5.5, 16.8 + wip], [mx - 2.8, 16.8 + wip], [mx + 5.5, 27 + wip], [mx + 2.6, 27 + wip]], K);
    vlak(ctx, [[mx - 3.6, 17 + wip], [mx - 2.8, 16.8 + wip], [mx + 5.5, 27 + wip], [mx + 4.6, 27 + wip]], tint(K, 0.2));
    // schouderstukken
    ovaal(ctx, mx - 5.8, 17.8 + wip, 3, 2.5, tint(STAAL, -0.3));
    ovaal(ctx, mx + 5.8, 17.8 + wip, 3, 2.5, tint(STAAL, -0.05));
    ovaal(ctx, mx + 6.4, 17.2 + wip, 1.2, 0.8, 'rgba(255,255,255,0.5)');
    // hoofd met open helm, baard en kam
    gezichtje(ctx, mx + 0.4, 12 + wip, { baard: '#7a4a28', haar: '#4a2c18' });
    ovaal(ctx, mx, 9.6 + wip, 4.8, 3.8, tint(STAAL, -0.12));
    blok(ctx, mx - 4.8, 9.6 + wip, 9.6, 1.8, tint(STAAL, -0.12));
    blok(ctx, mx - 4.8, 9.6 + wip, 3.2, 1.8, 'rgba(0,0,0,0.25)');
    blok(ctx, mx - 4.9, 9.6 + wip, 1.1, 5, tint(STAAL, -0.3));
    blok(ctx, mx + 3.8, 9.6 + wip, 1.1, 5, STAAL);
    ovaal(ctx, mx + 1.8, 7.6 + wip, 1.5, 1, 'rgba(255,255,255,0.5)');
    vlak(ctx, [[mx - 0.8, 6.4 + wip], [mx + 0.8, 6.4 + wip], [mx + 0.4, 3.6 + wip], [mx - 0.4, 3.6 + wip]], tint(K, -0.1));
    if (vecht) {
      if (hoog) { bijl(mx + 2, 24, mx + 11, 3); hand(ctx, mx + 3.5, 21, STAAL, 1.6); hand(ctx, mx + 6, 15, STAAL, 1.6); }
      else { bijl(mx + 1.5, 15, mx + 13.5, 28.5); hand(ctx, mx + 3.5, 17, STAAL, 1.6); hand(ctx, mx + 7.6, 22, STAAL, 1.6); }
    } else {
      hand(ctx, mx - 6.8, 21 + wip, STAAL, 1.6);
    }
  };
  return pakket(teken, { sla: [['hoog', 0], ['slag', 0]] });
}

// ----------------------------------------------------------- boogschutter
// Kap in teamkleur, lange boog, pijlkoker op de rug, leren borstkleed.
function boogschutter(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const geschoten = houding === 'los';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.4 : LOOP[beeld];
    const mx = 13;
    // pijlkoker
    lichtBlok(ctx, mx - 7.2, 15 + wip, 2.8, 9, '#5b4228', 0.25);
    for (const [dx, k] of [[0.4, '#e8e2d0'], [1.5, K], [2.4, '#e8e2d0']]) vlak(ctx, [[mx - 7.2 + dx, 15 + wip], [mx - 6.4 + dx, 15 + wip], [mx - 6.8 + dx, 12.2 + wip]], k);
    benen(ctx, mx, wip, pas, { top: 27, b: 2.9, sp: 2.1, been: ['#58452e', '#463725'], laars: '#2f2418', laarsH: 3.4 });
    // tuniek: leer met teamkleur
    romp(ctx, mx, wip, 8.8, 17, 10.4, '#8a6a40', '#2e2216');
    blok(ctx, mx - 4.4, 17 + wip, 8.8, 3.2, tint(K, -0.05));
    blok(ctx, mx + 1.8, 17 + wip, 2.6, 3.2, 'rgba(255,255,255,0.14)');
    blok(ctx, mx - 4.4, 26.4 + wip, 8.8, 1.6, tint('#8a6a40', -0.2));
    // kap in teamkleur met punt, gezicht
    gezichtje(ctx, mx + 0.6, 12 + wip, { rx: 2.7, ry: 3.1 });
    vlak(ctx, [[mx - 4.4, 13.2 + wip], [mx - 4.6, 8.2 + wip], [mx - 1, 5 + wip], [mx + 3.2, 6.6 + wip], [mx + 4, 9.8 + wip], [mx + 2.2, 10 + wip], [mx + 1.6, 9.2 + wip], [mx - 2.4, 9.6 + wip], [mx - 2.8, 13.2 + wip]], K);
    vlak(ctx, [[mx + 1.2, 5.8 + wip], [mx + 3.2, 6.6 + wip], [mx + 4, 9.8 + wip], [mx + 2.2, 10 + wip]], tint(K, 0.22));
    vlak(ctx, [[mx - 4.6, 8.2 + wip], [mx - 3.2, 6.6 + wip], [mx - 3, 13.2 + wip], [mx - 4.4, 13.2 + wip]], tint(K, -0.3));
    // boog
    const boog = (bx, by, trek) => {
      ctx.strokeStyle = '#7a5530'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(bx + 1.5, by - 11); ctx.quadraticCurveTo(bx + 7, by, bx + 1.5, by + 11); ctx.stroke(); ctx.lineCap = 'butt';
      ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(bx + 1.5, by - 10.8); ctx.quadraticCurveTo(bx + 6.4, by, bx + 1.5, by + 10.8); ctx.stroke();
      ctx.strokeStyle = 'rgba(240,235,220,0.85)'; ctx.lineWidth = 0.4;
      ctx.beginPath(); ctx.moveTo(bx + 1.5, by - 11); ctx.lineTo(bx - trek, by); ctx.lineTo(bx + 1.5, by + 11); ctx.stroke();
    };
    if (!vecht) {
      boog(mx + 5.5, 21 + wip, 0);
      lijn(ctx, mx + 3, 19 + wip, mx + 6.8, 21 + wip, tint(K, -0.1), 2.2);
      hand(ctx, mx + 7, 21 + wip, HUID, 1.4);
    } else if (!geschoten) {
      boog(mx + 7.5, 19, 4.6);
      lijn(ctx, mx + 5, 18.4, mx + 17, 19, '#d8c9a4', 0.6);
      vlak(ctx, [[mx + 18.6, 19], [mx + 16.6, 18.1], [mx + 16.6, 19.9]], '#cfd4da');
      lijn(ctx, mx + 3, 18.6, mx + 8.6, 19, tint(K, -0.1), 2.2);
      hand(ctx, mx + 8.9, 19, HUID, 1.4);
      lijn(ctx, mx - 1, 19, mx + 3, 18.6, tint(K, -0.2), 2);
    } else {
      boog(mx + 7.5, 19, 0);
      lijn(ctx, mx + 3, 18.6, mx + 8.6, 19, tint(K, -0.1), 2.2);
      hand(ctx, mx + 8.9, 19, HUID, 1.4);
      lijn(ctx, mx + 12, 19, mx + 22, 18.6, 'rgba(235,230,215,0.8)', 0.5);
      hand(ctx, mx - 1.4, 19, HUID, 1.3);
    }
  };
  return pakket(teken, { schiet: [['aan', 0], ['los', 0]] });
}

// -------------------------------------------------------- kruisboogschutter
// Ketelhoed, brigandine in teamkleur, zware kruisboog; schiet vooruit.
function kruisboogschutter(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const los = houding === 'los';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.4 : LOOP[beeld];
    const mx = vecht ? 12 : 13;
    benen(ctx, mx, wip, pas, { top: 27, b: 3, sp: 2.2, been: ['#46505e', '#38414d'], laars: '#2a2a2e', laarsH: 3 });
    // brigandine: stof in teamkleur met klinknagels
    romp(ctx, mx, wip, 9.4, 17, 10.6, K);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) ovaal(ctx, mx - 3.4 + c * 2.3, 19 + r * 2.7 + wip, 0.45, 0.45, 'rgba(235,225,190,0.8)');
    blok(ctx, mx - 4.7, 26.8 + wip, 9.4, 1.6, tint(K, -0.28));
    // koker met bouten op de heup
    blok(ctx, mx + 3.6, 22 + wip, 2, 4.6, '#4a3624');
    for (const dx of [0.2, 1.1]) blok(ctx, mx + 3.8 + dx, 20.8 + wip, 0.5, 1.4, '#d8cfb4');
    ovaal(ctx, mx - 4.6, 18.4 + wip, 2.2, 2, tint(STAAL, -0.3));
    ovaal(ctx, mx + 4.6, 18.4 + wip, 2.2, 2, STAAL);
    // ketelhoed
    gezichtje(ctx, mx + 0.6, 12.4 + wip, { rx: 2.7, ry: 3 });
    ovaal(ctx, mx, 9.8 + wip, 4.4, 3.2, STAAL);
    ovaal(ctx, mx, 9.4 + wip, 8.2, 1.9, tint(STAAL, -0.12));
    ovaal(ctx, mx + 2.4, 8.4 + wip, 1.6, 0.9, 'rgba(255,255,255,0.5)');
    blok(ctx, mx - 8, 9.6 + wip, 5.2, 1.5, 'rgba(0,0,0,0.18)');
    blok(ctx, mx - 1.2, 6.2 + wip, 2.4, 1, tint(K, 0.1));
    // kruisboog
    const kb = (x, y, schaal = 1) => {
      lijn(ctx, x - 8 * schaal, y, x + 3, y, '#7a5530', 1.8);                    // schacht
      lijn(ctx, x + 3, y - 5, x + 3, y + 5, '#3b3b44', 1.5);                      // boog
      ctx.strokeStyle = '#3b3b44'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x + 3, y - 5); ctx.quadraticCurveTo(x + 0.2, y - 5.4, x - 0.6, y - 5.2); ctx.moveTo(x + 3, y + 5); ctx.quadraticCurveTo(x + 0.2, y + 5.4, x - 0.6, y + 5.2); ctx.stroke();
    };
    if (!vecht) {
      lijn(ctx, mx + 2, 18.6 + wip, mx + 6.6, 22.6 + wip, tint(K, -0.15), 2.2);
      hand(ctx, mx + 6.8, 22.8 + wip, HUID, 1.4);
      ctx.save(); ctx.translate(mx + 4.4, 20.4 + wip); ctx.rotate(-0.7);
      lijn(ctx, -6, 0, 5, 0, '#7a5530', 1.7);
      lijn(ctx, 4, -4.6, 4, 4.6, '#3b3b44', 1.4);
      ctx.restore();
    } else {
      lijn(ctx, mx + 2, 18.6, mx + 9, 20, tint(K, -0.15), 2.2);
      kb(mx + 14.4, 20.2);
      hand(ctx, mx + 8.6, 20.2, HUID, 1.4);
      if (!los) { lijn(ctx, mx + 17.4, 15.2, mx + 14.6, 20.2, '#d8cfb4', 0.45); lijn(ctx, mx + 17.4, 25.2, mx + 14.6, 20.2, '#d8cfb4', 0.45); lijn(ctx, mx + 8, 20.2, mx + 19, 20, '#cfd4da', 0.7); }
      else { lijn(ctx, mx + 17.4, 15.2, mx + 17.4, 25.2, '#d8cfb4', 0.45); lijn(ctx, mx + 18.5, 20.2, mx + 25, 20.2, 'rgba(235,235,235,0.7)', 0.5); }
      lijn(ctx, mx - 1, 19, mx + 4, 19.8, tint(K, -0.25), 2);
    }
  };
  return pakket(teken, { schiet: [['aan', 0], ['los', 0]] });
}

// ----------------------------------------------------------- sluipmoordenaar
// Donkere kap en mantel, gezicht half verborgen, twee dolken, teamkleur als sjaal.
function sluipmoordenaar(def) {
  const K = def.kleur;
  const MANTEL = '#2b2b36', MANTEL2 = '#1f1f28';
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const steek = houding === 'slag';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 2 : LOOP[beeld];
    const mx = vecht ? 12.4 : 13;
    benen(ctx, mx, wip, pas, { top: 27, b: 2.8, sp: 2.2, been: ['#2a2a32', '#202028'], laars: '#17171c', laarsH: 4 });
    // wapperende mantel
    const wap = vecht ? 1.2 : [0, 1, 0, -1][beeld];
    vlak(ctx, [[mx - 4.4, 16.6 + wip], [mx + 4.6, 16.6 + wip], [mx + 5.2 - wap, 30.6], [mx - 6.4 - wap * 1.4, 31.4], [mx - 4.8 - wap, 29]], MANTEL);
    vlak(ctx, [[mx + 0.6, 16.8 + wip], [mx + 4.6, 16.6 + wip], [mx + 5.2 - wap, 30.6], [mx + 1.6 - wap, 30.8]], 'rgba(255,255,255,0.09)');
    vlak(ctx, [[mx - 4.4, 16.6 + wip], [mx - 1.2, 16.8 + wip], [mx - 3.2 - wap, 30.8], [mx - 6.4 - wap * 1.4, 31.4]], MANTEL2);
    // koord en riem
    lijn(ctx, mx - 4, 24 + wip, mx + 4.4, 24.6 + wip, '#6a4a30', 1);
    // kap met masker en sjaal in teamkleur
    ovaal(ctx, mx + 0.4, 11.4 + wip, 3.4, 3.6, MANTEL2);
    ovaal(ctx, mx + 1, 12 + wip, 2.2, 2, HUID);
    blok(ctx, mx - 1.3, 13 + wip, 5.2, 2, '#1c1c24');
    ovaal(ctx, mx + 0.4, 11.8 + wip, 0.55, 0.45, '#f3efe4'); ovaal(ctx, mx + 2.2, 11.8 + wip, 0.55, 0.45, '#f3efe4');
    vlak(ctx, [[mx - 4.4, 11 + wip], [mx - 2.8, 6 + wip], [mx + 2, 5.2 + wip], [mx + 4.4, 9.6 + wip], [mx + 3.8, 8.6 + wip], [mx + 0.4, 7.6 + wip], [mx - 2.8, 9.4 + wip], [mx - 3, 14 + wip], [mx - 4.4, 14.4 + wip]], MANTEL);
    vlak(ctx, [[mx - 4.6, 15.8 + wip], [mx + 4.6, 15.8 + wip], [mx + 4, 17.8 + wip], [mx - 4, 17.8 + wip]], K);
    vlak(ctx, [[mx + 2.4, 17.6 + wip], [mx + 4.2, 17.6 + wip], [mx + 5.4, 22.6 + wip], [mx + 3.4, 21 + wip]], tint(K, -0.15));
    const dolk = (x, y, hoek, l = 5.4) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(hoek);
      lijn(ctx, 0, 0, 0, -1.4, '#3a2a1c', 1);
      blok(ctx, -1.2, -1.8, 2.4, 0.6, '#7b7f88');
      vlak(ctx, [[-0.7, -2], [0.7, -2], [0, -2 - l]], '#e3e7ec');
      vlak(ctx, [[0.2, -2], [0.7, -2], [0, -2 - l]], '#aeb4bd');
      ctx.restore();
    };
    if (!vecht) {
      lijn(ctx, mx + 3, 18 + wip, mx + 5.4, 23 + wip, MANTEL, 2.2);
      hand(ctx, mx + 5.6, 23.4 + wip, HUID, 1.3);
      dolk(mx + 5.8, 24 + wip, 2.6);
      lijn(ctx, mx - 3, 18 + wip, mx - 5, 23 + wip, MANTEL2, 2.2);
      dolk(mx - 5.2, 23.4 + wip, -2.7);
    } else if (!steek) {
      lijn(ctx, mx + 3, 18, mx + 8, 14, MANTEL, 2.2); dolk(mx + 8.4, 13.4, 0.5, 5.4); hand(ctx, mx + 8.2, 14, HUID, 1.3);
      lijn(ctx, mx - 3, 18, mx - 6.6, 15, MANTEL2, 2.2); dolk(mx - 7, 14.6, -0.5, 5);
    } else {
      lijn(ctx, mx + 3, 19, mx + 9, 21, MANTEL, 2.2); dolk(mx + 10.4, 21.6, 1.55, 6); hand(ctx, mx + 9, 21, HUID, 1.3);
      lijn(ctx, mx - 3, 19, mx - 5, 22, MANTEL2, 2.2);
      lijn(ctx, mx + 13, 19.6, mx + 18, 18, 'rgba(255,255,255,0.8)', 0.6); lijn(ctx, mx + 13, 22.6, mx + 18, 24.4, 'rgba(255,255,255,0.8)', 0.6);
    }
  };
  return pakket(teken, { sla: [['hoog', 0], ['slag', 0]] });
}

// ------------------------------------------------------------ vlammenwever
// Lange gloeiend oranje mantel, puntmuts en sjerp in teamkleur, staf met vuurbol.
function vlammenwever(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const worp = houding === 'los';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const zwier = vecht ? 0.6 : [0, 1, 0, -1][beeld];
    const mx = 13;
    const bol = (x, y, r) => {
      const g = ctx.createRadialGradient(x, y, 0.3, x, y, r * 2);
      g.addColorStop(0, 'rgba(255,240,170,0.95)'); g.addColorStop(0.35, 'rgba(255,170,60,0.7)'); g.addColorStop(1, 'rgba(255,100,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, Math.PI * 2); ctx.fill();
      ovaal(ctx, x, y, r, r, '#ffb347'); ovaal(ctx, x - r * 0.2, y - r * 0.3, r * 0.5, r * 0.5, '#fff2c0');
    };
    if (!vecht) {
      lijn(ctx, mx - 6.6, 33, mx - 6.6, 7 + wip, '#4a3020', 1.4);
      vlak(ctx, [[mx - 8.4, 6.6 + wip], [mx - 4.8, 6.6 + wip], [mx - 5.4, 8.6 + wip], [mx - 7.8, 8.6 + wip]], '#2a2a30');
      bol(mx - 6.6, 4.6 + wip, 2.2);
    }
    // mantel
    vlak(ctx, [[mx - 5, 17.4 + wip], [mx + 5, 17.4 + wip], [mx + 7 + zwier, 33.6], [mx - 6.4 + zwier, 33.6]], '#b83a22');
    vlak(ctx, [[mx - 5, 17.4 + wip], [mx - 1.5, 17.6 + wip], [mx - 2.6 + zwier, 33.6], [mx - 6.4 + zwier, 33.6]], '#8e2a18');
    vlak(ctx, [[mx + 0.4, 17.6 + wip], [mx + 5, 17.4 + wip], [mx + 7 + zwier, 33.6], [mx + 2 + zwier, 33.6]], '#e0702a');
    for (let i = 0; i < 4; i++) vlak(ctx, [[mx - 6 + i * 3.4 + zwier, 33.6], [mx - 4.8 + i * 3.4 + zwier, 30], [mx - 3.6 + i * 3.4 + zwier, 33.6]], '#f2a53a');
    // sjerp in teamkleur
    vlak(ctx, [[mx - 5, 18 + wip], [mx - 2.6, 17.4 + wip], [mx + 5, 25 + wip], [mx + 3, 26.4 + wip]], K);
    blok(ctx, mx - 5, 24 + wip, 10, 1.2, '#4a2a18');
    // kap en gezicht
    gezichtje(ctx, mx + 0.6, 12.6 + wip, { baard: '#e8e2d4', haar: '#bdb7a8', rx: 2.8, ry: 3 });
    vlak(ctx, [[mx - 4.4, 11.2 + wip], [mx + 4.8, 11 + wip], [mx + 2.4, 5 + wip], [mx + 2, 0.8 + wip], [mx - 0.2, 4.6 + wip], [mx - 3.6, 6.4 + wip]], K);
    vlak(ctx, [[mx + 1, 5.4 + wip], [mx + 2.4, 5 + wip], [mx + 4.8, 11 + wip], [mx + 2.6, 11 + wip]], tint(K, 0.22));
    vlak(ctx, [[mx - 4.4, 11.2 + wip], [mx - 3.6, 6.4 + wip], [mx - 2.4, 11.2 + wip]], tint(K, -0.3));
    blok(ctx, mx - 4.6, 10.6 + wip, 9.6, 1.1, '#e8c04a');
    if (!vecht) {
      lijn(ctx, mx - 3, 19 + wip, mx - 6.4, 21.4 + wip, '#8e2a18', 2.4);
      hand(ctx, mx - 6.6, 21.6 + wip, HUID, 1.3);
      lijn(ctx, mx + 3, 19 + wip, mx + 5, 24 + wip, '#b83a22', 2.4);
      hand(ctx, mx + 5, 24.4 + wip, HUID, 1.3);
    } else if (!worp) {
      lijn(ctx, mx - 3, 19, mx - 7, 12, '#8e2a18', 2.4); hand(ctx, mx - 7.2, 11.6, HUID, 1.3);
      lijn(ctx, mx - 8, 33, mx - 8, 9, '#4a3020', 1.4);
      bol(mx - 8, 7, 2.6);
      lijn(ctx, mx + 3, 19, mx + 7, 22, '#b83a22', 2.4);
      bol(mx + 8.6, 22.6, 1.4);
    } else {
      lijn(ctx, mx - 3, 19, mx - 6, 22, '#8e2a18', 2.4);
      lijn(ctx, mx - 7, 33, mx - 7, 11, '#4a3020', 1.4); bol(mx - 7, 9.4, 1.8);
      lijn(ctx, mx + 3, 19, mx + 10, 18, '#b83a22', 2.4); hand(ctx, mx + 10.4, 18, HUID, 1.4);
      bol(mx + 15, 17.6, 3.2);
      ovaal(ctx, mx + 12.2, 18, 2, 1.1, 'rgba(255,150,40,0.7)');
    }
  };
  return pakket(teken, { schiet: [['aan', 0], ['los', 0]] });
}

// ------------------------------------------------------------ ladderdrager
// Lichte soldaat met leren kap en gewatteerde jas in teamkleur; draagt een ladder.
function ladderdrager(def) {
  const K = def.kleur;
  const HOUTL = '#9a7444';
  const ladder = (ctx, x1, y1, x2, y2) => {
    const l = Math.hypot(x2 - x1, y2 - y1);
    const nx = -(y2 - y1) / l * 1.7, ny = (x2 - x1) / l * 1.7;
    const n = Math.floor(l / 3.2);
    for (let i = 1; i < n; i++) { const d = i / n, px = x1 + (x2 - x1) * d, py = y1 + (y2 - y1) * d; lijn(ctx, px + nx, py + ny, px - nx, py - ny, tint(HOUTL, -0.18), 0.8); }
    lijn(ctx, x1 + nx, y1 + ny, x2 + nx, y2 + ny, HOUTL, 1.1);
    lijn(ctx, x1 - nx, y1 - ny, x2 - nx, y2 - ny, tint(HOUTL, -0.3), 1.1);
  };
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const zet = houding === 'hoog' ? 0 : 1;
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.2 : LOOP[beeld];
    const mx = 12;
    if (vecht) ladder(ctx, zet === 0 ? 17 : 18, 34, zet === 0 ? 19 : 25, zet === 0 ? 1 : 3);
    benen(ctx, mx, wip, pas, { top: 27, b: 2.9, sp: 2.1, been: ['#5a4a3a', '#483a2c'], laars: '#2c2218', laarsH: 3 });
    romp(ctx, mx, wip, 9, 17, 10.6, K);
    for (const y of [20, 23, 26]) blok(ctx, mx - 4.5, y + wip, 9, 0.5, 'rgba(0,0,0,0.22)');
    blok(ctx, mx - 4.5, 17 + wip, 9, 1.2, tint(K, 0.15));
    gezichtje(ctx, mx + 0.6, 12.4 + wip, { rx: 2.8, ry: 3.1 });
    ovaal(ctx, mx, 10.2 + wip, 4.3, 3.1, '#6b5034');
    blok(ctx, mx - 4.3, 10.2 + wip, 1.4, 4.2, '#5a4128');
    blok(ctx, mx + 2.8, 10.2 + wip, 1.4, 3.4, '#7c5e3c');
    ovaal(ctx, mx + 1.4, 8.6 + wip, 1.3, 0.8, 'rgba(255,255,255,0.25)');
    if (!vecht) {
      lijn(ctx, mx + 3, 17.6 + wip, mx + 4.6, 14 + wip, tint(K, -0.15), 2.2);
      hand(ctx, mx + 4.6, 13.6 + wip, HUID, 1.3);
      ladder(ctx, -2, 15 + wip, 27, 11.5 + wip);
    } else {
      lijn(ctx, mx + 2.6, 18.4, 18.5, 14 - zet * 4, tint(K, -0.15), 2.2);
      hand(ctx, 18.6, 14 - zet * 4, HUID, 1.3);
    }
  };
  return pakket(teken, { sla: [['hoog', 0], ['slag', 0]] });
}

// ------------------------------------------------------------------ werkers
// Elk beroep heeft een eigen hoofddeksel, gereedschap en lading, zodat je ze
// op de kaart uit elkaar houdt. Teamkleur: muts of hoedband plus halsdoek.
const STEEL = '#5a4126';
const RIET = '#a47a45';
const STRO = '#d9bb6a';

// Gereedschap met de steel van (ax,ay) naar (bx,by); kop aan het einde.
function gereedschap(ctx, soort, ax, ay, bx, by) {
  lijn(ctx, ax, ay, bx, by, STEEL, 1.4);
  const l = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / l, uy = (by - ay) / l, nx = -uy, ny = ux;
  if (soort === 'bijl') {
    vlak(ctx, [[bx - ux * 3.2, by - uy * 3.2], [bx + ux * 0.8, by + uy * 0.8], [bx + ux * 1.2 + nx * 4.2, by + uy * 1.2 + ny * 4.2], [bx - ux * 4 + nx * 3.6, by - uy * 4 + ny * 3.6]], '#dfe3e8');
    vlak(ctx, [[bx - ux * 3.2, by - uy * 3.2], [bx + ux * 0.8, by + uy * 0.8], [bx + nx * 1.4, by + ny * 1.4]], '#8f96a0');
  } else if (soort === 'houweel') {
    lijn(ctx, bx - nx * 4.8 - ux * 1.4, by - ny * 4.8 - uy * 1.4, bx + nx * 4.8 - ux * 1.4, by + ny * 4.8 - uy * 1.4, '#cfd4da', 1.7);
    lijn(ctx, bx - nx * 4.8 - ux * 1.4, by - ny * 4.8 - uy * 1.4, bx - nx * 5.6 - ux * 0.4, by - ny * 5.6 - uy * 0.4, '#8f96a0', 1.2);
  } else if (soort === 'zaag') {
    vlak(ctx, [[bx - nx * 0.4, by - ny * 0.4], [bx - nx * 0.4 + ux * 7.6, by - ny * 0.4 + uy * 7.6], [bx + nx * 2.4 + ux * 7.6, by + ny * 2.4 + uy * 7.6], [bx + nx * 2.4, by + ny * 2.4]], '#c9ced6');
    for (let i = 0; i < 6; i++) vlak(ctx, [[bx + nx * 2.4 + ux * (i + 1) * 1.2, by + ny * 2.4 + uy * (i + 1) * 1.2], [bx + nx * 3.2 + ux * (i + 0.5) * 1.2, by + ny * 3.2 + uy * (i + 0.5) * 1.2], [bx + nx * 2.4 + ux * i * 1.2, by + ny * 2.4 + uy * i * 1.2]], '#8f96a0');
  } else if (soort === 'sikkel') {
    ctx.strokeStyle = '#cfd4da'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + ux * 4.4 + nx * 0.8, by + uy * 4.4 + ny * 0.8, bx + ux * 4 + nx * 4.6, by + uy * 4 + ny * 4.6); ctx.stroke(); ctx.lineCap = 'butt';
  }
}

// Hoofddeksel per beroep, hoofd op (x, y).
function hoofddeksel(ctx, beroep, K, x, y) {
  if (beroep === 'tarweboer' || beroep === 'fruitteler' || beroep === 'boer') {
    ovaal(ctx, x, y - 2.2, 3.6, 2.2, STRO);
    ovaal(ctx, x, y - 1.6, 6.6, 1.5, tint(STRO, -0.08));
    ovaal(ctx, x + 2.6, y - 2, 3, 0.6, 'rgba(255,255,255,0.22)');
    blok(ctx, x - 3.6, y - 2.4, 7.2, 1.1, K);
  } else if (beroep === 'bakker') {
    blok(ctx, x - 3, y - 2.6, 6, 2, '#f4efe2');
    ovaal(ctx, x, y - 5.2, 3.8, 3.4, '#f4efe2');
    ovaal(ctx, x + 1.4, y - 6, 1.4, 1.1, 'rgba(255,255,255,0.6)');
    blok(ctx, x - 3, y - 3, 6, 0.9, K);
  } else if (beroep === 'mijnwerker') {
    ovaal(ctx, x, y - 1.8, 4.1, 3, K);
    blok(ctx, x - 4.4, y - 1.6, 8.8, 1.4, tint(K, -0.2));
    ovaal(ctx, x + 1.4, y - 3, 1.5, 0.8, 'rgba(255,255,255,0.35)');
    ovaal(ctx, x + 3.2, y - 1.8, 1.1, 1.1, '#ffd25a'); ovaal(ctx, x + 3.2, y - 1.8, 2.3, 2.3, 'rgba(255,210,90,0.25)');
  } else if (beroep === 'zager') {
    ovaal(ctx, x, y - 1.8, 3.9, 2.6, K);
    blok(ctx, x - 3.9, y - 1.6, 7.8, 1.2, tint(K, -0.18));
    ovaal(ctx, x + 2, y - 2.8, 1.4, 0.7, tint(K, 0.3));
  } else if (beroep === 'steenhouwer') {
    ovaal(ctx, x, y - 1.6, 3.9, 2.8, K);
    blok(ctx, x - 3.9, y - 1.4, 7.8, 1.5, tint(K, -0.22));
    vlak(ctx, [[x - 3.9, y - 0.4], [x - 5.6, y + 1.8], [x - 3.2, y + 0.9]], tint(K, -0.2));
  } else {
    // houthakker: wollen muts met omslag
    ovaal(ctx, x - 0.2, y - 2.4, 3.8, 3, K);
    blok(ctx, x - 4, y - 1.8, 8, 1.7, tint(K, -0.2));
    ovaal(ctx, x + 1.6, y - 3.4, 1.4, 0.8, tint(K, 0.3));
    ovaal(ctx, x - 0.2, y - 5.2, 1, 1, tint(K, 0.2));
  }
}

function werkerFiguur(def) {
  const K = def.kleur;
  const kiel = def.kiel || '#b39a6b';
  const naam = (def.sleutel || '');
  const beroep = def.beroep;
  const gereedsoort = { hout: 'bijl', planken: 'zaag', tarwe: 'sikkel', steen: 'houweel', koper: 'houweel' }[def.vracht] || null;
  const mand = def.gereedschap === 'mand';
  const geen = def.gereedschap === 'geen';
  const teken = (ctx, houding, beeld) => {
    const werkt = houding === 'hak';
    const wip = !werkt && beeld % 2 ? -1 : 0;
    const pas = werkt ? 0 : LOOP[beeld];
    const neer = werkt && beeld >= 2;
    const mx = 13;
    // gereedschap achter het lijf langs bij het lopen
    if (houding === 'lopen' && gereedsoort) gereedschap(ctx, gereedsoort, mx + 2.5, 23 + wip, mx - 6.8, 9.5 + wip);
    if (houding === 'lopen' && beroep === 'boer') { lijn(ctx, mx + 6, 33, mx + 6, 8 + wip, STEEL, 1.3); for (const dx of [-1.6, 0, 1.6]) lijn(ctx, mx + 6 + dx, 8 + wip, mx + 6 + dx, 4.6 + wip, '#cfd4da', 0.6); lijn(ctx, mx + 4.4, 8 + wip, mx + 7.6, 8 + wip, '#cfd4da', 0.6); }
    const broek = beroep === 'bakker' ? '#cfc8b4' : beroep === 'mijnwerker' ? '#3c342c' : '#5b4a34';
    benen(ctx, mx, wip, pas, { top: 27, b: 2.9, sp: 2, been: [broek, tint(broek, -0.15)], laars: '#33261a', laarsH: 2.6 });
    // tuniek met riem en mouw
    romp(ctx, mx, wip, 8.8, 17, 10.4, kiel);
    if (beroep === 'steenhouwer' || beroep === 'zager' || beroep === 'bakker') blok(ctx, mx - 3, 19.4 + wip, 6, 8.6, beroep === 'bakker' ? 'rgba(250,247,238,0.92)' : 'rgba(70,48,24,0.6)');
    if (beroep === 'houthakker') for (const dx of [-2.4, 2.4]) blok(ctx, mx + dx - 0.4, 17 + wip, 0.9, 7, '#6a4a2a');
    // halsdoek in teamkleur
    vlak(ctx, [[mx - 3.4, 16.6 + wip], [mx + 3.4, 16.6 + wip], [mx + 1.8, 19.4 + wip], [mx - 1.8, 19.4 + wip]], K);
    // hoofd en deksel
    gezichtje(ctx, mx + 0.6, 12 + wip, { rx: 2.8, ry: 3.1, baard: beroep === 'houthakker' || beroep === 'mijnwerker' ? '#6a4a2c' : null });
    hoofddeksel(ctx, beroep, K, mx + 0.4, 10.4 + wip);
    // armen en lading
    const arm = (x1, y1, x2, y2) => { lijn(ctx, x1, y1, x2, y2, kiel, 2.3); hand(ctx, x2, y2, HUID, 1.3); };
    const last = houding === 'last';
    if (mand && last) {
      vlak(ctx, [[mx - 0.2, 18.4 + wip], [mx + 8, 18.4 + wip], [mx + 7, 23.6 + wip], [mx + 0.8, 23.6 + wip]], RIET);
      blok(ctx, mx - 0.5, 18.1 + wip, 8.8, 1.1, tint(RIET, -0.22));
      for (const [ax, ay] of [[1.6, 17.3], [3.8, 16.4], [6, 17.2], [4.9, 18], [2.8, 18.1]]) ovaal(ctx, mx + ax, ay + wip, 1.3, 1.3, '#c8402f');
      arm(mx + 3, 19 + wip, mx + 7, 22 + wip);
    } else if (mand && werkt) {
      vlak(ctx, [[mx + 5.4, 29.8], [mx + 12, 29.8], [mx + 11.2, 34], [mx + 6.2, 34]], RIET);
      blok(ctx, mx + 5.2, 29.5, 7, 1, tint(RIET, -0.22));
      ovaal(ctx, mx + 7.4, 29.2, 1.2, 1.1, '#c8402f'); ovaal(ctx, mx + 9.8, 29.1, 1.2, 1.1, '#c8402f');
      if (!neer) { arm(mx + 3, 18, mx + 4.6, 10.4); ovaal(ctx, mx + 5.8, 8.8, 1.4, 1.4, '#c8402f'); }
      else { arm(mx + 3, 19, mx + 5, 25.2); ovaal(ctx, mx + 6.2, 26.4, 1.3, 1.3, '#c8402f'); }
    } else if (mand) {
      arm(mx + 3, 18.4 + wip, mx + 3.6, 23 + wip);
      vlak(ctx, [[mx + 1.4, 24.2 + wip], [mx + 7.4, 24.2 + wip], [mx + 6.6, 28.2 + wip], [mx + 2.2, 28.2 + wip]], RIET);
      blok(ctx, mx + 1.2, 23.9 + wip, 6.4, 0.9, tint(RIET, -0.22));
    } else if (last && def.vracht === 'steen') {
      vlak(ctx, [[mx - 0.5, 17.4 + wip], [mx + 8, 17.4 + wip], [mx + 9.4, 15.8 + wip], [mx + 0.9, 15.8 + wip]], '#d6d3ca');
      lichtBlok(ctx, mx - 0.5, 17.4 + wip, 8.5, 5.6, '#a8a59c', 0.2);
      vlak(ctx, [[mx + 8, 17.4 + wip], [mx + 9.4, 15.8 + wip], [mx + 9.4, 21.4 + wip], [mx + 8, 23 + wip]], '#8b887f');
      arm(mx + 3, 19.6 + wip, mx + 7, 21.4 + wip);
    } else if (last && def.vracht === 'koper') {
      vlak(ctx, [[mx - 3.6, 12.5 + wip], [mx + 5, 12.5 + wip], [mx + 4, 19.5 + wip], [mx - 2.6, 19.5 + wip]], '#8a6a3c');
      for (let j = 0; j < 3; j++) lijn(ctx, mx - 2.6 + j * 0.3, 14.5 + j * 1.8 + wip, mx + 4.6 - j * 0.3, 14.5 + j * 1.8 + wip, 'rgba(60,40,20,0.45)', 0.5);
      for (const [dx, dy, kl] of [[-1, 12, '#d07a3a'], [1.6, 11.4, '#e09050'], [3.6, 12.2, '#c26a2e'], [0.4, 10.6, '#4fa88a']]) ovaal(ctx, mx + dx, dy + wip, 1.5, 1.2, kl);
      arm(mx + 3, 19 + wip, mx + 5, 21 + wip);
    } else if (last && def.vracht === 'tarwe') {
      vlak(ctx, [[mx - 1, 14 + wip], [mx + 8, 13 + wip], [mx + 9, 22 + wip], [mx + 1, 23 + wip]], '#d9b44a');
      for (let j = 0; j < 4; j++) lijn(ctx, mx + 0.5 + j * 2, 13.5 + wip, mx + 1 + j * 2, 22.5 + wip, 'rgba(120,90,30,0.45)', 0.5);
      blok(ctx, mx, 18 + wip, 8.5, 1.2, '#8a6a2a');
      arm(mx + 3, 18 + wip, mx + 4, 21 + wip);
    } else if (last && def.vracht === 'brood') {
      blok(ctx, mx - 1, 18.8 + wip, 10, 1.4, '#9c7446');
      for (const bx of [0.8, 3.8, 6.8]) { ovaal(ctx, mx + bx, 17.6 + wip, 1.7, 1.3, '#b9773a'); ovaal(ctx, mx + bx + 0.5, 17.2 + wip, 0.7, 0.4, '#d9a05a'); }
      arm(mx + 3, 19.8 + wip, mx + 7, 20.8 + wip);
    } else if (last && def.vracht === 'planken') {
      for (const [hoog, kleur] of [[0, '#c9a36a'], [1.6, '#dbb97f'], [3.2, '#c9a36a']]) { blok(ctx, mx - 9, 15.4 - hoog + wip, 17, 1.5, kleur); blok(ctx, mx - 9, 16.5 - hoog + wip, 17, 0.4, 'rgba(0,0,0,0.25)'); }
      arm(mx + 3, 18 + wip, mx + 4, 16.6 + wip);
    } else if (last) {
      for (const [hoog, kleur] of [[0, '#7a5632'], [2.7, '#8e6a42']]) { blok(ctx, mx - 8.5, 14.6 - hoog + wip, 15.5, 2.7, kleur); blok(ctx, mx - 8.5, 16.5 - hoog + wip, 15.5, 0.8, 'rgba(0,0,0,0.25)'); ovaal(ctx, mx + 7, 15.9 - hoog + wip, 1.2, 1.4, '#d9bb88'); ovaal(ctx, mx + 7, 15.9 - hoog + wip, 0.6, 0.7, '#a07a48'); }
      arm(mx + 3, 18 + wip, mx + 4, 16.6 + wip);
    } else if (werkt && gereedsoort && !neer) {
      gereedschap(ctx, gereedsoort, mx + 4.2, 20, mx + 8.6, 6.5);
      arm(mx + 3, 18.4, mx + 4.4, 15);
    } else if (werkt && gereedsoort) {
      gereedschap(ctx, gereedsoort, mx + 4, 20.6, mx + 11.6, 22.8);
      arm(mx + 3, 18.6, mx + 7, 20.8);
    } else {
      arm(mx + 3, 18.4 + wip, mx + 3.6, 23.2 + wip);
      if (geen && houding === 'lopen' && beroep === 'bakker') { ovaal(ctx, mx + 5.6, 23.4 + wip, 1.6, 1.2, '#b9773a'); }
    }
  };
  return teken;
}

const BEROEP = { houthakker: 'houthakker', steenhouwer: 'steenhouwer', fruitteler: 'fruitteler', zager: 'zager', tarweboer: 'tarweboer', bakker: 'bakker', mijnwerker: 'mijnwerker', boer: 'boer' };
function werker(def, sleutel) {
  const beroep = BEROEP[(sleutel || '').replace('eenheid.', '').replace(/_(blauw|rood)$/, '')] || 'houthakker';
  const teken = werkerFiguur({ ...def, beroep });
  return pakket(teken, { last: VIER('last'), hak: VIER('hak') });
}

// ------------------------------------------------------------------ export
export const SOLDATEN = {
  ridder, bijlridder, boogschutter, kruisboogschutter, sluipmoordenaar, vlammenwever, ladderdrager,
};

export const heeftSoldaat = (vorm) => vorm === 'werker' || Object.prototype.hasOwnProperty.call(SOLDATEN, vorm);
export function teken(vorm, def, sleutel) { return vorm === 'werker' ? werker(def, sleutel) : SOLDATEN[vorm](def); }
