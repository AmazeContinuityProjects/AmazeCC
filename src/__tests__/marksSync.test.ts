import { describe, it, expect } from "vitest";
import { assessmentKeyFor, remapCohortStats } from "@/lib/marksSync";
import { normalisedPct } from "@/components/custom/exams/courseHelpers";

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
 * `normalisedPct` is what keeps the grade ladder honest mid-term: the class
 * average is a percentage of the weightage released so far, while the earned
 * total is a raw points figure. Comparing them directly put a genuine 90%
 * into band D.
 */
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
