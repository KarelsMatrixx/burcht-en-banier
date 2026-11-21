// Greyford (0.83.0): kloof, drie muren van 2, 4 en 6 lagen met dubbele poorten, rotseiland met twee torens,
// Moordgatentoren (olie binnen 2 tegels) en ontgrendeling na level 7.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8193'], { cwd: '/home/claude/burcht-en-banier', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, serviceWorkers: 'block' })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
const zet = async (klaar, missie) => {
  await p.goto('http://localhost:8193/?x=' + Date.now()); await wacht();
  await p.evaluate(([k, m]) => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [klaar, missie]);
  await p.reload(); await wacht();
  await p.evaluate(() => { document.getElementById('verhaalbeeld').hidden = true; document.getElementById('missie').hidden = true; });
};
await zet([0, 1, 2, 3, 4, 5, 6], 7);
const k = await p.evaluate(() => { const s = window.spel.kaart; const B = s.breedte; const rij = (y) => { let m = 0, po = 0, mg = 0; for (let x = 0; x < B; x++) { const o = s.object[y * B + x]; if (o === 4) m++; if (o === 6) po++; if (o === 50) mg++; } return { m, po, mg }; }; return { b: B, h: s.hoogte, tol: s.tolMuren, r64: rij(64), r65: rij(65), r40: rij(40), r17: rij(17), r22: rij(22), eiland: s.eilandTorens, o: s.object[65 * B + 24], verbonden: s.verbonden }; });
check('kaart 53 x 96', k.b === 53 && k.h === 96, JSON.stringify([k.b, k.h]));
check('drie muren van 2, 4 en 6 lagen', k.tol.map((w) => w.lagen).join() === '4,2,6'.split(',').reverse().join() || k.tol.map((w) => w.lagen).join() === '2,4,6', JSON.stringify(k.tol));
check('muur 1: twee poorten achter elkaar (rij 64 en 65)', k.r64.po === 1 && k.r65.po === 1, JSON.stringify([k.r64, k.r65]));
check('muur 3: poort in de eerste en laatste laag, gang ertussen', k.r17.po === 1 && k.r22.po === 1, JSON.stringify([k.r17, k.r22]));
check('muur 2: tussenlaag heeft een gang (geen poort)', k.r40.po === 0 && k.r40.m > 10, JSON.stringify(k.r40));
check('twee eilandtorens', k.eiland.length === 2, k.eiland.join());
check('moordgatentoren naast de poort', k.o === 50, k.o);
// de olie: een soldaat naast de toren verliest leven, een stuk verderop niet
await p.evaluate(() => { document.getElementById('missie-begin') && document.getElementById('missie-begin').click(); const l = window.spel.leger.lijst[0]; l.x = 24.5; l.y = 66.3; l.leven = l.levenMax = 500; });
await p.evaluate(() => { for (let i = 0; i < 60; i++) window.spel.strijd.stap(); });
const l1 = await p.evaluate(() => window.spel.leger.lijst[0].leven);
check('olie raakt een soldaat bij de toren', l1 < 500, l1);
await p.evaluate(() => { const l = window.spel.leger.lijst[0]; l.x = 26.5; l.y = 80.5; l.leven = l.levenMax = 500; for (let i = 0; i < 60; i++) window.spel.strijd.stap(); });
const l2 = await p.evaluate(() => window.spel.leger.lijst[0].leven);
check('verder weg geen olie', l2 === 500, l2);
// ontgrendeling: in level 7 nog niet, in level 8 wel
const bouw7 = await p.$$eval('#bouw-knoppen button', (x) => x.map((e) => e.textContent));
check('level 7: speler heeft de Moordgatentoren nog niet', !bouw7.some((t) => /Murder-Hole/.test(t)), bouw7.join('|'));
await zet([0, 1, 2, 3, 4, 5, 6, 7], 8);
await p.evaluate(() => { sessionStorage.setItem('burcht-banier.paneel', 'bouw'); });
await p.reload(); await wacht(); await p.evaluate(() => { document.getElementById('verhaalbeeld').hidden = true; document.getElementById('missie').hidden = true; });
const reg = await p.evaluate(() => Object.keys(window.spel.bouwwerken || {}).join());
check('bouwwerk moordgatentoren bestaat', /moordgatentoren/.test(reg), reg);
const kn = await p.$$eval('#bouw-knoppen button', (x) => x.map((e) => e.textContent));
check('level 8: Murder-Hole Tower in het bouwmenu', kn.some((t) => /Murder-Hole/.test(t)), kn.join('|'));
check('geen fouten in de console', fouten.length === 0, fouten.join('|'));
console.log(`tol83: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
