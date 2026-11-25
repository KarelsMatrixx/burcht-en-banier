// 0.110.0: Vikingdorp met kroegen en hopvelden, en de berserker met zijn sprong.
// node tests/berserker110.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const POORT = 8318;
const srv = spawn('python3', ['-m', 'http.server', String(POORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let goed = 0, fout = 0;
const check = (naam, ok, extra = '') => { console.log(`${ok ? 'GOED' : 'FOUT'} ${naam} ${extra}`); ok ? goed++ : fout++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' })).newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(e.message));
const zichtbaar = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !!(e.offsetWidth || e.offsetHeight) && !e.closest('[hidden]'); }, sel);
async function startLevel(n, klaar) {
  await p.goto(`http://localhost:${POORT}/`);
  await p.waitForFunction(() => window.spel);
  await p.evaluate(([m, k]) => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [n, klaar]);
  await p.reload();
  await p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
  await p.waitForFunction(() => { const v = document.getElementById('verhaalbeeld-verder'); return document.getElementById('verhaalbeeld').hidden || (v && !v.hidden); }, null, { timeout: 20000 });
  if (await zichtbaar('#verhaalbeeld-verder')) await p.click('#verhaalbeeld-verder');
  await p.waitForTimeout(500);
  if (await zichtbaar('#missie-begin')) await p.click('#missie-begin');
  await p.waitForTimeout(800);
}

// Level 8: het dorp van Rutger
await startLevel(8, [0, 1, 2, 3, 4, 5, 6, 7]);
const dorp = await p.evaluate(() => {
  const { kaart } = window.spel;
  const n = (s) => { let c = 0; for (let i = 0; i < kaart.object.length; i++) if (kaart.object[i] === s && !kaart.eigenaar[i]) c++; return c; };
  return { kroeg: n(54), hop: n(53), huis: n(55) };
});
check('dorp heeft kroegen', dorp.kroeg >= 6, JSON.stringify(dorp));
check('dorp heeft hopvelden', dorp.hop >= 8, JSON.stringify(dorp));
const regel = await p.evaluate(() => window.spel.regels.soldaten.berserker);
check('berserker in de regels', !!regel && !!regel.sprong, JSON.stringify(regel && regel.sprong));

// Level 9: berserker van de speler springt op een rode ridder
await startLevel(9, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
await p.evaluate(() => { window.spel.ui.verbergVerhaal(); });
const uit = await p.evaluate(async () => {
  const { strijd, leger, kaart, wegvinder } = window.spel;
  const s = kaart.start[0];
  let vak = -1;
  for (let d = 4; d < 14 && vak < 0; d++) for (let dx = -d; dx <= d && vak < 0; dx++) {
    const x = Math.floor(s.x) + dx, y = Math.floor(s.y) + d;
    if (wegvinder.isVrij(x, y, 0) && wegvinder.isVrij(x + 6, y, 0) && wegvinder.isVrij(x + 5, y, 0) && wegvinder.verbonden(y * 52 + x, y * 52 + x + 5, 0)) vak = y * 52 + x;
  }
  if (vak < 0) return { fout: 'geen plek' };
  const B = 52;
  const eb = leger.zetOp('berserker', vak);
  const rood = strijd.maakHeld('ridder', vak + 5);
  const start = rood.leven;
  let gesprongen = false, hoogMax = 0, tot = 0;
  for (let i = 0; i < 400 && !gesprongen; i++) {
    for (let j = 0; j < 3; j++) { window.spel.eenheden.stap(0.05); strijd.stap(); }
    hoogMax = Math.max(hoogMax, eb.sprongH || 0);
    if (rood.leven < start || (eb.sprongH || 0) > 0) tot = i;
    if (hoogMax > 5 && !(eb.sprongH > 0)) gesprongen = true;
  }
  return { gesprongen, hoogMax, verlies: start - rood.leven, afstand: Math.hypot(eb.x - rood.x, eb.y - rood.y), leven: eb.leven, max: eb.levenMax };
});
console.log(JSON.stringify(uit));
check('berserker springt (hoogte)', uit.hoogMax > 5, String(uit.hoogMax));
check('sprong doet schade', uit.verlies >= 25, String(uit.verlies));
check('berserker landt vlak bij zijn doel', uit.afstand < 2.2, String(uit.afstand));
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`${goed} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
