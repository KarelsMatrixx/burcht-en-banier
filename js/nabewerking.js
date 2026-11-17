// Nabewerking: een filmlaag over het hele spelbeeld.
// Alles met gewoon Canvas2D (geen WebGL), zodat het ook zonder extra rekenwerk op de iPhone werkt.
// Standen: 'uit', 'laag' (kleurgrading, gouden licht, vignet), 'hoog' (ook gloed en scherptediepte).

const STANDEN = ['uit', 'laag', 'hoog'];

export function maakNabewerking(startStand = 'uit') {
  let stand = STANDEN.includes(startStand) ? startStand : 'uit';
  const klein = document.createElement('canvas');   // kwart formaat: bron voor de gloed
  const kleinCtx = klein.getContext('2d');
  const wazig = document.createElement('canvas');   // achtste formaat: bron voor de scherptediepte
  const wazigCtx = wazig.getContext('2d');
  let w = 0;
  let h = 0;

  function maatAanpassen(breedte, hoogte) {
    if (breedte === w && hoogte === h) return;
    w = breedte;
    h = hoogte;
    klein.width = Math.max(1, Math.round(w / 4));
    klein.height = Math.max(1, Math.round(h / 4));
    wazig.width = Math.max(1, Math.round(w / 8));
    wazig.height = Math.max(1, Math.round(h / 8));
  }

  // dagdeel: 0 = vroeg licht, 0.5 = gouden uur (standaard). Voor later: dag en nacht cyclus.
  function toepassen(ctx, canvas, opties = {}) {
    if (stand === 'uit') return;
    const breedte = canvas.width;
    const hoogte = canvas.height;
    maatAanpassen(breedte, hoogte);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (stand === 'hoog') {
      // Scherptediepte: boven- en onderrand zacht, het midden scherp (miniatuurwereld).
      wazigCtx.imageSmoothingEnabled = true;
      wazigCtx.drawImage(canvas, 0, 0, wazig.width, wazig.height);
      randWazig(ctx, breedte, hoogte);

      // Gloed: alleen de lichte delen, versterkt door met zichzelf te vermenigvuldigen.
      kleinCtx.globalCompositeOperation = 'source-over';
      kleinCtx.drawImage(canvas, 0, 0, klein.width, klein.height);
      kleinCtx.globalCompositeOperation = 'multiply';
      kleinCtx.drawImage(klein, 0, 0);
      kleinCtx.globalCompositeOperation = 'source-over';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.28;
      ctx.drawImage(klein, 0, 0, breedte, hoogte);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    // Gouden uur: warm licht van rechtsboven, koelere schaduw linksonder.
    ctx.globalCompositeOperation = 'soft-light';
    const licht = ctx.createLinearGradient(breedte, 0, 0, hoogte);
    licht.addColorStop(0, 'rgba(255, 196, 110, 0.55)');
    licht.addColorStop(0.55, 'rgba(255, 214, 160, 0.12)');
    licht.addColorStop(1, 'rgba(70, 90, 170, 0.45)');
    ctx.fillStyle = licht;
    ctx.fillRect(0, 0, breedte, hoogte);

    // Extra contrast en kleurdiepte.
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = licht;
    ctx.fillRect(0, 0, breedte, hoogte);
    ctx.globalAlpha = 1;

    // Vignet: de randen zakken weg, het oog gaat naar het midden.
    ctx.globalCompositeOperation = 'multiply';
    const r = Math.hypot(breedte, hoogte) / 2;
    const vignet = ctx.createRadialGradient(breedte / 2, hoogte / 2, r * 0.45, breedte / 2, hoogte / 2, r * 1.02);
    vignet.addColorStop(0, 'rgba(255,255,255,1)');
    vignet.addColorStop(1, 'rgba(70, 58, 78, 1)');
    ctx.fillStyle = vignet;
    ctx.fillRect(0, 0, breedte, hoogte);

    ctx.restore();
    void opties;
  }

  // Het wazige beeld alleen aan boven- en onderkant laten doorschemeren.
  const laag = document.createElement('canvas');   // hergebruikt, geen nieuwe canvas per beeld
  const lctx = laag.getContext('2d');
  function randWazig(ctx, breedte, hoogte) {
    laag.width = wazig.width;
    laag.height = wazig.height;
    lctx.globalCompositeOperation = 'source-over';
    lctx.drawImage(wazig, 0, 0);
    lctx.globalCompositeOperation = 'destination-in';
    const m = lctx.createLinearGradient(0, 0, 0, laag.height);
    m.addColorStop(0, 'rgba(0,0,0,1)');
    m.addColorStop(0.3, 'rgba(0,0,0,0)');
    m.addColorStop(0.7, 'rgba(0,0,0,0)');
    m.addColorStop(1, 'rgba(0,0,0,1)');
    lctx.fillStyle = m;
    lctx.fillRect(0, 0, laag.width, laag.height);
    ctx.drawImage(laag, 0, 0, breedte, hoogte);
  }

  return {
    toepassen,
    get stand() { return stand; },
    zetStand(s) { if (STANDEN.includes(s)) stand = s; },
  };
}
