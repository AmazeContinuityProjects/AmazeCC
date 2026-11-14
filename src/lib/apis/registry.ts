/**
 * API registry - mounts, resolution, failover.
 *
 * One ordered list of mounts decides where an operation goes. Each definition
 * registers whole *operations*, so the registry can answer "who serves this"
 * without knowing anything about HTTP shapes. Failover is 5xx/timeout/network
 * only - never a 401, never a validation error: a response is an answer, and
 * re-asking it elsewhere would burn VTOP attempts.
 */
import type { ApiAuth, ApiDefinition, ApiRoute } from "./types";
import { honoDefinition } from "./hono";
import { legacyDefinition } from "./legacy";
import { cachePublicDefinition } from "./cache";
import { uniccDefinition } from "./unicc";

/**
 * Mount order = priority. The cache worker diverts the public GETs, hono is
 * the native host, legacy is the traditional backup, UniCC the last resort for
 * the nine operations it actually serves.
 */
const MOUNTS: ApiDefinition[] = [cachePublicDefinition, honoDefinition, legacyDefinition, uniccDefinition];

export interface ResolvedRoute {
  mount: ApiDefinition;
  route: ApiRoute;
  url: string;
  method: "GET" | "POST";
}

const FAIL_STATUSES = new Set([500, 502, 503, 504]);
export function isFailoverStatus(status: number): boolean {
  return FAIL_STATUSES.has(status);
}

function eligible(mount: ApiDefinition, op: string, auth: ApiAuth): ApiRoute | null {
  const route = mount.routeFor(op);
  if (!route) return null;
  const routeAuth = route.auth ?? "vtop";
  if (!mount.auth.includes(routeAuth)) return null;
  // A caller asking for no-auth must never hit an authenticated mount (and
  // vice versa would be the caller's own error, but keep it safe).
  if (auth === "none" && routeAuth !== "none") return null;
  return route;
}

/** Ordered candidates for an operation, filtered for mount + auth fit. */
export function resolveOperation(op: string, auth: ApiAuth = "vtop"): ResolvedRoute[] {
  const out: ResolvedRoute[] = [];
  for (const mount of MOUNTS) {
    const route = eligible(mount, op, auth);
    if (!route) continue;
    out.push({
      mount,
      route,
      url: `${mount.baseUrl}${route.path}`,
      method: route.method ?? "POST",
    });
  }
  return out;
}

/** Single best mount for an operation (diagnostics / tests). */
export function resolveOperationOne(op: string, auth: ApiAuth = "vtop"): ResolvedRoute | null {
  return resolveOperation(op, auth)[0] ?? null;
}

/** Diagnostics: which mounts would be tried, in order. */
export function explainOperation(op: string, auth: ApiAuth = "vtop") {
  return resolveOperation(op, auth).map((r) => ({
    mount: r.mount.id,
    method: r.method,
    path: r.route.path,
    url: r.url,
  }));
}

/** For tests / settings UIs. */
export function listMounts() {
  return MOUNTS.map((m) => ({ id: m.id, title: m.title, baseUrl: m.baseUrl }));
}
