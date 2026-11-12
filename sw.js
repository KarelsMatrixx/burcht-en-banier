// SERVICE WORKER: laat het spel ook zonder internet starten.
// Netwerk eerst; lukt dat niet, dan de bewaarde kopie. Bij elke stap VERSIE
// ophogen en nieuwe bestanden aan KERN toevoegen.
// (Opnieuw opgebouwd in stap 15: de vorige sw.js stond niet in het artifact.)
const VERSIE = 'burcht-banier-0.17.0';
const KERN = ["./index.html", "./manifest.webmanifest", "./css/stijl.css", "./data/assets.json", "./data/bouwwerken.json", "./data/economie.json", "./data/missies.json", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png", "./js/assets.js", "./js/bouwen.js", "./js/camera.js", "./js/config.js", "./js/economie.js", "./js/eenheden.js", "./js/invoer.js", "./js/iso.js", "./js/kaart.js", "./js/kunst.js", "./js/leger.js", "./js/main.js", "./js/meting.js", "./js/modus.js", "./js/opslag.js", "./js/rood.js", "./js/spellus.js", "./js/strijd.js", "./js/tekenaar.js", "./js/toeval.js", "./js/ui.js", "./js/wegvinden.js"];

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
