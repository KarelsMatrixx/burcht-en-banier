// Groei van rood: gebouwen, burgers, wachters, doel; burgers sneuvelen door jouw soldaten (0.55.0).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8244;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
async function start(missie, klaar) {
  await p.goto(`http://localhost:${poort}/`); await wacht();
  await p.evaluate(([m, k]) => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m }));
    sessionStorage.setItem('burcht-banier.geenTitel', '1');
  }, [missie, klaar]);
  await p.reload(); await wacht();
  // Het verhaalbeeld (12 s) en de briefing eerst weg: pas dan loopt het spel
  await p.waitForFunction(() => document.getElementById('verhaalbeeld').hidden, null, { timeout: 20000 }).catch(() => {});
  if (await p.isVisible('#missie-begin')) await p.tap('#missie-begin');
  await p.waitForTimeout(500);
}
const meet = () => p.evaluate(() => { const s = window.spel; const k = s.kaart; let rood = 0; for (let i = 0; i < k.object.length; i++) if (k.eigenaar[i] === 2 && k.object[i] !== 0) rood++;
  const g = s.rood.groei; return { rood, stappen: g.stappen(), burgers: g.burgers().length, extra: s.strijd.aantalExtraWachters(), doel: s.rood.stand().doel, cfg: g.config(), wer: s.rood.stand().werken }; });

// Level 3 en level 9: sterker bij een hoger level
await start(3, [0, 1, 2]);
const a0 = await meet();
await p.evaluate(() => window.spel.rood.groei.zetStappen(6));
await p.waitForTimeout(800);
const a1 = await meet();
console.log('level 3', JSON.stringify(a0), JSON.stringify(a1));
check('begint zonder groei', a0.stappen === 0);
check('na 6 stappen: meer gebouwen van rood (>= +5)', a1.rood >= a0.rood + 5, `${a0.rood} -> ${a1.rood}`);
check('na 6 stappen: burgers lopen rond (>= 3)', a1.burgers >= 3, a1.burgers);
check('doel stijgt', a1.doel > a0.doel, `${a0.doel} -> ${a1.doel}`);
check('werken van rood nemen toe (inkomen)', a1.wer > a0.wer, `${a0.wer} -> ${a1.wer}`);
const pos0 = await p.evaluate(() => window.spel.rood.groei.burgers().map((e) => [e.x, e.y]));
await p.waitForTimeout(10000);
const bew = await p.evaluate((p0) => window.spel.rood.groei.burgers().filter((e, i) => p0[i] && Math.hypot(e.x - p0[i][0], e.y - p0[i][1]) > 0.3).length, pos0);
check('burgers van rood lopen echt (>= 1 onderweg)', bew >= 1, bew);
// wachters: elke 45 s een extra; versnel via de klok
await p.evaluate(() => window.spel.rood.groei.stap(46));
await p.waitForTimeout(500);
const a3 = await meet();
check('extra wachters op de muur', a3.extra >= 1, a3.extra);
await p.screenshot({ path: '/home/claude/groei-a.png' });

// Bewaren en terugzetten
const bewaard = await p.evaluate(() => window.spel.rood.bewaar());
check('groei wordt bewaard', bewaard.g === 6, JSON.stringify(bewaard));

// Opnieuw beginnen haalt het weer weg
await p.evaluate(() => window.spel.rood.herstel());
await p.waitForTimeout(300);
const a4 = await meet();
check('herstel: alles weer weg', a4.stappen === 0 && a4.rood === a0.rood && a4.burgers === 0, JSON.stringify(a4));

// Levels: hoger = sterker
const cfgs = [];
for (const [m, kl] of [[1, [0]], [5, [0, 1, 2, 3, 4]], [6, [0, 1, 2, 3, 4, 5]]]) {
  await start(m, kl);
  cfgs.push(await p.evaluate(() => window.spel.rood.groei.config()));
}
console.log(JSON.stringify(cfgs));
check('level 6 groeit harder dan level 1', cfgs[2].max > cfgs[0].max && cfgs[2].doelPerStap > cfgs[0].doelPerStap && cfgs[2].elke < cfgs[0].elke);
check('level 5 (Stillwater) blijft rustig', cfgs[1].doelPerStap <= 0.2 && cfgs[1].max <= 10);

// Soldaten van jou doden burgers van rood
await start(3, [0, 1, 2]);
await p.evaluate(() => window.spel.rood.groei.zetStappen(6));
await p.waitForTimeout(500);
const dood = await p.evaluate(async () => {
  const s = window.spel; const burgers = s.rood.groei.burgers(); const voor = burgers.length; if (!voor) return 'geen';
  const e0 = burgers[0];
  s.leger.zetStand([['ridder', Math.floor(e0.x), Math.floor(e0.y), 100, 0]]);
  return voor;
});
await p.waitForTimeout(12000);
const na = await p.evaluate(() => ({ b: window.spel.rood.groei.burgers().length, d: window.spel.slachting.doden() }));
check('jouw soldaten doden burgers van rood', dood !== 'geen' && (na.d >= 1 || na.b < dood), JSON.stringify([dood, na]));
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
