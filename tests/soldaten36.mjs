// Stap 36: soldaten en werkers in de nieuwe stijl (js/soldaten.js).
// Per eenheid, blauw en rood: beelden en houdingen volgens het contract, anker, niets afgesneden,
// links = spiegel van rechts, teamkleur zichtbaar, loopbeelden verschillen, en de soorten
// verschillen onderling in silhouet. Dan een echt level zonder paginafouten.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8242;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) fouten.push(m.text()); });
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();

const res = await p.evaluate(async () => {
  const { laadAssets } = await import('/js/assets.js');
  const A = (await (await fetch('/data/assets.json')).json()).assets;
  const nieuwe = ['ridder', 'bijlridder', 'boogschutter', 'kruisboogschutter', 'sluipmoordenaar', 'vlammenwever', 'ladderdrager', 'werker'];
  const sleutels = Object.keys(A).filter((k) => k.startsWith('eenheid.') && nieuwe.includes(A[k].vorm));
  const a = await laadAssets({});
  const data = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height);
  const masker = (c) => { const d = data(c); const m = new Uint8Array(c.width * c.height); for (let i = 0; i < m.length; i++) m[i] = d.data[i * 4 + 3] > 60 ? 1 : 0; return m; };
  const rand = (c) => { const d = data(c); const w = c.width, h = c.height; let n = 0; for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (d.data[(y * w + x) * 4 + 3] > 20) n++; for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (d.data[(y * w + x) * 4 + 3] > 20) n++; return n; };
  const team = (c, blauw) => { const d = data(c); let n = 0; for (let i = 0; i < d.data.length; i += 4) { if (d.data[i + 3] < 200) continue; const [r, g, bl] = [d.data[i], d.data[i + 1], d.data[i + 2]]; if (blauw ? (bl > 150 && r < 90 && g < 130) : (r > 150 && g < 95 && bl < 95)) n++; } return n; };
  const spiegel = (r, l) => { const x = masker(r), y = masker(l), w = r.width, h = r.height; let df = 0, som = 0; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const v = x[j * w + i], u = y[j * w + (w - 1 - i)]; if (v || u) som++; if (v !== u) df++; } return df / Math.max(1, som); };
  const verschil = (c1, c2) => { const x = masker(c1), y = masker(c2); let df = 0, som = 0; for (let i = 0; i < x.length; i++) { if (x[i] || y[i]) som++; if (x[i] !== y[i]) df++; } return df / Math.max(1, som); };
  const uit = [];
  for (const k of sleutels) {
    const s = a.haal(k), vorm = A[k].vorm, blauw = k.endsWith('_blauw');
    const hd = s.houdingen || {};
    const verwacht = vorm === 'werker' ? { last: 4, hak: 4 } : (['boogschutter', 'kruisboogschutter', 'vlammenwever'].includes(vorm) ? { schiet: 2 } : { sla: 2 });
    const sets = [s, ...Object.values(hd)];
    const alle = sets.flatMap((t) => [...t.rechts, ...t.links]);
    uit.push({
      k, vorm, n: [s.rechts.length, s.links.length], houdingen: Object.fromEntries(Object.entries(hd).map(([n, t]) => [n, [t.rechts.length, t.links.length]])), verwacht,
      anker: sets.every((t) => t.ax === t.b / 2 && t.ay > 0 && t.ay < t.h), px: [s.rechts[0].width, s.rechts[0].height, s.b, s.h],
      leeg: alle.filter((c) => masker(c).reduce((x, y) => x + y, 0) < 150).length,
      afgesneden: alle.filter((c) => rand(c) > 0).length,
      team: Math.min(...[s.rechts[0], ...Object.values(hd).map((t) => t.rechts[0])].map((c) => team(c, blauw))),
      spiegel: Math.max(...sets.map((t) => spiegel(t.rechts[0], t.links[0]))),
      loop: verschil(s.rechts[0], s.rechts[1]),
      m0: Array.from(masker(s.rechts[0])), w: s.rechts[0].width,
    });
  }
  return uit;
});
const MIN = 40;
for (const e of res) {
  check(`${e.k} loopbeelden`, e.n[0] === 4 && e.n[1] === 4, e.n);
  for (const [naam, aantal] of Object.entries(e.verwacht)) check(`${e.k} houding ${naam}`, e.houdingen[naam] && e.houdingen[naam][0] === aantal && e.houdingen[naam][1] === aantal, JSON.stringify(e.houdingen));
  check(`${e.k} anker`, e.anker);
  check(`${e.k} geen leeg beeld`, e.leeg === 0, e.leeg);
  check(`${e.k} niets afgesneden`, e.afgesneden === 0, e.afgesneden);
  check(`${e.k} teamkleur (${e.team})`, e.team >= MIN, e.team);
  check(`${e.k} spiegel`, e.spiegel < 0.02, e.spiegel);
  check(`${e.k} loopt (frames verschillen)`, e.loop > 0.01, e.loop);
}
// silhouetten van de soorten (blauw) verschillen onderling
const soorten = res.filter((e) => e.k.endsWith('_blauw'));
let min = 1, paar = '';
for (let i = 0; i < soorten.length; i++) for (let j = i + 1; j < soorten.length; j++) {
  if (soorten[i].vorm === 'werker' && soorten[j].vorm === 'werker') continue;
  const x = soorten[i].m0, y = soorten[j].m0; let df = 0, som = 0;
  for (let n = 0; n < x.length; n++) { if (x[n] || y[n]) som++; if (x[n] !== y[n]) df++; }
  const d = df / Math.max(1, som); if (d < min) { min = d; paar = soorten[i].k + ' / ' + soorten[j].k; }
}
check(`silhouetten soorten verschillen (min ${min.toFixed(2)} ${paar})`, min >= 0.1, min);
// werkers onderling (kleding en gereedschap)
const werkers = soorten.filter((e) => e.vorm === 'werker');
let minW = 1, paarW = '';
for (let i = 0; i < werkers.length; i++) for (let j = i + 1; j < werkers.length; j++) {
  const x = werkers[i].m0, y = werkers[j].m0; let df = 0, som = 0;
  for (let n = 0; n < x.length; n++) { if (x[n] || y[n]) som++; if (x[n] !== y[n]) df++; }
  const d = df / Math.max(1, som); if (d < minW) { minW = d; paarW = werkers[i].k + ' / ' + werkers[j].k; }
}
console.log(`werkers onderling minimaal ${minW.toFixed(2)} (${paarW})`);
check('werkers verschillen onderling', minW >= 0.03, minW);

// echt spel: legers samenstellen en een poos laten lopen
for (const id of [1, 3]) {
  await p.evaluate((m) => {
    localStorage.clear();
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2] }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m }));
    sessionStorage.setItem('burcht-banier.geenTitel', '1');
  }, id);
  await p.reload(); await wacht(); await p.waitForTimeout(600);
  const kn = await p.$('text=Begin'); if (kn) await kn.click();
  await p.waitForTimeout(3000);
  check(`level ${id} draait zonder fouten`, fouten.length === 0, fouten.join('|'));
}
console.log(`${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
