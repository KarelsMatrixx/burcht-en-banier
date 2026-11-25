// 0.116.0: handelles in level 1 (Witherheath): voorraadkamer bouwen, aantikken, hout verkopen.
// node tests/handelles116.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';

const POORT = 8341;
const srv = spawn('python3', ['-m', 'http.server', String(POORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let goed = 0;
let fout = 0;
const check = (naam, ok, extra = '') => { console.log(`${ok ? 'GOED' : 'FOUT'} ${naam} ${extra}`); ok ? goed++ : fout++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' });
const p = await ctx.newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(e.message));
const zichtbaar = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !!(e.offsetWidth || e.offsetHeight) && !e.closest('[hidden]'); }, sel);
const tikOp = async (sel) => { const r = await p.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, sel); await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(350); };
const wachtTot = async (fn, ms = 8000, arg) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };

async function startLevel(n, klaar) {
  await p.goto(`http://localhost:${POORT}/`);
  await p.waitForFunction(() => window.spel);
  await p.evaluate(([m, k]) => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [n, klaar]);
  await p.reload();
  await p.waitForFunction(() => window.spel && window.spel.strijd);
  await wachtTot(() => { const v = document.getElementById('verhaalbeeld-verder'); return document.getElementById('verhaalbeeld').hidden || (v && !v.hidden); }, 20000);
  if (await zichtbaar('#verhaalbeeld-verder')) await tikOp('#verhaalbeeld-verder');
  await wachtTot(() => document.getElementById('verhaalbeeld').hidden, 5000);
  await p.waitForTimeout(400);
  if (await zichtbaar('#missie-begin')) await tikOp('#missie-begin');
  await p.waitForTimeout(500);
  // eventuele berichten van de heer wegtikken
  for (let k = 0; k < 4; k++) { if (await zichtbaar('#verhaal')) { await p.evaluate(() => window.spel.ui.verbergVerhaal()); await p.waitForTimeout(250); } }
}


await startLevel(1, [0]);
check('geen fouten bij start', fouten.length === 0, fouten.join(' | '));
const voor = await p.evaluate(() => ({ ...window.spel.economie.voorraad }));
check('handelles: kaartje', await wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 6000));
const klok1 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand()));
await p.waitForTimeout(1500);
const klok2 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand()));
check('oorlog staat stil tijdens de les', klok1 === klok2);
await p.screenshot({ path: '/tmp/handel1.png' });
await tikOp('#gids-kaart button');
check('bouwdoel voorraadkamer met plek', await p.evaluate(() => { const d = window.spel.gids.doel(); return d && d.soort === 'bouw' && d.sleutel === 'voorraadkamer' && !!d.plek; }));
await tikOp('#knop-hamer');
const groep = await p.evaluate(() => { const k = document.querySelector('#bouw-knoppen [data-sleutel="voorraadkamer"]'); return k && k.dataset.groep; });
if (groep && await zichtbaar(`#bouw-knoppen [data-open="${groep}"]`)) await tikOp(`#bouw-knoppen [data-open="${groep}"]`);
await tikOp('#bouw-knoppen [data-sleutel="voorraadkamer"]');
const plek = await p.evaluate(() => window.spel.gids.doel().plek);
await p.evaluate(({ x, y }) => { const c = window.spel.camera; const w = { x: (x + 0.5 - (y + 0.5)) * 32, y: (x + 0.5 + y + 0.5) * 16 }; c.kijkNaar(w.x, w.y); }, plek);
await p.waitForTimeout(600);
await tikOp('#gids-plek');
if (await p.evaluate(() => document.getElementById('knop-hamer').classList.contains('plaats'))) await tikOp('#knop-hamer');
await p.waitForTimeout(600);
const gebouwd = await p.evaluate(() => !!(window.spel.bouwer.eigenBouwwerken().voorraadkamer || []).length);
check('voorraadkamer gebouwd', gebouwd, JSON.stringify(plek));
check('kaartje 2 (tik je voorraadkamer)', await wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 6000));
const houtVoorKar = await p.evaluate(() => window.spel.economie.voorraad.hout);
await tikOp('#gids-kaart button');
check('extra kar hout erbij', await p.evaluate((h) => window.spel.economie.voorraad.hout === h + 10, houtVoorKar));
check('doel: voorraad aantikken', await p.evaluate(() => window.spel.gids.doel().soort === 'voorraad'));
await p.waitForTimeout(500);
await tikOp('#gids-plek');
await p.screenshot({ path: '/tmp/handel_na_tik.png' });
check('handelpaneel open', await wachtTot(() => { const e = document.getElementById('handelpaneel'); return e && !e.hidden; }, 3000));
await p.waitForTimeout(700);
await p.screenshot({ path: '/tmp/handel2.png' });
const goudVoor = await p.evaluate(() => window.spel.economie.voorraad.goud);
await p.waitForTimeout(300);
await tikOp('#handel-knoppen [data-verkoop="hout"]');
check('hout verkocht voor goud', await p.evaluate((g) => window.spel.economie.voorraad.goud >= g + 2 && window.spel.economie.aantalVerkocht() === 1, goudVoor));
check('kaartje 3', await wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 6000));
await p.screenshot({ path: '/tmp/handel3.png' });
await tikOp('#gids-kaart button');
check('les klaar', await p.evaluate(() => window.spel.handelLes.klaar()));
const na = await p.evaluate(() => ({ ...window.spel.economie.voorraad }));
for (const n of ['hout', 'steen', 'voedsel', 'planken', 'goud']) check(`na de les niet minder ${n}`, na[n] >= voor[n], `${voor[n]} -> ${na[n]}`);
await p.waitForTimeout(1200);
const klok3 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand()));
check('oorlog loopt weer', klok3 !== klok2);
// Bewaard: na herladen geen les meer
await p.evaluate(() => window.spel.economie && null);
await p.waitForTimeout(500);
await p.reload();
await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.waitForTimeout(2500);
check('na herladen geen les meer', await p.evaluate(() => !window.spel.handelLes || window.spel.handelLes.klaar()));
check('geen fouten', fouten.length === 0, fouten.join(' | '));
console.log(`\n${goed} goed, ${fout} fout`);
await b.close();
srv.kill();
process.exit(fout ? 1 : 0);
