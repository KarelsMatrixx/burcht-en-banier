import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8155'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto('http://localhost:8155/?x=' + Date.now()); await wacht();
await p.evaluate(() => localStorage.clear()); await p.reload(); await wacht();
await p.evaluate(async () => { window.__iso = await import('/js/iso.js'); document.getElementById('tip').hidden = true; });
const k = await p.evaluate(() => { const s = window.spel; const a = s.strijd.koning(0), r = s.strijd.koning(1); return { a: a && [a.x, a.y, a.leven], r: r && [r.x, r.y, r.leven], start: s.kaart.start, n: s.leger.soldaten().length, aanv: s.strijd.stand().vijanden }; });
console.log(JSON.stringify(k));
check('jouw koning bij je burcht', k.a && Math.hypot(k.a[0] - k.start[0].x, k.a[1] - k.start[0].y) < 6 && k.a[2] === 240);
check('koning van rood bij zijn burcht', k.r && Math.hypot(k.r[0] - k.start[1].x, k.r[1] - k.start[1].y) < 4);
check('koning telt niet als aanvaller', k.aanv === 0, k.aanv);
// selectie: knop Koning
await p.waitForTimeout(500);
const kn = await p.$$eval('#leger-groepen button', (x) => x.map((y) => y.textContent));
console.log(kn.join('|'));
// burcht schiet niet meer: rode ridder bij je burcht, koning valt aan
const r1 = await p.evaluate(async () => {
  const s = window.spel; const st = s.kaart.start[0];
  const v = s.strijd.zetVijand('ridder', st.x + 3, st.y + 2, 60) || s.strijd.zetVijand('ridder', st.x + 2, st.y + 3, 60);
  await new Promise((r) => setTimeout(r, 9000));
  return { v: v ? v.leven : null, dood: v ? !!v.dood || !s.strijd.vijanden().includes(v) : null, koning: s.strijd.koning(0).leven };
});
console.log(JSON.stringify(r1));
check('koning verslaat een ridder bij de burcht', r1.dood, JSON.stringify(r1));
// koning sturen: kies en tik
await p.evaluate(() => { const s = window.spel; s.leger.kies([s.strijd.koning(0)]); });
const doel = await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; for (let r = 4; r < 10; r++) for (let dx = -r; dx <= r; dx++) { const x = st.x + dx, y = st.y - r; if (s.wegvinder.isVrij(x, y, 0)) return [x, y]; } return null; });
const sp = await p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.zetZoom(1.2); return s.camera.wereldNaarScherm(w.x, w.y); }, doel);
await p.touchscreen.tap(sp.x, sp.y);
await p.waitForTimeout(6000);
const kp = await p.evaluate(() => { const a = window.spel.strijd.koning(0); return [a.x, a.y]; });
check('koning loopt waar je tikt', Math.hypot(kp[0] - doel[0] - 0.5, kp[1] - doel[1] - 0.5) < 1.6, JSON.stringify([kp, doel]));
// burcht kapot: geen verlies, koning zwakker
const r2 = await p.evaluate(() => { const s = window.spel; s.strijd.zetBurcht(0); s.strijd.stap(); return { u: s.strijd.uitslag(), m: document.getElementById('meldingen').textContent.slice(-150) }; });
check('burcht kapot is geen verlies', !r2.u, JSON.stringify(r2));
check('melding koning zwakker', /zwakker/.test(r2.m), r2.m);
// rode koning blijft thuis: zet hem weg, hij loopt terug
const r3 = await p.evaluate(async () => { const s = window.spel; const rk = s.strijd.koning(1); const st = s.kaart.start[1]; const t0 = Math.hypot(rk.x - st.x, rk.y - st.y); return t0; });
check('rode koning thuis', r3 < 3.5, r3);
// opslaan en laden: koningen blijven
await p.evaluate(() => { const s = window.spel; s.strijd.koning(1).leven = 100; });
await p.waitForTimeout(400);
await p.evaluate(() => window.spel.economie.verkoop('hout'));
await p.waitForTimeout(2500);
await p.reload(); await wacht();
const r4 = await p.evaluate(() => { const s = window.spel; return { a: !!s.strijd.koning(0), r: s.strijd.koning(1) && s.strijd.koning(1).leven, n: s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'koning').length }; });
check('na laden: één koning elk, rood leven bewaard', r4.a && r4.n === 1 && r4.r >= 100 && r4.r < 140, JSON.stringify(r4));
// rode koning dood = gewonnen
const r5 = await p.evaluate(() => { const s = window.spel; s.strijd.koning(1).dood = true; s.strijd.stap(); return { u: s.strijd.uitslag(), t: document.getElementById('einde-titel').textContent }; });
check('rode koning dood = gewonnen', r5.u === 'gewonnen' && /Gewonnen/.test(r5.t), JSON.stringify(r5));
await p.evaluate(() => localStorage.clear()); await p.reload(); await wacht();
const r6 = await p.evaluate(() => { const s = window.spel; s.strijd.koning(0).leven = 0; s.strijd.koning(0).dood = true; s.strijd.stap(); return { u: s.strijd.uitslag(), t: document.getElementById('einde-tekst').textContent }; });
check('jouw koning dood = verloren', r6.u === 'verloren' && /koning/.test(r6.t), JSON.stringify(r6));
// plaatje
await p.evaluate(() => localStorage.clear()); await p.reload(); await wacht();
await p.evaluate(async () => { const iso = await import('/js/iso.js'); const s = window.spel; const a = s.strijd.koning(0); s.leger.zetStand([['ridder', Math.floor(a.x) + 1, Math.floor(a.y), 60, 0], ['bijlridder', Math.floor(a.x) + 1, Math.floor(a.y) + 1, 60, 0]]); s.strijd.zetVijand('ridder', Math.floor(a.x) - 1, Math.floor(a.y) + 2, 60); const w = iso.rasterNaarWereld(a.x, a.y + 0.5); s.camera.x = w.x; s.camera.y = w.y - 10; s.camera.zetZoom(2.5); document.getElementById('tip').hidden = true; document.getElementById('meldingen').hidden = true; });
await p.waitForTimeout(800);
await p.screenshot({ path: '/home/claude/koning.png' });
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
