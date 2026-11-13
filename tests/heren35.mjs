// Stap 35: de tien heren als rode koning (js/heren.js).
// Controleert per heer: de beelden (4 lopen, 2 slaan, rechts en links), het anker, dat niets
// wordt afgesneden, dat het links het spiegelbeeld van rechts is, dat er rood in zit (team),
// en dat de silhouetten onderling echt verschillen. Daarna een echt level zonder paginafouten.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8240;
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
const url = `http://localhost:${poort}/`;

await p.goto(url); await wacht();
const res = await p.evaluate(async () => {
  const { laadAssets } = await import('/js/assets.js');
  const camp = await (await fetch('/data/campagne.json')).json();
  const uit = { heren: [], blauw: null };
  const alpha = (c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height); return d; };
  const masker = (c) => { const d = alpha(c); const m = new Uint8Array(c.width * c.height); for (let i = 0; i < m.length; i++) m[i] = d.data[i * 4 + 3] > 60 ? 1 : 0; return m; };
  const randLeeg = (c) => {
    const d = alpha(c); const w = c.width, h = c.height; let raak = 0;
    for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (d.data[(y * w + x) * 4 + 3] > 20) raak++;
    for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (d.data[(y * w + x) * 4 + 3] > 20) raak++;
    return raak === 0;
  };
  const rood = (c) => { const d = alpha(c); let n = 0; for (let i = 0; i < d.data.length; i += 4) if (d.data[i + 3] > 200 && d.data[i] > 150 && d.data[i + 1] < 95 && d.data[i + 2] < 95) n++; return n; };
  const spiegel = (r, l) => { const a = masker(r), bm = masker(l); const w = r.width, h = r.height; let diff = 0, som = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = a[y * w + x], u = bm[y * w + (w - 1 - x)]; if (v || u) som++; if (v !== u) diff++; } return diff / Math.max(1, som); };
  const maskers = [];
  for (const l of camp.levels) {
    const kg = l.rood && l.rood.koning;
    if (!kg || l.proloog) continue;   // de proloog leent Reinout als gast
    const a = await laadAssets({ 'eenheid.koning_rood': kg.uiterlijk });
    const k = a.haal('eenheid.koning_rood');
    const alle = [...k.rechts, ...k.links, ...k.houdingen.sla.rechts, ...k.houdingen.sla.links];
    const m0 = masker(k.rechts[0]);
    maskers.push([l.portret, m0, k.rechts[0].width, k.rechts[0].height]);
    uit.heren.push({
      id: l.id, figuur: kg.uiterlijk.figuur, n: [k.rechts.length, k.links.length, k.houdingen.sla.rechts.length, k.houdingen.sla.links.length],
      b: k.b, h: k.h, ax: k.ax, ay: k.ay, px: [k.rechts[0].width, k.rechts[0].height],
      leeg: alle.map((c) => masker(c).reduce((x, y) => x + y, 0)).filter((n) => n < 200).length,
      afgesneden: alle.filter((c) => !randLeeg(c)).length,
      rood: Math.min(...[k.rechts[0], k.houdingen.sla.rechts[0], k.houdingen.sla.rechts[1]].map(rood)),
      spiegel: Math.max(spiegel(k.rechts[0], k.links[0]), spiegel(k.houdingen.sla.rechts[1], k.houdingen.sla.links[1])),
      loop: new Set(k.rechts.map((c) => c.toDataURL())).size,
    });
  }
  // silhouetten onderling: aandeel pixels dat verschilt
  let minVerschil = 1, paar = '';
  for (let i = 0; i < maskers.length; i++) for (let j = i + 1; j < maskers.length; j++) {
    const A = maskers[i][1], B = maskers[j][1]; let diff = 0, som = 0;
    for (let q = 0; q < A.length; q++) { if (A[q] || B[q]) som++; if (A[q] !== B[q]) diff++; }
    const v = diff / som; if (v < minVerschil) { minVerschil = v; paar = maskers[i][0] + '/' + maskers[j][0]; }
  }
  uit.minVerschil = minVerschil; uit.paar = paar;
  // jouw blauwe koning is ongewijzigd (zonder figuur)
  const a0 = await laadAssets({});
  const bl = a0.haal('eenheid.koning_blauw');
  uit.blauw = { n: bl.rechts.length, b: bl.b, h: bl.h, ay: bl.ay, sla: bl.houdingen.sla.rechts.length };
  const rd = a0.haal('eenheid.koning_rood');
  uit.vrijRood = { n: rd.rechts.length, b: rd.b, h: rd.h };
  return uit;
});
console.log(res.heren.map((h) => `${h.id}:${h.figuur} rood=${h.rood} loop=${h.loop}`).join(' | '), 'minVerschil', res.minVerschil.toFixed(2), res.paar);

check('tien heren', res.heren.length === 10, res.heren.length);
for (const h of res.heren) {
  const t = `level ${h.id} ${h.figuur}`;
  check(t + ': 4 lopen en 2 slaan, rechts en links', h.n.join() === '4,4,2,2', h.n.join());
  check(t + ': anker midden onder', h.ax === h.b / 2 && h.ay > 40 && h.ay < h.h, `${h.ax} ${h.ay} ${h.b} ${h.h}`);
  check(t + ': doek op dubbele scherpte', h.px[0] === h.b * 2 && h.px[1] === h.h * 2, h.px.join());
  check(t + ': geen leeg beeld', h.leeg === 0, h.leeg);
  check(t + ': niets afgesneden aan de rand', h.afgesneden === 0, h.afgesneden);
  check(t + ': rood te zien in elke houding (team)', h.rood >= 12, h.rood);
  check(t + ': links is spiegelbeeld van rechts', h.spiegel < 0.02, h.spiegel);
  check(t + ': de loopbeelden verschillen', h.loop >= 3, h.loop);
}
check('silhouetten verschillen onderling minstens 15%', res.minVerschil >= 0.15, `${res.minVerschil} ${res.paar}`);
check('blauwe koning in de nieuwe stijl (stap 36): zelfde maat als de heren, 4 loop en 2 slag', res.blauw.n === 4 && res.blauw.b === 76 && res.blauw.h === 64 && res.blauw.ay === 56 && res.blauw.sla === 2, JSON.stringify(res.blauw));
check('vrij spel: rode koning in dezelfde nieuwe stijl', res.vrijRood.b === 76 && res.vrijRood.n === 4, JSON.stringify(res.vrijRood));

// Echte levels: laden zonder fouten, rode koning staat er
const missies = await (await fetch(url + 'data/campagne.json')).json();
const speelbaar = missies.levels.filter((l) => l.speelbaar && l.id >= 1).map((l) => l.id);
console.log('speelbare levels:', speelbaar.join());
for (const id of speelbaar) {
  await p.evaluate((m) => {
    localStorage.clear();
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3, 4, 5, 6, 7, 8, 9] }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m }));
    sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('burcht-banier.paneel', 'bouw');
  }, id);
  await p.reload(); await wacht(); await p.waitForTimeout(800);
  const r = await p.evaluate(() => { const s = window.spel; const k = s.strijd.koning(1); return { k: !!k, leven: k && k.leven }; });
  check(`level ${id}: rode koning staat er`, r.k && r.leven > 0, JSON.stringify(r));
  if (id === speelbaar[speelbaar.length - 1] || id === 1) {
    await p.evaluate(async () => {
      const s = window.spel; const iso = await import('/js/iso.js'); const k = s.strijd.koning(1);
      document.getElementById('tip').hidden = true;
      const w = iso.rasterNaarWereld(k.x + 0.5, k.y + 0.5); s.camera.x = w.x; s.camera.y = w.y; s.camera.zetZoom(2);
    });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `/home/claude/proef/ingame_level${id}.png` });
  }
}
check('geen paginafouten', fouten.length === 0, fouten.join(' | '));
console.log(`heren35: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
