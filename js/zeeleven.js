// ZEELEVEN (0.112.0, White Dike): wat er op en boven het water leeft.
// Walvissen die opspringen (een enkele geeft je een vangst), meeuwen bij de havens, kleine rode
// vissersboten, zeemist, Rutger die op zijn dijk schreeuwt en
// onbewoonde eilandjes met een kist die je met een schip van jouw haven kunt ophalen.
// Bijna alles is decor: alleen de gelukkige walvis en de kist geven iets (voedsel, planken, goud).

import { GROND } from './kaart.js';
import { HALVE_BREEDTE as HB, HALVE_HOOGTE as HH } from './iso.js';
import { maakToeval } from './toeval.js';

const BUREN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SPRONG = 1.8;          // seconden dat een walvis in de lucht is
const MAX_VANGST = 3;        // zoveel keer per level geeft een walvis voedsel
const VANGST = 25;           // vis per vangst
const VAART = 2.2;           // tegels per seconde van het schip naar het eilandje
const MIST_RONDE = 140;      // seconden tussen twee mistbanken

// Game text is English (na te lezen).
const SCHREEUW = [
  'Come out and fight, little king!',
  'My ships are hungry, and so am I!',
  'Is that your wall? My dog jumps higher!',
  'Bring more ale for my men!',
  'I can smell your fear from here!',
  'The sea is mine, and soon so is your land!',
];
const NAAM = { planken: 'planks', hout: 'wood', goud: 'gold', voedsel: 'food' };
const BELONING = [{ soort: 'planken', aantal: 20 }, { soort: 'goud', aantal: 40 }, { soort: 'hout', aantal: 40 }];

export function maakZeeleven({ kaart, economie, haven, melding = () => {}, volgendeGolf = () => Infinity, rutger = () => null, onderweg = () => 0 }) {
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const toeval = maakToeval((kaart.zaad || 1) + 112);
  const isWater = (x, y) => x >= 0 && y >= 0 && x < B && y < H && kaart.grond[y * B + x] === GROND.WATER;
  const jij = kaart.start[0];
  let t = 0;

  // --- Het water: afstand tot land, kustwater, open zee -----------------------------------
  const afstand = new Int16Array(B * H).fill(-1);
  {
    const rij = [];
    for (let i = 0; i < B * H; i++) if (kaart.grond[i] !== GROND.WATER) { afstand[i] = 0; rij.push(i); }
    for (let k = 0; k < rij.length; k++) {
      const i = rij[k];
      const x = i % B;
      const y = (i - x) / B;
      for (const [dx, dy] of BUREN) {
        if (!isWater(x + dx, y + dy)) continue;
        const j = (y + dy) * B + x + dx;
        if (afstand[j] >= 0) continue;
        afstand[j] = afstand[i] + 1;
        rij.push(j);
      }
    }
  }
  const kust = [];
  const jouwKust = [];
  const open = [];
  for (let i = 0; i < B * H; i++) {
    if (afstand[i] >= 3 && afstand[i] <= 7) {
      kust.push(i);
      if (Math.hypot((i % B) - jij.x, Math.floor(i / B) - jij.y) <= 24) jouwKust.push(i);
    }
    if (afstand[i] >= 5) open.push(i);
  }

  // --- Walvissen ----------------------------------------------------------------------------
  const walvissen = [];
  let volgendeWalvis = 6;
  let eersteGemeld = false;
  let gevangen = 0;

  function spring({ x, y, gelukkig = false } = {}) {
    let px = x;
    let py = y;
    if (px === undefined) {
      const dichtbij = toeval() < 0.5 && jouwKust.length > 0;
      const lijst = dichtbij ? jouwKust : kust;
      if (!lijst.length) return null;
      const i = lijst[Math.floor(toeval() * lijst.length)];
      px = (i % B) + 0.5;
      py = Math.floor(i / B) + 0.5;
      gelukkig = dichtbij && gevangen < MAX_VANGST && !walvissen.some((w) => w.gelukkig);
    }
    const w = { x: px, y: py, t: 0, duur: gelukkig ? 30 : 5.5, gelukkig, gevangen: false, richting: toeval() < 0.5 ? 1 : -1 };
    walvissen.push(w);
    if (gelukkig) melding('A whale swims close to your shore. Tap it: the fishermen will haul in a good catch!', true);
    else if (!eersteGemeld) { eersteGemeld = true; melding('A whale breaches off the coast.', false); }
    return w;
  }

  // --- Meeuwen en vissersboten --------------------------------------------------------------
  // Vissersboten: bij elke rode haven een kleine rode boot die heen en weer vaart over open water.
  const boten = [];
  for (const h of haven.havens()) {
    if (!h.rood || boten.length >= 6) continue;
    const a = h.ligplaats;
    let beste = null;
    for (let k = 0; k < 16 && !beste; k++) {
      const hoek = ((k * 7) % 16) / 16 * Math.PI * 2;
      for (let len = 12; len >= 5; len--) {
        const bx = Math.round(a.x + Math.cos(hoek) * len);
        const by = Math.round(a.y + Math.sin(hoek) * len);
        let vrij = true;
        for (let s = 0; s <= len && vrij; s++) vrij = isWater(Math.floor(a.x + (bx + 0.5 - a.x) * s / len), Math.floor(a.y + (by + 0.5 - a.y) * s / len));
        if (vrij) { beste = { x: bx + 0.5, y: by + 0.5, len }; break; }
      }
    }
    if (beste) boten.push({ a, b: beste, len: beste.len, snel: 0.5 + toeval() * 0.25, fase: toeval() * 40 });
  }
  function botPlek(bt) {
    const periode = 2 * (bt.len / bt.snel + 3);
    const q = ((t + bt.fase) % periode + periode) % periode;
    const heen = bt.len / bt.snel + 3;
    const heenweg = q < heen;
    const loop = Math.max(0, Math.min(bt.len / bt.snel, (heenweg ? q : q - heen))) / (bt.len / bt.snel);
    const f = heenweg ? loop : 1 - loop;
    const x = bt.a.x + (bt.b.x - bt.a.x) * f + Math.sin(t * 1.1 + bt.fase) * 0.03;
    const y = bt.a.y + (bt.b.y - bt.a.y) * f + Math.cos(t * 1.3 + bt.fase) * 0.03;
    const sx = (bt.b.x - bt.b.y) - (bt.a.x - bt.a.y);
    return { x, y, alpha: 1, richting: (sx >= 0) === heenweg ? 1 : -1, rood: true, schaal: 0.5 };
  }

  // --- Eilandjes met een kist ---------------------------------------------------------------
  const eilandjes = (kaart.eilandjes || []).map((e, i) => ({ x: e.x, y: e.y, gehaald: false, beloning: BELONING[i % BELONING.length] }));
  let reis = null;   // { route, pos, fase: 'heen'|'wacht'|'terug', wacht, eiland }

  function zeeweg(van, eiland) {
    const start = Math.floor(van.y) * B + Math.floor(van.x);
    const vorige = new Map([[start, -1]]);
    const rij = [start];
    for (let k = 0; k < rij.length; k++) {
      const i = rij[k];
      const x = i % B;
      const y = (i - x) / B;
      if (Math.abs(x - eiland.x) <= 2 && Math.abs(y - eiland.y) <= 2) {
        const route = [];
        for (let j = i; j !== -1; j = vorige.get(j)) route.unshift({ x: (j % B) + 0.5, y: Math.floor(j / B) + 0.5 });
        return route;
      }
      for (const [dx, dy] of BUREN) {
        if (!isWater(x + dx, y + dy)) continue;
        const j = (y + dy) * B + x + dx;
        if (vorige.has(j)) continue;
        vorige.set(j, i);
        rij.push(j);
      }
    }
    return null;
  }

  function stuurSchip(e) {
    if (reis) { melding('Your ship is already at sea.', false); return; }
    const eigen = haven.havens().filter((h) => !h.rood);
    if (!eigen.length) { melding('You need a harbour on your own shore to sail to the islet.', true); return; }
    const route = zeeweg(eigen[0].ligplaats, e);
    if (!route || route.length < 2) { melding('No sea route to the islet.', false); return; }
    reis = { route, pos: 0, fase: 'heen', wacht: 3, eiland: e };
    melding('Your ship sails for the islet. It will bring back what the sea left there.', false);
  }

  function reisStap(dt) {
    if (!reis) return;
    const L = reis.route.length - 1;
    if (reis.fase === 'heen') {
      reis.pos = Math.min(L, reis.pos + VAART * dt);
      if (reis.pos >= L) reis.fase = 'wacht';
    } else if (reis.fase === 'wacht') {
      reis.wacht -= dt;
      if (reis.wacht <= 0) reis.fase = 'terug';
    } else {
      reis.pos = Math.max(0, reis.pos - VAART * dt);
      if (reis.pos <= 0) {
        const { soort, aantal } = reis.eiland.beloning;
        const kreeg = economie.lever(soort, aantal);
        reis.eiland.gehaald = true;
        melding(kreeg > 0 ? `Your ship is back from the islet with a chest: +${kreeg} ${NAAM[soort] || soort}.` : 'Your ship is back with a chest, but your stores are full. The chest is lost to the sea.', true);
        reis = null;
      }
    }
  }

  // --- Rutger op zijn dijk -------------------------------------------------------------------
  let schreeuwKlok = 25;
  let schreeuw = null;   // { tekst, tot }

  // --- Mist --------------------------------------------------------------------
  const banken = [];
  for (let k = 0; k < 5 && open.length; k++) {
    const i = open[Math.floor(toeval() * open.length)];
    banken.push({ x: (i % B) + 0.5, y: Math.floor(i / B) + 0.5, straal: 6 + toeval() * 3, fase: toeval() * 6 });
  }
  const mist = () => {
    const ph = (((t + 40) % MIST_RONDE) + MIST_RONDE) % MIST_RONDE / MIST_RONDE;
    return ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI) : 0;
  };

  // --- Elke stap ------------------------------------------------------------------------------
  function stap(dt) {
    t += dt;
    volgendeWalvis -= dt;
    if (volgendeWalvis <= 0) { volgendeWalvis = 22 + toeval() * 26; spring(); }
    for (let i = walvissen.length - 1; i >= 0; i--) {
      walvissen[i].t += dt;
      if (walvissen[i].t > walvissen[i].duur) walvissen.splice(i, 1);
    }
    reisStap(dt);
    schreeuwKlok -= dt;
    if (schreeuw && t > schreeuw.tot) schreeuw = null;
    if (schreeuwKlok <= 0) {
      schreeuwKlok = 30 + toeval() * 25;
      const r = rutger();
      if (r && !r.dood && !onderweg() && volgendeGolf() > 8) {
        schreeuw = { tekst: SCHREEUW[Math.floor(toeval() * SCHREEUW.length)], tot: t + 5 };
        melding(`Rutger the Mad shouts from his dike: "${schreeuw.tekst}"`, false);
      }
    }
  }

  // --- Aantikken ------------------------------------------------------------------------------
  function tik(x, y) {
    const px = x + 0.5;
    const py = y + 0.5;
    for (const w of walvissen) {
      if (!w.gelukkig || w.gevangen || w.t < SPRONG) continue;
      if (Math.hypot(w.x - px, w.y - py) > 2.2) continue;
      const kreeg = economie.lever('vis', VANGST);   // vis (0.121.0)
      if (kreeg <= 0) { melding('Your stores are full: the fishermen cannot land their catch.', true); return true; }
      w.gevangen = true;
      w.duur = w.t + 3;
      gevangen++;
      melding(`The whale drives fish into your nets: +${kreeg} fish.`, true);
      return true;
    }
    for (const e of eilandjes) {
      if (e.gehaald || Math.abs(x - e.x) > 1 || Math.abs(y - e.y) > 1) continue;
      stuurSchip(e);
      return true;
    }
    return false;
  }

  // --- Tekenen --------------------------------------------------------------------------------
  const wx = (x, y) => (x - y) * HB;
  const wy = (x, y) => (x + y) * HH;
  const zichtbaar = (x, y, l, b, r, o, marge = 140) => { const a = wx(x, y); const c = wy(x, y); return a > l - marge && a < r + marge && c > b - marge - 80 && c < o + marge; };

  function ring(ctx, x, y, leeftijd, max = 3.4) {
    if (leeftijd < 0 || leeftijd > max) return;
    const f = leeftijd / max;
    const rad = (0.25 + leeftijd * 0.8) * HB;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.65 * (1 - f)})`;
    ctx.lineWidth = 0.8 + 1.8 * (1 - f);
    ctx.beginPath();
    ctx.ellipse(wx(x, y), wy(x, y), rad, rad * 0.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  function plons(ctx, x, y, leeftijd) {
    if (leeftijd < 0 || leeftijd > 0.9) return;
    for (let k = 0; k < 10; k++) {
      const hoek = (k / 10) * Math.PI * 2 + 0.4;
      const h = leeftijd * 78 - 120 * leeftijd * leeftijd;
      if (h < 0) continue;
      ctx.fillStyle = `rgba(235, 247, 252, ${0.9 * (1 - leeftijd / 0.9)})`;
      ctx.beginPath();
      ctx.arc(wx(x, y) + Math.cos(hoek) * leeftijd * 26, wy(x, y) + Math.sin(hoek) * leeftijd * 9 - h, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  function walvisLijf(ctx, richting) {
    const L = HB * 0.95;
    const D = HB * 0.3;
    ctx.scale(richting, 1);
    const g = ctx.createLinearGradient(0, -D, 0, D);
    g.addColorStop(0, '#2f4457');
    g.addColorStop(0.55, '#3e5a70');
    g.addColorStop(0.56, '#cfdbe0');
    g.addColorStop(1, '#e8eff1');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, L, D, 0, 0, Math.PI * 2);
    ctx.fill();
    // staart
    ctx.fillStyle = '#2f4457';
    ctx.beginPath();
    ctx.moveTo(-L * 0.85, 0);
    ctx.lineTo(-L * 1.3, -D * 1.1);
    ctx.lineTo(-L * 1.15, 0);
    ctx.lineTo(-L * 1.3, D * 1.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#10181f';
    ctx.beginPath();
    ctx.arc(L * 0.55, -D * 0.1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  function tekenWalvis(ctx, w) {
    const x = wx(w.x, w.y);
    const y = wy(w.x, w.y);
    ring(ctx, w.x, w.y, w.t, 3.4);
    ring(ctx, w.x, w.y, w.t - 0.4, 3.4);
    if (w.t < SPRONG) {
      const u = w.t / SPRONG;
      const hoog = Math.sin(Math.PI * u) * HB * 1.15;
      ctx.fillStyle = 'rgba(10, 30, 46, 0.22)';
      ctx.beginPath();
      ctx.ellipse(x, y, HB * 0.8 * (1 - hoog / (HB * 2)), HB * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(x, y - hoog - HB * 0.1);
      ctx.rotate((u - 0.5) * 2.1 * w.richting);
      walvisLijf(ctx, w.richting);
      ctx.restore();
      return;
    }
    ring(ctx, w.x, w.y, w.t - SPRONG, 3.4);
    ring(ctx, w.x, w.y, w.t - SPRONG - 0.45, 3.4);
    plons(ctx, w.x, w.y, w.t - SPRONG);
    if (!w.gelukkig || w.t > w.duur - 1.5) return;
    // gelukkige walvis: de rug boven water, een fontein en een knipperende ring als teken dat je hem kunt aantikken
    const dein = Math.sin(t * 1.6) * 1.5;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - HB, y - HB, HB * 2, HB + HB * 0.12);
    ctx.clip();
    ctx.translate(x, y + HB * 0.18 + dein);
    walvisLijf(ctx, w.richting);
    ctx.restore();
    const fase = (t * 0.9) % 2;
    if (fase < 1.2) {
      ctx.strokeStyle = `rgba(235, 247, 252, ${0.8 * (1 - fase / 1.2)})`;
      ctx.lineWidth = 1.6;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(x + w.richting * HB * 0.35, y - HB * 0.05);
        ctx.quadraticCurveTo(x + w.richting * HB * 0.35 + k * 5, y - HB * (0.35 + fase * 0.25), x + w.richting * HB * 0.35 + k * 11, y - HB * 0.1 - fase * 4);
        ctx.stroke();
      }
    }
    if (!w.gevangen) {
      ctx.strokeStyle = `rgba(255, 224, 120, ${0.55 + 0.35 * Math.sin(t * 4)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, HB * 1.15, HB * 0.58, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  function meeuw(ctx, x, y, klap, kleur, breed) {
    ctx.strokeStyle = kleur;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - breed, y - klap);
    ctx.quadraticCurveTo(x - breed / 2, y - 3, x, y);
    ctx.quadraticCurveTo(x + breed / 2, y - 3, x + breed, y - klap);
    ctx.stroke();
  }
  function tekenMeeuwen(ctx, l, b, r, o) {
    let j = 0;
    for (const h of haven.havens()) {
      j++;
      const a = h.ligplaats;
      if (!zichtbaar(a.x, a.y, l, b, r, o, 200)) continue;
      for (let k = 0; k < 3; k++) {
        const hoek = t * (0.45 + k * 0.08) * (k % 2 ? -1 : 1) + k * 2.1 + j;
        const R = (1.0 + k * 0.7) * HB;
        const gx = wx(a.x, a.y) + Math.cos(hoek) * R;
        const gy = wy(a.x, a.y) + Math.sin(hoek) * R * 0.5;
        const hoog = 34 + k * 9 + Math.sin(t * 0.8 + k + j) * 5;
        const klap = Math.sin(t * 7 + k * 1.7 + j) * 3.2;
        meeuw(ctx, gx + 2, gy + 1, klap * 0.4, 'rgba(10, 30, 46, 0.18)', 6);
        meeuw(ctx, gx, gy - hoog, klap, 'rgba(250, 250, 246, 0.95)', 6);
      }
    }
  }
  function tekenKist(ctx, e) {
    const x = wx(e.x + 0.5, e.y + 0.5);
    const y = wy(e.x + 0.5, e.y + 0.5);
    // een afgebroken mast met een flard zeil
    ctx.strokeStyle = '#5a3b22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 2);
    ctx.lineTo(x - 6, y - 26);
    ctx.stroke();
    ctx.fillStyle = 'rgba(226, 218, 196, 0.9)';
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 25);
    ctx.lineTo(x + 6, y - 20 + Math.sin(t * 2) * 1.5);
    ctx.lineTo(x - 6, y - 14);
    ctx.closePath();
    ctx.fill();
    if (e.gehaald) return;
    // de kist
    ctx.fillStyle = '#7a4c24';
    ctx.fillRect(x + 1, y - 7, 15, 9);
    ctx.fillStyle = '#a06a30';
    ctx.fillRect(x + 1, y - 7, 15, 3);
    ctx.fillStyle = '#d8b84a';
    ctx.fillRect(x + 7, y - 7, 3, 9);
    const g = 0.5 + 0.5 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(255, 244, 170, ${0.35 + 0.5 * g})`;
    ctx.beginPath();
    ctx.arc(x + 14, y - 10 - g * 2, 2 + g, 0, Math.PI * 2);
    ctx.fill();
  }
  function tekenBubbel(ctx) {
    const r = rutger();
    if (!schreeuw || !r || r.dood) return;
    const x = wx(r.x, r.y);
    const y = wy(r.x, r.y) - (r.hoogte || 0) - 74;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    const breed = ctx.measureText(schreeuw.tekst).width + 16;
    const left = (schreeuw.tot - t) / 5;
    ctx.globalAlpha = Math.min(1, left * 4, (1 - left) * 6 + 0.2);
    ctx.fillStyle = 'rgba(255, 252, 240, 0.96)';
    ctx.strokeStyle = '#4a2a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(x - breed / 2, y - 18, breed, 22);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 4);
    ctx.lineTo(x, y + 12);
    ctx.lineTo(x + 5, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3a1a10';
    ctx.fillText(schreeuw.tekst, x, y - 3);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'start';
  }
  function tekenMist(ctx, l, b, r, o) {
    const m = mist();
    if (m <= 0.02) return;
    for (const bank of banken) {
      const x = bank.x + Math.sin(t * 0.05 + bank.fase) * 3 + t * 0.02;
      const y = bank.y + Math.cos(t * 0.04 + bank.fase) * 2;
      if (!zichtbaar(x, y, l, b, r, o, bank.straal * HB)) continue;
      const cx = wx(x, y);
      const cy = wy(x, y);
      const R = bank.straal * HB * 0.9;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, `rgba(226, 234, 238, ${0.42 * m})`);
      g.addColorStop(1, 'rgba(226, 234, 238, 0)');
      ctx.fillStyle = g;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, 0.55);
      ctx.translate(-cx, -cy);
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
    }
  }

  // De wereld (camera aan): eilandjes, walvissen, meeuwen, mist en Rutgers bubbel.
  function teken(ctx, l, b, r, o) {
    for (const e of eilandjes) if (zichtbaar(e.x, e.y, l, b, r, o)) tekenKist(ctx, e);
    for (const w of walvissen) if (zichtbaar(w.x, w.y, l, b, r, o, 200)) tekenWalvis(ctx, w);
    tekenMeeuwen(ctx, l, b, r, o);
    tekenMist(ctx, l, b, r, o);
  }
  // Schepen voor de tekenlaag: vissersboten en het schip naar het eilandje.
  function schepen() {
    const lijst = boten.map(botPlek);
    if (reis) {
      const L = reis.route.length - 1;
      const p = Math.max(0, Math.min(L, reis.pos));
      const k = Math.min(L - 1, Math.floor(p));
      const f = p - k;
      const a = reis.route[k];
      const c = reis.route[k + 1] || a;
      const sx = (c.x - c.y) - (a.x - a.y);
      lijst.push({ x: a.x + (c.x - a.x) * f, y: a.y + (c.y - a.y) * f, alpha: 1, richting: (sx >= 0) !== (reis.fase === 'terug') ? 1 : -1, rood: false });
    }
    return lijst;
  }

  return {
    stap, tik, teken, tekenBoven: tekenBubbel, schepen, spring,
    walvissen: () => walvissen, eilandjes: () => eilandjes, boten: () => boten, kust: () => kust, jouwKust: () => jouwKust,
    reis: () => reis, schreeuw: () => schreeuw, mist, gevangen: () => gevangen,
    schreeuwNu(tekst) { schreeuw = { tekst: tekst || SCHREEUW[0], tot: t + 5 }; },
  };
}
