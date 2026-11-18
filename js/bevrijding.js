// BEVRIJDING: doeltype D uit het campagneplan (level 10, Mournkeep).
//
// Wessel zit in de Raaftoren, tussen de buitenste en de middelste ring. Breng een
// soldaat van jou naar de deur van de toren en houd daar stand: na 15 seconden achter
// elkaar ben je er. De toren zelf is onkwetsbaar (hij is van niemand), zodat Wessel nooit
// in gevaar komt. Hertog Ottger vecht zelf niet: zijn koningsfiguur kan niet sneuvelen.
// Reinout heeft een gat in de buitenste ring opengemaakt (kastelen.json: open).
//
// Is het doel gehaald, dan stopt het gevecht (strijd.staak), volgen drie korte kaartjes
// van het slot en daarna het winstscherm met de epiloog (campagne.json: uit).
//
// In data/campagne.json bij het level:
//   doel: { soort: 'bevrijden', seconden: 15, straal: 1.7, slot: [ { wie, naam, portret, tekst } ],
//           teksten: { begin, taak, houd, weg } }

import { OBJECT } from './kaart.js';

export function maakBevrijding({ missie, kaart, strijd, leger, toonVerhaal, toonTaak, toonMelding, kijkNaar }) {
  const d = missie.doel;
  const T = d.teksten || {};
  const nodig = d.seconden || 15;
  const straal = d.straal || 1.7;
  const B = kaart.breedte;
  const torenVak = kaart.object.indexOf(OBJECT.RAAFTOREN);
  const tx = (torenVak % B) + 0.5;
  const ty = Math.floor(torenVak / B) + 0.5;
  let loopt = false;
  let tijd = 0;
  let kijk = 0;
  let slot = -1;          // -1: nog bezig; daarna de stap in het slot
  let slotTijd = 0;
  let begonnen = false;

  const bijDeur = () => leger.lijst.filter((e) => !e.dood && !e.opMuur && Math.hypot(e.x - tx, e.y - ty) <= straal);

  function begin() {
    if (begonnen) return;
    begonnen = true;
    strijd.beschermKoning(true);
    if (T.begin) toonVerhaal({ naam: 'Reinout', portret: 'reinout', tekst: T.begin });
  }

  function startSlot() {
    slot = 0;
    slotTijd = 0;
    toonTaak('');
    strijd.staak();
    if (torenVak >= 0 && kijkNaar) kijkNaar(Math.floor(tx), Math.floor(ty));
    toonSlot();
  }
  function toonSlot() {
    const kaartje = (d.slot || [])[slot];
    if (!kaartje) {
      strijd.beslis('gewonnen', { staak: true });
      return;
    }
    toonVerhaal({ naam: kaartje.naam, portret: kaartje.portret, tekst: kaartje.tekst });
  }

  return {
    start() { loopt = true; begin(); },
    stap(dt) {
      if (!loopt) return;
      if (slot >= 0) {
        if (strijd.uitslag()) return;
        slotTijd += dt;
        if (slotTijd >= (d.slotSeconden || 6)) {
          slotTijd = 0;
          slot++;
          toonSlot();
        }
        return;
      }
      if (strijd.uitslag() || torenVak < 0) return;
      kijk += dt;
      tijd = bijDeur().length ? tijd + dt : 0;
      if (kijk < 0.5 && tijd < nodig) return;
      kijk = 0;
      if (tijd >= nodig) { startSlot(); return; }
      if (tijd > 0) toonTaak((T.houd || 'Hold at the door of the Raven Tower: {s} s').replace('{s}', Math.ceil(nodig - tijd)));
      else toonTaak(T.taak || 'Bring a soldier to the door of the Raven Tower');
    },
    wis() {
      tijd = 0;
      slot = -1;
      slotTijd = 0;
      begonnen = false;
      if (loopt) begin();
    },
    omschrijving: () => `Your goal: free Wessel. Bring a soldier to the door of the Raven Tower, between the outer and the middle ring, and hold there for ${nodig} seconds. Duke Ottger does not fight. If your king falls, you lose.`,
    // Voor de tests
    toren: () => ({ vak: torenVak, x: tx, y: ty }),
    tijd: () => tijd,
    slot: () => slot,
  };
}
