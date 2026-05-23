// Service worker for the Anthropic Hackathon frontend.
// Strategy:
//   - Precache the app shell + critical assets so /app works offline.
//   - Network-first for HTML navigations (so users see fresh marketing copy when online),
//     falling back to cached shell when offline.
//   - Cache-first for same-origin static assets (CSS/JS/images/fonts).
//   - Bypass everything else (cross-origin requests handled by browser default).

const VERSION = "v2";
const SHELL_CACHE = `shell-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

const SHELL_URLS = [
  "/",
  "/app",
  "/app/listen",
  "/app/vault",
  "/app/settings",
  "/manifest.webmanifest",
  "/icon.svg",
  "/favicon.svg",
  "/audiobook/ch1.json",
  "/audiobook/ch1.mp3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        // addAll is atomic — if any request 404s we'd lose the whole cache,
        // so we add individually and ignore failures (dev paths may differ).
        Promise.all(
          SHELL_URLS.map((url) =>
            cache.add(url).catch(() => {
              /* skip missing shell entry */
            }),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache LLM/TTS endpoints — they must always hit the network.
  if (url.pathname.startsWith("/api/")) return;

  // HTML navigations: network-first, fall back to shell.
  if (req.mode === "navigate" || req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          // Fall back to /app shell so the installed app still launches offline.
          const shell = await caches.match("/app");
          return shell ?? new Response("Offline", { status: 503 });
        }),
    );
    return;
  }

  // Static assets: cache-first, then network with cache fill.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(ASSET_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
