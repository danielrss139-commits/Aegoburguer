/* Service worker — AEGO Burguer (pedir + painel)
   Rede primeiro (sempre a versão mais nova); cache só como reserva offline.
   Guarda apenas arquivos do próprio site listados em SHELL e as fotos de img/.
   Ao publicar mudanças, aumente VERSAO para os celulares pegarem os arquivos novos. */
var VERSAO = 'ab-v13';
var SHELL = ['./', 'index.html', 'pedir.html', 'painel.html', 'base.css', 'site.css', 'pedir.css', 'painel.css',
  'db.js', 'site.js', 'pedir.js', 'painel.js', 'manifest-pedir.json', 'manifest-painel.json',
  'fonts/anton.woff2', 'fonts/hanken-grotesk.woff2', 'img/hero-aego.webp', 'img/hero-aego-m.webp', 'img/capa-aego.webp',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/favicon-32.png', 'icons/apple-touch-icon.png'];
var OK = {};
SHELL.forEach(function (f) { OK[new URL(f, self.registration.scope).pathname] = 1; });
function permitido(u) { return u.origin === self.location.origin && (OK[u.pathname] || /\/img\/[\w-]+\.webp$/.test(u.pathname)); }

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== VERSAO; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request; if (req.method !== 'GET') return;
  var url = new URL(req.url); if (!permitido(url)) return;
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok && res.type === 'basic') { var c = res.clone(); caches.open(VERSAO).then(function (k) { k.put(url.pathname, c); }); }
    return res;
  }).catch(function () {
    return caches.match(url.pathname).then(function (r) { return r || (req.mode === 'navigate' ? caches.match(new URL('pedir.html', self.registration.scope).pathname) : Response.error()); });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (l) {
    for (var i = 0; i < l.length; i++) if (l[i].url.indexOf('painel.html') >= 0 && 'focus' in l[i]) return l[i].focus();
    return self.clients.openWindow ? self.clients.openWindow(new URL('painel.html', self.registration.scope).href) : null;
  }));
});
