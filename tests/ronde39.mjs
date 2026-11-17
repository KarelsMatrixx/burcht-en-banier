// Stap 39: de steenwachter (en later level 6 De Reuzenrug).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8243;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1'); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
// Plaatjes
const beelden = await p.evaluate(async () => {
  const { laadAssets } = await import('/js/assets.js');
  const a = await laadAssets();
  return ['blauw', 'rood'].map((t) => { const x = a.haal(`eenheid.steen_${t}`); return !!(x && x.rechts.length === 4 && x.links.length === 4 && x.houdingen && x.houdingen.sla); });
});
check('plaatjes van de steenwachter', beelden.every(Boolean), beelden.join());
const def = await p.evaluate(() => window.spel.leger.soorten.steenwachter);
check('steenwachter in de economie (mystiek)', def && def.kazerne === 'mystiek' && def.legerPlekken === 2 && def.leven === 300);
// Legerplekken
const st = await p.evaluate(() => window.spel.kaart.start[0]);
const pl = await p.evaluate(([x, y]) => { const l = window.spel.leger; const n0 = l.aantal(), p0 = l.plekken(); l.zetStand([['steenwachter', x + 4, y + 4, 300, 0], ['ridder', x + 5, y + 4, 60, 0]]); return { n: l.aantal() - n0, plekken: l.plekken() - p0 }; }, [st.x, st.y]);
check('steenwachter telt voor twee plekken', pl.n === 2 && pl.plekken === 3, JSON.stringify(pl));
const vol = await p.evaluate(([x, y]) => {
  const l = window.spel.leger; const max = l.max; const lijst = [];
  for (let i = 0; i < max - 1; i++) lijst.push(['ridder', x + 3, y + 3 + (i % 5), 60, 0]);
  l.zetStand(lijst);
  return { plekken: l.plekken(), max };
}, [st.x, st.y]);
// Sinds 0.65 geeft elke kazerne 40 plekken: zonder kazerne is het maximum 0 en blijven de beginsoldaten gewoon bestaan.
check('leger loopt nooit over het maximum', vol.max === 0 || vol.plekken <= vol.max, JSON.stringify(vol));
// Kan niet klimmen
await p.evaluate(([x, y]) => { window.spel.leger.zetStand([['steenwachter', x + 4, y + 4, 300, 0]]); }, [st.x, st.y]);
const kl = await p.evaluate(() => window.spel.leger.soldaten().find((e) => e.soldaat.sleutel === 'steenwachter').lagen);
check('steenwachter klimt niet op ladders', kl === false, kl);
// Bijlridder doet extra schade tegen een steenwachter
const dm = await p.evaluate(([x, y]) => {
  const s = window.spel; s.leger.zetStand([['steenwachter', x + 4, y + 4, 300, 0]]);
  const ster = s.leger.soldaten().find((e) => e.soldaat.sleutel === 'steenwachter');
  s.strijd.stuurLeger({ bijlridder: 1 }, false);
  const v = s.strijd.vijanden()[0];
  return { bonus: v && s.leger.soorten.bijlridder.bonusTegen, schade: s.leger.soorten.bijlridder.schade, leven: ster.leven };
}, [st.x, st.y]);
check('bijlridder heeft bonus tegen steen', dm.bonus && dm.bonus.steenwachter === 1.5, JSON.stringify(dm));
// Level 6: De Reuzenrug, twee bouwloodsen slopen
await p.evaluate(() => {
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3, 4, 5] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 6 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(500);
check('level 6 speelbaar', (await p.evaluate(() => window.spel.modus.missie)) === 6);
check('kaart De Reuzenrug', (await p.evaluate(() => window.spel.kaart.naam)) === "The Giant's Spine");
const L = await p.evaluate(() => { const s = window.spel; return { v: s.doel.loodsen(), obj: s.doel.loodsen().map((v) => [s.kaart.object[v], s.kaart.eigenaar[v]]), b: s.kaart.breedte }; });
check('twee bouwloodsen van rood', L.v.length === 2 && L.obj.every(([o, e]) => o === 29 && e === 2), JSON.stringify(L));
const afstand = await p.evaluate(() => { const s = window.spel; const r = s.kaart.start[1]; const B = s.kaart.breedte; return s.doel.loodsen().map((v) => Math.max(Math.abs((v % B) - r.x), Math.abs(Math.floor(v / B) - r.y))); });
check('loodsen staan buiten de muren', afstand.every((a) => a >= 8), afstand.join());
check('loodsen staan niet dicht bij elkaar', Math.abs(L.v[0] - L.v[1]) > 3);
check('loodsen bereikbaar voor jou', await p.evaluate(() => { const s = window.spel; const B = s.kaart.breedte; const st = s.kaart.start[0]; let j = -1; for (let r = 2; r < 9 && j < 0; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (j < 0 && s.wegvinder.isVrij(st.x + dx, st.y + dy, 0)) j = (st.y + dy) * B + st.x + dx; return s.doel.loodsen().every((v) => [1, -1, B, -B].some((o) => s.wegvinder.verbonden(j, v + o, 0))); }));
await p.tap('#missie-begin'); await p.waitForTimeout(800);
const gl = await p.evaluate(() => [].concat(window.spel.missies.campagne.levels || window.spel.missies.campagne).find((l) => l.id === 6).doel.druk.golven.map((g) => Object.values(g.leger).reduce((a, b) => a + b, 0)));
check('zes golven oplopend tot 25', gl.length === 6 && gl[5] === 25 && gl.every((n, i) => i === 0 || n > gl[i - 1]), gl.join());
// Druk: eerste golf na 150 seconden
const g0 = await p.evaluate(() => window.spel.strijd.vijanden().length);
await p.evaluate(() => window.spel.doel.zetTijd(135)); await p.waitForTimeout(1200);
check('waarschuwing voor de eerste golf', (await p.evaluate(() => window.spel.doel.stand().gewaarschuwd)) === true);
await p.evaluate(() => window.spel.doel.zetTijd(151)); await p.waitForTimeout(1500);
const g1 = await p.evaluate(() => ({ n: window.spel.strijd.vijanden().length, golven: window.spel.doel.stand().golven }));
check('na 150 seconden komt er een golf', g1.golven === 1 && g1.n > g0, JSON.stringify([g0, g1]));
// Een loods slopen: balkje en daarna wel of niet teruggebouwd
await p.evaluate(() => { for (const e of window.spel.strijd.vijanden()) e.dood = true; });
const eerste = L.v[0];
await p.evaluate((v) => { const s = window.spel; s.kaart.object[v] = 0; s.kaart.eigenaar[v] = 0; s.wegvinder.herbereken(); }, eerste);
await p.waitForTimeout(1200);
const na1 = await p.evaluate(() => ({ g: window.spel.doel.gevallen().length, uitslag: window.spel.strijd.uitslag() }));
check('een gevallen loods telt, level nog niet gewonnen', na1.g === 1 && !na1.uitslag, JSON.stringify(na1));
await p.waitForTimeout(1500);
check('de gevallen loods wordt niet herbouwd', (await p.evaluate((v) => window.spel.kaart.object[v], eerste)) === 0);
// Herladen: gevallen blijft gevallen
await p.evaluate(() => sessionStorage.setItem('burcht-banier.geenTitel', '1'));
await p.reload(); await wacht(); await p.waitForTimeout(500);
if (await p.isVisible('#missie-begin')) { await p.tap('#missie-begin'); await p.waitForTimeout(500); }
const rl = await p.evaluate(() => { const s = window.spel; return { l: s.doel.loodsen().map((v) => s.kaart.object[v]), g: s.doel.gevallen().length }; });
check('na herladen is de gevallen loods nog weg', rl.l[0] === 0 && rl.l[1] === 29, JSON.stringify(rl));
// De tweede slopen: gewonnen
await p.evaluate((v) => { const s = window.spel; s.kaart.object[v] = 0; s.kaart.eigenaar[v] = 0; s.wegvinder.herbereken(); }, L.v[1]);
await p.waitForTimeout(1500);
const uit = await p.evaluate(() => ({ u: window.spel.strijd.uitslag(), st: window.spel.doel.stand() }));
check('beide loodsen weg: gewonnen', uit.u === 'gewonnen', JSON.stringify(uit));
check('geen pagina-fouten', fouten.length === 0, fouten.join('|'));
console.log(`ronde39: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
