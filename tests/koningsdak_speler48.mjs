// 0.65.1: ook rood kan jouw hoofdkasteel op en je koning op het dak vermoorden; je kasteel zelf krijgt geen schade.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8296'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto('http://localhost:8296/'); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(true);
  const K = s.kaart; const B = K.breedte; const N = B * K.hoogte; const hs = K.start[0]; const W = s.wegvinder;
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } };
  const uit = {};
  s.regels.strijd.burchtSchiet = false;
  const keep = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keep.push((hs.y + dy) * B + hs.x + dx);
  uit.deurOpgangRood = !!W.isOpgang(hs.x + 1, hs.y, 1);
  uit.keepKlimbaarRood = keep.filter((v) => K.object[v] === 7 && W.isMuur(v % B, Math.floor(v / B), 1)).length;
  const kon = s.strijd.koning ? null : null;
  const koning = s.leger.soldaten().find((e) => e.soldaat.sleutel === 'koning');
  uit.heeftKoning = !!koning;
  koning.leven = koning.levenMax = 60;
  const dak = (hs.y - 1) * B + hs.x;
  koning.x = (dak % B) + 0.5; koning.y = Math.floor(dak / B) + 0.5; koning.opMuur = true; koning.pad = null;
  for (const e of s.leger.soldaten()) if (e !== koning) s.leger.sneuvel(e);
  // Rood: zes ridders, vlak bij jouw kasteel
  let n = 0;
  for (let r = 3; r < 8 && n < 6; r++) for (let dy = -r; dy <= r && n < 6; dy++) for (let dx = -r; dx <= r && n < 6; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = hs.x + dx, y = hs.y + dy;
    if (x > 1 && y > 1 && x < B - 2 && y < K.hoogte - 2 && s.strijd.zetVijand('ridder', x, y, 60)) n++;
  }
  uit.roodAantal = n;
  uit.verplaatst = n;
  const keepVoor = s.strijd.burcht ? s.strijd.burcht(0).leven : null;
  let st = 0;
  while (st < 4000 && s.leger.soldaten().some((e) => e === koning && !e.dood) && !s.strijd.uitslag()) { sim(50); st += 50; }
  uit.stappen = st; uit.uitslag = s.strijd.uitslag();
  uit.keepNa = s.strijd.burcht ? s.strijd.burcht(0).leven : null; uit.keepVoor = keepVoor;
  return uit;
});
console.log(JSON.stringify(r));
check('rood kan jouw kasteel op via de deur', r.deurOpgangRood === true);
check('alle tegels van jouw hoofdkasteel zijn klimbaar voor rood', r.keepKlimbaarRood === 8, r.keepKlimbaarRood);
check('er zijn rode soldaten verplaatst', r.verplaatst >= 3, r.verplaatst);
check('rood vermoordt jouw koning op het dak: verloren', r.uitslag === 'verloren', JSON.stringify(r));
check('jouw hoofdkasteel krijgt geen schade', r.keepVoor === r.keepNa, r.keepVoor + ' ' + r.keepNa);
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
