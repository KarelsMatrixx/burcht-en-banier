// Level 4 The Fen: de hut van Gesina houden (doeltype B, js/doel.js).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8238;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 4 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(300);
check('level 4 gekozen', (await p.evaluate(() => window.spel.modus.missie)) === 4);
check('kaart The Fen', (await p.evaluate(() => window.spel.kaart.naam)) === 'The Fen');
check('briefing door Gesina', /gesina/.test(await p.getAttribute('#missie img', 'src').catch(() => '')) || /Gesina/.test(await p.textContent('#missie')));
await p.tap('#missie-begin'); await p.waitForTimeout(1200);
const hut = await p.evaluate(() => window.spel.strijd.hut());
check('hut staat', hut && hut.staat && hut.max === 900, JSON.stringify(hut));
const hx = hut.vak % 68, hy = Math.floor(hut.vak / 68);
check('hut ongeveer in het midden', Math.abs(hx - 34) < 12 && Math.abs(hy - 34) < 12, `${hx},${hy}`);
check('hut niet te slopen', (await p.evaluate(([x, y]) => window.spel.bouwer.sloop(x, y), [hx, hy])) === false);
check('taak met klok', /Hold Gesina's hut: \d:\d\d left/.test(await p.textContent('#taak')), await p.textContent('#taak'));
check('Gesina praat', /Silent Folk/.test(await p.evaluate(() => window.spel.ui.logboek().map((r) => r.tekst).join(' '))));
check('geen gewone aanvallen van rood', (await p.evaluate(() => window.spel.regels.heer.eersteAanval)) >= 9999);
// Eerste golf
await p.evaluate(() => window.spel.doel.zetTijd(149));
await p.waitForFunction(() => window.spel.doel.stand().golven >= 1, null, { timeout: 5000 }).catch(() => {});
const n = await p.evaluate(() => window.spel.strijd.vijanden().length);
check('eerste golf (3)', n >= 3, n);
check('melding golf', /hunters are coming/.test(await p.evaluate(() => window.spel.ui.logboek().map((r) => r.tekst).join(' '))));
// Ze gaan op de hut af en slaan hem
await p.waitForFunction(() => { const h = window.spel.strijd.hut(); return h && h.leven < h.max; }, null, { timeout: 90000 }).catch(() => {});
const h2 = await p.evaluate(() => window.spel.strijd.hut());
check('hut onder vuur', h2.leven < h2.max, JSON.stringify(h2));
await p.evaluate(([x, y]) => { const s = window.spel; const { rasterNaarWereld } = window; }, [hx, hy]);
await p.evaluate(async ([x, y]) => { const iso = await import('/js/iso.js'); const s = window.spel; const w = iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = w.x; s.camera.y = w.y; }, [hx, hy]);
await p.waitForTimeout(400);
await p.screenshot({ path: '/home/claude/hut36.png' });
// Hut valt: verloren
await p.evaluate(([x, y]) => window.spel.bouwer.verwoest(x, y), [hx, hy]);
await p.waitForFunction(() => window.spel.strijd.uitslag() === 'verloren', null, { timeout: 5000 }).catch(() => {});
check('hut weg: verloren', (await p.evaluate(() => window.spel.strijd.uitslag())) === 'verloren');
check('eindtekst over de hut', /Gesina's hut/.test(await p.textContent('#einde-tekst')), await p.textContent('#einde-tekst'));
// Opnieuw: hut terug, klok terug
await p.tap('#einde-opnieuw'); await p.waitForTimeout(800);
const h3 = await p.evaluate(() => window.spel.strijd.hut());
check('opnieuw: hut terug', h3.staat && h3.leven === h3.max && h3.vak === hut.vak, JSON.stringify(h3));
check('opnieuw: geen uitslag', (await p.evaluate(() => window.spel.strijd.uitslag())) === null);
check('opnieuw: klok terug', (await p.evaluate(() => window.spel.doel.stand().tijd)) < 5);
// Tijd om: gewonnen
await p.evaluate(() => window.spel.doel.zetTijd(479));
await p.waitForFunction(() => window.spel.strijd.uitslag() === 'gewonnen', null, { timeout: 6000 }).catch(() => {});
check('tijd om: gewonnen', (await p.evaluate(() => window.spel.strijd.uitslag())) === 'gewonnen');
check('overwinning bij The Fen', /The Fen/.test(await p.textContent('#einde-titel')), await p.textContent('#einde-titel'));
check('Gesina zegt het', /grieving/.test(await p.textContent('#einde-tekst')));
check('level 4 gewonnen', (await p.evaluate(() => JSON.parse(localStorage.getItem('burcht-banier.campagne')).klaar)).includes(4));
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
