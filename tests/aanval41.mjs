// Versie 0.81.0: spannendere aanvallen van rood.
// Verzamelpunt buiten het echte bereik van jouw schutters, uitwijken of aanvallen onder vuur,
// rood meet jouw sterkte, koningsjagers, schijnaanval, belegering en grote bestorming.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8279'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const fouten = []; let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
let p;
async function start(l) {
  if (p) await p.context().close();
  p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  p.on('pageerror', (e) => fouten.push(String(e)));
  await p.goto('http://localhost:8279/'); await p.waitForFunction(() => window.spel && window.spel.strijd);
  await p.evaluate((l) => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3, 4, 5, 6] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: l })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, l);
  await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd); await p.waitForTimeout(300);
  await p.evaluate(() => window.spel.strijd.pauzeer(true));
}
// Ringmuur van straal 6 met poort, en schutters op de muur rondom.
const ring = (schutters = 8) => p.evaluate((schutters) => {
  const s = window.spel; const k = s.kaart; const m = s.strijd.burcht(); const r = 6; const muur = [];
  for (let d = -r; d <= r; d++) for (const [x, y] of [[m.x + d, m.y - r], [m.x + d, m.y + r], [m.x - r, m.y + d], [m.x + r, m.y + d]]) {
    if (x < 0 || y < 0 || x >= k.breedte || y >= k.hoogte || k.object[y * k.breedte + x] !== 0) continue;
    const poort = x === m.x + r && y === m.y;
    s.bouwer.zetVast(y * k.breedte + x, poort ? 6 : 4);
    if (!poort) muur.push([x, y]);
  }
  s.wegvinder.herbereken(); s.strijd.kaartVeranderd();
  // Schutters gelijkmatig binnen de muur (op 1 tegel binnen de ring).
  const g = [];
  for (let i = 0; i < schutters; i++) {
    const a = (i / schutters) * Math.PI * 2; const x = Math.round(m.x + Math.cos(a) * (r - 1.5)); const y = Math.round(m.y + Math.sin(a) * (r - 1.5));
    if (s.wegvinder.isVrij(x, y, 0)) g.push(['boogschutter', x, y, 999]);
  }
  s.leger.zetStand(g);
  return s.leger.lijst.filter((e) => e.soldaat && e.soldaat.sleutel === 'boogschutter').length;
}, schutters);
const spoel = (sec, fn = null) => p.evaluate(([sec]) => { const s = window.spel; for (let i = 0; i < sec * 10; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } }, [sec]);

// ---- 1. Verzamelpunt buiten bereik van jouw schutters (level 5) -------------------------------
await start(5);
const nS = await ring(8);
const v1 = await p.evaluate(() => {
  const s = window.spel; const R = s.regels;
  s.strijd.stuurLeger({ zwaardvechter: 4, ridder: 4, boogschutter: 3, ram: 1 }, true);
  const v = s.strijd.vijanden().filter((e) => e.krijg && e.krijg.tak && e.krijg.tak.verzamel >= 0);
  const B = s.kaart.breedte;
  const sch = s.leger.lijst.filter((e) => e.soldaat && e.soldaat.sleutel === 'boogschutter');
  const reik = (e) => R.soldaten.boogschutter.bereik + (e.opMuur ? R.muurBereik : 0);
  let min = Infinity;
  for (const e of v) { const vak = e.krijg.tak.verzamel; const x = vak % B + 0.5, y = Math.floor(vak / B) + 0.5; for (const a of sch) min = Math.min(min, Math.hypot(a.x - x, a.y - y) - reik(a)); }
  return { n: v.length, ruimte: min };
});
check('ring met schutters staat', nS >= 6, nS);
check('iedereen heeft een verzamelvak', v1.n >= 10, v1.n);
check('elk verzamelvak ligt minstens 2 tegels buiten het bereik van elke schutter', v1.ruimte >= 2, v1.ruimte);

// ---- 2. Onder vuur: uitwijken (weinig er) of aanvallen (genoeg er) ---------------------------
const v2 = await p.evaluate(() => {
  const s = window.spel; const stap = () => { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); };
  const g0 = s.veld.groepen().find((g) => g.hoofd); const rally0 = g0.rally; const B = s.kaart.breedte;
  // Direct na vertrek: zet een schutter van jou vlak bij het verzamelpunt (nog bijna niemand is er).
  const x = rally0 % B, y = Math.floor(rally0 / B);
  s.leger.zetStand([...s.leger.lijst.filter((e) => e.soldaat).map((e) => [e.soldaat.sleutel, Math.floor(e.x), Math.floor(e.y), e.leven]), ['boogschutter', x + 3, y, 999]]);
  for (let i = 0; i < 30; i++) stap();
  const g1 = s.veld.groepen().find((g) => g.hoofd);
  const log = s.ui.logboek().map((r) => r.tekst);
  return { rally0, rally1: g1.rally, fase: g1.fase, uit: log.some((t) => /pulls back/.test(t)), storm: log.some((t) => /charges/.test(t)) };
});
check('onder vuur reageert rood: uitwijken of aanvallen', (v2.rally1 !== v2.rally0 && v2.uit) || v2.storm || v2.fase !== 'verzamel', JSON.stringify(v2));

// ---- 3. Rood meet jouw sterkte ----------------------------------------------------------------
await start(5);
const v3 = await p.evaluate(() => {
  const s = window.spel; const m = s.strijd.burcht(); const g = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if ((dx || dy) && g.length < 24 && s.wegvinder.isVrij(Math.floor(m.x) + dx, Math.floor(m.y) + dy, 0)) g.push(['ridder', Math.floor(m.x) + dx, Math.floor(m.y) + dy, 999]);
  const voor = s.rood.stand().doel;
  s.leger.zetStand(g);
  const na = s.rood.stand().doel;
  return { voor, na, sterk: s.veld.jouwSterkte(), aanpas: s.veld.instelling(1).aanpas };
});
check('met een groot leger van jou eist rood een grotere aanval', v3.na > v3.voor && v3.na >= v3.sterk * v3.aanpas / 3 * 0.99 - 0.01, JSON.stringify(v3));
const v3b = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(false); s.rood.zetVoorraad('goud', 0); s.rood.zetSinds(9999);
  const g0 = s.rood.stand().voorraad.goud;
  for (let i = 0; i < 100; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); }
  return { g0, g1: s.rood.stand().voorraad.goud };
});
check('kan rood het niet betalen, dan krijgt hij goud bij', v3b.g1 > v3b.g0 + 5, JSON.stringify(v3b));

// ---- 4. Koningsjagers (level 5, geen muur: de weg naar de koning is open) ----------------------
await start(5);
const v4 = await p.evaluate(() => {
  const s = window.spel; const stap = () => { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); };
  s.strijd.stuurLeger({ ridder: 10, boogschutter: 2 }, true);
  const v = s.strijd.vijanden().filter((e) => e.krijg && e.krijg.tak);
  const jagers = v.filter((e) => e.krijg.tak.jager);
  let jaagt = false;
  for (let i = 0; i < 2500 && !jaagt; i++) { stap(); jaagt = jagers.some((e) => !e.dood && e.krijg.jaagtKoning); }
  return { jagers: jagers.length, jaagt, log: s.ui.logboek().map((r) => r.tekst).some((t) => /king-hunters/.test(t)) };
});
check('er zijn 1 tot 3 koningsjagers', v4.jagers >= 1 && v4.jagers <= 3, v4.jagers);
check('een koningsjager rent naar jouw koning als er een weg is', v4.jaagt, JSON.stringify(v4));
check('de speler krijgt een waarschuwing', v4.log, JSON.stringify(v4));

// ---- 5. Schijnaanval (level 3, niveau 3, ring) --------------------------------------------------
await start(3);
await ring(4);
const v5 = await p.evaluate(() => {
  const s = window.spel; const stap = () => { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); };
  s.strijd.stuurLeger({ ridder: 12, boogschutter: 3, ram: 1 }, true);
  const gr = s.veld.groepen(); const hoofd = gr.find((g) => g.hoofd); const flank = gr.find((g) => !g.hoofd && g.rally !== hoofd.rally);
  let flankAanval = null, hoofdOpmars = null;
  for (let i = 0; i < 3000 && hoofdOpmars === null; i++) {
    stap();
    const g = s.veld.groepen();
    const f = flank && g.find((x) => x.id === flank.id), h = g.find((x) => x.id === hoofd.id);
    if (f && f.fase === 'aanval' && flankAanval === null) flankAanval = i / 10;
    if (h && (h.fase === 'opmars' || h.fase === 'aanval') && hoofdOpmars === null) hoofdOpmars = i / 10;
  }
  return { flank: !!flank, flankAanval, hoofdOpmars };
});
check('er is een schijnaanval (flank)', v5.flank, JSON.stringify(v5));
check('de schijnaanval valt eerst aan; de hoofdmacht vertrekt minstens 15 s later', v5.flankAanval !== null && v5.hoofdOpmars !== null && v5.hoofdOpmars >= v5.flankAanval + 15, JSON.stringify(v5));

// ---- 6. Belegering en bestorming (level 5, niveau 4) -------------------------------------------
await start(5);
await ring(0);
const v6 = await p.evaluate(() => {
  const s = window.spel; const stap = () => { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); };
  s.strijd.stuurLeger({ ridder: 8, boogschutter: 2, katapult: 1 }, true);
  let beleg = false;
  for (let i = 0; i < 2000 && !beleg; i++) { stap(); beleg = s.veld.groepen().some((g) => g.fase === 'beleg'); }
  return { beleg, piek5: s.veld.piek(5), log: s.ui.logboek().map((r) => r.tekst).some((t) => /catapults open fire/.test(t)), kv: s.veld.katapultVanaf(1) };
});
check('met een katapult begint de aanval met een belegering', v6.beleg && v6.log, JSON.stringify(v6));
check('aanval 5 is een grote bestorming (1,6 keer)', Math.abs(v6.piek5 - 1.6) < 0.01, v6.piek5);
check('belegering: rood koopt al vanaf aanval 3 een katapult', v6.kv === 3, v6.kv);

check('geen paginafouten', fouten.length === 0, fouten.join('|'));
console.log('aanval41:', ok, 'goed,', fout, 'fout');
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
