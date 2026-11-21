// Versie 0.48.1: level 5 (Stillwater): ladders komen mee met de rest, meer wachters en een grotere eerste aanval.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8273'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto('http://localhost:8273/'); await wacht();
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3, 4] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 5 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
await p.evaluate(() => window.spel.strijd.pauzeer(true));
const r = await p.evaluate(() => {
  const s = window.spel; const out = {};
  out.heer = { eerste: s.regels.heer.eersteAanval, begin: s.regels.heer.doelBegin, max: s.regels.heer.doelMax };
  out.wachters = s.strijd.stand().wachters;
  const k = s.kaart; const m = s.strijd.burcht(); const ring = 5;
  for (let d = -ring; d <= ring; d++) for (const [x, y] of [[m.x + d, m.y - ring], [m.x + d, m.y + ring], [m.x - ring, m.y + d], [m.x + ring, m.y + d]]) {
    if (x < 0 || y < 0 || x >= k.breedte || y >= k.hoogte || k.object[y * k.breedte + x] !== 0) continue;
    s.bouwer.zetVast(y * k.breedte + x, x === m.x + ring && y === m.y ? 6 : 4);
  }
  s.wegvinder.herbereken(); s.strijd.kaartVeranderd();
  s.strijd.stuurLeger({ zwaardvechter: 4, ridder: 3, boogschutter: 3, ram: 2, ladder: 2 }, true);
  const eerste = new Map();
  // Sinds 0.81.0 valt een schijnaanval bewust eerder aan: alleen de hoofdmacht telt.
  const hoofdId = (s.veld.groepen().find((g) => g.hoofd) || {}).id;
  for (let i = 0; i < 2400; i++) {
    s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap();
    for (const e of s.strijd.vijanden()) if (e.wachter === undefined && e.krijg && e.krijg.tak && e.krijg.tak.groep === hoofdId && !eerste.has(e) && Math.hypot(e.x - m.x, e.y - m.y) < 8.5) eerste.set(e, i / 10);
  }
  const tijd = (soort) => [...eerste.entries()].filter(([e]) => e.vijand === soort).map(([, t]) => t);
  out.ladder = tijd('ladder'); out.ridder = tijd('ridder'); out.ram = tijd('ram'); out.zwaard = tijd('zwaardvechter').sort((a, c) => a - c);
  return out;
});
check('eerste aanval na 150 s', r.heer.eerste === 150, JSON.stringify(r.heer));
check('doelBegin 4, doelMax 16 (rustige opbouw, wijziging 0.49.4)', r.heer.begin === 4 && r.heer.max === 16, JSON.stringify(r.heer));
check('minstens 10 wachters', r.wachters >= 10, r.wachters);
check('twee ladders gearriveerd', r.ladder.length === 2, JSON.stringify(r.ladder));
const hoofd = [...r.ladder, ...r.ridder, ...r.ram];
check('ladders, ridders en rammen binnen 12 s van elkaar', Math.max(...hoofd) - Math.min(...hoofd) <= 12, JSON.stringify(hoofd));
const sim = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(false);
  for (let i = 0; i < 1600; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); if ((s.strijd.stand().golf || 0) > 0) break; }
  const st = s.strijd.stand();
  return { golf: st.golf, aanvallers: s.strijd.vijanden().filter((e) => e.wachter === undefined && !e.koning).length };
});
check('eerste aanval van rood komt voor 160 s met met minstens 3 man (rustig begin)', sim.golf === 1 && sim.aanvallers >= 3, JSON.stringify(sim));
check('geen paginafouten', fouten.length === 0, fouten.join('|'));
console.log('level5_39:', ok, 'goed,', fout, 'fout');
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
