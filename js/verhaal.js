// VERHAAL: de berichten van de figuren tijdens een level (stap 31).
//
// Elk level in data/campagne.json heeft een lijst berichten. Een bericht
// verschijnt één keer, als zijn moment komt:
//   tijd        na zoveel seconden spelen
//   aanval      als aanval nummer zoveel begint
//   burcht      als je eigen burcht onder zoveel procent leven komt
//   koning      als je eigen koning onder zoveel procent leven komt
//   roodBurcht  als de burcht van rood onder zoveel procent komt
//   roodKoning  als de koning van rood onder zoveel procent komt
// Daarnaast gelden de berichten uit berichtenAltijd in elk level.
//
// wie: een figuur uit campagne.figuren, of "heer" voor de heer van dit level.
// portret: een ander portret van dezelfde figuur (bijvoorbeeld karel_boos).
//
// Wat al getoond is, onthouden we per level in localStorage, zodat een
// bericht na herladen niet opnieuw komt. Opnieuw beginnen wist dat.

const SLEUTEL = 'burcht-banier.verhaal.';

export function maakVerhaal({ campagne, missie, toon }) {
  const lijst = missie ? [...(missie.berichten || []), ...(campagne.berichtenAltijd || [])] : [];
  const geheugen = missie ? SLEUTEL + missie.id : null;
  let getoond = new Set();
  try {
    if (geheugen) getoond = new Set(JSON.parse(localStorage.getItem(geheugen) || '[]'));
  } catch (e) { /* geen geheugen: dan komen berichten na herladen opnieuw */ }
  let speeltijd = 0;
  let loopt = false;
  let kijkTegoed = 0;

  const bewaar = () => {
    try { if (geheugen) localStorage.setItem(geheugen, JSON.stringify([...getoond])); } catch (e) { /* niet erg */ }
  };

  // Naam en portret van wie er praat.
  function spreker(b) {
    if (b.wie === 'heer') return { naam: missie.heer, portret: b.portret || missie.portret };
    const f = (campagne.figuren || {})[b.wie] || { naam: b.wie, portret: b.wie };
    return { naam: f.naam, portret: b.portret || f.portret };
  }

  // Het moment van een bericht: is het er?
  function isZover(b, s) {
    const pct = (deel, heel) => (heel > 0 ? (100 * deel) / heel : 100);
    switch (b.bij) {
      case 'tijd': return speeltijd >= b.waarde;
      case 'aanval': return s.golf >= b.waarde && s.vijanden > 0;
      case 'burcht': return pct(s.burcht, s.burchtMax) < b.waarde;
      case 'roodBurcht': return s.roodMax > 0 && pct(s.rood, s.roodMax) < b.waarde;
      case 'koning': return s.koning && pct(s.koning.leven, s.koning.levenMax) < b.waarde;
      case 'roodKoning': return s.roodKoning && pct(s.roodKoning.leven, s.roodKoning.levenMax) < b.waarde;
      default: return false;
    }
  }

  return {
    // Het level begint echt (de briefing is dicht).
    start() { loopt = true; },
    // Een stap van het spel.
    // Kijken doen we twee keer per seconde; standVan() geeft de stand.
    stap(dt, standVan) {
      if (!loopt || !lijst.length) return;
      speeltijd += dt;
      kijkTegoed += dt;
      if (kijkTegoed < 0.5) return;
      kijkTegoed = 0;
      const s = standVan();
      if (s.uitslag) return;
      for (let i = 0; i < lijst.length; i++) {
        const b = lijst[i];
        const id = (i < (missie.berichten || []).length ? 'l' : 'a') + i;
        if (getoond.has(id) || !isZover(b, s)) continue;
        getoond.add(id);
        bewaar();
        toon({ ...spreker(b), tekst: b.tekst });
        return;   // hooguit één nieuw bericht per stap
      }
    },
    // Opnieuw beginnen: alles mag weer komen.
    wis() {
      getoond = new Set();
      speeltijd = 0;
      bewaar();
    },
    // Voor de tests.
    aantalGetoond: () => getoond.size,
  };
}
