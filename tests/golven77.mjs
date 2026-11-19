// Level 4 (0.77.9): golven van 12, 20 en 25 man, en 60 soldaten in het kamp.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8281;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 859, height: 396 }, hasTouch: true })).newPage();
await autoVerder(p);
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 4 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(300);
await p.tap('#missie-begin'); await p.waitForTimeout(1500);
await p.evaluate(() => { try { window.spel.ui.verbergVerhaal(); } catch (e) { /* niet erg */ } });
const aanv = () => p.evaluate(() => window.spel.strijd.vijanden().filter((e) => !e.garnizoen && !e.koning && !e.dood).length);
const klaarMet = (t) => p.evaluate((t) => { const s = window.spel; s.doel.zetTijd(t); for (let i = 0; i < 3; i++) { s.eenheden.stap(0.1); s.strijd.stap(); s.doel.stap(0.1); } for (const e of s.strijd.vijanden()) if (!e.garnizoen && !e.koning) e.leven = 0; }, t);
const gar = await p.evaluate(() => window.spel.strijd.garnizoen().length);
check('60 soldaten in het kamp', gar === 60, gar);
await p.evaluate(() => { const st = window.spel.strijd; const orig = st.stuurLeger.bind(st); window.__golven = []; st.stuurLeger = (inh, telAls) => { window.__golven.push(Object.values(inh).reduce((x, y) => x + y, 0)); return orig(inh, telAls); }; });
for (const t of [240.5, 360.5, 480.5]) {
  await p.evaluate((t) => { const s = window.spel; s.doel.zetTijd(t); for (let i = 0; i < 8; i++) { s.eenheden.stap(0.1); s.strijd.stap(); s.doel.stap(0.1); } }, t);
}
const tel = await p.evaluate(() => window.__golven);
console.log('golven', JSON.stringify(tel));
check('drie golven', tel.length === 3, JSON.stringify(tel));
check('golf 1 is 12 man', tel[0] === 12, tel[0]);
check('golf 2 is 20 man', tel[1] === 20, tel[1]);
check('laatste golf is 25 man', tel[2] === 25, tel[2]);
console.log(`golven77: ${ok} ok, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
