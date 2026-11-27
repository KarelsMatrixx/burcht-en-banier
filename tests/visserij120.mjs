// 0.120.0: vissershut in level 8 (visles na de havenles, bootje vaart uit, vist, komt terug, voedsel in de voorraad).
// node tests/visserij120.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';

const POORT = 8420;
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


const kaartjeOpen = () => wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 8000);

// Level 7: nog geen vissershut
await startLevel(7, [0, 1, 2, 3, 4, 5, 6]);
check('level 7: geen vissershut in het menu', await p.evaluate(() => !document.querySelector('#bouw-knoppen [data-sleutel="vissershut"]')));
check('level 7: geen visles', await p.evaluate(() => !window.spel.visLes));

await startLevel(8, [0, 1, 2, 3, 4, 5, 6, 7]);
check('geen fouten bij start', fouten.length === 0, fouten.join(' | '));
check('vissershut in het bouwmenu', await p.evaluate(() => !!document.querySelector('#bouw-knoppen [data-sleutel="vissershut"]')));
check('visles wacht op de havenles', await p.evaluate(() => window.spel.visLes && window.spel.visLes.fase() === 'wacht' && window.spel.havenLes.actief()));
// havenles overslaan
await p.evaluate(() => window.spel.havenLes.sla());
check('visles: kaartje na de havenles', await kaartjeOpen());
check('visles loopt', await p.evaluate(() => window.spel.visLes.actief()));
const k1 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand()));
await p.waitForTimeout(1500);
check('oorlog staat stil tijdens de visles', k1 === await p.evaluate(() => JSON.stringify(window.spel.strijd.stand())));
await tikOp('#gids-kaart button');
const doel = await p.evaluate(() => window.spel.gids.doel());
check('visles: bouwdoel vissershut met plek', doel && doel.soort === 'bouw' && doel.sleutel === 'vissershut' && !!doel.plek, JSON.stringify(doel));
// niet aan het water: geweigerd
const nietWater = await p.evaluate(() => { const s = window.spel.kaart.start[0]; return window.spel.bouwer.waaromNiet(s.x + 4, s.y + 4, window.spel.bouwwerken.vissershut); });
check('niet aan het water: reden', /water|already|someone/.test(nietWater), nietWater);
// bouwen via de knoppen
await tikOp('#knop-hamer');
const groep = await p.evaluate(() => { const k = document.querySelector('#bouw-knoppen [data-sleutel="vissershut"]'); return k && k.dataset.groep; });
if (groep && await zichtbaar(`#bouw-knoppen [data-open="${groep}"]`)) await tikOp(`#bouw-knoppen [data-open="${groep}"]`);
await tikOp('#bouw-knoppen [data-sleutel="vissershut"]');
const plek = doel.plek;
await p.evaluate(({ x, y }) => { const c = window.spel.camera; c.kijkNaar((x + 0.5 - (y + 0.5)) * 32, (x + 0.5 + y + 0.5) * 16); }, plek);
await p.waitForTimeout(600);
await tikOp('#gids-plek');
if (await p.evaluate(() => document.getElementById('knop-hamer').classList.contains('plaats'))) await tikOp('#knop-hamer');
await p.waitForTimeout(600);
const vak = plek.y * 0 + await p.evaluate(({ x, y }) => y * window.spel.kaart.breedte + x, plek);
check('vissershut gebouwd op de gouden plek', await p.evaluate((v) => window.spel.kaart.object[v] === 58 && window.spel.kaart.eigenaar[v] === 1, vak), JSON.stringify(plek));
check('visles: kaartje 2', await kaartjeOpen());
await p.screenshot({ path: '/home/claude/0120-hut.png' });
await tikOp('#gids-kaart button');
check('visles: kijken naar het bootje', await p.evaluate(() => window.spel.gids.doel().soort === 'kijk'));
check('een visser aan het werk', await wachtTot(() => window.spel.economie.aantalMetBeroep('visser') === 1, 8000));
const voedsel0 = await p.evaluate(() => window.spel.economie.voorraad.voedsel);
check('bootje vaart uit', await wachtTot(() => { const h = window.spel.visserij.hutten()[0]; return h && h.fase === 'uit' && h.pos > 1; }, 15000));
const posA = await p.evaluate(() => window.spel.visserij.bootje());
await p.waitForTimeout(1200);
const posB = await p.evaluate(() => window.spel.visserij.bootje());
check('bootje beweegt', Math.hypot(posA.x - posB.x, posA.y - posB.y) > 0.3, JSON.stringify([posA, posB]));
check('bootje vist op open water', await wachtTot(() => window.spel.visserij.hutten()[0].fase === 'vist', 30000));
const vp = await p.evaluate(() => { const h = window.spel.visserij.hutten()[0]; const K = window.spel.kaart; return { x: h.visplek.x, y: h.visplek.y, water: K.grond[Math.floor(h.visplek.y) * K.breedte + Math.floor(h.visplek.x)] === 3, schip: window.spel.staat.schepen().some((s) => s.visboot && s.vist) }; });
check('visplek is water, bootje in beeld als vissend', vp.water && vp.schip, JSON.stringify(vp));
await p.evaluate(({ x, y }) => { const c = window.spel.camera; c.kijkNaar((x - y) * 32, (x + y) * 16 - 20); }, vp);
await p.waitForTimeout(500);
await p.screenshot({ path: '/home/claude/0120-vissen.png' });
check('bootje komt terug', await wachtTot(() => window.spel.visserij.hutten()[0].fase === 'terug', 20000));
check('vangst in de voorraad, slotkaartje', await wachtTot(() => window.spel.visLes.fase() === 'kaart3', 30000));
const voedsel1 = await p.evaluate(() => window.spel.economie.voorraad.voedsel);
check('voedsel erbij (12, min wat er gegeten is)', voedsel1 - voedsel0 >= 8 || await p.evaluate(() => window.spel.visserij.gevangen() >= 12), `${voedsel0} -> ${voedsel1}, gevangen ${await p.evaluate(() => window.spel.visserij.gevangen())}`);
check('bootje terug aan zijn eigen hut', await p.evaluate(() => { const h = window.spel.visserij.hutten()[0]; const b = window.spel.visserij.bootje(); return Math.hypot(b.x - h.ligplaats.x, b.y - h.ligplaats.y) < 0.01; }));
await tikOp('#gids-kaart button');
check('visles klaar, oorlog loopt weer', await p.evaluate(() => window.spel.visLes.klaar() && !window.spel.visLes.actief()));
// tweede tocht: normale vistijd
check('tweede tocht vertrekt', await wachtTot(() => window.spel.visserij.hutten()[0].fase === 'uit', 15000));
// golf op zee: bootje keert om en blijft aan wal
await p.evaluate(() => { const d = window.spel.doel; const oud = d.stand; d.stand = () => ({ ...oud(), onderweg: 2 }); window.__oud = oud; });
check('golf op zee: bootje keert om', await wachtTot(() => window.spel.visserij.hutten()[0].fase === 'terug' || window.spel.visserij.hutten()[0].fase === 'thuis', 3000));
await wachtTot(() => window.spel.visserij.hutten()[0].fase === 'thuis', 20000);
await p.waitForTimeout(6000);
check('golf op zee: bootje blijft aan wal', await p.evaluate(() => window.spel.visserij.hutten()[0].fase === 'thuis'));
await p.evaluate(() => { window.spel.doel.stand = window.__oud; });
check('na de golf: weer uit', await wachtTot(() => window.spel.visserij.hutten()[0].fase === 'uit', 12000));
// tegelinfo
check('tegelinfo noemt het bootje', /boat/.test(await p.evaluate((v) => window.spel.visserij.beschrijf(v), vak)));
// herladen: les blijft klaar, hut terug met bootje
await p.waitForTimeout(10500);
await p.reload();
await p.waitForFunction(() => window.spel && window.spel.visserij);
await p.waitForTimeout(1500);
if (await zichtbaar('#titel-verder')) await tikOp('#titel-verder');
check('na herladen: hut en bootje terug', await p.evaluate(() => window.spel.visserij.hutten().length === 1));
check('na herladen: visles blijft klaar', await p.evaluate(() => !window.spel.visLes || window.spel.visLes.klaar()));
check('geen fouten', fouten.length === 0, fouten.join(' | '));

console.log(`\n${goed} goed, ${fout} fout`);
await b.close();
srv.kill();
process.exit(fout ? 1 : 0);
