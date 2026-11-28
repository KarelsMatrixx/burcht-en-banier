// 0.106.0: haven in level 8 (havenles, kopen, verkopen, 2 minuten), hopboerderij en kroeg.
// node tests/haven106.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';

const POORT = 8316;
const srv = spawn('python3', ['-m', 'http.server', String(POORT)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
let goed = 0;
let fout = 0;
const check = (naam, ok, extra = '') => { console.log(`${ok ? 'GOED' : 'FOUT'} ${naam} ${extra}`); ok ? goed++ : fout++; };
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' });
const p = await ctx.newPage();
const fouten = [];
p.on('pageerror', (e) => fouten.push(e.message));
const zichtbaar = (sel) => p.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && !!(e.offsetWidth || e.offsetHeight) && !e.closest('[hidden]'); }, sel);
const tikOp = async (sel) => { const r = await p.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; }, sel); await p.touchscreen.tap(r.x, r.y); await p.waitForTimeout(350); };
const wachtTot = async (fn, ms = 8000, arg) => { try { await p.waitForFunction(fn, arg, { timeout: ms }); return true; } catch { return false; } };

async function startLevel(n, klaar) {
  await p.goto(`http://localhost:${POORT}/`);
  await p.waitForFunction(() => window.spel);
  await p.evaluate(([m, k]) => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: k })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: m })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [n, klaar]);
  await p.reload();
  await p.waitForFunction(() => window.spel && window.spel.strijd);
  await wachtTot(() => { const v = document.getElementById('verhaalbeeld-verder'); return document.getElementById('verhaalbeeld').hidden || (v && !v.hidden); }, 20000);
  if (await zichtbaar('#verhaalbeeld-verder')) await tikOp('#verhaalbeeld-verder');
  await wachtTot(() => document.getElementById('verhaalbeeld').hidden, 5000);
  await p.waitForTimeout(400);
  if (await zichtbaar('#missie-begin')) await tikOp('#missie-begin');
  await p.waitForTimeout(500);
  // eventuele berichten van de heer wegtikken
  for (let k = 0; k < 4; k++) { if (await zichtbaar('#verhaal')) { await p.evaluate(() => window.spel.ui.verbergVerhaal()); await p.waitForTimeout(250); } }
  await p.evaluate(() => window.spel.heldenLes && window.spel.heldenLes.sla());   // heldenles (0.125.0) overslaan
}

await startLevel(8, [0, 1, 2, 3, 4, 5, 6, 7]);
check('geen fouten bij start', fouten.length === 0, fouten.join(' | '));
// Kaart: havenbekken bij jou en een rode haven
const kaartInfo = await p.evaluate(() => {
  const K = window.spel.kaart;
  const s = K.start[0];
  let water = 0;
  for (let y = s.y - 14; y <= s.y + 14; y++) for (let x = s.x - 14; x <= s.x + 14; x++) if (x >= 0 && y >= 0 && x < K.breedte && y < K.hoogte && K.grond[y * K.breedte + x] === 3) water++;
  let roodHaven = 0;
  for (let i = 0; i < K.object.length; i++) if (K.object[i] === 52) roodHaven++;
  let totaal = 0;
  for (let i = 0; i < K.grond.length; i++) if (K.grond[i] === 3) totaal++;
  return { water, roodHaven, totaal, verbonden: K.verbonden };
});
check('water binnen je bouwgebied', kaartInfo.water > 20, JSON.stringify(kaartInfo));
check('rode havens als decor (veel)', kaartInfo.roodHaven >= 6, String(kaartInfo.roodHaven));
check('twee eilanden: geen land tussen de burchten', kaartInfo.verbonden === false);
check('Port in het bouwmenu ontgrendeld', await p.evaluate(() => !!document.querySelector('#bouw-knoppen [data-sleutel="haven"]')));
check('kroeg nog niet in level 8', await p.evaluate(() => !document.querySelector('#bouw-knoppen [data-sleutel="kroeg"]')));

// 1. kaartje van Bartholt, de oorlog staat stil
check('havenles: kaartje', await wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 6000));
const klok1 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand()));
await p.waitForTimeout(1500);
const klok2 = await p.evaluate(() => JSON.stringify(window.spel.strijd.stand()));
check('oorlog staat stil tijdens de les', klok1 === klok2);
await tikOp('#gids-kaart button');
check('havenles: bouwdoel haven met plek', await p.evaluate(() => { const d = window.spel.gids.doel(); return d && d.soort === 'bouw' && d.sleutel === 'haven' && !!d.plek; }));
// 2. bouwen via de knoppen
await tikOp('#knop-hamer');
const groep = await p.evaluate(() => { const k = document.querySelector('#bouw-knoppen [data-sleutel="haven"]'); return k && k.dataset.groep; });
if (groep && await zichtbaar(`#bouw-knoppen [data-open="${groep}"]`)) await tikOp(`#bouw-knoppen [data-open="${groep}"]`);
await tikOp('#bouw-knoppen [data-sleutel="haven"]');
const plek = await p.evaluate(() => window.spel.gids.doel().plek);
// camera naar de plek en dan op de gouden ruit tikken
await p.evaluate(({ x, y }) => { const c = window.spel.camera; const w = { x: (x + 0.5 - (y + 0.5)) * 32, y: (x + 0.5 + y + 0.5) * 16 }; c.kijkNaar(w.x, w.y); }, plek);
await p.waitForTimeout(600);
await tikOp('#gids-plek');
if (await p.evaluate(() => document.getElementById('knop-hamer').classList.contains('plaats'))) await tikOp('#knop-hamer');
await p.waitForTimeout(500);
const gebouwd = await p.evaluate(({ x, y }) => window.spel.kaart.object[y * window.spel.kaart.breedte + x] === 52 && window.spel.kaart.eigenaar[y * window.spel.kaart.breedte + x] === 1, plek);
check('haven gebouwd op de gouden plek', gebouwd, JSON.stringify(plek));
if (!gebouwd) await p.evaluate(({ x, y }) => { window.spel.bouwer.plaats ? window.spel.bouwer.plaats(window.spel.bouwwerken.haven, [{ x, y }]) : null; }, plek);
check('havenles: kaartje 2', await wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 6000));
await p.screenshot({ path: '/home/claude/werk/h-gebouwd.png' });
await tikOp('#gids-kaart button');
// 3. de haven aantikken
await p.waitForTimeout(400);
await tikOp('#gids-plek');
check('havenpaneel open', await zichtbaar('#havenpaneel'));
await p.screenshot({ path: '/home/claude/werk/h-paneel.png' });
const voor = await p.evaluate(() => ({ hout: window.spel.economie.voorraad.hout, goud: window.spel.economie.voorraad.goud }));
await tikOp('[data-haven="goed:hout"]');
const gekozen = await p.evaluate(() => ({ goud: window.spel.economie.voorraad.goud, order: (window.spel.haven.havens().find((h) => !h.rood) || {}).order }));
check('goed kiezen bestelt nog niets', gekozen.goud === voor.goud && !gekozen.order, JSON.stringify(gekozen));
check('bevestigknop toont de prijs', /Buy for 6 gold/.test(await p.textContent('#haven-bevestig')), await p.textContent('#haven-bevestig'));
await p.screenshot({ path: '/tmp/haven-bord.png' });
await tikOp('[data-haven="bevestig"]');
const na = await p.evaluate(() => ({ hout: window.spel.economie.voorraad.hout, goud: window.spel.economie.voorraad.goud, havens: window.spel.haven.havens().map((h) => ({ rood: h.rood, order: h.order })) }));
const eigen = na.havens.find((h) => !h.rood);
check('bestelling geplaatst, goud betaald', eigen && eigen.order && eigen.order.soort === 'koop' && na.goud === voor.goud - 6, JSON.stringify({ voor, na }));
check('havenles: slotkaartje', await wachtTot(() => { const k = document.getElementById('gids-kaart'); return k && !k.hidden; }, 6000));
await p.waitForTimeout(3000);
await p.screenshot({ path: '/home/claude/werk/h-vaart.png' });
await p.screenshot({ path: '/home/claude/werk/h-slot.png' });
console.log(await p.evaluate(() => { const b = document.querySelector('#gids-kaart button').getBoundingClientRect(); const e = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return e && (e.id || e.className || e.tagName); }));
await tikOp('#gids-kaart button');
check('havenles klaar, oorlog loopt weer', await p.evaluate(() => window.spel.havenLes ? window.spel.havenLes.klaar() : true));
// Tweede bestelling op dezelfde haven kan niet
const tweede = await p.evaluate(() => { const h = window.spel.haven.havens().find((x) => !x.rood); return window.spel.haven.bestel(h.vak, 'koop', 'steen', 1); });
check('een schip tegelijk', /still at sea/.test(tweede), tweede);
// Snel vooruit: 120 s
await p.evaluate(() => window.spel.haven.stap(121));
const terug = await p.evaluate(() => ({ hout: window.spel.economie.voorraad.hout, order: window.spel.haven.havens().find((h) => !h.rood).order }));
check('na 2 minuten: hout in de voorraad', terug.hout === voor.hout + 10 && !terug.order, JSON.stringify(terug));
// Verkopen: meer goud dan de voorraadkamer
const verkoop = await p.evaluate(() => {
  const e = window.spel.economie;
  const h = window.spel.haven.havens().find((x) => !x.rood);
  e.lever('steen', 30);
  const g0 = e.voorraad.goud;
  const s0 = e.voorraad.steen;
  const r = window.spel.haven.bestel(h.vak, 'verkoop', 'steen', 2);
  const s1 = e.voorraad.steen;
  window.spel.haven.stap(60);
  const g1 = e.voorraad.goud;
  window.spel.haven.stap(61);
  return { r, weg: s0 - s1, tussen: g1 - g0, erbij: e.voorraad.goud - g0, kamer: window.spel.regels.handel.prijs.steen * 2 };
});
check('verkopen: goederen meteen weg, goud pas na 2 minuten', verkoop.r === '' && verkoop.weg === 20 && verkoop.tussen === 0 && verkoop.erbij === 12, JSON.stringify(verkoop));
check('verkopen: meer dan de voorraadkamer', verkoop.erbij > verkoop.kamer);
// Bewaren
await p.waitForTimeout(10500);
await p.evaluate(() => { const h = window.spel.haven.havens().find((x) => !x.rood); window.spel.haven.bestel(h.vak, 'koop', 'hout', 1); });
await p.waitForTimeout(10500);
await p.reload();
await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.waitForTimeout(1500);
if (await zichtbaar('#titel-verder')) await tikOp('#titel-verder');
await p.waitForTimeout(1500);
const herladen = await p.evaluate(() => ({ order: (window.spel.haven.havens().find((x) => !x.rood) || {}).order, les: window.spel.havenLes ? window.spel.havenLes.fase() : 'geen' }));
check('na herladen: schip nog op zee', herladen.order && herladen.order.soort === 'koop', JSON.stringify(herladen));
check('na herladen: les niet opnieuw', herladen.les === 'klaar' || herladen.les === 'geen', herladen.les);
// Het level opnieuw starten vanaf de levelkaart: de havenles begint weer
await p.evaluate(() => sessionStorage.setItem('burcht-banier.toonBeeld', '1'));
await p.reload();
await p.waitForFunction(() => window.spel && window.spel.strijd);
await p.waitForTimeout(1500);
const vanKaart = await p.evaluate(() => (window.spel.havenLes ? window.spel.havenLes.fase() : 'geen'));
check('levelkaart: havenles begint weer', vanKaart !== 'klaar' && vanKaart !== 'geen', vanKaart);
// Start over: de havenles begint ook dan weer
await p.evaluate(() => window.spel.havenLes.sla());
await p.evaluate(() => { const k = document.getElementById('knop-opnieuw'); k.click(); k.click(); });
await p.waitForTimeout(500);
const naOpnieuw = await p.evaluate(() => window.spel.havenLes.fase());
check('Start over: havenles begint weer', naOpnieuw !== 'klaar', naOpnieuw);
check('geen fouten in level 8', fouten.length === 0, fouten.join(' | '));

// Level 9: hopboerderij en kroeg
fouten.length = 0;
await startLevel(9, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
check('level 9: hopveld en kroeg in het menu', await p.evaluate(() => !!document.querySelector('#bouw-knoppen [data-sleutel="hopveld"]') && !!document.querySelector('#bouw-knoppen [data-sleutel="kroeg"]')));
check('level 9: geen havenles', await p.evaluate(() => !window.spel.havenLes));
const kroeg = await p.evaluate(() => {
  const { bouwer, bouwwerken, kaart, economie } = window.spel;
  const s = kaart.start[0];
  economie.lever('hout', 100); economie.lever('planken', 60); economie.lever('steen', 60);
  const vrij = [];
  for (let y = s.y - 8; y <= s.y + 8; y++) for (let x = s.x - 8; x <= s.x + 8; x++) if (!bouwer.waaromNiet(x, y, bouwwerken.kroeg) || bouwer.waaromNiet(x, y, bouwwerken.kroeg) === 'build a hop farm first') vrij.push({ x, y });
  const eerst = bouwer.waaromNiet(vrij[0].x, vrij[0].y, bouwwerken.kroeg);
  return { eerst, vrij: vrij.slice(0, 6) };
});
check('kroeg vraagt eerst een hopboerderij', kroeg.eerst === 'build a hop farm first', kroeg.eerst);
const opbouw = await p.evaluate((vrij) => {
  const { bouwer, bouwwerken, economie } = window.spel;
  const r1 = bouwer.plaats(bouwwerken.hopveld, [vrij[0]]);
  const r2 = bouwer.plaats(bouwwerken.kroeg, [vrij[3]]);
  return { r1, r2, waarom: bouwer.waaromNiet(vrij[3].x, vrij[3].y, bouwwerken.kroeg) };
}, kroeg.vrij);
check('hopveld en kroeg gebouwd', await p.evaluate(() => { const K = window.spel.kaart; let h = 0; let k = 0; for (let i = 0; i < K.object.length; i++) { if (K.object[i] === 53 && K.eigenaar[i] === 1) h++; if (K.object[i] === 54 && K.eigenaar[i] === 1) k++; } return h === 1 && k === 1; }), JSON.stringify(opbouw));
// Werkers erbij (boeren nodig): even laten lopen
await p.evaluate(() => window.spel.economie.zetVolk(20));
await p.waitForTimeout(4000);
const werk = await p.evaluate(() => ({ hopboer: window.spel.economie.aantalMetBeroep('hopboer'), waard: window.spel.economie.aantalMetBeroep('waard') }));
check('hopboer en waard aan het werk', werk.hopboer === 1 && werk.waard === 1, JSON.stringify(werk));
const stem = await p.evaluate(() => {
  const e = window.spel.economie;
  e.neem('hop', e.voorraad.hop);
  const zonder = e.stemming().factoren.find((f) => f.naam === 'tavern');
  e.lever('hop', 10);
  const met = e.stemming().factoren.find((f) => f.naam === 'tavern');
  return { zonder: zonder && zonder.waarde, met: met && met.waarde };
});
check('kroeg: zonder hop geen bonus, met hop +3', stem.zonder === 0 && stem.met === 3, JSON.stringify(stem));
check('hop in de balk', await p.evaluate(() => !!document.querySelector('.icoon-hop')));
await p.screenshot({ path: '/home/claude/werk/h-kroeg.png' });
check('geen fouten in level 9', fouten.length === 0, fouten.join(' | '));

console.log(`\n${goed} goed, ${fout} fout`);
await b.close();
srv.kill();
process.exit(fout ? 1 : 0);
