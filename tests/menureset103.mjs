// 0.103.0: een tik op hamer of zwaard begint dat menu altijd bij het begin.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8403;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 4 })); });
await p.reload(); await wacht(); await p.waitForTimeout(500);
await p.tap('#missie-begin').catch(() => {}); await p.waitForTimeout(800);
await p.evaluate(() => window.spel.ui && window.spel.ui.verbergVerhaal && window.spel.ui.verbergVerhaal());
const stand = () => p.evaluate(() => {
  const k = [...document.querySelectorAll('#bouw-knoppen button')];
  const zichtbaar = (x) => !x.hidden && x.offsetParent !== null;
  return {
    open: !document.getElementById('bouw-knoppen').hidden,
    begin: k.filter((x) => x.dataset.open).every(zichtbaar),
    groep: (k.find((x) => x.dataset.groep && zichtbaar(x)) || {}).dataset?.groep || null,
    actief: !!document.querySelector('#bouw-knoppen button.actief'),
  };
});
const klik = (sel) => p.evaluate((s) => document.querySelector(s).click(), sel);
await klik('#knop-hamer'); await p.waitForTimeout(200);
let s = await stand(); check('hamer opent bij het begin', s.open && s.begin, JSON.stringify(s));
await klik('#bouw-knoppen button[data-open="dorp"]'); await p.waitForTimeout(200);
s = await stand(); check('Village open', s.groep === 'dorp', JSON.stringify(s));
await klik('#knop-hamer'); await p.waitForTimeout(200);
s = await stand(); check('hamer in Village: terug naar begin, menu blijft open', s.open && s.begin && !s.groep, JSON.stringify(s));
await klik('#knop-hamer'); await p.waitForTimeout(200);
s = await stand(); check('hamer aan het begin: sluit', !s.open, JSON.stringify(s));
// Bouwwerk gekozen, dan naar het leger en terug
await klik('#knop-hamer'); await klik('#bouw-knoppen button[data-open="kasteel"]'); await p.waitForTimeout(100);
await klik('#bouw-knoppen button[data-sleutel="muur"]'); await p.waitForTimeout(200);
s = await stand(); check('muur gekozen', s.actief && s.groep === 'kasteel', JSON.stringify(s));
await klik('#knop-zwaard'); await p.waitForTimeout(200);
s = await stand(); check('zwaard: bouwen gestopt, bouwbalk dicht', !s.open && !s.actief, JSON.stringify(s));
await klik('#knop-hamer'); await p.waitForTimeout(200);
s = await stand(); check('hamer na leger: bij het begin', s.open && s.begin && !s.groep && !s.actief, JSON.stringify(s));
// Gekozen bouwwerk en tik op de hamer zonder plek: terug naar het begin
await klik('#bouw-knoppen button[data-open="kasteel"]'); await klik('#bouw-knoppen button[data-sleutel="muur"]'); await p.waitForTimeout(200);
await klik('#knop-hamer'); await p.waitForTimeout(200);
s = await stand(); check('hamer met gekozen muur zonder plek: begin', s.open && s.begin && !s.actief, JSON.stringify(s));
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
process.exit(fout || fouten.length ? 1 : 0);
