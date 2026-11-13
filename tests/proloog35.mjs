// De proloog: taken van Bartholt, Reinout als gast, avond, nacht met overmacht, scène, levelkaart.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8237;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 0 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(300);
check('proloog gekozen', (await p.evaluate(() => window.spel.modus.missie)) === 0);
check('briefing open', await p.isVisible('#missie'));
await p.tap('#missie-begin');
await p.waitForTimeout(800);
const st = () => p.evaluate(() => window.spel.proloog.stand());
let s = await st();
check('taak 1', s.fase === 'bouw' && s.taak === 0, JSON.stringify(s));
check('taak in beeld', /Task 1 of 8/.test(await p.textContent('#taak')));
check('Bartholt praat', /woodcutter/.test(await p.evaluate(() => window.spel.ui.logboek().map((r) => r.tekst).join(' '))));
check('Reinout staat bij de burcht', s.reinout && (await p.evaluate(() => window.spel.eenheden.lijst.some((e) => e.gast))));
check('geen rode koning', (await p.evaluate(() => window.spel.strijd.koning(1))) === null);
check('geen uitslag', (await p.evaluate(() => window.spel.strijd.uitslag())) === null);

// Vrije plekken rond de burcht
const vrij = await p.evaluate(() => {
  const s = window.spel; const k = s.kaart; const st = k.start[0]; const uit = [];
  for (let r = 5; r < 14 && uit.length < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = st.x + dx, y = st.y + dy; const i = y * k.breedte + x;
    if (k.object[i] === 0 && s.wegvinder.isVrij(x, y, 0) && !uit.some(([a, b2]) => Math.abs(a - x) < 3 && Math.abs(b2 - y) < 3)) uit.push([x, y]);
  }
  return uit;
});
check('genoeg plekken', vrij.length >= 6, vrij.length);
const zet = (lijst) => p.evaluate((l) => window.spel.bouwer.zetTerug(l), lijst);
const totTaak = (n) => p.waitForFunction((n) => { const s = window.spel.proloog.stand(); return s.fase !== 'bouw' || s.taak >= n; }, n, { timeout: 8000 }).catch(() => {});
let i = 0;
for (const [sleutel, n] of [['houthakker', 1], ['steengroeve', 2], ['boomgaard', 3], ['woning', 4], ['kazerne', 5]]) {
  await zet({ [sleutel]: vrij[i++] }); await totTaak(n);
  check(`${sleutel} gebouwd: taak ${n + 1}`, (await st()).taak === n, JSON.stringify(await st()));
}
// Twee soldaten
await p.evaluate(([x, y]) => window.spel.leger.zetStand([['ridder', x, y, 50, 0], ['boogschutter', x + 1, y, 40, 0]]), vrij[i]);
await totTaak(6);
check('twee soldaten: taak 7', (await st()).taak === 6);
// Sturen
await p.evaluate(([x, y]) => { const s = window.spel; const e = s.leger.soldaten().find((e) => e.soldaat.sleutel === 'ridder'); s.leger.kies([e]); s.leger.stuur(x, y); }, vrij[i + 1]);
await totTaak(7);
check('gestuurd: taak 8', (await st()).taak === 7, JSON.stringify(await st()));
// Muur en poort
const [mx, my] = vrij[i + 2];
await zet({ muur: [mx, my, mx + 1, my, mx + 2, my, mx + 3, my], poort: [mx + 4, my] });
await p.waitForFunction(() => window.spel.proloog.stand().fase === 'avond', null, { timeout: 8000 }).catch(() => {});
s = await st();
check('lijst af: avond', s.fase === 'avond', JSON.stringify(s));
check('Reinout is weg', !s.reinout && !(await p.evaluate(() => window.spel.eenheden.lijst.some((e) => e.gast))));
// Het wordt donker
await p.waitForTimeout(6000);
const n1 = await p.evaluate(() => window.spel.proloog.nacht());
check('schemering', n1 > 0.1 && n1 < 1, n1);
await p.waitForFunction(() => window.spel.proloog.stand().fase === 'nacht', null, { timeout: 25000 }).catch(() => {});
s = await st();
check('nacht', s.fase === 'nacht' && (await p.evaluate(() => window.spel.proloog.nacht())) === 1, JSON.stringify(s));
const vij = await p.evaluate(() => window.spel.strijd.vijanden().length);
check('overmacht (16 of meer)', vij >= 16, vij);
check('melding poort open', /gate is open/.test(await p.evaluate(() => window.spel.ui.logboek().map((r) => r.tekst).join(' '))));
check('taak nacht', /Night/.test(await p.textContent('#taak')));
await p.waitForTimeout(500);
await p.screenshot({ path: '/home/claude/proloog-nacht.png' });
// De koning sneuvelt niet
await p.evaluate(() => { const k = window.spel.strijd.koning(0); k.leven = 2; });
await p.waitForTimeout(4000);
check('koning leeft nog', (await p.evaluate(() => { const k = window.spel.strijd.koning(0); return !!k && k.leven >= 1; })));
check('nog steeds geen uitslag', (await p.evaluate(() => window.spel.strijd.uitslag())) === null);
// Burcht onder 40%: de scène
await p.evaluate(() => { const b = window.spel.strijd.burcht(); window.spel.strijd.zetBurcht(Math.floor(b.max * 0.35)); });
await p.waitForFunction(() => !document.getElementById('scene').hidden, null, { timeout: 5000 }).catch(() => {});
check('scène open', await p.isVisible('#scene'));
await p.screenshot({ path: '/home/claude/proloog-scene.png' });
let kaarten = 0;
while (await p.isVisible('#scene') && kaarten < 10) { kaarten++; await p.tap('#scene-verder'); await p.waitForTimeout(150); }
check('vijf kaarten', kaarten === 5, kaarten);
check('levelkaart open', await p.isVisible('#titel-kaart'));
check('proloog gewonnen', (await p.evaluate(() => JSON.parse(localStorage.getItem('burcht-banier.campagne')).klaar)).includes(0));
check('proloogstand gewist', (await p.evaluate(() => localStorage.getItem('burcht-banier.proloog'))) === null);
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
