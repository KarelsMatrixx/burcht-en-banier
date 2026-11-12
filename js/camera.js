// CAMERA: welk stuk van de wereld je ziet. De camera onthoudt het punt in
// de wereld dat midden op het scherm staat en hoe ver je bent ingezoomd.

import { CONFIG } from './config.js';

export function maakCamera(grenzen) {
  const cam = {
    x: 0,
    y: 0,
    zoom: CONFIG.camera.zoomStart,
    breedte: 1,   // schermmaat in gewone (css) pixels, gezet door de tekenlaag
    hoogte: 1,
  };

  const klem = (waarde, min, max) => Math.max(min, Math.min(max, waarde));

  // Houdt het midden van het scherm binnen de kaart.
  cam.begrens = () => {
    cam.x = klem(cam.x, grenzen.links, grenzen.rechts);
    cam.y = klem(cam.y, grenzen.boven, grenzen.onder);
  };

  cam.schermNaarWereld = (sx, sy) => ({
    x: cam.x + (sx - cam.breedte / 2) / cam.zoom,
    y: cam.y + (sy - cam.hoogte / 2) / cam.zoom,
  });

  cam.wereldNaarScherm = (wx, wy) => ({
    x: (wx - cam.x) * cam.zoom + cam.breedte / 2,
    y: (wy - cam.y) * cam.zoom + cam.hoogte / 2,
  });

  // Schuiven: de kaart beweegt mee met je vinger.
  cam.schuif = (dx, dy) => {
    cam.x -= dx / cam.zoom;
    cam.y -= dy / cam.zoom;
    cam.begrens();
  };

  // Zoomen rond een punt op het scherm: wat onder je vingers ligt, blijft
  // onder je vingers.
  cam.zoomRond = (sx, sy, factor) => {
    const voor = cam.schermNaarWereld(sx, sy);
    cam.zoom = klem(cam.zoom * factor, CONFIG.camera.zoomMin, CONFIG.camera.zoomMax);
    const na = cam.schermNaarWereld(sx, sy);
    cam.x += voor.x - na.x;
    cam.y += voor.y - na.y;
    cam.begrens();
  };

  cam.zetZoom = (zoom) => {
    cam.zoom = klem(zoom, CONFIG.camera.zoomMin, CONFIG.camera.zoomMax);
  };

  cam.kijkNaar = (wx, wy) => {
    cam.x = wx;
    cam.y = wy;
    cam.begrens();
  };

  return cam;
}
