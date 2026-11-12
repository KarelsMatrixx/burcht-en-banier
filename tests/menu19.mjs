import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8127'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
const zicht = (id) => p.evaluate((id) => !document.getElementById(id).hidden, id);
await p.goto('http://localhost:8127/?x=' + Date.now()); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); await wacht();
check('beginscherm bij openen', await zicht('titelscherm') && await zicht('titel-voorpagina'));
check('verder verborgen bij eerste keer', !(await zicht('titel-verder')));
const t0 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand().heer.voorraad));
await p.waitForTimeout(2500);
const t1 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand().heer.voorraad));
check('spel staat stil achter beginscherm', t0 === t1, `${t0} ${t1}`);
await p.screenshot({ path: '/home/claude/stap19-titel.png' });
await p.tap('#titel-campagne');
check('levelkaart open', await zicht('titel-kaart'));
const pt = await p.$$eval('#kaart-doek .punt', (g) => g.map((x) => x.getAttribute('class')));
console.log(pt.join(' | '));
check('3 punten: 1 open, 2 en 3 dicht', pt.length === 3 && /open/.test(pt[0]) && /dicht/.test(pt[1]) && /dicht/.test(pt[2]), pt.join('|'));
await p.screenshot({ path: '/home/claude/stap19-kaart.png' });
// dicht level aantikken: melding, geen start
const bx = async (i) => { const r = await (await p.$$('#kaart-doek .punt .tikvlak'))[i].boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
let [x, y] = await bx(1); await p.touchscreen.tap(x, y);
check('dicht level geeft uitleg', /Win eerst/.test(await p.textContent('#kaart-tekst')), await p.textContent('#kaart-tekst'));
// level 1 starten
[x, y] = await bx(0);
await Promise.all([p.waitForNavigation(), p.touchscreen.tap(x, y)]); await wacht();
check('na level kiezen geen beginscherm', !(await zicht('titelscherm')));
const m = await p.evaluate(() => window.spel.modus);
check('missie 1 actief', m.soort === 'campagne' && m.missie === 1, JSON.stringify(m));
check('missie-intro zichtbaar', await zicht('missie'));
await p.tap('#missie-begin');
// Menu-knop opent de kaart; huidige level = nu
await p.tap('#knop-menu');
check('menu opent levelkaart', await zicht('titel-kaart'));
const pt2 = await p.$$eval('#kaart-doek .punt', (g) => g.map((x) => x.getAttribute('class')));
check('level 1 is nu', /nu/.test(pt2[0]), pt2.join('|'));
const k0 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand().heer.voorraad)); await p.waitForTimeout(2000);
check('spel stil bij open kaart', k0 === (await p.evaluate(() => JSON.stringify(window.spel.strijd.stand().heer.voorraad))));
[x, y] = await bx(0); await p.touchscreen.tap(x, y);   // nu-level: gewoon verder
check('tik op huidig level sluit kaart', !(await zicht('titelscherm')));
await p.waitForTimeout(1500);
check('spel loopt weer', (await p.evaluate(() => JSON.stringify(window.spel.strijd.stand().heer.voorraad))) > k0);
// vrij spel via voorpagina na verversen
await p.reload(); await wacht();
check('na verversen weer beginscherm met verder', await zicht('titelscherm') && await zicht('titel-verder'));
await p.tap('#titel-vrij');
check('vrij spel opent menu', await zicht('menu') && !(await zicht('titelscherm')));
// gewonnen level 1 -> level 2 open en getoond als gewonnen
await p.evaluate(() => { localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1] })); }); await p.reload(); await wacht();
await p.tap('#titel-campagne');
const pt3 = await p.$$eval('#kaart-doek .punt', (g) => g.map((x) => x.getAttribute('class')));
check('level 1 gewonnen, 2 open, 3 dicht', /gewonnen/.test(pt3[0]) && /(open|nu)/.test(pt3[1]) && /dicht/.test(pt3[2]), pt3.join('|'));
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
