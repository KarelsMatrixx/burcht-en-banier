// PROLOOG: de laatste vredige dag (campagne-verhaal.md, stap 35 van het campagneplan).
//
// Wessel wordt negen. Bartholt leert je bouwen met een korte lijst taken.
// Heer Reinout is te gast en staat bij de burcht. Als de lijst af is (of na
// elf minuten) wordt het avond, Reinout is weg, en 's nachts gaat je poort
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
  { taak: "Build a Woodcutter's Hut", bouw: { houthakker: 1 }, tekst: "Happy birthday to Wessel, Sire! While the cooks work, let us put the land to work. Tap the hammer and build a woodcutter's hut near the forest." },
  { taak: 'Build a Quarry', bouw: { steengroeve: 1 }, tekst: 'Good. Wood we have, now stone. Build a quarry close to the rocks.' },
  { taak: 'Build an Orchard', bouw: { boomgaard: 1 }, tekst: 'A feast needs food, and so does an army. Build an orchard.' },
  { taak: 'Build a House', bouw: { woning: 1 }, tekst: 'More hands, more work. Build a house: new villagers will come to live in it.' },
  { taak: 'Build Barracks', bouw: { kazerne: 1 }, tekst: 'A king needs soldiers, even on a feast day. Build barracks.' },
  { taak: 'Train two soldiers', soldaten: 2, tekst: 'Tap your barracks and train two soldiers. Knights hold the line, archers shoot from behind it.' },
  { taak: 'Send a soldier somewhere', sturen: true, tekst: 'Tap a soldier to choose him, then tap the ground where he must go. The sword below shows all your soldiers.' },
  { taak: 'Build a wall and a gate', bouw: { muur: 4, poort: 1 }, tekst: "Sire, Ottger's messengers at the border fort are restless. Put a wall with a gate around your keep. Better safe on a feast day." },
];

const ELF_MINUTEN = 11 * 60;   // daarna wordt het hoe dan ook avond
const AVOND = 20;              // seconden schemering voor de nacht
const NACHT_DUUR = 240;        // vier minuten nacht, dan de scène
const VERSTERKING = 50;        // elke zoveel seconden komen er meer

export function maakProloog({ soortKoning, kaart, bouwer, leger, strijd, wegvinder, eenheden, koningSoort, toonVerhaal, toonTaak, toonMelding, kaartGewijzigd, toonScene }) {
  let s = lees() || nieuw();
  let loopt = false;
  let reinout = null;
  let kijk = 0;

  function nieuw() {
    return { fase: 'bouw', taak: 0, tijd: 0, fasetijd: 0, basis: null, golven: 0, gemeld: {} };
  }
  function lees() {
    try { return JSON.parse(localStorage.getItem(SLEUTEL) || 'null'); } catch (e) { return null; }
  }
  function bewaar() {
    try { localStorage.setItem(SLEUTEL, JSON.stringify(s)); } catch (e) { /* niet erg */ }
  }

  const bartholt = (tekst) => toonVerhaal({ naam: 'Bartholt', portret: 'bartholt', tekst });
  const tel = () => {
    const lijst = bouwer.eigenBouwwerken();
    const n = {};
    for (const [k, v] of Object.entries(lijst)) n[k] = v.length / 2;
    return n;
  };
  const soldaten = () => leger.soldaten().filter((e) => !e.dood && e.soldaat && e.soldaat.sleutel !== koningSoort);

  // Reinout staat als gast bij de burcht (alleen om te zien, hij doet niets).
  function zetReinout(aan) {
    if (aan && !reinout) {
      const st = kaart.start[0];
      for (const [dx, dy] of [[3, -1], [-1, 3], [3, 1], [1, 3], [4, 0], [0, 4]]) {
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

  function begin(taak) {
    s.taak = taak;
    s.basis = tel();
    s.basisSoldaten = soldaten().length;
    bartholt(TAKEN[taak].tekst);
    toonTaak(`Task ${taak + 1} of ${TAKEN.length}: ${TAKEN[taak].taak}`);
    bewaar();
  }

  function taakKlaar() {
    const t = TAKEN[s.taak];
    if (t.bouw) {
      const n = tel();
      return Object.entries(t.bouw).every(([k, nodig]) => (n[k] || 0) - ((s.basis || {})[k] || 0) >= nodig);
    }
    if (t.soldaten) return soldaten().length >= t.soldaten;
    if (t.sturen) return soldaten().some((e) => e.soldaat.doel >= 0);
    return true;
  }

  function naarAvond() {
    s.fase = 'avond';
    s.fasetijd = 0;
    toonTaak('Evening: the feast is over');
    bartholt('The feast is over and Wessel is asleep. Lord Reinout has gone out for some air. Sire, I count more torches on the road than I like. If they come tonight, they come in force. Hold the keep as long as you can.');
    zetReinout(false);
    bewaar();
  }

  // De overmacht: veel meer dan jij hebt, binnen en rond je muren.
  function stuurOvermacht(aantal) {
    const ridders = Math.ceil(aantal * 0.7);
    strijd.stuurLeger({ ridder: ridders, boogschutter: aantal - ridders }, true, { rond: kaart.start[0], straal: 9, binnen: 3 });
  }

  function naarNacht() {
    s.fase = 'nacht';
    s.fasetijd = 0;
    s.golven = 1;
    toonTaak('Night: hold the keep');
    // De poort gaat van binnenuit open.
    wegvinder.zetPoortenOpen(true);
    kaartGewijzigd(new Set());
    stuurOvermacht(14 + 2 * soldaten().length);
    toonMelding('The gate is open! Someone opened it from the inside. The Mourning Banner is in your courtyard!');
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
        if (!s.basis) begin(s.taak);
        else toonTaak(`Task ${s.taak + 1} of ${TAKEN.length}: ${TAKEN[s.taak].taak}`);
      } else if (s.fase === 'avond') toonTaak('Evening: the feast is over');
      else if (s.fase === 'nacht') {
        toonTaak('Night: hold the keep');
        wegvinder.zetPoortenOpen(true);
        kaartGewijzigd(new Set());
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
        if (s.taak === 2 && s.fasetijd > 25 && !s.gemeld.reinout) {
          s.gemeld.reinout = true;
          toonVerhaal({ naam: 'Lord Reinout of Witherheath', portret: 'reinout', tekst: 'A fine feast, King Karel. Your boy has grown. Nine already... time runs fast in Aldervale.' });
        }
        if (taakKlaar()) {
          if (s.taak + 1 < TAKEN.length) {
            s.fasetijd = 0;
            begin(s.taak + 1);
          } else naarAvond();
        } else if (s.tijd > ELF_MINUTEN) naarAvond();
        else if (Math.round(s.tijd) % 10 === 0) bewaar();
      } else if (s.fase === 'avond') {
        if (s.fasetijd >= AVOND) naarNacht();
      } else if (s.fase === 'nacht') {
        if (s.fasetijd >= VERSTERKING * s.golven && s.fasetijd < NACHT_DUUR - 20) {
          s.golven++;
          stuurOvermacht(6);
        }
        const st = strijd.stand();
        if (s.fasetijd >= NACHT_DUUR || (st.burchtMax > 0 && st.burcht / st.burchtMax < 0.4)) naarScene();
        else if (Math.round(s.fasetijd) % 10 === 0) bewaar();
      }
    },
    // Hoe donker het is: 0 overdag, 1 in de nacht.
    nacht() {
      if (s.fase === 'avond') return Math.min(1, s.fasetijd / AVOND);
      if (s.fase === 'nacht' || s.fase === 'scene') return 1;
      return 0;
    },
    // Voor de rol rechtsonder: de lijst taken.
    taken() {
      return TAKEN.map((t, i) => ({ taak: t.taak, klaar: s.fase !== 'bouw' || i < s.taak, nu: s.fase === 'bouw' && i === s.taak }));
    },
    fase: () => s.fase,
    // Na de scène: niets meer doen.
    stop() { loopt = false; },
    // Opnieuw beginnen.
    wis() {
      s = nieuw();
      zetReinout(false);
      wegvinder.zetPoortenOpen(false);
      try { localStorage.removeItem(SLEUTEL); } catch (e) { /* niet erg */ }
      if (loopt) {
        zetReinout(true);
        begin(0);
      }
    },
    // Voor de tests.
    stand: () => ({ ...s, reinout: !!reinout }),
    zetFase(fase) {
      if (fase === 'avond') naarAvond();
      if (fase === 'nacht') naarNacht();
      if (fase === 'scene') naarScene();
    },
  };
}
