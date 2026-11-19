// 0.71.1: in de hele game moet "Start over" werken na winst of nederlaag, ook na herladen. Nooit een defeat-lus.
// Per modus (campagne 1 tot 6, vrij spel) vier scenario's: winst of verlies, met of zonder herladen.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const wortel = new URL('..', import.meta.url).pathname;
const modi = [
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ naam: `level ${n}`, modus: { soort: 'campagne', missie: n }, klaar: Array.from({ length: n }, (_, i) => i) })),
  ...['rustig', 'normaal', 'zwaar', 'vrede'].map((p) => ({ naam: `vrij ${p}`, modus: { soort: 'vrij', profiel: p }, klaar: [] })),
];
const alleen = process.argv[2];   // bijv. "level 4"
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };

async function scenario(b, poort, m, uitkomst, herlaad) {
  const naam = `${m.naam} / ${uitkomst} / ${herlaad ? 'na herladen' : 'direct'}`;
  const p = await (await b.newContext({ viewport: { width: 859, height: 396 }, hasTouch: true })).newPage();
  await autoVerder(p);
  const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
  // Het verhaalbeeld wacht 10 s voor de knop; in de test duurt dat 50 ms.
  await p.addInitScript(() => { const st = window.setTimeout; window.setTimeout = (f, d, ...a) => st(f, d === 10000 ? 50 : d, ...a); });
  const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 25000 });
  const stand = () => p.evaluate(() => {
    const s = window.spel; const e = document.getElementById('einde');
    return { uitslag: s.strijd.uitslag(), koning: !!s.strijd.koning(), einde: !e.hidden, tekst: document.getElementById('einde-tekst').textContent.slice(0, 60) };
  });
  await p.goto(`http://localhost:${poort}/`); await wacht();
  await p.evaluate(({ modus, klaar }) => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify(modus));
    sessionStorage.setItem('burcht-banier.geenTitel', '1');
  }, m);
  await p.reload(); await wacht(); await p.waitForTimeout(300);
  const start = async () => {
    if (await p.evaluate(() => { const e = document.getElementById('missie-begin'); return !!e && e.offsetParent !== null; })) await p.tap('#missie-begin');
    await p.waitForTimeout(1200);
    await p.evaluate(() => { try { window.spel.ui.verbergVerhaal(); } catch (e) { /* niet erg */ } });
  };
  await start();
  // De uitslag
  if (uitkomst === 'winst') await p.evaluate(() => window.spel.strijd.beslis('gewonnen'));
  else await p.evaluate(() => { const k = window.spel.strijd.koning(); k.leven = 0; k.dood = true; });
  await p.waitForTimeout(1500);
  let s = await stand();
  check(`${naam}: uitslag staat`, s.uitslag === (uitkomst === 'winst' ? 'gewonnen' : 'verloren') && s.einde, JSON.stringify(s));
  if (herlaad) {
    await p.waitForTimeout(11500);   // bewaren om de tien seconden
    await p.evaluate(() => sessionStorage.setItem('burcht-banier.geenTitel', '1'));
    await p.reload(); await wacht(); await p.waitForTimeout(1800);
    await p.evaluate(() => { try { window.spel.ui.verbergVerhaal(); } catch (e) { /* niet erg */ } });
    s = await stand();
    // Na een herladen mag het eindscherm er staan (winst) of het spel gewoon lopen (verlies); in elk geval geen defeat zonder reden.
    if (!s.einde) { check(`${naam}: na herladen speelbaar met koning`, s.koning && s.uitslag === null, JSON.stringify(s)); await p.close(); return; }
  }
  await p.tap('#einde-opnieuw'); await p.waitForTimeout(2000);
  s = await stand();
  check(`${naam}: Start over geeft geen uitslag`, s.uitslag === null && !s.einde, JSON.stringify(s));
  check(`${naam}: Start over zet de koning terug`, s.koning, JSON.stringify(s));
  await p.waitForTimeout(3500);
  s = await stand();
  check(`${naam}: 3,5 s later nog steeds geen defeat`, s.uitslag === null && !s.einde && s.koning, JSON.stringify(s));
  check(`${naam}: geen scriptfouten`, fouten.length === 0, fouten.join(' | '));
  await p.close();
}

async function modus(i, m) {
  const poort = 8400 + i;
  const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: wortel, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  try {
    for (const uitkomst of ['winst', 'verlies']) for (const herlaad of [false, true]) await scenario(b, poort, m, uitkomst, herlaad);
  } catch (e) { check(`${m.naam}: test liep vast`, false, String(e).slice(0, 200)); }
  await b.close(); srv.kill();
}

const lijst = modi.map((m, i) => [i, m]).filter(([, m]) => !alleen || m.naam === alleen);
for (let i = 0; i < lijst.length; i += 3) await Promise.all(lijst.slice(i, i + 3).map(([k, m]) => modus(k, m)));
console.log(`opnieuw_alle_levels71: ${ok} goed, ${fout} fout`);
process.exit(fout ? 1 : 0);
