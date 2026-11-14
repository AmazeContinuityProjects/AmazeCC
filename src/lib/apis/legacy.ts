import type { ApiDefinition } from "./types";
import { NO_AUTH_OPERATIONS } from "./no-auth";

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
    const noAuthMethod = NO_AUTH_OPERATIONS.get(op);
    if (noAuthMethod) return { method: noAuthMethod, path: `/${op}`, auth: "none" };
    return { method: "POST", path: `/${op}` };
  },
};
