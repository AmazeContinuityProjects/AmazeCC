import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { BackgroundSyncQueue, Serwist } from "serwist";
import { defaultCache } from "@serwist/next/worker";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

self.skipWaiting();

self.addEventListener("activate", () => self.clients.claim());

/*
 * Large hero artwork is excluded from precache on purpose. It is pure
 * decoration for surfaces that are online anyway, and each multi-MB image
 * would otherwise dominate the install payload on phones — the SW precache
 * is what a first visit to an installed app pays for. The files still load
 * over the network on demand (the runtime cache handles them), and the
 * offline fallback page does not reference them.
 */
const precacheEntries = (self.__SW_MANIFEST ?? []).filter((entry) => {
  const url = typeof entry === "string" ? entry : (entry as PrecacheEntry).url;
  return !url?.includes("campus-twilight") && !url?.includes("hero-artwork");
});

const queue = new BackgroundSyncQueue("myQueueName");

const serwist = new Serwist({
  precacheEntries,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    concurrency: 10,
    ignoreURLParametersMatching: [],
  },
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: defaultCache,
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

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.origin === location.origin && url.pathname === "/legacy-post") {
    const backgroundSync = async () => {
      try {
        const response = await fetch(event.request.clone());
        return response;
      } catch (error) {
        await queue.pushRequest({ request: event.request });
        return Response.error();
      }
    };
    event.respondWith(backgroundSync());
  }
});

serwist.addEventListeners();

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

self.addEventListener('push', function (event: any) {
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
          url: data.url || basePath || '/',
          dateOfArrival: Date.now(),
        },
      };
      event.waitUntil(self.registration.showNotification(data.title, options));
    } catch (e) {
      console.error("Error parsing push payload:", e);
    }
  }
});
 
self.addEventListener('notificationclick', function (event: any) {
  event.notification.close();
  const rawUrl = event.notification.data?.url || basePath || '/';
  const urlToOpen = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    (self as any).clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clientList: any[]) => {
      for (const client of clientList) {
        if ('focus' in client) {
          try {
            if ('navigate' in client && client.url !== urlToOpen) {
              await client.navigate(urlToOpen);
            }
          } catch (e) {}
          return client.focus();
        }
      }
      if ((self as any).clients && (self as any).clients.openWindow) {
        return (self as any).clients.openWindow(urlToOpen);
      }
    })
  );
});