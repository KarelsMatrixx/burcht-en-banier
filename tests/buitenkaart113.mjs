// 0.114.0: ruiters van rood lopen niet meer de kaart af als je koning op het dak van je burcht staat.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8196'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
let ok = 0, fout = 0; const check = (n, w, d = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, d); } };
await p.goto('http://localhost:8196/'); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0,1,2,3,4,5,6] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 7 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd); await p.waitForTimeout(1200);
const r = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, H = K.hoogte;
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht && s.poortwacht.stap(); s.doel && s.doel.stap(0.1); } };
  const zij = s.veld.zijIngang(12);
  s.strijd.stuurLeger({ ruiter: 4, ridder: 2 }, true, zij ? { rond: zij, straal: 3, plan: true } : undefined);
  let buiten = 0, maxY = 0;
  for (let k = 0; k < 40; k++) { sim(25); for (const e of s.strijd.vijanden()) { if (e.dood) continue; if (e.x < 0 || e.y < 0 || e.x >= B || e.y >= H) buiten++; maxY = Math.max(maxY, e.y); } }
  return { buiten, maxY, n: s.strijd.vijanden().length };
});
console.log(JSON.stringify(r));
check('niemand van rood buiten de kaart', r.buiten === 0, JSON.stringify(r));
check('de overvallers zijn er nog', r.n > 0, JSON.stringify(r));
console.log(`buitenkaart113: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill(); process.exit(0);
