// De rode koning zwerft over de kaart en gaat bij onraad terug naar zijn hoofdkasteel.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8281'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
await p.goto('http://localhost:8281/'); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 1 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd); await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(false);
  document.getElementById('missie') && (document.getElementById('missie').hidden = true);
  const t = s.strijd.rood(); const thuis = { x: t.x, y: t.y };
  const k = () => s.strijd.roodKoning();
  const af = () => Math.hypot(k().x - thuis.x, k().y - thuis.y);
  let max = 0;
  for (let i = 0; i < 1800; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); max = Math.max(max, af()); }
  const uit = { max, nu: af() };
  // Wacht tot hij ver weg is en zet er een soldaat van jou naast
  let n = 0;
  while (af() < 8 && n < 3000) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); n++; }
  uit.ver = af();
  const kk = k();
  s.leger.zetStand([['ridder', Math.floor(kk.x) + 6, Math.floor(kk.y), 60, 0]]);
  let m = 0; let na;
  for (; m < 600; m++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); if (af() < 5) break; }
  uit.terugNa = m / 10; uit.terug = af();
  return uit;
});
console.log(JSON.stringify(r));
check('koning zwerft ver van zijn kasteel (meer dan 8 tegels)', r.max > 8, r.max);
check('koning zwerft niet buiten zijn straal (hooguit 24)', r.max <= 24, r.max);
check('bij onraad terug naar het hoofdkasteel (binnen 60 s)', r.terug < 5, JSON.stringify(r));
// Level 5 (ringmuur): hij komt buiten zijn muren en loopt ook op muren
await p.evaluate(() => { localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3, 4] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 5 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd); await p.waitForTimeout(300);
const r5 = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(false);
  const t = s.strijd.rood(); const k = () => s.strijd.roodKoning();
  let max = 0, opMuur = 0, buiten = 0;
  let stappen = 0; for (let i = 0; i < 6000; i++) { if (s.strijd.uitslag()) break; stappen++; s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); const d = Math.hypot(k().x - t.x, k().y - t.y); max = Math.max(max, d); if (k().opMuur) opMuur++; if (Math.max(Math.abs(k().x - t.x), Math.abs(k().y - t.y)) > 8) buiten++; }
  return { max, opMuur, buiten, stappen };
});
console.log(JSON.stringify(r5));
check('level 5: koning komt buiten zijn muren (ver weg)', r5.max > 10 && r5.buiten > 300, JSON.stringify(r5));
check('level 5: koning loopt ook op muren of kasteel', r5.opMuur > 30, JSON.stringify(r5));
check('level 5: koning blijft niet op de muur hangen (<40% van de tijd)', r5.opMuur < r5.stappen * 0.4, JSON.stringify(r5));
check('geen pagina-fouten', fouten.length === 0, fouten.join('|'));
console.log(`koning40: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
