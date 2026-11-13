// Stap 31: het schilderij op het beginscherm en de levelkaart (844 bij 390, zoals een iPhone liggend).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
const hier = path.dirname(fileURLToPath(import.meta.url));
const wortel = path.resolve(hier, '..');
const uit = process.env.UIT || '/home/claude';
const srv = spawn('python3', ['-m', 'http.server', '8231'], { cwd: wortel, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd);
await p.goto('http://localhost:8231/?x=' + Date.now()); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); await p.reload(); await wacht();
await p.waitForTimeout(600);

// Het beginscherm
const beeld = await p.evaluate(() => { const i = document.getElementById('titel-beeld'); return { w: i.naturalWidth, zichtbaar: !i.hidden && i.getBoundingClientRect().width > 800 }; });
check('beginscherm: schilderij geladen en schermvullend', beeld.w > 0 && beeld.zichtbaar, JSON.stringify(beeld));
const knoppen = await p.$$eval('#titel-knoppen button', (k) => k.filter((x) => !x.hidden).map((x) => { const r = x.getBoundingClientRect(); return { t: x.textContent, l: r.left, r: r.right, o: r.top, b: r.bottom }; }));
check('beginscherm: knoppen staan in het linker derde en binnen beeld', knoppen.every((k) => k.r < 844 / 3 + 40 && k.o >= 0 && k.b <= 390), JSON.stringify(knoppen));
await p.screenshot({ path: `${uit}/stap31-beginscherm.png` });

// De levelkaart, nog niets gewonnen
await p.tap('#titel-campagne');
await p.waitForTimeout(700);
const kaart = await p.evaluate(() => {
  const i = document.querySelector('#kaart-doek .kaartbeeld');
  const v = document.querySelector('#kaart-doek .kaartvlak').getBoundingClientRect();
  const punten = [...document.querySelectorAll('#kaart-doek .punt')].map((g) => g.getAttribute('class').replace('punt ', ''));
  const teksten = [...document.querySelectorAll('#kaart-doek .punt text')].map((t) => t.textContent);
  const goud = document.querySelector('#kaart-doek .weg-goud');
  return { w: i.naturalWidth, vw: v.width, vh: v.height, punten, teksten, goud: goud ? goud.getAttribute('stroke-dasharray') : null, brug: !!document.querySelector('#kaart-doek .brug'), images: document.querySelectorAll('#kaart-doek image').length };
});
check('kaart: schilderij geladen', kaart.w === 2576, kaart.w);
check('kaart: vult de breedte van het scherm', Math.abs(kaart.vw - 844) < 2 && kaart.vh <= 390, `${kaart.vw} x ${kaart.vh}`);
check('kaart: elf punten', kaart.punten.length === 11);
check('kaart: geen cijfers bij de punten', !kaart.teksten.some((t) => /^\d+$/.test(t)), kaart.teksten.join());
check('kaart: elf portretten', kaart.images === 11);
check('kaart: brug over de kloof', kaart.brug);
check('kaart: nog niets gewonnen, dus nog geen gouden weg', !kaart.goud, kaart.goud);
// Staan alle punten binnen het scherm, ook met de randen van een iPhone?
const binnen = await p.$$eval('#kaart-doek .punt .rond', (c) => c.map((x) => { const r = x.getBoundingClientRect(); return [r.left, r.right, r.top, r.bottom]; }));
check('kaart: alle punten ruim binnen beeld', binnen.every(([l, r, o, bo]) => l > 20 && r < 844 - 20 && o > 20 && bo < 390 - 30), JSON.stringify(binnen.map((x) => x.map(Math.round))));
// Tikvlak groot genoeg voor een vinger (minstens 44 punten)
const tik = await p.$$eval('#kaart-doek .punt .tikvlak', (c) => c.map((x) => x.getBoundingClientRect().width));
check('kaart: tikvlak minstens 44 punten', tik.every((w) => w >= 44), tik.map(Math.round).join());
await p.screenshot({ path: `${uit}/stap31-kaart.png` });

// Level 1 en 2 gewonnen: de weg wordt langer goud en de punten wisselen van stand
await p.evaluate(() => { localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2] })); });
await p.reload(); await wacht(); await p.tap('#titel-campagne'); await p.waitForTimeout(700);
const na = await p.evaluate(() => ({
  punten: [...document.querySelectorAll('#kaart-doek .punt')].map((g) => g.getAttribute('class').replace('punt ', '')),
  goud: document.querySelector('#kaart-doek .weg-goud').getAttribute('stroke-dasharray'),
  vinkjes: document.querySelectorAll('#kaart-doek .vinkje').length,
}));
check('na winst 1 en 2: gewonnen, open en dicht', na.punten[1] === 'gewonnen' && na.punten[2] === 'gewonnen' && na.punten[3] === 'open', na.punten.join());
check('na winst 1 en 2: weg tot level 3 is goud', Number(na.goud.split(' ')[0]) >= 390 && Number(na.goud.split(' ')[0]) <= 394, na.goud);
check('na winst 1 en 2: twee vinkjes', na.vinkjes === 2, na.vinkjes);
await p.screenshot({ path: `${uit}/stap31-kaart-gewonnen.png` });

// Terug naar het beginscherm, dan Verder spelen niet nodig; geen fouten
await p.tap('#kaart-terug'); await p.waitForTimeout(300);
check('terug: beginscherm met schilderij', await p.evaluate(() => !document.getElementById('titel-beeld').hidden));
check('geen paginafouten', fouten.length === 0, fouten.join(' | '));
console.log(`${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
