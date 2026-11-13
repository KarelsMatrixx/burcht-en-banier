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
  tekenWerker, tekenHouthakker, tekenSteengroeve, tekenBoomgaard, tekenTarweveld, tekenBakkerij, tekenKopermijn, tekenBijlridder, tekenKruisboogschutter, tekenSluipmoordenaar, tekenVlammenwever, tekenMagiertoren, tekenKoning, tekenKazerne,
} from './kunst.js';
import { SOLDATEN, teken as tekenNieuw } from './soldaten.js';
import { MACHINES } from './machines.js';

const VORMEN = {
  grond: tekenGrond,
  boom: tekenBoom,
  rots: tekenRots,
  ridder: tekenRidder,
  boogschutter: tekenBoogschutter,
  bijlridder: tekenBijlridder,
  kruisboogschutter: tekenKruisboogschutter,
  sluipmoordenaar: tekenSluipmoordenaar,
  vlammenwever: tekenVlammenwever,
  magiertoren: tekenMagiertoren,
  koning: tekenKoning,
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
  kopermijn: tekenKopermijn,
  kazerne: tekenKazerne,
};

// Stap 33: soldaten en werkers in de nieuwe stijl (soldaten.js).
for (const vorm of [...Object.keys(SOLDATEN), 'werker']) VORMEN[vorm] = (naam, def) => tekenNieuw(vorm, def, naam);
Object.assign(VORMEN, MACHINES);   // ram, katapult, belegeringstoren met omlijning

async function laadSprite(pad) {
  const plaatje = new Image();
  plaatje.src = pad;
  await plaatje.decode();
  return plaatje;
}

// aanpassing: per naam velden die over assets.json heen gaan (stap 32: de
// rode koning krijgt per level de kleding en het wapen van de heer).
// extra: nieuwe namen als kopie van een bestaande, { naam: { basis, ...velden } }
// (stap 33: het materiaal van het kasteel van rood).
export async function laadAssets(aanpassing = {}, extra = {}) {
  const antwoord = await fetch('data/assets.json');
  if (!antwoord.ok) throw new Error('Kan data/assets.json niet laden');
  const lijst = { ...(await antwoord.json()).assets };
  for (const [naam, { basis, ...velden }] of Object.entries(extra)) {
    if (lijst[basis]) lijst[naam] = { ...lijst[basis], ...velden };
  }

  const tabel = new Map();
  const meldingen = [];

  for (const [naam, basis] of Object.entries(lijst)) {
    const def = { ...basis, ...(aanpassing[naam] || {}) };
    if (def.hoogteFactor) def.hoogte = Math.round((def.hoogte || 0) * def.hoogteFactor);
    const maak = VORMEN[def.vorm];
    if (!maak) throw new Error(`assets.json: onbekende vorm "${def.vorm}" bij ${naam}`);
    const asset = maak(naam, def);
    asset.spreiding = def.spreiding || 0;
    asset.hoogte = def.hoogte || 0;

    // Een eigen plaatje vervangt de getekende versie. Dit werkt nu voor
    // onderdelen met één plaatje; varianten en loopbeelden volgen later.
    if (def.sprite) {
      if (asset.varianten || asset.rechts) {
        meldingen.push(`${naam}: a custom image for this part is not supported yet.`);
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
          meldingen.push(`Image ${def.sprite} not found. Using the drawn version for ${naam}.`);
        }
      }
    }
    tabel.set(naam, asset);
  }

  return {
    meldingen,
    heeft: (naam) => tabel.has(naam),
    haal(naam) {
      const asset = tabel.get(naam);
      if (!asset) throw new Error(`Asset "${naam}" staat niet in data/assets.json`);
      return asset;
    },
  };
}
