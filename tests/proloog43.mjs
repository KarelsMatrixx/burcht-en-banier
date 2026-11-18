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
const kaartTik = async () => { await p.waitForSelector('#gids-kaart:not([hidden]) button', { timeout: 8000 }); const voor = await p.textContent('#gids-kaart'); await p.tap('#gids-kaart button'); await p.waitForFunction((v) => { const k = document.getElementById('gids-kaart'); return k.hidden || k.textContent !== v; }, voor, { timeout: 4000 }).catch(() => {}); await p.waitForTimeout(250); };
await kaartTik();   // eerste kaartje van de dag
await p.evaluate(() => { const s = window.spel; s.leger.kies([s.leger.soldaten()[0]]); });
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
check('leger van ongeveer 150', k0.aantal >= 140 && k0.aantal <= 160, JSON.stringify(k0));
check('minstens 12 soorten', Object.keys(k0.soorten).length >= 12, JSON.stringify(k0.soorten));
check('machines erbij (ram, katapult, toren, ladder)', ['ram', 'katapult', 'toren', 'ladder'].every((x) => k0.soorten[x] > 0), JSON.stringify(k0.soorten));
check('aan de oostrand van de kaart', k0.minX > k0.B - 24, JSON.stringify(k0));
check('niemand in het kasteel', k0.binnen === 0, k0.binnen);
check('poort nog dicht (Bartholt-kaartje)', await p.isVisible('#gids-kaart'));
check('nacht begint zonder gekozen soldaat', await p.evaluate(() => window.spel.leger.aantalGekozen() === 0));
check('les 1 kaartje', /archers/i.test(await p.textContent('#gids-kaart')), await p.textContent('#gids-kaart'));
await kaartTik();
check('gids wijst het zwaard of de groep', /sword|Archer/i.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
// Het leger marcheert
await p.waitForTimeout(25000);
const k1 = await kijk();
check('ze marcheren naar het westen', k1.minX < k0.minX - 8, JSON.stringify([k0.minX, k1.minX]));
check('nog niemand binnen de muren', k1.binnen === 0, k1.binnen);
// Les 1 met echte tikken
if (!(await p.isVisible('#leger-groepen button'))) await p.tap('#knop-zwaard'); await p.waitForTimeout(500);
check('gids wijst Archer', /Archer/.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
await p.locator('#leger-groepen button', { hasText: /^Archer/ }).tap(); await p.waitForTimeout(900);
const nS = async () => (await st());
check('les 1 klaar', (await nS()).nKlaar, JSON.stringify(await nS()));
await kaartTik(); await kaartTik();
check('les 2: gouden plek', await p.evaluate(() => !document.getElementById('gids-plek').hidden), '');
const bevel = async () => { await p.waitForTimeout(400); const m = await p.evaluate(() => { const r = document.getElementById('gids-plek'); const c = r.getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2, r.classList.contains('buiten')]; }); return m; };
// de camera springt naar de plek bij "Understood"; sluit het paneel van het leger niet
await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; s.leger.stuur(st.x - 13, st.y, true); });
await p.waitForTimeout(1200);
check('les 2: bevel naar een andere muur telt niet', !(await nS()).nKlaar, JSON.stringify(await nS()));
await p.evaluate(() => { const s = window.spel; s.leger.kiesSoort('boogschutter'); });
let m = await bevel();
check('plek in beeld', !m[2], JSON.stringify(m));
await p.touchscreen.tap(m[0], m[1]); await p.waitForTimeout(800);
await p.waitForFunction(() => window.spel.proloog.stand().nKlaar, null, { timeout: 60000 }).catch(() => {});   // 0.76.4: klaar als ze er staan
check('les 2 klaar', (await nS()).nKlaar, JSON.stringify(await nS()));
await kaartTik(); await kaartTik();
console.log('DBG', await p.evaluate(() => ({ g: !document.getElementById('leger-groepen').hidden, btn: [...document.querySelectorAll('#leger-groepen button')].map((b) => b.textContent + ':' + (b.offsetParent ? 'v' : 'h')), zin: document.getElementById('gids-zin').textContent, pan: !!document.querySelector('#legerpaneel:not([hidden])') })));
if (!(await p.isVisible('#leger-groepen button'))) { await p.tap('#knop-zwaard'); await p.waitForTimeout(400); }
await p.locator('#leger-groepen button', { hasText: /^Knight/ }).tap({ timeout: 5000 }).catch(async () => { console.log('RETRY', await p.evaluate(() => { const b = [...document.querySelectorAll('#leger-groepen button')].find((x) => /^Knight/.test(x.textContent)); const r = b && b.getBoundingClientRect(); const o = r && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return JSON.stringify({ r: r && [r.left, r.top, r.width, r.height], over: o && (o.id || o.className || o.tagName), kaart: !document.getElementById('gids-kaart').hidden }); })); await p.tap('#knop-zwaard'); await p.waitForTimeout(500); await p.locator('#leger-groepen button', { hasText: /^Knight/ }).tap({ timeout: 5000 }); });
await p.waitForTimeout(900);
check('les 3 klaar', (await nS()).nKlaar, JSON.stringify(await nS()));
await kaartTik(); await kaartTik();
m = await bevel();
await p.touchscreen.tap(m[0], m[1]); await p.waitForTimeout(800);
await p.waitForFunction(() => window.spel.proloog.stand().nKlaar, null, { timeout: 60000 }).catch(() => {});   // 0.76.4: klaar als ze er staan
check('les 4 klaar', (await nS()).nKlaar, JSON.stringify(await nS()));
check('na de laatste stuurles: niemand gekozen, geen hint', await p.evaluate(() => window.spel.leger.aantalGekozen() === 0 && document.getElementById('legerhint').hidden));
const voor = await kijk();
check('voor de poort: ze staan buiten (nog niemand binnen)', voor.binnen === 0 && voor.klaar.klaar > 30, JSON.stringify(voor));
await kaartTik(); await kaartTik();   // Good, dan het kaartje van les 5
// Les 5: de buitenste poorten dicht (geen soldaten gekozen, poort aantikken)
const poortTik = async () => {
  await p.waitForTimeout(400);
  let r = await p.evaluate(() => { const g = document.getElementById('gids-plek'); const c = g.getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2, g.hidden, g.classList.contains('buiten')]; });
  if (r[3]) {
    await p.evaluate(() => { const s = window.spel; const t = s.CONFIG.tegel; const pl = s.gids.doel().plek; s.camera.kijkNaar((pl.x - pl.y) * t.breedte / 2, (pl.x + pl.y + 1) * t.hoogte / 2); });
    await p.waitForTimeout(500);
    r = await p.evaluate(() => { const g = document.getElementById('gids-plek'); const c = g.getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2, g.hidden, g.classList.contains('buiten')]; });
  }
  await p.touchscreen.tap(r[0], r[1]); await p.waitForTimeout(600);
  return r;
};
check('les 5: de poortles', /gate/i.test(await p.textContent('#taak')), await p.textContent('#taak'));
const g1 = await poortTik();
check('de oostpoort is dicht', await p.evaluate(() => { const s = window.spel, st = s.kaart.start[0], B = s.kaart.breedte; return s.wegvinder.isPoortDicht(st.y * B + st.x + 17); }), JSON.stringify(g1));
check('les 5 klaar met alleen de oostpoort', (await nS()).nKlaar, JSON.stringify(await nS()));
check('de westpoort blijft open', await p.evaluate(() => { const s = window.spel, st = s.kaart.start[0], B = s.kaart.breedte; return !s.wegvinder.isPoortDicht(st.y * B + st.x - 17); }));
await kaartTik();   // Hold
check('eerst het beleg: poort nog dicht', (await nS()).deel === 'beleg', JSON.stringify(await nS()));
await p.waitForTimeout(5000);
check('na 5 s: nog niemand binnen', (await kijk()).binnen === 0, JSON.stringify(await kijk()));
await p.waitForFunction(() => window.spel.proloog.stand().deel === 'storm', null, { timeout: 25000 }).catch(() => {});
check('Bartholt: verraad', await p.evaluate(() => /betrayed/.test(document.getElementById('verhaal').textContent + window.spel.ui.logboek().map((r) => r.tekst).join(' '))));
check('storm begonnen na ongeveer 10 s', (await nS()).deel === 'storm', JSON.stringify(await nS()));
check('poorten open', await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; return s.wegvinder.verbonden(st.y * s.kaart.breedte + st.x + 40, st.y * s.kaart.breedte + st.x + 3, 1); }));
// 0.76.2: staat Karel op de helft, dan begint de ontvoering en trekt het leger zich terug. Dus: meten op het
// hoogste punt binnen, of tot de ontvoering begint.
let na = await kijk(), hoogst = na.binnen, fase = 'nacht';
let sec = 0, verst = 0;
for (let i = 0; i < 150; i++) { await p.waitForTimeout(1000); sec = i + 1; verst = Math.max(verst, await p.evaluate(() => { const s = window.spel; const B = s.kaart.breedte; return Math.max(0, ...s.leger.lijst.filter((e) => !e.dood && e.karelWacht !== undefined && e.soldaat.sleutel !== 'koning').map((e) => Math.hypot(e.x - (e.karelWacht % B) - 0.5, e.y - Math.floor(e.karelWacht / B) - 0.5))); })); na = await kijk(); hoogst = Math.max(hoogst, na.binnen); fase = (await nS()).fase; if (fase !== 'nacht') break; if (i % 10 === 9) console.log('na', sec, 's: lijfwacht', await p.evaluate(() => window.spel.leger.lijst.filter((e) => !e.dood && e.karelWacht !== undefined && e.soldaat.sleutel !== 'koning').length), 'Karel', await p.evaluate(() => Math.round(window.spel.strijd.koning(0).leven))); }
console.log('ontvoering na storm (s):', sec, fase, 'reden:', (await nS()).reden, 'burcht:', await p.evaluate(() => { const s = window.spel.strijd.stand(); return Math.round(100 * s.burcht / s.burchtMax); }), 'hoogst binnen:', hoogst);
check('het leger stroomt naar binnen', hoogst >= 8, JSON.stringify(na));
check('lijfwacht blijft binnen 3,5 tegel van zijn post', verst <= 3.5, verst.toFixed(2));
await p.screenshot({ path: '/tmp/s/p43.png' });
check('geen scriptfouten', fouten.length === 0, fouten.join('|'));
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
