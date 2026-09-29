/**
 * The projection behind the mobile vertical timetable.
 *
 * The horizontal grid (`amazeui`'s `TimetableGrid`, and the inline copy in
 * `FFCSTimetableTab.tsx`) is a *day-row, period-column* table whose cells split
 * into a theory half and a lab half. This module produces the transpose: a
 * *band-row, day-column* table with **one cell per (day, band)**.
 *
 * Three things happen on the way through, and none of them touch the input.
 *
 * ## 1. Bands
 *
 * `theoryPeriods` is the row skeleton and `labPeriods` is index-aligned with it
 * — that pairing is the horizontal grid's column skeleton, and it is reused
 * verbatim. A period carrying `lunch: true` is a spacer, not a class.
 *
 * ## 2. Runs (the "band those cells together" behaviour)
 *
 * A **run** is a maximal chain of consecutive bands on one day that hold the
 * same course on the same half and are temporally contiguous. A three-hour
 * embedded lab is `L1+L2+L3` on Monday — 08:00-08:50, 08:50-09:40, 09:50-10:40
 * — which the horizontal grid draws as three cells and this one draws as a
 * single cell spanning three rows.
 *
 * `RUN_MERGE_GAP_MIN` is 10, not the 5 that `lib/attendanceTimetable.ts` uses
 * for its card merge. The real chennai lab vocabulary has a **ten** minute
 * break between `L2` and `L3`, so a 5-minute tolerance splits every three-hour
 * lab in half. A tolerance of 10 leaves theory intact: `TG1` ends 12:30 and
 * `S11` starts 12:35 (5), while `S11` ends 13:25 and `A2` starts 14:00 (35).
 *
 * Only *occupied* bands form runs. An empty band never merges with anything, or
 * a free stretch of the day would collapse into one oversized cell.
 *
 * ## 3. Lab precedence
 *
 * A band can hold a theory slot and a lab slot at the same time — Monday has
 * both `A1` and `L1` at 08:00-08:50. The horizontal grid draws them stacked in
 * one cell. This one shows a single cell, and **the lab wins**, because a lab
 * is the commitment the student is actually attending. The displaced theory run
 * is not dropped: it is collected per band and re-surfaced as `cell.shadowed`,
 * which the tap sheet reports. That is the one place this view is less dense
 * than the horizontal one, and it is a deliberate trade.
 *
 * ## No time parsing lives here
 *
 * `fmt`/`toMinutes` come from `@/lib/social/schedule`, which handles both time
 * dialects in play: `config.json`'s `"8:00-8:50"` and `campus/*.json`'s
 * `"8:00 AM"`. See that module's header for why 1-7 means PM.
 */

import type {
  AddedCourse,
  GapDetail,
  TimetablePeriod,
} from "@amazecontinuityprojects/amazeui";
import { fmt, toMinutes, dayKeyForDate } from "@/lib/social/schedule";
import { hasSlot } from "@/lib/slots";

/**
 * Tolerance for gluing two adjacent slots of the same course into one cell.
 *
 * 10 catches the real `L2`->`L3` break. See the module comment.
 */
export const RUN_MERGE_GAP_MIN = 10;

export type Half = "theory" | "lab";

/** One row of the vertical grid. */
export type Band = {
  index: number;
  /** A `lunch: true` spacer. Renders as a divider and never starts a run. */
  isLunch: boolean;
  /** False when the period carries no usable time, so no label can be shown. */
  hasTime: boolean;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
  /** Left-gutter text: `"8:00 AM – 8:50 AM"`, or `"Lunch"`. */
  label: string;
  /**
   * Gutter start time only, without the meridiem: `"8:00"`.
   *
   * The compact density drops the end time and the `"AM"` to buy width for the
   * day columns, and `label` is a range that has to be split to get at either
   * half — so the useful piece is derived once, here, where the time already
   * is.
   */
  shortLabel: string;
  /** The `"8:00 AM"` half of `label`, kept out of the component's splitting. */
  startLabel: string;
  /** The `"8:50 AM"` half of `label`, or `""` for lunch / a period with no time. */
  endLabel: string;
};

export type CellKind = "course" | "blocked" | "gap" | "empty";

/** A maximal contiguous chain of bands occupied by one course on one half. */
export type Run = {
  half: Half;
  course: AddedCourse;
  /** `"L1"`, or `["L1","L2","L3"]` for a merged lab. */
  slots: string[];
  /** Inclusive band indexes. */
  startBand: number;
  endBand: number;
  startMin: number;
  endMin: number;
};

export type ShadowedRun = {
  course: AddedCourse;
  slots: string[];
  label: string;
};

export type Cell = {
  dayId: string;
  /** The band this cell starts on. */
  bandIndex: number;
  /** `1`, or `3` for a merged run — the value to hand `rowSpan`. */
  bandCount: number;
  /**
   * Text for the cell body. A merged run shows `"L1+L2+L3"`; a free band shows
   * `"A1 / L1"`, matching the `" / "` join that
   * `attendance/TimetableGrid.tsx` already used for its own cells.
   */
  label: string;
  /**
   * `label` squeezed for a narrow column: a merged run becomes `"L1 +2"`, since
   * `"L1+L2+L3"` has to break mid-token at seven days across a phone.
   *
   * The compact density only uses this on **occupied** cells. A free band has no
   * meaningful single slot to show — `"L1 / A1"` is two — so compact leaves it
   * blank and lets the colour carry it.
   */
  shortLabel: string;
  slots: string[];
  course: AddedCourse | null;
  half: Half | null;
  kind: CellKind;
  /** Every slot in the run is ruled out — the course cannot run here. */
  blocked: boolean;
  /** Some but not all of the run's slots are ruled out. */
  partiallyBlocked: boolean;
  /** The band falls inside a `selectedGapDetails` window and holds no course. */
  inGap: boolean;
  /** Runs displaced by lab precedence that overlap this cell's span. */
  shadowed: ShadowedRun[];
  startMin: number;
  endMin: number;
};

export type VerticalGrid = {
  bands: Band[];
  days: { id: string; name: string }[];
  /**
   * `cells[dayId][bandIndex]` is the cell to render, or `null` when a `rowSpan`
   * from an earlier band already covers that position.
   */
  cells: Record<string, (Cell | null)[]>;
};

export const DEFAULT_DAYS: { id: string; name: string }[] = [
  { id: "mon", name: "Monday" },
  { id: "tue", name: "Tuesday" },
  { id: "wed", name: "Wednesday" },
  { id: "thu", name: "Thursday" },
  { id: "fri", name: "Friday" },
];

type Times = { startMin: number; endMin: number } | null;

/** Monday-first, matching `schedule.ts`'s `DAYS` rather than JS `getDay()`. */
const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * The calendar date that `dayId` falls on in the week containing `today`.
 *
 * The timetable is weekly and the vocabulary is day-keyed, so a column header
 * has no date of its own — this is what lets today's column show a real number
 * instead of a bare "MON". Returns `null` for an id outside the week.
 */
export function weekDateForDayId(dayId: string, today: Date = new Date()): Date | null {
  const from = DAY_ORDER.indexOf(dayKeyForDate(today).toLowerCase() as (typeof DAY_ORDER)[number]);
  const to = DAY_ORDER.indexOf(dayId.trim().toLowerCase() as (typeof DAY_ORDER)[number]);
  if (from < 0 || to < 0) return null;
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  // setDate, not add: it rolls into the next month correctly without the
  // `new Date(year, month, 0)` trick.
  date.setDate(date.getDate() + (to - from));
  return date;
}

function timesOf(period: TimetablePeriod | undefined): Times {
  const start = period?.start;
  const end = period?.end;
  if (!start || !end) return null;
  return { startMin: toMinutes(start), endMin: toMinutes(end) };
}

/**
 * Exported for tests: the cell text an assistive technology announces and the
 * `title` tooltip reads. Kept next to the projection so the two cannot drift.
 */
export function describeCell(cell: Cell, dayName: string): string {
  const what = `${dayName} ${cell.label}`;
  if (cell.kind === "empty") return `${what} — free`;
  if (cell.blocked) {
    return cell.course
      ? `${what} — ${cell.course.code} ${cell.course.title}, blocked`
      : `${what} — blocked`;
  }
  if (cell.course) return `${what} — ${cell.course.code} ${cell.course.title}`;
  if (cell.inGap) return `${what} — free, inside a selected gap`;
  return what;
}

/**
 * Build the transposed grid.
 *
 * Pure and React-free, which is the whole point: the run-merge and lab-precedence
 * rules are the two things most likely to be got wrong, and they are now
 * asserted directly in `src/__tests__/timetable-vertical.test.ts` rather than
 * inferred from rendered markup.
 */
export function buildVerticalGrid({
  courses,
  theoryPeriods,
  labPeriods,
  days = DEFAULT_DAYS,
  blockedSlots,
  selectedGapDetails,
  mergeGapMinutes = RUN_MERGE_GAP_MIN,
}: {
  courses: AddedCourse[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  blockedSlots?: Set<string>;
  selectedGapDetails?: GapDetail[] | null;
  mergeGapMinutes?: number;
}): VerticalGrid {
  const theory = theoryPeriods ?? [];
  const lab = labPeriods ?? [];
  const gaps = selectedGapDetails ?? [];

  const bands: Band[] = theory.map((period, index) => {
    const isLunch = Boolean(period?.lunch);
    const times = isLunch ? null : timesOf(period);
    const startLabel = isLunch || !times ? "" : fmt(period?.start);
    const endLabel = isLunch || !times ? "" : fmt(period?.end);
    return {
      index,
      isLunch,
      hasTime: times !== null,
      start: isLunch ? "" : (period?.start ?? ""),
      end: isLunch ? "" : (period?.end ?? ""),
      startMin: times?.startMin ?? 0,
      endMin: times?.endMin ?? 0,
      label: isLunch ? "Lunch" : times ? `${startLabel} – ${endLabel}` : "—",
      startLabel,
      endLabel,
      shortLabel: startLabel.replace(/\s?[AP]M$/, "") || "—",
    };
  });

  const cells: Record<string, (Cell | null)[]> = {};

  for (const day of days) {
    const dayId = day.id;
    const runsByHalf = {
      theory: buildRuns(dayId, "theory", bands, theory, courses, mergeGapMinutes),
      lab: buildRuns(dayId, "lab", bands, lab, courses, mergeGapMinutes),
    };

    const runAt = {
      theory: indexRuns(runsByHalf.theory),
      lab: indexRuns(runsByHalf.lab),
    };

    // Displaced runs are collected per band first, then folded into whichever
    // cell ends up spanning that band. Collecting per band (rather than
    // attaching to the losing run's own start) is what keeps a theory run from
    // going unreported when the lab run that beat it starts earlier and is
    // longer. `Run` objects are shared by reference across the bands they cover,
    // so the fold below can dedupe on identity rather than on slot lists.
    const shadowedAt: Run[][] = bands.map(() => []);

    for (const band of bands) {
      if (band.isLunch) continue;
      const loser =
        runAt.lab.get(band.index) != null ? runAt.theory.get(band.index) : null;
      if (!loser) continue;
      shadowedAt[band.index].push(loser);
    }

    const row: (Cell | null)[] = bands.map((band) => {
      if (band.isLunch) return null;

      const labRun = runAt.lab.get(band.index) ?? null;
      const theoryRun = runAt.theory.get(band.index) ?? null;
      const run = labRun ?? theoryRun;

      const theorySlot = theory[band.index]?.days?.[dayId];
      const labSlot = lab[band.index]?.days?.[dayId];
      const bandSlots = [labSlot, theorySlot].filter(
        (s): s is string => Boolean(s)
      );

      const runSlots = run?.slots ?? [];
      /**
       * What to *show*, which is not always the schema's id.
       *
       * A law course is booked `A+TA+TAA` where the schema calls those periods
       * `A1`/`TA1`/`TAA1`, so printing the schema's id would put "A1" in a
       * student's cell for a course their own timetable spells "A". Prefer the
       * id the course actually carries, and fall back to the schema's when the
       * two are the same string — which is every course that is not a law one.
       *
       * This is also what makes blocking work: the planner filters its options
       * by the slot on the course, so a blocked `A` has to be a `A` here for
       * `onToggleBlockSlot` to record something that can match.
       */
      const shownRunSlots = run
        ? run.slots.map((s) => run.course.slots.find((own) => hasSlot([own], s)) ?? s)
        : [];
      const slots = shownRunSlots.length > 0 ? shownRunSlots : bandSlots;
      const label =
        shownRunSlots.length > 0 ? shownRunSlots.join("+") : bandSlots.join(" / ");
      // "L1+L2+L3" cannot survive a 40px column, so the compact density reads
      // "L1 +2": the first slot plus how many more the run holds. The full list
      // is always in the tap sheet.
      const shortLabel =
        shownRunSlots.length > 1
          ? `${shownRunSlots[0]} +${shownRunSlots.length - 1}`
          : label;

      // A run is a *display* merge of one course's slots, so it is only fully
      // ruled out when every one of them is. A free cell is a single slot as far
      // as the planner is concerned, so any single blocked slot hatches it —
      // which is also what the horizontal grid does.
      //
      // Read through `hasSlot` because a blocked slot may be recorded in either
      // spelling: a law student blocks "A" and an engineering one blocks "A1",
      // and both mean the same period.
      const isBlocked = (s: string) => hasSlot(blockedSlots ?? [], s);
      const blocked =
        slots.length > 0 &&
        (runSlots.length > 0
          ? runSlots.every(isBlocked)
          : bandSlots.some(isBlocked));
      const partiallyBlocked =
        runSlots.length > 0 &&
        !blocked &&
        runSlots.some(isBlocked);

      const inGap =
        band.hasTime &&
        gaps.some(
          (g) => g.day === dayId && band.startMin >= g.startMin && band.startMin < g.endMin
        );

      const kind: CellKind = blocked
        ? "blocked"
        : run
          ? "course"
          : inGap
            ? "gap"
            : "empty";

      const bandCount = run ? run.endBand - run.startBand + 1 : 1;

      return {
        dayId,
        bandIndex: band.index,
        bandCount,
        label,
        shortLabel,
        slots,
        course: run?.course ?? null,
        half: run?.half ?? null,
        kind,
        blocked,
        partiallyBlocked,
        inGap,
        shadowed: [],
        startMin: run?.startMin ?? band.startMin,
        endMin: run?.endMin ?? band.endMin,
      };
    });

    // Fold the displaced runs in, over each cell's whole span, then blank the
    // positions a rowspan already covers. A run is listed under every band it
    // covers, so it has to be collapsed to one entry per run — keyed on where
    // the run starts, which is unique within a day.
    row.forEach((cell, bandIndex) => {
      if (!cell) return;
      const seen = new Set<number>();
      for (let i = bandIndex; i < bandIndex + cell.bandCount; i++) {
        for (const run of shadowedAt[i] ?? []) {
          if (seen.has(run.startBand)) continue;
          seen.add(run.startBand);
          cell.shadowed.push({
            course: run.course,
            slots: run.slots,
            label: run.slots.join("+"),
          });
        }
      }
    });

    for (let i = 0; i < row.length; i++) {
      const cell = row[i];
      if (!cell || cell.bandCount === 1) continue;
      for (let j = i + 1; j < i + cell.bandCount; j++) row[j] = null;
    }

    cells[dayId] = row;
  }

  return { bands, days: [...days], cells };
}

function indexRuns(runs: Run[]): Map<number, Run> {
  const map = new Map<number, Run>();
  for (const run of runs) {
    for (let i = run.startBand; i <= run.endBand; i++) map.set(i, run);
  }
  return map;
}

/** Chain each day's occupied bands into runs. See the module comment. */
function buildRuns(
  dayId: string,
  half: Half,
  bands: Band[],
  periods: TimetablePeriod[],
  courses: AddedCourse[],
  mergeGapMinutes: number
): Run[] {
  const runs: Run[] = [];
  let open: Run | null = null;

  for (const band of bands) {
    // A lunch spacer terminates any run rather than bridging it: 12:35-13:25
    // (S11) and 14:00-14:50 (A2) are never one sitting even though a student
    // could hold both.
    if (band.isLunch) {
      open = null;
      continue;
    }

    const period = periods[band.index];
    const slotId = period?.days?.[dayId];
    const times = timesOf(period);
    if (!slotId || !times) {
      open = null;
      continue;
    }

    const course = courses.find((c) => hasSlot(c.slots, slotId));
    if (!course) {
      // Free bands never start or extend a run.
      open = null;
      continue;
    }

    if (open && open.course.id === course.id && times.startMin - open.endMin <= mergeGapMinutes) {
      open.slots.push(slotId);
      open.endBand = band.index;
      open.endMin = Math.max(open.endMin, times.endMin);
      continue;
    }

    open = {
      half,
      course,
      slots: [slotId],
      startBand: band.index,
      endBand: band.index,
      startMin: times.startMin,
      endMin: times.endMin,
    };
    runs.push(open);
  }

  return runs;
}
