// Level 9 The Mourngate (versie 0.75.0): verborgen reserve van Valkenier, zieners van het Stille Volk.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8300'], { cwd: '/home/claude/burcht-en-banier', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
const start = async (missie, klaar) => {
  await p.goto('http://localhost:8300/?x=' + Date.now()); await wacht();
  await p.evaluate(([m, k]) => { localStorage.clear(); localStorage.setItem('tipGesloten', '1'); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [missie, klaar]);
  await p.reload(); await wacht();
  await p.waitForFunction(() => document.getElementById('verhaalbeeld').hidden, null, { timeout: 40000 }).catch(() => {});
  if (await p.isVisible('#missie-begin')) await p.click('#missie-begin');
  await p.waitForTimeout(800);
};
await start(9, [1, 2, 3, 4, 5, 6, 7, 8]);
const a = await p.evaluate(() => { const s = window.spel; const res = s.strijd.reserve(); const zieners = s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'ziener');
  return { modus: s.modus, kaart: s.kaart.naam, reserve: res.length, onzichtbaar: res.every((e) => e.onzichtbaar), zieners: zieners.length, landschap: s.landschap && s.landschap.sleutel, z: s.leger.waaromNiet('ziener'), stand: s.reserve.stand() }; });
check('level 9 geladen', a.modus.missie === 9, JSON.stringify(a.modus));
check('landschap sneeuw', a.landschap === 'sneeuw', a.landschap);
check('reserve van 24 man staat klaar', a.reserve === 24, a.reserve);
check('reserve is onzichtbaar', a.onzichtbaar);
check('twee zieners van het Stille Volk', a.zieners === 2, a.zieners);
check('ziener niet zelf op te leiden in level 9', !!a.z, a.z);
// Een ziener naar de reserve: zichtbaar, maar nog niet los
const b1 = await p.evaluate(() => { const s = window.spel; const z = s.leger.soldaten().find((e) => e.soldaat.sleutel === 'ziener'); const pl = s.reserve.stand().plek;
  const r0 = s.kaart.start[1]; const dx = pl.x - r0.x, dy = pl.y - r0.y, L = Math.hypot(dx, dy) || 1; z.x = pl.x + 0.5 + dx / L * 7; z.y = pl.y + 0.5 + dy / L * 7; z.pad = null;
  for (let i = 0; i < 12; i++) { s.strijd.stap(); }

  for (let i = 0; i < 4; i++) s.reserve.stap(0.5);
  const res = s.strijd.reserve(); return { zicht: res.filter((e) => !e.onzichtbaar).length, los: s.reserve.stand().los, ontdekt: s.reserve.stand().ontdekt, aantal: res.length }; });
check('ziener maakt de reserve zichtbaar', b1.zicht > 0 && b1.ontdekt, JSON.stringify(b1));
check('reserve nog niet los door alleen de ziener op 7 tegels', b1.los === false, JSON.stringify(b1));
// Een ridder vlak bij de burcht van rood: de reserve valt aan
const b2 = await p.evaluate(() => { const s = window.spel; const r = s.kaart.start[1]; const z = s.leger.soldaten().find((e) => e.soldaat.sleutel === 'ziener');
  z.x = r.x - 5; z.y = r.y + 3; for (let i = 0; i < 3; i++) s.reserve.stap(0.5);
  return { los: s.reserve.stand().los, wacht: s.strijd.reserve().length }; });
check('naderen van het fort laat de reserve los', b2.los === true && b2.wacht === 0, JSON.stringify(b2));
check('geen scriptfouten', fouten.length === 0, fouten.join('|'));
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
