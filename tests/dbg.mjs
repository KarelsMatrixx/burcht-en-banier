import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8124'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
await p.goto('http://localhost:8124/?x=1'); await p.waitForFunction(() => window.spel && window.spel.strijd);
console.log(JSON.stringify(await p.evaluate(() => { const s = window.spel; const k = s.kaart; const o = []; for (let x = 42; x <= 56; x++) { o.push(x + ':' + k.object[13 * 64 + x] + '/' + k.eigenaar[13 * 64 + x]); } return { o, vanRood: [44,13].map(v=>s.strijd.isRodeMuurZonderLadder(13*64+44)), muur: s.strijd.isRodeMuurZonderLadder(10*64+44) }; })));
await b.close(); srv.kill();
