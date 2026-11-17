// 0.68: bevestiging bij siege gear, unlocks tegen jou in het level waarin je ze krijgt, aparte siege-barak.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8352;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
const url = `http://localhost:${poort}/`;

// ---- Deel 1: data. Wat je als beloning van level N krijgt, gebruikt rood in level N tegen jou ----
await p.goto(url); await wacht();
const d = await p.evaluate(async () => {
  const camp = await (await fetch('data/campagne.json')).json();
  const eco = await (await fetch('data/economie.json')).json();
  const bw = (await (await fetch('data/bouwwerken.json')).json()).bouwwerken;
  const soldaten = eco.soldaten;
  const mist = [];
  const vroeg = [];   // een beloning die al in de allereerste aanval of golf zit (moet "later door het level")
  for (const l of camp.levels) {
    if (!l.speelbaar || l.proloog) continue;
    const r = l.rood || {};
    for (const sl of l.beloning || []) {
      if (!soldaten[sl]) continue;   // gebouwen en mijnen tellen niet
      const inLeger = r.leger && r.leger[sl];
      const inExtra = r.extra_soorten && r.extra_soorten[sl];
      const inHut = l.doel && l.doel.golven && l.doel.golven.leger && l.doel.golven.leger[sl];
      const inDruk = l.doel && l.doel.druk && (l.doel.druk.golven || []).some((g) => g.leger && g.leger[sl]);
      // Een soort die in een profiel-standaard zit telt ook (kruisboog in level 2 staat al in rood.leger)
      if (!(inLeger || inExtra || inHut || inDruk)) mist.push(`${l.id}:${sl}`);
    }
  }
  // Niet in de eerste aanval: machines en mystieke soorten die de speler pas krijgt komen later.
  const lv = (id) => camp.levels.find((l) => l.id === id);
  return {
    mist,
    toren1: lv(1).rood.extra_soorten.toren, katapult2: lv(2).rood.extra_soorten.katapult,
    vlam4: lv(4).doel.golven.leger.vlammenwever, heler5: lv(5).rood.leger.heler, steen6: lv(6).rood.leger.steenwachter,
    kazerne: Object.fromEntries(['ram', 'katapult', 'toren', 'ladder', 'ridder', 'boogschutter', 'sluipmoordenaar'].map((k) => [k, soldaten[k].kazerne || 'klassiek'])),
    werkplaats: bw.belegeringswerkplaats, gewichtWachter: eco.heer.gewicht.steenwachter,
    prologue: lv(0).beloning,
  };
});
console.log(JSON.stringify(d));
check('elke soldaat-beloning van een speelbaar level komt in dat level tegen je terug', d.mist.length === 0, d.mist.join(','));
check('toren in level 1 pas vanaf de eerste aanval (later door het level)', d.toren1 && d.toren1.vanaf >= 1 && d.toren1.max >= 1, JSON.stringify(d.toren1));
check('katapult in level 2 pas vanaf de eerste aanval', d.katapult2 && d.katapult2.vanaf >= 1, JSON.stringify(d.katapult2));
check('vlammenwever in level 4 niet in de eerste golf', d.vlam4 && d.vlam4.vanaf >= 1, JSON.stringify(d.vlam4));
check('heler in level 5 en steenwachter in level 6 niet meteen', d.heler5.vanaf >= 1 && d.steen6.vanaf >= 1);
check('een steenwachter telt mee voor de sterkte van rood', d.gewichtWachter > 0, d.gewichtWachter);
check('ram, katapult en toren horen bij de siege-barak, de ladderdrager bij de gewone kazerne', d.kazerne.ram === 'belegering' && d.kazerne.katapult === 'belegering' && d.kazerne.toren === 'belegering' && d.kazerne.ladder === 'klassiek' && d.kazerne.ridder === 'klassiek' && d.kazerne.sluipmoordenaar === 'mystiek', JSON.stringify(d.kazerne));
check('de siege-barak bestaat en leidt belegering op', d.werkplaats && d.werkplaats.leidtOp === 'belegering' && d.werkplaats.object === 'BELEGERINGSWERKPLAATS', JSON.stringify(d.werkplaats));
check('de siege-barak is een beloning van de proloog (samen met ram en ladder)', d.prologue.includes('belegeringswerkplaats') && d.prologue.includes('ram'), JSON.stringify(d.prologue));

// ---- Deel 2: vrij spel: bouwen, legerplekken, welke knoppen waar staan ----
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('burcht-banier.geenTitel', '1'); localStorage.setItem('tipGesloten', '1'); });
await p.reload(); await wacht(); await p.waitForTimeout(300);
const w = await p.evaluate(async () => {
  window.__iso = await import('/js/iso.js');
  const s = window.spel; s.strijd.pauzeer(true);
  const K = s.kaart, B = K.breedte, st = K.start[0], W = s.wegvinder;
  const uit = {};
  for (const k of ['hout', 'steen', 'goud', 'planken', 'koper', 'voedsel']) s.economie.voorraad[k] = 999;
  const vrij = (x, y) => W.isVrij(x, y, 0);
  const zoek = (n) => {
    const r = [];
    for (let y = st.y + 5; y < st.y + 20 && r.length < n; y++) for (let x = st.x - 8; x < st.x + 8 && r.length < n; x++) {
      if (vrij(x, y) && !s.bouwer.waaromNiet(x, y, s.bouwwerken.kazerne) && !s.bouwer.waaromNiet(x, y, s.bouwwerken.belegeringswerkplaats) && !r.some((q) => Math.abs(q.x - x) < 3 && Math.abs(q.y - y) < 3)) r.push({ x, y });
    }
    return r;
  };
  const [kz, wp] = zoek(2);
  uit.max0 = s.leger.max;
  uit.kazerne = s.bouwer.plaats(s.bouwwerken.kazerne, [kz]);
  uit.max1 = s.leger.max;
  uit.werk = s.bouwer.plaats(s.bouwwerken.belegeringswerkplaats, [wp]);
  uit.max2 = s.leger.max;
  uit.objectOpKaart = K.object[wp.y * B + wp.x];
  uit.beschrijving = (await import('/js/kaart.js')).beschrijfTegel(K, wp.x, wp.y);
  uit.kz = kz; uit.wp = wp;
  uit.knoppenInBouwbalk = [...document.querySelectorAll('#bouw-knoppen button')].map((k) => k.textContent).filter((t) => /Siege Workshop/.test(t)).length;
  return uit;
});
console.log(JSON.stringify(w));
check('kazerne gebouwd', w.kazerne === 1);
check('siege-barak gebouwd', w.werk === 1, w.werk);
check('de siege-barak geeft 40 legerplekken erbij, net als een kazerne', w.max2 - w.max1 === 40 && w.max1 - w.max0 === 40, JSON.stringify([w.max0, w.max1, w.max2]));
check('de kaart kent het object', w.objectOpKaart === 33 && /siege workshop/.test(w.beschrijving), JSON.stringify([w.objectOpKaart, w.beschrijving]));
check('de siege-barak staat in de bouwbalk', w.knoppenInBouwbalk >= 1, w.knoppenInBouwbalk);

// Tik op de gebouwen: het paneel toont per gebouw de juiste knoppen
const naarTegel = (x, y) => p.evaluate(([x, y]) => { const s = window.spel; const wr = window.__iso.rasterNaarWereld(x + 0.5, y + 0.5); s.camera.x = wr.x; s.camera.y = wr.y; s.camera.zetZoom(1); return s.camera.wereldNaarScherm(wr.x, wr.y - 8); }, [x, y]);
const paneel = async (t) => {
  const sp = await naarTegel(t.x, t.y); await p.touchscreen.tap(sp.x, sp.y); await p.waitForTimeout(250);
  return p.evaluate(() => ({ open: !document.getElementById('legerpaneel').hidden, naam: document.getElementById('leger-tekst').textContent, knoppen: [...document.querySelectorAll('#leger-opleiden button')].map((k) => k.dataset.soldaat) }));
};
const pw = await paneel(w.wp);
check('tik op de siege-barak opent het paneel met ram, katapult en toren', pw.open && ['ram', 'katapult', 'toren'].every((k) => pw.knoppen.includes(k)), JSON.stringify(pw));
check('in de siege-barak staan geen gewone soldaten en geen ladderdrager', !pw.knoppen.includes('ridder') && !pw.knoppen.includes('ladder') && !pw.knoppen.includes('boogschutter'), JSON.stringify(pw.knoppen));
check('het paneel noemt de siege-barak', /Siege Workshop/.test(pw.naam), pw.naam);
const pk = await paneel(w.kz);
check('tik op de gewone kazerne: ridder en ladderdrager, geen ram, katapult of toren', pk.open && pk.knoppen.includes('ridder') && pk.knoppen.includes('ladder') && !pk.knoppen.some((k) => ['ram', 'katapult', 'toren'].includes(k)), JSON.stringify(pk.knoppen));
// Een ram opleiden in de siege-barak
await paneel(w.wp);
const leid = await p.evaluate((wp) => {
  const s = window.spel; const voor = s.leger.soldaten().length;
  const vak = wp.y * s.kaart.breedte + wp.x;
  const r = ['ram', 'katapult', 'toren'].map((k) => s.leger.leidOp(k, vak));
  return { r, na: s.leger.soldaten().length - voor, soorten: s.leger.soldaten().map((e) => e.soldaat.sleutel).filter((k) => ['ram', 'katapult', 'toren'].includes(k)) };
}, w.wp);
check('ram, katapult en toren zijn op te leiden', leid.r.every((x) => x === '') && leid.na === 3, JSON.stringify(leid));

// ---- Deel 3: bevestiging bij siege gear (echte tikken, level 1 met een muur van rood) ----
const start = async (lv, klaar) => {
  await p.evaluate(([lv, klaar]) => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: lv }));
    sessionStorage.setItem('burcht-banier.geenTitel', '1');
  }, [lv, klaar]);
  await p.reload(); await wacht(); await p.waitForTimeout(300);
  await p.tap('#missie-begin');
  await p.evaluate(async () => { window.__iso = await import('/js/iso.js'); });
};
const log = () => p.evaluate(() => window.spel.ui.logboek().map((r) => r.tekst));
// Level 3 heeft ram, ladder, toren en katapult al vrij gegeven (alles uit level 1 en 2)
await start(3, [1, 2]);
const m = await p.evaluate(() => {
  const s = window.spel; const m = s.kaart.start[1];
  s.strijd.pauzeer(true);
  s.leger.zetStand([['ladder', m.x - 9, m.y + 2, 9999, 0], ['ram', m.x - 9, m.y + 3, 9999, 0], ['katapult', m.x - 10, m.y + 3, 9999, 0], ['toren', m.x - 10, m.y + 2, 9999, 0], ['ridder', m.x - 11, m.y + 2, 9999, 0]]);
  return { x: m.x, y: m.y };
});
const kies = async (sleutel) => {
  const l = await p.evaluate((sl) => { const e = window.spel.leger.soldaten().find((e) => e.soldaat.sleutel === sl); return { x: e.x, y: e.y }; }, sleutel);
  const sp = await naarTegel(Math.floor(l.x), Math.floor(l.y)); await p.touchscreen.tap(sp.x, sp.y - 2);
  return p.evaluate(() => window.spel.leger.aantalGekozen());
};
// Vind een gewoon stuk muur van rood dat je met een tik kunt aanwijzen
const muur = await p.evaluate(() => {
  const s = window.spel, K = s.kaart, B = K.breedte, m = K.start[1];
  for (let y = m.y - 6; y <= m.y + 6; y++) for (let x = m.x - 8; x <= m.x - 3; x++) {
    const v = y * B + x;
    if (K.eigenaar[v] === 2 && K.object[v] === 4 && s.strijd.isRodeMuurZonderLadder(v)) return { x, y };
  }
  return null;
});
check('er is een gewoon stuk muur van rood om aan te tikken', !!muur);
if (muur) {
  const tikMuur = async () => { const sp = await naarTegel(muur.x, muur.y); await p.touchscreen.tap(sp.x, sp.y + 4); await p.waitForTimeout(250); };
  // Ladderdrager
  check('ladderdrager gekozen', (await kies('ladder')) >= 1);
  const l0 = (await log()).length;
  await tikMuur();
  let nieuw = (await log()).slice(l0).join(' | ');
  check('ladder: melding dat de ladder tegen de muur gezet wordt', /ladder is being set against the red wall/i.test(nieuw), nieuw);
  // Katapult en ram op een rode muur
  check('katapult gekozen', (await kies('katapult')) >= 1);
  const l1 = (await log()).length;
  await tikMuur();
  nieuw = (await log()).slice(l1).join(' | ');
  check('katapult: melding dat hij gaat schieten', /catapult is going to fire/i.test(nieuw), nieuw);
  check('ram gekozen', (await kies('ram')) >= 1);
  const l2 = (await log()).length;
  await tikMuur();
  nieuw = (await log()).slice(l2).join(' | ');
  check('ram: melding dat hij de muur gaat doorbreken', /battering ram is going to break through the red wall/i.test(nieuw), nieuw);
  // Belegeringstoren
  check('toren gekozen', (await kies('toren')) >= 1);
  const l3 = (await log()).length;
  await tikMuur();
  nieuw = (await log()).slice(l3).join(' | ');
  check('toren: melding dat hij tegen de muur wordt geplaatst', /siege tower is being placed against the red wall/i.test(nieuw), nieuw);
  // Een gewone ridder krijgt geen melding bij hetzelfde bevel
  check('ridder gekozen', (await kies('ridder')) >= 1);
  const l4 = (await log()).length;
  await tikMuur();
  nieuw = (await log()).slice(l4).join(' | ');
  check('gewone soldaten krijgen geen siege-melding', !/ladder is being|catapult is going|battering ram is going|siege tower is being/i.test(nieuw), nieuw);
}

// ---- Deel 4: rood koopt en gebruikt wat jij in dit level krijgt ----
// (strijd.pauzeer(true) houdt rood stil: we draaien rood.stap() zelf, 10 per seconde)
await start(1, [0]);
const r1 = await p.evaluate(() => {
  const s = window.spel; const h = s.rood;
  s.strijd.pauzeer(true);
  const draai = (stappen) => { let max = {}; for (let i = 0; i < stappen; i++) { h.stap(); for (const [k, n] of Object.entries(h.stand().reserve)) max[k] = Math.max(max[k] || 0, n); h.zetVoorraad('goud', 300); h.zetVoorraad('hout', 300); h.zetVoorraad('steen', 100); } return max; };
  h.zet({ v: { hout: 300, steen: 100, goud: 300 }, r: {}, s: 0, a: 0 });
  const zonder = draai(400);
  h.zet({ v: { hout: 300, steen: 100, goud: 300 }, r: {}, s: 0, a: 1 });
  const met = draai(400);
  return { zonder, met };
});
check('level 1: voor de eerste aanval geen belegeringstoren bij rood', !r1.zonder.toren, JSON.stringify(r1.zonder));
check('level 1: na de eerste aanval koopt rood een belegeringstoren (later door het level)', r1.met.toren === 1, JSON.stringify(r1.met));

await start(2, [1]);
const r2 = await p.evaluate(() => {
  const s = window.spel; const h = s.rood; s.strijd.pauzeer(true);
  const draai = (stappen) => { let max = {}; for (let i = 0; i < stappen; i++) { h.stap(); for (const [k, n] of Object.entries(h.stand().reserve)) max[k] = Math.max(max[k] || 0, n); h.zetVoorraad('goud', 300); h.zetVoorraad('hout', 300); h.zetVoorraad('steen', 100); } return max; };
  h.zet({ v: { hout: 300, steen: 100, goud: 300 }, r: {}, s: 0, a: 0 });
  const zonder = draai(400);
  h.zet({ v: { hout: 300, steen: 100, goud: 300 }, r: {}, s: 0, a: 1 });
  return { zonder, met: draai(400) };
});
check('level 2: katapult pas na de eerste aanval', !r2.zonder.katapult && r2.met.katapult === 1, JSON.stringify(r2));

await start(5, [1, 2, 3, 4]);
const r5 = await p.evaluate(() => {
  const s = window.spel; const h = s.rood; s.strijd.pauzeer(true);
  h.zet({ v: { hout: 300, steen: 100, goud: 300 }, r: {}, s: 0, a: 3 });
  let max = {};
  for (let i = 0; i < 1500; i++) { h.stap(); for (const [k, n] of Object.entries(h.stand().reserve)) max[k] = Math.max(max[k] || 0, n); h.zetVoorraad('goud', 300); }
  return max;
});
check('level 5: rood kan een heler kopen (zijn brood betaalt hij met goud)', (r5.heler || 0) >= 1, JSON.stringify(r5));

await start(6, [1, 2, 3, 4, 5]);
const r6 = await p.evaluate(() => {
  const s = window.spel; const h = s.rood; s.strijd.pauzeer(true);
  // Zonder zwaar materieel, zodat zijn budget naar gewone soldaten gaat
  s.regels.heer.extra_soorten = {}; s.regels.heer.rammenVanaf = 99;
  h.zet({ v: { hout: 300, steen: 100, goud: 300 }, r: {}, s: 0, a: 3 });
  let max = {};
  for (let i = 0; i < 2500; i++) { h.stap(); for (const [k, n] of Object.entries(h.stand().reserve)) max[k] = Math.max(max[k] || 0, n); h.zetVoorraad('goud', 300); h.zetVoorraad('steen', 100); }
  return max;
});
check('level 6: rood kan een steenwachter kopen', (r6.steenwachter || 0) >= 1, JSON.stringify(r6));

// Level 4 (hut): de vlammenwever komt pas mee vanaf de derde golf
await start(4, [1, 2, 3]);
const r4 = await p.evaluate(() => {
  const s = window.spel; s.strijd.pauzeer(true);
  const lijst = [];
  const orig = s.strijd.stuurLeger;
  s.strijd.stuurLeger = (inhoud, telAls) => { lijst.push({ ...inhoud }); return orig(inhoud, telAls); };
  s.doel.start();
  for (let i = 0; i < 8; i++) s.doel.stap(80);
  return lijst;
});
check('level 4: de hut krijgt golven', r4.length >= 4, JSON.stringify(r4));
check('level 4: geen vlammenwever in de eerste twee golven', r4.length >= 2 && !r4[0].vlammenwever && !r4[1].vlammenwever, JSON.stringify(r4));
check('level 4: wel een vlammenwever in een latere golf', r4.slice(2).some((g) => g.vlammenwever > 0), JSON.stringify(r4));

check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
