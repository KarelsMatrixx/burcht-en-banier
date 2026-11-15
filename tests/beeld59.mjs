// 0.59.4: verhaalbeeld 20 s met zandloper, ook als je via de levelkaart een bewaard level kiest.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8259;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
const zet = (m, vlag) => p.evaluate(([m, vlag]) => { sessionStorage.setItem('burcht-banier.geenTitel', '1'); if (m !== null) localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); if (vlag) sessionStorage.setItem('burcht-banier.toonBeeld', '1'); localStorage.setItem('tipGesloten', '1'); }, [m, vlag]);
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await zet(1, false); await p.reload(); await wacht(); await p.waitForTimeout(600);
const z = () => p.evaluate(() => ({ beeld: !document.getElementById('verhaalbeeld').hidden, missie: !document.getElementById('missie').hidden, balk: getComputedStyle(document.querySelector('#verhaalbeeld-balk i')).animationDuration, zand: !!document.getElementById('verhaalbeeld-zand') && getComputedStyle(document.getElementById('verhaalbeeld-zand')).animationName, tekst: document.getElementById('verhaalbeeld-tekst').textContent.length }));
let s = await z();
check('nieuw level: beeld eerst, geen briefing', s.beeld && !s.missie, JSON.stringify(s));
check('duur 20 s', s.balk === '20s', s.balk);
check('zandloper draait', s.zand === 'zandloper', s.zand);
check('tekst aanwezig', s.tekst > 40);
await p.screenshot({ path: '/home/claude/beeld59.png' });
await p.waitForTimeout(18000);
s = await z(); check('na 18 s nog beeld', s.beeld, JSON.stringify(s));
await p.waitForFunction(() => document.getElementById('verhaalbeeld').hidden, null, { timeout: 8000 });
s = await z(); check('daarna de briefing', !s.beeld && s.missie, JSON.stringify(s));
await p.tap('#missie-begin'); await p.waitForTimeout(3000);
await p.evaluate(() => window.spel.bewaar && window.spel.bewaar());
// Bewaard spel, gewoon herladen (Continue): geen beeld
await zet(null, false); await p.reload(); await wacht(); await p.waitForTimeout(600);
s = await z(); check('bewaard spel zonder kaart: direct het spel', !s.beeld && !s.missie, JSON.stringify(s));
// Bewaard spel, gekozen via de kaart: wel het beeld
await zet(null, true); await p.reload(); await wacht(); await p.waitForTimeout(600);
s = await z(); check('bewaard spel via kaart: beeld', s.beeld, JSON.stringify(s));
await p.waitForFunction(() => document.getElementById('verhaalbeeld').hidden, null, { timeout: 25000 });
s = await z(); check('daarna gewoon verder (geen briefing)', !s.beeld && !s.missie, JSON.stringify(s));
check('geen paginafouten', fouten.length === 0, fouten.join(' | '));
console.log(`ok ${ok}, fout ${fout}`);
await b.close(); srv.kill();
