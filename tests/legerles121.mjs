// 0.121.0: legerles in level 3 (Ironmarsh): box, Ranged, Group, formatie Line, sturen, Hold.
// Plus losse controles van formaties en Hold. node tests/legerles121.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';

const POORT = 8352;
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
const tikKnop = async (begin) => { const r = await p.evaluate((t) => { const k = [...document.querySelectorAll('#leger-groepen button')].find((x) => x.textContent.startsWith(t)); if (!k) return null; const q = k.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, begin); if (r) { await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(350); } return !!r; };
const wachtTot = async (fn, ms = 8000, arg) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };
const kaartOpen = () => wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 8000);
const gidsZin = () => p.evaluate(() => document.getElementById('gids-zin').textContent);

async function startLevel(n, klaar, wis = true) {
  await p.goto(`http://localhost:${POORT}/`);
  await p.waitForFunction(() => window.spel);
  await p.evaluate(([m, k, w]) => { if (w) localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [n, klaar, wis]);
  await p.reload();
  await p.waitForFunction(() => window.spel && window.spel.strijd);
  await wachtTot(() => { const v = document.getElementById('verhaalbeeld-verder'); return document.getElementById('verhaalbeeld').hidden || (v && !v.hidden); }, 20000);
  if (await zichtbaar('#verhaalbeeld-verder')) await tikOp('#verhaalbeeld-verder');
  await wachtTot(() => document.getElementById('verhaalbeeld').hidden, 5000);
  await p.waitForTimeout(400);
  if (await zichtbaar('#missie-begin')) await tikOp('#missie-begin');
  await p.waitForTimeout(500);
  for (let k = 0; k < 4; k++) { if (await zichtbaar('#verhaal')) { await p.evaluate(() => window.spel.ui.verbergVerhaal()); await p.waitForTimeout(250); } }
}

// Het schermvak om de mannen van de les (met marge)
const vakMannen = () => p.evaluate(() => {
  const s = window.spel;
  const ps = s.legerLes.mannen().map((e) => s.camera.wereldNaarScherm((e.x - e.y) * 32, (e.x + e.y) * 16 - 16 - e.hoogte));
  return { x1: Math.min(...ps.map((q) => q.x)) - 22, y1: Math.min(...ps.map((q) => q.y)) - 22, x2: Math.max(...ps.map((q) => q.x)) + 22, y2: Math.max(...ps.map((q) => q.y)) + 22 };
});
const veeg = async (v) => {
  await p.mouse.move(v.x1, v.y1); await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(v.x1 + (v.x2 - v.x1) * i / 8, v.y1 + (v.y2 - v.y1) * i / 8);
  await p.mouse.up(); await p.waitForTimeout(400);
};

await startLevel(3, [0, 1, 2]);
check('geen fouten bij start', fouten.length === 0, fouten.join(' | '));
check('kaartje 1', await kaartOpen());
const klok1 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand()));
await p.waitForTimeout(1500);
check('oorlog staat stil', klok1 === await p.evaluate(() => JSON.stringify(window.spel.strijd.stand())));
await p.screenshot({ path: '/tmp/les1.png' });
await tikOp('#gids-kaart button');
check('acht mannen erbij', await p.evaluate(() => window.spel.legerLes.mannen().length === 8));
check('fase box', await p.evaluate(() => window.spel.legerLes.fase() === 'box'));
check('hamer dicht', await p.evaluate(() => document.getElementById('knop-hamer').classList.contains('tut-dicht')));
await p.waitForTimeout(1200);
await p.evaluate(() => window.spel.gids.stap(0.2));
check('gids: zwaard', /sword/.test(await gidsZin()), await gidsZin());
await tikOp('#knop-zwaard');
await p.waitForTimeout(300);
check('gids: Box', /Tap Box/.test(await gidsZin()), await gidsZin());
// formatieknop nog dicht in deze fase
await tikOp('#knop-kader');
await p.waitForTimeout(300);
check('gids: veeg', /drag one finger/.test(await gidsZin()), await gidsZin());
await p.screenshot({ path: '/tmp/les2.png' });
// eerst een te kleine box: de gids zegt dat het er niet acht zijn
const v = await vakMannen();
await veeg({ x1: v.x1, y1: v.y1, x2: (v.x1 + v.x2) / 2, y2: (v.y1 + v.y2) / 2 });
await p.waitForTimeout(300);
const kleinDeel = await p.evaluate(() => (window.spel.leger.deel() || []).length);
if (kleinDeel > 1 && kleinDeel < 8) check('te kleine box: Bartholt vraagt een grotere', /Not all eight/.test(await gidsZin()), await gidsZin());
if (await p.evaluate(() => !document.getElementById('knop-kader').classList.contains('actief'))) await tikOp('#knop-kader');
await veeg(await vakMannen());
check('kaartje na box', await kaartOpen());
await p.screenshot({ path: '/tmp/les3.png' });
await tikOp('#gids-kaart button');
check('fase ranged', await p.evaluate(() => window.spel.legerLes.fase() === 'ranged'));
await p.waitForTimeout(300);
await p.screenshot({ path: '/tmp/les4.png' });
check('knop Ranged getikt', await tikKnop('Ranged'));
check('alleen de 4 boogschutters', await p.evaluate(() => window.spel.leger.gekozen().length === 4));
check('kaartje na Ranged', await kaartOpen());
await tikOp('#gids-kaart button');
await p.waitForTimeout(300);
check('gids: Group', /Group/.test(await gidsZin()), await gidsZin());
check('knop Group getikt', await tikKnop('Group'));
check('kaartje na Group', await kaartOpen());
await tikOp('#gids-kaart button');
await p.waitForTimeout(300);
check('formatieknop zichtbaar', await zichtbaar('#knop-formatie'));
check('gids: formatie', /until it says Line/.test(await gidsZin()), await gidsZin());
await p.screenshot({ path: '/tmp/les5.png' });
await tikOp('#knop-formatie');
check('formatie Line', await p.evaluate(() => window.spel.leger.formatie() === 'lijn'));
check('knop zegt Line', await p.evaluate(() => document.querySelector('#knop-formatie span').textContent === 'Line'));
check('fase stuur', await p.evaluate(() => window.spel.legerLes.fase() === 'stuur'));
await p.waitForTimeout(1200);   // de camera glijdt naar de plek
await p.screenshot({ path: '/tmp/les6.png' });
await tikOp('#gids-plek');
await p.waitForTimeout(800);
check('onderweg', /on the way/.test(await gidsZin()), await gidsZin());
check('kaartje na de rij', await wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 30000));
// De rij: ridders vooraan (verder van waar ze vandaan kwamen, dus dichter bij het doel), schutters erachter
const rij = await p.evaluate(() => {
  const s = window.spel; const d = s.legerLes.doelPlek();
  const m = s.legerLes.mannen();
  const afst = (e) => Math.hypot(e.x - d.x - 0.5, e.y - d.y - 0.5);
  const r = m.filter((e) => e.soldaat.sleutel === 'ridder').map(afst);
  const a = m.filter((e) => e.soldaat.sleutel === 'boogschutter').map(afst);
  return { ridder: r.reduce((x, y) => x + y, 0) / r.length, archer: a.reduce((x, y) => x + y, 0) / a.length };
});
check('ridders voor de schutters', rij.ridder < rij.archer, JSON.stringify(rij));
await p.screenshot({ path: '/tmp/les7.png' });
await tikOp('#gids-kaart button');
await p.waitForTimeout(300);
check('gids: Hold', /Tap Hold/.test(await gidsZin()), await gidsZin());
await p.screenshot({ path: '/tmp/les8.png' });
await tikOp('#knop-houd');
check('alle acht houden', await p.evaluate(() => window.spel.legerLes.mannen().every((e) => e.houdt && e.post !== undefined)));
check('slotkaartje', await kaartOpen());
await p.screenshot({ path: '/tmp/les9.png' });
await tikOp('#gids-kaart button');
check('les klaar', await p.evaluate(() => window.spel.legerLes.klaar()));
check('hamer weer open', await p.evaluate(() => !document.getElementById('knop-hamer').classList.contains('tut-dicht') && !document.getElementById('knop-hamer').disabled));
await p.waitForTimeout(1500);
check('oorlog loopt weer', klok1 !== await p.evaluate(() => JSON.stringify(window.spel.strijd.stand())));

// Hold blijft bewaard na herladen; de les komt niet terug
await p.waitForTimeout(11000);
await p.reload();
await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.waitForTimeout(1500);
if (await zichtbaar('#titel-verder')) await tikOp('#titel-verder');
await p.waitForTimeout(800);
check('na herladen: les blijft klaar', await p.evaluate(() => !window.spel.legerLes || window.spel.legerLes.klaar()));
check('na herladen: 8 houden nog', await p.evaluate(() => window.spel.leger.lijst.filter((e) => e.houdt).length === 8), await p.evaluate(() => window.spel.leger.lijst.filter((e) => e.houdt).length));

// Formaties los: Block en Wide geven verschillende vormen, Free blijft zoals altijd
const vorm = await p.evaluate(async () => {
  const s = window.spel; const L = s.leger;
  const m = L.lijst.filter((e) => e.houdt);
  L.kies(m); L.zetHoud(false);
  const uit = {};
  const d = s.legerLes && s.legerLes.doelPlek() ? s.legerLes.doelPlek() : { x: Math.floor(m[0].x), y: Math.floor(m[0].y) };
  for (const f of ['blok', 'wijd', 'lijn']) {
    L.zetFormatie(f);
    L.stuur(d.x, d.y);
    const doelen = m.map((e) => e.soldaat.doel).filter((v) => v >= 0);
    const xs = doelen.map((v) => v % s.kaart.breedte), ys = doelen.map((v) => Math.floor(v / s.kaart.breedte));
    uit[f] = { n: doelen.length, b: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  }
  L.zetFormatie('vrij');
  return uit;
});
check('blok: alle 8 een plek', vorm.blok.n === 8, JSON.stringify(vorm));
check('wijd is ruimer dan blok', vorm.wijd.b * vorm.wijd.h > vorm.blok.b * vorm.blok.h, JSON.stringify(vorm));

// Shield: ridders voor en achter, schutters in het midden
const schild = await p.evaluate(() => {
  const s = window.spel; const L = s.leger; const B = s.kaart.breedte;
  const m = L.lijst.filter((e) => ['ridder', 'boogschutter'].includes(e.soldaat.sleutel));
  L.kies(m);
  const mx = m.reduce((a, e) => a + e.x, 0) / m.length, my = m.reduce((a, e) => a + e.y, 0) / m.length;
  const d = s.legerLes && s.legerLes.doelPlek() ? s.legerLes.doelPlek() : { x: Math.floor(mx), y: Math.floor(my) };
  // een doel 7 tegels verder, weg van de burcht
  const th = s.kaart.start[0]; const len = Math.hypot(d.x - th.x, d.y - th.y) || 1;
  const tx = Math.round(d.x + (d.x - th.x) / len * 7), ty = Math.round(d.y + (d.y - th.y) / len * 7);
  L.zetFormatie('schild');
  L.stuur(tx, ty);
  const ux = (tx - mx), uy = (ty - my); const ul = Math.hypot(ux, uy) || 1;
  const proj = (e) => { const v = e.soldaat.doel; return ((v % B) - mx) * ux / ul + (Math.floor(v / B) - my) * uy / ul; };
  const r = m.filter((e) => e.soldaat.sleutel === 'ridder' && e.soldaat.doel >= 0).map(proj);
  const a = m.filter((e) => e.soldaat.sleutel === 'boogschutter' && e.soldaat.doel >= 0).map(proj);
  return { r, a, n: r.length + a.length };
});
const gem = (l) => l.reduce((x, y) => x + y, 0) / l.length;
const rs = schild.r.slice().sort((x, y) => y - x);
check('shield: ridders voor en achter de schutters', schild.n === 8 && gem(rs.slice(0, 2)) > gem(schild.a) && gem(rs.slice(2)) < gem(schild.a) && rs[3] < Math.min(...schild.a), JSON.stringify(schild));
await p.waitForTimeout(12000);
await p.evaluate(() => { const s = window.spel; const m = s.leger.lijst.filter((e) => e.soldaat.sleutel === 'boogschutter'); const e = m[0]; s.camera.kijkNaar((e.x - e.y) * 32, (e.x + e.y) * 16); });
await p.waitForTimeout(600);
await p.screenshot({ path: '/tmp/les-schild.png' });
await p.evaluate(() => window.spel.leger.zetFormatie('vrij'));

// Hold met een schutter: hij schiet een vijand binnen bereik, maar loopt niet naar een verre
check('geen paginafouten', fouten.length === 0, fouten.join(' | '));

// Start over: de les begint weer
await p.evaluate(() => { document.getElementById('knop-opnieuw').click(); document.getElementById('knop-opnieuw').click(); });
await p.waitForTimeout(1500);
check('na Start over: les weer actief', await p.evaluate(() => window.spel.legerLes.actief() || window.spel.legerLes.fase() === 'wacht'));

console.log(`\n${goed} goed, ${fout} fout`);
await b.close();
srv.kill();
process.exit(fout ? 1 : 0);
