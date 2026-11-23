// 0.80.0: de ingenieur heeft een bouwmenu. Naast de trebuchet (twee ingenieurs, op de grond) bouwt een ingenieur
// alleen een ballista op een stuk muur of toren van jou: een reuzenkruisboog die op soldaten en machines schiet,
// vast blijft staan en niet bij een trebuchet kan.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8265;
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

// 1. Data
const data = await p.evaluate(() => {
  const s = window.spel, so = s.leger.soorten;
  return { bal: so.ballista, treb: so.trebuchet, ing: so.ingenieur, kat: so.katapult };
});
check('ballista: geschut, op de muur, door een ingenieur, niet op te leiden', data.bal && data.bal.geschut && data.bal.bouwOp === 'muur' && data.bal.bouwDoor === 1 && data.bal.kazerne === 'geen', JSON.stringify(data.bal));
check('ballista kost hout en steen, minder dan een trebuchet', data.bal.kosten.hout > 0 && data.bal.kosten.steen > 0 && data.bal.kosten.hout < data.treb.kosten.hout, JSON.stringify(data.bal.kosten));
check('ballista reikt minder ver dan een trebuchet', data.bal.bereik + 2 < data.treb.bereik, `${data.bal.bereik} tegen ${data.treb.bereik}`);
check('de trebuchet blijft: twee ingenieurs, op de grond', data.treb.bouwOp === 'grond' && data.treb.bouwDoor === 2);
check('het bouwmenu van de ingenieur heeft trebuchet en ballista', data.ing.bouwLijst && data.ing.bouwLijst.includes('trebuchet') && data.ing.bouwLijst.includes('ballista'), JSON.stringify(data.ing.bouwLijst));

// 2. Een stuk muur met toren en poort van jou; een ingenieur klimt erop en bouwt een ballista
const r = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, st = K.start[0];
  s.strijd.pauzeer(true);
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); s.doel.stap(0.1); } };
  for (const g of s.strijd.garnizoen()) { g.leven = 0; g.dood = true; }
  let x0 = -1, y0 = -1;
  for (let y = st.y + 6; y < st.y + 16 && x0 < 0; y++) for (let x = st.x - 8; x < st.x + 8 && x0 < 0; x++) {
    let vrij = true; for (let k = -2; k <= 6; k++) for (let d = -2; d <= 2; d++) if (!s.wegvinder.isVrij(x + k, y + d, 0)) vrij = false;
    if (vrij) { x0 = x; y0 = y; }
  }
  const v = y0 * B + x0;
  for (const [i, o] of [[v, 4], [v + 1, 5], [v + 2, 4], [v + 3, 6]]) { K.object[i] = o; K.eigenaar[i] = 1; }
  s.wegvinder.herbereken(); s.leger.kaartVeranderd();
  const uit = { x0, y0, v };
  // zonder ingenieur kan het niet
  uit.zonder = s.strijd.bouwBallista([], v + 1, null);
  // een ingenieur op de grond naast de poort
  const e = s.leger.geef('ingenieur', (y0 + 1) * B + x0 + 3, 6);
  s.leger.kies([e]);
  uit.opGrond = s.strijd.ballistaPlekOk(v + 1);
  uit.opGrondVrij = s.strijd.ballistaPlekOk((y0 + 3) * B + x0);   // open grond: geen muur
  uit.grondKan = s.strijd.bouwBallista([e], (y0 + 3) * B + x0, null);   // 0: niet op de grond
  uit.uitkomst = s.strijd.bouwBallista([e], v + 1, { hout: 50, steen: 30 });
  uit.projecten = s.strijd.projectenAantal();
  let bal = null;
  for (let i = 0; i < 400 && !bal; i++) { sim(5); bal = s.leger.soldaten().find((x) => x.soldaat.sleutel === 'ballista') || null; }
  uit.klaar = !!bal;
  if (bal) {
    uit.balMuur = bal.opMuur; uit.balVak = bal.y * 0 + Math.floor(bal.y) * B + Math.floor(bal.x); uit.torenVak = v + 1;
    uit.ingMuur = e.opMuur; uit.ingFase = e.krijg.ing && e.krijg.ing.fase; uit.ingVak = Math.floor(e.y) * B + Math.floor(e.x);
    uit.bediend = !!(e.krijg.ing && e.krijg.ing.treb === bal);
    // dezelfde plek: geen tweede ballista
    uit.dubbel = s.strijd.bouwBallista([e], v + 1, null);
  }
  window.__bal = bal; window.__ing = e; window.__v = v;
  return uit;
});
check('zonder ingenieur: -2', r.zonder === -2, r.zonder);
check('een stuk muur of toren mag, open grond niet', r.opGrond === true && r.opGrondVrij === false && r.grondKan === 0, JSON.stringify(r));
check('de ingenieur krijgt het bevel', r.uitkomst === 1 && r.projecten === 1, JSON.stringify(r));
check('de ballista wordt gebouwd', r.klaar, JSON.stringify(r));
check('de ballista staat boven op de toren, bij zijn ingenieur', r.balMuur === true && r.balVak === r.torenVak && r.ingMuur === true && r.ingVak === r.torenVak, JSON.stringify(r));
check('de ingenieur bedient hem', r.ingFase === 'bedien' && r.bediend, JSON.stringify(r));
check('op dezelfde plek kan er geen tweede', r.dubbel === 0, r.dubbel);

// 3. Schieten: op soldaten en machines, niet op een trebuchet
const s3 = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte;
  const bal = window.__bal; const e = window.__ing;
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); s.doel.stap(0.1); } };
  const bx = Math.floor(bal.x), by = Math.floor(bal.y);
  const vrij = (x, y) => x > 1 && y > 1 && x < B - 2 && y < K.hoogte - 2 && s.wegvinder.isVrij(x, y, 1) && K.object[y * B + x] === 0;
  const dichtbij = [];
  for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) { const d = Math.hypot(dx, dy); if (d >= 6 && d <= 8 && vrij(bx + dx, by + dy)) dichtbij.push([bx + dx, by + dy]); }
  const uit = { plekken: dichtbij.length };
  // een rode ram en een rode ridder binnen bereik
  const [rx, ry] = dichtbij[0]; const [qx, qy] = dichtbij[Math.floor(dichtbij.length / 2)];
  const ram = s.strijd.zetVijand('ram', rx, ry, 300);
  const ridder = s.strijd.zetVijand('ridder', qx, qy, 200);
  const ram0 = ram.leven, rid0 = ridder.leven;
  // een rode trebuchet net binnen de afstand van het geschut: die wordt niet geraakt
  const treb = s.strijd.zetVijand('trebuchet', dichtbij[1][0], dichtbij[1][1], 220);
  const treb0 = treb.leven;
  for (const v of [ram, ridder]) { v.krijg.denk = 99999; }
  sim(300);
  uit.ram = [ram0, Math.round(ram.leven), !!ram.dood]; uit.ridder = [rid0, Math.round(ridder.leven), !!ridder.dood];
  uit.treb = [treb0, Math.round(treb.leven)];
  uit.schiet = bal.houding || null;
  uit.balLeven = Math.round(bal.leven);
  window.__vijand = { ram, ridder, treb };
  return uit;
});
check('de ballista raakt een ram of een ridder binnen bereik', (s3.ram[1] < s3.ram[0]) || (s3.ridder[1] < s3.ridder[0]) || s3.ram[2] || s3.ridder[2], JSON.stringify(s3));
check('een trebuchet binnen die afstand wordt niet beschoten', s3.treb[1] === s3.treb[0], JSON.stringify(s3));

// 4. Zonder ingenieur zwijgt hij; Release crew maakt de ingenieur vrij
const s4 = await p.evaluate(() => {
  const s = window.spel;
  const bal = window.__bal, e = window.__ing, { ridder, ram } = window.__vijand;
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); s.doel.stap(0.1); } };
  const uit = {};
  uit.staatVast = s.leger.staatVast('ballista') && !s.leger.staatVast('ridder');
  s.leger.kies([bal]);
  const n = s.strijd.ontkoppel(s.leger.gekozen()).n;
  uit.ontkoppeld = n; uit.ingNu = e.krijg.ing === null || e.krijg.ing === undefined;
  // verse vijanden dicht bij: hij zwijgt nu
  const nu0 = []; for (const v of [ridder, ram]) { v.leven = v.levenMax; v.dood = false; nu0.push(v.leven); }
  ridder.x = bal.x + 2; ridder.y = bal.y + 2.5; ridder.krijg.denk = 99999;
  const l0 = ridder.leven;
  sim(120);
  uit.zwijgt = Math.round(ridder.leven) >= Math.round(l0) - 1 || bal.dood;
  uit.verplaatst = Math.hypot(bal.x - Math.floor(bal.x) - 0.5, bal.y - Math.floor(bal.y) - 0.5) < 1.2;
  return uit;
});
check('een ballista is vast en een ridder niet', s4.staatVast);
check('Release crew werkt ook voor een ballista', s4.ontkoppeld >= 1 && s4.ingNu, JSON.stringify(s4));

// 5. Het bouwmenu in beeld: Build opent Trebuchet en Ballista
const menu = await p.evaluate(() => {
  const s = window.spel;
  const e = window.__ing;
  s.leger.kies([e]);
  return new Promise((klaar) => setTimeout(() => {
    const zicht = (id) => { const el = document.getElementById(id); return !!el && !el.hidden && el.offsetParent !== null; };
    const voor = { bouw: zicht('knop-bouw'), treb: zicht('knop-trebuchet'), bal: zicht('knop-ballista') };
    document.getElementById('knop-bouw').click();
    setTimeout(() => {
      const open = { bouw: zicht('knop-bouw'), treb: zicht('knop-trebuchet'), bal: zicht('knop-ballista') };
      document.getElementById('knop-ballista').click();
      setTimeout(() => {
        const modus = { hint: document.getElementById('legerhint').textContent, tekst: document.getElementById('knop-ballista').textContent };
        klaar({ voor, open, modus });
      }, 150);
    }, 150);
  }, 200));
});
check('met een ingenieur gekozen: alleen Build, daarna Trebuchet en Ballista', menu.voor.bouw && !menu.voor.treb && !menu.voor.bal && menu.open.treb && menu.open.bal, JSON.stringify(menu));
check('Ballista aantikken: de speler kiest een stuk muur', /wall|tower/i.test(menu.modus.hint) && menu.modus.tekst === 'Cancel', JSON.stringify(menu.modus));
check('geen pagina-fouten', fouten.length === 0, fouten.join('|'));
console.log(`ballista80: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
