import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8143'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto('http://localhost:8143/?x=' + Date.now()); await wacht();
await p.evaluate(() => localStorage.clear()); await p.reload(); await wacht();
await p.evaluate(async () => { window.__iso = await import('/js/iso.js'); });
// vrij vak naast kopererts, dichtst bij de burcht
const vak = await p.evaluate(() => {
  const s = window.spel; const k = s.kaart; const st = k.start[0]; let best = null;
  for (let v = 0; v < 4096; v++) { if (k.object[v] !== 0) continue; const x = v % 64, y = Math.floor(v / 64); if (!s.wegvinder.isVrij(x, y, 0)) continue;
    let bij = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (k.object[(y + dy) * 64 + x + dx] === 3) bij = true;
    if (!bij) continue; const d = Math.hypot(x - st.x, y - st.y); if (!best || d < best.d) best = { x, y, d }; }
  return best;
});
console.log('mijnplek', JSON.stringify(vak));
check('kopererts op de kaart bij de speler', vak && vak.d < 20, JSON.stringify(vak));
await p.evaluate(() => { const v = window.spel.economie.voorraad; v.hout = 100; v.planken = 50; document.getElementById('tip').hidden = true; });
const knop = async (t) => { for (const x of await p.$$('#bouwbalk button')) { if ((await x.textContent()).startsWith(t) && await x.isVisible()) { await x.tap(); return true; } } return false; };
await knop('Werk'); check('knop Kopermijn', await knop('Kopermijn'));
const sp = await p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.zetZoom(1); return s.camera.wereldNaarScherm(w.x, w.y); }, [vak.x, vak.y]);
await p.touchscreen.tap(sp.x, sp.y); await knop('Zet neer'); await knop('Klaar');
check('mijn staat', (await p.evaluate(([x, y]) => window.spel.kaart.object[y * 64 + x], [vak.x, vak.y])) === 26);
let koper = 0; const st = new Set();
for (let t = 0; t < 90 && koper === 0; t++) { await p.waitForTimeout(1000); const r = await p.evaluate(([x, y]) => ({ k: window.spel.economie.voorraad.koper, b: window.spel.economie.beschrijf(y * 64 + x) }), [vak.x, vak.y]); koper = r.k; st.add(r.b); }
console.log([...st].join(' / '));
check('koper binnen', koper === 4, koper);
check('koper in balk', /Koper/.test(await p.evaluate(() => [...document.querySelectorAll('#voorraad-lijst .grondstof')].map((g) => g.dataset.naam).join())));
await p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.zetZoom(3); }, [vak.x, vak.y]);
await p.waitForTimeout(800);
await p.screenshot({ path: '/home/claude/stap23.png' });
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
