import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8128'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('burcht-banier.paneel', 'bouw'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto('http://localhost:8128/?x=' + Date.now()); await wacht();
await p.evaluate(() => localStorage.clear()); await p.reload(); await wacht();
const e = () => p.evaluate(() => { const s = window.spel.economie; return { v: { ...s.voorraad }, max: s.opslagMax('hout'), k: s.opslagKamers() }; });
let i = await e();
check('grens 150 zonder kamer', i.max === 150 && i.k === 0, JSON.stringify(i));
const hud = await p.textContent('#voorraad-lijst');
check('hud toont 60', /60/.test(hud), hud);
const knop = async (t) => { for (const x of await p.$$('#bouwbalk button')) { if ((await x.textContent()).startsWith(t) && await x.isVisible()) { await x.tap(); return true; } } return false; };
await p.evaluate(async () => { window.__iso = await import('/js/iso.js'); window.spel.economie.voorraad.hout = 150; });
// vrije tegel naast de burcht binnen de ring vinden
const vrij = await p.evaluate(() => { const s = window.spel; const k = s.kaart; const st = k.start[0]; for (let r = 3; r < 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = st.x + dx, y = st.y + dy; if (s.wegvinder.isVrij(x, y, 0) && k.object[y * 64 + x] === 0 && Math.max(Math.abs(dx), Math.abs(dy)) === r && dx > 0) return [x, y]; } return null; });
console.log('vrij', vrij);
await knop('Village'); check('knop Voorraad', await knop('Storehouse'));
const sp = await p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.begrens && s.camera.begrens(); return s.camera.wereldNaarScherm(w.x, w.y); }, vrij);
await p.touchscreen.tap(sp.x, sp.y);
await p.tap('#knop-hamer'); await knop('Done');
await p.waitForTimeout(300);
const o = await p.evaluate(([x, y]) => window.spel.kaart.object[y * 64 + x], vrij);
check('voorraadkamer staat (object 22)', o === 22, o);
await p.waitForTimeout(1500);
i = await e();
check('grens 300 met kamer', i.max === 300 && i.k === 1, JSON.stringify(i));
check('paneel toont van 300', /\/300/.test(await p.textContent('#volk-grondstoffen')), await p.textContent('#volk-tekst'));
// werker met vol magazijn
const hk = await p.evaluate(() => {
  const s = window.spel; const k = s.kaart; const w = s.bouwwerken.voorraadkamer ? (s.bouwer.werken ? null : null) : null;
  // dichtstbijzijnde boom
  let best = null;
  for (let v = 0; v < 4096; v++) if (k.object[v] === 1) { const x = v % 64, y = Math.floor(v / 64); const d = Math.hypot(x - k.start[0].x, y - k.start[0].y); if (!best || d < best.d) best = { x, y, d }; }
  // vrij vak naast die boom
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) { const x = best.x + dx, y = best.y + dy; if (s.wegvinder.isVrij(x, y, 0) && k.object[y * 64 + x] === 0) return [x, y]; }
  return null;
});
console.log('houthakker op', hk);
await p.evaluate(() => { window.spel.economie.voorraad.hout = 300; window.spel.economie.voorraad.goud = 500; });
await knop('‹ Back'); await knop('Work'); check('knop Houthakker', await knop("Woodcutter's Hut"));
const sp2 = await p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.begrens && s.camera.begrens(); return s.camera.wereldNaarScherm(w.x, w.y); }, hk);
await p.touchscreen.tap(sp2.x, sp2.y); await p.tap('#knop-hamer'); await knop('Done');
const werkers = () => p.evaluate(() => [...window.spel.eenheden.lijst ? window.spel.eenheden.lijst() : []].length);
let klem = '';
for (let t = 0; t < 120 && !/full/.test(klem); t++) {
  await p.waitForTimeout(1000);
  klem = await p.evaluate(() => window.spel.ui.logboek().map((r) => r.tekst).join(' | '));
}
console.log('melding:', klem.slice(-160));
check('werker meldt dat opslag vol is', /full/.test(klem), klem.slice(-200));
const hout1 = await p.evaluate(() => window.spel.economie.voorraad.hout);
check('hout blijft op grens', hout1 === 300, hout1);
await p.evaluate(() => { window.spel.economie.voorraad.hout = 100; });
let hout2 = 100;
for (let t = 0; t < 30 && hout2 <= 100; t++) { await p.waitForTimeout(1000); hout2 = await p.evaluate(() => window.spel.economie.voorraad.hout); }
check('na ruimte maken levert hij af', hout2 > 100, hout2);
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
