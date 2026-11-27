// De visles (0.120.0): aan het begin van level 8 (The White Dike), na de havenles, leert Bartholt
// je de Fisherman's Hut. Zelfde opzet als de havenles (js/havenles.js): kaartjes en de gouden
// plek, geen klok. Zolang de les loopt staat de oorlog stil (main.js lesLoopt).
//   1. kaartje: de zee zit vol vis, bouw een vissershut aan de kust
//   2. bouwen: hamer, Work, Fisherman's Hut, de gouden plek aan het water
//   3. kaartje: een visser neemt zijn plek in, kijk hoe het bootje uitvaart
//   4. kijken: de gouden plek volgt het bootje, tot de eerste vangst in je voorraad ligt
//   5. kaartje: wat de hut doet. Klaar.
// Teksten Engels, na te lezen.

import { GROND } from './kaart.js';

const BARTHOLT = { naam: 'Bartholt', portret: 'bartholt' };

export function maakVisLes({ gids, visserij, bouwer, bouwwerken, kaart, economie, klaarAl = false, wachtOp = () => true, opKlaar = () => {}, sluitPanelen = () => {}, glijNaar = () => {} }) {
  const B = kaart.breedte;
  let fase = klaarAl ? 'klaar' : 'wacht';
  const werk = bouwwerken.vissershut;
  let gevangenBij = 0;

  // De gouden plek: een vrije tegel aan het water met open zee ervoor, zo dicht mogelijk bij je burcht.
  function kiesPlek() {
    const thuis = kaart.start[0];
    let beste = null;
    for (let y = 1; y < kaart.hoogte - 1; y++) {
      for (let x = 1; x < B - 1; x++) {
        const d = Math.hypot(x - thuis.x, y - thuis.y);
        if (beste && d >= beste.d) continue;
        if (d > 30) continue;
        if (bouwer.waaromNiet(x, y, werk)) continue;
        // niet pal naast de haven: daar ligt het grote schip
        let water = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (kaart.grond[(y + dy) * B + x + dx] === GROND.WATER) water++;
        if (water < 2 || !visserij.kanVissen(x, y)) continue;
        beste = { x, y, d };
      }
    }
    return beste ? { x: beste.x, y: beste.y } : null;
  }

  const eigenHut = () => visserij.hutten()[0];

  // Genoeg om de hut te bouwen, en een vrije boer voor de visser.
  function vulAan() {
    for (const [naam, n] of Object.entries(werk.kosten || {})) if (economie.voorraad[naam] < n) economie.lever(naam, n - economie.voorraad[naam]);
  }

  function start() {
    fase = 'kaart1';
    gids.kaart({ ...BARTHOLT, tekst: 'The sea is full of fish, Sire. A fisherman with a little boat can feed many mouths. Let us build a fisherman\'s hut on the shore.', knop: 'Show me ›' }, () => {
      if (eigenHut()) { naarKijk(); return; }
      fase = 'bouw';
      vulAan();
      gids.richt({ soort: 'bouw', sleutel: 'vissershut', plek: kiesPlek(), plekTekst: 'Build the hut here' });
    });
  }

  function naarKijk() {
    gids.stop();
    sluitPanelen();   // het bouwmenu dicht, anders bouwt een tik nog een hut
    fase = 'kaart2';
    gids.kaart({ ...BARTHOLT, tekst: 'A peasant takes the hut and becomes your fisherman. Watch: his boat rows out to sea, casts the net and comes back to his own hut.', knop: 'Watch ›' }, () => {
      fase = 'kijk';
      gevangenBij = visserij.gevangen();
      visserij.snel(true);
      const p = visserij.bootje();
      if (p) glijNaar(p.x, p.y);
      gids.richt({ soort: 'kijk', tekst: 'Your fishing boat. Wait until it brings its catch home.', plekTekst: 'Your fishing boat', volg: () => { const b = visserij.bootje(); return b ? { x: Math.floor(b.x), y: Math.floor(b.y) } : null; } });
    });
  }

  function naarKlaar() {
    gids.stop();
    sluitPanelen();
    fase = 'kaart3';
    const R = visserij.regels;
    gids.kaart({ ...BARTHOLT, tekst: `The catch goes straight into your stores: ${R.vangst} fish each trip, about once a minute. Fish is food, like apples and bread: the more kinds of food your people have, the happier they are. Every hut needs a peasant and open water in front of it. When Rutger's longships are at sea, the fishermen stay ashore.`, knop: 'Got it' }, () => {
      fase = 'klaar';
      opKlaar();
    });
  }

  return {
    actief: () => fase !== 'klaar' && fase !== 'wacht',
    klaar: () => fase === 'klaar',
    fase: () => fase,
    zetOpnieuw() { gids.stop(); gids.verbergKaart(); sluitPanelen(); fase = 'wacht'; visserij.snel(false); },
    sla() { gids.stop(); gids.verbergKaart(); fase = 'klaar'; visserij.snel(false); opKlaar(); },   // voor tests
    // magBegin: het verhaalbeeld en de briefing zijn weg, en de havenles is klaar
    stap(dt, magBegin) {
      if (fase === 'wacht') { if (magBegin && wachtOp()) start(); return; }
      if (fase === 'bouw' && eigenHut()) naarKijk();
      else if (fase === 'kijk') {
        if (!eigenHut()) { fase = 'bouw'; gids.richt({ soort: 'bouw', sleutel: 'vissershut', plek: kiesPlek(), plekTekst: 'Build the hut here' }); }
        else if (visserij.gevangen() > gevangenBij) naarKlaar();
        else {
          // Geen vrije boer voor de visser? Dan brengt Bartholt er stil een mee, anders blijft de les hangen.
          const bev = economie.bevolking();
          if (bev.wachtend > 0 && bev.vrij <= 0) economie.zetVolk(bev.volk + 1);
        }
      }
      if (fase !== 'klaar') gids.stap(dt);
    },
  };
}
