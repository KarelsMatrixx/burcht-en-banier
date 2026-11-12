// OPSLAG: bewaart de stand van het spel op het toestel zelf: wat je hebt
// gebouwd, je voorraad en welke bomen er zijn omgehakt.
//
// Er gaat niets naar een server. Het kasteel staat in het geheugen van
// de browser, alleen op dit toestel. Let op: op een iPhone heeft de app
// op het beginscherm een eigen geheugen, los van Safari. En Safari kan
// het geheugen wissen van een site die je een week niet opent.
//
// Kan het geheugen niet gebruikt worden (dat komt voor), dan werkt het
// spel gewoon door, alleen zonder bewaren.

export function maakOpslag(zaad, SLEUTEL = 'burcht-banier.kasteel.1') {
  let werkt = true;

  // Geeft de bewaarde stand terug, of null als er niets bruikbaars is.
  // Wat erin zit: bouwwerken (zie bouwen.js), voorraad en gekapt (zie
  // economie.js). Die modules controleren zelf of de inhoud klopt.
  function laad() {
    try {
      const tekst = window.localStorage.getItem(SLEUTEL);
      if (!tekst) return null;
      const stand = JSON.parse(tekst);
      // Een stand hoort bij één kaart. Is de kaart anders, dan past hij niet meer.
      if (!stand || typeof stand !== 'object' || stand.zaad !== zaad) return null;
      return stand;
    } catch (fout) {
      werkt = false;
      return null;
    }
  }

  function bewaar(stand) {
    try {
      window.localStorage.setItem(SLEUTEL, JSON.stringify({ ...stand, zaad }));
      werkt = true;
    } catch (fout) {
      werkt = false;
    }
    return werkt;
  }

  function wis() {
    try {
      window.localStorage.removeItem(SLEUTEL);
    } catch (fout) {
      werkt = false;
    }
  }

  return { laad, bewaar, wis, werkt: () => werkt };
}
