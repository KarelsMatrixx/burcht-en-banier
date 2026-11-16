// 0.65.2: het spel meet zijn schermmaat zelf, zodat er geen zwarte balk onderin komt.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8297'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const maat = (p) => p.evaluate(() => { const r = document.body.getBoundingClientRect(); const c = document.getElementById('spel'); return { bw: Math.round(r.width), bh: Math.round(r.height), cw: c.clientWidth, ch: c.clientHeight }; });
// 1. gewone browser
let ctx = await b.newContext({ viewport: { width: 844, height: 390 } });
let p = await ctx.newPage(); const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
await p.goto('http://localhost:8297/'); await p.waitForTimeout(1500);
let m = await maat(p); check('gewoon: body vult het venster', m.bw === 844 && m.bh === 390, JSON.stringify(m));
check('gewoon: canvas vult het venster', m.cw === 844 && m.ch === 390, JSON.stringify(m));
await p.setViewportSize({ width: 800, height: 360 }); await p.waitForTimeout(500);
m = await maat(p); check('na verkleinen volgt alles', m.bw === 800 && m.bh === 360 && m.cw === 800 && m.ch === 360, JSON.stringify(m));
await ctx.close();
// 2. als app op het beginscherm, met een te lage gemeten hoogte (de iPhone-fout): het scherm is 844x390
ctx = await b.newContext({ viewport: { width: 844, height: 340 }, screen: { width: 844, height: 390 } });
await ctx.addInitScript(() => { Object.defineProperty(navigator, 'standalone', { value: true }); });
p = await ctx.newPage(); p.on('pageerror', (e) => fouten.push(String(e)));
await p.goto('http://localhost:8297/'); await p.waitForTimeout(1500);
m = await maat(p); check('app: body is zo groot als het scherm, ook bij te lage meting', m.bw === 844 && m.bh === 390, JSON.stringify(m));
check('app: canvas ook', m.cw === 844 && m.ch === 390, JSON.stringify(m));
await ctx.close();
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
