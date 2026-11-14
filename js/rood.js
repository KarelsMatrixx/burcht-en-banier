// DE RODE HEER: rood heeft zijn eigen economie en beslist zelf wanneer hij aanvalt.
//
// Tot stap 14 kwamen de aanvallen op de klok. Nu niet meer:
//   - Rood heeft een voorraad (hout, steen, goud). Zijn burcht geeft wat goud,
//     en elk werk van rood dat nog staat (houthakkershut, steengroeve,
//     boomgaard) geeft meer. Sloop je die werken, dan verdient hij minder.
//   - Hij koopt soldaten en houdt ze in zijn burcht (de reserve). Rammen en
//     ladders koopt hij pas vanaf zijn vierde aanval, een katapult vanaf
//     zijn zesde en een belegeringstoren vanaf zijn zevende.
//   - Hij valt aan als zijn reserve sterk genoeg is. Elke aanval is wat
//     sterker eisend dan de vorige, en er zit een minimale tijd tussen.
//   - Zijn muren en werken herstelt hij zelf, als hij de grondstoffen heeft
//     en er geen soldaat van jou in de buurt staat.
//   - Komen jouw soldaten dicht bij zijn burcht, dan doet hij een uitval met
//     zijn hele reserve.
//
// Alle getallen staan in data/economie.json onder "heer".

import { OBJECT } from './kaart.js';

const GRONDSTOFFEN = ['hout', 'steen', 'goud'];

export function maakRood({ regels, kaart, bouwwerken, leger, strijd, eenheden, perSeconde, opMelding, opVerandering, veld = null }) {
  const H = regels.heer;
  if (!H) return null;
  const dt = 1 / perSeconde;
  const soorten = regels.soldaten;
  const B = kaart.breedte;

  // Hoe zwaar een soort telt voor de sterkte van de reserve.
  const gewicht = H.gewicht;
  const sterkteVan = (reserve) => Object.entries(reserve).reduce((som, [k, n]) => som + (gewicht[k] || 1) * n, 0);

  // Kosten van opnieuw bouwen, per soort object.
  const kostenVan = new Map();
  for (const werk of Object.values(bouwwerken)) {
    if (Number.isInteger(werk.soort)) kostenVan.set(werk.soort, werk.kosten || {});
  }
  const bouwKosten = (soort) => kostenVan.get(soort) || { hout: 10 };

  // Welke vakken geven inkomen: de werken van rood op de kaart.
  const werken = [];
  for (let i = 0; i < B * kaart.hoogte; i++) {
    if (kaart.eigenaar[i] !== 2) continue;
    const geeft = H.werken[Object.keys(OBJECT).find((s) => OBJECT[s] === kaart.object[i])];
    if (geeft) werken.push({ vak: i, soort: kaart.object[i], geeft });
  }

  // --- De stand van de heer ---------------------------------------------------------------
  let voorraad;
  let reserve;
  let sinds;            // seconden sinds de laatste aanval (of sinds het begin)
  let aanvallen;        // hoeveel aanvallen er gestuurd zijn
  let kooptKlok;
  let herbouwKlok;
  let uitvalKlok;

  function begin() {
    voorraad = { hout: 0, steen: 0, goud: 0, ...H.begin };
    reserve = {};
    sinds = 0;
    aanvallen = 0;
    kooptKlok = H.kooptElke;
    herbouwKlok = H.herbouwElke;
    uitvalKlok = 0;
  }
  begin();

  const staand = () => werken.filter((w) => kaart.eigenaar[w.vak] === 2 && kaart.object[w.vak] === w.soort);
  // Elke derde aanval is een piek (veldheer, niveau 3): dan is zijn doel hoger, en daarna rust hij langer.
  const piek = () => (veld ? veld.piek(aanvallen + 1) : 1);
  const doel = () => Math.min(H.doelMax, H.doelBegin + H.doelPerAanval * aanvallen) * piek();
  const wachtTijd = () => (aanvallen === 0 ? H.eersteAanval : H.tussen * (veld ? veld.rust(aanvallen) : 1));
  const sterkte = () => sterkteVan(reserve);
  const aantal = () => Object.values(reserve).reduce((a, b) => a + b, 0);
  const opdracht = () => Math.max(wachtTijd(), 0) - sinds;

  // Inkomen per seconde, als geheel.
  function inkomen() {
    const uit = { hout: 0, steen: 0, goud: 0 };
    if (strijd.rood().leven > 0) uit.goud += H.burchtGoud;
    for (const w of staand()) for (const [k, v] of Object.entries(w.geeft)) uit[k] += v;
    return uit;
  }

  // Rood maakt geen planken: wat planken kost, betaalt hij met hout.
  // Eén plank kost hem twee hout, net als de verhouding in de bouwkosten.
  // Koper heeft hij ook niet: dat betaalt hij met goud (koperPrijs per stuk).
  const g = (k) => (k === 'planken' ? 'hout' : k === 'koper' ? 'goud' : k);
  const keer = (k) => (k === 'planken' ? 2 : k === 'koper' ? H.koperPrijs || 2 : 1);
  const omzet = (kosten) => {
    const u = {};
    for (const [k, n] of Object.entries(kosten || {})) u[g(k)] = (u[g(k)] || 0) + n * keer(k);
    return u;
  };
  const kanBetalen = (kosten) => Object.entries(omzet(kosten)).every(([k, n]) => (voorraad[k] || 0) >= n);
  function betaal(kosten) {
    for (const [k, n] of Object.entries(omzet(kosten))) voorraad[k] -= n;
  }

  // Wat koopt hij nu? Rammen en ladders pas na de derde aanval. Wil hij een
  // ram en mist hij alleen nog goud, dan spaart hij ervoor in plaats van
  // goedkopere soldaten te kopen (anders komt hij er nooit aan toe).
  function kiesKoop() {
    const tel = (k) => reserve[k] || 0;
    // Zwaarder materieel (katapult, belegeringstoren) komt later in het spel.
    for (const [soort, w] of Object.entries(H.extra_soorten || {})) {
      if (aanvallen < w.vanaf || tel(soort) >= w.max) continue;
      const kosten = soorten[soort].kosten;
      if (kanBetalen(kosten)) return soort;
      if (Object.entries(omzet(kosten)).every(([k, n]) => k === 'goud' || (voorraad[k] || 0) >= n)) return null;   // sparen
    }
    if (aanvallen >= H.rammenVanaf) {
      const max = Math.min(H.rammenMax + (veld ? veld.extraRam(aanvallen + 1) : 0), aanvallen - H.rammenVanaf + 1);
      for (const soort of ['ram', 'ladder']) {
        if (tel(soort) >= max) continue;
        const kosten = soorten[soort].kosten;
        if (kanBetalen(kosten)) return soort;
        const alleenGoud = Object.entries(omzet(kosten)).every(([k, n]) => k === 'goud' || (voorraad[k] || 0) >= n);
        if (alleenGoud) return null;   // sparen
      }
    }
    // Zijn gewone mannen: een mengsel volgens heer.leger (aandeel per soort,
    // en vanaf welke aanval hij die soort kent). Hij koopt de soort die het
    // verst achterloopt op zijn aandeel.
    const leger = H.leger || { ridder: { aandeel: H.ridderPerSchutter || 2 }, boogschutter: { aandeel: 1 } };
    // Veldheer, niveau 4: hij kijkt naar jouw leger en past zijn mengsel daarop aan.
    const kandidaten = Object.entries(leger)
      .filter(([soort, w]) => soorten[soort] && aanvallen >= (w.vanaf || 0) && w.aandeel > 0)
      .map(([soort, w]) => [soort, { ...w, aandeel: w.aandeel * (veld ? veld.tegenFactor(soort, aanvallen + 1) : 1) }]);
    if (!kandidaten.length) return null;
    const totaal = kandidaten.reduce((som, [, w]) => som + w.aandeel, 0);
    const aantal = kandidaten.reduce((som, [soort]) => som + tel(soort), 0) + 1;
    kandidaten.sort((a, b) => tel(a[0]) / aantal - a[1].aandeel / totaal - (tel(b[0]) / aantal - b[1].aandeel / totaal));
    const soort = kandidaten[0][0];
    if (kanBetalen(soorten[soort].kosten)) return soort;
    // Mist hij alleen goud voor een duurdere soort, dan spaart hij; anders
    // neemt hij een ridder als hij die wel kan betalen.
    if (soort !== 'ridder' && Object.entries(omzet(soorten[soort].kosten)).every(([k, n]) => k === 'goud' || (voorraad[k] || 0) >= n)) return null;
    return kanBetalen(soorten.ridder.kosten) ? 'ridder' : null;
  }

  function koop() {
    // Hij koopt niet veel meer dan hij nodig heeft voor de volgende aanval.
    if (sterkte() >= doel() + H.extra) return;
    const soort = kiesKoop();
    if (!soort) return;
    betaal(soorten[soort].kosten);
    reserve[soort] = (reserve[soort] || 0) + 1;
  }

  // Zijn mannen vertrekken. Geeft het aantal dat echt op de kaart kwam.
  function stuur(melding, telAls) {
    const inhoud = { ...reserve };
    // Een deel van de mannen blijft thuis (veldheer, niveau 2): voor een uitval en de volgende aanval.
    const thuis = telAls && veld ? veld.behoud(inhoud, aanvallen + 1) : {};
    const n = strijd.stuurLeger(inhoud, telAls);
    reserve = thuis;
    if (telAls) {
      aanvallen++;
      sinds = 0;
    }
    if (melding && n) opMelding(melding(n));
    return n;
  }

  // Zijn herstel: één stuk per keer, het nuttigste eerst.
  function herbouw() {
    const weg = strijd.roodWeg();
    if (!weg.length) return;
    const soldaten = leger.lijst;
    const veilig = (vak) => {
      const x = vak % B + 0.5;
      const y = Math.floor(vak / B) + 0.5;
      for (const e of soldaten) if (Math.abs(e.x - x) + Math.abs(e.y - y) < H.herbouwVrij) return false;
      for (const e of strijd.vijanden()) if (Math.abs(e.x - x) < 0.9 && Math.abs(e.y - y) < 0.9) return false;
      for (const e of strijd.wachters()) if (Math.abs(e.x - x) < 0.9 && Math.abs(e.y - y) < 0.9) return false;
      return true;
    };
    const kandidaten = weg
      .map((vak) => {
        const soort = strijd.origineelVan(vak);
        const werk = werken.some((w) => w.vak === vak);
        return { vak, soort, werk, kosten: bouwKosten(soort) };
      })
      .filter((c) => c.soort !== undefined && kanBetalen(c.kosten) && veilig(c.vak))
      // Eerst de werken (daar verdient hij aan), dan wat het goedkoopst is.
      .sort((a, b) => (b.werk ? 1 : 0) - (a.werk ? 1 : 0) || Object.values(a.kosten).reduce((s, n) => s + n, 0) - Object.values(b.kosten).reduce((s, n) => s + n, 0));
    if (!kandidaten.length) return;
    const k = kandidaten[0];
    betaal(k.kosten);
    strijd.herbouwVak(k.vak);
  }

  // Staan er soldaten van jou vlak bij zijn burcht?
  function bedreigd() {
    const r = strijd.rood();
    if (r.leven <= 0) return false;
    return leger.lijst.some((e) => Math.abs(e.x - r.x) + Math.abs(e.y - r.y) <= H.uitvalAfstand);
  }

  // Eén rekenstap, vanuit strijd.stap().
  function stap() {
    sinds += dt;
    const uit = inkomen();
    for (const k of GRONDSTOFFEN) voorraad[k] = Math.min(H.voorraadMax, voorraad[k] + uit[k] * dt);

    if ((kooptKlok -= dt) <= 0) {
      kooptKlok += H.kooptElke;
      koop();
    }
    if ((herbouwKlok -= dt) <= 0) {
      herbouwKlok += H.herbouwElke;
      herbouw();
    }
    if (uitvalKlok > 0) uitvalKlok -= dt;
    if (uitvalKlok <= 0 && aantal() > 0 && bedreigd()) {
      uitvalKlok = H.uitvalPauze;
      stuur((n) => `The red lord makes a sally with ${n} ${n === 1 ? 'man' : 'men'}!`, false);
      return;
    }
    if (sinds >= wachtTijd() && sterkte() >= doel()) {
      stuur((n) => `Attack ${aanvallen + 1}! ${n} ${n === 1 ? 'enemy is' : 'enemies are'} coming at you from the red keep.`, true);
      opVerandering();
    }
  }

  // Voor de cijfers in beeld.
  function stand() {
    const rest = Math.max(0, Math.ceil(wachtTijd() - sinds));
    return {
      voorraad: { hout: Math.floor(voorraad.hout), steen: Math.floor(voorraad.steen), goud: Math.floor(voorraad.goud) },
      reserve: { ...reserve },
      aantal: aantal(),
      sterkte: Math.round(sterkte() * 10) / 10,
      doel: doel(),
      wacht: rest,                      // seconden tot hij ten vroegste weer mag
      werken: staand().length,
      werkenTotaal: werken.length,
      inkomen: inkomen(),
      aanvallen,
    };
  }

  const bewaar = () => ({
    v: Object.fromEntries(GRONDSTOFFEN.map((k) => [k, Math.round(voorraad[k] * 10) / 10])),
    r: { ...reserve },
    s: Math.round(sinds),
    a: aanvallen,
  });

  function zet(s) {
    begin();
    if (!s || typeof s !== 'object') return;
    if (s.v && typeof s.v === 'object') {
      for (const k of GRONDSTOFFEN) if (Number.isFinite(s.v[k])) voorraad[k] = Math.min(H.voorraadMax, Math.max(0, s.v[k]));
    }
    if (s.r && typeof s.r === 'object') {
      for (const [k, n] of Object.entries(s.r)) {
        if (Object.prototype.hasOwnProperty.call(soorten, k) && Number.isInteger(n) && n > 0 && n <= 60) reserve[k] = n;
      }
    }
    if (Number.isInteger(s.a) && s.a >= 0 && s.a < 9999) aanvallen = s.a;
    if (Number.isFinite(s.s) && s.s >= 0) sinds = Math.min(s.s, 3600);
  }

  return {
    stap, stand, bewaar, zet, herstel: begin,
    // Voor het testen.
    zetVoorraad(k, n) { voorraad[k] = n; },
    zetReserve(r) { reserve = { ...r }; },
    zetSinds(s) { sinds = s; },
    werken: () => werken.map((w) => w.vak),
  };
}
