// De handelles (0.115.0): aan het begin van level 1 (Witherheath) leert Bartholt je verkopen
// in de voorraadkamer (storehouse). Zelfde opzet als de havenles (js/havenles.js): stap voor stap
// met de gids van de proloog (js/gids.js), zonder klok; zolang de les loopt staat de oorlog stil.
//   1. kaartje: de voorraadkamer koopt wat je over hebt
//   2. bouwen (alleen als je er nog geen hebt): hamer, Village, Storehouse, de gouden plek
//   3. kaartje: tik je voorraadkamer aan
//   4. de voorraadkamer aantikken en een partij hout verkopen
//   5. kaartje: weinig goud, verkoop alleen wat je niet nodig hebt. Klaar.
// Naar Karel: je moet daarna nog genoeg spullen hebben. Daarom brengt Bartholt het bouwhout
// voor de voorraadkamer en een extra kar hout mee, precies wat de les kost; je houdt alles wat je had.
// Is de les al gedaan (bewaard), dan begint hij niet opnieuw.

const BARTHOLT = { naam: 'Bartholt', portret: 'bartholt' };
const SLEUTEL = 'voorraadkamer';
const WAAR = 'hout';   // wat de les verkoopt

export function maakHandelLes({ gids, bouwer, bouwwerken, kaart, economie, regels, klaarAl = false, opKlaar = () => {}, sluitPanelen = () => {} }) {
  const B = kaart.breedte;
  let fase = klaarAl ? 'klaar' : 'wacht';
  const werk = bouwwerken[SLEUTEL];
  const per = (regels.handel && regels.handel.per) || 10;
  const prijs = (regels.handel && regels.handel.prijs && regels.handel.prijs[WAAR]) || 0;
  let verkochtBij = 0;   // het aantal verkopen toen de tikfase begon

  // De gouden plek: een vrije tegel dicht bij je burcht, maar niet er tegenaan.
  function kiesPlek() {
    const thuis = kaart.start[0];
    let beste = null;
    for (let y = 1; y < kaart.hoogte - 1; y++) {
      for (let x = 1; x < B - 1; x++) {
        const d = Math.hypot(x - thuis.x, y - thuis.y);
        if (d < 4 || d > 14) continue;
        if (bouwer.waaromNiet(x, y, werk)) continue;
        const score = Math.abs(d - 6);
        if (!beste || score < beste.score) beste = { x, y, score };
      }
    }
    return beste ? { x: beste.x, y: beste.y } : null;
  }

  // Je eigen voorraadkamer die het dichtst bij de burcht staat.
  function eigenKamer() {
    const lijst = bouwer.eigenBouwwerken()[SLEUTEL];
    if (!lijst || !lijst.length) return null;
    const thuis = kaart.start[0];
    let beste = null;
    for (let i = 0; i < lijst.length; i += 2) {
      const d = Math.hypot(lijst[i] - thuis.x, lijst[i + 1] - thuis.y);
      if (!beste || d < beste.d) beste = { x: lijst[i], y: lijst[i + 1], d };
    }
    return { x: beste.x, y: beste.y };
  }

  // Bartholt brengt het bouwhout mee: de voorraadkamer kost je niets van wat je had.
  function geefBouwhout() {
    for (const [naam, n] of Object.entries(werk.kosten || {})) economie.lever(naam, n);
  }

  function bouwStap() {
    fase = 'bouw';
    gids.richt({ soort: 'bouw', sleutel: SLEUTEL, plek: kiesPlek(), plekTekst: 'Build the storehouse here' });
  }

  function start() {
    fase = 'kaart1';
    const heeft = !!eigenKamer();
    const tekst = heeft
      ? 'Before Reinout stirs, Sire, a word on trade. The keeper of your storehouse buys whatever you can spare, and pays in gold.'
      : 'Before Reinout stirs, Sire, a word on trade. A storehouse keeps your goods, and its keeper buys whatever you can spare for gold. I brought the timber, let us build one.';
    gids.kaart({ ...BARTHOLT, tekst, knop: 'Show me ›' }, () => {
      if (eigenKamer()) { naarTik(); return; }
      geefBouwhout();
      bouwStap();
    });
  }

  function naarTik() {
    gids.stop();
    sluitPanelen();   // het bouwmenu dicht, anders bouwt een tik op de kamer er nog een
    fase = 'kaart2';
    gids.kaart({ ...BARTHOLT, tekst: `I also had the woodcutters bring an extra cart of ${per} wood, so you lose nothing. Tap your storehouse and sell it.`, knop: 'Show me ›' }, () => {
      economie.lever(WAAR, per);   // de extra kar: na de les heb je nog alles wat je had
      verkochtBij = economie.aantalVerkocht();
      fase = 'tik';
      richtOpKamer();
    });
  }

  function richtOpKamer() {
    const k = eigenKamer();
    gids.richt({ soort: 'voorraad', plek: k, plekTekst: 'Tap your storehouse' });
  }

  function naarKlaar() {
    gids.stop();
    sluitPanelen();   // het handelpaneel dicht, anders ligt het over het kaartje
    fase = 'kaart3';
    gids.kaart({ ...BARTHOLT, tekst: `${per} wood for ${prijs} gold. The keeper pays little, so sell only what you do not need. Gold trains soldiers, and you will need many.`, knop: 'Got it' }, () => {
      fase = 'klaar';
      opKlaar();
    });
  }

  return {
    actief: () => fase !== 'klaar' && fase !== 'wacht',
    klaar: () => fase === 'klaar',
    fase: () => fase,
    sla() { gids.stop(); gids.verbergKaart(); fase = 'klaar'; opKlaar(); },   // voor tests
    // magBegin: het verhaalbeeld en de briefing zijn weg
    stap(dt, magBegin) {
      if (fase === 'wacht') { if (magBegin) start(); return; }
      if (fase === 'bouw' && eigenKamer()) naarTik();
      else if (fase === 'tik') {
        if (!eigenKamer()) bouwStap();   // gesloopt: opnieuw bouwen
        else if (economie.aantalVerkocht() > verkochtBij) naarKlaar();
        else if (economie.voorraad[WAAR] < per) economie.lever(WAAR, per - economie.voorraad[WAAR]);   // toch te weinig: aanvullen
      }
      if (fase !== 'klaar') gids.stap(dt);
    },
  };
}
