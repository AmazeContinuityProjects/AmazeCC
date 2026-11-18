/**
 * Universal Course & Faculty Normalizer for AmazeCC.
 *
 * Ingests disparate course representations (Attendance, Marks, FFCS, Timetable,
 * Social, and Exams) and outputs unified, memory-efficient canonical objects:
 * `NormalizedCourse` and `NormalizedFaculty`.
 */

import type { NormalizedCourse, CourseComponentType } from "@/types/course";
import type { NormalizedFaculty, FacultyRating } from "@/types/faculty";
import { sanitizeCourseCode, sanitizeCourseTitle, isLabCourse } from "@/lib/courseClassifier";
import { getInitials } from "@/lib/textUtils";

const KNOWN_VIT_SCHOOLS = new Set([
  "SAS",
  "SCOPE",
  "SELECT",
  "SENSE",
  "SITE",
  "SMEC",
  "SSL",
  "VITSOL",
  "VITBS",
  "SCHEME",
  "HOT",
  "SCSE",
  "VAIAL",
  "SHSS",
  "DS",
  "SEEE",
  "SET",
  "CORE",
  "SCA",
  "CBST",
  "VFSTR",
  "CNE",
  "COE",
]);

/**
 * Normalizes any raw faculty string or object into a canonical `NormalizedFaculty`.
 */
export function normalizeFaculty(
  rawFaculty?: string | null | { name?: string; raw?: string; employeeId?: string; school?: string },
  rating?: FacultyRating | null,
): NormalizedFaculty {
  const rawString = typeof rawFaculty === "string" ? rawFaculty : rawFaculty?.raw || rawFaculty?.name || "";

  if (!rawString || !rawString.trim()) {
    return {
      raw: "",
      name: "",
      title: null,
      employeeId: typeof rawFaculty === "object" ? rawFaculty?.employeeId || null : null,
      school: typeof rawFaculty === "object" ? rawFaculty?.school || null : null,
      department: null,
      initials: "",
      rating: rating || null,
    };
  }

  let str = rawString.trim();
  let employeeId: string | null =
    typeof rawFaculty === "object" && rawFaculty?.employeeId ? rawFaculty.employeeId : null;
  let school: string | null = typeof rawFaculty === "object" && rawFaculty?.school ? rawFaculty.school : null;
  let department: string | null = null;
  let title: string | null = null;

  // 1. Extract Employee ID if string starts with digits (e.g. "50772 NATHIYA..." or "50772 - NATHIYA...")
  const startEmpMatch = str.match(/^(\d{3,7})\s*[-–—]?\s*(.*)$/);
  if (startEmpMatch) {
    if (!employeeId) employeeId = startEmpMatch[1];
    str = startEmpMatch[2].trim();
  }

  // 2. Extract Department or School from hyphenated suffix ("DR. JOHN DOE - SCOPE")
  const lastHyphenIdx = Math.max(str.lastIndexOf(" - "), str.lastIndexOf(" – "), str.lastIndexOf(" — "));
  if (lastHyphenIdx !== -1) {
    const after = str.slice(lastHyphenIdx + 3).trim();
    const before = str.slice(0, lastHyphenIdx).trim();
    if (after && before) {
      if (KNOWN_VIT_SCHOOLS.has(after.toUpperCase())) {
        if (!school) school = after.toUpperCase();
      } else {
        department = after;
      }
      str = before;
    }
  }

  // 3. Fallback: check trailing word if it's a known school ("50772 NATHIYA N SAS")
  if (!school) {
    const words = str.split(/\s+/);
    if (words.length > 1) {
      const lastWord = words[words.length - 1].toUpperCase();
      if (KNOWN_VIT_SCHOOLS.has(lastWord)) {
        school = lastWord;
        str = words.slice(0, -1).join(" ").trim();
      }
    }
  }

  // 4. Extract Honorific / Title ("DR.", "PROF.", "MR.", "MS.")
  const titleMatch = str.match(/^(DR\.|PROF\.|MR\.|MS\.|MRS\.)\s+(.*)$/i);
  if (titleMatch) {
    title = titleMatch[1].toUpperCase();
    str = titleMatch[2].trim();
  }

  // Clean name
  const cleanName = str.replace(/\s+/g, " ").trim();
  const initials = getInitials(cleanName) || (cleanName ? cleanName.slice(0, 2).toUpperCase() : "");

  return {
    raw: rawString,
    name: cleanName,
    title,
    employeeId,
    school,
    department,
    initials,
    rating: rating || null,
  };
}

/**
 * Strips component qualifiers like (L), (P), (E), or -L to extract the base course code.
 * e.g. "BACSE102(L)" -> "BACSE102", "BCSE101E" -> "BCSE101E"
 */
export function extractBaseCourseCode(code: string): string {
  if (!code) return "";
  const cleaned = sanitizeCourseCode(code);
  return cleaned.replace(/\s*\([A-Z]\)$/, "").replace(/[-/][LPET]$/, "");
}

/**
 * Resolves full canonical component type from code, type string, and slot.
 */
export function resolveComponentType(rawCode: string, rawType: string, slotDisplay: string): CourseComponentType {
  const t = (rawType || "").toLowerCase();
  const c = (rawCode || "").toUpperCase();

  if (t.includes("embedded lab")) return "Embedded Lab";
  if (t.includes("embedded theory")) return "Embedded Theory";
  if (t.includes("embedded")) {
    return isLabCourse({ courseCode: rawCode, courseType: rawType, slotName: slotDisplay })
      ? "Embedded Lab"
      : "Embedded Theory";
  }
  if (t.includes("lab only") || t === "lab" || t.includes("practical") || c.endsWith("(L)")) return "Lab Only";
  if (t.includes("theory only") || t === "theory") return "Theory Only";
  if (t.includes("project")) return "Project";
  if (t.includes("soft skills")) return "Soft Skills";

  if (isLabCourse({ courseCode: rawCode, courseType: rawType, slotName: slotDisplay })) {
    return "Lab Only";
  }
  return "Theory Only";
}

/**
 * Splits slot representations into an array of atomic slot tokens.
 * Handles "A1+TA1", "L31+L32+L37+L38", "A1 / TA1", or arrays.
 */
export function normalizeSlots(rawSlots?: string | string[] | null): string[] {
  if (!rawSlots) return [];
  if (Array.isArray(rawSlots)) {
    return rawSlots.flatMap((s) => normalizeSlots(s));
  }
  return rawSlots
    .split(/[+/,\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Universal Course Normalizer.
 * Accepts any existing shape (attendance item, parsed CSV course, marks item, exam item,
 * social course, etc.) and returns a canonical `NormalizedCourse`.
 */
export function normalizeCourse(raw: any): NormalizedCourse {
  if (!raw) {
    return {
      id: "unknown",
      code: "",
      baseCode: "",
      title: "",
      componentType: "Other",
      isLab: false,
      isTheory: false,
      isProject: false,
      credits: null,
      ltpjc: null,
      category: null,
      classId: null,
      classIds: [],
      slots: [],
      slotDisplay: "",
      venue: null,
      faculty: normalizeFaculty(""),
      semesterId: null,
    };
  }

  // 1. Extract and sanitize course codes
  const rawCode = (raw.code || raw.CODE || raw.courseCode || raw.course_code || raw.course || "")
    .toString()
    .trim()
    .toUpperCase();

  const baseCode = extractBaseCourseCode(rawCode);

  // 2. Extract and sanitize title
  const rawTitle = (raw.title || raw.TITLE || raw.courseTitle || raw.course_title || raw.name || "").toString();

  const title = sanitizeCourseTitle(rawTitle);

  // 3. Extract and normalize slots
  const rawSlotField = raw.slots || raw.slot || raw.SLOT || raw.slotName || raw.slot_name || "";
  const slots = normalizeSlots(rawSlotField);
  const slotDisplay = slots.join("+");

  // 4. Resolve component type and flags
  const rawType = (raw.componentType || raw.type || raw.TYPE || raw.courseType || raw.course_type || "").toString();

  const componentType: CourseComponentType = resolveComponentType(rawCode, rawType, slotDisplay);
  const isLab = isLabCourse({ courseCode: rawCode, courseType: rawType, slotName: slotDisplay });
  const isTheory = componentType === "Theory Only" || componentType === "Embedded Theory";
  const isProject = componentType === "Project" || /project/i.test(rawType);

  // 5. Extract credits and LTPJC
  let credits: number | null = null;
  if (raw.credits !== undefined && raw.credits !== null) {
    const parsed = Number(raw.credits);
    if (!Number.isNaN(parsed)) credits = parsed;
  } else if (raw.CREDITS !== undefined && raw.CREDITS !== null) {
    const parsed = Number(raw.CREDITS);
    if (!Number.isNaN(parsed)) credits = parsed;
  }

  const ltpjc = raw.ltpjc || raw.LTPJC || null;

  // 6. Extract venue / room
  const venue = raw.venue || raw.ROOM || raw.slotVenue || raw.room || raw.location || null;

  // 7. Extract class IDs
  const classId = raw.classId || raw.CLASS_ID || raw.classNbr || raw.class_id || null;

  let classIds: string[] = [];
  if (Array.isArray(raw.classIds)) {
    classIds = raw.classIds.map(String);
  } else if (Array.isArray(raw.CLASS_IDS)) {
    classIds = raw.CLASS_IDS.map(String);
  } else if (classId) {
    classIds = [String(classId)];
  }

  // 8. Extract and normalize faculty
  const rawFaculty = raw.faculty || raw.FACULTY || raw.facultyDetails || raw.faculty_name || raw.instructor || null;
  const faculty = normalizeFaculty(rawFaculty, raw.facultyRating || raw.rating);

  // 9. Generate stable ID
  const id = classId
    ? String(classId)
    : `${baseCode}${slots.length ? `-${slots.join("_")}` : ""}${faculty.employeeId ? `-${faculty.employeeId}` : ""}`;

  // 10. Extract category and semester
  const category = raw.category || raw.CATEGORY || null;
  const semesterId = raw.semesterId || raw.semester || null;

  // 11. Build canonical course
  const normalized: NormalizedCourse = {
    id,
    code: rawCode || baseCode,
    baseCode,
    title,
    componentType,
    isLab,
    isTheory,
    isProject,
    credits,
    ltpjc,
    category,
    classId: classId ? String(classId) : null,
    classIds,
    slots,
    slotDisplay,
    venue: venue ? String(venue).trim() : null,
    faculty,
    semesterId: semesterId ? String(semesterId) : null,
  };

  // Attach attendance sub-payload if present
  if (raw.attendedClasses !== undefined || raw.totalClasses !== undefined || raw.attendancePercentage !== undefined) {
    const attendedClasses = Number(raw.attendedClasses) || 0;
    const totalClasses = Number(raw.totalClasses) || 0;
    let attendancePercentage = 0;

    if (typeof raw.attendancePercentage === "string") {
      attendancePercentage = parseFloat(raw.attendancePercentage.replace("%", "")) || 0;
    } else if (typeof raw.attendancePercentage === "number") {
      attendancePercentage = raw.attendancePercentage;
    } else if (totalClasses > 0) {
      attendancePercentage = Math.round((attendedClasses / totalClasses) * 10000) / 100;
    }

    const history = Array.isArray(raw.viewLink)
      ? raw.viewLink.map((item: any) => ({
          date: item.date || "",
          status: item.status || "",
          slot: item.slot,
          remarks: item.remarks,
        }))
      : [];

    normalized.attendance = {
      attendedClasses,
      totalClasses,
      attendancePercentage,
      attendancePercentageFormatted: `${attendancePercentage.toFixed(2)}%`,
      history,
      registrationDate: raw.registrationDate,
      lastAttendanceDate: raw.attendanceDate,
    };
  }

  // Attach marks sub-payload if present
  if (Array.isArray(raw.assessments)) {
    const assessments = raw.assessments.map((a: any) => ({
      slNo: a.slNo,
      title: a.title || "",
      maxMark: Number(a.maxMark) || 0,
      weightagePercent: Number(a.weightagePercent) || 0,
      scoredMark:
        a.scoredMark !== null && a.scoredMark !== undefined && a.scoredMark !== "" ? Number(a.scoredMark) : null,
      weightageMark:
        a.weightageMark !== null && a.weightageMark !== undefined && a.weightageMark !== ""
          ? Number(a.weightageMark)
          : null,
      status: a.status || "",
      component: a.component,
    }));

    normalized.marks = {
      classNbr: raw.classNbr,
      courseMode: raw.courseMode,
      courseSystem: raw.courseSystem,
      assessments,
    };
  }

  // Attach exam details if present
  if (raw.examDate || raw.examTime || raw.reportingTime || raw.seatNo) {
    const slotInfo = {
      examName: raw.examSession || "FAT",
      examDate: raw.examDate || "",
      examSession: raw.examSession || "",
      reportingTime: raw.reportingTime || "",
      examTime: raw.examTime || "",
      venue: raw.venue || "",
      seatLocation: raw.seatLocation || "",
      seatNo: raw.seatNo || "",
    };

    normalized.exam = {
      fat: slotInfo,
    };
  }

  // Attach FFCS details if present
  if (raw.color || raw.batch || raw.LINK_ID || raw.linkId || raw.isLocked) {
    normalized.ffcs = {
      color: raw.color,
      batch: raw.batch || raw.BATCH,
      linkId: raw.linkId || raw.LINK_ID,
      isLocked: Boolean(raw.isLocked),
      allowedSlots: raw.allowedSlots,
      allowedFaculty: raw.allowedFaculty,
    };
  }

  return normalized;
}

/**
 * Normalizes an array of raw course objects, deduplicating by ID if required.
 */
export function normalizeCourseList(rawList: any[]): NormalizedCourse[] {
  if (!Array.isArray(rawList)) return [];
  return rawList.map((item) => normalizeCourse(item));
}
