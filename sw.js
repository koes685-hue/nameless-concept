/* 이름 없는 개념: offline cache.
   The page itself is fetched fresh when the network answers within a few seconds, so updates show up;
   otherwise the cached copy opens. Libraries, icons and fonts come from the cache first.
   Live class connections (PeerJS) are never cached. */
var VERSION = "nc-v9-2026-11-28";
var CORE = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-180.png",
  "vendor/html2canvas.min.js", "vendor/jspdf.umd.min.js", "vendor/peerjs.min.js", "vendor/qrcode.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function fromCache(req) { return caches.match(req, { ignoreSearch: true }); }
function put(req, res) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(req, copy); }); return res; }

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") { return; }
  var url = new URL(req.url);
  var same = url.origin === self.location.origin;
  var font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) { return; }

  if (same && (req.mode === "navigate" || /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { fromCache("index.html").then(function (r) { if (r && !done) { done = true; resolve(r); } }); }, 4000);
      fetch(req).then(function (res) {
        clearTimeout(timer);
        if (res.ok) { put("index.html", res.clone()); }
        if (!done) { done = true; resolve(res); }
      }).catch(function () {
        clearTimeout(timer);
        fromCache("index.html").then(function (r) { if (!done) { done = true; resolve(r || Response.error()); } });
      });
    }));
    return;
  }
  e.respondWith(fromCache(req).then(function (hit) {
    var net = fetch(req).then(function (res) { if (res.ok || res.type === "opaque") { put(req, res.clone()); } return res; });
    return hit || net;
  }));
});
