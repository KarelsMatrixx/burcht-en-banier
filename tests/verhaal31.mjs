// Stap 31: briefing met portretten, verhaalbalk op momenten, terugblik met Wessel.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8231;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
const url = `http://localhost:${poort}/`;

await p.goto(url); await wacht();
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 2 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(500);

// Briefing
check('briefing open', await p.isVisible('#missie'));
check('verteller Bartholt', /Bartholt/.test(await p.textContent('#missie-wie')), await p.textContent('#missie-wie'));
check('portret verteller', /bartholt\.jpg/.test(await p.getAttribute('#missie-portret', 'src') || ''));
check('heer Mechteld', /Mechteld/.test(await p.textContent('#missie-heer-naam')) && /mechteld\.jpg/.test(await p.getAttribute('#missie-heer', 'src') || ''));
const extra = await p.textContent('#missie-extra');
check('extra: nieuw en kaart', /New for you: Copper Mine/.test(extra) && /Map: The Two Lakes/.test(extra), extra);
const geladen = await p.evaluate(() => [...document.querySelectorAll('#missie img')].filter((i) => !i.hidden).every((i) => i.complete && i.naturalWidth > 0));
check('portretten geladen', geladen);
await p.screenshot({ path: '/home/claude/stap31-briefing.png' });

// Geen bericht zolang de briefing open is
await p.waitForTimeout(1200);
check('geen bericht tijdens briefing', await p.isHidden('#verhaal'));
await p.tap('#missie-begin');

// Bericht op tijd (na 15 s spelen)
await p.waitForFunction(() => !document.getElementById('verhaal').hidden, null, { timeout: 25000 });
check('bericht Bartholt', /Bartholt/.test(await p.textContent('#verhaal-wie')) && /archers/.test(await p.textContent('#verhaal-tekst')), await p.textContent('#verhaal-tekst'));
await p.waitForTimeout(500); await p.screenshot({ path: '/home/claude/stap31-balk.png' });
await p.tap('#verhaal');
await p.waitForTimeout(200);
check('tik haalt weg', await p.isHidden('#verhaal'));

// Rode burcht onder 50%: bericht van de heer
const kanRood = await p.evaluate(() => {
  const k = window.spel.strijd.koning(1);
  if (!k) return false;
  k.leven = Math.floor(k.levenMax * 0.4);
  return true;
});
check('rode koning bestaat', kanRood);
await p.waitForFunction(() => !document.getElementById('verhaal').hidden, null, { timeout: 5000 }).catch(() => {});
const t2 = await p.textContent('#verhaal-tekst');
check('bericht rode koning', /so few men/.test(t2), t2);
check('portret heer in balk', /mechteld\.jpg/.test(await p.getAttribute('#verhaal-portret', 'src') || ''));

// Na herladen komen getoonde berichten niet terug
const voor = await p.evaluate(() => JSON.parse(localStorage.getItem('burcht-banier.verhaal.2') || '[]').length);
check('onthouden', voor >= 2, voor);

// Winnen: terugblik met portret heer, Wessel en beloning
await p.evaluate(() => { window.spel.strijd.koning(1).dood = true; });
await p.waitForTimeout(1500);
check('einde portret heer', /mechteld\.jpg/.test(await p.getAttribute('#einde-portret', 'src') || ''));
check('Wessel-blok', await p.isVisible('#einde-wessel') && /charcoal/.test(await p.textContent('#einde-wessel-tekst')));
check('beloning', /Unlocked: Crossbowman/.test(await p.textContent('#einde-erbij')));
check('balk weg bij einde', await p.isHidden('#verhaal'));
await p.screenshot({ path: '/home/claude/stap31-einde.png' });

// Opnieuw beginnen wist het geheugen
await p.tap('#einde-opnieuw');
await p.waitForTimeout(400);
const na = await p.evaluate(() => JSON.parse(localStorage.getItem('burcht-banier.verhaal.2') || '[]').length);
check('opnieuw wist berichten', na === 0, na);

// Vrij spel: geen briefing, geen berichten
await p.evaluate(() => { localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'vrij', profiel: 'normaal' })); });
await p.reload(); await wacht(); await p.waitForTimeout(800);
check('vrij spel: geen briefing', await p.isHidden('#missie'));
check('vrij spel: geen balk', await p.isHidden('#verhaal'));

console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
