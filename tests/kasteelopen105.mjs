// 0.105.0: Greyford: achter muur 3 kun je het rode kasteel inlopen (open poort) en er staan weinig olietorens.
import fs from 'fs';
import { maakKaart, OBJECT } from '../js/kaart.js';
const k = JSON.parse(fs.readFileSync(new URL('../data/kaarten.json', import.meta.url))).kaarten.grauwvoort;
const kast = JSON.parse(fs.readFileSync(new URL('../data/kastelen.json', import.meta.url)));
const m = maakKaart({ ...k, kasteel: (kast.kastelen || kast).tolhuis });
let ok = 0, fout = 0; const check = (n, w, d = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, d); } };
const B = m.breedte, mid = 26;
const dicht = (o) => o === OBJECT.MUUR || o === OBJECT.TOREN || o === OBJECT.WACHTTOREN || o === OBJECT.MOORDGATENTOREN || o === OBJECT.POORT || o === OBJECT.STEEN || o === OBJECT.BURCHT;
const burcht = []; for (let i = 0; i < m.object.length; i++) if (m.object[i] === OBJECT.BURCHT) burcht.push(i);
check('burcht bestaat', burcht.length > 0);
// Vloed vanaf de strook vlak voor het kasteel (rij 16), 4 richtingen, alleen niet-dichte tegels
const gezien = new Set(); const rij = [16 * B + mid]; gezien.add(rij[0]);
while (rij.length) { const i = rij.pop(); const x = i % B, y = Math.floor(i / B); for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= B || ny >= m.hoogte) continue; const j = ny * B + nx; if (gezien.has(j) || dicht(m.object[j])) continue; gezien.add(j); rij.push(j); } }
const raak = burcht.some((i) => [1, -1, B, -B].some((d) => gezien.has(i + d)));
check('vanaf rij 16 loop je tot aan de burcht', raak);
const olie = m.object.reduce((n, o, i) => n + (o === OBJECT.MOORDGATENTOREN && Math.floor(i / B) < 16 ? 1 : 0), 0);
check('hooguit 4 olietorens bij het kasteel', olie <= 4, olie);
console.log('olietorens kasteel', olie);
console.log(`kasteelopen105: ${ok} goed, ${fout} fout`);
