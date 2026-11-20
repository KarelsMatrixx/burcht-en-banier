// Geluidsmix (0.78.1): alleen wat in beeld is, zoom bepaalt het volume, hooguit 3 gewone / 6 met gevecht tegelijk.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { autoVerder } from './hulp_beeld.mjs';
import { spawn } from 'child_process';
const poort = 8278;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, serviceWorkers: 'block' })).newPage();
await autoVerder(p);
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
await p.tap('#missie-begin'); await p.waitForTimeout(4000);
await p.tap('#gids-kaart button'); await p.waitForTimeout(300);
const g = (f) => p.evaluate(f);
// Buiten beeld: niets
const buiten = await g(() => { const s = window.spel; s.geluid.nulMeting(); s.camera.zoom = 2; s.geluid.speel('sword_hit', { x: 200, y: 200 }); return s.geluid.stand().gestart; });
check('geluid buiten beeld klinkt niet', buiten === 0, buiten);
// In beeld (midden van het scherm) klinkt wel
const midden = await g(() => { const s = window.spel; const c = s.camera; const w = c.schermNaarWereld(c.breedte / 2, c.hoogte / 2); return w; });
const inBeeld = await p.evaluate((w) => { const s = window.spel; s.geluid.nulMeting(); const x = (w.x / 32 + w.y / 16) / 2, y = (w.y / 16 - w.x / 32) / 2; s.geluid.speel('death_soldier', { x, y }); return [s.geluid.stand().gestart, x, y]; }, midden);
check('geluid in beeld klinkt', inBeeld[0] === 1, JSON.stringify(inBeeld));
// Zoomsterkte: helemaal uit 0, start ergens tussen, ver in 1
const z = await g(() => { const s = window.spel; const r = []; for (const zoom of [0.45, 1.0, 1.2, 1.6, 2.5]) { s.camera.zoom = zoom; r.push(Math.round(s.geluid.stand().zoom * 100) / 100); } return r; });
check('zoom: uit 0, in 1, ertussen oplopend', z[0] === 0 && z[3] === 1 && z[4] === 1 && z[1] > 0 && z[2] > z[1], JSON.stringify(z));
// Helemaal uitgezoomd: niets uit de wereld, wel knoppen
const uit = await g(() => { const s = window.spel; s.camera.zoom = 0.45; s.geluid.nulMeting(); s.geluid.speel('death_civilian', { x: 20, y: 40 }); s.geluid.speel('ui_confirm'); return s.geluid.stand().gestart; });
check('uitgezoomd: wereld stil, knop klinkt', uit === 1, uit);
// Omgevingslus volgt de zoom
await p.waitForTimeout(1500);
const lusUit = await g(() => window.spel.geluid.stand().lusVolume);
await g(() => { window.spel.camera.zoom = 2; });
await p.waitForTimeout(1500);
const lusIn = await g(() => window.spel.geluid.stand().lusVolume);
check('omgeving uitgezoomd stil, ingezoomd hoorbaar', lusUit < 0.02 && lusIn > 0.1, JSON.stringify([lusUit, lusIn]));
// Gevecht: hooguit 6 tegelijk; gewone geluiden hooguit 3
await g(() => { window.spel.camera.zoom = 1.2; window.spel.geluid.nulMeting(); window.spel.proloog.zetFase('storm'); });
await p.waitForTimeout(15000);
const mix = await g(() => window.spel.geluid.stand());
console.log(JSON.stringify({ gestart: mix.gestart, maxKlonk: mix.maxKlonk }));
check('in het gevecht nooit meer dan 6 tegelijk', mix.maxKlonk <= 6, mix.maxKlonk);
// Stresstest in het midden van het scherm
const stress = await p.evaluate(async (w) => {
  const s = window.spel; s.camera.zoom = 2; const g = s.geluid; await new Promise((r) => setTimeout(r, 3000)); g.nulMeting();
  const c = s.camera; const m = c.schermNaarWereld(c.breedte / 2, c.hoogte / 2); const x = (m.x / 32 + m.y / 16) / 2, y = (m.y / 16 - m.x / 32) / 2;
  const vecht = ['sword_hit', 'axe_hit', 'death_soldier', 'ram_hit', 'catapult_impact', 'assassin_stab', 'sword_heavy', 'fire_cast', 'cavalry_charge', 'death_civilian'];
  for (const n of vecht) g.speel(n, { x, y });
  const naVecht = g.stand().klinkt;
  for (const n of ['axe_chop', 'tree_fall', 'steps_grass', 'goods_delivered', 'fruit_pick']) g.speel(n, { x, y });
  const naWerk = g.stand().klinkt;
  g.speel('horn_attack');
  const naHoorn = g.stand();
  return { naVecht, naWerk, naHoorn: naHoorn.klinkt, max: naHoorn.maxKlonk, hoornIn: naHoorn.gehoord.includes('horn_attack') };
}, midden);
console.log(JSON.stringify(stress));
check('10 vechtgeluiden tegelijk: er klinken er 6', stress.naVecht === 6, JSON.stringify(stress));
check('werkgeluiden (lager) verdringen het gevecht niet', stress.naWerk === 6, JSON.stringify(stress));
check('de hoorn (hoogste) verdringt het zwakste', stress.hoornIn && stress.max <= 6, JSON.stringify(stress));
const rustig = await p.evaluate(async (w) => {
  const g = window.spel.geluid; await new Promise((r) => setTimeout(r, 9000)); g.nulMeting();
  const c = window.spel.camera; const m = c.schermNaarWereld(c.breedte / 2, c.hoogte / 2); const x = (m.x / 32 + m.y / 16) / 2, y = (m.y / 16 - m.x / 32) / 2;
  for (const n of ['axe_chop', 'tree_fall', 'steps_grass', 'goods_delivered', 'fruit_pick', 'stone_chisel']) g.speel(n, { x, y });
  return g.stand();
}, midden);
check('zonder gevecht: hooguit 3 tegelijk', rustig.maxKlonk <= 3 && rustig.gestart === 3, JSON.stringify({ g: rustig.gestart, m: rustig.maxKlonk }));
check('geen paginafouten', fouten.length === 0, fouten.join(' | '));
console.log('ok', ok, 'fout', fout);
await b.close(); srv.kill();
