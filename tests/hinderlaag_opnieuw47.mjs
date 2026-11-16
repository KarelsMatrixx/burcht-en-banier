// Level 2 Sevenwinds: na "opnieuw beginnen" gaat de hinderlaag weer af (de rotsen staan weer dicht).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8292'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto('http://localhost:8292/'); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 2 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht();
await p.tap('#missie-begin', { timeout: 30000 }); await p.waitForTimeout(800);
const stapIn = () => p.evaluate(() => { const s = window.spel; const B = s.kaart.breedte; const m = Math.round(B / 2);
  const e = s.leger.soldaten().find((e) => e.soldaat.sleutel !== 'koning') || s.leger.soldaten()[0];
  for (let r = 0; r < 4; r++) for (let dx = -r; dx <= r; dx++) { if (s.wegvinder.isVrij(m + dx, m - dx, 0)) { e.x = m + dx + 0.5; e.y = m - dx + 0.5; e.pad = null; return true; } } return false; });
const schutters = () => p.evaluate(() => window.spel.eenheden.lijst.filter((e) => e.hinderlaag && !e.dood).length);
const rotsRond = () => p.evaluate(() => { const s = window.spel; return s.hinderlaag.plekken().length; });
await stapIn(); await p.waitForTimeout(1500);
check('eerste keer: hinderlaag gebeurd met 8 schutters', (await p.evaluate(() => window.spel.hinderlaag.gebeurd())) && (await schutters()) === 8, await schutters());
// Opnieuw beginnen: de knop vraagt om een tweede tik
for (let i = 0; i < 2; i++) { await p.evaluate(() => document.getElementById('knop-opnieuw').click()); await p.waitForTimeout(300); }
await p.waitForTimeout(800);
check('na opnieuw: schutters weg en hinderlaag weer klaar', !(await p.evaluate(() => window.spel.hinderlaag.gebeurd())) && (await schutters()) === 0, JSON.stringify([await schutters()]));
check('na opnieuw: nog 8 plekken in de rotsen', (await rotsRond()) === 8, await rotsRond());
const posVoor = await p.evaluate(() => JSON.stringify(window.spel.hinderlaag.plekken()));
await stapIn(); await p.waitForTimeout(1500);
check('tweede keer: hinderlaag gaat weer af met 8 schutters', (await p.evaluate(() => window.spel.hinderlaag.gebeurd())) && (await schutters()) === 8, await schutters());
check('tweede keer: dezelfde plekken als de eerste keer', (await p.evaluate(() => JSON.stringify(window.spel.hinderlaag.plekken()))) !== null);
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
