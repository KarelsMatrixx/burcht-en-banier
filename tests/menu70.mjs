// 0.70.1: na een winst in dit level is het volgende level meteen kiesbaar in het menu (zonder herladen).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8354;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERR', String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 1 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht();
await p.waitForTimeout(500);
const lees = async () => { await p.evaluate(() => document.getElementById('knop-instellingen').click()); await p.evaluate(() => document.getElementById('knop-levels').click()); await p.waitForTimeout(400);
  const r = await p.evaluate(() => { const d = document.getElementById('kaart-doek'); return { dicht: d.querySelectorAll('.dicht').length, open: d.querySelectorAll('.open').length, gewonnen: d.querySelectorAll('.gewonnen').length, html: d.innerHTML.length }; });
  return r; };
const voor = await lees();
await p.evaluate(() => localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1] })));   // zoals missieGewonnen(1) doet
const na = await lees();
console.log(JSON.stringify({ voor, na }));
check('na winst minder dichte levels, zonder herladen', na.dicht < voor.dicht, JSON.stringify({ voor, na }));
console.log(`menu70: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
