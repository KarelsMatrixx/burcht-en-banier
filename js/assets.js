// ASSETS: levert voor elke naam (bijvoorbeeld "object.boom") een plaatje.
//
// Welke plaatjes er zijn en hoe ze eruitzien staat in data/assets.json.
// Zolang er geen sprite is ingevuld, tekent kunst.js het plaatje met code.
// Vul je bij "sprite" een bestandsnaam in en staat dat bestand in
// assets/sprites/, dan gebruikt het spel dat plaatje. De rest van de code
// merkt geen verschil.
//
// Ankerpunt: bij grond, bomen, rotsen en kasteeldelen de ONDERSTE punt van
// de tegelruit; bij soldaten de plek van de voeten.

import {
  tekenGrond, tekenBoom, tekenRots, tekenRidder, tekenBoogschutter, tekenRam, tekenLadderdrager, tekenKatapult, tekenBelegeringstoren,
  tekenMuur, tekenToren, tekenWachttoren, tekenPoort, tekenBurcht,
  tekenHuis, tekenTent, tekenHooiberg, tekenPut, tekenVaten,
  tekenWerker, tekenHouthakker, tekenSteengroeve, tekenBoomgaard, tekenTarweveld, tekenBakkerij, tekenKazerne,
} from './kunst.js';

const VORMEN = {
  grond: tekenGrond,
  boom: tekenBoom,
  rots: tekenRots,
  ridder: tekenRidder,
  boogschutter: tekenBoogschutter,
  ram: tekenRam,
  ladderdrager: tekenLadderdrager,
  katapult: tekenKatapult,
  belegeringstoren: tekenBelegeringstoren,
  muur: tekenMuur,
  toren: tekenToren,
  wachttoren: tekenWachttoren,
  poort: tekenPoort,
  burcht: tekenBurcht,
  huis: tekenHuis,
  tent: tekenTent,
  hooiberg: tekenHooiberg,
  put: tekenPut,
  vaten: tekenVaten,
  werker: tekenWerker,
  houthakker: tekenHouthakker,
  steengroeve: tekenSteengroeve,
  boomgaard: tekenBoomgaard,
  tarweveld: tekenTarweveld,
  bakkerij: tekenBakkerij,
  kazerne: tekenKazerne,
};

async function laadSprite(pad) {
  const plaatje = new Image();
  plaatje.src = pad;
  await plaatje.decode();
  return plaatje;
}

export async function laadAssets() {
  const antwoord = await fetch('data/assets.json');
  if (!antwoord.ok) throw new Error('Kan data/assets.json niet laden');
  const lijst = (await antwoord.json()).assets;

  const tabel = new Map();
  const meldingen = [];

  for (const [naam, def] of Object.entries(lijst)) {
    const maak = VORMEN[def.vorm];
    if (!maak) throw new Error(`assets.json: onbekende vorm "${def.vorm}" bij ${naam}`);
    const asset = maak(naam, def);
    asset.spreiding = def.spreiding || 0;
    asset.hoogte = def.hoogte || 0;

    // Een eigen plaatje vervangt de getekende versie. Dit werkt nu voor
    // onderdelen met één plaatje; varianten en loopbeelden volgen later.
    if (def.sprite) {
      if (asset.varianten || asset.rechts) {
        meldingen.push(`${naam}: een eigen plaatje voor dit onderdeel kan nog niet.`);
      } else {
        try {
          const plaatje = await laadSprite('assets/sprites/' + def.sprite);
          const schaal = def.schaal || 1;
          asset.beeld = plaatje;
          asset.b = plaatje.naturalWidth / schaal;
          asset.h = plaatje.naturalHeight / schaal;
          asset.ax = def.anker ? def.anker[0] : asset.b / 2;
          asset.ay = def.anker ? def.anker[1] : asset.h;
        } catch (fout) {
          meldingen.push(`Plaatje ${def.sprite} niet gevonden. Getekende versie gebruikt voor ${naam}.`);
        }
      }
    }
    tabel.set(naam, asset);
  }

  return {
    meldingen,
    haal(naam) {
      const asset = tabel.get(naam);
      if (!asset) throw new Error(`Asset "${naam}" staat niet in data/assets.json`);
      return asset;
    },
  };
}
