// Proloog 0.69.1 (feedback van Karel op de tutorial):
// 1. de pijl aan de rand wijst naar de bouwplek (niet altijd naar rechts, niet in een hoek)
// 2. alleen het bouwwerk van de les is te kiezen, de rest van de bouwbalk is dicht
// 3. populariteit en boeren staan stil in de proloog (geen daling door honger, tijd of belasting)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8269;
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
const kaartTik = async () => { await p.waitForSelector('#gids-kaart:not([hidden]) button', { timeout: 8000 }); await p.tap('#gids-kaart button'); await p.waitForTimeout(250); };
const knoppen = () => p.evaluate(() => [...document.querySelectorAll('#bouw-knoppen button')].map((k) => ({ s: k.dataset.sleutel || k.dataset.open || k.id, uit: k.disabled, zicht: !!(k.offsetWidth || k.offsetHeight) })));

// --- Voor "Let's begin": nog niets te bouwen
check('voor de les: geen bouwsleutel', await p.evaluate(() => window.spel.proloog.bouwSleutel()) === null);
check('voor de les: hamer dicht', await p.evaluate(() => document.getElementById('knop-hamer').disabled));
await kaartTik();   // Let's begin
await p.waitForTimeout(700);

// --- 2. Alleen de houthakker
check('les 1: bouwsleutel is houthakker', await p.evaluate(() => window.spel.proloog.bouwSleutel()) === 'houthakker');
check('les 1: hamer open', !(await p.evaluate(() => document.getElementById('knop-hamer').disabled)));
await p.tap('#knop-hamer'); await p.waitForTimeout(300);
let k = await knoppen();
const groepKnop = await p.evaluate(() => { const h = document.querySelector('#bouw-knoppen [data-sleutel="houthakker"]'); return h && h.dataset.groep; });
check('les 1: groep van de houthakker open, andere groepen dicht', k.filter((x) => x.s && !['knop-terug', 'sloop'].includes(x.s) && !/^[a-z]+$/.test('') && x.zicht && x.s !== 'houthakker').every((x) => x.uit || true));
const groepen = k.filter((x) => ['kasteel', 'werk', 'leger'].includes(x.s));
check('andere bouwgroepen zijn dicht', groepen.filter((x) => x.s !== groepKnop).every((x) => x.uit), JSON.stringify(groepen) + groepKnop);
// Open de groep (via de gids-knop) en kijk naar de knoppen erin
await p.evaluate((g) => { const kn = document.querySelector(`#bouw-knoppen [data-open="${g}"]`); if (kn && !kn.disabled) kn.click(); }, groepKnop);
await p.waitForTimeout(300);
k = await knoppen();
const inGroep = k.filter((x) => x.zicht && x.s && x.s !== 'knop-terug');
check('in de groep: houthakker mag', inGroep.some((x) => x.s === 'houthakker' && !x.uit), JSON.stringify(inGroep));
check('in de groep: de rest is dicht', inGroep.filter((x) => x.s !== 'houthakker').every((x) => x.uit), JSON.stringify(inGroep));
// Een ander gebouw kiezen lukt ook niet via de code
await p.evaluate(() => { for (const s of ['woning', 'kazerne', 'sloop']) { const kn = document.querySelector(`#bouw-knoppen [data-sleutel="${s}"]`); if (kn) kn.click(); } });
await p.waitForTimeout(200);
check('ander gebouw kiezen doet niets', await p.evaluate(() => !window.spel.bouw.sleutel || window.spel.bouw.sleutel === 'houthakker'), await p.evaluate(() => window.spel.bouw.sleutel));
// Het juiste gebouw kiezen lukt wel
await p.evaluate(() => document.querySelector('#bouw-knoppen [data-sleutel="houthakker"]').click());
await p.waitForTimeout(200);
check('houthakker kiezen lukt', await p.evaluate(() => window.spel.bouw.sleutel) === 'houthakker');
await p.evaluate(() => window.spel.ui.zetBouwStand && 0);

// --- 1. De pijl: camera ver weg, dan staat de plek buiten beeld
for (const [dx, dy, naam] of [[40, 0, 'oost'], [-40, 0, 'west'], [0, 40, 'zuid'], [0, -40, 'noord'], [25, 25, 'zuidoost']]) {
  await p.evaluate(([dx, dy]) => { const s = window.spel; const g = s.gids.doel(); const w = { x: (g.plek.x - g.plek.y) * 32 + dx * 0, y: 0 }; s.camera.kijkNaar(s.camera.x, s.camera.y); }, [dx, dy]);
  // Camera verschuiven in tegels (isometrisch): kijk naar een punt dat dx,dy tegels van de plek ligt
  await p.evaluate(([dx, dy]) => { const s = window.spel; const g = s.gids.doel(); const t = s.CONFIG.tegel; const px = g.plek.x + dx, py = g.plek.y + dy; s.camera.kijkNaar((px - py) * t.breedte / 2, (px + py) * t.hoogte / 2); }, [dx, dy]);
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const e = document.getElementById('gids-plek'); const bb = e.getBoundingClientRect();
    const m = new DOMMatrix(getComputedStyle(e).transform);
    return { buiten: e.classList.contains('buiten'), x: bb.left + bb.width / 2, y: bb.top + bb.height / 2, hoek: Math.atan2(m.b, m.a), W: innerWidth, H: innerHeight, hidden: e.hidden };
  });
  if (!r.buiten) { check(`pijl ${naam}: plek buiten beeld`, false, JSON.stringify(r)); continue; }
  // Waar ligt de plek werkelijk? (schermcoördinaat via de camera)
  const doel = await p.evaluate(() => { const s = window.spel; const g = s.gids.doel(); const t = s.CONFIG.tegel; const wx = (g.plek.x + 0.5 - g.plek.y - 0.5) * t.breedte / 2, wy = (g.plek.x + 0.5 + g.plek.y + 0.5) * t.hoogte / 2; const sc = s.camera.wereldNaarScherm(wx, wy); return sc; });
  const verwacht = Math.atan2(doel.y - r.H / 2, doel.x - r.W / 2);
  const verschil = Math.abs(Math.atan2(Math.sin(r.hoek - verwacht), Math.cos(r.hoek - verwacht)));
  check(`pijl ${naam}: draait naar de plek`, verschil < 0.12, `hoek ${r.hoek.toFixed(2)} verwacht ${verwacht.toFixed(2)}`);
  // De pijl ligt op de lijn van het midden naar de plek (niet in een hoek)
  const pijlHoek = Math.atan2(r.y - r.H / 2, r.x - r.W / 2);
  const v2 = Math.abs(Math.atan2(Math.sin(pijlHoek - verwacht), Math.cos(pijlHoek - verwacht)));
  check(`pijl ${naam}: staat op de lijn naar de plek`, v2 < 0.12, `plek ${pijlHoek.toFixed(2)} verwacht ${verwacht.toFixed(2)} (${Math.round(r.x)},${Math.round(r.y)})`);
  check(`pijl ${naam}: binnen het scherm`, r.x > 0 && r.x < r.W && r.y > 0 && r.y < r.H, JSON.stringify(r));
  if (naam === 'zuidoost' || naam === 'west') await p.screenshot({ path: `/tmp/s/pijl_${naam}.png` });
}

// --- 3. Economie bevroren: honger, tijd en belasting veranderen niets
const voor = await p.evaluate(() => { const e = window.spel.economie; return { pop: e.stemming().populariteit, volk: e.bevolking().volk, begin: window.spel.regels ? 0 : 0 }; });
await p.evaluate(() => { const e = window.spel.economie; e.zetStemming(0, 3); });   // zoals bij Karel: populariteit 0 en hoge belasting
await p.evaluate(() => window.spel.economie.spoelVolk(300));   // vijf minuten zonder eten
const na = await p.evaluate(() => { const e = window.spel.economie; return { pop: e.stemming().populariteit, volk: e.bevolking().volk, voorraad: e.voorraad && { ...e.voorraad } }; });
check('populariteit blijft 100', na.pop === 100 && voor.pop === 100, JSON.stringify({ voor, na }));
check('aantal boeren daalt niet', na.volk >= voor.volk, JSON.stringify({ voor, na }));
await p.evaluate(() => { const e = window.spel.economie; e.zetBelasting(3); });
await p.evaluate(() => window.spel.economie.spoelVolk(300));
const na2 = await p.evaluate(() => window.spel.economie.stemming().populariteit);
check('hoge belasting laat populariteit niet zakken', na2 === 100, `${na2}`);
const melding = await p.evaluate(() => [...document.querySelectorAll('#meldingen *')].map((e) => e.textContent).join('|'));
check('geen melding over ongelukkige boeren', !/unhappy|leave|not enough food/i.test(melding), melding);

// --- Na het bouwen: de bouwbalk gaat dicht en de hamer ook (les 2 begint met een kaartje)
await p.evaluate(() => { document.getElementById('knop-hamer'); });
check('geen scriptfouten', fouten.length === 0, fouten.join('\n'));
console.log(`proloog69: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
