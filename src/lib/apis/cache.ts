import type { ApiDefinition } from "./types";

/**
 * cache.amazecc.com - the edge-cached public API (bus routes, fresher
 * resources, mess menus, ...). GETs only; no credentials, ever - the whole
 * point of this mount is that it serves byte-identical public data to
 * everyone, aggressively cached at the edge.
 */
export const cachePublicDefinition: ApiDefinition = {
  id: "cache",
  title: "AmazeCC cache (public)",
  baseUrl: (process.env.NEXT_PUBLIC_WORKER_BASE || "https://cache.amazecc.com").replace(/\/+$/, ""),
  auth: ["none"],
  routeFor(op) {
    switch (op) {
      case "buses":
        return { method: "GET", path: "/transport/buses", auth: "none" };
      case "fresher-resources":
        return { method: "GET", path: "/fresher/resources", auth: "none" };
      default:
        return null; // not a public route - do not mount it here
    }
  },
};
