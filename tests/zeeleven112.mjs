// 0.112.0: zeeleven op White Dike: walvissen, meeuwen, vissersboten, mist, avondlicht, Rutger op de dijk, eilandje met kist.
// node tests/zeeleven112.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const POORT = 8331;
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
await p.evaluate(() => window.spel.ui.verbergVerhaal && window.spel.ui.verbergVerhaal());

const a = await p.evaluate(() => {
  const z = window.spel.zeeleven;
  const { kaart, staat } = window.spel;
  return { bestaat: !!z, eilandjes: z ? z.eilandjes().map((e) => ({ x: e.x, y: e.y, zand: kaart.grond[e.y * kaart.breedte + e.x] })) : [], boten: z ? z.boten().length : -1, kust: z ? z.kust().length : 0, jouwKust: z ? z.jouwKust().length : 0, zee: !!staat.zee };
});
console.log(JSON.stringify(a));
check('zeeleven draait op White Dike', a.bestaat && a.zee);
check('twee eilandjes in de straat', a.eilandjes.length === 2 && a.eilandjes.every((e) => e.zand === 2), JSON.stringify(a.eilandjes));
check('vissersboten bij rode havens', a.boten >= 3, String(a.boten));
check('kustwater gevonden, ook bij jouw kust', a.kust > 50 && a.jouwKust > 10, `${a.kust} / ${a.jouwKust}`);

// Walvis die springt, en de gelukkige walvis die je kunt vangen
const w = await p.evaluate(() => {
  const z = window.spel.zeeleven;
  const { economie } = window.spel;
  const i = z.jouwKust()[0];
  const B = window.spel.kaart.breedte;
  const x = i % B, y = Math.floor(i / B);
  const wv = z.spring({ x: x + 0.5, y: y + 0.5, gelukkig: true });
  const voor = economie.voorraad.vis;
  for (let k = 0; k < 40; k++) z.stap(0.05);   // 2 s: de sprong is voorbij
  const raak = z.tik(x, y);
  const na = economie.voorraad.vis;
  const tweede = z.tik(x, y);
  return { raak, plus: na - voor, tweede, gevangen: z.gevangen(), nog: z.walvissen().length };
});
console.log(JSON.stringify(w));
check('walvis aantikken geeft voedsel', w.raak === true && w.plus > 0, String(w.plus));
check('dezelfde walvis geeft maar een keer', w.tweede === false && w.gevangen === 1);
const sp = await p.evaluate(() => {
  const z = window.spel.zeeleven; const n0 = z.walvissen().length;
  for (let k = 0; k < 2400; k++) z.stap(0.05);   // twee minuten
  return { n0, gezien: z.gevangen() };
});
check('spel loopt twee minuten door zonder fouten', fouten.length === 0, fouten.join('|'));

// Mist (het avondlicht is weg sinds 0.120.1)
const m = await p.evaluate(() => {
  const z = window.spel.zeeleven; const d = window.spel.doel;
  let max = 0; for (let t = 0; t < 140; t += 2) { /* mist hangt aan de eigen klok: stappen */ z.stap(2); max = Math.max(max, z.mist()); }
  d.zetTijd(d.stand().tijd + d.volgende() - 20);   // 20 s voor de eerste golf
  for (let k = 0; k < 120; k++) z.stap(0.1);
  return { mistMax: max, licht: typeof z.licht };
});
check('er komt mist voorbij', m.mistMax > 0.5, m.mistMax.toFixed(2));
check('geen avondlicht meer', m.licht === 'undefined', m.licht);

// Rutger op de dijk, schreeuwt
const r = await p.evaluate(() => {
  const { doel, kaart } = window.spel; const z = window.spel.zeeleven;
  const e = doel.rutgerThuis();
  if (!e) return { geen: true };
  const jij = kaart.start[0]; const rood = kaart.start[1];
  const dist = (o) => Math.hypot(o.x - jij.x, o.y - jij.y);
  let dijkNabij = Infinity;
  for (let i = 0; i < kaart.object.length; i++) if (kaart.object[i] === 57) dijkNabij = Math.min(dijkNabij, dist({ x: i % kaart.breedte, y: Math.floor(i / kaart.breedte) }));
  for (let k = 0; k < 2000 && !z.schreeuw(); k++) z.stap(0.1);
  return { x: e.x, y: e.y, naarJou: dist(e), naarDorp: Math.hypot(e.x - rood.x, e.y - rood.y), dijkNabij, schreeuw: z.schreeuw() && z.schreeuw().tekst };
});
console.log(JSON.stringify(r));
check('Rutger staat vooraan op de dijk', !r.geen && r.naarJou <= r.dijkNabij + 4, `${r.naarJou && r.naarJou.toFixed(1)} vs ${r.dijkNabij && r.dijkNabij.toFixed(1)}`);
check('Rutger schreeuwt tussen de golven', !!r.schreeuw, r.schreeuw);

// Eilandje: zonder haven kan het niet, met haven vaart je schip erheen en terug
const e1 = await p.evaluate(() => {
  const z = window.spel.zeeleven; const { economie, haven } = window.spel;
  const e = z.eilandjes()[0];
  const eigen = haven.havens().filter((h) => !h.rood).length;
  const geenHaven = z.tik(e.x, e.y);   // wordt wel afgehandeld (melding), maar er vaart niets
  return { eigen, geenHaven, reis: !!z.reis() };
});
check('zonder haven vaart er geen schip', e1.eigen === 0 && e1.geenHaven === true && e1.reis === false);
// Zet een eigen haven aan het water bij jouw start
const h = await p.evaluate(() => {
  const { kaart, haven } = window.spel; const B = kaart.breedte; const a = kaart.start[0];
  let best = null, bd = 1e9;
  for (let y = 2; y < kaart.hoogte - 2; y++) for (let x = 2; x < B - 2; x++) {
    const i = y * B + x;
    if (kaart.grond[i] === 3 || kaart.object[i] !== 0) continue;
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => kaart.grond[(y + dy) * B + x + dx] === 3)) continue;
    const d = Math.hypot(x - a.x, y - a.y);
    if (d < bd && d > 4) { bd = d; best = i; }
  }
  kaart.object[best] = 52; kaart.eigenaar[best] = 1; haven.zoek();
  return { best, eigen: haven.havens().filter((q) => !q.rood).length };
});
check('eigen haven geplaatst', h.eigen >= 1, JSON.stringify(h));
const e2 = await p.evaluate(() => {
  const z = window.spel.zeeleven; const { economie } = window.spel;
  const e = z.eilandjes()[0];
  const voor = economie.voorraad.planken;
  const ok = z.tik(e.x, e.y);
  const reisStart = !!z.reis();
  let sec = 0; while (z.reis() && sec < 600) { z.stap(0.25); sec += 0.25; }
  return { ok, reisStart, sec, plus: economie.voorraad.planken - voor, gehaald: e.gehaald, opnieuw: z.tik(e.x, e.y) };
});
console.log(JSON.stringify(e2));
check('schip vaart naar het eilandje en komt terug', e2.ok && e2.reisStart && e2.sec < 600 && e2.gehaald, `${e2.sec}s`);
check('kist levert planken op', e2.plus > 0, String(e2.plus));
check('kist is leeg na ophalen', e2.opnieuw === false);

// tekenen zonder fouten, met alles aan
await p.evaluate(() => { const z = window.spel.zeeleven; z.spring({ x: window.spel.kaart.start[0].x + 6.5, y: window.spel.kaart.start[0].y + 0.5, gelukkig: false }); z.schreeuwNu(); });
await p.waitForTimeout(1500);
check('tekenen zonder fouten', fouten.length === 0, fouten.join('|'));
console.log(`\n${goed} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
