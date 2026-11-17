// TEKENLAAG: tekent de kaart en alles wat erop staat. Deze module
// verandert niets aan het spel, hij laat alleen zien wat er is.
//
// Het tekenen gaat in twee rondes:
//   1. Alle grond. Grond is plat en kan nooit iets verbergen.
//   2. Alles wat rechtop staat (bomen, rotsen, muren, soldaten), van
//      achter naar voren. Zo loopt een soldaat achter een toren langs
//      als hij erachter staat, en ervoor als hij ervoor staat.
//
// Tussen die twee rondes komen de slagschaduwen van muren en huizen.
//
// "Diepte" is x + y in rastermaat: hoe groter, hoe verder naar voren.

import { CONFIG } from './config.js';
import { GROND_ASSET, OBJECT_ASSET, OBJECT, GROND, aansluiting } from './kaart.js';
import { maakNabewerking } from './nabewerking.js';
import { maakSfeer, tekenSchaduw } from './sfeer.js';
import { maakLandschap } from './landschap.js';
import { wereldNaarRaster, HALVE_BREEDTE, HALVE_HOOGTE, TEGEL_HOOGTE } from './iso.js';
import { tekenLadderOp } from './kunst.js';

// De zwarte ruiter met Wessel (proloog). Getekend rond (0, 0) = de grond onder het paard, kijkend naar rechts.
function tekenRuiter(ctx, galop, nu) {
  const g2 = Math.sin(nu / 70 + 1.6);
  const op = galop * 0.8;   // het lijf deint mee
  // schaduw
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath(); ctx.ellipse(1, 0.5, 15, 3.6, 0, 0, Math.PI * 2); ctx.fill();
  // benen: twee delen met een knie, en hoeven
  const been = (hx, hy, fase, voor) => {
    const s1 = Math.sin(fase);
    const kx = hx + s1 * 3.5 + (voor ? 1 : -1);
    const ky = hy + 5.5;
    const vx = kx + Math.sin(fase - (voor ? 0.9 : -0.9)) * 3.2;
    const vy = Math.min(-0.5, ky + 5.5 - Math.max(0, Math.cos(fase)) * 2.2);
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(vx, vy); ctx.stroke();
    ctx.fillStyle = '#0b0908'; ctx.fillRect(vx - 1.3, vy - 0.4, 2.8, 1.6);
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#141010'; ctx.lineWidth = 2.4;
  been(-8, -10 + op, nu / 70 + 3.1, false);   // achterbenen (verre kant eerst)
  been(7, -10 + op, nu / 70 + 1.2, true);
  ctx.strokeStyle = '#2a201b';
  been(-6, -10 + op, nu / 70, false);
  been(9, -10 + op, nu / 70 + 2.2, true);
  // staart, wapperend
  ctx.strokeStyle = '#0c0a09'; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.moveTo(-12, -15 + op); ctx.quadraticCurveTo(-18, -14 + g2 * 2, -20, -8 + g2 * 2.5); ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(-12, -14 + op); ctx.quadraticCurveTo(-17, -11 + g2, -18, -5 + g2 * 2); ctx.stroke();
  // lijf met glans
  const lijf = ctx.createLinearGradient(0, -18 + op, 0, -5 + op);
  lijf.addColorStop(0, '#4a3c34'); lijf.addColorStop(0.45, '#241c18'); lijf.addColorStop(1, '#100c0a');
  ctx.fillStyle = lijf;
  ctx.beginPath(); ctx.ellipse(0, -12 + op, 13, 5.8, 0, 0, Math.PI * 2); ctx.fill();
  // hals en kop
  ctx.beginPath();
  ctx.moveTo(8, -16 + op); ctx.quadraticCurveTo(12, -25 + op, 16, -27 + op);
  ctx.lineTo(21, -23 + op); ctx.lineTo(22.5, -20.5 + op); ctx.lineTo(19.5, -19.5 + op);
  ctx.quadraticCurveTo(15, -18 + op, 12, -10 + op); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#3a2e28';
  ctx.beginPath(); ctx.moveTo(15.5, -27.5 + op); ctx.lineTo(16.5, -30.5 + op); ctx.lineTo(17.8, -27 + op); ctx.closePath(); ctx.fill();   // oor
  ctx.fillStyle = '#e8c070'; ctx.fillRect(18.2, -25 + op, 1.1, 1.1);   // oog in het fakkellicht
  // manen
  ctx.strokeStyle = '#080606'; ctx.lineWidth = 1.2;
  for (let m = 0; m < 5; m++) {
    const mx = 9 + m * 1.6, my = -18 - m * 1.9 + op;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx - 3 + g2, my + 2.5); ctx.stroke();
  }
  // teugels
  ctx.strokeStyle = '#7a1a14'; ctx.lineWidth = 0.7;
  ctx.beginPath(); ctx.moveTo(20.5, -21 + op); ctx.lineTo(7, -24 + op); ctx.stroke();
  // dekkleed: zwart met een donkerrode zoom
  ctx.fillStyle = '#121012';
  ctx.beginPath(); ctx.moveTo(-9, -17 + op); ctx.lineTo(7, -17 + op); ctx.lineTo(9, -7 + op); ctx.lineTo(-11, -7 + op); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#6e1712'; ctx.fillRect(-11, -8 + op, 20, 1.3);
  ctx.fillStyle = '#9a8a6a'; ctx.beginPath(); ctx.arc(-1, -12 + op, 1.6, 0, Math.PI * 2); ctx.fill();   // speld
  // Wessel dwars over het paard, voor het zadel: armen en benen hangen omlaag
  ctx.fillStyle = '#2f5fc4'; ctx.fillRect(2, -21.5 + op, 8, 4.2);
  ctx.fillStyle = '#244a9a'; ctx.fillRect(2, -18.2 + op, 8, 1);
  ctx.strokeStyle = '#2f5fc4'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(9.5, -18 + op); ctx.lineTo(10.5 + g2 * 0.6, -13 + op); ctx.stroke();   // arm
  ctx.strokeStyle = '#4a3a2a';
  ctx.beginPath(); ctx.moveTo(2.5, -18 + op); ctx.lineTo(1.5 - g2 * 0.6, -13.5 + op); ctx.moveTo(4, -18 + op); ctx.lineTo(3.5 - g2 * 0.5, -13 + op); ctx.stroke();   // benen
  ctx.fillStyle = '#e0b890'; ctx.beginPath(); ctx.arc(11.4, -18.6 + op, 1.9, 0, Math.PI * 2); ctx.fill();   // hoofd
  ctx.fillStyle = '#7a5530'; ctx.beginPath(); ctx.arc(11.6, -19.6 + op, 1.6, Math.PI, 0); ctx.fill();   // haar
  // de ruiter: wapperende mantel, been in de stijgbeugel, harnas, helm met pluim
  ctx.fillStyle = '#0a0809';
  ctx.beginPath(); ctx.moveTo(-1, -33 + op); ctx.quadraticCurveTo(-10, -30 + g2 * 2, -16, -22 + g2 * 3); ctx.lineTo(-9, -19 + op); ctx.lineTo(-2, -21 + op); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1c1a1c'; ctx.fillRect(-2.5, -21 + op, 3, 7);   // been
  ctx.fillStyle = '#5a5a60'; ctx.fillRect(-3, -14.5 + op, 4, 1.2);   // stijgbeugel
  const harnas = ctx.createLinearGradient(-4, -33, 3, -33);
  harnas.addColorStop(0, '#2a2a30'); harnas.addColorStop(0.5, '#5a5c66'); harnas.addColorStop(1, '#1e1e24');
  ctx.fillStyle = harnas;
  ctx.beginPath(); ctx.moveTo(-4.5, -32 + op); ctx.lineTo(2.5, -32 + op); ctx.lineTo(1.5, -21 + op); ctx.lineTo(-4, -21 + op); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#121012'; ctx.fillRect(-4.2, -24 + op, 6, 1.4);   // riem
  ctx.fillStyle = '#3c3e46';
  ctx.beginPath(); ctx.arc(-1, -35.5 + op, 3.4, 0, Math.PI * 2); ctx.fill();   // helm
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-0.2, -36.3 + op, 3.4, 0.9);   // vizier
  ctx.strokeStyle = '#0d0b0b'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-1, -38.5 + op); ctx.quadraticCurveTo(-5, -42 + g2, -9, -40 + g2 * 1.5); ctx.stroke();   // pluim
  // arm met de teugels
  ctx.strokeStyle = '#2e2e34'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(1, -30 + op); ctx.lineTo(6, -25 + op); ctx.stroke();
  // lans met de zwarte banier (de Rouwbanier)
  ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-5, -18 + op); ctx.lineTo(-5, -52 + op); ctx.stroke();
  ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.moveTo(-5.8, -52 + op); ctx.lineTo(-5, -55 + op); ctx.lineTo(-4.2, -52 + op); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#070707';
  ctx.beginPath(); ctx.moveTo(-5, -51 + op);
  ctx.quadraticCurveTo(-11, -52 + g2 * 2, -19, -50 + g2 * 2.5);
  ctx.lineTo(-17, -46 + g2); ctx.lineTo(-19, -42 + g2 * 2.5);
  ctx.quadraticCurveTo(-11, -44 + g2 * 2, -5, -43 + op); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a1210'; ctx.lineWidth = 0.6; ctx.stroke();
  // fakkel in de andere hand
  ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(2, -27 + op); ctx.lineTo(5, -36 + op); ctx.stroke();
  ctx.fillStyle = '#ff9a2e'; ctx.beginPath(); ctx.ellipse(5.4, -38.5 + op, 2.2, 3.4 + g2 * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.ellipse(5.4, -37.8 + op, 1, 1.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
}

const MAX_EENHEDEN = 4096;
const RUIMTE_ONDER = 190;   // hoge dingen net onder de rand steken nog in beeld

// Vast toevalsgetal per tegel (0 tot 1), voor verschuiving en varianten.
function tegelToeval(x, y, extra) {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(extra + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function maakTekenaar(canvas, kaart, camera, assets) {
  // Valhekken: per poorttegel hoe ver het hek omhoog is (0 dicht, 1 open). Het doel komt van main.js
  // (zetHekDoel); de stand schuift er langzaam naartoe, zo zie je het hek bewegen.
  const HEK_TEMPO = 0.45;   // deel per seconde: ruim 2 seconden van dicht naar open
  const hekNu = new Map();
  let hekDoel = () => 0;
  let hekTijd = 0;
  let hekDt = 0;
  const hekStand = (i) => {
    const doel = hekDoel(i);
    let nu = hekNu.has(i) ? hekNu.get(i) : doel;
    if (nu < doel) nu = Math.min(doel, nu + HEK_TEMPO * hekDt);
    else if (nu > doel) nu = Math.max(doel, nu - HEK_TEMPO * 1.6 * hekDt);
    hekNu.set(i, nu);
    return nu;
  };
  const ctx = canvas.getContext('2d', { alpha: false });
  // Nabewerking: standaard uit; proef met ?nabewerking=laag of ?nabewerking=hoog in de adresbalk.
  const nabewerking = maakNabewerking(new URLSearchParams(location.search).get('nabewerking') || CONFIG.beeld.nabewerking || 'uit');
  const grond = GROND_ASSET.map((naam) => assets.haal(naam));
  const objecten = OBJECT_ASSET.map((naam) => (naam ? assets.haal(naam) : null));
  // Het kasteel van rood kan in de campagne een eigen materiaal hebben (stap 33):
  // dan staan er plaatjes onder 'rood.muur', 'rood.toren', enzovoort.
  const objectenRood = OBJECT_ASSET.map((naam) => (naam && assets.heeft('rood.' + naam.split('.')[1]) ? assets.haal('rood.' + naam.split('.')[1]) : null));
  const objectOp = (i) => (kaart.eigenaar[i] === 2 && objectenRood[kaart.object[i]]) || objecten[kaart.object[i]];
  // soldaten[soort][team]
  const soldaten = [
    [assets.haal('eenheid.ridder_blauw'), assets.haal('eenheid.ridder_rood')],
    [assets.haal('eenheid.boogschutter_blauw'), assets.haal('eenheid.boogschutter_rood')],
    [assets.haal('eenheid.houthakker_blauw'), assets.haal('eenheid.houthakker_rood')],
    [assets.haal('eenheid.steenhouwer_blauw'), assets.haal('eenheid.steenhouwer_rood')],
    [assets.haal('eenheid.fruitteler_blauw'), assets.haal('eenheid.fruitteler_rood')],
    [assets.haal('eenheid.boer_blauw'), assets.haal('eenheid.boer_rood')],
    [assets.haal('eenheid.ram_blauw'), assets.haal('eenheid.ram_rood')],
    [assets.haal('eenheid.ladder_blauw'), assets.haal('eenheid.ladder_rood')],
    [assets.haal('eenheid.katapult_blauw'), assets.haal('eenheid.katapult_rood')],
    [assets.haal('eenheid.toren_blauw'), assets.haal('eenheid.toren_rood')],
    [assets.haal('eenheid.zager_blauw'), assets.haal('eenheid.zager_rood')],
    [assets.haal('eenheid.tarweboer_blauw'), assets.haal('eenheid.tarweboer_rood')],
    [assets.haal('eenheid.bakker_blauw'), assets.haal('eenheid.bakker_rood')],
    [assets.haal('eenheid.mijnwerker_blauw'), assets.haal('eenheid.mijnwerker_rood')],
    [assets.haal('eenheid.bijlridder_blauw'), assets.haal('eenheid.bijlridder_rood')],
    [assets.haal('eenheid.kruisboog_blauw'), assets.haal('eenheid.kruisboog_rood')],
    [assets.haal('eenheid.sluip_blauw'), assets.haal('eenheid.sluip_rood')],
    [assets.haal('eenheid.vlam_blauw'), assets.haal('eenheid.vlam_rood')],
    [assets.haal('eenheid.koning_blauw'), assets.haal('eenheid.koning_rood')],
    [assets.haal('eenheid.zwaard_blauw'), assets.haal('eenheid.zwaard_rood')],
    [assets.haal('eenheid.banier_blauw'), assets.haal('eenheid.banier_rood')],
    [assets.haal('eenheid.heler_blauw'), assets.haal('eenheid.heler_rood')],
    [assets.haal('eenheid.steen_blauw'), assets.haal('eenheid.steen_rood')],
    [assets.haal('eenheid.bartholt'), assets.haal('eenheid.bartholt')],
    [assets.haal('eenheid.wessel'), assets.haal('eenheid.wessel')],
    [assets.haal('eenheid.priester'), assets.haal('eenheid.priester')],
    [assets.haal('eenheid.dorp1'), assets.haal('eenheid.dorp1')],
    [assets.haal('eenheid.dorp2'), assets.haal('eenheid.dorp2')],
    [assets.haal('eenheid.dorp3'), assets.haal('eenheid.dorp3')],
    [assets.haal('eenheid.dorp4'), assets.haal('eenheid.dorp4')],
    [assets.haal('eenheid.kind'), assets.haal('eenheid.kind')],
    [assets.haal('eenheid.ruiter_blauw'), assets.haal('eenheid.ruiter_rood')],
    [assets.haal('eenheid.paardenboer_blauw'), assets.haal('eenheid.paardenboer_rood')],
  ];
  // De grond (gras, zand, water, aarde) komt uit het doorlopende landschap.
  // Alleen akkers blijven losse tegels (die zijn bewust rechthoekig).
  const landschap = maakLandschap(kaart);
  // Sfeer (stap G-A/B): echte slagschaduwen, wind, rook, water, wolken en vogels.
  // Uit te zetten met CONFIG.beeld.sfeer = false, of ?sfeer=uit in de adresbalk.
  const sfeerAan = (new URLSearchParams(location.search).get('sfeer') || (CONFIG.beeld.sfeer === false ? 'uit' : 'aan')) !== 'uit';
  const sfeer = maakSfeer(kaart, landschap);
  const basis = [1, 0, 0, 1, 0, 0];   // de cameratransformatie van dit beeld
  // Zelfbewaking: blijft het beeld langer traag (onder ongeveer 30 beelden per
  // seconde), dan gaat de wind uit. Schaduwen, rook en water blijven.
  let traagTijd = 0;
  let sfeerLicht = false;
  // Hoe sterk de wind elk soort object beweegt (scheefstand in radialen ongeveer).
  const WIEG = new Float32Array(64);
  WIEG[OBJECT.BOOM] = 0.035;
  WIEG[OBJECT.BOOMGAARD] = 0.022;
  WIEG[OBJECT.TARWEVELD] = 0.05;
  WIEG[OBJECT.VLAGGEN] = 0.045;
  let pixelRatio = 1;
  let getekend = 0;
  let inPoort = 0;   // hoeveel eenheden er dit beeld in een poort zaten

  // Per tegel vooraf uitgezocht welk plaatje erbij hoort.
  const aantalTegels = kaart.breedte * kaart.hoogte;
  const grondBeeld = new Array(aantalTegels);
  const randBeelden = new Array(aantalTegels);   // zachte randen van buren, of null
  const objectBeeld = new Array(aantalTegels);
  // Alle slagschaduwen samen, één keer vooraf getekend op een eigen doek
  // (op halve grootte: dat scheelt geheugen en maakt de rand zacht).
  const SCHADUW_SCHAAL = 0.5;
  const wereldLinks = -kaart.hoogte * HALVE_BREEDTE;
  const wereldBreed = (kaart.breedte + kaart.hoogte) * HALVE_BREEDTE;
  const wereldHoog = (kaart.breedte + kaart.hoogte) * HALVE_HOOGTE;
  const schaduwDoek = document.createElement('canvas');
  schaduwDoek.width = Math.ceil(wereldBreed * SCHADUW_SCHAAL);
  schaduwDoek.height = Math.ceil(wereldHoog * SCHADUW_SCHAAL);

  // De omtrek om een stel punten heen, voor de vorm van een slagschaduw.
  function omhulsel(punten) {
    const p = punten.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const kruis = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const onder = [];
    for (const punt of p) {
      while (onder.length >= 2 && kruis(onder[onder.length - 2], onder[onder.length - 1], punt) <= 0) onder.pop();
      onder.push(punt);
    }
    const boven = [];
    for (const punt of p.reverse()) {
      while (boven.length >= 2 && kruis(boven[boven.length - 2], boven[boven.length - 1], punt) <= 0) boven.pop();
      boven.push(punt);
    }
    return onder.slice(0, -1).concat(boven.slice(0, -1));
  }

  // Welke variant van een kasteeldeel past bij zijn buren. Bij een muur is
  // dat het masker zelf (16 varianten). Een poort heeft er twee: loopt de
  // muur van linksboven naar rechtsonder (buren op 2 en 8), dan zit de
  // doorgang in het linker zijvlak. Bij twijfel telt de kant met de
  // meeste buren, zodat de poort goed blijft staan als je ernaast sloopt.
  function variantBijBuren(asset, masker) {
    if (asset.kies !== 'poort') return masker;
    const langsX = (masker & 2 ? 1 : 0) + (masker & 8 ? 1 : 0);
    const langsY = (masker & 1 ? 1 : 0) + (masker & 4 ? 1 : 0);
    return langsX > langsY ? 1 : 0;
  }

  // Kiest per tegel de variant: bij land een willekeurige, bij muren de
  // variant die past bij de buren. Opnieuw aanroepen als de kaart verandert.
  function kiesPlaatjes() {
    const kies = (asset, x, y, extra) => {
      if (!asset || !asset.varianten) return asset;
      const nummer = asset.kies === 'toeval'
        ? Math.floor(tegelToeval(x, y, extra) * asset.varianten.length)
        : variantBijBuren(asset, aansluiting(kaart, x, y));
      const variant = asset.varianten[nummer];
      variant.spreiding = asset.spreiding;
      return variant;
    };
    // De vier buren van een tegel, in de volgorde van de randen:
    // rechtsboven, rechtsonder, linksonder, linksboven.
    const buren = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const schaduwen = new Path2D();
    for (let y = 0; y < kaart.hoogte; y++) {
      for (let x = 0; x < kaart.breedte; x++) {
        const i = y * kaart.breedte + x;
        const eigen = grond[kaart.grond[i]];
        grondBeeld[i] = kies(eigen, x, y, 3);
        objectBeeld[i] = kies(objectOp(i), x, y, 4) || null;

        // Grond met een hogere rang loopt met een zachte rand over deze tegel.
        let randen = null;
        for (let r = 0; r < 4; r++) {
          const bx = x + buren[r][0];
          const by = y + buren[r][1];
          if (bx < 0 || by < 0 || bx >= kaart.breedte || by >= kaart.hoogte) continue;
          const buurGrond = kaart.grond[by * kaart.breedte + bx];
          const buur = grond[buurGrond];
          if (buur.soort === eigen.soort || buur.rang <= eigen.rang) continue;
          // Het landschap tekent de zachte randen zelf; alleen rond akkers blijven ze nodig.
          if (buurGrond !== GROND.AKKER && kaart.grond[i] !== GROND.AKKER) continue;
          if (!randen) randen = [];
          randen.push(buur.randen[r][Math.floor(tegelToeval(x, y, 5 + r) * buur.randen[r].length)]);
        }
        // Het landschap tekent de zachte randen zelf; alleen rond akkers blijven ze nodig.
        randBeelden[i] = randen;

        // Slagschaduw: de voet van het object, opgeschoven naar linksboven.
        // (Met sfeer aan komt de schaduw uit het plaatje zelf, zie onder.)
        const hoog = !sfeerAan && objectOp(i) ? objectOp(i).hoogte : 0;
        if (hoog > 0) {
          const wx = (x - y) * HALVE_BREEDTE;
          const wy = (x + y) * HALVE_HOOGTE;
          const voet = [[wx, wy], [wx + HALVE_BREEDTE, wy + HALVE_HOOGTE], [wx, wy + TEGEL_HOOGTE], [wx - HALVE_BREEDTE, wy + HALVE_HOOGTE]];
          const dx = -0.62 * hoog;
          const dy = -0.14 * hoog;
          const vorm = omhulsel(voet.concat(voet.map(([px, py]) => [px + dx, py + dy])));
          vorm.forEach(([px, py], k) => (k ? schaduwen.lineTo(px, py) : schaduwen.moveTo(px, py)));
          schaduwen.closePath();
        }
      }
    }
    // Eén vorm voor alle schaduwen: waar ze overlappen wordt het niet
    // dubbel donker.
    const sctx = schaduwDoek.getContext('2d');
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, schaduwDoek.width, schaduwDoek.height);
    sctx.setTransform(SCHADUW_SCHAAL, 0, 0, SCHADUW_SCHAAL, -wereldLinks * SCHADUW_SCHAAL, 0);
    sctx.fillStyle = '#140e04';
    sctx.fill(schaduwen);
    if (!sfeerAan) return;
    // Echte slagschaduwen: het silhouet van elk plaatje, schuin over de grond
    // gelegd. Alles in één doek, zodat overlappende schaduwen niet dubbel
    // donker worden.
    const sbasis = [SCHADUW_SCHAAL, 0, 0, SCHADUW_SCHAAL, -wereldLinks * SCHADUW_SCHAAL, 0];
    for (let y = 0; y < kaart.hoogte; y++) {
      for (let x = 0; x < kaart.breedte; x++) {
        const o = objectBeeld[y * kaart.breedte + x];
        if (!o || !o.beeld) continue;
        const wx = (x - y) * HALVE_BREEDTE;
        const wy = (x + y) * HALVE_HOOGTE;
        const dx = o.spreiding ? (tegelToeval(x, y, 1) - 0.5) * 2 * o.spreiding : 0;
        const dy = o.spreiding ? (tegelToeval(x, y, 2) - 0.5) * o.spreiding : 0;
        tekenSchaduw(sctx, sbasis, o.beeld, o.b, o.h, wx - o.ax + dx, wy + TEGEL_HOOGTE - o.ay + dy, wy + TEGEL_HOOGTE + dy);
      }
    }
    sctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  kiesPlaatjes();
  landschap.herbouw();
  sfeer.herbouw();

  // --- Bomen vellen en wegslepen (alleen beeld) ------------------------------
  const boomAsset = objecten[OBJECT.BOOM];
  // Het plaatje van de boom die op (x, y) stond, en zijn verschuiving.
  function boomOp(x, y) {
    const o = boomAsset && boomAsset.varianten
      ? boomAsset.varianten[Math.floor(tegelToeval(x, y, 4) * boomAsset.varianten.length)]
      : boomAsset;
    const sp = boomAsset && boomAsset.spreiding ? boomAsset.spreiding : 0;
    return { o, dx: sp ? (tegelToeval(x, y, 1) - 0.5) * 2 * sp : 0, dy: sp ? (tegelToeval(x, y, 2) - 0.5) * sp : 0 };
  }
  const sleeptBoom = (e) => e.houding === 'last' && e.werk && e.werk.beroep && e.werk.beroep.ruimtOp;
  // Richting waarin de hakker loopt (op het scherm, in radialen). Staat hij
  // stil, dan houden we de laatste richting aan.
  function sleepRichting(e) {
    const mx = e.x - e.vorigeX;
    const my = e.y - e.vorigeY;
    const sx = mx - my;
    const sy = (mx + my) / 2;
    if (Math.abs(sx) + Math.abs(sy) > 1e-4) e.sleepHoek = Math.atan2(sy, sx);
    if (e.sleepHoek === undefined) e.sleepHoek = e.kijkt < 0 ? Math.PI : 0;
    return e.sleepHoek;
  }
  // De boom ligt achter de hakker: de stam in zijn hand, de kruin over de grond.
  function tekenSleepboom(e, i, px, py, hoek, nu) {
    const b = boomOp(0, 0).o;
    if (!b || !b.beeld) return;
    const draai = hoek - Math.PI / 2 + Math.sin(nu / 110 + i) * 0.05;
    ctx.translate(px - Math.cos(hoek) * 3, py - 4);
    ctx.scale(0.72, 0.72 * 0.8);
    ctx.rotate(draai);
    ctx.drawImage(b.beeld, -b.ax, -b.ay, b.b, b.h);
    ctx.setTransform(basis[0], 0, 0, basis[3], basis[4], basis[5]);
  }
  // Een gevelde boom valt om: eerst langzaam, dan steeds sneller, een kleine
  // stuit en een stofwolk. Daarna pakt de hakker hem op.
  function tekenBoomval(f, nu, l, b, r, o) {
    const wx = (f.x - f.y) * HALVE_BREEDTE;
    const wy = (f.x + f.y) * HALVE_HOOGTE;
    if (wx < l || wx > r || wy < b || wy > o + 80) return;
    const { o: boom, dx, dy } = boomOp(f.x, f.y);
    if (!boom || !boom.beeld) return;
    const leeftijd = nu - f.van;
    const VAL = 700;
    const p = Math.min(1, leeftijd / VAL);
    let hoek = (Math.PI / 2) * 0.9 * p * p;
    if (leeftijd > VAL) hoek -= 0.1 * Math.sin((leeftijd - VAL) / 45) * Math.exp(-(leeftijd - VAL) / 110);
    const voetX = wx + dx;
    const voetY = wy + TEGEL_HOOGTE + dy - 2;
    ctx.globalAlpha = Math.max(0, Math.min(1, (f.duur - leeftijd) / 150));
    ctx.translate(voetX, voetY);
    ctx.scale(1, 1 - 0.25 * p);   // liggend wordt hij platter (de grond loopt schuin weg)
    ctx.rotate(f.kant * hoek);
    ctx.drawImage(boom.beeld, -boom.ax, -boom.ay, boom.b, boom.h);
    ctx.setTransform(basis[0], 0, 0, basis[3], basis[4], basis[5]);
    // Stof bij het neerkomen
    if (leeftijd > VAL - 40) {
      const s = Math.min(1, (leeftijd - VAL + 40) / 450);
      for (let k = 0; k < 6; k++) {
        const afstand = 8 + k * 7;
        ctx.fillStyle = `rgba(214, 198, 160, ${0.5 * (1 - s)})`;
        ctx.beginPath();
        ctx.arc(voetX + f.kant * afstand, voetY - 3 - s * 6 - (k % 2) * 2, 2.5 + s * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Werkgeheugen voor de zichtbare eenheden, steeds hergebruikt.
  const zichtbaar = new Uint16Array(MAX_EENHEDEN);     // nummers van zichtbare eenheden
  const diepte = new Float32Array(MAX_EENHEDEN);       // per eenheid
  const plekX = new Float32Array(MAX_EENHEDEN);        // wereldpixels
  const plekY = new Float32Array(MAX_EENHEDEN);
  const opDiepte = (a, b) => diepte[a] - diepte[b];

  // Een gekleurde ruit op de plek van een tegel. wy is de bovenste punt.
  // Een levensbalkje: groen, geel als het minder wordt, rood als het bijna op is.
  function balk(wx, wy, breed, deel) {
    const vol = Math.max(0, Math.min(1, deel));
    ctx.fillStyle = 'rgba(12, 10, 8, 0.75)';
    ctx.fillRect(wx - breed / 2 - 1, wy - 1, breed + 2, 4.5);
    ctx.fillStyle = vol > 0.5 ? '#74d46c' : vol > 0.25 ? '#e8c14a' : '#e2604e';
    ctx.fillRect(wx - breed / 2, wy, breed * vol, 2.5);
  }

  let doorzicht = false;   // het oog: gebouwen en bomen doorzichtig (stap 35)

  function ruit(wx, wy, vulling, rand) {
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + HALVE_BREEDTE, wy + HALVE_HOOGTE);
    ctx.lineTo(wx, wy + TEGEL_HOOGTE);
    ctx.lineTo(wx - HALVE_BREEDTE, wy + HALVE_HOOGTE);
    ctx.closePath();
    ctx.fillStyle = vulling;
    ctx.fill();
    ctx.lineWidth = 1.5 / camera.zoom;
    ctx.strokeStyle = rand;
    ctx.stroke();
  }

  // Maakt de schim van wat je wilt bouwen of slopen. tegels is een lijst
  // van { x, y, ok }. Bij bouwen krijgt elke goede tegel het plaatje dat
  // past bij zijn buren, alsof het er al staat.
  function maakSchim(soort, tegels, sloop) {
    const inSchim = new Set(tegels.filter((t) => t.ok).map((t) => t.y * kaart.breedte + t.x));
    const lijst = tegels.map((t) => {
      let beeld = null;
      if (!sloop && t.ok) {
        const asset = objecten[soort];
        beeld = asset.varianten
          ? asset.varianten[variantBijBuren(asset, aansluiting(kaart, t.x, t.y, soort, (bx, by) => inSchim.has(by * kaart.breedte + bx)))]
          : asset;
      }
      return { x: t.x, y: t.y, ok: t.ok, beeld };
    });
    lijst.sort((a, b) => a.x + a.y - (b.x + b.y));   // van achter naar voren
    return { sloop: !!sloop, tegels: lijst };
  }

  // Past het tekenvlak aan het scherm aan (ook na draaien van de telefoon).
  function pasGrootteAan() {
    const breedte = canvas.clientWidth || window.innerWidth;
    const hoogte = canvas.clientHeight || window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, CONFIG.beeld.maxPixelRatio);
    canvas.width = Math.round(breedte * pixelRatio);
    canvas.height = Math.round(hoogte * pixelRatio);
    camera.breedte = breedte;
    camera.hoogte = hoogte;
    camera.begrens();
  }

  // tussenstand: 0 tot 1, hoe ver we zijn tussen twee rekenstappen.
  function teken(staat, tussenstand) {
    const hekNuTijd = performance.now();
    hekDt = hekTijd ? Math.min(0.1, (hekNuTijd - hekTijd) / 1000) : 0;
    hekTijd = hekNuTijd;
    const nu = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = CONFIG.beeld.achtergrond;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vanaf hier tekenen we in wereldpixels; de camera regelt de rest.
    const schaal = camera.zoom * pixelRatio;
    basis[0] = schaal;
    basis[3] = schaal;
    basis[4] = Math.round(canvas.width / 2 - camera.x * schaal);
    basis[5] = Math.round(canvas.height / 2 - camera.y * schaal);
    ctx.setTransform(basis[0], 0, 0, basis[3], basis[4], basis[5]);
    const t = nu / 1000;   // seconden, voor wind, rook en water
    const nachtNu = staat.nacht ? Math.min(1, staat.nacht()) : 0;
    const zon = 1 - nachtNu;   // schaduwen en wolken verdwijnen in het donker
    if (sfeerAan && !sfeerLicht && hekDt > 0) {
      traagTijd = hekDt > 0.034 ? traagTijd + hekDt : Math.max(0, traagTijd - hekDt * 2);
      if (traagTijd > 4) sfeerLicht = true;
    }
    ctx.imageSmoothingEnabled = !CONFIG.beeld.pixelArt;

    // Welk stuk van de wereld is in beeld?
    const linksBoven = camera.schermNaarWereld(0, 0);
    const rechtsOnder = camera.schermNaarWereld(camera.breedte, camera.hoogte);
    const zichtLinks = linksBoven.x - HALVE_BREEDTE - 8;
    const zichtRechts = rechtsOnder.x + HALVE_BREEDTE + 8;
    const zichtBoven = linksBoven.y - TEGEL_HOOGTE;
    const zichtOnder = rechtsOnder.y + RUIMTE_ONDER;
    const grondOnder = rechtsOnder.y + 2;

    // Welke tegels kunnen daarin liggen?
    const h1 = wereldNaarRaster(zichtLinks, zichtBoven);
    const h2 = wereldNaarRaster(zichtRechts, zichtBoven);
    const h3 = wereldNaarRaster(zichtLinks, zichtOnder);
    const h4 = wereldNaarRaster(zichtRechts, zichtOnder);
    const minX = Math.max(0, Math.floor(Math.min(h1.x, h2.x, h3.x, h4.x)));
    const maxX = Math.min(kaart.breedte - 1, Math.ceil(Math.max(h1.x, h2.x, h3.x, h4.x)));
    const minY = Math.max(0, Math.floor(Math.min(h1.y, h2.y, h3.y, h4.y)));
    const maxY = Math.min(kaart.hoogte - 1, Math.ceil(Math.max(h1.y, h2.y, h3.y, h4.y)));

    // --- Ronde 1: grond -----------------------------------------------------
    getekend = 0;
    landschap.teken(ctx, zichtLinks, zichtBoven, zichtRechts, grondOnder);
    if (sfeerAan) sfeer.tekenGlinster(ctx, zichtLinks, zichtBoven, zichtRechts, grondOnder, t);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const wx = (x - y) * HALVE_BREEDTE;   // bovenste punt van de ruit
        const wy = (x + y) * HALVE_HOOGTE;
        if (wx < zichtLinks || wx > zichtRechts || wy < zichtBoven || wy > grondOnder) continue;
        const i = y * kaart.breedte + x;
        const randen = randBeelden[i];
        if (kaart.grond[i] !== GROND.AKKER && !randen) continue;
        if (kaart.grond[i] === GROND.AKKER) {
          const g = grondBeeld[i];
          ctx.drawImage(g.beeld, wx - g.ax, wy + TEGEL_HOOGTE - g.ay, g.b, g.h);
        }
        if (randen) {
          for (let k = 0; k < randen.length; k++) {
            const r = randen[k];
            ctx.drawImage(r.beeld, wx - r.ax, wy + TEGEL_HOOGTE - r.ay, r.b, r.h);
          }
        }
        getekend++;
      }
    }

    // Slagschaduwen van muren, torens en huizen: het vooraf getekende doek.
    // Alleen het stuk dat in beeld is.
    const sx = Math.max(wereldLinks, linksBoven.x);
    const sy = Math.max(0, linksBoven.y);
    const sb = Math.min(wereldLinks + wereldBreed, rechtsOnder.x) - sx;
    const sh = Math.min(wereldHoog, rechtsOnder.y) - sy;
    if (sb > 0 && sh > 0) {
      ctx.globalAlpha = sfeerAan ? 0.36 * zon : 0.3;
      ctx.drawImage(
        schaduwDoek,
        (sx - wereldLinks) * SCHADUW_SCHAAL, sy * SCHADUW_SCHAAL, sb * SCHADUW_SCHAAL, sh * SCHADUW_SCHAAL,
        sx, sy, sb, sh
      );
      ctx.globalAlpha = 1;
    }

    let doelOpMuur = null;   // een doel boven op de muur tekenen we later, over de muur heen
    // Waar je soldaten heen stuurt: een ring op de grond die kort oplicht.
    // Rood als je ze op een vijand afstuurt.
    if (staat.doel && nu < staat.doel.tot) {
      const wx = (staat.doel.x - staat.doel.y) * HALVE_BREEDTE;
      const wy = (staat.doel.x + staat.doel.y + 1) * HALVE_HOOGTE;
      const deel = (staat.doel.tot - nu) / staat.doel.duur;
      if (staat.doel.hoogte) {
        doelOpMuur = { wx, wy: wy - staat.doel.hoogte, deel };
      } else {
        ctx.strokeStyle = `rgba(${staat.doel.aanval ? '255, 120, 100' : '255, 233, 138'}, ${Math.min(1, deel * 1.5)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(wx, wy, 8 + 12 * (1 - deel), 4 + 6 * (1 - deel), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Wie er net gevallen is: een vlek op de grond die langzaam vervaagt.
    // Verlopen effecten gaan hier meteen uit de lijst.
    const effecten = staat.effecten;
    if (effecten && effecten.length) {
      let over = 0;
      for (let i = 0; i < effecten.length; i++) {
        const f = effecten[i];
        if (nu - f.van >= f.duur) continue;
        effecten[over++] = f;
        if (f.soort === 'plas' || f.soort === 'lijk') {
          const wx0 = (f.x - f.y) * HALVE_BREEDTE;
          const wy0 = (f.x + f.y) * HALVE_HOOGTE;
          if (wx0 < zichtLinks || wx0 > zichtRechts || wy0 < zichtBoven || wy0 > zichtOnder) continue;
          const rest = f.duur - (nu - f.van);
          const vervaag = Math.min(1, rest / 6000);
          if (f.soort === 'plas') {
            const gr = 4 + ((f.van * 7) % 5);
            ctx.fillStyle = `rgba(110, 12, 12, ${0.55 * vervaag})`;
            ctx.beginPath();
            ctx.ellipse(wx0, wy0 + 1, gr, gr * 0.48, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = `rgba(150, 20, 18, ${0.4 * vervaag})`;
            ctx.beginPath();
            ctx.ellipse(wx0 + 3, wy0 + 2, gr * 0.5, gr * 0.25, 0, 0, Math.PI * 2);
            ctx.fill();
          } else {
            ctx.globalAlpha = vervaag;
            ctx.fillStyle = 'rgba(40, 20, 14, 0.4)';
            ctx.beginPath();
            ctx.ellipse(wx0, wy0 + 1, 8, 3.2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = f.kleur || '#8a6a4a';
            ctx.fillRect(wx0 - 5, wy0 - 3, 9, 3);
            ctx.fillStyle = '#e0b890';
            ctx.fillRect(wx0 + 4, wy0 - 3.5, 3, 3);
            ctx.fillStyle = '#7a1010';
            ctx.fillRect(wx0 - 2, wy0 - 3, 2.5, 2);
            ctx.globalAlpha = 1;
          }
          continue;
        }
        if (f.soort === 'rook') {
          const t = (nu - f.van) / f.duur;
          const wxr = (f.x - f.y) * HALVE_BREEDTE;
          const wyr = (f.x + f.y) * HALVE_HOOGTE;
          for (let k = 0; k < 6; k++) {
            const hoek = k * 1.047 + 0.4;
            ctx.fillStyle = `rgba(245, 232, 190, ${0.6 * (1 - t)})`;
            ctx.beginPath();
            ctx.arc(wxr + Math.cos(hoek) * (4 + 14 * t), wyr - 6 - 12 * t + Math.sin(hoek) * (2 + 6 * t), 3 + 5 * t, 0, Math.PI * 2);
            ctx.fill();
          }
          continue;
        }
        if (f.soort === 'boomval') {
          tekenBoomval(f, nu, zichtLinks, zichtBoven, zichtRechts, zichtOnder);
          continue;
        }
        if (f.soort !== 'val') continue;
        const deel = 1 - (nu - f.van) / f.duur;
        const wx = (f.x - f.y) * HALVE_BREEDTE;
        const wy = (f.x + f.y) * HALVE_HOOGTE;
        ctx.fillStyle = `rgba(70, 14, 10, ${0.5 * deel})`;
        ctx.beginPath();
        ctx.ellipse(wx, wy, 9, 4.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = f.team ? `rgba(194, 58, 46, ${deel})` : `rgba(47, 95, 196, ${deel})`;
        ctx.fillRect(wx - 5, wy - 2.5, 10, 3);
        ctx.fillStyle = `rgba(198, 203, 211, ${deel})`;
        ctx.fillRect(wx + 3, wy - 3.5, 4, 3.5);
      }
      effecten.length = over;
    }

    // De aangetikte tegel, op de grond en onder alles wat rechtop staat.
    if (staat.gekozen) {
      const wx = (staat.gekozen.x - staat.gekozen.y) * HALVE_BREEDTE;
      const wy = (staat.gekozen.x + staat.gekozen.y) * HALVE_HOOGTE;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + HALVE_BREEDTE, wy + HALVE_HOOGTE);
      ctx.lineTo(wx, wy + TEGEL_HOOGTE);
      ctx.lineTo(wx - HALVE_BREEDTE, wy + HALVE_HOOGTE);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 240, 180, 0.28)';
      ctx.fill();
      ctx.lineWidth = 2 / camera.zoom;
      ctx.strokeStyle = '#fff3c4';
      ctx.stroke();
    }

    // Bouwen: een groene ruit op de grond waar het bouwwerk komt.
    const schim = staat.schim;
    if (schim && !schim.sloop) {
      for (const t of schim.tegels) {
        if (t.ok) ruit((t.x - t.y) * HALVE_BREEDTE, (t.x + t.y) * HALVE_HOOGTE, 'rgba(120, 225, 120, 0.42)', '#d2f7c8');
      }
    }

    // --- Zichtbare eenheden verzamelen en op diepte zetten ---------------------
    const eenheden = staat.eenheden;
    let aantal = 0;
    inPoort = 0;
    const totaal = Math.min(eenheden.length, MAX_EENHEDEN);
    for (let i = 0; i < totaal; i++) {
      const e = eenheden[i];
      const x = e.vorigeX + (e.x - e.vorigeX) * tussenstand;
      const y = e.vorigeY + (e.y - e.vorigeY) * tussenstand;
      const wx = (x - y) * HALVE_BREEDTE;
      const wy = (x + y) * HALVE_HOOGTE;
      if (wx < zichtLinks || wx > zichtRechts || wy < zichtBoven || wy > zichtOnder) continue;
      // Wie op de trap in een toren is, zie je niet.
      if (e.klimt) continue;
      // Wie door een poort loopt, is even niet te zien: hij is binnen.
      if (e.hoogte === 0 && kaart.object[Math.floor(y) * kaart.breedte + Math.floor(x)] === OBJECT.POORT) {
        inPoort++;
        continue;
      }
      plekX[i] = wx;
      plekY[i] = wy - e.hoogte;
      // Wie op een muur staat, wordt getekend na het stuk muur waar hij
      // naartoe loopt. Anders zakt hij er tijdens het lopen even achter.
      diepte[i] = x + y + (e.hoogte > 0 ? 1 : 0);
      zichtbaar[aantal++] = i;
    }
    const rij = zichtbaar.subarray(0, aantal);
    rij.sort(opDiepte);

    // Welk plaatje een eenheid nu laat zien (lopen, hakken, slaan).
    const kiesBeeld = (e, i, s) => {
      // Een werker die hakt of iets draagt heeft daar eigen plaatjes voor,
      // net als een soldaat die slaat of schiet. Een houthakker die een boom
      // sleept loopt gewoon (de boom tekenen we er los achter).
      const eigen = e.houding && s.houdingen && !sleeptBoom(e) ? s.houdingen[e.houding] : null;
      const set = eigen || s;
      const beelden = e.kijkt < 0 ? set.links : set.rechts;
      let beeld = 0;
      if (!eigen) beeld = e.loopt ? Math.floor(nu / 115 + i * 1.3) % beelden.length : 0;
      else if (e.houding === 'hak') beeld = Math.floor(nu / 210 + i) % beelden.length;
      else if (e.houding === 'sla' || e.houding === 'schiet') beeld = e.pose ? 1 : 0;
      else if (e.loopt) beeld = Math.floor(nu / 115 + i * 1.3) % beelden.length;
      return beelden[beeld];
    };

    // Schaduwen van de eenheden op de grond, onder alles wat rechtop staat.
    if (sfeerAan && zon > 0) {
      ctx.globalAlpha = 0.3 * zon;
      for (let k = 0; k < aantal; k++) {
        const i = rij[k];
        const e = eenheden[i];
        if (e.hoogte > 0) continue;
        const s = soldaten[e.soort][e.team];
        tekenSchaduw(ctx, basis, kiesBeeld(e, i, s), s.b, s.h, plekX[i] - s.ax, plekY[i] - s.ay, plekY[i]);
      }
      ctx.globalAlpha = 1;
    }

    // --- Ronde 2: alles wat rechtop staat, van achter naar voren ---------------
    let volgende = 0;   // eerstvolgende eenheid in de rij
    const tekenEenhedenTot = (grens) => {
      while (volgende < aantal && diepte[rij[volgende]] < grens) {
        const i = rij[volgende++];
        const e = eenheden[i];
        const s = soldaten[e.soort][e.team];
        // Een gekozen soldaat staat in een lichte ring.
        if (e.gekozen) {
          ctx.strokeStyle = '#ffe98a';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.ellipse(plekX[i], plekY[i], 11, 5.5, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        const plaatje = kiesBeeld(e, i, s);
        // Een houthakker sleept zijn boom achter zich aan.
        const sleep = sleeptBoom(e) && !(e.werk.wacht > 0) ? sleepRichting(e) : null;
        if (sleep !== null && Math.sin(sleep) >= 0) tekenSleepboom(e, i, plekX[i], plekY[i], sleep, nu);
        // Een verborgen sluipmoordenaar: van jou half doorzichtig, van rood
        // alleen van dichtbij te zien (dat bepaalt strijd.js; hier vaag).
        if (sleep !== null && Math.sin(sleep) < 0) tekenSleepboom(e, i, plekX[i], plekY[i], sleep, nu);
        if (e.verborgen) ctx.globalAlpha = 0.5;
        // Een klap: de soldaat springt even naar voren (de vechtanimatie)
        const stoot = e.pose > 0 && e.houding === 'sla' ? e.kijkt * 3 : 0;
        ctx.drawImage(plaatje, plekX[i] - s.ax + stoot, plekY[i] - s.ay - (stoot ? 1 : 0), s.b, s.h);
        ctx.globalAlpha = 1;
        // Wie geraakt is, heeft een balkje boven zijn hoofd.
        if (e.levenMax && e.leven < e.levenMax) balk(plekX[i], plekY[i] - s.ay - 5, 14, e.leven / e.levenMax);
      }
    };

    // Ladders tegen een muur: aan de achterkant vóór de muur getekend, aan
    // de voorkant erna.
    const ladderOp = new Map();
    if (staat.ladders) for (const l of staat.ladders()) ladderOp.set(l.y * kaart.breedte + l.x, l);
    const tekenLadder = (l) => {
      const asset = objectOp(l.y * kaart.breedte + l.x);
      const muurH = (asset && asset.hoogte) || 40;
      const punt = (rx, ry, h) => [(rx - ry) * HALVE_BREEDTE, (rx + ry) * HALVE_HOOGTE - h];
      const [vx, vy] = punt(l.x + 0.5 + l.dx * 1.05, l.y + 0.5 + l.dy * 1.05, 0);
      const [tx, ty] = punt(l.x + 0.5 + l.dx * 0.4, l.y + 0.5 + l.dy * 0.4, muurH - 2);
      tekenLadderOp(ctx, vx, vy, tx, ty, l.team === 0 ? '#a07a48' : '#8a6a40', l.vast ? 5.5 : 3);
    };

    // Een object staat midden op zijn tegel: diepte x + y + 1.
    for (let som = minX + minY; som <= maxX + maxY; som++) {
      tekenEenhedenTot(som + 1);
      const vanX = Math.max(minX, som - maxY);
      const totX = Math.min(maxX, som - minY);
      for (let x = vanX; x <= totX; x++) {
        const y = som - x;
        let o = objectBeeld[y * kaart.breedte + x];
        if (!o) continue;
        const wx = (x - y) * HALVE_BREEDTE;
        const wy = som * HALVE_HOOGTE;
        if (wx < zichtLinks || wx > zichtRechts || wy < zichtBoven || wy > zichtOnder) continue;
        const dx = o.spreiding ? (tegelToeval(x, y, 1) - 0.5) * 2 * o.spreiding : 0;
        const dy = o.spreiding ? (tegelToeval(x, y, 2) - 0.5) * o.spreiding : 0;
        const l = ladderOp.size ? ladderOp.get(y * kaart.breedte + x) : null;
        if (l && (l.dx < 0 || l.dy < 0)) tekenLadder(l);
        // Een poort: het valhek staat zo hoog als hekStand zegt (gaat langzaam open en dicht)
        if (o.hek) o = { ...o, beeld: o.hek[Math.round(hekStand(y * kaart.breedte + x) * (o.hek.length - 1))].beeld };
        if (doorzicht) {
          // Het oog staat aan: natuur en gebouwen bijna doorzichtig, met een
          // vlak op de grond zodat je ziet waar ze staan. Troepen blijven vol.
          const soort = kaart.object[y * kaart.breedte + x];
          if (soort !== OBJECT.BOOM) ruit(wx, wy, kaart.eigenaar[y * kaart.breedte + x] === 2 ? 'rgba(170, 50, 40, 0.35)' : 'rgba(40, 32, 22, 0.35)', 'rgba(241, 234, 216, 0.5)');
          ctx.globalAlpha = soort === OBJECT.BOOM ? 0.18 : 0.26;
          ctx.drawImage(o.beeld, wx - o.ax + dx, wy + TEGEL_HOOGTE - o.ay + dy, o.b, o.h);
          ctx.globalAlpha = 1;
        } else if (sfeerAan) {
          // Wind: bomen, graan en vlaggen hellen mee, vanaf de voet.
          const wieg = sfeerLicht ? 0 : WIEG[kaart.object[y * kaart.breedte + x]];
          if (wieg) {
            const k = wieg * sfeer.wind(wx, wy, t + tegelToeval(x, y, 6) * 0.6);
            const voet = wy + TEGEL_HOOGTE + dy;
            ctx.setTransform(basis[0], 0, basis[0] * k, basis[3], basis[4] - basis[0] * k * voet, basis[5]);
            ctx.drawImage(o.beeld, wx - o.ax + dx, wy + TEGEL_HOOGTE - o.ay + dy, o.b, o.h);
            ctx.setTransform(basis[0], 0, 0, basis[3], basis[4], basis[5]);
          } else ctx.drawImage(o.beeld, wx - o.ax + dx, wy + TEGEL_HOOGTE - o.ay + dy, o.b, o.h);
          if (o.rook) sfeer.tekenRook(ctx, wx + dx + o.rook[0], wy + TEGEL_HOOGTE + dy + o.rook[1], t, tegelToeval(x, y, 7));
        } else ctx.drawImage(o.beeld, wx - o.ax + dx, wy + TEGEL_HOOGTE - o.ay + dy, o.b, o.h);
        if (l && !(l.dx < 0 || l.dy < 0)) tekenLadder(l);
      }
    }
    tekenEenhedenTot(Infinity);

    // Vogels boven het land.
    if (sfeerAan) sfeer.tekenVogels(ctx, zichtLinks, zichtBoven, zichtRechts, zichtOnder, t, zon);

    // --- De schim, bovenop alles ------------------------------------------------
    // Groen: het bouwwerk, half doorzichtig. Rood: hier kan het niet, of
    // dit ga je slopen.
    if (schim) {
      for (const t of schim.tegels) {
        const wx = (t.x - t.y) * HALVE_BREEDTE;
        const wy = (t.x + t.y) * HALVE_HOOGTE;
        if (schim.sloop) {
          const staand = objectOp(t.y * kaart.breedte + t.x);
          const hoog = t.ok && staand ? staand.hoogte : 0;
          ruit(wx, wy - hoog, t.ok ? 'rgba(235, 70, 50, 0.6)' : 'rgba(150, 150, 150, 0.45)', '#ffd6cf');
        } else if (t.ok) {
          ctx.globalAlpha = 0.62;
          ctx.drawImage(t.beeld.beeld, wx - t.beeld.ax, wy + TEGEL_HOOGTE - t.beeld.ay, t.beeld.b, t.beeld.h);
          ctx.globalAlpha = 1;
        } else {
          ruit(wx, wy, 'rgba(235, 70, 50, 0.55)', '#ffd6cf');
        }
      }
    }

    // Stuur je soldaten de muur op, dan licht de ring boven op de muur op.
    if (doelOpMuur) {
      const d = doelOpMuur;
      ctx.strokeStyle = `rgba(255, 233, 138, ${Math.min(1, d.deel * 1.5)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(d.wx, d.wy, 8 + 12 * (1 - d.deel), 4 + 6 * (1 - d.deel), 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Het leven van beschadigde bouwwerken en van je burcht.
    const balken = staat.balken;
    if (balken && balken.length) {
      for (let i = 0; i < balken.length; i++) {
        const b = balken[i];
        const asset = objectOp(b.y * kaart.breedte + b.x);
        const hoog = asset && asset.hoogte ? asset.hoogte : 24;
        const wx = (b.x - b.y) * HALVE_BREEDTE;
        const wy = (b.x + b.y) * HALVE_HOOGTE + HALVE_HOOGTE - hoog - (b.groot ? 18 : 12);
        balk(wx, wy, b.groot ? 46 : 24, b.deel);
      }
    }

    // Pijlen in de lucht: een streepje dat in een boog naar zijn doel vliegt.
    if (effecten && effecten.length) {
      ctx.lineCap = 'round';
      for (let i = 0; i < effecten.length; i++) {
        const f = effecten[i];
        if (f.soort !== 'pijl') continue;
        const t = Math.min(1, Math.max(0, (nu - f.van) / f.duur));
        const boog = 6 + 1.6 * Math.hypot(f.x2 - f.x1, f.y2 - f.y1);
        const punt = (deel) => {
          const x = f.x1 + (f.x2 - f.x1) * deel;
          const y = f.y1 + (f.y2 - f.y1) * deel;
          const h = f.h1 + (f.h2 - f.h1) * deel + Math.sin(Math.PI * deel) * boog;
          return [(x - y) * HALVE_BREEDTE, (x + y) * HALVE_HOOGTE - h];
        };
        const kop = punt(t);
        const staart = punt(Math.max(0, t - 0.16));
        if (f.vuur) {
          // Een vuurbal met een gloeiende staart
          for (let s = 4; s >= 1; s--) {
            const q = punt(Math.max(0, t - s * 0.04));
            ctx.fillStyle = `rgba(255, ${120 + s * 20}, 40, ${0.15 * (5 - s)})`;
            ctx.beginPath();
            ctx.arc(q[0], q[1], 1.5 + (4 - s) * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#ffd36a';
          ctx.beginPath();
          ctx.arc(kop[0], kop[1], 3.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ff7a2a';
          ctx.beginPath();
          ctx.arc(kop[0] + 0.6, kop[1] + 0.6, 2, 0, Math.PI * 2);
          ctx.fill();
          continue;
        }
        if (f.steen) {
          ctx.fillStyle = '#6b6a66';
          ctx.beginPath();
          ctx.arc(kop[0], kop[1], 2.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(kop[0] - 1.4, kop[1] - 1.6, 1.4, 1.4);
          continue;
        }
        ctx.strokeStyle = '#2e2114';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(staart[0], staart[1]);
        ctx.lineTo(kop[0], kop[1]);
        ctx.stroke();
        ctx.fillStyle = '#f1ead8';
        ctx.fillRect(kop[0] - 0.9, kop[1] - 0.9, 1.8, 1.8);
      }
      ctx.lineCap = 'butt';
      // Bloed en klappen: rode spettertjes die wegvliegen en vallen, en een lichtflits bij een klap
      for (let i = 0; i < effecten.length; i++) {
        const f = effecten[i];
        if (f.soort !== 'bloed' && f.soort !== 'klap') continue;
        const t = Math.min(1, Math.max(0, (nu - f.van) / f.duur));
        const wx = (f.x - f.y) * HALVE_BREEDTE;
        const wy = (f.x + f.y) * HALVE_HOOGTE - (f.h || 0);
        if (f.soort === 'klap') {
          ctx.strokeStyle = `rgba(255, 245, 200, ${1 - t})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let k = 0; k < 4; k++) {
            const hoek = k * 1.57 + 0.5;
            ctx.moveTo(wx + Math.cos(hoek) * 2, wy + Math.sin(hoek) * 2);
            ctx.lineTo(wx + Math.cos(hoek) * (4 + t * 6), wy + Math.sin(hoek) * (4 + t * 6));
          }
          ctx.stroke();
          continue;
        }
        const n = f.groot ? 14 : 6;
        const sec = t * f.duur / 1000;
        for (let j = 0; j < n; j++) {
          const toeval = Math.sin(f.van * 0.013 + j * 12.9898) * 43758.5453;
          const r1 = toeval - Math.floor(toeval);
          const r2 = (toeval * 7.31) - Math.floor(toeval * 7.31);
          const hoek = r1 * Math.PI * 2;
          const snel = 18 + r2 * (f.groot ? 46 : 30);
          const px = wx + Math.cos(hoek) * snel * sec;
          const py = wy + Math.sin(hoek) * snel * 0.5 * sec - 14 * sec + 70 * sec * sec;
          ctx.fillStyle = `rgba(${170 + Math.floor(r2 * 50)}, 14, 14, ${1 - t * t})`;
          const gr = f.groot ? 2.1 : 1.6;
          ctx.fillRect(px - gr / 2, py - gr / 2, gr, gr);
        }
      }
      // De ruiter van de Rouwbanier met Wessel over zijn zadel (proloog)
      for (let i = 0; i < effecten.length; i++) {
        const f = effecten[i];
        if (f.soort !== 'ruiter') continue;
        const t = Math.min(1, Math.max(0, (nu - f.van) / f.duur));
        // Positie langs de route (gelijke stukken per deel)
        const r = f.route;
        const deel = t * (r.length - 1);
        const k = Math.min(r.length - 2, Math.floor(deel));
        const u = deel - k;
        const x = r[k][0] + (r[k + 1][0] - r[k][0]) * u;
        const y = r[k][1] + (r[k + 1][1] - r[k][1]) * u;
        const wx = (x - y) * HALVE_BREEDTE;
        const wy = (x + y) * HALVE_HOOGTE;
        const dxs = (r[k + 1][0] - r[k][0]) - (r[k + 1][1] - r[k][1]);
        const kant = dxs >= 0 ? 1 : -1;
        const galop = Math.sin(nu / 70);
        ctx.save();
        ctx.translate(wx, wy);
        ctx.scale(kant * 1.5, 1.5);
        // Een fakkelgloed, zodat je hem in het donker ziet
        const gloed = ctx.createRadialGradient(4, -26, 2, 4, -26, 30);
        gloed.addColorStop(0, 'rgba(255, 190, 90, 0.55)');
        gloed.addColorStop(1, 'rgba(255, 150, 60, 0)');
        ctx.fillStyle = gloed;
        ctx.beginPath(); ctx.arc(4, -26, 30, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = t > 0.92 ? (1 - t) / 0.08 : 1;
        tekenRuiter(ctx, galop, nu);
        ctx.restore();
      }
      // Genezen: een gouden gloed die opstijgt bij wie de heler geneest
      for (let i = 0; i < effecten.length; i++) {
        const f = effecten[i];
        if (f.soort !== 'heel') continue;
        const t = Math.min(1, Math.max(0, (nu - f.van) / f.duur));
        const wx = (f.x - f.y) * HALVE_BREEDTE;
        const wy = (f.x + f.y) * HALVE_HOOGTE - (f.h || 0) - 10 - t * 10;
        ctx.fillStyle = `rgba(255, 224, 120, ${0.55 * (1 - t)})`;
        ctx.beginPath();
        ctx.arc(wx, wy, 5 + t * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 220, ${0.9 * (1 - t)})`;
        ctx.fillRect(wx - 0.6, wy - 3, 1.2, 6);
        ctx.fillRect(wx - 3, wy - 0.6, 6, 1.2);
      }
      // Ontploffingen van vuur en brandend hout
      for (let i = 0; i < effecten.length; i++) {
        const f = effecten[i];
        if (f.soort !== 'vuur' && f.soort !== 'brand') continue;
        const wx = (f.x - f.y) * HALVE_BREEDTE;
        const wy = (f.x + f.y) * HALVE_HOOGTE;
        if (f.soort === 'vuur') {
          const t = (nu - f.van - (f.wacht || 0)) / (f.duur - (f.wacht || 0));
          if (t < 0 || t > 1) continue;
          const r = 6 + t * 26;
          ctx.fillStyle = `rgba(255, 140, 40, ${0.45 * (1 - t)})`;
          ctx.beginPath();
          ctx.ellipse(wx, wy, r, r * 0.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgba(255, 220, 110, ${0.8 * (1 - t)})`;
          ctx.beginPath();
          ctx.arc(wx, wy - 6 - t * 8, 5 * (1 - t) + 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Een paar flakkerende vlammetjes
          for (let j = 0; j < 4; j++) {
            const fl = Math.sin(nu / 90 + j * 1.7 + f.x * 3) * 0.5 + 0.5;
            const fx = wx - 9 + j * 6;
            const fy = wy - 10 - (j % 2) * 6;
            ctx.fillStyle = `rgba(255, ${110 + fl * 90}, 30, 0.85)`;
            ctx.beginPath();
            ctx.moveTo(fx - 3, fy + 4);
            ctx.quadraticCurveTo(fx - 2, fy - 4 - fl * 5, fx, fy - 9 - fl * 5);
            ctx.quadraticCurveTo(fx + 2, fy - 4 - fl * 5, fx + 3, fy + 4);
            ctx.fill();
          }
        }
      }
    }

    nabewerking.toepassen(ctx, canvas);

    // De nacht (proloog): een donkerblauwe waas over de wereld, 0 tot 1.
    const nacht = staat.nacht ? staat.nacht() : 0;
    if (nacht > 0) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(10, 16, 46, ${0.5 * Math.min(1, nacht)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Het kader waarmee je soldaten kiest, in schermmaat over alles heen.
    if (staat.kader) {
      const k = staat.kader;
      ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      ctx.fillStyle = 'rgba(255, 233, 138, 0.12)';
      ctx.strokeStyle = '#ffe98a';
      ctx.lineWidth = 1.5;
      ctx.fillRect(k.x1, k.y1, k.x2 - k.x1, k.y2 - k.y1);
      ctx.strokeRect(k.x1, k.y1, k.x2 - k.x1, k.y2 - k.y1);
    }
  }

  // Voor het testen: welke variant van een plaatje er op een tegel staat.
  const variantOp = (x, y) => {
    const i = y * kaart.breedte + x;
    const asset = objectOp(i);
    return asset && asset.varianten ? asset.varianten.indexOf(objectBeeld[i]) : -1;
  };

  return { zetHekDoel: (f) => { hekDoel = f; }, pasGrootteAan, teken, kiesPlaatjes, maakSchim, variantOp, zetDoorzicht: (aan) => { doorzicht = !!aan; }, doorzicht: () => doorzicht, aantalGetekend: () => getekend, aantalInPoort: () => inPoort, sfeerLicht: () => sfeerLicht };
}
