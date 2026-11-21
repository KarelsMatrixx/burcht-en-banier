// Versie 0.71.0: rood verzamelt buiten bereik en marcheert samen op; machines lopen nooit alleen voorop.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const srv = spawn('python3', ['-m', 'http.server', '8277'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const fouten = []; let ok = 0, fout = 0;
const check = (n, w, x = '') => { if (w) ok++; else { fout++; console.log('FOUT:', n, x); } };
async function start(l, klaar) {
  const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  p.on('pageerror', (e) => fouten.push(String(e)));
  await p.goto('http://localhost:8277/'); await p.waitForFunction(() => window.spel && window.spel.strijd);
  await p.evaluate(([l, klaar]) => { localStorage.clear(); localStorage.setItem('burcht-banier.campagne', JSON.stringify({ klaar })); localStorage.setItem('burcht-banier.modus', JSON.stringify({ soort: 'campagne', missie: l })); sessionStorage.setItem('burcht-banier.geenTitel', '1'); }, [l, klaar]);
  await p.reload(); await p.waitForFunction(() => window.spel && window.spel.strijd); await p.waitForTimeout(300);
  await p.evaluate(() => window.spel.strijd.pauzeer(true));
  return p;
}
// Een ringmuur van straal 6 om jouw burcht, een poort aan de oostkant, en een paar ridders binnen.
const proef = (p, leger) => p.evaluate((leger) => {
  const s = window.spel; const k = s.kaart; const m = s.strijd.burcht(); const r = 6;
  for (let d = -r; d <= r; d++) for (const [x, y] of [[m.x + d, m.y - r], [m.x + d, m.y + r], [m.x - r, m.y + d], [m.x + r, m.y + d]]) {
    if (x < 0 || y < 0 || x >= k.breedte || y >= k.hoogte || (k.object[y * k.breedte + x] !== 0 && k.object[y * k.breedte + x] !== 1)) continue;
    s.bouwer.zetVast(y * k.breedte + x, x === m.x + r && y === m.y ? 6 : 4);
  }
  s.wegvinder.herbereken(); s.strijd.kaartVeranderd();
  s.strijd.stuurLeger(leger, true);
  const veld = s.veld; const out = { meldingen: [], fasen: [], ramAanMuur: null, begeleiding: null, ramVoorRidder: 0, maxVoorsprong: 0 };
  const groepen0 = veld.groepen(); out.groepen = groepen0;
  const hoofd = groepen0.find((g) => g.hoofd);
  out.rally = hoofd ? hoofd.rally : -1;
  const B = k.breedte;
  const aanvallers = () => s.strijd.vijanden().filter((e) => e.wachter === undefined && !e.koning && !e.lijfwacht && !e.dood);
  const machine = (e) => { const d = s.regels.soldaten[e.vijand]; return d && (d.alleenBouw || d.ladder); };
  const melee = (e) => { const d = s.regels.soldaten[e.vijand]; return d && !machine(e) && !(d.bereik > 2) && !d.steun; };
  const eind = () => { const g = (s.veld.groepen().find((x) => x.hoofd)); return null; };
  let vorige = '';
  for (let i = 0; i < 4000; i++) {
    s.eenheden.stap(0.1); s.leger.stap(); s.strijd.stap();
    const g = s.veld.groepen().find((x) => x.hoofd);
    const f = g ? (g.fase === 'beleg' ? 'verzamel' : g.fase) : 'weg';
    if (f !== vorige) { out.fasen.push([f, i / 10]); vorige = f; }
    const a = aanvallers();
    const hoofdId = g ? g.id : -1;
    const inHoofd = (e) => e.krijg && e.krijg.tak && e.krijg.tak.groep === hoofdId;
    const rams = a.filter(machine), mel = a.filter((e) => melee(e) && inHoofd(e));
    // Tijdens de opmars: loopt een machine voor de voorste ridder uit (richting jouw burcht)?
    if (f === 'opmars' && rams.length && mel.length) {
      const ei = g.eind || m; const dk = (e) => Math.hypot(e.x - ei.x, e.y - ei.y);   // tot het doel van de groep (de bres)
      const voor = Math.min(...mel.map(dk));
      const v = voor - Math.min(...rams.map(dk));
      out.maxVoorsprong = Math.max(out.maxVoorsprong, v);
    }
    if (out.ramAanMuur === null) {
      const r0 = rams.find((e) => Math.hypot(e.x - m.x, e.y - m.y) <= r + 2);
      if (r0) { out.ramAanMuur = i / 10; out.begeleiding = mel.filter((e) => Math.hypot(e.x - r0.x, e.y - r0.y) <= 5).length; }
    }
  }
  out.logboek = s.ui.logboek().slice(-6).map((x) => x.tekst || x);
  return out;
}, leger);

let p = await start(5, [1, 2, 3, 4]);
const r = await proef(p, { zwaardvechter: 4, ridder: 4, boogschutter: 3, ram: 2, ladder: 1 });
console.log(JSON.stringify({ fasen: r.fasen, rally: r.rally, ram: r.ramAanMuur, beg: r.begeleiding, voor: +r.maxVoorsprong.toFixed(1) }));
check('er is een verzamelpunt', r.rally >= 0, r.rally);
check('eerst verzamelen, dan opmars, dan aanval', r.fasen.map((x) => x[0]).join('>').startsWith('verzamel>opmars>aanval'), JSON.stringify(r.fasen));
check('een ram bereikt de muur', r.ramAanMuur !== null, r.ramAanMuur);
check('bij de ram staan minstens 2 ridders of zwaardvechters', r.begeleiding >= 2, r.begeleiding);
check('een machine loopt in de opmars nooit meer dan 1,5 tegel (gemeten tot de bres) voor de ridders uit', r.maxVoorsprong <= 1.5, r.maxVoorsprong);
check('melding verzamelen', r.logboek.some((x) => /gathers/.test(JSON.stringify(x))), JSON.stringify(r.logboek));
await p.context().close();
check('geen paginafouten', fouten.length === 0, fouten.join('|'));
console.log('opmars40:', ok, 'goed,', fout, 'fout');
await b.close(); srv.kill(); process.exit(fout ? 1 : 0);
