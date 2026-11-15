// Proloog 0.58: het leger van Ottger verschijnt aan de rand van de kaart, marcheert naar het kasteel,
// wacht buiten de muren; de speler leert zijn leger besturen; dan gaat de poort open.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8243;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 0 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
await p.tap('#missie-begin'); await p.waitForTimeout(1200);
const st = () => p.evaluate(() => window.spel.proloog.stand());
const kaartTik = async () => { await p.waitForSelector('#gids-kaart:not([hidden]) button', { timeout: 8000 }); await p.tap('#gids-kaart button'); await p.waitForTimeout(250); };
await kaartTik();   // eerste kaartje van de dag
await p.evaluate(() => window.spel.proloog.zetFase('nacht'));
await p.waitForTimeout(1500);
const kijk = () => p.evaluate(() => { const s = window.spel; const k = s.kaart; const st = k.start[0];
  const v = s.strijd.stand(); const ver = s.eenheden.lijst.filter((e) => e.team === 1 && e.vijand && e.wachter === undefined);
  const soorten = {}; for (const e of ver) soorten[e.vijand] = (soorten[e.vijand] || 0) + 1;
  const minX = Math.min(...ver.map((e) => e.x)), maxX = Math.max(...ver.map((e) => e.x));
  const binnen = ver.filter((e) => Math.max(Math.abs(e.x - st.x), Math.abs(e.y - st.y)) < 17).length;
  const klaar = s.strijd.opmarsStand();
  return { aantal: ver.length, soorten, minX, maxX, B: k.breedte, stx: st.x, binnen, klaar }; });
const k0 = await kijk();
check('leger van bijna 100', k0.aantal >= 95 && k0.aantal <= 105, JSON.stringify(k0));
check('minstens 12 soorten', Object.keys(k0.soorten).length >= 12, JSON.stringify(k0.soorten));
check('machines erbij (ram, katapult, toren, ladder)', ['ram', 'katapult', 'toren', 'ladder'].every((x) => k0.soorten[x] > 0), JSON.stringify(k0.soorten));
check('aan de oostrand van de kaart', k0.minX > k0.B - 24, JSON.stringify(k0));
check('niemand in het kasteel', k0.binnen === 0, k0.binnen);
check('poort nog dicht (Bartholt-kaartje)', await p.isVisible('#gids-kaart'));
check('les 1 kaartje', /archers/i.test(await p.textContent('#gids-kaart')), await p.textContent('#gids-kaart'));
await kaartTik();
check('gids wijst het zwaard', /sword/i.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
// Het leger marcheert
await p.waitForTimeout(25000);
const k1 = await kijk();
check('ze marcheren naar het westen', k1.minX < k0.minX - 8, JSON.stringify([k0.minX, k1.minX]));
check('nog niemand binnen de muren', k1.binnen === 0, k1.binnen);
// Les 1 met echte tikken
await p.tap('#knop-zwaard'); await p.waitForTimeout(500);
check('gids wijst Archer', /Archer/.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
await p.locator('#leger-groepen button', { hasText: /^Archer/ }).tap(); await p.waitForTimeout(900);
const nS = async () => (await st());
check('les 1 klaar', (await nS()).nKlaar, JSON.stringify(await nS()));
await kaartTik(); await kaartTik();
check('les 2: gouden plek', await p.evaluate(() => !document.getElementById('gids-plek').hidden), '');
const bevel = async () => { await p.waitForTimeout(400); const m = await p.evaluate(() => { const r = document.getElementById('gids-plek'); const c = r.getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2, r.classList.contains('buiten')]; }); return m; };
// de camera springt naar de plek bij "Understood"; sluit het paneel van het leger niet
let m = await bevel();
check('plek in beeld', !m[2], JSON.stringify(m));
await p.touchscreen.tap(m[0], m[1]); await p.waitForTimeout(800);
check('les 2 klaar', (await nS()).nKlaar, JSON.stringify(await nS()));
await kaartTik(); await kaartTik();
console.log('DBG', await p.evaluate(() => ({ g: !document.getElementById('leger-groepen').hidden, btn: [...document.querySelectorAll('#leger-groepen button')].map((b) => b.textContent + ':' + (b.offsetParent ? 'v' : 'h')), zin: document.getElementById('gids-zin').textContent, pan: !!document.querySelector('#legerpaneel:not([hidden])') })));
if (!(await p.isVisible('#leger-groepen button'))) { await p.tap('#knop-zwaard'); await p.waitForTimeout(400); }
await p.locator('#leger-groepen button', { hasText: /^Knight/ }).tap({ timeout: 5000 });
await p.waitForTimeout(900);
check('les 3 klaar', (await nS()).nKlaar, JSON.stringify(await nS()));
await kaartTik(); await kaartTik();
m = await bevel();
await p.touchscreen.tap(m[0], m[1]); await p.waitForTimeout(800);
check('les 4 klaar', (await nS()).nKlaar, JSON.stringify(await nS()));
const voor = await kijk();
check('voor de poort: ze staan buiten (nog niemand binnen)', voor.binnen === 0 && voor.klaar.klaar > 30, JSON.stringify(voor));
await kaartTik();   // Hold
check('storm begonnen', (await nS()).deel === 'storm', JSON.stringify(await nS()));
check('poorten open', await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; return s.wegvinder.verbonden(st.y * s.kaart.breedte + st.x + 40, st.y * s.kaart.breedte + st.x + 3, 1); }));
await p.waitForTimeout(30000);
const na = await kijk();
check('het leger stroomt naar binnen', na.binnen >= 8, JSON.stringify(na));
await p.screenshot({ path: '/tmp/s/p43.png' });
check('geen scriptfouten', fouten.length === 0, fouten.join('|'));
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
