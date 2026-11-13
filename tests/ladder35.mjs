// Een ladder tegen de muur van rood zetten, in campagne level 1 (Reinout), met tikken.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8236;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
for (const lv of [1, 2]) {
  await p.evaluate((lv) => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2] }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: lv }));
    sessionStorage.setItem('burcht-banier.geenTitel', '1');
  }, lv);
  await p.reload(); await wacht(); await p.waitForTimeout(300);
  await p.tap('#missie-begin');
  const m = await p.evaluate(async () => {
    window.__iso = await import('/js/iso.js');
    const s = window.spel; const m = s.kaart.start[1];
    s.leger.zetStand([['ladder', m.x - 9, m.y + 2, 9999, 0], ['ridder', m.x - 9, m.y + 3, 9999, 0]]);
    setInterval(() => { for (const v of s.strijd.vijanden()) if (!v.koning) v.dood = true; for (const e of s.leger.soldaten()) e.leven = e.levenMax; }, 100);
    return { x: m.x, y: m.y };
  });
  const naarTegel = (x, y) => p.evaluate(([x, y]) => { const s = window.spel; const w = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.zetZoom(1); return s.camera.wereldNaarScherm(w.x, w.y); }, [x, y]);
  // ladderdrager kiezen door hem aan te tikken
  const l = await p.evaluate(() => { const e = window.spel.leger.soldaten().find((e) => e.soldaat.sleutel === 'ladder'); return { x: e.x, y: e.y }; });
  let sp = await naarTegel(Math.floor(l.x), Math.floor(l.y)); await p.touchscreen.tap(sp.x, sp.y - 6);
  check(`level ${lv}: ladderdrager gekozen`, (await p.evaluate(() => window.spel.leger.aantalGekozen())) >= 1, await p.evaluate(() => window.spel.leger.aantalGekozen()));
  // muur van rood aantikken (voorste muur, naast de poort)
  sp = await naarTegel(m.x - 5, m.y + 2); await p.touchscreen.tap(sp.x, sp.y);
  await p.waitForFunction(() => window.spel.strijd.ladders().some((l) => l.team === 0), null, { timeout: 40000 }).catch(() => {});
  const lad = await p.evaluate(() => window.spel.strijd.ladders().filter((l) => l.team === 0).length);
  const log = await p.evaluate(() => window.spel.ui.logboek().slice(-3).map((r) => r.tekst).join(' | '));
  if (lv === 1) check('level 1: ladder staat tegen de muur', lad > 0, log);
  else check('level 2: muren te hoog, met melding', lad === 0 && /too high/.test(log), log);
}
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
