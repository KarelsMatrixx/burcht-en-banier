// Stap 44 (versie 0.68.0): de stal, de paardenboer en de ruiter (charge, grenzen, tegenspel, rode ruiters in Stillwater).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8296'], { cwd: '/home/claude/burcht-en-banier', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
const start = async (missie, klaar) => {
  await p.goto('http://localhost:8296/?x=' + Date.now()); await wacht();
  await p.evaluate(([m, k]) => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('tipGesloten', '1'); }, [missie, klaar]);
  await p.reload(); await wacht();
  // Het verhaalbeeld (20 s) en de briefing eerst weg: pas dan loopt het spel
  await p.waitForFunction(() => document.getElementById('verhaalbeeld').hidden, null, { timeout: 40000 }).catch(() => {});
  if (await p.isVisible('#missie-begin')) await p.click('#missie-begin');
  await p.waitForTimeout(500);
};
// ---- Level 6: stal, paardenboer, opleiden
await start(6, [1, 2, 3, 4, 5]);
const d = await p.evaluate(() => { const s = window.spel; const r = s.regels.soldaten.ruiter; return { r, stal: s.bouwwerken.stal && s.bouwwerken.stal.soort, boer: s.regels.beroepen.paardenboer, kr: s.regels.soldaten.kruisboog.bonusTegen, rid: s.regels.soldaten.ridder.bonusTegen }; });
check('ruiter bestaat met charge en perStal 5', d.r && d.r.perStal === 5 && d.r.charge.tegels === 5 && d.r.charge.keer === 2.5, JSON.stringify(d.r));
check('ruiter snelheid 180% van de ridder (3.6 tegen 2.0)', d.r.snelheid === 3.6);
check('stal is een bouwwerk (object 33)', d.stal === 33, d.stal);
check('paardenboer verzorgt', d.boer && d.boer.verzorgt === true);
check('kruisboog 2x en speer 1.5x tegen ruiters', d.kr.ruiter === 2 && d.rid.ruiter === 1.5);
const plek = await p.evaluate(() => { const s = window.spel; const k = s.kaart; const st = k.start[0]; for (let r = 4; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = st.x + dx, y = st.y + dy; let goed = true; for (let a = -2; a <= 6; a++) for (let c = -2; c <= 2; c++) if (!s.wegvinder.isVrij(x + a, y + c, 0) || k.object[(y + c) * 64 + x + a] !== 0) goed = false; if (goed) return [x, y]; } return null; });
check('vrije plek gevonden', !!plek);
const r1 = await p.evaluate(([x, y]) => {
  const s = window.spel; const v = s.economie.voorraad; v.planken = 100; v.steen = 100; v.hout = 100; v.goud = 500; v.koper = 40; v.brood = 100; v.tarwe = 100;
  s.economie.zetStand({ volk: 30 });
  const voor = s.leger.waaromNiet('ruiter');
  s.bouwer.plaats(s.bouwwerken.kazerne, [{ x, y }]);
  const zonderStal = s.leger.waaromNiet('ruiter');
  s.bouwer.plaats(s.bouwwerken.stal, [{ x: x + 4, y }]);
  return { voor, zonderStal, object: s.kaart.object[y * 64 + x + 4], boeren: s.economie.aantalMetBeroep('paardenboer') };
}, plek);
check('zonder stal: je hebt een stal nodig', r1.zonderStal.includes('stable first'), r1.zonderStal);
check('stal staat op de kaart', r1.object === 33, r1.object);
check('de stal krijgt een paardenboer', r1.boeren === 1, r1.boeren);
await p.waitForTimeout(300);
const r2 = await p.evaluate(([x, y]) => {
  const s = window.spel; const stalVak = y * 64 + x + 4; const uit = []; const v = s.economie.voorraad; const t0 = v.tarwe, b0 = v.brood, st0 = v.steen;
  for (let i = 0; i < 6; i++) uit.push(s.leger.leidOp('ruiter', stalVak));
  const ruiters = s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'ruiter');
  return { uit, n: ruiters.length, lagen: ruiters.map((e) => e.lagen), plekken: s.leger.plekken(), dt: t0 - v.tarwe, db: b0 - v.brood, dst: st0 - v.steen, stal: s.bouwwerken.stal.kosten };
}, plek);
check('vijf ruiters lukken', r2.uit.slice(0, 5).every((t) => t === ''), JSON.stringify(r2.uit));
check('de zesde past niet in de stal (5 per stal)', r2.uit[5].includes('stable place'), r2.uit[5]);
check('precies 5 ruiters, elk 2 legerplekken (10 plekken plus koning)', r2.n === 5 && r2.plekken >= 10, JSON.stringify(r2));
check('ruiters kosten tarwe (5 x 6), geen brood', r2.dt === 30 && r2.db === 0, JSON.stringify([r2.dt, r2.db]));
check('een stal kost geen steen', r2.stal.steen === undefined && r2.stal.hout === 30 && r2.stal.planken === 20, JSON.stringify(r2.stal));
check('ruiters kunnen niet klimmen', r2.lagen.every((l) => l === false));
// de paardenboer loopt rond bij de stal
const w = await p.evaluate(async () => { const s = window.spel; const e = s.economie.werkers().find((a) => a.werk.beroep.sleutel === 'paardenboer'); const p0 = [e.x, e.y]; let verschil = 0; const t0 = performance.now(); while (performance.now() - t0 < 9000) { await new Promise((r) => setTimeout(r, 200)); verschil = Math.max(verschil, Math.hypot(e.x - p0[0], e.y - p0[1])); } return { verschil, houding: e.houding, beschrijf: s.economie.beschrijf(e.werk.plaats) }; });
check('paardenboer loopt rond met hooi', w.verschil > 0.3 && w.houding === 'last', JSON.stringify(w));
check('paardenboer: tekst in beeld', /horse keeper is tending the horses/.test(w.beschrijf), w.beschrijf);
// ---- Paarden op het erf: bij 5 ruiters geen, na twee gesneuvelde ruiters twee paarden
const erf0 = await p.evaluate(() => window.spel.eenheden.lijst.filter((e) => e.paard).length);
check('bij vijf ruiters staan er geen paarden op het erf', erf0 === 0, erf0);
await p.evaluate(() => { const r = window.spel.leger.soldaten().filter((e) => e.soldaat.sleutel === 'ruiter'); r[0].dood = true; r[1].dood = true; });
await p.waitForTimeout(1200);
const erf1 = await p.evaluate(() => { const s = window.spel; const n = s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'ruiter').length; return { n, paarden: s.eenheden.lijst.filter((e) => e.paard).length }; });
check('na twee gesneuvelde ruiters staan er twee paarden op het erf', erf1.paarden === 5 - erf1.n && erf1.paarden >= 1, JSON.stringify(erf1));
// ---- Bakker laat 20 tarwe liggen
const bk = await p.evaluate(() => { const s = window.spel; const b = s.regels.beroepen.bakker; return { r: b.reserve, n: b.neemt }; });
check('bakker laat minstens 20 tarwe liggen', bk.r && bk.r.tarwe === 20 && bk.n.tarwe === 4, JSON.stringify(bk));
// ---- Charge
const c = await p.evaluate(async ([x, y]) => {
  const s = window.spel; for (const v of s.strijd.vijanden()) v.dood = true;
  for (const e of s.leger.soldaten()) if (e.soldaat.sleutel === 'ruiter') e.dood = true;
  s.leger.zetStand([['ruiter', x, y + 6, 78, 0]]);
  const e = s.leger.soldaten().find((a) => a.soldaat.sleutel === 'ruiter' && !a.dood && Math.floor(a.y) === y + 6);
  e.leven = 9999;
  let vx = x + 9; while (!s.wegvinder.isVrij(vx, y + 6, 1) && vx > x + 3) vx--;
  const v = s.strijd.zetVijand('steenwachter', vx, y + 6, 300);
  if (!v) return ['geen vijand', vx];
  const lijst = []; let vorig = v.leven;
  const t0 = performance.now(); let gezet = false;
  while (performance.now() - t0 < 9000 && lijst.length < 3) {
    await new Promise((r) => setTimeout(r, 25));
    if (!gezet && e.krijg) { e.krijg.bevel = v; gezet = true; }
    v.krijg && (v.krijg.denk = 1e9);
    if (v.leven < vorig) { lijst.push(vorig - v.leven); vorig = v.leven; }
  }
  return lijst;
}, plek);
check('eerste klap na een rit is een charge (25 = 10 x 2,5, met het vaandel van de koning 28)', c[0] >= 25 && c[0] <= 28, JSON.stringify(c));
check('tweede klap is gewoon (10, met het vaandel 11)', c[1] >= 10 && c[1] <= 11, JSON.stringify(c));
// ---- Rood in Stillwater
await start(5, [1, 2, 3, 4]);
const h = await p.evaluate(() => { const s = window.spel; const H = s.regels.heer; return { extra: H.extra_soorten, gew: H.gewicht.ruiter, prijs: H.tarwePrijs, mag: s.bouwwerken.stal && true }; });
check('rood in level 5 koopt ruiters: vanaf aanval 5 (dus de zesde), hooguit 2', h.extra.ruiter && h.extra.ruiter.vanaf === 5 && h.extra.ruiter.max === 2, JSON.stringify(h));
check('katapult en toren blijven in level 5', h.extra.katapult && h.extra.toren);
check('ruiter weegt 1,8', h.gew === 1.8);
const menu = await p.evaluate(() => [...document.querySelectorAll('#bouwbalk button')].map((b) => b.textContent));
check('stal staat niet in je bouwmenu in level 5 zelf', !menu.some((t) => t.startsWith('Stable')), menu.join('|'));
const rd = await p.evaluate(() => {
  const s = window.spel; const st = s.rood.bewaar(); st.a = 5; s.rood.zet(st);
  s.rood.zetVoorraad('goud', 900); s.rood.zetReserve({});
  for (let i = 0; i < 400; i++) { s.rood.zetVoorraad('goud', 900); s.rood.zetVoorraad('hout', 300); s.rood.zetSinds(0); s.strijd.stap(); }
  return s.rood.stand();
});
check('rood koopt ruiters (hooguit 2) vanaf de zesde aanval', rd.reserve && rd.reserve.ruiter >= 1 && rd.reserve.ruiter <= 2, JSON.stringify(rd.reserve));
const rd0 = await p.evaluate(() => { const s = window.spel; const st = s.rood.bewaar(); st.a = 2; s.rood.zet(st); s.rood.zetVoorraad('goud', 900); s.rood.zetReserve({}); for (let i = 0; i < 300; i++) { s.rood.zetVoorraad('goud', 900); s.rood.zetSinds(0); s.strijd.stap(); } return s.rood.stand().reserve; });
check('voor de zesde aanval geen ruiters', !rd0.ruiter, JSON.stringify(rd0));
// ---- Level 6 heeft de stal en ruiter in het menu
await start(6, [1, 2, 3, 4, 5]);
const menu6 = await p.evaluate(() => { const s = window.spel; return Object.values(s.bouwwerken).map((w) => w.sleutel); });
check('stal bestaat in level 6', menu6.includes('stal'));
const mag6 = await p.evaluate(async () => { const m = await import('/js/modus.js'); const c = await (await fetch('data/campagne.json')).json(); return [m.ontgrendeld(c.levels, 6)('stal'), m.ontgrendeld(c.levels, 6)('ruiter'), m.ontgrendeld(c.levels, 5)('stal'), m.ontgrendeld(c.levels, 5)('ruiter')]; });
check('stal en ruiter open in level 6, dicht in level 5', mag6.join() === 'true,true,false,false', mag6.join());
check('geen paginafouten', fouten.length === 0, fouten.slice(0, 3).join(' | '));
console.log('ruiter68:', ok, 'goed,', fout, 'fout');
await b.close(); srv.kill();
