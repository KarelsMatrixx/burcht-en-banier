// Level 4 The Fen (0.71.0, nu 60 soldaten): 40 soldaten in het tentenkamp (de helft ninja's), en na de acht minuten komen
// 80 vlammenwevers uit de linkerbovenhoek die van jou zijn. Je wint door de rode heer te verslaan.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8271;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 859, height: 396 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
const ssleutel = 'burcht-banier.doel.4';

async function begin() {
  await p.goto(`http://localhost:${poort}/`); await wacht();
  await p.evaluate(() => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3] }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 4 }));
    sessionStorage.setItem('burcht-banier.geenTitel', '1');
  });
  await p.reload(); await wacht(); await p.waitForTimeout(300);
  await p.tap('#missie-begin'); await p.waitForTimeout(1500);
  await p.evaluate(() => { try { window.spel.ui.verbergVerhaal(); } catch (e) { /* niet erg */ } });
  await installeer();
}
// Spoelt het spel vooruit zoals de spellus dat doet (zonder te tekenen).
const installeer = () => p.evaluate(() => {
  window.ga = (sec) => {
    const s = window.spel; const dt = 1 / s.CONFIG.spel.stappenPerSeconde; const n = Math.round(sec / dt);
    for (let i = 0; i < n; i++) {
      if (s.strijd.uitslag()) break;
      s.eenheden.stap(dt); s.economie.stap(); s.leger.stap(); s.strijd.stap(); s.doel.stap(dt);
    }
  };
});
const wevers = () => p.evaluate(() => window.spel.leger.soldaten().filter((e) => e.soldaat.sleutel === 'vlammenwever').length);

await begin();

// --- Het garnizoen ---
const g = await p.evaluate(() => {
  const s = window.spel; const m = s.kaart.start[1]; const lijst = s.strijd.garnizoen();
  const tel = {}; for (const e of lijst) tel[e.vijand] = (tel[e.vijand] || 0) + 1;
  const vakken = new Set(lijst.map((e) => Math.floor(e.y) * s.kaart.breedte + Math.floor(e.x)));
  const ver = lijst.map((e) => Math.max(Math.abs(e.x - m.x), Math.abs(e.y - m.y)));
  return { n: lijst.length, tel, uniek: vakken.size, max: Math.max(...ver), aanvallers: s.strijd.stand().vijanden, koning: s.strijd.vijanden().length };
});
console.log('garnizoen', JSON.stringify(g));
check('60 soldaten in het kamp', g.n === 60, g.n);
check('de helft is een rode ninja', g.tel.sluipmoordenaar === 30, JSON.stringify(g.tel));
check('ook schutters en ridders', g.tel.boogschutter === 18 && g.tel.ridder === 12, JSON.stringify(g.tel));
check('bijna ieder op een eigen tegel (een enkeling loopt al)', g.uniek >= 55, g.uniek);
check('allemaal in en rond het kamp', g.max <= 14, g.max);
check('het garnizoen telt niet als aanvaller', g.aanvallers === 0, g.aanvallers);

// Ze blijven in het kamp, maar lopen rustig heen en weer (levendigheid)
await p.evaluate(() => { window.begin40 = window.spel.strijd.garnizoen().map((e) => [e.x, e.y]); window.beweegt = 0; });
for (let i = 0; i < 40; i++) await p.evaluate(() => { window.ga(1); window.beweegt = Math.max(window.beweegt, window.spel.strijd.garnizoen().filter((e) => e.pad && e.pad.length).length); });
const blijf = await p.evaluate(() => {
  const s = window.spel; const m = s.kaart.start[1]; const l = s.strijd.garnizoen();
  const verplaatst = l.filter((e, i) => Math.hypot(e.x - window.begin40[i][0], e.y - window.begin40[i][1]) > 0.6).length;
  const postVer = Math.max(...l.map((e) => Math.hypot(e.x - ((e.post % s.kaart.breedte) + 0.5), e.y - (Math.floor(e.post / s.kaart.breedte) + 0.5))));
  return { n: l.length, max: Math.max(...l.map((e) => Math.max(Math.abs(e.x - m.x), Math.abs(e.y - m.y)))), verplaatst, postVer, beweegt: window.beweegt };
});
console.log('slenteren', JSON.stringify(blijf));
check('na 40 seconden staat iedereen nog in het kamp', blijf.n === 60 && blijf.max <= 15, JSON.stringify(blijf));
check('er wordt rondgelopen: minstens 10 soldaten staan ergens anders', blijf.verplaatst >= 10, blijf.verplaatst);
check('er lopen er tegelijk een paar, niet allemaal', blijf.beweegt >= 2 && blijf.beweegt < 40, blijf.beweegt);
check('ze blijven bij hun post (hooguit 4,5 tegels)', blijf.postVer <= 4.5, blijf.postVer);
check('nog geen wevers van jou', (await wevers()) === 0);

// --- Tijdens het ritueel: de hut moet nog verdedigd worden ---
check('fase 0: hut telt (strijd.hut aanwezig)', await p.evaluate(() => !!window.spel.strijd.hut() && window.spel.doel.fase() === 0));
check('fase 0: klok zichtbaar', await p.evaluate(() => !document.querySelector('#aanvalklok').hidden && getComputedStyle(document.querySelector('#aanvalklok')).display !== 'none'));

// --- De tien minuten zijn om ---
await p.evaluate(() => window.spel.doel.zetTijd(599.5));
await p.evaluate(() => window.ga(1.5));
const na0 = await p.evaluate(() => {
  const s = window.spel; const taak = document.querySelector('#taak');
  const klok = document.querySelector('#aanvalklok');
  return { fase: s.doel.fase(), uitslag: s.strijd.uitslag(), hut: s.strijd.hut(), taak: taak.textContent.trim(), klokWeg: klok.hidden || getComputedStyle(klok).display === 'none', cam: [s.camera.x, s.camera.y], opslag: localStorage.getItem('burcht-banier.doel.4') };
});
check('niet meteen gewonnen', na0.uitslag === null, na0.uitslag);
check('fase 2 begonnen', na0.fase === 1, na0.fase);
check('de hut hoeft niet meer te staan', na0.hut === null, JSON.stringify(na0.hut));
check('nieuwe opdracht in beeld', /Defeat Huntmaster Brandt/.test(na0.taak), na0.taak);
check('aanvalsklok is weg', na0.klokWeg);
check('camera kijkt naar de linkerbovenhoek', na0.cam[0] < -200 && na0.cam[0] > -1200 && na0.cam[1] < 900, JSON.stringify(na0.cam));
// Ze komen aanlopen: eerst een paar aan de rand van de kaart, die naar binnen lopen, en pas na een tijd alle 80.
const eerst = await p.evaluate(() => { const w = window.spel.leger.soldaten().filter((e) => e.soldaat.sleutel === 'vlammenwever'); return { n: w.length, xMax: Math.max(...w.map((e) => e.x)), lopend: w.filter((e) => e.pad && e.pad.length).length }; });
console.log('eerste groepje', JSON.stringify(eerst));
check('eerst maar een groepje, niet alle 80 in een keer', eerst.n > 0 && eerst.n <= 10, JSON.stringify(eerst));
check('ze staan aan de rand van de kaart', eerst.xMax < 4, JSON.stringify(eerst));
check('en ze lopen naar binnen', eerst.lopend >= 1, JSON.stringify(eerst));
await p.evaluate(() => window.ga(8));
check('na 8 s nog niet allemaal', (await wevers()) < 80, await wevers());
await p.evaluate(() => window.ga(40));
check('80 vlammenwevers erbij', (await wevers()) === 80, await wevers());
await p.evaluate(() => window.ga(30));   // laat ze eerst op hun plek aankomen
const pos = await p.evaluate(() => {
  const s = window.spel; const w = s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'vlammenwever');
  return {
    team: w.every((e) => e.team === 0), x: [Math.min(...w.map((e) => e.x)), Math.max(...w.map((e) => e.x))], y: [Math.min(...w.map((e) => e.y)), Math.max(...w.map((e) => e.y))],
    links: w.every((e) => e.x - e.y < 0), boven: w.every((e) => e.x + e.y < s.kaart.breedte), uniek: new Set(w.map((e) => Math.floor(e.y) * s.kaart.breedte + Math.floor(e.x))).size,
  };
});
console.log('wevers', JSON.stringify(pos));
check('de wevers zijn van jou', pos.team === true);
check('ze staan verzameld links op de kaart', pos.boven && pos.x[1] < 24 && pos.y[0] > 5 && pos.y[1] < 40, JSON.stringify(pos));
check('ieder op een eigen tegel', pos.uniek === 80, pos.uniek);
const bestuur = await p.evaluate(() => { const s = window.spel; s.leger.kiesAlles(); return { gekozen: s.leger.aantalGekozen() }; });
check('je kunt ze allemaal kiezen', bestuur.gekozen >= 80, bestuur.gekozen);
await p.screenshot({ path: '/tmp/s/v71_komen.png' });

// Herladen midden in de tweede fase: de wevers en het garnizoen blijven, er komen er geen bij
await p.waitForTimeout(600);
await p.evaluate(() => sessionStorage.setItem('burcht-banier.geenTitel', '1'));
await p.reload(); await wacht(); await p.waitForTimeout(800); await installeer();
const her = await p.evaluate(() => { const s = window.spel; return { fase: s.doel.fase(), wevers: s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'vlammenwever').length, garnizoen: s.strijd.garnizoen().length, hut: s.strijd.hut() }; });
console.log('herladen', JSON.stringify(her));
check('herladen: nog in fase 2', her.fase === 1, JSON.stringify(her));
check('herladen: de 80 wevers zijn er nog', her.wevers === 80, her.wevers);
check('herladen: het garnizoen is er nog', her.garnizoen === 60, her.garnizoen);
check('herladen: de hut telt niet meer', her.hut === null);
await p.evaluate(() => window.ga(8));
check('herladen: er komen er geen bij', (await wevers()) === 80, await wevers());

// --- Het kamp innemen ---
await p.evaluate(() => {
  const s = window.spel; const m = s.kaart.start[1];
  window.stuurKamp = () => { s.leger.kies(s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'vlammenwever')); s.leger.stuur(m.x - 4, m.y + 4); };
  window.stuurKamp();
});
let eind = null;
for (let t = 0; t < 400 && !eind; t += 10) {
  eind = await p.evaluate(() => { window.ga(10); return window.spel.strijd.uitslag(); });
  if (!eind && t % 30 === 20) await p.evaluate(() => window.stuurKamp());
}
const klaar = await p.evaluate(() => ({ uitslag: window.spel.strijd.uitslag(), garnizoen: window.spel.strijd.garnizoen().length, wevers: window.spel.leger.soldaten().filter((e) => e.soldaat.sleutel === 'vlammenwever').length, opslag: localStorage.getItem('burcht-banier.doel.4') }));
console.log('einde', JSON.stringify(klaar));
check('het level is te winnen met de wevers', klaar.uitslag === 'gewonnen', JSON.stringify(klaar));
check('na de winst is de klok van dit level gewist', klaar.opslag === null, klaar.opslag);
await p.waitForTimeout(500);
await p.screenshot({ path: '/tmp/s/v71_winst.png' });

// --- Opnieuw beginnen: alles terug ---
await p.tap('#einde-opnieuw'); await p.waitForTimeout(1200); await installeer();
const opn = await p.evaluate(() => {
  const s = window.spel; const klok = document.querySelector('#aanvalklok');
  return { fase: s.doel.fase(), wevers: s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'vlammenwever').length, garnizoen: s.strijd.garnizoen().length, hut: !!s.strijd.hut(), uitslag: s.strijd.uitslag(), klok: !klok.hidden && getComputedStyle(klok).display !== 'none', taak: document.querySelector('#taak').textContent.trim() };
});
console.log('opnieuw', JSON.stringify(opn));
check('opnieuw: weer fase 1 (hut houden)', opn.fase === 0 && opn.hut === true && opn.uitslag === null, JSON.stringify(opn));
check('opnieuw: geen wevers meer', opn.wevers === 0, opn.wevers);
check('opnieuw: het garnizoen is er weer', opn.garnizoen === 60, opn.garnizoen);
check('opnieuw: aanvalsklok terug', opn.klok);

// Doorspelen na de winst (Keep playing): geen opdracht meer in beeld, het level blijft rustig
// (Een tijdsprong laat in een keer alle golven los, en het spel doorspelen is al hierboven getest: de winst komt hier met de testknop.)
await p.evaluate(() => window.spel.doel.zetTijd(599.5));
await p.evaluate(() => window.ga(2));
check('tweede keer: ook nu komt het Stille Volk', await p.evaluate(() => window.spel.doel.fase() === 1 && window.spel.leger.soldaten().some((e) => e.soldaat.sleutel === 'vlammenwever')));
await p.evaluate(() => window.spel.strijd.beslis('gewonnen'));
await p.waitForTimeout(500);
await p.tap('#einde-verder'); await p.waitForTimeout(600);
await p.evaluate(() => window.ga(2));
const door = await p.evaluate(() => ({ taak: document.querySelector('#taak').textContent.trim(), uitslag: window.spel.strijd.uitslag() }));
check('na "Keep playing" geen opdracht meer', door.taak === '' && door.uitslag === null, JSON.stringify(door));

check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`versterking71: ${ok} ok, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
