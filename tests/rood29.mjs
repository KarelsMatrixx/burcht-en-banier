import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8163'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto('http://localhost:8163/?x=1'); await wacht();
const koopt = (modus, a) => p.evaluate(async ([modus, a]) => {
  localStorage.clear(); localStorage.setItem('burcht-banier.modus', JSON.stringify(modus));
  return a;
}, [modus, a]);
const proef = async (modus, aanvallen) => {
  await koopt(modus, aanvallen); await p.reload(); await wacht();
  return p.evaluate((a) => {
    const s = window.spel; const r = s.rood;
    r.zet({ v: { hout: 300, steen: 300, goud: 300 }, r: {}, s: 0, a });
    // laat hem 40 keer kopen (zonder grens op sterkte)
    s.regels.heer.extra = 999;
    for (let i = 0; i < 400; i++) { r.zetVoorraad('goud', 300); r.zetVoorraad('hout', 300); r.stap(); }
    return r.stand().reserve || r.bewaar().r;
  }, aanvallen);
};
const n1 = await proef({ soort: 'vrij', profiel: 'normaal' }, 0);
console.log('normaal, aanval 0', JSON.stringify(n1));
check('normaal begin: alleen ridder en boog', !n1.bijlridder && !n1.kruisboog && n1.ridder > 0 && n1.boogschutter > 0, JSON.stringify(n1));
const n5 = await proef({ soort: 'vrij', profiel: 'normaal' }, 5);
console.log('normaal, aanval 5', JSON.stringify(n5));
check('normaal aanval 5: alle zes', ['ridder', 'boogschutter', 'bijlridder', 'kruisboog', 'sluipmoordenaar', 'vlammenwever'].every((k) => n5[k] > 0), JSON.stringify(n5));
const r9 = await proef({ soort: 'campagne', missie: 1 }, 9);
console.log('level 1, aanval 9', JSON.stringify(r9));
check('level 1 (Reinout): alleen ridders, schutters en belegering', !r9.kruisboog && !r9.sluipmoordenaar && !r9.vlammenwever && !r9.bijlridder && r9.ridder > 0, JSON.stringify(r9));
const z3 = await proef({ soort: 'campagne', missie: 3 }, 3);
console.log('level 3, aanval 3', JSON.stringify(z3));
check('level 3 (Hademar): bijlridders, geen mystiek', z3.bijlridder > 0 && !z3.sluipmoordenaar && !z3.vlammenwever, JSON.stringify(z3));
// rood stuurt een gemengd leger: geen fouten, alle soorten op de kaart
await koopt({ soort: 'vrij', profiel: 'normaal' }, 0); await p.reload(); await wacht();
const st = await p.evaluate(async () => {
  const s = window.spel;
  const n = s.strijd.stuurLeger({ ridder: 2, bijlridder: 2, kruisboog: 2, sluipmoordenaar: 1, vlammenwever: 1 }, true);
  for (let i = 0; i < 300; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); }
  return { n, soorten: [...new Set(s.strijd.vijanden().map((v) => v.vijand))] };
});
console.log(JSON.stringify(st));
check('gemengd leger op de kaart', st.n === 8, JSON.stringify(st));
await p.evaluate(async () => { const iso = await import('/js/iso.js'); const s = window.spel; const v = s.strijd.vijanden()[0]; const w = iso.rasterNaarWereld(v.x, v.y); s.camera.x = w.x; s.camera.y = w.y; s.camera.zetZoom(2.2); document.getElementById('meldingen').hidden = true; document.getElementById('tip').hidden = true; });
await p.waitForTimeout(700);
await p.screenshot({ path: '/home/claude/stap29.png' });
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
