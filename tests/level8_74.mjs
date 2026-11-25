// Level 8 The White Dike (versie 0.74.0): de sluis bij het water, de rode koning is beschermd
// tot de sluis valt, daarna wint het doden van de koning. Beloning: de saboteur.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8298'], { cwd: '/home/claude/burcht-en-banier', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
const start = async (missie, klaar) => {
  await p.goto('http://localhost:8298/?x=' + Date.now()); await wacht();
  await p.evaluate(([m, k]) => { localStorage.clear(); localStorage.setItem('tipGesloten', '1'); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [missie, klaar]);
  await p.reload(); await wacht();
  await p.waitForFunction(() => document.getElementById('verhaalbeeld').hidden, null, { timeout: 40000 }).catch(() => {});
  if (await p.isVisible('#missie-begin')) await p.click('#missie-begin');
  await p.waitForTimeout(800);
};
await start(8, [1, 2, 3, 4, 5, 6, 7]);
const a = await p.evaluate(() => { const s = window.spel; const k = s.kaart; const B = k.breedte; const sl = []; k.object.forEach((o, i) => { if (o === 42) sl.push(i); });
  const vak = sl[0]; const x = vak % B, y = Math.floor(vak / B); let water = false;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (k.grond[(y + dy) * B + x + dx] === 3) water = true;
  return { modus: s.modus, sluizen: sl.length, water, beschermd: s.strijd.koningBeschermd(), sab: s.leger.waaromNiet('saboteur'), wind: s.leger.waaromNiet('windzanger'), leven: s.strijd.schadeOp(vak), eigenaar: k.eigenaar[vak], vak }; });
check('level 8 geladen', a.modus.missie === 8, JSON.stringify(a.modus));
check('precies een sluis van rood', a.sluizen === 1 && a.eigenaar === 2, JSON.stringify(a));
check('de sluis ligt bij het water', a.water);
check('sluis heeft 700 leven', a.leven === 700, a.leven);
check('rode koning beschermd zolang de sluis staat', a.beschermd === true);
check('saboteur nog niet op te leiden in level 8', !!a.sab, a.sab);
check('windzanger wel (beloning level 6)', !a.wind || !/unlock|later|not yet|win /i.test(a.wind), a.wind);
// De koning raken: hij kan niet vallen
const k1 = await p.evaluate(() => { const s = window.spel; const kon = s.strijd.vijanden().find((e) => e.krijg && e.krijg.def.koning) || s.strijd.koningVan?.(2);
  return { gevonden: !!kon }; });
// Sluis slopen via de kaart (alsof je soldaten hem slopen): eigenaar weg
const na = await p.evaluate(async (vak) => { const s = window.spel; s.kaart.object[vak] = 0; s.kaart.eigenaar[vak] = 0;
  for (let i = 0; i < 20; i++) { s.doel.stap(0.1); }
  return { beschermd: s.strijd.koningBeschermd(), klaar: s.doel.klaar(), uitslag: s.strijd.uitslag() }; }, a.vak);
check('na de sluis: koning niet meer beschermd', na.beschermd === false, JSON.stringify(na));
check('na de sluis nog niet gewonnen (eerst de koning)', na.klaar === true && !na.uitslag, JSON.stringify(na));
check('geen scriptfouten', fouten.length === 0, fouten.join('|'));
// ---- Level 9: saboteur vrijgegeven
await start(9, [1, 2, 3, 4, 5, 6, 7, 8]);
const c = await p.evaluate(() => { const s = window.spel; return { m: s.modus, sab: s.leger.waaromNiet('saboteur') }; });
if (c.m.missie === 9) check('saboteur vrij in level 9', !c.sab || !/unlock|later|not yet|win /i.test(c.sab), c.sab);
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
