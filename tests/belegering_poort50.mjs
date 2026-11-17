// 0.66: belegeringstroepen niet op muren; jouw koning vlucht naar het kasteel; poorten dicht bij vijanden.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8301'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto('http://localhost:8301/'); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, hs = K.start[0], W = s.wegvinder;
  s.strijd.pauzeer(true);
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); } };
  const uit = {};
  s.regels.strijd.burchtSchiet = false;
  // --- Een muur met een open poort, op open grond
  let x0 = -1, y0 = -1;
  for (let y = hs.y + 6; y < hs.y + 14 && x0 < 0; y++) for (let x = hs.x - 8; x < hs.x + 8 && x0 < 0; x++) {
    let vrij = true; for (let k = -1; k <= 5; k++) for (let d = -1; d <= 1; d++) if (!W.isVrij(x + k, y + d, 0)) vrij = false;
    if (vrij) { x0 = x; y0 = y; }
  }
  const v = y0 * B + x0;
  for (const [i, o] of [[v, 4], [v + 1, 4], [v + 2, 4], [v + 3, 6]]) { K.object[i] = o; K.eigenaar[i] = 1; }
  W.herbereken(); s.leger.kaartVeranderd();
  // 1. Belegeringstroepen: nooit de muur op
  s.leger.zetStand([['ridder', x0 + 1, y0 + 2, 60, 0], ['ram', x0 + 2, y0 + 2, 60, 0], ['katapult', x0 + 3, y0 + 2, 60, 0], ['ladder', x0 + 1, y0 + 3, 60, 0], ['toren', x0 + 2, y0 + 3, 60, 0]]);
  const per = (sl) => s.leger.soldaten().find((e) => e.soldaat.sleutel === sl);
  uit.siege = {};
  for (const sl of ['ram', 'katapult', 'ladder', 'toren']) { s.leger.kies([per(sl)]); uit.siege[sl] = s.leger.stuur(x0 + 1, y0, true); }
  s.leger.kies([per('ridder')]); uit.ridderOp = s.leger.stuur(x0 + 1, y0, true);
  sim(300);
  uit.siegeOpMuur = ['ram', 'katapult', 'ladder', 'toren'].filter((sl) => per(sl).opMuur).length;
  uit.ridderOpMuur = !!per('ridder').opMuur;
  // 2. Poortwacht: rode ridders dicht bij de poort: dicht; weg: weer open; zelf dicht: blijft dicht
  const gate = v + 3;
  const rode = [];
  for (let i = 0; i < 3; i++) if (s.strijd.zetVijand('ridder', x0 + 3 + i, y0 + 5, 60)) rode.push(i);
  uit.rode = rode.length;
  uit.poortOpenVoor = !W.isPoortDicht(gate);
  sim(30);
  uit.poortDichtBijVijand = W.isPoortDicht(gate);
  const vij = s.strijd.vijanden();
  for (const e of vij) { e.x = 3.5; e.y = 3.5; e.pad = null; }
  sim(120);
  uit.vijandenWeg = s.strijd.vijanden().filter((e) => Math.hypot(e.x - x0, e.y - y0) < 9).length;
  uit.poortWeerOpen = !W.isPoortDicht(gate);
  W.zetPoortDicht([gate], true); s.poortwacht.handmatig([gate], true);
  sim(120);
  uit.zelfDichtBlijft = W.isPoortDicht(gate);
  return uit;
});
console.log(JSON.stringify(r));
check('ram, katapult, ladder en toren kunnen de muur niet op (geen bevel)', r.siege.ram === 0 && r.siege.katapult === 0 && r.siege.ladder === 0 && r.siege.toren === 0, JSON.stringify(r.siege));
check('geen siege op de muur', r.siegeOpMuur === 0, r.siegeOpMuur);
check('een ridder kan er wel op', r.ridderOp > 0 && r.ridderOpMuur === true, JSON.stringify([r.ridderOp, r.ridderOpMuur]));
check('rode soldaten zijn bij de poort gezet', r.rode === 3, r.rode);
check('poort staat open zonder vijand', r.poortOpenVoor === true);
check('poort gaat dicht bij vijandelijke soldaten', r.poortDichtBijVijand === true);
check('poort gaat weer open als ze weg zijn', r.vijandenWeg === 0 && r.poortWeerOpen === true, JSON.stringify([r.vijandenWeg, r.poortWeerOpen]));
check('een poort die je zelf dichtdeed blijft dicht', r.zelfDichtBlijft === true);
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
