// Proloog 0.52: levendige kaart (kerk, dorpen, rondlopende figuren), gids stap voor stap, 80 vijanden.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8240;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 0 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(300);
await p.tap('#missie-begin');
await p.waitForTimeout(1500);
// Kaart
const kaartInfo = await p.evaluate(() => { const k = window.spel.kaart; let kerk = 0, huizen = 0, aarde = 0; for (let i = 0; i < k.object.length; i++) { if (k.object[i] === 32) kerk++; if (k.object[i] === 11 || k.object[i] === 12) huizen++; } return { kerk, huizen }; });
check('kerk staat er', kaartInfo.kerk >= 1, kaartInfo.kerk);
check('veel huizen (>= 60)', kaartInfo.huizen >= 60, kaartInfo.huizen);
// Bouwruimte: rond de burcht (afstand 5 tot 13) genoeg lege vrije tegels
const ruimte = await p.evaluate(() => { const s = window.spel; const k = s.kaart; const st = k.start[0]; let n = 0; for (let dy = -13; dy <= 13; dy++) for (let dx = -13; dx <= 13; dx++) { const r = Math.max(Math.abs(dx), Math.abs(dy)); if (r < 5) continue; const x = st.x + dx, y = st.y + dy; if (k.object[y * k.breedte + x] === 0 && s.wegvinder.isVrij(x, y, 0)) n++; } return n; });
check('genoeg bouwruimte (>= 150)', ruimte >= 150, ruimte);
// Vier ringen
const ringen = await p.evaluate(() => { const k = window.spel.kaart; let poorten = 0, muur = 0; for (let i = 0; i < k.object.length; i++) { if (k.object[i] === 6 && k.eigenaar[i] === 1) poorten++; } return { poorten }; });
check('acht poorten (vier ringen, oost en west)', ringen.poorten === 8, ringen.poorten);
const wachters = await p.evaluate(() => window.spel.leger.soldaten().filter((e) => e.opMuur).length);
check('wachters op de muren (>= 10)', wachters >= 10, wachters);
// Karel en de gast lopen rond
const k0 = await p.evaluate(() => { const e = window.spel.leger.soldaten().find((e) => e.soldaat.sleutel === 'koning'); const g = window.spel.eenheden.lijst.find((e) => e.gast); return [e.x, e.y, g.x, g.y]; });
let weg = 0, vorig = [k0[2], k0[3]];
for (let r = 0; r < 7; r++) { await p.waitForTimeout(3000); const g = await p.evaluate(() => { const g = window.spel.eenheden.lijst.find((e) => e.gast); return [g.x, g.y]; }); weg += Math.hypot(g[0] - vorig[0], g[1] - vorig[1]); vorig = g; }
const k1 = await p.evaluate(() => { const e = window.spel.leger.soldaten().find((e) => e.soldaat.sleutel === 'koning'); const g = window.spel.eenheden.lijst.find((e) => e.gast); return [e.x, e.y, g.x, g.y]; });
check('Karel loopt rond', Math.hypot(k1[0] - k0[0], k1[1] - k0[1]) > 0.5, JSON.stringify([k0, k1]));
check('de gast loopt rond (afgelegde weg in 21 s)', weg > 0.8, weg);
// Figuren
await p.waitForTimeout(500);
const f0 = await p.evaluate(() => window.spel.figuranten.lijst().map((e) => [e.soort, +e.x.toFixed(1), +e.y.toFixed(1)]));
check('figuranten: 100 of meer', f0.length >= 100, f0.length);
check('priester, Wessel en Bartholt erbij', [25, 24, 23].every((s) => f0.some((f) => f[0] === s)), JSON.stringify(f0.map((f) => f[0])));
await p.waitForTimeout(6000);
const f1 = await p.evaluate(() => window.spel.figuranten.lijst().map((e) => [e.soort, +e.x.toFixed(1), +e.y.toFixed(1), e.loopt]));
const bewogen = f1.filter((f, i) => Math.hypot(f[1] - f0[i][1], f[2] - f0[i][2]) > 0.3).length;
check('ze lopen rond (>= 20 bewogen)', bewogen >= 20, bewogen);
const wes = await p.evaluate(() => { const st = window.spel.kaart.start[0]; return window.spel.figuranten.lijst().filter((e) => e.soort === 24 || e.soort === 23).map((e) => Math.hypot(e.x - st.x, e.y - st.y)); });
check('Wessel en Bartholt blijven bij de burcht', wes.every((d) => d < 14), JSON.stringify(wes));
// Gids
check('gids: kaartje wacht', await p.isVisible('#gids-kaart'));
await p.tap('#gids-kaart button'); await p.waitForTimeout(400);
check('ring om hamer', await p.isVisible('#gids-ring') && /hammer/.test(await p.textContent('#gids-zin')));
await p.tap('#knop-hamer'); await p.waitForTimeout(600);
let zin = await p.textContent('#gids-zin');
check('na hamer: wijst naar groep of hut', /Open|Tap/.test(zin) && await p.isVisible('#gids-ring'), zin);
// Volg de gids totdat een bouwknop wordt aangewezen
for (let i = 0; i < 4; i++) {
  const doel = await p.evaluate(() => { const r = document.getElementById('gids-ring').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  const zinNu = await p.textContent('#gids-zin');
  if (/Hut|Wood|hut/i.test(zinNu) && !/Open/.test(zinNu)) break;
  await p.touchscreen.tap(doel[0], doel[1]); await p.waitForTimeout(500);
}
zin = await p.textContent('#gids-zin');
check('gids bij de houthakker', /ground|Wood|hut/i.test(zin), zin);
// Idle: 21 s niets doen geeft een luide ring
await p.waitForTimeout(21500);
check('na 20 s: ring klopt harder', await p.evaluate(() => document.getElementById('gids-ring').classList.contains('luid')));
// Avond: ze lopen nog rond; aanval: ze rennen het kasteel in
await p.evaluate(() => window.spel.proloog.zetFase('avond'));
await p.waitForTimeout(800);
check('avond: geen ring, wel het avondkaartje', !(await p.isVisible('#gids-ring')) && /feast is over/.test(await p.textContent('#gids-kaart')));
await p.tap('#gids-kaart button'); await p.waitForTimeout(300);
check('avond: figuranten er nog', (await p.evaluate(() => window.spel.figuranten.aantal())) >= 100);
await p.evaluate(() => window.spel.proloog.zetFase('nacht'));
await p.waitForTimeout(500);
await p.tap('#gids-kaart button');   // 0.73: zolang het nachtkaartje open is, staat alles stil
await p.waitForTimeout(6000);
const dicht = await p.evaluate(() => { const st = window.spel.kaart.start[0]; const l = window.spel.figuranten.lijst(); return l.filter((e) => e.pad && e.snelheid > 1.5).length; });
const rest = await p.evaluate(() => window.spel.figuranten.aantal());
check('nacht: figuranten vluchten (rennen of al binnen)', dicht >= 40 || rest < 100, dicht + ' van ' + rest);
await p.waitForTimeout(1500);
check('nacht: bijna 80 vijanden', (await p.evaluate(() => window.spel.strijd.vijanden().length)) >= 60);
// Prestaties in de nacht met 80 vijanden
await p.waitForTimeout(70000);
check('na de vlucht: allemaal binnen (weg)', (await p.evaluate(() => window.spel.figuranten.aantal())) === 0);
const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 3000) res(n / 3); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
console.log('fps in de nacht (headless, ruw):', fps.toFixed(1));
check('fps in de nacht >= 12', fps >= 12, fps);
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
