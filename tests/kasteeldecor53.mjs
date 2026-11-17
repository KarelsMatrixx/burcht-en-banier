// Decor in het kasteel van rood (detailronde): level 1 heeft een tent, hooibergen, vaten en een put in de binnenplaats.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8253;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const levels = (process.argv[2] || '1').split(',').map(Number);
for (const level of levels) {
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
  const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
  const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
  await p.goto(`http://localhost:${poort}/`); await wacht();
  await p.evaluate((level) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: level })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, level);
  await p.reload(); await wacht();
  await p.tap('#missie-begin', { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => { const s = window.spel; const k = s.kaart; const st = k.start[1]; const x0 = st.x ?? st[0], y0 = st.y ?? st[1];
    const tel = {}; for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { const o = k.object[(y0 + dy) * k.breedte + x0 + dx]; tel[o] = (tel[o] || 0) + 1; }
    return { tel, bereikbaar: s.wegvinder.verbonden ? true : null }; });
  console.log('level', level, JSON.stringify(info.tel));
  if (level === 1) { check('tent', info.tel[13] >= 1); check('hooiberg', info.tel[14] >= 2); check('vaten', info.tel[16] >= 1); check('put', info.tel[15] >= 1); }
  await p.evaluate((level) => { const s = window.spel; const t = s.CONFIG.tegel; const st = s.kaart.start[1]; const x = st.x ?? st[0], y = st.y ?? st[1]; s.camera.kijkNaar((x - y) * t.breedte / 2, (x + y) * t.hoogte / 2 + (level === 3 ? 60 : -20)); }, level);
  await p.waitForTimeout(600);
  await p.screenshot({ path: `/tmp/s/decor_${level}.png` });
  check(`geen scriptfouten level ${level}`, fouten.length === 0, fouten.join('|'));
  await p.close();
}
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
