/// <reference lib="webworker" />
/**
 * Service worker for How God Speaks To Us.
 *
 * Built by vite-plugin-pwa ("injectManifest"): self.__WB_MANIFEST is replaced
 * at build time with the list of app-shell files to precache (see
 * astro.config.mjs). Everything else is cached at runtime as people use the site.
 *
 * Not handled here on purpose, so the browser fetches them normally:
 * PDFs and files on assets.ctfassets.net (large; "Download" covers offline),
 * /api/* (contact form), POST requests, and other third-party origins.
 */
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";

declare let self: ServiceWorkerGlobalScope;

// The Astro integration stores offline/index.html in the precache as "/offline",
// so look it up by that URL (matchPrecache won't map index.html to it).
const OFFLINE_URL = "/offline";
const DAY = 24 * 60 * 60;

// Must match the cache name read by src/pages/offline.astro.
const PAGES_CACHE = "pages";

// ---------------------------------------------------------------------------
// Static assets
// ---------------------------------------------------------------------------

// Hashed Astro assets (/_astro/*). This route is registered before
// precacheAndRoute on purpose, so it wins. Precached files are deleted when a
// new version activates, but HTML cached from an older visit still points at
// the old hashed CSS/JS, which the server no longer has. Keeping our own
// copies here lets those older cached pages still render offline.
// On a miss with no network, fall back to the precached copy.
registerRoute(
  ({ url }) => url.origin === self.location.origin && url.pathname.startsWith("/_astro/"),
  new CacheFirst({
    cacheName: "astro-assets",
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 60 * DAY }),
      { handlerDidError: async ({ request }) => (await matchPrecache(request.url)) ?? undefined },
    ],
  }),
);

// Delete precaches left by older Workbox versions, then precache the shell.
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ---------------------------------------------------------------------------
// HTML pages
// ---------------------------------------------------------------------------

// One expiration plugin shared by both page strategies, since they share a cache.
const pageExpiration = new ExpirationPlugin({
  maxEntries: 100,
  maxAgeSeconds: 30 * DAY,
  purgeOnQuotaError: true,
});
// Only cache real pages, never 404s/500s or redirects (redirects show up as
// status 0 "opaqueredirect" responses for navigations; the browser follows them).
const pageCacheable = new CacheableResponsePlugin({ statuses: [200] });

const isSameOriginNavigation = (request: Request, url: URL) =>
  request.mode === "navigate" &&
  url.origin === self.location.origin &&
  !url.pathname.startsWith("/api/");

// Homepage and daily verses change every day: always try the network first so
// an online reader never sees yesterday's verse. If the network is slow (3s)
// or offline, show the cached copy.
registerRoute(
  ({ request, url }) =>
    isSameOriginNavigation(request, url) &&
    (url.pathname === "/" || url.pathname.startsWith("/daily-verses")),
  new NetworkFirst({
    cacheName: PAGES_CACHE,
    networkTimeoutSeconds: 3,
    plugins: [pageCacheable, pageExpiration],
  }),
);

// Everything else (blog, resources, about, ...): show the cached copy instantly
// and refresh it in the background for next time.
registerRoute(
  ({ request, url }) => isSameOriginNavigation(request, url),
  new StaleWhileRevalidate({
    cacheName: PAGES_CACHE,
    plugins: [pageCacheable, pageExpiration],
  }),
);

// ---------------------------------------------------------------------------
// Images and fonts
// ---------------------------------------------------------------------------

// Contentful images. <img> requests are usually "no-cors", which gives opaque
// responses (status 0). We have to allow status 0 to cache them, but the
// browser can't tell if an opaque response succeeded, and Chrome counts each
// one as roughly 7 MB of storage quota. Hence the low cap and purgeOnQuotaError.
registerRoute(
  ({ url }) => url.hostname === "images.ctfassets.net",
  new CacheFirst({
    cacheName: "contentful-images",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true }),
    ],
  }),
);

// Google Fonts (the standard Workbox recipe): the small CSS file is refreshed
// in the background; the font files themselves never change, so cache them long.
registerRoute(
  ({ url }) => url.hostname === "fonts.googleapis.com",
  new StaleWhileRevalidate({ cacheName: "google-fonts-stylesheets" }),
);
registerRoute(
  ({ url }) => url.hostname === "fonts.gstatic.com",
  new CacheFirst({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 365 * DAY }),
    ],
  }),
);

// ---------------------------------------------------------------------------
// Offline fallback
// ---------------------------------------------------------------------------

// Runs when one of the routes above fails (no network and nothing cached).
// For page loads, show the branded offline page; otherwise just fail.
setCatchHandler(async ({ request }) => {
  if (request.mode === "navigate") {
    const offline = await matchPrecache(OFFLINE_URL);
    if (offline) return offline;
  }
  return Response.error();
});

// ---------------------------------------------------------------------------
// Updates
// ---------------------------------------------------------------------------

// A new version waits until the reader taps "Refresh" in the update toast,
// which sends SKIP_WAITING (see src/components/UpdateToast.astro).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

// On first install there is no older version, so start controlling the open
// page right away and pages visited from now on get cached for offline use.
clientsClaim();

// Future: push notifications for the daily verse would add "push" and
// "notificationclick" listeners here.
