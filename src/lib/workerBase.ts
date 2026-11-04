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
 * Base URL of the Cloudflare CDN (`cdn.amazecc.com`).
 *
 * Fronts Supabase Storage for faculty photos and public media to protect
 * the origin database and buckets from getting overwhelmed.
 */
export const CDN_BASE = (process.env.NEXT_PUBLIC_CDN_BASE || "https://cdn.amazecc.com").replace(/\/+$/, "");

/**
 * Return the canonical unified CDN image URL for a faculty member.
 * The CDN serves as a single chokepoint that resolves and permanently caches
 * the highest quality version across Supabase, VIT Chennai WordPress, and Directorycc.
 *
 * e.g. "https://cdn.amazecc.com/faculty/51351.webp"
 */
export function getFacultyCdnUrl(employeeId: string | null | undefined): string | null {
  if (!employeeId) return null;
  const trimmed = employeeId.trim();
  if (!trimmed) return null;
  return `${CDN_BASE}/faculty/${trimmed}.webp`;
}

/**
 * Rewrite Supabase Storage and VIT Chennai media URLs to the Cloudflare CDN.
 * Safe to pass null/undefined or already-rewritten URLs through.
 */
export function toCdnImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith(CDN_BASE)) return trimmed;
  // Supabase storage public URLs:
  // e.g. https://blfxhlmpvdhcpdwgrffr.supabase.co/storage/v1/object/public/images/51351.webp -> https://cdn.amazecc.com/images/51351.webp
  if (/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//i.test(trimmed)) {
    return trimmed.replace(/^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\//i, `${CDN_BASE}/`);
  }
  // VIT Chennai WordPress media / upload URLs:
  // e.g. https://chennai.vit.ac.in/wp-content/uploads/faculty.jpg -> https://cdn.amazecc.com/chennai/wp-content/uploads/faculty.jpg
  if (/^https:\/\/chennai\.vit\.ac\.in\//i.test(trimmed)) {
    return trimmed.replace(/^https:\/\/chennai\.vit\.ac\.in\//i, `${CDN_BASE}/chennai/`);
  }
  return trimmed;
}

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
