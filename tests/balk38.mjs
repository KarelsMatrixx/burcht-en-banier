// Stap 38: balk met kern, uitklappaneel en klok van rood.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8243;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1');
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 4 })); });
await p.reload(); await wacht(); await p.waitForTimeout(500);
await p.tap('#missie-begin').catch(() => {}); await p.waitForTimeout(500);
const bal = () => p.evaluate(() => [...document.querySelectorAll('#voorraad-lijst .grondstof')].map((g) => g.dataset.sleutel));
const kern = await bal();
check('balk: alleen de kern', kern.join() === 'hout,steen,voedsel,goud,boeren', kern.join());
const klok = await p.evaluate(() => document.getElementById('strijdinfo').hidden);
check('level 4: geen zinloze klok van rood', klok === true, klok);
// Paneel
await p.tap('#voorraad'); await p.waitForTimeout(300);
const pan = await p.evaluate(() => ({ open: !document.getElementById('volkpaneel').hidden, n: document.querySelectorAll('#volk-grondstoffen .volk-grond').length, namen: [...document.querySelectorAll('#volk-grondstoffen .volk-grond span')].map((s) => s.textContent).join() }));
check('paneel met alle grondstoffen', pan.open && pan.n >= 5 && /Wood/.test(pan.namen), JSON.stringify(pan));
await p.screenshot({ path: '/home/claude/balk38-paneel.png' });
await p.tap('#volk-sluit'); await p.waitForTimeout(200);
// Flits en rood
await p.evaluate(() => { window.spel.economie.voorraad.hout += 10; window.spel.economie.voorraad.goud -= 1; });
await p.evaluate(() => window.spel.economie.herzieOpslag && window.spel.economie.herzieOpslag());
await p.waitForTimeout(6000);
await p.screenshot({ path: '/home/claude/balk38.png' });
// Voedsel op: rood
await p.evaluate(() => { const v = window.spel.economie.voorraad; v.voedsel = 0; v.brood = 0; });
await p.waitForTimeout(5500);
const rood = await p.evaluate(() => document.querySelector('#voorraad-lijst .grondstof[data-sleutel="voedsel"]').classList.contains('slecht'));
check('voedsel op: rood in de balk', rood === true);
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
