// WEGVINDEN: zoekt de kortste route over de kaart, om water, bomen en
// rotsen heen. De methode heet A* ("A ster") en is de standaard hiervoor.
//
// Twee dingen houden dit snel:
//   1. Het geheugen voor een zoektocht wordt hergebruikt.
//   2. Vooraf wordt bepaald welke stukken kaart aan elkaar vastzitten.
//      Ligt het doel in een ander stuk, dan zoeken we niet eens.
//
// Later komen hier muren, trappen, ladders en belegeringstorens bij.
// Na elke verandering aan de kaart moet herbereken() worden aangeroepen.

import { GROND, OBJECT } from './kaart.js';

export const BREEK = 2;   // zie hieronder bij "beeld"

const SCHUIN = Math.SQRT2;
const TRAP = 2;           // de muur op of af kost zoveel als twee tegels lopen
// De acht richtingen: eerst recht, dan schuin.
const RX = [1, -1, 0, 0, 1, 1, -1, -1];
const RY = [0, 0, 1, -1, 1, -1, 1, -1];

export function maakWegvinder(kaart) {
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const N = B * H;

  // Elk team heeft zijn eigen beeld van de kaart: door je eigen poort kun
  // je lopen, door die van een ander niet. Team 0 is de speler, team 1 de
  // vijand. Beeld 2 (BREEK) is de kaart zoals de vijand hem ziet als hij
  // door de bouwwerken van de speler heen zou breken: zo vindt hij de plek
  // waar hij moet beuken als je burcht helemaal is ommuurd.
  const BEELDEN = 3;
  const vrijVan = [new Uint8Array(N), new Uint8Array(N), new Uint8Array(N)];       // 1 = hier kun je lopen
  const gebiedVan = [new Int32Array(N), new Int32Array(N), new Int32Array(N)];     // nummer van het aaneengesloten stuk, 0 = geen
  const grootsteVan = [0, 0, 0];
  // De muur als tweede verdieping, per team. Over je eigen muren, torens
  // en poorten kun je lopen; omhoog en omlaag gaat via een toren, een
  // wachttoren of een poort (daar zit een trap in).
  const muurVan = [new Uint8Array(N), new Uint8Array(N)];       // 1 = hier kun je over de muur lopen
  const opgangVan = [new Uint8Array(N), new Uint8Array(N)];     // 1 = hier kun je de muur op en af
  const opgangen = [0, 0];
  // Ladders: een team kan een ladder tegen een muur van de ander zetten.
  // Daar kan dat team de muur op en aan beide kanten weer af, en over het
  // stuk muur van de ander dat eraan vastzit lopen.
  const ladderVan = [new Uint8Array(N), new Uint8Array(N)];
  let vrij = vrijVan[0];        // het beeld van het team waar we nu voor rekenen
  let gebied = gebiedVan[0];
  let grootsteGebied = 0;
  const kiesTeam = (team) => {
    vrij = vrijVan[team];
    gebied = gebiedVan[team];
    grootsteGebied = grootsteVan[team];
  };

  // Geheugen voor een zoektocht, steeds hergebruikt. Twee keer zo groot als
  // de kaart: vak + N is hetzelfde vak een verdieping hoger, op de muur.
  const kosten = new Float32Array(N * 2);
  const vorige = new Int32Array(N * 2);
  const gezien = new Uint32Array(N * 2);   // in welke zoektocht is dit vak aangeraakt
  const klaar = new Uint32Array(N * 2);    // in welke zoektocht is dit vak afgehandeld
  let zoektocht = 0;

  // Een "hoop": geeft steeds snel het vak met de laagste verwachte kosten.
  const hoopVak = new Int32Array(N * 16);
  const hoopSleutel = new Float32Array(N * 16);
  let hoopAantal = 0;

  function duw(vak, sleutel) {
    let i = hoopAantal++;
    while (i > 0) {
      const ouder = (i - 1) >> 1;
      if (hoopSleutel[ouder] <= sleutel) break;
      hoopVak[i] = hoopVak[ouder];
      hoopSleutel[i] = hoopSleutel[ouder];
      i = ouder;
    }
    hoopVak[i] = vak;
    hoopSleutel[i] = sleutel;
  }

  function pak() {
    const bovenste = hoopVak[0];
    hoopAantal--;
    const vak = hoopVak[hoopAantal];
    const sleutel = hoopSleutel[hoopAantal];
    let i = 0;
    for (;;) {
      let kind = 2 * i + 1;
      if (kind >= hoopAantal) break;
      if (kind + 1 < hoopAantal && hoopSleutel[kind + 1] < hoopSleutel[kind]) kind++;
      if (hoopSleutel[kind] >= sleutel) break;
      hoopVak[i] = hoopVak[kind];
      hoopSleutel[i] = hoopSleutel[kind];
      i = kind;
    }
    hoopVak[i] = vak;
    hoopSleutel[i] = sleutel;
    return bovenste;
  }

  // Schatting van de resterende afstand, als er niets in de weg stond.
  function schat(x, y, dx, dy) {
    const ax = Math.abs(x - dx);
    const ay = Math.abs(y - dy);
    return ax + ay + (SCHUIN - 2) * Math.min(ax, ay);
  }

  // Bepaalt opnieuw waar je kunt lopen en welke stukken aan elkaar zitten,
  // voor elk team apart.
  function herbereken() {
    for (let beeld = 0; beeld < BEELDEN; beeld++) herberekenVoor(beeld);
    for (let team = 0; team < 2; team++) {
      let aantal = 0;
      const ander = team === 0 ? 2 : 1;
      const stapel = [];
      for (let i = 0; i < N; i++) {
        const soort = kaart.object[i];
        const eigen = kaart.eigenaar[i] === team + 1;
        const trap = soort === OBJECT.TOREN || soort === OBJECT.WACHTTOREN || soort === OBJECT.POORT;
        muurVan[team][i] = eigen && (trap || soort === OBJECT.MUUR) ? 1 : 0;
        opgangVan[team][i] = eigen && trap ? 1 : 0;
        // Een ladder staat alleen zolang de muur van de ander er nog staat.
        if (ladderVan[team][i] && !(kaart.object[i] === OBJECT.MUUR && kaart.eigenaar[i] === ander)) ladderVan[team][i] = 0;
        if (ladderVan[team][i]) {
          muurVan[team][i] = 1;
          opgangVan[team][i] = 1;
          stapel.push(i);
        }
        aantal += opgangVan[team][i];
      }
      // Vanaf een ladder kun je over de muur van de ander lopen, zover die doorloopt.
      while (stapel.length) {
        const vak = stapel.pop();
        const x = vak % B;
        const y = (vak - x) / B;
        for (let r = 0; r < 4; r++) {
          const nx = x + RX[r];
          const ny = y + RY[r];
          if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
          const buur = ny * B + nx;
          if (muurVan[team][buur] || kaart.eigenaar[buur] !== ander) continue;
          const soort = kaart.object[buur];
          if (soort !== OBJECT.MUUR && soort !== OBJECT.TOREN && soort !== OBJECT.WACHTTOREN && soort !== OBJECT.POORT) continue;
          muurVan[team][buur] = 1;
          stapel.push(buur);
        }
      }
      opgangen[team] = aantal;
    }
  }

  let poortenOpen = false;   // proloog: de poort van de speler staat open voor rood
  function herberekenVoor(beeld) {
    kiesTeam(beeld);
    const team = beeld === BREEK ? 1 : beeld;
    for (let i = 0; i < N; i++) {
      const land = kaart.grond[i] !== GROND.WATER;
      // Een poort die je zelf hebt gebouwd is voor jouw team een doorgang.
      // In de proloog gaat jouw poort van binnenuit open: dan is hij ook voor rood een doorgang.
      const eigenPoort = kaart.object[i] === OBJECT.POORT && (kaart.eigenaar[i] === team + 1 || (poortenOpen && team === 1 && kaart.eigenaar[i] === 1));
      // Wat de speler heeft gebouwd, kan de vijand kapotmaken.
      const breekbaar = beeld === BREEK && kaart.eigenaar[i] === 1;
      vrij[i] = land && (kaart.object[i] === OBJECT.GEEN || eigenPoort || breekbaar) ? 1 : 0;
    }
    gebied.fill(0);
    const stapel = new Int32Array(N);
    let nummer = 0;
    let grootste = 0;
    for (let begin = 0; begin < N; begin++) {
      if (!vrij[begin] || gebied[begin]) continue;
      nummer++;
      let aantal = 0;
      let top = 0;
      stapel[top++] = begin;
      gebied[begin] = nummer;
      while (top > 0) {
        const vak = stapel[--top];
        aantal++;
        const x = vak % B;
        const y = (vak - x) / B;
        for (let r = 0; r < 4; r++) {
          const nx = x + RX[r];
          const ny = y + RY[r];
          if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
          const buur = ny * B + nx;
          if (vrij[buur] && !gebied[buur]) {
            gebied[buur] = nummer;
            stapel[top++] = buur;
          }
        }
      }
      if (aantal > grootste) {
        grootste = aantal;
        grootsteVan[beeld] = nummer;
      }
    }
  }

  // Geeft de route als lijst vakken (zonder het startvak, met het doel),
  // of null als er geen route bestaat.
  function zoekPad(sx, sy, dx, dy, team = 0) {
    kiesTeam(team);
    const start = sy * B + sx;
    const doel = dy * B + dx;
    if (!vrij[start] || !vrij[doel] || gebied[start] !== gebied[doel]) return null;
    if (start === doel) return [];

    zoektocht++;
    hoopAantal = 0;
    kosten[start] = 0;
    gezien[start] = zoektocht;
    duw(start, schat(sx, sy, dx, dy));

    while (hoopAantal > 0) {
      const vak = pak();
      if (vak === doel) break;
      if (klaar[vak] === zoektocht) continue;
      klaar[vak] = zoektocht;
      const x = vak % B;
      const y = (vak - x) / B;
      const totHier = kosten[vak];

      for (let r = 0; r < 8; r++) {
        const nx = x + RX[r];
        const ny = y + RY[r];
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const buur = ny * B + nx;
        if (!vrij[buur] || klaar[buur] === zoektocht) continue;
        // Niet schuin langs de hoek van een obstakel snijden.
        if (r >= 4 && (!vrij[y * B + nx] || !vrij[ny * B + x])) continue;
        const nieuw = totHier + (r >= 4 ? SCHUIN : 1);
        if (gezien[buur] !== zoektocht || nieuw < kosten[buur]) {
          gezien[buur] = zoektocht;
          kosten[buur] = nieuw;
          vorige[buur] = vak;
          duw(buur, nieuw + schat(nx, ny, dx, dy));
        }
      }
    }

    const pad = [];
    for (let vak = doel; vak !== start; vak = vorige[vak]) pad.push(vak);
    pad.reverse();
    return pad;
  }

  // De route voor wie ook over de muur kan (de soldaten van de speler).
  // van en naar zijn knopen: een vak op de grond, of vak + N voor datzelfde
  // vak boven op de muur. Geeft de route als lijst knopen (zonder het
  // begin, met het doel), of null als er geen route is.
  function zoekPadLagen(van, naar, team = 0) {
    kiesTeam(team);
    const muur = muurVan[team];
    const opgang = opgangVan[team];
    const kan = (knoop) => (knoop >= N ? muur[knoop - N] === 1 : vrij[knoop] === 1);
    if (van < 0 || naar < 0 || van >= N * 2 || naar >= N * 2 || !kan(van) || !kan(naar)) return null;
    if (van === naar) return [];
    // Zonder een enkele trap is het de gewone zoektocht over de grond.
    if (!opgangen[team]) {
      if (van >= N || naar >= N) return null;
      return zoekPad(van % B, Math.floor(van / B), naar % B, Math.floor(naar / B), team);
    }
    const doelVak = naar >= N ? naar - N : naar;
    const dx = doelVak % B;
    const dy = (doelVak - dx) / B;
    const beginVak = van >= N ? van - N : van;

    zoektocht++;
    hoopAantal = 0;
    kosten[van] = 0;
    gezien[van] = zoektocht;
    duw(van, schat(beginVak % B, Math.floor(beginVak / B), dx, dy));
    let gevonden = false;

    while (hoopAantal > 0) {
      const knoop = pak();
      if (knoop === naar) {
        gevonden = true;
        break;
      }
      if (klaar[knoop] === zoektocht) continue;
      klaar[knoop] = zoektocht;
      const boven = knoop >= N;
      const vak = boven ? knoop - N : knoop;
      const x = vak % B;
      const y = (vak - x) / B;
      const totHier = kosten[knoop];

      for (let r = 0; r < 8; r++) {
        const nx = x + RX[r];
        const ny = y + RY[r];
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        const buur = ny * B + nx;
        // Hooguit twee mogelijkheden per buur: op dezelfde verdieping verder, of de trap.
        let doel1 = -1;
        let prijs1 = 0;
        let doel2 = -1;
        if (!boven) {
          if (vrij[buur] && !(r >= 4 && (!vrij[y * B + nx] || !vrij[ny * B + x]))) {
            doel1 = buur;
            prijs1 = r >= 4 ? SCHUIN : 1;
          }
          if (r < 4 && opgang[buur]) doel2 = N + buur;       // de trap op
        } else if (r < 4) {
          if (muur[buur]) {
            doel1 = N + buur;
            prijs1 = 1;
          }
          if (opgang[vak] && vrij[buur]) doel2 = buur;        // de trap af
        }
        for (let keer = 0; keer < 2; keer++) {
          const naarKnoop = keer ? doel2 : doel1;
          if (naarKnoop < 0 || klaar[naarKnoop] === zoektocht) continue;
          const nieuw = totHier + (keer ? TRAP : prijs1);
          if (gezien[naarKnoop] !== zoektocht || nieuw < kosten[naarKnoop]) {
            gezien[naarKnoop] = zoektocht;
            kosten[naarKnoop] = nieuw;
            vorige[naarKnoop] = knoop;
            duw(naarKnoop, nieuw + schat(nx, ny, dx, dy));
          }
        }
      }
    }
    if (!gevonden) return null;
    const pad = [];
    for (let knoop = naar; knoop !== van; knoop = vorige[knoop]) pad.push(knoop);
    pad.reverse();
    return pad;
  }

  // Een willekeurig vak waar dit team kan lopen, in het grootste stuk kaart.
  // Met midden en straal zoekt hij alleen in de buurt van dat punt.
  function willekeurigVak(toeval, midden, straal, team = 0) {
    kiesTeam(team);
    for (let poging = 0; poging < 200; poging++) {
      let x;
      let y;
      if (midden) {
        x = Math.round(midden.x + (toeval() * 2 - 1) * straal);
        y = Math.round(midden.y + (toeval() * 2 - 1) * straal);
        if (x < 0 || y < 0 || x >= B || y >= H) continue;
      } else {
        x = Math.floor(toeval() * B);
        y = Math.floor(toeval() * H);
      }
      const vak = y * B + x;
      if (vrij[vak] && gebied[vak] === grootsteGebied) return vak;
    }
    return -1;
  }

  herbereken();
  return {
    herbereken,
    // Proloog: de poorten van de speler open voor rood. Daarna herbereken().
    zetPoortenOpen: (aan) => { poortenOpen = !!aan; },
    zoekPad,
    willekeurigVak,
    isVrij: (x, y, team = 0) => x >= 0 && y >= 0 && x < B && y < H && vrijVan[team][y * B + x] === 1,
    zoekPadLagen,
    // Kun je hier over de muur lopen, en kun je hier de muur op en af?
    isMuur: (x, y, team = 0) => x >= 0 && y >= 0 && x < B && y < H && muurVan[team][y * B + x] === 1,
    isOpgang: (x, y, team = 0) => x >= 0 && y >= 0 && x < B && y < H && opgangVan[team][y * B + x] === 1,
    aantalOpgangen: (team = 0) => opgangen[team],
    // Ladders: zet er een (of haal hem weg) en vraag waar ze staan.
    // Daarna herbereken() aanroepen.
    zetLadder: (vak, team, aan = true) => {
      if (vak >= 0 && vak < N) ladderVan[team][vak] = aan ? 1 : 0;
    },
    isLadder: (vak, team = 0) => vak >= 0 && vak < N && ladderVan[team][vak] === 1,
    ladders: (team = 0) => {
      const lijst = [];
      for (let i = 0; i < N; i++) if (ladderVan[team][i]) lijst.push(i);
      return lijst;
    },
    // Kun je van het ene vak naar het andere lopen? (Zonder de route te zoeken.)
    verbonden: (van, naar, team = 0) =>
      vrijVan[team][van] === 1 && vrijVan[team][naar] === 1 && gebiedVan[team][van] === gebiedVan[team][naar],
  };
}
