// 0.106.0: tik een zagerij aan en kies vanaf hoeveel hout de zagers planken maken; geldt voor alle zagerijen.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8361;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' });
const p = await ctx.newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto(`http://localhost:${poort}/?x=` + Date.now()); await wacht();
await p.evaluate(() => localStorage.clear()); await p.reload(); await wacht();
// Twee vrije plekken rechts van de start
const plekken = await p.evaluate(() => { const s = window.spel; const k = s.kaart; const st = k.start[0]; const uit = []; for (let r = 3; r < 10 && uit.length < 2; r++) for (let dy = -r; dy <= r && uit.length < 2; dy += 3) { const x = st.x + r, y = st.y + dy; if (s.wegvinder.isVrij(x, y, 0) && k.object[y * 64 + x] === 0) uit.push([x, y]); } return uit; });
check('twee plekken', plekken.length === 2, JSON.stringify(plekken));
await p.evaluate(async (pl) => { window.__iso = await import('/js/iso.js'); const s = window.spel; s.economie.voorraad.hout = 200; s.economie.zetVolk(12); for (const [x, y] of pl) s.bouwer.plaats(s.bouwwerken.zagerij, [{ x, y }]); const t = document.getElementById('tip'); if (t) t.hidden = true; }, plekken);
await p.waitForTimeout(1500);
check('twee zagers aan het werk', (await p.evaluate(() => window.spel.economie.aantalMetBeroep('zager'))) === 2);
check('standaard grens 30', (await p.evaluate(() => window.spel.economie.reserveVan('zager'))) === 30);
// Tik de eerste zagerij aan
const [x0, y0] = plekken[0];
const sp = await p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x + 90; s.camera.y = w.y; s.camera.zetZoom(2); return s.camera.wereldNaarScherm(w.x, w.y - 8); }, [x0, y0]);
await p.touchscreen.tap(sp.x, sp.y); await p.waitForTimeout(400);
check('paneel open', await p.evaluate(() => !document.getElementById('handelpaneel').hidden));
const tekst = await p.textContent('#handel-tekst');
check('tekst noemt sawmill en 30', /Sawmill/.test(tekst) && /leave 30 wood/.test(tekst), tekst);
const kn = await p.$$eval('#handel-knoppen button', (k) => k.map((x) => x.textContent));
console.log(kn.join(' | '));
check('zeven keuzes', kn.length === 7);
await p.screenshot({ path: '/home/claude/zager106.png' });
// Kies 80: beide zagers laten 100 hout liggen? Nee: zagen tot er 80 over is.
await p.tap('#handel-knoppen button[data-verkoop="80"]'); await p.waitForTimeout(300);
check('grens 80 gezet', (await p.evaluate(() => window.spel.economie.reserveVan('zager'))) === 80);
check('bericht', /keep 80 wood/.test(await p.textContent('#handel-tekst')));
await p.screenshot({ path: '/home/claude/zager106b.png' });
await p.evaluate(() => { window.spel.economie.voorraad.hout = 70; });
await p.waitForTimeout(14000);
const r1 = await p.evaluate((pl) => ({ h: window.spel.economie.voorraad.hout, b: pl.map(([x, y]) => window.spel.economie.beschrijf(y * 64 + x)) }), plekken);
console.log(JSON.stringify(r1));
check('onder 80: hout blijft liggen (beide zagerijen)', r1.h === 70 && r1.b.every((t) => /leaving wood/.test(t) || !/sawing/.test(t)), JSON.stringify(r1));
// Grens 0: ze zagen alles
await p.tap('#handel-knoppen button[data-verkoop="0"]'); await p.waitForTimeout(16000);
const r2 = await p.evaluate(() => window.spel.economie.voorraad.hout);
check('grens 0: hout wordt gezaagd', r2 < 70, r2);
// Bewaren en terugzetten
const terug = await p.evaluate(() => { const E = window.spel.economie; E.zetReserve('zager', 50); const st = JSON.parse(JSON.stringify(E.bewaarStand())); E.zetReserve('zager', 10); E.zetStand(st); return E.reserveVan('zager'); });
check('grens wordt bewaard', terug === 50, terug);
await p.tap('#handel-sluit');
check('paneel dicht', await p.evaluate(() => document.getElementById('handelpaneel').hidden));
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill();
