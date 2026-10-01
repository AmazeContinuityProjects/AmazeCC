import { describe, expect, it } from "vitest";
import {
  CAT_LOCK_OFFSET_DAYS,
  buildEffectiveDayMap,
  courseCeiling,
  courseLockDate,
  courseMeetingDays,
  courseMeetingDates,
  courseMeetsOn,
  dayKey,
  effectiveWeekday,
  formatPct,
  gridCeiling,
  isLabCourse,
  isProjectableCourse,
  lockDateFor,
  projectCourse,
  skipCountFor,
  skipSetFor,
  startOfDay,
  summarise,
  toggleCourseSkip,
  type CourseDateSkips,
  type DayLike,
} from "../lib/attendancePredictor";

/**
 * Attendance projection.
 *
 * The lock dates are regressions: the screen used to freeze attendance on the
 * Thursday and Friday two and one days before a CAT *and only if those days were
 * a Thursday or Friday*, so a CAT starting on a Saturday produced an empty set
 * and nothing locked at all. The real 2026 calendar has CAT I starting on a
 * Saturday, so that bug was live.
 */

/**
 * The milestone dates the live `/api/calendar` payload resolves to for
 * CH20262701, verbatim. CAT I and CAT II each span a week; these are the first
 * days, which is what `importantEvents` keeps.
 */
const DATES_2026 = {
  cat1Date: new Date(2026, 7, 8), // Sat 8 Aug 2026
  cat2Date: new Date(2026, 8, 25), // Fri 25 Sep 2026
  lidLabDate: new Date(2026, 9, 23), // Fri 23 Oct 2026
  lidTheoryDate: new Date(2026, 10, 3), // Tue 3 Nov 2026
};

const ymd = (y: number, m: number, d: number) => new Date(y, m, d);

/** A working day on the given date, with the real weekday spelled out. */
const day = (date: Date, events: DayLike["events"] = []): DayLike => ({
  date,
  weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()],
  events,
});

const theoryCourse = {
  courseCode: "BACSE105",
  courseTitle: "Data Structures and Algorithms",
  courseType: "Embedded Theory",
  slotName: "F1+TF1",
  attendedClasses: 20,
  totalClasses: 25,
};

const labCourse = {
  courseCode: "BACSE102",
  courseTitle: "Problem Solving Using Java",
  courseType: "Lab Only",
  slotName: "L1+L2",
  attendedClasses: 12,
  totalClasses: 15,
};

const dayCardsMap = {
  MON: [{ courseCode: "BACSE105" }],
  WED: [{ courseCode: "BACSE105" }],
  FRI: [{ courseCode: "BACSE105" }],
  FRI_LAB: [],
  TUE: [{ courseCode: "BACSE102" }],
  THU: [{ courseCode: "BACSE102" }],
};

describe("startOfDay / dayKey", () => {
  it("strips the time so a date and its timestamp agree", () => {
    const d = new Date(2026, 7, 8, 17, 45, 12);
    expect(startOfDay(d).getHours()).toBe(0);
    expect(startOfDay(d).getTime()).toBe(startOfDay(d).getTime());
  });

  it("builds a stable key", () => {
    expect(dayKey(ymd(2026, 7, 8))).toBe("2026-8-8");
    expect(dayKey(ymd(2026, 7, 8))).toBe(dayKey(new Date(2026, 7, 8, 23, 59)));
  });
});

describe("lockDateFor", () => {
  it("subtracts whole calendar days", () => {
    expect(lockDateFor(ymd(2026, 7, 8), 3)).toEqual(ymd(2026, 7, 5));
    expect(lockDateFor(ymd(2026, 8, 25), 3)).toEqual(ymd(2026, 8, 22));
  });

  it("crosses a month boundary", () => {
    // 1 Oct minus three days lands in September.
    expect(lockDateFor(ymd(2026, 9, 1), 3)).toEqual(ymd(2026, 8, 28));
  });

  it("crosses a year boundary", () => {
    // 2 Jan 2026 minus three days lands in December 2025.
    expect(lockDateFor(ymd(2026, 0, 2), 3)).toEqual(ymd(2025, 11, 30));
  });

  it("is null without a milestone", () => {
    expect(lockDateFor(null)).toBeNull();
    expect(lockDateFor(undefined)).toBeNull();
    expect(lockDateFor(new Date("nonsense"))).toBeNull();
  });

  it("is idempotent for zero offset", () => {
    expect(lockDateFor(ymd(2026, 9, 23), 0)).toEqual(ymd(2026, 9, 23));
  });
});

describe("courseCeiling", () => {
  it("locks CAT I three days before the exam, for lab and theory alike", () => {
    expect(courseCeiling("CAT1", false, DATES_2026)).toEqual(ymd(2026, 7, 5));
    expect(courseCeiling("CAT1", true, DATES_2026)).toEqual(ymd(2026, 7, 5));
  });

  it("locks CAT II three days before the exam", () => {
    expect(courseCeiling("CAT2", false, DATES_2026)).toEqual(ymd(2026, 8, 22));
  });

  it("locks a Saturday CAT, which the old Thursday/Friday rule silently skipped", () => {
    // CAT I is a Saturday, so the old rule found no Thursday or Friday at -1/-2
    // and locked nothing at all.
    expect(DATES_2026.cat1Date!.getDay()).toBe(6);
    expect(courseCeiling("CAT1", false, DATES_2026)).not.toBeNull();
  });

  it("splits LID by course type, which is the whole point of having two dates", () => {
    expect(courseCeiling("LID", true, DATES_2026)).toEqual(DATES_2026.lidLabDate);
    expect(courseCeiling("LID", false, DATES_2026)).toEqual(DATES_2026.lidTheoryDate);
  });

  it("does not let lab keep counting past its own LID in All Days", () => {
    // Lab instruction ended 23 Oct; theory ran to 3 Nov. Using the later of the
    // two - as the screen did - let lab accrue for a fortnight after it stopped.
    expect(courseCeiling("ALL", true, DATES_2026)).toEqual(DATES_2026.lidLabDate);
    expect(courseCeiling("ALL", false, DATES_2026)).toEqual(DATES_2026.lidTheoryDate);
  });

  it("survives a missing milestone rather than inventing a date", () => {
    expect(courseCeiling("CAT1", false, {})).toBeNull();
    expect(courseCeiling("LID", false, {})).toBeNull();
  });

  it("uses the same day for the lock as for the ceiling", () => {
    for (const mode of ["CAT1", "CAT2", "LID", "ALL"] as const) {
      for (const isLab of [true, false]) {
        expect(courseLockDate(mode, isLab, DATES_2026)).toEqual(
          courseCeiling(mode, isLab, DATES_2026)
        );
      }
    }
  });
});

describe("gridCeiling", () => {
  it("uses the CAT lock for the CAT modes", () => {
    expect(gridCeiling("CAT1", DATES_2026)).toEqual(ymd(2026, 7, 5));
    expect(gridCeiling("CAT2", DATES_2026)).toEqual(ymd(2026, 8, 22));
  });

  it("takes the later of the two LIDs so every course's window is reachable", () => {
    expect(gridCeiling("LID", DATES_2026)).toEqual(DATES_2026.lidTheoryDate);
    expect(gridCeiling("ALL", DATES_2026)).toEqual(DATES_2026.lidTheoryDate);
  });

  it("is null when there are no milestones at all", () => {
    expect(gridCeiling("LID", {})).toBeNull();
    expect(gridCeiling("ALL", {})).toBeNull();
  });
});

describe("effectiveWeekday", () => {
  it("is the date's own weekday normally", () => {
    expect(effectiveWeekday("Wed", [])).toBe("WED");
    expect(effectiveWeekday("MON", undefined)).toBe("MON");
  });

  it("follows a published day order on a Saturday", () => {
    // The real payload: 22 Aug 2026 carries
    // "(Instructional Day - Thursday Day Order)".
    expect(
      effectiveWeekday("Sat", [{ text: "(Instructional Day - Thursday Day Order)" }])
    ).toBe("THU");
  });

  it("reads the day order out of category when text does not carry it", () => {
    expect(
      effectiveWeekday("SAT", [
        { text: "Instructional Day", category: "Instructional Day - Friday Day Order" },
      ])
    ).toBe("FRI");
  });

  it("reads the enriched calendarDay shape", () => {
    expect(
      effectiveWeekday("Sat", [{ title: "(Instructional Day Order - Wednesday Day Order)" }])
    ).toBe("WED");
    expect(
      effectiveWeekday("Sat", [{ title: "Instructional Day", detail: "Working Day / Monday Day Order" }])
    ).toBe("MON");
  });

  it("prefers the longest day named, so 'Day Order - Friday' is not read as Thursday", () => {
    const ev = [{ text: "(Instructional Day - Thursday Day Order)" }];
    expect(effectiveWeekday("SAT", ev)).toBe("THU");
  });

  it("leaves a plain Saturday alone", () => {
    expect(effectiveWeekday("Sat", [{ text: "Instructional Day" }])).toBe("SAT");
    expect(effectiveWeekday("Sat", [])).toBe("SAT");
  });

  it("ignores a day order that names the weekend", () => {
    expect(effectiveWeekday("SAT", [{ text: "Holiday" }])).toBe("SAT");
  });
});

describe("buildEffectiveDayMap", () => {
  it("keys by day and applies day orders", () => {
    const days = [
      day(ymd(2026, 7, 26)), // Wednesday
      day(ymd(2026, 7, 22), [{ text: "(Instructional Day - Thursday Day Order)" }]), // Saturday
    ];
    const map = buildEffectiveDayMap(days);
    expect(map.get(dayKey(ymd(2026, 7, 26)))).toBe("WED");
    expect(map.get(dayKey(ymd(2026, 7, 22)))).toBe("THU");
  });

  it("ignores rubbish entries rather than throwing", () => {
    const map = buildEffectiveDayMap([
      day(ymd(2026, 7, 26)),
      { date: new Date("nonsense") },
      null as any,
      { weekday: "MON" },
    ]);
    expect(map.size).toBe(1);
  });

  it("is empty for no days", () => {
    expect(buildEffectiveDayMap([]).size).toBe(0);
    expect(buildEffectiveDayMap(null).size).toBe(0);
  });
});

describe("course classification", () => {
  it("spots a lab from the course type or the code suffix", () => {
    expect(isLabCourse({ courseCode: "BACSE102", courseType: "Lab Only" })).toBe(true);
    expect(isLabCourse({ courseCode: "BACSE102(L)", courseType: "" })).toBe(true);
    expect(isLabCourse({ courseCode: "BACSE105", courseType: "Embedded Theory" })).toBe(false);
  });

  it("skips courses with no slot or no code", () => {
    expect(isProjectableCourse({ courseCode: "BACSE105", slotName: "F1" })).toBe(true);
    expect(isProjectableCourse({ courseCode: "", slotName: "F1" })).toBe(false);
    expect(isProjectableCourse({ courseCode: "BACSE105", slotName: "NILL" })).toBe(false);
  });
});

describe("courseMeetingDays / courseMeetsOn", () => {
  it("reads the weekdays a course is timetabled on", () => {
    expect(courseMeetingDays("BACSE105", dayCardsMap).sort()).toEqual(["FRI", "MON", "WED"]);
    expect(courseMeetingDays("BACSE102", dayCardsMap).sort()).toEqual(["THU", "TUE"]);
  });

  it("is empty for an unknown course", () => {
    expect(courseMeetingDays("NOPE", dayCardsMap)).toEqual([]);
    expect(courseMeetingDays("BACSE105", null)).toEqual([]);
  });

  it("answers a single date through the effective map", () => {
    const map = buildEffectiveDayMap([
      day(ymd(2026, 7, 26)), // Wednesday
      day(ymd(2026, 7, 22), [{ text: "(Instructional Day - Thursday Day Order)" }]),
    ]);
    expect(courseMeetsOn(ymd(2026, 7, 26), "BACSE105", dayCardsMap, map)).toBe(true);
    expect(courseMeetsOn(ymd(2026, 7, 22), "BACSE105", dayCardsMap, map)).toBe(false);
    expect(courseMeetsOn(ymd(2026, 7, 27), "BACSE105", dayCardsMap, map)).toBe(false);
  });
});

describe("skip state", () => {
  it("toggles a date on and off without mutating", () => {
    const t = ymd(2026, 7, 26).getTime();
    let skips: CourseDateSkips = {};
    skips = toggleCourseSkip(skips, "BACSE105", t);
    expect(skipCountFor(skips, "BACSE105")).toBe(1);
    skips = toggleCourseSkip(skips, "BACSE105", t);
    expect(skipCountFor(skips, "BACSE105")).toBe(0);
  });

  it("keeps subjects independent", () => {
    const t = ymd(2026, 7, 26).getTime();
    let skips: CourseDateSkips = toggleCourseSkip({}, "BACSE105", t);
    expect(skipCountFor(skips, "BACSE102")).toBe(0);
    skips = toggleCourseSkip(skips, "BACSE102", t);
    expect(skipCountFor(skips, "BACSE105")).toBe(1);
    expect(skipCountFor(skips, "BACSE102")).toBe(1);
  });

  it("reads a stored map back as a set", () => {
    const t = ymd(2026, 7, 26).getTime();
    const skips = toggleCourseSkip({}, "BACSE105", t);
    expect(skipSetFor(skips, "BACSE105").has(t)).toBe(true);
    expect(skipSetFor(null, "BACSE105").size).toBe(0);
  });
});

/**
 * Six future days for a MON/WED/FRI course, all between the two CAT locks.
 *
 * Weekdays verified against the real 2026 calendar rather than assumed - Aug 2026
 * opens on a Saturday, so Aug 29 is a Saturday and Aug 19 a Wednesday, which is
 * exactly the sort of thing that makes a fixture quietly test the wrong thing.
 * All six are distinct dates, as a real calendar would be.
 */
const futureDays = [
  day(ymd(2026, 7, 24)), // Mon
  day(ymd(2026, 7, 26)), // Wed
  day(ymd(2026, 7, 28)), // Fri
  day(ymd(2026, 7, 31)), // Mon
  day(ymd(2026, 8, 2)), // Wed
  day(ymd(2026, 8, 4)), // Fri
];

/** Three future days for the TUE/THU lab. */
const labDays = [
  day(ymd(2026, 7, 25)), // Tue
  day(ymd(2026, 7, 27)), // Thu
  day(ymd(2026, 8, 1)), // Tue
];

const projectTheory = (over: Partial<Parameters<typeof projectCourse>[0]> = {}) =>
  projectCourse({
    course: theoryCourse,
    dayCardsMap,
    workingDays: futureDays,
    effectiveMap: buildEffectiveDayMap(futureDays),
    dateStates: {},
    skips: new Set(),
    ceiling: null,
    lockDate: null,
    threshold: 75,
    ...over,
  });

describe("projectCourse", () => {
  it("counts only the days the course actually meets", () => {
    const r = projectTheory();
    expect(r.meetingDays.sort()).toEqual(["FRI", "MON", "WED"]);
    expect(r.futureDays).toBe(6);
  });

  it("treats a skipped date as an absence for that subject only", () => {
    const skip = ymd(2026, 7, 26).getTime();
    const skipped = projectTheory({ skips: new Set([skip]) });
    const clean = projectTheory();

    expect(skipped.missedDays).toBe(1);
    // Still a scheduled class, so it stays in the denominator.
    expect(skipped.futureDays).toBe(clean.futureDays);
    expect(skipped.predictedTotal).toBe(clean.predictedTotal);
    expect(skipped.predictedAttended).toBe(clean.predictedAttended - 1);
    expect(skipped.predictedPct).toBeLessThan(clean.predictedPct);
  });

  it("does not let another subject's skip touch this one", () => {
    const other = projectTheory({
      skips: new Set([ymd(2026, 7, 26).getTime()]),
      dateStates: {},
    });
    expect(other.missedDays).toBe(1);

    const untouched = projectTheory({
      skips: new Set(),
      dateStates: {},
    });
    expect(untouched.missedDays).toBe(0);
  });

  it("still honours a global 'Absent' day", () => {
    const r = projectTheory({ dateStates: { [ymd(2026, 7, 26).getTime()]: 1 } });
    expect(r.missedDays).toBe(1);
  });

  it("ignores a global 'Off' day rather than counting it as a miss", () => {
    const r = projectTheory({ dateStates: { [ymd(2026, 7, 26).getTime()]: 2 } });
    expect(r.missedDays).toBe(0);
  });

  it("counts a skipped and a globally-absent day separately", () => {
    const r = projectTheory({
      skips: new Set([ymd(2026, 7, 26).getTime()]),
      dateStates: { [ymd(2026, 7, 28).getTime()]: 1 },
    });
    expect(r.missedDays).toBe(2);
  });

  it("stops counting at the ceiling", () => {
    const r = projectTheory({ ceiling: ymd(2026, 7, 25) });
    // Only Mon 24 Aug survives the 25th.
    expect(r.futureDays).toBe(1);
  });

  it("drops the lock day itself, because a lock is a suffix", () => {
    const all = projectTheory();
    const locked = projectTheory({ lockDate: ymd(2026, 8, 2) });
    // 2 and 4 Sep are on or after the lock, so both go.
    expect(locked.futureDays).toBe(all.futureDays - 2);
    expect(locked.futureDays).toBe(4);
  });

  it("keeps the day before the lock", () => {
    const locked = projectTheory({ lockDate: ymd(2026, 8, 2) });
    expect(locked.futureDays).toBe(4);
    // Mon 24 Aug, Wed 26 Aug, Fri 28 Aug, Mon 31 Aug.
    expect(locked.futureDays).toBeGreaterThan(0);
  });

  it("ignores a skip that lands on or after the lock", () => {
    const r = projectTheory({
      lockDate: ymd(2026, 8, 2),
      skips: new Set([ymd(2026, 8, 4).getTime()]),
    });
    // The 4th is frozen out before the skip is ever considered.
    expect(r.missedDays).toBe(0);
  });

  it("never counts more misses than it has future classes", () => {
    const r = projectTheory({
      skips: new Set(futureDays.map((d) => d.date!.getTime())),
    });
    expect(r.missedDays).toBeLessThanOrEqual(r.futureDays);
    expect(r.predictedAttended).toBe(r.attended);
  });

  it("weights a lab session as two hours on both sides", () => {
    const map = buildEffectiveDayMap(labDays);
    const r = projectCourse({
      course: labCourse,
      dayCardsMap,
      workingDays: labDays,
      effectiveMap: map,
      dateStates: {},
      skips: new Set(),
      ceiling: null,
      lockDate: null,
      threshold: 75,
    });
    expect(r.futureDays).toBe(3);
    expect(r.predictedTotal - labCourse.totalClasses).toBe(6); // 3 sessions x 2 hrs
  });

  it("counts one skipped lab session as two missed hours", () => {
    const map = buildEffectiveDayMap(labDays);
    const r = projectCourse({
      course: labCourse,
      dayCardsMap,
      workingDays: labDays,
      effectiveMap: map,
      dateStates: {},
      skips: new Set([ymd(2026, 7, 25).getTime()]),
      ceiling: null,
      lockDate: null,
      threshold: 75,
    });
    expect(r.missedDays).toBe(1);
    // Six future hours added, two of them missed, so four net.
    expect(r.predictedTotal - labCourse.totalClasses).toBe(6);
    expect(r.predictedAttended - labCourse.attendedClasses).toBe(4);
  });

  it("reports how many dates are skipped", () => {
    const r = projectTheory({
      skips: new Set([ymd(2026, 7, 26).getTime(), ymd(2026, 7, 29).getTime()]),
    });
    expect(r.skippedCount).toBe(2);
  });

  it("keeps the current percentage as the untouched baseline", () => {
    const r = projectTheory();
    expect(r.currentPct).toBeCloseTo(80, 5);
    expect(r.deltaPct).toBeCloseTo(r.predictedPct - r.currentPct, 5);
  });

  it("is inert for a course with no timetable entry", () => {
    const r = projectTheory({ dayCardsMap: {} });
    expect(r.futureDays).toBe(0);
    expect(r.predictedPct).toBeCloseTo(80, 5);
    expect(r.missedDays).toBe(0);
  });

  it("survives missing inputs", () => {
    const r = projectTheory({ workingDays: [], effectiveMap: new Map() });
    expect(r.futureDays).toBe(0);
    const s = projectTheory({ dateStates: null, skips: new Set() });
    expect(s.missedDays).toBe(0);
  });
});

describe("courseMeetingDates", () => {
  const map = buildEffectiveDayMap(futureDays);

  it("lists exactly the dates the course still has, oldest first", () => {
    const dates = courseMeetingDates("BACSE105", dayCardsMap, futureDays, map);
    expect(dates.map((d) => d.getDate())).toEqual([24, 26, 28, 31, 2, 4]);
    // Sorted, so "the next date" is the first one.
    const times = dates.map((d) => d.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("agrees with the count projectCourse reports", () => {
    const dates = courseMeetingDates("BACSE105", dayCardsMap, futureDays, map);
    const r = projectTheory();
    expect(dates.length).toBe(r.futureDays);
  });

  it("omits days the subject does not meet", () => {
    const dates = courseMeetingDates("BACSE105", dayCardsMap, futureDays, map);
    expect(dates.some((d) => d.getDay() === 0 || d.getDay() === 6)).toBe(false);
  });

  it("omits a locked date, so the skipper never offers an impossible skip", () => {
    const dates = courseMeetingDates(
      "BACSE105",
      dayCardsMap,
      futureDays,
      map,
      null,
      ymd(2026, 8, 2)
    );
    expect(dates.map((d) => d.getDate())).toEqual([24, 26, 28, 31]);
  });

  it("respects the ceiling too", () => {
    const dates = courseMeetingDates("BACSE105", dayCardsMap, futureDays, map, ymd(2026, 7, 26));
    expect(dates.map((d) => d.getDate())).toEqual([24, 26]);
  });

  it("honours a published day order", () => {
    // 29 Aug 2026 is a Saturday that follows the Thursday day order, so the
    // TUE/THU lab meets it while it does not meet a normal Saturday.
    const plainSaturday = day(ymd(2026, 7, 29));
    const thursdayOrder = day(ymd(2026, 7, 29), [
      { text: "(Instructional Day - Thursday Day Order)" },
    ]);
    const ordered = buildEffectiveDayMap([thursdayOrder]);

    expect(courseMeetingDates("BACSE102", dayCardsMap, [thursdayOrder], ordered).length).toBe(1);
    expect(courseMeetingDates("BACSE102", dayCardsMap, [plainSaturday], map).length).toBe(0);
  });

  it("is empty for a course with no timetable entry or no calendar", () => {
    expect(courseMeetingDates("NOPE", dayCardsMap, futureDays, map)).toEqual([]);
    expect(courseMeetingDates("BACSE105", dayCardsMap, [], map)).toEqual([]);
    expect(courseMeetingDates("BACSE105", dayCardsMap, null, map)).toEqual([]);
  });
});

describe("summarise", () => {
  const a = projectTheory();
  const b = projectTheory({ course: labCourse, skips: new Set() });

  it("adds up the whole cohort", () => {
    const s = summarise([a, b], 75);
    expect(s.totalCourses).toBe(2);
    expect(s.atRiskCount + s.safeCount).toBe(2);
    expect(s.predictedPct).toBeCloseTo(
      ((a.predictedAttended + b.predictedAttended) /
        (a.predictedTotal + b.predictedTotal)) *
        100,
      5
    );
  });

  it("counts safe courses against the threshold", () => {
    expect(summarise([a, b], 10).safeCount).toBe(2);
    expect(summarise([a, b], 99).safeCount).toBe(0);
  });

  it("is zeroed rather than NaN with no courses", () => {
    const s = summarise([], 75);
    expect(s.currentPct).toBe(0);
    expect(s.predictedPct).toBe(0);
    expect(s.totalCourses).toBe(0);
  });
});

describe("formatPct", () => {
  it("gives two decimals by default, as the screen promises", () => {
    expect(formatPct(87.4567)).toBe("87.46");
    expect(formatPct(87.4567, true)).toBe("87.46");
  });

  it("drops to one when the app-wide setting says so", () => {
    expect(formatPct(87.4567, false)).toBe("87.5");
  });
});

describe("the CAT lock offset is the number the college states", () => {
  it("is three days", () => {
    expect(CAT_LOCK_OFFSET_DAYS).toBe(3);
  });
});