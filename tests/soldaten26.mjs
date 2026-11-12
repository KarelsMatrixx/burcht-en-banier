import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8150'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto('http://localhost:8150/?x=' + Date.now()); await wacht();
await p.evaluate(() => localStorage.clear()); await p.reload(); await wacht();
// 1. Kazerne: nieuwe soldaten in het paneel, kosten met koper
const vrij = (r0) => p.evaluate((r0) => { const s = window.spel; const k = s.kaart; const st = k.start[0]; for (let r = r0; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = st.x + dx, y = st.y + dy; let goed = true; for (let a = -2; a <= 4; a++) for (let c = -2; c <= 2; c++) if (!s.wegvinder.isVrij(x + a, y + c, 0) || k.object[(y + c) * 64 + x + a] !== 0) goed = false; if (goed) return [x, y]; } return null; }, r0);
const plek = await vrij(4); const veld = await vrij(9);
console.log('plek', plek, 'veld', veld);
await p.evaluate((pl) => { const s = window.spel; const v = s.economie.voorraad; v.planken = 100; v.steen = 100; v.goud = 200; v.koper = 20; s.bouwer.plaats(s.bouwwerken.kazerne, [{ x: pl[0], y: pl[1] }]); }, plek);
const kz = await p.evaluate((pl) => window.spel.kaart.object[pl[1] * 64 + pl[0]], plek);
const knoppen = await p.evaluate(() => { const s = window.spel; return Object.keys(s.leger.soorten); });
check('soorten bevat bijlridder en kruisboog', knoppen.includes('bijlridder') && knoppen.includes('kruisboog'), knoppen.join());
await p.evaluate((pl) => { window.__kv = pl[1] * 64 + pl[0]; }, plek);
const r1 = await p.evaluate(() => { const s = window.spel; const kv = window.__kv; const a = s.leger.leidOp('bijlridder', kv); const b = s.leger.leidOp('kruisboog', kv); return { a, b, v: { ...s.economie.voorraad } }; });
console.log('opleiden', JSON.stringify(r1), 'kazerne', kz);
// 2. Gevecht: bijlridder raakt twee vijanden
check('opgeleid', r1.a === '' && r1.b === '' && r1.v.koper === 17 && r1.v.goud === 176, JSON.stringify(r1));
const r2 = await p.evaluate(async ([x, y]) => {
  const s = window.spel; s.strijd.pauzeer(false);
  s.leger.zetStand([['bijlridder', x, y, 9999, 0]]);
  const a = s.strijd.zetVijand('ridder', x + 1, y, 60); const c = s.strijd.zetVijand('ridder', x + 1, y + 1, 60);
  await new Promise((r) => setTimeout(r, 3500));
  return { a: a.leven, c: c.leven };
}, veld);
console.log('zwaai', JSON.stringify(r2));
check('bijl raakt twee vijanden', r2.a < 60 && r2.c < 60, JSON.stringify(r2));
// 3. Kruisboog door het dak van een stormram: volle schade (18)
const r3 = await p.evaluate(async ([x, y]) => {
  const s = window.spel; for (const v of s.strijd.vijanden()) v.dood = true; s.leger.zetStand([['kruisboog', x, y, 9999, 0]]);
  const ram = s.strijd.zetVijand('ram', x + 4, y, 240);
  await new Promise((r) => setTimeout(r, 2600));
  return 240 - ram.leven;
}, veld);
check('kruisboog doorboort het dak (veelvoud van 18)', r3 >= 18 && r3 % 18 === 0, r3);
// 4. Bijl dubbel op een rode werkplaats
const r4 = await p.evaluate(async () => {
  const s = window.spel; const k = s.kaart; let werk = -1;
  for (let v = 0; v < k.object.length; v++) if (k.object[v] === 17 && k.eigenaar[v] === 2) { werk = v; break; }
  const x = werk % 64, y = Math.floor(werk / 64);
  for (const v of s.strijd.vijanden()) v.dood = true;
  let vx = -1, vy = -1; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) if (vx < 0 && s.wegvinder.isVrij(x + dx, y + dy, 0)) { vx = x + dx; vy = y + dy; }
  s.leger.zetStand([['bijlridder', vx, vy, 9999, 0]]);
  const e = s.leger.soldaten().find((a) => Math.floor(a.x) === vx && Math.floor(a.y) === vy);
  s.leger.kies([e]);
  const okb = s.strijd.valBouwAan(s.leger.gekozen(), werk);
  const l0 = s.strijd.levenOp(werk).leven;
  await new Promise((r) => setTimeout(r, 7000));
  const l1 = s.strijd.levenOp(werk); return { okb, l0, l1: l1 ? l1.leven : 0, e: [e.x, e.y, e.soldaat.sleutel], werk: [x, y], v: [vx, vy], n: s.leger.soldaten().length };
});
console.log('bouw', JSON.stringify(r4));
check('bijl doet 10 per slag op hout', (r4.l0 - r4.l1) % 10 === 0 && r4.l0 > r4.l1, JSON.stringify(r4));
// 5. plaatje
await p.evaluate(async () => {
  const iso = await import('/js/iso.js'); const s = window.spel;
  for (const v of s.strijd.vijanden()) v.dood = true;
  s.leger.zetStand([['ridder', 20, 50, 60, 0], ['bijlridder', 21, 50, 66, 0], ['bijlridder', 21, 51, 66, 0], ['boogschutter', 20, 52, 30, 0], ['kruisboog', 21, 52, 42, 0], ['kruisboog', 22, 52, 42, 0]]);
  s.strijd.zetVijand('ridder', 23, 50, 60);
  const w = iso.rasterNaarWereld(21.5, 51); s.camera.x = w.x; s.camera.y = w.y; s.camera.zetZoom(2.5);
  document.getElementById('tip').hidden = true;
});
await p.waitForTimeout(1500);
await p.screenshot({ path: '/home/claude/stap26.png' });
// 6. selectieknoppen
const kn = await p.$$eval('#leger-groepen button', (k) => k.map((x) => x.textContent));
check('knoppen per soort', kn.some((t) => /Axe Knight/.test(t)) && kn.some((t) => /Crossbowman/.test(t)), kn.join('|'));
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
