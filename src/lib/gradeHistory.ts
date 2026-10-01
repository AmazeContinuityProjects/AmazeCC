import { formatSemesterName } from "@/components/custom/exams/courseHelpers";
import type { AssessmentItem, CourseItem } from "@/types/data/marks";
import type { GradeItem, GradeResultsMap } from "@/types/data/allgrades";

/**
 * Grade history, as numbers.
 *
 * The screen this backs is the "Grade History" subpage, and every derivation it
 * needs used to be inline in the component: a semester label, a GPA trend, a
 * distribution, an average. Inline, they had three separate bugs that this file
 * now makes testable:
 *
 *  - the semester label was re-derived as `id.endsWith("1") ? Fall : Winter`,
 *    which labels a **summer** term "Winter". `formatSemesterName` already exists
 *    and `CourseDetailSubpage` already uses it; the grade history had its own.
 *  - the trend series was built by assuming each course is out of 100, with no
 *    reference to `weightagePercent` at all.
 *  - there was no cumulative figure, on a page called "Grade History".
 *
 * Pure, and free of React, config.json and localStorage — same rule as
 * `calendarDay.ts`. Which number a screen shows is a design decision; what the
 * number *is* is decided here, once.
 */

/** A parsed number, or `null`. VTOP sends every figure as a string. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Round to 2dp, so a page never renders `8.899999999999999`. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Semesters
// ---------------------------------------------------------------------------

/** VIT's 10-point scale. `N` is ungraded and worth nothing. */
const GRADE_POINTS_LOOKUP: Record<string, number> = {
  S: 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0, N: 0,
};

export type SemesterRow = {
  /** The VTOP id, e.g. `CH20252601`. */
  id: string;
  /** `Fall 25-26`. */
  label: string;
  gpa: number;
  courses: GradeItem[];
  /** Courses that carry a numeric `grandTotal`. */
  scored: GradeItem[];
  /** Mean `grandTotal` across scored courses, 0 when none are scored. */
  avgScore: number;
  /** Mean of the letter grades, as points out of 10. 0 when no letter grades. */
  avgPoints: number;
};

/**
 * Sort key for a semester id.
 *
 * Real ids are `CH` + 4-digit entry year + 2-digit calendar year + 2-digit
 * term (`CH20252601`), and for that shape plain lexicographic order already
 * happens to be chronological — which is why the old page was right about
 * ordering and wrong about naming. Anything that does not match is sorted
 * lexicographically instead of dropped, because a term the reader can see in the
 * data must not silently disappear from the list.
 */
function semesterSortKey(id: string): string {
  return /^CH\d{8}$/.test(id) ? id.slice(2) : id;
}

/** One semester, reduced to the numbers the page shows. */
export function toSemesterRow(id: string, entry: unknown): SemesterRow | null {
  const data = entry as { gpa?: string | null; grades?: GradeItem[] } | null | undefined;
  if (!data || typeof data !== "object") return null;

  const courses = Array.isArray(data.grades) ? data.grades : [];
  // A term with no courses at all is a payload the college has not filled in
  // yet, not a term with an average of zero. It stays in the list so the student
  // can see it is missing, but it contributes to nothing.
  const scored = courses.filter((c) => num(c?.grandTotal) !== null);
  const avgScore = scored.length
    ? scored.reduce((s, c) => s + (num(c.grandTotal) ?? 0), 0) / scored.length
    : 0;

  const points = GRADE_POINTS_LOOKUP;
  // Graded letters only, for the same reason the distribution excludes them: an
  // `N` is worth 0 on the scale, but averaging it in as a 0 would report a term
  // the student has not been assessed on yet as a term they failed.
  const withPoints = courses.filter((c) => isGradedLetter(c?.grade));
  const avgPoints = withPoints.length
    ? withPoints.reduce(
        (s, c) => s + (points[String(c.grade).toUpperCase()] as number),
        0
      ) / withPoints.length
    : 0;

  return {
    id,
    label: formatSemesterName(id),
    gpa: num(data.gpa) ?? 0,
    courses,
    scored,
    avgScore: round2(avgScore),
    avgPoints: round2(avgPoints),
  };
}

/** Every term in the payload, oldest first. */
export function semesterRows(grades: GradeResultsMap | undefined | null): SemesterRow[] {
  if (!grades || typeof grades !== "object") return [];
  return Object.keys(grades)
    .map((id) => toSemesterRow(id, grades[id]))
    .filter((r): r is SemesterRow => r !== null)
    .sort((a, b) => semesterSortKey(a.id).localeCompare(semesterSortKey(b.id)));
}

/** The newest term with any courses, which is what the page opens on. */
export function latestSemester(rows: SemesterRow[]): SemesterRow | undefined {
  return [...rows].reverse().find((r) => r.courses.length > 0) ?? rows[rows.length - 1];
}

/** The highest-GPA term. Ties resolve to the most recent. */
export function bestTerm(rows: SemesterRow[]): SemesterRow | undefined {
  let best: SemesterRow | undefined;
  for (const r of rows) {
    if (r.gpa <= 0) continue;
    if (!best || r.gpa > best.gpa) best = r;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Cumulative
// ---------------------------------------------------------------------------

/**
 * Where a cumulative figure came from, so the page can say so.
 *
 * `vtop` is the authoritative one and the only one that accounts for credits
 * properly. `derived` is an unweighted mean of per-term GPAs, which is *not* the
 * same number — a 3-credit term and a 24-credit term count equally — so it is a
 * fallback for when VTOP has not published a CGPA, and the UI must label it
 * rather than presenting it as the real figure.
 */
export type CumulativeSource = "vtop" | "derived" | "none";

export type Cumulative = {
  value: number;
  creditsEarned: number;
  creditsRequired: number;
  source: CumulativeSource;
};

export function cumulativeGpa(
  rows: SemesterRow[],
  cgpa?: { cgpa?: string; creditsEarned?: string; creditsRequired?: string } | null
): Cumulative {
  const creditsEarned = num(cgpa?.creditsEarned) ?? 0;
  const creditsRequired = num(cgpa?.creditsRequired) ?? 0;

  const published = num(cgpa?.cgpa);
  if (published !== null && published > 0) {
    return { value: published, creditsEarned, creditsRequired, source: "vtop" };
  }

  // Unweighted, and that is a real limitation rather than a rounding detail.
  const withGpa = rows.filter((r) => r.gpa > 0);
  if (withGpa.length > 0) {
    return {
      value: round2(withGpa.reduce((s, r) => s + r.gpa, 0) / withGpa.length),
      creditsEarned,
      creditsRequired,
      source: "derived",
    };
  }

  return { value: 0, creditsEarned, creditsRequired, source: "none" };
}

// ---------------------------------------------------------------------------
// Letter grades
// ---------------------------------------------------------------------------

/**
 * The graded letters, best to worst.
 *
 * `N` (not yet graded) and `P` are deliberately absent. They are letters VTOP
 * prints, but neither is a grade the student received, and a distribution that
 * counted them would put an ungraded course in the denominator — three `N`s in a
 * term and an `S` reads as a minority when it is the only grade there was. They
 * still have tones in `GRADE_TONE`, because a course *row* showing `N` still
 * needs a sensible badge.
 */
export const GRADE_ORDER = ["S", "A", "B", "C", "D", "E", "F"] as const;
export type GradeLetter = (typeof GRADE_ORDER)[number];

/** Whether this is a grade the student was actually awarded. */
export function isGradedLetter(grade: string | undefined | null): boolean {
  return GRADE_ORDER.includes(
    String(grade ?? "").trim().toUpperCase() as GradeLetter
  );
}

/** Points for a letter, or `null` when the letter is one we do not know. */
export function gradePoints(grade: string | undefined | null): number | null {
  const key = String(grade ?? "").trim().toUpperCase();
  return GRADE_POINTS_LOOKUP[key] === undefined ? null : GRADE_POINTS_LOOKUP[key];
}

/**
 * Grade -> `TONE_BADGE` tone.
 *
 * Deliberately coarser than a one-hue-per-grade ladder: the token recipe has six
 * semantic hues, so `E` and `F` share `red`. That collapse is not a compromise to
 * make here — a failing grade is a failing grade, and two shades of the same red
 * were never distinguishable at list size anyway. `Cyan` and `violet` carry the
 * middle of the ladder instead of inventing hues for it.
 */
export const GRADE_TONE: Record<string, string> = {
  S: "amber",
  A: "emerald",
  B: "blue",
  C: "cyan",
  D: "violet",
  E: "red",
  F: "red",
  N: "zinc",
  P: "violet",
};

export const toneForGrade = (grade: string | undefined | null): string =>
  GRADE_TONE[String(grade ?? "").trim().toUpperCase()] ?? "zinc";

export type DistributionRow = {
  grade: string;
  tone: string;
  count: number;
  /** 0-100, of the courses that carry a letter grade at all. */
  share: number;
};

/**
 * How the grades are spread, across every course passed in.
 *
 * `total` counts only courses that carry a letter the student was actually
 * awarded — see `GRADE_ORDER` for why `N` is not one of them. A letter outside
 * the ladder is dropped rather than bucketed into an "other" column: a column
 * headed by a letter nobody recognises is not information, and an unexpected
 * letter is a data problem worth catching in a test rather than hiding in the UI.
 */
export function gradeDistribution(courses: GradeItem[]): DistributionRow[] {
  const counts = new Map<string, number>();
  for (const c of courses) {
    const g = String(c?.grade ?? "").trim().toUpperCase();
    if (!isGradedLetter(g)) continue;
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  if (total === 0) return [];

  return GRADE_ORDER.filter((g) => counts.has(g)).map((g) => ({
    grade: g,
    tone: GRADE_TONE[g],
    count: counts.get(g)!,
    share: round2((counts.get(g)! / total) * 100),
  }));
}

export type TypeAverage = {
  type: string;
  avg: number;
  count: number;
};

/**
 * Mean score by course type — theory against lab.
 *
 * The reason this is on the page: an embedded course is published as two entries
 * with the same code, and averaging all of them together hides the fact that
 * every lab is dragging the number down. Grouping by `courseType` is the one cut
 * that answers "where am I weak?".
 *
 * Scored courses only, and a type with none is omitted rather than shown as 0.
 */
export function averageByType(courses: GradeItem[]): TypeAverage[] {
  const groups = new Map<string, number[]>();
  for (const c of courses) {
    const score = num(c?.grandTotal);
    if (score === null) continue;
    const type = String(c?.courseType || "Other").trim() || "Other";
    const bucket = groups.get(type) ?? [];
    bucket.push(score);
    groups.set(type, bucket);
  }
  return [...groups.entries()]
    .map(([type, scores]) => ({
      type,
      avg: round2(scores.reduce((s, n) => s + n, 0) / scores.length),
      count: scores.length,
    }))
    .sort((a, b) => b.avg - a.avg);
}

// ---------------------------------------------------------------------------
// Assessment reconciliation
// ---------------------------------------------------------------------------

/**
 * The weighted total implied by a course's assessment breakdown.
 *
 * Each `detail` carries both `weightageMark` (this assessment's contribution to
 * the final score) and `weightagePercent`. Summing `weightageMark` gives the
 * total the assessment list itself implies, which is the number to check
 * `grandTotal` against — and `grandTotal` is what the page shows, because VTOP is
 * the authority on what the college recorded.
 *
 * Returns `null` when the breakdown has no usable weightage, so a caller can tell
 * "the list sums to nothing" apart from "the list sums to zero".
 */
export function weightedTotal(
  details: GradeItem["details"]
): number | null {
  if (!Array.isArray(details) || details.length === 0) return null;
  const parts = details
    .map((d) => num(d?.weightageMark))
    .filter((n): n is number => n !== null);
  if (parts.length === 0) return null;
  return round2(parts.reduce((s, n) => s + n, 0));
}

/**
 * Whether the assessment list disagrees with the recorded total.
 *
 * A half-point tolerance, because the two are rounded independently and a
 * 0.04 gap is arithmetic noise while a 3-point gap means the list is not the
 * thing that produced the total.
 */
export function weightedTotalDiffers(
  course: Pick<GradeItem, "grandTotal" | "details">
): boolean {
  const weighted = weightedTotal(course.details);
  const reported = num(course.grandTotal);
  if (weighted === null || reported === null) return false;
  return Math.abs(weighted - reported) > 0.5;
}

// ---------------------------------------------------------------------------
// Embedded courses: the two halves behind one published grade
// ---------------------------------------------------------------------------

/**
 * Is this an embedded (theory + lab) course?
 *
 * Matches on `courseType` alone. The course *code* is not a safe signal: the
 * embedded codes in circulation are unremarkable (`BAEEE101`, `BACHY107`), so a
 * suffix or prefix rule would both over- and under-match.
 */
export function isEmbeddedCourse(course: Pick<GradeItem, "courseType">): boolean {
  return /embedded/i.test(String(course?.courseType ?? ""));
}

export type EmbeddedSegment = {
  /** `"Theory"` or `"Lab"`. */
  kind: "Theory" | "Lab";
  /** VTOP's `courseType` for the half, e.g. `"Embedded Theory"`. */
  courseType: string;
  credits: number | null;
  /**
   * The half's own score out of 100 - the sum of its assessments'
   * `weightageMark`, which is VTOP's own weighted contribution and so needs no
   * rescaling.
   */
  score: number | null;
  assessments: AssessmentItem[];
};

/**
 * The theory and lab halves of an embedded course, from the marks payload.
 *
 * Why this exists: `all-grades` publishes an embedded course as **one** row with
 * one combined total and grade, and its `details` are a flat list with no
 * theory/lab marker at all (probed against the live endpoint - the frozen legacy
 * route strips the `type` field the AmazeCC route sets). The per-half breakdown
 * is only in the marks payload, where an embedded course appears as *two*
 * courses under one code, `"Embedded Theory"` and `"Embedded Lab"`.
 *
 * The app already has that payload for past terms: `pastDataSync.ts` caches
 * `frozen_marks_<semesterId>` per semester, and `marksRes.courses` is exactly
 * this shape. So nothing new is fetched - this reads what is already cached.
 *
 * Returns `null` when the halves are not cached (a term synced before this
 * existed, or a course with no matching marks rows). The caller must fall back
 * to the flat published breakdown rather than showing an empty section.
 */
export function embeddedSegments(
  courseCode: string,
  marks: { courses?: CourseItem[] } | null | undefined
): EmbeddedSegment[] | null {
  const code = String(courseCode ?? "").trim();
  if (!code) return null;

  const courses = Array.isArray(marks?.courses) ? marks.courses : [];
  const mine = courses.filter(
    (c) => String(c?.courseCode ?? "").trim() === code && isEmbeddedCourse(c)
  );
  if (mine.length === 0) return null;

  const build = (kind: "Theory" | "Lab", pattern: RegExp): EmbeddedSegment | null => {
    const row = mine.find((c) => pattern.test(String(c?.courseType ?? "")));
    if (!row) return null;
    const assessments = Array.isArray(row.assessments) ? row.assessments : [];
    const parts = assessments
      .map((a) => num(a?.weightageMark))
      .filter((n): n is number => n !== null);
    return {
      kind,
      courseType: String(row.courseType ?? ""),
      credits: num(row.credits),
      score: parts.length ? round2(parts.reduce((s, n) => s + n, 0)) : null,
      assessments,
    };
  };

  const theory = build("Theory", /theory/i);
  const lab = build("Lab", /lab/i);
  const segments = [theory, lab].filter((s): s is EmbeddedSegment => s !== null);
  return segments.length ? segments : null;
}

export type SegmentBlend = {
  /** Credit-weighted mean of the halves - what the published total should be. */
  blended: number;
  /** The published `grandTotal` for comparison. */
  published: number;
  /** `blended - published`. */
  delta: number;
  theoryCredits: number | null;
  labCredits: number | null;
};

/**
 * Reconcile the halves against the single published total.
 *
 * An embedded course's published grade is the credit-weighted blend of its two
 * halves - theory 3 credits, lab 1 - so `(theory * 3 + lab * 1) / 4` should land
 * on the published number. Measured against real published terms it lands
 * within about a point (BAENG101: 84.92 vs 85, BAMAT101: 87.70 vs 88), the
 * residual being per-assessment rounding.
 *
 * A half without credits cannot be weighted, so this needs both to be present
 * and returns `null` otherwise. Showing a blend computed from an assumed credit
 * ratio would be inventing the weighting, which is the one thing this file
 * refuses to do.
 */
export function segmentBlend(
  segments: EmbeddedSegment[],
  published: GradeItem["grandTotal"]
): SegmentBlend | null {
  const theory = segments.find((s) => s.kind === "Theory");
  const lab = segments.find((s) => s.kind === "Lab");
  const theoryCredits = theory?.credits ?? null;
  const labCredits = lab?.credits ?? null;
  const reported = num(published);
  if (theory?.score == null || lab?.score == null) return null;
  if (theoryCredits == null || labCredits == null) return null;
  const totalCredits = theoryCredits + labCredits;
  if (reported === null || totalCredits <= 0) return null;

  const blended = round2(
    (theory.score * theoryCredits + lab.score * labCredits) / totalCredits
  );
  return {
    blended,
    published: reported,
    delta: round2(blended - reported),
    theoryCredits,
    labCredits,
  };
}
