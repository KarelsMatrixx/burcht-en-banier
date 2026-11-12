// ECONOMIE: de voorraad, wat bouwen kost, je boeren, en de werkers die
// grondstoffen halen.
//
// Bij elk werkgebouw hoort één werker met een beroep. Elk beroep werkt
// hetzelfde: naar de dichtstbijzijnde bron lopen (een boom, een rots, de
// eigen boomgaard), daar een tijdje werken, de last naar de burcht dragen
// en opnieuw beginnen.
//
// Een werker is een boer. Boeren zonder werk lopen rond bij de burcht.
// Is er geen boer vrij, dan wacht een nieuw werkgebouw tot er een komt.
//
// Om de zoveel tijd is er een ronde: alle boeren eten, je int belasting
// (dat levert goud op) en de populariteit verandert. Is die hoog genoeg
// en is er woonruimte en voedsel, dan komen er boeren bij. Is hij te
// laag, dan vertrekken ze.
//
// De getallen staan in data/economie.json.

import { CONFIG } from './config.js';
import { OBJECT } from './kaart.js';
import { SOORT } from './eenheden.js';
import { maakToeval } from './toeval.js';

const TEAM = 0;   // de speler

export async function laadEconomie() {
  const antwoord = await fetch('data/economie.json');
  if (!antwoord.ok) throw new Error('Kan data/economie.json niet laden');
  const regels = await antwoord.json();
  for (const [sleutel, beroep] of Object.entries(regels.beroepen)) {
    if (OBJECT[beroep.bij] === undefined) throw new Error(`economie.json: onbekend object "${beroep.bij}" bij ${sleutel}`);
    if (SOORT[beroep.soort] === undefined) throw new Error(`economie.json: onbekende soort "${beroep.soort}" bij ${sleutel}`);
    if (!regels.grondstoffen[beroep.haalt]) throw new Error(`economie.json: onbekende grondstof "${beroep.haalt}" bij ${sleutel}`);
    beroep.sleutel = sleutel;
    beroep.bron = OBJECT[beroep.bij];
  }
  return regels;
}

// opKaart(vakken): de kaart is veranderd (er is een boom om).
// opVoorraad(): de voorraad is veranderd. opVerandering(): tijd om te bewaren.
// opMelding(tekst): iets dat de speler moet weten.
export function maakEconomie({ regels, kaart, wegvinder, eenheden, opKaart, opVoorraad, opVerandering, opMelding }) {
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const stappenPerSeconde = CONFIG.spel.stappenPerSeconde;

  // --- Voorraad en kosten ---------------------------------------------------------
  const voorraad = {};
  const beginVoorraad = () => {
    for (const [naam, def] of Object.entries(regels.grondstoffen)) voorraad[naam] = def.begin;
  };
  beginVoorraad();

  const soorten = (kosten) => Object.entries(kosten || {});

  // "14 steen", of "4 steen en 4 hout".
  function kostTekst(kosten, keer = 1) {
    return soorten(kosten).map(([naam, aantal]) => `${aantal * keer} ${naam}`).join(' en ');
  }

  // Lege tekst als je het kunt betalen, anders wat je tekortkomt.
  function tekort(kosten, keer = 1) {
    for (const [naam, aantal] of soorten(kosten)) {
      if (voorraad[naam] < aantal * keer) return `te weinig ${naam} (dit kost ${aantal * keer}, je hebt ${voorraad[naam]})`;
    }
    return '';
  }

  // Bij welke grondstof het misgaat, of '' als je het kunt betalen.
  function tekortAan(kosten, keer = 1) {
    for (const [naam, aantal] of soorten(kosten)) {
      if (voorraad[naam] < aantal * keer) return naam;
    }
    return '';
  }

  function betaal(kosten, keer = 1) {
    if (tekort(kosten, keer)) return false;
    for (const [naam, aantal] of soorten(kosten)) voorraad[naam] -= aantal * keer;
    opVoorraad();
    return true;
  }

  // Slopen geeft een deel van de bouwkosten terug.
  function geefTerug(kosten) {
    for (const [naam, aantal] of soorten(kosten)) voorraad[naam] += Math.floor(aantal * regels.sloopTerug);
    opVoorraad();
  }

  // --- Zoeken op de kaart -----------------------------------------------------------
  // Loopt vanaf een vak steeds verder de kaart op (alleen waar de speler
  // kan lopen) en geeft het eerste terug waar test(vak) iets oplevert.
  const rij = new Int32Array(B * H);
  const gezien = new Uint32Array(B * H);
  const ver = new Uint16Array(B * H);
  let ronde = 0;
  const RX = [1, 0, -1, 0];
  const RY = [0, 1, 0, -1];

  function zoekDichtbij(start, test, bereik) {
    if (start < 0 || !wegvinder.isVrij(start % B, Math.floor(start / B), TEAM)) return null;
    ronde++;
    let kop = 0;
    let staart = 0;
    rij[staart++] = start;
    gezien[start] = ronde;
    ver[start] = 0;
    while (kop < staart) {
      const vak = rij[kop++];
      const gevonden = test(vak);
      if (gevonden) return gevonden;
      if (ver[vak] >= bereik) continue;
      const x = vak % B;
      const y = (vak - x) / B;
      for (let r = 0; r < 4; r++) {
        const nx = x + RX[r];
        const ny = y + RY[r];
        if (!wegvinder.isVrij(nx, ny, TEAM)) continue;
        const buur = ny * B + nx;
        if (gezien[buur] === ronde) continue;
        gezien[buur] = ronde;
        ver[buur] = ver[vak] + 1;
        rij[staart++] = buur;
      }
    }
    return null;
  }

  const bezet = new Set();   // bronnen waar al een werker mee bezig is

  // Staat er naast dit vak een bron van deze soort die nog vrij is?
  const bijBron = (soort) => (vak) => {
    const x = vak % B;
    const y = (vak - x) / B;
    for (let r = 0; r < 4; r++) {
      const nx = x + RX[r];
      const ny = y + RY[r];
      if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
      const buur = ny * B + nx;
      if (kaart.object[buur] === soort && !bezet.has(buur)) return { sta: vak, bron: buur };
    }
    return null;
  };

  // De tegels rond de burcht van de speler: daar lever je af.
  const afleverplek = new Uint8Array(B * H);
  const isBurcht = (soort) => soort === OBJECT.BURCHT || soort === OBJECT.BANIER_BLAUW;
  {
    const s = kaart.start[TEAM];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = s.x + dx;
        const y = s.y + dy;
        if (!isBurcht(kaart.object[y * B + x])) continue;
        for (let r = 0; r < 4; r++) {
          const buur = (y + RY[r]) * B + x + RX[r];
          if (!isBurcht(kaart.object[buur])) afleverplek[buur] = 1;
        }
      }
    }
  }
  const bijBurcht = (vak) => (afleverplek[vak] ? { sta: vak } : null);

  // --- Opslag: de burcht en je voorraadkamers --------------------------------------
  // Werkers brengen hun last naar de dichtstbijzijnde plek: de burcht of een
  // voorraadkamer. De voorraad zelf is één totaal, met een grens per soort:
  // de burcht plus alle kamers. De grens geldt voor de grondstoffen in
  // regels.opslag.grondstoffen (goud niet).
  const opslagRegels = regels.opslag || { grondstoffen: [], burcht: 0, voorraadkamer: 0 };
  const afleverBurcht = afleverplek.slice();
  let kamers = 0;
  function herzieOpslag() {
    afleverplek.set(afleverBurcht);
    kamers = 0;
    for (let vak = 0; vak < B * H; vak++) {
      if (kaart.object[vak] !== OBJECT.VOORRAADKAMER || kaart.eigenaar[vak] !== TEAM + 1) continue;
      kamers++;
      const x = vak % B;
      const y = (vak - x) / B;
      for (let r = 0; r < 4; r++) {
        const nx = x + RX[r];
        const ny = y + RY[r];
        if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
        if (kaart.object[ny * B + nx] !== OBJECT.VOORRAADKAMER) afleverplek[ny * B + nx] = 1;
      }
    }
  }
  const heeftGrens = (naam) => opslagRegels.grondstoffen.includes(naam);
  const opslagMax = (naam) => (heeftGrens(naam) ? opslagRegels.burcht + kamers * opslagRegels.voorraadkamer : Infinity);
  herzieOpslag();

  // --- Werkers --------------------------------------------------------------------
  const werkplaatsen = new Map();   // vak van het werkgebouw -> de werker die erbij hoort
  const wachtend = [];              // werkgebouwen zonder werker: { vak, beroepNaam }
  const gekapt = [];                // vakken waar een boom is omgehakt

  // --- Bevolking ------------------------------------------------------------------
  const volkRegels = regels.bevolking;
  const stappen = (seconden) => Math.max(1, Math.round(seconden * stappenPerSeconde));
  let volk = volkRegels.begin;      // al je boeren, ook wie aan het werk is
  let woonruimte = 0;               // plek die woningen erbij geven
  let totBoer = stappen(volkRegels.komtElke);
  let totMaal = stappen(volkRegels.maaltijdElke);
  let honger = false;
  let klokLoopt = true;             // de test kan de klok van de bevolking stilzetten

  const ruimte = () => volkRegels.plekBurcht + woonruimte;
  const vrij = () => volk - werkplaatsen.size;

  // Populariteit en belasting.
  const stem = volkRegels.stemming;
  const tarieven = volkRegels.belasting;
  let populariteit = stem.begin;
  let belasting = volkRegels.beginBelasting;   // welke stand uit de lijst tarieven

  // Boeren zonder werk, als figuur op de kaart.
  const lopers = [];
  const gok = maakToeval(7719);
  const PLEIN = 5;                  // zo ver van de burcht lopen ze rond
  const vakVan = (e) => Math.floor(e.y) * B + Math.floor(e.x);
  const isVrijVak = (vak) => vak >= 0 && wegvinder.isVrij(vak % B, Math.floor(vak / B), TEAM);

  // Het vak voor de deur van een werkgebouw, of -1 als het is ingebouwd.
  function thuisVan(werkVak) {
    const x = werkVak % B;
    const y = (werkVak - x) / B;
    for (let r = 0; r < 4; r++) {
      if (wegvinder.isVrij(x + RX[r], y + RY[r], TEAM)) return (y + RY[r]) * B + x + RX[r];
    }
    return -1;
  }

  const zetOp = (e, vak) => {
    e.x = e.vorigeX = (vak % B) + 0.5;
    e.y = e.vorigeY = Math.floor(vak / B) + 0.5;
  };

  // Een vrije boer gaat bij dit werkgebouw aan de slag. Komt hij net in
  // dienst (vanBurcht), dan vertrekt hij bij de burcht; anders staat hij
  // al voor de deur.
  function zetAanHetWerk(werkVak, beroep, vanBurcht) {
    const thuis = thuisVan(werkVak);
    let begin = thuis >= 0 ? thuis : werkVak;
    if (vanBurcht && thuis >= 0) {
      // De boer die het dichtst bij rondloopt neemt de baan en vertrekt
      // waar hij staat. Loopt er niemand, dan vertrekt hij bij de burcht.
      const loper = neemLoper(werkVak);
      const bij = loper >= 0 ? null : zoekDichtbij(thuis, bijBurcht, B * H);
      if (loper >= 0) begin = loper;
      else if (bij) begin = bij.sta;
    }
    const e = eenheden.maakWerker(begin, TEAM, SOORT[beroep.soort], beroep.snelheid);
    e.werk = { beroep, plaats: werkVak, staat: 'zoek', bron: -1, sta: -1, tel: 0, last: 0, wacht: 0, klem: '' };
    werkplaatsen.set(werkVak, e);
    werkLopersBij();
  }

  // --- Boeren zonder werk ---------------------------------------------------------
  // Een vak bij de burcht waar een boer kan staan.
  const pleinVakken = [];
  for (let vak = 0; vak < B * H; vak++) if (afleverplek[vak]) pleinVakken.push(vak);
  function pleinVak() {
    const begin = Math.floor(gok() * pleinVakken.length);
    for (let k = 0; k < pleinVakken.length; k++) {
      const vak = pleinVakken[(begin + k) % pleinVakken.length];
      if (isVrijVak(vak)) return vak;
    }
    const s = kaart.start[TEAM];
    return vrijBij(s.y * B + s.x, 8);
  }

  // Het dichtstbijzijnde vrije vak rond een vak, of -1.
  function vrijBij(vak, ver = 3) {
    const x = vak % B;
    const y = Math.floor(vak / B);
    for (let r = 1; r <= ver; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (wegvinder.isVrij(x + dx, y + dy, TEAM)) return (y + dy) * B + x + dx;
        }
      }
    }
    return -1;
  }

  function nieuweLoper(vak) {
    const e = eenheden.maakWerker(vak >= 0 ? vak : kaart.start[TEAM].y * B + kaart.start[TEAM].x, TEAM, SOORT.BOER, volkRegels.loperSnelheid);
    e.wijkt = true;
    e.loper = { wacht: stappen(0.5 + gok() * 4) };
    lopers.push(e);
    return e;
  }

  // Zorgt dat er precies zoveel boeren rondlopen als er zonder werk zijn.
  function werkLopersBij() {
    const nodig = Math.max(0, vrij());
    while (lopers.length > nodig) eenheden.verwijder(lopers.pop());
    while (lopers.length < nodig) nieuweLoper(pleinVak());
  }

  // Haalt de boer die het dichtst bij een werkgebouw rondloopt van de
  // kaart en geeft terug waar hij stond (of -1 als er niemand loopt).
  function neemLoper(werkVak) {
    const wx = werkVak % B;
    const wy = Math.floor(werkVak / B);
    let beste = -1;
    let afstand = Infinity;
    for (let i = 0; i < lopers.length; i++) {
      const d = Math.hypot(lopers[i].x - wx, lopers[i].y - wy);
      if (d < afstand && isVrijVak(vakVan(lopers[i]))) {
        afstand = d;
        beste = i;
      }
    }
    if (beste < 0) return -1;
    const [e] = lopers.splice(beste, 1);
    eenheden.verwijder(e);
    return vakVan(e);
  }

  // Een boer zonder werk slentert: een stukje lopen, even staan, weer lopen.
  function slenter(e) {
    if (e.pad) return;
    const hier = vakVan(e);
    if (!isVrijVak(hier)) {
      // Er is gebouwd waar hij stond: hij stapt opzij.
      const opzij = vrijBij(hier);
      if (opzij >= 0) zetOp(e, opzij);
      return;
    }
    if (e.loper.wacht > 0) {
      e.loper.wacht--;
      return;
    }
    e.loper.wacht = stappen(2 + gok() * 5);
    const s = kaart.start[TEAM];
    const x = s.x + Math.round((gok() * 2 - 1) * PLEIN);
    const y = s.y + Math.round((gok() * 2 - 1) * PLEIN);
    if (wegvinder.isVrij(x, y, TEAM)) loopNaar(e, hier, y * B + x);
  }

  // Een werkgebouw is neergezet: er komt een werker bij met dit beroep,
  // als er een boer vrij is. Anders wacht het gebouw. nieuw = het is net
  // gebouwd (en niet teruggezet uit de opslag).
  function nieuweWerkplaats(werkVak, beroepNaam, nieuw = false) {
    const beroep = regels.beroepen[beroepNaam];
    if (!beroep || werkplaatsen.has(werkVak) || wachtend.some((w) => w.vak === werkVak)) return;
    if (vrij() > 0) {
      zetAanHetWerk(werkVak, beroep, nieuw);
      return;
    }
    wachtend.push({ vak: werkVak, beroepNaam });
    if (!nieuw) return;
    let raad = 'Er komt vanzelf een nieuwe boer.';
    if (volk >= ruimte()) raad = 'Zet een woning neer, dan komen er meer.';
    else if (voorraad[volkRegels.eet] <= 0) raad = 'Zonder voedsel komt er niemand bij.';
    opMelding(`Er is geen boer vrij voor de ${beroep.naam}. ${raad}`);
  }

  // Vrije boeren gaan naar de werkgebouwen die het langst wachten.
  function deelIn() {
    while (vrij() > 0 && wachtend.length) {
      const { vak, beroepNaam } = wachtend.shift();
      zetAanHetWerk(vak, regels.beroepen[beroepNaam], true);
    }
  }

  function laatBronLos(w) {
    if (w.bron >= 0) bezet.delete(w.bron);
    w.bron = -1;
  }

  // Het werkgebouw is weg. Zijn werker is weer een vrije boer en gaat,
  // als er een gebouw wacht, daar aan de slag.
  function werkplaatsWeg(werkVak) {
    const plek = wachtend.findIndex((w) => w.vak === werkVak);
    if (plek >= 0) wachtend.splice(plek, 1);
    const e = werkplaatsen.get(werkVak);
    if (!e) return;
    laatBronLos(e.werk);
    // Liep hij met grondstof uit de voorraad, dan komt die terug.
    if (e.werk.genomen) for (const [naam, n] of Object.entries(e.werk.beroep.neemt || {})) voorraad[naam] += n;
    eenheden.verwijder(e);
    werkplaatsen.delete(werkVak);
    // Hij is weer een boer zonder werk, op de plek waar hij stond.
    if (vrij() > lopers.length && isVrijVak(vakVan(e))) nieuweLoper(vakVan(e));
    deelIn();
    werkLopersBij();
  }

  // Het lukt even niet. Eén keer melden, en na een korte pauze opnieuw proberen.
  function klem(e, tekst, raad = '', pauze = 1.5) {
    const w = e.werk;
    if (w.klem !== tekst) {
      w.klem = tekst;
      opMelding(`Een ${w.beroep.naam} ${tekst}.${raad ? ` ${raad}` : ''}`);
    }
    w.wacht = Math.round(pauze * stappenPerSeconde);
  }

  function loopNaar(e, van, naar) {
    const pad = wegvinder.zoekPad(van % B, Math.floor(van / B), naar % B, Math.floor(naar / B), TEAM);
    if (!pad) return false;
    e.pad = pad;
    e.stap = 0;
    return true;
  }

  // Terug naar het begin: een nieuwe bron zoeken. Wat hij draagt houdt hij.
  function opnieuw(e) {
    const w = e.werk;
    laatBronLos(w);
    e.pad = null;
    e.houding = w.last ? 'last' : null;
    w.staat = w.last ? 'breng' : 'zoek';
  }

  function verwerk(e, hier) {
    const w = e.werk;
    const beroep = w.beroep;
    const thuis = thuisVan(w.plaats);
    if (w.staat === 'zoek') {
      if (!wegvinder.isVrij(hier % B, Math.floor(hier / B), TEAM)) {
        if (thuis < 0) return klem(e, 'is ingebouwd');
        zetOp(e, thuis);
        hier = thuis;
      }
      // Eerst kijken of er genoeg is: anders hoeft hij niet te lopen.
      for (const [naam, n] of Object.entries(beroep.neemt)) if (voorraad[naam] < n) return klem(e, beroep.mist, beroep.raad, 3);
      if (afleverplek[hier]) w.staat = 'haal';
      else {
        const doel = zoekDichtbij(hier, bijBurcht, B * H);
        if (!doel || !loopNaar(e, hier, doel.sta)) return klem(e, 'kan niet bij de voorraad', 'Zet een poort in je muur of bouw een voorraadkamer dichterbij.');
        w.klem = '';
        w.staat = 'haal';
        return;
      }
    }
    if (w.staat === 'haal') {
      if (e.pad) return;
      if (!afleverplek[hier]) { w.staat = 'zoek'; return; }
      for (const [naam, n] of Object.entries(beroep.neemt)) if (voorraad[naam] < n) return klem(e, beroep.mist, beroep.raad, 3);
      for (const [naam, n] of Object.entries(beroep.neemt)) voorraad[naam] -= n;
      opVoorraad();
      opVerandering();
      w.klem = '';
      w.genomen = true;
      e.houding = 'last';
      e.snelheid = beroep.snelheidMetLast;
      if (thuis < 0 || !loopNaar(e, hier, thuis)) {
        // Kan hij niet terug, dan legt hij het weer neer.
        for (const [naam, n] of Object.entries(beroep.neemt)) voorraad[naam] += n;
        w.genomen = false;
        e.houding = null;
        e.snelheid = beroep.snelheid;
        return klem(e, `kan niet terug naar ${beroep.plek}`, '', 3);
      }
      w.staat = 'terug';
      return;
    }
    // terug
    if (e.pad) return;
    if (hier !== thuis) {
      if (thuis < 0 || !loopNaar(e, hier, thuis)) return klem(e, `kan niet terug naar ${beroep.plek}`, '', 3);
      return;
    }
    w.staat = 'werk';
    w.genomen = false;
    w.tel = Math.round(beroep.werkTijd * stappenPerSeconde);
    e.houding = 'hak';
    e.snelheid = beroep.snelheid;
    const dx = (w.plaats % B) - (hier % B);
    const dy = Math.floor(w.plaats / B) - Math.floor(hier / B);
    e.kijkt = dx - dy >= 0 ? 1 : -1;
  }

  // Eén stap voor één werker.
  function werk(e) {
    const w = e.werk;
    const beroep = w.beroep;
    if (w.wacht > 0) {
      w.wacht--;
      return;
    }
    let hier = Math.floor(e.y) * B + Math.floor(e.x);

    // Een verwerker (de zager): haalt grondstof uit de voorraad, verwerkt
    // die in zijn werkplaats en brengt het product terug.
    if (beroep.neemt && (w.staat === 'zoek' || w.staat === 'haal' || w.staat === 'terug')) return verwerk(e, hier);

    if (w.staat === 'zoek') {
      const thuis = thuisVan(w.plaats);
      if (!wegvinder.isVrij(hier % B, Math.floor(hier / B), TEAM)) {
        // Hij staat nog in het gebouw omdat het was ingebouwd.
        if (thuis < 0) return klem(e, 'is ingebouwd');
        zetOp(e, thuis);
        hier = thuis;
      }
      // Hij zoekt vanaf zijn werkplaats, zodat hij in de buurt blijft werken.
      const doel = zoekDichtbij(thuis >= 0 ? thuis : hier, bijBron(beroep.bron), beroep.bereik);
      if (!doel) return klem(e, beroep.mist, beroep.raad, 3);
      if (!loopNaar(e, hier, doel.sta)) return klem(e, `kan niet bij ${beroep.plek}`);
      w.klem = '';
      w.bron = doel.bron;
      w.sta = doel.sta;
      bezet.add(doel.bron);
      w.staat = 'heen';
      return;
    }

    if (w.staat === 'heen') {
      if (kaart.object[w.bron] !== beroep.bron) return opnieuw(e);
      if (e.pad) return;                     // nog onderweg
      if (hier !== w.sta) return opnieuw(e); // de route is afgesneden: er is gebouwd
      w.staat = 'werk';
      w.tel = Math.round(beroep.werkTijd * stappenPerSeconde);
      e.houding = 'hak';
      const dx = (w.bron % B) - (hier % B);
      const dy = Math.floor(w.bron / B) - Math.floor(hier / B);
      e.kijkt = dx - dy >= 0 ? 1 : -1;
      return;
    }

    if (w.staat === 'werk') {
      if (!beroep.neemt && kaart.object[w.bron] !== beroep.bron) return opnieuw(e);
      if (--w.tel > 0) return;
      const bron = w.bron;
      laatBronLos(w);
      w.last = beroep.last;
      w.staat = 'breng';
      e.houding = 'last';
      e.snelheid = beroep.snelheidMetLast;
      if (beroep.ruimtOp) {
        // Een boom is na het hakken weg. Een rots raakt niet op.
        kaart.object[bron] = OBJECT.GEEN;
        gekapt.push(bron);
        opKaart(new Set([bron]));
        opVerandering();
      }
      return;
    }

    if (w.staat === 'breng') {
      if (e.pad) return;                     // nog onderweg
      if (afleverplek[hier]) {
        const ruimte = Math.max(0, opslagMax(beroep.haalt) - voorraad[beroep.haalt]);
        if (ruimte <= 0) return klem(e, `kan zijn ${regels.grondstoffen[beroep.haalt].naam.toLowerCase()} niet kwijt: de opslag is vol`, 'Bouw een voorraadkamer of gebruik wat je hebt.', 3);
        const brengt = Math.min(w.last, ruimte);
        voorraad[beroep.haalt] += brengt;
        w.last -= brengt;
        if (w.last > 0) return klem(e, 'kan een deel van zijn last niet kwijt: de opslag is vol', 'Bouw een voorraadkamer.', 3);
        w.klem = '';
        w.staat = 'zoek';
        e.houding = null;
        e.snelheid = beroep.snelheid;
        opVoorraad();
        opVerandering();
        return;
      }
      const doel = zoekDichtbij(hier, bijBurcht, B * H);
      if (!doel || !loopNaar(e, hier, doel.sta)) return klem(e, 'kan niet bij de burcht', 'Zet een poort in je muur.');
      w.klem = '';
    }
  }

  // Er komt een boer bij, als er plek en voedsel is en je populair genoeg
  // bent. Hij komt aan bij de burcht.
  function nieuweBoer() {
    if (volk >= ruimte() || voorraad[volkRegels.eet] <= 0 || populariteit < stem.grens) return;
    volk++;
    nieuweLoper(pleinVak());
    deelIn();
    werkLopersBij();
    opVoorraad();
    opVerandering();
  }

  // Er vertrekt een boer. Eerst wie zonder werk rondloopt; is die er
  // niet, dan laat een werker zijn werk in de steek en wacht dat gebouw.
  function vertrekBoer() {
    if (volk <= 0) return;
    volk--;
    if (lopers.length) {
      eenheden.verwijder(lopers.pop());
    } else if (werkplaatsen.size) {
      const [werkVak, e] = [...werkplaatsen.entries()].pop();
      laatBronLos(e.werk);
      eenheden.verwijder(e);
      werkplaatsen.delete(werkVak);
      wachtend.push({ vak: werkVak, beroepNaam: e.werk.beroep.sleutel });
    }
    opVoorraad();
    opVerandering();
  }

  // Wat de populariteit de volgende ronde doet, per oorzaak.
  function stemFactoren() {
    const genoeg = voorraad[volkRegels.eet] >= volk * volkRegels.eetPerPersoon;
    return [
      { naam: 'eten', waarde: genoeg ? stem.eten : stem.honger },
      { naam: 'belasting', waarde: tarieven[belasting].effect },
      { naam: 'wonen', waarde: volk > ruimte() ? stem.krap : 0 },
    ];
  }

  // Eén ronde: alle boeren eten, je int belasting en de populariteit
  // verandert. Is er te weinig voedsel, dan is alles op en komt er niemand
  // meer bij tot er weer voedsel is.
  function maaltijd() {
    const factoren = stemFactoren();   // hoe het er nu voor staat, vóór het eten
    const nodig = volk * volkRegels.eetPerPersoon;
    if (voorraad[volkRegels.eet] >= nodig) {
      voorraad[volkRegels.eet] -= nodig;
      honger = false;
    } else {
      voorraad[volkRegels.eet] = 0;
      if (!honger) {
        const heeftBron = [...werkplaatsen.values()].some((e) => e.werk.beroep.haalt === volkRegels.eet);
        opMelding(`Het voedsel is op. Er komen geen boeren meer bij.${heeftBron ? '' : ` ${volkRegels.raadHonger}`}`);
      }
      honger = true;
    }
    voorraad[volkRegels.munt] += volk * tarieven[belasting].goud;
    const was = populariteit;
    populariteit = Math.max(0, Math.min(100, populariteit + factoren.reduce((som, f) => som + f.waarde, 0)));
    if (was >= stem.grens && populariteit < stem.grens) {
      opMelding('Je boeren zijn ontevreden en gaan vertrekken. Tik bovenin op je voorraad om te zien waarom.');
    }
    opVoorraad();
    opVerandering();
  }

  // De klok van de bevolking: één rekenstap verder.
  function volkStap() {
    if (--totBoer <= 0) {
      totBoer = stappen(volkRegels.komtElke);
      if (populariteit < stem.grens) vertrekBoer();
      else nieuweBoer();
    }
    if (--totMaal <= 0) {
      totMaal = stappen(volkRegels.maaltijdElke);
      maaltijd();
    }
  }

  let opslagTeller = 0;
  function stap() {
    if (++opslagTeller >= stappenPerSeconde) {
      opslagTeller = 0;
      const was = kamers;
      herzieOpslag();
      if (kamers !== was) opVoorraad();   // de grens is veranderd: de voorraad in beeld bijwerken
    }
    for (const e of werkplaatsen.values()) werk(e);
    for (let i = 0; i < lopers.length; i++) slenter(lopers[i]);
    if (klokLoopt) volkStap();
  }

  // Wat de werker van dit gebouw aan het doen is, voor in beeld.
  function beschrijf(werkVak) {
    if (wachtend.some((w) => w.vak === werkVak)) return 'wacht op een vrije boer';
    const e = werkplaatsen.get(werkVak);
    if (!e) return '';
    const w = e.werk;
    const bezig = {
      zoek: 'zoekt werk',
      heen: `loopt naar ${w.beroep.plek}`,
      haal: `haalt ${Object.keys(w.beroep.neemt || {}).join(' en ')} uit de voorraad`,
      terug: `brengt ${Object.keys(w.beroep.neemt || {}).join(' en ')} naar ${w.beroep.plek}`,
      werk: w.beroep.bezig,
      breng: `brengt ${w.beroep.haalt} naar de voorraad`,
    };
    return `de ${w.beroep.naam} ${w.klem || bezig[w.staat]}`;
  }

  // --- Bewaren en terugzetten -------------------------------------------------------
  function bewaarStand() {
    return { voorraad: { ...voorraad }, gekapt: gekapt.slice(), volk, populariteit, belasting };
  }

  // Zet een bewaarde stand terug. Alleen wat klopt wordt overgenomen.
  // Geeft de vakken terug waar een boom is weggehaald.
  function zetStand(stand) {
    const vakken = new Set();
    if (!stand || typeof stand !== 'object') return vakken;
    if (stand.voorraad && typeof stand.voorraad === 'object') {
      for (const naam of Object.keys(voorraad)) {
        const aantal = stand.voorraad[naam];
        if (Number.isInteger(aantal) && aantal >= 0) voorraad[naam] = aantal;
      }
    }
    if (Number.isInteger(stand.volk) && stand.volk >= 0 && stand.volk <= 500) volk = stand.volk;
    if (Number.isInteger(stand.populariteit) && stand.populariteit >= 0 && stand.populariteit <= 100) populariteit = stand.populariteit;
    if (Number.isInteger(stand.belasting) && tarieven[stand.belasting]) belasting = stand.belasting;
    werkLopersBij();
    if (Array.isArray(stand.gekapt)) {
      for (const vak of stand.gekapt) {
        if (!Number.isInteger(vak) || vak < 0 || vak >= B * H) continue;
        if (kaart.object[vak] !== OBJECT.BOOM) continue;
        kaart.object[vak] = OBJECT.GEEN;
        gekapt.push(vak);
        vakken.add(vak);
      }
    }
    opVoorraad();
    return vakken;
  }

  // Terug naar het begin: werkers weg, de bomen terug, de beginvoorraad
  // en het aantal boeren van de start. Geeft de vakken terug waar weer een
  // boom staat.
  function herstel() {
    wachtend.length = 0;
    for (const werkVak of [...werkplaatsen.keys()]) werkplaatsWeg(werkVak);
    bezet.clear();
    volk = volkRegels.begin;
    woonruimte = 0;
    honger = false;
    populariteit = stem.begin;
    belasting = volkRegels.beginBelasting;
    while (lopers.length) eenheden.verwijder(lopers.pop());
    totBoer = stappen(volkRegels.komtElke);
    totMaal = stappen(volkRegels.maaltijdElke);
    const vakken = new Set();
    for (const vak of gekapt) {
      if (kaart.object[vak] !== OBJECT.GEEN) continue;
      kaart.object[vak] = OBJECT.BOOM;
      vakken.add(vak);
    }
    gekapt.length = 0;
    beginVoorraad();
    werkLopersBij();
    opVoorraad();
    return vakken;
  }

  // De boeren van het begin lopen meteen rond.
  werkLopersBij();

  return {
    voorraad, opslagMax, opslagKamers: () => kamers, herzieOpslag, kostTekst, tekort, tekortAan, betaal, geefTerug,
    nieuweWerkplaats, werkplaatsWeg, stap, beschrijf,
    bewaarStand, zetStand, herstel,
    // Woonruimte erbij (een woning gebouwd) of eraf (gesloopt).
    plekErbij(aantal) {
      woonruimte = Math.max(0, woonruimte + aantal);
      opVoorraad();
    },
    bevolking: () => ({ volk, ruimte: ruimte(), vrij: vrij(), wachtend: wachtend.length }),
    // Voor het testen: het aantal boeren zetten, de klok van de bevolking
    // stilzetten (hij begint dan opnieuw te tellen), en hem een aantal
    // seconden vooruit spoelen.
    zetVolk(aantal) {
      volk = aantal;
      deelIn();
      werkLopersBij();
      opVoorraad();
    },
    // Hoe het met de populariteit staat, voor het paneel over je volk.
    stemming() {
      const factoren = stemFactoren();
      return {
        populariteit, grens: stem.grens, belasting, tarieven, factoren,
        totaal: factoren.reduce((som, f) => som + f.waarde, 0),
        ronde: volkRegels.maaltijdElke, lopers: lopers.length, munt: volkRegels.munt,
      };
    },
    zetBelasting(stand) {
      if (!tarieven[stand]) return;
      belasting = stand;
      opVoorraad();
      opVerandering();
    },
    // Voor het testen: populariteit (en de stand van de belasting) zetten.
    zetStemming(waarde, stand) {
      populariteit = waarde;
      if (stand !== undefined) belasting = stand;
      opVoorraad();
    },
    // Een boer zonder werk verlaat het dorp, bijvoorbeeld om soldaat te
    // worden. Geeft false als er niemand zonder werk is.
    boerWeg() {
      if (vrij() <= 0) return false;
      volk--;
      werkLopersBij();
      opVoorraad();
      return true;
    },
    aantalLopers: () => lopers.length,
    lopers: () => lopers.slice(),
    pauzeerVolk(stil) {
      klokLoopt = !stil;
      totBoer = stappen(volkRegels.komtElke);
      totMaal = stappen(volkRegels.maaltijdElke);
      honger = false;
    },
    spoelVolk(seconden) {
      for (let i = stappen(seconden); i > 0; i--) volkStap();
    },
    aantalWerkers: () => werkplaatsen.size,
    aantalMetBeroep: (beroepNaam) => [...werkplaatsen.values()].filter((e) => e.werk.beroep.sleutel === beroepNaam).length,
    aantalGekapt: () => gekapt.length,
    werkers: () => [...werkplaatsen.values()],
  };
}
