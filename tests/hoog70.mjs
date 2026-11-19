// 0.70.4: een belegeringstoren is hoger dan een poort en kan er niet door (speler en rood).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8355;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 3 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(300);
await p.tap('#missie-begin');
const POORT = Number(process.env.POORT || 0) || (await import('../js/kaart.js')).OBJECT.POORT;
const r = await p.evaluate((POORT) => {
  const s = window.spel, K = s.kaart, W = s.wegvinder, B = K.breedte;
  const def = !!s.regels.soldaten.toren.hoog;
  // Een eigen poort van de speler, met een vrije tegel erbuiten en erbinnen (langs de x-as, zoals het ontwerp).
  let res = { def, gevonden: false, poorten: [...K.object].filter((o, j) => o === POORT).length, eig1: [...K.object].filter((o, j) => o === POORT && K.eigenaar[j] === 1).length };
  for (let i = 0; i < K.object.length; i++) {
    if (K.object[i] !== POORT || K.eigenaar[i] !== 2) continue;
    const x = i % B, y = (i - x) / B;
    const buiten = y * B + (x + 2), binnen = y * B + (x - 2);
    const gewoon = W.zoekPad(x + 2, y, x - 2, y, 1);
    const hoog = W.zoekPad(x + 2, y, x - 2, y, 4);
    res = { def, gevonden: true, gewoon: !!gewoon, hoog: !!hoog, hoogVerbonden: W.verbonden(buiten, binnen, 4), gewoonVerbonden: W.verbonden(buiten, binnen, 1) };
    break;
  }
  return res;
}, POORT);
console.log(JSON.stringify(r));
check('toren heeft hoog: true', r.def);
check('poort van rood gevonden', r.gevonden);
check('gewone soldaat komt door de poort', r.gewoon === true && r.gewoonVerbonden === true, JSON.stringify(r));
check('hoge toren komt er niet door', r.hoog === false && r.hoogVerbonden === false, JSON.stringify(r));
// Rode toren: hij mag nooit op een poortvak staan.
const t = await p.evaluate((POORT) => {
  const s = window.spel, K = s.kaart;
  const n = s.strijd.stuurLeger({ toren: 1 }, false);
  let opPoort = 0, bewogen = 0; let begin = null;
  const torens = () => s.strijd.vijanden().filter((e) => e.krijg && e.krijg.def.hoog);
  for (let i = 0; i < 3000; i++) {
    s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap();
    for (const e of torens()) {
      if (!begin) begin = { x: e.x, y: e.y };
      if (K.object[Math.floor(e.y) * K.breedte + Math.floor(e.x)] === POORT) opPoort++;
      if (Math.hypot(e.x - begin.x, e.y - begin.y) > 3) bewogen++;
    }
  }
  const e0 = torens()[0];
  return { n, aantal: torens().length, opPoort, bewogen, begin, eind: e0 ? { x: e0.x, y: e0.y, bouw: e0.krijg.bouw ? e0.krijg.bouw.soort : null, pad: !!e0.pad } : null, start: K.start };
}, POORT);
console.log(JSON.stringify(t));
check('rode toren staat buiten de muren (beweegt)', t.bewogen > 0, JSON.stringify(t));
check('rode toren gestuurd', t.n >= 1 && t.aantal >= 1, JSON.stringify(t));
check('rode toren staat nooit in een poort', t.opPoort === 0, t.opPoort);
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`hoog70: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
