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
import { maakLandschap } from './landschap.js';
import { wereldNaarRaster, HALVE_BREEDTE, HALVE_HOOGTE, TEGEL_HOOGTE } from './iso.js';
import { tekenLadderOp } from './kunst.js';

const MAX_EENHEDEN = 4096;
const RUIMTE_ONDER = 190;   // hoge dingen net onder de rand steken nog in beeld

// Vast toevalsgetal per tegel (0 tot 1), voor verschuiving en varianten.
function tegelToeval(x, y, extra) {
  let h = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(extra + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function maakTekenaar(canvas, kaart, camera, assets) {
  const ctx = canvas.getContext('2d', { alpha: false });
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
  ];
  // De grond (gras, zand, water, aarde) komt uit het doorlopende landschap.
  // Alleen akkers blijven losse tegels (die zijn bewust rechthoekig).
  const landschap = maakLandschap(kaart);
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
        const hoog = objectOp(i) ? objectOp(i).hoogte : 0;
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
  }
  kiesPlaatjes();
  landschap.herbouw();

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
    const nu = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = CONFIG.beeld.achtergrond;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vanaf hier tekenen we in wereldpixels; de camera regelt de rest.
    const schaal = camera.zoom * pixelRatio;
    ctx.setTransform(
      schaal, 0, 0, schaal,
      Math.round(canvas.width / 2 - camera.x * schaal),
      Math.round(canvas.height / 2 - camera.y * schaal)
    );
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
      ctx.globalAlpha = 0.3;
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
        // Een werker die hakt of iets draagt heeft daar eigen plaatjes voor,
        // net als een soldaat die slaat of schiet.
        const eigen = e.houding && s.houdingen ? s.houdingen[e.houding] : null;
        const set = eigen || s;
        const beelden = e.kijkt < 0 ? set.links : set.rechts;
        let beeld = 0;
        if (!eigen) beeld = e.loopt ? Math.floor(nu / 115 + i * 1.3) % beelden.length : 0;
        else if (e.houding === 'hak') beeld = Math.floor(nu / 210 + i) % beelden.length;
        else if (e.houding === 'sla' || e.houding === 'schiet') beeld = e.pose ? 1 : 0;
        else if (e.loopt) beeld = Math.floor(nu / 115 + i * 1.3) % beelden.length;
        // Een verborgen sluipmoordenaar: van jou half doorzichtig, van rood
        // alleen van dichtbij te zien (dat bepaalt strijd.js; hier vaag).
        if (e.verborgen) ctx.globalAlpha = 0.5;
        ctx.drawImage(beelden[beeld], plekX[i] - s.ax, plekY[i] - s.ay, s.b, s.h);
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
        const o = objectBeeld[y * kaart.breedte + x];
        if (!o) continue;
        const wx = (x - y) * HALVE_BREEDTE;
        const wy = som * HALVE_HOOGTE;
        if (wx < zichtLinks || wx > zichtRechts || wy < zichtBoven || wy > zichtOnder) continue;
        const dx = o.spreiding ? (tegelToeval(x, y, 1) - 0.5) * 2 * o.spreiding : 0;
        const dy = o.spreiding ? (tegelToeval(x, y, 2) - 0.5) * o.spreiding : 0;
        const l = ladderOp.size ? ladderOp.get(y * kaart.breedte + x) : null;
        if (l && (l.dx < 0 || l.dy < 0)) tekenLadder(l);
        if (doorzicht) {
          // Het oog staat aan: natuur en gebouwen bijna doorzichtig, met een
          // vlak op de grond zodat je ziet waar ze staan. Troepen blijven vol.
          const soort = kaart.object[y * kaart.breedte + x];
          if (soort !== OBJECT.BOOM) ruit(wx, wy, kaart.eigenaar[y * kaart.breedte + x] === 2 ? 'rgba(170, 50, 40, 0.35)' : 'rgba(40, 32, 22, 0.35)', 'rgba(241, 234, 216, 0.5)');
          ctx.globalAlpha = soort === OBJECT.BOOM ? 0.18 : 0.26;
          ctx.drawImage(o.beeld, wx - o.ax + dx, wy + TEGEL_HOOGTE - o.ay + dy, o.b, o.h);
          ctx.globalAlpha = 1;
        } else ctx.drawImage(o.beeld, wx - o.ax + dx, wy + TEGEL_HOOGTE - o.ay + dy, o.b, o.h);
        if (l && !(l.dx < 0 || l.dy < 0)) tekenLadder(l);
      }
    }
    tekenEenhedenTot(Infinity);

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

  return { pasGrootteAan, teken, kiesPlaatjes, maakSchim, variantOp, zetDoorzicht: (aan) => { doorzicht = !!aan; }, doorzicht: () => doorzicht, aantalGetekend: () => getekend, aantalInPoort: () => inPoort };
}
