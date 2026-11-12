/**
 * VTOP course-page dropdown cache — one entry per semester.
 *
 * The VTOP "Student Course Page" forces every client through the same
 * dropdown chain: semester -> courses -> a slot for a course -> faculty for a
 * (course, slot) pair. Those lists are static for the life of a semester, so
 * we persist them under a single per-semester key and only go to the network
 * when something is missing — and when the server errors out, we drop the
 * class's entry so the next attempt rebuilds it from the live dropdown.
 */

export interface VtopDropdownOption {
  value: string;
  text: string;
  selected?: boolean;
}

export interface VtopResolved {
  slotId: string;
  faculty: string;
  erpId: string;
}

interface ClassDropdowns {
  slotOptions?: VtopDropdownOption[];
  /** Keyed by the resolved slotId — faculty lists are slot-specific. */
  facultyBySlot?: Record<string, VtopDropdownOption[]>;
  /** Keyed by the raw slot label from the attendance sync ("B1+TB1"). */
  resolvedBySlotLabel?: Record<string, VtopResolved>;
  updatedAt: number;
}

export interface VtopSemesterCache {
  [classId: string]: ClassDropdowns;
}

/** Two weeks — long enough to make a semester static, short enough to self-heal. */
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

function classEntry(semSubId: string, classId: string): ClassDropdowns | undefined {
  const entry = readSemester(semSubId)[classId];
  if (!entry) return undefined;
  if (entry.updatedAt && Date.now() - entry.updatedAt > DROPDOWN_CACHE_TTL_MS) return undefined;
  return entry;
}

export function getSlotOptions(semSubId: string, classId: string): VtopDropdownOption[] | null {
  return classEntry(semSubId, classId)?.slotOptions ?? null;
}

export function setSlotOptions(semSubId: string, classId: string, slotOptions: VtopDropdownOption[]): void {
  const all = readSemester(semSubId);
  const prev = all[classId] ?? {};
  all[classId] = { ...prev, slotOptions, updatedAt: Date.now() };
  writeSemester(semSubId, all);
}

export function getFacultyOptions(semSubId: string, classId: string, slotId: string): VtopDropdownOption[] | null {
  return classEntry(semSubId, classId)?.facultyBySlot?.[slotId] ?? null;
}

export function setFacultyOptions(
  semSubId: string,
  classId: string,
  slotId: string,
  facultyOptions: VtopDropdownOption[],
): void {
  const all = readSemester(semSubId);
  const prev: ClassDropdowns = all[classId] ?? { updatedAt: Date.now() };
  all[classId] = {
    ...prev,
    facultyBySlot: { ...(prev.facultyBySlot ?? {}), [slotId]: facultyOptions },
    updatedAt: Date.now(),
  };
  writeSemester(semSubId, all);
}

export function getResolvedSlot(semSubId: string, classId: string, slotLabel: string): VtopResolved | null {
  return classEntry(semSubId, classId)?.resolvedBySlotLabel?.[slotLabel] ?? null;
}

export function setResolvedSlot(semSubId: string, classId: string, slotLabel: string, resolved: VtopResolved): void {
  const all = readSemester(semSubId);
  const prev: ClassDropdowns = all[classId] ?? { updatedAt: Date.now() };
  all[classId] = {
    ...prev,
    resolvedBySlotLabel: { ...(prev.resolvedBySlotLabel ?? {}), [slotLabel]: resolved },
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
