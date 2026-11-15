// SLACHTING: vijandelijke soldaten doden de burgers die ze tegenkomen (naar Karel).
//
// Je boeren (die rondlopen of werken) zijn burgers. Komt een aanvaller dichtbij,
// dan slaat hij er een dood: bloed, een lijk, en de boer verdwijnt uit je volk
// (economie.dodeBoer). Burgers die de vijand zien aankomen, rennen naar je burcht.
// De dorpelingen van de proloog doen hetzelfde (js/figuranten.js).
// Omgekeerd doden jouw soldaten de burgers van rood (js/roodgroei.js): ze lopen bij zijn huizen rond.

const DOOD_AFSTAND = 1.5;    // tegels
const ANGST_AFSTAND = 6;     // zo dichtbij een vijand rennen ze weg
const KANS = 0.5;            // per aanvaller per keer, drie keer per seconde
const PERIODE = 0.33;        // seconden tussen twee rondes

export function maakSlachting({ strijd, economie, wegvinder, kaart, eenheden, leger, rood = null }) {
  let klok = 0;
  let doden = 0;
  const bang = new Map();    // boer -> { snelheid }
  const afkoel = new WeakMap();

  const burgers = () => [...economie.lopers(), ...economie.werkers()].filter((e) => e && !e.dood);
  const aanvallers = () => strijd.vijanden().filter((v) => v.wachter === undefined && !v.dood);

  function ren(b) {
    if (bang.has(b)) return;
    const st = kaart.start[0];
    bang.set(b, { snelheid: b.snelheid });
    b.snelheid = Math.max(b.snelheid, 1.5);
    // Naar de burcht; werkers laten hun werk even liggen (ze hebben geen eigen route nodig)
    const pad = wegvinder.zoekPad(Math.floor(b.x), Math.floor(b.y), st.x + 2, st.y + 2, 0);
    if (pad && pad.length) { b.pad = pad; b.stap = 0; }
  }

  // Jouw soldaten en de burgers van rood
  const bangRood = new Map();
  function rodeBurgers() {
    const groei = rood && rood.groei;
    if (!groei) return;
    const burgers = groei.burgers().filter((b) => !b.dood);
    if (!burgers.length) return;
    const soldaten = leger.lijst.filter((e) => e.soldaat && !e.dood && !e.opMuur);
    const m = kaart.start[1];
    for (const b of burgers) {
      let dicht = Infinity;
      let wie = null;
      for (const v of soldaten) {
        const d = Math.hypot(v.x - b.x, v.y - b.y);
        if (d < dicht) { dicht = d; wie = v; }
      }
      if (dicht < ANGST_AFSTAND && !bangRood.has(b)) {
        bangRood.set(b, b.snelheid);
        b.snelheid = Math.max(b.snelheid, 1.4);
        const pad = wegvinder.zoekPad(Math.floor(b.x), Math.floor(b.y), m.x - 2, m.y - 2, 1);
        if (pad && pad.length) { b.pad = pad; b.stap = 0; }
      } else if (dicht > ANGST_AFSTAND + 4 && bangRood.has(b)) { b.snelheid = bangRood.get(b); bangRood.delete(b); }
      if (dicht <= DOOD_AFSTAND && wie && (afkoel.get(wie) || 0) <= performance.now() && Math.random() < KANS) {
        afkoel.set(wie, performance.now() + 900);
        wie.pose = 1;
        strijd.vermoord(b.x, b.y, '#8a6a5a');
        bangRood.delete(b);
        groei.burgerWeg(b);
        doden++;
      }
    }
  }

  return {
    stap(dt) {
      klok += dt;
      if (klok < PERIODE) return;
      klok = 0;
      rodeBurgers();
      const vijand = aanvallers();
      const bur = burgers();
      if (!vijand.length || !bur.length) {
        for (const [b, o] of bang) { b.snelheid = o.snelheid; }
        bang.clear();
        return;
      }
      for (const b of bur) {
        let dicht = Infinity;
        let wie = null;
        for (const v of vijand) {
          const d = Math.hypot(v.x - b.x, v.y - b.y);
          if (d < dicht) { dicht = d; wie = v; }
        }
        if (dicht < ANGST_AFSTAND && !b.opMuur) ren(b);
        else if (bang.has(b) && dicht > ANGST_AFSTAND + 4) { b.snelheid = bang.get(b).snelheid; bang.delete(b); }
        if (dicht <= DOOD_AFSTAND && wie && (afkoel.get(wie) || 0) <= performance.now() && Math.random() < KANS) {
          afkoel.set(wie, performance.now() + 900);
          wie.pose = 1;
          strijd.vermoord(b.x, b.y, '#a58a5a');
          bang.delete(b);
          if (economie.dodeBoer(b)) doden++;
        }
      }
    },
    doden: () => doden,
    wis() { for (const [b, o] of bang) b.snelheid = o.snelheid; bang.clear(); doden = 0; },
  };
}
