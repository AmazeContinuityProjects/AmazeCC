/**
 * API registry - mounts, resolution, failover.
 *
 * Mounts are declared in `spec.json` (or the `NEXT_PUBLIC_API_MOUNTS` env
 * override); definition files in this directory carry the shape and behavior;
 * the registry resolves operations against the ordered mount list and keeps
 * selection + diagnostics in one place.
 *
 * Failover is 5xx/timeout/network only - never a 401, never a 4xx. A response
 * is an answer, and re-asking it elsewhere would burn VTOP attempts.
 */
import type { ApiAuth, ApiDefinition, ApiRoute } from "./types";
import { honoDefinition } from "./hono";
import { legacyDefinition } from "./legacy";
import { cachePublicDefinition } from "./cache";
import { uniccDefinition } from "./unicc";
import { loadMountSpec, type MountSpecEntry } from "./spec";

/** lib key (in the spec) -> the definition file providing the behavior. */
const LIBS: Record<string, ApiDefinition> = {
  "cache-public": cachePublicDefinition,
  hono: honoDefinition,
  legacy: legacyDefinition,
  unicc: uniccDefinition,
};

export interface MountedApi extends ApiDefinition {
  /** Stable id from the spec (usually the same as `lib`, but may differ). */
  mountId: string;
  /** Display name for UIs and the settings picker. */
  name: string;
  /** Position in the resolved order. */
  index: number;
}

function buildMounts(): MountedApi[] {
  const spec = loadMountSpec();
  const order = spec.order.length ? spec.order : Object.keys(spec.mounts);
  const out: MountedApi[] = [];
  for (const id of order) {
    const entry: MountSpecEntry | undefined = spec.mounts[id];
    if (!entry || entry.enabled === false) continue;
    const impl = LIBS[entry.lib];
    if (!impl) {
      console.warn(`[apis] spec mount '${id}' names unknown lib '${entry.lib}' - skipped`);
      continue;
    }
    out.push({
      ...impl,
      mountId: id,
      name: entry.name ?? impl.title,
      baseUrl: entry.baseUrl ?? impl.baseUrl,
      index: out.length,
    });
  }
  return out;
}

/** Mount registration - call once at module import (client-side). */
export const MOUNTS: MountedApi[] = buildMounts();

export interface ResolvedRoute {
  mount: MountedApi;
  route: ApiRoute;
  url: string;
  method: "GET" | "POST";
}

const FAIL_STATUSES = new Set([500, 502, 503, 504]);
export function isFailoverStatus(status: number): boolean {
  return FAIL_STATUSES.has(status);
}

/** Read the user's preferred mount id from localStorage (never throws). */
export function getPreferredMount(): string | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return null;
  try {
    return localStorage.getItem("amazecc_api_pref");
  } catch {
    return null;
  }
}

/** Persist the user's preferred mount id ("auto" clears it). */
export function setPreferredMount(id: string | "auto"): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    if (id === "auto") localStorage.removeItem("amazecc_api_pref");
    else localStorage.setItem("amazecc_api_pref", id);
  } catch {
    // storage unavailable - the in-memory preference is lost, nothing else
  }
}

function eligible(mount: MountedApi, op: string, auth: ApiAuth): ApiRoute | null {
  const route = mount.routeFor(op);
  if (!route) return null;
  const routeAuth = route.auth ?? "vtop";
  if (!mount.auth.includes(routeAuth)) return null;
  if (auth === "none" && routeAuth !== "none") return null;
  return route;
}

/** Ordered candidates for an operation, filtered for mount + auth fit. */
export function resolveOperation(op: string, auth: ApiAuth = "vtop"): ResolvedRoute[] {
  const out: ResolvedRoute[] = [];
  const preferred = getPreferredMount();
  const mounts = preferred
    ? [...MOUNTS].sort((a, b) => (a.mountId === preferred ? -1 : b.mountId === preferred ? 1 : 0))
    : MOUNTS;
  for (const mount of mounts) {
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
    mount: r.mount.mountId,
    name: r.mount.name,
    method: r.method,
    path: r.route.path,
    url: r.url,
  }));
}

/** Mount list for UIs — name/order/baseUrl, only enabled mounts. */
export function listMounts() {
  return MOUNTS.map((m) => ({ id: m.mountId, lib: m.id, name: m.name, baseUrl: m.baseUrl, title: m.title }));
}

/** Does the named mount serve `op` for `auth`? Used by pickers to hide irrelevant mounts. */
export function mountServes(mountId: string, op: string, auth: ApiAuth = "vtop"): boolean {
  const m = MOUNTS.find((x) => x.mountId === mountId);
  if (!m) return false;
  return eligible(m, op, auth) !== null;
}
