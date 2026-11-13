// MACHINES in dezelfde stijl als heren en soldaten: de bestaande tekeningen van de ram,
// de katapult en de belegeringstoren (kunst.js) krijgen dezelfde donkere omlijning en een
// zachtere schaduw. De omlijning komt alleen om het werktuig zelf, niet om zijn schaduw.
// Zelfde beeldcontract: { rechts, links, b, h, ax, ay, houdingen }.

import { tekenRam, tekenKatapult, tekenBelegeringstoren } from './kunst.js';

const OMLIJN = [27, 19, 13];

// Zet om een plaatje een omlijning van 1 beeldpunt (in doekpixels: r).
function omlijn(doek, r, pad) {
  const d0 = doek.getContext('2d').getImageData(0, 0, doek.width, doek.height);
  const w = doek.width + 2 * pad, h = doek.height + 2 * pad;
  // eerst op een ruimer doek zetten, zodat de omlijning niet tegen de rand valt
  const ruim = document.createElement('canvas');
  ruim.width = w; ruim.height = h;
  ruim.getContext('2d').putImageData(d0, pad, pad);
  doek = ruim;
  const d = ruim.getContext('2d').getImageData(0, 0, w, h);
  const masker = document.createElement('canvas');
  masker.width = w; masker.height = h;
  const mc = masker.getContext('2d');
  const m = mc.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    if (d.data[i * 4 + 3] > 110) { m.data[i * 4] = OMLIJN[0]; m.data[i * 4 + 1] = OMLIJN[1]; m.data[i * 4 + 2] = OMLIJN[2]; m.data[i * 4 + 3] = 255; }
  }
  mc.putImageData(m, 0, 0);
  const uit = document.createElement('canvas');
  uit.width = w; uit.height = h;
  const u = uit.getContext('2d');
  for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; u.drawImage(masker, Math.cos(a) * r, Math.sin(a) * r); }
  u.drawImage(doek, 0, 0);
  return uit;
}

const MARGE = 3;   // logische pixels extra rondom
function omlijnSet(set, r) {
  const schaal = set.rechts[0].width / set.b;
  const pad = Math.ceil(MARGE * schaal);
  const marge = pad / schaal;
  const uit = {
    ...set,
    rechts: set.rechts.map((c) => omlijn(c, r, pad)), links: set.links.map((c) => omlijn(c, r, pad)),
    b: set.b + 2 * marge, h: set.h + 2 * marge, ax: set.ax + marge, ay: set.ay + marge,
  };
  if (set.houdingen) {
    uit.houdingen = {};
    for (const [naam, t] of Object.entries(set.houdingen)) uit.houdingen[naam] = omlijnSet(t, r);
  }
  return uit;
}

const R = 1.4;
export const MACHINES = {
  ram: (naam, def) => omlijnSet(tekenRam(naam, def), R),
  katapult: (naam, def) => omlijnSet(tekenKatapult(naam, def), R),
  belegeringstoren: (naam, def) => omlijnSet(tekenBelegeringstoren(naam, def), R),
};
