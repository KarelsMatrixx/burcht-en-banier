// Proloog 0.76.2 (naar Karel):
// - Karel op de helft van zijn leven: meteen de ontvoering (niet pas na 5 minuten)
// - de ruiter rijdt over een echte route door de open poorten, niet over de muren
// - het leger van Ottger trekt zich tegelijk terug en vecht niet meer
// - de grondles vraagt altijd naar het oog, ook als het eerder aan is geweest
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8277;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e) + ' ' + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 0 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
await p.tap('#missie-begin'); await p.waitForTimeout(1500);
const st = () => p.evaluate(() => window.spel.proloog.stand());

// --- Oog: zet het oog vooraf aan; de grondles moet er toch naar vragen
// 0.76.6: buiten les 10 is de oogknop dicht (tutorial: alleen wat de les vraagt)
await p.waitForTimeout(500);
check('oogknop dicht buiten de grondles', await p.evaluate(() => document.getElementById('knop-oog').classList.contains('tut-dicht')));
// De testsoldaat op een goed bereikbaar vak (zoals een soldaat uit de kazerne), niet in een ingesloten hoekje
await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; const B = s.kaart.breedte; let best = null, bestN = -1;
  for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const x = st.x + dx, y = st.y + dy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 6 || !s.wegvinder.isVrij(x, y, 0)) continue;
    let n = 0; for (let ey = -9; ey <= 9; ey += 3) for (let ex = -9; ex <= 9; ex += 3) { const vx = st.x + 4 + ex, vy = st.y + 3 + ey; if (s.wegvinder.isVrij(vx, vy, 0) && s.wegvinder.verbonden(y * B + x, vy * B + vx, 0)) n++; }
    if (n > bestN) { bestN = n; best = [x, y]; } }
  s.leger.zetStand([['ridder', best[0], best[1], 100, 0]]); });
// Spring naar de grondles (index 9) via de opslag van de proloog
await p.evaluate(() => { const r = JSON.parse(localStorage.getItem('burcht-banier.proloog') || '{}'); r.taak = 9; r.basis = false; r.klaar = false; r.fase = 'bouw'; localStorage.setItem('burcht-banier.proloog', JSON.stringify(r)); });
await p.waitForTimeout(11000);   // het spel bewaart elke 10 s: zo komen de soldaten mee door het herladen
await p.evaluate(() => window.spel.proloog.stop());
await p.evaluate(() => sessionStorage.setItem('burcht-banier.geenTitel', '1'));
await p.reload(); await wacht(); await p.waitForTimeout(800);
if (await p.getByText('Continue', { exact: false }).first().isVisible().catch(() => false)) { await p.getByText('Continue', { exact: false }).first().tap(); await p.waitForTimeout(1500); }
if (await p.isVisible('#missie-begin')) { await p.tap('#missie-begin'); await p.waitForTimeout(1200); }
const s9 = await st();
check('in de grondles', s9.taak === 9, JSON.stringify({ taak: s9.taak, fase: s9.fase }));
await p.waitForSelector('#gids-kaart:not([hidden]) button', { timeout: 25000 }); await p.tap('#gids-kaart button'); await p.waitForTimeout(600);
check('oog uit aan het begin van de grondles', await p.evaluate(() => document.getElementById('knop-oog').getAttribute('aria-pressed') !== 'true'));
await p.waitForTimeout(800);
let zin = await p.textContent('#gids-zin');
check('stap 1: de gids vraagt eerst naar het oog', /eye/i.test(zin) && await p.isVisible('#gids-ring'), zin);
check('stap 1: nog geen gouden plek', await p.isHidden('#gids-plek'));
// 0.77.1: voor het oog is de soldaat niet te kiezen, ook niet met een tik precies op hem
const sp = await p.evaluate(() => { const s = window.spel; const e = s.gids.doel().soldaat(); const T = s.CONFIG.tegel; s.camera.kijkNaar((e.x - e.y) * T.breedte / 2, (e.x + e.y) * T.hoogte / 2); const w = { x: (e.x - e.y) * T.breedte / 2, y: (e.x + e.y) * T.hoogte / 2 - 14 }; return s.camera.wereldNaarScherm(w.x, w.y); });
await p.waitForTimeout(200);
await p.touchscreen.tap(sp.x, sp.y); await p.waitForTimeout(400);
check('voor het oog: tik op de soldaat kiest niets', (await p.evaluate(() => window.spel.leger.aantalGekozen())) === 0);
// Een bevel zonder oog telt niet
await p.tap('#knop-oog'); await p.waitForTimeout(800);
zin = await p.textContent('#gids-zin');
check('stap 2: na het oog de soldaat kiezen', /soldier/i.test(zin), zin);
if (!/soldier/i.test(zin)) console.log('DBG soldaten', await p.evaluate(() => JSON.stringify(window.spel.leger.soldaten().filter((e) => e.soldaat.sleutel !== 'koning').slice(-6).map((e) => [e.soldaat.sleutel, e.x.toFixed(1), e.y.toFixed(1), !!e.wachter, !!e.garnizoen, e.opMuur, e.soldaat.doel]))), await p.evaluate(() => JSON.stringify(window.spel.gids.doel() && window.spel.gids.doel().soldaat && window.spel.gids.doel().soldaat())));
for (let k = 0; k < 6 && (await p.evaluate(() => window.spel.leger.aantalGekozen())) === 0; k++) {
  const r = await p.evaluate(() => { const e = document.getElementById('gids-plek'); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, buiten: e.classList.contains('buiten'), hid: e.hidden }; });
  if (r.hid) { await p.waitForTimeout(500); continue; }
  if (r.buiten) { await p.evaluate(() => { const s = window.spel; const e = s.leger.soldaten().filter((x) => !x.wachter && x.soldaat.sleutel !== 'koning').pop(); const t = s.CONFIG.tegel; s.camera.kijkNaar((e.x - e.y) * t.breedte / 2, (e.x + e.y) * t.hoogte / 2); }); await p.waitForTimeout(500); continue; }
  await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(500);
}
check('soldaat gekozen', (await p.evaluate(() => window.spel.leger.aantalGekozen())) > 0);
await p.evaluate(() => { window._mijn = window.spel.leger.gekozen(); });
await p.waitForTimeout(700);
zin = await p.textContent('#gids-zin');
check('stap 3: de gouden plek op de grond', /golden spot on the ground/i.test(zin), zin);
// Niemand staat op of vlak bij de plek (behalve Bartholt naast de plek)
const vrij = await p.evaluate(() => { const s = window.spel; const g = s.gids.doel().plek; return s.eenheden.lijst.filter((e) => !e.dood && Math.hypot(e.x - g.x - 0.5, e.y - g.y - 0.5) < 1).length; });
check('niemand op de gouden plek', vrij === 0, vrij);
// Een bevel 4 tegels ernaast telt niet
await p.evaluate(() => { const s = window.spel; const g = s.gids.doel().plek; for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) if (s.wegvinder.isVrij(g.x + dx, g.y + dy, 0)) { s.leger.stuur(g.x + dx, g.y + dy, false); break; } });
await p.waitForTimeout(800);
check('bevel naast de plek telt niet', !(await st()).klaar, JSON.stringify((await st()).klaar));
// Op de plek: wel (opnieuw kiezen als de keuze weg is)
console.log('gekozen na fout bevel:', await p.evaluate(() => window.spel.leger.aantalGekozen()));
await p.evaluate(() => { const s = window.spel; const g = s.gids.doel().plek; s.leger.stuur(g.x, g.y, false); });
await p.waitForTimeout(1200);
check('bevel op de plek, na het oog: les klaar', (await st()).klaar, JSON.stringify((await st()).klaar));

// --- Pauze: niemand trilt (menu open, dan staan de getekende plekken stil)
await p.evaluate(() => { document.getElementById('instellingen').hidden = false; });
await p.waitForTimeout(400);
const tril = await p.evaluate(() => window.spel.eenheden.lijst.filter((e) => !e.dood && (e.vorigeX !== e.x || e.vorigeY !== e.y)).length);
check('pauze: niemand tussen twee plekken (geen trillen)', tril === 0, tril);
await p.evaluate(() => { document.getElementById('instellingen').hidden = true; });
await p.waitForTimeout(300);
// --- Het einde: storm, Karel op de helft
await p.evaluate(() => window.spel.proloog.zetFase('storm'));
await p.waitForTimeout(400);
while (await p.isVisible('#gids-kaart')) { await p.tap('#gids-kaart button'); await p.waitForTimeout(300); }
check('storm', (await st()).deel === 'storm', JSON.stringify(await st()));
// Lijfwacht van Karel: 20 zwaardvechters, niet te kiezen, Karel blijft staan
const lw = await p.evaluate(() => { const s = window.spel; const w = s.leger.lijst.filter((e) => !e.dood && e.karelWacht !== undefined && e.soldaat.sleutel !== 'koning'); const k = s.leger.lijst.find((e) => e.soldaat && e.soldaat.sleutel === 'koning');
  s.leger.kiesAlles(); const gek = w.filter((e) => e.soldaat.sleutel !== 'koning').filter((e) => e.gekozen).length; s.leger.kiesGeen();
  return { n: w.length, soort: [...new Set(w.map((e) => e.soldaat.sleutel))], gek, blijf: !!k.blijf, bij: w.filter((e) => Math.hypot(e.x - k.x, e.y - k.y) < 5).length }; });
check('lijfwacht: 20 zwaardvechters', lw.n === 20 && lw.soort.join() === 'zwaardvechter', JSON.stringify(lw));
check('lijfwacht: niet te kiezen', lw.gek === 0, JSON.stringify(lw));
check('lijfwacht: rond Karel, Karel blijft staan', lw.bij >= 18 && lw.blijf, JSON.stringify(lw));
// Zoals in het echte spel: het leger staat binnen, bij de burcht
await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; const vrij = [];
  for (let dy = -7; dy <= 7; dy++) for (let dx = 2; dx <= 8; dx++) if (s.wegvinder.isVrij(st.x + dx, st.y + dy, 1)) vrij.push([st.x + dx, st.y + dy]);
  let i = 0; for (const e of s.eenheden.lijst) { if (e.team !== 1 || e.dood || e.wachter !== undefined || !e.krijg) continue; const [x, y] = vrij[i++ % vrij.length]; e.x = x + 0.5; e.y = y + 0.5; e.pad = null; if (e.krijg.tak) e.krijg.tak.houd = false; } });
await p.waitForTimeout(6000);
const lw2 = await p.evaluate(() => { const s = window.spel; const B = s.kaart.breedte; const w = s.leger.lijst.filter((e) => !e.dood && e.karelWacht !== undefined);
  const af = w.map((e) => Math.hypot(e.x - (e.karelWacht % B) - 0.5, e.y - Math.floor(e.karelWacht / B) - 0.5)); return { n: w.length, ver: af.filter((d) => d > 3).length, vecht: w.filter((e) => e.krijg && e.krijg.doelwit).length, fase: s.proloog.stand().fase }; });
console.log('lijfwacht na 6 s storm:', JSON.stringify(lw2));
check('lijfwacht: blijft bij de posten (hooguit 3 man ver weg)', lw2.ver <= 3, JSON.stringify(lw2));
await p.evaluate(() => { const k = window.spel.strijd.koning(0); k.leven = Math.ceil(k.levenMax / 2); });
await p.waitForTimeout(1500);
check('Karel op de helft: de ontvoering begint', (await st()).fase === 'ontvoering', JSON.stringify({ fase: (await st()).fase }));
// 0.77.0: eerst het gesprek (kaartjes), de ruiter pas daarna
check('eerst het gesprek: kaartje open, nog geen ruiter', await p.isVisible('#gids-kaart') && !(await p.evaluate(() => window.spel.strijd.effecten.some((f) => f.soort === 'ruiter'))));
const regels = [];
while (await p.isVisible('#gids-kaart')) { regels.push((await p.textContent('#gids-kaart')).slice(0, 30)); await p.tap('#gids-kaart button'); await p.waitForTimeout(300); }
console.log('gesprek voor de rit:', regels.join(' / '));
check('gesprek: vier kaartjes', regels.length === 4, regels.length);
await p.waitForTimeout(500);
check('na het gesprek: de ruiter rijdt', await p.evaluate(() => window.spel.strijd.effecten.some((f) => f.soort === 'ruiter')));
// De route: elke stap is een buurvak, en geen enkel vak is muur of toren
const rit = await p.evaluate(() => { const s = window.spel; const f = (Array.isArray(s.strijd.effecten) ? s.strijd.effecten : s.strijd.effecten()).find((x) => x.soort === 'ruiter'); if (!f) return null;
  const B = s.kaart.breedte; let sprong = 0, muur = 0, poorten = 0;
  for (let i = 0; i < f.route.length; i++) { const [x, y] = f.route[i]; const v = Math.floor(y) * B + Math.floor(x); const o = s.kaart.object[v];
    if (o === 6) poorten++; else if (s.leger.isMuur && s.leger.isMuur(v)) muur++;
    if (i && Math.max(Math.abs(x - f.route[i - 1][0]), Math.abs(y - f.route[i - 1][1])) > 1.01) sprong++; }
  return { n: f.route.length, sprong, muur, poorten, duur: f.duur, eind: f.route[f.route.length - 1], st: [s.kaart.start[0].x, s.kaart.start[0].y] }; });
check('ruiter: route bestaat', rit && rit.n > 10, JSON.stringify(rit));
check('ruiter: geen sprongen (vak voor vak)', rit && rit.sprong === 0, JSON.stringify(rit));
check('ruiter: niet over muren', rit && rit.muur === 0, JSON.stringify(rit));
check('ruiter: door de poorten (4 ringen)', rit && rit.poorten >= 4, JSON.stringify(rit));
check('ruiter: eindigt buiten de buitenste ring', rit && rit.eind[0] - rit.st[0] > 18, JSON.stringify(rit));
// Het leger trekt terug
await p.waitForTimeout(1500);
const terug = await p.evaluate(() => { const s = window.spel; const v = s.eenheden.lijst.filter((e) => e.team === 1 && !e.dood && e.wachter === undefined && e.krijg && e.krijg.tak);
  return { n: v.length, aftocht: v.filter((e) => e.krijg.tak.aftocht >= 0).length, vecht: v.filter((e) => e.krijg.doelwit).length, x: v.reduce((a, e) => a + e.x, 0) / Math.max(1, v.length) }; });
check('leger: iedereen op de aftocht', terug.n > 0 && terug.aftocht >= terug.n * 0.9, JSON.stringify(terug));
check('leger: niemand vecht nog', terug.vecht === 0, JSON.stringify(terug));
await p.screenshot({ path: '/tmp/s/p77_rit.png' });
await p.waitForTimeout(4000);
const terug2 = await p.evaluate(() => { const s = window.spel; const v = s.eenheden.lijst.filter((e) => e.team === 1 && !e.dood && e.wachter === undefined && e.krijg && e.krijg.tak); return v.reduce((a, e) => a + e.x, 0) / Math.max(1, v.length); });
check('leger: loopt naar het oosten', terug2 > terug.x + 1, `${terug.x.toFixed(1)} -> ${terug2.toFixed(1)}`);
await p.screenshot({ path: '/tmp/s/p77_rit2.png' });
await p.waitForFunction(() => window.spel.proloog.stand().fase === 'scene', null, { timeout: 30000 }).catch(() => {});
check('daarna de scène', (await st()).fase === 'scene', (await st()).fase);
check('geen scriptfouten', fouten.length === 0, fouten.join('\n'));
console.log(`proloog77: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
