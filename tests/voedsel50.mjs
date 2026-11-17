// 0.66: soldaten en boeren eten 0.5 per minuut; wie niet kan eten kost 2 populariteit; bij 90 tot 100 komen er 2 boeren per 15 seconden.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8300;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
await p.goto(`http://localhost:${poort}/`); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 1 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.tap('#missie-begin', { timeout: 30000 }); await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  const s = window.spel, E = s.economie, uit = {};
  s.strijd.pauzeer(true);
  const zetEten = (n) => { E.voorraad.brood = 0; E.voorraad.voedsel = n; };
  // 1. Genoeg eten: 10 boeren en 6 soldaten eten 16 maal 0.5 = 8 per minuut
  E.pauzeerVolk(true); E.pauzeerVolk(false);
  E.zetVolk(10);
  s.leger.zetStand(Array.from({ length: 6 }, (_, i) => ['ridder', 20 + i, 20, 60, 0]));
  const soldaten = s.leger.soldaten().length;
  uit.eters = E.bevolking().eters; uit.soldaten = soldaten;
  E.zetStemming(50, 0);
  zetEten(100);
  E.spoelVolk(61);
  uit.etenNa = E.voorraad.voedsel; uit.verwacht = 100 - Math.ceil((10 + soldaten) * 0.5);
  // 2. Te weinig: eten voor 10 personen, 16 mensen: 6 hongerig = 12 populariteit eraf
  E.zetStemming(80, 0);
  zetEten(5);
  E.spoelVolk(61);
  uit.popHonger = E.stemming().populariteit; uit.etenLeeg = E.voorraad.voedsel;
  return uit;
});
console.log(JSON.stringify(r));
check('soldaten tellen mee als eters', r.eters === 10 + r.soldaten, JSON.stringify([r.eters, r.soldaten]));
check('iedereen eet een halve per minuut', r.etenNa === r.verwacht, JSON.stringify([r.etenNa, r.verwacht]));
check('te weinig eten: elk hongerig persoon kost 2 populariteit', r.popHonger === 80 - 2 * (r.eters - 10), JSON.stringify([r.popHonger, r.eters]));
check('het eten is dan op', r.etenLeeg === 0, r.etenLeeg);
// 3. Groei: 2 boeren per 15 seconden tussen 90 en 100, anders 1
const g = await p.evaluate(() => {
  const s = window.spel, E = s.economie, uit = {};
  E.zetStemming(70, 0); E.zetVolk(4); E.voorraad.voedsel = 500; E.pauzeerVolk(true); E.pauzeerVolk(false);
  E.spoelVolk(15.2); uit.normaal = E.bevolking().volk - 4;
  E.zetStemming(95, 0); E.zetVolk(4); E.voorraad.voedsel = 500; E.pauzeerVolk(true); E.pauzeerVolk(false);
  E.spoelVolk(15.2); uit.snel = E.bevolking().volk - 4;
  E.zetStemming(89, 0); E.zetVolk(4); E.voorraad.voedsel = 500; E.pauzeerVolk(true); E.pauzeerVolk(false);
  E.spoelVolk(15.2); uit.net_onder = E.bevolking().volk - 4;
  return uit;
});
console.log(JSON.stringify(g));
check('onder 90: 1 boer per 15 seconden', g.normaal === 1, g.normaal);
check('vanaf 90: 2 boeren per 15 seconden', g.snel === 2, g.snel);
check('89 is nog normaal', g.net_onder === 1, g.net_onder);
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
