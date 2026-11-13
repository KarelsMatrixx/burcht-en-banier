// Stap 35: de adviseur met logboek, meldingen per soort, en de bediening rechtsonder.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8235;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => {
  localStorage.clear(); sessionStorage.clear();
  localStorage.setItem('tipGesloten', '1');
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(400);

// Plaatjes geladen
const plaatjes = await p.evaluate(() => [...document.querySelectorAll('#bedien img, #adviseur img, #knop-instellingen img')].every((i) => i.complete && i.naturalWidth > 0));
check('alle plaatjes van de bediening geladen', plaatjes);

// Bij het begin is er niets open
check('bouwbalk dicht bij begin', await p.isHidden('#bouw-knoppen'));
check('legerbalk dicht bij begin', await p.isHidden('#leger-balk'));

// Hamer en zwaard
await p.tap('#knop-hamer');
check('hamer opent bouwbalk', await p.isVisible('#bouw-knoppen'));
await p.tap('#knop-zwaard');
check('zwaard sluit bouwbalk', await p.isHidden('#bouw-knoppen'));
check('zwaard opent legerknoppen (de koning is er altijd)', await p.isVisible('#leger-balk'));
await p.tap('#knop-zwaard');
check('zwaard nog eens: dicht', await p.isHidden('#leger-balk'));

// Buidel opent het paneel van je volk, rol het menu
await p.tap('#knop-buidel');
check('buidel opent volk', await p.isVisible('#volkpaneel'));
await p.tap('#knop-buidel');
check('buidel nog eens: dicht', await p.isHidden('#volkpaneel'));

// Meldingen: soort en of ze in beeld komen
const tel = () => p.evaluate(() => document.getElementById('meldingen').children.length);
await p.evaluate(() => { document.getElementById('meldingen').textContent = ''; });
const voor = await p.evaluate(() => window.spel.ui.logboek().length);
await p.evaluate(() => window.spel.ui.toonMelding('A sawyer is waiting for wood.', { soort: 'economie' }));
check('economie: stil', (await tel()) === 0);
await p.evaluate(() => window.spel.ui.toonMelding('Attack 1! 3 enemies are coming.', { soort: 'vijand' }));
check('vijand: in beeld', (await tel()) === 1);
await p.evaluate(() => window.spel.ui.toonMelding('The food has run out.', { soort: 'economie', toon: true }));
check('dringende economie: in beeld', (await tel()) === 2);
await p.evaluate(() => window.spel.ui.toonMelding('Your soldiers cannot get there.', { soort: 'leger' }));
check('hooguit twee in beeld', (await tel()) === 2);
const log = await p.evaluate(() => window.spel.ui.logboek());
check('alles in het logboek', log.length === voor + 4, JSON.stringify(log.slice(-4)));
check('soorten kloppen', log.slice(-4).map((r) => r.soort).join() === 'economie,vijand,economie,leger', JSON.stringify(log.slice(-4)));
check('teller staat aan', await p.isVisible('#adviseur-teller'));

// Het logboek
await p.tap('#adviseur');
check('logboek open', await p.isVisible('#logboek'));
check('teller weg als logboek open', await p.isHidden('#adviseur-teller'));
const regels = await p.evaluate(() => document.querySelectorAll('#logboek-lijst .log-regel').length);
check('regels in het logboek', regels >= 4, regels);
const eerste = await p.evaluate(() => document.querySelector('#logboek-lijst .log-regel span').textContent);
check('nieuwste bovenaan', /cannot get there/.test(eerste), eerste);
await p.tap('.log-filter[data-soort="vijand"]');
const alleenVijand = await p.evaluate(() => [...document.querySelectorAll('#logboek-lijst .log-regel')].every((r) => r.classList.contains('soort-vijand')));
check('filter: alleen vijand', alleenVijand);
check('filtertekst', /Enemy/.test(await p.textContent('.log-filtertekst')));
await p.tap('#adviseur');
check('logboek dicht', await p.isHidden('#logboek'));

// Een verhaalbericht zet het portret van de adviseur
await p.evaluate(() => window.spel.ui.toonVerhaal({ naam: 'Lady Mechteld Sevenwinds', portret: 'mechteld', tekst: 'Nobody passes Sevenwinds.' }));
check('adviseur toont spreker', /mechteld\.jpg/.test(await p.getAttribute('#adviseur-portret', 'src')));
check('verhaal in logboek', (await p.evaluate(() => window.spel.ui.logboek().at(-1).soort)) === 'verhaal');
await p.tap('#verhaal');
check('adviseur terug naar Bartholt', /bartholt\.jpg/.test(await p.getAttribute('#adviseur-portret', 'src')));

// Het oog: alles plat
check('oog zichtbaar', await p.isVisible('#knop-oog'));
await p.tap('#knop-oog');
check('oog zet doorzicht aan', await p.evaluate(() => window.spel.tekenaar.doorzicht()) === true);
check('oog knop actief', (await p.getAttribute('#knop-oog', 'aria-pressed')) === 'true');
await p.waitForTimeout(300);
await p.screenshot({ path: '/home/claude/stap35-oog.png' });
await p.tap('#knop-oog');
check('oog nog eens: uit', await p.evaluate(() => window.spel.tekenaar.doorzicht()) === false);
// Instellingen achter het tandwiel
await p.tap('#knop-instellingen');
check('tandwiel opent instellingen', await p.isVisible('#instellingen') && /v0\./.test(await p.textContent('#versie')));
await p.screenshot({ path: '/home/claude/stap35-hud.png' });

console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
