// ISO: rekent om tussen het raster (tegel x, y) en de isometrische wereld
// (pixels). Alle andere modules gebruiken deze functies, zodat de
// rekensom maar op één plek staat.
//
// Afspraak: tegel (x, y) is een ruit. rasterNaarWereld geeft de BOVENSTE
// punt van die ruit. De ruit loopt vandaar een halve tegel naar links en
// rechts en een hele tegelhoogte naar beneden.

import { CONFIG } from './config.js';

export const HALVE_BREEDTE = CONFIG.tegel.breedte / 2;
export const HALVE_HOOGTE = CONFIG.tegel.hoogte / 2;
export const TEGEL_HOOGTE = CONFIG.tegel.hoogte;

// Raster naar wereld. Werkt ook met decimalen: (x + 0.5, y + 0.5) is het
// midden van een tegel.
export function rasterNaarWereld(x, y) {
  return { x: (x - y) * HALVE_BREEDTE, y: (x + y) * HALVE_HOOGTE };
}

// Wereld naar raster, met decimalen. Math.floor van de uitkomst geeft de
// tegel waar het punt in ligt.
export function wereldNaarRaster(wx, wy) {
  const a = wx / HALVE_BREEDTE;
  const b = wy / HALVE_HOOGTE;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

// De rechthoek in wereldpixels waar de hele kaart in past.
export function kaartGrenzen(breedte, hoogte) {
  return {
    links: -hoogte * HALVE_BREEDTE,
    rechts: breedte * HALVE_BREEDTE,
    boven: 0,
    onder: (breedte + hoogte) * HALVE_HOOGTE,
  };
}
