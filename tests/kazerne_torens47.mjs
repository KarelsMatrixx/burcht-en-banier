// 0.65: Watchtower 7 plekken, Tower 3 plekken, 40 soldaten per kazerne, Food heet Apples.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8290'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });

// ---- Deel 1: vrij spel: namen, torenplekken, Apples ----
await p.goto('http://localhost:8290/'); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
const d = await p.evaluate(async () => {
  const bw = (await (await fetch('data/bouwwerken.json')).json()).bouwwerken;
  const s = window.spel; s.strijd.pauzeer(true);
  const K = s.kaart; const B = K.breedte; const st = K.start[0];
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); } };
  const zet = (n) => s.leger.zetStand(Array.from({ length: n }, (_, i) => ['ridder', st.x + 3 + (i % 4), st.y + 3 + Math.floor(i / 4), 60, 0]));
  const leeg = () => { for (const e of s.leger.soldaten()) if (!e.koning) s.leger.sneuvel(e); };
  const uit = {
    naamToren: bw.toren.naam, naamWacht: bw.wachttoren.naam, kostToren: bw.toren.kosten.steen, kostWacht: bw.wachttoren.kosten.steen,
    appels: s.regels.grondstoffen.voedsel.naam, brood: s.regels.grondstoffen.brood.naam,
  };
  // Een toren met twee stukken muur en een poort, van jou, op een rij open grond
  const bouw = (rij, obj) => {
    for (let x = st.x + 6; x < K.breedte - 6; x++) {
      const v = [0, 1, 2, 3].map((k) => (st.y + rij) * B + x + k);
      if (v.every((i) => K.object[i] === 0)) {
        for (const [i, o] of [[v[0], obj], [v[1], 4], [v[2], 4], [v[3], 6]]) { K.object[i] = o; K.eigenaar[i] = 1; }
        s.wegvinder.herbereken(); s.leger.kaartVeranderd();
        return v[0];
      }
    }
    return -1;
  };
  const test = (rij, obj, aantal) => {
    leeg();
    const tw = bouw(rij, obj);
    if (tw < 0) return { fout: 'geen plek' };
    zet(aantal); s.leger.kiesAlles();
    s.leger.stuur(tw % B, Math.floor(tw / B), true);
    sim(700);
    const op = s.leger.soldaten().filter((e) => e.opMuur && Math.floor(e.y) * B + Math.floor(e.x) === tw);
    let min = 9;
    for (let i = 0; i < op.length; i++) for (let j = i + 1; j < op.length; j++) min = Math.min(min, Math.hypot(op[i].x - op[j].x, op[i].y - op[j].y));
    return { op: op.length, min };
  };
  uit.watchtower = test(8, 5, 9);     // OBJECT.TOREN: 9 gestuurd
  uit.tower = test(13, 10, 5);        // OBJECT.WACHTTOREN: 5 gestuurd
  return uit;
});
console.log(JSON.stringify(d));
check('duurdere toren heet Watchtower', d.naamToren === 'Watchtower' && d.kostToren === 12, JSON.stringify([d.naamToren, d.kostToren]));
check('goedkopere toren heet Tower', d.naamWacht === 'Tower' && d.kostWacht === 8, JSON.stringify([d.naamWacht, d.kostWacht]));
check('Food heet Apples, Bread blijft Bread', d.appels === 'Apples' && d.brood === 'Bread', JSON.stringify([d.appels, d.brood]));
check('Watchtower: precies 7 van de 9', d.watchtower && d.watchtower.op === 7, JSON.stringify(d.watchtower));
check('Watchtower: soldaten staan niet op elkaar', d.watchtower && d.watchtower.min > 0.15, d.watchtower && d.watchtower.min);
check('Tower: precies 3 van de 5', d.tower && d.tower.op === 3, JSON.stringify(d.tower));
check('Tower: soldaten staan niet op elkaar', d.tower && d.tower.min > 0.15, d.tower && d.tower.min);

// ---- Deel 2: level 5 (legerMax 60): 40 per kazerne, nooit meer dan het level toestaat ----
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3, 4] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 5 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
const k = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(true);
  const K = s.kaart; const B = K.breedte; const st = K.start[0];
  const uit = { levelMax: s.regels.legerMax, perKazerne: s.regels.legerPerKazerne };
  for (const e of s.leger.soldaten()) if (!e.koning) s.leger.sneuvel(e);
  const eigen = (o) => { let n = 0; for (let i = 0; i < K.object.length; i++) if (K.object[i] === o && K.eigenaar[i] === 1) n++; return n; };
  uit.kazernesBegin = eigen(21);
  // Kazernes op open grond bij de burcht
  const vrij = []; for (let r = 4; r < 14 && vrij.length < 6; r++) for (let dx = -r; dx <= r && vrij.length < 6; dx++) { const x = st.x + dx, y = st.y + r; if (x > 0 && x < B - 1 && K.object[y * B + x] === 0 && K.grond[y * B + x] <= 2) vrij.push(y * B + x); }
  const zetKazerne = (i) => { K.object[i] = 21; K.eigenaar[i] = 1; s.leger.kaartVeranderd(); };
  uit.max0 = s.leger.max;
  zetKazerne(vrij[0]); uit.max1 = s.leger.max;
  zetKazerne(vrij[2]); uit.max2 = s.leger.max;
  // Vul tot de grens met een kazerne
  K.object[vrij[2]] = 0; K.eigenaar[vrij[2]] = 0; s.leger.kaartVeranderd();
  uit.max1b = s.leger.max;
  const vul = uit.max1b - s.leger.plekken();
  s.leger.zetStand(Array.from({ length: vul }, (_, i) => ['ridder', st.x + 3 + (i % 8), st.y + 2 + Math.floor(i / 8), 60, 0]));
  uit.plekkenVol = s.leger.plekken();
  uit.reden1 = s.leger.waaromNiet('ridder');
  zetKazerne(vrij[2]);
  uit.redenNa2 = s.leger.waaromNiet('ridder');
  // Tweede kazerne weer weg: de bestaande troepen blijven leven
  K.object[vrij[2]] = 0; K.eigenaar[vrij[2]] = 0; s.leger.kaartVeranderd();
  uit.nogLeven = s.leger.plekken();
  return uit;
});
console.log(JSON.stringify(k));
check('level 5 heeft legerMax 60 en 40 per kazerne', k.levelMax === 60 && k.perKazerne === 40, JSON.stringify([k.levelMax, k.perKazerne]));
check('zonder kazerne: 0 plekken', k.max0 === 0, k.max0);
check('1 kazerne: 40 plekken', k.max1 === 40, k.max1);
check('2 kazernes: 60 plekken (de grens van het level)', k.max2 === 60, k.max2);
check('leger vult tot de grens van 1 kazerne', k.plekkenVol === 40, k.plekkenVol);
check('vol met 1 kazerne: melding wijst op een extra kazerne', /army is full \(40 places\).*another barracks/.test(k.reden1), k.reden1);
check('met 2 kazernes kun je weer opleiden (geen legermelding)', !/army is full/.test(k.redenNa2), k.redenNa2);
check('sloop je een kazerne, dan blijven de soldaten leven', k.nogLeven === 40, k.nogLeven);

// ---- Deel 3: proloog heeft de kazerneregel niet ----
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 0 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
const pr = await p.evaluate(() => ({ per: window.spel.regels.legerPerKazerne, max: window.spel.leger.max }));
check('proloog: geen kazerneregel, max 120', pr.per === 0 && pr.max === 120, JSON.stringify(pr));

check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
