import type { ApiDefinition } from "./types";
import { noAuthRoute } from "./no-auth";

/**
 * api.amazecc.com - the traditional Next.js API. Kept as the first fallback
 * and as the reference for shape parity with the Worker.
 *
 * Same operations as hono but with the legacy route shape (no /services
 * prefix for marks/enroll/faculty).
 */
export const legacyDefinition: ApiDefinition = {
  id: "legacy",
  title: "AmazeCC (traditional API)",
  baseUrl: (process.env.NEXT_PUBLIC_API_URL || "https://api.amazecc.com").replace(/\/+$/, ""),
  auth: ["vtop", "eventhub", "none"],
  routeFor(op) {
    return noAuthRoute(op) ?? { method: "POST", path: `/${op}` };
  },
};
