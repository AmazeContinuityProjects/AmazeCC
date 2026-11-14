import type { ApiDefinition } from "./types";

/**
 * cache.amazecc.com - the edge-cached public API. GETs only; no credentials,
 * ever. Serves what this mount lists, byte-identical to its other consumers.
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
        return null;
    }
  },
};
