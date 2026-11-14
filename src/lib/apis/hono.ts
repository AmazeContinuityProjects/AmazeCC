import type { ApiDefinition } from "./types";

/**
 * amazecc-api-hono (https://hono.amazecc.com) - the Cloudflare Worker that is
 * the primary API host.
 *
 * Native shape - NOT compatible with the legacy host for a few operations:
 *   - VTOP scrapers:  POST /api/<op>          (1:1 with legacy, incl. aliased /api/remote/<op>)
 *   - services:       POST /api/services/<op> (marks/stats, marks/sync, marks/tokens,
 *                                              enroll, faculty/scrape, faculty/schools)
 *                     (legacy serves those at /api/<op> with NO /services prefix)
 *   - admin:          /api/admin/*             (Amaze ID Bearer, section-gated)
 *   - health:         /api/health, /api/status
 *   - /api/*          reverse-PROXIES anything else to api.amazecc.com
 *
 * The client adapts to THIS shape - the proxy is the server's problem, not the
 * client's. Anything this mount can't prove it serves natively still gets
 * proxied server-side, but the client never depends on that being true.
 */
export const honoDefinition: ApiDefinition = {
  id: "hono",
  title: "AmazeCC (Cloudflare Workers)",
  baseUrl: (process.env.NEXT_PUBLIC_HONO_API_URL || "https://hono.amazecc.com").replace(/\/+$/, ""),
  auth: ["vtop", "eventhub", "none"],
  routeFor(op) {
    // Services live under /services/* on hono (legacy has them at /api/*).
    const services = new Set([
      "marks/stats",
      "marks/sync",
      "marks/tokens",
      "enroll",
      "faculty/scrape",
      "faculty/schools",
    ]);
    if (services.has(op)) return { method: "POST", path: `/services/${op}` };
    // Every remote scraper is also aliased at /api/* and behaves like legacy.
    return { method: "POST", path: `/${op}` };
  },
};
