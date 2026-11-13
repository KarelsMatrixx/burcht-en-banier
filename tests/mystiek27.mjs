import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8152'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('burcht-banier.paneel', 'bouw'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto('http://localhost:8152/?x=' + Date.now()); await wacht();
await p.evaluate(() => localStorage.clear()); await p.reload(); await wacht();
await p.evaluate(async () => { window.__iso = await import('/js/iso.js'); document.getElementById('tip').hidden = true; });
const vrij = (r0) => p.evaluate((r0) => { const s = window.spel; const k = s.kaart; const st = k.start[0]; for (let r = r0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = st.x + dx, y = st.y + dy; let goed = true; for (let a = -2; a <= 4; a++) for (let c = -2; c <= 2; c++) if (!s.wegvinder.isVrij(x + a, y + c, 0) || k.object[(y + c) * 64 + x + a] !== 0) goed = false; if (goed) return [x, y]; } return null; }, r0);
const plek = await vrij(4); const veld = await vrij(9);
// 1. Magiertoren bouwen met tikken, paneel toont alleen mystieke soldaten
await p.evaluate(() => { const v = window.spel.economie.voorraad; v.planken = 100; v.steen = 100; v.goud = 300; v.koper = 40; });
const knop = async (t) => { for (const x of await p.$$('#bouwbalk button')) { if ((await x.textContent()).startsWith(t) && await x.isVisible()) { await x.tap(); return true; } } return false; };
await knop('Army'); check('knop Magiertoren', await knop('Mage Tower'));
let sp = await p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.zetZoom(1); return s.camera.wereldNaarScherm(w.x, w.y); }, plek);
await p.touchscreen.tap(sp.x, sp.y); await knop('Place'); await knop('Done');
check('magiertoren staat', (await p.evaluate(([x, y]) => window.spel.kaart.object[y * 64 + x], plek)) === 27);
await p.waitForTimeout(400);
sp = await p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); return s.camera.wereldNaarScherm(w.x, w.y + 4); }, plek);
await p.touchscreen.tap(sp.x, sp.y); await p.waitForTimeout(300);
const kn = await p.$$eval('#leger-opleiden button', (k) => k.map((x) => x.dataset.soldaat));
check('paneel: alleen sluip en vlam', kn.join() === 'sluipmoordenaar,vlammenwever', kn.join());
const boer0 = await p.evaluate(() => window.spel.economie.bevolking().vrij);
await p.tap('#leger-opleiden button[data-soldaat="sluipmoordenaar"]');
const boer1 = await p.evaluate(() => window.spel.economie.bevolking().vrij);
check('sluip kost 2 boeren', boer0 - boer1 === 2, `${boer0} -> ${boer1}`);
await p.screenshot({ path: '/home/claude/stap27-paneel.png' });
await p.tap('#leger-sluit');
// 2. Klassieke kazerne toont geen mystieke
const kk = await p.evaluate(() => Object.values(window.spel.leger.soorten).filter((d) => (d.kazerne || 'klassiek') === 'klassiek').map((d) => d.sleutel));
check('klassiek zonder mystiek', !kk.includes('sluipmoordenaar') && kk.includes('bijlridder'));
// 3. Verborgen: een rode boogschutter op 5 tegels schiet niet op de sluip
const r3 = await p.evaluate(async ([x, y]) => {
  const s = window.spel; for (const v of s.strijd.vijanden()) v.dood = true;
  s.leger.zetStand([['sluipmoordenaar', x, y, 36, 0]]);
  const e = s.leger.soldaten().find((a) => a.soldaat.sleutel === 'sluipmoordenaar' && Math.floor(a.x) === x);
  const v = s.strijd.zetVijand('boogschutter', x + 5, y, 30);
  // de sluip zelf blijft staan (anders gaat hij erop af en wordt hij zichtbaar)
  const t0 = performance.now(); while (performance.now() - t0 < 3000) { if (e.krijg) { e.krijg.denk = 1e9; e.krijg.doelwit = null; e.pad = null; } await new Promise((r) => setTimeout(r, 20)); }
  const l = e.leven;
  // nu dichtbij zetten: binnen 3 tegels wel
  return { l, verb: e.verborgen };
}, veld);
check('verborgen sluip niet beschoten op 5 tegels', r3.l === 36 && r3.verb, JSON.stringify(r3));
// 4. Eerste slag 300% (30 schade) op een ridder
const r4 = await p.evaluate(async ([x, y]) => {
  const s = window.spel; for (const v of s.strijd.vijanden()) v.dood = true;
  s.leger.zetStand([['sluipmoordenaar', x, y + 3, 36, 0]]);
  const v = s.strijd.zetVijand('ridder', x + 1, y + 3, 60);
  const e = s.leger.soldaten().find((a) => a.soldaat.sleutel === 'sluipmoordenaar' && Math.floor(a.y) === y + 3);
  e.leven = 9999;
  let eerste = null; const t0 = performance.now();
  while (performance.now() - t0 < 3000) { await new Promise((r) => setTimeout(r, 30)); if (v.leven < 60 && eerste === null) eerste = 60 - v.leven; }
  return { eerste };
}, veld);
check('eerste slag 36 (3 x 12)', r4.eerste === 36, JSON.stringify(r4));
// 5. Vlammenwever: gebiedsschade op twee vijanden naast elkaar
const r5 = await p.evaluate(async ([x, y]) => {
  const s = window.spel; for (const v of s.strijd.vijanden()) v.dood = true;
  s.leger.zetStand([['vlammenwever', x, y, 9999, 0]]);
  const a = s.strijd.zetVijand('ridder', x + 5, y, 60); const c = s.strijd.zetVijand('ridder', x + 5, y + 1, 60);
  await new Promise((r) => setTimeout(r, 2000));
  return { a: a.leven, c: c.leven };
}, veld);
check('vuurbal raakt twee', r5.a < 60 && r5.c < 60, JSON.stringify(r5));
// 6. Vlam op stormram: brand
const r6 = await p.evaluate(async ([x, y]) => {
  const s = window.spel; for (const v of s.strijd.vijanden()) v.dood = true;
  const ram = s.strijd.zetVijand('ram', x + 5, y, 240);
  await new Promise((r) => setTimeout(r, 1500));
  const brand = ram.krijg && ram.krijg.brand;
  return { brand, leven: ram.leven };
}, veld);
check('ram vat vlam', r6.brand > 0, JSON.stringify(r6));
// 7. Klimmen: sluip naar een rode muur, met een tik
const muur = await p.evaluate(() => { const s = window.spel; const k = s.kaart; const m = k.start[1]; for (let dy = -3; dy <= 3; dy++) { const x = m.x - 5, y = m.y + dy; if (k.object[y * 64 + x] === 4 && k.eigenaar[y * 64 + x] === 2) return [x, y]; } return null; });
await p.evaluate(([x, y]) => { const s = window.spel; for (const v of s.strijd.vijanden()) v.dood = true; s.leger.zetStand([['sluipmoordenaar', x - 4, y + 1, 9999, 0]]); const e = s.leger.soldaten().find((a) => Math.floor(a.x) === x - 4 && Math.floor(a.y) === y + 1); s.leger.kies([e]); window.__sl = e; setInterval(() => { for (const v of s.strijd.vijanden()) v.dood = true; }, 200); }, muur);
sp = await p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.zetZoom(1.2); return s.camera.wereldNaarScherm(w.x, w.y - 18); }, muur);
await p.touchscreen.tap(sp.x, sp.y);
let boven = false;
for (let t = 0; t < 20 && !boven; t++) { await p.waitForTimeout(500); boven = await p.evaluate(() => window.__sl.opMuur); }
check('sluip klimt zonder ladder op de muur', boven, await p.evaluate(() => window.spel.ui.logboek().map((r) => r.tekst).join(' | ').slice(-120)));
check('geen ladder gezet', (await p.evaluate(() => window.spel.strijd.ladders().length)) === 0);
// 8. Van de muur naar binnen
const binnen = await p.evaluate(([x, y]) => { const s = window.spel; const e = window.__sl; s.leger.kies([e]); return s.leger.stuurNaar ? 'x' : Object.keys(s.leger).filter((k) => /stuur|loop/.test(k)).join(); }, muur);
console.log('stuur api', binnen);
// plaatje
await p.evaluate(([x, y]) => { const s = window.spel; s.leger.zetStand([['sluipmoordenaar', 20, 50, 36, 0], ['vlammenwever', 21, 50, 33, 0], ['vlammenwever', 22, 51, 33, 0]]); const w = window.__iso.rasterNaarWereld(21, 50.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.zetZoom(2.5); }, muur);
await p.waitForTimeout(800);
await p.screenshot({ path: '/home/claude/stap27.png' });
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
