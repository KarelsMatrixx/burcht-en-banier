// INSTELLINGEN: alle getallen op één plek.
// Een getal hier aanpassen verandert het spel, zonder dat je in de rest
// van de code hoeft te zijn.

export const CONFIG = {
  versie: '0.39.0',
  stap: 34,

  // Het speelveld. Hetzelfde zaad geeft altijd dezelfde kaart.
  kaart: { breedte: 64, hoogte: 64, zaad: 20261110 },

  // Maat van één ruitvormige tegel in pixels (verhouding 2:1).
  tegel: { breedte: 64, hoogte: 32 },

  // Hoe ver je mag uitzoomen en inzoomen, en waar je begint.
  camera: { zoomMin: 0.45, zoomMax: 2.5, zoomStart: 1.2 },

  beeld: {
    maxPixelRatio: 2,        // lager = sneller, hoger = scherper
    achtergrond: '#14130f',
    pixelArt: false,         // true = harde pixels, voor pixel art sprites
  },

  invoer: {
    tikDrempel: 10,          // verder bewegen dan dit aantal pixels telt als slepen
    tikTijd: 400,            // langer vasthouden dan dit (ms) telt niet als tik
    dubbelTijd: 380,         // twee tikken binnen deze tijd (ms) zijn een dubbeltik
    dubbelAfstand: 28,       // en binnen deze afstand (pixels)
  },

  // Hoe vaak per seconde het spel rekent. Tekenen gaat vaker en vloeit
  // tussen de rekenstappen door.
  spel: { stappenPerSeconde: 10 },

  // Bouwen: hoe lang één stuk muur in één keer mag zijn (in tegels).
  bouw: { langsteLijn: 40 },

  // De prestatietest van stap 2 en de wachters op de muur.
  proef: {
    aantallen: [0, 150, 300, 600],   // de knop "Figuren" loopt deze rij af; de eerste is het begin
    aantalMeting: 150,               // met minstens zoveel figuren wordt er gemeten
    snelheid: 2.2,                   // tegels per seconde
    snelheidWachter: 0.7,            // wachters op de muur lopen rustig
    routesPerStap: 8,                // hooguit zoveel routes zoeken per rekenstap
  },
};
