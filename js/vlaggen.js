// De vlaggen op het beginscherm wapperen rustig in de wind (stap 41).
// De achtergrond (beelden/startscherm.webp) is zonder vlaggen; de vlaggen zijn
// losse plaatjes (beelden/titel/vlaggen) die hier strook voor strook een beetje
// worden verschoven, met een golf die van de paal naar de punt loopt.
// Posities zijn pixels van startscherm.webp (2576 bij 1093).

const BEELD = { b: 2576, h: 1093, posX: 0.85, posY: 0.5 };   // gelijk aan object-fit: cover, object-position: 85% 50%
const RAND = 6;                                                // doorzichtige rand rond elk plaatje
const STROOK = 2;                                              // breedte van een strook in beeldpixels
const FPS = 30;

// soort 'wimpel': paal rechts, golft op en neer. soort 'banier': hangt aan de bovenkant, golft opzij.
// t = duur van een golf in seconden, f = fase, k = hoe sterk (1 = normaal)
const VLAGGEN = [
  { naam: 'top',      soort: 'wimpel', x: 1776, y: 32,  w: 172, h: 85, t: 5.6, f: 0.00, k: 1.0 },
  { naam: 'wimpel_a', soort: 'wimpel', x: 1537, y: 198, w: 194, h: 86, t: 6.1, f: 0.35, k: 1.0 },
  { naam: 'wimpel_b', soort: 'wimpel', x: 2030, y: 192, w: 150, h: 73, t: 5.2, f: 0.62, k: 1.0 },
  { naam: 'wimpel_c', soort: 'wimpel', x: 1408, y: 319, w: 124, h: 79, t: 5.9, f: 0.18, k: 1.0 },
  { naam: 'klein_a',  soort: 'wimpel', x: 1788, y: 255, w: 61,  h: 47, t: 4.8, f: 0.80, k: 1.2 },
  { naam: 'klein_b',  soort: 'wimpel', x: 2011, y: 272, w: 57,  h: 49, t: 5.0, f: 0.45, k: 1.2 },
  { naam: 'klein_c',  soort: 'wimpel', x: 1596, y: 367, w: 52,  h: 45, t: 5.3, f: 0.10, k: 1.2 },
  { naam: 'banier',   soort: 'banier', x: 2268, y: 346, w: 229, h: 443, t: 7.0, f: 0.25, k: 1.0 },
];

const klem = (v, a, b) => Math.max(a, Math.min(b, v));

export function maakVlaggen(scherm, kader) {
  const doek = document.getElementById('titel-vlaggen');
  if (!doek) return { zet() {} };
  const g = doek.getContext('2d');
  const minderBeweging = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let klaar = false, aan = false, raf = 0, laatste = 0, t0 = 0;
  let B = 0, H = 0, dpr = 1, schaal = 1, ox = 0, oy = 0;

  for (const v of VLAGGEN) {
    v.img = new Image();
    v.img.decoding = 'async';
    v.img.onload = () => { v.ok = true; if (VLAGGEN.every((x) => x.ok)) { klaar = true; if (aan) start(); } };
    v.img.src = `beelden/titel/vlaggen/${v.naam}.webp`;
  }

  function maat() {
    const w = scherm.clientWidth, h = scherm.clientHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === B && h === H && doek.width === Math.round(w * dpr)) return;
    B = w; H = h;
    doek.width = Math.round(w * dpr); doek.height = Math.round(h * dpr);
    schaal = Math.max(B / BEELD.b, H / BEELD.h);
    ox = (B - BEELD.b * schaal) * BEELD.posX;
    oy = (H - BEELD.h * schaal) * BEELD.posY;
  }

  function teken(tijd) {
    maat();
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, B, H);
    for (const v of VLAGGEN) {
      const { img, w, h } = v;
      const s = tijd / v.t + v.f;
      const strook = STROOK;
      if (v.soort === 'wimpel') {
        const A = Math.max(3.5, 0.05 * w) * v.k;
        for (let px = 0; px < w; px += strook) {
          const r = klem((w - RAND - px) / (w - 2 * RAND), 0, 1);          // 0 bij de paal, 1 bij de punt
          const dy = A * Math.pow(r, 1.25) * (Math.sin(6.2832 * (s - 0.8 * r)) + 0.3 * Math.sin(6.2832 * (1.7 * s - 1.5 * r)));
          const sw = Math.min(strook, w - px);
          g.drawImage(img, px, 0, sw, h, ox + (v.x + px) * schaal, oy + (v.y + dy) * schaal, sw * schaal + 0.6, h * schaal);
        }
      } else {
        const A = 0.034 * h * v.k;
        for (let py = 0; py < h; py += strook) {
          const r = klem(py / h, 0, 1);                                      // 0 bovenaan, 1 onderaan
          // het doek waait van de paal weg: alleen naar links, nooit over de paal heen
          const dx = -A * Math.pow(r, 1.4) * (0.5 + 0.38 * Math.sin(6.2832 * (s - 0.7 * r)) + 0.12 * Math.sin(6.2832 * (1.9 * s - 1.3 * r)));
          const sh = Math.min(strook, h - py);
          g.drawImage(img, 0, py, w, sh, ox + (v.x + dx) * schaal, oy + (v.y + py) * schaal, w * schaal, sh * schaal + 0.6);
        }
      }
    }
  }

  function lus(nu) {
    raf = requestAnimationFrame(lus);
    if (nu - laatste < 1000 / FPS - 2) return;
    laatste = nu;
    teken((nu - t0) / 1000);
  }
  function start() {
    if (!klaar) return;
    cancelAnimationFrame(raf);
    if (minderBeweging) { teken(0); return; }       // minder beweging: de vlaggen staan stil
    t0 = performance.now(); laatste = 0;
    raf = requestAnimationFrame(lus);
  }

  window.addEventListener('resize', () => { if (aan && klaar) teken((performance.now() - t0) / 1000); });

  return {
    // aan = het beginscherm is open en toont het schilderij
    zet(waar) {
      aan = !!waar;
      doek.hidden = !aan;
      if (aan) start();
      else { cancelAnimationFrame(raf); g.clearRect(0, 0, doek.width, doek.height); }
    },
  };
}
