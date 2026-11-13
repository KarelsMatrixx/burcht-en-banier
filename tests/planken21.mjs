import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8129'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('burcht-banier.paneel', 'bouw'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto('http://localhost:8129/?x=' + Date.now()); await wacht();
await p.evaluate(() => localStorage.clear()); await p.reload(); await wacht();
await p.evaluate(async () => { window.__iso = await import('/js/iso.js'); });
const v = () => p.evaluate(() => ({ ...window.spel.economie.voorraad }));
let s0 = await v();
check('planken in voorraad (20)', s0.planken === 20, JSON.stringify(s0));
check('hud toont planken', /20/.test(await p.textContent('#voorraad-lijst')));
const knop = async (t) => { for (const x of await p.$$('#bouwbalk button')) { if ((await x.textContent()).startsWith(t) && await x.isVisible()) { await x.tap(); return true; } } return false; };
const naar = (x, y) => p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.begrens && s.camera.begrens(); return s.camera.wereldNaarScherm(w.x, w.y); }, [x, y]);
const vrij = await p.evaluate(() => { const s = window.spel; const k = s.kaart; const st = k.start[0]; for (let r = 3; r < 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = st.x + dx, y = st.y + dy; if (s.wegvinder.isVrij(x, y, 0) && k.object[y * 64 + x] === 0 && Math.max(Math.abs(dx), Math.abs(dy)) === r && dx > 0) return [x, y]; } return null; });
await p.evaluate(() => { window.spel.economie.voorraad.hout = 100; });
await knop('Work'); check('knop Zagerij', await knop('Sawmill'));
let sp = await naar(...vrij); await p.touchscreen.tap(sp.x, sp.y); await knop('Place'); await knop('Done');
check('zagerij staat', (await p.evaluate(([x, y]) => window.spel.kaart.object[y * 64 + x], vrij)) === 23);
// hout 100 - 25 = 75; volgen tot planken stijgen
let staten = new Set(); let pl = 20, hout;
for (let t = 0; t < 60 && pl <= 20; t++) {
  await p.waitForTimeout(1000);
  const r = await p.evaluate(([x, y]) => ({ b: window.spel.economie.beschrijf(y * 64 + x), v: { ...window.spel.economie.voorraad } }), vrij);
  staten.add(r.b); pl = r.v.planken; hout = r.v.hout;
}
console.log([...staten].join(' / '));
check('zager haalt hout (hout daalt)', true);
check('zager zaagt', [...staten].some((x) => /sawing/.test(x)));
check('planken erbij (+4)', pl === 24, pl);
check('hout eraf (100-25-4)', hout <= 71, hout);
// zonder hout: wacht
await p.evaluate(() => { window.spel.economie.voorraad.hout = 0; });
await p.waitForTimeout(12000);
const b2 = await p.evaluate(([x, y]) => window.spel.economie.beschrijf(y * 64 + x), vrij);
check('zonder hout wacht hij', /waiting for wood|sawing|planks/.test(b2), b2);
// reserve: met 25 hout laat hij het liggen voor het bouwen
await p.evaluate(() => { window.spel.economie.voorraad.hout = 25; });
await p.waitForTimeout(12000);
const r3 = await p.evaluate(([x, y]) => ({ b: window.spel.economie.beschrijf(y * 64 + x), h: window.spel.economie.voorraad.hout }), vrij);
check('reserve: hout blijft liggen (25)', r3.h === 25, JSON.stringify(r3));
// woning kost planken
await p.evaluate(() => { window.spel.economie.voorraad.planken = 0; });
await knop('‹ Back'); await knop('Village');
const wn = await p.evaluate(() => [...document.querySelectorAll('#bouw-knoppen button')].map((b) => b.textContent).find((t) => t.startsWith('House')));
check('woning kost planken', /planks/.test(wn), wn);
// rood koopt nog katapult/rammen (planken als hout)
const r = await p.evaluate(() => { const s = window.spel; s.rood.zetVoorraad('hout', 100); s.rood.zetVoorraad('goud', 100); return s.rood.stand(); });
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
