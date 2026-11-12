// INVOER: vertaalt vingers op het scherm naar acties.
//   1 vinger slepen   = schuiven
//   2 vingers knijpen = zoomen
//   kort tikken       = tik
//   twee keer tikken  = dubbeltik (als main.js die actie meegeeft)
//   1 vinger slepen terwijl acties.kaderActief() waar is = een kader trekken
// Deze module weet niets van de kaart of de camera. Hij roept alleen de
// functies aan die main.js meegeeft.

import { CONFIG } from './config.js';

export function koppelInvoer(element, acties) {
  const vingers = new Map();   // id van de vinger -> laatste plek
  let begin = null;            // waar en wanneer de eerste vinger neerkwam
  let verschoven = false;      // is er gesleept of geknepen?
  let kader = false;           // trekt deze vinger een kader in plaats van te schuiven?
  let vorigeTik = null;        // waar en wanneer er het laatst is getikt

  const plek = (e) => {
    const vak = element.getBoundingClientRect();
    return { x: e.clientX - vak.left, y: e.clientY - vak.top };
  };

  element.addEventListener('pointerdown', (e) => {
    if (element.setPointerCapture) {
      try { element.setPointerCapture(e.pointerId); } catch (fout) { /* niet erg */ }
    }
    const p = plek(e);
    vingers.set(e.pointerId, p);
    if (vingers.size === 1) {
      begin = { x: p.x, y: p.y, tijd: performance.now() };
      verschoven = false;
      kader = false;
    } else {
      verschoven = true;   // met twee vingers is het nooit een tik
      if (kader) {
        kader = false;     // en ook geen kader meer
        acties.kaderWeg();
      }
    }
  });

  element.addEventListener('pointermove', (e) => {
    const oud = vingers.get(e.pointerId);
    if (!oud) return;
    const nieuw = plek(e);

    if (vingers.size === 1) {
      if (!verschoven && Math.hypot(nieuw.x - begin.x, nieuw.y - begin.y) > CONFIG.invoer.tikDrempel) {
        verschoven = true;
        kader = !!acties.kaderActief && acties.kaderActief();
      }
      if (verschoven && kader) acties.kaderBeweeg(begin.x, begin.y, nieuw.x, nieuw.y);
      else if (verschoven) acties.schuif(nieuw.x - oud.x, nieuw.y - oud.y);
    } else if (vingers.size === 2) {
      let ander = null;
      for (const [id, p] of vingers) if (id !== e.pointerId) ander = p;
      const oudeAfstand = Math.hypot(oud.x - ander.x, oud.y - ander.y);
      const nieuweAfstand = Math.hypot(nieuw.x - ander.x, nieuw.y - ander.y);
      const oudMidden = { x: (oud.x + ander.x) / 2, y: (oud.y + ander.y) / 2 };
      const nieuwMidden = { x: (nieuw.x + ander.x) / 2, y: (nieuw.y + ander.y) / 2 };
      acties.schuif(nieuwMidden.x - oudMidden.x, nieuwMidden.y - oudMidden.y);
      if (oudeAfstand > 0) acties.zoom(nieuwMidden.x, nieuwMidden.y, nieuweAfstand / oudeAfstand);
    }
    vingers.set(e.pointerId, nieuw);
  });

  const los = (e) => {
    if (!vingers.has(e.pointerId)) return;
    const wasTik =
      e.type === 'pointerup' &&
      vingers.size === 1 &&
      !verschoven &&
      performance.now() - begin.tijd < CONFIG.invoer.tikTijd;
    const p = plek(e);
    vingers.delete(e.pointerId);
    if (kader) {
      kader = false;
      if (e.type === 'pointerup') acties.kaderKlaar(begin.x, begin.y, p.x, p.y);
      else acties.kaderWeg();
      return;
    }
    if (!wasTik) return;
    // Twee tikken kort na elkaar op dezelfde plek is een dubbeltik.
    const nu = performance.now();
    const dubbel = vorigeTik && nu - vorigeTik.tijd < CONFIG.invoer.dubbelTijd && Math.hypot(p.x - vorigeTik.x, p.y - vorigeTik.y) < CONFIG.invoer.dubbelAfstand;
    if (dubbel && acties.dubbeltik) {
      vorigeTik = null;
      acties.dubbeltik(p.x, p.y);
    } else {
      vorigeTik = { x: p.x, y: p.y, tijd: nu };
      acties.tik(p.x, p.y);
    }
  };
  element.addEventListener('pointerup', los);
  element.addEventListener('pointercancel', los);

  // Muiswiel, zodat testen op een computer ook kan.
  element.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = plek(e);
      acties.zoom(p.x, p.y, Math.exp(-e.deltaY * 0.0015));
    },
    { passive: false }
  );

  // Voorkom dat Safari zelf gaat zoomen, selecteren of een menu toont.
  for (const soort of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick']) {
    document.addEventListener(soort, (e) => e.preventDefault(), { passive: false });
  }
}
