// Stap 33: kasteelontwerpen voor rood. Voor elk ontwerp op elke kaart:
// rood kan naar buiten, jij kunt pas naar binnen als de poorten weg zijn,
// er is een weg tussen de kastelen, de werken van rood staan er en er zijn
// looproutes voor de wachters. Plus schermafbeeldingen van level 1 tot 3.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8234;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
const url = `http://localhost:${poort}/`;
await p.goto(url); await wacht();

const uitslag = await p.evaluate(async () => {
  const { maakKaart, OBJECT } = await import('/js/kaart.js');
  const { maakWegvinder } = await import('/js/wegvinden.js');
  const kaarten = (await (await fetch('/data/kaarten.json')).json()).kaarten;
  const kastelen = (await (await fetch('/data/kastelen.json')).json()).kastelen;
  const uit = [];
  for (const [kn, recept] of Object.entries(kaarten)) {
    for (const [on, ontwerp] of Object.entries(kastelen)) {
      const k = maakKaart({ ...recept, kasteel: ontwerp });
      const B = k.breedte;
      const m = k.start[1];
      const vak = (x, y) => y * B + x;
      const tel = (s) => { let n = 0; for (let i = 0; i < k.object.length; i++) if (k.object[i] === s && k.eigenaar[i] === 2) n++; return n; };
      const poorten = tel(OBJECT.POORT);
      const verwacht = ontwerp.ringen.reduce((s, r) => s + (r.poorten || ['voor']).length, 0);
      // een plek naast de burcht, en een plek ver buiten het kasteel aan jouw kant
      const binnen = vak(m.x - 2, m.y);
      const omvang = Math.max(...ontwerp.ringen.map((r) => r.maat)) + (ontwerp.gracht ? (ontwerp.gracht.afstand || 2) + (ontwerp.gracht.breedte || 1) - 1 : 0);
      const buiten = vak(m.x - omvang - 1, m.y);   // waar de weg naar jouw kasteel begint
      const w = maakWegvinder(k);
      const roodEruit = w.verbonden(binnen, buiten, 1);
      const jijDicht = !w.verbonden(buiten, binnen, 0);
      // poorten weg: dan kun jij erin
      for (let i = 0; i < k.object.length; i++) if (k.object[i] === OBJECT.POORT && k.eigenaar[i] === 2) { k.object[i] = OBJECT.GEEN; k.eigenaar[i] = 0; }
      w.herbereken();
      const jijOpen = w.verbonden(buiten, binnen, 0);
      const werken = [OBJECT.HOUTHAKKER, OBJECT.STEENGROEVE, OBJECT.BOOMGAARD].map(tel).reduce((s, n) => s + n, 0);
      uit.push({ kn, on, poorten, verwacht, roodEruit, jijDicht, jijOpen, weg: k.verbonden, werken, routes: k.kastelen[1].routes.length });
    }
  }
  return uit;
});
for (const u of uitslag) {
  const n = `${u.kn}/${u.on}`;
  const goed = u.poorten === u.verwacht && u.roodEruit && u.jijDicht && u.jijOpen && u.weg && u.werken === 3 && u.routes > 0;
  check(n, goed, JSON.stringify(u));
}

// De gewone ringmuur verandert niet door het ontwerp: vrij spel is gelijk aan een ontwerp "ring".
const gelijk = await p.evaluate(async () => {
  const { maakKaart } = await import('/js/kaart.js');
  const kaarten = (await (await fetch('/data/kaarten.json')).json()).kaarten;
  const kastelen = (await (await fetch('/data/kastelen.json')).json()).kastelen;
  const a = maakKaart(kaarten.standaard);
  const b = maakKaart({ ...kaarten.standaard, kasteel: kastelen.ring });
  let verschil = 0;
  for (let i = 0; i < a.object.length; i++) if (a.object[i] !== b.object[i] || a.eigenaar[i] !== b.eigenaar[i]) verschil++;
  return { verschil, routes: [a.kastelen[1].routes.length, b.kastelen[1].routes.length] };
});
check('ring-ontwerp wijkt weinig af van het oude kasteel', gelijk.verschil <= 40 && gelijk.routes[0] === gelijk.routes[1], JSON.stringify(gelijk));

// In het spel: level 1 tot 3 met hun kasteel
for (const [lv, ontwerp] of [[1, 'dorre_heide'], [2, 'rotsvesting'], [3, 'dubbel']]) {
  await p.evaluate((lv) => {
    localStorage.clear();
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3] }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: lv }));
    sessionStorage.setItem('burcht-banier.geenTitel', '1');
  }, lv);
  await p.reload(); await wacht(); await p.waitForTimeout(400);
  const r = await p.evaluate(async () => {
    document.getElementById('missie-begin').click();
    const s = window.spel; const r = s.strijd.rood();
    const { rasterNaarWereld } = await import('/js/iso.js');
    const w = rasterNaarWereld(r.x, r.y);
    s.camera.zetZoom(0.75);
    s.camera.kijkNaar(w.x, w.y);
    const muur = s.kaart.object.findIndex((o, i) => o === 4 && s.kaart.eigenaar[i] === 2);
    return { wachters: s.strijd.wachters().length, koning: !!s.strijd.koning(1), x: r.x, y: r.y, hoog: s.strijd.muurTeHoog(), muurMax: s.strijd.levenOp(muur).max, factor: s.regels.strijd.roodMuurFactor };
  });
  check(`level ${lv} (${ontwerp}): koning en wachters`, r.koning && r.wachters > 0, JSON.stringify(r));
  check(`level ${lv}: muren ${[100, 115, 130][lv - 1]}%`, Math.abs(r.factor - [1, 1.15, 1.3][lv - 1]) < 0.001, JSON.stringify(r));
  check(`level ${lv}: te hoog voor ladders alleen in level 2`, r.hoog === (lv === 2), JSON.stringify(r));
  await p.waitForTimeout(600);
  await p.screenshot({ path: `/home/claude/stap33-level${lv}.png` });
}

// Level 3: door twee poorten heen breken en winnen (sterke soldaten, zodat het om de route gaat).
await p.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 3 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht();
const inval = await p.evaluate(() => {
  document.getElementById('missie-begin').click();
  const s = window.spel; const k = s.kaart; const B = k.breedte; const m = k.start[1];
  const lijst = [];
  for (let i = 0; i < 8; i++) lijst.push(['ridder', m.x - 10 - (i % 3), m.y - 1 + Math.floor(i / 3), 9999, 0]);
  lijst.push(['ram', m.x - 10, m.y + 2, 9999, 0], ['ram', m.x - 11, m.y + 2, 9999, 0]);
  s.leger.zetStand(lijst);
  const soldaten = s.leger.soldaten().filter((e) => !s.leger.soorten[e.soldaat.sleutel].koning);
  const buitenPoort = m.y * B + m.x - 7, binnenPoort = m.y * B + m.x - 4, burchtVak = m.y * B + m.x;
  let fase = 0;
  s.strijd.valBouwAan(soldaten, buitenPoort);
  for (let t = 0; t < 10 * 480 && !s.strijd.uitslag(); t++) {
    s.eenheden.stap(0.1); s.economie.stap(); s.leger.stap(); s.strijd.stap();
    if (fase === 0 && k.object[buitenPoort] !== 6) { fase = 1; s.strijd.valBouwAan(soldaten, binnenPoort); }
    if (fase === 1 && k.object[binnenPoort] !== 6) { fase = 2; s.strijd.valBouwAan(soldaten, burchtVak); }
  }
  return { fase, uitslag: s.strijd.uitslag() };
});
check('level 3: door twee poorten en gewonnen', inval.fase === 2 && inval.uitslag === 'gewonnen', JSON.stringify(inval));

console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
