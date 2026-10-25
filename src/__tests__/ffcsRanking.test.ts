import { describe, expect, it } from "vitest";
import {
  RANKING_MODES,
  asRankingMode,
  combineRankingScores,
  profileFor,
  rankCourses,
  rankingInputs,
  scoreRanking,
  type RankingMode,
} from "../lib/ffcsRanking";
import { generateTimetables, type GenerateParams } from "../components/custom/exams/FFCS/logic/generate";
import type { ParsedCourse, CourseLock } from "../components/custom/exams/FFCS/types";
import chennai from "../data/campus/chennai.json";

/**
 * The weighted ranking profiles, and the promise that they are additive.
 *
 * Two separate things are being pinned here. The first is the arithmetic: that
 * a profile means what it says — "Early Finish" prefers a week that ends early,
 * "Late Start" prefers one that begins late — which is only demonstrable by the
 * two profiles *disagreeing* about the same two weeks.
 *
 * The second, and the one this app actually cares about, is the contract with
 * everything that was already here: a run with no profile must be byte-for-byte
 * the run this planner has always produced, and a run with a profile must be the
 * same set of weeks in a different order. A "new ranking mode" that quietly
 * changed which options exist would not be an addition.
 *
 * ## Fixture slots
 *
 * Every one is a single period of a single day of the Chennai schema, so each
 * fixture week is unambiguous:
 *
 *   TB1 = Mon 10:45–11:35   (starts early, ends early)
 *   TG2 = Mon 17:40–18:30   (starts late,  ends late — five hours later)
 *   A1  = Mon 08:00 + Wed 08:55 (two days, for `activeDays`)
 */

const week = (...slots: string[]) => slots.map((slot) => ({ slots: [slot] }));

const inputs = (...slots: string[]) => rankingInputs(week(...slots), chennai as never);

describe("reading a week's ranking inputs", () => {
  it("counts the days, span and clock of a one-period week", () => {
    const reading = inputs("TB1");
    expect(reading.activeDays).toBe(1);
    expect(reading.compactDays).toBe(1); // 50 minutes is well inside four hours
    expect(reading.averageDayStartMinutes).toBe(10 * 60 + 45);
    expect(reading.averageDayEndMinutes).toBe(11 * 60 + 35);
    expect(reading.dailyLoadVariance).toBe(0);
    expect(reading.totalGapSlots).toBe(0);
  });

  it("counts a course that runs on two days as two active days", () => {
    const reading = inputs("A1");
    expect(reading.activeDays).toBe(2); // Mon 08:00 and Wed 08:55
  });

  it("does not call a day with eight hours of teaching compact", () => {
    // TB1 at 10:45 and TG2 at 17:40 are both Monday, so the day spans 7h45m —
    // more than the four-hour window, and therefore not a half day however
    // few classes it holds.
    const reading = rankingInputs([{ slots: ["TB1"] }, { slots: ["TG2"] }], chennai as never);
    expect(reading.activeDays).toBe(1);
    expect(reading.compactDays).toBe(0);
  });

  it("measures a long dead stretch as empty periods, not as nothing", () => {
    // 11:35 → 17:40 is 365 minutes, which is a lot of nothing.
    const reading = rankingInputs([{ slots: ["TB1"] }, { slots: ["TG2"] }], chennai as never);
    expect(reading.totalGapSlots).toBe(Math.round(365 / 55));
  });
});

describe("scoring", () => {
  it("stays within 0–100 and accounts for every point it claims", () => {
    const reading = rankingInputs(week("TB1"), chennai as never);
    for (const mode of RANKING_MODES) {
      const { score, breakdown } = scoreRanking(reading, mode);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(Object.keys(breakdown).sort()).toEqual([
        "balancedLoad",
        "compactDays",
        "earlyFinish",
        "lateStart",
        "lowGaps",
      ]);
      // The five factors are the whole score; anything they do not sum to is
      // rounding, and rounding past a few tenths would mean a mis-weighted term.
      const sum = Object.values(breakdown).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - score)).toBeLessThanOrEqual(0.6);
    }
  });

  it("agrees with itself about which week ends earlier", () => {
    const earlyEnd = scoreRanking(inputs("TB1"), "Early Finish").score;
    const lateEnd = scoreRanking(inputs("TG2"), "Early Finish").score;
    expect(earlyEnd).toBeGreaterThan(lateEnd);
  });

  it("agrees with itself about which week starts later", () => {
    const lateStart = scoreRanking(inputs("TG2"), "Late Start").score;
    const earlyStart = scoreRanking(inputs("TB1"), "Late Start").score;
    expect(lateStart).toBeGreaterThan(earlyStart);
  });

  it("makes the two profiles disagree about the same two weeks", () => {
    // The whole point of a profile: the same pair of weeks, ranked opposite
    // ways round, because the weights say so.
    const early = inputs("TB1");
    const late = inputs("TG2");

    expect(scoreRanking(early, "Early Finish").score).toBeGreaterThan(
      scoreRanking(late, "Early Finish").score
    );
    expect(scoreRanking(late, "Late Start").score).toBeGreaterThan(
      scoreRanking(early, "Late Start").score
    );
  });

  it("weights what the profile names", () => {
    const reading = inputs("TB1"); // perfectly compact, so the factor value is 1
    const forHalfDays = scoreRanking(reading, "Half Days").breakdown.compactDays;
    const forGaps = scoreRanking(reading, "Minimize Gaps").breakdown.compactDays;

    // Identical input, identical factor — only the weight differs, which is
    // what a profile *is*.
    expect(forHalfDays).toBeGreaterThan(forGaps);
    expect(scoreRanking(reading, "Half Days").breakdown.lowGaps).toBeLessThan(
      scoreRanking(reading, "Minimize Gaps").breakdown.lowGaps
    );
  });

  it("reports zero for a week with nothing in it, without dividing by it", () => {
    const { score, breakdown } = scoreRanking(rankingInputs([], chennai as never), "Balanced");
    expect(Number.isFinite(score)).toBe(true);
    expect(breakdown.compactDays).toBe(0); // no class days, so no share of them
  });
});

describe("naming a profile", () => {
  it("accepts every mode it publishes", () => {
    for (const mode of RANKING_MODES) expect(asRankingMode(mode)).toBe(mode);
  });

  it("refuses anything it does not know rather than guessing", () => {
    expect(asRankingMode("Half-Day Focused")).toBeNull();
    expect(asRankingMode("")).toBeNull();
    expect(asRankingMode(undefined)).toBeNull();
    expect(asRankingMode(42)).toBeNull();
  });

  it("falls back to Balanced for an absent or unknown mode", () => {
    const reading = inputs("TB1");
    expect(scoreRanking(reading, null as unknown as RankingMode)).toEqual(
      scoreRanking(reading, "Balanced")
    );
    expect(profileFor(null)).toEqual(profileFor("Balanced"));
  });
});

describe("combined ranking priorities", () => {
  it("lets the configured priority order dominate the unified score", () => {
    const scores = { profile: 100, faculty: 0, sort: 0, time: 0 };
    const profileFirst = combineRankingScores(scores, ["profile", "faculty", "sort", "time"]);
    const facultyFirst = combineRankingScores(scores, ["faculty", "profile", "sort", "time"]);

    expect(profileFirst.score).toBeGreaterThan(facultyFirst.score);
    expect(
      Object.values(profileFirst.breakdown).reduce((sum, value) => sum + value, 0)
    ).toBeCloseTo(profileFirst.score, 1);
  });
});

/* ── the contract with the planner ─────────────────────────────────────── */

const row = (
  over: Partial<ParsedCourse> & Pick<ParsedCourse, "CODE" | "SLOT">
): ParsedCourse => ({
  CODE: over.CODE,
  TITLE: over.TITLE ?? "Course",
  TYPE: over.TYPE ?? "TH",
  CREDITS: over.CREDITS ?? "3",
  ROOM: over.ROOM ?? "AB1-101",
  SLOT: over.SLOT,
  FACULTY: over.FACULTY ?? "Dr Someone",
  ...over,
});

const lock = (code: string): CourseLock => ({
  code,
  title: "Course",
  allowedSlots: [],
  allowedFaculty: [],
});

const params = (over: Partial<GenerateParams> = {}): GenerateParams => ({
  schema: chennai as never,
  masterCourses: [
    row({ CODE: "BCSE101", SLOT: "TB1" }),
    row({ CODE: "BCSE101", SLOT: "TG2", ROOM: "AB2-202" }),
  ],
  courseLocks: [lock("BCSE101")],
  blockedSlots: [],
  friends: [],
  preference: "none",
  syncFriendClasses: false,
  maximizeFreeTimeFriends: [],
  minStartTime: null,
  maxEndTime: null,
  uniqueFaculties: false,
  noLimit: false,
  minHalfDays: 0,
  sortBy: "balanced",
  ...over,
});

const layouts = (r: ReturnType<typeof generateTimetables>): string[] =>
  r.kind === "ok" ? r.timetables.map((t) => t.courses.flatMap((c) => c.slots).join("|")).sort() : [];

describe("ranking profiles inside the generator", () => {
  it("scores nothing when no profile was asked for", () => {
    const r = generateTimetables(params());
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    for (const timetable of r.timetables) {
      expect(timetable.rankingScore).toBeUndefined();
      expect(timetable.rankingBreakdown).toBeUndefined();
    }
  });

  it("scores every option once a profile was asked for", () => {
    const r = generateTimetables(params({ rankingMode: "Late Start" }));
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;
    for (const timetable of r.timetables) {
      expect(timetable.rankingScore).toBeGreaterThanOrEqual(0);
      expect(timetable.rankingScore).toBeLessThanOrEqual(100);
      expect(Object.keys(timetable.rankingBreakdown ?? {})).toEqual(["profile", "sort"]);
    }
  });

  it("offers exactly the same options as it did before the profiles existed", () => {
    // The contract that makes this an addition rather than a change: turning a
    // profile on may reorder the shelf, it may not add or remove books.
    expect(layouts(generateTimetables(params({ rankingMode: "Late Start" })))).toEqual(
      layouts(generateTimetables(params()))
    );
    expect(layouts(generateTimetables(params({ rankingMode: "Balanced" })))).toEqual(
      layouts(generateTimetables(params()))
    );
  });

  it("reorders the shelf when a profile is chosen", () => {
    const plain = generateTimetables(params());
    const ranked = generateTimetables(params({ rankingMode: "Late Start" }));

    expect(plain.kind).toBe("ok");
    expect(ranked.kind).toBe("ok");
    if (plain.kind !== "ok" || ranked.kind !== "ok") return;

    // Late Start wants the day to begin late, so the 17:40 offering wins —
    // where the unranked run put the 10:45 one first.
    const slotsOf = (index: number) => ranked.timetables[index].courses.flatMap((c) => c.slots);
    expect(slotsOf(0)).toEqual(["TG2"]);
    expect(slotsOf(1)).toEqual(["TB1"]);
    expect(ranked.timetables[0].rankingScore!).toBeGreaterThanOrEqual(
      ranked.timetables[1].rankingScore!
    );
    expect(plain.timetables[0].courses.flatMap((c) => c.slots)).toEqual(["TB1"]);
  });

  it("scores a week the same way whether it is asked through the generator or directly", () => {
    const r = generateTimetables(params({ rankingMode: "Balanced" }));
    expect(r.kind).toBe("ok");
    if (r.kind !== "ok") return;

    for (const timetable of r.timetables) {
      expect(timetable.rankingComponents?.profile).toBe(
        rankCourses(timetable.courses, chennai as never, "Balanced").score
      );
    }
  });

  it("adds Best Faculty as an available profile", () => {
    expect(RANKING_MODES).toContain("Best Faculty");
    expect(asRankingMode("Best Faculty")).toBe("Best Faculty");
  });

  it("ranks equal-slot faculty variants by their review quality", () => {
    const rows = [
      row({ CODE: "BCSE101", SLOT: "TB1", FACULTY: "Dr Low", ERP_ID: "1001" }),
      row({ CODE: "BCSE101", SLOT: "TB1", FACULTY: "Dr High", ERP_ID: "1002" }),
    ];
    const result = generateTimetables(
      params({
        masterCourses: rows,
        rankingMode: "Best Faculty",
        facultyRatingsAvailable: true,
        facultyRatings: {
          "id:1001": { wPct: 35, lecture: 2, da: 2, vibe: 2, reviews: 12 },
          "id:1002": { wPct: 90, lecture: 4.5, da: 4, vibe: 4, reviews: 20 },
        },
      })
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const variants = result.timetables[0].variants ?? [];
    expect(variants[0].courses[0].employeeId).toBe("1002");
    expect(variants[0].facultySummary?.averageWPct).toBe(90);
  });

  it("filters low-rated offers by minimum faculty scores", () => {
    const rows = [
      row({ CODE: "BCSE101", SLOT: "TB1", FACULTY: "Dr Low", ERP_ID: "1001" }),
      row({ CODE: "BCSE101", SLOT: "TG2", FACULTY: "Dr High", ERP_ID: "1002" }),
    ];
    const result = generateTimetables(
      params({
        masterCourses: rows,
        facultyRatingsAvailable: true,
        facultyRatings: {
          "id:1001": { wPct: 35, lecture: 2, da: 2, vibe: 2, reviews: 12 },
          "id:1002": { wPct: 90, lecture: 4.5, da: 4, vibe: 4, reviews: 20 },
        },
        facultyScoreFilters: { minWPct: 70, minLecture: 0, minDa: 0, minVibe: 0 },
      })
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.timetables).toHaveLength(1);
    expect(result.timetables[0].courses[0].employeeId).toBe("1002");
  });

  it("keeps generation running when faculty data is unavailable", () => {
    const result = generateTimetables(
      params({
        facultyRatingsAvailable: false,
        facultyRatings: {},
        facultyScoreFilters: { minWPct: 95, minLecture: 5, minDa: 5, minVibe: 5 },
      })
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.timetables.length).toBeGreaterThan(0);
    expect(result.timetables[0].facultySummary).toBeUndefined();
  });
});
