// SPELLUS: het hart van het spel.
//
// Rekenen en tekenen lopen los van elkaar:
//   - Rekenen (wie loopt waarheen) gebeurt een vast aantal keer per
//     seconde. Daardoor loopt het spel op elke telefoon even snel.
//   - Tekenen gebeurt zo vaak als het scherm aankan. Tussen twee
//     rekenstappen in wordt de plek van een poppetje geschat, zodat het
//     vloeiend beweegt.

export function maakSpellus({ stappenPerSeconde, stap, teken, meld }) {
  const stapDuur = 1000 / stappenPerSeconde;   // in milliseconden
  let vorige = performance.now();
  let tegoed = 0;

  function beeld(nu) {
    let verstreken = nu - vorige;
    vorige = nu;
    // Na een pauze (app op de achtergrond) niet alles inhalen.
    if (verstreken > 250) verstreken = 250;
    tegoed += verstreken;

    let gedaan = 0;
    while (tegoed >= stapDuur && gedaan < 5) {
      const begin = performance.now();
      stap(stapDuur / 1000);
      meld.stap(performance.now() - begin);
      tegoed -= stapDuur;
      gedaan++;
    }
    if (tegoed > stapDuur) tegoed = stapDuur;   // de telefoon houdt het niet bij

    const begin = performance.now();
    teken(tegoed / stapDuur);
    meld.beeld(verstreken, performance.now() - begin);

    requestAnimationFrame(beeld);
  }

  requestAnimationFrame((nu) => {
    vorige = nu;
    requestAnimationFrame(beeld);
  });
}
