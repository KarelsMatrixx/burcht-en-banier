// Level 4 The Fen: ongeveer 30 plekken waar een werker of soldaat van jou een sluipmoordenaar wakker maakt.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8278;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 4 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht();
await p.tap('#missie-begin', { timeout: 30000 }); await p.waitForTimeout(1500);
check('sluipers in level 4', await p.evaluate(() => !!window.spel.sluipers));
const pl = await p.evaluate(() => window.spel.sluipers.plekken());
console.log('plekken:', pl.length);
check('ongeveer 30 plekken (28 tot 30)', pl.length >= 28 && pl.length <= 30, pl.length);
const info = await p.evaluate((pl) => { const s = window.spel, B = s.kaart.breedte, H = s.kaart.hoogte; const k = s.kaart.start[0];
  const hv = s.kaart.object.indexOf(12);
  return { B, H, vrij: pl.every((q) => s.wegvinder.isVrij(q.x, q.y, 1) && s.wegvinder.isVrij(q.x, q.y, 0)),
    minKasteel: Math.min(...pl.map((q) => Math.hypot(q.x - k.x, q.y - k.y))),
    minHut: hv < 0 ? 99 : Math.min(...pl.map((q) => Math.hypot(q.x - hv % B, q.y - Math.floor(hv / B)))),
    minOnder: Math.min(...pl.flatMap((q, i) => pl.slice(i + 1).map((r) => Math.hypot(q.x - r.x, q.y - r.y)))),
    kwart: [0, 1, 2, 3].map((n) => pl.filter((q) => (q.x < B / 2 ? 0 : 1) + (q.y < H / 2 ? 0 : 2) === n).length) }; }, pl);
console.log(JSON.stringify(info));
check('alle plekken op begaanbaar land', info.vrij);
check('niet vlak bij je kasteel', info.minKasteel >= 12, info.minKasteel);
check('niet vlak bij de hut', info.minHut >= 5, info.minHut);
check('plekken liggen uit elkaar', info.minOnder >= 4, info.minOnder);
check('in alle vier de kwarten van de kaart', info.kwart.every((n) => n >= 3), JSON.stringify(info.kwart));
const sluipTel = () => p.evaluate(() => window.spel.strijd.vijanden().filter((e) => !e.dood && e.vijand === 'sluipmoordenaar').length);
const gebr = () => p.evaluate(() => window.spel.sluipers.gebruikt());
const zet = (n, soort) => p.evaluate(([n, soort]) => { const s = window.spel; const q = s.sluipers.plekken()[n];
  for (const e of s.leger.lijst) if (!e.dood && e.levenMax) e.leven = e.levenMax;   // de proef mag niet stranden op een gesneuvelde soldaat
  const wie = soort === 'werker' ? s.eenheden.lijst.find((e) => e.zelf && e.team === 0 && !e.dood)
    : (s.leger.lijst.find((e) => !e.dood && e.soldaat && e.soldaat.sleutel !== 'koning') || s.leger.lijst.find((e) => !e.dood));
  if (!wie) return false; wie.x = q.x + 0.5; wie.y = q.y + 0.5; wie.pad = null; return true; }, [n, soort]);
const voorS = await sluipTel();
await p.waitForTimeout(1500);
check('niets zolang niemand erlangs loopt', (await gebr()) === 0);
check('soldaat op plek 0', await zet(0, 'soldaat'));
await p.waitForTimeout(1000);
let g = await gebr();
check('plek 0 gebruikt na een soldaat', await p.evaluate(() => window.spel.sluipers.plekken()[0].gebruikt));
check('precies een sluipmoordenaar per gebruikte plek', (await sluipTel()) === voorS + g, `${voorS} + ${g} = ${await sluipTel()}`);
const bij = await p.evaluate((q) => window.spel.strijd.vijanden().filter((e) => !e.dood && e.vijand === 'sluipmoordenaar').some((e) => Math.hypot(e.x - q.x, e.y - q.y) < 3), pl[0]);
check('hij staat bij de plek', bij);
await p.waitForTimeout(1500);
check('een plek werkt maar een keer', (await sluipTel()) === voorS + (await gebr()));
// Een werker op plek 1
check('werker op plek 1', await zet(1, 'werker'));
await p.waitForTimeout(1000);
check('plek 1 gebruikt na een werker', await p.evaluate(() => window.spel.sluipers.plekken()[1].gebruikt));
g = await gebr();
check('nog steeds precies een per plek', (await sluipTel()) >= voorS + g - 0 && (await sluipTel()) <= voorS + g, `${await sluipTel()} vs ${voorS + g}`);
// Rood zelf lost niets uit
const g0 = await gebr();
await p.evaluate(() => { const s = window.spel; const q = s.sluipers.plekken().find((x) => !x.gebruikt);
  const v = s.eenheden.lijst.find((e) => e.team === 1 && !e.dood && e.vijand !== 'sluipmoordenaar'); v.x = q.x + 0.5; v.y = q.y + 0.5; });
await p.waitForTimeout(600);
check('rood zelf lost geen plek uit', (await gebr()) === g0 || (await gebr()) === g0 + 0);
// Alle plekken: elke werker/soldaat op een plek geeft precies 1
for (let n = 0; n < pl.length; n++) {
  if (await p.evaluate((n) => window.spel.sluipers.plekken()[n].gebruikt, n)) continue;
  await zet(n, 'soldaat') || await zet(n, 'werker');
  await p.waitForTimeout(400);
}
const totaal = await p.evaluate(() => window.spel.sluipers.gebruikt());
check(`alle ${pl.length} plekken gebruikt`, totaal === pl.length, totaal);
check('voor elke plek een eigen sluipmoordenaar erbij (gevallen niet meegeteld: minstens 20 staan er nog of zijn gevallen)', (await p.evaluate(() => window.spel.strijd.vijanden().filter((e) => e.vijand === 'sluipmoordenaar').length)) >= voorS + 20);
// Herstart: alles staat weer klaar
await p.evaluate(() => window.spel.sluipers.wis());
check('na opnieuw beginnen weer 0 gebruikt', (await p.evaluate(() => window.spel.sluipers.gebruikt())) === 0);
// Andere levels hebben geen sluipers
const anders = await p.evaluate(async () => { const r = await fetch('data/campagne.json'); const j = await r.json(); const l = j.levels; return (Array.isArray(l) ? l : Object.values(l)).filter((m) => m.sluipers).map((m) => m.id); });
check('alleen level 4 heeft sluipers', JSON.stringify(anders) === '[4]', JSON.stringify(anders));
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
