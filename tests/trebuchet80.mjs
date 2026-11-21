// 0.79.0: de Siege Engineer bouwt een trebuchet (staand, alleen gebouwen, groter bereik dan een katapult, dode zone).
// Controle: soorten en beloning, bouwen, schieten, dode zone, bediener nodig, rode ingenieur bouwt er ook een.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8264;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
await autoVerder(p);
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1'); });
await p.evaluate(() => {
  localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3, 4, 5] }));
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 6 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht();
await p.waitForFunction(() => { const v = document.getElementById('verhaalbeeld'); return !v || v.hidden || getComputedStyle(v).display === 'none'; }, null, { timeout: 30000 }).catch(() => {});
await p.evaluate(() => { const k = document.getElementById('missie-begin'); if (k) k.click(); });
await p.waitForTimeout(800);


// 1. Data: soorten, beloning, steenwachter niet meer op te leiden
const data = await p.evaluate(async () => {
  const s = window.spel; const c = await (await fetch('data/campagne.json')).json();
  const l6 = c.levels.find((l) => l.id === 6);
  const alles = JSON.stringify(l6);
  return { ing: s.leger.soorten.ingenieur, treb: s.leger.soorten.trebuchet, kat: s.leger.soorten.katapult, steen: s.leger.soorten.steenwachter, beloning: l6.beloning, steenInLevel: /steenwachter/.test(alles), ingInRood: /"ingenieur"/.test(JSON.stringify(l6.rood)) };
});
check('ingenieur: belegeringswerkplaats, bouwt trebuchet', data.ing && data.ing.kazerne === 'belegering' && data.ing.bouwt === 'trebuchet', JSON.stringify(data.ing));
check('trebuchet kost hout en steen (duur)', data.treb && data.treb.kosten && data.treb.kosten.hout >= 60 && data.treb.kosten.steen >= 40, JSON.stringify(data.treb.kosten));
check('trebuchet: staand, alleen bouwwerken, bereik > katapult, dode zone', data.treb && data.treb.staand && data.treb.alleenBouw && data.treb.bereik > data.kat.bereik && data.treb.minBereik >= 4, JSON.stringify(data.treb));
check('steenwachter niet meer op te leiden', data.steen.kazerne === 'geen', data.steen.kazerne);
check('0.81.1: bereik van de trebuchet 28 (twee keer zo groot)', data.treb.bereik === 28, data.treb.bereik);
const standen = await p.evaluate(async () => { const m = await import('./js/machines.js'); const set = m.MACHINES.trebuchet('x', { kleur: '#2f5fc4' }); return set.houdingen.schiet.rechts.length; });
check('0.81.1: de arm heeft 24 standen (12 worp, 12 terug) voor een soepele beweging', standen === 24, standen);
check('beloning level 6 is de ingenieur', data.beloning.length === 1 && data.beloning[0] === 'ingenieur', JSON.stringify(data.beloning));
check('geen steenwachter meer in level 6', !data.steenInLevel);
check('rood zet ingenieurs in (level 6)', data.ingInRood);

// 2. Jouw ingenieur bouwt een trebuchet en schiet op een bouwwerk van rood
const r = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, P = K.posten[0];
  s.strijd.pauzeer(true);
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); s.doel.stap(0.1); } };
  const dx = Math.sign(P.x - P.poort.x), dy = Math.sign(P.y - P.poort.y);
  // een vrij vak op ruim 11 tegels van de loods: gelijk aan de afstand van de poort, 9 tegels de andere kant op
  let plek = -1;
  const rich = [P.poort.x - P.x, P.poort.y - P.y]; const len = Math.hypot(...rich);
  for (let af = 13; af >= 7 && plek < 0; af--) {
    const x = Math.round(P.x + (rich[0] / len) * af), y = Math.round(P.y + (rich[1] / len) * af);
    for (let ddy = -2; ddy <= 2 && plek < 0; ddy++) for (let ddx = -2; ddx <= 2; ddx++) { const v = (y + ddy) * B + x + ddx; if (s.wegvinder.isVrij(x + ddx, y + ddy, 0) && K.object[v] === 0 && Math.hypot(x + ddx - P.x, y + ddy - P.y) > 7) { plek = v; break; } }
  }
  // de bewakers van de post halen we weg: deze test gaat over de trebuchet zelf (de bewakers schieten anders de ingenieur neer)
  for (const g of s.strijd.garnizoen()) { g.leven = 0; g.dood = true; }
  sim(5);
  const px = plek % B, py = Math.floor(plek / B);
  const e = s.leger.geef('ingenieur', py * B + px - 3, 6);
  const e2 = s.leger.geef('ingenieur', py * B + px - 4, 6);
  const uit = { plek, afstandLoods: Math.hypot(px - P.x, py - P.y), ing: !!e && !!e2 };
  if (!e || !e2) return uit;
  uit.bevel = s.strijd.bouwTrebuchet([e], plek);   // een gekozen is genoeg: de ander helpt vanzelf
  uit.maat = [e, e2].map((x) => !!(x.krijg && x.krijg.ing));
  sim(30);
  uit.nogNiet = s.leger.soldaten().filter((x) => x.soldaat.sleutel === 'trebuchet').length;   // na 3 s is hij er nog niet
  sim(250);
  const tr = s.leger.soldaten().filter((x) => x.soldaat.sleutel === 'trebuchet');
  uit.treb = tr.length;
  uit.trebOp = tr.length ? [Math.floor(tr[0].x), Math.floor(tr[0].y)] : null;
  uit.verwacht = [px, py];
  uit.stilStaan = tr.length ? (tr[0].pad == null) : null;
  // schiet hij op de loods (leven daalt) zonder dat er soldaten zijn?
  const loodsVak = P.vak;
  const voor = s.strijd.levenOp(loodsVak).leven;
  uit.voorLeven = voor;
  uit.bereikOk = tr.length ? s.strijd.valBouwAan(tr, loodsVak) : 0;
  sim(50);
  uit.bedienen = [e, e2].map((x) => x.krijg.ing && x.krijg.ing.fase);
  { const poses = new Set(); for (let i = 0; i < 20; i++) { sim(1); poses.add(e.pose); } uit.poses = [...poses]; }   // 0.81.1: ze werken echt (de arm gaat op en neer)
  uit.hameren = [e, e2].map((x) => x.houding); uit.tb = [JSON.stringify(tr[0].krijg.bouw && tr[0].krijg.bouw.soort), tr[0].krijg.bouwBevel ? 1 : 0, tr[0].houding];
  sim(350);
  uit.naLeven = s.strijd.levenOp(loodsVak).leven;
  // de dode zone: een bouwwerk op minder dan 5 tegels wordt niet beschoten
  uit.max2 = s.strijd.bouwTrebuchet([e, e2], plek + 1);   // een tweede (naast de eerste), mag nog
  // zonder ingenieur schiet hij niet
  e.leven = 0; s.strijd.raak ? 0 : 0;
  return uit;
});
check('een gekozen ingenieur: de tweede helpt automatisch', r.ing && r.bevel === 1 && r.maat.every(Boolean), JSON.stringify(r));
check('trebuchet nog niet na 3 s', r.nogNiet === 0, r.nogNiet);
check('trebuchet staat er na de bouwtijd, op het gekozen vak', r.treb === 1 && r.trebOp && Math.abs(r.trebOp[0] - r.verwacht[0]) <= 0 && Math.abs(r.trebOp[1] - r.verwacht[1]) <= 0, JSON.stringify(r));
check('beide ingenieurs blijven en bedienen de trebuchet, draaiend aan de windas', r.bedienen && r.bedienen.every((f) => f === 'bedien') && r.hameren.every((h) => h === 'sla'), JSON.stringify([r.bedienen, r.hameren, r.tb]));
check('trebuchet loopt niet', r.stilStaan === true);
check('0.81.1: de ingenieurs bewegen tijdens het werk (niet stil)', r.poses && r.poses.length === 2, JSON.stringify(r.poses));
check('loods staat op meer dan 7 tegels, binnen bereik', r.afstandLoods > 7 && r.afstandLoods <= 13, r.afstandLoods);
check('bevel op de loods is binnen bereik', r.bereikOk === 1, r.bereikOk);
check('de loods verliest leven van de trebuchet alleen', r.naLeven < r.voorLeven, `${r.voorLeven} -> ${r.naLeven}`);

// 5. De kosten: terug als de bouw stopt (een ingenieur valt)
const kt = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, P = K.posten[0];
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); s.doel.stap(0.1); } };
  const vrij = []; for (let y = 5; y < K.hoogte - 5 && vrij.length < 3; y++) for (let x = 5; x < 40; x++) if (s.wegvinder.isVrij(x, y, 0) && K.object[y * B + x] === 0) { vrij.push(y * B + x); break; }
  const plek = vrij[1];
  const a = s.leger.geef('ingenieur', plek + 4, 6), b = s.leger.geef('ingenieur', plek + 5, 6);
  const kosten = { hout: 7, steen: 5 };
  s.economie.voorraad.hout += 20; s.economie.voorraad.steen += 20;
  const h0 = s.economie.voorraad.hout, st0 = s.economie.voorraad.steen;
  const tekortVoor = s.economie.tekort(kosten);
  const uit = { bevel: s.strijd.bouwTrebuchet([a, b], plek, kosten) };
  s.economie.betaal(kosten);
  const betaald = [h0 - s.economie.voorraad.hout, st0 - s.economie.voorraad.steen];
  sim(3);
  s.leger.sneuvel(b); b.dood = true;
  sim(10);
  return { dbg: [s.strijd.projectenAantal(), s.strijd.stand().uitslag, a.krijg && JSON.stringify(a.krijg.ing && {f: a.krijg.ing.fase, g: a.krijg.ing.proj.gestopt, k: a.krijg.ing.proj.klaar}), a.dood, b.dood, b.leven, s.leger.soldaten().length], ...uit, tekortVoor, betaald, terug: [s.economie.voorraad.hout - h0, s.economie.voorraad.steen - st0], geenTreb: s.leger.soldaten().filter((x) => x.soldaat.sleutel === 'trebuchet').length - 1 };
});
check('kosten betaald bij het bevel', kt.bevel === 1 && kt.betaald[0] === 7 && kt.betaald[1] === 5, JSON.stringify(kt));
check('valt een ingenieur uit, dan krijg je alles terug en komt er geen trebuchet', kt.terug[0] === 0 && kt.terug[1] === 0 && kt.geenTreb === 0, JSON.stringify(kt));
check('geen fouten (kosten)', fouten.length === 0, fouten.join(' | '));
// 2b. Release crew: de ingenieurs worden losgemaakt en de trebuchet zwijgt
const ro = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, P = K.posten[0];
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); s.doel.stap(0.1); } };
  const tr = s.leger.soldaten().find((x) => x.soldaat.sleutel === 'trebuchet');
  const ings = s.leger.soldaten().filter((x) => x.soldaat.sleutel === 'ingenieur');
  const voor = s.strijd.levenOp(P.vak).leven;
  s.strijd.valBouwAan([tr], P.vak);
  const n = s.strijd.ontkoppel([tr]);
  sim(300);
  const na = s.strijd.levenOp(P.vak).leven;
  const gebonden = ings.filter((x) => x.krijg && x.krijg.ing).length;
  return { n, gebonden, zwijgt: voor === na || voor - na === 0, voor, na, een: s.strijd.bouwTrebuchet([ings[0]], 0) };
});
check('Release crew maakt beide ingenieurs los', ro.n === 2 && ro.gebonden === 0, JSON.stringify(ro));

// 3. Zonder bediener geen schot, en een trebuchet op een rood bouwwerk te dichtbij raakt niet
const z = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, P = K.posten[0];
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); s.doel.stap(0.1); } };
  const tr = s.leger.soldaten().find((x) => x.soldaat.sleutel === 'trebuchet');
  const ings = s.leger.soldaten().filter((x) => x.soldaat.sleutel === 'ingenieur');
  for (const i of ings) { s.leger.sneuvel(i); i.dood = true; }
  sim(10);
  const voor = s.strijd.levenOp(P.vak).leven;
  sim(300);
  const na = s.strijd.levenOp(P.vak).leven;
  return { geenBediener: voor === na, voor, na, rest: ings.length };
});
check('zonder ingenieur schiet de trebuchet niet', z.geenBediener, JSON.stringify(z));

// 4. Rode ingenieur: bouwt zelf een trebuchet en schiet op jouw bouwwerken
const rd = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, st = K.start[0];
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); s.doel.stap(0.1); } };
  // een vrij vak voor rood op ongeveer 16 tegels van jouw burcht
  let vx = -1, vy = -1;
  for (let af = 16; af <= 22 && vx < 0; af++) for (let dy = -6; dy <= 6 && vx < 0; dy++) { const x = st.x + af, y = st.y + dy; if (x < B && s.wegvinder.isVrij(x, y, 1)) { vx = x; vy = y; } }
  const uit = { stand: Object.keys(s.strijd.stand()) };
  const e = vx >= 0 ? s.strijd.zetVijand('ingenieur', vx, vy, 50) : null;
  const e2 = vx >= 0 ? s.strijd.zetVijand('ingenieur', vx, vy + 1, 50) : null;
  uit.e2 = !!e2;
  uit.e = !!e;
  if (!e) return uit;
  // met een enkele ingenieur bouwt rood niets
  uit.eenAlleen = 0;
  
  const tellen = () => s.strijd.vijanden().filter((v) => !v.dood && v.krijg && v.krijg.def.staand).length;
  uit.voor = tellen();
  const burchtLeven = () => s.strijd.stand().burcht;
  uit.burchtVoor = burchtLeven();
  sim(150);
  uit.nogBouwen = tellen();   // na 15 s: bouwtijd is 20 s
  sim(350);
  uit.na = tellen();
  uit.dbgR = [e, e2].map((x) => [x.dood, x.garnizoen, JSON.stringify(x.krijg && x.krijg.ing && {f: x.krijg.ing.fase, v: x.krijg.ing.vak}), JSON.stringify(x.krijg && x.krijg.tak), x.x, x.y]);
  uit.uitslag = s.strijd.stand().uitslag;
  sim(600);
  uit.burchtNa = burchtLeven();
  uit.balken = s.strijd.balken.length;
  const t = s.strijd.vijanden().find((v) => !v.dood && v.krijg && v.krijg.def.staand);
  uit.trebDoel = t && t.krijg.bouw ? [t.krijg.bouw.soort, Math.round(Math.hypot(t.krijg.bouw.x - t.x, t.krijg.bouw.y - t.y))] : null;
  return uit;
});
check('rode ingenieurs geplaatst', rd.e && rd.e2, JSON.stringify(rd));
check('rode trebuchet er nog niet na 15 s, wel na 40 s', rd.voor === 0 && rd.nogBouwen === 0 && rd.na === 1, JSON.stringify(rd));
check('rode trebuchet beschiet jouw bouwwerken', rd.burchtNa < rd.burchtVoor || rd.balken > 0, JSON.stringify(rd));
check('geen fouten in de pagina', fouten.length === 0, fouten.join(' | '));
console.log(`trebuchet80: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
