// Stap 40: Stillwater (level 5) bouwt rustig op: tien aanvallen, nooit meer dan 16 man,
// en twee keer zoveel tijd tussen de aanvallen als eerst (tempo 130 naar 65).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8283'], { cwd: '/home/claude/burcht-en-banier', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto('http://localhost:8283/'); await wacht();
await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3, 4] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 5 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht();
const r = await p.evaluate(() => { const h = window.spel.regels.heer; return { tussen: h.tussen, eerste: h.eersteAanval, begin: h.doelBegin, per: h.doelPerAanval, max: h.doelMax, piek: h.aanval.piekElke }; });
check('tussen twee aanvallen ongeveer 154 s (dubbel van 77)', r.tussen >= 150 && r.tussen <= 158, JSON.stringify(r));
const doel = (n) => Math.min(r.max, r.begin + r.per * (n - 1));
check('aanval 1 is klein (4 tot 5)', doel(1) >= 4 && doel(1) <= 5, doel(1));
check('aanval 10 bereikt 16', Math.round(doel(10)) === 16, doel(10));
check('elke aanval groeit of blijft gelijk, nooit boven 16', [1,2,3,4,5,6,7,8,9,10,11].every((n) => doel(n) <= 16 && (n === 1 || doel(n) >= doel(n - 1))));
check('geen piekaanvallen meer (anders boven 16)', r.piek === 0, JSON.stringify(r));
check('aanvallen 1 tot 3 samen minder dan 17 gewicht', doel(1) + doel(2) + doel(3) < 17, doel(1) + doel(2) + doel(3));
check('legerMax in level 5 is 60', (await p.evaluate(() => window.spel.regels.legerMax)) === 60);
const lm = await p.evaluate(async () => { const c = await (await fetch('data/campagne.json')).json(); return c.levels.map((l) => [l.id, l.rood.legerMax || 40]); });
check('legerMax per level: 0 tot 4 = 40, 5 tot 7 = 60, 8 tot 10 = 80', lm.every(([id, m]) => m === (id <= 4 ? 40 : id <= 7 ? 60 : 80)), JSON.stringify(lm));
console.log('stillwater40:', ok, 'goed,', fout, 'fout');
await b.close(); srv.kill();
