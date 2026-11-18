// De proloog: taken van Bartholt, Reinout als gast, avond, nacht met overmacht, scène, levelkaart.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8237;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
await p.goto(`http://localhost:${poort}/`); await wacht();
await p.evaluate(() => {
  localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
  localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 0 }));
  sessionStorage.setItem('burcht-banier.geenTitel', '1');
});
await p.reload(); await wacht(); await p.waitForTimeout(300);
check('proloog gekozen', (await p.evaluate(() => window.spel.modus.missie)) === 0);
await p.waitForSelector('#missie:not([hidden])', { timeout: 20000 }).catch(() => {});
check('briefing open', await p.isVisible('#missie'));
await p.tap('#missie-begin');
const st = () => p.evaluate(() => window.spel.proloog.stand());
await p.waitForTimeout(1500);
let s = await st();
check('eerst een kaartje, nog geen taak', !s.basis && await p.isVisible('#gids-kaart') && /begin/.test(await p.textContent('#gids-kaart button')), JSON.stringify(s));
await p.waitForTimeout(8000);
check('geen klok: na 8 s nog steeds wachten', !(await st()).basis);
check('geen kasteel van rood', (await p.evaluate(() => { const k = window.spel.kaart; let n = 0; for (let i = 0; i < k.eigenaar.length; i++) if (k.eigenaar[i] === 2) n++; return n; })) === 0);
check('jouw ringmuur staat er al', (await p.evaluate(() => { const k = window.spel.kaart; let n = 0; for (let i = 0; i < k.eigenaar.length; i++) if (k.eigenaar[i] === 1 && k.object[i] === 4) n++; return n; })) >= 20);
check('feest: vlaggen en meer huisjes', (await p.evaluate(() => { const k = window.spel.kaart; let v = 0, h = 0; for (let i = 0; i < k.object.length; i++) { if (k.object[i] === 28) v++; if (k.object[i] === 11 || k.object[i] === 12) h++; } return v >= 10 && h >= 20; })));
check('kaart groter', (await p.evaluate(() => window.spel.kaart.breedte)) === 84);
check('geen rode heer', (await p.evaluate(() => window.spel.rood)) === null);
await p.screenshot({ path: '/home/claude/proloog-feest.png' });
let gesprekken = 0;
// Gesprekken tussen de lessen (knop '›') doorklikken; telt de kaartjes
const slaGesprekOver = async () => { let n = 0; while (n < 12 && await p.isVisible('#gids-kaart') && (await p.textContent('#gids-kaart button')).trim() === '›') { if (n === 0) check('gesprek met portret', await p.isVisible('#gids-kaart img.portret')); n++; await p.tap('#gids-kaart button'); await p.waitForTimeout(120); } return n; };
const kaartTik = async () => { await p.waitForSelector('#gids-kaart:not([hidden]) button', { timeout: 6000 }); await p.tap('#gids-kaart button'); await p.waitForTimeout(150); gesprekken += await slaGesprekOver(); };
const intro0 = await p.textContent('#gids-kaart');
await kaartTik();
s = await st();
check('Bartholt praat', /wood/.test(intro0), intro0);
check('gids wijst de hamer', await p.isVisible('#gids-ring') && /hammer/.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
check('taak 1', s.fase === 'bouw' && s.taak === 0, JSON.stringify(s));
check('garnizoen van ongeveer 40', (await p.evaluate(() => window.spel.leger.soldaten().length)) >= 36, await p.evaluate(() => window.spel.leger.soldaten().length));
check('taak in beeld', /Task 1 of 12/.test(await p.textContent('#taak')));
check('Reinout staat bij de burcht', s.reinout && (await p.evaluate(() => window.spel.eenheden.lijst.some((e) => e.gast))));
check('geen rode koning', (await p.evaluate(() => window.spel.strijd.koning(1))) === null);
check('geen uitslag', (await p.evaluate(() => window.spel.strijd.uitslag())) === null);

// Vrije plekken rond de burcht
const vrij = await p.evaluate(() => {
  const s = window.spel; const k = s.kaart; const st = k.start[0]; const uit = [];
  for (let r = 5; r < 14 && uit.length < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = st.x + dx, y = st.y + dy; const i = y * k.breedte + x;
    if (k.object[i] === 0 && s.wegvinder.isVrij(x, y, 0) && !uit.some(([a, b2]) => Math.abs(a - x) < 3 && Math.abs(b2 - y) < 3)) uit.push([x, y]);
  }
  return uit;
});
check('genoeg plekken', vrij.length >= 6, vrij.length);
const zet = (lijst) => p.evaluate((l) => window.spel.bouwer.zetTerug(l), lijst);
const volgende = async () => { await p.waitForFunction(() => window.spel.proloog.stand().klaar, null, { timeout: 8000 }).catch(() => {}); await kaartTik(); await kaartTik(); };
const totTaak = (n) => p.waitForFunction((n) => { const s = window.spel.proloog.stand(); return s.fase !== 'bouw' || (s.taak >= n && !s.klaar); }, n, { timeout: 16000 }).catch(() => {});
let i = 0;
const bouwTaak = async ([sleutel, n]) => {
  await zet({ [sleutel]: vrij[i++] });
  if (n === 1) {
    await p.waitForFunction(() => window.spel.proloog.stand().klaar, null, { timeout: 4000 }).catch(() => {});
    const k = await st();
    check('na de taak wacht het kaartje (nog taak 1, klaar)', k.taak === 0 && k.klaar && await p.isVisible('#gids-kaart') && /Next lesson/.test(await p.textContent('#gids-kaart button')), JSON.stringify(k));
    await p.waitForTimeout(6000);
    check('geen klok: blijft op taak 1', (await st()).taak === 0);
  } else await p.waitForFunction(() => window.spel.proloog.stand().klaar, null, { timeout: 6000 }).catch(() => {});
  await kaartTik();   // Next lesson
  await kaartTik();   // Start lesson
  await totTaak(n);
  check(`${sleutel} gebouwd: taak ${n + 1}`, (await st()).taak === n, JSON.stringify(await st()));
};
for (const t of [['houthakker', 1], ['voorraadkamer', 2], ['steengroeve', 3], ['boomgaard', 4], ['woning', 5]]) await bouwTaak(t);
// Taak 5 en 6: je volk en de belasting, met echte tikken
check('taak 6: je volk', (await st()).taak === 5 && /purse/.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
await p.tap('#knop-buidel'); await p.waitForTimeout(500);
check('paneel open: gids wijst naar Close', await p.isVisible('#volkpaneel') && /close/i.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
check('nog niet klaar zolang het paneel openstaat', !(await st()).klaar);
await p.tap('#volk-sluit'); await p.waitForTimeout(900);
check('volk gezien en gesloten: klaar', (await st()).klaar);
await kaartTik(); await kaartTik(); await totTaak(6);
check('taak 7: belasting', (await st()).taak === 6 && /purse|people/.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
await p.tap('#knop-buidel'); await p.waitForTimeout(500);
check('gids wijst een belastingknop aan', /tax level/i.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
const voor = await p.evaluate(() => window.spel.economie.stemming().belasting);
await p.tap('#volk-belasting button:not(.actief)'); await p.waitForTimeout(500);
const na = await p.evaluate(() => window.spel.economie.stemming().belasting);
check('belasting veranderd', na !== voor, `${voor} ${na}`);
check('na de keuze: sluiten', /close/i.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
await p.tap('#volk-sluit'); await p.waitForTimeout(900);
check('belasting klaar', (await st()).klaar);
await p.evaluate((b) => window.spel.economie.zetBelasting(b), voor);
await kaartTik(); await kaartTik(); await totTaak(7);
await bouwTaak(['kazerne', 8]).catch((e) => console.log('kazerne', e));
// Twee soldaten; ze lopen niet vanzelf weg (een bevel telt pas als de speler het geeft)
check('opleiden: gouden plek op de kazerne', await p.evaluate(() => { const e = document.getElementById('gids-plek'); return !e.hidden && /Barracks/.test(e.textContent) && /barracks/i.test(document.getElementById('gids-zin').textContent); }), await p.textContent('#gids-zin'));
const plekMidden = await p.evaluate(() => { const r = document.getElementById('gids-plek').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await p.touchscreen.tap(plekMidden[0], plekMidden[1]); await p.waitForTimeout(500);
check('kazerne aangetikt: opleidpaneel open', await p.isVisible('#legerpaneel'));
check('gids wijst een opleidknop aan', /train a soldier/i.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
for (let k = 0; k < 2; k++) { await p.tap('#leger-opleiden button:not(.kanniet)').catch(() => {}); await p.waitForTimeout(400); }
const getraind = await p.evaluate(() => window.spel.leger.soldaten().length);
if (!(await st()).klaar) await p.evaluate(([x, y]) => window.spel.leger.zetStand([['ridder', x, y, 50, 0], ['boogschutter', x + 1, y, 40, 0]]), vrij[i]);
await volgende();
await totTaak(9);
check('twee soldaten: taak 10', (await st()).taak === 9);
await p.waitForTimeout(2000);
check('sturen nog niet klaar zonder bevel', !(await st()).klaar);
// Sturen
await p.evaluate(() => window.spel.leger.kiesGeen()); await p.waitForTimeout(500);
// 0.76.3: eerst het oog, dan de soldaat, dan de plek
check('sturen: eerst het oog', /eye/i.test(await p.textContent('#gids-zin')) && await p.evaluate(() => document.getElementById('gids-plek').hidden), await p.textContent('#gids-zin'));
await p.tap('#knop-oog'); await p.waitForTimeout(500);
check('oog aan: nu de nieuwe soldaat aanwijzen', await p.evaluate(() => { const e = document.getElementById('gids-plek'); return !e.hidden && (/Tap this soldier/.test(e.textContent) || e.classList.contains('buiten')) && /new soldier/i.test(document.getElementById('gids-zin').textContent); }), await p.textContent('#gids-zin'));
// Een bevel naar de muur telt niet voor de grondles
await p.evaluate(() => { const s = window.spel; const e = s.gids.doel() && s.gids.doel().soldaat ? s.gids.doel().soldaat() : null; s.leger.kies(e ? [e] : []); const st = s.kaart.start[0]; s.leger.stuur(st.x - 5, st.y - 2, true); });
await p.waitForTimeout(1200);
check('grondles: soldaat op de muur telt niet', !(await st()).klaar);
await p.evaluate(() => { const s = window.spel; const e = s.gids.doel() && s.gids.doel().soldaat ? s.gids.doel().soldaat() : null; s.leger.kies(e ? [e] : []); });
await p.waitForTimeout(500);
check('soldaat gekozen: nu de gouden plek', /golden spot/i.test(await p.textContent('#gids-zin')) && /Send him here/.test(await p.textContent('#gids-plek')), await p.textContent('#gids-zin'));
await p.tap('#knop-oog'); await p.waitForTimeout(400);
check('oog weer uit: gids vraagt er niet opnieuw om', !/eye/i.test(await p.textContent('#gids-zin')), await p.textContent('#gids-zin'));
check('zin niet over de legerhint', await p.evaluate(() => { const h = document.getElementById('legerhint'); if (h.hidden) return true; const a = h.getBoundingClientRect(), z = document.getElementById('gids-zin').getBoundingClientRect(); return !(z.left < a.right && z.right > a.left && z.top < a.bottom && z.bottom > a.top); }));
// Nu echt: oog aan, soldaat kiezen en op de gouden plek tikken
await p.tap('#knop-oog'); await p.waitForTimeout(300);
await p.evaluate(() => { const s = window.spel; const e = s.gids.doel() && s.gids.doel().soldaat ? s.gids.doel().soldaat() : null; s.leger.kies(e ? [e] : []); });
await p.waitForTimeout(500);
// De plek ligt verder weg: het beeld schuiven in de richting van de pijl tot hij in beeld is
for (let k = 0; k < 8 && await p.evaluate(() => document.getElementById('gids-plek').classList.contains('buiten')); k++) {
  await p.evaluate(() => { const s = window.spel; const r = document.getElementById('gids-plek').getBoundingClientRect(); const mx = innerWidth / 2, my = innerHeight / 2; const dx = r.left + r.width / 2 - mx, dy = r.top + r.height / 2 - my, l = Math.hypot(dx, dy) || 1; const w = s.camera.schermNaarWereld(mx + dx / l * 220, my + dy / l * 220); s.camera.kijkNaar(w.x, w.y); });
  await p.waitForTimeout(500);
}
const gp = await p.evaluate(() => { const r = document.getElementById('gids-plek'); const c = r.getBoundingClientRect(); return [c.left + c.width / 2, c.top + c.height / 2, r.hidden, r.classList.contains('buiten')]; });
check('gouden plek in beeld voor het bevel', !gp[2] && !gp[3], JSON.stringify(gp));
await p.evaluate(() => { const l = window.spel.leger; const w = l.stuur; l.stuur = (...a) => { window.__st = a; return w(...a); }; });
await p.touchscreen.tap(gp[0], gp[1]);
await p.waitForTimeout(800); check('bevel op de gouden plek telt', (await st()).gestuurd);

await volgende();
await totTaak(10);
check('gestuurd: taak 11', (await st()).taak === 10, JSON.stringify(await st()));
// Een soldaat op de muur
if (await p.isVisible('#gids-kaart')) await kaartTik();   // het introkaartje van de muurles
await p.waitForFunction(() => !document.getElementById('gids-plek').hidden, null, { timeout: 4000 }).catch(() => {});
check('muur: gouden plek op de kaart', await p.evaluate(() => { const e = document.getElementById('gids-plek'); return !e.hidden && (/Wall here|Tap this soldier/.test(e.textContent) || e.classList.contains('buiten')); }));
// Een beeldvullend scherm (titel) verbergt de gids helemaal
await p.evaluate(() => { document.getElementById('titelscherm').hidden = false; }); await p.waitForTimeout(500);
check('titelscherm: gids verborgen', await p.evaluate(() => ['gids-ring', 'gids-zin', 'gids-plek', 'gids-kaart'].every((id) => getComputedStyle(document.getElementById(id)).display === 'none')));
await p.evaluate(() => { document.getElementById('titelscherm').hidden = true; }); await p.waitForTimeout(500);
await p.waitForFunction(() => !document.body.classList.contains('gids-bedekt'), null, { timeout: 4000 }).catch(() => {});
check('titelscherm weg: gids terug', await p.evaluate(() => !document.body.classList.contains('gids-bedekt') && getComputedStyle(document.getElementById('gids-zin')).display !== 'none'));
// 0.76.6: een wachter kun je in de tutorial niet kiezen; alleen de soldaat van de les
const wachterGekozen = await p.evaluate(() => { const s = window.spel; s.leger.kies(s.leger.soldaten().filter((e) => e.opMuur && e.wachter).slice(0, 3)); return s.leger.aantalGekozen(); });
check('muurles: wachters niet te kiezen', wachterGekozen === 0, wachterGekozen);
await p.evaluate(() => { const s = window.spel; const e = s.gids.doel().soldaat(); s.leger.kies([e]); const g = s.gids.doel().plek; s.leger.stuur(g.x, g.y, true); });
await p.waitForTimeout(1500);
check('bevel naar de muur telt', (await st()).klaar);
// Alle soldaten gekozen (wachters en nieuwe), dan naar de muur: de nieuwe telt wel
await p.waitForFunction(() => window.spel.proloog.stand().klaar, null, { timeout: 40000 }).catch(() => {});
await kaartTik(); await kaartTik();   // lof, dan het introkaartje van de logboekles
// Logboekles: Bartholts portret linksboven
await p.waitForTimeout(500);
check('logboekles: gids wijst het portret', /portrait/i.test(await p.textContent('#gids-zin')) && (await p.evaluate(() => { const r = document.getElementById('gids-ring').getBoundingClientRect(), a = document.getElementById('adviseur').getBoundingClientRect(); return Math.abs(r.left - a.left) < 12 && Math.abs(r.top - a.top) < 12; })), await p.textContent('#gids-zin'));
await p.tap('#adviseur'); await p.waitForTimeout(800);
check('logboek open, nog niet klaar', await p.isVisible('#logboek') && !(await st()).klaar);
await p.tap('#adviseur'); await p.waitForTimeout(900);
check('logboek dicht: les klaar', (await st()).klaar, JSON.stringify(await st()));
await kaartTik();   // Continue
await p.waitForFunction(() => window.spel.proloog.stand().fase === 'avond', null, { timeout: 8000 }).catch(() => {});
s = await st();
check('lijst af: avond', s.fase === 'avond', JSON.stringify(s));
// 0.73: meteen een avondkaartje van Bartholt; Reinout gaat pas als je verder tikt, dan schemer
check('avondkaartje meteen', await p.isVisible('#gids-kaart') && /feast is over/.test(await p.textContent('#gids-kaart')), await p.textContent('#gids-kaart'));
check('Reinout er nog zolang het kaartje open is', (await st()).reinout);
await p.tap('#gids-kaart button'); await p.waitForTimeout(400);
check('Reinout is weg', !(await st()).reinout && !(await p.evaluate(() => window.spel.eenheden.lijst.some((e) => e.gast))));
await p.waitForTimeout(3000);
const n1 = await p.evaluate(() => window.spel.proloog.nacht());
check('schemering', n1 > 0.1 && n1 < 1, n1);
await p.waitForFunction(() => window.spel.proloog.stand().fase === 'nacht', null, { timeout: 25000 }).catch(() => {});
s = await st();
check('nacht', s.fase === 'nacht' && (await p.evaluate(() => window.spel.proloog.nacht())) === 1, JSON.stringify(s));
const vij = await p.evaluate(() => window.spel.strijd.vijanden().length);
check('overmacht: bijna 100 vijanden onderweg', vij >= 90, vij);
// De opmars wacht op de poort: de storm begint pas na de les (hier direct via zetFase)
await p.evaluate(() => window.spel.proloog.zetFase('storm'));
await p.waitForTimeout(300);
check('melding poort open', /gate is open/.test(await p.evaluate(() => window.spel.ui.logboek().map((r) => r.tekst).join(' '))));
check('taak nacht', /Night/.test(await p.textContent('#taak')));
await p.waitForTimeout(500);
await p.screenshot({ path: '/home/claude/proloog-nacht.png' });
// De koning sneuvelt niet
await p.evaluate(() => { const k = window.spel.strijd.koning(0); k.leven = 2; });
await p.waitForTimeout(4000);
check('koning leeft nog', (await p.evaluate(() => { const k = window.spel.strijd.koning(0); return !!k && k.leven >= 1; })));
check('koning niet onder de helft na een treffer', await p.evaluate(() => { const k = window.spel.strijd.koning(0); return k.leven >= Math.ceil(k.levenMax / 2); }), await p.evaluate(() => { const k = window.spel.strijd.koning(0); return k.leven + '/' + k.levenMax; }));
check('nog steeds geen uitslag', (await p.evaluate(() => window.spel.strijd.uitslag())) === null);
// Burcht onder 40%: de scène
await p.evaluate(() => { const b = window.spel.strijd.burcht(); window.spel.strijd.zetBurcht(Math.floor(b.max * 0.35)); });
await p.waitForFunction(() => window.spel.proloog.stand().fase === 'ontvoering', null, { timeout: 5000 }).catch(() => {});
check('eerst de ontvoering: een ruiter', (await st()).fase === 'ontvoering' && (await p.evaluate(() => window.spel.strijd.effecten.some((f) => f.soort === 'ruiter'))));
await p.waitForTimeout(3500);
await p.screenshot({ path: '/tmp/s/ruiter.png' });
await p.waitForFunction(() => !document.getElementById('scene').hidden, null, { timeout: 9000 }).catch(() => {});
check('scène open', await p.isVisible('#scene'));
await p.screenshot({ path: '/home/claude/proloog-scene.png' });
let kaarten = 0;
while (await p.isVisible('#scene') && kaarten < 20) { kaarten++; await p.tap('#scene-verder'); await p.waitForTimeout(150); }
check('dertien kaarten', kaarten === 13, kaarten);
check('levelkaart open', await p.isVisible('#titel-kaart'));
check('proloog gewonnen', (await p.evaluate(() => JSON.parse(localStorage.getItem('burcht-banier.campagne')).klaar)).includes(0));
check('proloogstand gewist', (await p.evaluate(() => localStorage.getItem('burcht-banier.proloog'))) === null);
check('drie gesprekken, 12 kaartjes', gesprekken === 12, gesprekken);
console.log('fouten', fouten, 'ok', ok, 'fout', fout);
await b.close(); srv.kill();
