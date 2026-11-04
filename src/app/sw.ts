import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, NetworkFirst, StaleWhileRevalidate, ExpirationPlugin } from "serwist";
import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("activate", () => self.clients.claim());

/*
 * Large hero artwork is excluded from precache on purpose. It is pure
 * decoration for surfaces that are online anyway, and each multi-MB image
 * would otherwise dominate the install payload on phones — the SW precache
 * is what a first visit to an installed app pays for. The files still load
 * over the network on demand (the runtime cache handles them), and the
 * offline fallback page does not reference them.
 *
 * Every other static image and data file is excluded for the same reason:
 * together they were ~10MB of the ~17.7MB manifest (poster art, favicon set,
 * laundry/mess/roster JSON, FFCS CSVs) and none is part of the offline shell.
 * They are fetched on demand and kept by the runtime caches once used
 * (`static-image-assets`, `static-data-assets` — see the rules below).
 * Lazy JS chunks can't be filtered by name here; the build-time script
 * `scripts/prune-sw-precache.js` drops the ones no eagerly served HTML
 * references from the inlined manifest in `out/sw.js`.
 */
const precacheEntries = (self.__SW_MANIFEST ?? []).filter((entry) => {
  const url = typeof entry === "string" ? entry : (entry as PrecacheEntry).url;
  if (!url) return false;
  if (url.includes("campus-twilight") || url.includes("hero-artwork")) return false;
  return !/\.(?:png|jpe?g|gif|webp|avif|ico|svg|json|csv|md|txt|pem|webmanifest)(?:\?|$)/i.test(url);
});

/*
 * Runtime caching, persistence-first.
 *
 * `@serwist/next`'s `defaultCache` ages every shell-critical cache out after
 * 24 hours (`pages`, `next-static-js-assets`, `static-js-assets`,
 * `static-style-assets`), which on a phone — iOS Safari in particular —
 * means the app silently degrades to the offline fallback after a day of
 * not opening it. The rules below run *before* `defaultCache` (first match
 * wins) and give the app shell a 30-day, `last-used` lifespan: pages the user
 * actually opens offline stay cached, while anything genuinely abandoned ages
 * out. Dynamic data (`apis`, `next-data`, RSC) keeps the short TTLs — those
 * are meant to be refreshed, not preserved.
 */
const PERSISTENT_AGE = 30 * 24 * 60 * 60; // 30 days

const persistentCache: typeof defaultCache = [
  {
    // Same-origin HTML documents: the app shell. NetworkFirst keeps it fresh
    // online and falls back to the cache when the network is gone.
    matcher: ({ request, url, sameOrigin }) =>
      request.headers.get("Content-Type")?.includes("text/html") && sameOrigin && !url.pathname.startsWith("/api/"),
    handler: new NetworkFirst({
      cacheName: PAGES_CACHE_NAME.html,
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: PERSISTENT_AGE,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  {
    matcher: /\/_next\/static.+\.js$/i,
    handler: new CacheFirst({
      cacheName: "next-static-js-assets",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 64,
          maxAgeSeconds: PERSISTENT_AGE,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  {
    matcher: /\.(?:js)$/i,
    handler: new StaleWhileRevalidate({
      cacheName: "static-js-assets",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 48,
          maxAgeSeconds: PERSISTENT_AGE,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  {
    matcher: /\.(?:css|less)$/i,
    handler: new StaleWhileRevalidate({
      cacheName: "static-style-assets",
      plugins: [
        new ExpirationPlugin({
          maxEntries: 32,
          maxAgeSeconds: PERSISTENT_AGE,
          maxAgeFrom: "last-used",
        }),
      ],
    }),
  },
  // Everything else — fonts, images, APIs, RSC, cross-origin — keeps the
  // Next.js defaults.
  ...defaultCache,
];

const serwist = new Serwist({
  precacheEntries,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    concurrency: 10,
    ignoreURLParametersMatching: [],
  },
  // Activate immediately on install: a waiting SW leaves the old cache in
  // charge for every open tab, which on iOS means stale app data after a
  // redeploy until every tab is closed.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: persistentCache,
  fallbacks: {
    entries: [
      {
        url: "/~offline/",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

self.addEventListener("push", function (event: any) {
  if (event.data) {
    try {
      const data = event.data.json();
      const options = {
        body: data.body,
        icon: data.icon || `${basePath}/logo.png`,
        badge: `${basePath}/logo.png`,
        vibrate: data.vibrate || [100, 50, 100],
        tag: data.tag || "amazecc-push",
        data: {
          url: data.url || basePath || "/",
          dateOfArrival: Date.now(),
        },
      };
      event.waitUntil(self.registration.showNotification(data.title, options));
    } catch (e) {
      console.error("Error parsing push payload:", e);
    }
  }
});

self.addEventListener("notificationclick", function (event: any) {
  event.notification.close();
  const rawUrl = event.notification.data?.url || basePath || "/";
  const urlToOpen = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    (self as any).clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clientList: any[]) => {
      for (const client of clientList) {
        if ("focus" in client) {
          try {
            if ("navigate" in client && client.url !== urlToOpen) {
              await client.navigate(urlToOpen);
            }
          } catch (e) {}
          return client.focus();
        }
      }
      if ((self as any).clients && (self as any).clients.openWindow) {
        return (self as any).clients.openWindow(urlToOpen);
      }
    }),
  );
});
