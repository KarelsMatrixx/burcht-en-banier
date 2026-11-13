// Stap 34: kaartvormen. Elke vorm geeft een weg tussen de kastelen, laat de
// kastelen vrij, en heeft echt rotsen of water waar het hoort. Plus
// schermafbeeldingen van level 2 (pas) en level 3 (moeras).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8238;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();

const uit = await p.evaluate(async () => {
  const { maakKaart, OBJECT, GROND } = await import('/js/kaart.js');
  const kaarten = (await (await fetch('/data/kaarten.json')).json()).kaarten;
  const r = {};
  for (const [naam, recept] of Object.entries(kaarten)) {
    if (!recept.vorm) continue;
    const k = maakKaart(recept);
    let rots = 0, water = 0;
    const N = k.breedte * k.hoogte;
    for (let i = 0; i < N; i++) { if (k.object[i] === OBJECT.STEEN) rots++; if (k.grond[i] === GROND.WATER) water++; }
    // vrij rond de kastelen: geen rots of water binnen 6 tegels van het midden (buiten de burcht)
    let bezet = 0;
    for (const s of k.start) for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const i = (s.y + dy) * k.breedte + s.x + dx;
      if (k.object[i] === OBJECT.STEEN || k.grond[i] === GROND.WATER) bezet++;
    }
    // gespiegeld
    let scheef = 0;
    for (let i = 0; i < N; i++) if (k.object[i] !== k.object[N - 1 - i] && !(k.object[i] >= 4 && k.object[i] <= 10) && !(k.object[N - 1 - i] >= 4 && k.object[N - 1 - i] <= 10)) scheef++;
    r[naam] = { soort: recept.vorm.soort, weg: k.verbonden, rots: Math.round((100 * rots) / N), water: Math.round((100 * water) / N), bezet, scheef };
  }
  return r;
});
console.log(JSON.stringify(uit));
for (const [naam, u] of Object.entries(uit)) {
  check(`${naam}: weg tussen de kastelen`, u.weg, JSON.stringify(u));
  check(`${naam}: kastelen vrij`, u.bezet === 0, JSON.stringify(u));
  const genoeg = { pas: u.rots >= 25, kloof: u.rots >= 35, rotsrug: u.rots >= 3, moeras: u.water >= 10, polder: u.water >= 25 }[u.soort];
  check(`${naam}: ${u.soort} is te zien`, genoeg, JSON.stringify(u));
}

for (const lv of [2, 3]) {
  await p.evaluate((lv) => {
    localStorage.clear();
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2, 3] }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: lv }));
    sessionStorage.setItem('burcht-banier.geenTitel', '1');
  }, lv);
  await p.reload(); await wacht(); await p.waitForTimeout(400);
  await p.evaluate(async () => {
    document.getElementById('missie-begin').click();
    for (const id of ['tip', 'meldingen']) document.getElementById(id).hidden = true;
    const s = window.spel; const { rasterNaarWereld } = await import('/js/iso.js');
    const w = rasterNaarWereld(s.kaart.breedte / 2, s.kaart.hoogte / 2);
    s.camera.zetZoom(0.4); s.camera.kijkNaar(w.x, w.y);
  });
  await p.waitForTimeout(700);
  await p.screenshot({ path: `/home/claude/stap34-level${lv}.png` });
}
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
