// SLUIPERS: ongeveer dertig plekken verspreid over de kaart (level 4, The Fen, naar Karel).
// Loopt een werker of soldaat van jou over zo'n plek, dan duikt er uit het niets precies
// één sluipmoordenaar van rood op, vlak naast hem, en die valt aan. Elke plek werkt één keer.
//
// Instelling in data/campagne.json bij het level:
//   "sluipers": { "aantal": 30, "soort": "sluipmoordenaar", "straal": 1.3,
//                 "mijdKasteel": 13, "mijdHut": 6, "zaad": 404 }
// De plekken zijn vast per kaart (zelfde zaad, zelfde plekken), niet zichtbaar, en liggen op
// droog land dat rood te voet kan bereiken, niet vlak bij jouw kasteel of bij de hut.
// De stand (welke plekken al gebruikt zijn) staat in localStorage, zodat herladen ze niet opnieuw geeft.

import { maakToeval } from './toeval.js';
import { OBJECT } from './kaart.js';

const SLEUTEL = 'burcht-banier.sluipers.';

export function maakSluipers({ missie, kaart, eenheden, leger, strijd, wegvinder, toonMelding }) {
  const ins = missie.sluipers;
  const geheugen = SLEUTEL + missie.id;
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const aantal = ins.aantal || 30;
  const soort = ins.soort || 'sluipmoordenaar';
  const straal = ins.straal || 1.3;
  const mijdKasteel = ins.mijdKasteel || 13;
  const mijdHut = ins.mijdHut || 6;
  let gebruikt = lees();
  let kijk = 0;
  let gemeld = false;

  function lees() { try { return new Set(JSON.parse(localStorage.getItem(geheugen) || '[]')); } catch (e) { return new Set(); } }
  function bewaar() { try { localStorage.setItem(geheugen, JSON.stringify([...gebruikt])); } catch (e) { /* niet erg */ } }

  const mijdVan = (x, y, p, r) => !!p && Math.hypot(x - p.x, y - p.y) < r;

  // De plekken: de kaart in een raster van ongeveer evenveel vakken als er plekken zijn, in elk
  // vak één plek (met vast toeval gekozen), zodat ze verspreid liggen en niet op een hoop.
  function maakPlekken() {
    const toeval = maakToeval(ins.zaad || 404);
    const kolommen = Math.max(1, Math.round(Math.sqrt(aantal * (B / H))));
    const rijen = Math.max(1, Math.ceil(aantal / kolommen));
    const jij = kaart.start[0];
    const hv = kaart.object.indexOf(OBJECT.HUT);   // de hut van Gesina (staat er al voor de eerste stap)
    const hut = hv >= 0 ? { x: hv % B, y: Math.floor(hv / B) } : null;
    const lijst = [];
    const kandidaat = (x, y) => x >= 2 && y >= 2 && x < B - 2 && y < H - 2
      && kaart.object[y * B + x] === 0 && wegvinder.isVrij(x, y, 1) && wegvinder.isVrij(x, y, 0)
      && !mijdVan(x, y, jij, mijdKasteel) && !mijdVan(x, y, hut, mijdHut)
      && lijst.every((q) => Math.hypot(q.x - x, q.y - y) >= 4);
    for (let r = 0; r < rijen; r++) {
      for (let k = 0; k < kolommen; k++) {
        const x0 = Math.floor((k * B) / kolommen);
        const x1 = Math.floor(((k + 1) * B) / kolommen);
        const y0 = Math.floor((r * H) / rijen);
        const y1 = Math.floor(((r + 1) * H) / rijen);
        // een paar worpen in het eigen raster; lukt dat niet, dan blijft het raster leeg
        for (let poging = 0; poging < 40; poging++) {
          const x = x0 + Math.floor(toeval() * Math.max(1, x1 - x0));
          const y = y0 + Math.floor(toeval() * Math.max(1, y1 - y0));
          if (kandidaat(x, y)) { lijst.push({ x, y }); break; }
        }
      }
    }
    // Te weinig (rasters zonder droog land): aanvullen op willekeurige geschikte vakken
    for (let poging = 0; lijst.length < aantal && poging < 4000; poging++) {
      const x = 2 + Math.floor(toeval() * (B - 4));
      const y = 2 + Math.floor(toeval() * (H - 4));
      if (kandidaat(x, y)) lijst.push({ x, y });
    }
    return lijst.slice(0, aantal);
  }

  let plekken = null;
  const loopt = () => {
    const wie = [];
    for (const e of leger.lijst) if (!e.dood) wie.push(e);
    for (const e of eenheden.lijst) if (!e.dood && e.zelf && e.team === 0) wie.push(e);   // werkers van jou
    return wie;
  };

  // Een vrij vak naast de plek, waar de sluipmoordenaar uit het niets opduikt
  function vakBij(p, wie) {
    const kies = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (wegvinder.isVrij(p.x + dx, p.y + dy, 1)) kies.push({ x: p.x + dx, y: p.y + dy, d: Math.hypot(p.x + dx + 0.5 - wie.x, p.y + dy + 0.5 - wie.y) });
      }
    }
    kies.sort((a, b) => a.d - b.d);
    // liefst niet precies op de speler zelf, maar wel vlakbij
    const k = kies.find((q) => q.d >= 0.9) || kies[0] || p;
    return k.y * B + k.x;
  }

  function spring(nummer, wie) {
    gebruikt.add(nummer);
    bewaar();
    const e = strijd.duikOp(soort, vakBij(plekken[nummer], wie));
    if (e && !gemeld) {
      gemeld = true;
      if (toonMelding) toonMelding('An assassin leaps out of the reeds!');
    }
    return e;
  }

  return {
    stap(dt) {
      if (strijd.uitslag()) return;
      kijk += dt;
      if (kijk < 0.3) return;
      kijk = 0;
      if (!plekken) plekken = maakPlekken();
      const wie = loopt();
      for (let n = 0; n < plekken.length; n++) {
        if (gebruikt.has(n)) continue;
        const p = plekken[n];
        const raak = wie.find((e) => Math.hypot(e.x - (p.x + 0.5), e.y - (p.y + 0.5)) <= straal);
        if (raak) spring(n, raak);
      }
    },
    plekken: () => (plekken = plekken || maakPlekken()).map((p, n) => ({ ...p, gebruikt: gebruikt.has(n) })),
    gebruikt: () => gebruikt.size,
    springNu: (n, wie) => spring(n, wie),
    wis() { gebruikt = new Set(); bewaar(); gemeld = false; kijk = 0; },
  };
}
