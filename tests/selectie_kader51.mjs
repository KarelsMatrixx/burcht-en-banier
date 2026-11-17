// Na een kader werken Melee, Ranged, Siege en de soorten alleen binnen die ingeboxte groep (0.66.2).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8151'], { cwd: '/home/claude/burcht-en-banier', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto('http://localhost:8151/?x=' + Date.now()); await wacht();
await p.evaluate(() => localStorage.clear()); await p.reload(); await wacht();
await p.evaluate(() => { window.kaderLijst = () => { const l = window.spel.leger.soldaten().filter((e) => e.soldaat.sleutel !== 'koning'); const r = l.filter((e) => e.soldaat.sleutel === 'ridder').slice(0, 2); const a = l.filter((e) => e.soldaat.sleutel === 'boogschutter').slice(0, 2); return [...r, ...a]; }; });
const gekozen = () => p.evaluate(() => window.spel.leger.gekozen().map((e) => e.soldaat.sleutel).sort().join(','));
const knoppen = () => p.$$eval('#leger-groepen button', (k) => k.map((x) => x.textContent));
const tik = async (tekst) => { for (const x of await p.$$('#leger-groepen button')) if ((await x.textContent()).startsWith(tekst)) { await x.tap(); return; } throw new Error('knop ' + tekst); };
await p.evaluate(() => window.spel.leger.zetStand([['ridder', 12, 50, 60, 0], ['ridder', 13, 50, 60, 0], ['boogschutter', 12, 52, 30, 0], ['boogschutter', 13, 52, 30, 0], ['ridder', 20, 56, 60, 0], ['boogschutter', 21, 56, 30, 0], ['boogschutter', 22, 56, 30, 0]]));
await p.waitForTimeout(400);
await p.tap('#knop-zwaard'); await p.waitForTimeout(200);
// Voor het kader: alles telt mee.
let k = await knoppen(); check('zonder kader: Melee 3', k.some((x) => x === 'Melee 3'), k.join('|'));
check('zonder kader: geen Group', !k.some((x) => x.startsWith('Group')), k.join('|'));
// Kader om vier soldaten (2 ridders, 2 boogschutters).
await p.evaluate(() => { const l = window.spel.leger; l.kiesKader(window.kaderLijst()); });
await p.waitForTimeout(800);
k = await knoppen(); console.log(k.join(' | '));
check('Group 4', k.includes('Group 4'), k.join('|'));
check('Melee 2 (alleen kader)', k.includes('Melee 2'), k.join('|'));
check('Ranged 2 (alleen kader)', k.includes('Ranged 2'), k.join('|'));
await tik('Ranged'); check('Ranged kiest alleen kader-boogschutters', (await gekozen()) === 'boogschutter,boogschutter', await gekozen());
k = await knoppen(); check('Group blijft 4 na Ranged', k.includes('Group 4') && k.includes('Ranged 2'), k.join('|'));
await tik('Melee'); check('Melee kiest alleen kader-ridders', (await gekozen()) === 'ridder,ridder', await gekozen());
await tik('Group'); check('Group kiest het hele kader', (await gekozen()) === 'boogschutter,boogschutter,ridder,ridder', await gekozen());
// Alle wist de groep.
await p.tap('#knop-alle'); await p.waitForTimeout(200);
k = await knoppen(); check('na Alle weer Melee 3, Ranged 4', k.includes('Melee 3') && k.includes('Ranged 4') && !k.some((x) => x.startsWith('Group')), k.join('|'));
await tik('Ranged'); check('Ranged na Alle = alle 4 boogschutters', (await gekozen()).split(',').length === 4, await gekozen());
// Sneuvelende kader-soldaat telt niet meer mee.
await p.evaluate(() => { const l = window.spel.leger; l.kiesKader(window.kaderLijst()); l.sneuvel(window.kaderLijst()[2]); });
await p.waitForTimeout(200);
k = await knoppen(); check('na sneuvelen Group 3', k.includes('Group 3') && k.includes('Ranged 1'), k.join('|'));
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
process.exit(fout || fouten.length ? 1 : 0);
