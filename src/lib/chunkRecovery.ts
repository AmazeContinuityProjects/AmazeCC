/**
 * Recovery for failed lazy-chunk loads.
 *
 * A `ChunkLoadError` means the document the page was rendered from references a
 * JS/CSS chunk that is no longer available — typically a stale service-worker
 * cache serving an old HTML document after a deploy. A plain
 * `window.location.reload()` re-serves that same broken document, so the error
 * boundary fires again and the page reloads every throttle window in a loop,
 * wiping out whatever the user was doing. Recovery has to drop the stale
 * bundle first.
 */

type ErrorLike = Error & { digest?: string };

export function isChunkLoadError(error: ErrorLike | null | undefined): boolean {
  if (!error) return false;
  return (
    error.name === "ChunkLoadError" ||
    error.message?.includes("Loading chunk") === true ||
    error.message?.includes("Loading CSS chunk") === true ||
    error.message?.includes("Failed to fetch dynamically imported module") === true
  );
}

/**
 * Drop the stale service-worker cache and the SW itself, then reload. The
 * reload can no longer re-serve the document that referenced the missing
 * chunks, so it fetches the current build from the network. The root-mounted
 * `ServiceWorkerRegistrar` re-registers and re-precaches on the next load, so
 * offline support comes back with the fresh bundle.
 *
 * Called only when online: offline, the cached bundle is all there is, and
 * clearing it would leave nothing to render.
 */
export async function recoverFromChunkLoad(
  reload: () => void = () => window.location.reload()
): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.onLine) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    /* registration teardown is best-effort */
  }

  try {
    const cacheKeys = await caches.keys();
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));
  } catch {
    /* cache teardown is best-effort */
  }

  reload();
}
