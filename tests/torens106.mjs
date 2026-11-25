// 0.106.0 (Greyford, aanvalsrooster): katapulten tegen volle torens, instorten, schilden, zwaardere aanval.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8287'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
let goed = 0, fout = 0; const check = (n, ok, x = '') => { if (ok) goed++; else { fout++; console.log('FOUT: ' + n, x); } };
const uit = {};
for (const soort of ['belegering', 'bestorming']) {
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  p.on('pageerror', (e) => console.log('ERR', String(e)));
  await p.goto('http://localhost:8287/'); await p.waitForFunction(() => window.spel && window.spel.strijd);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: [0,1,2,3,4,5,6] })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: 7 })); sessionStorage.setItem('burcht-banier.geenTitel','1'); });
  await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd); await p.waitForTimeout(400);
  const r = await p.evaluate((soort) => {
    const s = window.spel; const K = s.kaart; const B = K.breedte; s.strijd.pauzeer(true);
    const m = s.strijd.burcht(); const mx = Math.floor(m.x), my = Math.floor(m.y); const R = 8;
    const torens = [];
    for (let d = -R; d <= R; d++) for (const [x, y] of [[mx + d, my - R], [mx + d, my + R], [mx - R, my + d], [mx + R, my + d]]) {
      const v = y * B + x; if (K.object[v] !== 0 && K.object[v] !== 1) continue;
      const toren = Math.abs(d) === R || d === 0 || Math.abs(d) === 4;
      s.bouwer.zetVast(v, toren ? 5 : 4); if (toren) torens.push([x, y]);
    }
    s.wegvinder.herbereken(); s.strijd.kaartVeranderd();
    const st = [];
    for (const [x, y] of torens) for (let k = 0; k < 7; k++) if (st.length < 62) st.push(['boogschutter', x, y, undefined, 1]);
    for (let i = 0; i < 16; i++) st.push(['zwaardvechter', mx - 4 + (i % 8), my - 3 + Math.floor(i / 8) * 6, undefined, 0]);
    s.leger.zetStand(st);
    s.strijd.pauzeer(false);
    const v = s.veld; const telB = () => s.leger.lijst.filter((e) => !e.dood && e.opMuur).length;
    const op0 = telB(); const tor0 = [...v.torenBezetting().values()].reduce((a, b) => a + b, 0);
    const g = v.aanvalsGrootte(4); const inh = v.samenstelling(soort, g, 4);
    v.zetSoort(soort);
    s.strijd.stuurLeger(inh, true);
    const tel = { opMuur0: op0, opToren0: tor0, gewicht: Math.round(g), inh: JSON.stringify(inh) };
    const voor = new Map(); for (let v2 = 0; v2 < B * K.hoogte; v2++) if (K.eigenaar[v2] === 1 && K.object[v2]) voor.set(v2, K.object[v2]);
    const fasen = new Set(); let schildMax = 0;
    for (let i = 0; i < 3000; i++) {
      s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap();
      for (const g2 of v.groepen()) fasen.add(g2.fase);
      schildMax = Math.max(schildMax, s.strijd.vijanden().filter((e) => !e.dood && e.krijg && e.krijg.tak && (e.krijg.tak.mars || e.krijg.tak.rem || e.krijg.tak.verzamel >= 0)).length);
      if (s.strijd.uitslag && s.strijd.uitslag()) { tel.uitslag = s.strijd.uitslag() + '@' + i / 10; break; }
    }
    let torenWeg = 0, muurWeg = 0; for (const [v2, o] of voor) if (K.object[v2] !== o) { if (o === 5) torenWeg++; else muurWeg++; }
    Object.assign(tel, { fasen: [...fasen].join(','), torenWeg, muurWeg, opMuurEind: telB(), jijEind: s.leger.lijst.filter((e) => !e.dood && e.soldaat && e.soldaat.sleutel !== 'koning').length, roodOver: s.strijd.vijanden().filter((e) => !e.dood && e.krijg && e.krijg.tak && e.krijg.tak.groep).length, schildMax,
      meld: s.ui.logboek().map((x) => x.tekst).filter((t) => /catapult|collapse|Attack|storm|advance/i.test(t)).join(' | ') });
    return tel;
  }, soort);
  uit[soort] = r;
  await p.context().close();
}
const be = uit.belegering, bs = uit.bestorming;
check('zware verdediging op de muur: aanval tot het maximum (60)', be.gewicht >= 55, be.gewicht);
check('belegering neemt meerdere katapulten mee', (JSON.parse(be.inh).katapult || 0) >= 3, be.inh);
check('bestorming neemt katapulten mee tegen volle torens', (JSON.parse(bs.inh).katapult || 0) >= 1, bs.inh);
check('katapulten richten op een volle toren', /shell your .* tower/.test(be.meld), be.meld);
check('een toren valt en de schutters erop vallen eraf', be.torenWeg >= 1 && /collapses/.test(be.meld), be.meld);
check('schutters sneuvelen door het instorten', be.opMuurEind < be.opMuur0, be.opMuurEind);
check('rood heeft schilden op in opmars en verzamelen', be.schildMax >= 20 && bs.schildMax >= 20, be.schildMax + '/' + bs.schildMax);
check('alle fasen doorlopen', /verzamel/.test(be.fasen) && /beleg/.test(be.fasen) && /opmars/.test(be.fasen) && /aanval/.test(be.fasen), be.fasen);
console.log(`torens106: ${goed} goed, ${fout} fout`);
await b.close(); srv.kill();
