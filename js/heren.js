// HEREN: de tien tegenstanders (heren van level 1 tot en met 10) als rode koning in het spel.
// Elke heer heeft een eigen lichaamsbouw, kleding, hoofddeksel en wapen, naar zijn portret.
// Zie WIJZIGINGEN.md 0.35.0.
//
// Wat deze figuren anders doet dan de oude koning (tekenKoning in kunst.js):
//   - geen kroon: een heer herken je aan zijn silhouet en aan een dunne gouden ring op de grond
//   - groot wapen in de hand met een duidelijke vorm
//   - donkere contour rond de hele figuur, ook rond het wapen
//   - gezicht met wenkbrauw, oog, neus en mond
//   - licht van rechts, zoals in de rest van het spel
//   - team = rood: elke heer draagt rood (mantel of voering, sjerp, doek, koord)
//
// Gebruik: tekenHeer(naam, def) met def.figuur = de sleutel van de heer (zie HEREN).
// Alles wordt eenmalig voortekend; er komt geen tekenwerk per beeld bij.

// PROEFONTWERP: nieuwe heren (Reinout, Lambrecht, Ottger).
// Staat los van het spel. Als Karel het goedkeurt, gaat dit naar js/kunst.js.
//
// Wat anders is dan de huidige koning (tekenKoning):
//   - eigen lichaamsbouw, kleding en hoofddeksel per heer (geen kroon)
//   - groot wapen in de hand, met een duidelijke vorm
//   - donkere contour rond de hele figuur (komt uit de pixels, dus ook om het wapen)
//   - gezicht met wenkbrauw, oog, neus en mond
//   - zachte schaduw met gouden ring: zo herken je een heer zonder kroon
//   - licht van rechts, zoals in de rest van het spel

const SCHERPTE = 2;
const B = 76;
const H = 64;
const AY = 56;   // ankerpunt van de voeten, vanaf de bovenkant
const OMLIJN = '#1b130d';

// --- gereedschap (kopie van kunst.js, zodat dit bestand los werkt) ----------
export function blok(ctx, x, y, b, h, kleur) { ctx.fillStyle = kleur; ctx.fillRect(x, y, b, h); }
export function lijn(ctx, x1, y1, x2, y2, kleur, dikte) {
  ctx.strokeStyle = kleur; ctx.lineWidth = dikte; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.lineCap = 'butt';
}
export function vlak(ctx, punten, kleur) {
  ctx.beginPath();
  punten.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath(); ctx.fillStyle = kleur; ctx.fill();
}
export function ovaal(ctx, x, y, rx, ry, kleur, hoek = 0) {
  ctx.fillStyle = kleur; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, hoek, 0, Math.PI * 2); ctx.fill();
}
export function tint(kleur, sterkte) {
  let d;
  if (kleur[0] === '#') { const g = parseInt(kleur.slice(1), 16); d = [(g >> 16) & 255, (g >> 8) & 255, g & 255]; }
  else d = kleur.match(/\d+/g).map(Number);
  const doel = sterkte < 0 ? 0 : 255;
  const deel = Math.min(1, Math.abs(sterkte));
  return `rgb(${d.map((k) => Math.round(k + (doel - k) * deel)).join(',')})`;
}

// Een vlak met licht van rechts: basiskleur, donkere linkerrand, lichte rechterrand.
export function lichtBlok(ctx, x, y, b, h, kleur, sterkte = 0.2) {
  blok(ctx, x, y, b, h, kleur);
  blok(ctx, x, y, b * 0.28, h, `rgba(0,0,0,${sterkte})`);
  blok(ctx, x + b * 0.78, y, b * 0.22, h, `rgba(255,255,255,${sterkte * 0.7})`);
}

// Zachte schaduw met een dunne gouden ring: de heer van het level.
function grond(ctx, mx, breedte) {
  const g = ctx.createRadialGradient(mx, 34, 1, mx, 34, breedte);
  g.addColorStop(0, 'rgba(0,0,0,0.42)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.26)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(mx, 34, breedte, breedte * 0.36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(232,196,74,0.9)';
  ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.ellipse(mx, 34, breedte * 0.86, breedte * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
}

// Hand: huidkleur, met een kleine duimknobbel.
export function hand(ctx, x, y, huid, r = 1.7) {
  ovaal(ctx, x, y, r, r * 0.95, huid);
  ovaal(ctx, x + r * 0.5, y - r * 0.5, r * 0.5, r * 0.45, tint(huid, 0.18));
}

// Gezicht van voren. v = { huid, brauw: 'bezorgd'|'zwaar'|'moe'|'recht', mond: 'twijfel'|'streng'|'neer'|'lach',
// holte, kringen, ooglid (halfdichte ogen), bril, litteken, stoppels }
function gezicht(ctx, x, y, v, rx = 3.7, ry = 4.1) {
  const huid = v.huid;
  ovaal(ctx, x, y, rx, ry, huid);
  ovaal(ctx, x - rx * 0.45, y + 0.4, rx * 0.5, ry * 0.85, 'rgba(0,0,0,0.13)');
  ovaal(ctx, x + rx * 0.55, y - 0.3, rx * 0.4, ry * 0.7, 'rgba(255,255,255,0.10)');
  if (v.holte) {
    ovaal(ctx, x - rx * 0.62, y + 1.7, 0.9, 1.5, 'rgba(60,30,20,0.30)');
    ovaal(ctx, x + rx * 0.62, y + 1.7, 0.9, 1.5, 'rgba(60,30,20,0.22)');
  }
  const oogY = y - 0.2;
  if (v.kringen) {
    ovaal(ctx, x - 1.5, oogY + 1, 1.05, 0.55, 'rgba(70,40,50,0.55)');
    ovaal(ctx, x + 1.5, oogY + 1, 1.05, 0.55, 'rgba(70,40,50,0.55)');
  }
  ovaal(ctx, x - 1.5, oogY, 0.95, 0.65, '#f1e8da');
  ovaal(ctx, x + 1.5, oogY, 0.95, 0.65, '#f1e8da');
  ovaal(ctx, x - 1.4, oogY, 0.5, 0.5, '#2a1b12');
  ovaal(ctx, x + 1.6, oogY, 0.5, 0.5, '#2a1b12');
  if (v.ooglid) {
    lijn(ctx, x - 2.5, oogY - 0.35, x - 0.5, oogY - 0.35, huid, 0.9);
    lijn(ctx, x + 0.5, oogY - 0.35, x + 2.5, oogY - 0.35, huid, 0.9);
    lijn(ctx, x - 2.5, oogY - 0.35, x - 0.5, oogY - 0.35, 'rgba(60,35,25,0.6)', 0.35);
    lijn(ctx, x + 0.5, oogY - 0.35, x + 2.5, oogY - 0.35, 'rgba(60,35,25,0.6)', 0.35);
  }
  const br = v.brauwKleur || '#3a2a1c';
  if (v.brauw === 'bezorgd') {
    lijn(ctx, x - 2.6, oogY - 1.5, x - 0.8, oogY - 2.2, br, 0.6);
    lijn(ctx, x + 2.6, oogY - 1.5, x + 0.8, oogY - 2.2, br, 0.6);
  } else if (v.brauw === 'zwaar') {
    lijn(ctx, x - 2.8, oogY - 1.6, x - 0.5, oogY - 1.4, br, 1.1);
    lijn(ctx, x + 2.8, oogY - 1.6, x + 0.5, oogY - 1.4, br, 1.1);
  } else if (v.brauw === 'recht') {
    lijn(ctx, x - 2.8, oogY - 1.7, x - 0.5, oogY - 1.7, br, 0.7);
    lijn(ctx, x + 2.8, oogY - 1.7, x + 0.5, oogY - 1.7, br, 0.7);
  } else {
    lijn(ctx, x - 2.8, oogY - 1.2, x - 0.8, oogY - 2, br, 0.7);
    lijn(ctx, x + 2.8, oogY - 1.2, x + 0.8, oogY - 2, br, 0.7);
  }
  if (v.bril) {
    ctx.strokeStyle = '#26262c'; ctx.lineWidth = 0.5;
    for (const dx of [-1.5, 1.5]) { ctx.beginPath(); ctx.ellipse(x + dx, oogY, 1.35, 1.25, 0, 0, Math.PI * 2); ctx.stroke(); }
    lijn(ctx, x - 0.2, oogY - 0.1, x + 0.2, oogY - 0.1, '#26262c', 0.4);
  }
  lijn(ctx, x + 0.2, oogY + 0.4, x + 0.5, oogY + 2.1, 'rgba(90,50,30,0.55)', 0.7);
  ovaal(ctx, x + 0.6, oogY + 2.2, 0.8, 0.5, tint(huid, -0.12));
  if (v.litteken) lijn(ctx, x + 2.5, y - 0.4, x + 1.6, y + 2.8, '#b4685a', 0.55);
  if (v.stoppels) for (const [dx, dy] of [[-1.6, 2.7], [-0.3, 3.3], [1.1, 3.2], [2, 2.5], [-2.2, 1.8]]) ovaal(ctx, x + dx, y + dy, 0.3, 0.3, 'rgba(45,35,28,0.6)');
  if (v.mond === 'twijfel') lijn(ctx, x - 1, y + 2.9, x + 1.2, y + 2.6, '#7a3a30', 0.55);
  else if (v.mond === 'neer') lijn(ctx, x - 1.1, y + 3.1, x + 1.1, y + 3.1, '#6a3a34', 0.55);
  else if (v.mond === 'streng') lijn(ctx, x - 1.2, y + 3, x + 1.2, y + 3, '#6a3a34', 0.6);
  else if (v.mond === 'lach') { ctx.strokeStyle = '#7a3a30'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.arc(x + 0.2, y + 2.3, 1.2, 0.15, Math.PI - 0.35); ctx.stroke(); }
}

const ROOD = '#c23a2e';
const arm = (ctx, ax, ay, bx, by, kleur, d = 2.6) => lijn(ctx, ax, ay, bx, by, kleur, d);
function hals(ctx, x, y, huid) { lichtBlok(ctx, x - 1.4, y + 3.2, 2.8, 2.4, tint(huid, -0.1), 0.15); }
export function benen(ctx, mx, wip, pas, o) {
  const { top = 27, b = 3.2, sp = 2.3, been, laars, laarsH = 2.6 } = o;
  [[-sp + pas * 0.5, been[0], pas], [sp - pas * 0.5, been[1], -pas]].forEach(([dx, k, f]) => {
    const x = mx + dx;
    lichtBlok(ctx, x - b / 2, top + wip, b, 34 - top - wip, k, 0.2);
    vlak(ctx, [[x - b / 2 - 0.4, 34 - laarsH], [x + b / 2 + 0.4, 34 - laarsH], [x + b / 2 + 0.9 + f * 0.1, 34], [x - b / 2 - 0.9 + f * 0.1, 34]], laars);
  });
}
// Korte rode mantel achter de schouders: het team
function roodMantel(ctx, mx, wip, wapper, o = {}) {
  const top = o.top ?? 17.5, b = o.b ?? 4.6, len = o.len ?? 29;
  vlak(ctx, [[mx - b, top + wip], [mx + b, top + wip], [mx + b - 1 - wapper, len], [mx - b - 2 - wapper, len - 0.5]], tint(ROOD, -0.22));
  vlak(ctx, [[mx + b * 0.25, top + 0.4 + wip], [mx + b, top + wip], [mx + b - 1 - wapper, len], [mx + b * 0.2 - wapper, len]], 'rgba(255,255,255,0.10)');
}

// --- de drie heren ----------------------------------------------------------
// houding: 'lopen' (beeld 0..3), 'hoog' (wapen opgeheven), 'slag'
// Alles in een ruimte van 26 bij 38, voeten op y = 34, midden x = 13.

// ---------- Reinout: mager, bezorgd, bruin en dor; speer en rond houten schild
function reinout(ctx, houding, beeld) {
  const huid = '#e3c4a2';
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.8 : 0;
  const pas = vecht ? 1.6 : [0, 1.5, 0, -1.5][beeld];
  const wapper = vecht ? 0 : [0, 1.2, 0, -1.2][beeld];
  const mx = 13;
  const lees = houding === 'slag' ? 1.5 : 0;   // leunt naar voren bij de steek
  const tuniek = '#8f6f48';
  const leer = '#5a3d22';

  // Korte rode mantel achter de schouders (het team)
  vlak(ctx, [[mx - 4, 17 + wip], [mx + 4, 17 + wip], [mx + 3 - wapper, 29], [mx - 6 - wapper, 28.5]], tint(ROOD, -0.22));
  vlak(ctx, [[mx + 1, 17.5 + wip], [mx + 4, 17 + wip], [mx + 3 - wapper, 29], [mx + 0.5 - wapper, 28.8]], 'rgba(255,255,255,0.10)');

  // Benen: dunne bruine kousen, versleten laarzen, iets x-benig
  const links = mx - 2.2 + pas * 0.5;
  const rechts = mx + 2.2 - pas * 0.5;
  lichtBlok(ctx, links - 1.4, 26.5 + wip, 2.8, 5.5 - wip, '#6b5236', 0.2);
  lichtBlok(ctx, rechts - 1.4, 26.5 + wip, 2.8, 5.5 - wip, '#7a5d3d', 0.2);
  vlak(ctx, [[links - 1.8, 31.5], [links + 1.6, 31.5], [links + 2.3 + pas * 0.2, 34], [links - 2.2, 34]], '#3b2a1a');
  vlak(ctx, [[rechts - 1.6, 31.5], [rechts + 1.8, 31.5], [rechts + 2.6 - pas * 0.2, 34], [rechts - 2, 34]], '#47321f');

  // Rok van de tuniek en torso
  vlak(ctx, [[mx - 4.6, 26 + wip], [mx + 4.6, 26 + wip], [mx + 5.2, 29.5 + wip], [mx - 5.2, 29.5 + wip]], tint(tuniek, -0.12));
  lichtBlok(ctx, mx - 4.2 + lees * 0.3, 17.5 + wip, 8.4, 9.5, tuniek, 0.22);
  // Lederen vest met veters
  vlak(ctx, [[mx - 4.2, 17.5 + wip], [mx - 0.8, 17.5 + wip], [mx - 1.4, 26.5 + wip], [mx - 4.2, 26.5 + wip]], '#6a4c2b');
  vlak(ctx, [[mx + 0.8, 17.5 + wip], [mx + 4.2, 17.5 + wip], [mx + 4.2, 26.5 + wip], [mx + 1.4, 26.5 + wip]], '#76562f');
  for (let i = 0; i < 3; i++) lijn(ctx, mx - 0.8, 19.5 + i * 2.4 + wip, mx + 0.8, 20.5 + i * 2.4 + wip, '#d8c690', 0.45);
  // Riem
  blok(ctx, mx - 4.4, 24.6 + wip, 8.8, 1.1, leer);
  blok(ctx, mx - 0.6, 24.5 + wip, 1.2, 1.3, '#b9a25a');
  // Dor takje als embleem op de borst (rechts)
  lijn(ctx, mx + 2.8, 22.8 + wip, mx + 3.6, 19.6 + wip, '#3d2a16', 0.5);
  lijn(ctx, mx + 3.2, 21.4 + wip, mx + 4.1, 20.9 + wip, '#3d2a16', 0.4);
  lijn(ctx, mx + 3.1, 21.9 + wip, mx + 2.3, 20.8 + wip, '#3d2a16', 0.4);
  // Rode sjaal om de nek
  vlak(ctx, [[mx - 3.2, 16.6 + wip], [mx + 3.2, 16.6 + wip], [mx + 2.6, 18.8 + wip], [mx - 2.6, 18.8 + wip]], ROOD);
  vlak(ctx, [[mx + 1.2, 18 + wip], [mx + 3.2, 18.2 + wip], [mx + 2.8, 21.2 + wip + wapper * 0.2], [mx + 1.4, 20.6 + wip]], tint(ROOD, -0.18));

  // Smalle schouders
  ovaal(ctx, mx - 4.5, 18.4 + wip, 1.9, 1.7, tint(tuniek, -0.2));
  ovaal(ctx, mx + 4.5, 18.4 + wip, 1.9, 1.7, tint(tuniek, 0.05));

  // Hoofd met dun bruin haar
  const hx = mx + 0.2 + lees * 0.6;
  const hy = 12 + wip;
  lichtBlok(ctx, hx - 1.3, hy + 3.2, 2.6, 2.2, tint(huid, -0.1), 0.15);      // hals
  gezicht(ctx, hx, hy, { huid, brauw: 'bezorgd', mond: 'twijfel', holte: true });
  // haar: dun, pluizig, valt in plukken over het voorhoofd
  ovaal(ctx, hx - 0.2, hy - 3.2, 4.1, 2.2, '#6b4a2b');
  ovaal(ctx, hx - 3.4, hy - 0.8, 1.2, 2.4, '#5b3e22');
  ovaal(ctx, hx + 3.5, hy - 1, 1, 2, '#7a5632');
  for (const [dx, dy] of [[-1.5, -1.1], [0.2, -1.6], [1.8, -1.1]]) lijn(ctx, hx + dx, hy - 3.4, hx + dx * 1.2, hy + dy, '#6b4a2b', 0.9);
  // kleine oorbel
  ovaal(ctx, hx - 3.8, hy + 0.5, 0.7, 1, tint(huid, -0.08));

  // --- Schild links: rond, hout met ijzeren rand en nop
  const schild = (sx, sy, r) => {
    ovaal(ctx, sx, sy, r + 0.6, r + 0.6, '#3a3a40');
    ovaal(ctx, sx, sy, r, r, '#8a6238');
    // planken
    ctx.save();
    ctx.beginPath(); ctx.ellipse(sx, sy, r, r, 0, 0, Math.PI * 2); ctx.clip();
    for (let i = -2; i <= 2; i++) lijn(ctx, sx + i * r * 0.4, sy - r, sx + i * r * 0.4, sy + r, 'rgba(40,22,8,0.45)', 0.4);
    blok(ctx, sx + r * 0.3, sy - r, r, r * 2, 'rgba(255,255,255,0.10)');
    blok(ctx, sx - r, sy - r, r * 0.6, r * 2, 'rgba(0,0,0,0.18)');
    ctx.restore();
    ovaal(ctx, sx, sy, r * 0.32, r * 0.32, '#c9ccd2');
    ovaal(ctx, sx - 0.25, sy - 0.25, r * 0.12, r * 0.12, '#fff');
  };

  if (houding === 'lopen') {
    schild(mx - 6.2, 23.6 + wip, 4.6);
    hand(ctx, mx - 4.4, 24.4 + wip, huid, 1.5);
    // speer rechtop in de rechterhand, punt boven het hoofd
    lijn(ctx, mx + 6.2, 34, mx + 6.2, 2 + wip, '#6b4a2b', 1.2);
    lijn(ctx, mx + 6.5, 33, mx + 6.5, 3 + wip, 'rgba(255,255,255,0.18)', 0.4);
    vlak(ctx, [[mx + 6.2, -3 + wip], [mx + 7.7, 3.4 + wip], [mx + 6.2, 2.4 + wip], [mx + 4.7, 3.4 + wip]], '#e1e5ea');
    lijn(ctx, mx + 6.2, -2.5 + wip, mx + 6.2, 2.4 + wip, 'rgba(120,130,140,0.7)', 0.4);
    blok(ctx, mx + 5.2, 3 + wip, 2, 0.9, '#a07a3a');
    ovaal(ctx, mx + 5.6, 22 + wip, 1.5, 1.7, huid);       // hand
    blok(ctx, mx + 3.8, 19 + wip, 2.2, 4.5, tint(tuniek, -0.05));   // arm
    ovaal(ctx, mx + 5.8, 22.6 + wip, 1.6, 1.6, huid);
  } else if (houding === 'hoog') {
    // speer schuin achter, klaar om te steken; schild naar voren
    schild(mx - 6.8, 22, 4.8);
    hand(ctx, mx - 4.8, 22.6, huid, 1.5);
    blok(ctx, mx + 3.6, 18.8, 2, 4.2, tint(tuniek, -0.05));
    lijn(ctx, mx + 12, 14, mx + 1.5, 28, '#6b4a2b', 1.2);
    vlak(ctx, [[mx + 13.8, 11.4], [mx + 13.6, 14.6], [mx + 11, 13.4], [mx + 12.2, 11]], '#e1e5ea');
    hand(ctx, mx + 5.8, 21.4, huid, 1.6);
  } else {
    // de steek: speer recht naar rechts
    schild(mx - 5.6, 22.4, 4.8);
    hand(ctx, mx - 3.8, 23.2, huid, 1.5);
    blok(ctx, mx + 3.8, 20, 4.4, 2.2, tint(tuniek, -0.05));
    lijn(ctx, mx - 2, 24.4, mx + 21.5, 20.4, '#6b4a2b', 1.2);
    vlak(ctx, [[mx + 25.6, 19.7], [mx + 21.4, 21.9], [mx + 21.8, 18.8]], '#e1e5ea');
    lijn(ctx, mx + 21.5, 20.4, mx + 25, 19.8, 'rgba(120,130,140,0.7)', 0.4);
    blok(ctx, mx + 20, 19.2, 0.9, 2.6, '#a07a3a');
    hand(ctx, mx + 8.4, 21.8, huid, 1.7);
    // beweging
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(mx + 9, 18.6); ctx.lineTo(mx + 15, 17.6); ctx.moveTo(mx + 9, 24.6); ctx.lineTo(mx + 15, 23.4); ctx.stroke();
  }
}

// ---------- Lambrecht: breed, ronde schouders, leren schort, rode hamers (handen), grote moker
function lambrecht(ctx, houding, beeld) {
  const huid = '#d9a68a';
  const rood = '#c9634a';     // rode handen en onderarmen van het werk
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.9 : 0;
  const pas = vecht ? 2 : [0, 1.9, 0, -1.9][beeld];
  const wapper = vecht ? 0 : [0, 1.2, 0, -1.2][beeld];
  const mx = 13;
  const trui = '#7d7650';
  const schort = '#5e3d22';

  // Korte rode mantel (team), als werkkleed over de schouders
  vlak(ctx, [[mx - 6, 17.5 + wip], [mx + 6, 17.5 + wip], [mx + 5 - wapper, 28], [mx - 8 - wapper, 28]], tint(ROOD, -0.25));
  vlak(ctx, [[mx + 2, 18 + wip], [mx + 6, 17.5 + wip], [mx + 5 - wapper, 28], [mx + 1.5 - wapper, 28]], 'rgba(255,255,255,0.10)');

  // Benen, zware laarzen
  lichtBlok(ctx, mx - 4.6 + pas * 0.5, 27 + wip, 3.8, 5 - wip, '#4a3a2a', 0.22);
  lichtBlok(ctx, mx + 0.8 - pas * 0.5, 27 + wip, 3.8, 5 - wip, '#55432f', 0.22);
  vlak(ctx, [[mx - 5.2 + pas * 0.5, 31.6], [mx - 0.6 + pas * 0.5, 31.6], [mx - 0.1 + pas * 0.5, 34], [mx - 5.7 + pas * 0.5, 34]], '#2d2219');
  vlak(ctx, [[mx + 0.4 - pas * 0.5, 31.6], [mx + 5 - pas * 0.5, 31.6], [mx + 5.6 - pas * 0.5, 34], [mx - 0.1 - pas * 0.5, 34]], '#34271c');

  // Torso: breed met ronde schouders en een buik
  vlak(ctx, [[mx - 5.6, 18.4 + wip], [mx + 5.6, 18.4 + wip], [mx + 6.4, 25 + wip], [mx + 5.4, 28.4 + wip], [mx - 5.4, 28.4 + wip], [mx - 6.4, 25 + wip]], trui);
  blok(ctx, mx - 6, 19 + wip, 3, 9, 'rgba(0,0,0,0.20)');
  blok(ctx, mx + 4.2, 19 + wip, 2, 9, 'rgba(255,255,255,0.10)');
  // breisteken op de trui
  for (let i = 0; i < 4; i++) lijn(ctx, mx - 5 + i * 0.3, 20.4 + i * 2, mx - 3.4, 20.4 + i * 2, 'rgba(0,0,0,0.16)', 0.5);
  ovaal(ctx, mx - 5.4, 19.4 + wip, 2.6, 2.4, tint(trui, -0.18));
  ovaal(ctx, mx + 5.4, 19.4 + wip, 2.6, 2.4, tint(trui, 0.03));
  // Leren schort met borststuk en gereedschapsriem
  vlak(ctx, [[mx - 3.2, 19 + wip], [mx + 3.2, 19 + wip], [mx + 4.8, 28.6 + wip], [mx - 4.8, 28.6 + wip]], schort);
  vlak(ctx, [[mx + 0.4, 19 + wip], [mx + 3.2, 19 + wip], [mx + 4.8, 28.6 + wip], [mx + 0.9, 28.6 + wip]], 'rgba(255,255,255,0.09)');
  blok(ctx, mx - 4.6, 24 + wip, 9.2, 1.3, '#2d1e10');
  blok(ctx, mx - 0.5, 23.9 + wip, 1.1, 1.5, '#b9a25a');
  // Tangen en beitel in de riem
  lijn(ctx, mx - 3.3, 25 + wip, mx - 3.6, 28 + wip, '#8c9199', 0.9);
  lijn(ctx, mx + 3.1, 25 + wip, mx + 3.5, 27.6 + wip, '#8c9199', 0.9);
  blok(ctx, mx + 2.7, 27 + wip, 1.3, 1.7, '#6b4a2b');
  // Rode doek om het hoofd en de nek: team
  vlak(ctx, [[mx - 4.4, 17.2 + wip], [mx + 4.4, 17.2 + wip], [mx + 3, 19.4 + wip], [mx - 3, 19.4 + wip]], tint(trui, -0.1));

  // Hoofd
  const hx = mx + 0.3;
  const hy = 12 + wip;
  lichtBlok(ctx, hx - 1.6, hy + 3, 3.2, 2.4, tint(huid, -0.1), 0.15);
  gezicht(ctx, hx, hy, { huid, brauw: 'zwaar', mond: 'neer', brauwKleur: '#5a4a3a' }, 3.9, 4.2);
  // grijs bruin haar en baard, rode hoofddoek
  ovaal(ctx, hx - 0.1, hy - 3.2, 4.3, 1.8, '#7b7468');
  ovaal(ctx, hx - 3.8, hy - 1, 1.1, 2.1, '#7b7468');
  ovaal(ctx, hx + 3.9, hy - 1, 1, 2, '#8c8576');
  vlak(ctx, [[hx - 4.4, hy - 3.2], [hx + 4.4, hy - 3.2], [hx + 4.1, hy - 1.7], [hx - 4.1, hy - 1.7]], ROOD);
  vlak(ctx, [[hx + 1.5, hy - 3.2], [hx + 4.4, hy - 3.2], [hx + 4.1, hy - 1.7], [hx + 1.5, hy - 1.7]], 'rgba(255,255,255,0.15)');
  vlak(ctx, [[hx - 4.2, hy - 3], [hx - 6.2, hy - 0.6 + wapper * 0.3], [hx - 5.2, hy - 0.4 + wapper * 0.3], [hx - 3.8, hy - 1.7]], tint(ROOD, -0.2));   // knoop met flap
  // baard: vol en grijs
  vlak(ctx, [[hx - 3.6, hy + 1.2], [hx + 3.8, hy + 1.2], [hx + 3.2, hy + 4.6], [hx + 0.2, hy + 6.4], [hx - 2.9, hy + 4.6]], '#8d8d88');
  vlak(ctx, [[hx + 0.6, hy + 1.4], [hx + 3.8, hy + 1.2], [hx + 3.2, hy + 4.6], [hx + 0.2, hy + 6.4]], 'rgba(255,255,255,0.18)');
  lijn(ctx, hx - 1, hy + 3.1, hx + 1, hy + 3.1, '#5a2a24', 0.6);   // de mond onder de snor
  ovaal(ctx, hx - 1.4, hy + 2, 1.6, 0.7, '#9a9a94');
  ovaal(ctx, hx + 1.6, hy + 2, 1.6, 0.7, '#a8a8a2');

  // De moker: houten steel, groot blokvormig hoofd met ijzeren banden
  const moker = (x1, y1, x2, y2, kop = 1) => {
    const hoek = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.cos(hoek), dy = Math.sin(hoek);
    const nx = -dy, ny = dx;
    lijn(ctx, x1 - dx * 4, y1 - dy * 4, x2, y2, '#6b4a2b', 1.6);
    lijn(ctx, x1 - dx * 4 + nx * 0.4, y1 - dy * 4 + ny * 0.4, x2 + nx * 0.4, y2 + ny * 0.4, 'rgba(255,255,255,0.15)', 0.5);
    // kop: rechthoek haaks op de steel
    const l = 5.4 * kop, d = 3.4 * kop;
    const c = [x2 + dx * 1.2, y2 + dy * 1.2];
    const p = [
      [c[0] + nx * l - dx * d, c[1] + ny * l - dy * d],
      [c[0] + nx * l + dx * d, c[1] + ny * l + dy * d],
      [c[0] - nx * l + dx * d, c[1] - ny * l + dy * d],
      [c[0] - nx * l - dx * d, c[1] - ny * l - dy * d],
    ];
    vlak(ctx, p, '#9a6e3c');
    vlak(ctx, [p[0], p[1], [p[1][0] - nx * l * 0.6, p[1][1] - ny * l * 0.6], [p[0][0] - nx * l * 0.6, p[0][1] - ny * l * 0.6]], 'rgba(255,255,255,0.12)');
    vlak(ctx, [p[2], p[3], [p[3][0] + nx * l * 0.5, p[3][1] + ny * l * 0.5], [p[2][0] + nx * l * 0.5, p[2][1] + ny * l * 0.5]], 'rgba(0,0,0,0.22)');
    for (const f of [-0.62, 0.62]) {
      lijn(ctx, c[0] + nx * l * f - dx * d, c[1] + ny * l * f - dy * d, c[0] + nx * l * f + dx * d, c[1] + ny * l * f + dy * d, '#4b4e56', 1.1);
    }
    // houtnerf
    lijn(ctx, c[0] - dx * d * 0.4 + nx * l * 0.2, c[1] - dy * d * 0.4 + ny * l * 0.2, c[0] + dx * d * 0.5 + nx * l * 0.3, c[1] + dy * d * 0.5 + ny * l * 0.3, 'rgba(60,30,10,0.4)', 0.4);
  };

  const arm = (ax, ay, bx, by) => {   // rode onderarm
    lijn(ctx, ax, ay, bx, by, trui, 3.2);
    lijn(ctx, ax + (bx - ax) * 0.45, ay + (by - ay) * 0.45, bx, by, rood, 2.6);
  };

  if (houding === 'lopen') {
    // moker op de rechterschouder, kop achter het hoofd omhoog
    moker(mx + 4.4, 26.4 + wip, mx + 11.4, 2.2 + wip, 1);
    arm(mx + 5.8, 20.4 + wip, mx + 6.4, 24.6 + wip);
    hand(ctx, mx + 6.6, 25.4 + wip, rood, 1.9);
    arm(mx - 5.8, 20.4 + wip, mx - 5.6, 25.6 + wip);
    hand(ctx, mx - 5.6, 26.6 + wip, rood, 1.8);
  } else if (houding === 'hoog') {
    // beide handen aan de steel vlak voor de borst, de moker hoog boven het hoofd
    moker(mx + 3, 25, mx + 8, -2, 1.1);
    arm(mx - 5.8, 20.4, mx + 3.2, 22.8);
    hand(ctx, mx + 3.4, 22.8, rood, 1.9);
    arm(mx + 5.8, 20.4, mx + 4.6, 17.4);
    hand(ctx, mx + 4.6, 17.2, rood, 1.9);
  } else {
    // de slag: de steel schuin over het lijf, de kop zwaait naar voren en omlaag
    moker(mx - 2, 23, mx + 16.4, 25.4, 1.1);
    arm(mx - 5.8, 20.4, mx - 2.2, 23.2);
    hand(ctx, mx - 2, 23.2, rood, 1.9);
    arm(mx + 5.8, 20.4, mx + 6.2, 23.6);
    hand(ctx, mx + 6.2, 24, rood, 1.9);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(mx + 4, 18, 16, -0.9, 0.9); ctx.stroke();
  }
}

// ---------- Ottger: oud, gebogen, zwarte mantel met zilveren rand, rouwscepter
function ottger(ctx, houding, beeld) {
  const huid = '#e7d3c0';
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.5 : 0;     // langzaam
  const wapper = vecht ? 0 : [0, 1, 0, -1][beeld];
  const mx = 13;
  const zwart = '#1a1a20';
  const zilver = '#b9bfc8';
  const hang = houding === 'lopen' ? 2.2 : 1;       // gebogen stand
  const hx = mx - 1.6 + (houding === 'slag' ? 2.4 : 0);   // hoofd voor het lijf uit
  const hy = 13.6 + wip;

  // Lange mantel tot de grond, met rode voering
  vlak(ctx, [[mx - 6.5, 18 + wip], [mx + 5.5, 18 + wip], [mx + 7.6 - wapper, 33.6], [mx - 9 - wapper * 1.4, 33.8]], zwart);
  vlak(ctx, [[mx - 6.5, 18 + wip], [mx - 3.6, 18 + wip], [mx - 5.2 - wapper * 1.4, 33.8], [mx - 9 - wapper * 1.4, 33.8]], ROOD);   // voering, team
  vlak(ctx, [[mx - 3.9, 18 + wip], [mx - 3.1, 18 + wip], [mx - 4.6 - wapper * 1.4, 33.8], [mx - 5.4 - wapper * 1.4, 33.8]], 'rgba(0,0,0,0.35)');
  vlak(ctx, [[mx + 2, 18 + wip], [mx + 5.5, 18 + wip], [mx + 7.6 - wapper, 33.6], [mx + 3.4, 33.6]], 'rgba(255,255,255,0.10)');
  // plooien
  for (const f of [0.15, 0.4, 0.62]) lijn(ctx, mx - 5 + f * 11, 22 + wip, mx - 6 + f * 13 - wapper * f, 33.2, 'rgba(255,255,255,0.08)', 0.5);
  // zilveren rand langs de voorkant en de zoom
  lijn(ctx, mx - 3.2, 18.4 + wip, mx - 4.6 - wapper * 1.2, 33.4, zilver, 0.9);
  lijn(ctx, mx + 3.2, 18.4 + wip, mx + 5 - wapper * 0.6, 33.4, zilver, 0.9);
  lijn(ctx, mx - 8.6 - wapper * 1.4, 33.4, mx + 7.2 - wapper * 0.6, 33.2, zilver, 0.8);
  // laarspunten
  blok(ctx, mx - 3.4, 32.6, 2.2, 1.5, '#0c0c10');
  blok(ctx, mx + 1.2, 32.6, 2.2, 1.5, '#0c0c10');

  // Kraag en schoudermantel met zilver
  vlak(ctx, [[mx - 7, 19.8 + wip], [mx - 4, 16.6 + wip], [mx + 4, 16.6 + wip], [mx + 7, 19.8 + wip], [mx + 5, 21.4 + wip], [mx - 5, 21.4 + wip]], '#26262e');
  lijn(ctx, mx - 6.6, 20.2 + wip, mx - 3.8, 17 + wip, zilver, 0.8);
  lijn(ctx, mx + 6.6, 20.2 + wip, mx + 3.8, 17 + wip, zilver, 0.8);
  lijn(ctx, mx - 5, 21.2 + wip, mx + 5, 21.2 + wip, zilver, 0.7);
  // rood koord aan de hals
  lijn(ctx, mx - 1.2, 18.4 + wip, mx - 1.2, 22.6 + wip, ROOD, 0.7);
  ovaal(ctx, mx - 1.2, 22.8 + wip, 0.7, 0.7, ROOD);
  // Smalle gebogen schouders
  ovaal(ctx, mx + 5.2, 19.8 + wip, 2, 1.7, '#2a2a33');

  // Lang wit haar en baard, hoofd ver naar voren
  vlak(ctx, [[hx - 4.6, hy - 2], [hx - 5.4, hy + 6.5], [hx - 3.2, hy + 7.5], [hx - 3, hy + 0.5]], '#d8d8d6');
  vlak(ctx, [[hx + 4.4, hy - 2], [hx + 5.2, hy + 6.8], [hx + 3, hy + 7.4], [hx + 3, hy + 0.5]], '#e8e8e6');
  gezicht(ctx, hx, hy, { huid, brauw: 'moe', mond: 'neer', holte: true, kringen: true, brauwKleur: '#9a9a98' });
  // haren boven
  ovaal(ctx, hx, hy - 3.1, 4.3, 2.0, '#e2e2e0');
  ovaal(ctx, hx + 1.6, hy - 3.4, 2.2, 1.2, '#f2f2f0');
  ovaal(ctx, hx - 3.9, hy - 1, 1.1, 2.3, '#cfcfcd');
  // lange baard: smal, tot de borst
  vlak(ctx, [[hx - 3.5, hy + 1.4], [hx + 3.6, hy + 1.4], [hx + 2.8, hy + 5], [hx + 1.6, hy + 9.8], [hx - 0.2, hy + 11], [hx - 1.9, hy + 9.6], [hx - 3, hy + 5]], '#ecebe8');
  vlak(ctx, [[hx - 3.5, hy + 1.4], [hx - 0.6, hy + 1.4], [hx - 0.8, hy + 9.8], [hx - 1.9, hy + 9.6], [hx - 3, hy + 5]], 'rgba(0,0,0,0.12)');
  for (const dx of [-1.4, 0, 1.4]) lijn(ctx, hx + dx, hy + 3.6, hx + dx * 0.7, hy + 9.4, 'rgba(120,120,120,0.35)', 0.4);
  ovaal(ctx, hx - 1, hy + 2.1, 1.6, 0.6, '#f3f3f1');
  ovaal(ctx, hx + 1.4, hy + 2.1, 1.6, 0.6, '#f6f6f4');
  lijn(ctx, hx - 0.8, hy + 3.2, hx + 1, hy + 3.2, '#6a4a48', 0.5);

  // Scepter: donker hout, zilveren hals, zwarte ijzeren lelie bovenop
  const staf = (x1, y1, x2, y2, getrokken) => {
    const hoek = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.cos(hoek), dy = Math.sin(hoek);
    const nx = -dy, ny = dx;
    lijn(ctx, x1, y1, x2, y2, '#2b1e14', 1.6);
    lijn(ctx, x1 + nx * 0.4, y1 + ny * 0.4, x2 + nx * 0.4, y2 + ny * 0.4, 'rgba(255,255,255,0.14)', 0.4);
    // zilveren hals
    lijn(ctx, x2 - dx * 3, y2 - dy * 3, x2 - dx * 1.2, y2 - dy * 1.2, zilver, 1.8);
    // zwarte lelie
    const tx = x2 + dx * 1.4, ty = y2 + dy * 1.4;
    ovaal(ctx, tx, ty, 1.5, 1.5, '#101014');
    vlak(ctx, [[tx + dx * 2.8, ty + dy * 2.8], [tx + nx * 1.6, ty + ny * 1.6], [tx - nx * 1.6, ty - ny * 1.6]], '#101014');
    vlak(ctx, [[tx + nx * 2.4 + dx * 0.4, ty + ny * 2.4 + dy * 0.4], [tx + nx * 0.6, ty + ny * 0.6 - 0.4], [tx + nx * 0.4 - dx * 1.4, ty + ny * 0.4 - dy * 1.4]], '#101014');
    vlak(ctx, [[tx - nx * 2.4 + dx * 0.4, ty - ny * 2.4 + dy * 0.4], [tx - nx * 0.6, ty - ny * 0.6 - 0.4], [tx - nx * 0.4 - dx * 1.4, ty - ny * 0.4 - dy * 1.4]], '#101014');
    ovaal(ctx, tx - 0.4, ty - 0.4, 0.4, 0.4, 'rgba(255,255,255,0.5)');
    if (getrokken) {
      // de verborgen degen komt uit de onderkant van de stok
      return { dx, dy };
    }
  };

  if (houding === 'lopen') {
    // leunt op de scepter, grond aan de rechterkant
    staf(mx + 7.4, 34, mx + 6.8, 8 + wip, false);
    blok(ctx, mx + 4.6, 20 + wip, 2.6, 4.8, '#26262e');
    hand(ctx, mx + 6.9, 24 + wip, huid, 1.7);
    hand(ctx, mx - 3.4, 24.2 + wip, huid, 1.4);        // andere hand tegen de buik
  } else if (houding === 'hoog') {
    // scepter opgetild, de hand sluit om de hals en trekt het zilveren blad
    staf(mx + 9, 25, mx + 2.4, 2, true);
    lijn(ctx, mx + 9.2, 26, mx + 11.2, 31.6, '#c9ced6', 1.1);       // het blad komt uit het onderstuk
    lijn(ctx, mx + 9.2, 26, mx + 11.2, 31.6, 'rgba(255,255,255,0.7)', 0.4);
    blok(ctx, mx + 4, 19.6, 2.8, 4.6, '#26262e');
    hand(ctx, mx + 7.2, 24.6, huid, 1.7);
    hand(ctx, mx + 4.6, 17.8, huid, 1.5);
  } else {
    // de slag: smal zilveren zwaard, de zwarte schede in de andere hand
    lijn(ctx, mx + 4, 24, mx + 22, 18, '#2b1e14', 1.4);             // schede
    lijn(ctx, mx + 5, 22.4, mx + 23.5, 24.6, '#e6e9ee', 1.4);       // blad
    lijn(ctx, mx + 5, 22.4, mx + 23.5, 24.6, 'rgba(255,255,255,0.7)', 0.4);
    lijn(ctx, mx + 4.4, 20.4, mx + 4.4, 24.8, zilver, 1.3);         // kruis
    ovaal(ctx, mx + 4.2, 22.4, 1.2, 1.2, '#101014');
    blok(ctx, mx + 3.4, 20.4, 3, 4.4, '#26262e');
    hand(ctx, mx + 5.6, 22.6, huid, 1.7);
    hand(ctx, mx - 0.4, 24.8, huid, 1.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(mx + 4, 20, 17, -0.4, 0.7); ctx.stroke();
  }
}


// ---------- Mechteld: lang, trots, grijze vlecht, groene mantel, lange boog
function mechteld(ctx, houding, beeld) {
  const huid = '#e6cbb0';
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.8 : 0;
  const pas = vecht ? 1.3 : [0, 1.4, 0, -1.4][beeld];
  const wapper = vecht ? 0 : [0, 1.2, 0, -1.2][beeld];
  const mx = 13;
  const groen = '#3f6b3a';
  roodMantel(ctx, mx, wip, wapper, { top: 16.8, b: 4.4, len: 31 });
  benen(ctx, mx, wip, pas, { top: 28, b: 2.8, sp: 2, been: ['#3a2f22', '#44372a'], laars: '#2b2018', laarsH: 6 });
  // lange groene mantel tot de knie
  vlak(ctx, [[mx - 4.6, 17 + wip], [mx + 4.6, 17 + wip], [mx + 5.8, 30.6 + wip], [mx - 6, 30.6 + wip]], groen);
  blok(ctx, mx - 5.8, 18 + wip, 3, 12.4, 'rgba(0,0,0,0.22)');
  vlak(ctx, [[mx + 2, 17.4 + wip], [mx + 4.6, 17 + wip], [mx + 5.8, 30.6 + wip], [mx + 2.8, 30.6 + wip]], 'rgba(255,255,255,0.10)');
  lijn(ctx, mx - 6, 30.4 + wip, mx + 5.8, 30.4 + wip, '#2c4d29', 0.9);
  blok(ctx, mx - 4.4, 24.2 + wip, 8.8, 1, '#3a2a1a');
  // windkrul op de schouder
  ctx.strokeStyle = '#cfe3b6'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(mx - 3, 21.4 + wip, 1.5, 0.3, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(mx - 3, 21.4 + wip, 0.7, 0.3, Math.PI * 1.8); ctx.stroke();
  // capuchon op de schouders, rood koord
  vlak(ctx, [[mx - 5.4, 18.8 + wip], [mx - 3, 15.4 + wip], [mx + 3, 15.4 + wip], [mx + 5.4, 18.8 + wip], [mx + 3.6, 20 + wip], [mx - 3.6, 20 + wip]], tint(groen, -0.14));
  lijn(ctx, mx - 2.4, 18.6 + wip, mx + 2.4, 18.6 + wip, ROOD, 0.7);
  ovaal(ctx, mx, 19.3 + wip, 0.7, 0.7, ROOD);
  ovaal(ctx, mx - 5, 18.8 + wip, 1.8, 1.7, tint(groen, -0.2));
  ovaal(ctx, mx + 5, 18.8 + wip, 1.8, 1.7, tint(groen, 0.04));
  // hoofd: grijs haar met wind, vlecht over de rechterschouder
  const hx = mx + 0.2, hy = 11.2 + wip;
  hals(ctx, hx, hy, huid);
  ovaal(ctx, hx - 0.4, hy - 0.4, 4.6, 4.9, '#8c8c8f');
  for (const [dy, l] of [[-2, 3], [0, 4], [2, 3.4]]) lijn(ctx, hx - 4, hy + dy, hx - 4 - l, hy + dy - 0.6 + wapper * 0.2, '#a4a4a6', 0.7);
  gezicht(ctx, hx, hy, { huid, brauw: 'zwaar', mond: 'streng', holte: true, brauwKleur: '#7a7a7c' }, 3.5, 4.1);
  ovaal(ctx, hx, hy - 3.3, 4.0, 1.9, '#a2a2a4');
  ovaal(ctx, hx + 1.6, hy - 3.6, 1.8, 1, '#bcbcbe');
  for (let i = 0; i < 7; i++) ovaal(ctx, hx + 4 + Math.sin(i * 0.8) * 0.5, hy + 2 + i * 2.1, 1.2, 1.3, i % 2 ? '#8a8a8c' : '#a9a9ab');
  ovaal(ctx, hx + 4, hy + 16.4, 1.1, 0.9, ROOD);
  // de lange boog
  const boog = (cx, top, bodem, bul, trek) => {
    const mid = (top + bodem) / 2;
    ctx.strokeStyle = '#7a5532'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, top); ctx.quadraticCurveTo(cx + bul * 2, mid, cx, bodem); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx + 0.3, top); ctx.quadraticCurveTo(cx + bul * 2 + 0.3, mid, cx + 0.3, bodem); ctx.stroke();
    ctx.lineCap = 'butt';
    lijn(ctx, cx, top, cx - trek, mid, '#efe8d4', 0.45);
    lijn(ctx, cx - trek, mid, cx, bodem, '#efe8d4', 0.45);
    return [cx + bul, mid];
  };
  if (houding === 'lopen') {
    const [gx, gy] = boog(mx + 7.4, 3 + wip, 31 + wip, 2.6, 0);
    arm(ctx, mx + 5, 19 + wip, gx - 0.2, gy, tint(groen, -0.05));
    hand(ctx, gx, gy, huid, 1.5);
    hand(ctx, mx - 3.6, 24.8 + wip, huid, 1.4);
  } else if (houding === 'hoog') {
    // pees naar het oog getrokken, pijl klaar
    lijn(ctx, mx + 1.2, 19, mx + 19, 19, '#d9c9a0', 0.8);
    vlak(ctx, [[mx + 20.6, 19], [mx + 18.4, 17.9], [mx + 18.4, 20.1]], '#dfe3e8');
    vlak(ctx, [[mx + 1.2, 19], [mx + 3, 17.8], [mx + 3, 20.2]], '#b22a22');
    const [gx, gy] = boog(mx + 11.5, 7, 31, 2.6, 10.3);
    arm(ctx, mx + 5, 18.8, gx - 0.4, gy + 0.2, tint(groen, -0.05));
    hand(ctx, gx, gy, huid, 1.5);
    arm(ctx, mx - 5, 18.8, mx + 0.6, 19.6, tint(groen, -0.2));
    hand(ctx, mx + 1.2, 19.4, huid, 1.4);
  } else {
    // losgelaten: de pees recht, de hand springt terug
    const [gx, gy] = boog(mx + 11.5, 7, 31, 2.6, 0);
    arm(ctx, mx + 5, 18.8, gx - 0.4, gy + 0.2, tint(groen, -0.05));
    hand(ctx, gx, gy, huid, 1.5);
    arm(ctx, mx - 5, 18.8, mx - 1.4, 20.4, tint(groen, -0.2));
    hand(ctx, mx - 1.2, 20.4, huid, 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(mx + 17, 17.6); ctx.lineTo(mx + 22, 17.6); ctx.moveTo(mx + 17, 20.4); ctx.lineTo(mx + 23, 20.4); ctx.stroke();
  }
}

// ---------- Hademar: breed, grijs harnas, leren smidsschort, zware strijdhamer
function hademar(ctx, houding, beeld) {
  const huid = '#d8a688';
  const staal = '#8f959e', staalD = '#6b7078', leer = '#3a281a', handschoen = '#9aa0aa';
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.9 : 0;
  const pas = vecht ? 1.8 : [0, 1.7, 0, -1.7][beeld];
  const wapper = vecht ? 0 : [0, 1.1, 0, -1.1][beeld];
  const mx = 13;
  roodMantel(ctx, mx, wip, wapper, { top: 17.5, b: 6, len: 28.6 });
  benen(ctx, mx, wip, pas, { top: 26.4, b: 3.8, sp: 2.9, been: [staalD, staal], laars: '#44474d', laarsH: 4 });
  vlak(ctx, [[mx - 6.2, 18 + wip], [mx + 6.2, 18 + wip], [mx + 6.8, 25 + wip], [mx + 5.6, 28.2 + wip], [mx - 5.6, 28.2 + wip], [mx - 6.8, 25 + wip]], staal);
  blok(ctx, mx - 6.6, 18.6 + wip, 3.2, 9.4, 'rgba(0,0,0,0.22)');
  blok(ctx, mx + 4.4, 18.6 + wip, 2, 9.4, 'rgba(255,255,255,0.14)');
  lijn(ctx, mx, 18.4 + wip, mx, 23 + wip, 'rgba(0,0,0,0.25)', 0.5);
  vlak(ctx, [[mx - 4, 22.4 + wip], [mx + 4, 22.4 + wip], [mx + 5.4, 28.8 + wip], [mx - 5.4, 28.8 + wip]], leer);
  vlak(ctx, [[mx + 0.6, 22.4 + wip], [mx + 4, 22.4 + wip], [mx + 5.4, 28.8 + wip], [mx + 1, 28.8 + wip]], 'rgba(255,255,255,0.08)');
  blok(ctx, mx - 4.2, 22.2 + wip, 8.4, 1.1, '#241810');
  blok(ctx, mx + 0.6, 24.6 + wip, 2.8, 2.8, ROOD);
  lijn(ctx, mx + 0.6, 26 + wip, mx + 3.4, 26 + wip, 'rgba(0,0,0,0.35)', 0.4);
  lijn(ctx, mx + 2, 24.6 + wip, mx + 2, 27.4 + wip, 'rgba(0,0,0,0.35)', 0.4);
  for (const [dx, dy] of [[-3, 19.8], [3, 19.8], [-3, 21.2], [3, 21.2]]) ovaal(ctx, mx + dx, dy + wip, 0.35, 0.35, 'rgba(255,255,255,0.55)');
  for (const s of [-1, 1]) {
    ovaal(ctx, mx + s * 6.2, 19.4 + wip, 3.4, 2.9, s < 0 ? staalD : staal);
    lijn(ctx, mx + s * 6.2 - 2.4, 20.8 + wip, mx + s * 6.2 + 2.4, 20.8 + wip, 'rgba(0,0,0,0.3)', 0.5);
    ovaal(ctx, mx + s * 6.2 + 0.8, 18.6 + wip, 1.4, 0.8, 'rgba(255,255,255,0.3)');
  }
  const hx = mx + 0.3, hy = 11.8 + wip;
  lichtBlok(ctx, hx - 2, hy + 3, 4, 2.6, tint(huid, -0.12), 0.15);
  gezicht(ctx, hx, hy, { huid, brauw: 'zwaar', mond: 'lach', ooglid: true, brauwKleur: '#6a6a6a' }, 4.0, 4.2);
  ovaal(ctx, hx - 0.1, hy - 3.2, 4.3, 1.7, '#8a8a8a');
  ovaal(ctx, hx + 1.6, hy - 3.4, 2, 0.9, '#a6a6a6');
  ovaal(ctx, hx - 3.8, hy + 0.9, 1.3, 2.6, '#8c8c8c');
  ovaal(ctx, hx + 3.9, hy + 0.9, 1.3, 2.6, '#a0a0a0');
  ovaal(ctx, hx + 0.1, hy + 3.6, 3.4, 1.4, '#9a9a9a');
  lijn(ctx, hx - 0.8, hy + 2.9, hx + 1, hy + 2.7, '#7a3a30', 0.5);
  const hamer = (x1, y1, x2, y2) => {
    const hoek = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.cos(hoek), dy = Math.sin(hoek), nx = -dy, ny = dx;
    lijn(ctx, x1 - dx * 3, y1 - dy * 3, x2, y2, '#6b4a2b', 1.3);
    const c = [x2 + dx * 0.8, y2 + dy * 0.8];
    const P = (a, b) => [c[0] + nx * a + dx * b, c[1] + ny * a + dy * b];
    vlak(ctx, [P(4.2, -2.2), P(4.2, 2.2), P(-1.2, 2.2), P(-1.2, -2.2)], staal);
    vlak(ctx, [P(4.2, -2.2), P(4.2, 2.2), P(3, 2.2), P(3, -2.2)], 'rgba(255,255,255,0.2)');
    vlak(ctx, [P(-1.2, 2), P(-1.2, -2), P(-5.6, 0)], staalD);
    lijn(ctx, P(1, -2.2)[0], P(1, -2.2)[1], P(1, 2.2)[0], P(1, 2.2)[1], 'rgba(0,0,0,0.3)', 0.5);
  };
  if (houding === 'lopen') {
    hamer(mx - 7.4, 30, mx - 7.8, 3 + wip);
    arm(ctx, mx - 6.4, 20 + wip, mx - 7.4, 21.6 + wip, staal, 3);
    hand(ctx, mx - 7.4, 22 + wip, handschoen, 2);
    hand(ctx, mx + 5.8, 25.2 + wip, handschoen, 1.9);
  } else if (houding === 'hoog') {
    hamer(mx - 0.5, 25, mx - 10, 2);
    arm(ctx, mx + 6.4, 20, mx - 0.6, 23.2, staal, 3);
    hand(ctx, mx - 0.8, 23.4, handschoen, 2);
    arm(ctx, mx - 6.4, 20, mx - 4.2, 16.2, staal, 3);
    hand(ctx, mx - 4.2, 16, handschoen, 2);
  } else {
    hamer(mx - 1, 20, mx + 14.4, 27.4);
    arm(ctx, mx - 6.4, 20, mx - 1, 21.2, staal, 3);
    hand(ctx, mx - 0.6, 21.2, handschoen, 2);
    arm(ctx, mx + 6.4, 20, mx + 5.4, 22.8, staal, 3);
    hand(ctx, mx + 5.4, 23, handschoen, 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(mx + 2, 17, 15, -0.9, 0.9); ctx.stroke();
  }
}

// ---------- Brandt: pezig, groene kap met rode veer, vachtmantel, jachtspies
function brandt(ctx, houding, beeld) {
  const huid = '#c79f7d';
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.8 : 0;
  const pas = vecht ? 1.8 : [0, 1.8, 0, -1.8][beeld];
  const wapper = vecht ? 0 : [0, 1.3, 0, -1.3][beeld];
  const mx = 13;
  const kap = '#2f4a2a', vacht = '#5a493a', vachtD = '#3b2f25';
  const lees = houding === 'slag' ? 1.6 : 1;
  roodMantel(ctx, mx, wip, wapper, { top: 17.5, b: 5, len: 29.5 });
  benen(ctx, mx, wip, pas, { top: 26, b: 2.6, sp: 2.2, been: ['#3a3926', '#46442e'], laars: '#2a2218', laarsH: 5 });
  // wambuis en vachtmantel
  lichtBlok(ctx, mx - 3.8 + lees * 0.3, 17.8 + wip, 7.6, 9, kap, 0.22);
  blok(ctx, mx - 3.9, 24.2 + wip, 7.8, 1, '#2a1a0e');
  vlak(ctx, [[mx - 6.8, 17.6 + wip], [mx + 6.8, 17.6 + wip], [mx + 7.4, 25 + wip], [mx - 7.4, 25 + wip]], vachtD);
  for (let i = 0; i < 9; i++) ovaal(ctx, mx - 6.8 + i * 1.7, 18.6 + wip + (i % 2) * 0.8, 1.7, 2.3, i % 3 ? vacht : vachtD);
  for (let i = 0; i < 8; i++) vlak(ctx, [[mx - 7 + i * 1.8, 24.6 + wip], [mx - 6 + i * 1.8, 27.4 + wip + (i % 2) * 0.9], [mx - 5 + i * 1.8, 24.6 + wip]], i % 2 ? vacht : vachtD);
  blok(ctx, mx - 7.4, 19 + wip, 3, 6, 'rgba(0,0,0,0.2)');
  blok(ctx, mx + 4.6, 19 + wip, 2.4, 6, 'rgba(255,255,255,0.08)');
  // kap, gezicht, rode veer
  const hx = mx + 0.6 + lees * 0.5, hy = 12 + wip;
  ovaal(ctx, hx, hy - 0.4, 5.1, 5.3, kap);
  vlak(ctx, [[hx - 4, hy - 3], [hx - 1, hy - 8.4], [hx + 3, hy - 3.6]], kap);
  gezicht(ctx, hx, hy, { huid, brauw: 'zwaar', mond: 'streng', holte: true, litteken: true, stoppels: true, brauwKleur: '#2a2018' }, 3.3, 4.1);
  ovaal(ctx, hx, hy - 3.3, 4.2, 1.8, kap);
  ovaal(ctx, hx - 4, hy + 0.6, 1.5, 3.7, tint(kap, -0.15));
  ovaal(ctx, hx + 4, hy + 0.6, 1.4, 3.7, tint(kap, 0.04));
  vlak(ctx, [[hx + 1.2, hy - 4.6], [hx + 5.4, hy - 9.4 + wapper * 0.2], [hx + 4.6, hy - 5.4], [hx + 2.6, hy - 3.8]], ROOD);
  lijn(ctx, hx + 1.4, hy - 4.4, hx + 5, hy - 9, 'rgba(0,0,0,0.3)', 0.4);
  const spies = (x1, y1, x2, y2) => {
    const hoek = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.cos(hoek), dy = Math.sin(hoek), nx = -dy, ny = dx;
    lijn(ctx, x1 - dx * 3, y1 - dy * 3, x2, y2, '#6b4a2b', 1.2);
    const P = (a, b) => [x2 + nx * a + dx * b, y2 + ny * a + dy * b];
    vlak(ctx, [P(0, 5.4), P(1.7, 1.6), P(0, -0.4), P(-1.7, 1.6)], '#e1e5ea');
    lijn(ctx, P(0, 5.2)[0], P(0, 5.2)[1], P(0, 0)[0], P(0, 0)[1], 'rgba(120,130,140,0.7)', 0.4);
    lijn(ctx, P(-2.8, -0.4)[0], P(-2.8, -0.4)[1], P(2.8, -0.4)[0], P(2.8, -0.4)[1], '#7a5532', 1);   // dwarsstuk
  };
  if (houding === 'lopen') {
    spies(mx + 4.8, 30, mx + 8.2, 1.6 + wip);
    arm(ctx, mx + 5.2, 19.4 + wip, mx + 5.6, 23 + wip, kap, 2.4);
    hand(ctx, mx + 5.6, 23.4 + wip, huid, 1.5);
    hand(ctx, mx - 4.4, 25.2 + wip, huid, 1.4);
  } else if (houding === 'hoog') {
    spies(mx - 1, 25, mx + 10.4, 8);
    arm(ctx, mx + 5.2, 19.6, mx + 3.6, 22.6, kap, 2.4);
    hand(ctx, mx + 3.4, 22.8, huid, 1.5);
    arm(ctx, mx - 4.6, 19.6, mx - 1.6, 23.8, kap, 2.4);
    hand(ctx, mx - 1.6, 24, huid, 1.4);
  } else {
    spies(mx - 4, 22.4, mx + 19.4, 20.4);
    arm(ctx, mx + 5, 19.6, mx + 5.6, 22.6, kap, 2.4);
    hand(ctx, mx + 5.8, 22.4, huid, 1.5);
    arm(ctx, mx - 4.6, 19.6, mx - 1.2, 22.8, kap, 2.4);
    hand(ctx, mx - 1, 22.8, huid, 1.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(mx + 8, 18); ctx.lineTo(mx + 14, 17.2); ctx.moveTo(mx + 8, 24); ctx.lineTo(mx + 14, 23); ctx.stroke();
  }
}

// ---------- Aleid: rechtop, helm met hoge kuif, wit tabbaard met rood, torenschild en slagzwaard
function aleid(ctx, houding, beeld) {
  const huid = '#e1c0a0';
  const staal = '#c3c8d0', staalD = '#9aa0aa', wit = '#ece8de';
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.7 : 0;
  const pas = vecht ? 1.6 : [0, 1.6, 0, -1.6][beeld];
  const wapper = vecht ? 0 : [0, 1.1, 0, -1.1][beeld];
  const mx = 13;
  roodMantel(ctx, mx, wip, wapper, { top: 16.8, b: 4.6, len: 30 });
  benen(ctx, mx, wip, pas, { top: 28, b: 3, sp: 2.2, been: [staalD, staal], laars: '#4a4d54', laarsH: 5 });
  // wit tabbaard met rode rand en een rode Y
  vlak(ctx, [[mx - 4.8, 17 + wip], [mx + 4.8, 17 + wip], [mx + 5.2, 30 + wip], [mx - 5.2, 30 + wip]], wit);
  blok(ctx, mx - 5, 18 + wip, 2.6, 12, 'rgba(0,0,0,0.14)');
  blok(ctx, mx + 3.4, 18 + wip, 1.8, 12, 'rgba(255,255,255,0.25)');
  lijn(ctx, mx - 4.8, 17.4 + wip, mx - 5.2, 30 + wip, ROOD, 0.9);
  lijn(ctx, mx + 4.8, 17.4 + wip, mx + 5.2, 30 + wip, ROOD, 0.9);
  lijn(ctx, mx - 5.2, 29.8 + wip, mx + 5.2, 29.8 + wip, ROOD, 1);
  lijn(ctx, mx, 22 + wip, mx, 29.6 + wip, ROOD, 1.5);
  lijn(ctx, mx, 22 + wip, mx - 3.4, 18 + wip, ROOD, 1.2);
  lijn(ctx, mx, 22 + wip, mx + 3.4, 18 + wip, ROOD, 1.2);
  blok(ctx, mx - 4.8, 24.4 + wip, 9.6, 0.9, '#4a3a28');
  // staal om de nek en schouders
  vlak(ctx, [[mx - 4.4, 17.4 + wip], [mx + 4.4, 17.4 + wip], [mx + 3.2, 19.2 + wip], [mx - 3.2, 19.2 + wip]], staal);
  for (const s of [-1, 1]) {
    ovaal(ctx, mx + s * 5.4, 18.9 + wip, 2.8, 2.4, s < 0 ? staalD : staal);
    ovaal(ctx, mx + s * 5.4 + 0.6, 18.2 + wip, 1.1, 0.6, 'rgba(255,255,255,0.45)');
    lijn(ctx, mx + s * 5.4 - 2, 20 + wip, mx + s * 5.4 + 2, 20 + wip, 'rgba(0,0,0,0.25)', 0.5);
  }
  const hx = mx + 0.3, hy = 11 + wip;
  lichtBlok(ctx, hx - 1.4, hy + 3.2, 2.8, 2.2, tint(huid, -0.1), 0.15);
  gezicht(ctx, hx, hy, { huid, brauw: 'recht', mond: 'streng', brauwKleur: '#3a2e24' }, 3.5, 4);
  // helm met hoge kuif
  ovaal(ctx, hx, hy - 2.2, 4.6, 3.1, staal);
  blok(ctx, hx - 4.6, hy - 2.6, 9.2, 0.9, staalD);
  blok(ctx, hx - 4.6, hy - 2.6, 3, 1.1, 'rgba(0,0,0,0.2)');
  lijn(ctx, hx + 0.2, hy - 2.6, hx + 0.2, hy + 1.4, staalD, 0.7);    // neusbeschermer
  vlak(ctx, [[hx - 3.8, hy - 4.2], [hx - 1.6, hy - 9.8], [hx + 1.4, hy - 10.6], [hx + 3.2, hy - 4.6]], staal);
  vlak(ctx, [[hx + 0.4, hy - 10.2], [hx + 1.4, hy - 10.6], [hx + 3.2, hy - 4.6], [hx + 1.2, hy - 4.8]], 'rgba(255,255,255,0.3)');
  vlak(ctx, [[hx - 3.8, hy - 4.2], [hx - 1.6, hy - 9.8], [hx - 0.4, hy - 9.8], [hx - 1.4, hy - 4.4]], 'rgba(0,0,0,0.22)');
  // torenschild links
  const schild = (sx, sy, dy) => {
    const P = [[sx - 3.8, sy - 6.2], [sx + 3.8, sy - 6.2], [sx + 3.8, sy + 3.4], [sx, sy + 6.6 + dy], [sx - 3.8, sy + 3.4]];
    vlak(ctx, P, '#3a3a40');
    vlak(ctx, [[sx - 3.2, sy - 5.6], [sx + 3.2, sy - 5.6], [sx + 3.2, sy + 3.1], [sx, sy + 5.8 + dy], [sx - 3.2, sy + 3.1]], wit);
    vlak(ctx, [[sx - 3.2, sy - 5.6], [sx - 1.4, sy - 5.6], [sx - 1.4, sy + 4.4], [sx - 3.2, sy + 3.1]], 'rgba(0,0,0,0.12)');
    lijn(ctx, sx - 3.2, sy - 5.6, sx + 3.2, sy - 5.6, ROOD, 0.9);
    lijn(ctx, sx, sy - 5.6, sx, sy + 5, ROOD, 1.4);
    lijn(ctx, sx - 3, sy - 1.2, sx + 3, sy - 1.2, ROOD, 1.1);
    ovaal(ctx, sx, sy - 1.2, 1, 1, staal);
  };
  const zwaard = (x1, y1, x2, y2) => {
    const hoek = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.cos(hoek), dy = Math.sin(hoek), nx = -dy, ny = dx;
    lijn(ctx, x1, y1, x2, y2, '#e6e9ee', 1.6);
    lijn(ctx, x1, y1, x2, y2, 'rgba(255,255,255,0.7)', 0.5);
    lijn(ctx, x1 - nx * 2.5, y1 - ny * 2.5, x1 + nx * 2.5, y1 + ny * 2.5, '#e3c04a', 1.2);
    lijn(ctx, x1, y1, x1 - dx * 3, y1 - dy * 3, '#5a3d22', 1.4);
    ovaal(ctx, x1 - dx * 3.4, y1 - dy * 3.4, 0.8, 0.8, '#e3c04a');
  };
  if (houding === 'lopen') {
    schild(mx - 6.8, 23.2 + wip, 0);
    hand(ctx, mx - 4.6, 24 + wip, staalD, 1.6);
    zwaard(mx + 6, 22 + wip, mx + 9.6, 5 + wip);
    arm(ctx, mx + 5.4, 19.6 + wip, mx + 6, 22 + wip, staal, 2.6);
    hand(ctx, mx + 6, 22.4 + wip, staalD, 1.7);
  } else if (houding === 'hoog') {
    schild(mx - 5.6, 21.6, 0);
    hand(ctx, mx - 4, 22.4, staalD, 1.6);
    zwaard(mx + 5, 15.4, mx + 7.4, -3);
    arm(ctx, mx + 5.4, 19.6, mx + 5, 15.8, staal, 2.6);
    hand(ctx, mx + 5, 15.6, staalD, 1.7);
  } else {
    schild(mx - 4.4, 22, 0);
    hand(ctx, mx - 3.2, 22.6, staalD, 1.6);
    zwaard(mx + 5, 20, mx + 22.6, 25.6);
    arm(ctx, mx + 5.4, 19.6, mx + 5.2, 20.4, staal, 2.6);
    hand(ctx, mx + 5.4, 20.4, staalD, 1.7);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(mx + 4, 17, 15, -1.2, 0.4); ctx.stroke();
  }
}

// ---------- Everhard: schraal, stijf, grijze wollen mantel, ronde brilletjes, zegels, hellebaard
function everhard(ctx, houding, beeld) {
  const huid = '#d8bda6';
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.5 : 0;
  const pas = vecht ? 1.3 : [0, 1.3, 0, -1.3][beeld];
  const wapper = vecht ? 0 : [0, 1, 0, -1][beeld];
  const mx = 13;
  const wol = '#7a7a78', wolD = '#5c5c5b';
  roodMantel(ctx, mx, wip, wapper, { top: 17.5, b: 7.6, len: 31.4 });
  benen(ctx, mx, wip, pas, { top: 29, b: 2.8, sp: 2.2, been: ['#4a4a4c', '#555558'], laars: '#2a2a2e', laarsH: 4 });
  // wijde mantel met kap-kraag
  vlak(ctx, [[mx - 5.6, 17.4 + wip], [mx + 5.6, 17.4 + wip], [mx + 7.6, 30.6 + wip], [mx - 7.6, 30.6 + wip]], wol);
  blok(ctx, mx - 7.4, 19 + wip, 3.4, 11.6, 'rgba(0,0,0,0.2)');
  vlak(ctx, [[mx + 2.4, 18 + wip], [mx + 5.6, 17.4 + wip], [mx + 7.6, 30.6 + wip], [mx + 3.2, 30.6 + wip]], 'rgba(255,255,255,0.10)');
  for (const f of [-0.5, 0, 0.5]) lijn(ctx, mx + f * 5, 21 + wip, mx + f * 7.4, 30.2 + wip, 'rgba(0,0,0,0.18)', 0.5);
  lijn(ctx, mx - 7.6, 30.4 + wip, mx + 7.6, 30.4 + wip, wolD, 0.9);
  ovaal(ctx, mx, 18.2 + wip, 5.6, 2.2, wolD);
  ovaal(ctx, mx + 1.6, 18 + wip, 3.4, 1.2, 'rgba(255,255,255,0.1)');
  // rood zegel op de mantel
  ovaal(ctx, mx + 2.4, 22.4 + wip, 1.4, 1.4, ROOD);
  ovaal(ctx, mx + 2, 22 + wip, 0.5, 0.5, 'rgba(255,255,255,0.5)');
  // riem met ring van zegels
  blok(ctx, mx - 5.4, 25.4 + wip, 10.8, 0.9, '#2a2a2e');
  ctx.strokeStyle = '#a8a8ac'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(mx - 3.4, 27 + wip, 1.1, 0, Math.PI * 2); ctx.stroke();
  [['#c23a2e', -4.4], ['#d4b24a', -3.2], ['#4f7a4a', -2.4]].forEach(([k, dx]) => ovaal(ctx, mx + dx, 28.6 + wip + (dx === -3.2 ? 0.8 : 0), 0.7, 0.9, k));
  const hx = mx + 0.2, hy = 12.2 + wip;
  hals(ctx, hx, hy, huid);
  gezicht(ctx, hx, hy, { huid, brauw: 'recht', mond: 'streng', bril: true, holte: true, brauwKleur: '#7a7a7e' }, 3.2, 4.2);
  ovaal(ctx, hx, hy - 3.4, 3.8, 1.5, '#9a9aa0');
  ovaal(ctx, hx - 3.4, hy - 1.2, 1, 2, '#8c8c92');
  ovaal(ctx, hx + 3.2, hy - 1.2, 0.9, 1.8, '#a8a8ae');
  const hellebaard = (x1, y1, x2, y2) => {
    const hoek = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.cos(hoek), dy = Math.sin(hoek), nx = -dy, ny = dx;
    lijn(ctx, x1 - dx * 3, y1 - dy * 3, x2, y2, '#5a3d22', 1.3);
    const P = (a, b) => [x2 + nx * a + dx * b, y2 + ny * a + dy * b];
    vlak(ctx, [P(0, 4.6), P(1.1, 1.2), P(-1.1, 1.2)], '#dfe3e8');                          // punt
    vlak(ctx, [P(0, 1.4), P(4.6, 2.2), P(4.4, -2.8), P(0, -1.4)], '#d3d7dd');              // bijlblad
    vlak(ctx, [P(0, 1.4), P(4.6, 2.2), P(3.8, 0.4), P(0, 0.2)], 'rgba(255,255,255,0.3)');
    vlak(ctx, [P(0, -0.4), P(-3.4, -0.2), P(0, 0.9)], '#aeb3ba');                            // haak
    lijn(ctx, P(0, 1.6)[0], P(0, 1.6)[1], P(0, -1.4)[0], P(0, -1.4)[1], '#8b9099', 0.8);
  };
  if (houding === 'lopen') {
    hellebaard(mx + 7, 34, mx + 6.6, 3.8 + wip);
    arm(ctx, mx + 5, 19.6 + wip, mx + 6.6, 23 + wip, wol, 2.6);
    hand(ctx, mx + 6.8, 23.4 + wip, huid, 1.5);
    hand(ctx, mx - 3.6, 26 + wip, huid, 1.4);
  } else if (houding === 'hoog') {
    hellebaard(mx + 2, 24, mx + 9.6, 0.4);
    arm(ctx, mx + 5, 19.8, mx + 3.2, 22.6, wol, 2.6);
    hand(ctx, mx + 3, 22.8, huid, 1.5);
    arm(ctx, mx - 5, 19.8, mx + 1, 17.6, wol, 2.6);
    hand(ctx, mx + 1.4, 17.4, huid, 1.5);
  } else {
    hellebaard(mx + 2, 17, mx + 18, 28.6);
    arm(ctx, mx - 5, 19.8, mx + 1, 20.2, wol, 2.6);
    hand(ctx, mx + 1.4, 20.2, huid, 1.5);
    arm(ctx, mx + 5, 19.8, mx + 5.4, 22.8, wol, 2.6);
    hand(ctx, mx + 5.4, 23, huid, 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(mx + 3, 15, 16, -0.6, 0.9); ctx.stroke();
  }
}

// ---------- Rutger: zwaar, rond gezicht, geteerde mantel met hoge kraag, lange boothaak
function rutger(ctx, houding, beeld) {
  const huid = '#d2a68c';
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.9 : 0;
  const pas = vecht ? 1.8 : [0, 1.7, 0, -1.7][beeld];
  const wapper = vecht ? 0 : [0, 1.1, 0, -1.1][beeld];
  const mx = 13;
  const teer = '#2f2b29', blauw = '#4f6272';
  roodMantel(ctx, mx, wip, wapper, { top: 17.5, b: 7.4, len: 30.4 });
  benen(ctx, mx, wip, pas, { top: 27, b: 4, sp: 2.7, been: [tint(blauw, -0.25), tint(blauw, -0.1)], laars: '#26221f', laarsH: 7.4 });
  // blauwgrijze tuniek onder de geteerde mantel
  vlak(ctx, [[mx - 5.6, 24 + wip], [mx + 5.6, 24 + wip], [mx + 6, 29.4 + wip], [mx - 6, 29.4 + wip]], blauw);
  vlak(ctx, [[mx - 6.2, 18.4 + wip], [mx + 6.2, 18.4 + wip], [mx + 7, 25 + wip], [mx + 6.2, 27.2 + wip], [mx - 6.2, 27.2 + wip], [mx - 7, 25 + wip]], teer);
  blok(ctx, mx - 6.8, 19 + wip, 3.2, 8, 'rgba(0,0,0,0.3)');
  blok(ctx, mx + 4.4, 19 + wip, 2.4, 8, 'rgba(255,255,255,0.1)');
  lijn(ctx, mx, 19.8 + wip, mx, 27 + wip, 'rgba(255,255,255,0.12)', 0.5);
  for (const dy of [21.6, 24]) ovaal(ctx, mx, dy + wip, 0.5, 0.5, '#8a8a8e');
  lijn(ctx, mx - 6.6, 26.6 + wip, mx + 6.6, 26.6 + wip, '#8f9cab', 0.8);        // lichte zoom
  // hoge kraag
  vlak(ctx, [[mx - 5.8, 18.6 + wip], [mx - 4.6, 14.2 + wip], [mx - 2, 17 + wip], [mx + 2, 17 + wip], [mx + 4.6, 14.2 + wip], [mx + 5.8, 18.6 + wip], [mx + 3, 20 + wip], [mx - 3, 20 + wip]], tint(teer, 0.06));
  lijn(ctx, mx - 4.6, 14.4 + wip, mx - 2, 17 + wip, 'rgba(255,255,255,0.15)', 0.5);
  const hx = mx + 0.2, hy = 12.4 + wip;
  ovaal(ctx, hx, hy + 3, 2.6, 1.6, tint(huid, -0.15));
  gezicht(ctx, hx, hy, { huid, brauw: 'moe', mond: 'neer', brauwKleur: '#8a8a8a' }, 4.3, 4.4);
  ovaal(ctx, hx - 0.2, hy - 3.2, 4.5, 1.8, '#787878');
  ovaal(ctx, hx - 4, hy - 0.8, 1.2, 2.2, '#6c6c6c');
  ovaal(ctx, hx + 4, hy - 0.8, 1.1, 2.1, '#8c8c8c');
  ovaal(ctx, hx - 3.6, hy + 2.2, 1.3, 2.4, '#9a9a9a');
  ovaal(ctx, hx + 3.7, hy + 2.2, 1.2, 2.3, '#b0b0b0');
  ovaal(ctx, hx + 0.1, hy + 4.2, 2.6, 1, '#a4a4a4');
  lijn(ctx, hx - 0.9, hy + 3.2, hx + 1, hy + 3.2, '#6a3a34', 0.5);
  const haak = (x1, y1, x2, y2) => {
    const hoek = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.cos(hoek), dy = Math.sin(hoek), nx = -dy, ny = dx;
    lijn(ctx, x1 - dx * 3, y1 - dy * 3, x2, y2, '#6b4a2b', 1.4);
    // ijzeren haak: boog die omkeert
    ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(x2 + dx * 1.6, y2 + dy * 1.6);
    ctx.quadraticCurveTo(x2 + dx * 3.6 + nx * 4, y2 + dy * 3.6 + ny * 4, x2 + dx * 1 + nx * 3.4, y2 + dy * 1 + ny * 3.4);
    ctx.stroke(); ctx.lineCap = 'butt';
    lijn(ctx, x2 + dx * 1.2 + nx * 3.4, y2 + dy * 1.2 + ny * 3.4, x2 + dx * 2.2 + nx * 3.8, y2 + dy * 2.2 + ny * 3.8, '#c9ced4', 0.7);
    // rood koord
    for (let i = 0; i < 3; i++) lijn(ctx, x2 - dx * (2 + i * 1.2) - nx * 0.9, y2 - dy * (2 + i * 1.2) - ny * 0.9, x2 - dx * (2.6 + i * 1.2) + nx * 0.9, y2 - dy * (2.6 + i * 1.2) + ny * 0.9, ROOD, 0.7);
  };
  if (houding === 'lopen') {
    haak(mx + 7.6, 34, mx + 4, 3 + wip);
    arm(ctx, mx + 5.6, 19.8 + wip, mx + 6.6, 24 + wip, teer, 3);
    hand(ctx, mx + 6.6, 24.4 + wip, huid, 1.8);
    hand(ctx, mx - 5, 26 + wip, huid, 1.7);
  } else if (houding === 'hoog') {
    haak(mx + 1.6, 25, mx + 10, 5);
    arm(ctx, mx + 5.6, 19.8, mx + 3.4, 22.6, teer, 3);
    hand(ctx, mx + 3.2, 22.8, huid, 1.8);
    arm(ctx, mx - 5.6, 19.8, mx - 0.6, 23.8, teer, 3);
    hand(ctx, mx - 0.4, 24, huid, 1.8);
  } else {
    haak(mx - 2, 20, mx + 17, 24.4);
    arm(ctx, mx - 5.6, 19.8, mx - 1.4, 20.8, teer, 3);
    hand(ctx, mx - 1.2, 20.8, huid, 1.8);
    arm(ctx, mx + 5.6, 19.8, mx + 5.6, 22.6, teer, 3);
    hand(ctx, mx + 5.6, 22.8, huid, 1.8);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(mx + 3, 15, 16, -0.5, 1); ctx.stroke();
  }
}

// ---------- Valkenier: elegant, zwart en zilver, valk op de borst, rode sjerp, zwaard en parerdolk
function valkenier(ctx, houding, beeld) {
  const huid = '#e0c3a8';
  const zwart = '#1f1f25', zilver = '#b9bfc8';
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.7 : 0;
  const pas = vecht ? 1.7 : [0, 1.7, 0, -1.7][beeld];
  const wapper = vecht ? 0 : [0, 1.2, 0, -1.2][beeld];
  const mx = 13;
  roodMantel(ctx, mx, wip, wapper, { top: 17, b: 4.4, len: 30 });
  benen(ctx, mx, wip, pas, { top: 26.6, b: 3, sp: 2.2, been: ['#26262c', '#303037'], laars: '#17171b', laarsH: 5 });
  for (const [dx, k] of [[-2.2 + pas * 0.5, 0], [2.2 - pas * 0.5, 1]]) ovaal(ctx, mx + dx, 28.4 + wip, 1.1, 0.8, zilver);
  // zwart harnas met zilveren rand
  vlak(ctx, [[mx - 5, 17.6 + wip], [mx + 5, 17.6 + wip], [mx + 5.2, 25 + wip], [mx + 4.6, 28.6 + wip], [mx - 4.6, 28.6 + wip], [mx - 5.2, 25 + wip]], zwart);
  blok(ctx, mx - 5.2, 18.4 + wip, 2.6, 10, 'rgba(0,0,0,0.3)');
  blok(ctx, mx + 3.4, 18.4 + wip, 1.8, 10, 'rgba(255,255,255,0.12)');
  lijn(ctx, mx - 4.6, 28.4 + wip, mx + 4.6, 28.4 + wip, zilver, 0.8);
  lijn(ctx, mx - 5, 18 + wip, mx + 5, 18 + wip, zilver, 0.7);
  blok(ctx, mx - 4.8, 24.2 + wip, 9.6, 1, '#4a4a54');
  // valk op de borst: zilveren vleugels
  vlak(ctx, [[mx, 21.6 + wip], [mx - 3.2, 19.6 + wip], [mx - 1.6, 22 + wip], [mx, 23.6 + wip], [mx + 1.6, 22 + wip], [mx + 3.2, 19.6 + wip]], zilver);
  ovaal(ctx, mx, 20.6 + wip, 0.7, 0.8, zilver);
  // schouders
  for (const s of [-1, 1]) {
    ovaal(ctx, mx + s * 5.4, 19 + wip, 2.8, 2.4, zwart);
    ctx.strokeStyle = zilver; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.ellipse(mx + s * 5.4, 19 + wip, 2.8, 2.4, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    ovaal(ctx, mx + s * 5.4 + 0.5, 18.2 + wip, 1.1, 0.6, 'rgba(255,255,255,0.22)');
  }
  // rode sjerp schuin over de borst
  vlak(ctx, [[mx + 2.4, 17.6 + wip], [mx + 5, 17.6 + wip], [mx - 3, 27.4 + wip], [mx - 5.4, 27 + wip]], ROOD);
  vlak(ctx, [[mx + 3.8, 17.6 + wip], [mx + 5, 17.6 + wip], [mx - 3, 27.4 + wip], [mx - 4, 27.2 + wip]], 'rgba(255,255,255,0.14)');
  vlak(ctx, [[mx - 5.4, 27 + wip], [mx - 3, 27.4 + wip], [mx - 3.4 - wapper * 0.3, 30.6 + wip], [mx - 5.6 - wapper * 0.3, 30.2 + wip]], tint(ROOD, -0.18));
  const hx = mx + 0.3, hy = 11.4 + wip;
  hals(ctx, hx, hy, huid);
  gezicht(ctx, hx, hy, { huid, brauw: 'recht', mond: 'streng', brauwKleur: '#6a6a72' }, 3.4, 4.1);
  ovaal(ctx, hx - 0.2, hy - 3.3, 4.0, 1.8, '#8f8f98');
  ovaal(ctx, hx + 1.5, hy - 3.6, 2, 1, '#c4c4cc');
  ovaal(ctx, hx - 3.5, hy - 1.2, 1, 1.8, '#7a7a84');
  ovaal(ctx, hx + 3.3, hy - 1.2, 0.9, 1.7, '#a6a6b0');
  const zwaard = (x1, y1, x2, y2) => {
    const hoek = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.cos(hoek), dy = Math.sin(hoek), nx = -dy, ny = dx;
    lijn(ctx, x1, y1, x2, y2, '#e6e9ee', 1.5);
    lijn(ctx, x1, y1, x2, y2, 'rgba(255,255,255,0.7)', 0.45);
    lijn(ctx, x1 - nx * 2.8, y1 - ny * 2.8, x1 + nx * 2.8, y1 + ny * 2.8, zilver, 1.2);
    lijn(ctx, x1, y1, x1 - dx * 3.2, y1 - dy * 3.2, '#2a2a30', 1.4);
    ovaal(ctx, x1 - dx * 3.6, y1 - dy * 3.6, 0.8, 0.8, zilver);
  };
  const dolk = (x, y, hoek) => {
    const dx = Math.cos(hoek), dy = Math.sin(hoek);
    lijn(ctx, x, y, x + dx * 5, y + dy * 5, '#dfe3e8', 1);
    lijn(ctx, x - dy * 1.3, y + dx * 1.3, x + dy * 1.3, y - dx * 1.3, zilver, 0.9);
    lijn(ctx, x, y, x - dx * 2, y - dy * 2, '#2a2a30', 1.1);
  };
  if (houding === 'lopen') {
    zwaard(mx + 6.4, 23 + wip, mx + 8.6, 3 + wip);
    arm(ctx, mx + 5.4, 19.8 + wip, mx + 6.4, 23 + wip, zwart, 2.6);
    hand(ctx, mx + 6.4, 23.4 + wip, '#3a3a44', 1.7);
    lijn(ctx, mx - 5, 25.2 + wip, mx - 6.6, 29 + wip, '#2a2a30', 1.2);      // de parerdolk aan de riem
    lijn(ctx, mx - 6.2, 25.6 + wip, mx - 4.2, 24.6 + wip, zilver, 0.9);
    hand(ctx, mx - 5, 24.6 + wip, '#3a3a44', 1.4);
  } else if (houding === 'hoog') {
    zwaard(mx + 5, 17, mx + 12.4, 0.4);
    arm(ctx, mx + 5.4, 19.6, mx + 5.2, 17.4, zwart, 2.6);
    hand(ctx, mx + 5, 17.2, '#3a3a44', 1.7);
    arm(ctx, mx - 5.4, 19.6, mx - 6.4, 23, zwart, 2.6);
    dolk(mx - 6.4, 23.2, -Math.PI / 2 - 0.3);
    hand(ctx, mx - 6.4, 23.2, '#3a3a44', 1.5);
  } else {
    zwaard(mx + 5, 21, mx + 23.4, 21.6);
    arm(ctx, mx + 5.4, 19.8, mx + 5.2, 21.2, zwart, 2.6);
    hand(ctx, mx + 5.2, 21.2, '#3a3a44', 1.7);
    arm(ctx, mx - 5.4, 19.8, mx - 1.6, 23.2, zwart, 2.6);
    dolk(mx - 1.4, 23.2, -0.3);
    hand(ctx, mx - 1.4, 23.4, '#3a3a44', 1.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(mx + 3, 18, 18, -0.55, 0.45); ctx.stroke();
  }
}

// ---------- De koning (jouw blauwe koning, en de rode in vrij spel): geen kroon, wel een
// bontkraag, een gouden speld, bruin haar en baard, zwaard en schild in teamkleur.
function koning(ctx, houding, beeld, def = {}) {
  const K = def.kleur || '#2f5fc4';
  const goud = def.wapen && def.wapen !== '#1d1d22' ? def.wapen : '#e3c04a';
  const huid = '#e1c0a0';
  const staal = '#c3c8d0', staalD = '#9aa0aa';
  const haar = '#4a2f1c';
  const vecht = houding !== 'lopen';
  const wip = !vecht && beeld % 2 ? -0.7 : 0;
  const pas = vecht ? 1.6 : [0, 1.6, 0, -1.6][beeld];
  const wapper = vecht ? 0 : [0, 1.1, 0, -1.1][beeld];
  const mx = 13;
  const donker = tint(K, -0.3);
  // lange mantel achter de schouders
  vlak(ctx, [[mx - 5, 16.8 + wip], [mx + 5, 16.8 + wip], [mx + 5.4 - wapper, 31.4], [mx - 7.4 - wapper, 31.8]], donker);
  vlak(ctx, [[mx + 1, 17 + wip], [mx + 5, 16.8 + wip], [mx + 5.4 - wapper, 31.4], [mx + 1.4 - wapper, 31.6]], 'rgba(255,255,255,0.10)');
  lijn(ctx, mx - 7.4 - wapper, 31.6, mx + 5.4 - wapper, 31.2, goud, 0.8);
  benen(ctx, mx, wip, pas, { top: 28, b: 3, sp: 2.2, been: ['#3a3a44', '#4a4a56'], laars: '#2a2220', laarsH: 5 });
  // rok in teamkleur met gouden zoom en riem
  vlak(ctx, [[mx - 4.8, 17 + wip], [mx + 4.8, 17 + wip], [mx + 5.2, 30 + wip], [mx - 5.2, 30 + wip]], K);
  blok(ctx, mx - 5, 18 + wip, 2.6, 12, 'rgba(0,0,0,0.2)');
  blok(ctx, mx + 3.4, 18 + wip, 1.8, 12, 'rgba(255,255,255,0.18)');
  lijn(ctx, mx - 5.2, 29.7 + wip, mx + 5.2, 29.7 + wip, goud, 1.1);
  lijn(ctx, mx - 4.8, 17.4 + wip, mx - 5.2, 30 + wip, goud, 0.7);
  lijn(ctx, mx + 4.8, 17.4 + wip, mx + 5.2, 30 + wip, goud, 0.7);
  blok(ctx, mx - 4.8, 24.2 + wip, 9.6, 1.3, '#3a2a1a');
  blok(ctx, mx - 1, 24 + wip, 2, 1.7, goud);
  // bontkraag met zwarte spikkels
  ovaal(ctx, mx, 17.8 + wip, 5.6, 2.4, '#efece4');
  for (const dx of [-3.6, -1.6, 0.6, 2.6, 4]) ovaal(ctx, mx + dx, 18.2 + wip, 0.5, 0.8, '#2a2a30');
  ovaal(ctx, mx + 2.6, 17.2 + wip, 2.4, 0.8, 'rgba(255,255,255,0.5)');
  ovaal(ctx, mx, 18.6 + wip, 1, 1, goud);
  // schouders van staal
  for (const sg of [-1, 1]) {
    ovaal(ctx, mx + sg * 5.6, 19.2 + wip, 2.7, 2.3, sg < 0 ? staalD : staal);
    ovaal(ctx, mx + sg * 5.6 + 0.6, 18.5 + wip, 1, 0.6, 'rgba(255,255,255,0.45)');
  }
  // rouwband om de linkerarm
  if (def.rouwband) blok(ctx, mx - 7.9, 21.4 + wip, 2.8, 1.5, '#1d1d22');
  // hoofd: bruin haar, baard
  const hx = mx + 0.3, hy = 11 + wip;
  lichtBlok(ctx, hx - 1.4, hy + 3.2, 2.8, 2.2, tint(huid, -0.1), 0.15);
  vlak(ctx, [[hx - 3.8, hy + 0.6], [hx + 3.8, hy + 0.6], [hx + 3, hy + 5.4], [hx, hy + 7.4], [hx - 3, hy + 5.4]], haar);
  gezicht(ctx, hx, hy, { huid, brauw: 'zwaar', mond: 'streng', brauwKleur: '#2a1a10' }, 3.5, 4);
  vlak(ctx, [[hx - 2.6, hy + 2.4], [hx + 2.6, hy + 2.4], [hx + 1.8, hy + 5.4], [hx, hy + 6.6], [hx - 1.8, hy + 5.4]], haar);
  lijn(ctx, hx - 1, hy + 3.1, hx + 1.2, hy + 3.1, '#7a3a30', 0.55);
  ovaal(ctx, hx, hy - 2.6, 4.5, 3.2, haar);
  vlak(ctx, [[hx - 4.4, hy - 1.6], [hx - 3.2, hy + 3.6], [hx - 2.6, hy - 0.6]], haar);
  ovaal(ctx, hx + 1.8, hy - 4.4, 1.6, 0.8, 'rgba(255,255,255,0.18)');
  // schild en zwaard
  const schild = (sx, sy) => {
    const P = [[sx - 3.8, sy - 6], [sx + 3.8, sy - 6], [sx + 3.8, sy + 3.2], [sx, sy + 6.8], [sx - 3.8, sy + 3.2]];
    vlak(ctx, P, goud);
    vlak(ctx, [[sx - 3.1, sy - 5.3], [sx + 3.1, sy - 5.3], [sx + 3.1, sy + 2.9], [sx, sy + 6], [sx - 3.1, sy + 2.9]], K);
    vlak(ctx, [[sx - 3.1, sy - 5.3], [sx - 1.2, sy - 5.3], [sx - 1.2, sy + 4.6], [sx - 3.1, sy + 2.9]], 'rgba(0,0,0,0.2)');
    lijn(ctx, sx, sy - 4.4, sx, sy + 4.4, goud, 1.2);
    lijn(ctx, sx - 2.4, sy - 1, sx + 2.4, sy - 1, goud, 1.2);
    ovaal(ctx, sx, sy - 1, 0.9, 0.9, '#efece4');
  };
  const zwaard = (x1, y1, x2, y2) => {
    const hoek = Math.atan2(y2 - y1, x2 - x1);
    const dx = Math.cos(hoek), dy = Math.sin(hoek), nx = -dy, ny = dx;
    lijn(ctx, x1, y1, x2, y2, '#e6e9ee', 1.7);
    lijn(ctx, x1, y1, x2, y2, 'rgba(255,255,255,0.7)', 0.5);
    lijn(ctx, x1 - nx * 2.7, y1 - ny * 2.7, x1 + nx * 2.7, y1 + ny * 2.7, goud, 1.3);
    lijn(ctx, x1, y1, x1 - dx * 3, y1 - dy * 3, '#5a3d22', 1.4);
    ovaal(ctx, x1 - dx * 3.5, y1 - dy * 3.5, 0.9, 0.9, goud);
  };
  const arm = (ax, ay, bx, by) => lijn(ctx, ax, ay, bx, by, staal, 2.6);
  if (houding === 'lopen') {
    schild(mx - 6.8, 23.2 + wip);
    hand(ctx, mx - 4.6, 24 + wip, staalD, 1.6);
    zwaard(mx + 6, 22 + wip, mx + 9.6, 5 + wip);
    arm(mx + 5.4, 19.6 + wip, mx + 6, 22 + wip);
    hand(ctx, mx + 6, 22.4 + wip, staalD, 1.7);
  } else if (houding === 'hoog') {
    schild(mx - 5.6, 21.6);
    hand(ctx, mx - 4, 22.4, staalD, 1.6);
    zwaard(mx + 5, 15.4, mx + 7.4, -3);
    arm(mx + 5.4, 19.6, mx + 5, 15.8);
    hand(ctx, mx + 5, 15.6, staalD, 1.7);
  } else {
    schild(mx - 4.4, 22);
    hand(ctx, mx - 3.2, 22.6, staalD, 1.6);
    zwaard(mx + 5, 20, mx + 22.6, 25.6);
    arm(mx + 5.4, 19.6, mx + 5.2, 20.4);
    hand(ctx, mx + 5.4, 20.4, staalD, 1.7);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.arc(mx + 4, 17, 15, -1.2, 0.4); ctx.stroke();
  }
}

export const HEREN = {
  reinout: { teken: reinout, brede: 11 },
  mechteld: { teken: mechteld, brede: 9.6 },
  hademar: { teken: hademar, brede: 12 },
  brandt: { teken: brandt, brede: 10.4 },
  aleid: { teken: aleid, brede: 10.6 },
  lambrecht: { teken: lambrecht, brede: 11.5 },
  everhard: { teken: everhard, brede: 11.2 },
  rutger: { teken: rutger, brede: 12 },
  valkenier: { teken: valkenier, brede: 10.2 },
  ottger: { teken: ottger, brede: 10.5 },
  koning: { teken: koning, brede: 11 },
};

export const heeftFiguur = (sleutel) => !!sleutel && Object.prototype.hasOwnProperty.call(HEREN, sleutel);

// Bouwt een plaatje: schaduw met ring, contour, figuur. Tekent in een ruimte van 26 bij 38
// (voeten op y = 34, midden x = 13), vergroot naar 130% zoals de oude koning.
export function maakHeer(sleutel, houding, beeld, spiegel = false, def = {}) {
  const heer = HEREN[sleutel];
  const w = Math.ceil(B * SCHERPTE);
  const h = Math.ceil(H * SCHERPTE);
  const nieuw = () => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.scale(SCHERPTE, SCHERPTE);
    ctx.translate(B / 2, AY);
    ctx.scale(1.3, 1.3);
    ctx.translate(-13, -34);
    return [c, ctx];
  };
  const [fig, fctx] = nieuw();
  heer.teken(fctx, houding, beeld, def);
  const sil = document.createElement('canvas');
  sil.width = w; sil.height = h;
  const sctx = sil.getContext('2d');
  sctx.drawImage(fig, 0, 0);
  sctx.globalCompositeOperation = 'source-in';
  sctx.fillStyle = OMLIJN;
  sctx.fillRect(0, 0, w, h);
  const uit = document.createElement('canvas');
  uit.width = w; uit.height = h;
  const u = uit.getContext('2d');
  if (spiegel) { u.translate(w, 0); u.scale(-1, 1); }
  u.save();
  u.scale(SCHERPTE, SCHERPTE);
  u.translate(B / 2, AY);
  u.scale(1.3, 1.3);
  u.translate(-13, -34);
  grond(u, 13, heer.brede);
  u.restore();
  const r = 1.15;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    u.drawImage(sil, Math.cos(a) * r, Math.sin(a) * r);
  }
  u.drawImage(fig, 0, 0);
  return { doek: uit, b: B, h: H, ax: B / 2, ay: AY };
}

// Zelfde vorm als tekenKoning in kunst.js: rechts en links met vier loopbeelden,
// en houdingen.sla met twee beelden (wapen hoog, de slag).
export function tekenHeer(naam, def) {
  const sleutel = def.figuur;
  const set = (lijst) => ({
    rechts: lijst.map(([hd, bd]) => maakHeer(sleutel, hd, bd, false, def).doek),
    links: lijst.map(([hd, bd]) => maakHeer(sleutel, hd, bd, true, def).doek),
    b: B, h: H, ax: B / 2, ay: AY,
  });
  const beelden = set([['lopen', 0], ['lopen', 1], ['lopen', 2], ['lopen', 3]]);
  beelden.houdingen = { sla: set([['hoog', 0], ['slag', 0]]) };
  return beelden;
}

// Silhouet voor de zwarte silhouettoets
export function maakSilhouet(beeld) {
  const c = document.createElement('canvas');
  c.width = beeld.width; c.height = beeld.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(beeld, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}
