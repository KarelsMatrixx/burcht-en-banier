import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 } });
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('burcht-banier.paneel', 'bouw'); } catch (e) {} });
const fouten = [];
p.on('pageerror', (e) => fouten.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
await p.goto(url + '/?x=' + Date.now());
await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(() => localStorage.clear());
await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd);
const spoel = (sec) => p.evaluate((sec) => { const s = window.spel; for (let i = 0; i < sec * 10; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } return s.strijd.stand(); }, sec);
// 1. soorten bestaan en zijn te bestellen
const info = await p.evaluate(() => { const s = window.spel; return { kat: !!s.leger.soorten.katapult, tor: !!s.leger.soorten.toren }; });
check('katapult en toren bekend', info.kat && info.tor);
// 2. katapult beschiet een werk van rood vanaf 8 tegels
await p.evaluate(() => { const s = window.spel; s.rood.zetVoorraad('goud', 0); s.strijd.pauzeer(true); });
const werk = await p.evaluate(() => { const s = window.spel; const v = s.rood.werken()[1]; return { v, x: v % 64, y: Math.floor(v / 64), soort: s.kaart.object[v] }; });
console.log('werk', JSON.stringify(werk));
const n0 = await p.evaluate((w) => { const s = window.spel; return s.leger.zetStand([['katapult', w.x - 7, w.y + 3, 90, 0]]); }, werk);
check('katapult neergezet', n0 === 1, n0);
const zet = await p.evaluate((w) => { const s = window.spel; const kat = s.leger.lijst.find((e) => e.soldaat.sleutel === 'katapult'); return { n: s.strijd.valBouwAan([kat], w.v), pos: [kat.x, kat.y] }; }, werk);
check('aanvalsbevel op werk', zet.n === 1, JSON.stringify(zet));
let effSteen = false, schadeGezien = false;
for (let i = 0; i < 12; i++) {
  const r = await p.evaluate(() => { const s = window.spel; let steen = false; for (let k = 0; k < 50; k++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); if (s.strijd.effecten.some((f) => f.steen)) steen = true; } return { steen }; });
  if (r.steen) effSteen = true;
}
const na = await p.evaluate((w) => { const s = window.spel; return { o: s.kaart.object[w.v], e: s.kaart.eigenaar[w.v], lev: s.strijd.levenOp(w.v), kat: s.leger.lijst.find((e) => e.soldaat.sleutel === 'katapult') && [s.leger.lijst.find((e) => e.soldaat.sleutel === 'katapult').x, s.leger.lijst.find((e) => e.soldaat.sleutel === 'katapult').y] }; }, werk);
console.log('na 60s', JSON.stringify(na));
check('werk vernield of beschadigd', na.o !== werk.soort || (na.lev && na.lev.leven < na.lev.max), JSON.stringify(na));
check('steen vloog door de lucht (zichtbaar effect)', effSteen);
// 3. belegeringstoren zet een vaste ladder tegen een muur van rood
await p.evaluate(() => { const s = window.spel; s.strijd.herstel(); s.strijd.pauzeer(true); s.leger.herstel(); });
const muur = await p.evaluate(() => { const s = window.spel; const m = s.strijd.rood(); const vak = (m.y + 5) * 64 + m.x - 2; return { vak, x: m.x - 2, y: m.y + 5, soort: s.kaart.object[vak], eig: s.kaart.eigenaar[vak] }; });
console.log('muur', JSON.stringify(muur));
await p.evaluate((m) => { const s = window.spel; s.leger.zetStand([['toren', m.x, m.y + 2, 300, 0]]); }, muur);
const bev = await p.evaluate((m) => { const s = window.spel; const t = s.leger.lijst.find((e) => e.soldaat.sleutel === 'toren'); return s.strijd.zetLadderBevel([t], m.vak); }, muur);
check('toren krijgt ladderbevel', bev === 1, bev);
await spoel(25);
const lad = await p.evaluate((m) => { const s = window.spel; return s.strijd.ladders().filter((l) => l.vak === m.vak); }, muur);
check('vaste ladder staat tegen muur', lad.length === 1 && lad[0].vast === true && lad[0].team === 0, JSON.stringify(lad));
// opslaan en terugzetten van de vaste ladder
const bew = await p.evaluate(() => JSON.stringify(window.spel.strijd.bewaarStand().ladders));
check('vast bewaard (5e getal 1)', JSON.parse(bew).some((r) => r[4] === 1), bew);
// 4. een soldaat op de ladder-tegel duwt hem pas na ~10 s om (niet na 3 s)
// 4. een soldaat op de ladder-tegel duwt hem pas na ~10 s om (niet na 3 s)
const gezet = await p.evaluate((m) => { const s = window.spel; return { n: s.leger.zetStand([['ridder', m.x - 3, m.y + 4, 60, 0]]), aantal: s.leger.lijst.map((e) => e.soldaat.sleutel) }; }, muur);
console.log('ridder gezet', JSON.stringify(gezet));
await p.evaluate((m) => { const s = window.spel; const r = s.leger.lijst.find((e) => e.soldaat.sleutel === 'ridder'); if (!r) return; s.leger.kies([r]); s.leger.stuur(m.x, m.y, true); }, muur);
let opMuur = false, t = 0, weg = false;
for (; t < 40; t++) {
  const r = await p.evaluate((m) => { const s = window.spel; for (let i = 0; i < 10; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } const r = s.leger.lijst.find((e) => e.soldaat.sleutel === 'ridder'); return { op: !!(r && r.opMuur && Math.floor(r.y) * 64 + Math.floor(r.x) === m.vak), ladder: s.strijd.ladders().some((l) => l.vak === m.vak), dood: !r }; }, muur);
  if (r.dood) break;
  if (r.op && !opMuur) { opMuur = true; t = 0; }
  if (opMuur && !r.ladder) { weg = true; break; }
}
console.log('op ladderplek:', opMuur, 'ladder omgeduwd na', t, 's:', weg);
check('ridder kwam op de muur', opMuur);
check('vaste ladder valt pas na 8 s of meer om', !opMuur || (weg && t >= 8) || !weg, `t=${t} weg=${weg}`);
// 5. rood koopt katapult en toren op zijn tijd
await p.evaluate(() => { const s = window.spel; s.strijd.herstel(); s.strijd.pauzeer(false); });
const schema = await p.evaluate(() => {
  const s = window.spel; const uit = []; let vorig = 0; let t = 0;
  for (let i = 0; i < 10 * 2200; i++) {
    s.strijd.stap(); t += 0.1;
    const g = s.strijd.stand().golf;
    if (g !== vorig) { vorig = g; const so = {}; for (const v of s.strijd.vijanden()) so[v.vijand] = (so[v.vijand] || 0) + 1; uit.push([g, Math.round(t), JSON.stringify(so)]); for (const v of s.strijd.vijanden()) v.dood = true; s.strijd.stap(); }
  }
  return uit;
});
for (const r of schema) console.log(' ', r.join(' | '));
check('katapult pas vanaf aanval 6', schema.every(([g, , sm]) => g >= 6 || !sm.includes('katapult')) && schema.some(([g, , sm]) => g >= 6 && sm.includes('katapult')));
check('toren pas vanaf aanval 7', schema.every(([g, , sm]) => g >= 7 || !sm.includes('toren')) && schema.some(([g, , sm]) => g >= 7 && sm.includes('toren')));
// 6. rode katapult beschiet jouw bouwwerk
await p.evaluate(() => { const s = window.spel; s.strijd.herstel(); s.strijd.pauzeer(true); s.leger.herstel(); });
const eigen = await p.evaluate(() => {
  const s = window.spel; const k = s.kaart; const st = k.start[0];
  // een muurstuk van jou, 8 tegels van de katapult
  const x = st.x + 3, y = st.y - 8; const vak = y * 64 + x;
  k.object[vak] = 4; k.eigenaar[vak] = 1; s.wegvinder.herbereken(); s.strijd.kaartVeranderd();
  s.strijd.zetVijand('katapult', x + 7, y, 90);
  return { vak, x, y };
});
await spoel(120);
const sch = await p.evaluate((e) => { const s = window.spel; return { burcht: s.strijd.stand().burcht, o: s.kaart.object[e.vak], lev: s.strijd.levenOp(e.vak), kat: s.strijd.vijanden().map((v) => [v.vijand, Math.round(v.x), Math.round(v.y)]) }; }, eigen);
console.log('rode katapult:', JSON.stringify(sch));
check('rode katapult doet iets (muur of burcht beschadigd)', sch.o !== 4 || (sch.lev && sch.lev.leven < sch.lev.max) || sch.burcht < 1200, JSON.stringify(sch));
const echt = fouten.filter((f) => !/404/.test(f));
check('geen paginafouten', echt.length === 0, echt.join(' | '));
console.log(`ok ${ok}, fout ${fout}`);
await b.close();
