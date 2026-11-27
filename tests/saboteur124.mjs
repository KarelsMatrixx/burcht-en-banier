// 0.124.3: de saboteur blaast zichzelf op: de helft van het leven van een muur aan schade (dubbel bij een poort), en hij sneuvelt.
// node tests/saboteur124.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const POORT = 8324;
const srv = spawn('python3', ['-m', 'http.server', String(POORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let goed = 0, fout = 0;
const check = (naam, ok, extra = '') => { console.log(`${ok ? 'GOED' : 'FOUT'} ${naam} ${extra}`); ok ? goed++ : fout++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' })).newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(e.message));
await p.goto(`http://localhost:${POORT}/`);
await p.waitForFunction(() => window.spel);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3, 4, 5, 6, 7] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 8 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload();
await p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
await p.waitForTimeout(1500);
await p.evaluate(() => { const t = document.getElementById('titelscherm'); if (t) t.style.display = 'none'; window.spel.ui.verbergVerhaal && window.spel.ui.verbergVerhaal(); });
const r = await p.evaluate(() => {
  const s = window.spel, B = s.kaart.breedte, st = s.strijd;
  const vrij = (x, y) => s.kaart.object[y * B + x] === 0 && s.kaart.eigenaar[y * B + x] === 0;
  // een lege plek op het land: zoek 6 vrije tegels naast elkaar
  let pl = null;
  for (let y = 20; y < 40 && !pl; y++) for (let x = 20; x < 40 && !pl; x++) if ([0, 1, 2, 3, 4, 5].every((d) => vrij(x + d, y))) pl = { x, y };
  if (!pl) return { fout: 'geen plek' };
  const uit = {};
  for (const [naam, soort] of [['muur', 4], ['poort', 6]]) {
    const wx = pl.x + 3, vak = pl.y * B + wx;
    s.kaart.object[vak] = soort; s.kaart.eigenaar[vak] = 1;
    st.kaartVeranderd && st.kaartVeranderd();
    const max = st.levenOp(vak).max;
    const sab = st.maakVijand('saboteur', pl.y * B + pl.x + 2);
    sab.x = pl.x + 2.5; sab.y = pl.y + 0.5;
    const voor = st.levenOp(vak).leven;
    for (let i = 0; i < 600 && !sab.dood; i++) { s.eenheden.stap(0.1); s.leger.stap(); st.stap(); }
    const na = st.levenOp(vak);
    uit[naam] = { max, voor, na: na ? na.leven : 0, dood: !!sab.dood, object: s.kaart.object[vak] };
    s.kaart.object[vak] = 0; s.kaart.eigenaar[vak] = 0;
  }
  return uit;
});
console.log(JSON.stringify(r));
check('muur: saboteur sneuvelt', r.muur && r.muur.dood, JSON.stringify(r.muur));
check('muur: schade is de helft van het leven', r.muur && Math.abs((r.muur.voor - r.muur.na) - r.muur.max / 2) <= 1, JSON.stringify(r.muur));
check('poort: dubbele schade (twee keer de helft van een muur)', r.poort && r.poort.dood && Math.abs((r.poort.voor - r.poort.na) - r.muur.max) <= 1, JSON.stringify(r.poort));
check('geen fouten in de console', fouten.length === 0, fouten.slice(0, 3).join(' | '));
console.log(`saboteur124: ${goed} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
