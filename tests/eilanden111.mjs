// 0.111.1: White Dike als twee eilanden, veel rode havens, veel schepen, meer begin-hout.
// node tests/eilanden111.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const POORT = 8321;
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
const zichtbaar = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !!(e.offsetWidth || e.offsetHeight) && !e.closest('[hidden]'); }, sel);
await p.waitForFunction(() => { const v = document.getElementById('verhaalbeeld-verder'); return document.getElementById('verhaalbeeld').hidden || (v && !v.hidden); }, null, { timeout: 20000 });
if (await zichtbaar('#verhaalbeeld-verder')) await p.click('#verhaalbeeld-verder');
await p.waitForTimeout(500);
if (await zichtbaar('#missie-begin')) await p.click('#missie-begin');
await p.waitForTimeout(800);
const u = await p.evaluate(() => {
  const { kaart, wegvinder, doel, economie } = window.spel;
  const B = kaart.breedte;
  const a = kaart.start[0], r = kaart.start[1];
  // land verbonden? vul vanaf jouw start, tel of rood bereikt wordt
  const gezien = new Uint8Array(kaart.breedte * kaart.hoogte);
  const rij = [a.y * B + a.x]; gezien[rij[0]] = 1; let land = 0, roodBereikt = false;
  while (rij.length) {
    const i = rij.pop(); land++;
    if (i === r.y * B + r.x) roodBereikt = true;
    const x = i % B, y = (i - x) / B;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= B || ny >= kaart.hoogte) continue;
      const j = ny * B + nx;
      if (gezien[j] || kaart.grond[j] === 3) continue;
      gezien[j] = 1; rij.push(j);
    }
  }
  const havens = []; for (let i = 0; i < kaart.object.length; i++) if (kaart.object[i] === 52 && !kaart.eigenaar[i]) havens.push(i);
  return { breedte: B, hoogte: kaart.hoogte, land, roodBereikt, havensRood: havens.length, hout: economie.voorraad.hout, landingen: doel.landingen ? doel.landingen().length : -1, kaarthavens: doel.havens ? doel.havens().length : -1 };
});
console.log(JSON.stringify(u));
check('kaart is groter (96 x 96)', u.breedte === 96 && u.hoogte === 96);
check('rood niet over land bereikbaar', u.roodBereikt === false);
check('jouw eiland is groot genoeg', u.land > 1500, String(u.land));
check('veel rode havens', u.havensRood >= 6, String(u.havensRood));
check('havens gevonden voor de schepen', u.kaarthavens >= 6, String(u.kaarthavens));
check('minstens drie landingsplekken', u.landingen >= 3, String(u.landingen));
check('begin met meer hout', u.hout >= 130, String(u.hout));
// de laatste golf: veel schepen, van verschillende kaden
const w = await p.evaluate(async () => {
  const d = window.spel.doel;
  window.spel.ui.verbergVerhaal && window.spel.ui.verbergVerhaal();
  let max = 0, bronnen = new Set();
  d.zetTijd(180 + 110 * 9 + 1);
  for (let i = 0; i < 40; i++) { d.stap(0.2); const sch = d.schepen(); max = Math.max(max, sch.length); for (const s of sch) bronnen.add(Math.round(s.x) + ',' + Math.round(s.y)); }
  return { max, golven: d.stand().golven };
});
console.log(JSON.stringify(w));
check('in de laatste golven veel schepen tegelijk', w.max >= 8, String(w.max));
await p.waitForTimeout(2500);
const dorp = await p.evaluate(() => {
  const { eenheden, kaart } = window.spel;
  const r = kaart.start[1];
  const lijst = eenheden.lijst.filter((e) => e.burgerVanRood);
  return { n: lijst.length, dichtbij: lijst.filter((e) => Math.hypot(e.x - r.x, e.y - r.y) <= 14).length };
});
console.log(JSON.stringify(dorp));
check('veel burgers rond het dorp van rood', dorp.n >= 30 && dorp.dichtbij >= 30, JSON.stringify(dorp));
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`${goed} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
