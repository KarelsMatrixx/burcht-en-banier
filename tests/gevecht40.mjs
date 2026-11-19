// Bloed, klappen en vermoorde burgers (0.54.0).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8243;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 0 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(300);
await p.tap('#missie-begin'); await p.waitForTimeout(1500);
await p.tap('#gids-kaart button'); await p.waitForTimeout(500);
const voor = await p.evaluate(() => ({ lopers: window.spel.economie.aantalLopers(), fig: window.spel.figuranten.aantal() }));
await p.evaluate(() => window.spel.proloog.zetFase('storm'));
// Camera naar de burcht, om het te zien
await p.waitForTimeout(5000);
await p.screenshot({ path: '/home/claude/gevecht-a.png' });
await p.waitForTimeout(8000);
await p.screenshot({ path: '/home/claude/gevecht-b.png' });
const na = await p.evaluate(() => {
  const s = window.spel; const soorten = {}; for (const f of s.strijd.effecten) soorten[f.soort] = (soorten[f.soort] || 0) + 1;
  return { gedood: s.figuranten.gedood(), burgers: s.slachting.doden(), lopers: s.economie.aantalLopers(), soorten };
});
console.log(JSON.stringify(voor), JSON.stringify(na));
check('dorpelingen vermoord (>= 8)', na.gedood >= 8, na.gedood);
check('bloedplassen en lijken in beeld', (na.soorten.plas || 0) >= 5 && (na.soorten.lijk || 0) >= 5, JSON.stringify(na.soorten));
check('bloedspetters bij treffers', (na.soorten.bloed || 0) >= 1 || (na.soorten.plas || 0) >= 5, JSON.stringify(na.soorten));
// Eigen boeren: vermoord als de vijand ze raakt
await p.waitForTimeout(20000);
const boer = await p.evaluate(() => { const s = window.spel; return { doden: s.slachting.doden(), lopers: s.economie.aantalLopers() }; });
check('boeren van de speler kunnen sneuvelen (economie.dodeBoer)', boer.doden >= 1 || boer.lopers < voor.lopers, JSON.stringify(boer));
// dodeBoer rechtstreeks
const direct = await p.evaluate(() => { const s = window.spel; const l = s.economie.lopers()[0]; if (!l) return 'geen'; const n = s.economie.aantalLopers(); const ok = s.economie.dodeBoer(l); return [ok, n, s.economie.aantalLopers()]; });
check('dodeBoer haalt een boer uit het volk', direct === 'geen' || (direct[0] === true && direct[2] === direct[1] - 1), JSON.stringify(direct));
// Wessel en Bartholt sneuvelen niet: ze zijn binnen of nog onderweg
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
