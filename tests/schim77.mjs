// Bouwschim (0.77.12): voor elk gebouw is het schim-plaatje er, ook naast een buur (een huis naast een huis gaf eerst een fout).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8291'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 859, height: 396 }, hasTouch: true })).newPage();
await autoVerder(p);
p.on('pageerror', (e) => console.log('PAGEERR', String(e)));
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto('http://localhost:8291/'); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 4 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
await p.tap('#missie-begin'); await p.waitForTimeout(1500);
await p.evaluate(() => { try { window.spel.ui.verbergVerhaal(); } catch (e) {} });
const r = await p.evaluate(() => {
  const s = window.spel; const slecht = [];
  for (const k of Object.keys(s.bouwwerken)) {
    for (const rij of [[{ x: 20, y: 20, ok: true }], [{ x: 20, y: 20, ok: true }, { x: 21, y: 20, ok: true }, { x: 22, y: 20, ok: true }], [{ x: 20, y: 20, ok: true }, { x: 20, y: 21, ok: true }, { x: 20, y: 22, ok: true }, { x: 21, y: 21, ok: true }]]) {
      try { const sc = s.tekenaar.maakSchim(s.bouwwerken[k].soort, rij, false); for (const t of sc.tegels) if (!t.beeld || !t.beeld.beeld) slecht.push(k + ' n=' + rij.length + ' @' + t.x + ',' + t.y); } catch (e) { slecht.push(k + ' ERR ' + e.message); }
    }
  }
  return { n: Object.keys(s.bouwwerken).length, slecht: [...new Set(slecht)].slice(0, 20) };
});
console.log(JSON.stringify(r));
console.log(`schim77: ${r.slecht.length ? 'FOUT' : 'ok'}`);
await b.close(); srv.kill();
process.exit(r.slecht.length ? 1 : 0);
