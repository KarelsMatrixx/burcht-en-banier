// 0.65.3: wie al op de muur staat, kan er ook bij een dichte poort overheen lopen.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8298;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
await p.goto(`http://localhost:${poort}/`); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 1 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.tap('#missie-begin', { timeout: 30000 }); await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, st = K.start[0];
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } };
  const uit = {};
  let x0 = -1, y0 = -1;
  for (let y = st.y + 6; y < st.y + 14 && x0 < 0; y++) for (let x = st.x - 8; x < st.x + 8 && x0 < 0; x++) {
    let vrij = true; for (let k = -1; k <= 5; k++) for (let d = -1; d <= 1; d++) if (!s.wegvinder.isVrij(x + k, y + d, 0)) vrij = false;
    if (vrij) { x0 = x; y0 = y; }
  }
  const v = y0 * B + x0;
  for (const [i, o] of [[v, 4], [v + 1, 4], [v + 2, 4], [v + 3, 6]]) { K.object[i] = o; K.eigenaar[i] = 1; }
  s.wegvinder.herbereken(); s.leger.kaartVeranderd();
  s.leger.zetStand([['ridder', x0 + 1, y0 + 2, 60, 0], ['ridder', x0 + 2, y0 + 3, 60, 0]]);
  const rid = s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'ridder');
  const man = rid[0]; const ander = rid[1];
  // Eerst via de open poort de muur op
  s.leger.kies([man]);
  uit.op = s.leger.stuur(x0 + 2, y0, true);
  sim(400);
  uit.opMuur = !!man.opMuur;
  // Poort dicht
  s.wegvinder.zetPoortDicht([v + 3], true); s.wegvinder.herbereken(); s.leger.kaartVeranderd();
  s.leger.kies([man]);
  uit.verplaats = s.leger.stuur(x0, y0, true);
  sim(300);
  uit.nu = [Math.floor(man.x) - x0, Math.floor(man.y) - y0, !!man.opMuur];
  // Een soldaat op de grond kan er bij een dichte poort nog steeds niet op
  if (ander) { s.leger.kies([ander]); uit.grond = s.leger.stuur(x0, y0, true); }
  return uit;
});
console.log(JSON.stringify(r));
check('via de open poort op de muur', r.op > 0 && r.opMuur === true, JSON.stringify(r));
check('bij een dichte poort loopt hij over de muur', r.verplaats > 0, r.verplaats);
check('hij staat op de nieuwe plek op de muur', r.nu && r.nu[0] === 0 && r.nu[1] === 0 && r.nu[2] === true, JSON.stringify(r.nu));
check('een soldaat op de grond kan er met een dichte poort niet op', r.grond === 0, r.grond);
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
