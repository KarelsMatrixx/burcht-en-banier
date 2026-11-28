// 0.125.0: heldenles in level 9 (Mourngate): Rutger gratis, Berserker, de heldenzaal.
// node tests/heldenles125.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';

const POORT = 8351;
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



const kaartOpen = () => wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 8000);
const kijk = async (pl) => { await p.evaluate(({ x, y }) => { const c = window.spel.camera; c.kijkNaar((x + 0.5 - (y + 0.5)) * 32, (x + 0.5 + y + 0.5) * 16); }, pl); await p.waitForTimeout(500); };
async function kies(sleutel) {
  if (await zichtbaar('#tip-sluit')) await tikOp('#tip-sluit');
  if (!(await zichtbaar('#bouw-knoppen'))) await tikOp('#knop-hamer');
  const groep = await p.evaluate((s) => { const k = document.querySelector(`#bouw-knoppen [data-sleutel="${s}"]`); return k && k.dataset.groep; }, sleutel);
  if (!(await zichtbaar(`#bouw-knoppen [data-sleutel="${sleutel}"]`)) && groep) await tikOp(`#bouw-knoppen [data-open="${groep}"]`);
  await tikOp(`#bouw-knoppen [data-sleutel="${sleutel}"]`);
}
const zin = () => p.evaluate(() => document.getElementById('gids-zin').textContent);
const fase = () => p.evaluate(() => window.spel.heldenLes && window.spel.heldenLes.fase());

await startLevel(9, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
check('kaartje 1 van Bartholt', await kaartOpen());
const k1 = await p.evaluate(() => document.getElementById('gids-kaart').textContent);
check('kaartje: Rutger gratis', /costs you nothing/.test(k1), k1.slice(0, 80));
const gratis = await p.evaluate(() => { const h = window.spel.leger.held(); return h && h.soldaat.sleutel; });
check('Rutger staat er gratis', gratis === 'rutger', gratis);
const klok1 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand().klok || window.spel.strijd.stand()));
await tikOp('#gids-kaart button');
await p.waitForTimeout(1400);
check('fase kies', (await fase()) === 'kies', await fase());
// Hamer is dicht: bouwen mag nog niet
const bouwDicht = await p.evaluate(() => { const b = document.querySelectorAll('#bouw-knoppen [data-sleutel]'); return [...b].every((k) => k.classList.contains('tut-dicht') || k.hidden || k.disabled); });
check('bouwbalk dicht tijdens kies', bouwDicht);
// Rutger aantikken via de gouden plek
await p.evaluate(() => { const r = window.spel.leger.held(); const c = window.spel.camera; c.kijkNaar((r.x - r.y) * 32, (r.x + r.y) * 16); });
await p.waitForTimeout(500);
await p.screenshot({ path: '/home/claude/les1.png' });
const rp = await p.evaluate(async () => { const r = window.spel.leger.held(); const c = window.spel.camera; const sc = c.wereldNaarScherm((r.x - r.y) * 32, (r.x + r.y) * 16 - 14); const q = document.querySelector('canvas').getBoundingClientRect(); return { x: q.left + sc.x, y: q.top + sc.y }; });
await p.touchscreen.tap(rp.x, rp.y);
await p.waitForTimeout(700);
check('Rutger gekozen, fase ability', (await fase()) === 'ability', await fase());
check('abilityknop Berserker zichtbaar', await zichtbaar('#knop-held'), await p.evaluate(() => document.getElementById('knop-held').textContent));
check('gids wijst naar Berserker', /Berserker/.test(await zin()), await zin());
await p.screenshot({ path: '/home/claude/les2.png' });
await tikOp('#knop-held');
check('kaartje over de heldenzaal', await kaartOpen());
check('Berserker gebruikt', await p.evaluate(() => window.spel.strijd.heldStand(window.spel.leger.held()).wacht > 0));
const voor = await p.evaluate(() => ({ ...window.spel.economie.voorraad }));
await tikOp('#gids-kaart button');
await p.waitForTimeout(1200);
check('fase zaal', (await fase()) === 'zaal', await fase());
const zaal = await p.evaluate(() => window.spel.heldenLes.zaal());
await kies('heldenzaal');
await kijk(zaal);
await tikOp('#gids-plek');
await tikOp('#knop-hamer');
await p.waitForTimeout(700);
check('zaal gebouwd, fase tikzaal', (await fase()) === 'tikzaal', await fase());
const na = await p.evaluate(() => ({ ...window.spel.economie.voorraad }));
check('zaal kostte de speler niets', na.planken === voor.planken && na.steen === voor.steen, JSON.stringify([voor.planken, na.planken, voor.steen, na.steen]));
await kijk(zaal);
await tikOp('#gids-plek');
await p.waitForTimeout(700);
check('heldenpaneel open', await zichtbaar('.held-kaart'));
check('slotkaartje', await kaartOpen());
await p.screenshot({ path: '/home/claude/les3.png' });
await tikOp('#gids-kaart button');
await p.waitForTimeout(500);
check('les klaar', (await fase()) === 'klaar', await fase());
const bewaard = await (async () => { await p.waitForTimeout(500); return p.evaluate(() => { const s = Object.keys(localStorage).map((k) => localStorage.getItem(k)).find((v) => v && v.includes('"heldenLes"')); return s ? /"heldenLes":true/.test(s) : null; }); })();
check('les gedaan wordt bewaard', bewaard === true, bewaard);
check('geen paginafouten', fouten.length === 0, fouten.slice(0, 3).join(' | '));
console.log(`\n${goed} goed, ${fout} fout`);
await b.close();
srv.kill();
process.exit(fout ? 1 : 0);
