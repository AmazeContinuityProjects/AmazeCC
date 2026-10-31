import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  decodeVitfacId,
  encodeVitfacId,
  normalizeFacultyName,
  getVitfacProfileUrl,
  resetVitfacCatalogForTesting,
  loadVitfacCatalog,
  getFacultyReview,
  getFacultyProfileBundle,
  ENABLE_VITFAC_INTEGRATION,
  VITFAC_WORKER_BASE,
  type VitfacFaculty,
} from "../lib/vitfacService";
import { safeSessionStorage } from "../lib/ffcsGeneratorSessionPrefs";

describe("vitfacService", () => {
  beforeEach(() => {
    safeSessionStorage.clear();
    resetVitfacCatalogForTesting();
    vi.restoreAllMocks();
  });

  describe("Base64 ID encoding and decoding", () => {
    it("encodes numeric employee ID to base64", () => {
      expect(encodeVitfacId("10090")).toBe("MTAwOTA=");
      expect(encodeVitfacId("12345")).toBe("MTIzNDU=");
    });

    it("decodes base64 ID to numeric employee ID", () => {
      expect(decodeVitfacId("MTAwOTA=")).toBe("10090");
      expect(decodeVitfacId("MTIzNDU=")).toBe("12345");
    });
  });

  describe("Faculty name normalization", () => {
    it("strips prefixes and punctuation", () => {
      expect(normalizeFacultyName("Dr. John Doe")).toBe("johndoe");
      expect(normalizeFacultyName("Prof. Jane Smith")).toBe("janesmith");
      expect(normalizeFacultyName("Mr. Bob Dylan")).toBe("bobdylan");
      expect(normalizeFacultyName("MS. ALICE WONDER")).toBe("alicewonder");
    });
  });

  describe("getVitfacProfileUrl", () => {
    it("generates direct vitfac profile link from numeric employee ID", () => {
      const url = getVitfacProfileUrl("10090");
      expect(url).toBe("https://vitfac.pages.dev/profile?id=MTAwOTA%3D");
    });

    it("handles pre-encoded base64 ID", () => {
      const url = getVitfacProfileUrl("MTAwOTA=");
      expect(url).toBe("https://vitfac.pages.dev/profile?id=MTAwOTA%3D");
    });

    it("generates direct link when passed target object with employeeId", () => {
      const url = getVitfacProfileUrl({ employeeId: "10269" });
      expect(url).toBe("https://vitfac.pages.dev/profile?id=MTAyNjk%3D");
    });

    it("generates direct link when passed target object with vitfacId", () => {
      const url = getVitfacProfileUrl({ vitfacId: "MTAyNjk=" });
      expect(url).toBe("https://vitfac.pages.dev/profile?id=MTAyNjk%3D");
    });

    it("never emits internal database UUIDs to vitfac.pages.dev", () => {
      const url = getVitfacProfileUrl("86ded97d-f6a3-4924-87ba-b2cfaf184060");
      expect(url).not.toContain("86ded97d-f6a3-4924-87ba-b2cfaf184060");
    });
  });

  describe("Catalog loading and lookup", () => {
    const mockFacultyList: VitfacFaculty[] = [
      {
        id: "MTAwOTA=",
        name: "Dr. John Doe",
        designation: "Associate Professor Grade 1",
        dept: "SCOPE",
        wPct: 88,
        reviews: 25,
        wCount: 22,
        lCount: 3,
        metrics: { lecture: 4.2, da: 4.5, vibe: 4.0 },
        lore: {
          green: [{ text: "Chill", count: 12 }],
          red: [{ text: "Strict Attendance", count: 2 }],
        },
      },
    ];

    it("fetches catalog from worker, caches it, and resolves lookups by employeeId and name", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        if (String(url).endsWith("/faculty")) {
          return {
            ok: true,
            json: async () => ({
              status: 200,
              data: { faculty: mockFacultyList },
            }),
          } as Response;
        }
        return { ok: false, status: 404 } as Response;
      });

      const catalog = await loadVitfacCatalog();
      expect(catalog.size).toBeGreaterThan(0);

      // Lookup by decoded employeeId
      const byEmp = getFacultyReview({ employeeId: "10090" });
      expect(byEmp).not.toBeNull();
      expect(byEmp?.name).toBe("Dr. John Doe");
      expect(byEmp?.wPct).toBe(88);

      // Lookup by base64 ID
      const byB64 = getFacultyReview({ employeeId: "MTAwOTA=" });
      expect(byB64?.wPct).toBe(88);

      // Lookup by name
      const byName = getFacultyReview({ name: "John Doe" });
      expect(byName?.wPct).toBe(88);
    });

    it("fetches individual profile bundle and synchronizes with courseStats.global", async () => {
      const mockBundle = {
        prof: { ...mockFacultyList[0], wPct: 1, reviews: 10 },
        courseStats: {
          global: {
            reviews: 68,
            wPct: 69,
          },
        },
      };

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        if (String(url).includes("/profile/")) {
          return {
            ok: true,
            json: async () => ({
              status: 200,
              data: mockBundle,
            }),
          } as Response;
        }
        return { ok: false } as Response;
      });

      const bundle = await getFacultyProfileBundle("10090");
      expect(bundle).not.toBeNull();
      expect(bundle?.prof.name).toBe("Dr. John Doe");
      expect(bundle?.prof.wPct).toBe(69);
      expect(bundle?.prof.reviews).toBe(68);
      expect(bundle?.courseStats?.global?.wPct).toBe(69);

      // Verify that in-memory catalog was also enriched with the live aggregated stats
      const enrichedInCatalog = getFacultyReview({ employeeId: "10090" });
      expect(enrichedInCatalog?.wPct).toBe(69);
      expect(enrichedInCatalog?.reviews).toBe(68);
    });
  });

  describe("ENABLE_VITFAC_INTEGRATION switch", () => {
    it("is exported as a boolean switch and defaults to true", () => {
      expect(typeof ENABLE_VITFAC_INTEGRATION).toBe("boolean");
      expect(ENABLE_VITFAC_INTEGRATION).toBe(true);
    });
  });

  describe("getFacultyInitials", () => {
    it("uses avatar string if provided", async () => {
      const { getFacultyInitials } = await import(
        "../components/custom/exams/FFCS/components/FacultyReviewSheet"
      );
      expect(getFacultyInitials("Dr. Rajesh Goswami", "DR")).toBe("DR");
    }, 15000);

    it("parses initials from name by stripping academic titles", async () => {
      const { getFacultyInitials } = await import(
        "../components/custom/exams/FFCS/components/FacultyReviewSheet"
      );
      expect(getFacultyInitials("Prof. Arnab Kayal")).toBe("AK");
      expect(getFacultyInitials("Dr. Venkatesan C")).toBe("VC");
      expect(getFacultyInitials("Muthulakshmi")).toBe("MU");
    }, 15000);
  });
});

