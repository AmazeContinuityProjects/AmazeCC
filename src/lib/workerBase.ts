import { API_BASE } from "./fetch-utils";

/**
 * Base URL of the Cloudflare Worker (`cache.amazecc.com`).
 *
 * The worker is the single cached source for every piece of *public* data the
 * app needs — faculty (see `vitfacService.ts`), bus routes, fresher resources,
 * mess menus, laundry slots, the changelog, VIT faculty photos.
 *
 * Overridable for local worker development (`wrangler dev` serves on
 * localhost:8787).
 */
export const WORKER_BASE = (process.env.NEXT_PUBLIC_WORKER_BASE || "https://cache.amazecc.com").replace(/\/+$/, "");

/**
 * API routes the Worker answers instead of api.amazecc.com.
 *
 * A route belongs here only if it needs **no student credentials**: the worker
 * has no way to log into VTOP, and caching a credentialed response would leak
 * one student's data to every other student. That single rule is why this list
 * is three entries long while the app calls fifty routes — attendance, marks,
 * hostel, payments and the rest all need a live VTOP session and stay on the
 * API host, where the existing primary→backup→UniCC failover still applies.
 *
 * The worker caches aggressively (hours to days) and keeps a stale copy well
 * past its freshness window, so these routes degrade to slightly-old data
 * rather than to an error. That resilience replaces the failover they give up
 * by leaving the API host.
 *
 * Keys are the bare route names `request()`/`apiRequest()` receive.
 */
const WORKER_ROUTES: ReadonlyMap<string, string> = new Map([
  ["buses", "/transport/buses"],
  ["fresher-resources", "/fresher/resources"],
]);

/**
 * Resolve an API route name to a full URL, diverting the handful of public
 * routes the Worker serves and leaving everything else on the API host.
 *
 * `auth` is checked rather than trusted: a caller that later gains credentials
 * must not have them posted to a shared cache by accident. The guard costs one
 * comparison and removes a whole class of future leak.
 */
export function resolveApiRoute(path: string, auth?: string): string {
  if (auth === undefined || auth === "none") {
    const workerPath = WORKER_ROUTES.get(path);
    if (workerPath) return `${WORKER_BASE}${workerPath}`;
  }
  return `${API_BASE}/api/${path}`;
}

/** Whether a route is served by the Worker. Tests and diagnostics use this. */
export function isWorkerRoute(path: string): boolean {
  return WORKER_ROUTES.has(path);
}
