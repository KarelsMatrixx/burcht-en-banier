// Level 7 Greyford (versie 0.73.0): speelbaar, drie poorten, rood heeft zwaardvechters en
// later windzangers; de windzanger is de beloning van level 6 (vanaf level 7 op te leiden in de Mystic Lodge)
// en blaast een rode wachter van zijn muur.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8297'], { cwd: '/home/claude/burcht-en-banier', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
const start = async (missie, klaar) => {
  await p.goto('http://localhost:8297/?x=' + Date.now()); await wacht();
  await p.evaluate(([m, k]) => { localStorage.clear(); localStorage.setItem('tipGesloten', '1'); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [missie, klaar]);
  await p.reload(); await wacht();
  await p.waitForFunction(() => document.getElementById('verhaalbeeld').hidden, null, { timeout: 40000 }).catch(() => {});
  if (await p.isVisible('#missie-begin')) await p.click('#missie-begin');
  await p.waitForTimeout(500);
};
// ---- Level 7
await start(7, [1, 2, 3, 4, 5, 6]);
const a = await p.evaluate(() => { const s = window.spel; const tel = {}; for (const o of s.kaart.object) tel[o] = (tel[o] || 0) + 1;
  return { modus: s.modus, poorten: tel[6] || 0, landschap: s.landschap && s.landschap.sleutel, wind: s.leger.waaromNiet('windzanger'), wachters: s.strijd.wachters().length }; });
check('level 7 geladen', a.modus.soort === 'campagne' && a.modus.missie === 7, JSON.stringify(a.modus));
check('drie poorten van rood (en jouw poort)', a.poorten >= 3, a.poorten);
check('landschap kloof', a.landschap === 'berg', a.landschap);
check('windzanger is in level 7 beschikbaar (geen unlock-reden)', !a.wind || !/unlock|later|not yet|win /i.test(a.wind), a.wind);
check('rood heeft wachters op de muren', a.wachters >= 6, a.wachters);
// ---- Vrij spel (alles vrij, gewone ringmuur zonder gracht): leid een windzanger op en zet hem bij een rode wachter
await p.goto('http://localhost:8297/?x=' + Date.now()); await wacht();
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('tipGesloten', '1'); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'vrij', profiel: 'normaal' })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht();
if (await p.isVisible('#missie-begin')) await p.click('#missie-begin');
await p.waitForTimeout(500);
const plek = await p.evaluate(() => { const s = window.spel; const k = s.kaart; const st = k.start[0];
  for (let r = 4; r < 20; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const x = st.x + dx, y = st.y + dy; let goed = true;
    for (let a = -1; a <= 2; a++) for (let c = -1; c <= 2; c++) { const i = (y + c) * k.breedte + x + a; if (k.object[i] !== 0 || k.grond[i] === 3) goed = false; } if (goed) return [x, y]; } return null; });
check('vrije plek gevonden', !!plek);
const r = await p.evaluate(([x, y]) => { const s = window.spel; const v = s.economie.voorraad; v.planken = 100; v.steen = 100; v.goud = 500; v.koper = 40; v.brood = 100;
  s.economie.zetStand({ volk: 30 });
  s.bouwer.plaats(s.bouwwerken.magiertoren, [{ x, y }]);
  const uit = s.leger.leidOp('windzanger', y * s.kaart.breedte + x);
  const w = s.leger.soldaten().find((e) => e.soldaat.sleutel === 'windzanger');
  return { uit, er: !!w }; }, plek);
check('windzanger op te leiden (vrij spel)', r.uit === '' && r.er, JSON.stringify(r));
const duw = await p.evaluate(async () => { const s = window.spel; const w = s.leger.soldaten().find((e) => e.soldaat.sleutel === 'windzanger');
  const doel = s.strijd.wachters().find((e) => e.opMuur && !e.dood);
  if (!doel) return { geen: true };
  // naast de muur zetten, op de grond buiten
  w.x = doel.x - 3.5; w.y = doel.y + 0.2; w.pad = null;
  for (let i = 0; i < 120 && doel.opMuur && !doel.dood; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); }
  return { opMuur: doel.opMuur, dood: doel.dood, hoogte: doel.hoogte, wachter: doel.wachter }; });
check('rode wachter van de muur geblazen', duw.geen === undefined && (duw.opMuur === false || duw.dood), JSON.stringify(duw));
check('geen scriptfouten', fouten.length === 0, fouten.join('|'));
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
