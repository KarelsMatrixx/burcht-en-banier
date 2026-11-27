// De legerles (0.121.0): aan het begin van level 3 (Ironmarsh) leert Bartholt je je soldaten besturen.
// Zelfde opzet als de handelles (js/handelles.js): kaartjes en de gids, geen klok; zolang de les loopt
// staat de oorlog stil (main.js lesLoopt).
//   1. kaartje: Bartholt brengt vier ridders en vier boogschutters om mee te oefenen
//   2. box: het zwaard, Box, een kader om de acht man op de gouden plek
//   3. kaartje: de knoppen tellen nu alleen wie in je box zit
//   4. Ranged: alleen de boogschutters uit de box
//   5. Group: de hele box weer
//   6. kaartje: de formatieknop
//   7. de formatieknop tot hij Line zegt
//   8. stuur ze naar de gouden plek; wachten tot ze er staan
//   9. kaartje: voetvolk voor, schutters erachter; nu Hold
//  10. Hold aan
//  11. kaartje: wat Hold doet. Klaar.
// De acht man blijven bij je (een geschenk, zoals de extra kar hout in de handelles).
// Is de les al gedaan (bewaard), dan begint hij niet opnieuw. Teksten Engels, na te lezen.

const BARTHOLT = { naam: 'Bartholt', portret: 'bartholt' };
const GESCHENK = [['ridder', 4], ['boogschutter', 4]];

export function maakLegerLes({ gids, leger, kaart, wegvinder, klaarAl = false, opKlaar = () => {}, sluitPanelen = () => {}, glijNaar = () => {}, kaderAan = () => false }) {
  const B = kaart.breedte;
  const H = kaart.hoogte;
  let fase = klaarAl ? 'klaar' : 'wacht';
  let mannen = [];      // de acht van Bartholt
  let midden = null;    // waar ze staan bij het begin
  let doelPlek = null;  // waar ze in een rij heen moeten
  let besteld = false;  // het bevel naar de gouden plek is gegeven
  let kaderFout = false;   // er is een box getrokken, maar niet om alle acht

  const vrij = (x, y) => x > 0 && y > 0 && x < B - 1 && y < H - 1 && wegvinder.isVrij(x, y, 0);
  // Een open veld van (2r+1)x(2r+1) rond (x, y)?
  const open = (x, y, r) => { for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!vrij(x + dx, y + dy)) return false; return true; };

  // De oefenplek: een open veld 7 tot 16 tegels van je burcht, met een tweede open veld
  // zes tegels verderop (het doel van de rij), allebei over land bereikbaar.
  function kiesPlekken() {
    const thuis = kaart.start[0];
    let beste = null;
    for (let y = 3; y < H - 3; y++) {
      for (let x = 3; x < B - 3; x++) {
        const d = Math.hypot(x - thuis.x, y - thuis.y);
        if (d < 7 || d > 16 || !open(x, y, 1)) continue;
        if (!wegvinder.inHetVeld(y * B + x, 0)) continue;
        // het doel: zes tegels verder van de burcht af, met ruimte voor een rij van acht
        const ux = (x - thuis.x) / d;
        const uy = (y - thuis.y) / d;
        const tx = Math.round(x + ux * 6);
        const ty = Math.round(y + uy * 6);
        if (!open(tx, ty, 2) || !wegvinder.verbonden(y * B + x, ty * B + tx, 0)) continue;
        const score = Math.abs(d - 10);
        if (!beste || score < beste.score) beste = { x, y, tx, ty, score };
      }
    }
    if (!beste) return false;
    midden = { x: beste.x, y: beste.y };
    doelPlek = { x: beste.tx, y: beste.ty };
    return true;
  }

  const levend = () => mannen.filter((e) => !e.dood && leger.lijst.includes(e));
  const archers = () => levend().filter((e) => e.soldaat.sleutel === 'boogschutter');
  const inBox = () => { const d = leger.deel(); return !!d && levend().every((e) => d.includes(e)); };
  const alleenSchutters = () => { const g = leger.gekozen(); return g.length > 0 && g.every((e) => e.soldaat.sleutel === 'boogschutter') && archers().every((e) => e.gekozen); };
  const alleGekozen = () => levend().length > 0 && levend().every((e) => e.gekozen);
  const lopen = () => levend().some((e) => e.pad || e.soldaat.doel >= 0);
  const opDePlek = () => {
    const l = levend();
    if (!l.length || !doelPlek) return false;
    const mx = l.reduce((s, e) => s + e.x, 0) / l.length;
    const my = l.reduce((s, e) => s + e.y, 0) / l.length;
    return Math.hypot(mx - doelPlek.x - 0.5, my - doelPlek.y - 0.5) < 3.5;
  };

  function geefMannen() {
    mannen = [];
    for (const [sleutel, n] of GESCHENK) {
      for (let i = 0; i < n; i++) {
        const e = leger.geef(sleutel, midden.y * B + midden.x, 4);
        if (e) mannen.push(e);
      }
    }
    leger.kiesGeen();
  }

  function start() {
    if (!kiesPlekken()) { fase = 'klaar'; opKlaar(); return; }   // geen plek op deze kaart: dan geen les
    fase = 'kaart1';
    sluitPanelen();
    gids.kaart({ ...BARTHOLT, tekst: 'Before we march on Ironmarsh, Sire, let us drill the men. I brought four knights and four archers from the garrison. They are yours to keep.', knop: 'Show me ›' }, () => {
      geefMannen();
      glijNaar(midden.x + 0.5, midden.y + 0.5);
      naarBox();
    });
  }

  function naarBox() {
    fase = 'box';
    kaderFout = false;
    gids.richt({ soort: 'kader', plek: midden, plekTekst: 'Box these eight men', kaderAan, fout: () => kaderFout });
  }

  function naarKaart(tekst, knop, daarna) {
    gids.stop();
    fase = 'kaart';
    gids.kaart({ ...BARTHOLT, tekst, knop }, daarna);
  }

  function naarRanged() {
    fase = 'ranged';
    gids.richt({ soort: 'kies', groep: 'Ranged', anders: 'Your box is gone. Tap Box again.' });
  }

  function naarGroep() {
    fase = 'groep';
    gids.richt({ soort: 'kies', groep: 'Group', tekst: 'Now tap Group: the whole box is chosen again.' });
  }

  function naarFormatie() {
    fase = 'formatie';
    gids.richt({ soort: 'formatie', naam: 'Line', heeftKeuze: alleGekozen });
  }

  function naarStuur() {
    fase = 'stuur';
    besteld = false;
    glijNaar(doelPlek.x + 0.5, doelPlek.y + 0.5);
    gids.richt({
      soort: 'stuur', plek: doelPlek, plekTekst: 'Send them here',
      heeftKeuze: () => besteld || alleGekozen(),
      onderweg: () => besteld && lopen(),
      onderwegTekst: 'Watch them form a line on the way.',
    });
  }

  function naarHoud() {
    fase = 'houd';
    gids.richt({ soort: 'houd', heeftKeuze: alleGekozen });
  }

  function klaar() {
    fase = 'klaar';
    opKlaar();
  }

  return {
    actief: () => fase !== 'klaar' && fase !== 'wacht',
    klaar: () => fase === 'klaar',
    fase: () => fase,
    mannen: () => levend(),
    doelPlek: () => doelPlek,
    // Wat mag de speler nu? (main.js en ui.beperkKnoppen)
    mag(wat) {
      if (wat === 'zwaard' || wat === 'alle' || wat === 'kader') return true;
      if (wat === 'formatie') return fase === 'formatie';
      if (wat === 'houd') return fase === 'houd';
      return false;   // bouwen, volk, logboek, oog: na de les
    },
    sla() { gids.stop(); gids.verbergKaart(); klaar(); },   // voor tests
    zetOpnieuw() { gids.stop(); gids.verbergKaart(); sluitPanelen(); fase = 'wacht'; mannen = []; },   // Start over: de les begint weer
    // Een box is getrokken (main.js kaderKlaar): telt hij alle acht?
    naKader() { if (fase === 'box') kaderFout = !inBox(); },
    // magBegin: het verhaalbeeld en de briefing zijn weg
    stap(dt, magBegin) {
      if (fase === 'wacht') { if (magBegin) start(); return; }
      if (fase === 'klaar') return;
      if (fase !== 'kaart' && fase !== 'kaart1' && !levend().length) { gids.stop(); klaar(); return; }   // niemand meer over (zou niet mogen)
      if (fase === 'box' && inBox()) {
        naarKaart('Good. These eight are now your group. Look at the buttons below: they only count the men inside your box.', 'Next ›', naarRanged);
      } else if (fase === 'ranged') {
        if (!leger.deel()) naarBox();
        else if (alleenSchutters()) naarKaart('Only the archers inside your box are chosen, not every archer you own. Handy in a big battle.', 'Next ›', naarGroep);
      } else if (fase === 'groep') {
        if (!leger.deel()) naarBox();
        else if (alleGekozen()) naarKaart('Now how they stand. The formation button shows the shape they take when you send them somewhere.', 'Next ›', naarFormatie);
      } else if (fase === 'formatie' && leger.formatie() === 'lijn') {
        naarStuur();
      } else if (fase === 'stuur') {
        if (!besteld && alleGekozen() && lopen()) besteld = true;
        if (besteld && !lopen()) {
          if (opDePlek()) naarKaart('See? Knights in front, archers right behind them. Shield puts fighters in front and behind with the archers in the middle. Block makes a tight square, Wide a loose one, Free lets them crowd the spot. Last lesson: Hold.', 'Next ›', naarHoud);
          else { besteld = false; gids.zetPlek(doelPlek); }   // ergens anders heen gestuurd: nog een keer
        }
      } else if (fase === 'houd' && levend().every((e) => e.houdt)) {
        naarKaart('Holding men stay on their spot and only strike what comes close; archers shoot whatever is in range. Send them elsewhere and they hold there. Attack an enemy, or tap Hold again, to let them fight freely.', 'Got it', klaar);
      }
      if (fase !== 'klaar') gids.stap(dt);
    },
  };
}
