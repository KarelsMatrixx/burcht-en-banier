import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8123'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true });
const p = await ctx.newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const laad = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto('http://localhost:8123/?x=' + Date.now()); await laad();
await p.evaluate(() => localStorage.clear()); await p.reload(); await laad();
const soort = process.argv[2] || 'katapult';
const doelVak = process.argv[3] ? process.argv[3].split(',').map(Number) : [44, 13];
await p.evaluate(async (soort) => {
  const iso = await import('/js/iso.js'); window.__iso = iso;
  const s = window.spel; const m = s.strijd.rood();
  s.leger.zetStand([[soort, Math.floor(m.x) - 14, Math.floor(m.y) + 10, 100, 0]]);
}, soort);
// helper: camera op tegel, geef schermpunt van tegel terug
const naarTegel = (x, y) => p.evaluate(([x, y]) => {
  const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5);
  s.camera.x = w.x; s.camera.y = w.y; s.camera.begrens && s.camera.begrens();
  return s.camera.wereldNaarScherm(w.x, w.y);
}, [x, y]);
const e0 = await p.evaluate(() => { const e = window.spel.leger.soldaten()[0]; return { x: e.x, y: e.y }; });
let sp = await naarTegel(Math.floor(e0.x), Math.floor(e0.y));
await p.touchscreen.tap(sp.x, sp.y - 6);
let g = await p.evaluate(() => window.spel.leger.aantalGekozen());
check('soldaat gekozen met tik', g === 1, g);
sp = await naarTegel(doelVak[0], doelVak[1]);
console.log('doel scherm', JSON.stringify(sp));
await p.touchscreen.tap(sp.x, sp.y);
await p.waitForTimeout(300);
const melding = await p.evaluate(() => document.getElementById('meldingen').textContent);
const stand = await p.evaluate(() => { const e = window.spel.leger.soldaten()[0]; return { x: e.x, y: e.y, pad: !!e.pad }; });
console.log('na tik', JSON.stringify(stand), 'melding:', melding);
const l0 = await p.evaluate(([x, y]) => (window.spel.strijd.levenOp(y * 64 + x) || window.spel.strijd.stand().rood), doelVak);
for (let i = 0; i < 12; i++) { await p.waitForTimeout(4000); console.log(i * 4, JSON.stringify(await p.evaluate(([x, y]) => { const e = window.spel.leger.soldaten()[0]; return e ? { m: window.spel.melding || 0, x: +e.x.toFixed(1), y: +e.y.toFixed(1), pad: !!e.pad, l: e.soldaat.leven, t: (window.spel.strijd.levenOp(y * 64 + x) || window.spel.strijd.stand().rood).leven, v: window.spel.strijd.stand().vijanden } : null; }, doelVak))); }
const l1 = await p.evaluate(([x, y]) => (window.spel.strijd.levenOp(y * 64 + x) || window.spel.strijd.stand().rood), doelVak);
const e1 = await p.evaluate(() => { const e = window.spel.leger.soldaten()[0]; return e ? { x: e.x, y: e.y, opMuur: e.opMuur } : null; });
console.log('leven', JSON.stringify(l0), '->', JSON.stringify(l1), 'soldaat', JSON.stringify(e1), 'ladders', JSON.stringify(await p.evaluate(() => window.spel.strijd.ladders())));
check('doel kreeg schade (katapult)', soort !== 'katapult' || (l1 && l0 && l1.leven < l0.leven), JSON.stringify([l0, l1]));
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
