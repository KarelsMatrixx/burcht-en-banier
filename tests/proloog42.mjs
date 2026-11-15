// Proloog 0.56: bouwveld in het westen, gouden bouwplek, economielessen. Bouwt alleen met tikken, zoals de speler.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8242;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 0 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
await p.tap('#missie-begin'); await p.waitForTimeout(1200);
const st = () => p.evaluate(() => window.spel.proloog.stand());
let gesprekken = 0;
// Gesprekken tussen de lessen (knop '›') doorklikken; telt de kaartjes
const slaGesprekOver = async () => { let n = 0; while (n < 12 && await p.isVisible('#gids-kaart') && (await p.textContent('#gids-kaart button')).trim() === '›') { if (n === 0) check('gesprek met portret', await p.isVisible('#gids-kaart img.portret')); n++; await p.tap('#gids-kaart button'); await p.waitForTimeout(120); } return n; };
const kaartTik = async () => { await p.waitForSelector('#gids-kaart:not([hidden]) button', { timeout: 8000 }); await p.tap('#gids-kaart button'); await p.waitForTimeout(200); gesprekken += await slaGesprekOver(); };
// Het veld
const veld = await p.evaluate(() => { const k = window.spel.kaart; const st = k.start[0]; let steen = 0, boom = 0, vrij = 0, poort = 0;
  for (let dy = -7; dy <= 7; dy++) for (let dx = -24; dx <= -18; dx++) { const o = k.object[(st.y + dy) * k.breedte + st.x + dx]; if (o === 2) steen++; else if (o === 1) boom++; else if (o === 0) vrij++; }
  for (let dx = -20; dx <= -4; dx++) if (k.object[st.y * k.breedte + st.x + dx] === 6) poort++;
  return { steen, boom, vrij, poort }; });
check('veld: rotsen', veld.steen >= 5, JSON.stringify(veld));
check('veld: bomen', veld.boom >= 5, JSON.stringify(veld));
check('veld: veel vrije grond', veld.vrij >= 60, JSON.stringify(veld));
check('vier westpoorten', veld.poort === 4, JSON.stringify(veld));
const bouwStraal = await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; return s.bouwer.waaromNiet(st.x - 21, st.y + 3, s.bouwwerken.woning); });
check('ver van de burcht bouwen mag', bouwStraal !== 'this is too far from your keep', bouwStraal);
// De lessen: volg alleen de gids
async function tikGids() {
  const stap = await p.evaluate(() => {
    const ring = document.getElementById('gids-ring'); const plek = document.getElementById('gids-plek');
    if (!ring.hidden) { const r = ring.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, wat: 'ring' }; }
    if (!plek.hidden && !plek.classList.contains('buiten')) { const r = plek.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, wat: 'plek' }; }
    return null; });
  if (!stap) return false;
  await p.touchscreen.tap(stap.x, stap.y); await p.waitForTimeout(450); return true;
}
const bouwLes = async (n, naam) => {
  await kaartTik();
  await kaartTik();
  const t0 = await st();
  check(`les ${n + 1} ${naam}: plek in beeld`, await p.evaluate(() => { const e = document.getElementById('gids-plek'); return !e.hidden && !e.classList.contains('buiten'); }), JSON.stringify(t0));
  for (let k = 0; k < 14 && !(await st()).klaar; k++) { await tikGids(); await p.waitForTimeout(200); }
  if (!(await st()).klaar) { console.log('DEBUG', await p.evaluate(() => JSON.stringify({ zin: document.getElementById('gids-zin').textContent, plek: window.spel.proloog && document.getElementById('gids-plek').getBoundingClientRect(), ring: !document.getElementById('gids-ring').hidden, melding: [...document.querySelectorAll('#meldingen *')].map((e) => e.textContent).join('|') }))); await p.screenshot({ path: '/tmp/s/dbg.png' }); }
  check(`les ${n + 1} ${naam}: gebouwd met tikken`, (await st()).klaar, JSON.stringify(await st()));
};
await kaartTik(); // Let's begin
const les1 = await p.evaluate(() => { const e = document.getElementById('gids-plek'); return { zichtbaar: !e.hidden, label: e.textContent }; });
const bart = await p.evaluate(() => { const s = window.spel; const g = document.getElementById('gids-plek'); const b = s.figuranten.lijst().find((e) => e.soort === 23); const plek = s.proloog.stand(); return { b: b && [b.x, b.y] }; });
const plekTegel = await p.evaluate(() => { const s = window.spel; const t = s.kaart.start[0]; return [t.x, t.y]; });
check('Bartholt staat bij het bouwveld (west)', bart.b && bart.b[0] < plekTegel[0] - 15, JSON.stringify([bart, plekTegel]));
check('les 1 plek met label', les1.zichtbaar && /Woodcutter/.test(les1.label), JSON.stringify(les1));
for (let k = 0; k < 14 && !(await st()).klaar; k++) { await tikGids(); await p.waitForTimeout(200); }
check('les 1 houthakker gebouwd met tikken', (await st()).klaar, JSON.stringify(await st()));
const plekHut = await p.evaluate(() => { const s = window.spel; const l = s.bouwer.eigenBouwwerken().houthakker || []; return l.slice(0, 2); });
check('houthakker staat op het veld (west)', plekHut.length === 2 && plekHut[0] < 12, JSON.stringify(plekHut));
await bouwLes(1, 'steengroeve');
await bouwLes(2, 'boomgaard');
await bouwLes(3, 'woning');
await bouwLes(4, 'voorraadkamer');
const lijst = await p.evaluate(() => { const s = window.spel; const l = s.bouwer.eigenBouwwerken(); return Object.fromEntries(Object.entries(l).filter(([k]) => ['houthakker', 'steengroeve', 'boomgaard', 'woning', 'voorraadkamer'].includes(k)).map(([k, v]) => [k, v.length / 2])); });
check('alle vijf staan', ['houthakker', 'steengroeve', 'boomgaard', 'woning', 'voorraadkamer'].every((k) => lijst[k] === 1), JSON.stringify(lijst));
// Werkers lopen naar het veld
await p.evaluate(() => window.spel.economie.zetVolk && window.spel.economie.zetVolk(8));
await p.waitForTimeout(45000);
const werkers = await p.evaluate(() => { const s = window.spel; const st = s.kaart.start[0]; return s.eenheden.lijst.filter((e) => !e.dood && e.x < st.x - 16 && !e.gast).length; });
check('werkers bij het veld (>= 1)', werkers >= 1, werkers);
// Economielessen met alleen de gids
await kaartTik(); await kaartTik();
check('les 6 is je volk', (await st()).taak === 5 && /purse/.test(await p.textContent('#gids-zin')));
for (let k = 0; k < 6 && !(await st()).klaar; k++) { await tikGids(); await p.waitForTimeout(300); }
check('les 5 klaar via gids', (await st()).klaar, JSON.stringify(await st()));
await kaartTik(); await kaartTik();
check('les 7 is belasting', (await st()).taak === 6);
for (let k = 0; k < 8 && !(await st()).klaar; k++) { await tikGids(); await p.waitForTimeout(300); }
check('les 6 klaar via gids', (await st()).klaar, JSON.stringify(await st()));
await p.screenshot({ path: '/tmp/s/p42.png' });
check('geen scriptfouten', fouten.length === 0, fouten.join('|'));
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
