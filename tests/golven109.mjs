// 0.109.0: White Dike: tien golven met drakenschepen, Rutger de Gekke als held.
// node tests/golven109.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const POORT = 8317;
const srv = spawn('python3', ['-m', 'http.server', String(POORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let goed = 0, fout = 0;
const check = (naam, ok, extra = '') => { console.log(`${ok ? 'GOED' : 'FOUT'} ${naam} ${extra}`); ok ? goed++ : fout++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' })).newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(e.message));
const zichtbaar = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !!(e.offsetWidth || e.offsetHeight) && !e.closest('[hidden]'); }, sel);
async function startLevel(n, klaar) {
  await p.goto(`http://localhost:${POORT}/`);
  await p.waitForFunction(() => window.spel);
  await p.evaluate(([m, k]) => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [n, klaar]);
  await p.reload();
  await p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
  await p.waitForFunction(() => { const v = document.getElementById('verhaalbeeld-verder'); return document.getElementById('verhaalbeeld').hidden || (v && !v.hidden); }, null, { timeout: 20000 });
  if (await zichtbaar('#verhaalbeeld-verder')) await p.click('#verhaalbeeld-verder');
  await p.waitForTimeout(500);
  if (await zichtbaar('#missie-begin')) await p.click('#missie-begin');
  await p.waitForTimeout(800);
  await p.evaluate(() => window.spel.heldenLes && window.spel.heldenLes.sla());   // heldenles (0.125.0) overslaan
}

await startLevel(8, [0, 1, 2, 3, 4, 5, 6, 7]);
await p.evaluate(() => { if (window.spel.havenLes) window.spel.havenLes.sla(); if (window.spel.visLes) window.spel.visLes.sla(); window.spel.ui.verbergVerhaal(); });
const begin = await p.evaluate(() => {
  const { doel, strijd } = window.spel;
  const thuis = doel.rutgerThuis();
  return { soort: window.spel.missies.campagne.find((c) => c.id === 8).doel.soort, landingen: doel.landingen().length, thuis: !!thuis && thuis.onsterfelijk && thuis.vijand === 'rutger', koning: !!strijd.roodKoning(), uitslag: strijd.uitslag(), omschrijving: doel.omschrijving() };
});
check('golven-doel en landingsplekken', begin.soort === 'golven' && begin.landingen >= 2, JSON.stringify(begin));
check('Rutger staat in zijn dorp, onsterfelijk', begin.thuis);
check('geen rode koning, geen meteen-winst', !begin.koning && !begin.uitslag);
await p.waitForTimeout(2000);
check('na 2 s nog geen uitslag', !(await p.evaluate(() => window.spel.strijd.uitslag())));
// Golf 1
const g1 = await p.evaluate(() => {
  const { doel, strijd } = window.spel;
  const voor = strijd.vijanden().length;
  doel.zetTijd(180);
  doel.stap(0.6);
  const st = doel.stand();
  return { voor, golven: st.golven, schepen: doel.schepen().length };
});
check('golf 1 vaart uit met schepen', g1.golven === 1 && g1.schepen >= 1, JSON.stringify(g1));
await p.evaluate(() => { const c = window.spel.camera; const l = window.spel.doel.landingen()[0]; c.kijkNaar((l.x - l.y) * 32, (l.x + l.y) * 16); c.zoom = 0.7; window.spel.doel.stap(20); });
await p.waitForTimeout(400);
await p.screenshot({ path: '/home/claude/werk/g-schepen.png' });
const g1b = await p.evaluate(() => { const { doel, strijd } = window.spel; for (let i = 0; i < 60; i++) doel.stap(0.5); return { geland: doel.stand().geland, vijanden: strijd.vijanden().length }; });
check('golf 1 geland, mannen aan land', g1b.geland === 1 && g1b.vijanden >= g1.voor + 8, JSON.stringify(g1b));
await p.waitForTimeout(1500);
await p.screenshot({ path: '/home/claude/werk/g-land.png' });
// 0.120.2: de klok naar de volgende golf wacht tot de laatste man van de golf dood is
const wacht = await p.evaluate(() => {
  const { doel } = window.spel;
  const a = doel.volgende();
  for (let i = 0; i < 100; i++) doel.stap(0.5);
  return { a, b: doel.volgende(), bezig: doel.stand().golfBezig, over: doel.mannenOver() };
});
check('klok wacht zolang er mannen van de golf leven', wacht.bezig && wacht.over > 0 && wacht.b === wacht.a, JSON.stringify(wacht));
const dood = await p.evaluate(() => {
  const { doel, strijd, eenheden } = window.spel;
  for (const e of strijd.vijanden()) { e.leven = 0; e.dood = true; }
  for (let i = 0; i < 6; i++) { eenheden.stap(0.1); strijd.stap(); doel.stap(0.6); }
  const a = doel.volgende();
  for (let i = 0; i < 20; i++) doel.stap(0.5);
  return { bezig: doel.stand().golfBezig, a, b: doel.volgende() };
});
check('klok telt weer na de laatste dode man', !dood.bezig && dood.b < dood.a, JSON.stringify(dood));
// 0.124.3: een vastzittende laatste man houdt de golf niet eeuwig open
const vast = await p.evaluate(() => {
  const { doel, strijd } = window.spel;
  doel.zetTijd(180 + 110 + 1); doel.stap(0.6);
  for (let i = 0; i < 160; i++) doel.stap(0.5);   // schepen leggen aan
  const lijst = doel.golfMannen().filter((e) => !e.dood);
  for (const e of lijst.slice(1)) { e.leven = 0; e.dood = true; }
  lijst[0].snelheid = 0;
  const voor = doel.mannenOver();
  for (let i = 0; i < 40; i++) doel.stap(0.5);
  const na20 = doel.mannenOver();
  for (let i = 0; i < 160; i++) doel.stap(0.5);
  return { voor, na20, na: doel.mannenOver(), bezig: doel.stand().golfBezig };
});
check('laatste man blijft eerst staan, geeft na 60 s op', vast.voor === 1 && vast.na20 === 1 && vast.na === 0 && !vast.bezig, JSON.stringify(vast));
// Snel naar golf 10
const g10 = await p.evaluate(() => {
  const { doel } = window.spel;
  for (let k = 0; k < 9; k++) { doel.zetTijd(180 + (k + 1) * 110); doel.stap(0.6); }
  const st = doel.stand();
  const thuis = doel.rutgerThuis();
  for (let i = 0; i < 120; i++) doel.stap(0.5);
  const r = doel.rutger();
  return { golven: st.golven, thuisWeg: !thuis, rutger: !!r, leven: r && r.leven, onst: r && r.onsterfelijk, geland: doel.stand().rutgerGeland };
});
check('tien golven verstuurd', g10.golven === 10, JSON.stringify(g10));
check('Rutger is meegevaren en aan land', g10.thuisWeg && g10.rutger && g10.geland && g10.onst && g10.leven === 3000);
// Dertig ridders tegen Rutger
const gevecht = await p.evaluate(() => {
  const { doel, leger, kaart, strijd } = window.spel;
  for (const e of strijd.vijanden()) if (e.vijand !== 'rutger') e.dood = true;
  const r = doel.rutger();
  const vak = Math.floor(r.y) * kaart.breedte + Math.floor(r.x);
  let n = 0;
  for (let i = 0; i < 30; i++) if (leger.geef('ridder', vak, 6)) n++;
  return n;
});
await p.waitForTimeout(25000);
const naGevecht = await p.evaluate(() => { const { doel, leger } = window.spel; const r = doel.rutger(); return { leven: r ? Math.round(r.leven) : -1, ridders: leger.soldaten().filter((e) => e.soldaat.sleutel === 'ridder' && !e.dood).length }; });
check('Rutger houdt stand tegen 30 ridders (25 s)', naGevecht.leven > 1 && naGevecht.ridders < gevecht, JSON.stringify({ gevecht, ...naGevecht }));
// Verslaan: hij sterft niet, het level is gewonnen
await p.evaluate(() => { const r = window.spel.doel.rutger(); r.leven = 3; const { leger, kaart } = window.spel; const vak = Math.floor(r.y) * kaart.breedte + Math.floor(r.x); for (let i = 0; i < 10; i++) leger.geef('ridder', vak, 4); });
await p.waitForTimeout(4000);
const vs = await p.evaluate(() => { const r = window.spel.doel.rutger(); return { verslagen: r && r.verslagen, dood: r ? r.dood : 'weg', leven: r && r.leven }; });
check('Rutger verslagen, niet dood', vs.verslagen && !vs.dood && vs.leven === 1, JSON.stringify(vs));
await p.waitForTimeout(8000);
check('level gewonnen', (await p.evaluate(() => window.spel.strijd.uitslag())) === 'gewonnen');
await p.screenshot({ path: '/home/claude/werk/g-winst.png' });
check('geen fouten in level 8', fouten.length === 0, fouten.join(' | '));

// Level 9: Rutger als held
fouten.length = 0;
await startLevel(9, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
const held = await p.evaluate(() => { const r = window.spel.leger.soldaten().find((e) => e.soldaat.sleutel === 'rutger'); return r ? { leven: r.leven, team: r.team } : null; });
check('level 9: Rutger vecht voor jou', held && held.leven === 3000, JSON.stringify(held));
await p.evaluate(() => { const r = window.spel.leger.soldaten().find((e) => e.soldaat.sleutel === 'rutger'); const c = window.spel.camera; c.kijkNaar((r.x - r.y) * 32, (r.x + r.y) * 16); c.zoom = 2.2; });
await p.waitForTimeout(800);
await p.screenshot({ path: '/home/claude/werk/g-held.png' });
check('geen fouten in level 9', fouten.length === 0, fouten.join(' | '));
console.log(`\n${goed} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
