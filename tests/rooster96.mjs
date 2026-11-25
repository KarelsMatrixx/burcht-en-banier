// Versie 0.96.0: aanvalsrooster in Greyford (level 7): geen sparen, soorten aanval, formatie, uitval.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8286'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const fouten = []; let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
let p;
async function start(l) {
  if (p) await p.context().close();
  p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  p.on('pageerror', (e) => fouten.push(String(e)));
  await p.goto('http://localhost:8286/'); await p.waitForFunction(() => window.spel && window.spel.strijd);
  await p.evaluate((l) => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0, 1, 2, 3, 4, 5, 6] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: l })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, l);
  await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd); await p.waitForTimeout(400);
}
await start(7);
const a = await p.evaluate(() => {
  const s = window.spel; const v = s.veld; const st = s.rood.stand();
  const uit = { rooster: !!v.rooster(), stand: st.rooster, doel: st.doel };
  uit.soorten = {};
  for (const soort of ['bestorming', 'belegering', 'overval', 'brand', 'schijn', 'koningsmoord']) uit.soorten[soort] = v.samenstelling(soort, 24, 4);
  uit.eerste = v.kiesSoort(1);
  const vroeg = new Set(); for (let i = 0; i < 40; i++) vroeg.add(v.kiesSoort(2));
  uit.vroeg = [...vroeg];
  uit.g1 = v.aanvalsGrootte(1); uit.g4 = v.aanvalsGrootte(4);
  const ro = v.rooster(); uit.met = [1, 2, 3, 4].map((n) => v.aanvalsGrootte(n)); const bf = ro.beginFactor; ro.beginFactor = null; uit.zonder = [1, 2, 3, 4].map((n) => v.aanvalsGrootte(n)); ro.beginFactor = bf;
  return uit;
});
console.log('aanvalsgrootte met/zonder beginFactor', JSON.stringify([a.met, a.zonder]));
check('eerste drie aanvallen ongeveer de helft', [0, 1, 2].every((k) => a.met[k] <= Math.max(4, Math.ceil(a.zonder[k] * 0.55))) && a.met[3] === a.zonder[3], JSON.stringify([a.met, a.zonder]));
check('Greyford heeft een aanvalsrooster', a.rooster && a.stand && a.stand.volgende > 0, JSON.stringify(a.stand));
check('geen sparen: rood koopt alleen een kleine reserve voor uitvallen', a.doel <= 12, a.doel);
check('bestorming: ladders en een ram', a.soorten.bestorming.ladder >= 1 && a.soorten.bestorming.ram >= 1, JSON.stringify(a.soorten.bestorming));
check('belegering: katapulten', a.soorten.belegering.katapult >= 1, JSON.stringify(a.soorten.belegering));
check('overval: ruiters', a.soorten.overval.ruiter >= 4, JSON.stringify(a.soorten.overval));
check('brand: vlammenwevers', a.soorten.brand.vlammenwever >= 2, JSON.stringify(a.soorten.brand));
check('koningsmoord: sluipmoordenaars en ladders', a.soorten.koningsmoord.sluipmoordenaar >= 3 && a.soorten.koningsmoord.ladder >= 2, JSON.stringify(a.soorten.koningsmoord));
check('de eerste aanval is een bestorming', a.eerste === 'bestorming', a.eerste);
check('aanval 2 is nooit een koningsmoord', !a.vroeg.includes('koningsmoord'), JSON.stringify(a.vroeg));
check('aanvallen lopen op (aanval 4 groter dan aanval 1)', a.g4 > a.g1, JSON.stringify([a.g1, a.g4]));
// De balk toont de klok met de soort; 40 s vooraf een waarschuwing; de aanval komt op tijd.
const b2 = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(false);
  const kort0 = document.querySelector('#strijd-kort, .strijd-kort, [data-strijd-kort]') ? 1 : 0;
  const v0 = s.rood.stand().rooster.volgende;
  let golf = 0, warn = false;
  for (let i = 0; i < (v0 + 5) * 10; i++) { s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap(); if (!warn && s.ui.logboek().some((r) => /Scouts report|Riders spotted/.test(r.tekst))) warn = s.rood.stand().rooster.volgende; golf = s.strijd.stand().golf || 0; if (golf) break; }
  return { v0, golf, warn, kort0, groepen: s.veld.groepen().map((g) => g.fase) };
});
check('40 s vooraf een waarschuwing van de verkenners', b2.warn !== false && b2.warn <= 40 && b2.warn >= 35, JSON.stringify(b2));
check('de aanval komt op tijd volgens het rooster', b2.golf === 1, JSON.stringify(b2));
check('de aanval gaat eerst verzamelen', b2.groepen.includes('verzamel'), JSON.stringify(b2));
// Formatie: voetvolk vooraan op het verzamelpunt, schutters achteraan.
const f = await p.evaluate(() => {
  const s = window.spel; const B = s.kaart.breedte;
  const g = s.veld.groepen().find((x) => x.hoofd); if (!g) return null;
  const v = s.strijd.vijanden().filter((e) => e.krijg && e.krijg.tak && e.krijg.tak.groep === g.id && e.krijg.tak.verzamel >= 0);
  const d = (e) => { const t = e.krijg.tak.verzamel; return Math.hypot(t % B + 0.5 - g.eind.x, Math.floor(t / B) + 0.5 - g.eind.y); };
  const R = s.regels.soldaten;
  const voet = v.filter((e) => !(R[e.vijand].bereik > 2) && !R[e.vijand].alleenBouw && !R[e.vijand].ladder && !R[e.vijand].steun).map(d);
  const sch = v.filter((e) => R[e.vijand].bereik > 2 && !R[e.vijand].alleenBouw).map(d);
  return { voet: voet.length ? voet.reduce((a, c) => a + c, 0) / voet.length : 0, sch: sch.length ? sch.reduce((a, c) => a + c, 0) / sch.length : 0, n: v.length };
});
check('formatie: voetvolk staat dichter bij het doel dan de schutters', f && f.voet > 0 && f.sch > f.voet, JSON.stringify(f));
// Zijpas en uitval
const z = await p.evaluate(() => {
  const s = window.spel; const r = s.strijd.roodKoning(); const zi = s.veld.zijIngang(12);
  // een schutter van jou vlak onder muur 1 van rood: dan is er een uitvalpunt
  let vak = -1; const K = s.kaart; const B = K.breedte;
  for (let y = 66; y < 72 && vak < 0; y++) for (let x = 10; x < 44 && vak < 0; x++) if (s.wegvinder.isVrij(x, y, 0)) vak = y * B + x;
  const oud = s.leger.lijst.filter((e) => e.soldaat).map((e) => [e.soldaat.sleutel, Math.floor(e.x), Math.floor(e.y), e.leven]);
  s.leger.zetStand([...oud, ['boogschutter', vak % B, Math.floor(vak / B), 999]]);
  return { zi, up: s.veld.uitvalPunt() };
});
check('er is een ingang langs de rotswand voor overvallers', !!z.zi, JSON.stringify(z.zi));
check('een schutter onder de muur van rood geeft een uitvalpunt', !!z.up, JSON.stringify(z.up));
// Andere levels houden het oude systeem
await start(5);
const o = await p.evaluate(() => ({ rooster: !!window.spel.veld.rooster(), stand: window.spel.rood.stand().rooster }));
check('level 5 heeft (nog) geen rooster', !o.rooster && !o.stand, JSON.stringify(o));
check('geen paginafouten', fouten.length === 0, fouten.join('|'));
console.log('rooster96:', ok, 'goed,', fout, 'fout');
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
