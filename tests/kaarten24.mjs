import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8145'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('burcht-banier.paneel', 'bouw'); } catch (e) {} });
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
await p.goto('http://localhost:8145/?x=' + Date.now()); await wacht();
const vingerafdruk = () => p.evaluate(() => { const k = window.spel.kaart; let h = 0; for (let i = 0; i < k.object.length; i++) h = (h * 31 + k.object[i] * 7 + k.grond[i]) >>> 0; return { h, b: k.breedte, n: k.naam, s: k.start, v: k.verbonden }; });
for (const [modus, verwacht] of [[{ soort: 'vrij', profiel: 'normaal' }, 64], [{ soort: 'campagne', missie: 1 }, 56], [{ soort: 'campagne', missie: 2 }, 64], [{ soort: 'campagne', missie: 3 }, 68]]) {
  await p.evaluate((m) => { localStorage.clear(); localStorage.setItem('burcht-banier.modus', JSON.stringify(m)); }, modus);
  await p.reload(); await wacht();
  const v = await vingerafdruk();
  const naam = modus.missie ? 'missie ' + modus.missie : 'vrij';
  console.log(naam, JSON.stringify(v));
  check(naam + ' grootte', v.b === verwacht, v.b);
  check(naam + ' weg tussen de poorten', v.v);
  const r = await p.evaluate(() => {
    const s = window.spel; const k = s.kaart; const B = k.breedte; const [a, z] = k.start;
    const van = a.y * B + a.x + 6, naar = z.y * B + z.x - (k.omvang || 5) - 1;
    const telObj = (o, eig) => { let n = 0; for (let i = 0; i < k.object.length; i++) if (k.object[i] === o && (eig === undefined || k.eigenaar[i] === eig)) n++; return n; };
    // kopererts en steen op redelijke afstand van jouw burcht
    let koper = 999, steen = 999;
    for (let i = 0; i < k.object.length; i++) { const d = Math.hypot(i % B - a.x, Math.floor(i / B) - a.y); if (k.object[i] === 3) koper = Math.min(koper, d); if (k.object[i] === 2) steen = Math.min(steen, d); }
    return { pad: s.wegvinder.verbonden(van, naar, 0), werkenRood: telObj(17, 2) + telObj(18, 2) + telObj(19, 2), koper: Math.round(koper), steen: Math.round(steen), rood: s.strijd.stand().rood };
  });
  console.log('  ', JSON.stringify(r));
  check(naam + ' leger kan naar rood lopen', r.pad);
  check(naam + ' drie werken van rood', r.werkenRood === 3, r.werkenRood);
  check(naam + ' steen in de buurt', r.steen < 18, r.steen);
  check(naam + ' koper op de kaart', r.koper < 45, r.koper);
  await p.evaluate(() => { const s = window.spel; s.camera.zetZoom(0.45); const k = s.kaart; });
  await p.waitForTimeout(600);
  await p.screenshot({ path: `/home/claude/kaart-${naam.replace(' ', '')}.png` });
}
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
