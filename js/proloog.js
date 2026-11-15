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
  { taak: "Build a Woodcutter's Hut", bouw: { houthakker: 1 }, gids: { soort: 'bouw', sleutel: 'houthakker' }, tekst: "Happy birthday to Wessel, Sire! While the cooks work, let us put the land to work. First lesson: wood. I will show you each button." },
  { taak: 'Build a Stone Mine', bouw: { steengroeve: 1 }, gids: { soort: 'bouw', sleutel: 'steengroeve' }, tekst: 'Wood we have, now stone. Build a stone mine right against the grey rocks.' },
  { taak: 'Build an Orchard', bouw: { boomgaard: 1 }, gids: { soort: 'bouw', sleutel: 'boomgaard' }, tekst: 'A feast needs food, and so does an army. Build an orchard on open grass.' },
  { taak: 'Build a House', bouw: { woning: 1 }, gids: { soort: 'bouw', sleutel: 'woning' }, tekst: 'More hands, more work. A house brings new villagers.' },
  { taak: 'Build Barracks', bouw: { kazerne: 1 }, gids: { soort: 'bouw', sleutel: 'kazerne' }, tekst: 'A king needs soldiers, even on a feast day. Build barracks.' },
  { taak: 'Train two soldiers', soldaten: 2, gids: { soort: 'opleiden' }, tekst: 'Now train two soldiers. Knights hold the line, archers shoot from behind it.' },
  { taak: 'Send a soldier somewhere', sturen: true, gids: { soort: 'sturen' }, tekst: 'Now give an order. Choose a soldier, then show him where to go.' },
  { taak: 'Put a soldier on the wall', opMuur: true, gids: { soort: 'muur' }, tekst: "Last lesson, Sire. Ottger's messengers at the border are restless. Put a soldier on the wall to keep watch." },
];

const LOF = ['Well done, Sire.', 'Good work.', 'Splendid. The people see their king at work.', 'That will do nicely.', 'Very good.'];
const AVOND = 20;              // seconden schemering voor de nacht
const NACHT_DUUR = 240;        // vier minuten nacht, dan de scène
const OVERMACHT = 80;          // zoveel vijanden komen er ineens: je hebt geen kans (naar Karel)

export function maakProloog({ soortKoning, kaart, bouwer, leger, strijd, wegvinder, eenheden, koningSoort, toonVerhaal, toonTaak, toonMelding, kaartGewijzigd, toonScene, gids }) {
  let s = lees() || nieuw();
  let loopt = false;
  let reinout = null;
  let kijk = 0;

  function nieuw() {
    return { fase: 'bouw', taak: 0, tijd: 0, fasetijd: 0, basis: null, golven: 0, gemeld: {}, klaar: false, gestuurd: false };
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
    if (gelukt && s.fase === 'bouw' && s.basis && TAKEN[s.taak].sturen) s.gestuurd = true;
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
  const opDeMuur = () => soldaten().filter((e) => e.opMuur).length;

  // Wachters op de muren van de vier ringen: het kasteel leeft. Ze tellen niet mee voor de lessen
  // (die kijken naar wat er bijkomt) en vechten 's nachts gewoon mee.
  function zetWachters() {
    if (s.wachtGezet) return;
    s.wachtGezet = true;
    const st = kaart.start[0];
    const lijst = [];
    let n = 0;
    for (const M of [17, 13, 9, 5]) {
      const h = Math.round(M / 2);
      for (const [dx, dy] of [[-h, -M], [h, M], [-M, h]]) {
        const x = st.x + dx;
        const y = st.y + dy;
        if (!leger.isMuur(x, y)) continue;
        lijst.push([n++ % 3 === 1 ? 'ridder' : 'boogschutter', x, y, 100, 1]);
      }
    }
    leger.zetStand(lijst);
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
      s.basisMuur = opDeMuur();
      s.fasetijd = 0;
      gids.richt(TAKEN[s.taak].gids);
      bewaar();
    });
  }
  function klaarKaart() {
    const laatste = s.taak + 1 >= TAKEN.length;
    gids.kaart({ naam: 'Bartholt', tekst: LOF[s.taak % LOF.length], knop: laatste ? 'Continue ›' : 'Next lesson ›' }, () => {
      if (!laatste) begin(s.taak + 1);
      else naarAvond();
    });
  }

  function taakKlaar() {
    const t = TAKEN[s.taak];
    if (t.bouw) {
      const n = tel();
      return Object.entries(t.bouw).every(([k, nodig]) => (n[k] || 0) - ((s.basis || {})[k] || 0) >= nodig);
    }
    if (t.soldaten) return soldaten().length - (s.basisSoldaten || 0) >= t.soldaten;
    if (t.sturen) return s.gestuurd;
    if (t.opMuur) return opDeMuur() > (s.basisMuur || 0);
    return true;
  }

  function naarAvond() {
    s.fase = 'avond';
    s.fasetijd = 0;
    gids.stop();
    gids.verbergKaart();
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
    gids.stop();
    gids.verbergKaart();
    toonTaak('Night: hold the keep');
    // De poort gaat van binnenuit open.
    wegvinder.zetPoortenOpen(true);
    kaartGewijzigd(new Set());
    stuurOvermacht(OVERMACHT);
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
        zetWachters();
        toonTaak(`Task ${s.taak + 1} of ${TAKEN.length}: ${TAKEN[s.taak].taak}`);
        if (s.klaar) { toonTaak(`Done: ${TAKEN[s.taak].taak}`); klaarKaart(); }
        else if (!s.basis) introKaart();
        else gids.richt(TAKEN[s.taak].gids);
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
        if (!s.basis) return;   // het kaartje wacht op de speler
        if (s.taak === 2 && s.fasetijd > 25 && !s.gemeld.reinout) {
          s.gemeld.reinout = true;
          toonVerhaal({ naam: 'Lord Reinout of Witherheath', portret: 'reinout', tekst: 'A fine feast, King Karel. Your boy has grown. Nine already... time runs fast in Aldervale.' });
        }
        if (!s.klaar && taakKlaar()) {
          s.klaar = true;
          gids.stop();
          toonTaak(`Done: ${TAKEN[s.taak].taak}`);
          bewaar();
          klaarKaart();
        } else if (Math.round(s.tijd) % 10 === 0) bewaar();
      } else if (s.fase === 'avond') {
        if (s.fasetijd >= AVOND) naarNacht();
      } else if (s.fase === 'nacht') {
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
      if (fase === 'scene') naarScene();
    },
  };
}
