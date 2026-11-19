// 0.63: valhek gaat zichtbaar omhoog en omlaag; op het hoofdkasteel alleen via de deur (x + 1).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8245;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
await p.goto(`http://localhost:${poort}/`); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 0 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.tap('#missie-begin', { timeout: 30000 }); await p.waitForTimeout(800); await p.tap('#gids-kaart button'); await p.waitForTimeout(300);
// Hoofdkasteel: alleen de deurtegel is een opgang
const op = await p.evaluate(() => { const s = window.spel, k = s.kaart, st = k.start[0], B = k.breedte; const r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (s.wegvinder.isOpgang && s.wegvinder.isOpgang(st.x + dx, st.y + dy, 0)) r.push([dx, dy]); return r; });
check('kasteel: alleen de deur (1,0) is een opgang', JSON.stringify(op) === '[[1,0]]', JSON.stringify(op));
// Poort (5,0): dicht doen met een tik, dan staat het hek na ruim een seconde lager
const kijk = async () => { await p.evaluate(() => { const s = window.spel, st = s.kaart.start[0], t = s.CONFIG.tegel; s.camera.zetZoom(2.4); s.camera.kijkNaar((st.x + 5 - st.y) * t.breedte / 2, (st.x + st.y + 5 + 1) * t.hoogte / 2 - 20); }); await p.waitForTimeout(300); };
await kijk();
await p.screenshot({ path: '/tmp/s/poort_open.png' });
await p.evaluate(() => { const s = window.spel, st = s.kaart.start[0], B = s.kaart.breedte; s.wegvinder.zetPoortDicht([st.y * B + st.x + 5], true); });
await p.waitForTimeout(700);
await p.screenshot({ path: '/tmp/s/poort_half.png' });
await p.waitForTimeout(2500);
await p.screenshot({ path: '/tmp/s/poort_dicht.png' });
check('geen scriptfouten', fouten.length === 0, fouten.join('|'));
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
