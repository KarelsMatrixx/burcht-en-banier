// TAAL: kleine hulpjes voor Engelse zinnen in het spel.

// "a knight" of "an archer". hoofdletter = "A knight" aan het begin van een zin.
export function metLidwoord(woord, hoofdletter = false) {
  const lid = /^[aeiou]/i.test(woord) ? 'an' : 'a';
  return `${hoofdletter ? lid.charAt(0).toUpperCase() + lid.slice(1) : lid} ${woord}`;
}
