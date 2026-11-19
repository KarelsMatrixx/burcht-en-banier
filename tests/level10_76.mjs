// Level 10 Mournkeep (versie 0.76.0): Raaftoren, gat in de buitenring, Wessel bevrijden en het slot.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8301'], { cwd: '/home/claude/burcht-en-banier', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
const start = async (missie, klaar) => {
  await p.goto('http://localhost:8301/?x=' + Date.now()); await wacht();
  await p.evaluate(([m, k]) => { localStorage.clear(); localStorage.setItem('tipGesloten', '1'); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [missie, klaar]);
  await p.reload(); await wacht();
  await p.waitForFunction(() => document.getElementById('verhaalbeeld').hidden, null, { timeout: 40000 }).catch(() => {});
  if (await p.isVisible('#missie-begin')) await p.click('#missie-begin');
  await p.waitForTimeout(800);
};
await start(10, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
const a = await p.evaluate(() => { const s = window.spel; const k = s.kaart; const B = k.breedte; const tel = {}; k.object.forEach((o) => { tel[o] = (tel[o] || 0) + 1; });
  const t = s.doel.toren(); const r = k.start[1]; const jij = k.start[0];
  // bereikbaar: een vrij vak naast de toren dat je vanaf huis kunt halen
  let thuis = -1; for (let d = 2; d < 8 && thuis < 0; d++) for (let dy = -d; dy <= d && thuis < 0; dy++) for (let dx = -d; dx <= d; dx++) if (s.wegvinder.isVrij(jij.x + dx, jij.y + dy, 0)) { thuis = (jij.y + dy) * B + jij.x + dx; break; }
  let naast = -1; const tx = Math.floor(t.x), ty = Math.floor(t.y);
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) { const v = (ty + dy) * B + tx + dx; if (s.wegvinder.isVrij(tx + dx, ty + dy, 0) && s.wegvinder.verbonden(thuis, v, 0)) { naast = v; break; } }
  return { modus: s.modus, toren: tel[43] || 0, eigenaar: k.eigenaar[t.vak], kerk: tel[32] || 0, graf: tel[41] || 0, naast, beschermd: s.strijd.koningBeschermd(), landschap: s.landschap && s.landschap.sleutel, reserve: s.strijd.reserve().length }; });
check('level 10 geladen', a.modus.missie === 10, JSON.stringify(a.modus));
check('een Raaftoren, van niemand (onkwetsbaar)', a.toren === 1 && a.eigenaar === 0, JSON.stringify(a));
check('kerk en begraafplaats', a.kerk === 1 && a.graf >= 10, JSON.stringify(a));
check('de deur van de toren is te voet bereikbaar (gat in de buitenring)', a.naast >= 0, JSON.stringify(a));
check('Ottger kan niet sneuvelen', a.beschermd === true);
check('landschap rouw', a.landschap === 'rouw');
check('verborgen reserve van Ottger', a.reserve === 24, a.reserve);
const b1 = await p.evaluate((naast) => { const s = window.spel; s.economie.zetStand({ volk: 30 }); const e = s.leger.geef('ridder', naast, 1); if (!e) return { geen: true };
  e.x = (naast % s.kaart.breedte) + 0.5; e.y = Math.floor(naast / s.kaart.breedte) + 0.5; e.pad = null;
  for (let i = 0; i < 34; i++) s.doel.stap(0.5);
  return { slot: s.doel.slot(), gestaakt: s.strijd.gestaakt(), uitslag: s.strijd.uitslag() }; }, a.naast);
check('15 s bij de deur: het slot begint en het gevecht staakt', b1.slot >= 0 && b1.gestaakt === true, JSON.stringify(b1));
const b2 = await p.evaluate(() => { const s = window.spel; for (let i = 0; i < 40; i++) s.doel.stap(0.5);
  const ottger = s.strijd.vijanden ? null : null; return { uitslag: s.strijd.uitslag(), koning: s.strijd.stand().uitslag }; });
check('na het slot: gewonnen', b2.uitslag === 'gewonnen', JSON.stringify(b2));
await p.waitForTimeout(600);
const eind = await p.evaluate(() => { const el = document.getElementById('einde') || document.querySelector('[id*=einde]'); return el ? el.innerText.slice(0, 300) : ''; });
check('winstscherm met de epiloog', /two banners|Wessel/i.test(eind), eind);
check('geen scriptfouten', fouten.length === 0, fouten.join('|'));
console.log('ok', ok, 'fout', fout);
srv.kill(); await b.close();
