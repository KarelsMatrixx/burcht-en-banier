// 0.78.5: level 6 (De Reuzenrug): elke bouwloods staat in een versterkte buitenpost, ver van het kasteel van rood.
// Controle: vorm van de posten, bewakers, bereikbaarheid, werven als decor, en een echte aanval met katapulten.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8263;
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

const info = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, rood = K.start[1];
  const ring = (p) => {
    const t = { MUUR: 0, TOREN: 0, WACHTTOREN: 0, POORT: 0, anders: 0, vanRood: 0 };
    for (let dy = -p.maat; dy <= p.maat; dy++) for (let dx = -p.maat; dx <= p.maat; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== p.maat) continue;
      const i = (p.y + dy) * B + p.x + dx;
      const naam = { 4: 'MUUR', 5: 'TOREN', 10: 'WACHTTOREN', 6: 'POORT' }[K.object[i]] || 'anders';
      t[naam]++;
      if (K.eigenaar[i] === 2) t.vanRood++;
    }
    return t;
  };
  const g = s.strijd.garnizoen();
  const per = (p) => g.filter((e) => Math.max(Math.abs(Math.floor(e.x) - p.x), Math.abs(Math.floor(e.y) - p.y)) <= p.maat + 3).length;
  let j = -1; const st = K.start[0];
  for (let r = 2; r < 9 && j < 0; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (j < 0 && s.wegvinder.isVrij(st.x + dx, st.y + dy, 0)) j = (st.y + dy) * B + st.x + dx;
  return {
    posten: K.posten,
    ringen: K.posten.map(ring),
    afstand: K.posten.map((p) => Math.max(Math.abs(p.x - rood.x), Math.abs(p.y - rood.y))),
    loodsen: s.doel.loodsen(),
    loodsOp: s.doel.loodsen().map((v) => [K.object[v], K.eigenaar[v]]),
    garn: g.length,
    garnPerPost: K.posten.map(per),
    erf: K.posten.map((p) => { let n = 0; for (let dy = -p.maat + 1; dy <= p.maat - 1; dy++) for (let dx = -p.maat + 1; dx <= p.maat - 1; dx++) if (K.object[(p.y + dy) * B + p.x + dx] === 0) n++; return n; }),
    voorPoort: K.posten.map((p) => { const dx = Math.sign(p.poort.x - p.x), dy = Math.sign(p.poort.y - p.y); return s.wegvinder.verbonden(j, (p.poort.y + dy * 2) * B + p.poort.x + dx * 2, 0); }),
    gateRichting: K.posten.map((p) => Math.hypot(st.x - p.poort.x, st.y - p.poort.y) < Math.hypot(st.x - p.x, st.y - p.y)),
    wervenDecor: (() => { let n = 0; for (let i = 0; i < B * K.hoogte; i++) if ([35, 44, 45, 46, 47].includes(K.object[i]) && K.eigenaar[i] === 0) n++; return n; })(),
    leven: s.strijd.schadeOp ? s.doel.loodsen().map((v) => s.strijd.schadeOp(v)) : null,
    verbonden: K.verbonden,
  };
});
check('twee posten', info.posten.length === 2, JSON.stringify(info.posten));
check('elke post: muur van 24 stukken, 4 torens, 3 wachttorens, 1 poort, allemaal van rood', info.ringen.every((r) => r.TOREN === 4 && r.WACHTTOREN === 3 && r.POORT === 1 && r.MUUR === 16 && r.anders === 0 && r.vanRood === 24), JSON.stringify(info.ringen));
check('posten staan ver van het kasteel van rood (minstens 18 tegels)', info.afstand.every((a) => a >= 18), info.afstand.join());
check('de loodsen staan midden in de posten', info.loodsen.every((v, i) => v === info.posten[i].vak) && info.loodsOp.every(([o, e]) => o === 29 && e === 2), JSON.stringify(info.loodsOp));
check('elke post heeft een garnizoen (minstens 12 man)', info.garnPerPost.every((n) => n >= 12) && info.garn >= 24, JSON.stringify([info.garn, info.garnPerPost]));
check('erf is grotendeels vrij voor het garnizoen', info.erf.every((n) => n >= 18), info.erf.join());
check('stuk voor de poort is voor jou bereikbaar', info.voorPoort.every(Boolean), info.voorPoort.join());
check('poort kijkt naar jouw kant', info.gateRichting.every(Boolean), info.gateRichting.join());
check('werven als decor (kranen, werkbanken, houtstapels, rammen, steenhouwers)', info.wervenDecor >= 12, info.wervenDecor);
check('kaart blijft verbonden', info.verbonden === true);
check('loods heeft veel leven', Array.isArray(info.leven) ? info.leven.every((l) => l >= 900) : true, JSON.stringify(info.leven));

// De garnizoenen tellen niet mee als aanvaller van jouw burcht.
const aanv = await p.evaluate(() => window.spel.strijd.vijanden().filter((e) => !e.garnizoen && !e.koning && e.wachter === undefined && !e.lijfwacht).length);
check('garnizoen telt niet mee als aanvaller', aanv === 0, aanv);

// Een aanval: een leger loopt naar post 1, katapulten slopen de loods (achter de muur), rammen de poort.
const aanval = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte;
  s.strijd.pauzeer(true);
  const sim = (n) => { for (let i = 0; i < n; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); s.poortwacht.stap(); s.doel.stap(0.1); } };
  const P = K.posten[0];
  const gx = P.poort.x - 8, gy = P.poort.y;
  const lijst = []; let k = 0;
  const plaats = (soort, n) => { for (let i = 0; i < n; i++, k++) lijst.push([soort, gx - (k % 8), gy - 4 + Math.floor(k / 8), 60, 0]); };
  plaats('ridder', 30); plaats('bijlridder', 10); plaats('boogschutter', 12); plaats('ram', 3); plaats('katapult', 4);
  s.leger.zetStand(lijst);
  const per = (sl) => s.leger.soldaten().filter((e) => e.soldaat.sleutel === sl);
  s.leger.kies(s.leger.soldaten());
  s.leger.stuur(P.poort.x - 3, P.poort.y, false);
  sim(60);
  const poortVak = P.poort.y * B + P.poort.x;
  const uit = { direct: s.strijd.valBouwAan(per('ridder'), P.vak) };   // zonder weg naar binnen: geen bevel voor het zwaardvolk
  uit.poort = s.strijd.valBouwAan(per('ram').concat(per('ridder'), per('bijlridder')), poortVak);
  uit.kat = s.strijd.valBouwAan(per('katapult'), P.vak);
  let t = 0;
  while (K.object[P.vak] === 29 && t < 3000) { sim(10); t += 10; }
  uit.tijd = t / 10;
  sim(15);   // het doel kijkt elke halve seconde wie er gevallen is
  uit.loodsWeg = K.object[P.vak] !== 29;
  uit.over = s.leger.soldaten().length;
  uit.gevallen = s.doel.gevallen().length;
  uit.uitslag = s.strijd.uitslag();
  return uit;
});
check('zwaardvolk kan niet direct op de loods achter de muur', aanval.direct === 0, aanval.direct);
check('rammen en ridders krijgen een bevel op de poort', aanval.poort > 0, aanval.poort);
check('katapulten kunnen de loods over de muur beschieten', aanval.kat > 0, aanval.kat);
check('de loods valt (binnen 5 minuten)', aanval.loodsWeg && aanval.tijd < 300, JSON.stringify(aanval));
check('het duurt een tijd (niet in een paar seconden)', aanval.tijd >= 25, aanval.tijd);
check('een loods gevallen: level nog niet gewonnen', aanval.gevallen === 1 && !aanval.uitslag, JSON.stringify(aanval));

check('geen pagina-fouten', fouten.length === 0, fouten.join('|'));
console.log(`posten79: ${ok} goed, ${fout} fout`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
