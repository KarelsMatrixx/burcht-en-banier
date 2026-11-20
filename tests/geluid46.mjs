// Geluidseffecten (0.78.0): motor, ontgrendelen bij de eerste tik, geluiden in het gevecht, menu.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8246;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=user-gesture-required'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' });
const p = await ctx.newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
const mis = []; p.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('sw.js')) mis.push(r.url()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 0 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(300);
const voor = await p.evaluate(() => window.spel.geluid.stand());
check('voor de eerste tik: geen audio', voor.ctx === 'geen', JSON.stringify(voor));
await p.tap('#missie-begin'); await p.waitForTimeout(2500);
const na = await p.evaluate(() => window.spel.geluid.stand());
check('na de eerste tik: audio aan', na.ctx === 'running', JSON.stringify(na));
check('alle 54 bestanden geladen', na.geladen === 54, JSON.stringify(na));
// Tellen wat er klinkt
await p.evaluate(() => {
  const g = window.spel.geluid; const echt = g.speel; window.__gehoord = {};
  g.speel = (naam, opt) => { window.__gehoord[naam] = (window.__gehoord[naam] || 0) + 1; return echt(naam, opt); };
});
await p.tap('#gids-kaart button'); await p.waitForTimeout(300);
await p.evaluate(() => window.spel.proloog.zetFase('storm'));
await p.waitForTimeout(20000);
const gehoord = await p.evaluate(() => window.__gehoord);
console.log(JSON.stringify(gehoord));
const st0 = await p.evaluate(() => window.spel.geluid.stand().gehoord);
check('knop tikt', st0.includes('ui_click') || st0.includes('ui_back'), JSON.stringify(st0));
check('zwaarden in het gevecht', (gehoord.sword_hit || 0) + (gehoord.axe_hit || 0) >= 5);
check('sneuvelen klinkt', (gehoord.death_soldier || 0) + (gehoord.death_civilian || 0) >= 1);
check('pijlen of kruisbogen', (gehoord.arrow_release || 0) + (gehoord.crossbow_shot || 0) >= 1);
const st = await p.evaluate(() => window.spel.geluid.stand());
check('nooit meer dan 14 tegelijk', st.spelend <= 14, JSON.stringify(st));
// Menu: geluid uit en weer aan, volume
await p.evaluate(() => { document.getElementById('instellingen').hidden = false; });
await p.click('#knop-geluid');
let s2 = await p.evaluate(() => [window.spel.geluid.aan(), document.getElementById('knop-geluid').textContent, JSON.parse(localStorage.getItem('aldervale.geluid')).aan]);
check('geluid uit via menu en bewaard', s2[0] === false && s2[1] === 'Sound: off' && s2[2] === false, JSON.stringify(s2));
await p.click('#knop-geluid');
await p.fill('#geluid-volume', '40');
s2 = await p.evaluate(() => [window.spel.geluid.aan(), window.spel.geluid.volume()]);
check('geluid weer aan, volume 0,4', s2[0] === true && Math.abs(s2[1] - 0.4) < 0.01, JSON.stringify(s2));
await p.screenshot({ path: '/home/claude/geluid-menu.png' });
check('geen ontbrekende bestanden', mis.length === 0, mis.join(' '));
check('geen paginafouten', fouten.length === 0, fouten.join(' | '));
console.log('ok', ok, 'fout', fout);
await b.close(); srv.kill();
