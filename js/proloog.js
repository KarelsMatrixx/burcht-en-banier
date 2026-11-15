// PROLOOG: de laatste vredige dag (campagne-verhaal.md, stap 35 van het campagneplan).
//
// Wessel wordt negen. Bartholt leert je bouwen met een korte lijst taken.
// Heer Reinout is te gast en staat bij de burcht. Als de lijst af is (de speler bepaalt het tempo met de knop op het kaartje) wordt het avond, Reinout is weg, en 's nachts gaat je poort
// van binnenuit open: een overmacht onder de Rouwbanier valt binnen. Je
// koning sneuvelt niet en de burcht valt niet helemaal (strijd.js, R.proloog).
// Na vier minuten nacht, of als je burcht onder 40% komt, volgt de scène:
// een ruiter draagt Wessel weg. Daarna de levelkaart.
//
// Fasen: 'bouw' (taak 0 tot en met 7), 'avond', 'nacht', 'scene'.
// De stand staat in localStorage, zodat herladen verder gaat waar je was.

const SLEUTEL = 'burcht-banier.proloog';

// De taken. telt: hoeveel van dit bouwwerk er bij moeten komen.
const TAKEN = [
  { taak: "Build a Woodcutter's Hut", bouw: { houthakker: 1 }, gids: { soort: 'bouw', sleutel: 'houthakker', plekTekst: 'Woodcutter here' }, anker: [-21, 4],
    tekst: "Happy birthday to Wessel, Sire! While the cooks work, let us put the land to work. First lesson: wood. A woodcutter's hut sends one peasant to chop the trees nearby. Every building starts with wood. I will show you each button and the spot on the map." },
  { taak: 'Build a Stone Mine', bouw: { steengroeve: 1 }, gids: { soort: 'bouw', sleutel: 'steengroeve', plekTekst: 'Stone mine here' }, anker: [-21, -5],
    tekst: 'Wood we have, now stone. A stone mine must stand right against the grey rocks. Its worker brings stone for barracks and walls.' },
  { taak: 'Build an Orchard', bouw: { boomgaard: 1 }, gids: { soort: 'bouw', sleutel: 'boomgaard', plekTekst: 'Orchard here' }, anker: [-22, 2],
    tekst: 'A feast needs food. Your peasants eat every half minute. When the food runs out they grow unhappy and leave. An orchard grows apples, on open grass.' },
  { taak: 'Build a House', bouw: { woning: 1 }, gids: { soort: 'bouw', sleutel: 'woning', plekTekst: 'House here' }, anker: [-19, -3],
    tekst: 'Peasants live in houses. A house gives room for four more, and a new peasant arrives every so often as long as there is room, food and a happy people.' },
  { taak: 'Build a Storehouse', bouw: { voorraadkamer: 1 }, gids: { soort: 'bouw', sleutel: 'voorraadkamer', plekTekst: 'Storehouse here' }, anker: [-21, -2],
    tekst: 'Wood, stone and food must be kept somewhere. Your workers carry what they gather to the storehouse, and each one holds 150 of each. Later, tap it to sell what you do not need for gold.' },
  { taak: 'See your people', volk: true, gids: { soort: 'volk' },
    tekst: 'Look at the top bar, Sire: Peasants 4/6 means four peasants and room for six. Each building needs a peasant to work in it, and so does every soldier you train. A peasant without work is a spare hand. Let me show you the panel.',
    lof: 'Peasants without work are your reserve. If food runs out or taxes are too high, popularity falls, and below 50 your people leave.' },
  { taak: 'Set the taxes', belasting: true, gids: { soort: 'belasting' },
    tekst: 'Taxes, Sire. Every half minute each peasant pays gold. Higher taxes bring more gold but make your people unhappier; lower taxes make them happier. Try a different level.',
    lof: 'Low is the safe level. Choose High only for a short while, when you need gold fast.' },
  { taak: 'Build Barracks', bouw: { kazerne: 1 }, gids: { soort: 'bouw', sleutel: 'kazerne', plekTekst: 'Barracks here' }, anker: [-19, 3],
    tekst: 'A king needs soldiers, even on a feast day. Barracks train soldiers from your peasants and your gold. Wood and stone were for this.' },
  { taak: 'Train two soldiers', soldaten: 2, gids: { soort: 'opleiden', plekTekst: 'Barracks' }, kazernePlek: true, tekst: 'Now train two soldiers. Each costs gold and one idle peasant. Knights hold the line, archers shoot from behind it.' },
  { taak: 'Send a soldier somewhere', sturen: true, gids: { soort: 'sturen', plekTekst: 'Send him here' }, doelPlek: [4, 3], tekst: 'Now give an order on the ground. First tap your new soldier to choose him. The spot lies behind a wall, so then tap the eye in the top right corner: walls and buildings turn see-through. Then show him where to go.' },
  { taak: 'Put a soldier on the wall', opMuur: true, gids: { soort: 'muur', plekTekst: 'Wall here' }, doelPlek: [-5, -2], tekst: "Last lesson, Sire. Ottger's messengers at the border are restless. Put a soldier on the wall to keep watch." },
];

const LOF = ['Well done, Sire.', 'Good work.', 'Splendid. The people see their king at work.', 'That will do nicely.', 'Very good.'];
const VRIJ = 20;               // seconden vrij spelen bij daglicht na de laatste dagles
const AVOND = 20;              // daarna seconden schemering voor de nacht
const NACHT_DUUR = 240;        // vier minuten nacht, dan de scène
const OVERMACHT = 100;         // zoveel vijanden komen er: je hebt geen kans (naar Karel)
const OPMARS_TEMPO = 0.55;     // zo langzaam lopen ze aan (deel van hun gewone snelheid)
const BELEG = 10;              // zo lang houdt de poort het tijdens de aanval, dan gaat hij van binnenuit open
const WACHT_MAX = 150;         // zo lang wacht het leger buiten de poort, ook als de speler de les niet afmaakt (seconden)
// Het leger van Ottger: veel soorten, ook belegeringsmachines
const LEGER_OTTGER = { ridder: 27, boogschutter: 18, bijlridder: 10, kruisboog: 8, zwaardvechter: 8, banierdrager: 3, heler: 3, sluipmoordenaar: 3, vlammenwever: 3, steenwachter: 2, ladder: 6, ram: 4, katapult: 3, toren: 2 };

// De les over je leger besturen, terwijl het leger van rood buiten de muur wacht.
const NACHT_TAKEN = [
  { taak: 'Select your archers', gids: { soort: 'kies', groep: 'Archer' },
    tekst: 'Sire, look east! A whole army. We cannot stop them, but we can hold the walls. Take command: first choose your archers. Open the army with the sword, then pick the Archer group.',
    keuze: 'boogschutter' },
  { taak: 'Archers to the gate wall', gids: { soort: 'stuur', plekTekst: 'Archers here' }, doelPlek: [17, -1], opMuur: true,
    tekst: 'Good. Archers shoot best from a wall. With your archers chosen, tap the glowing piece of wall beside the gate.',
    stuurSoort: 'boogschutter' },
  { taak: 'Select your knights', gids: { soort: 'kies', groep: 'Knight' },
    tekst: 'Now the knights. They fight in the open. Pick the Knight group in the same panel.',
    keuze: 'ridder' },
  { taak: 'Knights behind the gate', gids: { soort: 'stuur', plekTekst: 'Knights here' }, doelPlek: [14, 2],
    tekst: 'When the gate falls, knights must meet them in the passage. Tap the glowing spot just inside the gate.',
    stuurSoort: 'ridder' },
];

// Gesprekken tussen de lessen door: kennismaken met Wessel en Reinout (Engels, door Claude geschreven, na te lezen).
const KAREL = { naam: 'King Karel', portret: 'karel' };
const WESSEL = { naam: 'Wessel', portret: 'wessel_blij' };
const REINOUT = { naam: 'Lord Reinout of Witherheath', portret: 'reinout' };
const GESPREKKEN = {
  3: [
    [WESSEL, 'Father! Father! Bartholt says I am nine today. Nine! Is it true there is honey cake?'],
    [KAREL, 'Honey cake, minstrels, and a wooden sword with your name cut into the hilt. Do not tell Bartholt I told you.'],
    [WESSEL, 'A real sword? Then I can guard the gate with you tonight!'],
    [KAREL, 'One day, son. Tonight you guard the cake.'],
  ],
  7: [
    [REINOUT, 'You keep a strong house, Karel. Good walls, loyal men. Your father would be proud.'],
    [KAREL, 'My father built these walls. I only keep them standing. You will stay for the feast, Reinout?'],
    [REINOUT, 'I would not miss it. Tell me, how many men watch your eastern gate at night?'],
    [KAREL, 'Enough. Why do you ask?'],
    [REINOUT, 'An old soldier\'s habit. The roads are restless. Riders of Duke Ottger were seen near the border.'],
  ],
  10: [
    [WESSEL, 'Look, Father! Lord Reinout gave me a falcon feather. He says it brings luck.'],
    [REINOUT, 'Keep it close tonight, boy. Luck is a fickle guest.'],
    [KAREL, 'Come, both of you. The minstrels are waiting.'],
  ],
};

export function maakProloog({ soortKoning, kaart, bouwer, bouwwerken, kijkNaar, stopBouw, kiesGeen, figuranten, leger, strijd, wegvinder, eenheden, koningSoort, toonVerhaal, toonTaak, toonMelding, kaartGewijzigd, toonScene, gids }) {
  let s = lees() || nieuw();
  let loopt = false;
  let reinout = null;
  let kijk = 0;

  function nieuw() {
    return { fase: 'bouw', taak: 0, tijd: 0, fasetijd: 0, basis: null, golven: 0, gemeld: {}, klaar: false, gestuurd: false, deel: '', nTaak: 0, nKlaar: false, nBegonnen: false };
  }
  function lees() {
    try { return JSON.parse(localStorage.getItem(SLEUTEL) || 'null'); } catch (e) { return null; }
  }
  function bewaar() {
    try { localStorage.setItem(SLEUTEL, JSON.stringify(s)); } catch (e) { /* niet erg */ }
  }

  // Een bevel van de speler: hij stuurt soldaten ergens heen (niet de kazerne
  // die nieuwe soldaten naar buiten stuurt).
  const stuurWas = leger.stuur;
  leger.stuur = (...a) => {
    const gelukt = stuurWas(...a);
    // Grondles: alleen een bevel op de grond, bij de gouden plek (niet op een muur)
    if (gelukt && s.fase === 'bouw' && s.basis && TAKEN[s.taak].sturen && !a[2] && !leger.isMuur(a[0], a[1])) {
      const g = gids.doel();
      const st = kaart.start[0];
      const p = (g && g.plek) || { x: st.x + TAKEN[s.taak].doelPlek[0], y: st.y + TAKEN[s.taak].doelPlek[1] };
      if (Math.hypot(a[0] - p.x, a[1] - p.y) <= 4) s.gestuurd = true;
    }
    // Muurles: elk bevel naar een stuk muur telt
    if (gelukt && s.fase === 'bouw' && s.basis && TAKEN[s.taak].opMuur && (a[2] || leger.isMuur(a[0], a[1]))) s.gestuurd = true;
    // Nachtles: een bevel telt alleen als het bij de gouden plek is (bij de muurles: op de muur)
    if (gelukt && s.fase === 'nacht' && s.deel === 'opmars' && s.nBegonnen && !s.nKlaar) {
      const t = NACHT_TAKEN[s.nTaak];
      const p = t.doelPlek && nachtPlek(t);
      const [x, y, opMuur] = a;
      const groep = leger.gekozen();
      const soortOk = !t.stuurSoort || groep.some((e) => e.soldaat.sleutel === t.stuurSoort) || !heeftSoort(t.stuurSoort);
      if (p && soortOk && Math.hypot(x - p.x, y - p.y) <= 6 && (!t.opMuur || opMuur || leger.isMuur(x, y))) s.nBevel = s.nTaak + 1;
    }
    return gelukt;
  };
  const bartholt = (tekst) => toonVerhaal({ naam: 'Bartholt', portret: 'bartholt', tekst });
  const tel = () => {
    const lijst = bouwer.eigenBouwwerken();
    const n = {};
    for (const [k, v] of Object.entries(lijst)) n[k] = v.length / 2;
    return n;
  };
  const soldaten = () => leger.soldaten().filter((e) => !e.dood && e.soldaat && e.soldaat.sleutel !== koningSoort);

  // Wachters op de muren van de vier ringen: het kasteel leeft. Ze tellen niet mee voor de lessen
  // (die kijken naar wat er bijkomt) en vechten 's nachts gewoon mee.
  // De posten van de wachters op de muren (ook gebruikt om ze van de soldaten van de speler te onderscheiden)
  function wachtPosten() {
    const st = kaart.start[0];
    const lijst = [];
    for (const M of [17, 13, 9, 5]) {
      const h = Math.round(M / 2);
      for (const [dx, dy] of [[-h, -M], [h, M], [-M, h]]) {
        const x = st.x + dx;
        const y = st.y + dy;
        if (leger.isMuur(x, y)) lijst.push([x, y]);
      }
    }
    return lijst;
  }
  // Een wachter is een van de soldaten die bij het begin al op een post stonden. Een soldaat die de speler
  // zelf traint of verplaatst telt niet als wachter, ook niet als hij op een post terechtkomt.
  const isWachter = (e) => {
    if (e.wachter) return true;
    if (soldaten().some((x) => x.wachter)) return false;   // de wachters zijn gemerkt: dit is er geen
    return wachtPosten().some(([x, y]) => Math.hypot(e.x - x - 0.5, e.y - y - 0.5) < 1.3);   // na herladen: de posten bepalen het
  };
  // Een soldaat van de speler die op de muur staat of er al naartoe loopt (zijn doel ligt dan op de muurlaag)
  const naarDeMuur = () => soldaten().filter((e) => !isWachter(e) && (e.opMuur || (e.soldaat.doel >= kaart.breedte * kaart.hoogte && e.pad))).length;
  function zetWachters() {
    if (s.wachtGezet) return;
    s.wachtGezet = true;
    const lijst = wachtPosten().map(([x, y], n) => [n % 3 === 1 ? 'ridder' : 'boogschutter', x, y, 100, 1]);
    leger.zetStand(lijst);
    for (const e of soldaten()) if (e.opMuur) e.wachter = true;
    bewaar();
  }

  // Reinout staat als gast bij de burcht (alleen om te zien, hij doet niets).
  function zetReinout(aan) {
    if (aan && !reinout) {
      const st = kaart.start[0];
      for (const [dx, dy] of [[2, 2], [3, 1], [1, 3], [-2, 2], [2, -2], [3, 2]]) {
        const x = st.x + dx;
        const y = st.y + dy;
        if (!wegvinder.isVrij(x, y, 0)) continue;
        reinout = eenheden.maakWerker(y * kaart.breedte + x, 1, soortKoning, 0);
        reinout.kijkt = -1;
        reinout.gast = true;
        return;
      }
    } else if (!aan && reinout) {
      eenheden.verwijder(reinout);
      reinout = null;
    }
  }

  // De bouwplek voor een les: de dichtstbijzijnde tegel bij het ankerpunt waar het bouwwerk mag staan.
  function zoekPlek(t) {
    if (!t.anker || !bouwwerken) return null;
    const werk = bouwwerken[t.gids.sleutel];
    const st = kaart.start[0];
    const ax = st.x + t.anker[0];
    const ay = st.y + t.anker[1];
    for (let r = 0; r <= 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          // Niet op de weg naar de poort
          if (ay + dy === st.y) continue;
          if (bouwer.waaromNiet(ax + dx, ay + dy, werk) === '') return { x: ax + dx, y: ay + dy };
        }
      }
    }
    return null;
  }
  // Voor 'sturen' en 'muur': een vaste plek bij de burcht om naartoe te wijzen
  function doelPlek(t) {
    const st = kaart.start[0];
    const x = st.x + t.doelPlek[0];
    const y = st.y + t.doelPlek[1];
    if (t.gids.soort === 'muur') return leger.isMuur(x, y) ? { x, y } : null;
    for (let r = 0; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && wegvinder.isVrij(x + dx, y + dy, 0) && !eenheden.staatOp(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
    return null;
  }
  function richtGids(kijk) {
    const t = TAKEN[s.taak];
    let plek = t.doelPlek ? doelPlek(t) : zoekPlek(t);
    if (t.kazernePlek) {
      // De kazerne die de speler zelf zette: daar tik je op om soldaten op te leiden
      const k = (bouwer.eigenBouwwerken().kazerne || []).slice(0, 2);
      plek = k.length === 2 ? { x: k[0], y: k[1] } : null;
    }
    const bevel = t.sturen || t.opMuur;
    gids.richt(plek ? { ...t.gids, plek, ...(bevel ? { heeftKeuze: () => leger.aantalGekozen() > 0, soldaat: nieuweSoldaat } : {}) } : t.gids);
    // Bartholt gaat mee naar de plek van de les (of staat bij de burcht als er geen plek is)
    if (kijk && figuranten) figuranten.leid(plek);
    if (plek && kijk && kijkNaar) kijkNaar(plek.x, plek.y);
  }

  // De soldaat die de speler het laatst trainde (geen wachter, niet de koning), liefst niet op de muur
  function nieuweSoldaat() {
    const eigen = soldaten().filter((e) => !isWachter(e));
    return eigen.filter((e) => !e.opMuur).pop() || eigen.pop() || null;
  }

  // Eerst een kaartje van Bartholt met een knop (geen klok), dan pas de gids.
  function begin(taak) {
    s.taak = taak;
    s.klaar = false;
    s.gestuurd = false;
    s.basis = null;
    s.fasetijd = 0;
    toonTaak(`Task ${taak + 1} of ${TAKEN.length}: ${TAKEN[taak].taak}`);
    bewaar();
    introKaart();
  }
  function introKaart() {
    gids.kaart({ naam: 'Bartholt', tekst: TAKEN[s.taak].tekst, knop: s.taak === 0 ? "Let's begin ›" : 'Start lesson ›' }, () => {
      s.basis = tel();
      s.basisSoldaten = soldaten().length;
      s.fasetijd = 0;
      richtGids(true);
      bewaar();
    });
  }
  // Een gesprek, kaartje voor kaartje, met portret
  function toonGesprek(regels, klaar, i = 0) {
    if (i >= regels.length) { klaar(); return; }
    const [wie, tekst] = regels[i];
    gids.kaart({ naam: wie.naam, portret: wie.portret, tekst, knop: '›' }, () => toonGesprek(regels, klaar, i + 1));
  }
  function klaarKaart() {
    const laatste = s.taak + 1 >= TAKEN.length;
    gids.kaart({ naam: 'Bartholt', tekst: TAKEN[s.taak].lof || LOF[s.taak % LOF.length], knop: laatste ? 'Continue ›' : 'Next lesson ›' }, () => {
      const verder = () => { if (!laatste) begin(s.taak + 1); else naarAvond(); };
      const gesprek = GESPREKKEN[s.taak];
      if (gesprek) toonGesprek(gesprek, verder);
      else verder();
    });
  }

  function taakKlaar() {
    const t = TAKEN[s.taak];
    if (t.bouw) {
      const n = tel();
      return Object.entries(t.bouw).every(([k, nodig]) => (n[k] || 0) - ((s.basis || {})[k] || 0) >= nodig);
    }
    if (t.volk) return gids.volkGesloten();
    if (t.belasting) return gids.belastingGekozen() && gids.volkGesloten();
    if (t.soldaten) return soldaten().length - (s.basisSoldaten || 0) >= t.soldaten;
    if (t.sturen) return s.gestuurd;
    if (t.opMuur) return s.gestuurd;   // alleen een bevel in deze les naar een stuk muur
    return true;
  }

  function naarAvond() {
    s.fase = 'avond';
    s.fasetijd = 0;
    gids.stop();
    gids.verbergKaart();
    toonTaak('The feast goes on');
    bewaar();
  }
  // Na de vrije tijd: het wordt avond
  function begintSchemer() {
    s.gemeld.avond = true;
    toonTaak('Evening: the feast is over');
    bartholt('The feast is over and Wessel is asleep. Lord Reinout has gone out for some air. Sire, I count more torches on the road than I like. If they come tonight, they come in force. Hold the keep as long as you can.');
    zetReinout(false);
    bewaar();
  }

  // Soepel: heeft de speler dat soort niet (meer), dan telt elke soldaat van hem.
  const heeftSoort = (sleutel) => soldaten().some((e) => e.soldaat.sleutel === sleutel && !isWachterZonderBevel(e) && !e.wachter);
  const nachtKlaar = (t) => {
    const sleutel = t.keuze || t.stuurSoort;
    // Kiezen: de groep telt ook de wachters mee (zo staat het in het paneel)
    if (t.keuze) return leger.gekozen().some((e) => e.soldaat.sleutel === sleutel || !soldaten().some((x) => x.soldaat.sleutel === sleutel));
    // Sturen: alleen een bevel in deze les naar (de buurt van) de gouden plek telt
    return s.nBevel === s.nTaak + 1;
  };
  // Staat of loopt er een soldaat van de speler naar deze plek? (muur: de bovenkant van het stuk muur)
  function bijPlek(t, past) {
    const B = kaart.breedte;
    const N = B * kaart.hoogte;
    const p = nachtPlek(t);
    if (!p) return false;
    return soldaten().some((e) => {
      if (isWachterZonderBevel(e) || !past(e)) return false;
      const doel = e.soldaat && e.soldaat.doel >= 0 ? e.soldaat.doel : -1;
      if (doel >= 0) {
        const vak = doel >= N ? doel - N : doel;
        return Math.hypot((vak % B) - p.x, Math.floor(vak / B) - p.y) <= 6;
      }
      return Math.hypot(e.x - p.x - 0.5, e.y - p.y - 0.5) <= 6;
    });
  }
  // Een wachter die nog op zijn vaste post staat, telt niet als bevel van de speler
  const isWachterZonderBevel = (e) => !(e.soldaat && e.soldaat.doel >= 0) && isWachter(e);
  const nachtPlekken = new Map();   // de gekozen plek per les (blijft gelijk)
  const nachtPlek = (t) => {
    if (nachtPlekken.has(t)) return nachtPlekken.get(t);
    const st = kaart.start[0];
    const x = st.x + t.doelPlek[0];
    const y = st.y + t.doelPlek[1];
    let plek = { x, y };
    if (!t.opMuur) {
      plek = null;
      for (let r = 0; r <= 4 && !plek; r++) for (let dy = -r; dy <= r && !plek; dy++) for (let dx = -r; dx <= r && !plek; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && wegvinder.isVrij(x + dx, y + dy, 0)) plek = { x: x + dx, y: y + dy };
      }
    }
    nachtPlekken.set(t, plek);
    return plek;
  };

  // De overmacht: een leger helemaal aan de oostrand van de kaart. Het marcheert langzaam naar een plek
  // buiten de muren en wacht daar. In groepjes langs de rand, zodat ze echt aan de rand beginnen.
  function stuurOvermacht() {
    const st = kaart.start[0];
    const wacht = { x: st.x + 31, y: st.y, straal: 6 };
    const randX = kaart.breedte - 3;
    let groep = 0;
    for (const [soort, aantal] of Object.entries(LEGER_OTTGER)) {
      for (let i = 0; i < aantal; i += 6) {
        const dy = ((groep * 7) % 37) - 18;   // verspreid langs de rand
        groep++;
        strijd.stuurLeger({ [soort]: Math.min(6, aantal - i) }, groep === 1, { rond: { x: randX, y: st.y + dy }, straal: 2, binnen: 0, houd: wacht, traag: OPMARS_TEMPO });
      }
    }
  }

  function nachtToon() {
    toonTaak(`Defend: lesson ${s.nTaak + 1} of ${NACHT_TAKEN.length}: ${NACHT_TAKEN[s.nTaak].taak}`);
  }
  function nachtRichtGids(kijk) {
    const t = NACHT_TAKEN[s.nTaak];
    let plek = null;
    if (t.doelPlek) plek = nachtPlek(t);
    gids.richt(plek ? { ...t.gids, plek, heeftKeuze: () => leger.aantalGekozen() > 0 } : t.gids);
    if (plek && kijk && kijkNaar) kijkNaar(plek.x, plek.y);
  }
  function nachtIntro() {
    nachtToon();
    gids.kaart({ naam: 'Bartholt', tekst: NACHT_TAKEN[s.nTaak].tekst, knop: 'Understood ›' }, () => { s.nBegonnen = true; s.nKlaar = false; nachtRichtGids(true); bewaar(); });
  }
  function nachtKlaarKaart() {
    const laatste = s.nTaak + 1 >= NACHT_TAKEN.length;
    gids.kaart({ naam: 'Bartholt', tekst: laatste ? 'Well done, Sire. They are at the gate now. Hold your positions!' : 'Good.', knop: laatste ? 'Hold ›' : 'Next ›' }, () => {
      if (laatste) { openPoort(); return; }
      s.nTaak++;
      s.nKlaar = false;
      s.nBegonnen = false;
      nachtIntro();
      bewaar();
    });
  }
  // De poort gaat van binnenuit open en het leger stroomt naar binnen.
  // Het leger valt aan, maar de poort houdt nog stand: ze bestormen de muren (BELEG seconden).
  function openPoort() {
    if (s.deel === 'storm' || s.deel === 'beleg') return;
    s.deel = 'beleg';
    s.fasetijd = 0;
    gids.stop();
    gids.verbergKaart();
    toonTaak('Night: hold the walls');
    strijd.laatOpmarsLos();
    toonMelding('They are coming! Hold the walls!');
    bewaar();
  }
  // Dan gaat de poort van binnenuit open en stroomt het leger naar binnen.
  function poortGaatOpen() {
    if (s.deel === 'storm') return;
    s.deel = 'storm';
    s.fasetijd = 0;
    toonTaak('Night: hold the keep');
    wegvinder.zetPoortenOpen(true);
    kaartGewijzigd(new Set());
    toonMelding('The gate is open! Someone opened it from the inside. The Mourning Banner is pouring in!');
    bewaar();
  }

  function naarNacht() {
    s.fase = 'nacht';
    s.deel = 'opmars';
    s.nTaak = 0;
    s.nKlaar = false;
    s.nBegonnen = false;
    s.fasetijd = 0;
    s.golven = 1;
    gids.stop();
    gids.verbergKaart();
    if (kiesGeen) kiesGeen();
    stuurOvermacht();
    toonMelding('Torches on the eastern road! A great army is marching on Aldervale.');
    // De camera kijkt naar de poort in het oosten, waar ze aankomen
    if (kijkNaar) kijkNaar(kaart.start[0].x + 22, kaart.start[0].y);
    nachtIntro();
    bewaar();
  }

  function naarScene() {
    s.fase = 'scene';
    bewaar();
    toonTaak('');
    toonScene([
      { naam: 'Bartholt', portret: 'bartholt', tekst: 'Sire! A rider, there, at the gate. He has the boy!' },
      { naam: 'Wessel', portret: 'wessel_bang', tekst: 'Father!' },
      { naam: 'Bartholt', portret: 'bartholt', tekst: 'They are gone, all of them, as fast as they came. They left this, nailed to the door of the hall. Five words: "Come and get him."' },
      { naam: 'King Karel', portret: 'karel_rouw', tekst: 'Whose banner was that? Black, without a sign.' },
      { naam: 'Bartholt', portret: 'bartholt', tekst: 'The Mourning Banner, Sire. Duke Ottger of Blackmark. The road north runs through three lords who serve him. Reinout of Witherheath is the first.' },
    ]);
  }

  return {
    // Is dit het begin van de proloog? Dan zegt Bartholt de eerste taak.
    start() {
      loopt = true;
      if (s.fase === 'bouw') {
        zetReinout(true);
        zetWachters();
        toonTaak(`Task ${s.taak + 1} of ${TAKEN.length}: ${TAKEN[s.taak].taak}`);
        if (s.klaar) { toonTaak(`Done: ${TAKEN[s.taak].taak}`); klaarKaart(); }
        else if (!s.basis) introKaart();
        else richtGids(false);
      } else if (s.fase === 'avond') toonTaak(s.gemeld.avond ? 'Evening: the feast is over' : 'The feast goes on');
      else if (s.fase === 'nacht') {
        if (s.deel === 'opmars') {
          // Na het herladen is het leger er niet meer: opnieuw laten marcheren, de les gaat verder
          if (strijd.opmarsStand().totaal < 10) stuurOvermacht();
          if (s.nBegonnen && !s.nKlaar) { nachtToon(); nachtRichtGids(false); }
          else if (s.nKlaar) nachtKlaarKaart();
          else nachtIntro();
        } else if (s.deel === 'beleg') {
          s.deel = 'storm-wacht';
          poortGaatOpen();
        } else {
          toonTaak('Night: hold the keep');
          wegvinder.zetPoortenOpen(true);
          kaartGewijzigd(new Set());
        }
      } else if (s.fase === 'scene') naarScene();
    },
    stap(dt) {
      if (!loopt || s.fase === 'scene') return;
      s.tijd += dt;
      s.fasetijd += dt;
      kijk += dt;
      if (kijk < 0.5) return;
      kijk = 0;
      if (s.fase === 'bouw') {
        if (!s.basis) return;   // het kaartje wacht op de speler
        if (s.taak === 2 && s.fasetijd > 25 && !s.gemeld.reinout) {
          s.gemeld.reinout = true;
          toonVerhaal({ naam: 'Lord Reinout of Witherheath', portret: 'reinout', tekst: 'A fine feast, King Karel. Your boy has grown. Nine already... time runs fast in Aldervale.' });
        }
        const huidig = TAKEN[s.taak];
        const g = gids.doel();
        if (huidig.bouw && g && g.plek && !s.klaar && bouwer.waaromNiet(g.plek.x, g.plek.y, bouwwerken && bouwwerken[huidig.gids.sleutel]) !== '') gids.zetPlek(zoekPlek(huidig));
        if (!s.klaar && taakKlaar()) {
          s.klaar = true;
          gids.stop();
          if (kiesGeen && (TAKEN[s.taak].sturen || TAKEN[s.taak].opMuur)) kiesGeen();   // de hint 'soldier selected' weg
          if (stopBouw) stopBouw();   // klaar met bouwen: de bouwstand uit, zodat een tik niet per ongeluk nog een hut zet
          toonTaak(`Done: ${TAKEN[s.taak].taak}`);
          bewaar();
          klaarKaart();
        } else if (Math.round(s.tijd) % 10 === 0) bewaar();
      } else if (s.fase === 'avond') {
        if (s.fasetijd >= VRIJ && !s.gemeld.avond) begintSchemer();
        if (s.fasetijd >= VRIJ + AVOND) naarNacht();
      } else if (s.fase === 'nacht' && s.deel === 'beleg') {
        if (s.fasetijd >= BELEG) poortGaatOpen();
      } else if (s.fase === 'nacht' && s.deel === 'opmars') {
        // De les over je leger; de poort gaat ook open als de speler te lang wacht
        const t = NACHT_TAKEN[s.nTaak];
        if (s.nBegonnen && !s.nKlaar && nachtKlaar(t)) {
          s.nKlaar = true;
          gids.stop();
          toonTaak(`Done: ${t.taak}`);
          if (kiesGeen && t.stuurSoort) kiesGeen();
          bewaar();
          nachtKlaarKaart();
        }
        if (s.fasetijd >= WACHT_MAX) openPoort();
      } else if (s.fase === 'nacht') {
        const st = strijd.stand();
        if (s.fasetijd >= NACHT_DUUR || (st.burchtMax > 0 && st.burcht / st.burchtMax < 0.4)) naarScene();
        else if (Math.round(s.fasetijd) % 10 === 0) bewaar();
      }
    },
    // Hoe donker het is: 0 overdag, 1 in de nacht.
    nacht() {
      if (s.fase === 'avond') return Math.max(0, Math.min(1, (s.fasetijd - VRIJ) / AVOND));
      if (s.fase === 'nacht' || s.fase === 'scene') return 1;
      return 0;
    },
    // Voor de rol rechtsonder: de lijst taken.
    taken() {
      return TAKEN.map((t, i) => ({ taak: t.taak, klaar: s.fase !== 'bouw' || i < s.taak || (i === s.taak && s.klaar), nu: s.fase === 'bouw' && i === s.taak }));
    },
    fase: () => s.fase,
    // Na de scène: niets meer doen.
    stop() { loopt = false; },
    // Opnieuw beginnen.
    wis() {
      s = nieuw();
      gids.stop();
      gids.verbergKaart();
      zetReinout(false);
      wegvinder.zetPoortenOpen(false);
      try { localStorage.removeItem(SLEUTEL); } catch (e) { /* niet erg */ }
      if (loopt) zetReinout(true);
    },
    // Voor de tests.
    stand: () => ({ ...s, reinout: !!reinout }),
    zetFase(fase) {
      if (fase === 'avond') naarAvond();
      if (fase === 'nacht') naarNacht();
      if (fase === 'storm') { naarNacht(); openPoort(); poortGaatOpen(); }
      if (fase === 'scene') naarScene();
    },
  };
}
