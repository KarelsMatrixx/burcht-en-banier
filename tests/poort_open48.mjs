// 0.65.1: een open poort van jou is een doorgang voor rood, een dichte poort niet.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8294'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto('http://localhost:8294/'); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(true);
  const K = s.kaart; const B = K.breedte; const W = s.wegvinder; const st = K.start[0];
  const rij = Math.min(K.hoogte - 6, st.y + 14);
  // Zoek een kolom waar beide kanten vrij zijn voor soldaten
  let kol = -1;
  for (let x = 4; x < B - 4 && kol < 0; x++) if ([-3, 3].every((d) => W.isVrij(x, rij + d, 1))) kol = x;
  if (kol < 0) return { fout: 'geen kolom' };
  // Een muur dwars over de hele kaart met een poort op die kolom, van jou
  for (let x = 0; x < B; x++) { const i = rij * B + x; K.object[i] = x === kol ? 6 : 4; K.eigenaar[i] = 1; }
  W.herbereken(); s.leger.kaartVeranderd();
  const pad = (team) => W.zoekPad(kol, rij - 3, kol, rij + 3, team);
  const uit = { kol, rij };
  uit.openRood = !!pad(1);
  uit.openJij = !!pad(0);
  W.zetPoortDicht([rij * B + kol], true); W.herbereken();
  uit.dichtRood = !!pad(1);
  uit.dichtJij = !!pad(0);
  W.zetPoortDicht([rij * B + kol], false); W.herbereken();
  uit.weerOpenRood = !!pad(1);
  // De poort van rood zelf is voor jou geen doorgang
  K.eigenaar[rij * B + kol] = 2; W.herbereken();
  uit.roodPoortVoorJou = !!pad(0);
  uit.roodPoortVoorRood = !!pad(1);
  return uit;
});
console.log(JSON.stringify(r));
check('open poort van jou: rood kan erdoor', r.openRood === true);
check('open poort van jou: jij kunt erdoor', r.openJij === true);
check('dichte poort: rood kan er niet door', r.dichtRood === false);
check('dichte poort: jij ook niet', r.dichtJij === false);
check('poort weer open: rood kan er weer door', r.weerOpenRood === true);
check('poort van rood is voor jou geen doorgang', r.roodPoortVoorJou === false);
check('poort van rood is voor rood een doorgang', r.roodPoortVoorRood === true);
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
