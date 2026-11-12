/**
 * VTOP "Course Page View" (`processViewStudentCourseDetail`) fetch + cache.
 *
 * The course subpage wants this payload (lecture plan + teacher-uploaded
 * reference materials + syllabus params) for every current-semester course.
 * Fetching it on demand costs 4-6 VTOP round trips per course, so the sync
 * sweep caches one entry per class (`coursePageView` in storage.cache) and the
 * page reads the cache; a manual reload button forces a refresh.
 *
 * The transport is injected (`CoursePageApiCall`) so both the sync engine
 * (ctx.request, `auth: "vtop"` — cookies from the credential manager) and UI
 * (the `api()` helper with the page's creds) share one code path.
 */

import { storage } from "./storage";
import {
  getFacultyOptions,
  getResolvedSlot,
  getSlotOptions,
  invalidateClass,
  setFacultyOptions,
  setResolvedSlot,
  setSlotOptions,
  type VtopDropdownOption,
} from "./vtopCoursePage";

export const COURSE_PAGE_VIEW_CACHE_KEY = "coursePageView";
export const COURSE_PAGE_VIEW_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export interface CoursePageViewCache {
  semesterId: string;
  fetchedAt: number;
  /** Keyed by classId (the VTOP class number, e.g. CH2026270100036). */
  courses: Record<string, unknown>;
}

export const normToken = (s: string): string =>
  String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export function parseSelectOptions(d: any, name: string): VtopDropdownOption[] {
  const opts = d?.results?.selectOptions?.[name] ?? d?.selectOptions?.[name] ?? [];
  return Array.isArray(opts) ? opts.filter((o: any) => o && String(o.value ?? "").trim() !== "") : [];
}

export function matchOption(opts: VtopDropdownOption[], wanted: string): VtopDropdownOption | null {
  const w = normToken(wanted);
  if (!w) return opts[0] ?? null;
  return (
    opts.find((o) => normToken(o.text) === w) ||
    opts.find((o) => {
      const t = normToken(o.text);
      return t && (t.startsWith(w) || w.startsWith(t) || t.includes(w) || w.includes(t));
    }) ||
    opts.find((o) => o.selected) ||
    opts[0] ||
    null
  );
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
  slotId: string;
  faculty: string;
  erpId: string;
}

/**
 * Resolve the dropdown semantics for one course component.
 *
 * Persisted per semester in `vtopCoursePage` — warm caches never see the
 * network. Pass `fresh: true` to bypass both cache tiers (the error path).
 */
export async function resolveVtopDropdowns(
  call: CoursePageApiCall,
  semSubId: string,
  comp: CourseCompInput,
  opts?: { fresh?: boolean },
): Promise<ResolvedDropdowns> {
  const classId = String(comp.classNbr ?? "");
  const slotLabel = String(comp.slot ?? "");

  if (!opts?.fresh) {
    const stored = getResolvedSlot(semSubId, classId, slotLabel);
    if (stored) return stored;
  }

  // 1. Slot options — usually already cached for this semester.
  let slotOptions = opts?.fresh ? null : getSlotOptions(semSubId, classId);
  if (!slotOptions) {
    try {
      const d = await call({ semesterSubId: semSubId, courseCode: classId });
      slotOptions = parseSelectOptions(d, "slotId");
      if (slotOptions.length > 0) setSlotOptions(semSubId, classId, slotOptions);
    } catch (e) {
      console.error("slotId resolution failed (continuing with raw slot):", e);
      slotOptions = [];
    }
  }
  const slotMatch = matchOption(slotOptions, slotLabel);
  const slotId = slotMatch?.value ? String(slotMatch.value) : slotLabel;

  // 2. Faculty options for the resolved slot.
  let facultyOptions = opts?.fresh ? null : getFacultyOptions(semSubId, classId, slotId);
  if (!facultyOptions) {
    try {
      const d = await call({ semesterSubId: semSubId, courseCode: classId, slotId });
      facultyOptions = parseSelectOptions(d, "faculty");
      if (facultyOptions.length > 0) setFacultyOptions(semSubId, classId, slotId, facultyOptions);
    } catch (e) {
      console.error("faculty resolution failed (continuing with raw faculty):", e);
      facultyOptions = [];
    }
  }
  const facultyMatch = matchOption(facultyOptions, comp.faculty ?? "");
  const faculty = facultyMatch?.value ? String(facultyMatch.value) : String(comp.faculty ?? "");
  const erpId = facultyMatch?.value
    ? String(facultyMatch.value)
    : String(
        String(comp.faculty ?? "")
          .split("-")[0]
          ?.trim() ??
          comp.faculty ??
          "",
      );

  const resolved: ResolvedDropdowns = { slotId, faculty, erpId };
  setResolvedSlot(semSubId, classId, slotLabel, resolved);
  return resolved;
}

/**
 * Fetch the view-detail payload for one course component.
 * Retries once with a freshly computed dropdown when the server errors out —
 * the cached dropdown may be stale, but this keeps one bad call from sinking
 * the whole sync.
 */
export async function fetchViewDetailForComp(
  call: CoursePageApiCall,
  semSubId: string,
  comp: CourseCompInput,
  opts?: { fresh?: boolean },
): Promise<any> {
  const classId = String(comp.classNbr ?? "");
  let d: any = null;
  try {
    const resolved = await resolveVtopDropdowns(call, semSubId, comp, opts);
    d = await call({
      viewDetail: "true",
      semSubId,
      erpId: resolved.erpId,
      classId,
      slotId: resolved.slotId,
      faculty: resolved.faculty,
    });
  } catch (e) {
    d = null;
  }

  if (!d || d.success === false || d.error) {
    invalidateClass(semSubId, classId);
    try {
      const resolved = await resolveVtopDropdowns(call, semSubId, comp, { fresh: true });
      d = await call({
        viewDetail: "true",
        semSubId,
        erpId: resolved.erpId,
        classId,
        slotId: resolved.slotId,
        faculty: resolved.faculty,
      });
    } catch (e) {
      d = null;
    }
  }

  if (d && d.success !== false && d.results) return d.results;
  return null;
}
