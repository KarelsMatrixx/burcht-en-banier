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

export function maakGids() {
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
  document.body.append(ring, zin, kaart);

  document.addEventListener('pointerdown', () => { laatsteTik = nu; ring.classList.remove('luid'); }, true);

  // Wat is nu de eerstvolgende knop? Per soort taak.
  function volgende() {
    if (!doel) return null;
    const hamer = el('knop-hamer');
    if (doel.soort === 'bouw') {
      if (hamer.classList.contains('plaats')) return { e: hamer, tekst: 'Now tap the glowing hammer to build it.' };
      const knoppen = el('bouw-knoppen');
      const bouwt = knoppen && knoppen.querySelector('.actief');
      if (bouwt) return { e: null, tekst: 'Tap the ground where it should stand. A green outline means it fits.' };
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
      return { e: el('knop-zwaard'), tekst: 'Tap the sword to open your army.' };
    }
    if (doel.soort === 'sturen') return { e: null, tekst: 'Tap a soldier, then tap the ground where he must go.' };
    if (doel.soort === 'muur') return { e: null, tekst: 'Tap a soldier, then tap a piece of your castle wall.' };
    return null;
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
    if (tekst !== vorigeTekst) { vorigeTekst = tekst; laatsteTik = nu; }
  }

  return {
    // Richt de gids op een taak: soort 'bouw' (met sleutel), 'opleiden', 'sturen', 'muur'.
    richt(taak) { doel = taak; laatsteTik = nu; vorigeTekst = ''; },
    stop() { doel = null; zet(null); },
    // Elke halve seconde of sneller.
    stap(dt) {
      nu += dt;
      if (!doel) return;
      zet(volgende());
      if (nu - laatsteTik > IDLE) ring.classList.add('luid');
    },
    // Een kaartje midden onderin met een knop. Geen klok: de speler bepaalt het tempo.
    kaart({ naam, tekst, knop }, opKlik) {
      kaart.replaceChildren();
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
