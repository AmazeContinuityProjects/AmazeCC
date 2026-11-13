/**
 * VTOP "Course Page View" (`processViewStudentCourseDetail`) fetch + cache.
 *
 * The course subpage wants this payload (lecture plan + teacher-uploaded
 * reference materials + syllabus params) for every current-semester course.
 * Fetching it costs ~2 VTOP round trips via the API's priming warmers, so the
 * sync sweep caches one entry per class and the page reads the cache; a manual
 * reload button forces a refresh.
 *
 * The one (classId, erpId) pair VTOP's `processViewStudentCourseDetail`
 * accepts is the attendance payload's teacher — live-verified for every class
 * of Fall 2026-27: the attendance teacher's leading-digit erpId gets HTTP 200
 * with the lecture plan, while every option of the praType="source" faculty
 * dropdown gets HTTP 404. `slotId` never reaches the view-detail AJAX (it is
 * only session priming, and priming is not required), so the pipeline sends
 * nothing but `semSubId`, `erpId` and `classId`.
 *
 * The transport is injected (`CoursePageApiCall`) so both the sync engine
 * (ctx.request, `auth: "vtop"` — cookies from the credential manager) and UI
 * (the `api()` helper with the page's creds) share one code path.
 */

import { storage } from "./storage";
import { getResolvedSlot, invalidateClass, setResolvedSlot } from "./vtopCoursePage";

export const COURSE_PAGE_VIEW_CACHE_KEY = "coursePageView";
export const COURSE_PAGE_VIEW_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface CoursePageViewCache {
  semesterId: string;
  fetchedAt: number;
  /** Keyed by classId (the VTOP class number, e.g. CH2026270100036). */
  courses: Record<string, unknown>;
}

// --- cache helpers ----------------------------------------------------------

export function readCoursePageViewCache(semSubId: string): CoursePageViewCache | null {
  try {
    const raw = storage.cache.get(COURSE_PAGE_VIEW_CACHE_KEY) as CoursePageViewCache | null;
    if (!raw || typeof raw !== "object" || raw.semesterId !== semSubId) return null;
    if (raw.fetchedAt && Date.now() - raw.fetchedAt > COURSE_PAGE_VIEW_TTL_MS) return null;
    if (!raw.courses || typeof raw.courses !== "object") return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeCoursePageViewCache(semSubId: string, courses: Record<string, unknown>): void {
  try {
    storage.cache.set(COURSE_PAGE_VIEW_CACHE_KEY, {
      semesterId: semSubId,
      fetchedAt: Date.now(),
      courses,
    });
  } catch {
    /* best-effort persistence */
  }
}

/** Drop one class's cached view (used by the course page's manual reload). */
export function clearCoursePageViewClass(semSubId: string, classId: string): void {
  try {
    const cache = readCoursePageViewCache(semSubId);
    if (!cache) return;
    const courses = { ...cache.courses };
    delete courses[classId];
    writeCoursePageViewCache(semSubId, courses);
  } catch {
    /* best-effort */
  }
}

// --- fetch pipeline ---------------------------------------------------------

export type CoursePageApiCall = (formData: Record<string, unknown>) => Promise<any>;

export interface CourseCompInput {
  classNbr: string;
  slot?: string;
  faculty?: string;
  courseType?: string;
  courseCode?: string;
  courseTitle?: string;
}

export interface ResolvedDropdowns {
  /** Empty — kept only for cache-shape compatibility; the view-detail AJAX ignores it. */
  slotId: string;
  faculty: string;
  erpId: string;
}

/**
 * The attendance faculty label is the only identity VTOP will serve the
 * student's own course page for: the leading digit run is the teacher's erpId
 * (e.g. "52262 MERCY …" → "52262"). Returns null for labels with no numeric
 * id (APT / elective buckets) — those have no course page to fetch.
 */
export const erpIdFromAttendanceFaculty = (s: unknown): string | null => {
  const m = String(s ?? "").match(/\d{4,}/);
  return m ? m[0] : null;
};

/**
 * Derive the (semSubId, erpId, classId) triple for one component.
 *
 * Nothing hits the network here — the triple is local work from the sync's
 * own attendance payload. Cached per semester for shape compatibility and so
 * the retry path can invalidate cleanly.
 */
export async function resolveVtopDropdowns(
  semSubId: string,
  comp: CourseCompInput,
  opts?: { fresh?: boolean },
): Promise<ResolvedDropdowns | null> {
  const classId = String(comp.classNbr ?? "");
  if (!opts?.fresh) {
    const stored = getResolvedSlot(semSubId, classId);
    if (stored) return stored;
  }
  const faculty = String(comp.faculty ?? "").trim();
  const erpId = erpIdFromAttendanceFaculty(faculty);
  if (!erpId) return null;
  const resolved: ResolvedDropdowns = { slotId: "", faculty, erpId };
  setResolvedSlot(semSubId, classId, resolved);
  return resolved;
}

/**
 * Fetch the view-detail payload for one course component.
 * Sent as just `semSubId` + `erpId` + `classId` — live-verified to be the
 * whole requirement for `processViewStudentCourseDetail`; the extra slotId /
 * faculty fields only drive priming warmers (which VTOP tolerates failing).
 * One retry keeps a transient VTOP blip from sinking the class.
 */
export async function fetchViewDetailForComp(
  call: CoursePageApiCall,
  semSubId: string,
  comp: CourseCompInput,
  opts?: { fresh?: boolean },
): Promise<any> {
  const classId = String(comp.classNbr ?? "");
  const attempt = async () => {
    const resolved = await resolveVtopDropdowns(semSubId, comp, opts);
    if (!resolved) return null;
    return call({ viewDetail: "true", semSubId, erpId: resolved.erpId, classId });
  };

  let d: any = null;
  try {
    d = await attempt();
  } catch {
    d = null;
  }

  if (!d || d.success === false || d.error) {
    invalidateClass(semSubId, classId);
    try {
      d = await attempt();
    } catch {
      d = null;
    }
  }

  if (d && d.success !== false && d.results) return d.results;
  return null;
}
