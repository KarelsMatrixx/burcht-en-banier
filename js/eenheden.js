// EENHEDEN: de poppetjes op de kaart en hoe ze lopen.
//
// Er zijn nu drie soorten:
//   - Ridders: testfiguren die een willekeurig doel kiezen, een route
//     aanvragen en erheen lopen. Daarna kiezen ze een nieuw doel.
//   - Wachters: boogschutters van rood die op zijn kasteelmuur heen en
//     weer lopen (ronde = hun vaste route). strijd.js zet ze neer.
//   - Werkers: die lopen waar economie.js ze heen stuurt.
//   - Soldaten en vijanden: die lopen waar leger.js en strijd.js ze heen
//     sturen. De soldaten van de speler kunnen ook de muur op (lagen =
//     true): in hun route is vak + N hetzelfde vak boven op de muur.
//
// Plek van een eenheid: x en y in rastermaat, met decimalen. Het midden
// van tegel (3, 5) is x = 3.5, y = 5.5. hoogte is hoe hoog hij staat in
// pixels: 0 op de grond, de muurhoogte op een muur.

import { CONFIG } from './config.js';
import { maakToeval } from './toeval.js';

export const SOORT = { RIDDER: 0, BOOGSCHUTTER: 1, HOUTHAKKER: 2, STEENHOUWER: 3, FRUITTELER: 4, BOER: 5, RAM: 6, LADDER: 7, KATAPULT: 8, TOREN: 9, ZAGER: 10, TARWEBOER: 11, BAKKER: 12, MIJNWERKER: 13, BIJLRIDDER: 14, KRUISBOOG: 15, SLUIP: 16, VLAM: 17 };

// hoogteOp(vak) geeft hoe hoog je staat boven op het bouwwerk op dat vak.
export function maakEenheden(kaart, wegvinder, muurHoogte, hoogteOp = () => muurHoogte) {
  const B = kaart.breedte;
  const N = B * kaart.hoogte;
  const lijst = [];
  let wachtrij = [];   // eenheden die op een route wachten
  let kop = 0;         // eerstvolgende in de wachtrij
  let toeval = maakToeval(1);
  let aantalRidders = 0;
  let stapNummer = 0;
  const rusters = [];   // wie geen route vond en even wacht voor een nieuwe poging

  function nieuw(vak, team, soort) {
    const x = (vak % B) + 0.5;
    const y = Math.floor(vak / B) + 0.5;
    return {
      x, y, vorigeX: x, vorigeY: y,
      team, soort,
      hoogte: 0,
      snelheid: CONFIG.proef.snelheid,
      kijkt: team === 0 ? 1 : -1,   // 1 = naar rechts, -1 = naar links
      loopt: false,
      pad: null, stap: 0,
      ronde: null,                  // vaste looproute van een wachter
      zelf: false,                  // true = kiest zelf zijn routes (een werker)
      wijkt: false,                 // true = je kunt bouwen waar hij staat; hij stapt opzij
      houding: null,                // 'hak' of 'last': een ander plaatje dan lopen
      lagen: false,                 // true = kan ook de muur op (een soldaat van de speler)
      opMuur: false,                // hij staat boven op de muur
      klimt: false,                 // hij is op de trap, in de toren: even niet te zien
    };
  }

  // De route is op of onbruikbaar. Een testfiguur krijgt een nieuw
  // willekeurig doel; een werker bepaalt zelf wat hij gaat doen.
  function vraagRoute(eenheid) {
    eenheid.pad = null;
    if (!eenheid.zelf) wachtrij.push(eenheid);
  }

  // Een werker. Waar hij heen loopt bepaalt economie.js.
  function maakWerker(vak, team, soort, snelheid) {
    const werker = nieuw(vak, team, soort);
    werker.snelheid = snelheid;
    werker.zelf = true;
    lijst.push(werker);
    return werker;
  }

  function verwijder(eenheid) {
    const plek = lijst.indexOf(eenheid);
    if (plek >= 0) lijst.splice(plek, 1);
  }

  // Zet het aantal ridders. verspreid = over de hele kaart, anders rond
  // de twee kastelen. Werkers blijven wie en waar ze zijn.
  function zetAantal(aantal, verspreid) {
    toeval = maakToeval(4242 + aantal);
    const werkers = lijst.filter((e) => e.zelf);
    lijst.length = 0;
    wachtrij = [];
    kop = 0;
    rusters.length = 0;
    aantalRidders = 0;
    for (let i = 0; i < aantal; i++) {
      const team = i % 2;
      const vak = verspreid
        ? wegvinder.willekeurigVak(toeval, null, 0, team)
        : wegvinder.willekeurigVak(toeval, kaart.start[team], 9, team);
      if (vak < 0) continue;
      const ridder = nieuw(vak, team, SOORT.RIDDER);
      lijst.push(ridder);
      aantalRidders++;
      vraagRoute(ridder);
    }
    for (const werker of werkers) lijst.push(werker);
  }

  // Eén spelstap. dt = duur van de stap in seconden.
  function stap(dt) {
    // 1. Routes uitdelen, hooguit een paar per stap. Zo blijft het spel
    //    vloeiend, ook als veel eenheden tegelijk een route willen.
    stapNummer++;
    for (let k = rusters.length - 1; k >= 0; k--) {
      if (rusters[k].rustTot > stapNummer) continue;
      wachtrij.push(rusters[k]);
      rusters.splice(k, 1);
    }
    let budget = CONFIG.proef.routesPerStap;
    while (budget > 0 && kop < wachtrij.length) {
      const eenheid = wachtrij[kop++];
      const doel = wegvinder.willekeurigVak(toeval, null, 0, eenheid.team);
      const pad = doel < 0 ? null : wegvinder.zoekPad(
        Math.floor(eenheid.x), Math.floor(eenheid.y),
        doel % B, Math.floor(doel / B),
        eenheid.team
      );
      if (pad && pad.length) {
        eenheid.pad = pad;
        eenheid.stap = 0;
      } else {
        // Geen route, bijvoorbeeld omdat hij is ingebouwd. Anderhalve
        // seconde wachten en dan opnieuw proberen.
        eenheid.rustTot = stapNummer + 15;
        rusters.push(eenheid);
      }
      budget--;
    }
    if (kop >= wachtrij.length) {
      wachtrij = [];
      kop = 0;
    }

    // 2. Lopen langs de route.
    for (let i = 0; i < lijst.length; i++) {
      const e = lijst[i];
      e.vorigeX = e.x;
      e.vorigeY = e.y;
      e.loopt = false;
      if (!e.pad) {
        if (e.klimt) land(e);   // zijn route viel weg terwijl hij op de trap was
        continue;
      }

      let rest = e.snelheid * dt;
      while (rest > 0 && e.stap < e.pad.length) {
        let vak = e.pad[e.stap];
        // Voor wie de muur op kan: vak + N is boven op de muur.
        const boven = e.lagen && vak >= N;
        if (boven) vak -= N;
        if (e.lagen) e.klimt = boven !== e.opMuur;
        const doelX = (vak % B) + 0.5;
        const doelY = Math.floor(vak / B) + 0.5;
        const dx = doelX - e.x;
        const dy = doelY - e.y;
        const afstand = Math.hypot(dx, dy);
        // Op het scherm loopt x naar rechtsonder en y naar linksonder.
        if (Math.abs(dx - dy) > 0.01) e.kijkt = dx - dy > 0 ? 1 : -1;
        if (afstand <= rest) {
          e.x = doelX;
          e.y = doelY;
          rest -= afstand;
          e.stap++;
          if (e.lagen) {
            e.opMuur = boven;
            e.hoogte = boven ? hoogteOp(vak) : 0;
            e.klimt = false;
          }
        } else {
          e.x += (dx / afstand) * rest;
          e.y += (dy / afstand) * rest;
          // Van de muur de toren op (of andersom) gaat geleidelijk omhoog.
          if (boven && !e.klimt) e.hoogte += (hoogteOp(vak) - e.hoogte) * (rest / afstand);
          rest = 0;
        }
        e.loopt = true;
      }

      if (e.stap >= e.pad.length) {
        if (e.ronde) {
          e.ronde.reverse();   // wachter: omkeren en teruglopen
          e.pad = e.ronde;
          e.stap = 1;
        } else {
          vraagRoute(e);
        }
      }
    }
  }

  // Zet iemand die halverwege de trap zijn route kwijtraakte weer neer:
  // boven op de muur als die er staat, anders op de grond.
  function land(e) {
    const x = Math.floor(e.x);
    const y = Math.floor(e.y);
    e.klimt = false;
    e.opMuur = wegvinder.isMuur(x, y, e.team);
    e.hoogte = e.opMuur ? hoogteOp(y * B + x) : 0;
  }

  // Staat er iemand op deze tegel? Dan mag je er niet bouwen.
  function staatOp(x, y) {
    for (let i = 0; i < lijst.length; i++) {
      if (!lijst[i].wijkt && Math.floor(lijst[i].x) === x && Math.floor(lijst[i].y) === y) return true;
    }
    return false;
  }

  // Er is gebouwd op deze vakken. Wie er nog langs wilde, zoekt een
  // nieuwe route. De rest loopt gewoon door.
  function kaartVeranderd(vakken) {
    for (let i = 0; i < lijst.length; i++) {
      const e = lijst[i];
      if (e.ronde || !e.pad) continue;
      for (let k = e.stap; k < e.pad.length; k++) {
        const vak = e.pad[k] >= N ? e.pad[k] - N : e.pad[k];
        if (vakken.has(vak)) {
          vraagRoute(e);
          break;
        }
      }
    }
  }

  return {
    lijst,
    stap,
    zetAantal,
    maakWerker,
    verwijder,
    staatOp,
    kaartVeranderd,
    hoogteOp,
    aantalRidders: () => aantalRidders,
    aantalWachtend: () => wachtrij.length - kop + rusters.length,
  };
}
