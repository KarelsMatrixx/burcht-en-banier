// SERVICE WORKER: laat het spel ook zonder internet starten.
// Netwerk eerst; lukt dat niet, dan de bewaarde kopie. Bij elke stap VERSIE
// ophogen en nieuwe bestanden aan KERN toevoegen.
// (Opnieuw opgebouwd in stap 15: de vorige sw.js stond niet in het artifact.)
const VERSIE = 'burcht-banier-0.36.0';
const KERN = ["./index.html", "./manifest.webmanifest", "./css/stijl.css", "./data/assets.json", "./data/bouwwerken.json", "./data/economie.json", "./data/missies.json", "./data/kaarten.json", "./data/kastelen.json", "./data/campagne.json", "./data/levelkaart.json", "./beelden/levelkaart.webp", "./beelden/startscherm.webp",
  "./beelden/portretten/aleid.jpg", "./beelden/portretten/bartholt.jpg", "./beelden/portretten/brandt.jpg", "./beelden/portretten/everhard.jpg", "./beelden/portretten/gesina.jpg", "./beelden/portretten/hademar.jpg", "./beelden/portretten/ingeborg.jpg", "./beelden/portretten/karel.jpg", "./beelden/portretten/karel_boos.jpg", "./beelden/portretten/karel_rouw.jpg", "./beelden/portretten/lambrecht.jpg", "./beelden/portretten/ludolf.jpg", "./beelden/portretten/mechteld.jpg", "./beelden/portretten/ottger.jpg", "./beelden/portretten/ottger_boos.jpg", "./beelden/portretten/ottger_verdriet.jpg", "./beelden/portretten/reinout.jpg", "./beelden/portretten/rutger.jpg", "./beelden/portretten/valkenier.jpg", "./beelden/portretten/wessel.jpg", "./beelden/portretten/wessel_bang.jpg", "./beelden/portretten/wessel_blij.jpg", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png", "./js/assets.js", "./js/bouwen.js", "./js/camera.js", "./js/config.js", "./js/economie.js", "./js/eenheden.js", "./js/heren.js", "./js/soldaten.js", "./js/machines.js", "./js/invoer.js", "./js/iso.js", "./js/kaart.js", "./js/kunst.js", "./js/leger.js", "./js/main.js", "./js/meting.js", "./js/modus.js", "./js/opslag.js", "./js/rood.js", "./js/spellus.js", "./js/strijd.js", "./js/taal.js", "./js/tekenaar.js", "./js/toeval.js", "./js/ui.js", "./js/verhaal.js", "./js/wegvinden.js"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSIE).then((c) => c.addAll(KERN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((namen) => Promise.all(namen.filter((n) => n !== VERSIE).map((n) => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then((r) => { const kopie = r.clone(); caches.open(VERSIE).then((c) => c.put(e.request, kopie)); return r; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('index.html')))
  );
});
