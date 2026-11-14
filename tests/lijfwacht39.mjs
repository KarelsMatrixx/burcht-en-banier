// Versie 0.49.2: level 5 (Stillwater): twee zwaardvechters lopen als lijfwacht achter de rode heer.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8274'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const fouten = []; let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
async function start(l) {
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  p.on('pageerror', (e) => fouten.push(String(e)));
  await p.goto('http://localhost:8274/'); await p.waitForFunction(() => window.spel && window.spel.strijd);
  await p.evaluate((l) => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3, 4, 5] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: l })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, l);
  await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd); await p.waitForTimeout(300);
  return p;
}
let p = await start(5);
const r = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(false);
  const lw = () => s.strijd.lijfwachten();
  const koning = () => s.strijd.roodKoning();
  const out = { begin: lw().length, soort: lw().map((e) => e.vijand), alsAanvaller: s.strijd.stand().vijanden };
  const afstanden = [];
  for (let i = 0; i < 1800; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); if (i % 100 === 99) { const k = koning(); afstanden.push(Math.max(...lw().map((e) => Math.hypot(e.x - k.x, e.y - k.y)))); } }
  out.afstanden = afstanden; out.na = lw().length;
  // een soldaat van jou bij de heer: de lijfwachten gaan erop af
  const k = koning();
  const vijand = s.leger.lijst.find((e) => e.soldaat && !e.koning) || null;
  out.eenSoldaat = !!vijand;
  return out;
});
check('twee lijfwachten bij de start', r.begin === 2, r.begin);
check('het zijn zwaardvechters', r.soort.every((x) => x === 'zwaardvechter'), JSON.stringify(r.soort));
check('lijfwachten tellen niet als aanvallers', r.alsAanvaller === 0, r.alsAanvaller);
check('ze blijven bij de heer (hij zwerft nu): alle binnen 14 tegels, minstens 70% binnen 8', r.afstanden.every((a) => a <= 14) && r.afstanden.filter((a) => a <= 8).length >= r.afstanden.length * 0.7, JSON.stringify(r.afstanden.map((a) => +a.toFixed(1))));
check('ze zijn er na 3 minuten nog', r.na === 2, r.na);
const g = await p.evaluate(() => {
  const s = window.spel; const k = s.strijd.roodKoning();
  // Een soldaat van jou bij de heer: de lijfwachten vallen hem aan.
  const vx = Math.floor(k.x) + 3, vy = Math.floor(k.y) + 3;
  s.leger.zetStand([['ridder', vx, vy, 200]]);
  const sold = s.leger.lijst.find((e) => e.soldaat && e.soldaat.sleutel === 'ridder');
  if (!sold) return { geen: true };
  const voor = sold.leven; let geraakt = false;
  for (let i = 0; i < 80; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); if (sold.dood || sold.leven < voor) { geraakt = true; break; } }
  return { geraakt, nu: s.strijd.lijfwachten().length };
});
check('er is een soldaat om mee te testen', !g.geen, JSON.stringify(g));
check('lijfwachten vallen een soldaat bij de heer aan', g.geraakt, JSON.stringify(g));
await p.context().close();
p = await start(3);
const n3 = await p.evaluate(() => window.spel.strijd.lijfwachten().length);
check('level 3 heeft geen lijfwachten', n3 === 0, n3);
check('geen paginafouten', fouten.length === 0, fouten.join('|'));
console.log('lijfwacht39:', ok, 'goed,', fout, 'fout');
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
