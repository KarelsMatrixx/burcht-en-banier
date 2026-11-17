// 0.66: jouw koning gaat bij een aanval altijd naar het dak van je hoofdkasteel.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8302'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto('http://localhost:8302/'); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, hs = K.start[0], W = s.wegvinder;
  s.strijd.pauzeer(true);
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); } };
  const uit = {};
  s.regels.strijd.burchtSchiet = false;
  const koning = s.leger.soldaten().find((e) => e.soldaat.sleutel === 'koning');
  uit.heeftKoning = !!koning;
  koning.leven = koning.levenMax = 900;
  // De koning staat op de grond, vlak bij zijn kasteel
  koning.x = hs.x + 3.5; koning.y = hs.y + 3.5; koning.opMuur = false; koning.pad = null;
  for (const e of s.leger.soldaten()) if (e !== koning) s.leger.sneuvel(e);
  uit.opDakVoor = !!koning.opMuur;
  sim(40);
  uit.rustig = !koning.opMuur;           // zonder vijand blijft hij waar hij is
  let n = 0;
  for (let r = 6; r < 10 && n < 4; r++) for (let dy = -r; dy <= r && n < 4; dy++) for (let dx = -r; dx <= r && n < 4; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = hs.x + dx, y = hs.y + dy;
    if (x > 1 && y > 1 && x < B - 2 && y < K.hoogte - 2 && s.strijd.zetVijand('ridder', x, y, 60)) n++;
  }
  uit.rode = n;
  let opDak = false; let stappen = 0;
  while (stappen < 400 && !opDak && !s.strijd.uitslag()) { sim(10); stappen += 10; if (koning.opMuur && K.object[Math.floor(koning.y) * B + Math.floor(koning.x)] === 7) opDak = true; }
  uit.opDak = opDak; uit.stappen = stappen; uit.uitslag = s.strijd.uitslag();
  return uit;
});
console.log(JSON.stringify(r));
check('er is een koning', r.heeftKoning === true);
check('zonder vijand blijft de koning waar hij is', r.rustig === true && r.opDakVoor === false, JSON.stringify(r));
check('er zijn rode soldaten gezet', r.rode >= 3, r.rode);
check('bij een aanval gaat de koning naar het dak van zijn kasteel', r.opDak === true, JSON.stringify(r));
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
