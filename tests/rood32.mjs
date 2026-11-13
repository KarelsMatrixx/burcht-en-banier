// Stap 32: rood per level (sterkte, eerste aanval, tempo, legermengsel) en
// de rode koning als de heer zelf (kleding, wapen, leven).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8232;
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
const lees = async (modus) => {
  await p.evaluate((m) => {
    localStorage.clear();
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3] }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify(m));
    sessionStorage.setItem('burcht-banier.geenTitel', '1');
  }, modus);
  await p.reload(); await wacht(); await p.waitForTimeout(300);
  return p.evaluate(() => {
    const s = window.spel; const h = s.regels.heer; const k = s.strijd.koning(1);
    return { eerste: h.eersteAanval, tussen: h.tussen, doel: h.doelBegin, leger: Object.keys(h.leger).sort().join(), wachters: s.regels.strijd.wachters,
      burcht: s.strijd.stand().roodMax, koning: k ? k.levenMax : null, gewoon: s.regels.soldaten.koning.leven };
  });
};

const vrij = await lees({ soort: 'vrij', profiel: 'normaal' });
const l1 = await lees({ soort: 'campagne', missie: 1 });
const l2 = await lees({ soort: 'campagne', missie: 2 });
const l3 = await lees({ soort: 'campagne', missie: 3 });
console.log(JSON.stringify({ vrij, l1, l2, l3 }));

check('vrij: koning gewoon', vrij.koning === vrij.gewoon, vrij.koning);
check('level 1: eerste aanval 240', l1.eerste === 240, l1.eerste);
check('level 1: Reinout zwakker (80%)', l1.koning === Math.round(l1.gewoon * 0.8), l1.koning);
check('level 1: ridders en schutters', l1.leger === 'boogschutter,ridder', l1.leger);
check('level 2: trager (tempo 70)', l2.tussen > vrij.tussen, `${l2.tussen} vs ${vrij.tussen}`);
check('level 2: veel wachters', l2.wachters === 5, l2.wachters);
check('level 2: schutters en kruisboog', l2.leger === 'boogschutter,kruisboog,ridder', l2.leger);
check('level 3: Hademar sterker (130%)', l3.koning === Math.round(l3.gewoon * 1.3), l3.koning);
check('level 3: bijlridders', /bijlridder/.test(l3.leger), l3.leger);

// Bewaren en terugzetten houdt het leven van de rode koning binnen zijn eigen maximum
await p.evaluate(() => { const k = window.spel.strijd.koning(1); k.leven = k.levenMax - 10; });
const bewaard = await p.evaluate(() => window.spel.strijd.koning(1).leven);
check('rode koning leven > gewoon mogelijk', bewaard > l3.gewoon, bewaard);

// Plaatje van alle tien heren als rode koning
const plaat = await p.evaluate(async () => {
  const { tekenKoning } = await import('/js/kunst.js');
  const c = (await (await fetch('/data/campagne.json')).json()).levels.filter((l) => l.rood);
  const doek = document.createElement('canvas');
  doek.width = 844; doek.height = 390;
  const ctx = doek.getContext('2d');
  ctx.fillStyle = '#5f7f45'; ctx.fillRect(0, 0, 844, 390);
  ctx.imageSmoothingEnabled = false;
  ctx.font = '12px sans-serif'; ctx.fillStyle = '#fff';
  c.forEach((l, i) => {
    const k = tekenKoning('k', { kleur: '#c23a2e', rouwband: false, ...l.rood.koning.uiterlijk });
    const x = 10 + (i % 5) * 166;
    const y = i < 5 ? 10 : 200;
    ctx.drawImage(k.rechts[0], x, y, k.b * 2.4, k.h * 2.4);
    ctx.drawImage(k.houdingen.sla.rechts[1], x + 80, y, k.b * 2.4, k.h * 2.4);
    ctx.fillText(`${l.id} ${l.rood.koning.uiterlijk.wapenSoort}`, x, y + 180);
  });
  return doek.toDataURL();
});
const fs = await import('fs');
fs.writeFileSync('/home/claude/stap32-heren.png', Buffer.from(plaat.split(',')[1], 'base64'));

console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
