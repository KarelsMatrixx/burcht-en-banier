import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8146'], { cwd: '/home/claude/spel', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 900, height: 260 } })).newPage();
await p.goto('http://localhost:8146/index.html');
await p.evaluate(async () => {
  const { maakKaart, laadKaarten } = await import('/js/kaart.js');
  const kaarten = await laadKaarten();
  document.body.innerHTML = ''; document.body.style.background = '#222'; document.body.style.margin = '0';
  for (const naam of ['standaard', 'dal', 'meren', 'grensland']) {
    const k = maakKaart(kaarten[naam]); const S = 3;
    const c = document.createElement('canvas'); c.width = k.breedte * S; c.height = k.hoogte * S; c.style.margin = '6px';
    const x = c.getContext('2d');
    const kl = ['#5d9a3e', '#4b8434', '#d8c58a', '#3d6fa8', '#8a6a3e', '#a87a40'];
    for (let i = 0; i < k.object.length; i++) {
      const o = k.object[i]; let f = kl[k.grond[i]] || '#777';
      if (o === 1) f = '#1f4a1c'; else if (o === 2) f = '#bbb'; else if (o === 3) f = '#e07a30'; else if (o) f = k.eigenaar[i] === 2 ? '#d33' : '#eee';
      x.fillStyle = f; x.fillRect((i % k.breedte) * S, Math.floor(i / k.breedte) * S, S, S);
    }
    x.fillStyle = '#36f'; x.fillRect(k.start[0].x * S - 4, k.start[0].y * S - 4, 9, 9);
    document.body.appendChild(c);
  }
});
await p.screenshot({ path: '/home/claude/kaarten-overzicht.png' });
await b.close(); srv.kill();
