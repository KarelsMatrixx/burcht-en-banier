// 0.64: muren en torens op alleen via een open poort; de rode koning vlucht naar het dak van zijn hoofdkasteel.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8246;
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
  // Een los stuk muur zonder poort, op open grond
  let x0 = -1, y0 = -1;
  for (let y = st.y + 6; y < st.y + 14 && x0 < 0; y++) for (let x = st.x - 8; x < st.x + 8 && x0 < 0; x++) {
    let vrij = true; for (let k = -1; k <= 5; k++) for (let d = -1; d <= 1; d++) if (!s.wegvinder.isVrij(x + k, y + d, 0)) vrij = false;
    if (vrij) { x0 = x; y0 = y; }
  }
  const v = y0 * B + x0;
  for (const [i, o] of [[v, 4], [v + 1, 5], [v + 2, 4]]) { K.object[i] = o; K.eigenaar[i] = 1; }
  s.wegvinder.herbereken(); s.leger.kaartVeranderd();
  const man = s.leger.soldaten().find((e) => !e.koning);
  s.leger.kies([man]);
  uit.zonderPoort = s.leger.stuur(x0, y0, true);
  // Nu een poort eraan
  K.object[v + 3] = 6; K.eigenaar[v + 3] = 1;
  s.wegvinder.herbereken(); s.leger.kaartVeranderd();
  uit.metPoort = s.leger.stuur(x0 + 1, y0, true);
  // Poort dicht: geen opgang meer
  s.wegvinder.zetPoortDicht([v + 3], true); s.wegvinder.herbereken(); s.leger.kaartVeranderd();
  uit.dichtOpgang = s.wegvinder.isOpgang(x0 + 3, y0, 0);
  uit.metDichtePoort = s.leger.stuur(x0, y0, true);
  s.wegvinder.zetPoortDicht([v + 3], false); s.wegvinder.herbereken(); s.leger.kaartVeranderd();
  uit.torenGeenOpgang = !s.wegvinder.isOpgang(x0 + 1, y0, 0);
  // De rode koning buiten zijn kasteel, met jouw ridders vlak bij
  const rk = s.strijd.koning(1);
  const rst = K.start[1];
  uit.koning = !!rk;
  if (rk) {
    let gezet = false;
    for (let r = 8; r < 20 && !gezet; r++) for (let a = 0; a < 16 && !gezet; a++) {
      const x = Math.round(rst.x + Math.cos(a / 16 * Math.PI * 2) * r), y = Math.round(rst.y + Math.sin(a / 16 * Math.PI * 2) * r);
      if (s.wegvinder.isVrij(x, y, 1) && s.wegvinder.verbonden(y * B + x, rst.y * B + rst.x + 2, 1)) { rk.x = x + 0.5; rk.y = y + 0.5; rk.pad = null; rk.opMuur = false; gezet = true; uit.koningBuiten = [x - rst.x, y - rst.y]; }
    }
    const ridders = s.leger.soldaten().filter((e) => !e.koning).slice(0, 2);
    for (const e of ridders) { e.x = rk.x + 2.5; e.y = rk.y + 0.5; e.pad = null; e.opMuur = false; }
    uit.deur = [s.wegvinder.isOpgang(rst.x + 1, rst.y, 1), s.wegvinder.isVrij(rst.x + 2, rst.y, 1), [[-2,-2],[-2,-1],[-2,0],[-2,1],[-2,2],[2,-2],[2,-1],[2,0],[2,1],[2,2],[-1,2],[0,2],[1,2],[-1,-2],[0,-2],[1,-2]].map(([dx,dy]) => K.object[(rst.y+dy)*B+rst.x+dx]).join(','), !!s.wegvinder.zoekPadLagen(Math.floor(rk.y) * B + Math.floor(rk.x), B*K.hoogte + rst.y * B + rst.x + 1, 1)];
    const spoor = []; for (let t = 0; t < 30; t++) { sim(10); spoor.push([+(rk.x - rst.x).toFixed(1), +(rk.y - rst.y).toFixed(1), rk.opMuur ? 1 : 0]); } uit.spoor = spoor;
    uit.koningNa = [rk.x - rst.x, rk.y - rst.y, rk.opMuur, K.object[Math.floor(rk.y) * B + Math.floor(rk.x)], rk.dood];
  }
  return uit;
});
console.log(JSON.stringify(r));
check('muur zonder poort: niemand gaat erop', r.zonderPoort === 0, r.zonderPoort);
check('met een poort: wel', r.metPoort >= 1, r.metPoort);
check('dichte poort is geen opgang', r.dichtOpgang === false);
check('met een dichte poort: niemand gaat erop', r.metDichtePoort === 0, r.metDichtePoort);
check('een toren is geen opgang meer', r.torenGeenOpgang);
check('rode koning vlucht naar het dak van zijn kasteel', r.koning && r.koningNa && (r.koningNa[2] && r.koningNa[3] === 7 || Math.hypot(r.koningNa[0], r.koningNa[1]) < 3), JSON.stringify(r.koningNa));
check('geen scriptfouten', fouten.length === 0, fouten.join('|'));
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
