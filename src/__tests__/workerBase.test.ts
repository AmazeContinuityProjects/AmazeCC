import { describe, it, expect } from "vitest";
import {
  WORKER_BASE,
  CDN_BASE,
  toCdnImageUrl,
  getFacultyCdnUrl,
  resolveApiRoute,
  isWorkerRoute,
} from "../lib/workerBase";
import { PRIMARY_API_URL } from "../lib/fetch-utils";

/**
 * The Worker diversion is a small piece of routing with a large blast radius:
 * get it wrong and either a credentialed VTOP route posts a student's cookies
 * to a shared cache, or a public route quietly stops working. Both failure
 * modes are silent at runtime — the app renders, just with someone else's bus
 * routes — so they are pinned here rather than left to be found on campus.
 */
describe("workerBase", () => {
  describe("WORKER_BASE", () => {
    it("defaults to the production worker host", () => {
      // No NEXT_PUBLIC_WORKER_BASE is set in the test env.
      expect(WORKER_BASE).toBe("https://cache.amazecc.com");
    });

    it("never carries a trailing slash", () => {
      // A trailing slash would produce `https://host//transport/buses`, and
      // every route in the app is composed by string concatenation.
      expect(WORKER_BASE.endsWith("/")).toBe(false);
    });
  });

  describe("CDN_BASE & toCdnImageUrl", () => {
    it("defaults to the production cdn host", () => {
      expect(CDN_BASE).toBe("https://cdn.amazecc.com");
      expect(CDN_BASE.endsWith("/")).toBe(false);
    });

    it("rewrites Supabase storage URLs to CDN URLs", () => {
      const supabaseUrl = "https://blfxhlmpvdhcpdwgrffr.supabase.co/storage/v1/object/public/images/51351.webp";
      expect(toCdnImageUrl(supabaseUrl)).toBe("https://cdn.amazecc.com/images/51351.webp");
    });

    it("passes through already rewritten CDN URLs untouched", () => {
      const cdnUrl = "https://cdn.amazecc.com/images/51351.webp";
      expect(toCdnImageUrl(cdnUrl)).toBe(cdnUrl);
    });

    it("handles null, undefined, and empty string safely", () => {
      expect(toCdnImageUrl(null)).toBeNull();
      expect(toCdnImageUrl(undefined)).toBeNull();
      expect(toCdnImageUrl("   ")).toBeNull();
    });

    it("rewrites chennai.vit.ac.in media URLs to CDN URLs", () => {
      const chennaiUrl = "https://chennai.vit.ac.in/wp-content/uploads/2023/10/faculty.jpg";
      expect(toCdnImageUrl(chennaiUrl)).toBe("https://cdn.amazecc.com/chennai/wp-content/uploads/2023/10/faculty.jpg");
    });

    it("leaves third-party non-proxied URLs untouched", () => {
      const otherUrl = "https://images.unsplash.com/photo-123456";
      expect(toCdnImageUrl(otherUrl)).toBe(otherUrl);
    });
  });

  describe("getFacultyCdnUrl", () => {
    it("builds the unified faculty webp CDN url", () => {
      expect(getFacultyCdnUrl("51351")).toBe("https://cdn.amazecc.com/faculty/51351.webp");
    });

    it("trims whitespace from employee id", () => {
      expect(getFacultyCdnUrl("  54162  ")).toBe("https://cdn.amazecc.com/faculty/54162.webp");
    });

    it("returns null for empty, null, or undefined employee id", () => {
      expect(getFacultyCdnUrl(null)).toBeNull();
      expect(getFacultyCdnUrl(undefined)).toBeNull();
      expect(getFacultyCdnUrl("")).toBeNull();
      expect(getFacultyCdnUrl("   ")).toBeNull();
    });
  });

  describe("isWorkerRoute", () => {
    it("claims exactly the public routes the Worker serves", () => {
      expect(isWorkerRoute("buses")).toBe(true);
      expect(isWorkerRoute("fresher-resources")).toBe(true);
    });

    it("does not claim a credentialed route", () => {
      // The list must stay short. Every one of these needs a live VTOP
      // session, and the Worker has no way to create one.
      for (const route of [
        "attendance",
        "marks/stats",
        "grades",
        "schedule",
        "hostel",
        "student",
        "transport",
        "payments",
        "wallet",
        "credentials",
        "od",
        "lms-data",
        "circulars",
        "events/profile",
        "koha/patron",
        "social/people",
      ]) {
        expect(isWorkerRoute(route)).toBe(false);
      }
    });
  });

  describe("resolveApiRoute", () => {
    it("diverts a public route to the Worker", () => {
      expect(resolveApiRoute("buses")).toBe(`${WORKER_BASE}/transport/buses`);
      expect(resolveApiRoute("fresher-resources")).toBe(`${WORKER_BASE}/fresher/resources`);
    });

    it("leaves every other route on the API host", () => {
      expect(resolveApiRoute("attendance")).toBe(`${PRIMARY_API_URL}/api/attendance`);
      expect(resolveApiRoute("marks/sync")).toBe(`${PRIMARY_API_URL}/api/marks/sync`);
    });

    it("does not divert a public route when a credential domain is attached", () => {
      // The safety net for a future regression: `buses` is public *today*, but
      // if a caller starts passing credentials with it the request must stay
      // on the API host rather than post them to a shared cache.
      expect(resolveApiRoute("buses", "vtop")).toBe(`${PRIMARY_API_URL}/api/buses`);
      expect(resolveApiRoute("buses", "eventhub")).toBe(`${PRIMARY_API_URL}/api/buses`);
      expect(resolveApiRoute("fresher-resources", "vtop")).toBe(`${PRIMARY_API_URL}/api/fresher-resources`);
    });

    it("treats an explicit 'none' the same as an omitted auth", () => {
      // `apiRequest` defaults `auth` to "none" and passes it through, so the
      // two must agree or the same call would route differently by call site.
      expect(resolveApiRoute("buses", "none")).toBe(resolveApiRoute("buses"));
    });
  });
});
