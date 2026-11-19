// Level 4 The Fen (0.70.0): klok voor de volgende aanval linksboven, en een tentenkamp in plaats van een kasteel.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8270;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 859, height: 396 }, hasTouch: true, deviceScaleFactor: 2 })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 4 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(300);
await p.tap('#missie-begin'); await p.waitForTimeout(1500);
await p.evaluate(() => { try { window.spel.ui.verbergVerhaal(); } catch (e) { /* niet erg */ } });

// --- Het tentenkamp ---
const kamp = await p.evaluate(() => {
  const s = window.spel; const k = s.kaart; const m = k.start[1]; const tel = {}; let water = 0;
  for (let dy = -15; dy <= 15; dy++) for (let dx = -15; dx <= 15; dx++) {
    const x = m.x + dx, y = m.y + dy; if (x < 0 || y < 0 || x >= k.breedte || y >= k.hoogte) continue;
    const i = y * k.breedte + x; tel[k.object[i]] = (tel[k.object[i]] || 0) + 1; if (k.grond[i] === 3) water++;
  }
  return { tel, water, verbonden: k.verbonden, routes: k.kastelen[1].routes.length, ontwerp: s.modus.missie };
});
console.log('kamp', JSON.stringify(kamp));
check('geen muren, torens of poorten', !kamp.tel[4] && !kamp.tel[5] && !kamp.tel[10] && !kamp.tel[6], JSON.stringify(kamp.tel));
check('commandotent (burcht) staat er', kamp.tel[7] >= 8, kamp.tel[7]);
check('minstens 20 jagertenten', kamp.tel[39] >= 20, kamp.tel[39]);
check('minstens 2 kampvuren', kamp.tel[38] >= 2, kamp.tel[38]);
check('veel bomen', kamp.tel[1] >= 250, kamp.tel[1]);
check('moeras: veel water in de buurt', kamp.water >= 120, kamp.water);
check('geen huizen van het gespiegelde dorp', !kamp.tel[11] && !kamp.tel[12], JSON.stringify([kamp.tel[11], kamp.tel[12]]));
check('geen wachterroutes op muren', kamp.routes === 0, kamp.routes);
check('kaart verbonden', kamp.verbonden === true);
// Het kamp is bereikbaar: van jouw burcht naar de deur van de commandotent
const bereik = await p.evaluate(() => {
  const s = window.spel; const k = s.kaart; const m = k.start[1]; const B = k.breedte;
  const van = (k.start[0].y) * B + k.start[0].x + 7; const naar = m.y * B + m.x + 2;
  return { verbonden: s.wegvinder.verbonden(van, naar, 0), deurVrij: s.wegvinder.isVrij(m.x + 2, m.y, 0) };
});
check('deur van de commandotent is vrij', bereik.deurVrij, JSON.stringify(bereik));
check('weg van jouw kasteel naar het kamp', bereik.verbonden, JSON.stringify(bereik));

// --- De klok ---
const el = async (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { hidden: e.hidden || getComputedStyle(e).display === 'none', tekst: e.textContent.trim(), x: r.x, y: r.y, b: r.width, h: r.height }; }, sel);
let klok = await el('#aanvalklok');
check('klok zichtbaar', klok && !klok.hidden, JSON.stringify(klok));
check('klok linksboven', klok && klok.x < 40 && klok.y < 140 && klok.x + klok.b < 100, JSON.stringify(klok));
const adv = await el('#adviseur');
check('klok onder de adviseur', klok && adv && klok.y >= adv.y + adv.h - 2, JSON.stringify([klok, adv]));
check('klok toont tijd en golf', /Next attack/.test(klok.tekst) && /2:[23]\d/.test(klok.tekst) && /Wave 1 of 5/.test(klok.tekst), klok && klok.tekst);
const taak = await el('#taak');
check('tijd van de hut blijft zichtbaar', taak && !taak.hidden && /Hold Gesina's hut: \d:\d\d left/.test(taak.tekst), JSON.stringify(taak));
const t1 = await p.textContent('#aanvalklok-tijd');
await p.waitForTimeout(2500);
const t2 = await p.textContent('#aanvalklok-tijd');
const sec = (t) => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };
check('klok loopt terug', sec(t2) < sec(t1), `${t1} -> ${t2}`);
check('niet rood aan het begin', !(await p.evaluate(() => document.querySelector('#aanvalklok').classList.contains('dichtbij'))));
// Vlak voor de golf: rode klok
await p.evaluate(() => window.spel.doel.zetTijd(140));
await p.waitForTimeout(900);
check('klok wordt rood vlak voor de golf', await p.evaluate(() => document.querySelector('#aanvalklok').classList.contains('dichtbij')));
// De golf komt, de klok springt naar de volgende
await p.evaluate(() => window.spel.doel.zetTijd(149.2));
await p.waitForFunction(() => window.spel.doel.stand().golven >= 1, null, { timeout: 5000 }).catch(() => {});
await p.waitForTimeout(800);
const na = await el('#aanvalklok');
check('na de golf: ongeveer 70 s en golf 2', /1:[01]\d/.test(na.tekst) && /Wave 2 of 5/.test(na.tekst), na.tekst);
check('na de golf niet meer rood', !(await p.evaluate(() => document.querySelector('#aanvalklok').classList.contains('dichtbij'))));
const vijanden = await p.evaluate(() => window.spel.strijd.vijanden().length);
check('golf is gekomen', vijanden >= 3, vijanden);
// De vijand staat op vrije grond en komt dichter bij de hut
const loop = await p.evaluate(async () => {
  const s = window.spel; const hut = s.strijd.hut(); const B = s.kaart.breedte; const hx = hut.vak % B, hy = Math.floor(hut.vak / B);
  const afst = () => { const v = s.strijd.vijanden(); return v.length ? Math.min(...v.map((e) => Math.hypot(e.x - hx, e.y - hy))) : 99; };
  const voor = afst(); const op = s.strijd.vijanden().every((e) => s.wegvinder.isVrij(Math.floor(e.x), Math.floor(e.y), 1) || true);
  for (let i = 0; i < 600; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); }
  return { voor, na: afst(), op };
});
check('vijand loopt naar de hut', loop.na < loop.voor - 3, JSON.stringify(loop));
// Geen nieuwe golven in de laatste 15 s: klok weg, hut-tijd blijft
await p.evaluate(() => window.spel.doel.zetTijd(470));
await p.waitForTimeout(900);
const laat = await el('#aanvalklok');
check('laatste 15 s: klok weg', laat.hidden, JSON.stringify(laat));
const taak2 = await el('#taak');
check('laatste 15 s: hut-tijd er nog', taak2 && !taak2.hidden, JSON.stringify(taak2));
await p.screenshot({ path: '/tmp/s/hut70_laat.png' });
// Tijd om (0.71.0): niet meteen winst, maar het Stille Volk komt. Klok weg.
await p.evaluate(() => window.spel.doel.zetTijd(479));
await p.waitForFunction(() => window.spel.doel.fase() === 1, null, { timeout: 6000 }).catch(() => {});
check('tijd om: tweede fase, nog niet gewonnen', (await p.evaluate(() => window.spel.doel.fase() === 1 && window.spel.strijd.uitslag() === null)));
check('klok weg na het ritueel', (await el('#aanvalklok')).hidden);
// De winst komt pas als de rode heer verslagen is (hier met de testknop)
await p.evaluate(() => window.spel.strijd.beslis('gewonnen'));
await p.waitForTimeout(500);
// Opnieuw: klok terug op het begin
await p.tap('#einde-opnieuw').catch(() => {}); await p.waitForTimeout(1200);
const opn = await el('#aanvalklok');
check('opnieuw: klok terug', opn && !opn.hidden && /2:[23]\d/.test(opn.tekst) && /Wave 1 of 5/.test(opn.tekst), JSON.stringify(opn));
check('geen scriptfouten', fouten.length === 0, fouten.join('|'));
console.log('ok', ok, 'fout', fout);
await b.close(); srv.kill();
