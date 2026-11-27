// 0.124.0: bouwles in level 1 (Witherheath): muur, poort, toren, slopen.
// node tests/bouwles124.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';

const POORT = 8347;
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

const kaartOpen = () => wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 6000);
const kijk = async (pl) => { await p.evaluate(({ x, y }) => { const c = window.spel.camera; c.kijkNaar((x + 0.5 - (y + 0.5)) * 32, (x + 0.5 + y + 0.5) * 16); }, pl); await p.waitForTimeout(500); };
const doel = () => p.evaluate(() => { const d = window.spel.gids.doel(); return d && { soort: d.soort, sleutel: d.sleutel, plek: d.plek }; });
// Kies een bouwwerk via de bouwbalk, zoals de gids het aanwijst
async function kies(sleutel) {
  if (await zichtbaar('#tip-sluit')) await tikOp('#tip-sluit');
  if (!(await zichtbaar('#bouw-knoppen'))) await tikOp('#knop-hamer');
  const groep = await p.evaluate((s) => { const k = document.querySelector(`#bouw-knoppen [data-sleutel="${s}"]`); return k && k.dataset.groep; }, sleutel);
  if (!(await zichtbaar(`#bouw-knoppen [data-sleutel="${sleutel}"]`)) && groep) await tikOp(`#bouw-knoppen [data-open="${groep}"]`);
  await tikOp(`#bouw-knoppen [data-sleutel="${sleutel}"]`);
}
const tikPlek = async (pl) => { await kijk(pl); await p.waitForTimeout(300); await tikOp('#gids-plek'); };

await startLevel(1, [0]);
check('geen fouten bij start', fouten.length === 0, fouten.join(' | '));
check('handelles kaartje', await kaartOpen());
await p.evaluate(() => window.spel.handelLes.sla());
const voor = await p.evaluate(() => ({ ...window.spel.economie.voorraad }));
check('bouwles: kaartje 1', await kaartOpen());
const klok1 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand()));
await p.waitForTimeout(1200);
check('oorlog staat stil', klok1 === await p.evaluate(() => JSON.stringify(window.spel.strijd.stand())));
await p.screenshot({ path: '/tmp/bouw1.png' });
await tikOp('#gids-kaart button');
const pl = await p.evaluate(() => window.spel.bouwLes.plekken());
check('doel muur', (await doel()).sleutel === 'muur', JSON.stringify(pl));
// Andere bouwwerken zijn dicht
check('woning dicht', await p.evaluate(() => { const k = document.querySelector('#bouw-knoppen [data-sleutel="woning"]'); return !k || k.disabled; }));
await kies('muur');
// Een tik naast de plek telt niet
await p.evaluate(({ x, y }) => window.spel.bouw && 0, pl.begin);
await tikPlek(pl.begin);
check('begin gezet', await p.evaluate(() => !!document.getElementById('knop-hamer')));
await p.screenshot({ path: '/tmp/bouw2.png' });
// De hamer na alleen het begin: niets
await tikOp('#knop-hamer');
check('geen los stuk na hamer zonder eind', await p.evaluate(() => !(window.spel.bouwer.eigenBouwwerken().muur || []).length));
await tikPlek(pl.eind);
await p.screenshot({ path: '/tmp/bouw3.png' });
const zin = await p.evaluate(() => document.getElementById('gids-zin').textContent);
check('gids zegt hamer', /hammer/.test(zin), zin);
await tikOp('#knop-hamer');
await p.waitForTimeout(500);
check('vijf stukken muur', await p.evaluate(() => (window.spel.bouwer.eigenBouwwerken().muur || []).length === 10));
check('kaartje poort', await kaartOpen());
await tikOp('#gids-kaart button');
check('doel poort', (await doel()).sleutel === 'poort');
await kies('poort');
await tikPlek(pl.poort);
await p.screenshot({ path: '/tmp/bouwP.png' });
await tikOp('#knop-hamer');
await p.waitForTimeout(500);
check('poort gebouwd', await p.evaluate(() => (window.spel.bouwer.eigenBouwwerken().poort || []).length === 2));
check('kaartje toren', await kaartOpen());
await tikOp('#gids-kaart button');
await kies('wachttoren');
await tikPlek(pl.toren);
await tikOp('#knop-hamer');
await p.waitForTimeout(500);
check('toren gebouwd', await p.evaluate(() => (window.spel.bouwer.eigenBouwwerken().wachttoren || []).length === 2));
check('kaartje slopen', await kaartOpen());
check('los stuk staat er', await p.evaluate(({ x, y }) => window.spel.kaart.object[y * window.spel.kaart.breedte + x] === 4, pl.los));
await p.screenshot({ path: '/tmp/bouw4.png' });
await tikOp('#gids-kaart button');
await kies('sloop');
await p.screenshot({ path: '/tmp/bouw5.png' });
// De muur zelf slopen mag niet
await kijk(pl.begin);
await tikPlek(pl.los);
await p.screenshot({ path: '/tmp/bouw6.png' });
await tikOp('#knop-hamer');
await p.waitForTimeout(500);
check('los stuk weg', await p.evaluate(({ x, y }) => window.spel.kaart.object[y * window.spel.kaart.breedte + x] !== 4, pl.los));
check('muur staat nog', await p.evaluate(() => (window.spel.bouwer.eigenBouwwerken().muur || []).length === 8));
check('kaartje klaar', await kaartOpen());
await p.screenshot({ path: '/tmp/bouw7.png' });
await tikOp('#gids-kaart button');
check('les klaar', await p.evaluate(() => window.spel.bouwLes.klaar()));
const na = await p.evaluate(() => ({ ...window.spel.economie.voorraad }));
for (const n of ['hout', 'steen', 'planken', 'goud']) check(`na de les niet minder ${n}`, na[n] >= voor[n], `${voor[n]} -> ${na[n]}`);
check('bouwbalk weer open', await p.evaluate(() => { const k = document.querySelector('#bouw-knoppen [data-sleutel="woning"]'); return !k || !k.disabled; }));
await p.waitForTimeout(11000);
await p.reload();
await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.waitForTimeout(2500);
check('na herladen geen les', await p.evaluate(() => !window.spel.bouwLes || window.spel.bouwLes.klaar()));
check('geen fouten', fouten.length === 0, fouten.join(' | '));
console.log(`\n${goed} goed, ${fout} fout`);
await b.close();
srv.kill();
process.exit(fout ? 1 : 0);
