// GIDS: stap voor stap begeleiding in de proloog (naar Karel: een nieuwkomer
// mag niet te snel door de knoppen heen).
//
// Eén ding tegelijk: een pulserende ring om de knop die nu aan de beurt is,
// met één korte zin erbij. De gids kijkt alleen naar wat er in beeld staat
// (welke knoppen open zijn), en gaat pas verder als de speler echt iets doet.
// Doet de speler 20 seconden niets, dan klopt de ring harder en komt de zin terug.
// Verder een kaartje met een knop ("Next lesson ›") zodat er geen klok loopt.

const IDLE = 20;      // seconden zonder tik, dan een duwtje
const el = (id) => document.getElementById(id);
const zichtbaar = (e) => !!e && !e.hidden && !!(e.offsetWidth || e.offsetHeight) && !e.closest('[hidden]');

export function maakGids({ plekNaarScherm = null, tegelMaat = { breedte: 64, hoogte: 32 } } = {}) {
  let doel = null;        // { sleutel, soort } of null
  let laatsteTik = 0;
  let nu = 0;
  let vorigeTekst = '';

  const ring = document.createElement('div');
  ring.id = 'gids-ring';
  ring.hidden = true;
  const zin = document.createElement('div');
  zin.id = 'gids-zin';
  zin.className = 'plaat';
  zin.hidden = true;
  const kaart = document.createElement('div');
  kaart.id = 'gids-kaart';
  kaart.className = 'plaat';
  kaart.hidden = true;
  // De plek op de kaart waar het bouwwerk moet komen: een gouden ruit die klopt, met een pijl aan de rand als hij uit beeld is.
  const plek = document.createElement('div');
  plek.id = 'gids-plek';
  plek.hidden = true;
  plek.innerHTML = '<svg viewBox="-34 -18 68 36" aria-hidden="true"><polygon points="0,-16 32,0 0,16 -32,0"/></svg><span><img src="beelden/portretten/bartholt.jpg" alt=""><b></b></span>';
  const plekPijl = plek.querySelector('span');
  const plekTekstEl = plek.querySelector('b');
  document.body.append(ring, zin, kaart, plek);

  document.addEventListener('pointerdown', () => { laatsteTik = nu; ring.classList.remove('luid'); }, true);
  // Heeft de speler een stand van de belasting gekozen, of het volkspaneel geopend?
  let belastingTik = false;
  let paneelGezien = false;
  document.addEventListener('click', (ev) => {
    if (ev.target.closest && ev.target.closest('#volk-belasting button')) belastingTik = true;
  }, true);

  // Wat is nu de eerstvolgende knop? Per soort taak.
  function volgende() {
    if (!doel) return null;
    const hamer = el('knop-hamer');
    if (doel.soort === 'bouw') {
      if (hamer.classList.contains('plaats')) return { e: hamer, tekst: 'Now tap the glowing hammer to build it.' };
      const knoppen = el('bouw-knoppen');
      const bouwt = knoppen && knoppen.querySelector('.actief');
      // Staat een ander bouwwerk aan? Dan eerst het juiste kiezen.
      if (bouwt && bouwt.dataset.sleutel !== doel.sleutel && zichtbaar(knoppen.querySelector(`[data-sleutel="${doel.sleutel}"]`))) {
        return { e: knoppen.querySelector(`[data-sleutel="${doel.sleutel}"]`), tekst: `Tap ${knoppen.querySelector(`[data-sleutel="${doel.sleutel}"]`).firstChild.textContent.trim()}.` };
      }
      if (bouwt && bouwt.dataset.sleutel !== doel.sleutel) { const terug = el('knop-terug'); if (zichtbaar(terug)) return { e: terug, tekst: 'Not this one. Go back.' }; }
      if (bouwt) return { e: null, tekst: doel.plek ? 'Tap the golden spot on the map. A green outline means it fits.' : 'Tap the ground where it should stand. A green outline means it fits.' };
      if (zichtbaar(knoppen)) {
        const knop = knoppen.querySelector(`[data-sleutel="${doel.sleutel}"]`);
        if (zichtbaar(knop)) return { e: knop, tekst: `Tap ${knop.firstChild.textContent.trim()}.` };
        const groep = knop && knop.dataset.groep;
        const groepKnop = groep && knoppen.querySelector(`[data-open="${groep}"]`);
        if (zichtbaar(groepKnop)) return { e: groepKnop, tekst: `Open ${groepKnop.textContent.trim()}.` };
        const terug = el('knop-terug');
        if (zichtbaar(terug)) return { e: terug, tekst: 'Not here. Go back.' };
      }
      return { e: hamer, tekst: 'Tap the hammer to open the building menu.' };
    }
    if (doel.soort === 'opleiden') {
      const paneel = el('legerpaneel');
      if (zichtbaar(paneel)) {
        const knop = el('leger-opleiden').querySelector('[data-soldaat]:not(.kanniet)') || el('leger-opleiden').querySelector('[data-soldaat]');
        if (knop) return { e: knop, tekst: 'Tap to train a soldier.' };
      }
      // Soldaten leid je op bij de kazerne: tik het gebouw zelf aan (het zwaard opent alleen de selectiebalk).
      return { e: null, tekst: 'Tap your barracks on the map (the golden spot) to train soldiers.' };
    }
    if (doel.soort === 'volk') {
      if (zichtbaar(el('volkpaneel'))) return { e: el('volk-sluit'), tekst: 'This is your people. Read it, then close it.' };
      return { e: el('knop-buidel'), tekst: 'Tap the purse to see your people.' };
    }
    if (doel.soort === 'belasting') {
      if (!zichtbaar(el('volkpaneel'))) return { e: el('knop-buidel'), tekst: 'Tap the purse to open your people.' };
      if (belastingTik) return { e: el('volk-sluit'), tekst: 'Good. Now close the panel.' };
      const knop = el('volk-belasting').querySelector('button:not(.actief)');
      return { e: knop, tekst: 'Tap a tax level. Low is safe, High brings gold but angers your people.' };
    }
    if (doel.soort === 'kies') {
      const groepen = el('leger-groepen');
      if (!zichtbaar(groepen)) return { e: el('knop-zwaard'), tekst: 'Tap the sword to open your army.' };
      const knop = [...groepen.querySelectorAll('button')].find((b) => b.textContent.startsWith(doel.groep));
      if (knop && zichtbaar(knop)) return { e: knop, tekst: `Tap ${doel.groep}.` };
      return { e: el('knop-alle'), tekst: 'Tap All to choose your soldiers.' };
    }
    if (doel.soort === 'stuur') {
      if (doel.heeftKeuze && !doel.heeftKeuze()) return { e: el('knop-zwaard'), tekst: 'Your soldiers are no longer chosen. Open the army and choose them again.' };
      return { e: null, tekst: 'Tap the golden spot on the map.' };
    }
    if (doel.soort === 'sturen' || doel.soort === 'muur') {
      // 1. de soldaat die je net trainde aantikken, 2. (grond) het oog, 3. de gouden plek
      const oog = el('knop-oog');
      if (oog && oog.getAttribute('aria-pressed') === 'true') oogGezien = true;
      if (wijsSoldaat()) return { e: null, tekst: 'Tap your new soldier (the golden spot) to choose him.' };
      if (doel.soort === 'sturen' && !oogGezien && oog) return { e: oog, tekst: 'Walls can hide your soldiers. Tap the eye to see through them.' };
      return { e: null, tekst: doel.soort === 'muur' ? 'Now tap the golden piece of wall.' : 'Now tap the golden spot on the ground.' };
    }
    return null;
  }

  // Zet de ruit op de plek van de les (alleen bij bouwlessen).
  let oogGezien = false;   // het oog is al een keer aangezet (de les over bevelen op de grond)
  // Nog niemand gekozen in een les met een bevel: de gouden plek staat op een nieuwe soldaat
  const wijsSoldaat = () => (doel && doel.soldaat && doel.heeftKeuze && !doel.heeftKeuze() ? doel.soldaat() : null);
  function zetPlek() {
    const sol = wijsSoldaat();
    const p = sol ? { x: Math.floor(sol.x), y: Math.floor(sol.y) } : doel && doel.plek;
    if (!p || !plekNaarScherm) { plek.hidden = true; return; }
    if (doel.soort === 'opleiden' && zichtbaar(el('legerpaneel'))) { plek.hidden = true; return; }   // het kazernepaneel staat al open
    const sc = plekNaarScherm(p.x, p.y);
    const z = sc.zoom;
    const breed = tegelMaat.breedte * z * 1.1;
    const hoog = tegelMaat.hoogte * z * 1.1;
    const veilig = 34;
    const buiten = sc.x < veilig || sc.y < veilig || sc.x > window.innerWidth - veilig || sc.y > window.innerHeight - veilig;
    plek.hidden = false;
    plek.classList.toggle('buiten', buiten);
    if (!buiten) {
      plek.style.width = `${breed}px`;
      plek.style.height = `${hoog}px`;
      plek.style.left = `${sc.x - breed / 2}px`;
      plek.style.top = `${sc.y - hoog / 2}px`;
      plek.style.transform = '';
      plekTekstEl.textContent = sol ? 'Tap this soldier' : doel.plekTekst || 'Build here';
      plekPijl.hidden = false;
    } else {
      // Een pijl aan de rand van het scherm, in de richting van de plek
      const mx = window.innerWidth / 2;
      const my = window.innerHeight / 2;
      const hoek = Math.atan2(sc.y - my, sc.x - mx);
      const rx = Math.max(-1, Math.min(1, Math.cos(hoek) * 1e3));
      const ry = Math.max(-1, Math.min(1, Math.sin(hoek) * 1e3));
      const x = Math.max(veilig, Math.min(window.innerWidth - veilig, mx + rx * (mx - veilig)));
      const y = Math.max(veilig + 40, Math.min(window.innerHeight - veilig - 20, my + ry * (my - veilig - 20)));
      plek.style.width = '44px';
      plek.style.height = '44px';
      plek.style.left = `${x - 22}px`;
      plek.style.top = `${y - 22}px`;
      plek.style.transform = `rotate(${hoek}rad)`;
      plekPijl.hidden = true;
    }
  }

  function zet(r) {
    const tekst = r ? r.tekst : '';
    if (!r) {
      ring.hidden = true;
      zin.hidden = true;
      return;
    }
    zin.textContent = tekst;
    zin.hidden = false;
    if (r.e && zichtbaar(r.e)) {
      const b = r.e.getBoundingClientRect();
      const pad = 6;
      ring.style.left = `${b.left - pad}px`;
      ring.style.top = `${b.top - pad}px`;
      ring.style.width = `${b.width + 2 * pad}px`;
      ring.style.height = `${b.height + 2 * pad}px`;
      ring.hidden = false;
      // De zin boven of onder de knop, binnen het scherm
      const vrijOnder = window.innerHeight - b.bottom;
      zin.style.top = vrijOnder > 70 ? `${b.bottom + 10}px` : '';
      zin.style.bottom = vrijOnder > 70 ? '' : `${window.innerHeight - b.top + 10}px`;
      const midden = b.left + b.width / 2;
      // Staat de knop aan de rechterrand, dan staat de zin links ervan (niet over de andere knoppen)
      if (b.left > window.innerWidth - 130) {
        zin.style.top = `${Math.max(8, Math.min(window.innerHeight - 70, b.top + b.height / 2 - 24))}px`;
        zin.style.bottom = '';
        zin.style.left = `${Math.max(8, b.left - 276)}px`;
      } else zin.style.left = `${Math.max(8, Math.min(window.innerWidth - 268, midden - 130))}px`;
    } else {
      ring.hidden = true;
      zin.style.top = '';
      zin.style.bottom = '90px';
      zin.style.left = `${Math.max(8, window.innerWidth / 2 - 130)}px`;
    }
    // Niet over de hint van het leger linksonder: dan erboven
    const hint = el('legerhint');
    if (hint && zichtbaar(hint)) {
      const h = hint.getBoundingClientRect();
      const z = zin.getBoundingClientRect();
      if (z.left < h.right && z.right > h.left && z.top < h.bottom && z.bottom > h.top) {
        zin.style.top = '';
        zin.style.bottom = `${window.innerHeight - h.top + 8}px`;
      }
    }
    // Niet over het taaklabel rechtsboven: valt de zin erover, dan schuift hij eronder
    const taak = el('taak');
    if (taak && zichtbaar(taak) && taak.textContent.trim()) {
      const t = taak.getBoundingClientRect();
      const z = zin.getBoundingClientRect();
      if (z.left < t.right && z.right > t.left && z.top < t.bottom && z.bottom > t.top) {
        zin.style.bottom = '';
        zin.style.top = `${t.bottom + 8}px`;
      }
    }
    if (tekst !== vorigeTekst) { vorigeTekst = tekst; laatsteTik = nu; }
  }

  // Ligt er een beeldvullend scherm over het spel (titel, menu, verhaal, uitslag), dan verdwijnt de gids helemaal.
  // Een eigen klokje, want de spellus staat dan stil.
  const BEDEKKERS = ['titelscherm', 'menu', 'verhaalbeeld', 'missie', 'uitslag', 'einde', 'scene', 'logboek', 'verhaal', 'instellingen'];
  const bedektNu = () => BEDEKKERS.some((id) => { const e = document.getElementById(id); return e && !e.hidden; });
  setInterval(() => {
    const bedekt = bedektNu();
    document.body.classList.toggle('gids-bedekt', bedekt);
  }, 150);

  return {
    // Richt de gids op een taak: soort 'bouw' (met sleutel), 'opleiden', 'sturen', 'muur'.
    richt(taak) { doel = taak; laatsteTik = nu; vorigeTekst = ''; belastingTik = false; paneelGezien = false; },
    belastingGekozen: () => belastingTik,
    // Is het volkspaneel in deze les geopend geweest?
    volkGezien: () => paneelGezien,
    volkGesloten: () => paneelGezien && !zichtbaar(el('volkpaneel')),
    // De ruit op de kaart verplaatsen (als de plek bezet raakt)
    zetPlek(p) { if (doel) doel.plek = p; },
    stop() { doel = null; plek.hidden = true; zet(null); },
    // Elke halve seconde of sneller.
    stap(dt) {
      nu += dt;
      if (!doel) return;
      zetPlek();
      if (zichtbaar(el('volkpaneel'))) paneelGezien = true;
      zet(volgende());
      if (nu - laatsteTik > IDLE) ring.classList.add('luid');
    },
    // Een kaartje midden onderin met een knop. Geen klok: de speler bepaalt het tempo.
    kaart({ naam, tekst, knop, portret }, opKlik) {
      kaart.replaceChildren();
      kaart.classList.toggle('met-portret', !!portret);
      if (portret) { const i = document.createElement('img'); i.className = 'portret'; i.alt = ''; i.src = `beelden/portretten/${portret}.jpg`; kaart.appendChild(i); }
      if (naam) { const n = document.createElement('strong'); n.textContent = naam; kaart.appendChild(n); }
      const p = document.createElement('p');
      p.textContent = tekst;
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = knop;
      b.addEventListener('click', () => { kaart.hidden = true; opKlik(); });
      kaart.append(p, b);
      kaart.hidden = false;
      zet(null);
    },
    kaartOpen: () => !kaart.hidden,
    verbergKaart() { kaart.hidden = true; },
    doel: () => doel,
  };
}
