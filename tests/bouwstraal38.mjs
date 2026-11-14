// Stap 38: bouwstraal 14 en golven in level 4.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8241;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1');
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 4 })); });
await p.reload(); await wacht(); await p.waitForTimeout(500);
const g = await p.evaluate(() => { const s = window.spel; const t = s.kaart.start[0]; const w = s.bouwwerken.muur;
  const dichtbij = s.bouwer.waaromNiet ? null : 'n.v.t.';
  return { t, regels: s.regels.bouwStraal, golven: s.missies.campagne[4].doel.golven }; });
check('bouwStraal 14 geladen', g.regels === 14, JSON.stringify(g));
check('golven zachter', g.golven.eerste === 150 && g.golven.begin === 3 && g.golven.max === 8, JSON.stringify(g.golven));
// Bouwen: binnen en buiten de straal
const r = await p.evaluate(() => { const s = window.spel; const t = s.kaart.start[0]; s.economie.voorraad.steen = 500; s.economie.voorraad.hout = 500;
  const vrij = (x, y) => s.kaart.object[y * s.kaart.breedte + x] === 0 && s.kaart.grond[y * s.kaart.breedte + x] !== 3;
  const vind = (d) => { for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue; const x = t.x + dx, y = t.y + dy; if (x >= 0 && y >= 0 && x < s.kaart.breedte && y < s.kaart.hoogte && vrij(x, y)) return { x, y }; } return null; };
  const bin = vind(13), bui = vind(15);
  return { bin: bin && s.bouwer.plaats(s.bouwwerken.muur, [bin]), bui: bui && s.bouwer.plaats(s.bouwwerken.muur, [bui]), hebBin: !!bin, hebBui: !!bui }; });
check('binnen 14: bouwen lukt', r.hebBin && r.bin === 1, JSON.stringify(r));
check('buiten 14: bouwen mislukt', r.hebBui && r.bui === 0, JSON.stringify(r));
// De hut ligt buiten de straal
const h = await p.evaluate(() => { const s = window.spel; const t = s.kaart.start[0]; const hh = s.strijd.hut(); return Math.max(Math.abs((hh.vak % s.kaart.breedte) - t.x), Math.abs(Math.floor(hh.vak / s.kaart.breedte) - t.y)); });
check('hut ligt buiten het bouwgebied', h > 14, h);
// Een golf komt echt op de hut af
await p.evaluate(() => { document.getElementById('missie').hidden = true; });
const w = await p.evaluate(() => { const s = window.spel; const n = s.strijd.stuurLeger({ ridder: 3 }, true); return n; });
check('golf verschijnt', w === 3, w);
const d0 = await p.evaluate(() => { const s = window.spel; const hh = s.strijd.hut(); const x = hh.vak % s.kaart.breedte, y = Math.floor(hh.vak / s.kaart.breedte); return s.strijd.vijanden().filter((e) => e.wachter === undefined).map((e) => Math.hypot(e.x - x, e.y - y)); });
await p.waitForTimeout(6000);
const d1 = await p.evaluate(() => { const s = window.spel; const hh = s.strijd.hut(); const x = hh.vak % s.kaart.breedte, y = Math.floor(hh.vak / s.kaart.breedte); return s.strijd.vijanden().filter((e) => e.wachter === undefined).map((e) => Math.hypot(e.x - x, e.y - y)); });
const som = (a) => a.reduce((x, y) => x + y, 0);
check('de golf loopt naar de hut', d1.length > 0 && som(d1) / d1.length < som(d0) / d0.length - 2, JSON.stringify([d0, d1]));
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
