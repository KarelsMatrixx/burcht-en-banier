import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8162'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('burcht-banier.paneel', 'bouw'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
await p.goto('http://localhost:8162/?x=1'); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'vrij', profiel: 'vrede' })); }); await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd);
const BUDGET = 132;
const res = await p.evaluate(async (BUDGET) => {
  const s = window.spel; const k = s.kaart;
  const prijs = (sl) => { const c = s.leger.soorten[sl].kosten; return (c.goud || 0) + (c.planken || 0) + 2 * (c.koper || 0); };
  // open veld in het midden: bomen en stenen weg
  const veld = [22, 26];
  const vakken = new Set();
  for (let y = veld[1] - 1; y < veld[1] + 10; y++) for (let x = veld[0] - 1; x < veld[0] + 16; x++) { const i = y * k.breedte + x; k.object[i] = 0; k.eigenaar[i] = 0; if (k.grond[i] === 3) k.grond[i] = 0; vakken.add(i); }
  s.wegvinder.herbereken();
  const stap = (sec) => { for (let i = 0; i < sec * 10; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); } };
  const uit = [];
  const gevecht = (blauw, rood) => {
    for (const v of s.strijd.vijanden()) if (!v.koning) v.dood = true;
    for (const e of s.leger.soldaten()) if (!s.leger.soorten[e.soldaat.sleutel].koning) e.dood = true;
    stap(0.5);
    const nb = Math.floor(BUDGET / prijs(blauw)), nr = Math.floor(BUDGET / prijs(rood));
    const lijst = []; for (let i = 0; i < nb; i++) lijst.push([blauw, veld[0] + (i % 3), veld[1] + Math.floor(i / 3) % 8, 9999, 0]);
    s.leger.zetStand(lijst);
    const mijn = s.leger.soldaten().filter((e) => e.soldaat.sleutel === blauw && !e.dood);
    const tegen = []; for (let i = 0; i < nr; i++) { const v = s.strijd.zetVijand(rood, veld[0] + 5 + (i % 3), veld[1] + Math.floor(i / 3) % 8, undefined); if (v) tegen.push(v); }
    // blauw valt ook aan: iedereen op de dichtstbijzijnde vijand
    s.leger.kies(mijn); s.strijd.valAan(mijn, tegen[0]);
    let t = 0;
    for (; t < 150; t++) { stap(1); if (mijn.every((e) => e.dood) || tegen.every((v) => v.dood)) break; }
    const over = (l) => Math.round(100 * l.filter((e) => !e.dood).reduce((a, e) => a + e.leven, 0) / l.reduce((a, e) => a + e.levenMax, 0));
    return { b: over(mijn), r: over(tegen), t, nb, nr };
  };
  for (const x of ['ridder', 'boogschutter', 'bijlridder', 'kruisboog', 'sluipmoordenaar', 'vlammenwever']) {
    for (const y of ['ridder', 'boogschutter']) {
      const g1 = gevecht(x, y), g2 = gevecht(y, x);
      // marge voor x: (x over - y over), gemiddeld over beide kanten
      uit.push({ x, y, marge: Math.round(((g1.b - g1.r) + (g2.r - g2.b)) / 2), g1, g2 });
    }
  }
  return { veld, uit };
}, BUDGET);
console.log('veld', res.veld);
for (const r of res.uit) console.log(`${r.x.padEnd(16)} tegen ${r.y.padEnd(12)} marge ${String(r.marge).padStart(4)}   (${JSON.stringify(r.g1)} ${JSON.stringify(r.g2)})`);
console.log('fouten', fouten);
await b.close(); srv.kill();
