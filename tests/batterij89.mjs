// Greyford (0.89.0): tegenbatterij. Vier vaste trebuchets van rood achter muur 2 en 3, elk met twee ingenieurs; ze beschieten bouwwerken van de speler binnen bereik.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8196'], { cwd: '/home/claude/burcht-en-banier', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto('http://localhost:8196/?x=' + Date.now()); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3, 4, 5, 6] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 7 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht();
await p.evaluate(() => { document.getElementById('verhaalbeeld').hidden = true; document.getElementById('missie').hidden = true; document.getElementById('missie-begin') && document.getElementById('missie-begin').click(); });
const a = await p.evaluate(() => { const s = window.spel; const v = s.strijd.garnizoen(); const tr = v.filter((e) => !e.dood && e.krijg && e.krijg.def.staand); const ing = v.filter((e) => !e.dood && e.krijg && e.krijg.def.bouwt); const B = s.kaart.breedte; return { plekken: s.kaart.batterijPlekken, tr: tr.map((e) => [Math.floor(e.x), Math.floor(e.y)]), ing: ing.length, gekoppeld: ing.filter((e) => e.krijg.ing && e.krijg.ing.treb).length }; });
check('vier plekken', a.plekken.length === 4, JSON.stringify(a.plekken));
check('vier trebuchets van rood', a.tr.length === 4, JSON.stringify(a.tr));
check('acht ingenieurs, allemaal aan een trebuchet gekoppeld', a.ing === 8 && a.gekoppeld === 8, JSON.stringify(a));
check('twee trebuchets achter muur 2 (y 35), twee achter muur 3 (y 15)', a.tr.filter((t) => t[1] === 35).length === 2 && a.tr.filter((t) => t[1] === 15).length === 2, JSON.stringify(a.tr));
// een bouwwerk van de speler op 20 tegels van de trebuchet bij (20, 35)
const voor = await p.evaluate(() => { const s = window.spel; const B = s.kaart.breedte; const vak = 55 * B + 22; s.kaart.object[vak] = 4; s.kaart.eigenaar[vak] = 1; return vak; });
await p.evaluate(() => { const s = window.spel; for (let i = 0; i < 900; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } });
const na = await p.evaluate((vak) => { const s = window.spel; const v = s.strijd.garnizoen().filter((e) => !e.dood && e.krijg && e.krijg.def.staand); return { schoten: v.filter((e) => e.schotTijd).length, object: s.kaart.object[vak], eig: s.kaart.eigenaar[vak], bouwdoel: v.filter((e) => e.krijg.bouw).length }; }, voor);
console.log('na', JSON.stringify(na));
check('rode trebuchets schieten en slopen het bouwwerk', na.schoten > 0 && na.object !== 4, JSON.stringify(na));
check('geen fouten in de console', fouten.length === 0, fouten.slice(0, 3).join(' | '));
console.log(`batterij89: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
