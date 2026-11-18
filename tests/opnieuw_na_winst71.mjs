// 0.70.4: een gewonnen level opnieuw spelen ("Start over") mag niet meteen "Your king fell during attack 0" geven.
// Oorzaak was: na herladen in een beslechte stand kende leger.js het thuisvak van de koning niet, dus herstel() zette hem niet terug.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8392;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 859, height: 396 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
const stand = () => p.evaluate(() => {
  const s = window.spel; const e = document.getElementById('einde');
  return { uitslag: s.strijd.uitslag(), koning: !!s.strijd.koning(), hut: s.strijd.hut(), tijd: s.doel ? s.doel.stand().tijd : null, einde: !e.hidden, tekst: document.getElementById('einde-tekst').textContent };
});
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
// Winnen: de hut gehouden
await p.evaluate(() => { window.spel.doel.zetTijd(479.5); });   // sinds 0.72.1 komt dan het Stille Volk; de winst komt als Brandt verslagen is
await p.waitForTimeout(1500);
await p.evaluate(() => window.spel.strijd.beslis('gewonnen'));
await p.waitForTimeout(1500);
let s = await stand();
check('level 4 gewonnen', s.uitslag === 'gewonnen' && s.einde, JSON.stringify(s));
await p.waitForTimeout(11500);   // de stand wordt om de tien seconden bewaard
// Opnieuw spelen: herladen met de bewaarde, gewonnen stand
await p.evaluate(() => sessionStorage.setItem('burcht-banier.geenTitel', '1'));
await p.reload(); await wacht(); await p.waitForTimeout(2000);
s = await stand();
check('na herladen staat de koning er nog', s.koning, JSON.stringify(s));
// Start over
await p.tap('#einde-opnieuw'); await p.waitForTimeout(2000);
s = await stand();
check('na Start over geen uitslag', s.uitslag === null, JSON.stringify(s));
check('na Start over de koning terug', s.koning, JSON.stringify(s));
check('na Start over het eindscherm weg', !s.einde, JSON.stringify(s));
check('na Start over de hut heel', s.hut && s.hut.staat && !s.hut.gevallen && s.hut.leven === s.hut.max, JSON.stringify(s.hut));
check('klok van het level begint opnieuw', s.tijd !== null && s.tijd < 10, s.tijd);
// Het spel loopt echt door
await p.waitForTimeout(3000);
s = await stand();
check('3 s later nog steeds geen defeat', s.uitslag === null && !s.einde && s.koning, JSON.stringify(s));
check('klok loopt', s.tijd > 1, s.tijd);
// Nog een keer winnen en weer opnieuw (de lus mag nergens terugkomen)
await p.evaluate(() => { window.spel.doel.zetTijd(479.5); });   // sinds 0.72.1 komt dan het Stille Volk; de winst komt als Brandt verslagen is
await p.waitForTimeout(1500);
await p.evaluate(() => window.spel.strijd.beslis('gewonnen'));
await p.waitForTimeout(1500);
s = await stand();
check('tweede keer gewonnen', s.uitslag === 'gewonnen', JSON.stringify(s));
await p.tap('#einde-opnieuw'); await p.waitForTimeout(2000);
s = await stand();
check('tweede Start over werkt ook', s.uitslag === null && s.koning && !s.einde, JSON.stringify(s));
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`opnieuw_na_winst71: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
