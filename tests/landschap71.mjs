// Landschap per level (0.71.0): elk level laadt zijn eigen profiel (grond, bomen, rotsen, weer),
// zonder scriptfouten; level 10 heeft een kerk met begraafplaats. Schermafdrukken in /tmp/s.
// Gebruik: node tests/landschap71.mjs [levels, bijvoorbeeld 1,4,9]
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { readFileSync, mkdirSync } from 'fs';
mkdirSync('/tmp/s', { recursive: true });
const poort = 8271;
const map = new URL('..', import.meta.url).pathname;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: map, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const profielen = JSON.parse(readFileSync(map + 'data/landschappen.json', 'utf8')).landschappen;
const campagne = JSON.parse(readFileSync(map + 'data/campagne.json', 'utf8')).levels;
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const levels = (process.argv[2] || '1,2,3,4,5,6,7,8,9,10').split(',').map(Number);
for (const level of levels) {
  const verwacht = campagne.find((c) => c.id === level).landschap;
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2, serviceWorkers: 'block' })).newPage();
  const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
  // Levels 7 tot 10 zijn nog niet speelbaar: voor deze proef zetten we ze open.
  await p.route('**/data/campagne.json', async (route) => { const d = JSON.parse(readFileSync(map + 'data/campagne.json', 'utf8'));
    d.levels.forEach((l) => { l.speelbaar = true; }); await route.fulfill({ contentType: 'application/json', body: JSON.stringify(d) }); });
  const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
  await p.goto(`http://localhost:${poort}/`); await wacht();
  await p.evaluate((level) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: level })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, level);
  await p.reload(); await wacht();
  await p.tap('#missie-begin', { timeout: 30000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => { const s = window.spel; const boom = s.assets.haal('object.boom');
    const tel = {}; for (const o of s.kaart.object) tel[o] = (tel[o] || 0) + 1;
    return { sleutel: s.landschap && s.landschap.sleutel, boomVarianten: boom.varianten.length, tel }; });
  check(`level ${level} profiel ${verwacht}`, info.sleutel === verwacht, info.sleutel);
  check(`level ${level} bomen volgens profiel`, info.boomVarianten === profielen[verwacht].bomen.length, info.boomVarianten);
  if (level === 10) {
    check('level 10 kerk', info.tel[32] === 1, info.tel[32]);
    check('level 10 graven', info.tel[41] >= 10, info.tel[41]);
  }
  // Schermafdruk bij jouw burcht, en bij level 10 ook bij de kerk.
  const kijk = async (naam, welke, dx, dy, zoom) => {
    await p.evaluate(([welke, dx, dy, zoom]) => { const s = window.spel; const t = s.CONFIG.tegel; const st = s.kaart.start[welke];
      const x = (st.x ?? st[0]) + dx, y = (st.y ?? st[1]) + dy; if (zoom && s.camera.zetZoom) s.camera.zetZoom(zoom);
      s.camera.kijkNaar((x - y) * t.breedte / 2, (x + y) * t.hoogte / 2); }, [welke, dx, dy, zoom]);
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `/tmp/s/landschap_${String(level).padStart(2, '0')}${naam}.png` });
  };
  await kijk('', 0, 6, -6, 0);
  if (level === 10) {
    const kerk = await p.evaluate(() => { const k = window.spel.kaart; const i = k.object.indexOf(32); return [i % k.breedte, Math.floor(i / k.breedte)]; });
    const st = await p.evaluate(() => { const st = window.spel.kaart.start[1]; return [st.x ?? st[0], st.y ?? st[1]]; });
    await kijk('_kerk', 1, kerk[0] - st[0], kerk[1] - st[1] + 2, 0);
  }
  check(`geen scriptfouten level ${level}`, fouten.length === 0, fouten.join('|'));
  await p.close();
}
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
