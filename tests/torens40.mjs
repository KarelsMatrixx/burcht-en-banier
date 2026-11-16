// Torens: sinds 0.65 passen er 7 op een Watchtower (toren) en 3 op een Tower (wachttoren). Hoofdkasteel: te beklimmen, samen vijf man.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8282'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
await p.goto('http://localhost:8282/'); await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd); await p.waitForTimeout(300);
const r = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(true);
  const K = s.kaart; const B = K.breedte;
  const alle = (o, e) => { const v = []; for (let i = 0; i < K.object.length; i++) if (K.object[i] === o && K.eigenaar[i] === e) v.push(i); return v; };
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); } };
  const uit = {};
  const keep = (t) => { const v = []; for (let i = 0; i < K.object.length; i++) if (K.object[i] === 7 && Math.max(Math.abs((i % B) - K.start[t].x), Math.abs(Math.floor(i / B) - K.start[t].y)) <= 1) v.push(i); return v; };
  const burcht = keep(0); const rood = keep(1);
  uit.burchtTegels = burcht.length;
  uit.blauwMuur = burcht.filter((v) => s.wegvinder.isMuur(v % B, Math.floor(v / B), 0)).length;
  uit.roodMuur = rood.filter((v) => s.wegvinder.isMuur(v % B, Math.floor(v / B), 1)).length;
  const st = K.start[0];
  const zet = (n) => { s.leger.zetStand(Array.from({ length: n }, (_, i) => ['ridder', st.x + 3 + (i % 4), st.y + 3 + Math.floor(i / 4), 60, 0])); };
  // Hoofdkasteel: zeven soldaten sturen, vijf kunnen er op
  zet(7);
  s.leger.kiesAlles();
  const t = burcht[0];
  s.leger.stuur(t % B, Math.floor(t / B), true);
  sim(400);
  const op = s.leger.soldaten().filter((e) => e.opMuur && K.object[Math.floor(e.y) * B + Math.floor(e.x)] === 7);
  uit.opKasteel = op.length;
  uit.hoogte = op.length ? op[0].hoogte : 0;
  // Torens
  // Een toren met een stuk muur en een poort ernaast (sinds 0.64 klim je alleen via een poort), van jou, op open grond.
  const tw = (st.y + 8) * B + st.x + 6;
  for (const [i, o] of [[tw, 5], [tw + 1, 4], [tw + 2, 4], [tw + 3, 6]]) { K.object[i] = o; K.eigenaar[i] = 1; }
  s.wegvinder.herbereken(); s.leger.kaartVeranderd();
  const torens = [tw];
  uit.torens = torens.length;
  for (const e of s.leger.soldaten()) if (!e.koning) s.leger.sneuvel(e);
  zet(3);
  s.leger.kiesAlles();
  uit.trap = s.wegvinder.isOpgang((tw + 3) % B, Math.floor(tw / B), 0); uit.gestuurd = s.leger.stuur(tw % B, Math.floor(tw / B), true); uit.obj = [tw, tw+1, tw+2, tw+3].map((i) => K.object[i] + '/' + K.eigenaar[i]);
  sim(500);
  const opTw = s.leger.soldaten().filter((e) => e.opMuur && Math.floor(e.y) * B + Math.floor(e.x) === tw);
  uit.opToren = opTw.length;
  uit.afstand = 9; for (let i = 0; i < opTw.length; i++) for (let j = i + 1; j < opTw.length; j++) uit.afstand = Math.min(uit.afstand, Math.hypot(opTw[0 + i].x - opTw[j].x, opTw[i].y - opTw[j].y));
  uit.opMuur = s.leger.soldaten().filter((e) => e.opMuur).length;
  return uit;
});
console.log(JSON.stringify(r));
check('burcht van de speler is beklimbaar', r.burchtTegels > 0 && r.blauwMuur === r.burchtTegels, JSON.stringify([r.burchtTegels, r.blauwMuur]));
check('burcht van rood is beklimbaar voor rood', r.roodMuur > 0, r.roodMuur);
check('precies vijf man op het hoofdkasteel (van zeven)', r.opKasteel === 5, r.opKasteel);
check('torens bestaan', r.torens > 0);
check('alle drie op een Watchtower (past 7)', r.opToren === 3, r.opToren);
check('ze staan naast elkaar', r.afstand > 0.3 && r.afstand < 9, r.afstand);
check('alle drie staan op de muur', r.opMuur === 3, r.opMuur);
check('geen pagina-fouten', fouten.length === 0, fouten.join('|'));
console.log(`torens40: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
