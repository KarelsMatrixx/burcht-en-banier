// SCHERM: hulp voor het gedraaide scherm (0.77.0).
// Een iPhone laat een webapp niet vastzetten in liggende stand. Houd je de telefoon staand,
// dan draait index.html daarom het hele spel 90 graden (klasse "gedraaid" op <html>, zie
// css/stijl.css), zodat het spel liggend blijft. Vingers en meetwaarden van de browser
// (clientX, getBoundingClientRect, innerWidth) zijn dan nog in de staande ruimte; deze
// functies zetten ze om naar de liggende ruimte waarin het spel rekent.
//
// Draaiing: een punt (x, y) in het spel staat op het scherm op (S - y, x), met S de
// (korte) schermbreedte. Terug: x = schermY, y = S - schermX.
// window.__scherm = { gedraaid, w, h } wordt gezet door het meetscript in index.html;
// w en h zijn de echte schermmaat (staand: w kort, h lang).

export function isGedraaid() {
  return document.documentElement.classList.contains('gedraaid') && !!window.__scherm;
}

// Een vingerplek (clientX, clientY) naar spelcoördinaten.
export function naarSpel(cx, cy) {
  if (!isGedraaid()) return { x: cx, y: cy };
  return { x: cy, y: window.__scherm.w - cx };
}

// Een verschuiving (bijvoorbeeld van een veeg) naar spelrichting.
export function deltaNaarSpel(dx, dy) {
  return isGedraaid() ? { x: dy, y: -dx } : { x: dx, y: dy };
}

// De doos van een element in spelcoördinaten (zoals getBoundingClientRect, maar meegedraaid).
export function vak(element) {
  const r = element.getBoundingClientRect();
  if (!isGedraaid()) return r;
  const s = window.__scherm.w;
  const left = r.top;
  const right = r.bottom;
  const top = s - r.right;
  const bottom = s - r.left;
  return { left, right, top, bottom, x: left, y: top, width: right - left, height: bottom - top };
}

// De maat van het spelvenster (liggend), ook als de telefoon staat.
export function spelBreedte() {
  return isGedraaid() ? window.__scherm.h : window.innerWidth;
}
export function spelHoogte() {
  return isGedraaid() ? window.__scherm.w : window.innerHeight;
}
