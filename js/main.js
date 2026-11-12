// MAIN: zet alle onderdelen in elkaar en start het spel.

import { CONFIG } from './config.js';
import { maakKaart, laadKaarten, binnenKaart, beschrijfTegel, OBJECT_ASSET } from './kaart.js';
import { rasterNaarWereld, wereldNaarRaster, kaartGrenzen } from './iso.js';
import { maakCamera } from './camera.js';
import { koppelInvoer } from './invoer.js';
import { laadAssets } from './assets.js';
import { maakTekenaar } from './tekenaar.js';
import { maakWegvinder } from './wegvinden.js';
import { maakEenheden } from './eenheden.js';
import { maakSpellus } from './spellus.js';
import { maakMeting } from './meting.js';
import { laadEconomie, maakEconomie } from './economie.js';
import { laadBouwwerken, maakBouwer } from './bouwen.js';
import { maakLeger } from './leger.js';
import { maakStrijd } from './strijd.js';
import { maakRood } from './rood.js';
import { maakOpslag } from './opslag.js';
import { maakUi } from './ui.js';
import { laadMissies, leesModus, zetModus, voortgang, missieGewonnen, opslagSleutel, profielVan, pasProfielToe } from './modus.js';

const GEEN_TITEL = 'burcht-banier.geenTitel';

async function start() {
  const canvas = document.getElementById('spel');
  const ui = maakUi();
  registreerOffline(ui);

  const assets = await laadAssets();
  assets.meldingen.forEach((tekst) => ui.toonMelding(tekst));

  // Vrij spel of een missie: dat bepaalt ook welke kaart je krijgt.
  const missies = await laadMissies();
  const modus = leesModus(missies);
  const missie = modus.soort === 'campagne' ? missies.campagne.find((c) => c.id === modus.missie) : null;
  const kaarten = await laadKaarten();
  const kaartNaam = (missie && missie.kaart) || 'standaard';
  const kaart = maakKaart(kaarten[kaartNaam] || { ...CONFIG.kaart });
  let titelOpen = false;   // staat het beginscherm of de levelkaart open? Dan staat het spel stil.
  const camera = maakCamera(kaartGrenzen(kaart.breedte, kaart.hoogte));
  const tekenaar = maakTekenaar(canvas, kaart, camera, assets);
  const wegvinder = maakWegvinder(kaart);
  // Hoe hoog je staat boven op een muur, een toren of een poort.
  const hoogtes = OBJECT_ASSET.map((naam) => (naam ? assets.haal(naam).hoogte || 0 : 0));
  const hoogteOp = (vak) => hoogtes[kaart.object[vak]] || 0;
  const eenheden = maakEenheden(kaart, wegvinder, assets.haal('kasteel.muur').hoogte, hoogteOp);
  const meting = maakMeting({ kaart, camera, eenheden, ui });
  const { bouwwerken, groepen } = await laadBouwwerken();
  const regels = await laadEconomie();
  // Vrij spel of een missie: de regels van die modus over de gewone regels heen.
  pasProfielToe(regels, profielVan(missies, modus));
  const opslag = maakOpslag(kaart.zaad, opslagSleutel(modus));

  // Bewaren: na elke keer bouwen, slopen, hakken of afleveren.
  let bewaarFoutGemeld = false;
  let bewaren = false;   // pas aan als het spel helemaal is opgebouwd
  const bewaar = () => {
    if (!bewaren) return;
    const stand = { bouwwerken: bouwer.eigenBouwwerken(), ...economie.bewaarStand(), leger: leger.bewaarStand(), strijd: strijd.bewaarStand() };
    if (opslag.bewaar(stand) || bewaarFoutGemeld) return;
    bewaarFoutGemeld = true;
    ui.toonMelding('Bewaren lukt hier niet. Wat je doet is weg als je het spel sluit.');
  };

  // De kaart is veranderd zonder dat er gebouwd is (er is een boom om).
  const kaartGewijzigd = (vakken) => {
    wegvinder.herbereken();
    tekenaar.kiesPlaatjes();
    eenheden.kaartVeranderd(vakken);
  };

  let naVoorraad = () => {};
  let verversHandel = () => {};   // het paneel van de voorraadkamer, als het openstaat   // wordt verderop ingevuld, als de bouwbalk er is
  const economie = maakEconomie({
    regels, kaart, wegvinder, eenheden,
    opKaart: kaartGewijzigd,
    opVoorraad: () => naVoorraad(),
    opVerandering: bewaar,
    opMelding: (tekst) => ui.toonMelding(tekst),
  });
  let naBouw = () => {};       // wordt hieronder ingevuld, als het gevecht er is
  const bouwer = maakBouwer({
    kaart, wegvinder, tekenaar, eenheden, economie, bouwwerken,
    opVerandering: () => {
      naBouw();
      bewaar();
    },
  });
  let naLeger = () => {};      // wordt verderop ingevuld, als de knoppen er zijn
  const leger = maakLeger({ regels, kaart, wegvinder, eenheden, economie, opVerandering: bewaar, opLeger: () => naLeger() });
  // Het gevecht: de aanvallen van de rode heer, winnen en verliezen.
  let naStrijd = () => {};     // de cijfers in beeld bijwerken
  let naEinde = () => {};      // gewonnen of verloren
  let naVerwoest = () => {};   // de vijand heeft iets van je vernield
  const strijd = maakStrijd({
    regels, kaart, wegvinder, eenheden, leger, bouwer, bouwwerken,
    opVerandering: bewaar,
    opStand: () => naStrijd(),
    opMelding: (tekst) => ui.toonMelding(tekst),
    opVerwoest: (werk, van) => naVerwoest(werk, van),
    opKaart: (vakken) => kaartGewijzigd(vakken),
    opEinde: (wat) => naEinde(wat),
  });
  // De rode heer: eigen voorraad, eigen werken, beslist zelf wanneer hij aanvalt.
  const rood = maakRood({
    regels, kaart, bouwwerken, leger, strijd, eenheden,
    perSeconde: CONFIG.spel.stappenPerSeconde,
    opMelding: (tekst) => ui.toonMelding(tekst),
    opVerandering: bewaar,
  });
  if (rood) strijd.koppelHeer(rood);
  naBouw = () => {
    strijd.kaartVeranderd();
    leger.kaartVeranderd();   // wie op een gesloopte muur stond, staat weer op de grond
  };

  // De stand van de vorige keer terugzetten, voordat de soldaten komen:
  // eerst de omgehakte bomen en de voorraad, dan wat je had gebouwd.
  const bewaard = opslag.laad();
  if (bewaard) {
    const bomenWeg = economie.zetStand(bewaard);
    if (bomenWeg.size) kaartGewijzigd(bomenWeg);
    const teruggezet = bouwer.zetTerug(bewaard.bouwwerken);
    if (teruggezet) ui.toonMelding(`Je kasteel staat er weer: ${teruggezet} ${teruggezet === 1 ? 'bouwwerk' : 'bouwwerken'}.`);
    leger.zetStand(bewaard.leger);
    strijd.zetStand(bewaard.strijd);
  } else {
    strijd.maakRoodKoning();
  }
  // Jouw koning: hij staat altijd bij de burcht als hij er nog niet is.
  if (!strijd.uitslag()) leger.zetKoning((kaart.start[0].y + 2) * kaart.breedte + kaart.start[0].x + 2);   // voor de burcht, zodat je hem ziet
  bewaren = true;

  // Alles wat de tekenlaag moet weten. doel = waar je soldaten heen stuurt
  // (licht kort op), kader = het kader waarmee je soldaten kiest, effecten =
  // pijlen en gevallenen, balken = het leven van beschadigde bouwwerken.
  const staat = {
    gekozen: null, schim: null, eenheden: eenheden.lijst, doel: null, kader: null,
    effecten: strijd.effecten, balken: strijd.balken,
    ladders: () => strijd.ladders(),
  };

  // --- Bouwen -------------------------------------------------------------------
  // sleutel = wat je aan het bouwen bent (of 'sloop'), begin en eind zijn
  // de tegels die je hebt aangetikt.
  const bouw = { sleutel: null, begin: null, eind: null };
  const SLOOP = 'sloop';

  // Werkt de schim op de kaart en de tekst in de bouwbalk bij.
  function toonBouw() {
    if (!bouw.sleutel) {
      staat.schim = null;
      ui.zetBouwStand({ actief: null });
      naLeger();
      return;
    }
    const sloop = bouw.sleutel === SLOOP;
    const werk = bouwwerken[bouw.sleutel];
    let tegels = [];
    let hint;
    let betaalbaar = true;

    if (sloop) {
      if (bouw.begin) tegels = [{ ...bouw.begin, ok: bouwer.isVanSpeler(bouw.begin.x, bouw.begin.y) }];
      if (!bouw.begin) hint = 'Tik op iets dat je zelf hebt gebouwd.';
      else if (tegels[0].ok) hint = 'Tik op Sloop om dit af te breken. Je krijgt de helft van de prijs terug.';
      else hint = 'Dit kun je niet slopen. Alleen wat je zelf hebt gebouwd.';
    } else {
      const naam = werk.naam.toLowerCase();
      if (bouw.begin) {
        const eind = werk.lijn && bouw.eind ? bouw.eind : bouw.begin;
        tegels = bouwer
          .lijn(bouw.begin.x, bouw.begin.y, eind.x, eind.y)
          .map((t) => ({ ...t, ok: !bouwer.waaromNiet(t.x, t.y, werk) }));
      }
      const goed = tegels.filter((t) => t.ok).length;
      const fout = tegels.length - goed;
      // Kun je het betalen? Zo niet, dan zie je wat je tekortkomt.
      const tekort = goed ? economie.tekort(werk.kosten, goed) : '';
      const kost = economie.kostTekst(werk.kosten, goed);
      betaalbaar = !tekort;
      if (!bouw.begin) {
        if (werk.lijn) hint = `Tik waar de ${naam} begint.`;
        else if (werk.inMuur) hint = `Tik een stuk van je muur aan waar de ${naam} moet komen.`;
        else hint = `Tik waar de ${naam} moet komen.`;
        if (werk.tip) hint += ` ${werk.tip}`;
      } else if (!goed && werk.lijn && bouw.eind) {
        hint = 'Hier kan het nergens (rood). Tik een ander eind.';
      } else if (!goed) {
        hint = `Hier kan het niet: ${bouwer.waaromNiet(bouw.begin.x, bouw.begin.y, werk)}.`;
      } else if (tekort) {
        hint = `Dat lukt niet: ${tekort}.`;
        // Wie deze grondstof nog niet binnenkrijgt, heeft een zetje nodig.
        const mist = economie.tekortAan(werk.kosten, goed);
        const bron = Object.values(bouwwerken).find((w) => w.werker && regels.beroepen[w.werker].haalt === mist);
        if (bron && !economie.aantalMetBeroep(bron.werker)) {
          hint += bron === werk ? ' Sloop iets: je krijgt de helft terug.' : ` Zet eerst een ${bron.naam.toLowerCase()} neer.`;
        }
      } else if (werk.lijn && !bouw.eind) {
        hint = `Tik waar hij eindigt, of zet dit ene stuk neer voor ${kost}.`;
      } else if (werk.lijn) {
        hint = `${goed} ${goed === 1 ? 'stuk' : 'stukken'} voor ${kost}` + (fout ? `, ${fout} kan niet (rood)` : '') + '. Tik een ander eind of zet neer.';
      } else {
        hint = `Dit kost ${kost}. Tik een andere plek of zet neer.`;
        // Een werkgebouw zonder boer doet niets: dat wil je vooraf weten.
        if (werk.werker && economie.bevolking().vrij <= 0) hint += ' Let op: er is geen boer vrij, het gebouw wacht tot er een komt.';
      }
    }

    staat.schim = tegels.length ? tekenaar.maakSchim(sloop ? null : werk.soort, tegels, sloop) : null;
    ui.zetBouwStand({
      actief: bouw.sleutel,
      hint,
      bevestigTekst: sloop ? 'Sloop' : 'Zet neer',
      kanBevestigen: betaalbaar && tegels.some((t) => t.ok),
    });
    naLeger();
  }

  // Een knop in de bouwbalk. Nog eens tikken op dezelfde knop begint opnieuw.
  function kiesBouw(sleutel) {
    if (meting.isBezig()) return;
    bouw.sleutel = sleutel;
    bouw.begin = null;
    bouw.eind = null;
    staat.gekozen = null;
    ui.toonTegel('');
    toonBouw();
  }

  function stopBouw() {
    kiesBouw(null);
  }

  function bevestigBouw() {
    if (!bouw.sleutel || !staat.schim) return;
    if (bouw.sleutel === SLOOP) bouwer.sloop(bouw.begin.x, bouw.begin.y);
    else bouwer.plaats(bouwwerken[bouw.sleutel], staat.schim.tegels.filter((t) => t.ok));
    bouw.begin = null;
    bouw.eind = null;
    toonBouw();
  }

  // Een tik op de kaart terwijl je bouwt.
  function tikBouw(x, y) {
    const werk = bouwwerken[bouw.sleutel];
    if (werk && werk.lijn && bouw.begin) bouw.eind = { x, y };
    else bouw.begin = { x, y };
    toonBouw();
  }

  ui.maakBouwbalk(
    groepen,
    [
      ...Object.values(bouwwerken).map((werk) => ({ sleutel: werk.sleutel, naam: werk.naam, kost: economie.kostTekst(werk.kosten), groep: werk.groep })),
      { sleutel: SLOOP, naam: 'Slopen' },
    ],
    kiesBouw,
    stopBouw
  );
  ui.opBevestig(bevestigBouw);
  ui.opKlaar(stopBouw);
  toonBouw();

  // De voorraad in beeld. Verandert die terwijl je bouwt, dan kan iets
  // wat net te duur was nu wel, of andersom.
  naVoorraad = () => {
    const volk = economie.bevolking();
    const stem = economie.stemming();
    // Een grondstof die je (nog) niet hebt en niet maakt, laat de balk weg:
    // anders past hij niet op een telefoon. Is hij vol, dan staat hij in het rood.
    const grondstoffen = Object.entries(regels.grondstoffen)
      .filter(([naam, def]) => def.begin > 0 || economie.voorraad[naam] > 0 || economie.maakt(naam))
      .map(([naam, def]) => {
        const max = economie.opslagMax(naam);
        return { naam: def.naam, aantal: economie.voorraad[naam], slecht: Number.isFinite(max) && economie.voorraad[naam] >= max };
      });
    ui.toonVoorraad([
      ...grondstoffen,
      // Je boeren en voor hoeveel er plek is, en hoe populair je bent.
      { naam: 'Boeren', aantal: `${volk.volk}/${volk.ruimte}` },
      { naam: 'Populariteit', aantal: stem.populariteit, slecht: stem.populariteit < stem.grens },
    ]);
    // Het paneel achter de voorraad: alles met naam erbij, en de belasting.
    const plus = (getal) => (getal > 0 ? `+${getal}` : getal < 0 ? `−${-getal}` : '0');
    const wacht = volk.wachtend ? ` ${volk.wachtend} ${volk.wachtend === 1 ? 'gebouw wacht' : 'gebouwen wachten'} op een boer.` : '';
    ui.toonVolk({
      regels: [
        grondstoffen.map((g) => { const sl = Object.keys(regels.grondstoffen).find((k) => regels.grondstoffen[k].naam === g.naam); const m = economie.opslagMax(sl); return `${g.naam} ${g.aantal}${Number.isFinite(m) ? ' van ' + m : ''}`; }).join(' · '),
        `Boeren: ${volk.volk}, plek voor ${volk.ruimte}. ${stem.lopers} zonder werk.${wacht}`,
        `Populariteit ${stem.populariteit}. Elke halve minuut ${plus(stem.totaal)}: ` + stem.factoren.filter((f) => f.waarde || f.naam !== 'afwisseling').map((f) => `${f.naam} ${plus(f.waarde)}`).join(', ') + '.',
        `Vanaf ${stem.grens} komen er boeren bij, daaronder vertrekken ze.`,
      ],
      tarieven: stem.tarieven.map((t) => ({ naam: t.naam, uitleg: `${volk.volk * t.goud} goud, ${plus(t.effect)}` })),
      gekozen: stem.belasting,
    });
    // Het paneel van de kazerne rekent met goud en boeren: dat gaat mee.
    naLeger();
    if (bouw.sleutel && bouw.begin) toonBouw();
  };
  naVoorraad();
  ui.opBelasting((stand) => economie.zetBelasting(stand));

  // --- Het leger --------------------------------------------------------------------
  // De kazerne: tik hem aan en leid soldaten op.
  let kazerneVak = -1;         // de kazerne waarvan het paneel openstaat
  let kazerneBericht = '';     // wat er het laatst gebeurde
  const toonKazerne = () => {
    const x = kazerneVak % kaart.breedte;
    const y = Math.floor(kazerneVak / kaart.breedte);
    const gebouw = kazerneVak >= 0 ? bouwer.werkOp(x, y) : null;
    if (!gebouw || !gebouw.leidtOp) {
      kazerneVak = -1;
      ui.toonKazerne({ open: false });
      return;
    }
    const volk = economie.bevolking();
    ui.toonKazerne({
      open: true,
      regels: [
        `${gebouw.naam}. Soldaten: ${leger.aantal()} van ${leger.max}. Goud: ${economie.voorraad.goud}. Boeren zonder werk: ${Math.max(0, volk.vrij)}.`,
        kazerneBericht || (gebouw.leidtOp === 'mystiek' ? 'Mystieke soldaten kosten goud, koper en twee boeren zonder werk.' : 'Een soldaat kost goud en een boer zonder werk.'),
      ],
      knoppen: Object.values(leger.soorten).filter((def) => (def.kazerne || 'klassiek') === (gebouw.leidtOp === true ? 'klassiek' : gebouw.leidtOp)).map((def) => ({ sleutel: def.sleutel, naam: def.naam, kost: economie.kostTekst(def.kosten), kan: !leger.waaromNiet(def.sleutel) })),
    });
  };
  const sluitKazerne = () => {
    kazerneVak = -1;
    kazerneBericht = '';
    ui.toonKazerne({ open: false });
  };
  ui.opKazerneSluit(sluitKazerne);
  ui.opOpleiden((sleutel) => {
    const reden = leger.leidOp(sleutel, kazerneVak);
    kazerneBericht = reden ? `Dat lukt niet: ${reden}.` : `Er staat een ${leger.soorten[sleutel].naam.toLowerCase()} klaar bij de kazerne.`;
    toonKazerne();
  });

  // De voorraadkamer: tik hem aan en verkoop wat je over hebt voor goud.
  let handelVak = -1;
  let handelBericht = '';
  const toonHandel = () => {
    const gebouw = handelVak >= 0 ? bouwer.werkOp(handelVak % kaart.breedte, Math.floor(handelVak / kaart.breedte)) : null;
    if (!gebouw || !gebouw.handel || !regels.handel) {
      handelVak = -1;
      ui.toonHandel({ open: false });
      return;
    }
    const h = regels.handel;
    ui.toonHandel({
      open: true,
      regels: [`Voorraadkamer. Goud: ${economie.voorraad.goud}. Elke kamer geeft plek aan ${regels.opslag.voorraadkamer} van elke grondstof.`, handelBericht || `Verkoop per ${h.per} stuks voor goud.`],
      knoppen: Object.keys(h.prijs).filter((n) => regels.grondstoffen[n] && (economie.voorraad[n] > 0 || economie.maakt(n))).map((n) => ({
        sleutel: n,
        naam: `${regels.grondstoffen[n].naam} (${economie.voorraad[n]})`,
        kost: `${h.per} voor ${h.prijs[n]} goud`,
        kan: economie.voorraad[n] >= h.per,
      })),
    }, (n) => {
      const reden = economie.verkoop(n);
      handelBericht = reden ? `Dat lukt niet: ${reden}.` : `Verkocht: ${h.per} ${regels.grondstoffen[n].naam.toLowerCase()} voor ${h.prijs[n]} goud.`;
      toonHandel();
    });
  };
  verversHandel = () => { if (handelVak >= 0) toonHandel(); };
  ui.opHandelSluit(() => { handelVak = -1; handelBericht = ''; ui.toonHandel({ open: false }); });

  // Soldaten kiezen: de knoppen rechts onderin en de uitleg erboven.
  let kaderAan = false;        // staat de knop Kader aan?
  naLeger = () => {
    const bouwt = !!bouw.sleutel;
    if (bouwt) kaderAan = false;
    const gekozen = leger.aantalGekozen();
    let hint = '';
    if (!bouwt && kaderAan) hint = 'Sleep met één vinger een kader om je soldaten.';
    else if (!bouwt && gekozen === 1) hint = '1 soldaat gekozen. Tik waar hij heen moet.';
    else if (!bouwt && gekozen > 1) hint = `${gekozen} soldaten gekozen. Tik waar ze heen moeten.`;
    // Zijn er vijanden, dan kun je die ook aantikken. Heb je een toren,
    // wachttoren of poort, dan kunnen ze de muur op.
    if (hint && gekozen && !kaderAan && strijd.aantalVijanden()) hint = hint.replace(/\.$/, ', of tik een vijand aan.');
    else if (hint && gekozen && !kaderAan && wegvinder.aantalOpgangen(0)) hint = hint.replace(/\.$/, ', ook boven op je muur.');
    ui.toonLeger({ zichtbaar: !bouwt && leger.aantal() > 0, hint, kader: kaderAan, gekozen: gekozen > 0 });
    // Groepen (dichtbij, afstand, belegering) en losse soorten kiezen.
    if (!bouwt && leger.aantal() > 0) {
      const t = leger.telling();
      const namenGroep = { melee: 'Dichtbij', afstand: 'Afstand', belegering: 'Belegering' };
      const lijst = [];
      const groepen = Object.keys(namenGroep).filter((g) => t.groepen[g]);
      const soortKeys = Object.keys(t.perSoort);
      const vol = (x) => x.gekozen === x.n;
      if (groepen.length > 1) for (const g of groepen) lijst.push({ sleutel: 'g:' + g, tekst: `${namenGroep[g]} ${t.groepen[g].n}`, actief: vol(t.groepen[g]) });
      if (soortKeys.length > 1) for (const sl of soortKeys) lijst.push({ sleutel: 's:' + sl, tekst: `${leger.soorten[sl].naam} ${t.perSoort[sl].n}`, actief: vol(t.perSoort[sl]), klein: true });
      ui.toonGroepen(lijst, (sl) => {
        kaderAan = false;
        if (sl.startsWith('g:')) leger.kiesGroep(sl.slice(2));
        else leger.kiesSoort(sl.slice(2));
      });
    }
    if (kazerneVak >= 0) toonKazerne();
    verversHandel();
  };
  ui.opKader(() => {
    kaderAan = !kaderAan;
    naLeger();
  });
  ui.opAlle(() => {
    kaderAan = false;
    leger.kiesAlles();
  });
  ui.opNiets(() => {
    kaderAan = false;
    leger.kiesGeen();
  });
  naLeger();

  // Waar staat deze soldaat op het scherm (het midden van zijn lijf)?
  const opScherm = (e) => camera.wereldNaarScherm((e.x - e.y) * (CONFIG.tegel.breedte / 2), (e.x + e.y) * (CONFIG.tegel.hoogte / 2) - 16 - e.hoogte);

  // Het stuk eigen muur onder een punt in de wereld, of null. Een muur is
  // hoog: wie de bovenkant aantikt, raakt op de grond een tegel erachter.
  // Daarom kijken we per hoogte welke tegel er dan onder het punt ligt.
  const muurHoogtes = [...new Set(hoogtes.filter((h) => h > 0))].sort((a, b) => b - a);
  const muurOnder = (wx, wy) => {
    let beste = null;
    for (const h of [...muurHoogtes, 0]) {
      const r = wereldNaarRaster(wx, wy + h);
      const x = Math.floor(r.x);
      const y = Math.floor(r.y);
      if (!leger.isMuur(x, y) || (h && hoogteOp(y * kaart.breedte + x) !== h)) continue;
      // Liggen er meer onder je vinger, dan telt de voorste.
      if (!beste || x + y > beste.x + beste.y) beste = { x, y };
    }
    return beste;
  };
  // Het bouwwerk van rood onder een punt in de wereld, of null. Een muur
  // is hoog: je vinger kan de voet, de zijkant of de bovenkant raken. We
  // lopen daarom de hoogtes af en kijken welke tegel er dan onder ligt.
  const hoogste = Math.max(0, ...hoogtes);
  const roodOnder = (wx, wy) => {
    let beste = null;
    for (let h = 0; h <= hoogste; h += 6) {
      const r = wereldNaarRaster(wx, wy + h);
      const x = Math.floor(r.x);
      const y = Math.floor(r.y);
      if (!binnenKaart(kaart, x, y)) continue;
      const vak = y * kaart.breedte + x;
      if (!strijd.isVanRood(vak) || hoogteOp(vak) < h - 6) continue;
      // Liggen er meer onder je vinger, dan telt de voorste.
      if (!beste || x + y > beste.x + beste.y) beste = { x, y, vak };
    }
    return beste;
  };
  const inBeeld = (e) => {
    const p = opScherm(e);
    return p.x >= 0 && p.y >= 0 && p.x <= camera.breedte && p.y <= camera.hoogte;
  };

  // De testfiguren van de prestatietest.
  // Met ?figuren=150 achter het adres start het spel met zoveel testfiguren.
  const gevraagd = Number(new URLSearchParams(window.location.search).get('figuren'));
  let keuze = Math.max(0, CONFIG.proef.aantallen.indexOf(gevraagd));
  const aantal = () => CONFIG.proef.aantallen[keuze];

  // Opnieuw beginnen: alles afbreken wat je hebt gebouwd, de bomen en de
  // beginvoorraad terug, en de bewaarde stand wissen.
  const opnieuw = () => {
    if (meting.isBezig()) return;
    stopBouw();
    bewaren = false;
    const gevochten = strijd.stand().golf > 0 || !!strijd.uitslag();
    const weg = bouwer.sloopAlles();
    const bomenTerug = economie.herstel();
    if (bomenTerug.size) kaartGewijzigd(bomenTerug);
    leger.herstel();
    strijd.herstel();
    sluitKazerne();
    ui.toonEinde({ open: false });
    // Wie op de plek van een teruggekomen boom stond, krijgt een nieuwe plek.
    eenheden.zetAantal(aantal(), false);
    opslag.wis();
    bewaren = true;
    if (weg || bomenTerug.size) ui.toonMelding(`Opnieuw begonnen: ${weg} ${weg === 1 ? 'bouwwerk' : 'bouwwerken'} afgebroken, het bos staat er weer.`);
    else ui.toonMelding(gevochten ? 'Opnieuw begonnen: de eerste aanval moet nog komen.' : 'Er was nog niets veranderd.');
  };
  ui.opOpnieuw(opnieuw);

  // --- Het gevecht ------------------------------------------------------------------
  const tijd = (seconden) => `${Math.floor(seconden / 60)}:${String(seconden % 60).padStart(2, '0')}`;
  let vijandInBeeld = false;
  const heerNaam = missie ? missie.heer : 'Rood';
  naStrijd = () => {
    const s = strijd.stand();
    let kort = '';
    let lang = '';
    const h = s.heer;
    const rij = h ? Object.entries(h.reserve).map(([k, n]) => { const naam = (regels.soldaten[k] ? regels.soldaten[k].naam : k).toLowerCase(); return `${n} ${n === 1 ? naam : naam + (naam.endsWith('ram') ? 'men' : 's')}`; }).join(', ') : '';
    if (s.golven === 0) {
      lang = 'Vrij spel zonder aanvallen: bouw, laat je volk groeien en oefen je soldaten.';
    } else if (s.vrede) {
      lang = 'De burcht van rood is gevallen. Er komt niemand meer.';
    } else if (h) {
      // Rood verzamelt zelf: je ziet hoe sterk zijn reserve is en wat hij nog verdient.
      const klaar = h.sterkte >= h.doel && h.wacht > 0;
      if (s.vijanden) kort = 'Aanval!';
      else kort = klaar ? tijd(h.wacht) : `Rood ${Math.floor(h.sterkte)}/${Math.ceil(h.doel)}`;
      lang = (s.vijanden ? `Aanval ${s.golf}: nog ${s.vijanden} ${s.vijanden === 1 ? 'vijand' : 'vijanden'}. ` : `Aanval ${s.golf + 1}: `) +
        `${heerNaam} heeft ${rij || 'nog niemand'} in reserve (sterkte ${h.sterkte} van ${h.doel}). ` +
        `Zijn werken: ${h.werken} van ${h.werkenTotaal} staan nog. Voorraad: ${h.voorraad.goud} goud, ${h.voorraad.hout} hout, ${h.voorraad.steen} steen.`;
    } else if (s.vijanden) {
      kort = 'Aanval!';
      lang = `Aanval ${s.golf}: nog ${s.vijanden} ${s.vijanden === 1 ? 'vijand' : 'vijanden'}. De volgende komt over ${tijd(s.klok)}.`;
    } else if (s.golven) {
      kort = tijd(s.klok);
      lang = `Aanval ${s.golf + 1} komt over ${tijd(s.klok)}.`;
    }
    lang += ` Burcht: ${s.burcht} van ${s.burchtMax}.`;
    if (!s.vrede) lang += ` Burcht van rood: ${s.rood} van ${s.roodMax}. Laat die vallen en je wint.`;
    ui.toonStrijd({ kort, lang: lang.trim(), slecht: s.vijanden > 0 });
    // De uitleg bij je soldaten verandert als er vijanden zijn.
    if (vijandInBeeld !== s.vijanden > 0) {
      vijandInBeeld = s.vijanden > 0;
      naLeger();
    }
  };
  naStrijd();

  // De vijand heeft iets vernield. Niet voor elk stuk muur een eigen bericht.
  let laatstVernield = -Infinity;
  let laatstVernieldRood = -Infinity;
  naVerwoest = (werk, van) => {
    naLeger();
    if (van === 2) {
      // Jouw soldaten hebben iets van rood vernield.
      if (performance.now() - laatstVernieldRood < 6000) return;
      laatstVernieldRood = performance.now();
      ui.toonMelding(`Je soldaten hebben een ${werk.naam.toLowerCase()} van rood vernield.`);
      return;
    }
    if (performance.now() - laatstVernield < 6000) return;
    laatstVernield = performance.now();
    ui.toonMelding(`De vijand heeft een ${werk.naam.toLowerCase()} van je vernield.`);
  };

  // Gewonnen of verloren: het spel staat stil tot je kiest.
  naEinde = (wat) => {
    stopBouw();
    sluitKazerne();
    leger.kiesGeen();
    // Iedereen blijft precies staan waar hij stond.
    for (const e of eenheden.lijst) {
      e.vorigeX = e.x;
      e.vorigeY = e.y;
    }
    const s = strijd.stand();
    if (wat === 'gewonnen') {
      const na = s.golf ? ` Je hebt ${s.golf} ${s.golf === 1 ? 'aanval' : 'aanvallen'} doorstaan.` : '';
      if (missie) {
        missieGewonnen(missie.id);
        const volgende = missies.campagne.find((c) => c.id === missie.id + 1);
        ui.toonEinde({ open: true, titel: `Missie ${missie.id} gewonnen!`, tekst: `${missie.uit}${na}`, verder: true, volgende: !!volgende });
      } else {
        ui.toonEinde({ open: true, titel: 'Gewonnen!', tekst: `De koning van rood is verslagen en de jouwe leeft nog.${na}`, verder: true });
      }
    } else {
      ui.toonEinde({ open: true, titel: 'Verloren', tekst: `Je koning is gesneuveld bij aanval ${s.golf}. Begin opnieuw en probeer het nog eens.`, verloren: true });
    }
  };
  ui.opVerder(() => {
    strijd.gaVerder();
    ui.toonEinde({ open: false });
    ui.toonMelding('Je speelt verder. Er komen geen aanvallen meer.');
  });
  ui.opEindeOpnieuw(opnieuw);

  // --- Het beginscherm en de levelkaart ---------------------------------------------------
  // (titelOpen staat hierboven bij de spellus.)
  // --- Het menu: vrij spel en de campagne -------------------------------------------------
  const modusNaam = missie ? missie.titel : `Vrij spel: ${missies.profielen[modus.profiel].naam}`;
  document.getElementById('versie').textContent += ` · ${missie ? 'missie ' + missie.id : missies.profielen[modus.profiel].naam.toLowerCase()}`;
  const gewonnen = voortgang();
  const menuItems = () => [
    ...missies.campagne.map((c) => ({
      groep: 'Campagne', sleutel: `missie:${c.id}`, naam: `${c.titel}${gewonnen.includes(c.id) ? ' (gewonnen)' : ''}`,
      tekst: c.id === 1 || gewonnen.includes(c.id - 1) ? c.intro.split('. ')[0] + '.' : `Win eerst missie ${c.id - 1}.`,
      kan: c.id === 1 || gewonnen.includes(c.id - 1),
      nu: modus.soort === 'campagne' && modus.missie === c.id,
    })),
    ...missies.vrij.map((v) => ({
      groep: 'Vrij spel', sleutel: `vrij:${v.profiel}`, naam: missies.profielen[v.profiel].naam, tekst: v.tekst,
      nu: modus.soort === 'vrij' && modus.profiel === v.profiel,
    })),
  ];
  const kiesModus = (sleutel) => {
    const [soort, waarde] = sleutel.split(':');
    const nieuw = soort === 'missie' ? { soort: 'campagne', missie: Number(waarde) } : { soort: 'vrij', profiel: waarde };
    if (!zetModus(nieuw)) {
      ui.toonMelding('Kiezen lukt hier niet: het geheugen van de browser is dicht.');
      return;
    }
    bewaar();   // wat je nu hebt blijft bewaard bij deze modus
    try { window.sessionStorage.setItem(GEEN_TITEL, '1'); } catch (fout) { /* dan zie je het beginscherm nog eens */ }
    window.location.reload();
  };
  const openMenu = () => ui.toonMenu({ open: true, nu: `Nu: ${modusNaam}. Elke modus bewaart zijn eigen spel.`, items: menuItems() });
  const kanVerder = !!bewaard || !!missie;   // is er al iets gespeeld?
  const toonKaart = () => {
    const open = (c) => c.id === 1 || gewonnen.includes(c.id - 1);
    ui.toonTitel({ open: true, weergave: 'kaart' });
    ui.toonLevelkaart(missies.campagne.map((c, i) => ({
      id: c.id, naam: c.heer.replace(/^(Heer|Vrouwe|Graaf)\s+/, ''),
      x: c.punt ? c.punt.x : 15 + (i * 35) % 70, y: c.punt ? c.punt.y : (i % 2 ? 35 : 65),
      staat: gewonnen.includes(c.id) ? 'gewonnen' : !open(c) ? 'dicht' : modus.soort === 'campagne' && modus.missie === c.id ? 'nu' : 'open',
    })), (id) => {
      const c = missies.campagne.find((m) => m.id === id);
      if (!open(c)) { document.getElementById('kaart-tekst').textContent = `Win eerst level ${id - 1}.`; return; }
      if (modus.soort === 'campagne' && modus.missie === id) { sluitTitel(); return; }
      kiesModus(`missie:${id}`);
    }, 'Tik op een level om het te starten. Een gewonnen level kun je opnieuw spelen.');
  };
  const toonTitel = () => { titelOpen = true; ui.toonTitel({ open: true, weergave: 'voorpagina', kanVerder }); };
  const sluitTitel = () => { titelOpen = false; ui.toonTitel({ open: false }); };
  ui.opTitel({ campagne: toonKaart, vrij: () => { sluitTitel(); openMenu(); }, verder: sluitTitel, terug: toonTitel });
  ui.opMenu(() => { titelOpen = true; toonKaart(); });
  // Het beginscherm komt bij het openen van de pagina, niet na het kiezen van een level.
  let geenTitel = false;
  try { geenTitel = window.sessionStorage.getItem(GEEN_TITEL) === '1'; window.sessionStorage.removeItem(GEEN_TITEL); } catch (fout) { /* geen geheugen: dan toon je het gewoon */ }
  if (!geenTitel) toonTitel();
  ui.opMenuKeuze(kiesModus);
  ui.opVolgende(() => kiesModus(`missie:${missie.id + 1}`));
  // Een missie die nog niet is begonnen opent met zijn intro.
  ui.opMissieBegin(() => ui.toonMissie({ open: false }));
  if (missie && !bewaard && !strijd.uitslag()) ui.toonMissie({ open: true, titel: missie.titel, tekst: `${missie.intro}${kaart.naam ? ` Je speelt op de kaart ${kaart.naam}.` : ''}` });
  if (strijd.uitslag()) naEinde(strijd.uitslag());
  else if (strijd.stand().golf === 0 && !strijd.stand().vrede) {
    const hh = strijd.stand().heer;
    ui.toonMelding(hh ? 'De rode heer verzamelt een leger. Zijn werken staan buiten zijn muur: sloop ze en hij verdient minder. Bouw een kazerne en leid soldaten op.' : `De rode heer valt over ${tijd(strijd.stand().klok)} aan. Bouw een kazerne en leid soldaten op.`);
  }

  const naarStart = () => {
    if (meting.isBezig()) return;
    const s = kaart.start[0];
    const midden = rasterNaarWereld(s.x + 0.5, s.y + 0.5);
    camera.zetZoom(CONFIG.camera.zoomStart);
    camera.kijkNaar(midden.x, midden.y);
  };

  tekenaar.pasGrootteAan();
  naarStart();
  window.addEventListener('resize', tekenaar.pasGrootteAan);
  window.addEventListener('orientationchange', () => setTimeout(tekenaar.pasGrootteAan, 300));

  // Tijdens een meting doen vingers niets, anders klopt de meting niet.
  const acties = {
    schuif: (dx, dy) => { if (!meting.isBezig()) camera.schuif(dx, dy); },
    zoom: (sx, sy, factor) => { if (!meting.isBezig()) camera.zoomRond(sx, sy, factor); },
    tik: (sx, sy) => {
      if (meting.isBezig()) return;
      const wereld = camera.schermNaarWereld(sx, sy);
      const raster = wereldNaarRaster(wereld.x, wereld.y);
      const x = Math.floor(raster.x);
      const y = Math.floor(raster.y);
      if (bouw.sleutel) {
        if (binnenKaart(kaart, x, y)) tikBouw(x, y);
        return;
      }
      // Een bouwwerk van rood onder je vinger gaat voor op wie erachter
      // staat: die zie je niet, dus die bedoel je ook niet.
      const vanRood = roodOnder(wereld.x, wereld.y);
      const erachter = (e) => !!vanRood && e.hoogte === 0 && e.x + e.y < vanRood.x + vanRood.y + 1;
      // Een eigen soldaat aangetikt: die kies je.
      const soldaat = leger.vind(wereld.x, wereld.y, 8 / camera.zoom);
      if (soldaat && !erachter(soldaat)) {
        kaderAan = false;
        leger.kies([soldaat]);
        return;
      }
      // Een vijand aangetikt: je gekozen soldaten vallen hem aan.
      const vijand = strijd.vindVijand(wereld.x, wereld.y, 8 / camera.zoom);
      if (vijand && !erachter(vijand)) {
        if (leger.aantalGekozen()) {
          strijd.valAan(leger.gekozen(), vijand);
          staat.doel = { x: Math.floor(vijand.x), y: Math.floor(vijand.y), duur: 900, tot: performance.now() + 900, aanval: true };
        } else {
          staat.gekozen = null;
          ui.toonTegel(`Vijand: ${leger.soorten[vijand.vijand].naam.toLowerCase()}, leven ${Math.max(0, Math.ceil(vijand.leven))} van ${vijand.levenMax}`);
        }
        return;
      }
      // De kazerne aangetikt: daar leid je soldaten op.
      const aangetikt = binnenKaart(kaart, x, y) ? bouwer.werkOp(x, y) : null;
      if (aangetikt && aangetikt.handel) {
        handelVak = y * kaart.breedte + x;
        handelBericht = '';
        staat.gekozen = { x, y };
        toonHandel();
        return;
      }
      if (aangetikt && aangetikt.leidtOp) {
        kazerneVak = y * kaart.breedte + x;
        kazerneBericht = '';
        staat.gekozen = { x, y };
        toonKazerne();
        return;
      }
      // Een muur van rood aangetikt met een ladderdrager erbij: die zet er
      // een ladder tegen. Staat er al een ladder van jou aan dit stuk muur,
      // dan klimmen je soldaten erop (een stormram beukt).
      if (vanRood && leger.aantalGekozen()) {
        const groep = leger.gekozen();
        const isDrager = (e) => !!leger.soorten[e.soldaat.sleutel].ladder;
        const isRam = (e) => !!leger.soorten[e.soldaat.sleutel].alleenBouw;
        // Sluipmoordenaars klimmen zonder ladder op een gewone muur. Tik je op
        // een toren of de poort, dan kiezen ze het dichtstbijzijnde stuk muur.
        const klimmers = groep.filter((e) => leger.soorten[e.soldaat.sleutel].klimMuur && !e.opMuur);
        if (klimmers.length) {
          const klimVak = strijd.isRodeMuur(vanRood.vak) ? vanRood.vak : strijd.dichtsteRodeMuur(vanRood.vak, 3);
          if (klimVak >= 0 && strijd.klimBevel(klimmers, klimVak)) {
            staat.doel = { x: klimVak % kaart.breedte, y: Math.floor(klimVak / kaart.breedte), duur: 900, tot: performance.now() + 900 };
            ui.toonMelding('Je sluipmoordenaar klimt op de muur van rood.');
            if (klimmers.length === groep.length) return;
          }
        }
        const draagt = groep.some(isDrager);
        // Tik je op een toren of de poort, dan zoekt de drager zelf het
        // dichtstbijzijnde gewone stuk muur.
        const muurVak = !draagt ? -1 : strijd.isRodeMuurZonderLadder(vanRood.vak) ? vanRood.vak : strijd.dichtsteRodeMuur(vanRood.vak, 3);
        if (draagt && muurVak >= 0) {
          if (strijd.zetLadderBevel(groep.filter(isDrager), muurVak)) {
            staat.doel = { x: muurVak % kaart.breedte, y: Math.floor(muurVak / kaart.breedte), duur: 900, tot: performance.now() + 900 };
            ui.toonMelding(groep.some((e) => leger.soorten[e.soldaat.sleutel].vast) ? 'De belegeringstoren gaat naar de muur van rood. Daarna klimmen je soldaten er overheen.' : 'Je ladderdrager zet een ladder tegen de muur van rood.');
          } else {
            ui.toonMelding('Je ladderdrager kan niet bij die muur komen.');
          }
          return;
        }
        if (draagt && !groep.some((e) => !isDrager(e))) {
          ui.toonMelding(strijd.isVanRood(vanRood.vak) && !strijd.isRodeMuurZonderLadder(vanRood.vak) ? 'Tik op een stuk gewone muur zonder ladder: daar past de toren of ladder tegen.' : 'Daar staat al een ladder.');
          return;
        }
        if (leger.heeftTrap(vanRood.x, vanRood.y) && groep.some((e) => !isRam(e) && !isDrager(e))) {
          const rammen = groep.filter(isRam);
          if (rammen.length) strijd.valBouwAan(rammen, vanRood.vak);
          leger.kies(groep.filter((e) => !isRam(e) && !isDrager(e)));
          const opWeg = leger.stuur(vanRood.x, vanRood.y, true);
          leger.kies(groep);
          if (opWeg) {
            staat.doel = { x: vanRood.x, y: vanRood.y, duur: 900, tot: performance.now() + 900, hoogte: hoogteOp(vanRood.vak) };
            return;
          }
        }
      }
      // Een bouwwerk van rood aangetikt: je gekozen soldaten vallen het aan.
      if (vanRood && leger.aantalGekozen()) {
        if (strijd.valBouwAan(leger.gekozen(), vanRood.vak)) {
          staat.doel = { x: vanRood.x, y: vanRood.y, duur: 900, tot: performance.now() + 900, aanval: true };
        } else {
          ui.toonMelding('Daar kunnen je soldaten niet bij komen. Breek eerst door de poort of de muur van rood.');
        }
        return;
      }
      if (vanRood) {
        const leven = strijd.levenOp(vanRood.vak);
        staat.gekozen = { x: vanRood.x, y: vanRood.y };
        ui.toonTegel(`Tegel ${vanRood.x}, ${vanRood.y}: ${beschrijfTegel(kaart, vanRood.x, vanRood.y)} van rood, leven ${leven.leven} van ${leven.max}`);
        return;
      }
      // Zijn er soldaten gekozen en tik je je eigen muur aan, dan gaan ze erop.
      const muur = leger.aantalGekozen() ? muurOnder(wereld.x, wereld.y) : null;
      if (muur) {
        if (leger.stuur(muur.x, muur.y, true)) {
          staat.doel = { x: muur.x, y: muur.y, duur: 900, tot: performance.now() + 900, hoogte: hoogteOp(muur.y * kaart.breedte + muur.x) };
        } else if (!leger.heeftTrap(muur.x, muur.y)) {
          ui.toonMelding('Je soldaten kunnen deze muur niet op. Bouw er een toren, wachttoren of poort aan vast.');
        } else {
          ui.toonMelding('Daar kunnen je soldaten niet komen.');
        }
        return;
      }
      // Zijn er soldaten gekozen, dan stuur je ze naar deze tegel.
      if (leger.aantalGekozen()) {
        if (!binnenKaart(kaart, x, y)) return;
        if (leger.stuur(x, y)) staat.doel = { x, y, duur: 900, tot: performance.now() + 900 };
        else ui.toonMelding('Daar kunnen je soldaten niet komen.');
        return;
      }
      if (binnenKaart(kaart, x, y)) {
        staat.gekozen = { x, y };
        let bezig = economie.beschrijf(y * kaart.breedte + x);
        const gebouw = bouwer.werkOp(x, y);
        if (gebouw && gebouw.woont) bezig = `plek voor ${gebouw.woont} boeren`;
        // Is het beschadigd, dan zie je hoeveel het nog kan hebben.
        const leven = strijd.levenOp(y * kaart.breedte + x);
        const heel = leven && leven.leven < leven.max ? `, leven ${leven.leven} van ${leven.max}` : '';
        ui.toonTegel(`Tegel ${x}, ${y}: ${beschrijfTegel(kaart, x, y)}` + (bezig ? `, ${bezig}` : '') + heel);
      } else {
        staat.gekozen = null;
        ui.toonTegel('');
      }
    },
    // Twee keer tikken op een soldaat kiest alle soldaten van die soort
    // die in beeld zijn.
    // Is het geen soldaat, dan is het gewoon nog een tik.
    dubbeltik: (sx, sy) => {
      if (meting.isBezig()) return;
      const wereld = camera.schermNaarWereld(sx, sy);
      const soldaat = bouw.sleutel ? null : leger.vind(wereld.x, wereld.y, 8 / camera.zoom);
      if (!soldaat) {
        acties.tik(sx, sy);
        return;
      }
      kaderAan = false;
      leger.kies(leger.soldaten().filter((e) => e.soldaat.sleutel === soldaat.soldaat.sleutel && inBeeld(e)));
    },
    // Met de knop Kader aan trek je met één vinger een kader om je soldaten.
    kaderActief: () => kaderAan && !bouw.sleutel && !meting.isBezig(),
    kaderBeweeg: (x1, y1, x2, y2) => {
      staat.kader = { x1, y1, x2, y2 };
    },
    kaderKlaar: (x1, y1, x2, y2) => {
      staat.kader = null;
      kaderAan = false;
      const links = Math.min(x1, x2);
      const rechts = Math.max(x1, x2);
      const boven = Math.min(y1, y2);
      const onder = Math.max(y1, y2);
      leger.kies(leger.soldaten().filter((e) => {
        const p = opScherm(e);
        return p.x >= links && p.x <= rechts && p.y >= boven && p.y <= onder;
      }));
    },
    kaderWeg: () => {
      staat.kader = null;
    },
  };
  koppelInvoer(canvas, acties);
  ui.opNaarStart(naarStart);

  // De testfiguren en de knoppen van de prestatietest.
  eenheden.zetAantal(aantal(), false);
  ui.zetAantalKnop(aantal());
  ui.opAantal(() => {
    keuze = (keuze + 1) % CONFIG.proef.aantallen.length;
    eenheden.zetAantal(aantal(), false);
    ui.zetAantalKnop(aantal());
  });
  ui.opMeting(() => {
    stopBouw();
    meting.start(Math.max(CONFIG.proef.aantalMeting, aantal()), aantal());
  });

  // De spellus: rekenen op vaste stappen, tekenen zo vaak als het kan.
  // Elke halve seconde werken we de cijfers in beeld bij.
  const teller = { beelden: 0, tijd: 0, tekenTijd: 0, stappen: 0, rekenTijd: 0 };
  let totBewaren = 0;
  let totStrijd = 0;
  maakSpellus({
    stappenPerSeconde: CONFIG.spel.stappenPerSeconde,
    stap: (dt) => {
      if (strijd.uitslag() || titelOpen) return;   // gewonnen of verloren, of het beginscherm staat open: alles staat stil
      eenheden.stap(dt);
      economie.stap();
      leger.stap();
      strijd.stap();
    },
    teken: (tussenstand) => tekenaar.teken(staat, tussenstand),
    meld: {
      stap: (rekenMs) => {
        teller.stappen++;
        teller.rekenTijd += rekenMs;
        meting.stapGedaan(rekenMs);
      },
      beeld: (verstreken, tekenMs) => {
        meting.beeld(verstreken, tekenMs);
        teller.beelden++;
        teller.tijd += verstreken;
        teller.tekenTijd += tekenMs;
        if (teller.tijd < 500) return;
        ui.toonBeelden(Math.round((teller.beelden * 1000) / teller.tijd));
        ui.toonProef({
          aantal: eenheden.aantalRidders(),
          wachtend: eenheden.aantalWachtend(),
          tekenMs: teller.tekenTijd / teller.beelden,
          rekenMs: teller.stappen ? teller.rekenTijd / teller.stappen : 0,
        });
        teller.beelden = teller.tijd = teller.tekenTijd = teller.stappen = teller.rekenTijd = 0;
        // Om de seconde de cijfers van de rode heer verversen (reserve, voorraad).
        if (++totStrijd >= 2) {
          totStrijd = 0;
          naStrijd();
        }
        // Om de tien seconden bewaren, zodat ook de klok van de aanvallen klopt.
        if (++totBewaren >= 20) {
          totBewaren = 0;
          bewaar();
        }
        // Soldaten lopen door: wat net nog kon, kan nu misschien niet meer.
        if (bouw.sleutel && bouw.begin) toonBouw();
      },
    },
  });

  // Handig bij het zoeken naar fouten.
  window.spel = { rood, regels, modus, missies, CONFIG, kaart, camera, staat, tekenaar, wegvinder, eenheden, meting, bouwer, bouwwerken, bouw, opslag, economie, leger, strijd };
}

// Zorgt dat het spel ook zonder internet start (zie sw.js) en dat je na
// een nieuwe stap vanzelf de nieuwste versie krijgt.
function registreerOffline(ui) {
  try {
    koppelOffline(ui);
  } catch (fout) {
    /* Op sommige plekken (een ingesloten voorbeeld) mag dit niet. Het spel werkt dan gewoon, alleen niet offline. */
  }
}

function koppelOffline(ui) {
  if (!('serviceWorker' in navigator)) return;
  const hadAlEen = !!navigator.serviceWorker.controller;
  let herladen = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadAlEen || herladen) return;
    herladen = true;
    window.location.reload();   // er staat een nieuwe versie klaar
  });
  navigator.serviceWorker
    .register('./sw.js')
    .then((registratie) => {
      // Elke keer dat je de app weer opent: kijken of er iets nieuws is.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registratie.update().catch(() => {});
      });
    })
    .catch(() => {
      /* zonder https werkt dit niet; het spel zelf werkt dan wel */
    });
  navigator.serviceWorker.ready.then(() => ui.zetOfflineKlaar()).catch(() => {});
}

start();
