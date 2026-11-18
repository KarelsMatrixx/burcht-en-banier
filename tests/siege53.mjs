// 0.68.2: stormrammen en katapulten van rood slaan niet op het hoofdkasteel zelf,
// maar op muren, poorten en torens (daarna op de overige bouwwerken).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const poort = 8353;
const srv = spawn('python3', ['-m', 'http.server', String(poort)], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true })).newPage();
const fouten = []; p.on('pageerror', (e) => fouten.push(String(e)));
let ok = 0, fout = 0; const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
const wacht = () => p.waitForFunction(() => window.spel && window.spel.strijd, null, { timeout: 20000 });
const url = `http://localhost:${poort}/`;
for (const lv of [1, 3]) {
  await p.goto(url); await wacht();
  await p.evaluate(([lv]) => {
    localStorage.clear(); sessionStorage.clear(); localStorage.setItem('tipGesloten', '1');
    localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar: lv === 1 ? [] : [1, 2] }));
    localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: lv }));
    sessionStorage.setItem('burcht-banier.geenTitel', '1');
  }, [lv]);
  await p.reload(); await wacht(); await p.waitForTimeout(300);
  await p.tap('#missie-begin');
  const r = await p.evaluate(() => {
    const s = window.spel; const bu = s.strijd.burcht();
    for (const k of ['hout', 'steen', 'goud', 'planken', 'koper', 'voedsel']) s.economie.voorraad[k] = 999;
    // Een kazerne van jou, ver van het hoofdkasteel: de machine mag daar op afgaan als er geen muur is.
    const K = s.kaart, st = K.start[0], W = s.wegvinder;
    let kz = null;
    for (let y = st.y + 6; y < st.y + 22 && !kz; y++) for (let x = st.x - 8; x < st.x + 8 && !kz; x++) {
      if (W.isVrij(x, y, 0) && !s.bouwer.waaromNiet(x, y, s.bouwwerken.kazerne)) kz = { x, y };
    }
    const geplaatst = kz ? s.bouwer.plaats(s.bouwwerken.kazerne, [kz]) : 0;
    const n = s.strijd.stuurLeger({ ram: 2, katapult: 2 }, false);
    const gezien = {}; let burchtDoel = 0; let metBouw = 0;
    const machines = () => s.strijd.vijanden().filter((e) => e.krijg && e.krijg.def.alleenBouw);
    for (let i = 0; i < 6000; i++) {
      s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap();
      for (const e of machines()) {
        const t = e.krijg.bouw;
        if (!t) continue;
        metBouw++;
        if (t.burcht) burchtDoel++;
        gezien[t.soort] = (gezien[t.soort] || 0) + 1;
      }
    }
    return { geplaatst, gestuurd: n, aantal: machines().length, gezien, burchtDoel, metBouw, burchtLeven: s.strijd.burcht().leven };
  });
  console.log(`level ${lv}:`, JSON.stringify(r));
  check(`level ${lv}: machines gestuurd`, r.gestuurd >= 2, r.gestuurd);
  check(`level ${lv}: een machine slaat op een bouwwerk van jou (geen hoofdkasteel)`, r.metBouw > 0 && Object.keys(r.gezien).every((k) => +k !== 7 && +k !== 8 && +k !== 9), JSON.stringify(r.gezien));
  check(`level ${lv}: een machine kiest het hoofdkasteel nooit als doel`, r.burchtDoel === 0, r.burchtDoel);
}
check('geen scriptfouten', fouten.length === 0, fouten.join(' | '));
console.log(`OK ${ok}, FOUT ${fout}`);
await b.close(); srv.kill();
process.exit(fout ? 1 : 0);
