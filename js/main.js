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
import { metLidwoord } from './taal.js';
import { maakVerhaal } from './verhaal.js';
import { laadMissies, leesModus, zetModus, voortgang, missieGewonnen, opslagSleutel, profielVan, pasProfielToe, isOpen, ontgrendeld } from './modus.js';

const GEEN_TITEL = 'burcht-banier.geenTitel';

async function start() {
  const canvas = document.getElementById('spel');
  const ui = maakUi();
  registreerOffline(ui);

  // Vrij spel of een missie: dat bepaalt ook welke kaart je krijgt.
  const missies = await laadMissies();
  const modus = leesModus(missies);
  const missie = modus.soort === 'campagne' ? missies.campagne.find((c) => c.id === modus.missie) : null;

  // De rode koning is in de campagne de heer zelf: zijn kleding en wapen.
  const heerKoning = missie && missie.rood && missie.rood.koning;
  const assets = await laadAssets(heerKoning ? { 'eenheid.koning_rood': heerKoning.uiterlijk || {} } : {});
  assets.meldingen.forEach((tekst) => ui.toonMelding(tekst));
  // In de campagne heb je alleen wat het verhaal al heeft vrijgegeven.
  const mag = ontgrendeld(missies.campagne, missie ? missie.id : null);
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
  // De naam van een soldaat of gebouw, voor wat je in een level vrijspeelt.
  const naamVan = (sleutel) => (regels.soldaten[sleutel] || bouwwerken[sleutel] || {}).naam;
  // Het verhaal: berichten van de figuren op hun moment (stap 31).
  const verhaal = maakVerhaal({ campagne: missies, missie, toon: (b) => ui.toonVerhaal(b) });
  const verhaalStand = () => ({ ...strijd.stand(), koning: strijd.koning(0), roodKoning: strijd.koning(1) });

  // Wat er in dit level nieuw is: de beloning van het level ervoor.
  const nieuwHier = () => {
    const vorige = missie ? missies.campagne.find((c) => c.id === missie.id - 1) : null;
    const erbij = vorige ? (vorige.beloning || []).map(naamVan).filter(Boolean) : [];
    return erbij.length ? ` New for you: ${erbij.join(', ')}.` : '';
  };
  const regels = await laadEconomie();
  // Vrij spel of een missie: de regels van die modus over de gewone regels heen.
  pasProfielToe(regels, profielVan(missies, modus), missie && missie.rood);
  const opslag = maakOpslag(kaart.zaad, opslagSleutel(modus));

  // Bewaren: na elke keer bouwen, slopen, hakken of afleveren.
  let bewaarFoutGemeld = false;
  let bewaren = false;   // pas aan als het spel helemaal is opgebouwd
  const bewaar = () => {
    if (!bewaren) return;
    const stand = { bouwwerken: bouwer.eigenBouwwerken(), ...economie.bewaarStand(), leger: leger.bewaarStand(), strijd: strijd.bewaarStand() };
    if (opslag.bewaar(stand) || bewaarFoutGemeld) return;
    bewaarFoutGemeld = true;
    ui.toonMelding('Saving does not work here. Your progress is lost when you close the game.');
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
    if (teruggezet) ui.toonMelding(`Your castle is back: ${teruggezet} ${teruggezet === 1 ? 'building' : 'buildings'}.`);
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
      if (!bouw.begin) hint = 'Tap something you built yourself.';
      else if (tegels[0].ok) hint = 'Tap Demolish to tear this down. You get half the price back.';
      else hint = 'You cannot demolish this. Only what you built yourself.';
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
        if (werk.lijn) hint = `Tap where the ${naam} starts.`;
        else if (werk.inMuur) hint = `Tap the piece of your wall where the ${naam} should go.`;
        else hint = `Tap where the ${naam} should go.`;
        if (werk.tip) hint += ` ${werk.tip}`;
      } else if (!goed && werk.lijn && bouw.eind) {
        hint = 'It fits nowhere here (red). Tap another end point.';
      } else if (!goed) {
        hint = `Not here: ${bouwer.waaromNiet(bouw.begin.x, bouw.begin.y, werk)}.`;
      } else if (tekort) {
        hint = `Not possible: ${tekort}.`;
        // Wie deze grondstof nog niet binnenkrijgt, heeft een zetje nodig.
        const mist = economie.tekortAan(werk.kosten, goed);
        const bron = Object.values(bouwwerken).find((w) => w.werker && regels.beroepen[w.werker].haalt === mist);
        if (bron && !economie.aantalMetBeroep(bron.werker)) {
          hint += bron === werk ? ' Demolish something: you get half back.' : ` First build ${metLidwoord(bron.naam.toLowerCase())}.`;
        }
      } else if (werk.lijn && !bouw.eind) {
        hint = `Tap where it ends, or place this one piece for ${kost}.`;
      } else if (werk.lijn) {
        hint = `${goed} ${goed === 1 ? 'piece' : 'pieces'} for ${kost}` + (fout ? `, ${fout} not possible (red)` : '') + '. Tap another end point or place it.';
      } else {
        hint = `This costs ${kost}. Tap another spot or place it.`;
        // Een werkgebouw zonder boer doet niets: dat wil je vooraf weten.
        if (werk.werker && economie.bevolking().vrij <= 0) hint += ' Note: no peasant is free, the building waits until one arrives.';
      }
    }

    staat.schim = tegels.length ? tekenaar.maakSchim(sloop ? null : werk.soort, tegels, sloop) : null;
    ui.zetBouwStand({
      actief: bouw.sleutel,
      hint,
      bevestigTekst: sloop ? 'Demolish' : 'Place',
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
      ...Object.values(bouwwerken).filter((werk) => mag(werk.sleutel)).map((werk) => ({ sleutel: werk.sleutel, naam: werk.naam, kost: economie.kostTekst(werk.kosten), groep: werk.groep })),
      { sleutel: SLOOP, naam: 'Demolish' },
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
        return { sleutel: naam, naam: def.naam, aantal: economie.voorraad[naam], slecht: Number.isFinite(max) && economie.voorraad[naam] >= max };
      });
    ui.toonVoorraad([
      ...grondstoffen,
      // Je boeren en voor hoeveel er plek is, en hoe populair je bent.
      { sleutel: 'boeren', naam: 'Peasants', aantal: `${volk.volk}/${volk.ruimte}` },
      { sleutel: 'populariteit', naam: 'Popularity', aantal: stem.populariteit, slecht: stem.populariteit < stem.grens },
    ]);
    // Het paneel achter de voorraad: alles met naam erbij, en de belasting.
    const plus = (getal) => (getal > 0 ? `+${getal}` : getal < 0 ? `−${-getal}` : '0');
    const wacht = volk.wachtend ? ` ${volk.wachtend} ${volk.wachtend === 1 ? 'building is' : 'buildings are'} waiting for a peasant.` : '';
    ui.toonVolk({
      regels: [
        grondstoffen.map((g) => { const sl = Object.keys(regels.grondstoffen).find((k) => regels.grondstoffen[k].naam === g.naam); const m = economie.opslagMax(sl); return `${g.naam} ${g.aantal}${Number.isFinite(m) ? ' of ' + m : ''}`; }).join(' · '),
        `Peasants: ${volk.volk}, room for ${volk.ruimte}. ${stem.lopers} without work.${wacht}`,
        `Popularity ${stem.populariteit}. Every half minute ${plus(stem.totaal)}: ` + stem.factoren.filter((f) => f.waarde || f.naam !== 'variety').map((f) => `${f.naam} ${plus(f.waarde)}`).join(', ') + '.',
        `From ${stem.grens} upwards new peasants arrive; below that they leave.`,
      ],
      tarieven: stem.tarieven.map((t) => ({ naam: t.naam, uitleg: `${volk.volk * t.goud} gold, ${plus(t.effect)}` })),
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
        `${gebouw.naam}. Soldiers: ${leger.aantal()} of ${leger.max}. Gold: ${economie.voorraad.goud}. Idle peasants: ${Math.max(0, volk.vrij)}.`,
        kazerneBericht || (gebouw.leidtOp === 'mystiek' ? 'Mystic soldiers cost gold, copper and two idle peasants.' : 'A soldier costs gold and one idle peasant.'),
      ],
      knoppen: Object.values(leger.soorten).filter((def) => mag(def.sleutel) && (def.kazerne || 'klassiek') === (gebouw.leidtOp === true ? 'klassiek' : gebouw.leidtOp)).map((def) => ({ sleutel: def.sleutel, naam: def.naam, kost: economie.kostTekst(def.kosten), kan: !leger.waaromNiet(def.sleutel) })),
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
    kazerneBericht = reden ? `Not possible: ${reden}.` : `${metLidwoord(leger.soorten[sleutel].naam.toLowerCase(), true)} is ready at the barracks.`;
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
      regels: [`Storehouse. Gold: ${economie.voorraad.goud}. Each storehouse holds ${regels.opslag.voorraadkamer} of every resource.`, handelBericht || `Sell in lots of ${h.per} for gold.`],
      knoppen: Object.keys(h.prijs).filter((n) => regels.grondstoffen[n] && (economie.voorraad[n] > 0 || economie.maakt(n))).map((n) => ({
        sleutel: n,
        naam: `${regels.grondstoffen[n].naam} (${economie.voorraad[n]})`,
        kost: `${h.per} for ${h.prijs[n]} gold`,
        kan: economie.voorraad[n] >= h.per,
      })),
    }, (n) => {
      const reden = economie.verkoop(n);
      handelBericht = reden ? `Not possible: ${reden}.` : `Sold: ${h.per} ${regels.grondstoffen[n].naam.toLowerCase()} for ${h.prijs[n]} gold.`;
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
    if (!bouwt && kaderAan) hint = 'Drag a box around your soldiers with one finger.';
    else if (!bouwt && gekozen === 1) hint = '1 soldier selected. Tap where he should go.';
    else if (!bouwt && gekozen > 1) hint = `${gekozen} soldiers selected. Tap where they should go.`;
    // Zijn er vijanden, dan kun je die ook aantikken. Heb je een toren,
    // wachttoren of poort, dan kunnen ze de muur op.
    if (hint && gekozen && !kaderAan && strijd.aantalVijanden()) hint = hint.replace(/\.$/, ', or tap an enemy.');
    else if (hint && gekozen && !kaderAan && wegvinder.aantalOpgangen(0)) hint = hint.replace(/\.$/, ', also on top of your wall.');
    ui.toonLeger({ zichtbaar: !bouwt && leger.aantal() > 0, hint, kader: kaderAan, gekozen: gekozen > 0 });
    // Groepen (dichtbij, afstand, belegering) en losse soorten kiezen.
    if (!bouwt && leger.aantal() > 0) {
      const t = leger.telling();
      const namenGroep = { melee: 'Melee', afstand: 'Ranged', belegering: 'Siege' };
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
    ui.verbergVerhaal();
    verhaal.wis();
    // Wie op de plek van een teruggekomen boom stond, krijgt een nieuwe plek.
    eenheden.zetAantal(aantal(), false);
    opslag.wis();
    bewaren = true;
    if (weg || bomenTerug.size) ui.toonMelding(`Restarted: ${weg} ${weg === 1 ? 'building' : 'buildings'} torn down, the forest is back.`);
    else ui.toonMelding(gevochten ? 'Restarted: the first attack is still to come.' : 'Nothing had changed yet.');
  };
  ui.opOpnieuw(opnieuw);

  // --- Het gevecht ------------------------------------------------------------------
  const tijd = (seconden) => `${Math.floor(seconden / 60)}:${String(seconden % 60).padStart(2, '0')}`;
  let vijandInBeeld = false;
  const heerNaam = missie ? missie.heer : 'Red';
  naStrijd = () => {
    const s = strijd.stand();
    let kort = '';
    let lang = '';
    const h = s.heer;
    const rij = h ? Object.entries(h.reserve).map(([k, n]) => { const d = regels.soldaten[k]; return `${n} ${(d ? (n === 1 ? d.naam : d.meervoud || d.naam + 's') : k).toLowerCase()}`; }).join(', ') : '';
    if (s.golven === 0) {
      lang = 'Free play without attacks: build, grow your people and train your soldiers.';
    } else if (s.vrede) {
      lang = 'The red keep has fallen. No one else is coming.';
    } else if (h) {
      // Rood verzamelt zelf: je ziet hoe sterk zijn reserve is en wat hij nog verdient.
      const klaar = h.sterkte >= h.doel && h.wacht > 0;
      if (s.vijanden) kort = 'Attack!';
      else kort = klaar ? tijd(h.wacht) : `Red ${Math.floor(h.sterkte)}/${Math.ceil(h.doel)}`;
      lang = (s.vijanden ? `Attack ${s.golf}: ${s.vijanden} ${s.vijanden === 1 ? 'enemy' : 'enemies'} left. ` : `Attack ${s.golf + 1}: `) +
        `${heerNaam} has ${rij || 'no one yet'} in reserve (strength ${h.sterkte} of ${h.doel}). ` +
        `Workshops still standing: ${h.werken} of ${h.werkenTotaal}. Stock: ${h.voorraad.goud} gold, ${h.voorraad.hout} wood, ${h.voorraad.steen} stone.`;
    } else if (s.vijanden) {
      kort = 'Attack!';
      lang = `Attack ${s.golf}: ${s.vijanden} ${s.vijanden === 1 ? 'enemy' : 'enemies'} left. The next one comes in ${tijd(s.klok)}.`;
    } else if (s.golven) {
      kort = tijd(s.klok);
      lang = `Attack ${s.golf + 1} comes in ${tijd(s.klok)}.`;
    }
    lang += ` Keep: ${s.burcht} of ${s.burchtMax}.`;
    if (!s.vrede) lang += ` Red keep: ${s.rood} of ${s.roodMax}. Break it and the red king grows weaker.`;
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
      ui.toonMelding(`Your soldiers destroyed a red ${werk.naam.toLowerCase()}.`);
      return;
    }
    if (performance.now() - laatstVernield < 6000) return;
    laatstVernield = performance.now();
    ui.toonMelding(`The enemy destroyed your ${werk.naam.toLowerCase()}.`);
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
      const na = s.golf ? ` You withstood ${s.golf} ${s.golf === 1 ? 'attack' : 'attacks'}.` : '';
      if (missie) {
        missieGewonnen(missie.id);
        const volgende = missies.campagne.find((c) => c.id === missie.id + 1 && c.speelbaar);
        const erbij = (missie.beloning || []).map(naamVan).filter(Boolean);
        ui.verbergVerhaal();
        ui.toonEinde({
          open: true,
          titel: `Victory at ${missie.naam}!`,
          tekst: `${missie.uit}${na}`,
          portret: { naam: missie.heer, portret: missie.portret },
          wessel: missie.wessel || '',
          erbij: erbij.length ? `Unlocked: ${erbij.join(', ')}.` : '',
          verder: true,
          volgende: !!volgende,
        });
      } else {
        ui.toonEinde({ open: true, titel: 'Victory!', tekst: `The red king is defeated and yours still lives.${na}`, verder: true });
      }
    } else {
      ui.verbergVerhaal();
      ui.toonEinde({ open: true, titel: 'Defeat', tekst: `Your king fell during attack ${s.golf}. Start again and try once more.`, verloren: true, portret: { naam: 'King Karel', portret: 'karel_rouw' } });
    }
  };
  ui.opVerder(() => {
    strijd.gaVerder();
    ui.toonEinde({ open: false });
    ui.toonMelding('You play on. No more attacks will come.');
  });
  ui.opEindeOpnieuw(opnieuw);

  // --- Het beginscherm en de levelkaart ---------------------------------------------------
  // (titelOpen staat hierboven bij de spellus.)
  // --- Het menu: vrij spel en de campagne -------------------------------------------------
  const modusNaam = missie ? missie.titel : `Free play: ${missies.profielen[modus.profiel].naam}`;
  document.getElementById('versie').textContent += ` · ${missie ? 'mission ' + missie.id : missies.profielen[modus.profiel].naam.toLowerCase()}`;
  const gewonnen = voortgang();
  const menuItems = () => [
    ...missies.campagne.filter((c) => c.speelbaar).map((c) => ({
      groep: 'Campaign', sleutel: `missie:${c.id}`, naam: `${c.titel}${gewonnen.includes(c.id) ? ' (won)' : ''}`,
      tekst: isOpen(c, gewonnen) ? c.intro.split('. ')[0] + '.' : `Win level ${c.id - 1} first.`,
      kan: isOpen(c, gewonnen),
      nu: modus.soort === 'campagne' && modus.missie === c.id,
    })),
    ...missies.vrij.map((v) => ({
      groep: 'Free play', sleutel: `vrij:${v.profiel}`, naam: missies.profielen[v.profiel].naam, tekst: v.tekst,
      nu: modus.soort === 'vrij' && modus.profiel === v.profiel,
    })),
  ];
  const kiesModus = (sleutel) => {
    const [soort, waarde] = sleutel.split(':');
    const nieuw = soort === 'missie' ? { soort: 'campagne', missie: Number(waarde) } : { soort: 'vrij', profiel: waarde };
    if (!zetModus(nieuw)) {
      ui.toonMelding('Choosing does not work here: the browser storage is blocked.');
      return;
    }
    bewaar();   // wat je nu hebt blijft bewaard bij deze modus
    try { window.sessionStorage.setItem(GEEN_TITEL, '1'); } catch (fout) { /* dan zie je het beginscherm nog eens */ }
    window.location.reload();
  };
  const openMenu = () => ui.toonMenu({ open: true, nu: `Now: ${modusNaam}. Each mode keeps its own game.`, items: menuItems() });
  const kanVerder = !!bewaard || !!missie;   // is er al iets gespeeld?
  const toonKaart = () => {
    const open = (c) => isOpen(c, gewonnen);
    ui.toonTitel({ open: true, weergave: 'kaart' });
    ui.toonLevelkaart(missies.campagne.map((c, i) => ({
      id: c.id, naam: c.naam, portret: c.portret,
      x: c.punt ? c.punt.x : 10 + i * 8, y: c.punt ? c.punt.y : 50,
      staat: gewonnen.includes(c.id) ? 'gewonnen' : !c.speelbaar ? 'later' : !open(c) ? 'dicht' : modus.soort === 'campagne' && modus.missie === c.id ? 'nu' : 'open',
    })), (id) => {
      const c = missies.campagne.find((m) => m.id === id);
      const tekst = document.getElementById('kaart-tekst');
      if (!c.speelbaar) { tekst.textContent = `${c.titel}${c.heer ? ` (${c.heer})` : ''}: coming later.`; return; }
      if (!open(c)) { tekst.textContent = `${c.titel}: win level ${id - 1} first.`; return; }
      if (modus.soort === 'campagne' && modus.missie === id) { sluitTitel(); return; }
      kiesModus(`missie:${id}`);
    }, 'Tap a level to start it. You can replay a level you have won.', missies.levelkaart);
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
  ui.opMissieBegin(() => { ui.toonMissie({ open: false }); verhaal.start(); });
  if (missie && !bewaard && !strijd.uitslag()) {
    const verteller = missies.figuren[missie.verteller || 'bartholt'];
    ui.toonMissie({
      open: true,
      titel: missie.titel,
      tekst: missie.intro,
      spreker: verteller || null,
      tegen: missie.heer ? { naam: missie.heer, portret: missie.portret } : null,
      extra: [nieuwHier().trim(), kaart.naam ? `Map: ${kaart.naam}.` : ''].filter(Boolean),
    });
  } else {
    verhaal.start();
  }
  if (strijd.uitslag()) naEinde(strijd.uitslag());
  else if (strijd.stand().golf === 0 && !strijd.stand().vrede) {
    const hh = strijd.stand().heer;
    ui.toonMelding(hh ? 'The enemy is gathering an army. Their workshops stand outside their wall: destroy them and they earn less. Build barracks and train soldiers.' : `The enemy attacks in ${tijd(strijd.stand().klok)}. Build barracks and train soldiers.`);
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
          ui.toonTegel(`Enemy: ${leger.soorten[vijand.vijand].naam.toLowerCase()}, health ${Math.max(0, Math.ceil(vijand.leven))} of ${vijand.levenMax}`);
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
            ui.toonMelding('Your assassin climbs the red wall.');
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
            ui.toonMelding(groep.some((e) => leger.soorten[e.soldaat.sleutel].vast) ? 'The siege tower rolls to the red wall. Then your soldiers climb over it.' : 'Your ladder bearer sets a ladder against the red wall.');
          } else {
            ui.toonMelding('Your ladder bearer cannot reach that wall.');
          }
          return;
        }
        if (draagt && !groep.some((e) => !isDrager(e))) {
          ui.toonMelding(strijd.isVanRood(vanRood.vak) && !strijd.isRodeMuurZonderLadder(vanRood.vak) ? 'Tap a plain piece of wall without a ladder: the tower or ladder fits there.' : 'There is already a ladder there.');
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
          ui.toonMelding('Your soldiers cannot reach that. Break through the red gate or wall first.');
        }
        return;
      }
      if (vanRood) {
        const leven = strijd.levenOp(vanRood.vak);
        staat.gekozen = { x: vanRood.x, y: vanRood.y };
        ui.toonTegel(`Tile ${vanRood.x}, ${vanRood.y}: red ${beschrijfTegel(kaart, vanRood.x, vanRood.y)}, health ${leven.leven} of ${leven.max}`);
        return;
      }
      // Zijn er soldaten gekozen en tik je je eigen muur aan, dan gaan ze erop.
      const muur = leger.aantalGekozen() ? muurOnder(wereld.x, wereld.y) : null;
      if (muur) {
        if (leger.stuur(muur.x, muur.y, true)) {
          staat.doel = { x: muur.x, y: muur.y, duur: 900, tot: performance.now() + 900, hoogte: hoogteOp(muur.y * kaart.breedte + muur.x) };
        } else if (!leger.heeftTrap(muur.x, muur.y)) {
          ui.toonMelding('Your soldiers cannot get onto this wall. Attach a tower, watchtower or gate to it.');
        } else {
          ui.toonMelding('Your soldiers cannot get there.');
        }
        return;
      }
      // Zijn er soldaten gekozen, dan stuur je ze naar deze tegel.
      if (leger.aantalGekozen()) {
        if (!binnenKaart(kaart, x, y)) return;
        if (leger.stuur(x, y)) staat.doel = { x, y, duur: 900, tot: performance.now() + 900 };
        else ui.toonMelding('Your soldiers cannot get there.');
        return;
      }
      if (binnenKaart(kaart, x, y)) {
        staat.gekozen = { x, y };
        let bezig = economie.beschrijf(y * kaart.breedte + x);
        const gebouw = bouwer.werkOp(x, y);
        if (gebouw && gebouw.woont) bezig = `room for ${gebouw.woont} peasants`;
        // Is het beschadigd, dan zie je hoeveel het nog kan hebben.
        const leven = strijd.levenOp(y * kaart.breedte + x);
        const heel = leven && leven.leven < leven.max ? `, health ${leven.leven} of ${leven.max}` : '';
        ui.toonTegel(`Tile ${x}, ${y}: ${beschrijfTegel(kaart, x, y)}` + (bezig ? `, ${bezig}` : '') + heel);
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
      verhaal.stap(dt, verhaalStand);
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
