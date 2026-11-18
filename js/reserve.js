// RESERVE: de verborgen reserve van rood (level 9, The Mourngate; stap 41 uit het campagneplan).
//
// Drost Valkenier houdt een deel van zijn leger verborgen op een flank van zijn bergfort.
// Je ziet die mannen niet: alleen een soldaat van jou die er vlak langs loopt, of een
// ziener (beloning van level 8, het Stille Volk) maakt ze zichtbaar. De reserve valt aan
// zodra je soldaten dicht bij zijn burcht komen (dan slaan ze je in de flank), als je
// ze ontdekt, of na een vaste tijd.
//
// In data/campagne.json bij het level:
//   reserve: { leger: { soort: aantal }, afstand: tegels van het kasteel, kant: hoek in radialen
//              ten opzichte van de richting naar jou (1.4 = flink opzij), los: { naderen: tegels,
//              tijd: seconden }, zieners: aantal dat je meekrijgt, teksten: { ontdekt, aanval, zieners } }
//
// De stand (al losgelaten of niet) staat in localStorage, zodat herladen geen tweede reserve geeft.

const SLEUTEL = 'burcht-banier.reserve.';

export function maakReserve({ missie, kaart, strijd, leger, wegvinder, toonMelding, toonVerhaal }) {
  const r = missie.reserve;
  const geheugen = SLEUTEL + missie.id;
  const B = kaart.breedte;
  let s = lees() || nieuw();
  let kijk = 0;
  let plek = null;

  function nieuw() { return { los: false, tijd: 0, ontdekt: false, geschonken: false }; }
  function lees() { try { return JSON.parse(localStorage.getItem(geheugen) || 'null'); } catch (e) { return null; } }
  function bewaar() { try { localStorage.setItem(geheugen, JSON.stringify(s)); } catch (e) { /* niet erg */ } }

  // De plek: opzij van het kasteel van rood (niet tussen jou en hem in), op een vrij vak
  // dat rood te voet kan bereiken.
  function zoekPlek() {
    const rood = kaart.start[1];
    const jij = kaart.start[0];
    const hoek = Math.atan2(jij.y - rood.y, jij.x - rood.x) + (r.kant === undefined ? 1.4 : r.kant);
    const afstand = r.afstand || 11;
    const tx = Math.round(rood.x + Math.cos(hoek) * afstand);
    const ty = Math.round(rood.y + Math.sin(hoek) * afstand);
    for (let ring = 0; ring < 14; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const x = tx + dx;
          const y = ty + dy;
          if (x < 2 || y < 2 || x >= B - 2 || y >= kaart.hoogte - 2) continue;
          if (!wegvinder.isVrij(x, y, 1) || kaart.eigenaar[y * B + x] !== 0) continue;
          return { x, y };
        }
      }
    }
    return { x: rood.x, y: rood.y };
  }

  // Zet de mannen in een kluitje rond de plek, elk op een eigen vrij vak.
  function zetNeer() {
    plek = plek || zoekPlek();
    const vakken = [];
    for (let ring = 0; ring < 6 && vakken.length < 60; ring++) {
      for (let dy = -ring; dy <= ring; dy++) {
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
          const x = plek.x + dx;
          const y = plek.y + dy;
          if (x < 1 || y < 1 || x >= B - 1 || y >= kaart.hoogte - 1 || !wegvinder.isVrij(x, y, 1)) continue;
          vakken.push(y * B + x);
        }
      }
    }
    let n = 0;
    for (const [soort, aantal] of Object.entries(r.leger || {})) {
      for (let i = 0; i < aantal && vakken.length; i++) {
        if (strijd.reserveSoldaat(soort, vakken[n % vakken.length])) n++;
      }
    }
    return n;
  }

  function laatLos(tekst) {
    if (s.los) return;
    s.los = true;
    const n = strijd.laatReserveLos();
    bewaar();
    if (n) toonMelding((tekst || "Falconer's hidden reserve charges! {n} soldiers.").replace('{n}', n));
    if (n && r.teksten && r.teksten.aanval) toonVerhaal(r.teksten.aanval);
  }

  // Het Stille Volk stuurt zieners mee (zieners: aantal). Eén keer per poging.
  function schenk() {
    if (s.geschonken || !r.zieners) return;
    const st = kaart.start[0];
    let n = 0;
    for (let i = 0; i < r.zieners; i++) if (leger.geef('ziener', st.y * B + st.x)) n++;
    s.geschonken = true;
    bewaar();
    if (n && r.teksten && r.teksten.zieners) toonMelding(r.teksten.zieners);
  }

  if (!s.los) zetNeer();
  schenk();

  return {
    stap(dt) {
      if (s.los || strijd.uitslag()) return;
      s.tijd += dt;
      kijk += dt;
      if (kijk < 0.5) return;
      kijk = 0;
      const mannen = strijd.reserve();
      if (!mannen.length) { s.los = true; bewaar(); return; }
      // Ontdekt door een ziener (of iemand vlakbij): een melding, de reserve wacht nog even.
      if (!s.ontdekt && mannen.some((e) => !e.onzichtbaar)) {
        s.ontdekt = true;
        bewaar();
        toonMelding((r.teksten && r.teksten.ontdekt) || 'Your seer sees soldiers hidden on the flank of the fort!');
      }
      const rood = kaart.start[1];
      const naderen = (r.los && r.los.naderen) || 9;
      const dichtbij = leger.lijst.some((a) => !a.dood && Math.hypot(a.x - rood.x, a.y - rood.y) <= naderen);
      const ontmaskerd = mannen.some((e) => leger.lijst.some((a) => !a.dood && Math.hypot(a.x - e.x, a.y - e.y) <= 3));
      if (dichtbij) laatLos("Falconer's hidden reserve strikes your flank! {n} soldiers.");
      else if (ontmaskerd) laatLos('The hidden reserve is found and attacks! {n} soldiers.');
      else if (s.tijd >= ((r.los && r.los.tijd) || 600)) laatLos("Falconer's hidden reserve marches out! {n} soldiers.");
      else if (Math.round(s.tijd) % 5 === 0) bewaar();
    },
    // Opnieuw beginnen: strijd.herstel heeft alle vijanden al weggehaald; de reserve komt terug.
    wis() {
      try { localStorage.removeItem(geheugen); } catch (e) { /* niet erg */ }
      s = nieuw();
      zetNeer();
      schenk();
    },
    // Voor de tests
    stand: () => ({ ...s, plek, aantal: strijd.reserve().length }),
    laatLos,
  };
}
