import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { AddedCourse, ParsedCourse, TimetableState } from "@/components/custom/exams/FFCS/types";
import { GLOBAL_CAMPUS } from "@/lib/campusSchema";
import {
  getFFCSSemester,
  getFFCSSemesterByClassIdPrefix,
  type FFCSSemesterId,
} from "@/components/custom/exams/FFCS/reports";

/**
 * Share links: one timetable, compressed into the URL itself.
 *
 * ## Why the URL carries everything
 *
 * A static export has no server to hold a share id, and a link that needs one
 * is a link that dies with its host. Compressing the plan into the path means
 * a shared link works forever, offline, for anyone — and the payload is the
 * same local-first data the planner already keeps in this browser.
 *
 * ## What travels, and what does not
 *
 * Only the week being shared: its name and its placed courses, field-picked
 * down to what the grid needs. Not the student's other timetables, not their
 * friends, not their locks, not metrics (the receiver recomputes those from
 * the courses against the schema in the payload). A share link is an
 * invitation to look at one plan, not an export of the planner.
 *
 * ## Versioning
 *
 * `v` is checked exactly, and a mismatch decodes to `null` rather than a best
 * guess: this payload renders a timetable, and a timetable half-understood
 * (which field means what) is worse than a link that says "can't read this".
 * Bump {@link FFCS_SHARE_VERSION} whenever the wire shape changes and old
 * links should stop parsing rather than misparse.
 */

export const FFCS_SHARE_VERSION = 1;

/**
 * URL length past which WhatsApp/QR encoders start mangling links.
 *
 * Not a hard limit — the decode side takes whatever arrives — but a warning
 * the sender deserves: past this, "why didn't my friend's link work" becomes
 * the likeliest support question.
 */
export const FFCS_SHARE_WARN_LENGTH = 8000;

interface ShareWire {
  v: number;
  /** Campus whose schema the plan was built against. */
  c: string;
  n: string;
  k: AddedCourse[];
}

export interface CompactShareWire {
  v: number;
  s: FFCSSemesterId;
  p: string;
  i: string[];
  n: string;
}

/** Decoded name-free timetable share: semester is inferred from the ID namespace. */
export interface TimetableShapeShareData {
  semesterId: FFCSSemesterId;
  classIds: string[];
}

/** Known fields only — a course from a future version travels as what it is. */
function asCourse(raw: unknown): AddedCourse | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.code !== "string" || c.code.length === 0) return null;
  if (!Array.isArray(c.slots) || !c.slots.every((s) => typeof s === "string")) return null;
  return {
    id: typeof c.id === "string" && c.id ? c.id : `share-${c.code}`,
    code: c.code,
    title: typeof c.title === "string" ? c.title : "",
    slots: c.slots as string[],
    faculty: typeof c.faculty === "string" ? c.faculty : "",
    ...(typeof c.classId === "string" && c.classId ? { classId: c.classId } : {}),
    ...(Array.isArray(c.classIds) && c.classIds.every((id) => typeof id === "string")
      ? { classIds: c.classIds as string[] }
      : {}),
    venue: typeof c.venue === "string" ? c.venue : "",
    credits: typeof c.credits === "string" ? c.credits : "",
    type: typeof c.type === "string" ? c.type : "",
    color: typeof c.color === "string" ? c.color : "",
    ...(typeof c.batch === "string" ? { batch: c.batch } : {}),
  };
}

function commonPrefix(values: readonly string[]): string {
  if (!values.length) return "";
  let prefix = values[0];
  for (const value of values.slice(1)) {
    let length = 0;
    while (length < prefix.length && length < value.length && prefix[length] === value[length]) {
      length++;
    }
    prefix = prefix.slice(0, length);
    if (!prefix) break;
  }
  return prefix;
}

function normalizedSlots(slots: readonly string[]): string {
  return slots.map((slot) => slot.trim().toUpperCase()).filter(Boolean).sort().join("+");
}

function normalizedFacultyName(name: string): string {
  return name
    .trim()
    .replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase();
}

function normalizedCourseFamily(code: string): string {
  return code.trim().toUpperCase().replace(/[LP]$/, "");
}

function rowSlotSet(course: ParsedCourse): Set<string> {
  return new Set(normalizedSlots(course.SLOT.split("+")).split("+").filter(Boolean));
}

/** Find a unique set of report rows that exactly covers one added course. */
function resolveReportClassIds(
  course: AddedCourse,
  reportCourses: readonly ParsedCourse[]
): string[] | null {
  const targetSlots = new Set(normalizedSlots(course.slots).split("+").filter(Boolean));
  if (targetSlots.size === 0) return null;

  const anchoredIds = Array.from(new Set(
    (course.classIds?.length ? course.classIds : course.classId ? [course.classId] : [])
      .map((id) => id.trim())
      .filter(Boolean)
  ));
  let candidates = reportCourses.filter((row) => {
    if (!row.CLASS_ID?.trim()) return false;
    if (normalizedCourseFamily(row.CODE) !== normalizedCourseFamily(course.code)) return false;
    const slots = rowSlotSet(row);
    return slots.size > 0 && [...slots].every((slot) => targetSlots.has(slot));
  });

  if (anchoredIds.some((id) => !candidates.some((row) => row.CLASS_ID?.trim() === id))) {
    return null;
  }

  const facultyParts = course.faculty.split("/").map(normalizedFacultyName).filter(Boolean);
  if (facultyParts.length > 0) {
    const facultyMatches = candidates.filter((row) =>
      facultyParts.includes(normalizedFacultyName(row.FACULTY))
    );
    if (facultyMatches.length > 0 && anchoredIds.every((id) =>
      facultyMatches.some((row) => row.CLASS_ID?.trim() === id)
    )) candidates = facultyMatches;
  }

  const covers: string[][] = [];
  let explored = 0;
  const visit = (start: number, covered: Set<string>, selected: string[]) => {
    if (covers.length > 1 || ++explored > 10000) return;
    if ([...targetSlots].every((slot) => covered.has(slot))) {
      if (anchoredIds.every((id) => selected.includes(id))) covers.push(selected);
      return;
    }

    for (let index = start; index < candidates.length; index++) {
      const row = candidates[index];
      const classId = row.CLASS_ID!.trim();
      if (selected.includes(classId)) continue;
      const slots = rowSlotSet(row);
      if ([...slots].some((slot) => covered.has(slot))) continue;
      const nextCovered = new Set(covered);
      slots.forEach((slot) => nextCovered.add(slot));
      visit(index + 1, nextCovered, [...selected, classId]);
      if (covers.length > 1) return;
    }
  };
  visit(0, new Set(), []);

  return covers.length === 1 ? covers[0] : null;
}

/**
 * Fill missing/stale class IDs only from a unique exact offering in the
 * currently selected registration report. This lets pasted VTOP courses use
 * compact links while ensuring the receiver can resolve every ID from the
 * same semester's public report.
 */
export function attachReportClassIds(
  timetable: Pick<TimetableState, "name" | "courses">,
  reportCourses: readonly ParsedCourse[],
  preserveUnmatchedClassIds = false
): Pick<TimetableState, "name" | "courses"> {
  return {
    name: timetable.name,
    courses: timetable.courses.map((course) => {
      const classIds = resolveReportClassIds(course, reportCourses);
      if (classIds) return { ...course, classId: classIds[0], classIds };
      if (preserveUnmatchedClassIds) return course;
      return { ...course, classId: undefined, classIds: undefined };
    }),
  };
}

/**
 * A compact report-backed format: transmit only the shared class-id prefix and
 * each selected class-id suffix. Returns null when the plan has no complete,
 * unique report IDs or they do not share a useful prefix.
 */
export function encodeCompactTimetableShare(
  timetable: Pick<TimetableState, "name" | "courses">,
  semester: FFCSSemesterId
): string | null {
  const idsByCourse = timetable.courses.map((course) =>
    (course.classIds?.length ? course.classIds : course.classId ? [course.classId] : [])
      .map((id) => id.trim())
      .filter(Boolean)
  );
  if (idsByCourse.some((ids) => ids.length === 0)) return null;
  const classIds = idsByCourse.flat();
  if (new Set(classIds).size !== classIds.length) return null;
  const prefix = commonPrefix(classIds);
  if (prefix.length < 4) return null;
  const wire: CompactShareWire = {
    v: FFCS_SHARE_VERSION,
    s: semester,
    p: prefix,
    i: classIds.map((id) => id.slice(prefix.length)),
    n: timetable.name,
  };
  return compressToEncodedURIComponent(JSON.stringify(wire));
}

/**
 * Encode the shortest report-backed form: only the common class-ID prefix and
 * each ID suffix are carried. The `q` URL parameter identifies this wire shape,
 * so neither a timetable name, semester key, nor JSON version field is needed.
 */
export function encodeTimetableShapeShare(
  timetable: Pick<TimetableState, "name" | "courses">,
  semester: FFCSSemesterId
): string | null {
  const reportPrefix = getFFCSSemester(semester).classIdPrefix;
  if (!reportPrefix) return null;

  const idsByCourse = timetable.courses.map((course) =>
    (course.classIds?.length ? course.classIds : course.classId ? [course.classId] : [])
      .map((id) => id.trim())
      .filter(Boolean)
  );
  const classIds = idsByCourse.flat();
  if (
    idsByCourse.some((ids) => ids.length === 0) ||
    classIds.length === 0 ||
    classIds.some((id) => !/^[A-Za-z0-9_-]+$/.test(id) || !id.startsWith(reportPrefix)) ||
    new Set(classIds).size !== classIds.length
  ) return null;

  const prefix = commonPrefix(classIds);
  if (!prefix.startsWith(reportPrefix)) return null;
  return compressToEncodedURIComponent(JSON.stringify({
    p: prefix,
    i: classIds.map((id) => id.slice(prefix.length)),
  }));
}

/** Decode a name-free link and infer its report from the class-ID namespace. */
export function decodeTimetableShapeShare(encoded: string): TimetableShapeShareData | null {
  if (!encoded) return null;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const raw: unknown = JSON.parse(json);
    if (!raw || typeof raw !== "object") return null;
    const wire = raw as Record<string, unknown>;
    if (
      typeof wire.p !== "string" ||
      wire.p.length < 4 ||
      wire.p.length > 100 ||
      !/^[A-Za-z0-9_-]+$/.test(wire.p) ||
      !Array.isArray(wire.i) ||
      wire.i.length === 0 ||
      wire.i.length > 100 ||
      !wire.i.every((suffix) =>
        typeof suffix === "string" &&
        suffix.length <= 100 &&
        /^[A-Za-z0-9_-]*$/.test(suffix)
      )
    ) return null;

    const report = getFFCSSemesterByClassIdPrefix(wire.p);
    if (!report?.classIdPrefix) return null;
    const classIds = (wire.i as string[]).map((suffix) => `${wire.p}${suffix}`);
    if (
      classIds.some((id) => !id.startsWith(report.classIdPrefix!)) ||
      new Set(classIds).size !== classIds.length
    ) return null;
    return { semesterId: report.id, classIds };
  } catch {
    return null;
  }
}

/** Decode and validate the compact report-backed payload before fetching its semester data. */
export function decodeCompactTimetableShare(encoded: string): CompactShareWire | null {
  if (!encoded) return null;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const raw: unknown = JSON.parse(json);
    if (!raw || typeof raw !== "object") return null;
    const wire = raw as Record<string, unknown>;
    if (
      wire.v !== FFCS_SHARE_VERSION ||
      (wire.s !== "winter-2026-2027" && wire.s !== "previous") ||
      typeof wire.p !== "string" ||
      wire.p.length < 4 ||
      wire.p.length > 100 ||
      !/^[A-Za-z0-9_-]+$/.test(wire.p) ||
      typeof wire.n !== "string" ||
      wire.n.length > 120 ||
      !Array.isArray(wire.i) ||
      wire.i.length === 0 ||
      wire.i.length > 100 ||
      !wire.i.every(
        (suffix) =>
          typeof suffix === "string" &&
          suffix.length <= 100 &&
          /^[A-Za-z0-9_-]*$/.test(suffix)
      ) ||
      new Set(wire.i).size !== wire.i.length
    ) {
      return null;
    }
    return {
      v: FFCS_SHARE_VERSION,
      s: wire.s as FFCSSemesterId,
      p: wire.p,
      i: wire.i as string[],
      n: wire.n,
    };
  } catch {
    return null;
  }
}

/** Compresses one timetable into the `d=` parameter of a share URL. */
export function encodeTimetableShare(
  timetable: Pick<TimetableState, "name" | "courses">,
  campus: string = GLOBAL_CAMPUS
): string {
  const wire: ShareWire = {
    v: FFCS_SHARE_VERSION,
    c: campus,
    n: timetable.name,
    k: timetable.courses,
  };
  return compressToEncodedURIComponent(JSON.stringify(wire));
}

/**
 * Inverse of {@link encodeTimetableShare}, validating every field.
 *
 * Returns null for anything unreadable — tampered, truncated, or written by
 * a version this one does not understand. The timetable gets a fresh id on
 * the way out so importing a shared plan twice yields two plans, not a
 * silent overwrite.
 */
export function decodeTimetableShare(
  encoded: string
): { timetable: TimetableState; campus: string } | null {
  if (!encoded) return null;
  let wire: unknown;
  try {
    const json = decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    wire = JSON.parse(json);
  } catch {
    return null;
  }
  if (!wire || typeof wire !== "object") return null;
  const w = wire as Record<string, unknown>;
  if (w.v !== FFCS_SHARE_VERSION) return null;
  if (typeof w.n !== "string" || !Array.isArray(w.k)) return null;

  const courses = w.k.map(asCourse).filter((c): c is AddedCourse => c !== null);
  if (courses.length === 0) return null;

  return {
    timetable: {
      id: `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: w.n,
      courses,
    },
    campus: typeof w.c === "string" && w.c ? w.c : GLOBAL_CAMPUS,
  };
}

/**
 * The full URL for an encoded plan.
 *
 * Honours `NEXT_PUBLIC_BASE_PATH` because the same static build can land at a
 * domain root or under `/<repo>/` on GitHub Pages — a link built from
 * `origin` alone silently 404s in the second case.
 */
export function buildShareUrl(encoded: string, origin: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
  const host = origin.replace(/\/+$/, "");
  return `${host}${base}/share/ffcs/?d=${encodeURIComponent(encoded)}`;
}

/** URL for the compact, class-id-only share payload. */
export function buildCompactShareUrl(encoded: string, origin: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
  const host = origin.replace(/\/+$/, "");
  return `${host}${base}/share/ffcs/?x=${encodeURIComponent(encoded)}`;
}

/** URL for the name-free timetable-shape payload. */
export function buildTimetableShapeShareUrl(encoded: string, origin: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");
  const host = origin.replace(/\/+$/, "");
  return `${host}${base}/share/ffcs/?q=${encodeURIComponent(encoded)}`;
}

/** Whether a built link is long enough to warn the sender about. */
export function isOversizedShareLink(url: string): boolean {
  return url.length > FFCS_SHARE_WARN_LENGTH;
}
