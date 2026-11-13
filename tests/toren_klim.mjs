import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8125'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('burcht-banier.paneel', 'bouw'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
await p.goto('http://localhost:8125/?x=' + Date.now()); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(async () => {
  window.__iso = await import('/js/iso.js');
  const s = window.spel;
  s.leger.zetStand([['toren', 38, 17, 300, 0], ['ridder', 37, 18, 9999, 0], ['ridder', 38, 18, 9999, 0], ['ridder', 39, 18, 9999, 0]]);
  setInterval(() => { for (const v of s.strijd.vijanden()) v.dood = true; for (const e of s.leger.soldaten()) e.leven = e.levenMax; }, 100);   // rood stoort even niet
});
const naarTegel = (x, y) => p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.begrens && s.camera.begrens(); return s.camera.wereldNaarScherm(w.x, w.y); }, [x, y]);
const muur = [44, 10];
// 1. toren kiezen met een tik op hem
const t = await p.evaluate(() => { const e = window.spel.leger.soldaten().find((e) => e.soldaat.sleutel === 'toren'); return { x: e.x, y: e.y }; });
let sp = await naarTegel(Math.floor(t.x), Math.floor(t.y)); await p.touchscreen.tap(sp.x, sp.y - 6);
check('toren gekozen', (await p.evaluate(() => window.spel.leger.aantalGekozen())) === 1);
sp = await naarTegel(...muur); await p.touchscreen.tap(sp.x, sp.y);
await p.waitForFunction(() => window.spel.strijd.ladders().some((l) => l.vast), null, { timeout: 60000 }).catch(() => {});
const lad = await p.evaluate(() => window.spel.strijd.ladders());
console.log('ladders', JSON.stringify(lad));
check('toren staat tegen de muur (vast)', lad.some((l) => l.vast && l.team === 0));
// 2. ridders kiezen (alle ridders) en muur aantikken
await p.evaluate(() => { const s = window.spel; s.leger.kies(s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'ridder')); });
check('3 ridders gekozen', (await p.evaluate(() => window.spel.leger.aantalGekozen())) === 3);
sp = await naarTegel(...muur); await p.touchscreen.tap(sp.x, sp.y);
let bin = false, opMuur = false;
for (let i = 0; i < 40 && !bin; i++) {
  await p.waitForTimeout(1000);
  const st = await p.evaluate(() => window.spel.leger.soldaten().filter((e) => e.soldaat.sleutel === 'ridder').map((e) => ({ x: +e.x.toFixed(1), y: +e.y.toFixed(1), m: !!e.opMuur })));
  opMuur = opMuur || st.some((r) => r.m);
  bin = st.some((r) => r.x > 44.5 && !r.m);   // voorbij de westmuur, in het kasteel
  if (i % 8 === 0) console.log(i, JSON.stringify(st));
}
check('ridder komt op de muur', opMuur);
await p.evaluate(() => { const s = window.spel; s.leger.kies(s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'ridder')); });
sp = await naarTegel(47, 10); await p.touchscreen.tap(sp.x, sp.y);
await p.waitForTimeout(100);
console.log('melding', await p.evaluate(() => window.spel.ui.logboek().map((r) => r.tekst).join(' | ').slice(-120)));
for (let i = 0; i < 30 && !bin; i++) { await p.waitForTimeout(1000); const st = await p.evaluate(() => window.spel.leger.soldaten().filter((e) => e.soldaat.sleutel === 'ridder').map((e) => ({ x: +e.x.toFixed(1), y: +e.y.toFixed(1), m: !!e.opMuur }))); bin = st.some((r) => r.x > 45.2 && !r.m); if (i % 6 === 0) console.log('na', i, JSON.stringify(st)); }
check('ridder komt binnen het kasteel', bin);
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
