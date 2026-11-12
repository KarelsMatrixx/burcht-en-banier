import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8164'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); } catch (e) {} });
await p.goto('http://localhost:8164/?x=1'); await p.waitForFunction(() => window.spel && window.spel.strijd);
for (const leger of [{ ridder: 3 }, { ridder: 2, boogschutter: 1 }, { ridder: 3, boogschutter: 1 }, { ridder: 4, boogschutter: 2 }]) {
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd);
  const r = await p.evaluate((leger) => {
    const s = window.spel; s.strijd.stuurLeger(leger, true);
    let t = 0; for (; t < 1500 && !s.strijd.uitslag() && s.strijd.vijanden().length; t++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); }
    const k = s.strijd.koning(0);
    return { t: t / 10, uitslag: s.strijd.uitslag(), koning: k ? k.leven : 0, over: s.strijd.vijanden().length, burcht: s.strijd.stand().burcht };
  }, leger);
  console.log(JSON.stringify(leger), JSON.stringify(r));
}
await b.close(); srv.kill();
