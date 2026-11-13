/**
 * VTOP course-page resolution cache — one entry per semester.
 *
 * `processViewStudentCourseDetail` needs the (erpId, classId) pair derived
 * from the sync's own attendance payload, so "resolution" is local work —
 * but persisting it keeps the retry path trivially simple and lets
 * `invalidateClass` drop a poisoned entry when the server errors out.
 */

export interface VtopResolved {
  /** Kept for shape compatibility; the view-detail AJAX ignores it. */
  slotId: string;
  faculty: string;
  erpId: string;
}

interface ClassResolution {
  /** The derived (slotId/faculty/erpId) triple for this class. */
  resolved?: VtopResolved;
  updatedAt: number;
}

export interface VtopSemesterCache {
  [classId: string]: ClassResolution;
}

/** Two weeks — long enough to make a semester's triples static, short enough to self-heal. */
export const DROPDOWN_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const keyOf = (semSubId: string) => `vtopCoursePage:${String(semSubId ?? "").trim() || "current"}`;

function readSemester(semSubId: string): VtopSemesterCache {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(keyOf(semSubId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeSemester(semSubId: string, data: VtopSemesterCache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(keyOf(semSubId), JSON.stringify(data));
  } catch {
    /* quota or serialization failure — cache is best-effort */
  }
}

function classEntry(semSubId: string, classId: string): ClassResolution | undefined {
  const entry = readSemester(semSubId)[classId];
  if (!entry) return undefined;
  if (entry.updatedAt && Date.now() - entry.updatedAt > DROPDOWN_CACHE_TTL_MS) return undefined;
  return entry;
}

export function getResolvedSlot(semSubId: string, classId: string): VtopResolved | null {
  return classEntry(semSubId, classId)?.resolved ?? null;
}

export function setResolvedSlot(semSubId: string, classId: string, resolved: VtopResolved): void {
  const all = readSemester(semSubId);
  const prev: ClassResolution = all[classId] ?? { updatedAt: Date.now() };
  all[classId] = {
    ...prev,
    resolved,
    updatedAt: Date.now(),
  };
  writeSemester(semSubId, all);
}

/** Drop everything we know about one class — used when the server errors. */
export function invalidateClass(semSubId: string, classId: string): void {
  const all = readSemester(semSubId);
  if (!all[classId]) return;
  delete all[classId];
  writeSemester(semSubId, all);
}

/** Drop one semester's cache. Mostly for tests and "reload from VTOP" paths. */
export function clearSemesterDropdowns(semSubId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyOf(semSubId));
  } catch {
    /* ignore */
  }
}
