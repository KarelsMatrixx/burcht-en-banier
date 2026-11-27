// Proloog 0.73.0: de hele tutorial met een trage lezer die alleen de gids volgt.
// Controleert: het spel staat stil zolang een kaartje open is, de bouwlessen hoeven niet op hout te wachten,
// de voorraadkamer is les 2, de avond is één kaartje, het leger valt pas aan na "Hold" (geen klok),
// wachtende vijanden vechten niet (ook niet met boogschutters op de muur), de kiesles telt alleen de juiste soort.
// Daarna: in level 1 is Bartholts raad over de eerste gebouwen het eerste bericht (en in de proloog niet).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8270;
const LEES = 4000;   // zo lang leest de speler elk kaartje (ms)
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
const start = async (missie) => {
  await p.goto(`http://localhost:${poort}/`); await wacht();
  await p.evaluate((m) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, missie);
  await p.reload(); await wacht(); await p.waitForTimeout(300);
  await p.tap('#missie-begin'); await p.waitForTimeout(1500);
};
await start(0);
const st = () => p.evaluate(() => window.spel.proloog.stand());
const vijanden = () => p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0];
  const v = s.eenheden.lijst.filter((e) => e.team === 1 && e.vijand && e.wachter === undefined && !e.dood);
  return { n: v.length, som: Math.round(v.reduce((a, e) => a + e.x + e.y, 0) * 10), binnen: v.filter((e) => Math.max(Math.abs(e.x - st.x), Math.abs(e.y - st.y)) < 18).length,
    vechten: v.filter((e) => e.krijg && e.krijg.doelwit).length, wachten: v.filter((e) => e.krijg && e.krijg.tak && e.krijg.tak.houd).length }; });

// Een kaartje rustig lezen: het spel moet stilstaan, dan pas tikken.
let kaartjes = 0, stilFout = 0, bedekteTik = 0;
async function leesKaart() {
  await p.waitForSelector('#gids-kaart:not([hidden]) button', { timeout: 10000 });
  const voor = await p.evaluate(() => ({ t: window.spel.proloog.stand().tijd, tekst: document.getElementById('gids-kaart').textContent }));
  const v0 = await vijanden();
  await p.waitForTimeout(LEES);
  const na = await p.evaluate(() => window.spel.proloog.stand().tijd);
  const v1 = await vijanden();
  if (Math.abs(na - voor.t) > 0.05 || v0.som !== v1.som) { stilFout++; console.log('loopt door tijdens kaartje:', voor.tekst.slice(0, 60), voor.t, na, v0.som, v1.som); }
  kaartjes++;
  await p.tap('#gids-kaart button');
  await p.waitForFunction((v) => { const k = document.getElementById('gids-kaart'); return k.hidden || k.textContent !== v; }, voor.tekst, { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(250);
  const nog = await p.evaluate((v) => { const k = document.getElementById('gids-kaart'); return !k.hidden && k.textContent === v; }, voor.tekst);
  if (nog) { console.log('DBG kaart blijft:', await p.evaluate(() => { const b = document.querySelector('#gids-kaart button'); const r = b.getBoundingClientRect(); const o = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return JSON.stringify({ r: [r.left, r.top, r.width, r.height], over: o && (o.id || o.className || o.tagName), ouder: o && o.parentElement && o.parentElement.id }); })); await p.screenshot({ path: '/tmp/s/p70_dbg.png' }); process.exit(2); }
  return voor.tekst;
}
// Tik waar de gids naar wijst (ring om een knop, of de gouden plek; buiten beeld: camera erheen)
async function tikGids() {
  let stap = await p.evaluate(() => {
    const ring = document.getElementById('gids-ring'); const plek = document.getElementById('gids-plek');
    if (!ring.hidden) { const r = ring.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, wat: 'ring' }; }
    if (!plek.hidden) { const r = plek.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, wat: plek.classList.contains('buiten') ? 'buiten' : 'plek' }; }
    return null; });
  if (stap && stap.wat === 'buiten') {
    // Zoals een speler: het beeld schuiven in de richting van de pijl
    await p.evaluate(() => { const s = window.spel; const r = document.getElementById('gids-plek').getBoundingClientRect(); const mx = innerWidth / 2, my = innerHeight / 2;
      const dx = r.left + r.width / 2 - mx, dy = r.top + r.height / 2 - my, l = Math.hypot(dx, dy) || 1;
      const w = s.camera.schermNaarWereld(mx + dx / l * 220, my + dy / l * 220); s.camera.kijkNaar(w.x, w.y); });
    await p.waitForTimeout(600);
    return true;
  }
  if (!stap) return false;
  // Ligt er een knop over de plek? Dan eerst het beeld schuiven, zoals een speler zou doen
  if (stap.wat === 'plek') {
    const bedekt = await p.evaluate(([x, y]) => { const o = document.elementFromPoint(x, y); return !!(o && o.tagName !== 'CANVAS' && !o.closest('#gids-plek')); }, [stap.x, stap.y]);
    if (bedekt) { bedekteTik++; await p.evaluate(([x, y]) => { const s = window.spel; const w = s.camera.schermNaarWereld(x, y); s.camera.kijkNaar(w.x, w.y); }, [stap.x, stap.y]); await p.waitForTimeout(500); return true; }
  }
  await p.touchscreen.tap(stap.x, stap.y); await p.waitForTimeout(500); return true;
}
const kaartOpen = () => p.isVisible('#gids-kaart');

// --- De dag ---
const logVoor = await p.evaluate(() => window.spel.ui.logboek().map((r) => r.tekst).join(' | '));
check('proloog: geen raad over de eerste gebouwen in het logboek', !/Build these first/.test(logVoor), logVoor);
const houtStart = await p.evaluate(() => window.spel.economie.voorraad.hout);
check('proloog: 120 hout bij het begin', houtStart >= 120, houtStart);
const takenGezien = [];
let wachtenOpHout = 0;
const duur = {}; let tLes = Date.now(), lesNu = -1;
const tEind = Date.now() + 6 * 60000;
while (Date.now() < tEind) {
  const s = await st();
  if (s.fase !== 'bouw') break;
  if (s.taak !== lesNu) { if (lesNu >= 0) duur[lesNu] = Math.round((Date.now() - tLes) / 1000); lesNu = s.taak; tLes = Date.now(); }
  if (await kaartOpen()) { await leesKaart(); continue; }
  if (!s.basis || s.klaar) {
    // Ligt er een bericht over het kaartje (de gids is dan bedekt), dan tikt de speler het weg
    if (!s.basis && await p.isVisible('#verhaal')) { console.log('bericht weggetikt bij les', s.taak, (await p.textContent('#verhaal')).slice(0, 60)); await p.tap('#verhaal').catch(() => {}); await p.waitForTimeout(300); continue; }
    if (!s.basis && Math.random() < 0.05) console.log('WACHT', s.taak, await p.evaluate(() => JSON.stringify({ body: document.body.className, kaartHid: document.getElementById('gids-kaart').hidden, open: ['verhaal', 'logboek', 'volkpaneel', 'legerpaneel', 'bouwpaneel', 'instellingen', 'titelscherm', 'verhaalbeeld', 'missie', 'scene', 'einde'].filter((id) => { const e = document.getElementById(id); return e && !e.hidden; }) })));
    await p.waitForTimeout(300); continue;
  }
  if (!takenGezien.includes(s.taak)) takenGezien.push(s.taak);
  if (s.taak === 4 && !globalThis.huisGetest) {
    globalThis.huisGetest = true;
    const r = await p.evaluate(() => { const sp = window.spel; const dicht = (id) => document.getElementById(id).classList.contains('tut-dicht');
      sp.leger.kiesAlles(); const gek = sp.leger.aantalGekozen(); sp.leger.kiesGeen();
      return { zwaard: dicht('knop-zwaard'), buidel: dicht('knop-buidel'), oog: dicht('knop-oog'), portret: dicht('adviseur'), gek }; });
    check('huisles: zwaard, buidel, oog en portret dicht', r.zwaard && r.buidel && r.oog && r.portret, JSON.stringify(r));
    check('huisles: geen soldaten te kiezen', r.gek === 0, JSON.stringify(r));
    await p.tap('#knop-zwaard', { force: true }).catch(() => {}); await p.waitForTimeout(300);
    check('huisles: legerpaneel gaat niet open', !(await p.isVisible('#leger-groepen button')));
  }
  const melding = await p.evaluate(() => [...document.querySelectorAll('#meldingen *, #bouwhint, #gids-zin')].map((e) => e.textContent).join('|'));
  if (/not enough|need .* wood|more wood/i.test(melding)) wachtenOpHout++;
  // Les 9: er is soms nog geen boer zonder werk; dan wachten (het volk groeit)
  if (!(await tikGids())) await p.waitForTimeout(500);
}
const sDag = await st();
console.log('seconden per les (incl. lezen):', JSON.stringify(duur), 'gouden plek onder een knop:', bedekteTik);
check('dag doorlopen tot de avond', sDag.fase === 'avond', JSON.stringify({ fase: sDag.fase, taak: sDag.taak }));
check('alle 12 daglessen gezien', takenGezien.length === 12, JSON.stringify(takenGezien));
check('bouwlessen: nooit wachten op hout', wachtenOpHout === 0, wachtenOpHout);
const volgorde = await p.evaluate(() => window.spel.proloog.taken().map((t) => t.taak));
check('voorraadkamer is les 2', volgorde[1] === 'Build a Storehouse', JSON.stringify(volgorde));

// --- De avond: meteen een kaartje, dan schemer, dan nacht ---
check('avond: kaartje van Bartholt staat er meteen', await kaartOpen() && /feast is over/.test(await p.textContent('#gids-kaart')), await p.textContent('#gids-kaart'));
check('avond: Reinout nog in beeld tot het kaartje dicht is', (await st()).reinout);
await leesKaart();
check('avond: Reinout weg', !(await st()).reinout);
await p.waitForFunction(() => window.spel.proloog.stand().fase === 'nacht', null, { timeout: 20000 }).catch(() => {});
check('nacht binnen 20 s na het avondkaartje', (await st()).fase === 'nacht', JSON.stringify(await st()));

// --- De nacht ---
check('nacht: zwaard open', !(await p.evaluate(() => document.getElementById('knop-zwaard').classList.contains('tut-dicht'))));
check('nacht: intro van les 1', await kaartOpen() && /archers/i.test(await p.textContent('#gids-kaart')));
await leesKaart();
// Les 1 streng: eerst per ongeluk de ridders
if (!(await p.isVisible('#leger-groepen button'))) { await p.tap('#knop-zwaard'); await p.waitForTimeout(500); }
check('kiesles: All en Box dicht', await p.evaluate(() => ['knop-alle', 'knop-kader'].every((id) => document.getElementById(id).classList.contains('tut-dicht'))));
await p.tap('#knop-alle', { force: true }).catch(() => {}); await p.waitForTimeout(400);
check('kiesles: All kiest niemand', await p.evaluate(() => window.spel.leger.aantalGekozen() === 0));
check('kiesles: gids wijst Ranged aan, niet All', /Ranged/.test(await p.textContent('#gids-zin')) && !/\bAll\b/.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
await p.locator('#leger-groepen button', { hasText: /^Melee/ }).tap(); await p.waitForTimeout(600);
await p.locator('#leger-groepen button', { hasText: /^Knight/ }).tap(); await p.waitForTimeout(1200);
check('kiesles: ridders kiezen telt niet voor boogschutters', !(await st()).nKlaar, JSON.stringify(await st()));
// Daarna de gids volgen (Back, Ranged, Archer)
for (let k = 0; k < 6 && !(await st()).nKlaar; k++) { await tikGids(); await p.waitForTimeout(700); }
check('kiesles: boogschutters via de gids gekozen telt', (await st()).nKlaar, JSON.stringify(await st()));
check('kiesles: alleen boogschutters gekozen', await p.evaluate(() => window.spel.leger.gekozen().every((e) => e.soldaat.sleutel === 'boogschutter' || e.soldaat.sleutel === 'koning')));
await leesKaart(); await leesKaart();   // Good, intro les 2
// Les 2: boogschutters naar de muur bij de poort (de gids volgen)
for (let k = 0; k < 12 && (await st()).nBevel !== 2; k++) { if (await kaartOpen()) break; await tikGids(); }
check('les 2: bevel gegeven', (await st()).nBevel === 2, JSON.stringify(await st()));
const onderweg2 = await p.evaluate(() => window.spel.leger.gekozen().some((e) => e.pad || e.klimt));
check('les 2: niet klaar zolang ze lopen', !onderweg2 || !(await st()).nKlaar);
await p.waitForFunction(() => window.spel.proloog.stand().nKlaar, null, { timeout: 60000 }).catch(() => {});
check('les 2: klaar als de boogschutters op de muur staan', (await st()).nKlaar && await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; return s.leger.soldaten().some((e) => e.soldaat.sleutel === 'boogschutter' && e.opMuur && !e.pad && Math.hypot(e.x - st.x - 17.5, e.y - st.y + 0.5) <= 4.5); }), JSON.stringify(await st()));
// Iedereen op zijn wachtplek, de boogschutters op de muur; dan treuzelt de speler 200 s zonder kaartje open
await leesKaart();   // "Good."
await p.waitForSelector('#gids-kaart:not([hidden]) button');   // intro les 3 staat open: eerst dicht, dan treuzelen
await leesKaart();
await p.evaluate(() => { const s = window.spel; s.strijd.opmarsDirect(); for (const e of s.leger.soldaten()) { if (e.soldaat && e.soldaat.sleutel === 'boogschutter' && e.soldaat.doel >= 0) { const B = s.kaart.breedte, N = B * s.kaart.hoogte; const v = e.soldaat.doel >= N ? e.soldaat.doel - N : e.soldaat.doel; if (e.soldaat.doel >= N) { e.x = v % B + 0.5; e.y = Math.floor(v / B) + 0.5; e.opMuur = true; e.hoogte = 40; e.pad = null; } } } });
const leven0 = await p.evaluate(() => window.spel.leger.soldaten().reduce((a, e) => a + (e.leven || 0), 0));
const v0 = await vijanden();
await p.evaluate(() => { const s = window.spel; for (let i = 0; i < 2000; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); if (i % 5 === 0) s.proloog.stap(0.5); } });
const v1 = await vijanden();
const leven1 = await p.evaluate(() => window.spel.leger.soldaten().reduce((a, e) => a + (e.leven || 0), 0));
const s200 = await st();
check('treuzelen 200 s: de opmars wacht nog (geen klok)', s200.deel === 'opmars', JSON.stringify(s200));
check('treuzelen: geen vijand gesneuveld', v1.n === v0.n, JSON.stringify([v0, v1]));
check('treuzelen: niemand binnen de muren', v1.binnen === 0, JSON.stringify(v1));
check('treuzelen: geen vijand vecht', v1.vechten === 0, JSON.stringify(v1));
check('treuzelen: vijanden wachten nog', v1.wachten >= v0.n - 2, JSON.stringify(v1));
check('treuzelen: je soldaten ongedeerd', leven1 >= leven0, `${leven0} -> ${leven1}`);
const boogOpMuur = await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; return s.leger.soldaten().filter((e) => e.soldaat && e.soldaat.sleutel === 'boogschutter' && e.opMuur && Math.abs(e.x - st.x - 17) < 3).length; });
check('boogschutters staan echt op de poortmuur', boogOpMuur >= 1, boogOpMuur);
// Les 3 en 4
if (!(await p.isVisible('#leger-groepen button'))) { await p.tap('#knop-zwaard'); await p.waitForTimeout(500); }
check('les 3: gids wijst Back of Melee aan', /Go back|Melee/.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
for (let k = 0; k < 6 && !(await st()).nKlaar; k++) { await tikGids(); await p.waitForTimeout(700); }
check('les 3: ridders via de gids gekozen', (await st()).nKlaar, JSON.stringify(await st()));
await leesKaart(); await leesKaart();
for (let k = 0; k < 12 && (await st()).nBevel !== 4; k++) { if (await kaartOpen()) break; await tikGids(); }
check('les 4: bevel gegeven', (await st()).nBevel === 4, JSON.stringify(await st()));
const onderweg4 = await p.evaluate(() => window.spel.leger.soldaten().some((e) => e.soldaat.sleutel === 'ridder' && e.pad && e.soldaat.doel >= 0));   // de keuze vervalt na het bevel (0.77.0)
check('les 4: gids zegt onderweg', /on their way/i.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
check('les 4: niet klaar zolang ze lopen', onderweg4 && !(await st()).nKlaar, JSON.stringify({ onderweg4, k: (await st()).nKlaar }));
check('les 4: taakregel zegt onderweg', /on their way/i.test(await p.evaluate(() => document.body.textContent)));
await p.waitForFunction(() => window.spel.proloog.stand().nKlaar, null, { timeout: 60000 }).catch(() => {});
check('les 4: klaar als de ridders achter de poort staan', (await st()).nKlaar && await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; return s.leger.soldaten().some((e) => e.soldaat.sleutel === 'ridder' && !e.pad && Math.hypot(e.x - st.x - 14.5, e.y - st.y - 2.5) <= 4.5); }), JSON.stringify(await st()));
await leesKaart(); await leesKaart();
// Les 5: de poort dicht. Tot hier geen aanval.
check('voor de poortles: nog opmars', (await st()).deel === 'opmars', JSON.stringify(await st()));
for (let k = 0; k < 12 && !(await st()).nKlaar; k++) { if (await kaartOpen()) break; await tikGids(); }
check('les 5: poort dicht', (await st()).nKlaar && await p.evaluate(() => { const s = window.spel, st = s.kaart.start[0], B = s.kaart.breedte; return s.wegvinder.isPoortDicht(st.y * B + st.x + 17); }), JSON.stringify(await st()));
check('na de poortles, voor Hold: nog opmars', (await st()).deel === 'opmars', JSON.stringify(await st()));
await leesKaart();   // Hold
check('na Hold: de aanval begint', (await st()).deel === 'beleg', JSON.stringify(await st()));
await p.waitForTimeout(6000);
check('na Hold: de vijand komt (wacht niet meer)', (await vijanden()).wachten === 0, JSON.stringify(await vijanden()));
check(`het spel stond stil tijdens alle ${kaartjes} kaartjes`, stilFout === 0, stilFout);
await p.screenshot({ path: '/tmp/s/p70_nacht.png' });

// --- Level 1: Bartholts raad als eerste bericht ---
await start(1);
// Sinds 0.116/0.124 begint level 1 met de handel- en bouwles; Bartholts raad komt pas daarna (zie handelles116 en bouwles124).
const metLessen = await p.evaluate(() => !!(window.spel.handelLes || window.spel.bouwLes));
if (!metLessen) {
  await p.waitForFunction(() => window.spel.ui.logboek().some((r) => r.soort === 'verhaal'), null, { timeout: 25000 }).catch(() => {});
  await p.waitForTimeout(300);
  const log1 = await p.evaluate(() => window.spel.ui.logboek().filter((r) => r.soort === 'verhaal'));
  check('level 1: eerste bericht is de raad van Bartholt', log1.length > 0 && /Build these first/.test(log1[0].tekst), JSON.stringify(log1.slice(0, 2)));
} else console.log('level 1 begint met lessen: controle van het eerste bericht overgeslagen');
check('geen scriptfouten', fouten.length === 0, fouten.join('\n'));
console.log(`proloog70: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
