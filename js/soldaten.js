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

// ------------------------------------------------------------- berserker
// Onbloot bovenlijf, rode baard, een band in teamkleur om het hoofd en twee
// strijdhamers. Rent en springt; weinig harnas.
function berserker(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const hoog = houding === 'hoog';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.8 : LOOP[beeld] * 1.2;
    const mx = 13;
    // strijdhamer: korte steel met een zwaar stalen blok
    const hamer = (x1, y1, x2, y2) => {
      lijn(ctx, x1, y1, x2, y2, HOUT, 1.5);
      const l = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / l, uy = (y2 - y1) / l, nx = -uy, ny = ux;
      vlak(ctx, [[x2 + nx * 3 + ux * 1.6, y2 + ny * 3 + uy * 1.6], [x2 - nx * 3 + ux * 1.6, y2 - ny * 3 + uy * 1.6], [x2 - nx * 3 - ux * 2.4, y2 - ny * 3 - uy * 2.4], [x2 + nx * 3 - ux * 2.4, y2 + ny * 3 - uy * 2.4]], '#9aa0a8');
      vlak(ctx, [[x2 + nx * 3 + ux * 1.6, y2 + ny * 3 + uy * 1.6], [x2 + nx * 3 - ux * 2.4, y2 + ny * 3 - uy * 2.4], [x2 + nx * 1.4 - ux * 2.4, y2 + ny * 1.4 - uy * 2.4], [x2 + nx * 1.4 + ux * 1.6, y2 + ny * 1.4 + uy * 1.6]], '#dfe3e8');
    };
    // lage hamers langs het lijf als hij loopt
    if (!vecht) { hamer(mx - 6.6, 25 + wip, mx - 9.4, 12 + wip); hamer(mx + 6.6, 25 + wip, mx + 9.6, 12 + wip); }
    benen(ctx, mx, wip, pas, { top: 27, b: 3.6, sp: 2.7, been: ['#5a4630', '#473623'], laars: '#2a2018', laarsH: 3.2 });
    // bovenlijf: bloot, met spieren en een leren riem met lendendoek in teamkleur
    lichtBlok(ctx, mx - 5.6, 16.5 + wip, 11.2, 11, HUID, 0.3);
    ovaal(ctx, mx - 2.2, 20 + wip, 2.4, 2.1, 'rgba(150,80,50,0.28)');
    ovaal(ctx, mx + 2.4, 20 + wip, 2.4, 2.1, 'rgba(150,80,50,0.28)');
    lijn(ctx, mx, 18.4 + wip, mx, 25 + wip, 'rgba(120,60,40,0.35)', 0.5);
    for (let i = 0; i < 3; i++) blok(ctx, mx - 2.2, 22.2 + i * 1.6 + wip, 4.4, 0.4, 'rgba(120,60,40,0.3)');
    blok(ctx, mx - 5.8, 25.4 + wip, 11.6, 1.8, LEER);
    vlak(ctx, [[mx - 5.4, 27 + wip], [mx + 5.4, 27 + wip], [mx + 4, 31 + wip], [mx - 4, 31 + wip]], K);
    ovaal(ctx, mx + 0.4, 26.3 + wip, 1.1, 0.8, '#c9a64a');
    // schouders en armen blijven bloot
    ovaal(ctx, mx - 5.8, 18 + wip, 2.4, 2.2, tint(HUID, -0.1));
    ovaal(ctx, mx + 5.8, 18 + wip, 2.4, 2.2, tint(HUID, 0.05));
    // hoofd: wilde baard, lang haar en een band in teamkleur
    ovaal(ctx, mx - 0.4, 9.4 + wip, 5.2, 4.4, '#8a4a22');
    gezichtje(ctx, mx + 0.4, 12 + wip, { baard: '#9a5426', haar: '#5a2c12' });
    ovaal(ctx, mx + 0.2, 8.4 + wip, 4.2, 2.4, '#8a4a22');
    blok(ctx, mx - 3.6, 8.6 + wip, 7.8, 1.5, K);
    blok(ctx, mx + 1.2, 8.6 + wip, 3, 1.5, tint(K, 0.2));
    if (vecht) {
      if (hoog) { hamer(mx - 2, 20, mx - 10, 3); hamer(mx + 3, 21, mx + 12, 4); hand(ctx, mx - 4, 19, HUID, 1.6); hand(ctx, mx + 5, 19, HUID, 1.6); }
      else { hamer(mx - 3, 18, mx - 8, 31); hamer(mx + 3, 17, mx + 13, 29); hand(ctx, mx - 4.4, 19, HUID, 1.6); hand(ctx, mx + 5.6, 19, HUID, 1.6); }
    } else {
      hand(ctx, mx - 6.6, 24 + wip, HUID, 1.6);
      hand(ctx, mx + 6.6, 24 + wip, HUID, 1.6);
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
  const gereedsoort = { hout: 'bijl', planken: 'zaag', tarwe: 'sikkel', hop: 'sikkel', steen: 'houweel', koper: 'houweel' }[def.vracht] || null;
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
    } else if (last && def.vracht === 'hop') {
      // een mand vol groene hopbellen op de heup (de hopboer)
      vlak(ctx, [[mx - 0.2, 18.4 + wip], [mx + 8, 18.4 + wip], [mx + 7, 23.6 + wip], [mx + 0.8, 23.6 + wip]], RIET);
      for (const [ax, ay] of [[1.6, 17.3], [3.8, 16.4], [6, 17.2], [4.9, 18], [2.8, 18.1]]) ovaal(ctx, mx + ax, ay + wip, 1.3, 1.6, '#b8d878');
      arm(mx + 3, 19 + wip, mx + 7, 22 + wip);
    } else if (last && def.vracht === 'vis') {
      // de visser met een net over de schouder en een vis in de hand
      vlak(ctx, [[mx - 4, 14 + wip], [mx + 2, 13 + wip], [mx + 4, 22 + wip], [mx - 3, 23 + wip]], 'rgba(150,130,90,0.75)');
      for (let j = 0; j < 4; j++) lijn(ctx, mx - 3.6 + j * 1.8, 13.6 + wip, mx - 2.6 + j * 1.8, 22.6 + wip, 'rgba(70,50,30,0.6)', 0.4);
      for (let j = 0; j < 4; j++) lijn(ctx, mx - 3.8, 15 + j * 2.2 + wip, mx + 3, 14.2 + j * 2.2 + wip, 'rgba(70,50,30,0.6)', 0.4);
      arm(mx + 3, 18.6 + wip, mx + 6, 21.4 + wip);
      ovaal(ctx, mx + 6.6, 24 + wip, 1.3, 3, '#a9bcc8');
      vlak(ctx, [[mx + 6.6, 26.6 + wip], [mx + 5.2, 28.4 + wip], [mx + 8, 28.4 + wip]], '#8fa4b2');
    } else if (last && def.vracht === 'kroes') {
      // de waard met een volle bierkroes in de hand en een witte schort
      blok(ctx, mx - 3, 19.4 + wip, 6, 8.6, 'rgba(250,247,238,0.92)');
      arm(mx + 3, 18.6 + wip, mx + 6, 19.6 + wip);
      blok(ctx, mx + 5.4, 15.8 + wip, 3, 4, '#c9a24a');
      ovaal(ctx, mx + 6.9, 15.8 + wip, 1.6, 0.8, '#f4efe0');
      lijn(ctx, mx + 8.4, 16.6 + wip, mx + 9.4, 18.4 + wip, '#a8842a', 0.7);
    } else if (last && def.vracht === 'brood') {
      blok(ctx, mx - 1, 18.8 + wip, 10, 1.4, '#9c7446');
      for (const bx of [0.8, 3.8, 6.8]) { ovaal(ctx, mx + bx, 17.6 + wip, 1.7, 1.3, '#b9773a'); ovaal(ctx, mx + bx + 0.5, 17.2 + wip, 0.7, 0.4, '#d9a05a'); }
      arm(mx + 3, 19.8 + wip, mx + 7, 20.8 + wip);
    } else if (last && def.vracht === 'planken') {
      for (const [hoog, kleur] of [[0, '#c9a36a'], [1.6, '#dbb97f'], [3.2, '#c9a36a']]) { blok(ctx, mx - 9, 15.4 - hoog + wip, 17, 1.5, kleur); blok(ctx, mx - 9, 16.5 - hoog + wip, 17, 0.4, 'rgba(0,0,0,0.25)'); }
      arm(mx + 3, 18 + wip, mx + 4, 16.6 + wip);
    } else if (last && def.vracht === 'hooi') {
      // een bos hooi tegen de borst (de paardenboer)
      ovaal(ctx, mx + 5.6, 18.6 + wip, 5.4, 3.6, '#d6b85a');
      ovaal(ctx, mx + 5.6, 17.4 + wip, 4.6, 1.7, '#ecd27e');
      for (let j = 0; j < 5; j++) lijn(ctx, mx + 2 + j * 1.8, 15.8 + wip, mx + 2.6 + j * 1.8, 21 + wip, 'rgba(150,110,30,0.55)', 0.5);
      lijn(ctx, mx + 2, 18.8 + wip, mx + 9.4, 18.8 + wip, '#8a6a2a', 0.7);
      arm(mx + 3, 18.6 + wip, mx + 5, 19.8 + wip);
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

const BEROEP = { houthakker: 'houthakker', steenhouwer: 'steenhouwer', fruitteler: 'fruitteler', zager: 'zager', tarweboer: 'tarweboer', bakker: 'bakker', mijnwerker: 'mijnwerker', boer: 'boer', paardenboer: 'boer', hopboer: 'tarweboer', waard: 'bakker', visser: 'fruitteler' };
function werker(def, sleutel) {
  const beroep = BEROEP[(sleutel || '').replace('eenheid.', '').replace(/_(blauw|rood)$/, '')] || 'houthakker';
  const teken = werkerFiguur({ ...def, beroep });
  return pakket(teken, { last: VIER('last'), hak: VIER('hak') });
}


// ---------------------------------------------------------- zwaardvechter
// Stevig, rond houten schild in teamkleur, kort zwaard, helm met lage kam.
function zwaardvechter(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const hoog = houding === 'hoog';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.8 : LOOP[beeld];
    const mx = 13;
    benen(ctx, mx, wip, pas, { top: 27, b: 3.4, sp: 2.3, been: ['#4a4a54', '#3a3a44'], laars: '#2b2b32', laarsH: 3 });
    blok(ctx, mx - 5, 26 + wip, 10, 2.4, '#8a909a');
    for (let i = 0; i < 6; i++) blok(ctx, mx - 4.8 + i * 1.65, 27.2 + wip, 0.7, 0.6, 'rgba(0,0,0,0.35)');
    // wapenrok: grijs met een teamkleurige band
    romp(ctx, mx, wip, 10.2, 17, 10, '#7d828c');
    blok(ctx, mx - 5.1, 20 + wip, 10.2, 2, K);
    ovaal(ctx, mx - 4.8, 18.2 + wip, 2.5, 2.3, tint(STAAL, -0.25));
    ovaal(ctx, mx + 4.8, 18.2 + wip, 2.6, 2.4, STAAL);
    // helm met lage kam
    ovaal(ctx, mx + 0.4, 12.4 + wip, 2.9, 3.1, HUID);
    ovaal(ctx, mx, 10.4 + wip, 4.7, 4.1, STAAL);
    blok(ctx, mx - 4.7, 10.4 + wip, 9.4, 2.4, STAAL);
    blok(ctx, mx - 4.7, 10.4 + wip, 3, 2.4, 'rgba(0,0,0,0.22)');
    blok(ctx, mx - 1.2, 11.4 + wip, 4, 1, '#23232a');
    vlak(ctx, [[mx - 3.6, 7 + wip], [mx + 3.4, 7 + wip], [mx + 2.8, 5.4 + wip], [mx - 3, 5.4 + wip]], tint(K, -0.1));
    ovaal(ctx, mx + 1.8, 8.4 + wip, 1.3, 0.9, 'rgba(255,255,255,0.5)');
    // rond schild met rand en knop
    const sx = mx - 5.6, sy = 22.5 + wip;
    ovaal(ctx, sx, sy, 5, 5.4, '#7a5530');
    ovaal(ctx, sx, sy, 4.1, 4.5, K);
    ovaal(ctx, sx + 1.2, sy - 1.2, 2.2, 2.4, tint(K, 0.2));
    ovaal(ctx, sx, sy, 1.2, 1.3, '#d8c27a');
    // zwaard
    if (!vecht) {
      lijn(ctx, mx + 6, 23 + wip, mx + 7.4, 31 + wip, '#e2e6ec', 1.3);
      blok(ctx, mx + 4.6, 22.2 + wip, 3, 0.9, '#c9a24a');
      hand(ctx, mx + 5.8, 22.4 + wip, STAAL, 1.5);
    } else if (hoog) {
      lijn(ctx, mx + 5, 17, mx + 9.5, 7.5, '#e2e6ec', 1.4);
      blok(ctx, mx + 3.6, 16.8, 3, 0.9, '#c9a24a');
      hand(ctx, mx + 5, 17.4, STAAL, 1.5);
    } else {
      lijn(ctx, mx + 6, 21, mx + 16, 23.5, '#e2e6ec', 1.4);
      blok(ctx, mx + 5.4, 19.8, 0.9, 3, '#c9a24a');
      hand(ctx, mx + 5.6, 21, STAAL, 1.5);
    }
  };
  return pakket(teken, { sla: [['hoog', 0], ['slag', 0]] });
}

// ----------------------------------------------------------- banierdrager
// De langste klassieke figuur: tabbaard, lange stok met een groot vaandel in
// teamkleur dat wappert.
function banierdrager(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const wip = houding === 'lopen' && beeld % 2 ? -1 : 0;
    const pas = houding === 'lopen' ? LOOP[beeld] : 0;
    const golf = [0, 1, 0, -1][beeld % 4];
    const mx = 12.5;
    // stok en vaandel achter de figuur
    lijn(ctx, mx + 6.5, 32, mx + 6.5, -3 + wip, HOUT, 1.3);
    ovaal(ctx, mx + 6.5, -3.4 + wip, 1, 1, '#d8b24a');
    const v = [[mx + 7, -1.5 + wip], [mx + 17, 0.5 + wip + golf], [mx + 16, 6 + wip], [mx + 18, 11.5 + wip - golf], [mx + 7, 10 + wip]];
    vlak(ctx, v, K);
    vlak(ctx, [[mx + 7, 4 + wip], [mx + 16.5, 5.2 + wip], [mx + 16, 6 + wip], [mx + 7, 5.6 + wip]], tint(K, -0.25));
    vlak(ctx, [[mx + 7, -1.5 + wip], [mx + 17, 0.5 + wip + golf], [mx + 16.6, 2 + wip + golf], [mx + 7, 0.2 + wip]], tint(K, 0.25));
    ovaal(ctx, mx + 11.5, 4.6 + wip, 1.8, 1.8, '#efe6c8');
    benen(ctx, mx, wip, pas, { top: 27, b: 3, sp: 2.1, been: ['#5a4a38', '#4a3c2c'], laars: '#2b2218', laarsH: 3 });
    // lange tabbaard in teamkleur over een maliënhemd
    romp(ctx, mx, wip, 9.2, 16, 12, '#8a909a');
    vlak(ctx, [[mx - 3.6, 16.2 + wip], [mx + 3.6, 16.2 + wip], [mx + 4, 29 + wip], [mx - 4, 29 + wip]], K);
    blok(ctx, mx - 0.4, 16.2 + wip, 0.8, 12.8, '#efe6c8');
    blok(ctx, mx - 3, 21 + wip, 6, 0.8, '#efe6c8');
    ovaal(ctx, mx - 4.4, 17.4 + wip, 2.3, 2.1, tint(STAAL, -0.25));
    ovaal(ctx, mx + 4.4, 17.4 + wip, 2.4, 2.2, STAAL);
    // hoofd met kapje
    gezichtje(ctx, mx + 0.4, 11.4 + wip, { haar: '#5a3a20' });
    vlak(ctx, [[mx - 3.6, 10.6 + wip], [mx - 3.2, 7.4 + wip], [mx, 6.2 + wip], [mx + 3.2, 7.4 + wip], [mx + 3.6, 9.6 + wip], [mx - 1, 9.4 + wip]], '#6b6f78');
    // handen aan de stok
    hand(ctx, mx + 6.5, 17 + wip, HUID, 1.4);
    hand(ctx, mx + 6.5, 22 + wip, HUID, 1.4);
  };
  return pakket(teken, { sla: [['lopen', 0], ['lopen', 2]] });
}

// ------------------------------------------------------------------ heler
// Witte en crème pij met capuchon, een staf met een lantaarn, een gouden
// gloed rond de voeten. Mystiek: blauwe accenten; teamkleur in de sjerp.
function heler(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const wip = houding === 'lopen' && beeld % 2 ? -1 : 0;
    const pas = houding === 'lopen' ? LOOP[beeld] * 0.6 : 0;
    const mx = 12.5;
    const g = ctx.createRadialGradient(mx, 33, 0.5, mx, 33, 9);
    g.addColorStop(0, 'rgba(255,220,120,0.45)');
    g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(mx, 33, 9, 3.4, 0, 0, Math.PI * 2); ctx.fill();
    // staf met lantaarn
    lijn(ctx, mx + 6.8, 32, mx + 6.8, 7 + wip, HOUT, 1.2);
    lijn(ctx, mx + 6.8, 7 + wip, mx + 9, 8 + wip, HOUT, 0.9);
    blok(ctx, mx + 8.2, 8.4 + wip, 2.4, 3, '#3a2a1c');
    blok(ctx, mx + 8.6, 8.8 + wip, 1.6, 2.2, '#ffd56a');
    ovaal(ctx, mx + 9.4, 9.9 + wip, 3, 3, 'rgba(255,214,106,0.25)');
    // pij tot op de grond
    vlak(ctx, [[mx - 4.4, 16 + wip], [mx + 4.4, 16 + wip], [mx + 5.6 + pas * 0.3, 33], [mx - 5.6 - pas * 0.3, 33]], '#ebe4d2');
    vlak(ctx, [[mx - 4.4, 16 + wip], [mx - 1.6, 16 + wip], [mx - 2.4, 33], [mx - 5.6 - pas * 0.3, 33]], 'rgba(0,0,0,0.12)');
    vlak(ctx, [[mx + 2.6, 16 + wip], [mx + 4.4, 16 + wip], [mx + 5.6, 33], [mx + 3.8, 33]], 'rgba(255,255,255,0.35)');
    blok(ctx, mx - 0.5, 18 + wip, 1, 14, '#5b7bc4');
    // sjerp in teamkleur
    vlak(ctx, [[mx - 4.4, 22 + wip], [mx + 4.6, 22 + wip], [mx + 4.6, 23.6 + wip], [mx - 4.4, 23.6 + wip]], K);
    // capuchon met gezicht in de schaduw
    vlak(ctx, [[mx - 4.6, 17 + wip], [mx - 4.4, 9 + wip], [mx, 5.6 + wip], [mx + 4.4, 9 + wip], [mx + 4.6, 17 + wip]], '#ddd5c0');
    ovaal(ctx, mx + 0.4, 12 + wip, 2.8, 3.2, tint(HUID, -0.15));
    ovaal(ctx, mx - 0.7, 11.9 + wip, 0.5, 0.45, '#2a1b12');
    ovaal(ctx, mx + 1.5, 11.9 + wip, 0.5, 0.45, '#2a1b12');
    vlak(ctx, [[mx - 4.4, 9 + wip], [mx, 5.6 + wip], [mx - 1, 8 + wip], [mx - 3, 13 + wip]], 'rgba(0,0,0,0.12)');
    hand(ctx, mx + 6.8, 19 + wip, HUID, 1.4);
  };
  return pakket(teken, { sla: [['lopen', 0], ['lopen', 2]] });
}

// ------------------------------------------------------------------ steenwachter
// Een reus van levende steen: grove grijze blokken, mos op de schouders,
// blauw gloeiende ogen en runen op de borst. Teamkleur in doek en riem.
function steenwachter(def) {
  const K = def.kleur;
  const SK = '#8d9096', SL = '#a9acb2', SD = '#5f6268';
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const slag = houding === 'slag' ? 1 : 0;
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.6 : LOOP[beeld] * 0.8;
    const mx = 12.5 + slag;
    // zware benen
    blok(ctx, mx - 5.2 - pas * 0.4, 25 + wip, 4.6, 9, SD);
    blok(ctx, mx + 0.6 + pas * 0.4, 25 + wip, 4.6, 9, SK);
    blok(ctx, mx - 5.6 - pas * 0.4, 32.2, 5.4, 2, '#4a4c52');
    blok(ctx, mx + 0.4 + pas * 0.4, 32.2, 5.4, 2, '#4a4c52');
    // romp van blokken
    lichtBlok(ctx, mx - 6.6, 11 + wip, 13.2, 15, SK, 0.25);
    blok(ctx, mx - 6.6, 17 + wip, 13.2, 0.8, SD);
    blok(ctx, mx - 0.4, 11 + wip, 0.8, 6, SD);
    // doek en riem in teamkleur
    blok(ctx, mx - 6.6, 23.4 + wip, 13.2, 2.2, K);
    blok(ctx, mx - 1, 23.4 + wip, 2, 4.6, K);
    // runen op de borst
    lijn(ctx, mx - 2.6, 13.4 + wip, mx - 2.6, 16 + wip, '#7fc4ff', 0.6);
    lijn(ctx, mx - 3.6, 14.2 + wip, mx - 1.6, 14.2 + wip, '#7fc4ff', 0.6);
    lijn(ctx, mx + 2, 13.2 + wip, mx + 3.2, 16 + wip, '#7fc4ff', 0.6);
    // armen
    const arm = vecht ? (slag ? 4 : -1) : pas * 0.5;
    lichtBlok(ctx, mx - 10.4, 11.6 + wip, 4, 11, SD, 0.2);
    lichtBlok(ctx, mx + 6.4 + slag * 2, 11.6 + wip + arm, 4.4, 12, SL, 0.2);
    blok(ctx, mx - 10.8, 21.6 + wip, 4.8, 3.4, SK);
    blok(ctx, mx + 6.2 + slag * 2, 22.6 + wip + arm, 5, 3.6, SL);
    // schouders met mos
    ovaal(ctx, mx - 7, 11.4 + wip, 3.6, 2.6, SL);
    ovaal(ctx, mx + 7, 11.4 + wip, 3.6, 2.6, SL);
    ovaal(ctx, mx - 7.4, 10.2 + wip, 2.6, 1.2, '#5f8a3a');
    ovaal(ctx, mx + 6.6, 10.2 + wip, 2.8, 1.3, '#6f9a45');
    // hoofd
    lichtBlok(ctx, mx - 3.4, 4.6 + wip, 6.8, 6.4, SL, 0.25);
    blok(ctx, mx - 3.4, 4.6 + wip, 6.8, 1, SD);
    ovaal(ctx, mx - 1.3, 8 + wip, 0.9, 0.7, '#8fd6ff');
    ovaal(ctx, mx + 1.6, 8 + wip, 0.9, 0.7, '#8fd6ff');
    ovaal(ctx, mx - 1.3, 8 + wip, 1.8, 1.4, 'rgba(120,200,255,0.25)');
    ovaal(ctx, mx + 1.6, 8 + wip, 1.8, 1.4, 'rgba(120,200,255,0.25)');
  };
  return pakket(teken, { sla: [['hoog', 0], ['slag', 0]] });
}

// ------------------------------------------------------------------ ruiter
// Een ridder in staal op een bruin strijdpaard. Teamkleur in het dek van het paard,
// de tabbaard, de pluim en het schild. Groter dan een gewone ridder: het canvas laat
// ruimte voor het paard (tot x = 31 rechts en x = -1 links van het midden).
function ruiter(def, zonder = false) {
  const K = def.kleur;
  const VACHT = '#7a4e2c', VD = '#4e3018', MAAN = '#2a1a10', HOEF = '#1c130b';
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const slag = houding === 'slag';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht || zonder ? 0 : LOOP[beeld];
    const duik = zonder ? 4.2 : slag ? 1.2 : 0;   // een paard op het erf eet met zijn kop omlaag
    const mx = 12.5;
    // staart
    vlak(ctx, [[mx - 8.8, 21 + wip], [mx - 13.4, 23.6 + wip + pas * 0.4], [mx - 12.4, 30 + wip], [mx - 9.4, 25.4 + wip]], MAAN);
    // verre benen (donkerder), dan het lijf
    const been = (x0, x1, kleur) => { lijn(ctx, x0, 27 + wip, x1, 33.2, kleur, 2.1); ovaal(ctx, x1, 33.6, 1.5, 0.8, HOEF); };
    been(mx + 6.4, mx + 6.4 + pas * 2.2, VD);
    been(mx - 5.8, mx - 5.8 - pas * 2.2, VD);
    ovaal(ctx, mx + 1, 24.6 + wip, 10.6, 5.5, VACHT);
    ovaal(ctx, mx + 1.4, 22.2 + wip, 8.6, 2.2, tint(VACHT, 0.2));
    ovaal(ctx, mx + 1, 28 + wip, 8.6, 1.5, tint(VACHT, -0.22));
    // nabije benen
    been(mx + 9, mx + 9 - pas * 2.2, VACHT);
    been(mx - 3.6, mx - 3.6 + pas * 2.2, VACHT);
    // hals met manen, hoofd
    vlak(ctx, [[mx + 7.6, 20.6 + wip], [mx + 12.4, 11.6 + wip + duik], [mx + 15.8, 13.4 + wip + duik], [mx + 11.6, 24.4 + wip]], VACHT);
    vlak(ctx, [[mx + 7.4, 20 + wip], [mx + 12.2, 11 + wip + duik], [mx + 10.8, 11.2 + wip + duik], [mx + 6.4, 19.6 + wip]], MAAN);
    ovaal(ctx, mx + 16.4, 15.8 + wip + duik, 4.4, 2.3, VACHT);
    ovaal(ctx, mx + 19.8, 17.4 + wip + duik, 1.9, 1.6, tint(VACHT, 0.22));
    vlak(ctx, [[mx + 13.4, 13.6 + wip + duik], [mx + 13.9, 10.4 + wip + duik], [mx + 15.2, 13.2 + wip + duik]], VD);
    ovaal(ctx, mx + 17, 14.9 + wip + duik, 0.5, 0.5, '#150e08');
    lijn(ctx, mx + 13.2, 16.4 + wip + duik, mx + 17.6, 17.6 + wip + duik, K, 0.8);
    // dek (teamkleur) met witte rand, zadel
    vlak(ctx, [[mx - 5.8, 20.6 + wip], [mx + 5.8, 20.6 + wip], [mx + 5.2, 28.6 + wip], [mx - 5.4, 28.6 + wip]], K);
    blok(ctx, mx - 5.4, 27.8 + wip, 10.6, 0.9, '#f1ead6');
    ovaal(ctx, mx, 19.8 + wip, 4.4, 1.7, '#5a3a20');
    if (zonder) return;
    // ruiter: been, romp met tabbaard, schild, hoofd met helm en pluim
    lijn(ctx, mx - 0.6, 19 + wip, mx + 2.4, 26 + wip, STAAL, 2.3);
    ovaal(ctx, mx + 2.8, 26.6 + wip, 1.5, 0.9, '#5a4126');
    lichtBlok(ctx, mx - 3.6, 10.4 + wip, 7.2, 9.8, STAAL, 0.25);
    blok(ctx, mx - 3.6, 13.6 + wip, 7.2, 6.4, K);
    blok(ctx, mx - 0.4, 13.6 + wip, 0.9, 6.4, '#f1ead6');
    blok(ctx, mx - 3.6, 18.6 + wip, 7.2, 0.9, '#d8b24a');
    ovaal(ctx, mx + 4.6, 15.4 + wip, 2.7, 3.6, '#2a2a2a');
    ovaal(ctx, mx + 4.6, 15.4 + wip, 2.1, 3, K);
    blok(ctx, mx + 4.2, 13.2 + wip, 0.9, 4.4, '#f1ead6');
    ovaal(ctx, mx - 0.2, 7.6 + wip, 3.7, 3.7, STAAL);
    blok(ctx, mx - 0.4, 7.2 + wip, 4, 1, '#2a2a2a');
    vlak(ctx, [[mx - 1.2, 4.4 + wip], [mx - 5, 2.6 + wip], [mx - 6.6, 6.4 + wip], [mx - 2.6, 5.8 + wip]], K);
    // zwaardarm en zwaard
    let hx, hy, tx, ty;
    if (!vecht) { hx = mx + 5; hy = 12.6 + wip; tx = mx + 6.4; ty = 3 + wip; }
    else if (slag) { hx = mx + 8.6; hy = 14.6; tx = mx + 17.6; ty = 20.4; }
    else { hx = mx + 5.6; hy = 7; tx = mx + 7.6; ty = -0.5; }
    lijn(ctx, mx + 2.6, 12.6 + wip, hx, hy, STAAL, 2);
    lijn(ctx, hx, hy, tx, ty, '#dfe3e8', 1.5);
    lijn(ctx, hx - 1.6 * (ty - hy) / 12, hy + 1.6 * (tx - hx) / 12, hx + 1.6 * (ty - hy) / 12, hy - 1.6 * (tx - hx) / 12, '#d8b24a', 1.2);
    hand(ctx, hx, hy, HUID, 1.3);
  };
  return pakket(teken, { sla: [['hoog', 0], ['slag', 0]] });
}

// ------------------------------------------------------------------ windzanger
// Een zangeres van Zevenwind (level 7): lange grijsgroene mantel met windvlaag,
// kap in teamkleur, een gebogen hoorn aan de lippen; bij het blazen waait een krul uit de hoorn.
function windzanger(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const blaas = houding === 'los';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const zwier = vecht ? -1.2 : [0, 1, 0, -1][beeld];
    const mx = 13;
    // mantel die naar achteren waait
    vlak(ctx, [[mx - 4.6, 17.4 + wip], [mx + 4.6, 17.4 + wip], [mx + 6 + zwier, 33.6], [mx - 8 + zwier, 33.6], [mx - 9.5 + zwier, 30]], '#5f7466');
    vlak(ctx, [[mx - 4.6, 17.4 + wip], [mx - 1.4, 17.6 + wip], [mx - 3 + zwier, 33.6], [mx - 8 + zwier, 33.6], [mx - 9.5 + zwier, 30]], '#47584d');
    vlak(ctx, [[mx + 0.6, 17.6 + wip], [mx + 4.6, 17.4 + wip], [mx + 6 + zwier, 33.6], [mx + 2 + zwier, 33.6]], '#7e937f');
    // windvlaag op de mantel
    ctx.strokeStyle = '#d8e4dc'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(mx - 3, 27 + wip); ctx.quadraticCurveTo(mx + 1, 24.5 + wip, mx + 3.6, 27.2 + wip); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(mx - 2, 29.6 + wip); ctx.quadraticCurveTo(mx + 1.4, 27.6 + wip, mx + 4.4, 30 + wip); ctx.stroke();
    // riem en sjerp in teamkleur
    vlak(ctx, [[mx - 4.6, 18 + wip], [mx - 2.4, 17.4 + wip], [mx + 4.6, 24.6 + wip], [mx + 2.6, 26 + wip]], K);
    blok(ctx, mx - 4.6, 23.6 + wip, 9.2, 1.1, '#3a2a1a');
    // gezicht, lange grijze vlecht, kap in teamkleur
    gezichtje(ctx, mx + 0.6, 12.6 + wip, { haar: '#9a9a90', rx: 2.8, ry: 3.1 });
    lijn(ctx, mx - 3, 13 + wip, mx - 5 + zwier * 0.5, 22 + wip, '#a8a89e', 1.6);
    vlak(ctx, [[mx - 4.2, 13 + wip], [mx + 4.4, 11 + wip], [mx + 3.6, 7 + wip], [mx + 0.4, 6.2 + wip], [mx - 3.6, 7.6 + wip]], K);
    vlak(ctx, [[mx + 0.8, 6.4 + wip], [mx + 3.6, 7 + wip], [mx + 4.4, 11 + wip], [mx + 2.4, 10.6 + wip]], tint(K, 0.22));
    vlak(ctx, [[mx - 4.2, 13 + wip], [mx - 3.6, 7.6 + wip], [mx - 2.2, 11.6 + wip]], tint(K, -0.3));
    if (!vecht) {
      lijn(ctx, mx - 3, 19 + wip, mx - 5.6, 24 + wip, '#47584d', 2.3);
      hand(ctx, mx - 5.8, 24.4 + wip, HUID, 1.3);
      // hoorn aan de riem
      vlak(ctx, [[mx + 3, 22 + wip], [mx + 7, 24 + wip], [mx + 8.4, 21.6 + wip], [mx + 7.4, 25.8 + wip], [mx + 3, 23.4 + wip]], '#d9c9a0');
      lijn(ctx, mx + 3, 19 + wip, mx + 4.6, 24 + wip, '#5f7466', 2.3);
    } else {
      // de hoorn aan de mond, met twee handen
      lijn(ctx, mx - 2.6, 19, mx + 3, 15, '#47584d', 2.3);
      lijn(ctx, mx + 3, 19, mx + 6, 16, '#5f7466', 2.3);
      vlak(ctx, [[mx + 3.2, 13.4], [mx + 9, 12], [mx + 11.6, 9], [mx + 12.4, 13.6], [mx + 9.4, 14.6], [mx + 3.4, 14.8]], '#e2d3aa');
      ovaal(ctx, mx + 12, 11.3, 1.1, 2.3, '#9a8456');
      hand(ctx, mx + 3.4, 14.8, HUID, 1.2); hand(ctx, mx + 6.6, 15.6, HUID, 1.2);
      if (blaas) {
        ctx.strokeStyle = 'rgba(245,252,255,0.95)'; ctx.lineWidth = 1;
        for (const [r, dx] of [[2, 15], [3, 19], [3.8, 23.5]]) { ctx.beginPath(); ctx.arc(mx + dx, 11.2, r, -1.2, 1.6); ctx.stroke(); }
      }
    }
  };
  return pakket(teken, { schiet: [['aan', 0], ['los', 0]] });
}

// ------------------------------------------------------------------ saboteur
// Een man van het Stille Volk (level 8): donkere kap en mantel met een band in teamkleur,
// een kruitvaatje op de rug en een smeulende lont in de hand. Hij sluipt en blaast bouwwerken op.
function saboteur(def) {
  const K = def.kleur;
  const MANTEL = '#3b3a34';
  const MANTEL2 = '#2a2925';
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const slag = houding === 'slag';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.4 : LOOP[beeld];
    const mx = 13;
    // benen
    lijn(ctx, mx - 1.6, 26 + wip, mx - 1.6 - pas, 33.6, '#2c2a26', 2.4);
    lijn(ctx, mx + 1.6, 26 + wip, mx + 1.6 + pas, 33.6, '#2c2a26', 2.4);
    // vaatje op de rug
    ovaal(ctx, mx - 5.4, 19 + wip, 3.6, 4.6, '#7a5634');
    lijn(ctx, mx - 8.6, 17 + wip, mx - 2.2, 17 + wip, '#3a3a3a', 0.8);
    lijn(ctx, mx - 8.8, 21 + wip, mx - 2, 21 + wip, '#3a3a3a', 0.8);
    // gebogen romp in mantel
    vlak(ctx, [[mx - 4, 15.6 + wip], [mx + 4.4, 16 + wip], [mx + 5, 27 + wip], [mx - 4.4, 27 + wip]], MANTEL);
    vlak(ctx, [[mx - 4, 15.6 + wip], [mx - 0.6, 15.8 + wip], [mx - 1, 27 + wip], [mx - 4.4, 27 + wip]], MANTEL2);
    vlak(ctx, [[mx - 4, 17 + wip], [mx - 2, 16.4 + wip], [mx + 4.6, 22.6 + wip], [mx + 3, 24 + wip]], K);
    blok(ctx, mx - 4.4, 23.4 + wip, 9.4, 1.1, '#1e1a14');
    // kap met gezicht in de schaduw
    gezichtje(ctx, mx + 1, 11.6 + wip, { rx: 2.6, ry: 2.9 });
    vlak(ctx, [[mx - 3.8, 13.4 + wip], [mx - 3.2, 7.6 + wip], [mx + 1, 6.2 + wip], [mx + 4.4, 8.4 + wip], [mx + 4.6, 10 + wip], [mx + 1.6, 9.4 + wip], [mx - 1, 14 + wip]], MANTEL2);
    lijn(ctx, mx - 1, 10.6 + wip, mx + 3.6, 10.6 + wip, 'rgba(0,0,0,0.35)', 1.2);
    // armen en lont
    const lont = (x, y) => {
      lijn(ctx, x, y, x + 2.6, y - 2.8, '#6b4a2a', 0.9);
      ovaal(ctx, x + 2.8, y - 3, 1.3, 1.3, 'rgba(255,170,60,0.9)');
      ovaal(ctx, x + 2.8, y - 3, 0.6, 0.6, '#fff0b0');
    };
    if (!vecht) {
      lijn(ctx, mx + 3, 18 + wip, mx + 5.6, 23 + wip, MANTEL, 2.2); hand(ctx, mx + 5.8, 23.4 + wip, HUID, 1.2); lont(mx + 5.8, 23.4 + wip);
    } else if (!slag) {
      lijn(ctx, mx + 3, 18, mx + 7.6, 16, MANTEL, 2.2); hand(ctx, mx + 7.8, 16, HUID, 1.2); lont(mx + 7.8, 16);
    } else {
      // gooit het lont naar voren; een vonkenregen
      lijn(ctx, mx + 3, 18, mx + 9, 20, MANTEL, 2.2); hand(ctx, mx + 9.2, 20.2, HUID, 1.2);
      for (const [dx, dy] of [[12, 18], [14, 21], [11, 23], [15, 17]]) ovaal(ctx, mx + dx, dy, 0.8, 0.8, '#ffc04a');
    }
    lijn(ctx, mx - 3, 18 + wip, mx - 5, 23 + wip, MANTEL2, 2.2);
  };
  return pakket(teken, { sla: [['hoog', 0], ['slag', 0]] });
}

// ------------------------------------------------------------------ ziener
// Een ziener van het Stille Volk (level 9): lange witgrijze pij, kap in teamkleur met een
// geschilderd oog, een staf met een lantaarn waarin een blauw licht brandt.
function ziener(def) {
  const K = def.kleur;
  const PIJ = '#c9c4b4';
  const PIJ2 = '#a39e8e';
  const teken = (ctx, houding, beeld) => {
    const wip = houding === 'lopen' && beeld % 2 ? -1 : 0;
    const zwier = houding === 'lopen' ? [0, 1, 0, -1][beeld] : 0;
    const mx = 13;
    // staf met lantaarn
    lijn(ctx, mx + 6.4, 33.4, mx + 6.4, 8 + wip, '#5a4126', 1.3);
    lijn(ctx, mx + 6.4, 8 + wip, mx + 9, 7 + wip, '#5a4126', 1.1);
    const g = ctx.createRadialGradient(mx + 9, 10.6 + wip, 0.3, mx + 9, 10.6 + wip, 5);
    g.addColorStop(0, 'rgba(200,235,255,0.95)'); g.addColorStop(0.4, 'rgba(120,190,255,0.5)'); g.addColorStop(1, 'rgba(120,190,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(mx + 9, 10.6 + wip, 5, 0, Math.PI * 2); ctx.fill();
    blok(ctx, mx + 7.6, 8.4 + wip, 2.8, 4.2, 'rgba(60,50,40,0.9)');
    blok(ctx, mx + 8.1, 9 + wip, 1.8, 3, '#bfe4ff');
    // pij
    vlak(ctx, [[mx - 4.6, 16.6 + wip], [mx + 4.6, 16.6 + wip], [mx + 6 + zwier, 33.6], [mx - 6 + zwier, 33.6]], PIJ);
    vlak(ctx, [[mx - 4.6, 16.6 + wip], [mx - 1.2, 16.8 + wip], [mx - 2.4 + zwier, 33.6], [mx - 6 + zwier, 33.6]], PIJ2);
    blok(ctx, mx - 4.4, 23.4 + wip, 8.8, 1.1, K);
    // kap in teamkleur met oog
    gezichtje(ctx, mx + 0.6, 12.6 + wip, { rx: 2.7, ry: 3, baard: '#dcd8cc', haar: '#cfcabd' });
    lijn(ctx, mx - 2.2, 12.2 + wip, mx + 3.4, 12.2 + wip, '#2a2a2a', 1.2);   // blinddoek
    vlak(ctx, [[mx - 4.4, 14.6 + wip], [mx - 4, 8.2 + wip], [mx + 0.6, 5.8 + wip], [mx + 4.6, 8 + wip], [mx + 4.8, 11 + wip], [mx + 2.6, 9.6 + wip], [mx - 1.6, 10 + wip], [mx - 2.4, 15 + wip]], K);
    ovaal(ctx, mx + 0.4, 7.8 + wip, 1.4, 0.8, '#f2e7b8');
    ovaal(ctx, mx + 0.4, 7.8 + wip, 0.5, 0.5, '#2a2a2a');
    // armen
    lijn(ctx, mx + 3, 18 + wip, mx + 6.2, 20 + wip, PIJ2, 2.2); hand(ctx, mx + 6.4, 20 + wip, HUID, 1.2);
    lijn(ctx, mx - 3, 18 + wip, mx - 4.6, 23 + wip, PIJ2, 2.2); hand(ctx, mx - 4.6, 23.4 + wip, HUID, 1.2);
  };
  return pakket(teken, { sla: [['lopen', 0], ['lopen', 0]] });
}

// ---------------------------------------------------------- ingenieur
// Bouwmeester van de belegering: leren schort, werkmanshoed in teamkleur, grote houten hamer.
// Lopen = hamer op de schouder, sla = hamer omhoog en dan neer.
function ingenieur(def) {
  const K = def.kleur;
  const ARM = '#a8906a';
  const teken = (ctx, houding, beeld) => {
    const slaat = houding === 'hoog' || houding === 'slag';
    const wip = houding === 'lopen' && beeld % 2 ? -1 : 0;
    const pas = houding === 'lopen' ? LOOP[beeld] : 1.2;
    const mx = 13;
    benen(ctx, mx, wip, pas, { top: 27, b: 3.2, sp: 2.2, been: ['#5a4a3a', '#473a2c'], laars: '#2f2218', laarsH: 3 });
    romp(ctx, mx, wip, 9.6, 17, 10, '#b7a07a');
    // leren schort met teamkleurige band
    vlak(ctx, [[mx - 3.6, 19 + wip], [mx + 3.6, 19 + wip], [mx + 4, 29 + wip], [mx - 4, 29 + wip]], LEER);
    blok(ctx, mx - 3.8, 19.6 + wip, 7.6, 1.6, K);
    ovaal(ctx, mx, 25.4 + wip, 1.2, 0.9, '#2a1d10');   // zakje met spijkers
    gezichtje(ctx, mx + 0.6, 12.6 + wip, { rx: 2.7, ry: 3, baard: '#6a4a2a', haar: '#5a3a1a' });
    // werkmanshoed: brede rand, teamkleurige kroon
    ovaal(ctx, mx + 0.4, 9.2 + wip, 5.6, 1.5, tint(K, -0.2));
    vlak(ctx, [[mx - 3.2, 9 + wip], [mx - 2.6, 5.4 + wip], [mx + 3.4, 5.4 + wip], [mx + 4, 9 + wip]], K);
    blok(ctx, mx - 3, 8 + wip, 6.8, 0.8, 'rgba(0,0,0,0.25)');
    // armen en hamer
    lijn(ctx, mx - 3, 18 + wip, mx - 4.6, 23 + wip, ARM, 2.2); hand(ctx, mx - 4.6, 23.4 + wip, HUID, 1.2);
    if (slaat) {
      const op = houding === 'hoog';
      const hx = mx + (op ? 5.6 : 8.4), hy = op ? 6 : 24;
      lijn(ctx, mx + 3, 18 + wip, hx - 0.6, op ? 11 : 20.4, ARM, 2.2); hand(ctx, hx - 0.6, op ? 11 : 20.4, HUID, 1.2);
      lijn(ctx, hx - 0.6, op ? 11 : 20.4, hx, hy, HOUT, 1.4);
      lichtBlok(ctx, hx - 3, hy - (op ? 4 : 0.8), 6.4, 3.6, tint(HOUT, 0.1), 0.2);
      blok(ctx, hx - 3, hy - (op ? 4 : 0.8), 6.4, 0.7, 'rgba(255,255,255,0.22)');
    } else {
      lijn(ctx, mx + 3, 18 + wip, mx + 5.6, 15 + wip, ARM, 2.2); hand(ctx, mx + 5.8, 14.6 + wip, HUID, 1.2);
      lijn(ctx, mx + 5.8, 14.6 + wip, mx + 8.4, 22 + wip, HOUT, 1.4);   // steel over de schouder
      lichtBlok(ctx, mx + 6.4, 8.8 + wip, 6.2, 3.6, tint(HOUT, 0.1), 0.2);
    }
  };
  return pakket(teken, { sla: [['hoog', 0], ['slag', 0]] });
}

// ---------------------------------------------------------- hellebaardier
// Zwaar harnas, gesloten helm met vizier, lange hellebaard; sjerp in teamkleur.
function hellebaardier(def) {
  const K = def.kleur;
  const teken = (ctx, houding, beeld) => {
    const vecht = houding !== 'lopen';
    const hoog = houding === 'hoog';
    const wip = !vecht && beeld % 2 ? -1 : 0;
    const pas = vecht ? 1.6 : LOOP[beeld];
    const mx = 13;
    // hellebaard: lange steel met speerpunt, bijlblad en haak
    const bijl = (x1, y1, x2, y2) => {
      lijn(ctx, x1, y1, x2, y2, HOUT, 1.4);
      const l = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / l, uy = (y2 - y1) / l, nx = -uy, ny = ux;
      vlak(ctx, [[x2, y2], [x2 - nx * 1 - ux * 3.6, y2 - ny * 1 - uy * 3.6], [x2 + nx * 1 - ux * 3.6, y2 + ny * 1 - uy * 3.6]], '#dfe3e8');
      vlak(ctx, [[x2 - ux * 2.4, y2 - uy * 2.4], [x2 + nx * 5.2 - ux * 1.6, y2 + ny * 5.2 - uy * 1.6], [x2 + nx * 5 - ux * 5.4, y2 + ny * 5 - uy * 5.4], [x2 - ux * 5.4, y2 - uy * 5.4]], '#cfd4da');
      vlak(ctx, [[x2 - ux * 3, y2 - uy * 3], [x2 - nx * 3.4 - ux * 4.4, y2 - ny * 3.4 - uy * 4.4], [x2 - ux * 5, y2 - uy * 5]], '#8f96a0');
    };
    if (!vecht) bijl(mx - 6.5, 24 + wip, mx - 9.5, 6 + wip);
    benen(ctx, mx, wip, pas, { top: 27, b: 3.6, sp: 2.5, been: ['#4a3c2c', '#3a2e22'], laars: '#2a2018', laarsH: 3.2 });
    // zwaar harnas: borstplaat en maliën, sjerp in teamkleur
    romp(ctx, mx, wip, 11, 16.5, 11.6, '#9aa0a8', '#2a2c30');
    blok(ctx, mx - 3.4, 18 + wip, 6.8, 6, tint(STAAL, 0.1));
    for (let y = 18; y < 27; y += 2) blok(ctx, mx - 5.5, y + wip, 11, 0.4, 'rgba(0,0,0,0.22)');
    vlak(ctx, [[mx - 5.5, 16.8 + wip], [mx - 2.8, 16.8 + wip], [mx + 5.5, 27 + wip], [mx + 2.6, 27 + wip]], K);
    vlak(ctx, [[mx - 3.6, 17 + wip], [mx - 2.8, 16.8 + wip], [mx + 5.5, 27 + wip], [mx + 4.6, 27 + wip]], tint(K, 0.2));
    // schouderstukken
    ovaal(ctx, mx - 5.8, 17.8 + wip, 3, 2.5, tint(STAAL, -0.3));
    ovaal(ctx, mx + 5.8, 17.8 + wip, 3, 2.5, tint(STAAL, -0.05));
    ovaal(ctx, mx + 6.4, 17.2 + wip, 1.2, 0.8, 'rgba(255,255,255,0.5)');
    // hoofd met open helm, baard en kam
    blok(ctx, mx - 4, 8 + wip, 8, 6, tint(STAAL, -0.15));
    blok(ctx, mx - 3, 10.6 + wip, 6.4, 1.1, '#14161a');
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

// ------------------------------------------------------- vuurboogschutter
// Een boogschutter met oranje kap en een vuurpot: zijn pijlen branden.
function vuurboogschutter(def) {
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
    blok(ctx, mx - 4.4, 17 + wip, 8.8, 3.2, tint('#c46a2a', -0.05));
    blok(ctx, mx + 1.8, 17 + wip, 2.6, 3.2, 'rgba(255,255,255,0.14)');
    blok(ctx, mx - 4.4, 26.4 + wip, 8.8, 1.6, tint('#8a6a40', -0.2));
    ovaal(ctx, mx - 5.4, 23 + wip, 2, 2.4, '#3a3028');
    vlak(ctx, [[mx - 6.6, 21.4 + wip], [mx - 5.4, 18.6 + wip], [mx - 4.2, 21.4 + wip]], '#ff9a2a');
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
      vlak(ctx, [[mx + 20.8, 19], [mx + 18.4, 16.6], [mx + 17.2, 19], [mx + 18.4, 21.4]], '#ff9a2a');
      vlak(ctx, [[mx + 19.4, 19], [mx + 18.2, 17.8], [mx + 17.8, 19], [mx + 18.2, 20.2]], '#ffe27a');
      lijn(ctx, mx + 3, 18.6, mx + 8.6, 19, tint(K, -0.1), 2.2);
      hand(ctx, mx + 8.9, 19, HUID, 1.4);
      lijn(ctx, mx - 1, 19, mx + 3, 18.6, tint(K, -0.2), 2);
    } else {
      boog(mx + 7.5, 19, 0);
      lijn(ctx, mx + 3, 18.6, mx + 8.6, 19, tint(K, -0.1), 2.2);
      hand(ctx, mx + 8.9, 19, HUID, 1.4);
      lijn(ctx, mx + 12, 19, mx + 22, 18.6, 'rgba(255,170,60,0.9)', 0.9);
      vlak(ctx, [[mx + 24, 18.6], [mx + 21.4, 16.2], [mx + 20.4, 18.6], [mx + 21.4, 21]], '#ff9a2a');
      hand(ctx, mx - 1.4, 19, HUID, 1.3);
    }
  };
  return pakket(teken, { schiet: [['aan', 0], ['los', 0]] });
}

// ------------------------------------------------------------------ export
export const SOLDATEN = {
  ridder, bijlridder, berserker, boogschutter, kruisboogschutter, sluipmoordenaar, vlammenwever, ladderdrager,
  hellebaardier, vuurboogschutter, zwaardvechter, banierdrager, heler, steenwachter, ingenieur, windzanger, saboteur, ziener, ruiter, paard: (def) => ruiter(def, true),
};

export const heeftSoldaat = (vorm) => vorm === 'werker' || Object.prototype.hasOwnProperty.call(SOLDATEN, vorm);
export function teken(vorm, def, sleutel) { return vorm === 'werker' ? werker(def, sleutel) : SOLDATEN[vorm](def); }
