import type { ApiDefinition } from "./types";

/**
 * UniCC (api-unicc.arya22.dev) - the third-party VTOP proxy, kept ONLY as a
 * last-resort fallback for the operations it actually implements, and only
 * when every AmazeCC host has already failed. Mirrors the pre-existing
 * allowlist in `unicc-fallback.ts` - expressed as a mount so it composes with
 * the rest of the registry instead of living in its own bespoke path.
 */
export const uniccDefinition: ApiDefinition = {
  id: "unicc",
  title: "UniCC (third-party fallback)",
  baseUrl: (process.env.NEXT_PUBLIC_UNICC_API_URL || "https://api-unicc.arya22.dev").replace(/\/+$/, ""),
  auth: ["vtop"],
  routeFor(op) {
    const allowlist = new Set([
      "login",
      "grades",
      "all-grades",
      "attendance",
      "calendar",
      "schedule",
      "hostel",
      "lms-data",
      "vitol-data",
    ]);
    return allowlist.has(op) ? { method: "POST", path: `/${op}` } : null;
  },
};
