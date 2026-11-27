// Havens (0.106.0, vanaf level 8). Een haven staat aan het water. Tik hem aan en bestel
// goederen (je betaalt goud) of verkoop goederen (je krijgt meer goud dan in de
// voorraadkamer). Het schip vaart uit en is na regels.reis seconden terug: met de goederen,
// of met het goud. Een schip per haven, een bestelling tegelijk. Bij rood ligt een schip
// als decor aan zijn kade.
//
// Getallen in data/economie.json, onder "haven".

import { OBJECT, GROND } from './kaart.js';

const BUREN = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const VAART = 30;      // seconden die het uitvaren en het binnenvaren in beeld duren
const ROUTE = 16;      // zo ver (tegels) vaart het schip in beeld voor het uit zicht raakt

export function maakHaven({ kaart, economie, regels, grondstoffen, opMelding = () => {}, geluid = null }) {
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const havens = new Map();   // vak -> { vak, ligplaats, route, order, rood }
  const isWater = (x, y) => x >= 0 && y >= 0 && x < B && y < H && kaart.grond[y * B + x] === GROND.WATER;
  const klein = (naam) => (grondstoffen[naam] ? grondstoffen[naam].naam.toLowerCase() : naam);

  // De ligplaats: het water naast de haven met het meeste water eromheen.
  // De route: over water zo ver mogelijk weg (liefst tot de rand van de kaart).
  function maakHavenInfo(vak) {
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
    // Een tegel verder het water in, als dat kan: dan ligt het schip naast de kade, niet eronder.
    const rx = lig.x - x;
    const ry = lig.y - y;
    if (isWater(lig.x + rx, lig.y + ry)) lig = { x: lig.x + rx, y: lig.y + ry };
    const start = lig.y * B + lig.x;
    const vorige = new Map([[start, -1]]);
    const rij = [start];
    let verst = start;
    let verstD = 0;
    for (let k = 0; k < rij.length && k < 4000; k++) {
      const i = rij[k];
      const ix = i % B;
      const iy = (i - ix) / B;
      const d = Math.max(Math.abs(ix - lig.x), Math.abs(iy - lig.y));
      const rand = ix === 0 || iy === 0 || ix === B - 1 || iy === H - 1;
      const score = d + (rand ? 6 : 0);
      if (score > verstD) { verstD = score; verst = i; }
      if (d >= ROUTE) continue;
      for (const [dx, dy] of BUREN) {
        const nx = ix + dx;
        const ny = iy + dy;
        if (!isWater(nx, ny)) continue;
        const j = ny * B + nx;
        if (vorige.has(j)) continue;
        vorige.set(j, i);
        rij.push(j);
      }
    }
    const route = [];
    for (let i = verst; i !== -1; i = vorige.get(i)) route.unshift({ x: (i % B) + 0.5, y: Math.floor(i / B) + 0.5 });
    return { vak, ligplaats: { x: lig.x + 0.5, y: lig.y + 0.5 }, route, order: null, rood: kaart.eigenaar[vak] !== 1 };
  }

  // Havens erbij of eraf, na bouwen, slopen of een nieuwe kaart.
  function zoek() {
    const gezien = new Set();
    for (let i = 0; i < kaart.object.length; i++) {
      if (kaart.object[i] !== OBJECT.HAVEN) continue;
      gezien.add(i);
      if (!havens.has(i)) {
        const info = maakHavenInfo(i);
        if (info) havens.set(i, info);
      } else {
        havens.get(i).rood = kaart.eigenaar[i] !== 1;
      }
    }
    for (const [vak, h] of havens) {
      if (gezien.has(vak)) continue;
      if (h.order) opMelding('Your port is gone. Its ship and cargo are lost.');
      havens.delete(vak);
    }
  }

  const partijGrootte = () => regels.per || 10;

  // Kan deze bestelling? Geeft '' of de reden. Doet niets (het havenbord gebruikt dit voor de bevestigknop).
  function waaromNiet(vak, soort, naam, partijen = 1) {
    const h = havens.get(vak);
    if (!h || h.rood) return 'this is not your port';
    if (h.order) return 'the ship of this port is still at sea';
    const aantal = partijGrootte() * partijen;
    const munt = economie.munt();
    if (soort === 'koop') {
      const prijs = (regels.koop || {})[naam];
      if (!prijs) return 'no ship brings that';
      const goud = prijs * partijen;
      if (economie.voorraad[munt] < goud) return `you need ${goud} gold`;
      const ruimte = economie.opslagMax(naam) - economie.voorraad[naam];
      if (ruimte < aantal) return `your stores have room for only ${Math.max(0, ruimte)} more ${klein(naam)}`;
    } else {
      const prijs = (regels.verkoop || {})[naam];
      if (!prijs) return 'nobody overseas buys that';
      if (economie.voorraad[naam] < aantal) return `you have less than ${aantal} ${klein(naam)}`;
    }
    return '';
  }

  // Een bestelling plaatsen. soort 'koop' of 'verkoop'. Geeft '' of de reden.
  function bestel(vak, soort, naam, partijen = 1) {
    const reden = waaromNiet(vak, soort, naam, partijen);
    if (reden) return reden;
    const h = havens.get(vak);
    const aantal = partijGrootte() * partijen;
    const munt = economie.munt();
    if (soort === 'koop') {
      const goud = regels.koop[naam] * partijen;
      economie.neem(munt, goud);
      h.order = { soort, naam, aantal, goud, tijd: regels.reis, rest: aantal };
    } else {
      const goud = regels.verkoop[naam] * partijen;
      economie.neem(naam, aantal);
      h.order = { soort, naam, aantal, goud, tijd: regels.reis, rest: goud };
    }
    if (geluid) geluid.speel('coins');
    return '';
  }

  function stap(dt) {
    for (const h of havens.values()) {
      const o = h.order;
      if (!o) continue;
      if (o.tijd > 0) {
        o.tijd = Math.max(0, o.tijd - dt);
        if (o.tijd > 0) continue;
      }
      // Het schip is terug: lossen, zoveel als er past.
      if (o.soort === 'koop') {
        const past = economie.lever(o.naam, o.rest);
        o.rest -= past;
        if (o.rest > 0) {
          if (!o.wacht) { o.wacht = true; opMelding(`Your ship is back with ${o.aantal} ${klein(o.naam)}, but your stores are full. It waits at the quay.`); }
          continue;
        }
        opMelding(`Your ship is back: ${o.aantal} ${klein(o.naam)} unloaded into your stores.`);
      } else {
        economie.lever(economie.munt(), o.goud);
        opMelding(`Your ship is back: ${o.aantal} ${klein(o.naam)} sold for ${o.goud} gold.`);
      }
      if (geluid) geluid.speel('coins');
      h.order = null;
    }
  }

  // Wat de tekenaar moet tekenen: een schip per haven, op zijn plek.
  function schepen() {
    const lijst = [];
    const t = performance.now() / 1000;
    for (const h of havens.values()) {
      const deinen = Math.sin(t * 1.3 + h.vak) * 0.04;
      let plek = h.ligplaats;
      let alpha = 1;
      let richting = 1;
      const o = h.order;
      if (o && o.tijd > 0 && h.route.length > 1) {
        const verstreken = regels.reis - o.tijd;
        let deel = -1;
        if (verstreken < VAART) deel = verstreken / VAART;                // uitvaren
        else if (o.tijd < VAART) deel = o.tijd / VAART;                    // binnenvaren
        if (deel < 0) continue;                                            // op zee
        const pos = deel * (h.route.length - 1);
        const k = Math.min(h.route.length - 2, Math.floor(pos));
        const f = pos - k;
        const a = h.route[k];
        const b = h.route[k + 1];
        plek = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
        alpha = deel > 0.7 ? Math.max(0, (1 - deel) / 0.3) : 1;
        const vooruit = verstreken < VAART;
        const sx = (b.x - b.y) - (a.x - a.y);
        richting = (sx >= 0) === vooruit ? 1 : -1;
      }
      lijst.push({ x: plek.x, y: plek.y + deinen, alpha, richting, rood: h.rood });
    }
    return lijst;
  }

  // Voor het paneel.
  function info(vak) {
    const h = havens.get(vak);
    if (!h) return null;
    return { order: h.order ? { ...h.order } : null, reis: regels.reis };
  }

  function stand() {
    return [...havens.values()].filter((h) => h.order).map((h) => ({ vak: h.vak, order: h.order }));
  }
  function laad(lijst) {
    zoek();
    for (const { vak, order } of lijst || []) {
      const h = havens.get(vak);
      if (h && order) h.order = { ...order };
    }
  }

  zoek();
  return { zoek, bestel, waaromNiet, stap, schepen, info, stand, laad, havens: () => [...havens.values()], regels };
}
