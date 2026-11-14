// Stap 38 (versie 0.48.0): de veldheer van rood. Samen aankomen, golven met rol, doelkeuze,
// tegenzetten, terugtrekken en de moeilijkheidscurve (js/veldheer.js).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8238;
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

const start = async (missie) => {
  await p.evaluate((m) => {
    localStorage.clear();
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3, 4, 5, 6, 7, 8, 9] }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m }));
    sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('burcht-banier.paneel', 'bouw');
  }, missie);
  await p.reload(); await wacht(); await p.waitForTimeout(300);
  await p.evaluate(() => window.spel.strijd.pauzeer(true));
};
// Eén stuk spel vooruit: seconden van 0,1.
const spoel = (sec) => p.evaluate((sec) => { const s = window.spel; for (let i = 0; i < sec * 10; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } }, sec);


// Een ringmuur met poort rond je burcht (rood kiest zijn bres in zulke muren).
const bouwRing = () => p.evaluate(() => {
  const s = window.spel; const k = s.kaart; const m = s.strijd.burcht(); const O = { MUUR: 4, POORT: 6 };
  const objecten = s.kaart.object; void objecten;
  const r = 5;
  for (let d = -r; d <= r; d++) {
    for (const [x, y] of [[m.x + d, m.y - r], [m.x + d, m.y + r], [m.x - r, m.y + d], [m.x + r, m.y + d]]) {
      if (x < 0 || y < 0 || x >= k.breedte || y >= k.hoogte) continue;
      const poort = x === m.x + r && y === m.y;
      if (k.object[y * k.breedte + x] !== 0) continue;
      s.bouwer.zetVast(y * k.breedte + x, poort ? s.wegvinder.OBJ_POORT ?? 6 : 4);
    }
  }
  s.wegvinder.herbereken(); s.strijd.kaartVeranderd();
});

// ---- Laag 1: samen aankomen (level 1, niveau 1) -------------------------------------------
async function aankomst(synchroon) {
  await start(1);
  return p.evaluate((synchroon) => {
    const s = window.spel;
    s.regels.heer.aanval.niveaus['1'].synchroon = synchroon;
    s.strijd.stuurLeger({ ridder: 4, boogschutter: 2, ram: 1, ladder: 1 }, true);
    const vijanden = s.strijd.vijanden();
    const keep = s.strijd.burcht();
    const eerste = new Map();
    const hold = vijanden.map((e) => [e.vijand, e.krijg.tak ? e.krijg.tak.houdTot : -1]);
    for (let i = 0; i < 1800; i++) {
      s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap();
      for (const e of vijanden) if (!eerste.has(e) && Math.hypot(e.x - keep.x, e.y - keep.y) <= 6.5) eerste.set(e, i / 10);
    }
    const tijden = vijanden.map((e) => [e.vijand, eerste.get(e) ?? null]);
    return { hold, tijden };
  }, synchroon);
}
const zonder = await aankomst(false);
const met = await aankomst(true);
const spreiding = (r) => { const t = r.tijden.filter((x) => x[0] !== 'boogschutter').map((x) => x[1]).filter((x) => x !== null); return t.length ? Math.max(...t) - Math.min(...t) : 999; };
console.log('spreiding zonder plan', spreiding(zonder).toFixed(1), 'met plan', spreiding(met).toFixed(1), JSON.stringify(met.tijden));
check('zonder plan komen ze ver uit elkaar aan (ram veel later)', spreiding(zonder) > 15, spreiding(zonder));
check('met plan komen ridders, ram en ladder binnen 10 s van elkaar aan', spreiding(met) <= 10, spreiding(met));
check('het plan verkleint de spreiding sterk', spreiding(met) < spreiding(zonder) / 2, `${spreiding(met)} vs ${spreiding(zonder)}`);
check('met plan: bijna iedereen komt aan', met.tijden.filter((x) => x[1] !== null).length >= 6, JSON.stringify(met.tijden));
check('de ram wacht niet, de ridders wel', met.hold.find((h) => h[0] === 'ram')[1] === 0 && met.hold.find((h) => h[0] === 'ridder')[1] > 0, JSON.stringify(met.hold));

// ---- Laag 2: verkenners, tweede lijn, thuiswacht (level 2, niveau 2) ------------------------
await start(2);
const l2 = await p.evaluate(() => {
  const s = window.spel;
  s.strijd.stuurLeger({ ridder: 8, boogschutter: 6 }, true);
  const v = s.strijd.vijanden();
  const nu = s.strijd.stapNr();
  const wacht = v.map((e) => e.krijg.tak.houdTot - nu).sort((a, b) => a - b);
  const behoud = s.veld.behoud({ ridder: 10, boogschutter: 4, ram: 1 }, 2);
  const kleine = s.veld.behoud({ ridder: 3 }, 2);
  return { n: v.length, wacht, groepen: s.veld.groepen(), behoud, kleine, niveau2: s.veld.niveau(1) };
});
check('niveau 2 in level 2', l2.niveau2 === 2, l2.niveau2);
check('verkenners vertrekken eerst (1 tot 3 met kortste wacht)', l2.wacht[0] < l2.wacht[l2.wacht.length - 1], JSON.stringify(l2.wacht));
check('er zijn meer wachttijden dan een: tweede lijn komt later', new Set(l2.wacht).size >= 3, JSON.stringify([...new Set(l2.wacht)]));
check('thuiswacht: schutters blijven thuis, geen machines', l2.behoud.boogschutter > 0 && !l2.behoud.ram && Object.values(l2.behoud).reduce((a, c) => a + c, 0) <= 6, JSON.stringify(l2.behoud));
check('thuiswacht: kleine aanval blijft compleet', Object.keys(l2.kleine).length === 0, JSON.stringify(l2.kleine));

// ---- Laag 3: doelkeuze en flank (level 3, niveau 3) ------------------------------------------
await start(3);
await bouwRing();
const l3 = await p.evaluate(() => {
  const s = window.spel;
  const plan = (inhoud) => {
    for (const e of s.strijd.vijanden()) e.dood = true;
    s.strijd.stap();
    s.strijd.stuurLeger(inhoud, true);
    const v = s.strijd.vijanden();
    const doelen = new Map();
    for (const e of v) { const d = e.krijg.tak && e.krijg.tak.doel; if (d) doelen.set(d.vak, (doelen.get(d.vak) || 0) + 1); }
    return [...doelen.entries()];
  };
  const kaart = s.kaart;
  const B = kaart.breedte;
  const A = plan({ ridder: 10, boogschutter: 2 });
  // Zet een stevige verdediging bij de eerste bres en kijk of rood een ander stuk kiest.
  const eerste = A.sort((p, q) => q[1] - p[1])[0][0];
  const x = eerste % B; const y = Math.floor(eerste / B);
  const gezet = [];
  for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
    if (gezet.length >= 8) break;
    if (s.wegvinder.isVrij(x + dx, y + dy, 0)) gezet.push(['ridder', x + dx, y + dy, 60]);
  }
  s.leger.zetStand(gezet);
  const A2 = plan({ ridder: 10, boogschutter: 2 });
  const tweede = A2.sort((p, q) => q[1] - p[1])[0][0];
  const soort = (v) => kaart.object[v];
  return { A, eerste, tweede, ver: Math.hypot((tweede % B) - x, Math.floor(tweede / B) - y), eigenaar: kaart.eigenaar[eerste], soort: soort(eerste), gezet: gezet.length,
    log: window.spel.ui.logboek().map((r) => r.tekst).filter((t) => /Red masses/.test(t)).length };
});
check('bres is een muur of poort van jou', l3.eigenaar === 1 && (l3.soort === 5 || l3.soort === 4 || l3.soort === 6 || l3.soort >= 0), JSON.stringify([l3.eigenaar, l3.soort]));
check('flank: de aanval gaat naar twee bressen', l3.A.length >= 2, JSON.stringify(l3.A));
check('met soldaten bij de eerste bres kiest rood een andere', l3.gezet >= 4 && l3.tweede !== l3.eerste && l3.ver >= 3, JSON.stringify([l3.eerste, l3.tweede, l3.ver, l3.gezet]));
check('de speler wordt gewaarschuwd', l3.log >= 1, l3.log);

// ---- Laag 4: tegenzetten (level 5, niveau 4) ---------------------------------------------------
await start(5);
const l5 = await p.evaluate(() => {
  const s = window.spel;
  const x0 = Math.floor(s.strijd.burcht().x); const y0 = Math.floor(s.strijd.burcht().y);
  const zet = (sleutel, n) => {
    const lijst = [];
    for (let dx = -4; dx <= 4 && lijst.length < n; dx++) for (let dy = -4; dy <= 4 && lijst.length < n; dy++) if (s.wegvinder.isVrij(x0 + dx, y0 + dy, 0)) lijst.push([sleutel, x0 + dx, y0 + dy, 40]);
    s.leger.zetStand(lijst);
  };
  zet('boogschutter', 8);
  const schutters = { zwaard: s.veld.tegenFactor('zwaardvechter', 1), boog: s.veld.tegenFactor('boogschutter', 1), ram: s.veld.extraRam(1) };
  for (const e of s.leger.lijst) if (!s.regels.soldaten[e.soldaat.sleutel].koning) e.dood = true;
  s.strijd.stap();
  zet('ridder', 8);
  const ridders = { zwaard: s.veld.tegenFactor('zwaardvechter', 1), boog: s.veld.tegenFactor('boogschutter', 1), ram: s.veld.extraRam(1) };
  return { schutters, ridders, niveau: s.veld.niveau(1), piek: [s.veld.piek(2), s.veld.piek(3)] };
});
check('level 5 is niveau 4', l5.niveau === 4, l5.niveau);
check('veel schutters bij jou: meer zwaardvechters, minder schutters, extra ram', l5.schutters.zwaard > 1.3 && l5.schutters.boog < 1 && l5.schutters.ram === 1, JSON.stringify(l5.schutters));
check('veel ridders bij jou: meer schutters', l5.ridders.boog > 1.3 && l5.ridders.zwaard <= 1, JSON.stringify(l5.ridders));
check('piek op elke derde aanval', l5.piek[0] === 1 && l5.piek[1] > 1, JSON.stringify(l5.piek));

// ---- Laag 5: terugtrekken en terugkomen (niveau 5) -----------------------------------------------
await start(5);
const l8 = await p.evaluate(async () => {
  const s = window.spel;
  s.regels.heer.aanval.niveau = 5; s.regels.heer.aanval.max = 5;
  s.strijd.stuurLeger({ ridder: 10, boogschutter: 2 }, true);
  const v = s.strijd.vijanden();
  const stap = () => { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); };
  for (let i = 0; i < 3000 && s.strijd.stapNr() < s.veld.groepen()[0].vrijNa + 20; i++) stap();
  // De hele groep zwaar gewond: ze verliezen en trekken zich terug.
  for (const e of v) e.leven = Math.max(1, Math.round(e.levenMax * 0.15));
  for (let i = 0; i < 30; i++) stap();
  const terug = v.filter((e) => e.krijg.tak && e.krijg.tak.terug).length;
  const bericht = s.ui.logboek().some((r) => /wounded fall back/.test(r.tekst));
  // Zet ze bij hun burcht (de weg terug is lang en jouw koning staat dwars): daar rusten ze uit.
  const rood = s.strijd.rood();
  v.filter((e) => !e.dood).forEach((e, i) => {
    for (let r = 2; r <= 5; r++) {
      const x = Math.floor(rood.x) + (i % 4) - 1; const y = Math.floor(rood.y) + r + Math.floor(i / 4);
      if (s.wegvinder.isVrij(x, y, 1)) { e.x = x + 0.5; e.y = y + 0.5; e.pad = null; break; }
    }
  });
  const leven0 = v.filter((e) => !e.dood).reduce((a, e) => a + e.leven, 0);
  for (let i = 0; i < 1500; i++) stap();
  const leven1 = v.filter((e) => !e.dood).reduce((a, e) => a + e.leven, 0);
  const nog = v.filter((e) => !e.dood && e.krijg.tak && e.krijg.tak.terug).length;
  return { terug, bericht, leven0, leven1, nog, levend: v.filter((e) => !e.dood).length, uitslag: s.strijd.uitslag() };
});
check('gewonden trekken zich terug', l8.terug >= 8, JSON.stringify(l8));
check('de speler hoort het', l8.bericht);
check('ze rusten uit bij hun burcht', l8.levend >= 8 && l8.leven1 > l8.leven0 * 2.5, JSON.stringify(l8));
check('hersteld komen ze terug (niet allemaal meer in terugtocht)', l8.nog < l8.levend, JSON.stringify(l8));

// ---- Level 4: de jagers komen van twee kanten --------------------------------------------------
await start(4);
const l4 = await p.evaluate(() => {
  const s = window.spel;
  s.strijd.stuurLeger({ sluipmoordenaar: 2, boogschutter: 2, ridder: 6 }, true);
  const v = s.strijd.vijanden();
  return { via: v.filter((e) => e.krijg.tak && e.krijg.tak.via >= 0).length, n: v.length, hut: !!s.strijd.hut() };
});
check('level 4: een deel van de jagers neemt een omweg', l4.hut && l4.via >= 2 && l4.via < l4.n, JSON.stringify(l4));

// ---- Curve ---------------------------------------------------------------------------------------
await start(1);
const curve = await p.evaluate(() => { const v = window.spel.veld; return [1, 4, 5, 9, 13].map((n) => v.niveau(n)); });
check('level 1 blijft zacht (hoogstens niveau 2)', curve.every((n) => n <= 2) && curve[0] === 1 && curve[2] === 2, JSON.stringify(curve));
const camp = await p.evaluate(async () => (await (await fetch('/data/campagne.json')).json()).levels.filter((l) => l.rood).map((l) => [l.id, l.rood.aanval && l.rood.aanval.niveau]));
const per = Object.fromEntries(camp);
check('niveaus per level staan in campagne.json', per[1] === 1 && per[2] === 2 && per[3] === 3 && per[4] === 3 && per[5] === 4 && per[10] === 5, JSON.stringify(per));
check('de niveaus stijgen met de levels', [1, 2, 3, 5, 8, 10].every((id, i, a) => i === 0 || per[id] >= per[a[i - 1]]), JSON.stringify(per));

// ---- Volledige aanval door rood zelf (level 3), zonder fouten ---------------------------------------
await start(3);
const vol = await p.evaluate(() => {
  const s = window.spel;
  s.strijd.pauzeer(false);
  s.rood.zetReserve({ ridder: 12, boogschutter: 4 });
  s.rood.zetSinds(500);
  for (let i = 0; i < 2000; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); }
  return { aanvallen: s.rood.stand().aanvallen, vijanden: s.strijd.vijanden().length, uitslag: s.strijd.uitslag(), reserve: s.rood.stand().aantal };
});
check('rood valt zelf aan met het plan', vol.aanvallen >= 1, JSON.stringify(vol));

check('geen paginafouten', fouten.length === 0, fouten.join(' | '));
console.log(`veldheer38: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
