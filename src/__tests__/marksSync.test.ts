import { describe, it, expect, vi, beforeEach } from "vitest";
import { assessmentKeyFor, remapCohortStats, syncMarksDiff } from "@/lib/marksSync";
import { normalisedPct } from "@/components/custom/exams/courseHelpers";

vi.mock("@/lib/sync-engine", () => ({ api: vi.fn() }));
import { api } from "@/lib/sync-engine";

/**
 * jsdom hands vitest an opaque origin, so `localStorage` is absent. Same in-memory
 * shim as the other suites that need it.
 */
function installLocalStorage() {
  const map = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: stub,
    configurable: true,
    writable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: stub,
      configurable: true,
      writable: true,
    });
  }
}

installLocalStorage();

/**
 * The client side of the two cross-boundary contracts the cohort statistics
 * depend on.
 *
 * `assessmentKeyFor` must agree byte-for-byte with
 * `AmazeCC-API/src/lib/marksStats.ts`. The expected value below was computed
 * independently on both sides; if either implementation changes, this test and
 * its server twin (`marksStats.test.ts`) must change together, or every read
 * silently misses.
 */
describe("assessmentKeyFor (client)", () => {
  it("matches the server implementation byte-for-byte", async () => {
    await expect(
      assessmentKeyFor(
        "CH2026270102001",
        "theory",
        "Continuous Assessment Test - I"
      )
    ).resolves.toBe("980839950cdf23ab162c753ae63ad4b8");
  });

  it("separates theory from lab", async () => {
    const theory = await assessmentKeyFor("X", "theory", "CAT I");
    const lab = await assessmentKeyFor("X", "lab", "CAT I");
    expect(theory).not.toBe(lab);
  });
});

/**
 * `remapCohortStats` translates the server payload into what the course pages read.
 *
 * Regression test for a real outage: the implementation read `entry.overall`, a key
 * the server never sends (it carries the figure flat as `{ count, mean, sd }`), and
 * `?? null` turned that into permanent, silent "no data" on every marks page while
 * localStorage held perfect statistics.
 */
describe("remapCohortStats", () => {
  const CLASS = "CH2026270102001";
  const serverEntry = {
    count: 25,
    mean: 53.36,
    sd: 14.03,
    assessments: {} as Record<string, unknown>,
  };

  it("reads the flat overall figure, not a nested key", async () => {
    const out = await remapCohortStats({ [CLASS]: serverEntry }, []);
    expect(out[CLASS].overall).toEqual({ count: 25, mean: 53.36, sd: 14.03 });
  });

  it("maps each assessment by its re-derived digest key", async () => {
    const key = await assessmentKeyFor(CLASS, "theory", "Continuous Assessment Test - I");
    const payload = {
      [CLASS]: {
        ...serverEntry,
        assessments: { [key]: { count: 12, mean: 68.5, sd: 9.1 } },
      },
    };
    const courses = [
      {
        theory: {
          classNbr: CLASS,
          assessments: [{ title: "Continuous Assessment Test - I" }],
        },
        lab: null,
      },
    ];
    const out = await remapCohortStats(payload, courses);
    expect(out[CLASS].assessments["Continuous Assessment Test - I"]).toEqual({
      count: 12,
      mean: 68.5,
      sd: 9.1,
    });
  });

  it("yields null overall when the entry carries no figure", async () => {
    const out = await remapCohortStats({ [CLASS]: { assessments: {} } }, []);
    expect(out[CLASS].overall).toBeNull();
    expect(out[CLASS].assessments).toEqual({});
  });

  it("ignores assessments with no matching statistic", async () => {
    const out = await remapCohortStats(
      { [CLASS]: serverEntry },
      [
        {
          theory: { classNbr: CLASS, assessments: [{ title: "CAT II" }] },
          lab: null,
        },
      ]
    );
    expect(out[CLASS].overall).toEqual({ count: 25, mean: 53.36, sd: 14.03 });
    expect(out[CLASS].assessments).toEqual({});
  });
});
/**
 * One-time backfill.
 *
 * Per-assessment statistics only arrive when a mark *changes*, so stable marks would
 * otherwise never contribute. The first sync sends everything once; the server
 * reconciles each against any legacy record and mints a token, and later syncs resume
 * diffing. The flag is set only on success so a failed backfill retries.
 */
describe("syncMarksDiff backfill", () => {
  const MARKS = {
    courses: [
      {
        courseCode: "AAA1001",
        courseType: "Theory Only",
        classNbr: "C1",
        slot: "A1",
        credits: 3,
        assessments: [
          { title: "CAT I", maxMark: 50, scoredMark: 40, weightagePercent: 15, weightageMark: 12 },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("sends unchanged values on the first sync", async () => {
    (api as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tally: { added: 2 }, tokens: {} }),
    });
    // Identical old and new: normal diffing would send nothing.
    await syncMarksDiff(MARKS, MARKS);
    const calls = (api as ReturnType<typeof vi.fn>).mock.calls;
    // First the sync itself…
    expect(calls[0][0]).toBe("marks/sync");
    expect(calls[0][1].body.contributions.length).toBeGreaterThan(0);
    // …then the bootstrap, because the store started empty and the sync returned
    // no receipts to file.
    expect(calls[1][0]).toBe("marks/tokens");
    expect(window.localStorage.getItem("marksSyncBackfillV1")).toBe("true");
  });

  it("skips unchanged values once the backfill is done", async () => {
    window.localStorage.setItem("marksSyncBackfillV1", "true");
    (api as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, tokens: [], legacy: [] }),
    });
    await syncMarksDiff(MARKS, MARKS);
    // The only call is the token bootstrap (store was empty); no marks are sent.
    expect(api).toHaveBeenCalledOnce();
    expect((api as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("marks/tokens");
  });

  it("retries the backfill after a failure", async () => {
    (api as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false });
    await syncMarksDiff(MARKS, MARKS);
    expect(window.localStorage.getItem("marksSyncBackfillV1")).toBeNull();
  });

  it("still sends genuinely changed marks without the backfill", async () => {
    window.localStorage.setItem("marksSyncBackfillV1", "true");
    (api as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    const changed = JSON.parse(JSON.stringify(MARKS));
    changed.courses[0].assessments[0].scoredMark = 45;
    await syncMarksDiff(MARKS, changed);
    expect(api).toHaveBeenCalledOnce();
  });
});

/**
 * Token store, continuity receipts, and frozen visibility.
 *
 * The server returns an HMAC receipt for every accepted write and the full token set
 * on bootstrap. The client files them, checks that unchanged resends echo back
 * identical tokens (a difference means server state moved without us), and reports
 * which held keys this sync did not cover — contributions it cannot update.
 */
describe("token receipts and frozen visibility", () => {
  const MARKS2 = {
    courses: [
      {
        courseCode: "AAA1001",
        courseType: "Theory Only",
        classNbr: "C1",
        slot: "A1",
        credits: 3,
        assessments: [
          { title: "CAT I", maxMark: 50, scoredMark: 40, weightagePercent: 15, weightageMark: 12 },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("stores returned receipts and reports no mismatch on a clean sync", async () => {
    const { getStoredTokens, syncMarksDiff: sync } = await import("@/lib/marksSync");
    (api as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        tally: { added: 2 },
        tokens: { "C1::overall::overall": "tok-overall" },
      }),
    });

    const result = await sync(MARKS2, MARKS2);

    expect(result.mismatches).toEqual([]);
    expect(getStoredTokens()["C1::overall::overall"]).toBe("tok-overall");
  });

  it("flags an unchanged resend whose token moved", async () => {
    // No backfill flag: every scored value is (re)sent, including unchanged ones.
    // The overall is identical across snapshots, so any token move is suspect.
    window.localStorage.setItem(
      "marksTokensV1",
      JSON.stringify({ "C1::overall::overall": "tok-old" })
    );
    (api as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        tally: { added: 2 },
        tokens: { "C1::overall::overall": "tok-unexpected" },
      }),
    });

    const { syncMarksDiff: sync } = await import("@/lib/marksSync");
    const result = await sync(MARKS2, MARKS2);
    expect(result.mismatches).toContain("C1::overall::overall");
  });

  it("lists held keys the sync did not cover as frozen", async () => {
    window.localStorage.setItem(
      "marksTokensV1",
      JSON.stringify({
        "C1::overall::overall": "tok-overall",
        "C9::assessment::k9": "tok-stale",
      })
    );
    window.localStorage.setItem("marksSyncBackfillV1", "true");
    (api as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ tally: {}, tokens: {} }),
    });

    const { syncMarksDiff: sync, getFrozenKeys } = await import("@/lib/marksSync");
    const result = await sync(MARKS2, MARKS2);
    // C9 was never sent this sync and the store already held it: frozen.
    expect(result.frozen).toContain("C9::assessment::k9");
    // Persisted for the UI badge.
    expect(getFrozenKeys()).toContain("C9::assessment::k9");
  });
});
describe("normalisedPct", () => {
  it("normalises earned points against released weightage", () => {
    // 54 of 60 released = 90%.
    expect(normalisedPct(54, 60)).toBeCloseTo(90, 9);
  });

  it("is 100 when everything released is earned", () => {
    expect(normalisedPct(100, 100)).toBe(100);
  });

  it("is 0 when nothing has been released, not NaN", () => {
    expect(normalisedPct(0, 0)).toBe(0);
  });
});
