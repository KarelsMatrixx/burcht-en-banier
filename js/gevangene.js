// GEVANGENE: een gevangene in het kasteel van rood (level 5: Broeder Ludolf).
// In campagne.json staat bij het level: "gevangene": { "naam": "Brother Ludolf" }.
// Op het binnenplein van rood komt een stenen cel (OBJECT.CEL, decor, dus niet te
// slopen en niet te beklimmen) met de monnik achter de tralies. Valt de burcht van
// rood, dan gaat de cel open (OBJECT.CEL_OPEN). De plek wordt bewaard met de kaart.
import { OBJECT } from './kaart.js';

export function maakGevangene({ kaart, missie }) {
  if (!missie || !missie.gevangene) return null;
  const B = kaart.breedte;
  const H = kaart.hoogte;
  const vindt = () => {
    for (let i = 0; i < B * H; i++) if (kaart.object[i] === OBJECT.CEL || kaart.object[i] === OBJECT.CEL_OPEN) return i;
    return -1;
  };
  let vak = vindt();
  if (vak < 0) {
    // Op het binnenplein van rood, naast zijn hoofdkasteel, aan de kant van de kijker (zuidoost).
    const s = kaart.start[1];
    const kandidaten = [[2, 2], [3, 2], [2, 3], [3, 1], [1, 3], [-2, 2], [2, -2], [3, 3], [-3, 2], [2, -3]];
    for (const [dx, dy] of kandidaten) {
      const x = s.x + dx;
      const y = s.y + dy;
      if (x < 1 || y < 1 || x >= B - 1 || y >= H - 1) continue;
      const i = y * B + x;
      if (kaart.object[i] !== OBJECT.GEEN || kaart.grond[i] === 3) continue;   // 3 = water
      kaart.object[i] = OBJECT.CEL;
      vak = i;
      break;
    }
  }
  return {
    vak: () => vak,
    naam: missie.gevangene.naam,
    bevrijd() {
      if (vak >= 0 && kaart.object[vak] === OBJECT.CEL) kaart.object[vak] = OBJECT.CEL_OPEN;
    },
  };
}
