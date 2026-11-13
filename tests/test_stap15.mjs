import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const url = process.argv[2];
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await b.newPage({ viewport: { width: 844, height: 390 } });
await p.addInitScript(() => { try { sessionStorage.setItem('burcht-banier.geenTitel', '1'); } catch (e) {} });
const fouten = [];
p.on('pageerror', (e) => fouten.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error') fouten.push(m.text()); });
let ok = 0, fout = 0;
const check = (naam, waar, extra = '') => { if (waar) ok++; else { fout++; console.log('FOUT:', naam, extra); } };
await p.goto(url + '/?x=' + Date.now());
await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.evaluate(() => { localStorage.clear(); });
await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd);
// tijd stilzetten van de echte lus: we spoelen zelf
const r = await p.evaluate(() => {
  const s = window.spel;
  const st = s.strijd.stand();
  return { v: s.CONFIG.versie, heer: !!st.heer, werken: st.heer && st.heer.werkenTotaal, golf: st.golf, w: s.rood.werken() };
});
check('versie', r.v === '0.36.0', r.v);
check('heer aanwezig', r.heer);
check('3 werken', r.werken === 3, r.werken);
const spoel = (sec) => p.evaluate((sec) => { const s = window.spel; for (let i = 0; i < sec * 10; i++) s.strijd.stap(); return s.strijd.stand(); }, sec);
let st = await spoel(60);
check('voorraad groeit', st.heer.voorraad.hout > 10 || st.heer.voorraad.steen > 10, JSON.stringify(st.heer.voorraad));
check('koopt soldaten', st.heer.aantal > 0, JSON.stringify(st.heer));
check('nog geen aanval na 60s', st.golf === 0);
st = await spoel(120);
check('nog geen aanval voor 200s', st.golf === 0, JSON.stringify(st.heer));
st = await spoel(40);
check('aanval na ruim 200s', st.golf === 1 && st.vijanden > 0, `golf ${st.golf} vijanden ${st.vijanden} ` + JSON.stringify(st.heer));
check('reserve na aanval kleiner dan voor de aanval', st.heer.aantal < 10, JSON.stringify(st.heer));
console.log('na aanval 1:', JSON.stringify(st.heer));
// tweede aanval niet eerder dan 70 s
st = await spoel(20);
check('geen tweede aanval binnen 100s', st.golf === 1, st.golf);
// werken slopen -> inkomen daalt
const inkomenVoor = (await p.evaluate(() => window.spel.strijd.stand().heer.inkomen));
const sl = await p.evaluate(() => {
  const s = window.spel; const k = s.kaart; const v = s.rood.werken()[0];
  s.strijd.zetVijand; k.object[v] = 0; k.eigenaar[v] = 0; s.strijd.kaartVeranderd();
  return s.strijd.stand().heer;
});
check('werk weg: werken 2', sl.werken === 2, JSON.stringify(sl));
check('inkomen lager', sl.inkomen.hout + sl.inkomen.steen + sl.inkomen.goud < inkomenVoor.hout + inkomenVoor.steen + inkomenVoor.goud);
// herbouw: geef steen/hout, spoel
await p.evaluate(() => { const s = window.spel; s.rood.zetVoorraad('hout', 100); s.rood.zetVoorraad('steen', 100); });
st = await spoel(10);
check('rood herbouwt zijn werk', st.heer.werken === 3, JSON.stringify(st.heer));
// muurstuk vernielen en herbouwen
const muur = await p.evaluate(() => {
  const s = window.spel; const k = s.kaart; const m = s.strijd.rood();
  const vak = (m.y - 5) * k.breedte + m.x; // een stuk ringmuur (boven)
  return { vak, soort: k.object[vak], eig: k.eigenaar[vak] };
});
console.log('muurvak', JSON.stringify(muur));
await p.evaluate((vak) => { const s = window.spel; s.kaart.object[vak] = 0; s.kaart.eigenaar[vak] = 0; s.strijd.kaartVeranderd(); s.wegvinder.herbereken(); }, muur.vak);
check('roodWeg bevat vak', await p.evaluate((vak) => window.spel.strijd.roodWeg().includes(vak), muur.vak));
await spoel(10);
const na = await p.evaluate((vak) => ({ o: window.spel.kaart.object[vak], e: window.spel.kaart.eigenaar[vak] }), muur.vak);
check('muur hersteld', na.o === muur.soort && na.e === 2, JSON.stringify(na));
// herbouw wacht als soldaat van jou vlakbij staat
await p.evaluate((vak) => { const s = window.spel; s.kaart.object[vak] = 0; s.kaart.eigenaar[vak] = 0; s.strijd.kaartVeranderd(); }, muur.vak);
// uitval: soldaat van jou bij de burcht van rood
await p.evaluate(() => { const s = window.spel; const m = s.strijd.rood(); s.rood.zetReserve({ ridder: 3 }); s.leger.zetStand([['ridder', Math.floor(m.x) - 5, Math.floor(m.y) + 5, 60, 0]]); });
console.log('soldaten:', await p.evaluate(() => window.spel.leger.aantal()));
const voorU = (await p.evaluate(() => window.spel.strijd.stand())).vijanden;
st = await spoel(3);
console.log('uitval-debug', voorU, JSON.stringify(st), await p.evaluate(() => JSON.stringify([window.spel.leger.lijst.map((e)=>[e.x,e.y]), window.spel.strijd.rood()])));
check('uitval: reserve is vertrokken', st.heer.aantal < 3, st.heer.aantal);
// bewaren en terugzetten
await p.evaluate(() => { const s = window.spel; s.rood.zetReserve({ ridder: 2, boogschutter: 1 }); s.rood.zetVoorraad('goud', 55); });
const bew = await p.evaluate(() => window.spel.strijd.bewaarStand().heer);
await p.evaluate((b) => { const s = window.spel; s.rood.zetReserve({}); s.rood.zetVoorraad('goud', 0); s.rood.zet(b); }, bew);
const terug = await p.evaluate(() => window.spel.strijd.stand().heer);
check('bewaren: reserve terug', terug.reserve.ridder === 2 && terug.reserve.boogschutter === 1, JSON.stringify(terug));
check('bewaren: goud terug', terug.voorraad.goud === 55, terug.voorraad.goud);
// opnieuw beginnen
await p.evaluate(() => window.spel.strijd.herstel());
const nul = await p.evaluate(() => window.spel.strijd.stand());
check('herstel: golf 0 en begin voorraad', nul.golf === 0 && nul.heer.aantal === 0 && nul.heer.werken === 3, JSON.stringify(nul.heer));
// schema van aanvallen zonder speler: tijd en samenstelling
const schema = await p.evaluate(() => {
  const s = window.spel; s.strijd.herstel(); const uit = []; let vorig = 0; let t = 0;
  for (let i = 0; i < 10 * 1500; i++) {
    s.strijd.stap(); t += 0.1;
    const g = s.strijd.stand().golf;
    if (g !== vorig) { vorig = g; const soorten = {}; for (const v of s.strijd.vijanden()) soorten[v.vijand] = (soorten[v.vijand] || 0) + 1; uit.push([g, Math.round(t), JSON.stringify(soorten)]); for (const v of s.strijd.vijanden()) v.dood = true; s.strijd.stap(); }
    if (s.strijd.uitslag()) break;
  }
  return uit;
});
console.log('schema (aanval, seconde, samenstelling):'); for (const r of schema) console.log(' ', r.join(' | '));
check('minstens 6 aanvallen in 25 min', schema.length >= 6, schema.length);
check('ram pas vanaf aanval 4', schema.every(([g, , sm]) => g >= 4 || !sm.includes('ram')) && schema.some(([g, , sm]) => g >= 4 && sm.includes('ram')));
// geen kapotte JSON in opslag, geen fouten
const echt = fouten.filter((f) => !/404/.test(f)); check('geen paginafouten (sw.js 404 telt niet)', echt.length === 0, echt.join(' | '));
console.log(`ok ${ok}, fout ${fout}`);
await b.close();
