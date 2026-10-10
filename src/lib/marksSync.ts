import { api } from "@/lib/sync-engine";

/**
 * Contribute this student's marks to their cohorts' running statistics.
 *
 * ## What this does and does not know
 *
 * The client sends marks. It does **not** decide identity and it does **not** decide
 * whether this is an add or a replace — the server derives the owner from the VTOP
 * session and decides that from a token it minted last time (see
 * `AmazeCC-API/src/lib/marksStats.ts`).
 *
 * So the wire payload is a flat list of "here is my current mark for this thing, and
 * here is what I last told you it was". There is no `userHash`, no `timestamp` and no
 * `type`. Dropping all three is the point: each was a place where a modified client
 * could influence what the server believed.
 *
 * ## The previous value
 *
 * `prevMark` is read from the marks snapshot taken *before* this sync. If that snapshot
 * is missing — a cleared cache, a first ever sync — it is sent as `null`, and the server
 * treats a missing claim conservatively: it will add, but it will not replace a
 * contribution it already holds. A student whose cache was cleared therefore keeps their
 * first recorded value rather than being counted twice.
 */

const getNumericValue = (value: any, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getAssessmentTotals = (assessments: any[]) =>
  assessments.reduce(
    (acc, asm) => {
      acc.max += getNumericValue(asm.maxMark);
      acc.scored += getNumericValue(asm.scoredMark);
      acc.weightPercent += getNumericValue(asm.weightagePercent);
      acc.weighted += getNumericValue(asm.weightageMark);
      return acc;
    },
    { max: 0, scored: 0, weightPercent: 0, weighted: 0 }
  );

const getCourseCredits = (course: any) => {
  const credits = getNumericValue(course?.credits, -1);
  return credits > 0 ? credits : -1;
};

/** Percentage of the weightage released so far, or 0 when nothing has been released. */
const normalisedPct = (earned: number, available: number) =>
  available > 0 ? (earned / available) * 100 : 0;

/** The blended course total: credit-weighted across the theory and lab halves. */
const overallPct = (group: any): number => {
  const theoryTotals = getAssessmentTotals(group.theory?.assessments || []);
  const labTotals = getAssessmentTotals(group.lab?.assessments || []);

  if (!group.lab) return normalisedPct(theoryTotals.weighted, theoryTotals.weightPercent);
  if (!group.theory) return normalisedPct(labTotals.weighted, labTotals.weightPercent);

  const theoryCredits = getCourseCredits(group.theory);
  const labCredits = getCourseCredits(group.lab);
  if (theoryCredits < 0 || labCredits < 0) return 0;

  const total = theoryCredits + labCredits;
  const earned = (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) / total;
  const available =
    (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / total;

  return normalisedPct(earned, available);
};

/** A single assessment's mark as a percentage of its maximum. */
const assessmentPct = (asm: any) =>
  getNumericValue(asm?.maxMark) > 0
    ? (getNumericValue(asm.scoredMark) / getNumericValue(asm.maxMark)) * 100
    : 0;

export type CourseGroupLite = {
  theory?: { classNbr?: string; assessments?: any[] } | null;
  lab?: { classNbr?: string; assessments?: any[] } | null;
};

export type RemappedStats = Record<
  string,
  { overall: { count: number; mean: number; sd: number } | null; assessments: Record<string, any> }
>;

/**
 * Re-key the server's cohort payload into what the course pages read.
 *
 * The server keys assessments by digest and carries the overall figure flat on the
 * entry (`{ count, mean, sd, assessments }`). The pages read `overall` plus an
 * assessment map keyed by VTOP title, so this translates between the two.
 *
 * Kept as a pure, exported function — and unit-tested — because the previous version
 * of this logic lived inline and read `entry.overall`, a key the server never sends.
 * The `?? null` fallback turned that into permanent, silent "no data".
 */
export const remapCohortStats = async (
  stored: Record<string, any>,
  uniqueCourses: CourseGroupLite[]
): Promise<RemappedStats> => {
  const remapped: RemappedStats = {};

  for (const [classId, entry] of Object.entries<any>(stored ?? {})) {
    const assessments: Record<string, any> = {};
    const groups = uniqueCourses.filter(
      (g) => (g.theory || g.lab)?.classNbr === classId
    );

    for (const g of groups) {
      for (const component of ["theory", "lab"] as const) {
        const list = g[component]?.assessments;
        if (!Array.isArray(list)) continue;
        for (const asm of list) {
          const key = await assessmentKeyFor(
            classId,
            component,
            String(asm?.title ?? "")
          );
          const hit = entry?.assessments?.[key];
          if (hit) assessments[asm.title] = hit;
        }
      }
    }

    const overall =
      entry && Number.isFinite(Number(entry.count))
        ? {
            count: Number(entry.count),
            mean: Number(entry.mean ?? 0),
            sd: Number(entry.sd ?? 0),
          }
        : null;

    remapped[classId] = { overall, assessments };
  }

  return remapped;
};

/**
 * The key an assessment's cohort statistics are stored and read back under.
 *
 * **This mirrors `assessmentKeyFor` in `AmazeCC-API/src/lib/marksStats.ts` and the two
 * must stay byte-identical** — if they drift, every read silently misses and the UI falls
 * back to "not enough data" with nothing to indicate why.
 *
 * A plain SHA-256, not an HMAC: the client cannot compute an HMAC under a server-only
 * salt, and it has to be able to derive this to join a statistic back to the assessment it
 * is rendering. The input is a course-level constant shared by everyone in the cohort, so
 * there is nothing sensitive in it.
 */
export const assessmentKeyFor = async (
  classId: string,
  component: string,
  title: string
): Promise<string> => {
  const normalised = title.trim().replace(/\s+/g, " ");
  const data = new TextEncoder().encode([classId, component, normalised].join("::"));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
};

type CourseGroup = { theory?: any; lab?: any };

/**
 * Split the flat `courses[]` VTOP returns into theory/lab halves per course code.
 *
 * A component is lab when VTOP says so, or — as the scraper's own heuristic does — when
 * its slot starts with `L`. `component` travels with every contribution because the two
 * halves of an embedded course carry the same course code and frequently the same
 * assessment titles; without it their statistics merge.
 */
const buildMap = (marksData: any): Map<string, CourseGroup> => {
  const map = new Map<string, CourseGroup>();
  if (!marksData?.courses || !Array.isArray(marksData.courses)) return map;

  marksData.courses.forEach((c: any) => {
    if (!c || typeof c !== "object") return;
    const code = String(c.courseCode || "");
    if (!code) return;

    const type = String(c.courseType || "").toLowerCase();
    const slot = String(c.slot || "").toLowerCase();
    const isLab = type.includes("lab") || slot.startsWith("l");

    const group = map.get(code) ?? {};
    if (isLab) group.lab = c;
    else group.theory = c;
    map.set(code, group);
  });

  return map;
};

/** Push one contribution, collapsing a no-op so the server does no needless work. */
function push(
  out: any[],
  classId: string,
  scope: "overall" | "assessment",
  component: string,
  title: string,
  mark: number,
  prev: number | null
) {
  if (!classId) return;
  if (!Number.isFinite(mark) || mark <= 0) return;
  // Re-sending an unchanged value would make the server do a remove-then-add of the
  // same number. Harmless, but it is a write we do not need to make.
  if (prev !== null && Math.abs(prev - mark) < 1e-9) return;

  out.push({
    classId,
    scope,
    component,
    title,
    mark,
    prevMark: prev,
  });
}

export const syncMarksDiff = async (oldMarksData: any, newMarksData: any) => {
  if (!newMarksData?.courses) return;

  try {
    const oldMap = buildMap(oldMarksData);
    const newMap = buildMap(newMarksData);
    const contributions: any[] = [];

    newMap.forEach((newGroup, courseCode) => {
      const oldGroup = oldMap.get(courseCode) ?? {};

      // Both halves report under the theory component's class id, which is what the
      // reader looks the course up by too.
      const classId = String(newGroup.theory?.classNbr || newGroup.lab?.classNbr || "");
      if (!classId) return;

      push(
        contributions,
        classId,
        "overall",
        "",
        "",
        overallPct(newGroup),
        oldGroup.theory || oldGroup.lab ? overallPct(oldGroup) : null
      );

      for (const component of ["theory", "lab"] as const) {
        const fresh = newGroup[component]?.assessments;
        if (!Array.isArray(fresh)) continue;

        const stale = new Map<string, any>(
          (oldGroup[component]?.assessments ?? []).map((a: any) => [
            String(a?.title ?? ""),
            a,
          ])
        );

        for (const asm of fresh) {
          const title = String(asm?.title ?? "");
          if (!title) continue;

          const previous = stale.get(title);
          push(
            contributions,
            classId,
            "assessment",
            component,
            title,
            assessmentPct(asm),
            previous ? assessmentPct(previous) : null
          );
        }
      }
    });

    if (contributions.length === 0) return;

    const res = (await api("marks/sync", {
      method: "POST",
      body: { contributions },
      auth: "vtop",
      parse: "raw",
    })) as Response;

    if (!res.ok) {
      // 401 here means the VTOP session went stale between the marks fetch and this
      // call. The caller already has a live session in hand — the marks fetch used it
      // moments ago — so a failure here is logged and dropped rather than surfaced.
      // Nothing is lost: the next sync recomputes from the marks snapshot.
      console.warn("marks/sync rejected:", res.status);
    }
  } catch (e) {
    console.error("Error during background marks sync:", e);
  }
};