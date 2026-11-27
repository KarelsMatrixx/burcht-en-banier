// VISSERIJ (0.120.0, vanaf level 8): de Fisherman's Hut.
// Een hut aan het water met een visser (een boer, beroep "visser"). Bij elke bemande hut hoort
// een klein bootje. Het vaart uit naar een eigen visplek op open water, vist daar zichtbaar
// (net uit, kringen in het water), vaart terug naar zijn eigen hut en lost de vangst: vis (een eigen
// voedselsoort sinds 0.121.0), automatisch in je voorraad. Zijn de schepen van rood op zee (een golf), dan blijft het bootje
// aan wal; was het al buiten, dan keert het om.
//
// Getallen in data/economie.json, onder "visserij". Alle getallen zijn schattingen (na te lezen).
// Niet bewaard: na herladen ligt elk bootje weer aan zijn hut.

import { OBJECT, GROND } from './kaart.js';
import { HALVE_BREEDTE as HB, HALVE_HOOGTE as HH } from './iso.js';

const BUREN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SPELER = 1;

export function maakVisserij({ kaart, economie, regels = {}, gevaar = () => false, opMelding = () => {}, geluid = null }) {
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const R = {
    vangst: 12, vissen: 25, snelheid: 0.7, rust: 4, minAfstand: 5, maxAfstand: 11, diep: 2, lesVissen: 8,
    ...regels,
  };
  const isWater = (x, y) => x >= 0 && y >= 0 && x < B && y < H && kaart.grond[y * B + x] === GROND.WATER;
  const hutten = new Map();   // vak -> { vak, ligplaats, route, visplek, fase, tijd, pos, vangst, ... }
  let snelleTocht = false;    // de les: de eerste tocht is korter
  let tochten = 0;            // hoe vaak een bootje met vangst terug is gekomen
  let gevangen = 0;           // hoeveel vis er in totaal is binnengebracht (voor de les en tests)
  let gemeldGevaar = false;
  let t = 0;

  // Afstand tot land per watertegel (breedte eerst), voor "open water".
  const diepte = new Int16Array(B * H).fill(-1);
  {
    const rij = [];
    for (let i = 0; i < B * H; i++) if (kaart.grond[i] !== GROND.WATER) { diepte[i] = 0; rij.push(i); }
    for (let k = 0; k < rij.length; k++) {
      const i = rij[k];
      const x = i % B;
      const y = (i - x) / B;
      for (const [dx, dy] of BUREN) {
        if (!isWater(x + dx, y + dy)) continue;
        const j = (y + dy) * B + x + dx;
        if (diepte[j] >= 0) continue;
        diepte[j] = diepte[i] + 1;
        rij.push(j);
      }
    }
  }

  // Waar ligt het bootje en waar vist het? Ligplaats: water naast de hut. Visplek: over water
  // tussen minAfstand en maxAfstand stappen ver, liefst diep en niet op de plek van een andere hut.
  function plan(vak, bezet = []) {
    const x = vak % B;
    const y = (vak - x) / B;
    let lig = null;
    let besteN = -1;
    for (const [dx, dy] of BUREN) {
      if (!isWater(x + dx, y + dy)) continue;
      const n = BUREN.filter(([ex, ey]) => isWater(x + dx + ex, y + dy + ey)).length;
      if (n > besteN) { besteN = n; lig = { x: x + dx, y: y + dy }; }
    }
    if (!lig) return null;
    const start = lig.y * B + lig.x;
    const vorige = new Map([[start, -1]]);
    const stappen = new Map([[start, 0]]);
    const rij = [start];
    let beste = -1;
    let besteScore = -Infinity;
    for (let k = 0; k < rij.length; k++) {
      const i = rij[k];
      const s = stappen.get(i);
      const ix = i % B;
      const iy = (i - ix) / B;
      if (s >= R.minAfstand && diepte[i] >= R.diep) {
        // diep water telt, dichtbij een andere visplek niet
        let score = Math.min(diepte[i], 5) * 2 - Math.abs(s - (R.minAfstand + R.maxAfstand) / 2) * 0.5 + ((ix * 7 + iy * 13 + vak) % 5) * 0.1;
        for (const p of bezet) if (Math.hypot(p.x - ix, p.y - iy) < 3) score -= 20;
        if (score > besteScore) { besteScore = score; beste = i; }
      }
      if (s >= R.maxAfstand) continue;
      for (const [dx, dy] of BUREN) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (!isWater(nx, ny)) continue;
        const j = ny * B + nx;
        if (vorige.has(j)) continue;
        vorige.set(j, i);
        stappen.set(j, s + 1);
        rij.push(j);
      }
    }
    if (beste < 0) return null;
    const route = [];
    for (let i = beste; i !== -1; i = vorige.get(i)) route.unshift({ x: (i % B) + 0.5, y: Math.floor(i / B) + 0.5 });
    return { ligplaats: { x: lig.x + 0.5, y: lig.y + 0.5 }, route, visplek: route[route.length - 1] };
  }

  // Kan hier een hut vissen? (de les kiest zo zijn gouden plek)
  const kanVissen = (x, y) => !!plan(y * B + x);

  // Hutten erbij of eraf, na bouwen, slopen of herladen.
  function zoek() {
    const gezien = new Set();
    for (let i = 0; i < kaart.object.length; i++) {
      if (kaart.object[i] !== OBJECT.VISSERSHUT || kaart.eigenaar[i] !== SPELER) continue;
      gezien.add(i);
      if (hutten.has(i)) continue;
      const p = plan(i, [...hutten.values()].map((h) => h.visplek));
      // Geen open water: de hut staat er wel, maar het bootje kan nergens heen.
      hutten.set(i, { vak: i, ...(p || { ligplaats: null, route: [], visplek: null }), fase: 'thuis', tijd: R.rust, pos: 0, vangst: 0, rest: 0, gemeld: !p ? false : true, wachtGemeld: false });
    }
    for (const vak of hutten.keys()) if (!gezien.has(vak)) hutten.delete(vak);
  }

  const bemand = (vak) => economie.werkers().some((e) => e.werk && e.werk.plaats === vak);

  function stap(dt) {
    t += dt;
    const nuGevaar = gevaar();
    if (!nuGevaar) gemeldGevaar = false;
    for (const h of hutten.values()) {
      if (!h.ligplaats) {
        if (!h.gemeld) { h.gemeld = true; opMelding('Your fisherman finds no open water from his hut. Build it on a coast that faces the sea.'); }
        continue;
      }
      const L = h.route.length - 1;
      if (h.fase === 'thuis') {
        if (!bemand(h.vak)) { h.tijd = R.rust; continue; }
        if (nuGevaar) {
          if (!gemeldGevaar) { gemeldGevaar = true; opMelding('Longships at sea! Your fishermen stay ashore until the raid is over.'); }
          h.tijd = R.rust;
          continue;
        }
        h.tijd -= dt;
        if (h.tijd <= 0) { h.fase = 'uit'; h.pos = 0; }
        continue;
      }
      if (h.fase === 'uit') {
        if (nuGevaar) { h.fase = 'terug'; h.vangst = 0; continue; }
        h.pos += R.snelheid * dt;
        if (h.pos >= L) { h.pos = L; h.fase = 'vist'; h.tijd = snelleTocht ? R.lesVissen : R.vissen; h.duur = h.tijd; }
        continue;
      }
      if (h.fase === 'vist') {
        h.tijd -= dt;
        if (nuGevaar) {
          // halverwege terug: wat er al in het net zit, gaat mee
          h.vangst = Math.floor(R.vangst * Math.max(0, 1 - h.tijd / h.duur));
          h.fase = 'terug';
          continue;
        }
        if (h.tijd <= 0) { h.vangst = R.vangst; h.fase = 'terug'; }
        continue;
      }
      if (h.fase === 'terug') {
        h.pos -= R.snelheid * dt;
        if (h.pos > 0) continue;
        h.pos = 0;
        h.fase = 'lost';
        h.rest = h.vangst;
        if (h.vangst > 0) tochten++;   // een bootje is met vangst terug (de visles wacht hierop, 0.121.1)
        h.wachtGemeld = false;
      }
      if (h.fase === 'lost') {
        if (h.rest > 0) {
          const past = economie.lever('vis', h.rest) || 0;   // nooit NaN (0.121.1)
          h.rest -= past;
          gevangen += past;
          if (past && geluid) geluid.speel('goods_delivered', { x: h.ligplaats.x, y: h.ligplaats.y });
          if (h.rest > 0) {
            if (!h.wachtGemeld) { h.wachtGemeld = true; opMelding('Your fishing boat is back, but your stores are full. The catch waits at the hut.'); }
            continue;
          }
        }
        if (h.vangst > 0) snelleTocht = false;
        h.vangst = 0;
        h.fase = 'thuis';
        h.tijd = R.rust;
      }
    }
  }

  // Waar is het bootje van deze hut?
  function plekVan(h) {
    if (!h.ligplaats) return null;
    if (h.fase === 'thuis' || h.fase === 'lost' || h.route.length < 2) return { x: h.ligplaats.x, y: h.ligplaats.y, richting: 1 };
    const L = h.route.length - 1;
    const p = Math.max(0, Math.min(L, h.pos));
    const k = Math.min(L - 1, Math.floor(p));
    const f = p - k;
    const a = h.route[k];
    const c = h.route[k + 1];
    const sx = (c.x - c.y) - (a.x - a.y);
    const vooruit = h.fase !== 'terug';
    // De eerste stap: van de ligplaats (naast de hut) naar het water.
    const van = k === 0 ? { x: h.ligplaats.x, y: h.ligplaats.y } : a;
    return { x: van.x + (c.x - van.x) * f, y: van.y + (c.y - van.y) * f, richting: (sx >= 0) === vooruit ? 1 : -1 };
  }

  // Voor de tekenlaag: een bootje per bemande hut (of een hut waarvan de boot buiten is).
  function schepen() {
    const lijst = [];
    for (const h of hutten.values()) {
      const p = plekVan(h);
      if (!p) continue;
      const deinen = Math.sin(t * 1.6 + h.vak) * 0.035;
      lijst.push({ x: p.x, y: p.y + deinen, alpha: 1, richting: p.richting, visboot: true, vist: h.fase === 'vist', vol: h.fase === 'terug' && h.vangst > 0, schaal: 1 });
    }
    return lijst;
  }

  // Kringen in het water en drijvers van het net bij een vissend bootje.
  function teken(ctx, l, b, r, o) {
    for (const h of hutten.values()) {
      if (h.fase !== 'vist' || !h.visplek) continue;
      const x = (h.visplek.x - h.visplek.y) * HB;
      const y = (h.visplek.x + h.visplek.y) * HH;
      if (x < l - 100 || x > r + 100 || y < b - 100 || y > o + 100) continue;
      // het net: een boog van kurken drijvers achter het bootje
      const bt = plekVan(h);
      const kant = bt && bt.richting < 0 ? -1 : 1;   // het net ligt aan de kant waar de visser het uitgooit (voor de boeg)
      for (let k = 0; k < 7; k++) {
        const u = k / 6;
        const nx = x + kant * (22 + u * 22) + Math.sin(t * 1.4 + k) * 0.6;
        const ny = y + 6 + Math.sin(u * Math.PI) * 9 + Math.cos(t * 1.7 + k) * 0.5;
        ctx.fillStyle = 'rgba(10, 30, 46, 0.25)';
        ctx.beginPath(); ctx.ellipse(nx, ny + 0.8, 2.2, 0.9, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = k % 2 ? '#e0b860' : '#c96a3a';
        ctx.beginPath(); ctx.ellipse(nx, ny, 1.6, 1.1, 0, 0, Math.PI * 2); ctx.fill();
      }
      // kringen waar het net in het water ligt
      for (let k = 0; k < 2; k++) {
        const leeftijd = ((t * 0.6 + k * 0.5 + h.vak * 0.13) % 1);
        ctx.strokeStyle = `rgba(235, 245, 250, ${0.45 * (1 - leeftijd)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(x + kant * 33, y + 9, 6 + leeftijd * 16, (6 + leeftijd * 16) * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // af en toe springt er een visje op
      const sprong = (t * 0.5 + h.vak * 0.37) % 3;
      if (sprong < 0.6) {
        const u = sprong / 0.6;
        const fx = x + kant * (28 + u * 10);
        const fy = y + 8 - Math.sin(Math.PI * u) * 12;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate((u - 0.5) * 2.4 * kant);
        ctx.fillStyle = '#b8c8d2';
        ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1.2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(-5, -1.4); ctx.lineTo(-5, 1.4); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }

  // Wat de hut aan het doen is (voor het bouwpaneel en de les).
  function beschrijf(vak) {
    const h = hutten.get(vak);
    if (!h) return '';
    if (!h.ligplaats) return 'Its boat finds no open water here.';
    return {
      thuis: bemand(vak) ? 'The boat lies at the hut, ready to sail.' : 'The boat waits for a fisherman.',
      uit: 'The boat is rowing out to the fishing ground.',
      vist: 'The boat is out fishing.',
      terug: h.vangst ? `The boat is coming home with ${h.vangst} fish.` : 'The boat is coming home.',
      lost: 'The catch is being unloaded.',
    }[h.fase] || '';
  }

  zoek();
  return {
    zoek, stap, schepen, teken, beschrijf, kanVissen, regels: R,
    hutten: () => [...hutten.values()],
    gevangen: () => gevangen,
    tochten: () => tochten,
    snel(aan = true) { snelleTocht = !!aan; },
    // de plek van het eerste bootje dat buiten is (de les volgt het)
    bootje(vak) { const h = vak !== undefined ? hutten.get(vak) : [...hutten.values()][0]; return h ? plekVan(h) : null; },
  };
}
