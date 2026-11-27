// 0.124.6: de voorraadbalk blijft altijd naast de adviseur op de bovenste rij, ook met vis,
// een lange golfklok en een smal scherm. node tests/bovenbalk125.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const POORT = 8391;
const srv = spawn('python3', ['-m', 'http.server', String(POORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let goed = 0, fout = 0;
const check = (naam, ok, extra = '') => { console.log(`${ok ? 'GOED' : 'FOUT'} ${naam} ${extra}`); ok ? goed++ : fout++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const zichtbaar = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !!(e.offsetWidth || e.offsetHeight) && !e.closest('[hidden]'); }, sel);
for (const [w, h] of [[859, 396], [844, 390], [740, 360], [667, 375]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, serviceWorkers: 'block' })).newPage();
  await p.goto(`http://localhost:${POORT}/`);
  await p.waitForFunction(() => window.spel);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3, 4, 5, 6, 7] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 8 })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); });
  await p.reload();
  await p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 30000 });
  await p.waitForFunction(() => { const v = document.getElementById('verhaalbeeld-verder'); return document.getElementById('verhaalbeeld').hidden || (v && !v.hidden); }, null, { timeout: 20000 });
  if (await zichtbaar(p, '#verhaalbeeld-verder')) await p.click('#verhaalbeeld-verder');
  await p.waitForTimeout(500);
  if (await zichtbaar(p, '#missie-begin')) await p.click('#missie-begin');
  await p.waitForTimeout(800);
  await p.evaluate(() => { if (window.spel.havenLes) window.spel.havenLes.sla(); if (window.spel.visLes) window.spel.visLes.sla(); window.spel.ui.verbergVerhaal(); });
  // Het ergste geval: veel voorraad, vis, en de langste tekst in het strijdvak.
  for (const tekst of ['1:20 · Wave 8/10', 'Attack! 10/10', '12:59 · Wave 10/10']) {
    await p.evaluate((t) => {
      const e = window.spel.economie;
      for (const k of Object.keys(e.voorraad)) e.voorraad[k] = 600;
      const s = document.getElementById('strijdinfo'); s.hidden = false; document.getElementById('strijd-kort').textContent = t;
    }, tekst);
    await p.waitForTimeout(1300);
    const m = await p.evaluate(() => {
      const r = (id) => document.getElementById(id).getBoundingClientRect();
      const a = r('adviseur'), v = r('voorraad'), o = r('knop-oog'), t = r('knop-instellingen');
      const strijd = r('strijdinfo');
      return { aTop: a.top, aBottom: a.bottom, vTop: v.top, vRight: v.right, vBottom: v.bottom, oLeft: o.left, oTop: o.top, tTop: t.top, sRight: strijd.right, sW: strijd.width, breed: innerWidth };
    });
    check(`${w}x${h} "${tekst}": balk op de bovenste rij`, m.vTop < m.aBottom - 20 && m.vBottom < m.aBottom + 10, JSON.stringify(m));
    check(`${w}x${h} "${tekst}": oog en tandwiel ook boven`, m.oTop < m.aBottom - 20 && m.tTop < m.aBottom - 20);
    check(`${w}x${h} "${tekst}": klok binnen de balk en niet onder het oog`, m.sW > 20 && m.sRight <= m.vRight + 1 && m.vRight <= m.oLeft + 1, JSON.stringify(m));
    if (tekst.startsWith('12:59')) console.log(await p.evaluate(() => [...document.querySelectorAll('#voorraad-lijst .grondstof')].map((g) => g.dataset.sleutel + ':' + Math.round(g.getBoundingClientRect().width)).join(' ') + ' | ' + document.getElementById('voorraad').className));
    if (tekst.startsWith('1:20')) await p.screenshot({ path: `/home/claude/werk/balk-${w}.png` });
  }
  await p.close();
}
console.log(`\n${goed} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
