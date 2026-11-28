// 0.125.0: de heldenzaal (Hall of Heroes) met vier helden en hun abilities.
// node tests/helden125.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const POORT = 8325;
const srv = spawn('python3', ['-m', 'http.server', String(POORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let goed = 0, fout = 0;
const check = (naam, ok, extra = '') => { console.log(`${ok ? 'GOED' : 'FOUT'} ${naam} ${extra}`); ok ? goed++ : fout++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' })).newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(e.message));
const zichtbaar = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !!(e.offsetWidth || e.offsetHeight) && !e.closest('[hidden]'); }, sel);
async function startLevel(n, klaar) {
  await p.goto(`http://localhost:${POORT}/`);
  await p.waitForFunction(() => window.spel);
  await p.evaluate(([m, k]) => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [n, klaar]);
  await p.reload();
  await p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
  await p.waitForFunction(() => { const v = document.getElementById('verhaalbeeld-verder'); return document.getElementById('verhaalbeeld').hidden || (v && !v.hidden); }, null, { timeout: 20000 });
  if (await zichtbaar('#verhaalbeeld-verder')) await p.click('#verhaalbeeld-verder');
  await p.waitForTimeout(500);
  if (await zichtbaar('#missie-begin')) await p.click('#missie-begin');
  await p.waitForTimeout(800);
  await p.evaluate(() => window.spel.heldenLes && window.spel.heldenLes.sla());   // heldenles (0.125.0) overslaan
}

// Level 8: nog geen heldenzaal in het bouwmenu
await startLevel(8, [0, 1, 2, 3, 4, 5, 6, 7]);
const in8 = await p.evaluate(() => [...document.querySelectorAll('#bouwknoppen button, #bouwbalk button, button')].some((k) => /Hall of Heroes/.test(k.textContent)));
check('level 8: geen Hall of Heroes', !in8);

// Level 9: wel
await startLevel(9, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
await p.evaluate(() => { window.spel.ui.verbergVerhaal(); });
const in9 = await p.evaluate(() => [...document.querySelectorAll('button')].some((k) => /Hall of Heroes/.test(k.textContent)));
check('level 9: Hall of Heroes in het bouwmenu', in9);

// Rutger staat gratis klaar; de heldenzaal laat geen tweede held toe
const r1 = await p.evaluate(() => {
  const { leger } = window.spel;
  const h = leger.held();
  return { held: h && h.soldaat.sleutel, waarom: leger.waaromNiet('mechteld') };
});
check('level 9: Rutger is je held', r1.held === 'rutger', JSON.stringify(r1));
check('tweede held geweigerd', /Only one hero/.test(r1.waarom), r1.waarom);

// De heldenzaal bouwen en aantikken: het paneel toont de vier helden
const zaal = await p.evaluate(() => {
  const { kaart, bouwer, bouwwerken, economie, wegvinder } = window.spel;
  const werk = bouwwerken.find ? bouwwerken.find((w) => w.sleutel === 'heldenzaal') : Object.values(bouwwerken).find((w) => w.sleutel === 'heldenzaal');
  economie.voorraad.planken += 100; economie.voorraad.steen += 100;
  const s = kaart.start[0];
  for (let d = 6; d < 13; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    const x = Math.floor(s.x) + dx, y = Math.floor(s.y) + dy;
    const vak = y * kaart.breedte + x;
    if (!bouwer.waaromNiet(x, y, werk)) {
      bouwer.plaats(werk, [{ x, y }]);
      if (kaart.object[vak] === 59) return { vak, x, y };
    }
  }
  return null;
});
check('heldenzaal geplaatst (object 59)', !!zaal, JSON.stringify(zaal));

// Heldenzaal aantikken: vier knoppen met portret en naam
await p.evaluate(() => { document.querySelectorAll('button').forEach((k) => { if (k.textContent.trim() === 'Close' && k.offsetWidth && !k.closest('#legerpaneel')) k.click(); }); window.spel.leger.kies([]); });
for (const [ox, oy] of [[0.5, 0.5], [0.5, 0.2], [0.3, 0.5], [0.5, 0.8]]) {
  const punt = await p.evaluate(async ([z, ox, oy]) => {
    const iso = await import('/js/iso.js');
    const s = window.spel;
    const w = iso.rasterNaarWereld(z.x + ox, z.y + oy);
    s.camera.kijkNaar(w.x, w.y);
    const sc = s.camera.wereldNaarScherm(w.x, w.y);
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.left + sc.x, y: r.top + sc.y };
  }, [zaal, ox, oy]);
  await p.waitForTimeout(300);
  await p.touchscreen.tap(punt.x, punt.y);
  await p.waitForTimeout(600);
  if (await zichtbaar('.held-kaart')) break;
}
const paneel = await p.evaluate(() => [...document.querySelectorAll('#leger-opleiden .held-kaart')].map((k) => ({ naam: k.querySelector('.held-naam').textContent, portret: k.querySelector('.held-portret').naturalWidth, figuur: k.querySelector('.held-figuur') ? k.querySelector('.held-figuur').naturalWidth : 0, kost: k.querySelector('small').textContent })));
check('heldenzaal: vier helden met portret en poppetje', paneel.length === 4 && paneel.every((k) => k.portret > 0 && k.figuur > 0), JSON.stringify(paneel));
await p.click('.held-kaart[data-held="mechteld"]');
await p.waitForTimeout(300);
const info = await p.evaluate(() => ({ tekst: document.querySelector('.held-info').textContent, koop: document.getElementById('held-koop').textContent, kanniet: document.getElementById('held-koop').classList.contains('kanniet') }));
check('uitleg ability en Buy met prijs', /Wind Volley/.test(info.tekst) && /Always:/.test(info.tekst) && /Buy Mechteld · 1250 gold/.test(info.koop) && info.kanniet, JSON.stringify(info));
await p.screenshot({ path: '/home/claude/125-zaal.png' });

// Rutger sneuvelt; daarna kun je opnieuw een held kopen
await p.evaluate(async (z) => {
  const { leger, economie } = window.spel;
  leger.held().dood = true;
  await new Promise((r) => setTimeout(r, 600));
  economie.voorraad.goud = 5000;
  const plek = leger.plekken(); const vrij = economie.bevolking().vrij;
  window.__koop = { plek, vrij };
  return null;
}, zaal);
await p.click('.held-kaart[data-held="mechteld"]');
await p.click('#held-koop');
await p.waitForTimeout(300);
await p.screenshot({ path: '/home/claude/125-gekocht.png' });
const koop = await p.evaluate(() => {
  const { leger, economie } = window.spel;
  const { plek, vrij } = window.__koop;
  const fout = leger.held() && leger.held().soldaat.sleutel === 'mechteld' ? '' : 'niet gekocht';
  const na = { goud: economie.voorraad.goud, plek: leger.plekken(), vrij: economie.bevolking().vrij, held: leger.held() && leger.held().soldaat.sleutel };
  return { fout, plek, vrij, na, tweede: leger.waaromNiet('brandt') };
});
check('Mechteld gekocht', koop.fout === '' && koop.na.held === 'mechteld', JSON.stringify(koop));
check('kost 1250 goud', koop.na.goud === 3750, koop.na.goud);
check('geen legerplek en geen boer', koop.na.plek === koop.plek && koop.na.vrij === koop.vrij, JSON.stringify(koop));
check('daarna geen tweede held', /Only one hero/.test(koop.tweede), koop.tweede);

// Het paneel van de heldenzaal (tik via de kaart is lastig: toon het via de knoppen in de DOM na een tik)
// Windvlaag: vijanden bij Mechteld
const wind = await p.evaluate(async () => {
  const { leger, strijd, kaart } = window.spel;
  const h = leger.held();
  const B = kaart.breedte;
  const vak = Math.floor(h.y) * B + Math.floor(h.x);
  const vijanden = [];
  for (const d of [3, 4]) { const v = strijd.maakVijand('ridder', vak + d); if (v) vijanden.push(v); }
  const voor = vijanden.map((v) => v.leven);
  const zonder = strijd.heldStand(h);
  const r = strijd.heldDaad(h);
  const na = vijanden.map((v) => v.leven);
  const nog = strijd.heldDaad(h);
  return { r, voor, na, nog, wacht: strijd.heldStand(h).wacht, zonder };
});
check('Wind Volley raakt vijanden', wind.r === '' && wind.na.every((l, i) => l < wind.voor[i]), JSON.stringify(wind));
check('Wind Volley wacht 60 s', wind.wacht >= 59 && wind.wacht <= 60, wind.wacht);
check('tweede keer: nog niet klaar', /not ready/.test(wind.nog), wind.nog);

// Aura: een boogschutter bij Mechteld schiet 20% verder
const aura = await p.evaluate(async () => {
  const { leger, strijd, kaart } = window.spel;
  const h = leger.held();
  const e = leger.geef('boogschutter', Math.floor(h.y) * kaart.breedte + Math.floor(h.x), 3);
  await new Promise((r) => setTimeout(r, 1200));
  const met = strijd.bereikVan(e);
  return { met, basis: leger.soorten.boogschutter.bereik };
});
check('aura: schutter 20% verder', Math.abs(aura.met - aura.basis * 1.2) < 0.01, JSON.stringify(aura));

// De knop: kies Mechteld, de knop toont de wachttijd
await p.evaluate(() => { const { leger } = window.spel; leger.kies([leger.held()]); });
await p.waitForTimeout(1300);
const knop = await p.evaluate(() => { const k = document.getElementById('knop-held'); return { hidden: k.hidden, tekst: k.textContent, wacht: k.classList.contains('wacht') }; });
check('abilityknop zichtbaar met wachttijd', !knop.hidden && /Wind Volley \d+s/.test(knop.tekst) && knop.wacht, JSON.stringify(knop));
await p.screenshot({ path: '/home/claude/125-knop.png' });

// Brandt: oogst sneller en Snare
const brandt = await p.evaluate(async (z) => {
  const { leger, strijd, economie, kaart } = window.spel;
  leger.held().dood = true;
  await new Promise((r) => setTimeout(r, 600));
  economie.voorraad.goud = 5000;
  const f = leger.leidOp('brandt', z.vak);
  await new Promise((r) => setTimeout(r, 1300));
  const oogst = { fruit: economie.oogstVan('fruitteler'), hout: economie.oogstVan('houthakker') };
  const h = leger.held();
  const leeg = strijd.heldDaad(h);
  const vak = Math.floor(h.y) * kaart.breedte + Math.floor(h.x);
  const v = strijd.maakVijand('ridder', vak + 2);
  const r = strijd.heldDaad(h);
  const x0 = v.x, y0 = v.y, l0 = h.leven;
  await new Promise((res) => setTimeout(res, 3000));
  return { f, goud: economie.voorraad.goud, oogst, leeg, r, vast: v.vastTot > 0, bewoog: Math.hypot(v.x - x0, v.y - y0), hLeven: [l0, h.leven] };
}, zaal);
check('Brandt gekocht voor 750', brandt.f === '' && brandt.goud === 4250, JSON.stringify(brandt));
check('oogst boomgaard 25% sneller, hout niet', brandt.oogst.fruit === 0.8 && brandt.oogst.hout === 1, JSON.stringify(brandt.oogst));
check('Snare zonder vijand geweigerd', /no enemy/.test(brandt.leeg), brandt.leeg);
check('Snare zet vijand vast', brandt.r === '' && brandt.vast && brandt.bewoog < 0.05, JSON.stringify(brandt));

// Lambrecht: Quick Repair op een beschadigd eigen bouwwerk (de heldenzaal zelf)
const lam = await p.evaluate(async (z) => {
  const { leger, strijd, economie } = window.spel;
  leger.held().dood = true;
  await new Promise((r) => setTimeout(r, 600));
  economie.voorraad.goud = 5000;
  const f = leger.leidOp('lambrecht', z.vak);
  await new Promise((r) => setTimeout(r, 300));
  strijd.beschadig(z.vak, 1);
  const max = strijd.bouwSchade(z.vak).max;
  strijd.beschadig(z.vak, Math.round(max * 0.55));
  const voor = strijd.bouwSchade(z.vak);
  const r = strijd.heldDaad(leger.held());
  const na = strijd.bouwSchade(z.vak);
  await new Promise((res) => setTimeout(res, 2100));
  const later = strijd.bouwSchade(z.vak);
  return { f, voor, na, later, uitslag: strijd.uitslag(), afstand: Math.hypot(leger.held().x - z.x, leger.held().y - z.y) };
}, zaal);
check('Quick Repair herstelt 40%', lam.f === '' && lam.voor && lam.na && Math.abs(lam.na.leven - lam.voor.leven - lam.voor.max * 0.4) < 1, JSON.stringify(lam));
check('Lambrecht herstelt ook langzaam', lam.later && lam.later.leven > lam.na.leven, JSON.stringify(lam));

// Rutger kopen: 2000, Berserker verdubbelt zijn schade
const rut = await p.evaluate(async (z) => {
  const { leger, strijd, economie, kaart } = window.spel;
  leger.held().dood = true;
  await new Promise((r) => setTimeout(r, 600));
  economie.voorraad.goud = 5000;
  const f = leger.leidOp('rutger', z.vak);
  const h = leger.held();
  const r = strijd.heldDaad(h);
  const st = strijd.heldStand(h);
  return { f, goud: economie.voorraad.goud, r, st };
}, zaal);
check('Rutger gekocht voor 2000', rut.f === '' && rut.goud === 3000, JSON.stringify(rut));
check('Berserker actief', rut.r === '' && rut.st.actief && rut.st.wacht >= 89, JSON.stringify(rut));


// Opslaan en laden: de held blijft
await p.waitForTimeout(11000);
await p.evaluate(() => sessionStorage.setItem('burcht-banier.geenTitel', '1'));
await p.reload();
await p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
await p.waitForTimeout(1500);
if (await zichtbaar('#verhaalbeeld-verder')) await p.click('#verhaalbeeld-verder');
await p.waitForTimeout(1500);
const na = await p.evaluate(() => { const h = window.spel.leger.held(); return h && h.soldaat.sleutel; });
check('na herladen is Rutger nog je held', na === 'rutger', na);

check('geen paginafouten', fouten.length === 0, fouten.slice(0, 3).join(' | '));
console.log(`\n${goed} goed, ${fout} fout`);
await b.close();
srv.kill();
process.exit(fout ? 1 : 0);
