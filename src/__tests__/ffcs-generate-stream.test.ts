import { beforeAll, describe, expect, it } from "vitest";
import {
  generateTimetables,
  generateTimetablesStream,
  HARD_RESULT_LIMIT,
  type GenerateParams,
  type GenerateProgress,
  type GenerateResult,
} from "../components/custom/exams/FFCS/logic/generate";
import type { ParsedCourse, CourseLock, TimetableState } from "../components/custom/exams/FFCS/types";
import { periodsForSlot, type SlotPeriod } from "../lib/slots";
import chennai from "../data/campus/chennai.json";

/**
 * The streaming solver, pinned against the solver that already was.
 *
 * `generateTimetables` used to own the search; it is now
 * `generateTimetablesStream` with no hooks. That refactor is only worth
 * anything if the two cannot drift, and "cannot drift" has to be an assertion
 * rather than a property of how carefully they are edited — so the bulk of this
 * file is the one-shot answer and the watched answer being compared.
 *
 * ## The fixture
 *
 * Seven courses that can each be timetabled seven ways, none of which clash
 * with each other — so the search space is exactly 7! = 5040 complete weeks.
 * That is large enough to cross the solver's tick interval, which is the only
 * way cancellation and progress become reachable at all, and it is also small
 * enough to assert on precisely.
 *
 * The seven periods are *derived*, not chosen: `nonClashingSlots` asks the same
 * `periodsForSlot` the solver asks, and keeps whatever survives a pairwise
 * overlap test. Writing a slot id into this file by hand is how this fixture
 * came to be wrong once already — a slot that looks free on Monday and quietly
 * also runs on Wednesday. Asking the solver's own lookup cannot go out of
 * step with the solver.
 *
 * Every one of the 5040 weeks happens to occupy the same seven periods, so
 * they collapse into a single layout carrying all 5040 as faculty variants.
 * That quirk is used deliberately in the last test below.
 */

/**
 * All slot ids the Chennai schema actually declares, in a stable order.
 */
const declaredSlotIds = (): string[] => {
  const ids = new Set<string>();
  for (const period of [...(chennai.theory ?? []), ...(chennai.lab ?? [])]) {
    for (const slot of Object.values(period?.days ?? {})) {
      if (slot) ids.add(String(slot));
    }
  }
  return [...ids].sort();
};

/** Do these two bookings collide anywhere? Mirrors the solver's own test. */
const collide = (a: SlotPeriod[], b: SlotPeriod[]): boolean =>
  a.some((x) =>
    b.some((y) => x.day === y.day && Math.max(x.startMin, y.startMin) < Math.min(x.endMin, y.endMin))
  );

/**
 * As many periods as can be had that never clash with one another.
 *
 * Greedy over a sorted list, so the set is the same on every run — a fixture
 * that reshuffled would turn a red test into a mystery.
 */
const nonClashingSlots = (count: number): string[] => {
  const chosen: string[] = [];
  const windows: SlotPeriod[][] = [];
  for (const id of declaredSlotIds()) {
    const periods = periodsForSlot(chennai as never, id);
    if (!periods.length) continue;
    if (windows.some((taken) => collide(taken, periods))) continue;
    chosen.push(id);
    windows.push(periods);
    if (chosen.length === count) break;
  }
  return chosen;
};

const FREE_SLOTS = nonClashingSlots(7);

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

const lock = (over: Partial<CourseLock> & Pick<CourseLock, "code">): CourseLock => ({
  code: over.code,
  title: over.title ?? "Course",
  allowedSlots: over.allowedSlots ?? [],
  allowedFaculty: over.allowedFaculty ?? [],
  offerings: over.offerings,
});

const params = (over: Partial<GenerateParams> = {}): GenerateParams => ({
  schema: chennai as never,
  masterCourses: [],
  courseLocks: [],
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

/** Seven courses, each offering all seven of the non-clashing periods. */
const sevenBySeven = (): Partial<GenerateParams> => {
  expect(FREE_SLOTS).toHaveLength(7);

  const masterCourses: ParsedCourse[] = [];
  const courseLocks: CourseLock[] = [];
  FREE_SLOTS.forEach((_, courseIndex) => {
    const code = `BCSE2${courseIndex}0`;
    courseLocks.push(lock({ code }));
    FREE_SLOTS.forEach((slot, slotIndex) =>
      masterCourses.push(row({ CODE: code, SLOT: slot, ROOM: `AB1-${100 + slotIndex}` }))
    );
  });
  return { masterCourses, courseLocks };
};

/** The slot layout of every option, sorted — the stable identity. */
const layouts = (result: GenerateResult): string[] => {
  if (result.kind !== "ok") return [];
  return result.timetables
    .map((t) =>
      t.courses
        .flatMap((c) => c.slots)
        .slice()
        .sort()
        .join("|")
    )
    .sort();
};

describe("watching a search", () => {
  // One long run, observed three different ways. Re-running it per assertion
  // would triple the cost of the most expensive fixture in the suite for no
  // extra information — the run is deterministic, so what it produced once is
  // what it always produces.
  let batches: TimetableState[][] = [];
  let progress: GenerateProgress[] = [];
  let result: GenerateResult;

  // Both halves of the drift check are run here rather than in the test below:
  // this fixture deliberately walks 5040 combinations twice, which is cheap
  // enough to be boring in a hook and expensive enough to trip a 5s assertion
  // budget under full-suite load. The assertions then only read, so a failure
  // below always means the two solvers disagreed, never that the machine was
  // busy.
  let oneShot: GenerateResult;

  beforeAll(() => {
    batches = [];
    progress = [];
    result = generateTimetablesStream(
      params({ ...sevenBySeven(), noLimit: true }),
      {
        batchSize: 100,
        onBatch: (batch) => batches.push(batch),
        onProgress: (p) => progress.push(p),
      }
    );
    // Unlimited on both sides: the point is that watching does not change the
    // answer, and comparing a capped run against an uncapped one would only be
    // comparing the two caps.
    oneShot = generateTimetables(params({ ...sevenBySeven(), noLimit: true }));
  }, 60_000);

  it("still arrives at the same answer as the one-shot solver", () => {
    expect(layouts(result)).toEqual(layouts(oneShot));
    expect(result.kind).toBe("ok");
    if (result.kind === "ok" && oneShot.kind === "ok") {
      expect(result.timetables).toHaveLength(oneShot.timetables.length);
      expect(result.capped).toBe(oneShot.capped);
    }
  });

  it("emits batches no larger than the batch size", () => {
    expect(batches.length).toBeGreaterThan(1);
    for (const batch of batches) expect(batch.length).toBeLessThanOrEqual(100);
  });

  it("emits every accepted timetable exactly once, and every one conflict-free", () => {
    const streamed = batches.flat();
    // 7! injections: every assignment of seven courses to seven periods that
    // puts no two courses on the same one.
    expect(streamed).toHaveLength(5040);

    const ids = streamed.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);

    // The invariant the batches exist to carry: a combination that slipped
    // through the walk with two courses on one period would be the one bug
    // this whole solver is for, and it would be invisible in the grouped
    // result because grouping reads slot multisets, not collisions.
    for (const timetable of streamed) {
      expect(timetable.courses).toHaveLength(7);
      const slots = timetable.courses.flatMap((c) => c.slots);
      expect(new Set(slots).size).toBe(slots.length);
    }
  });

  it("reports progress while the search runs", () => {
    expect(progress.length).toBeGreaterThan(0);
    const last = progress[progress.length - 1];
    expect(last.nodes).toBeGreaterThan(0);
    expect(last.accepted).toBeGreaterThan(0);
    // Nodes always outgrow results: this is a tree walk that rejects clashes.
    expect(last.nodes).toBeGreaterThanOrEqual(last.found);
  });

  it("hands every streamed timetable real metrics", () => {
    for (const timetable of batches.flat()) {
      expect(timetable.metrics).toBeDefined();
      expect(timetable.metrics!.halfDays).toBeGreaterThanOrEqual(0);
      expect(timetable.rankingScore).toBeUndefined();
    }
  });

  it("collapses the run into one layout with every combination as a variant", () => {
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.timetables).toHaveLength(1);
    expect(result.timetables[0].variants).toHaveLength(5040);
    expect(result.timetables[0].name).toBe("Option 1");
  });
});

/**
 * The ceiling itself.
 *
 * `noLimit` used to sit at an unreachable 999,999 — which stopped nothing: a
 * wide search streamed every combination it found onto a page that had to
 * paint each one, and the student watched a frozen screen while the solver ran
 * on. The ceiling is a real number now, and it has to be met here rather than
 * trusted: this fixture resolves millions of combinations when allowed, so
 * the only thing that can end the run is the ceiling, not the space itself.
 */
describe("the unlimited search stops at the ceiling", () => {
  let batches: TimetableState[][] = [];
  let progress: GenerateProgress[] = [];
  let result: GenerateResult;

  beforeAll(() => {
    // Ten courses, each with three options drawn from disjoint stretches of
    // the non-clashing pool. The three windows are distinct per course — a
    // week needs every course in a different one or the pairs clash — so the
    // space is 3^10 = 59,049 complete weeks and the walk has somewhere far
    // past `HARD_RESULT_LIMIT` to stop.
    const pool = nonClashingSlots(30);
    const masterCourses: ParsedCourse[] = [];
    const courseLocks: CourseLock[] = [];
    for (let courseIndex = 0; courseIndex < 10; courseIndex++) {
      const code = `BCSE3${courseIndex}0`;
      courseLocks.push(lock({ code }));
      for (let slotIndex = 0; slotIndex < 3; slotIndex++) {
        masterCourses.push(
          row({
            CODE: code,
            SLOT: pool[(courseIndex * 3 + slotIndex) % pool.length],
            ROOM: `AB1-${200 + courseIndex * 3 + slotIndex}`,
          })
        );
      }
    }

    batches = [];
    progress = [];
    result = generateTimetablesStream(
      params({ masterCourses, courseLocks, noLimit: true }),
      {
        batchSize: 100,
        onBatch: (batch) => batches.push(batch),
        onProgress: (p) => progress.push(p),
      }
    );
  }, 60_000);

  it("answers rather than cancels, and says it was capped", () => {
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // A ceiling is an answer — the walk was never asked to stop, so the
    // cancelled shape (with its "stopped early" wording) must not appear.
    expect(result.capped).toBe(true);
  });

  it("keeps exactly the ceiling's worth of timetables", () => {
    // The batches carry the pre-grouping list, so this is the count the walk
    // accepted — the grouped result collapses these into layouts.
    expect(batches.flat()).toHaveLength(HARD_RESULT_LIMIT);
    // Progress is polled on nodes, whose last tick can land before the final
    // combinations are counted — it must never overshoot the ceiling, but
    // it may read a little under.
    for (const p of progress) {
      expect(p.accepted).toBeLessThanOrEqual(HARD_RESULT_LIMIT);
    }
  });
});

/**
 * A course offered on two slots offers two *choices*.
 *
 * The solver used to precompute one array of periods per course by
 * concatenating every offering's periods, then test that union against the
 * week so far — identically for each offering. So the moment one of them
 * clashed with an already-chosen course, the alternatives that did not clash
 * were rejected along with it, and the course was dropped from the search
 * entirely. It stayed hidden because every fixture before this file gave each
 * course a single offering, which is also why a real student picking a course
 * with a clashing lab section was quietly shown fewer timetables than exist.
 */
describe("a course with more than one offering", () => {
  it("keeps the offering that fits, not just the one it tried first", () => {
    const result = generateTimetables(
      params({
        masterCourses: [
          // A lab on Friday 09:50–10:40.
          row({ CODE: "BCSE101", SLOT: "L27", ROOM: "AB1-101" }),
          // Two offerings of the same course. TA1 is also Friday 09:50, so it
          // collides with L27; TA2 is Friday 15:50 and is free.
          row({ CODE: "BCSE102", SLOT: "A1+TA1", ROOM: "AB2-201" }),
          row({ CODE: "BCSE102", SLOT: "A1+TA2", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
      })
    );

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;

    // The colliding lab is rejected and the free one is kept. Before the fix
    // this returned an error, having rejected both offerings as one — the
    // student was told no week existed when the schedule held exactly one.
    expect(result.timetables).toHaveLength(1);
    const second = result.timetables[0].courses.find((c) => c.code === "BCSE102");
    // Slots arrive split on `+`, so the offering reads as its two halves.
    expect(second?.slots).toEqual(["A1", "TA2"]);
  });

  it("still reports nothing when nothing genuinely fits", () => {
    const result = generateTimetables(
      params({
        masterCourses: [
          // A1 occupies Mon 08:00 and Wed 08:55.
          row({ CODE: "BCSE101", SLOT: "A1", ROOM: "AB1-101" }),
          // Both offerings carry A1, so both really do collide — and the fix
          // must not turn a real impossibility into a phantom timetable.
          row({ CODE: "BCSE102", SLOT: "A1+TA1", ROOM: "AB2-201" }),
          row({ CODE: "BCSE102", SLOT: "A1+TA2", ROOM: "AB2-202" }),
        ],
        courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
      })
    );

    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.code).toBe("no_conflict_free");
  });
});

describe("cancelling a search", () => {
  it("stops early and keeps what it had found", () => {
    const seen: TimetableState[] = [];
    const result = generateTimetablesStream(
      // Unlimited, so the walk is not already going to stop at fifty for a
      // different reason and cancellation never gets a chance to be the cause.
      params({ ...sevenBySeven(), noLimit: true }),
      {
        shouldStop: () => true,
        onBatch: (batch) => seen.push(...batch),
      }
    );

    expect(result.kind).toBe("cancelled");
    if (result.kind !== "cancelled") return;

    // Not nothing, and not everything: a cancel that returns an empty list is
    // indistinguishable from a failed run, and one that returns all 5040 means
    // the cancel was ignored.
    expect(result.timetables.length).toBeGreaterThan(0);
    expect(result.timetables.length).toBeLessThan(5040);
    expect(result.timetables[0].metrics).toBeDefined();
    expect(seen.length).toBe(result.timetables.length);
  });

  it("does not mistake a completed search for a cancelled one", () => {
    const result = generateTimetablesStream(params(sevenBySeven()), {
      shouldStop: () => false,
    });
    expect(result.kind).toBe("ok");
  });
});

describe("the cap", () => {
  it("flags a run that stopped at the limit rather than exhausting the search", () => {
    const result = generateTimetablesStream(params(sevenBySeven()));
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // Fifty is the default cap and 5040 combinations exist, so this stopped
    // early — which is exactly what `capped` is for.
    expect(result.capped).toBe(true);
    expect(result.timetables[0].variants).toHaveLength(50);
  });

  it("leaves the flag clear when the search was not truncated", () => {
    const result = generateTimetables(
      params({
        masterCourses: [row({ CODE: "BCSE101", SLOT: "A1+TA1" })],
        courseLocks: [lock({ code: "BCSE101" })],
      })
    );
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.capped).toBe(false);
  });
});

describe("watching does not change the failure modes", () => {
  const watched = (over: Partial<GenerateParams>): GenerateResult =>
    generateTimetablesStream(params(over), { onBatch: () => {}, onProgress: () => {} });

  it("reports no selection", () => {
    expect(watched({}).kind).toBe("error");
    const r = watched({});
    if (r.kind === "error") expect(r.code).toBe("no_courses_selected");
  });

  it("names the course with no options left", () => {
    const r = watched({
      masterCourses: [row({ CODE: "BCSE101", SLOT: "A1" })],
      courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE999" })],
    });
    expect(r.kind).toBe("error");
    if (r.kind === "error") {
      expect(r.code).toBe("no_valid_slots");
      expect(r.subjectCode).toBe("BCSE999");
    }
  });

  it("reports a week that cannot be assembled", () => {
    const r = watched({
      masterCourses: [
        row({ CODE: "BCSE101", SLOT: "B1" }),
        row({ CODE: "BCSE102", SLOT: "B1", ROOM: "AB2-202" }),
      ],
      courseLocks: [lock({ code: "BCSE101" }), lock({ code: "BCSE102" })],
    });
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("no_conflict_free");
  });

  it("reports the half-days floor rather than returning too few", () => {
    const r = watched({
      masterCourses: [row({ CODE: "BCSE101", SLOT: "A1+TA1" })],
      courseLocks: [lock({ code: "BCSE101" })],
      minHalfDays: 10,
    });
    expect(r.kind).toBe("error");
    if (r.kind === "error") expect(r.code).toBe("below_min_half_days");
  });

  it("emits nothing at all when it fails", () => {
    const seen: TimetableState[] = [];
    generateTimetablesStream(
      params({
        masterCourses: [row({ CODE: "BCSE101", SLOT: "A1+TA1" })],
        courseLocks: [lock({ code: "BCSE101" })],
        minHalfDays: 10,
      }),
      { onBatch: (batch) => seen.push(...batch) }
    );
    // Every batch it might have sent was later withdrawn by the floor, so a
    // caller that only watches batches would have shown an option that does
    // not exist. The failure code is what tells it otherwise.
    expect(seen).toHaveLength(0);
  });
});
