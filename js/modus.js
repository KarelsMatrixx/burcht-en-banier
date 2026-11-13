// MODUS: vrij spel of een missie van de campagne.
//
// De gekozen modus staat in het geheugen van de browser (los van de
// bewaarde stand van het spel). Kies je een andere modus, dan laadt de
// pagina opnieuw: zo begint alles schoon met de regels van die modus.
// Elke modus heeft zijn eigen bewaarde stand, zodat je tussen missies kunt
// wisselen zonder iets kwijt te raken. Vrij spel op Normaal gebruikt de
// bewaarde stand van vóór stap 17.

const MODUS = 'burcht-banier.modus';
const VOORTGANG = 'burcht-banier.campagne';

export async function laadMissies() {
  const antwoord = await fetch('data/missies.json');
  if (!antwoord.ok) throw new Error('Kon data/missies.json niet laden.');
  const m = await antwoord.json();
  for (const [sleutel, p] of Object.entries(m.profielen)) {
    if (!p.naam) throw new Error(`missies.json: profiel ${sleutel} mist een naam`);
  }
  for (const v of m.vrij) if (!m.profielen[v.profiel]) throw new Error(`missies.json: vrij spel verwijst naar onbekend profiel ${v.profiel}`);
  const ca = await fetch('data/campagne.json');
  if (!ca.ok) throw new Error('Kon data/campagne.json niet laden.');
  const cj = await ca.json();
  m.campagne = cj.levels;
  m.figuren = cj.figuren || {};
  m.berichtenAltijd = cj.berichtenAltijd || [];
  for (const c of m.campagne) if (!m.profielen[c.profiel]) throw new Error(`campagne.json: level ${c.id} verwijst naar onbekend profiel ${c.profiel}`);
  // De weg en de brug op het schilderij van de levelkaart.
  const lk = await fetch('data/levelkaart.json');
  if (!lk.ok) throw new Error('Kon data/levelkaart.json niet laden.');
  m.levelkaart = await lk.json();
  return m;
}

// Is dit level open? Level 1 altijd (de proloog is nog niet speelbaar),
// daarna als het vorige level gewonnen is.
export const isOpen = (c, gewonnen) => c.id <= 1 || gewonnen.includes(c.id - 1);

// Wat je in een level mag gebruiken. Elk level heeft een beloning: soldaten en
// gebouwen die je krijgt als je het wint (vaak iets van de heer die je versloeg).
// In level n heb je de beloningen van alle levels ervoor. Wat in geen enkele
// beloning staat, heb je altijd. In vrij spel (levelId null) heb je alles.
export function ontgrendeld(campagne, levelId) {
  if (levelId === null || levelId === undefined) return () => true;
  const ergens = new Set(campagne.flatMap((c) => c.beloning || []));
  const al = new Set(campagne.filter((c) => c.id < levelId).flatMap((c) => c.beloning || []));
  return (sleutel) => !ergens.has(sleutel) || al.has(sleutel);
}

const lees = (sleutel) => {
  try {
    return JSON.parse(window.localStorage.getItem(sleutel) || 'null');
  } catch (fout) {
    return null;
  }
};
const schrijf = (sleutel, waarde) => {
  try {
    window.localStorage.setItem(sleutel, JSON.stringify(waarde));
    return true;
  } catch (fout) {
    return false;
  }
};

// De huidige modus: { soort: 'vrij', profiel } of { soort: 'campagne', missie }.
// Wat niet klopt wordt vrij spel op Normaal.
export function leesModus(missies) {
  const m = lees(MODUS);
  if (m && m.soort === 'campagne' && missies.campagne.some((c) => c.id === m.missie && c.speelbaar)) return { soort: 'campagne', missie: m.missie };
  if (m && m.soort === 'vrij' && missies.profielen[m.profiel]) return { soort: 'vrij', profiel: m.profiel };
  return { soort: 'vrij', profiel: 'normaal' };
}

export const zetModus = (modus) => schrijf(MODUS, modus);

// Welke missies je hebt gewonnen: een lijst nummers.
export function voortgang() {
  const v = lees(VOORTGANG);
  return v && Array.isArray(v.klaar) ? v.klaar.filter(Number.isInteger) : [];
}

export function missieGewonnen(id) {
  const klaar = new Set(voortgang());
  klaar.add(id);
  schrijf(VOORTGANG, { klaar: [...klaar] });
}

// Waar de bewaarde stand van deze modus staat.
export function opslagSleutel(modus) {
  if (modus.soort === 'campagne') return `burcht-banier.missie.${modus.missie}`;
  return modus.profiel === 'normaal' ? 'burcht-banier.kasteel.1' : `burcht-banier.vrij.${modus.profiel}`;
}

export function profielVan(missies, modus) {
  if (modus.soort === 'campagne') return missies.profielen[missies.campagne.find((c) => c.id === modus.missie).profiel];
  return missies.profielen[modus.profiel];
}

// De regels van het profiel over economie.json heen leggen. Alleen de
// onderdelen die het profiel noemt veranderen.
export function pasProfielToe(regels, profiel) {
  regels.heer = { ...regels.heer, ...(profiel.heer || {}) };
  if (profiel.heer && profiel.heer.begin) regels.heer.begin = { ...regels.heer.begin, ...profiel.heer.begin };
  if (profiel.heer && profiel.heer.extra_soorten) regels.heer.extra_soorten = { ...profiel.heer.extra_soorten };
  if (profiel.heer && profiel.heer.leger) regels.heer.leger = { ...profiel.heer.leger };
  regels.strijd = { ...regels.strijd, ...(profiel.strijd || {}) };
  for (const [k, n] of Object.entries(profiel.begin || {})) {
    if (regels.grondstoffen[k] && Number.isFinite(n)) regels.grondstoffen[k] = { ...regels.grondstoffen[k], begin: n };
  }
}
