import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  decodeVitfacId,
  encodeVitfacId,
  normalizeFacultyName,
  getVitfacProfileUrl,
  loadVitfacCatalog,
  loadFacultyRoster,
  loadVitfacRankingData,
  getFacultyReview,
  getFacultyProfileBundle,
  setVitfacIntegrationEnabled,
  isVitfacIntegrationEnabled,
  useVitfacEnabled,
  ENABLE_VITFAC_INTEGRATION,
  useChennaiImage,
  type VitfacFaculty,
} from "../lib/vitfacService";
import { safeSessionStorage } from "../lib/ffcsGeneratorSessionPrefs";

describe("vitfacService", () => {
  beforeEach(() => {
    safeSessionStorage.clear();
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

  describe("runtime switch (Planner Settings → Vitfac faculty reviews)", () => {
    afterEach(() => {
      // The flag is module state shared with every other suite in this file —
      // always hand the default back, and drop the persisted preference.
      setVitfacIntegrationEnabled(true);
      try {
        globalThis.localStorage?.removeItem("ffcs_vitfac_enabled");
      } catch {}
    });

    it("persists both ways and forgets the catalog indexed before the flip", async () => {
      expect(isVitfacIntegrationEnabled()).toBe(true);

      const faculty: VitfacFaculty[] = [
        {
          id: "MTAwOTA=",
          name: "Dr. John Doe",
          designation: "Associate Professor Grade 1",
          dept: "SCOPE",
          wPct: 88,
          reviews: 25,
          wCount: 22,
          lCount: 3,
        },
      ];
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        return {
          ok: true,
          json: async () => ({ status: 200, data: { faculty } }),
        } as Response;
      });

      // A disable/enable cycle is the switch's own memory reset — start from
      // a known-empty index so the assertions below can't lean on whatever
      // an earlier test in this file left behind.
      setVitfacIntegrationEnabled(false);
      setVitfacIntegrationEnabled(true);
      fetchSpy.mockClear();

      const catalog = await loadVitfacCatalog();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(catalog.size).toBeGreaterThan(0);
      expect(getFacultyReview({ employeeId: "10090" })).not.toBeNull();

      setVitfacIntegrationEnabled(false);
      expect(isVitfacIntegrationEnabled()).toBe(false);
      expect(globalThis.localStorage?.getItem("ffcs_vitfac_enabled")).toBe("false");
      // The index the switch just dropped was populated a moment ago, so a
      // null here is the gate + the cleared memory, not an empty catalog.
      expect(getFacultyReview({ employeeId: "10090" })).toBeNull();

      setVitfacIntegrationEnabled(true);
      expect(isVitfacIntegrationEnabled()).toBe(true);
      expect(globalThis.localStorage?.getItem("ffcs_vitfac_enabled")).toBe("true");
      // Memory was cleared on the way out, so re-enabling re-indexes…
      const reloaded = await loadVitfacCatalog();
      expect(reloaded.size).toBeGreaterThan(0);
      // …from the cache written on the first load, without another request.
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("makes no network request of any kind while off", async () => {
      setVitfacIntegrationEnabled(false);
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        throw new Error("a Vitfac request happened while the integration was off");
      });

      expect(await loadVitfacCatalog()).toEqual(new Map());
      expect(await loadFacultyRoster()).toEqual([]);
      await expect(getFacultyProfileBundle("10090")).resolves.toBeNull();
      expect(await loadVitfacRankingData([])).toEqual({ available: false, ratings: {} });

      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("re-renders subscribers when the switch flips", () => {
      const { result } = renderHook(() => useVitfacEnabled());
      expect(result.current).toBe(true);

      act(() => setVitfacIntegrationEnabled(false));
      expect(result.current).toBe(false);

      act(() => setVitfacIntegrationEnabled(true));
      expect(result.current).toBe(true);
    });
  });

  describe("useChennaiImage direct fetch from chennai.vit.ac.in", () => {
    // Images are resolved by AmazeCC itself, directly from chennai.vit.ac.in
    // (the browser repairs VIT's incomplete certificate chain via AIA
    // fetching). The cache worker is deliberately NOT used here — workerd's
    // strict TLS verification rejects that chain and silently lost photos.
    const EMP = "10090";
    const FM = 191027;

    const seedRoster = () => {
      safeSessionStorage.setItem(
        "amazecc_faculty_roster_v1",
        JSON.stringify([{ employeeId: EMP, name: "Dr. John Doe", school: "scope", featuredMedia: FM }]),
      );
      safeSessionStorage.setItem("amazecc_faculty_roster_ts_v1", String(Date.now()));
    };

    const okJson = (payload: unknown) => ({ ok: true, json: async () => payload }) as Response;
    const notOk = { ok: false, status: 502 } as Response;

    beforeEach(() => {
      seedRoster();
    });

    it("resolves directly from chennai.vit.ac.in and never touches the worker", async () => {
      const seen: string[] = [];
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        const u = String(url);
        seen.push(u);
        if (u.includes("chennai.vit.ac.in")) return okJson({ source_url: "https://cdn.example/direct.jpg" });
        return notOk;
      });

      const { result } = renderHook(() => useChennaiImage(EMP));
      await vi.waitFor(() => {
        if (result.current !== "https://cdn.example/direct.jpg") throw new Error("not resolved");
      });
      expect(result.current).toBe("https://cdn.example/direct.jpg");
      expect(seen.some((u) => u.includes("/wp-media/"))).toBe(false);
    });

    it("keeps the guid fallback, which is how some media rows carry the URL", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async (url: any) => {
        if (String(url).includes("chennai.vit.ac.in"))
          return okJson({ guid: { rendered: "https://cdn.example/guid.jpg" } });
        return notOk;
      });

      const { result } = renderHook(() => useChennaiImage(EMP));
      await vi.waitFor(() => {
        if (result.current !== "https://cdn.example/guid.jpg") throw new Error("not resolved");
      });
      expect(result.current).toBe("https://cdn.example/guid.jpg");
    });

    it("stays null when chennai cannot answer", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => notOk);
      const { result } = renderHook(() => useChennaiImage(EMP));
      await vi.waitFor(() => {
        if (fetchSpy.mock.calls.length === 0) throw new Error("no fetch yet");
      });
      await new Promise((r) => setTimeout(r, 50));
      expect(result.current).toBeNull();
    });
  });

  describe("getFacultyInitials", () => {
    it("uses avatar string if provided", async () => {
      const { getFacultyInitials } = await import("../components/custom/exams/FFCS/components/FacultyReviewSheet");
      expect(getFacultyInitials("Dr. Rajesh Goswami", "DR")).toBe("DR");
    }, 15000);

    it("parses initials from name by stripping academic titles", async () => {
      const { getFacultyInitials } = await import("../components/custom/exams/FFCS/components/FacultyReviewSheet");
      expect(getFacultyInitials("Prof. Arnab Kayal")).toBe("AK");
      expect(getFacultyInitials("Dr. Venkatesan C")).toBe("VC");
      expect(getFacultyInitials("Muthulakshmi")).toBe("MU");
    }, 15000);
  });
});
