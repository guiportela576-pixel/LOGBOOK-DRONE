self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("drone-logbook").then(cache => {
      return cache.addAll([
        "index.html",
        "style.css",
        "app.js"
      ]);
    })
  );
});
