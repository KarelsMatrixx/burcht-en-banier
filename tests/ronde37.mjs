// Stap 37: zwaardvechter, banierdrager en heler; level 5 Stillwater Abbey.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8239;
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
const pl = await p.evaluate(() => { const a = window.spel.tekenaar; return ['zwaard', 'banier', 'heler'].map((n) => n); });
const beelden = await p.evaluate(async () => {
  const { laadAssets } = await import('/js/assets.js');
  const a = await laadAssets();
  return ['zwaard', 'banier', 'heler'].flatMap((n) => ['blauw', 'rood'].map((t) => { const x = a.haal(`eenheid.${n}_${t}`); return !!(x && x.rechts && x.rechts.length === 4 && x.links.length === 4); }));
});
check('plaatjes van de drie nieuwe soldaten', beelden.every(Boolean), beelden.join());
const defs = await p.evaluate(() => { const s = window.spel.leger.soorten; return ['zwaardvechter', 'banierdrager', 'heler'].map((k) => s[k] && { k, n: s[k].naam, kaz: s[k].kazerne || 'klassiek' }); });
check('drie soldaten in de economie', defs.every(Boolean) && defs[2].kaz === 'mystiek', JSON.stringify(defs));
check('zwaardvechter: schild halveert pijlen', (await p.evaluate(() => window.spel.leger.soorten.zwaardvechter.pijlDekking)) === 0.5);
// Proef in vrij spel: soldaten neerzetten bij de burcht
const st = await p.evaluate(() => window.spel.kaart.start[0]);
await p.evaluate(([x, y]) => window.spel.leger.zetStand([['ridder', x + 4, y + 4, 60, 0], ['banierdrager', x + 5, y + 4, 54, 0], ['ridder', x + 4, y - 6, 60, 0]]), [st.x, st.y]);
await p.waitForTimeout(400);
const aura = await p.evaluate(() => { const s = window.spel; const r = s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'ridder'); const k = s.strijd.koning(0); return r.map((e) => ({ f: s.strijd.sterkteVan(e), kd: Math.hypot(e.x - k.x, e.y - k.y) })); });
check('ridder bij banierdrager slaat 15% harder', Math.abs(aura[0].f - 1.15) < 0.001, JSON.stringify(aura));
check('ridder ver weg: geen extra', aura[1].kd > 4 ? aura[1].f === 1 : true, JSON.stringify(aura));
// Een banierdrager valt niemand aan
const v = await p.evaluate(() => { const s = window.spel; s.strijd.stuurLeger({ ridder: 1 }, false); const vij = s.strijd.vijanden()[0]; const bd = s.leger.soldaten().filter((e) => e.soldaat.sleutel === 'banierdrager'); return s.strijd.valAan(bd, vij); });
check('banierdrager vecht niet', v === 0, v);
// Heler geneest de zwaarst gewonde, niet zichzelf
await p.evaluate(([x, y]) => { const s = window.spel; for (const e of s.strijd.vijanden()) e.dood = true; s.leger.zetStand([['heler', x - 4, y + 4, 10, 0], ['ridder', x - 4, y + 5, 20, 0], ['ridder', x - 3, y + 4, 50, 0]]); }, [st.x, st.y]);
await p.waitForTimeout(300);
const voor = await p.evaluate(() => window.spel.leger.soldaten().filter((e) => e.soldaat.sleutel === 'heler' || e.leven === 20 || e.leven === 50).map((e) => [e.soldaat.sleutel, e.leven]));
await p.waitForTimeout(3200);
const na = await p.evaluate(() => { const s = window.spel.leger.soldaten(); const h = s.find((e) => e.soldaat.sleutel === 'heler'); const r = s.filter((e) => e.soldaat.sleutel === 'ridder').sort((a, b) => a.leven - b.leven); return { heler: h.leven, laag: r[0].leven }; });
check('heler geneest de zwaarst gewonde', na.laag >= 25, JSON.stringify({ voor, na }));
check('heler geneest zichzelf niet', na.heler <= 11, JSON.stringify(na));
// Level 5: kaart, kasteel en het leger van Aleid
await p.evaluate(() => {
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3, 4] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 5 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(400);
check('level 5 speelbaar', (await p.evaluate(() => window.spel.modus.missie)) === 5);
check('kaart met meren', (await p.evaluate(() => window.spel.kaart.naam)) === 'The Two Lakes');
const gr = await p.evaluate(() => { const k = window.spel.kaart; const r = k.start[1]; let w = 0; for (let dy = -10; dy <= 10; dy++) for (let dx = -10; dx <= 10; dx++) { const i = (r.y + dy) * k.breedte + r.x + dx; if (k.grond[i] === 3) w++; } return w; });
check('gracht om de abdij', gr > 40, gr);
check('Aleid heeft zwaardvechters', !!(await p.evaluate(() => window.spel.regels.heer.leger.zwaardvechter)));
check('in level 5 nog geen zwaardvechter voor jou', !(await p.evaluate(() => [...document.querySelectorAll('#leger-opleiden button')].some((b) => /Swordsman/.test(b.textContent)))));
const r = await p.evaluate(() => { const s = window.spel; return s.strijd.stuurLeger({ zwaardvechter: 3, banierdrager: 1 }, false); });
check('rood stuurt zwaardvechters en een banierdrager', r === 4, r);
await p.tap('#missie-begin'); await p.waitForTimeout(800);
await p.screenshot({ path: '/home/claude/ronde37.png' });
// Level 6: de beloning is er
await p.evaluate(() => {
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3, 4, 5] }));
});
const mag6 = await p.evaluate(async () => { const m = await import('/js/modus.js'); const mis = window.spel.missies; const f = m.ontgrendeld(mis.campagne, 6); const g = m.ontgrendeld(mis.campagne, 5); return [f('zwaardvechter'), f('banierdrager'), f('heler'), g('zwaardvechter')]; });
check('na level 5: zwaardvechter, banierdrager, heler', mag6[0] && mag6[1] && mag6[2] && !mag6[3], JSON.stringify(mag6));
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
