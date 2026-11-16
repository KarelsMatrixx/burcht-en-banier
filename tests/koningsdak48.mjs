// 0.65.1: jouw soldaten kunnen het hoofdkasteel van rood op (via zijn deur), de koning op het dak
// verslaan en zo winnen. Het hoofdkasteel zelf is geen doelwit meer.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8295'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto('http://localhost:8295/'); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(true);
  const K = s.kaart; const B = K.breedte; const N = B * K.hoogte; const rs = K.start[1]; const W = s.wegvinder;
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } };
  const uit = {};
  s.regels.strijd.burchtSchiet = false;   // de test gaat om de route, niet om de balans
  for (const e of s.strijd.vijanden()) if (!e.koning && e.vijand !== 'koning') e.dood = true;
  const roodKeep = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) roodKeep.push((rs.y + dy) * B + rs.x + dx);
  uit.keepTegels = roodKeep.filter((v) => K.object[v] === 7).length;
  uit.roodKeepVoorJouKlimbaar = roodKeep.filter((v) => W.isMuur(v % B, Math.floor(v / B), 0)).length;
  uit.deurOpgang = !!W.isOpgang(rs.x + 1, rs.y, 0);
  // Het hoofdkasteel is geen doelwit meer
  uit.keepIsDoelwit = roodKeep.some((v) => s.strijd.isVanRood(v));
  // Jouw soldaten op de binnenplaats van rood, bij de deur
  for (const e of s.leger.soldaten()) if (e.soldaat.sleutel !== 'koning') s.leger.sneuvel(e);
  const vrijeVakken = [];
  for (let r = 3; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = rs.x + dx, y = rs.y + dy;
    if (x > 1 && y > 1 && x < B - 2 && y < K.hoogte - 2 && W.isVrij(x, y, 0) && dx > 0) vrijeVakken.push([x, y]);
  }
  uit.vrij = vrijeVakken.length;
  s.leger.zetStand(vrijeVakken.slice(0, 8).map(([x, y]) => ['ridder', x, y, 60, 0]));
  uit.soldaten = s.leger.soldaten().filter((e) => e.soldaat.sleutel !== 'koning').length;
  // Alle torens, poorten en muren van rood weg, zodat er niets in de weg staat voor de test
  s.leger.kiesAlles();
  // De soldaten gaan op het kasteel van rood
  const kt = roodKeep.find((v) => K.object[v] === 7 && v !== rs.y * B + rs.x + 1);
  const ok1 = s.leger.stuur(kt % B, Math.floor(kt / B), true);
  uit.gestuurd = ok1;
  sim(100);   // na 100 stappen staan ze er al op; de sterke koning verslaat ze daarna, dat is balans en geen route
  const opKeep = s.leger.soldaten().filter((e) => e.soldaat.sleutel !== 'koning' && e.opMuur && K.object[Math.floor(e.y) * B + Math.floor(e.x)] === 7 && Math.max(Math.abs(Math.floor(e.x) - rs.x), Math.abs(Math.floor(e.y) - rs.y)) <= 1);
  uit.opRoodKeep = opKeep.length;
  sim(600);
  uit.uitslag1 = s.strijd.uitslag();
  uit.koningDood1 = !!(s.strijd.roodKoning() && s.strijd.roodKoning().dood);
  // Het hoofdkasteel zelf krijgt geen schade
  const roodVoor = s.strijd.rood().leven;
  uit.valBouwAan = s.strijd.valBouwAan(s.leger.soldaten().filter((e) => e.soldaat.sleutel !== 'koning'), kt);
  sim(100);
  uit.keepLeven = [roodVoor, s.strijd.rood().leven, s.strijd.rood().max];
  return uit;
});
console.log(JSON.stringify(r));
check('rood heeft een hoofdkasteel', r.keepTegels >= 8, r.keepTegels);
check('jouw soldaten kunnen alle tegels van het rode hoofdkasteel op', r.roodKeepVoorJouKlimbaar === r.keepTegels, r.roodKeepVoorJouKlimbaar);
check('de deur van rood is een opgang voor jou', r.deurOpgang === true);
check('het hoofdkasteel van rood is geen doelwit', r.keepIsDoelwit === false);
check('soldaten staan klaar', r.soldaten >= 4, r.soldaten);
check('bevel naar het kasteel van rood werkt', r.gestuurd > 0, r.gestuurd);
check('soldaten staan op het dak van rood (hooguit 5)', r.opRoodKeep >= 1 && r.opRoodKeep <= 5, r.opRoodKeep);
check('aanvallen van het hoofdkasteel levert niets op', r.valBouwAan === 0, r.valBouwAan);
check('het hoofdkasteel van rood krijgt geen schade', r.keepLeven[0] === r.keepLeven[1] && r.keepLeven[1] === r.keepLeven[2], JSON.stringify(r.keepLeven));

// ---- Deel 2: de koning van rood zit op het dak van zijn hoofdkasteel: jouw soldaten klimmen erop en winnen ----
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
const w = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(true);
  const K = s.kaart; const B = K.breedte; const rs = K.start[1]; const W = s.wegvinder;
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } };
  const uit = {};
  const koning = s.strijd.roodKoning();
  uit.heeftKoning = !!koning;
  s.regels.strijd.burchtSchiet = false;   // de test gaat om de route naar het dak, niet om de balans
  koning.leven = koning.levenMax = 80;
  s.regels.soldaten.koning.schade = 1;   // een zwakke koning: de test gaat om de route, niet om de balans
  s.regels.soldaten.koning.zwaaiAantal = 0;
  // Alleen de koning van rood blijft staan: zijn wachters zijn weg, zodat het om het dak gaat
  for (const e of s.strijd.vijanden()) if (e !== koning) e.dood = true;
  for (const e of s.leger.soldaten()) if (e.soldaat.sleutel !== 'koning') s.leger.sneuvel(e);
  const dakVak = (rs.y) * B + rs.x + 1;   // de tegel van de deur, aan de rand van het dak
  const dak = (rs.y - 1) * B + rs.x;      // een dakrand aan de achterkant
  koning.x = (dak % B) + 0.5; koning.y = Math.floor(dak / B) + 0.5; koning.opMuur = true; koning.pad = null;
  koning.hoogte = s.eenheden.hoogteOp ? s.eenheden.hoogteOp(dak) : 0;
  uit.opDak = koning.opMuur && K.object[dak] === 7;
  const plekken = [];
  for (let r = 3; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = rs.x + dx, y = rs.y + dy;
    if (x > 1 && y > 1 && x < B - 2 && y < K.hoogte - 2 && W.isVrij(x, y, 0) && dx > 0) plekken.push([x, y]);
  }
  s.leger.zetStand(plekken.slice(0, 12).map(([x, y]) => ['ridder', x, y, 60, 0]));
  const groep = s.leger.soldaten().filter((e) => e.soldaat.sleutel !== 'koning');
  uit.groep = groep.length;
  s.strijd.valAan(groep, koning);
  let stappen = 0;
  while (stappen < 6000 && !koning.dood && !s.strijd.uitslag()) { sim(50); stappen += 50; }
  uit.koningDood = !!koning.dood;
  uit.uitslag = s.strijd.uitslag();
  uit.stappen = stappen;
  uit.levend = s.leger.soldaten().filter((e) => e.soldaat.sleutel !== 'koning' && !e.dood).length;
  return uit;
});
console.log(JSON.stringify(w));
check('rood heeft een koning', w.heeftKoning === true);
check('de koning staat op het dak', w.opDak === true);
check('jouw soldaten staan klaar', w.groep >= 8, w.groep);
check('de koning op het dak wordt verslagen', w.koningDood === true, JSON.stringify(w));
check('daarmee win je het level', w.uitslag === 'gewonnen', w.uitslag);

check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
