// Rouwlint: zwart lint onder de rode banier, groter per level. Maakt per level een beeld van het kasteel van rood.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8252;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const levels = (process.argv[2] || '1,5').split(',').map(Number);
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
  await p.evaluate(() => { const s = window.spel; const t = s.CONFIG.tegel; const st = s.kaart.start[1]; const x = st.x ?? st[0], y = st.y ?? st[1]; s.camera.kijkNaar((x - y) * t.breedte / 2, (x + y) * t.hoogte / 2 - 70); });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `/tmp/s/rouwlint_${level}.png` });
  check(`geen scriptfouten level ${level}`, fouten.length === 0, fouten.join('|'));
  await p.close();
}
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
