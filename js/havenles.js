// De havenles (0.106.0): aan het begin van level 8 (The White Dike) leert Bartholt je de haven.
// Stap voor stap, met de gids van de proloog (js/gids.js), zonder klok: zolang de les loopt
// staat de oorlog stil (main.js slaat strijd.stap over).
//   1. kaartje: de dijk ligt aan zee, bouw een haven
//   2. bouwen: hamer, Village, Port, de gouden plek aan het water
//   3. kaartje: tik je haven aan
//   4. de haven aantikken en een bestelling plaatsen (hout kopen)
//   5. kaartje: het schip is weg, twee minuten; je kunt ook verkopen. Klaar.
// Is de les al gedaan (bewaard), dan begint hij niet opnieuw.

import { OBJECT, GROND } from './kaart.js';

const BARTHOLT = { naam: 'Bartholt', portret: 'bartholt' };

export function maakHavenLes({ gids, haven, bouwer, bouwwerken, kaart, economie, klaarAl = false, opKlaar = () => {}, sluitPanelen = () => {} }) {
  const B = kaart.breedte;
  let fase = klaarAl ? 'klaar' : 'wacht';
  const werk = bouwwerken.haven;

  // De gouden plek: een vrije tegel aan het water, zo dicht mogelijk bij je burcht.
  function kiesPlek() {
    const thuis = kaart.start[0];
    let beste = null;
    for (let y = 1; y < kaart.hoogte - 1; y++) {
      for (let x = 1; x < B - 1; x++) {
        if (bouwer.waaromNiet(x, y, werk)) continue;
        // liefst aan het havenbekken: veel water eromheen
        let water = 0;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (kaart.grond[(y + dy) * B + x + dx] === GROND.WATER) water++;
        const d = Math.hypot(x - thuis.x, y - thuis.y) - water * 0.3;
        if (!beste || d < beste.d) beste = { x, y, d };
      }
    }
    return beste ? { x: beste.x, y: beste.y } : null;
  }

  const eigenHaven = () => haven.havens().find((h) => !h.rood);

  // Genoeg om de haven te bouwen en een eerste lading te kopen.
  function vulAan() {
    for (const [naam, n] of Object.entries(werk.kosten || {})) if (economie.voorraad[naam] < n) economie.lever(naam, n - economie.voorraad[naam]);
    const goud = (haven.regels.koop || {}).hout || 0;
    if (economie.voorraad.goud < goud) economie.lever('goud', goud - economie.voorraad.goud);
  }

  function start() {
    fase = 'kaart1';
    gids.kaart({ ...BARTHOLT, tekst: 'The White Dike lies by the sea, Sire. Merchant ships sail here. Let us build a port by the water, so they can bring us goods.', knop: 'Show me ›' }, () => {
      if (eigenHaven()) { naarTik(); return; }
      fase = 'bouw';
      vulAan();
      gids.richt({ soort: 'bouw', sleutel: 'haven', plek: kiesPlek(), plekTekst: 'Build the port here' });
    });
  }

  function naarTik() {
    gids.stop();
    sluitPanelen();   // het bouwmenu dicht, anders bouwt een tik op de haven er nog een
    fase = 'kaart2';
    gids.kaart({ ...BARTHOLT, tekst: 'A fine quay. Tap your port to trade. Pay gold and a ship sails out for goods.', knop: 'Show me ›' }, () => {
      fase = 'tik';
      const h = eigenHaven();
      const x = h ? h.vak % B : 0;
      gids.richt({ soort: 'haven', plek: h ? { x, y: (h.vak - x) / B } : null, plekTekst: 'Tap your port' });
    });
  }

  function naarKlaar() {
    gids.stop();
    sluitPanelen();   // het havenpaneel dicht, anders ligt het over het kaartje
    fase = 'kaart3';
    gids.kaart({ ...BARTHOLT, tekst: 'The ship has sailed. In two minutes it is back with your goods. You can also sell: a ship pays more gold than the storehouse, but you wait two minutes for it. One ship per port, so more ports means more ships.', knop: 'Got it' }, () => {
      fase = 'klaar';
      opKlaar();
    });
  }

  return {
    actief: () => fase !== 'klaar' && fase !== 'wacht',
    klaar: () => fase === 'klaar',
    fase: () => fase,
    zetOpnieuw() { gids.stop(); gids.verbergKaart(); sluitPanelen(); fase = 'wacht'; },   // Start over: de les begint weer
    sla() { gids.stop(); gids.verbergKaart(); fase = 'klaar'; opKlaar(); },   // voor tests
    // magBegin: het verhaalbeeld en de briefing zijn weg
    stap(dt, magBegin) {
      if (fase === 'wacht') { if (magBegin) start(); return; }
      if (fase === 'bouw' && eigenHaven()) naarTik();
      else if (fase === 'tik') { const h = eigenHaven(); if (!h) { fase = 'bouw'; gids.richt({ soort: 'bouw', sleutel: 'haven', plek: kiesPlek(), plekTekst: 'Build the port here' }); } else if (h.order) naarKlaar(); }
      if (fase !== 'klaar') gids.stap(dt);
    },
  };
}
