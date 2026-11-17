// De poortwacht (0.66): jouw poorten gaan vanzelf dicht als er vijandelijke soldaten (aanvallers) in de buurt
// komen, en weer open als ze weg zijn. Alleen voor vijanden: je eigen soldaten sluiten niets af.
// Doe je een poort zelf dicht, dan blijft die dicht. Doe je hem zelf open terwijl er vijanden bij zijn, dan
// laat de wacht hem een tijdje met rust. In de proloog (de les) doet de wacht niets: daar sluit de speler zelf.
import { OBJECT } from "./kaart.js";
export function maakPoortwacht({ kaart, wegvinder, vijanden, kaartGewijzigd, melding, stappenPerSeconde, uit }) {
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const AFSTAND = 6;           // zo dichtbij (tegels) moet een aanvaller komen
  const WEG = 4;               // zoveel seconden is het veilig voordat hij weer opengaat
  const RUST = 25;             // zoveel seconden laat de wacht een poort met rust die jij zelf opende
  const poortVakken = [];
  const autoDicht = new Map(); // eerste vak van de poort -> { vakken, veilig: aantal controles zonder vijand }
  const rustTot = new Map();   // eerste vak van de poort -> stap tot wanneer hij met rust gelaten wordt
  let stapNr = 0;

  // Alle poorten van jou, als groepen vakken die aan elkaar vastzitten.
  function groepen() {
    const gezien = new Set();
    const lijst = [];
    for (let i = 0; i < B * H; i++) {
      if (gezien.has(i) || kaart.object[i] !== OBJECT.POORT || kaart.eigenaar[i] !== 1) continue;
      const vakken = [i];
      gezien.add(i);
      for (let j = 0; j < vakken.length && vakken.length < 9; j++) {
        const x = vakken[j] % B;
        const y = Math.floor(vakken[j] / B);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= B || ny >= H) continue;
          const v = ny * B + nx;
          if (gezien.has(v) || kaart.object[v] !== OBJECT.POORT || kaart.eigenaar[v] !== 1) continue;
          gezien.add(v);
          vakken.push(v);
        }
      }
      lijst.push(vakken);
    }
    return lijst;
  }

  const dichtbij = (vakken, lijst) => lijst.some((e) => !e.dood && vakken.some((v) => Math.hypot(e.x - ((v % B) + 0.5), e.y - (Math.floor(v / B) + 0.5)) <= AFSTAND));

  // De speler tikte zelf op een poort.
  function handmatig(vakken, nuDicht) {
    autoDicht.delete(vakken[0]);
    if (!nuDicht) rustTot.set(vakken[0], stapNr + RUST * stappenPerSeconde);
    else rustTot.delete(vakken[0]);
  }

  function controle() {
    const lijst = vijanden();
    const veranderd = new Set();
    let ging = false;
    for (const vakken of groepen()) {
      const sleutel = vakken[0];
      const dicht = wegvinder.isPoortDicht(sleutel);
      const bij = lijst.length && dichtbij(vakken, lijst);
      if (!dicht && bij && stapNr >= (rustTot.get(sleutel) || 0)) {
        wegvinder.zetPoortDicht(vakken, true);
        autoDicht.set(sleutel, { vakken, veilig: 0 });
        vakken.forEach((v) => veranderd.add(v));
        ging = true;
      } else if (dicht && autoDicht.has(sleutel)) {
        const a = autoDicht.get(sleutel);
        a.veilig = bij ? 0 : a.veilig + 1;
        if (a.veilig >= WEG * 2) {   // twee controles per seconde
          wegvinder.zetPoortDicht(vakken, false);
          autoDicht.delete(sleutel);
          vakken.forEach((v) => veranderd.add(v));
        }
      } else if (dicht && !autoDicht.has(sleutel)) {
        // door de speler dichtgedaan: niets doen
      }
    }
    if (veranderd.size) {
      kaartGewijzigd(veranderd);
      if (ging && melding) melding('The enemy is near: your gates close by themselves.');
    }
  }

  function stap() {
    if (uit && uit()) return;
    stapNr++;
    if (stapNr % Math.max(1, Math.round(stappenPerSeconde / 2)) === 0) controle();
  }

  return { stap, handmatig, controle, poortVakken, dichtGemaakt: () => [...autoDicht.keys()] };
}
