import { describe, it, expect, beforeEach } from "vitest";
import { hasStoredAppSession, hasStoredVtopCredentials } from "@/components/custom/app/readBootstrapSnapshot";
import { storage } from "@/lib/storage";

describe("readBootstrapSnapshot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("hasStoredVtopCredentials", () => {
    it("returns false when both IDs and legacy credentials are missing", () => {
      expect(hasStoredVtopCredentials(null, null, null)).toBe(false);
      expect(hasStoredVtopCredentials({}, null, null)).toBe(false);
    });

    it("returns true when IDs object has VtopUsername and VtopPassword", () => {
      expect(hasStoredVtopCredentials({ VtopUsername: "21BCE0001", VtopPassword: "secretPassword" }, null, null)).toBe(
        true,
      );
    });

    it("returns false when IDs object only has username or password partially", () => {
      expect(hasStoredVtopCredentials({ VtopUsername: "21BCE0001" }, null, null)).toBe(false);
      expect(hasStoredVtopCredentials({ VtopPassword: "secretPassword" }, null, null)).toBe(false);
    });

    it("returns true when legacy credentials exist", () => {
      expect(hasStoredVtopCredentials(null, "21BCE0001", "secretPassword")).toBe(true);
    });
  });

  describe("hasStoredAppSession", () => {
    it("recognizes no login key in storage for first-time guests", () => {
      expect(hasStoredAppSession()).toBe(false);
    });

    it("recognizes active session when IDs are stored", () => {
      storage.ids.set({
        VtopUsername: "21BCE1234",
        VtopPassword: "password123",
      } as any);
      expect(hasStoredAppSession()).toBe(true);
    });

    it("recognizes active session when legacy credentials are stored", () => {
      storage.username.set("21BCE1234");
      storage.password.set("password123");
      expect(hasStoredAppSession()).toBe(true);
    });

    it("recognizes active session when demoMode is active", () => {
      storage.demoMode.set(true);
      expect(hasStoredAppSession()).toBe(true);
    });
  });
});
