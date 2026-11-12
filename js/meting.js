// METING: de prestatietest. Eén druk op de knop, daarna ongeveer 20
// seconden wachten. De camera doorloopt drie vaste standen, zodat elke
// meting op elke telefoon hetzelfde meet.
//
// Uitkomst: beelden per seconde per stand, en een oordeel. Onder de 30
// beelden per seconde is canvas niet snel genoeg en moeten we overleggen.

import { CONFIG } from './config.js';
import { kaartGrenzen } from './iso.js';

const OPWARMEN = 1500;   // ms, telt niet mee
const METEN = 5000;      // ms per stand

const komma = (getal, cijfers = 1) => getal.toFixed(cijfers).replace('.', ',');

export function maakMeting({ kaart, camera, eenheden, ui }) {
  const grenzen = kaartGrenzen(kaart.breedte, kaart.hoogte);
  const middenX = (grenzen.links + grenzen.rechts) / 2;
  const middenY = (grenzen.boven + grenzen.onder) / 2;

  const STANDEN = [
    { naam: 'Close up', zet: () => { camera.zetZoom(1.2); camera.kijkNaar(middenX, middenY); } },
    { naam: 'Whole map', zet: () => { camera.zetZoom(CONFIG.camera.zoomMin); camera.kijkNaar(middenX, middenY); } },
    {
      naam: 'Moving',
      zet: (deel) => {
        camera.zetZoom(1);
        camera.kijkNaar(grenzen.links * 0.6 + (grenzen.rechts - grenzen.links) * 0.6 * deel, middenY);
      },
    },
  ];

  let bezig = false;
  let stand = 0;
  let tijdInStand = 0;
  let uitkomsten = [];
  let nu = null;          // tellers van de stand die nu gemeten wordt
  let venster = null;     // halve seconde, voor het laagste aantal beelden
  let reken = null;
  let aantalFiguren = 0;

  const nieuweTellers = () => ({ beelden: 0, tijd: 0, tekenTijd: 0, laagste: Infinity });

  // aantal = met hoeveel testfiguren er gemeten wordt, daarna = hoeveel er
  // na afloop weer moeten staan.
  function start(aantal, daarna = aantal) {
    if (bezig) return;
    aantalFiguren = daarna;
    eenheden.zetAantal(aantal, true);
    bezig = true;
    stand = 0;
    tijdInStand = 0;
    uitkomsten = [];
    nu = nieuweTellers();
    venster = { beelden: 0, tijd: 0 };
    reken = { stappen: 0, tijd: 0, hoogste: 0 };
    ui.toonVoortgang(`Measuring: ${STANDEN[0].naam} (1 of ${STANDEN.length})`);
  }

  // Wordt elk beeld aangeroepen door de spellus.
  function beeld(verstreken, tekenMs) {
    if (!bezig) return;
    tijdInStand += verstreken;
    const metenSinds = tijdInStand - OPWARMEN;
    STANDEN[stand].zet(Math.max(0, Math.min(1, metenSinds / METEN)));
    if (metenSinds <= 0) return;

    nu.beelden++;
    nu.tijd += verstreken;
    nu.tekenTijd += tekenMs;
    venster.beelden++;
    venster.tijd += verstreken;
    if (venster.tijd >= 500) {
      nu.laagste = Math.min(nu.laagste, (venster.beelden * 1000) / venster.tijd);
      venster = { beelden: 0, tijd: 0 };
    }

    if (metenSinds >= METEN) {
      uitkomsten.push({
        naam: STANDEN[stand].naam,
        beeldenPerSeconde: (nu.beelden * 1000) / nu.tijd,
        laagste: nu.laagste === Infinity ? (nu.beelden * 1000) / nu.tijd : nu.laagste,
        tekenMs: nu.tekenTijd / nu.beelden,
      });
      stand++;
      tijdInStand = 0;
      nu = nieuweTellers();
      venster = { beelden: 0, tijd: 0 };
      if (stand >= STANDEN.length) rondAf();
      else ui.toonVoortgang(`Measuring: ${STANDEN[stand].naam} (${stand + 1} of ${STANDEN.length})`);
    }
  }

  // Wordt elke rekenstap aangeroepen door de spellus.
  function stapGedaan(rekenMs) {
    if (!bezig) return;
    reken.stappen++;
    reken.tijd += rekenMs;
    reken.hoogste = Math.max(reken.hoogste, rekenMs);
  }

  function rondAf() {
    bezig = false;
    const traagste = Math.min(...uitkomsten.map((u) => u.beeldenPerSeconde));
    const zwaarsteTekenen = Math.max(...uitkomsten.map((u) => u.tekenMs));
    const allesRond30 = uitkomsten.every((u) => u.beeldenPerSeconde > 27 && u.beeldenPerSeconde < 33);

    let oordeel;
    if (allesRond30 && zwaarsteTekenen < 12) {
      oordeel = 'UNCLEAR. Your screen seems capped at 30 fps.\nIs low power mode on? Turn it off and measure again.';
    } else if (traagste >= 50) {
      oordeel = 'MORE THAN ENOUGH. Canvas can handle this.';
    } else if (traagste >= 30) {
      oordeel = 'ENOUGH, but with little margin.';
    } else {
      oordeel = 'NOT ENOUGH. Discuss this before we build further.';
    }

    const regels = [
      `Measurement done: ${aantalFiguren} figures`,
      '',
      ...uitkomsten.map(
        (u) =>
          `${u.naam.padEnd(11)} ${komma(u.beeldenPerSeconde, 0).padStart(3)} fps` +
          ` (lowest ${komma(u.laagste, 0)}) · drawing ${komma(u.tekenMs)} ms`
      ),
      `Logic       ${komma(reken.stappen ? reken.tijd / reken.stappen : 0)} ms per step (highest ${komma(reken.hoogste)})`,
      '',
      `Verdict: ${oordeel}`,
      '',
      `v${CONFIG.versie} · screen ${camera.breedte}×${camera.hoogte} · pixelratio ${window.devicePixelRatio || 1}`,
    ];
    ui.toonVoortgang('');
    ui.toonUitslag(regels.join('\n'));
    eenheden.zetAantal(aantalFiguren, false);
  }

  return { start, beeld, stapGedaan, isBezig: () => bezig, laatste: () => uitkomsten };
}
