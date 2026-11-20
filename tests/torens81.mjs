// 0.80.1: level 6 krijgt bemande torens (ballista's en kruisbogen), een garnizoen op het slotplein,
// geen rode werkers meer en meer steigers en decor.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8266;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1'); });
await p.evaluate(() => {
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3, 4, 5] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 6 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht();
await p.waitForFunction(() => { const v = document.getElementById('verhaalbeeld'); return !v || v.hidden || getComputedStyle(v).display === 'none'; }, null, { timeout: 30000 }).catch(() => {});
await p.evaluate(() => { const k = document.getElementById('missie-begin'); if (k) k.click(); });
await p.waitForTimeout(800);

const r = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, m = K.start[1];
  const O = { TOREN: 0 };
  const torens = [];
  for (let i = 0; i < K.object.length; i++) if (K.eigenaar[i] === 2 && (K.object[i] === 4 + 0 * 1 && false)) torens.push(i);
  const posten = s.strijd.torenPosten();
  const garn = s.strijd.garnizoen().filter((e) => Math.hypot(e.x - m.x, e.y - m.y) < 6);
  return {
    posten: posten.map((e) => ({ s: e.vijand, vak: Math.floor(e.y) * B + Math.floor(e.x), opMuur: e.opMuur, h: e.hoogte })),
    slot: garn.length, slotSoorten: garn.map((e) => e.vijand),
    wachters: s.strijd.wachters().length,
  };
});
console.log(JSON.stringify(r).slice(0, 600));
check('torenposten aanwezig', r.posten.length >= 6, r.posten.length);
check('ballista en kruisboog op torens', r.posten.some((e) => e.s === 'ballista') && r.posten.some((e) => e.s === 'kruisboog'));
check('torenposten staan op de muur en hoog', r.posten.every((e) => e.opMuur && e.h > 0));
check('slotgarnizoen op het plein', r.slot >= 12, r.slot);
check('meer wachters', r.wachters >= 12, r.wachters);
check('geen pagina fouten', fouten.length === 0, fouten.join('|'));

// Gedrag: een kruisboog en een ballista op hun toren schieten op een soldaat van jou binnen bereik, en lopen niet weg.
const g = await p.evaluate(async () => {
  const s = window.spel, K = s.kaart, B = K.breedte;
  s.strijd.pauzeer(true);
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } };
  const posten = s.strijd.torenPosten();
  const bal = posten.find((e) => e.vijand === 'ballista');
  const kruis = posten.find((e) => e.vijand === 'kruisboog');
  const uit = { n: posten.length, nBal: posten.filter((e) => e.vijand === 'ballista').length, nKruis: posten.filter((e) => e.vijand === 'kruisboog').length };
  // alle torens van rood
  let torens = 0; for (let i = 0; i < K.object.length; i++) if (K.eigenaar[i] === 2 && (K.object[i] === 5 || K.object[i] === 6)) torens++;
  uit.torens = torens;
  const x0 = bal.x, y0 = bal.y;
  // een zwaardvechter van jou, 4 tegels van de ballista
  let plek = -1;
  for (let r = 3; r < 6 && plek < 0; r++) for (let dy = -r; dy <= r && plek < 0; dy++) for (let dx = -r; dx <= r && plek < 0; dx++) {
    const x = Math.floor(x0) + dx, y = Math.floor(y0) + dy;
    if (Math.hypot(dx, dy) < 3.5 || !s.wegvinder.isVrij(x, y, 0)) continue;
    plek = y * B + x;
  }
  const z = s.leger.geef('zwaardvechter', plek, 200);
  z.leven = z.levenMax = 400;
  const l0 = z.leven;
  sim(120);
  uit.schade = l0 - z.leven;
  uit.balStaatStil = Math.abs(bal.x - x0) < 0.01 && Math.abs(bal.y - y0) < 0.01;
  uit.nogOpToren = bal.opMuur === true;
  // de toren valt: de bemanning staat op de grond en telt niet meer als torenpost
  const vak = Math.floor(kruis.y) * B + Math.floor(kruis.x);
  K.object[vak] = 0; K.eigenaar[vak] = 0;
  s.wegvinder.herbereken(); s.strijd.kaartVeranderd(); s.leger.kaartVeranderd();
  sim(5);
  uit.valt = !kruis.torenPost && !kruis.opMuur;
  // bewaren en terugzetten behoudt de torenposten
  const st = s.strijd.bewaarStand();
  uit.bewaard = st && Array.isArray(st.torenPosten) ? st.torenPosten.length : -1;
  return uit;
});
console.log(JSON.stringify(g));
check('ongeveer de helft van de torens heeft een ballista', g.nBal >= Math.floor(g.torens * 0.4) && g.nBal <= Math.ceil(g.torens * 0.6), `${g.nBal} van ${g.torens}`);
check('een aantal torens heeft een kruisboog', g.nKruis >= 3 && g.nKruis <= Math.ceil(g.torens * 0.35), `${g.nKruis} van ${g.torens}`);
check('de ballista schiet op een soldaat binnen bereik', g.schade > 0, g.schade);
check('de ballista blijft staan op zijn toren', g.balStaatStil && g.nogOpToren);
check('valt de toren, dan staat de schutter op de grond', g.valt);
check('torenposten worden bewaard', g.bewaard >= 1, g.bewaard);

// Werkvolk: veel rode ingenieurs die rondlopen en met de hamer werken.
await p.evaluate(() => window.spel.strijd.pauzeer(false));
await p.waitForTimeout(12000);
const w = await p.evaluate(() => {
  const v = window.spel.rood.groei.werkvolk();
  return { n: v.length, werkt: v.filter((e) => e.houding === 'sla').length, loopt: v.filter((e) => e.pad).length, ingenieur: v.every((e) => e.team === 1) };
});
console.log(JSON.stringify(w));
check('minstens 30 rode ingenieurs', w.n >= 30, w.n);
check('ze werken en lopen tegelijk', w.werkt >= 3 && w.loopt >= 3, JSON.stringify(w));
await p.evaluate(() => window.spel.strijd.pauzeer(true));

// Screenshots
const foto = async (naam, x, y, zoom) => {
  await p.evaluate(async ([x, y, zoom]) => {
    const s = window.spel; const { rasterNaarWereld } = await import('/js/iso.js');
    const w = rasterNaarWereld(x, y); s.camera.zetZoom(zoom); s.camera.kijkNaar(w.x, w.y);
  }, [x, y, zoom]);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `/home/claude/${naam}.png` });
};
const mid = await p.evaluate(() => window.spel.kaart.start[1]);
await foto('0801-slot', mid.x, mid.y, 0.8);
await foto('0801-toren', mid.x - 9, mid.y - 9, 1.5);
console.log(`${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
