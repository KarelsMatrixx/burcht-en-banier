import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
const p = await ctx.newPage();
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); sessionStorage.setItem('burcht-banier.paneel', 'bouw'); } catch (e) {} });
const fouten = [];
p.on('pageerror', (e) => fouten.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const laad = async () => { await p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 }); };
await p.goto(url + '/?x=' + Date.now()); await laad();
await p.evaluate(() => localStorage.clear()); await p.reload(); await laad();
// 1. standaard: vrij normaal, bestaande bewaarsleutel
let i = await p.evaluate(() => ({ v: window.spel.CONFIG.versie, m: window.spel.modus, eerste: window.spel.regels.heer.eersteAanval, hout: window.spel.regels.grondstoffen.hout.begin }));
check('versie', i.v === '0.44.0', i.v);
check('standaard vrij normaal', i.m.soort === 'vrij' && i.m.profiel === 'normaal', JSON.stringify(i.m));
check('normaal: ongewijzigde regels', i.eerste === 200 && i.hout === 60, JSON.stringify(i));
await p.evaluate(() => window.spel.bouwer && 0);
// 2. menu
await p.click('#knop-instellingen'); await p.click('#knop-levels'); await p.click('#kaart-terug'); await p.click('#titel-vrij');
const menu = await p.evaluate(() => ({ open: !document.getElementById('menu').hidden, knoppen: [...document.querySelectorAll('#menu-lijst button')].map((k) => [k.dataset.sleutel, k.disabled]) }));
check('menu opent met 4 vrij en 3 missies', menu.open && menu.knoppen.length === 7, JSON.stringify(menu));
check('missie 2 en 3 dicht, missie 1 open', menu.knoppen.find((k) => k[0] === 'missie:1')[1] === false && menu.knoppen.find((k) => k[0] === 'missie:2')[1] === true && menu.knoppen.find((k) => k[0] === 'missie:3')[1] === true);
await p.screenshot({ path: '/home/claude/stap17-menu.png' });
// 3. kies missie 1 via menu
await Promise.all([p.waitForNavigation(), p.click('button[data-sleutel="missie:1"]')]); await laad();
i = await p.evaluate(() => ({ m: window.spel.modus, eerste: window.spel.regels.heer.eersteAanval, hout: window.spel.regels.grondstoffen.hout.begin, wacht: window.spel.regels.strijd.wachters, burcht: window.spel.strijd.stand().rood, intro: !document.getElementById('missie').hidden, titel: document.getElementById('missie-titel').textContent, voorraadHout: window.spel.economie.voorraad.hout, versie: document.getElementById('versie').textContent, heerStand: window.spel.strijd.stand().heer }));
console.log('missie1:', JSON.stringify(i));
check('missie 1 gekozen', i.m.soort === 'campagne' && i.m.missie === 1);
check('missie 1: profiel rustig, Reinout eerste aanval 240', i.eerste === 240 && i.hout === 80 && i.wacht === 4 && i.burcht === 700, JSON.stringify(i));
check('intro zichtbaar', i.intro && /Witherheath/.test(i.titel), i.titel);
check('versie toont missie', /mission 1/.test(i.versie), i.versie);
await p.screenshot({ path: '/home/claude/stap17-missie1.png' });
await p.click('#missie-begin');
check('intro dicht na Begin', await p.evaluate(() => document.getElementById('missie').hidden));
// 4. winnen: missie 1 klaar, volgende missie vrij
await p.evaluate(() => { const s = window.spel; s.strijd.koning(1).dood = true; s.strijd.stap(); });
const e1 = await p.evaluate(() => ({ titel: document.getElementById('einde-titel').textContent, tekst: document.getElementById('einde-tekst').textContent, volgende: !document.getElementById('einde-volgende').hidden, klaar: localStorage.getItem('burcht-banier.campagne') }));
console.log('einde:', JSON.stringify(e1));
check('missie 1 gewonnen scherm', /Victory at Witherheath/.test(e1.titel) && /Reinout/.test(e1.tekst), JSON.stringify(e1));
check('volgende-knop zichtbaar', e1.volgende);
check('voortgang bewaard', /\[1\]/.test(e1.klaar || ''), e1.klaar);
await Promise.all([p.waitForNavigation(), p.click('#einde-volgende')]); await laad();
i = await p.evaluate(() => ({ m: window.spel.modus, eerste: window.spel.regels.heer.eersteAanval, titel: document.getElementById('missie-titel').textContent, ridders: window.spel.regels.heer.ridderPerSchutter }));
check('missie 2 gestart (normaal)', i.m.missie === 2 && i.eerste === 300 && /Sevenwinds/.test(i.titel), JSON.stringify(i));
// menu: missie 3 nu dicht, missie 2 open; missie 1 blijft bewaard apart
const sleutels = await p.evaluate(() => Object.keys(localStorage).sort());
console.log('opslagsleutels:', sleutels.join(', '));
check('missie 1 heeft eigen bewaarde stand', sleutels.includes('burcht-banier.missie.1'));
// 5. zwaar: via menu na voortgang 1,2
await p.evaluate(() => { localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [1, 2] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 3 })); });
await p.reload(); await laad();
const z = await p.evaluate(() => {
  const s = window.spel; const r = s.regels;
  const uit = []; let vorig = 0; let t = 0;
  for (let k = 0; k < 10 * 700; k++) {
    s.strijd.stap(); t += 0.1; const g = s.strijd.stand().golf;
    if (g !== vorig) { vorig = g; const so = {}; for (const v of s.strijd.vijanden()) so[v.vijand] = (so[v.vijand] || 0) + 1; uit.push([g, Math.round(t), JSON.stringify(so)]); for (const v of s.strijd.vijanden()) v.dood = true; s.strijd.stap(); }
  }
  return { hout: r.grondstoffen.hout.begin, burcht: s.strijd.stand().rood, uit };
});
for (const r of z.uit) console.log('  zwaar', r.join(' | '));
check('zwaar (Hademar): eerste aanval rond 260 s, rammen vroeg', z.uit.length >= 4 && z.uit[0][1] <= 270 && z.uit.some(([g, , so]) => g <= 4 && /ram/.test(so)), JSON.stringify(z.uit));
check('zwaar: begin en burcht', z.hout === 40 && z.burcht === 1260, JSON.stringify(z));
// 6. vrede: niets gebeurt, niets te winnen
await p.evaluate(() => localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'vrij', profiel: 'vrede' })));
await p.reload(); await laad();
const v = await p.evaluate(() => {
  const s = window.spel;
  for (let k = 0; k < 10 * 900; k++) s.strijd.stap();
  s.strijd.zetRood(0); s.strijd.stap();
  return { st: s.strijd.stand(), einde: !document.getElementById('einde').hidden, tekst: document.getElementById('volk-strijd').textContent };
});
check('vrede: geen aanvallen na 15 minuten', v.st.golf === 0 && v.st.vijanden === 0, JSON.stringify(v.st));
check('vrede: niets te winnen', !v.einde && !v.st.uitslag, JSON.stringify(v));
check('vrede: uitleg in paneel', /without attacks/.test(v.tekst), v.tekst);
// 7. kapotte modus in opslag -> terug naar normaal
await p.evaluate(() => localStorage.setItem('burcht-banier.modus', '{"soort":"campagne","missie":99}'));
await p.reload(); await laad();
check('kapotte modus valt terug op vrij normaal', await p.evaluate(() => window.spel.modus.soort === 'vrij' && window.spel.modus.profiel === 'normaal'));
// 8. rustig: eerste aanval niet voor 330 s
await p.evaluate(() => localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'vrij', profiel: 'rustig' })));
await p.reload(); await laad();
const r = await p.evaluate(() => { const s = window.spel; let t = 0; let eerste = null; for (let k = 0; k < 10 * 700; k++) { s.strijd.stap(); t += 0.1; if (eerste === null && s.strijd.stand().golf > 0) eerste = Math.round(t); } return eerste; });
check('rustig: eerste aanval niet voor 330 s', r !== null && r >= 330, r);
const echt = fouten.filter((f) => !/404/.test(f));
check('geen paginafouten', echt.length === 0, echt.join(' | '));
console.log(`ok ${ok}, fout ${fout}`);
await b.close();
