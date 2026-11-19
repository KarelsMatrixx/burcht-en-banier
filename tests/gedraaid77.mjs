// 0.77.0: staande telefoon draait het spel mee, zodat het liggend blijft.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8331'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const fouten = [];
const nieuw = async (viewport, opties = {}) => {
  const ctx = await b.newContext({ viewport, hasTouch: true, ...opties });
  const p = await ctx.newPage(); p.on('pageerror', (e) => fouten.push(String(e)));
  await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); } catch (e) {} });
  return { ctx, p };
};
const maat = (p) => p.evaluate(() => {
  const r = document.body.getBoundingClientRect(); const c = document.getElementById('spel');
  return { gedraaid: document.documentElement.classList.contains('gedraaid'), bw: Math.round(r.width), bh: Math.round(r.height), cw: c.clientWidth, ch: c.clientHeight, draai: getComputedStyle(document.getElementById('draai')).display };
});

// 1. liggend: niets verandert
let { ctx, p } = await nieuw({ width: 844, height: 390 });
await p.goto('http://localhost:8331/'); await p.waitForTimeout(1500);
let m = await maat(p);
check('liggend: niet gedraaid', m.gedraaid === false, JSON.stringify(m));
check('liggend: canvas 844 x 390', m.cw === 844 && m.ch === 390, JSON.stringify(m));
await ctx.close();

// 2. staand: het spel is liggend van maat en gedraaid
({ ctx, p } = await nieuw({ width: 390, height: 844 }));
await p.goto('http://localhost:8331/'); await p.waitForTimeout(1500);
m = await maat(p);
check('staand: gedraaid', m.gedraaid === true, JSON.stringify(m));
check('staand: canvas is liggend (844 x 390)', m.cw === 844 && m.ch === 390, JSON.stringify(m));
check('staand: op het scherm vult het 390 x 844', m.bw === 390 && m.bh === 844, JSON.stringify(m));
check('staand: geen draai-melding', m.draai === 'none', JSON.stringify(m));
// omrekening van vingerplekken: linksboven van het spel staat rechtsboven op het scherm
const om = await p.evaluate(async () => {
  const s = await import('/js/scherm.js');
  const c = document.getElementById('spel');
  return { a: s.naarSpel(390, 0), b: s.naarSpel(0, 844), v: s.vak(c), bw: s.spelBreedte(), bh: s.spelHoogte(), d: s.deltaNaarSpel(10, 0) };
});
check('naarSpel hoek linksboven', om.a.x === 0 && om.a.y === 0, JSON.stringify(om.a));
check('naarSpel hoek rechtsonder', om.b.x === 844 && om.b.y === 390, JSON.stringify(om.b));
check('vak van het canvas', Math.round(om.v.left) === 0 && Math.round(om.v.top) === 0 && Math.round(om.v.width) === 844 && Math.round(om.v.height) === 390, JSON.stringify(om.v));
check('spelmaat', om.bw === 844 && om.bh === 390, JSON.stringify([om.bw, om.bh]));
check('veeg naar rechts op het scherm is omhoog in het spel', om.d.x === 0 && om.d.y === -10, JSON.stringify(om.d));
// echte tikken: een knop in het spel (hamer) reageert op een tik op zijn schermplek
await p.waitForSelector('#knop-hamer', { state: 'visible', timeout: 8000 }).catch(() => {});
const hamer = await p.evaluate(() => { const r = document.getElementById('knop-hamer').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, in: r.left >= 0 && r.right <= 390 && r.top >= 0 && r.bottom <= 844 }; });
check('hamerknop ligt op het scherm', hamer.in, JSON.stringify(hamer));
await p.touchscreen.tap(hamer.x, hamer.y); await p.waitForTimeout(400);
const bouw = await p.evaluate(() => document.getElementById('bouwbalk') && getComputedStyle(document.getElementById('bouw-knoppen')).display !== 'none' && document.getElementById('bouw-knoppen').children.length);
check('tik op de hamer opent het bouwmenu', bouw > 0, String(bouw));
// schuiven met een veeg op de kaart verplaatst de camera in de juiste richting
const cam = () => p.evaluate(() => { const c = window.spel && window.spel.camera; return c ? { x: c.x, y: c.y } : null; });
const c0 = await cam();
if (c0) {
  const cdp = await p.context().newCDPSession(p);
  const veeg = async (x1, y1, x2, y2) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x1, y: y1 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x1 + ((x2 - x1) * i) / 8, y: y1 + ((y2 - y1) * i) / 8 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  // veeg op het scherm naar rechts = in het spel omhoog; de kaart volgt de vinger, dus camera.y neemt toe
  await veeg(100, 400, 250, 400); await p.waitForTimeout(300);
  const c1 = await cam();
  check('veeg op het scherm naar rechts schuift de kaart omhoog in het spel', c1.y > c0.y + 1 && Math.abs(c1.x - c0.x) < Math.abs(c1.y - c0.y), JSON.stringify([c0, c1]));
} else check('camera bereikbaar via window.spel', false);
await ctx.close();

// 2b. tijdens het laden is het spel afgedekt (0.77.2), daarna weg
({ ctx, p } = await nieuw({ width: 390, height: 844 }));
await p.route('**/js/assets.js', async (r) => { await new Promise((x) => setTimeout(x, 2500)); r.continue(); });
await p.goto('http://localhost:8331/', { waitUntil: 'commit' }); await p.waitForTimeout(1200);
const dek = await p.evaluate(() => { const a = document.getElementById('adviseur').getBoundingClientRect(); const e = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2); return { laden: !!document.getElementById('laden'), boven: e && (e.id === 'laden' || (e.parentElement && e.parentElement.id === 'laden')) }; });
check('tijdens het laden dekt #laden de knoppen af', dek.laden && dek.boven, JSON.stringify(dek));
await p.waitForTimeout(5000);
check('na het laden is #laden weg', await p.evaluate(() => !document.getElementById('laden')));
await ctx.close();

// 3. omdraaien van de telefoon: staand naar liggend naar staand
({ ctx, p } = await nieuw({ width: 390, height: 844 }));
await p.goto('http://localhost:8331/'); await p.waitForTimeout(1200);
await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(600);
m = await maat(p); check('na draaien naar liggend: niet meer gedraaid', m.gedraaid === false && m.cw === 844 && m.ch === 390, JSON.stringify(m));
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(600);
m = await maat(p); check('weer staand: gedraaid, canvas liggend', m.gedraaid === true && m.cw === 844 && m.ch === 390, JSON.stringify(m));
await ctx.close();

// 4. als app op het beginscherm (iPhone 390 x 844 punten), met een te lage gemeten hoogte
({ ctx, p } = await nieuw({ width: 390, height: 760 }, { screen: { width: 390, height: 844 } }));
await ctx.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }); });
await p.goto('http://localhost:8331/'); await p.waitForTimeout(1500);
m = await maat(p); check('app staand: gedraaid, canvas 844 x 390', m.gedraaid === true && m.cw === 844 && m.ch === 390, JSON.stringify(m));
await ctx.close();

// 5. ingesloten in een andere pagina: niet draaien
({ ctx, p } = await nieuw({ width: 390, height: 844 }));
await p.route('http://localhost:8331/buiten.html', (r) => r.fulfill({ contentType: 'text/html', body: '<iframe src="/" style="width:390px;height:844px;border:0"></iframe>' }));
await p.goto('http://localhost:8331/buiten.html'); await p.waitForTimeout(1800);
const kind = p.frames().find((f) => f !== p.mainFrame());
const mk = await kind.evaluate(() => ({ gedraaid: document.documentElement.classList.contains('gedraaid'), cw: document.getElementById('spel').clientWidth }));
check('ingesloten: niet gedraaid', mk.gedraaid === false && mk.cw === 390, JSON.stringify(mk));
await ctx.close();

check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
