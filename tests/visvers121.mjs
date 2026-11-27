// 0.121.1: geen NaN en de visles eindigt, ook met een oud data/economie.json zonder vis (uit de cache),
// en ook als de voorraad vis vol is.
// node tests/visvers121.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';

const POORT = 8421;
const srv = spawn('python3', ['-m', 'http.server', String(POORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let goed = 0;
let fout = 0;
const check = (naam, ok, extra = '') => { console.log(`${ok ? 'GOED' : 'FOUT'} ${naam} ${extra}`); ok ? goed++ : fout++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' });
const p = await ctx.newPage();
// Oud gegevensbestand: geen grondstof vis, vis niet in opslag of eten (zoals 0.120.0).
await p.route('**/data/economie.json', async (route) => {
  const r = await route.fetch();
  const d = await r.json();
  delete d.grondstoffen.vis;
  d.opslag.grondstoffen = d.opslag.grondstoffen.filter((n) => n !== 'vis');
  d.bevolking.eet = d.bevolking.eet.filter((n) => n !== 'vis');
  route.fulfill({ response: r, body: JSON.stringify(d) });
});
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

await startLevel(8, [0, 1, 2, 3, 4, 5, 6, 7]);
check('geen fouten bij start', fouten.length === 0, fouten.join(' | '));
// check('vissershut in het bouwmenu', await p.evaluate(() => !!document.querySelector('#bouw-knoppen [data-sleutel="vissershut"]')));
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
const voedsel0 = await p.evaluate(() => window.spel.economie.voorraad.vis);
check('bootje komt terug', await wachtTot(() => window.spel.visserij.hutten()[0] && window.spel.visserij.hutten()[0].fase === 'terug', 90000));
check('oud bestand: slotkaartje komt toch', await wachtTot(() => window.spel.visLes.fase() === 'kaart3', 30000));
const n = await p.evaluate(() => ({ vis: window.spel.economie.voorraad.vis, gevangen: window.spel.visserij.gevangen() }));
check('oud bestand: vis is een getal, geen NaN', Number.isFinite(n.vis) && Number.isFinite(n.gevangen) && n.gevangen > 0, JSON.stringify(n));
await tikOp('#gids-kaart button');
check('visles klaar', await p.evaluate(() => window.spel.visLes.klaar() && !window.spel.visLes.actief()));
// walvis met oud bestand
const w = await p.evaluate(() => {
  const z = window.spel.zeeleven;
  const i = z.jouwKust()[0];
  const B = window.spel.kaart.breedte;
  const x = i % B, y = Math.floor(i / B);
  z.spring({ x: x + 0.5, y: y + 0.5, gelukkig: true });
  for (let k = 0; k < 40; k++) z.stap(0.05);
  const meld = [];
  const voor = window.spel.economie.voorraad.vis;
  const raak = z.tik(x, y);
  return { raak, voor, na: window.spel.economie.voorraad.vis, tekst: document.body.innerText.match(/\+\S+ fish/g) };
});
check('oud bestand: walvis geeft een getal vis', w.raak && Number.isFinite(w.na) && w.na > w.voor && !(w.tekst || []).some((t) => /NaN/.test(t)), JSON.stringify(w));
check('geen fouten', fouten.length === 0, fouten.join(' | '));

await b.close();
srv.kill();
console.log(`\n${goed} goed, ${fout} fout`);
process.exit(fout ? 1 : 0);
