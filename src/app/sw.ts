import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { BackgroundSyncQueue, Serwist } from "serwist";
import { defaultCache } from "@serwist/next/worker";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("activate", () => self.clients.claim());

const queue = new BackgroundSyncQueue("myQueueName");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: {
    cleanupOutdatedCaches: true,
    concurrency: 10,
    ignoreURLParametersMatching: [],
  },
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: false,
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