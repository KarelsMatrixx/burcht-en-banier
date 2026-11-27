// MAIN: zet alle onderdelen in elkaar en start het spel.

import { CONFIG } from './config.js';
import { geluid } from './geluid.js';
import { maakKaart, laadKaarten, laadKastelen, binnenKaart, beschrijfTegel, OBJECT_ASSET, OBJECT } from './kaart.js';
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
import { maakVeldheer } from './veldheer.js';
import { maakOpslag } from './opslag.js';
import { maakUi } from './ui.js';
import { metLidwoord } from './taal.js';
import { maakVerhaal } from './verhaal.js';
import { maakProloog } from './proloog.js';
import { maakHinderlaag } from './hinderlaag.js';
import { maakReserve } from './reserve.js';
import { maakSluipers } from './sluipers.js';
import { maakPoortwacht } from './poortwacht.js';
import { maakGids } from './gids.js';
import { maakHaven } from './haven.js';
import { maakHavenLes } from './havenles.js';
import { maakVisserij } from './visserij.js';
import { maakVisLes } from './visles.js';
import { maakHandelLes } from './handelles.js';
import { maakLegerLes } from './legerles.js';
import { maakGolven } from './golven.js';
import { maakZeeleven } from './zeeleven.js';
import { maakFiguranten } from './figuranten.js';
import { maakSlachting } from './slachting.js';
import { maakDoel } from './doel.js';
import { maakLoodsen } from './loodsen.js';
import { maakBevrijding } from './bevrijding.js';
import { maakGevangene } from './gevangene.js';
import { SOORT } from './eenheden.js';
import { laadMissies, leesModus, zetModus, voortgang, missieGewonnen, opslagSleutel, profielVan, pasProfielToe, isOpen, eerstWinnen, ontgrendeld } from './modus.js';

// Landschapsprofiel uit data/landschappen.json; zonder naam of bij een fout: null (gewoon groen).
async function laadLandschap(naam) {
  if (!naam) return null;
  try {
    const antwoord = await fetch('data/landschappen.json');
    if (!antwoord.ok) return null;
    const lijst = (await antwoord.json()).landschappen;
    return lijst[naam] ? { sleutel: naam, ...lijst[naam] } : null;
  } catch (fout) {
    return null;
  }
}

const GEEN_TITEL = 'burcht-banier.geenTitel';
const TOON_BEELD = 'burcht-banier.toonBeeld';   // na het kiezen van een level op de kaart: eerst het verhaalbeeld

async function start() {
  const canvas = document.getElementById('spel');
  const ui = maakUi();
  registreerOffline(ui);

  // Vrij spel of een missie: dat bepaalt ook welke kaart je krijgt.
  const missies = await laadMissies();
  const modus = leesModus(missies);
  const missie = modus.soort === 'campagne' ? missies.campagne.find((c) => c.id === modus.missie) : null;

  // Het kasteel van rood: in de campagne het ontwerp van het level (stap 33).
  const { kastelen, materialen } = await laadKastelen();
  const ontwerp = missie && missie.kasteel ? kastelen[missie.kasteel] : null;

  if (missie && missie.kasteel && !ontwerp) throw new Error(`campagne.json: level ${missie.id} kent geen kasteel ${missie.kasteel}`);
  // Het materiaal van dat kasteel: eigen plaatjes voor muur, torens, poort en burcht van rood.
  const materiaal = ontwerp && ontwerp.materiaal ? materialen[ontwerp.materiaal] : null;
  const roodKasteel = {};
  if (materiaal) {
    const hoger = ontwerp.hoog ? 1.25 : 1;
    for (const deel of ['muur', 'toren', 'wachttoren', 'moordgatentoren', 'poort']) roodKasteel['rood.' + deel] = { basis: 'kasteel.' + deel, kleur: materiaal.kleur, hoogteFactor: hoger };
    // Een materiaal kan de burcht een andere vorm geven (tentenkamp: de commandotent) en een tweede kleur meegeven.
    // Een materiaal kan de burcht een andere vorm geven. Tentenkamp: de 8 buitenste tegels zijn een laag
    // houten podium (vorm, hoogte, vloer) en de middelste tegel is de commandotent (middenVorm, middenHoogte).
    // Een stijl voor het hoofdkasteel (kunst.js burchtStijl: a hoge donjon, b rotsburcht, c tolpoort, d scheve burcht): uit het ontwerp of het materiaal.
    const burchtStijl = ontwerp.burchtStijl || materiaal.stijl || null;
    const burchtVelden = { ...(burchtStijl ? { stijl: burchtStijl } : {}), kleur: materiaal.burcht || materiaal.kleur, ...(materiaal.vorm ? { vorm: materiaal.vorm } : {}), ...(materiaal.accent ? { accent: materiaal.accent } : {}), ...(materiaal.vloer ? { vloer: materiaal.vloer } : {}), ...(materiaal.hoogte ? { hoogte: materiaal.hoogte } : {}) };
    roodKasteel['rood.burcht'] = { basis: 'kasteel.burcht', ...burchtVelden };
    roodKasteel['rood.banier_rood'] = { basis: 'kasteel.banier_rood', ...burchtVelden, ...(materiaal.middenVorm ? { vorm: materiaal.middenVorm } : {}), ...(materiaal.middenHoogte ? { hoogte: materiaal.middenHoogte } : {}) };
  }

  // De rode koning is in de campagne de heer zelf: zijn kleding en wapen.
  const heerKoning = missie && missie.rood && missie.rood.koning;
  // Het landschap van dit level (versie 0.71.0): grondkleuren, bomen, rotsen, weer.
  // Alleen het uiterlijk; het spel zelf verandert niet.
  const landschapProfiel = await laadLandschap(missie && missie.landschap);
  const aanpassingen = heerKoning ? { 'eenheid.koning_rood': heerKoning.uiterlijk || {} } : {};
  if (landschapProfiel) {
    aanpassingen['object.boom'] = { kleur: landschapProfiel.boomKleur, stijl: landschapProfiel.bomen };
    if (landschapProfiel.rotsKleur || landschapProfiel.rotsSneeuw) aanpassingen['object.steen'] = { ...(landschapProfiel.rotsKleur ? { kleur: landschapProfiel.rotsKleur } : {}), sneeuw: !!landschapProfiel.rotsSneeuw };
  }
  const assets = await laadAssets(aanpassingen, roodKasteel);
  assets.meldingen.forEach((tekst) => ui.toonMelding(tekst, { soort: 'uitleg' }));
  // In de campagne heb je alleen wat het verhaal al heeft vrijgegeven.
  const mag = ontgrendeld(missies.campagne, missie ? missie.id : null);
  const kaarten = await laadKaarten();
  const kaartNaam = (missie && missie.kaart) || 'standaard';
  const kaart = maakKaart({ ...(kaarten[kaartNaam] || CONFIG.kaart), ...(ontwerp ? { kasteel: ontwerp } : {}) });
  let titelOpen = false;   // staat het beginscherm of de levelkaart open? Dan staat het spel stil.
  const camera = maakCamera(kaartGrenzen(kaart.breedte, kaart.hoogte));
  // Geluid (stap 46): klinkt zachter naarmate het verder buiten beeld is.
  if (!window.__geluidGekoppeld) { window.__geluidGekoppeld = true; geluid.koppel(); }
  geluid.zetLandschap(missie && missie.proloog ? 'proloog' : (missie && missie.landschap) || 'vrij');
  geluid.zetStil(() => titelOpen || !document.getElementById('titelscherm').hidden);
  geluid.zetPlek((x, y) => { const w = rasterNaarWereld(x, y); const sc = camera.wereldNaarScherm(w.x, w.y); return { sx: sc.x, sy: sc.y, b: camera.breedte, h: camera.hoogte, zoom: camera.zoom }; });
  const tekenaar = maakTekenaar(canvas, kaart, camera, assets, landschapProfiel);
  tekenaar.zetWimpels(!!(ontwerp && ontwerp.wimpels));
  const gevangene = maakGevangene({ kaart, missie });   // level 5: Ludolf in zijn cel
  const wegvinder = maakWegvinder(kaart);
  // Hoe hoog je staat boven op een muur, een toren of een poort.
  const hoogtes = OBJECT_ASSET.map((naam) => (naam ? assets.haal(naam).hoogte || 0 : 0));
  const hoogtesRood = OBJECT_ASSET.map((naam) => (naam && assets.heeft('rood.' + naam.split('.')[1]) ? assets.haal('rood.' + naam.split('.')[1]).hoogte || 0 : 0));
  const hoogteOp = (vak) => (kaart.eigenaar[vak] === 2 && hoogtesRood[kaart.object[vak]]) || hoogtes[kaart.object[vak]] || 0;
  const eenheden = maakEenheden(kaart, wegvinder, assets.haal('kasteel.muur').hoogte, hoogteOp);
  const meting = maakMeting({ kaart, camera, eenheden, ui });
  const { bouwwerken, groepen } = await laadBouwwerken();
  // De naam van een soldaat of gebouw, voor wat je in een level vrijspeelt.
  const naamVan = (sleutel) => (regels.soldaten[sleutel] || bouwwerken[sleutel] || {}).naam;
  // Het verhaal: berichten van de figuren op hun moment (stap 31).
  let proloog = null;   // alleen in de proloog (js/proloog.js)
  let doel = null;      // een level met een eigen doel, zoals de hut in level 4 (js/doel.js)
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
  if (missie && missie.begin) pasProfielToe(regels, { begin: missie.begin });   // eigen beginvoorraad van dit level (White Dike: hout voor de haven en voor de rest)
  if (ontwerp && ontwerp.hoog) regels.strijd.roodMuurHoog = true;   // te hoog voor ladders
  // De proloog: geen winst of verlies, geen rode heer in zijn burcht (js/proloog.js).
  if (missie && missie.proloog) regels.strijd.proloog = true;
  if (missie && missie.proloog) regels.legerPerKazerne = 0;   // geen kazerneregel: het garnizoen van Aldervale staat er al
  if (missie && missie.proloog) regels.legerMax = Math.max(regels.legerMax, 120);   // het garnizoen van Aldervale (ongeveer 80) plus wat je traint
  const opslag = maakOpslag(kaart.zaad, opslagSleutel(modus));

  // Bewaren: na elke keer bouwen, slopen, hakken of afleveren.
  let bewaarFoutGemeld = false;
  let bewaren = false;   // pas aan als het spel helemaal is opgebouwd
  const bewaar = () => {
    if (!bewaren) return;
    const stand = { bouwwerken: bouwer.eigenBouwwerken(), ...economie.bewaarStand(), leger: leger.bewaarStand(), strijd: strijd.bewaarStand(), haven: haven ? haven.stand() : [], havenLes: havenLesKlaar, visLes: visLesKlaar, handelLes: handelLesKlaar, legerLes: legerLesKlaar };
    if (opslag.bewaar(stand) || bewaarFoutGemeld) return;
    bewaarFoutGemeld = true;
    ui.toonMelding('Saving does not work here. Your progress is lost when you close the game.', { soort: 'uitleg', toon: true });
  };

  // De kaart is veranderd zonder dat er gebouwd is (er is een boom om).
  const kaartGewijzigd = (vakken) => {
    wegvinder.herbereken();
    tekenaar.kiesPlaatjes();
    eenheden.kaartVeranderd(vakken);
  };

  let haven = null;            // havens (js/haven.js), zodra de economie er is
  let havenLes = null;         // de havenles van level 8 (js/havenles.js)
  let havenTik = 0;            // elke seconde: havens zoeken, het paneel bijwerken
  let havenLesKlaar = false;   // de havenles van level 8 is gedaan (bewaard)
  let visserij = null;         // vissershutten en hun bootjes (js/visserij.js)
  let visLes = null;           // de visles van level 8 (js/visles.js), na de havenles
  let visLesKlaar = false;     // de visles is gedaan (bewaard)
  let handelLes = null;        // de handelles van level 1 (js/handelles.js)
  let handelLesKlaar = false;  // de handelles is gedaan (bewaard)
  let legerLes = null;         // de legerles van level 3 (js/legerles.js): box, groep, formatie, Hold
  let legerLesKlaar = false;   // de legerles is gedaan (bewaard)
  // Loopt er een les (haven of handel)? Dan staat de oorlog stil.
  const lesLoopt = () => !!((havenLes && havenLes.actief()) || (visLes && visLes.actief()) || (handelLes && handelLes.actief()) || (legerLes && legerLes.actief()));
  let naVoorraad = () => {};
  let naGeveld = () => {};     // een gevelde boom valt om (beeld); ingevuld als het gevecht er is
  let verversHandel = () => {};   // het paneel van de voorraadkamer, als het openstaat   // wordt verderop ingevuld, als de bouwbalk er is
  const economie = maakEconomie({
    regels, kaart, wegvinder, eenheden,
    opKaart: kaartGewijzigd,
    opVoorraad: () => naVoorraad(),
    opVerandering: bewaar,
    // Economie: stil in het logboek, behalve als het echt dringend is.
    opMelding: (tekst) => ui.toonMelding(tekst, { soort: 'economie', toon: /food has run out|unhappy/.test(tekst) }),
    opGeveld: (vak, kant) => naGeveld(vak, kant),
  });
  // Havens (0.106.0): een schip haalt en brengt goederen (data/economie.json "haven").
  haven = maakHaven({ kaart, economie, regels: regels.haven || { reis: 120, per: 10, koop: {}, verkoop: {} }, grondstoffen: regels.grondstoffen, geluid,
    opMelding: (tekst) => ui.toonMelding(tekst, { soort: 'economie', toon: true }) });
  // Vissershutten (0.120.0): een bootje vist voedsel. Zijn de schepen van rood op zee, dan blijft het aan wal.
  visserij = maakVisserij({ kaart, economie, regels: regels.visserij || {}, geluid,
    gevaar: () => !!(doel && doel.stand && doel.stand().onderweg > 0),
    opMelding: (tekst) => ui.toonMelding(tekst, { soort: 'economie', toon: true }) });
  let naBouw = () => {};       // wordt hieronder ingevuld, als het gevecht er is
  const bouwer = maakBouwer({
    kaart, wegvinder, tekenaar, eenheden, economie, bouwwerken, bouwStraal: missie && missie.proloog ? 0 : regels.bouwStraal,   // proloog: bouw waar Bartholt het wijst
    opVerandering: () => {
      naBouw();
      bewaar();
    },
  });
  let naLeger = () => {};      // wordt verderop ingevuld, als de knoppen er zijn
  let legerOpen = null;        // legerbalk: welke groep openstaat (null = het begin)
  const leger = maakLeger({ regels, kaart, wegvinder, eenheden, economie, opVerandering: bewaar, opLeger: () => naLeger() });
  economie.zetEters(() => leger.soldaten().length);   // soldaten eten ook
  // Het gevecht: de aanvallen van de rode heer, winnen en verliezen.
  let naStrijd = () => {};     // de cijfers in beeld bijwerken
  let naEinde = () => {};      // gewonnen of verloren
  let naVerwoest = () => {};   // de vijand heeft iets van je vernield
  const strijd = maakStrijd({
    regels, kaart, wegvinder, eenheden, leger, bouwer, bouwwerken,
    opVerandering: bewaar,
    opStand: () => naStrijd(),
    // Van de vijand of over je eigen leger, te zien aan de zin.
    opMelding: (tekst) => ui.toonMelding(tekst, { soort: /^(Red |Attack|Your keep|The enemy)/.test(tekst) ? 'vijand' : 'leger' }),
    opVerwoest: (werk, van) => naVerwoest(werk, van),
    opKaart: (vakken) => kaartGewijzigd(vakken),
    opEinde: (wat) => naEinde(wat),
    opTerug: (kosten) => economie.geefAllesTerug(kosten),
  });
  naGeveld = (vak, kant) => {
    const gx = (vak % kaart.breedte) + 0.5;
    const gy = Math.floor(vak / kaart.breedte) + 0.5;
    geluid.speel('tree_fall', { x: gx, y: gy });
    geluid.speel('log_drag', { x: gx, y: gy, wacht: 1100 });
    if (strijd.effecten.length > 400) return;
    strijd.effecten.push({ soort: 'boomval', x: vak % kaart.breedte, y: Math.floor(vak / kaart.breedte), kant: kant < 0 ? -1 : 1, van: performance.now(), duur: 1250 });
  };
  // De veldheer: hoe rood zijn aanvallen aanpakt (timing, doelkeuze, tegenzetten, terugtrekken).
  const veld = missie && missie.proloog ? null : maakVeldheer({
    regels, kaart, leger, strijd,
    perSeconde: CONFIG.spel.stappenPerSeconde,
    opMelding: (tekst) => ui.toonMelding(tekst, { soort: 'vijand' }),
  });
  if (veld) strijd.koppelVeld(veld);
  // De rode heer: eigen voorraad, eigen werken, beslist zelf wanneer hij aanvalt.
  // In de proloog is er nog geen rode heer met een eigen economie.
  const rood = missie && missie.proloog ? null : maakRood({
    regels, kaart, bouwwerken, leger, strijd, eenheden, veld, wegvinder,
    niveau: missie ? missie.id : 3,
    groeiConfig: missie && missie.rood && missie.rood.groei ? missie.rood.groei : null,
    perSeconde: CONFIG.spel.stappenPerSeconde,
    opMelding: (tekst) => ui.toonMelding(tekst, { soort: 'vijand' }),
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
    haven.laad(bewaard.haven);
    // De havenles begint elke keer dat je het level vanaf de levelkaart start; bij een herlaad midden in het level blijft hij gedaan.
    let vanKaart = false;
    try { vanKaart = window.sessionStorage.getItem(TOON_BEELD) === '1'; } catch (fout) { /* niet erg */ }
    havenLesKlaar = !!bewaard.havenLes && !vanKaart;
    visLesKlaar = !!bewaard.visLes && !vanKaart;   // de visles net zo
    visserij.zoek();
    handelLesKlaar = !!bewaard.handelLes;
    legerLesKlaar = !!bewaard.legerLes;   // de legerles net zo (de acht man staan al in je bewaarde leger)
    if (teruggezet) ui.toonMelding(`Your castle is back: ${teruggezet} ${teruggezet === 1 ? 'building' : 'buildings'}.`, { soort: 'uitleg' });
    leger.zetStand(bewaard.leger);
    strijd.zetStand(bewaard.strijd);
  } else {
    strijd.maakRoodKoning();
    strijd.maakGarnizoen();   // level 4: de soldaten in het tentenkamp
  }
  if (gevangene && strijd.uitslag() === 'gewonnen') gevangene.bevrijd();   // de cel staat open als je het level al won
  // Jouw koning: hij staat altijd bij de burcht als hij er nog niet is.
  const koningVak = (kaart.start[0].y + 2) * kaart.breedte + kaart.start[0].x + 2;   // voor de burcht, zodat je hem ziet
  // Het thuisvak ook onthouden als het level al beslist was (bewaarde winst): zonder dat komt de koning bij
  // "Start over" niet terug en verlies je meteen weer ("Your king fell during attack 0").
  leger.zetKoningThuis(koningVak);
  if (!strijd.uitslag()) leger.zetKoning(koningVak);
  // Rutger the Mad (0.109.0): na White Dike (level 8) vecht hij als held voor jou, vanaf level 9.
  if (!bewaard && modus.soort === 'campagne' && missie && missie.id > 8 && mag('rutger') && regels.soldaten.rutger && !strijd.uitslag()) {
    if (leger.geef('rutger', koningVak, 8)) ui.toonMelding('Rutger the Mad fights at your side. Tap him to give him orders.', { soort: 'leger' });
  }
  bewaren = true;

  // Alles wat de tekenlaag moet weten. doel = waar je soldaten heen stuurt
  // (licht kort op), kader = het kader waarmee je soldaten kiest, effecten =
  // pijlen en gevallenen, balken = het leven van beschadigde bouwwerken.
  const staat = {
    gekozen: null, schim: null, eenheden: eenheden.lijst, doel: null, kader: null, nacht: () => (proloog ? proloog.nacht() : 0),
    effecten: strijd.effecten, balken: strijd.balken,
    vissers: visserij,
    schepen: () => [...haven.schepen(), ...visserij.schepen(), ...(doel && doel.schepen ? doel.schepen() : []), ...(zeeleven ? zeeleven.schepen() : [])],
    zee: null,
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
      else if (tegels[0].ok) hint = 'Tap the hammer to tear this down. You get half the price back.';
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
        hint = `Tap where it ends, or tap the hammer to place this one piece for ${kost}.`;
      } else if (werk.lijn) {
        hint = `${goed} ${goed === 1 ? 'piece' : 'pieces'} for ${kost}` + (fout ? `, ${fout} not possible (red)` : '') + '. Tap another end point, or tap the hammer to place it.';
      } else {
        hint = `This costs ${kost}. Tap another spot, or tap the hammer to place it.`;
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
    // Proloog: alleen het bouwwerk van de les is te kiezen (de knoppen zijn dan ook dicht).
    if (sleutel && proloog && proloog.bouwSleutel() !== sleutel) return;
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
    if (bouw.sleutel === SLOOP) geluid.speel(bouwer.sloop(bouw.begin.x, bouw.begin.y) ? 'build_demolish' : 'ui_denied');
    else geluid.speel(bouwer.plaats(bouwwerken[bouw.sleutel], staat.schim.tegels.filter((t) => t.ok)) ? 'build_place' : 'ui_denied');
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
  setInterval(() => {
    metingen.push({ t: Date.now(), v: { ...economie.voorraad } });
    while (metingen.length > 13) metingen.shift();
    naVoorraad();
  }, 5000);
  ui.opBevestig(bevestigBouw);
  ui.opKlaar(stopBouw);
  toonBouw();

  // De voorraad in beeld. Verandert die terwijl je bouwt, dan kan iets
  // wat net te duur was nu wel, of andersom.
  // De verandering van de laatste minuut per grondstof: elke 5 seconden een meting.
  // Wat je uitgeeft telt mee, dus een gebouw neerzetten geeft een min.
  const metingen = [];
  const KERN = ['hout', 'steen', 'voedsel', 'goud', 'boeren'];   // altijd in de balk
  naVoorraad = () => {
    const volk = economie.bevolking();
    const stem = economie.stemming();
    // Een grondstof die je (nog) niet hebt en niet maakt, laat de lijst weg. Koper
    // pas als je de kopermijn hebt ontgrendeld. Is hij vol, dan staat hij in het rood.
    const eten = (economie.voorraad.voedsel || 0) + (economie.voorraad.brood || 0) + (economie.voorraad.vis || 0);
    const oudste = metingen.length ? metingen[0] : null;
    const grondstoffen = Object.entries(regels.grondstoffen)
      .filter(([naam, def]) => def.begin > 0 || economie.voorraad[naam] > 0 || (economie.maakt(naam) && (naam !== 'koper' || mag('kopermijn')) && (naam !== 'hop' || mag('hopveld')) && (naam !== 'vis' || mag('vissershut'))))
      .map(([naam, def]) => {
        const max = economie.opslagMax(naam);
        const vol = Number.isFinite(max) && economie.voorraad[naam] >= max;
        // Voedsel in het rood als er minder is dan voor één maaltijdronde.
        const op = naam === 'voedsel' && volk.eters > 0 && eten < volk.nodig;
        const verschil = oudste && oudste.t < Date.now() - 20000 ? Math.round(((economie.voorraad[naam] - oudste.v[naam]) * 60000) / (Date.now() - oudste.t)) : null;
        return { sleutel: naam, naam: def.naam, aantal: economie.voorraad[naam], slecht: vol || op, max: Number.isFinite(max) ? max : null, verschil };
      });
    const boeren = { sleutel: 'boeren', naam: 'Peasants', aantal: `${volk.volk}/${volk.ruimte}` };
    const pop = { sleutel: 'populariteit', naam: 'Popularity', aantal: stem.populariteit, slecht: stem.populariteit < stem.grens };
    // In de balk staat de kern. Iets anders komt erbij zodra het in het rood staat.
    // Vis (0.121.0) staat in de balk zodra je een vissershut hebt of vis in voorraad.
    const balk = [...grondstoffen, boeren, pop].filter((g) => KERN.includes(g.sleutel) || g.slecht || (g.sleutel === 'vis' && (economie.voorraad.vis > 0 || economie.maakt('vis'))));
    ui.toonVoorraad(balk);
    // Het paneel achter de voorraad: alles met naam erbij, en de belasting.
    const plus = (getal) => (getal > 0 ? `+${getal}` : getal < 0 ? `−${-getal}` : '0');
    const wacht = volk.wachtend ? ` ${volk.wachtend} ${volk.wachtend === 1 ? 'building is' : 'buildings are'} waiting for a peasant.` : '';
    ui.toonVolk({
      regels: [
        `Peasants: ${volk.volk}, room for ${volk.ruimte}. ${stem.lopers} without work.${wacht}`,
        `Popularity ${stem.populariteit}. Every half minute ${plus(stem.totaal)}: ` + stem.factoren.filter((f) => f.waarde || f.naam !== 'variety').map((f) => `${f.naam} ${plus(f.waarde)}`).join(', ') + '.',
        `Everyone eats: ${volk.volk} peasants and ${volk.eters - volk.volk} soldiers need ${Math.round(volk.nodig * 60 / regels.bevolking.voedselElke * 10) / 10} food a minute (peasants eat ${regels.bevolking.eetPerPersoon * 60 / regels.bevolking.voedselElke} each, soldiers ${regels.bevolking.eetPerSoldaat * 60 / regels.bevolking.voedselElke}). Each person who cannot eat costs ${regels.bevolking.stemming.hongerPerPersoon} popularity.`,
        `From ${stem.grens} upwards new peasants arrive; below that they leave. From ${regels.bevolking.stemming.snelleGroei.vanaf} popularity ${regels.bevolking.stemming.snelleGroei.aantal} arrive at a time.`,
      ],
      tarieven: stem.tarieven.map((t) => ({ naam: t.naam, uitleg: `${volk.volk * t.goud} gold, ${plus(t.effect)}` })),
      gekozen: stem.belasting,
      voorraad: [...grondstoffen, { sleutel: 'populariteit', naam: 'Popularity', aantal: stem.populariteit, slecht: pop.slecht }],
    });
    // Het paneel van de kazerne rekent met goud en boeren: dat gaat mee.
    naLeger();
    if (bouw.sleutel && bouw.begin) toonBouw();
  };
  naVoorraad();
  ui.opBelasting((stand) => economie.zetBelasting(stand));

  // --- Het leger --------------------------------------------------------------------
  // De kazerne: tik hem aan en leid soldaten op.
  // Siege gear krijgt een bevestiging zodra het zijn opdracht heeft: de ladders worden tegen de
  // muur gezet, de ram gaat de muur doorbreken, de toren wordt geplaatst, de katapult gaat schieten.
  // Gewone soldaten krijgen die melding niet. ontvangen = de eenheden die het bevel echt kregen;
  // doel = wat het bevel aanwees ('wall', 'gate', ...).
  function meldSiege(ontvangen, doel) {
    if (ontvangen.length) geluid.speel('siege_confirm');
    if (ontvangen.some((e) => leger.soorten[e.soldaat.sleutel].vast)) geluid.speel('siege_tower_roll', { wacht: 300 });
    const aantal = {};
    for (const e of ontvangen) {
      const def = leger.soorten[e.soldaat.sleutel];
      const soort = def.vast ? 'toren' : def.ladder ? 'ladder' : def.sleutel === 'katapult' ? 'katapult' : def.sleutel === 'trebuchet' ? 'trebuchet' : def.sabotage ? 'saboteur' : def.alleenBouw ? 'ram' : null;
      if (soort) aantal[soort] = (aantal[soort] || 0) + 1;
    }
    const rood = `the red ${doel || 'wall'}`;
    const tekst = {
      ladder: () => `A ladder is being set against ${rood}.`,
      toren: (n) => `${n > 1 ? 'The siege towers are' : 'The siege tower is'} being placed against ${rood}. Then your soldiers can climb over ${n > 1 ? 'them' : 'it'}.`,
      ram: (n) => `${n > 1 ? 'The battering rams are' : 'The battering ram is'} going to break through ${rood}.`,
      katapult: (n) => `${n > 1 ? 'The catapults are' : 'The catapult is'} going to fire at ${rood}.`,
      trebuchet: (n) => `${n > 1 ? 'The trebuchets are' : 'The trebuchet is'} going to hurl stones at ${rood}.`,
      saboteur: (n) => `${n > 1 ? 'The saboteurs sneak' : 'The saboteur sneaks'} toward ${rood} with a powder keg.`,
    };
    for (const soort of ['ladder', 'toren', 'ram', 'katapult', 'trebuchet']) {
      if (aantal[soort]) ui.toonMelding(tekst[soort](aantal[soort]), { soort: 'leger', toon: true });
    }
  }

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
        `${gebouw.naam}. Army places: ${leger.plekken()} of ${leger.max}. Gold: ${economie.voorraad.goud}. Idle peasants: ${Math.max(0, volk.vrij)}.`,
        kazerneBericht || (gebouw.leidtOp === 'mystiek' ? 'Mystic soldiers cost gold, copper and two idle peasants.' : gebouw.leidtOp === 'belegering' ? 'Siege gear costs gold, planks and one idle peasant. Ladder bearers are trained at the barracks.' : gebouw.leidtOp === 'stal' ? 'A mounted knight costs gold, copper, wheat and one idle peasant. Each stable holds five horses and needs a horse keeper.' : 'A soldier costs gold and one idle peasant.'),
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
    if (reden) geluid.speel('ui_denied');
    else {
      const soort = leger.soorten[sleutel];
      geluid.speel({ mystiek: 'mystic_ready', belegering: 'siegeworks_ready', stal: 'horse_neigh' }[soort.kazerne] || 'barracks_ready');
      if (!soort.alleenBouw && soort.kazerne !== 'belegering') geluid.speel('unit_ready_shout', { wacht: 350 });
    }
    kazerneBericht = reden ? `Not possible: ${reden}.` : `${metLidwoord(leger.soorten[sleutel].naam.toLowerCase(), true)} is ready at the ${leger.soorten[sleutel].kazerne === 'stal' ? 'stable' : leger.soorten[sleutel].kazerne === 'belegering' ? 'siege workshop' : 'barracks'}.`;
    toonKazerne();
  });

  // De voorraadkamer: tik hem aan en verkoop wat je over hebt voor goud.
  let handelVak = -1;
  let handelBericht = '';
  let havenModus = 'koop';
  let havenPartij = 1;
  const klok = (s) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;
  // De haven (0.119.0): een bord. Goed, kant en hoeveelheid kies je alleen; pas "Confirm" bestelt.
  let havenGoed = null;
  const toonHaven = () => {
    const hr = haven.regels;
    const info = haven.info(handelVak);
    if (!info) { handelVak = -1; ui.toonHandel({ open: false }); return; }
    const o = info.order;
    const koop = havenModus === 'koop';
    const per = hr.per * havenPartij;
    const naam = (n) => regels.grondstoffen[n].naam;
    const klein = (n) => naam(n).toLowerCase();
    const lijst = koop ? hr.koop : hr.verkoop;
    const goederen = Object.keys(lijst).filter((n) => regels.grondstoffen[n] && (n !== 'koper' || mag('kopermijn')) && (n !== 'hop' || mag('hopveld')));
    if (havenGoed && !goederen.includes(havenGoed)) havenGoed = null;
    let schip;
    if (o && o.tijd > 0) schip = { tekst: o.soort === 'koop' ? `Ship at sea. Back in ${klok(o.tijd)} with ${o.aantal} ${klein(o.naam)}.` : `Ship at sea. Back in ${klok(o.tijd)} with ${o.goud} gold.`, voortgang: 1 - o.tijd / info.reis };
    else if (o) schip = { tekst: `Ship at the quay: no room for ${o.rest} ${klein(o.naam)}.`, voortgang: 1 };
    else schip = { tekst: 'Your ship is at the quay, ready to sail.', voortgang: null };
    // Wat de bevestigknop en de som laten zien
    let som, bevestig;
    if (!havenGoed) {
      som = { tekst: koop ? 'Choose goods to buy.' : 'Choose goods to sell.', sub: koop ? `You pay now. The ship is back in ${klok(hr.reis)}.` : `The ship takes the goods now. It is back in ${klok(hr.reis)} with the gold.` };
      bevestig = { tekst: koop ? 'Buy' : 'Sell', kan: false, verkoop: !koop };
    } else {
      const goud = lijst[havenGoed] * havenPartij;
      const reden = haven.waaromNiet(handelVak, havenModus, havenGoed, havenPartij);
      const na = economie.voorraad.goud + (koop ? -goud : 0);
      som = { tekst: `${per} ${klein(havenGoed)}, ${goud} gold`, sub: koop ? `Gold ${economie.voorraad.goud} \u2192 ${na}. Back in ${klok(hr.reis)}.` : `You get ${goud} gold when the ship is back in ${klok(hr.reis)}.` };
      if (reden && !(o && o.tijd > 0)) som.sub = `Not possible: ${reden}.`;
      bevestig = { tekst: o ? 'Ship away' : reden ? (koop ? 'Buy' : 'Sell') : koop ? `Buy for ${goud} gold` : `Sell for ${goud} gold`, kan: !reden, verkoop: !koop };
    }
    if (handelBericht) som.sub = handelBericht;
    ui.toonHaven({
      open: true,
      goud: economie.voorraad.goud,
      schip,
      modi: [
        { sleutel: 'modus:koop', naam: 'Buy', gekozen: koop },
        { sleutel: 'modus:verkoop', naam: 'Sell', gekozen: !koop },
      ],
      partijen: (hr.partijen || [1]).map((p) => ({ sleutel: `partij:${p}`, naam: `${p * hr.per}`, gekozen: havenPartij === p })),
      goederen: goederen.map((n) => {
        const goud = lijst[n] * havenPartij;
        const kan = !o && (koop ? economie.voorraad.goud >= goud && economie.opslagMax(n) - economie.voorraad[n] >= per : economie.voorraad[n] >= per);
        return { sleutel: `goed:${n}`, n, naam: naam(n), prijs: `${hr.per} for ${lijst[n]} gold`, voorraad: economie.voorraad[n], gekozen: havenGoed === n, kan };
      }),
      som,
      bevestig,
    }, (sleutel) => {
      const [soort, waarde] = sleutel.split(':');
      if (soort === 'modus') { havenModus = waarde; handelBericht = ''; geluid.speel('ui_click'); }
      else if (soort === 'partij') { havenPartij = +waarde; handelBericht = ''; geluid.speel('ui_click'); }
      else if (soort === 'goed') { havenGoed = waarde; handelBericht = ''; geluid.speel('ui_click'); }
      else if (sleutel === 'bevestig') {
        if (!havenGoed) { geluid.speel('ui_denied'); handelBericht = 'Choose goods first.'; }
        else {
          const reden = haven.bestel(handelVak, havenModus, havenGoed, havenPartij);
          if (reden) geluid.speel('ui_denied');
          handelBericht = reden ? `Not possible: ${reden}.` : '';
        }
      }
      toonHaven();
    });
  };
  const toonHandel = () => {
    const gebouw = handelVak >= 0 ? bouwer.werkOp(handelVak % kaart.breedte, Math.floor(handelVak / kaart.breedte)) : null;
    if (gebouw && gebouw.haven) { toonHaven(); return; }
    if (!gebouw || !gebouw.handel || !regels.handel) {
      handelVak = -1;
      ui.toonHandel({ open: false });
      return;
    }
    const h = regels.handel;
    ui.toonHandel({
      open: true,
      haven: false,
      regels: [`Storehouse. Gold: ${economie.voorraad.goud}. Each storehouse holds ${regels.opslag.voorraadkamer} of every resource.`, handelBericht || `Sell in lots of ${h.per} for gold.`],
      knoppen: Object.keys(h.prijs).filter((n) => regels.grondstoffen[n] && (economie.voorraad[n] > 0 || economie.maakt(n))).map((n) => ({
        sleutel: n,
        naam: `${regels.grondstoffen[n].naam} (${economie.voorraad[n]})`,
        kost: `${h.per} for ${h.prijs[n]} gold`,
        kan: economie.voorraad[n] >= h.per,
      })),
    }, (n) => {
      const reden = economie.verkoop(n);
      geluid.speel(reden ? 'ui_denied' : 'coins');
      handelBericht = reden ? `Not possible: ${reden}.` : `Sold: ${h.per} ${regels.grondstoffen[n].naam.toLowerCase()} for ${h.prijs[n]} gold.`;
      toonHandel();
    });
  };
  // De zagerij: tik hem aan en kies vanaf hoeveel hout de zagers planken maken.
  // Die grens geldt voor elke zagerij tegelijk (economie.zetReserve). Gebruikt het paneel van de handel.
  const ZAAG_GRENZEN = [0, 10, 20, 30, 50, 80, 120];
  let zagerVak = -1;
  let zagerBericht = '';
  const toonZagerij = () => {
    const gebouw = zagerVak >= 0 ? bouwer.werkOp(zagerVak % kaart.breedte, Math.floor(zagerVak / kaart.breedte)) : null;
    const grens = economie.reserveVan('zager');
    if (!gebouw || gebouw.werker !== 'zager' || grens === null) {
      zagerVak = -1;
      ui.toonHandel({ open: false });
      return;
    }
    const aantal = economie.aantalMetBeroep('zager');
    ui.toonHandel({
      open: true,
      regels: [
        `Sawmill. Wood: ${economie.voorraad.hout}. Your sawyers (${aantal}) leave ${grens} wood in the stores for building and only saw what is above that.`,
        zagerBericht || 'Choose how much wood to keep. This counts for every sawmill.',
      ],
      knoppen: ZAAG_GRENZEN.map((n) => ({ sleutel: String(n), naam: `Keep ${n}`, kost: n === grens ? 'now' : n === 0 ? 'saw all' : 'wood', kan: true })),
    }, (sleutel) => {
      const n = Number(sleutel);
      economie.zetReserve('zager', n);
      geluid.speel('ui_click');
      zagerBericht = n === 0 ? 'Your sawyers now saw all wood into planks.' : `Your sawyers now keep ${n} wood for building.`;
      toonZagerij();
    });
  };
  verversHandel = () => { if (handelVak >= 0) toonHandel(); else if (zagerVak >= 0) toonZagerij(); };
  ui.opHandelSluit(() => { handelVak = -1; handelBericht = ''; zagerVak = -1; zagerBericht = ''; ui.toonHandel({ open: false }); });
  ui.opHavenSluit(() => { handelVak = -1; handelBericht = ''; havenGoed = null; ui.toonHandel({ open: false }); });

  // Soldaten kiezen: de knoppen rechts onderin en de uitleg erboven.
  let kaderAan = false;        // staat de knop Kader aan?
  let trebuchetModus = false;  // de speler kiest een plek voor een trebuchet
  let trebuchetPlek = null;    // het voorbeeld: { x, y, ok, doelen } (staat.trebPlek, de tekenlaag tekent de ring)
  let bouwMenu = false;        // het menu van wat een ingenieur kan bouwen staat open
  let ballistaModus = false;   // de speler kiest een stuk muur of toren voor een ballista
  let ballistaPlek = null;     // het voorbeeld voor de ballista (zelfde vorm als trebuchetPlek)
  const BOUWMELDING_MUUR = 'A ballista goes on a piece of your wall or on a tower. Tap one.';
  const zetBallistaPlek = (x, y) => {
    const ok = strijd.ballistaPlekOk(y * kaart.breedte + x);
    ballistaPlek = { x, y, ok, doelen: [], bereik: strijd.ballistaBereik(), min: 0 };
    geluid.speel('ui_click');
    if (!ok) ui.toonMelding('There is already a ballista here. Pick another piece of wall.', { soort: 'leger' });
    naLeger();
  };
  function bouwBallistaHier() {
    const { x, y } = ballistaPlek;
    const kosten = leger.soorten.ballista.kosten;
    const mist = economie.tekort(kosten);
    if (mist) {
      geluid.speel('ui_denied');
      ui.toonMelding(`A ballista costs ${economie.kostTekst(kosten)}: ${mist}.`, { soort: 'leger' });
      return;
    }
    const uitkomst = strijd.bouwBallista(leger.gekozen(), y * kaart.breedte + x, kosten);
    if (uitkomst > 0) {
      economie.betaal(kosten);
      staat.doel = { x, y, duur: 1400, tot: performance.now() + 1400 };
      geluid.speel('order_move');
      ui.toonMelding(`An engineer is on his way to build the ballista (${economie.kostTekst(kosten)}).`, { soort: 'leger' });
      ballistaModus = false;
      bouwMenu = false;
      naLeger();
    } else {
      geluid.speel('ui_denied');
      ui.toonMelding(uitkomst === -2 ? 'No free engineer selected. Pick an engineer who is not busy.' : uitkomst === -1 ? 'You can have at most 4 ballistas at a time.' : uitkomst === -3 ? 'The engineer cannot get up there. Open a gate or stairs to that wall first.' : BOUWMELDING_MUUR, { soort: 'leger' });
    }
  }
  const zetTrebuchetPlek = (x, y) => {
    const ok = strijd.trebuchetPlekOk(y * kaart.breedte + x);
    trebuchetPlek = { x, y, ok, doelen: ok ? strijd.trebuchetDoelen(x, y) : [], bereik: leger.soorten.trebuchet.bereik - 1, min: leger.soorten.trebuchet.minBereik };
    staat.trebPlek = trebuchetPlek;
    geluid.speel('ui_click');
    if (!ok) ui.toonMelding('A trebuchet needs a free, open spot on the ground.', { soort: 'leger' });
    naLeger();
  };
  function bouwTrebuchetHier() {
    const { x, y } = trebuchetPlek;
    const kosten = leger.soorten.trebuchet.kosten;
    const mist = economie.tekort(kosten);
    if (mist) {
      geluid.speel('ui_denied');
      ui.toonMelding(`A trebuchet costs ${economie.kostTekst(kosten)}: ${mist}.`, { soort: 'leger' });
      return;
    }
    const uitkomst = strijd.bouwTrebuchet(leger.gekozen(), y * kaart.breedte + x, kosten);
    if (uitkomst > 0) {
      economie.betaal(kosten);
      staat.doel = { x, y, duur: 1400, tot: performance.now() + 1400 };
      geluid.speel('order_move');
      ui.toonMelding(`Two engineers are on their way to build the trebuchet (${economie.kostTekst(kosten)}).`, { soort: 'leger' });
      trebuchetModus = false;
      naLeger();
    } else {
      geluid.speel('ui_denied');
      ui.toonMelding(uitkomst === -2 ? 'A trebuchet takes two siege engineers. Train another engineer first.' : uitkomst < 0 ? `You can have at most ${strijd.trebuchetStand().max} trebuchets at a time.` : 'A trebuchet needs a free, open spot on the ground.', { soort: 'leger' });
    }
  }
  ui.opBouw(() => {
    // Build opent of sluit het menu; een bouwmodus die aan staat gaat weer uit.
    bouwMenu = !bouwMenu && !(trebuchetModus || ballistaModus);
    trebuchetModus = false;
    ballistaModus = false;
    naLeger();
  });
  ui.opBallista(() => {
    if (ballistaModus && ballistaPlek) { if (ballistaPlek.ok) bouwBallistaHier(); else { geluid.speel('ui_denied'); ui.toonMelding(BOUWMELDING_MUUR, { soort: 'leger' }); } return; }
    ballistaModus = !ballistaModus;
    if (ballistaModus) trebuchetModus = false;
    naLeger();
  });
  ui.opTrebuchet(() => {
    if (trebuchetModus && trebuchetPlek) { if (trebuchetPlek.ok) bouwTrebuchetHier(); else { geluid.speel('ui_denied'); ui.toonMelding('A trebuchet needs a free, open spot on the ground.', { soort: 'leger' }); } return; }
    trebuchetModus = !trebuchetModus;
    if (trebuchetModus) ballistaModus = false;
    naLeger();
  });
  // Formaties en Hold (0.121.0)
  const FORMATIE_NAAM = { vrij: 'Free', lijn: 'Line', schild: 'Shield', blok: 'Block', wijd: 'Wide' };
  const FORMATIE_UITLEG = {
    vrij: 'Formation: Free. They gather as close to the spot as they can.',
    lijn: 'Formation: Line. One wide row, fighters in front, archers behind.',
    schild: 'Formation: Shield. Fighters in front and behind, archers safe in the middle.',
    blok: 'Formation: Block. A tight square, fighters in front, archers behind.',
    wijd: 'Formation: Wide. A loose square with room between the men.',
  };
  ui.opFormatie(() => {
    if (proloog || (legerLes && legerLes.actief() && !legerLes.mag('formatie'))) return;
    const f = leger.volgendeFormatie();
    geluid.speel('order_move');
    ui.toonMelding(FORMATIE_UITLEG[f], { soort: 'leger' });
    naLeger();
  });
  ui.opHoud(() => {
    if (proloog || (legerLes && legerLes.actief() && !legerLes.mag('houd'))) return;
    const t = leger.telling();
    const aan = !(t.houdbaar > 0 && t.houdt === t.houdbaar);
    const n = leger.zetHoud(aan);
    geluid.speel(n ? 'order_move' : 'ui_denied');
    if (n) ui.toonMelding(aan ? 'Hold: they stay where they are and only fight what comes close. Archers shoot what is in range.' : 'Hold is off: they fight freely again.', { soort: 'leger' });
    naLeger();
  });
  ui.opOntkoppel(() => {
    const { n, sloop } = strijd.ontkoppel(leger.gekozen());
    if (sloop) for (let i = 0; i < sloop; i++) economie.geefTerug(leger.soorten.trebuchet.kosten);
    geluid.speel(n || sloop ? 'order_move' : 'ui_denied');
    ui.toonMelding(sloop ? `The trebuchet is taken apart. You get part of the cost back.` : n ? 'The engineers are free again and the trebuchet stays silent. Press again to take it apart.' : 'This trebuchet has no engineers. Press again on a silent trebuchet to take it apart.', { soort: 'leger' });
    naLeger();
  });
  naLeger = () => {
    const bouwt = !!bouw.sleutel;
    if (bouwt) kaderAan = false;
    const gekozen = leger.aantalGekozen();
    const ingenieur = !bouwt && leger.gekozen().some((e) => leger.soorten[e.soldaat.sleutel].bouwt);
    if (!ingenieur) { trebuchetModus = false; ballistaModus = false; bouwMenu = false; }
    if (!trebuchetModus) trebuchetPlek = null;
    if (!ballistaModus) ballistaPlek = null;
    staat.trebPlek = trebuchetModus ? trebuchetPlek : ballistaModus ? ballistaPlek : null;
    const staandGekozen = !bouwt && leger.gekozen().some((e) => leger.staatVast(e.soldaat.sleutel));
    let hint = '';
    if (trebuchetModus && trebuchetPlek) hint = trebuchetPlek.ok ? `The rings show how far it shoots: ${trebuchetPlek.doelen.length} enemy ${trebuchetPlek.doelen.length === 1 ? 'target' : 'targets'} in range. Tap the same spot again or press Build here.` : 'Not here. Tap a free spot on the ground.';
    else if (trebuchetModus) hint = 'Tap a free spot on the ground. Two engineers walk there and build the trebuchet together.';
    else if (ballistaModus && ballistaPlek) hint = ballistaPlek.ok ? 'The ring shows how far the ballista shoots. Tap the same spot again or press Build here. The engineer climbs up and builds it.' : 'Not here. Tap a free piece of your wall or a tower.';
    else if (ballistaModus) hint = 'Tap a piece of your wall or a tower. One engineer climbs up and builds the ballista there.';
    else if (bouwMenu) hint = 'Choose what the engineers build. A trebuchet needs two engineers on open ground, a ballista one engineer on your wall.';
    else if (!bouwt && kaderAan) hint = 'Drag a box around your soldiers with one finger.';
    else if (!bouwt && gekozen === 1) hint = '1 soldier selected. Tap where he should go.';
    else if (!bouwt && gekozen > 1) hint = `${gekozen} soldiers selected. Tap where they should go.`;
    // Zijn er vijanden, dan kun je die ook aantikken. Heb je een toren,
    // wachttoren of poort, dan kunnen ze de muur op.
    if (trebuchetModus || ballistaModus || bouwMenu) { /* eigen uitleg, geen extra zin */ }
    else if (hint && gekozen && !kaderAan && strijd.aantalVijanden()) hint = hint.replace(/\.$/, ', or tap an enemy.');
    else if (hint && gekozen && !kaderAan && wegvinder.aantalOpgangen(0)) hint = hint.replace(/\.$/, ', also on top of your wall.');
    // Formatie en Hold (0.121.0): alleen bij een gewoon bevel (niet tijdens bouwen of een bouwmenu van de ingenieur)
    const telG = leger.telling();
    const gewoon = !bouwt && !trebuchetModus && !ballistaModus && !bouwMenu && !proloog;   // de proloog heeft zijn eigen Hold
    const formatie = gewoon && telG.houdbaar > 1 ? FORMATIE_NAAM[leger.formatie()] : null;
    const houd = gewoon && telG.houdbaar > 0 ? { aan: telG.houdt === telG.houdbaar } : null;
    if (gewoon && telG.houdbaar > 0 && telG.houdt === telG.houdbaar && hint) hint = hint.replace(' selected.', ' selected (Hold).');
    ui.toonLeger({ formatie, houd, zichtbaar: !bouwt && leger.aantal() > 0, hint, kader: kaderAan, gekozen: gekozen > 0, bouw: ingenieur ? { menu: bouwMenu, trebuchet: { actief: trebuchetModus, tekst: trebuchetModus ? (trebuchetPlek && trebuchetPlek.ok ? 'Build here' : 'Cancel') : 'Trebuchet' }, ballista: { actief: ballistaModus, tekst: ballistaModus ? (ballistaPlek && ballistaPlek.ok ? 'Build here' : 'Cancel') : 'Ballista' } } : null, ontkoppel: staandGekozen });
    // Groepen (dichtbij, afstand, belegering) en losse soorten kiezen.
    if (!bouwt && leger.aantal() > 0) {
      const t = leger.telling();
      const namenGroep = { melee: 'Melee', afstand: 'Ranged', belegering: 'Siege' };
      const lijst = [];
      const groepen = Object.keys(namenGroep).filter((g) => t.groepen[g]);
      const vol = (x) => x.gekozen === x.n;
      // Twee lagen, net als de bouwbalk (0.104.0). Laag 1: de groepen, de koning
      // en na een kader de ingeboxte groep. Laag 2 (legerOpen): Back en de
      // soorten van die ene groep.
      const soortenVan = (g) => Object.keys(t.perSoort).filter((sl) => sl !== 'koning' && t.perSoort[sl].groep === g);
      if (legerOpen && soortenVan(legerOpen).length < 2) legerOpen = null;   // groep weg of nog maar één soort
      if (legerOpen) {
        lijst.push({ sleutel: 'b:', tekst: '‹ Back' });
        for (const sl of soortenVan(legerOpen)) lijst.push({ sleutel: 's:' + sl, tekst: `${leger.soorten[sl].naam} ${t.perSoort[sl].n}`, actief: vol(t.perSoort[sl]), klein: true });
      } else {
        if (t.deel && (groepen.length > 1 || Object.keys(t.perSoort).length > 1)) lijst.push({ sleutel: 'd:', tekst: `Group ${t.deel}`, actief: t.deelGekozen === t.deel });
        for (const g of groepen) lijst.push({ sleutel: 'g:' + g, tekst: `${namenGroep[g]} ${t.groepen[g].n}`, actief: vol(t.groepen[g]) });
        if (t.perSoort.koning) lijst.push({ sleutel: 's:koning', tekst: `${leger.soorten.koning.naam} ${t.perSoort.koning.n}`, actief: vol(t.perSoort.koning) });
        // Eén knop is geen keuze: zonder ingeboxte groep en met maar één knop blijft de rij leeg.
        if (lijst.length === 1 && !t.deel && !(lijst[0].sleutel.startsWith('g:') && soortenVan(lijst[0].sleutel.slice(2)).length > 1)) lijst.length = 0;
      }
      ui.toonGroepen(lijst, (sl) => {
        kaderAan = false;
        if (sl === 'b:') legerOpen = null;
        else if (sl === 'd:') leger.kiesDeel();
        else if (sl.startsWith('g:')) {
          leger.kiesGroep(sl.slice(2));
          if (soortenVan(sl.slice(2)).length > 1) legerOpen = sl.slice(2);
        } else leger.kiesSoort(sl.slice(2));
        naLeger();
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
  ui.opLegerBegin(() => { legerOpen = null; naLeger(); });
  ui.opBouwOpen(() => { if (leger.aantalGekozen()) leger.kiesGeen(); });
  naLeger();

  // Waar staat deze soldaat op het scherm (het midden van zijn lijf)?
  const opScherm = (e) => camera.wereldNaarScherm((e.x - e.y) * (CONFIG.tegel.breedte / 2), (e.x + e.y) * (CONFIG.tegel.hoogte / 2) - 16 - e.hoogte);

  // Het stuk eigen muur onder een punt in de wereld, of null. Een muur is
  // hoog: wie de bovenkant aantikt, raakt op de grond een tegel erachter.
  // Daarom kijken we per hoogte welke tegel er dan onder het punt ligt.
  const muurHoogtes = [...new Set(hoogtes.filter((h) => h > 0))].sort((a, b) => b - a);
  // De vakken van je eigen poort onder de tik (een poort kan meer vakken breed zijn)
  const POORT = OBJECT_ASSET.indexOf('kasteel.poort');
  const isEigenPoort = (x, y) => binnenKaart(kaart, x, y) && kaart.object[y * kaart.breedte + x] === POORT && kaart.eigenaar[y * kaart.breedte + x] === 1;
  const poortOnder = (x, y, wereld) => {
    let p = isEigenPoort(x, y) ? { x, y } : null;
    if (!p) { const m = muurOnder(wereld.x, wereld.y); if (m && isEigenPoort(m.x, m.y)) p = m; }
    if (!p) return null;
    const B = kaart.breedte;
    const vakken = [p.y * B + p.x];
    for (let i = 0; i < vakken.length && vakken.length < 9; i++) {
      const vx = vakken[i] % B, vy = Math.floor(vakken[i] / B);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isEigenPoort(vx + dx, vy + dy) && !vakken.includes((vy + dy) * B + vx + dx)) vakken.push((vy + dy) * B + vx + dx);
    }
    return vakken;
  };
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
    // De proloog begint helemaal opnieuw: met een schone kaart (je kasteel staat er weer).
    if (proloog) {
      bewaren = false;
      opslag.wis();
      proloog.stop();
      proloog.wis();
      verhaal.wis();
      window.location.reload();
      return;
    }
    stopBouw();
    bewaren = false;
    const gevochten = strijd.stand().golf > 0 || !!strijd.uitslag();
    const weg = bouwer.sloopAlles();
    const bomenTerug = economie.herstel();
    if (bomenTerug.size) kaartGewijzigd(bomenTerug);
    leger.herstel();
    leger.zetKoning(koningVak);   // altijd: wat de bewaarde stand ook was, na Start over staat je koning er weer (anders meteen weer Defeat)
    strijd.herstel();
    if (hinderlaag) hinderlaag.wis();   // level 2: de nissen in de rotsen dicht, de hinderlaag komt weer
    if (reserve) reserve.wis();   // level 9: de verborgen reserve staat weer klaar
    if (sluipers) sluipers.wis();   // level 4: alle dertig plekken staan weer klaar
    sluitKazerne();
    ui.toonEinde({ open: false });
    ui.verbergVerhaal();
    verhaal.wis();
    if (proloog) proloog.wis();
    if (doel) doel.wis();
    havenLesKlaar = false;   // na Start over begint de havenles weer
    if (havenLes) havenLes.zetOpnieuw();
    visLesKlaar = false;     // de visles ook
    if (visLes) visLes.zetOpnieuw();
    legerLesKlaar = false;   // de legerles ook (het leger is weg)
    if (legerLes) legerLes.zetOpnieuw();
    // Wie op de plek van een teruggekomen boom stond, krijgt een nieuwe plek.
    eenheden.zetAantal(aantal(), false);
    opslag.wis();
    bewaren = true;
    if (weg || bomenTerug.size) ui.toonMelding(`Restarted: ${weg} ${weg === 1 ? 'building' : 'buildings'} torn down, the forest is back.`, { soort: 'uitleg', toon: true });
    else ui.toonMelding(gevochten ? 'Restarted: the first attack is still to come.' : 'Nothing had changed yet.', { soort: 'uitleg', toon: true });
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
      else if (h.wacht > 3600) kort = '';   // rood valt in dit level niet vanzelf aan: de klok zegt niets
      else if (h.rooster) kort = `${h.rooster.naam} ${tijd(h.rooster.volgende)}`;   // aanvalsrooster: de klok tikt
      else kort = klaar ? tijd(h.wacht) : `Red ${Math.floor(h.sterkte)}/${Math.ceil(h.doel)}`;
      if (h.rooster) {
        lang = (s.vijanden ? `Attack ${s.golf}: ${s.vijanden} ${s.vijanden === 1 ? 'enemy' : 'enemies'} left. ` : '') +
          `Next attack (${s.golf + 1}): ${h.rooster.naam.toLowerCase()} in ${tijd(h.rooster.volgende)}. The stronger you are, the stronger it comes. ` +
          `Workshops still standing: ${h.werken} of ${h.werkenTotaal}.`;
      } else
      lang = (s.vijanden ? `Attack ${s.golf}: ${s.vijanden} ${s.vijanden === 1 ? 'enemy' : 'enemies'} left. ` : `Attack ${s.golf + 1}: `) +
        `${heerNaam} has ${rij || 'no one yet'} in reserve (strength ${Math.round(h.sterkte * 10) / 10} of ${Math.round(h.doel * 10) / 10}). ` +
        `Workshops still standing: ${h.werken} of ${h.werkenTotaal}. Stock: ${h.voorraad.goud} gold, ${h.voorraad.hout} wood, ${h.voorraad.steen} stone.`;
    } else if (s.vijanden) {
      kort = 'Attack!';
      lang = `Attack ${s.golf}: ${s.vijanden} ${s.vijanden === 1 ? 'enemy' : 'enemies'} left. The next one comes in ${tijd(s.klok)}.`;
    } else if (s.golven && !regels.strijd.proloog) {
      kort = tijd(s.klok);
      lang = `Attack ${s.golf + 1} comes in ${tijd(s.klok)}.`;
    }
    // Level 8 (golven van Rutger): bovenin staat de klok en hoeveel golven er geweest zijn. "Attack!" alleen als er
    // echt een golf bezig is, tot de laatste man dood is; dan telt de klok weer.
    if (missie && missie.doel && missie.doel.soort === 'golven' && doel && doel.stand && !s.vrede) {
      const st = doel.stand();
      const totaal = missie.doel.aantal || 10;
      if (st.golfBezig || st.golven >= totaal) {
        kort = `Attack! ${st.golven}/${totaal}`;
        lang = st.golfBezig ? `Wave ${st.golven} of ${totaal}: ${doel.mannenOver()} raiders left. The next wave comes ${tijd(missie.doel.tussen || 100)} after the last one falls.` : `All ${totaal} waves have come. Hold the shore.`;
      } else {
        const nog = Math.max(0, Math.ceil(doel.volgende()));
        kort = `${tijd(nog)} \u00b7 Wave ${st.golven}/${totaal}`;
        lang = `Wave ${st.golven + 1} of ${totaal} lands in ${tijd(nog)}.`;
      }
    }
    lang += ` Keep: ${s.burcht} of ${s.burchtMax}.`;
    if (!s.vrede && !regels.strijd.proloog) lang += ' Defeating the red king wins the level.';
    ui.toonStrijd({ kort, lang: lang.trim(), slecht: missie && missie.doel && missie.doel.soort === 'golven' && doel && doel.stand ? doel.stand().golfBezig : s.vijanden > 0 });
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
      ui.toonMelding(`Your soldiers destroyed a red ${werk.naam.toLowerCase()}.`, { soort: 'leger' });
      return;
    }
    if (performance.now() - laatstVernield < 6000) return;
    laatstVernield = performance.now();
    ui.toonMelding(`The enemy destroyed your ${werk.naam.toLowerCase()}.`, { soort: 'vijand' });
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
      if (doel && doel.klaar) doel.klaar();   // de klok van dit level begint de volgende keer opnieuw
      const na = s.golf ? ` You withstood ${s.golf} ${s.golf === 1 ? 'attack' : 'attacks'}.` : '';
      if (missie) {
        missieGewonnen(missie.id);
        if (gevangene) gevangene.bevrijd();
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
      const hut = strijd.hut();
      if (hut && hut.gevallen) ui.toonEinde({ open: true, titel: 'Defeat', tekst: "Brandt's hunters broke into Gesina's hut. The Silent Folk will not come now. Start again and try once more.", verloren: true, portret: { naam: 'Mother Gesina', portret: 'gesina' } });
      else ui.toonEinde({ open: true, titel: 'Defeat', tekst: `Your king fell during attack ${s.golf}. Start again and try once more.`, verloren: true, portret: { naam: 'King Karel', portret: 'karel_rouw' } });
    }
  };
  ui.opVerder(() => {
    strijd.gaVerder();
    ui.toonEinde({ open: false });
    ui.toonMelding('You play on. No more attacks will come.', { soort: 'uitleg', toon: true });
  });
  ui.opEindeOpnieuw(opnieuw);

  // --- Het beginscherm en de levelkaart ---------------------------------------------------
  // (titelOpen staat hierboven bij de spellus.)
  // --- Het menu: vrij spel en de campagne -------------------------------------------------
  const modusNaam = missie ? missie.titel : `Free play: ${missies.profielen[modus.profiel].naam}`;
  document.getElementById('versie').textContent += ` · ${missie ? 'mission ' + missie.id : missies.profielen[modus.profiel].naam.toLowerCase()}`;
  const gewonnenNu = () => voortgang();   // elke keer opnieuw lezen: na een winst in dit level moet het volgende level meteen open zijn
  const menuItems = () => { const gewonnen = gewonnenNu(); return [
    ...missies.campagne.filter((c) => c.speelbaar).map((c) => ({
      groep: 'Campaign', sleutel: `missie:${c.id}`, naam: `${c.titel}${gewonnen.includes(c.id) ? ' (won)' : ''}`,
      tekst: isOpen(c, gewonnen) ? c.intro.split('. ')[0] + '.' : eerstWinnen(c.id),
      kan: isOpen(c, gewonnen),
      nu: modus.soort === 'campagne' && modus.missie === c.id,
    })),
    ...missies.vrij.map((v) => ({
      groep: 'Free play', sleutel: `vrij:${v.profiel}`, naam: missies.profielen[v.profiel].naam, tekst: v.tekst,
      nu: modus.soort === 'vrij' && modus.profiel === v.profiel,
    })),
  ]; };
  const kiesModus = (sleutel) => {
    const [soort, waarde] = sleutel.split(':');
    const nieuw = soort === 'missie' ? { soort: 'campagne', missie: Number(waarde) } : { soort: 'vrij', profiel: waarde };
    if (!zetModus(nieuw)) {
      ui.toonMelding('Choosing does not work here: the browser storage is blocked.', { soort: 'uitleg', toon: true });
      return;
    }
    bewaar();   // wat je nu hebt blijft bewaard bij deze modus
    try { window.sessionStorage.setItem(TOON_BEELD, soort === 'missie' ? '1' : '0'); } catch (fout) { /* dan geen beeld */ }
    try { window.sessionStorage.setItem(GEEN_TITEL, '1'); } catch (fout) { /* dan zie je het beginscherm nog eens */ }
    window.location.reload();
  };
  const openMenu = () => ui.toonMenu({ open: true, nu: `Now: ${modusNaam}. Each mode keeps its own game.`, items: menuItems() });
  const kanVerder = !!bewaard || !!missie;   // is er al iets gespeeld?
  const toonKaart = () => {
    const open = (c) => isOpen(c, gewonnenNu());
    ui.toonTitel({ open: true, weergave: 'kaart' });
    geluid.speel('ui_map_open');
    ui.toonLevelkaart(missies.campagne.map((c, i) => ({
      id: c.id, naam: c.naam, portret: c.portret,
      x: c.punt ? c.punt.x : 10 + i * 8, y: c.punt ? c.punt.y : 50,
      staat: gewonnenNu().includes(c.id) ? 'gewonnen' : !c.speelbaar ? 'later' : !open(c) ? 'dicht' : modus.soort === 'campagne' && modus.missie === c.id ? 'nu' : 'open',
    })), (id) => {
      const c = missies.campagne.find((m) => m.id === id);
      const tekst = document.getElementById('kaart-tekst');
      if (!c.speelbaar) { tekst.textContent = `${c.titel}${c.heer ? ` (${c.heer})` : ''}: coming later.`; return; }
      if (!open(c)) { tekst.textContent = `${c.titel}: ${eerstWinnen(id).toLowerCase()}`; return; }
      if (modus.soort === 'campagne' && modus.missie === id) {
        sluitTitel();
        if (c.beeld && c.verhaal) toonLevelBeeld();   // ook als je verder speelt: eerst het verhaalbeeld
        return;
      }
      kiesModus(`missie:${id}`);
    }, 'Tap a level to start it. You can replay a level you have won.', missies.levelkaart);
  };
  const toonTitel = () => { titelOpen = true; ui.toonTitel({ open: true, weergave: 'voorpagina', kanVerder }); };
  const sluitTitel = () => { titelOpen = false; ui.toonTitel({ open: false }); };
  ui.opTitel({ campagne: toonKaart, vrij: () => { sluitTitel(); openMenu(); }, verder: sluitTitel, terug: toonTitel });
  // Het oog: gebouwen en bomen doorzichtig, zodat je ziet wie erachter staat.
  const oog = document.getElementById('knop-oog');
  oog.addEventListener('click', () => {
    tekenaar.zetDoorzicht(!tekenaar.doorzicht());
    oog.classList.toggle('actief', tekenaar.doorzicht());
    oog.setAttribute('aria-pressed', String(tekenaar.doorzicht()));
  });
  ui.opMenuActies({
    opslaan: () => {
      const was = bewaarFoutGemeld;
      bewaar();
      if (bewaarFoutGemeld && !was) return;   // dan staat er al een melding
      ui.toonMelding(bewaren ? 'Game saved. You continue from here next time.' : 'Nothing to save yet.', { soort: 'uitleg', toon: true });
    },
    levels: () => { titelOpen = true; toonKaart(); },
    hoofdmenu: toonTitel,
  });
  // De rol rechtsonder: wat je in dit level moet doen.
  ui.opDoel(() => proloog ? {
    titel: missie.titel,
    tekst: missie.intro,
    taak: proloog.taken().map((t) => `${t.klaar ? '✓' : t.nu ? '▸' : '·'} ${t.taak}`).join('\n'),
    portret: 'bartholt',
  } : missie && missie.doel ? {
    titel: missie.titel,
    tegen: missie.heer ? `Against ${missie.heer}` : '',
    tekst: missie.intro,
    taak: doel.omschrijving ? doel.omschrijving() : doel.fase && doel.fase() === 1
      ? "Your goal: defeat Huntmaster Brandt in his tent camp. The Flameweavers of the Silent Folk are yours: tap them and send them in. If your king falls, you lose."
      : `Your goal: hold Mother Gesina's hut until her ritual is done (${Math.ceil(doel.over() / 60)} min left). If the hut falls, or your king, you lose. Then the Silent Folk come, and you go after Brandt.`,
    portret: doel.omschrijving ? (missie.doel.soort === 'bevrijden' ? 'bartholt' : missie.portret || 'lambrecht') : 'gesina',
  } : missie ? {
    titel: missie.titel,
    tegen: missie.heer ? `Against ${missie.heer}` : '',
    tekst: missie.intro,
    taak: 'Your goal: defeat the red king. Keep your own king alive.',
    portret: missie.portret || null,
  } : {
    titel: modusNaam,
    tekst: 'Build your keep and your village, train an army and hold off the attacks of red.',
    taak: 'Your goal: defeat the red king. Keep your own king alive.',
  });
  // Het beginscherm komt bij het openen van de pagina, niet na het kiezen van een level.
  let geenTitel = false;
  try { geenTitel = window.sessionStorage.getItem(GEEN_TITEL) === '1'; window.sessionStorage.removeItem(GEEN_TITEL); } catch (fout) { /* geen geheugen: dan toon je het gewoon */ }
  if (!geenTitel) toonTitel();
  // De afdekking van het laden weg (index.html): het beginscherm of het spel staat er nu.
  { const laden = document.getElementById('laden'); if (laden) { laden.classList.add('weg'); setTimeout(() => laden.remove(), 400); } }
  ui.opMenuKeuze(kiesModus);
  ui.opVolgende(() => kiesModus(`missie:${missie.id + 1}`));
  // Een missie die nog niet is begonnen opent met zijn intro.
  // De proloog: taken van Bartholt, de nacht en de scène.
  const gids = missie && (missie.proloog || missie.havenLes || missie.visLes || missie.handelLes || missie.legerLes) ? maakGids({
    // Waar staat een tegel op het scherm, en hoe groot is hij? Voor de gouden ruit op de bouwplek.
    // boven: de bovenkant van het bouwwerk op die plek (een muur), daar tikt de speler om er een soldaat op te zetten
    plekNaarScherm: (x, y, boven = false) => { const w = rasterNaarWereld(x + 0.5, y + 0.5); const h = boven ? hoogteOp(y * kaart.breedte + x) : 0; const sc = camera.wereldNaarScherm(w.x, w.y - h); return { x: sc.x, y: sc.y, zoom: camera.zoom }; },
    tegelMaat: { breedte: CONFIG.tegel.breedte, hoogte: CONFIG.tegel.hoogte },
  }) : null;
  const slachting = maakSlachting({ strijd, economie, wegvinder, kaart, eenheden, leger, rood });
  // Level 8: Bartholt leert je de haven (js/havenles.js).
  havenLes = missie && missie.havenLes && !strijd.uitslag() ? maakHavenLes({ gids, haven, bouwer, bouwwerken, kaart, economie, klaarAl: havenLesKlaar, opKlaar: () => { havenLesKlaar = true; bewaar(); }, sluitPanelen: () => { stopBouw(); ui.sluitPaneel(); handelVak = -1; handelBericht = ''; ui.toonHandel({ open: false }); } }) : null;
  // Level 8, na de havenles: Bartholt leert je de vissershut (js/visles.js).
  visLes = missie && missie.visLes && mag('vissershut') && !strijd.uitslag() ? maakVisLes({ gids, visserij, bouwer, bouwwerken, kaart, economie, klaarAl: visLesKlaar,
    wachtOp: () => !havenLes || havenLes.klaar(),
    opKlaar: () => { visLesKlaar = true; bewaar(); },
    glijNaar: (x, y) => { const w = rasterNaarWereld(x, y); camera.glijNaar(w.x, w.y, 900); },
    sluitPanelen: () => { stopBouw(); ui.sluitPaneel(); handelVak = -1; handelBericht = ''; ui.toonHandel({ open: false }); } }) : null;
  // Level 1: Bartholt leert je verkopen in de voorraadkamer (js/handelles.js).
  handelLes = missie && missie.handelLes && !strijd.uitslag() ? maakHandelLes({ gids, bouwer, bouwwerken, kaart, economie, regels, klaarAl: handelLesKlaar, opKlaar: () => { handelLesKlaar = true; bewaar(); }, sluitPanelen: () => { stopBouw(); ui.sluitPaneel(); handelVak = -1; handelBericht = ''; ui.toonHandel({ open: false }); } }) : null;
  // Level 3: Bartholt leert je het leger besturen: box, groep, formatie en Hold (js/legerles.js).
  legerLes = missie && missie.legerLes && !strijd.uitslag() ? maakLegerLes({ gids, leger, kaart, wegvinder, klaarAl: legerLesKlaar,
    opKlaar: () => { legerLesKlaar = true; ui.beperkKnoppen(null); ui.vrijBouw(); naLeger(); bewaar(); },
    kaderAan: () => kaderAan,
    glijNaar: (x, y) => { const w = rasterNaarWereld(x, y); camera.glijNaar(w.x, w.y, 900); },
    sluitPanelen: () => { stopBouw(); ui.sluitPaneel(); handelVak = -1; handelBericht = ''; ui.toonHandel({ open: false }); } }) : null;
  const figuranten = missie && missie.proloog ? maakFiguranten({ kaart, eenheden, wegvinder, leger, strijd }) : null;
  proloog = missie && missie.proloog ? maakProloog({
    soortKoning: SOORT.KONING, kaart, bouwer, bouwwerken, leger, strijd, wegvinder, eenheden,
    koningSoort: 'koning', gids, figuranten, bevolking: () => economie.bevolking(),
    glijNaar: (x, y, duur) => { const w = rasterNaarWereld(x + 0.5, y + 0.5); camera.glijNaar(w.x, w.y, duur); },
    // Het oog uit: met het oog aan telt een tik als een tik op de grond, dan kom je de muur niet op
    oogUit: () => { tekenaar.zetDoorzicht(false); oog.classList.remove('actief'); oog.setAttribute('aria-pressed', 'false'); },
    geefVoorraad: (naam, n) => { economie.voorraad[naam] = (economie.voorraad[naam] || 0) + n; if (naVoorraad) naVoorraad(); },
    kiesGeen: () => { leger.kiesGeen(); if (naLeger) naLeger(); },
    sluitPanelen: () => { stopBouw(); sluitKazerne(); leger.kiesGeen(); ui.verbergVerhaal(); if (naLeger) naLeger(); },   // ook een open bericht weg: dat verbergt anders de kaartjes van de gids
    stopBouw: () => stopBouw(),
    kijkNaar: (x, y) => { const w = rasterNaarWereld(x + 0.5, y + 0.5); camera.kijkNaar(w.x, w.y); },
    toonVerhaal: (b) => ui.toonVerhaal(b),
    toonTaak: (t) => ui.toonTaak(t),
    toonMelding: (t) => ui.toonMelding(t, { soort: 'vijand' }),
    logMelding: (t) => ui.toonMelding(t, { soort: 'economie', toon: false, wie: 'Bartholt' }),
    kaartGewijzigd,
    toonScene: (kaarten) => { titelOpen = true; stopBouw(); sluitKazerne(); leger.kiesGeen(); ui.verbergVerhaal(); ui.toonScene(kaarten, () => {
      // Klaar: de proloog telt als gedaan, de stand gaat weg, door naar de levelkaart.
      missieGewonnen(missie.id);
      bewaren = false;
      opslag.wis();
      proloog.stop();
      proloog.wis();
      verhaal.wis();
      titelOpen = true;
      toonKaart();
    }); },
  }) : null;
  // In de proloog staat je volk stil: populariteit en boeren dalen of stijgen niet door tijd of honger (economie.js bevries).
  if (proloog) economie.bevries(true);
  // Tutorial: alleen de soldaat van de les (overdag) of niet de lijfwacht ('s nachts) is te kiezen
  if (proloog) leger.zetKiesFilter((e) => proloog.magKiezen(e));
  // Een level met een eigen doel (level 4: de hut van Gesina houden).
  doel = missie && missie.doel ? (missie.doel.soort === 'loodsen' ? maakLoodsen : missie.doel.soort === 'bevrijden' ? maakBevrijding : missie.doel.soort === 'golven' ? maakGolven : maakDoel)({
    missie, kaart, bouwer, strijd, wegvinder,
    toonVerhaal: (b) => ui.toonVerhaal(b),
    toonTaak: (t) => ui.toonTaak(t),
    toonAanvalKlok: (k) => ui.toonAanvalKlok(k),
    toonMelding: (t) => ui.toonMelding(t, { soort: 'vijand' }),
    leger,
    kijkNaar: (x, y) => { const w = rasterNaarWereld(x + 0.5, y + 0.5); camera.kijkNaar(w.x, w.y); },
    kaartGewijzigd,
  }) : null;
  // Zeeleven (0.112.0, White Dike): walvissen, meeuwen, vissersboten, mist, avondlicht, Rutger op de dijk, eilandjes met een kist.
  const zeeleven = missie && missie.zeeleven ? maakZeeleven({
    kaart, economie, haven,
    melding: (t, toon) => ui.toonMelding(t, { soort: /^Rutger/.test(t) ? 'vijand' : 'uitleg', toon: !!toon }),
    volgendeGolf: () => (doel && doel.volgende ? doel.volgende() : Infinity),
    rutger: () => (doel && doel.rutgerThuis ? doel.rutgerThuis() : null),
    onderweg: () => (doel && doel.stand ? doel.stand().onderweg : 0),
  }) : null;
  staat.zee = zeeleven;
  // Je poorten gaan vanzelf dicht als er vijandelijke soldaten dichtbij komen (js/poortwacht.js).
  const poortwacht = maakPoortwacht({
    kaart, wegvinder, vijanden: () => strijd.vijanden(), kaartGewijzigd: (v) => kaartGewijzigd(v),
    melding: (t) => ui.toonMelding(t, { soort: 'leger' }), stappenPerSeconde: CONFIG.spel.stappenPerSeconde,
    uit: () => !!proloog || wegvinder.poortenOpen(),
  });
  // Level 2: boogschutters in de rotsen van de pas (js/hinderlaag.js)
  const hinderlaag = missie && missie.hinderlaag ? maakHinderlaag({
    instelling: missie.hinderlaag, kaart, leger, strijd, kaartGewijzigd,
    toonMelding: (t) => ui.toonMelding(t, { soort: 'vijand' }),
    toonVerhaal: (tekst) => ui.toonVerhaal({ naam: missie.heer, portret: missie.portret, tekst }),
  }) : null;
  // Level 9: de verborgen reserve van Valkenier (js/reserve.js)
  const reserve = missie && missie.reserve ? maakReserve({
    missie, kaart, strijd, leger, wegvinder,
    toonMelding: (t) => ui.toonMelding(t, { soort: 'vijand' }),
    toonVerhaal: (tekst) => ui.toonVerhaal({ naam: missie.heer, portret: missie.portret, tekst }),
  }) : null;
  // Level 4: ongeveer dertig plekken waar uit het niets een sluipmoordenaar opduikt (js/sluipers.js)
  const sluipers = missie && missie.sluipers ? maakSluipers({
    missie, kaart, eenheden, leger, strijd, wegvinder,
    toonMelding: (t) => ui.toonMelding(t, { soort: 'vijand' }),
  }) : null;
  let beeldOpen = false;   // het verhaalbeeld staat in beeld: het spel wacht
  const GEZIEN = 'burcht-banier.beeldGezien';   // welk level zijn verhaalbeeld al heeft gehad: bij heropenen niet nog eens
  const toonLevelBeeld = () => {
    beeldOpen = true;
    try { window.localStorage.setItem(GEZIEN, String(missie.id)); } catch (fout) { /* dan zien we het soms nog eens */ }
    return ui.toonVerhaalbeeld({ beeld: missie.beeld, tekst: missie.verhaal, seconden: CONFIG.verhaalbeeldSeconden })
      .then(() => { beeldOpen = false; });
  };
  const beginLevel = () => { verhaal.start(); if (proloog) proloog.start(); if (doel) doel.start(); };
  ui.opMissieBegin(() => { ui.toonMissie({ open: false }); beginLevel(); });
  // Is dit een start via de levelkaart? Dan eerst het beeld, ook bij een bewaard spel.
  let viaKaart = false;
  try { viaKaart = window.sessionStorage.getItem(TOON_BEELD) === '1'; window.sessionStorage.removeItem(TOON_BEELD); } catch (fout) { /* geen beeld */ }
  const heeftBeeld = !!(missie && missie.beeld && missie.verhaal);
  let alGezien = false;
  try { alGezien = window.localStorage.getItem(GEZIEN) === String(missie && missie.id); } catch (fout) { /* niet bekend */ }
  if (missie && !bewaard && !strijd.uitslag()) {
    const verteller = missies.figuren[missie.verteller || 'bartholt'];
    const toonBriefing = () => ui.toonMissie({
      open: true,
      titel: missie.titel,
      tekst: missie.intro,
      spreker: verteller || null,
      tegen: missie.heer ? { naam: missie.heer, portret: missie.portret } : null,
      extra: [nieuwHier().trim(), kaart.naam ? `Map: ${kaart.naam}.` : ''].filter(Boolean),
    });
    // Eerst het verhaalbeeld, dan de briefing.
    if (heeftBeeld && (viaKaart || !alGezien)) toonLevelBeeld().then(toonBriefing);
    else toonBriefing();
  } else if (heeftBeeld && viaKaart && !strijd.uitslag()) {
    toonLevelBeeld().then(beginLevel);
  } else {
    beginLevel();
  }
  if (strijd.uitslag()) naEinde(strijd.uitslag());
  else if (strijd.stand().golf === 0 && !strijd.stand().vrede && !proloog && !doel) {
    const hh = strijd.stand().heer;
    ui.toonMelding(hh ? 'The enemy is gathering an army. Their workshops stand outside their wall: destroy them and they earn less. Build barracks and train soldiers.' : `The enemy attacks in ${tijd(strijd.stand().klok)}. Build barracks and train soldiers.`, { soort: 'uitleg', toon: true });
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
      let vanRood = roodOnder(wereld.x, wereld.y);
      const erachter = (e) => !!vanRood && e.hoogte === 0 && e.x + e.y < vanRood.x + vanRood.y + 1;
      // Een eigen soldaat aangetikt: die kies je.
      const soldaat = leger.vind(wereld.x, wereld.y, 8 / camera.zoom);
      // Tutorial: een soldaat die nu niet te kiezen is (niet die van de les, of de poortles) telt niet als tik op een soldaat
      // Ingenieurs gekozen en een eigen trebuchet aangetikt: die ingenieurs gaan de trebuchet bedienen.
      if (soldaat && !erachter(soldaat) && leger.staatVast(soldaat.soldaat.sleutel) && !leger.gekozen().includes(soldaat)
          && leger.gekozen().some((e) => leger.soorten[e.soldaat.sleutel].bouwt)) {
        const gek = leger.gekozen().filter((e) => leger.soorten[e.soldaat.sleutel].bouwt);
        const n = strijd.bemanTrebuchet(gek, Math.floor(soldaat.y) * kaart.breedte + Math.floor(soldaat.x));
        if (n > 0) {
          staat.doel = { x: soldaat.x, y: soldaat.y, duur: 900, tot: performance.now() + 900 };
          geluid.speel('order_move');
          ui.toonMelding(n === 1 ? 'The engineer goes to operate the trebuchet.' : 'The engineers go to operate the trebuchet.', { soort: 'leger' });
        } else {
          geluid.speel('ui_denied');
          ui.toonMelding(n === -2 ? 'This trebuchet already has two engineers.' : 'These engineers cannot reach that trebuchet.', { soort: 'leger' });
        }
        return;
      }
      if (soldaat && !erachter(soldaat) && (!proloog || proloog.magTikKiezen(soldaat))) {
        kaderAan = false;
        leger.kies([soldaat]);
        geluid.speel('select_soldier');
        return;
      }
      // Een vijand aangetikt: je gekozen soldaten vallen hem aan.
      const vijand = strijd.vindVijand(wereld.x, wereld.y, 8 / camera.zoom);
      if (vijand && !erachter(vijand)) {
        if (leger.aantalGekozen()) {
          strijd.valAan(leger.gekozen(), vijand);
          geluid.speel('order_attack');
          staat.doel = { x: Math.floor(vijand.x), y: Math.floor(vijand.y), duur: 900, tot: performance.now() + 900, aanval: true };
          // Staat die vijand op de muur van rood en heb je een ladderdrager
          // gekozen? Dan bedoel je die muur: de drager zet er een ladder tegen,
          // de anderen vallen de vijand aan.
          const vijandVak = Math.floor(vijand.y) * kaart.breedte + Math.floor(vijand.x);
          const metDrager = leger.gekozen().some((e) => leger.soorten[e.soldaat.sleutel].ladder);
          if (!(metDrager && (vanRood || strijd.isVanRood(vijandVak)))) return;
          if (!vanRood) vanRood = { x: Math.floor(vijand.x), y: Math.floor(vijand.y), vak: vijandVak };
        } else {
          staat.gekozen = null;
          ui.toonTegel(`Enemy: ${leger.soorten[vijand.vijand].naam.toLowerCase()}, health ${Math.max(0, Math.ceil(vijand.leven))} of ${vijand.levenMax}`);
          return;
        }
      }
      // Zeeleven: de gelukkige walvis en de kist op het eilandje.
      if (zeeleven && zeeleven.tik(x, y)) return;
      // De kazerne aangetikt: daar leid je soldaten op.
      const aangetikt = binnenKaart(kaart, x, y) ? bouwer.werkOp(x, y) : null;
      // Proloog: een gebouw aantikken opent alleen een paneel als de les erom vraagt
      if (aangetikt && proloog && ((aangetikt.handel && !proloog.mag('handel')) || (aangetikt.leidtOp && !proloog.mag('kazerne')))) return;
      if (aangetikt && aangetikt.werker === 'zager' && !proloog) {
        handelVak = -1;
        zagerVak = y * kaart.breedte + x;
        zagerBericht = '';
        staat.gekozen = { x, y };
        toonZagerij();
        return;
      }
      if (aangetikt && (aangetikt.handel || aangetikt.haven)) {
        if (havenLes && havenLes.actief() && havenLes.fase() !== 'tik' && aangetikt.haven) return;   // havenles: pas aantikken als Bartholt erom vraagt
        if (handelLes && handelLes.actief() && handelLes.fase() !== 'tik' && aangetikt.handel) return;   // handelles: idem
        zagerVak = -1;
        handelVak = y * kaart.breedte + x;
        handelBericht = '';
        havenGoed = null;
        staat.gekozen = { x, y };
        toonHandel();
        return;
      }
      if (aangetikt && aangetikt.leidtOp) {
        zagerVak = -1;
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
            ui.toonMelding('Your assassin climbs the red wall.', { soort: 'leger' });
            if (klimmers.length === groep.length) return;
          }
        }
        const draagt = groep.some(isDrager);
        // Tik je op een toren of de poort, dan zoekt de drager zelf het
        // dichtstbijzijnde gewone stuk muur.
        const muurVak = !draagt ? -1 : strijd.isRodeMuurZonderLadder(vanRood.vak) ? vanRood.vak : strijd.dichtsteRodeMuur(vanRood.vak, 3);
        if (draagt && muurVak >= 0) {
          if (strijd.muurTeHoog() && !groep.some((e) => isDrager(e) && leger.soorten[e.soldaat.sleutel].vast)) {
            ui.toonMelding('These walls are too high for ladders. Bring a siege tower.', { soort: 'leger' });
            return;
          }
          const kregen = [];
          if (strijd.zetLadderBevel(groep.filter(isDrager), muurVak, kregen)) {
            staat.doel = { x: muurVak % kaart.breedte, y: Math.floor(muurVak / kaart.breedte), duur: 900, tot: performance.now() + 900 };
            meldSiege(kregen, 'wall');
          } else {
            ui.toonMelding('Your ladder bearer cannot reach that wall.', { soort: 'leger' });
          }
          return;
        }
        if (draagt && !groep.some((e) => !isDrager(e))) {
          ui.toonMelding(strijd.isVanRood(vanRood.vak) && !strijd.isRodeMuurZonderLadder(vanRood.vak) ? 'Tap a plain piece of wall without a ladder: the tower or ladder fits there.' : 'There is already a ladder there.', { soort: 'leger' });
          return;
        }
        if (leger.heeftTrap(vanRood.x, vanRood.y) && groep.some((e) => !isRam(e) && !isDrager(e))) {
          const rammen = groep.filter(isRam);
          if (rammen.length) {
            const kregen = [];
            if (strijd.valBouwAan(rammen, vanRood.vak, kregen)) meldSiege(kregen, beschrijfTegel(kaart, vanRood.x, vanRood.y));
          }
          leger.kies(groep.filter((e) => !isRam(e) && !isDrager(e)));
          const opWeg = leger.stuur(vanRood.x, vanRood.y, true);
          leger.kies(groep);
          if (opWeg) {
            geluid.speel('order_attack');
            geluid.speel('ladder_climb', { wacht: 300 });
            staat.doel = { x: vanRood.x, y: vanRood.y, duur: 900, tot: performance.now() + 900, hoogte: hoogteOp(vanRood.vak) };
            return;
          }
        }
      }
      // Een bouwwerk van rood aangetikt: je gekozen soldaten vallen het aan.
      if (vanRood && leger.aantalGekozen()) {
        const kregen = [];
        if (strijd.valBouwAan(leger.gekozen(), vanRood.vak, kregen)) {
          staat.doel = { x: vanRood.x, y: vanRood.y, duur: 900, tot: performance.now() + 900, aanval: true };
          geluid.speel('order_attack');
          meldSiege(kregen, beschrijfTegel(kaart, vanRood.x, vanRood.y));
        } else {
          ui.toonMelding('Your soldiers cannot reach that. Break through the red gate or wall first.', { soort: 'leger' });
        }
        return;
      }
      if (vanRood) {
        const leven = strijd.levenOp(vanRood.vak);
        staat.gekozen = { x: vanRood.x, y: vanRood.y };
        ui.toonTegel(`Tile ${vanRood.x}, ${vanRood.y}: red ${beschrijfTegel(kaart, vanRood.x, vanRood.y)}, health ${leven.leven} of ${leven.max}`);
        return;
      }
      // Een ingenieur gekozen en Ballista aan: de tik is het stuk muur of de toren voor de ballista.
      if (ballistaModus && leger.aantalGekozen()) {
        const m = muurOnder(wereld.x, wereld.y) || (leger.isMuur(x, y) ? { x, y } : null);
        if (!m) { geluid.speel('ui_denied'); ui.toonMelding(BOUWMELDING_MUUR, { soort: 'leger' }); return; }
        if (ballistaPlek && ballistaPlek.x === m.x && ballistaPlek.y === m.y) {
          if (ballistaPlek.ok) bouwBallistaHier();
          else { geluid.speel('ui_denied'); ui.toonMelding(BOUWMELDING_MUUR, { soort: 'leger' }); }
          return;
        }
        zetBallistaPlek(m.x, m.y);
        return;
      }
      // Een ingenieur gekozen en de knop Trebuchet aan: de tik is de plek voor de trebuchet.
      if (trebuchetModus && leger.aantalGekozen()) {
        if (!binnenKaart(kaart, x, y)) return;
        // Eerste tik: een voorbeeld met de bereikring. Dezelfde plek nog eens aantikken (of de knop Build here) bouwt.
        if (trebuchetPlek && trebuchetPlek.x === x && trebuchetPlek.y === y) {
          if (trebuchetPlek.ok) bouwTrebuchetHier();
          else { geluid.speel('ui_denied'); ui.toonMelding('A trebuchet needs a free, open spot on the ground.', { soort: 'leger' }); }
          return;
        }
        zetTrebuchetPlek(x, y);
        return;
      }
      // Zijn er soldaten gekozen en tik je je eigen muur aan, dan gaan ze erop.
      // Met het oog aan (muren doorzichtig) telt de grond: alleen een tik op de muur zelf zet ze erop.
      const grondEerst = tekenaar.doorzicht() && !leger.isMuur(x, y);
      const muur = leger.aantalGekozen() && !grondEerst ? muurOnder(wereld.x, wereld.y) : null;
      if (muur) {
        if (leger.stuur(muur.x, muur.y, true)) {
          geluid.speel('order_move');
          geluid.speel('steps_stone', { wacht: 250 });
          staat.doel = { x: muur.x, y: muur.y, duur: 900, tot: performance.now() + 900, hoogte: hoogteOp(muur.y * kaart.breedte + muur.x) };
        } else if (!leger.heeftTrap(muur.x, muur.y)) {
          ui.toonMelding('Your soldiers cannot get onto this wall yet. They can only climb up through an open gate: build a gate in this wall, or open it.', { soort: 'leger' });
        } else {
          ui.toonMelding('Your soldiers cannot get there.', { soort: 'leger' });
        }
        return;
      }
      // Zijn er soldaten gekozen, dan stuur je ze naar deze tegel.
      if (leger.aantalGekozen()) {
        if (!binnenKaart(kaart, x, y)) return;
        if (leger.stuur(x, y)) { staat.doel = { x, y, duur: 900, tot: performance.now() + 900 }; geluid.speel('order_move'); geluid.speel('steps_grass', { wacht: 250 }); }
        else ui.toonMelding(leger.gekozenHoog() ? 'The siege tower is taller than the gate and cannot pass through it.' : 'Your soldiers cannot get there.', { soort: 'leger' });
        return;
      }
      // Je eigen poort aantikken (geen soldaten gekozen): dicht of open
      const poort = poortOnder(x, y, wereld);
      if (poort && proloog && !proloog.mag('poort')) return;   // overdag in de tutorial geen poorten open of dicht
      if (poort) {
        if (wegvinder.poortenOpen()) { ui.toonMelding('The gate is jammed open. It cannot be closed now.', { soort: 'leger' }); return; }
        const nuDicht = !wegvinder.isPoortDicht(poort[0]);
        wegvinder.zetPoortDicht(poort, nuDicht);
        poortwacht.handmatig(poort, nuDicht);
        geluid.speel(nuDicht ? 'gate_close' : 'gate_open', { x: poort[0] % kaart.breedte + 0.5, y: Math.floor(poort[0] / kaart.breedte) + 0.5 });
        kaartGewijzigd(new Set(poort));
        ui.toonMelding(nuDicht ? 'Gate closed. Nobody can pass, not even your own men.' : 'Gate open. Your men can pass, the enemy cannot.', { soort: 'leger' });
        return;
      }
      if (binnenKaart(kaart, x, y)) {
        staat.gekozen = { x, y };
        let bezig = economie.beschrijf(y * kaart.breedte + x);
        const gebouw = bouwer.werkOp(x, y);
        if (gebouw && gebouw.woont) bezig = `room for ${gebouw.woont} peasants`;
        if (kaart.object[y * kaart.breedte + x] === OBJECT.VISSERSHUT) { const v = visserij.beschrijf(y * kaart.breedte + x); if (v) bezig = (bezig ? `${bezig}. ` : '') + v.replace(/\.$/, ''); }
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
      leger.kiesKader(leger.soldaten().filter((e) => {
        const p = opScherm(e);
        return p.x >= links && p.x <= rechts && p.y >= boven && p.y <= onder;
      }));
      if (legerLes) legerLes.naKader();
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
  const menuPaneel = document.getElementById('instellingen');   // het menu achter het tandwiel zet het spel stil
  let totStrijd = 0;
  maakSpellus({
    stappenPerSeconde: CONFIG.spel.stappenPerSeconde,
    stap: (dt) => {
      // Stilstaan zonder trillen: de tekenaar tekent tussen de vorige en de huidige plek in; zonder rekenstap
      // zou hij blijven heen en weer springen. Dus de vorige plek gelijk aan de huidige.
      const stilzetten = () => { for (const e of eenheden.lijst) { e.vorigeX = e.x; e.vorigeY = e.y; } };
      if (strijd.uitslag() || titelOpen || beeldOpen || !menuPaneel.hidden) { stilzetten(); return; }   // gewonnen of verloren, beginscherm of menu open: alles staat stil
      // Proloog: zolang er een kaartje openstaat (Bartholt of een gesprek) lopen de klokken van de tutorial niet.
      // Overdag leeft het dorp gewoon door; bij avond en nacht staat alles stil, ook het leger van Ottger.
      const leest = proloog && gids.kaartOpen();
      if (leest && proloog.fase() !== 'bouw') { stilzetten(); return; }
      eenheden.stap(dt);
      economie.stap();
      leger.stap();
      // Havenles: zolang Bartholt de haven uitlegt, staat de oorlog stil (geen klok in een les).
      if (!lesLoopt()) strijd.stap();
      haven.stap(dt);
      visserij.stap(dt);
      havenTik += dt;
      if (havenTik >= 1) { havenTik = 0; haven.zoek(); visserij.zoek(); if (handelVak >= 0) verversHandel(); }
      if (legerLes) {
        legerLes.stap(dt, !beeldOpen && document.getElementById('missie').hidden && document.getElementById('verhaalbeeld').hidden && document.getElementById('verhaal').hidden);
        if (legerLes.actief()) { ui.beperkKnoppen(legerLes.mag); ui.beperkBouw(null); if (kazerneVak >= 0) sluitKazerne(); }
      }
      if (handelLes) handelLes.stap(dt, !beeldOpen && document.getElementById('missie').hidden && document.getElementById('verhaalbeeld').hidden && document.getElementById('verhaal').hidden);
      if (havenLes) havenLes.stap(dt, !beeldOpen && document.getElementById('missie').hidden && document.getElementById('verhaalbeeld').hidden && document.getElementById('verhaal').hidden);
      if (visLes) visLes.stap(dt, !beeldOpen && document.getElementById('missie').hidden && document.getElementById('verhaalbeeld').hidden && document.getElementById('verhaal').hidden);
      poortwacht.stap();
      if (!lesLoopt()) verhaal.stap(dt, verhaalStand);   // havenles: ook de berichten wachten
      if (proloog) { if (!leest) proloog.stap(dt); gids.stap(dt); figuranten.stap(dt, proloog.fase()); ui.beperkBouw(proloog.bouwSleutel()); ui.beperkKnoppen(proloog.mag); if (kazerneVak >= 0 && !proloog.mag('kazerne')) sluitKazerne(); }   // opleidles klaar: het kazernepaneel dicht
      if (doel && !lesLoopt()) doel.stap(dt);   // havenles: de golven wachten
      if (zeeleven) zeeleven.stap(dt);
      if (hinderlaag && !strijd.uitslag()) hinderlaag.stap(dt);
      if (reserve) reserve.stap(dt);
      if (sluipers) sluipers.stap(dt);
      slachting.stap(dt);
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
  // Valhekken: jouw poort is open tenzij je hem dichtdeed; een poort van rood gaat open als er een rode
  // soldaat vlak bij is (zo zie je ze erdoor komen).
  tekenaar.zetHekDoel((i) => {
    if (kaart.eigenaar[i] === 1) return wegvinder.isPoortDicht(i) ? 0 : 1;
    const x = (i % kaart.breedte) + 0.5;
    const y = Math.floor(i / kaart.breedte) + 0.5;
    return eenheden.lijst.some((e) => e.team === 1 && !e.dood && Math.abs(e.x - x) < 1.8 && Math.abs(e.y - y) < 1.8) ? 1 : 0;
  });
  window.spel = { legerLes, zeeleven, haven, havenLes, visserij, visLes, handelLes, gids, hinderlaag, reserve, sluipers, veld, rood, regels, modus, missies, CONFIG, kaart, camera, staat, tekenaar, wegvinder, eenheden, meting, bouwer, bouwwerken, bouw, opslag, economie, leger, strijd, ui, proloog, doel, figuranten, slachting, poortwacht, assets, landschap: landschapProfiel, geluid };
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
