/**
 * Canonical Course & Component Classifier.
 *
 * Single source of truth for:
 * - Determining whether a course/session is a Lab vs Theory
 * - Sanitizing course codes and course titles
 * - Extracting component types
 */

export type CourseComponent = "theory" | "lab";

export interface CourseLike {
  courseCode?: string;
  courseTitle?: string;
  courseType?: string;
  componentType?: string;
  slotName?: string;
  slot?: string;
}

/**
 * Robustly checks if a course or slot represents a laboratory session.
 * Consolidates the 6 previously conflicting heuristics across the codebase.
 */
export function isLabCourse(course: CourseLike | null | undefined): boolean {
  if (!course) return false;

  // 1. Explicit componentType enum
  if (course.componentType) {
    const ct = course.componentType.toLowerCase();
    if (ct === "lab" || ct === "practical") return true;
    if (ct === "theory") return false;
  }

  // 2. Course type string (e.g. "Embedded Lab", "Lab Only", "Practical")
  if (course.courseType) {
    const t = course.courseType.toLowerCase();
    if (t.includes("lab") || t.includes("practical") || t.includes("project")) {
      return true;
    }
    if (t.includes("theory") && !t.includes("embedded")) {
      return false;
    }
  }

  // 3. Slot name (e.g. "L1+L2", "L31+L32"). Exclude special slots like "LT1" or "LEX"
  const slotStr = (course.slotName || course.slot || "").trim().toUpperCase();
  if (slotStr) {
    if (slotStr.startsWith("L") && !slotStr.startsWith("LT") && !slotStr.startsWith("LAW")) {
      return true;
    }
  }

  return false;
}

/**
 * Returns canonical "theory" | "lab".
 */
export function getComponentType(course: CourseLike | null | undefined): CourseComponent {
  return isLabCourse(course) ? "lab" : "theory";
}

/**
 * Strips whitespace, junk characters, and normalizes course codes.
 */
export function sanitizeCourseCode(code: unknown): string {
  if (typeof code !== "string") return "";
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Cleans up raw VTOP course titles by removing redundant codes,
 * weird trailing dashes, or unescaped HTML artifacts.
 */
export function sanitizeCourseTitle(title: unknown, fallbackCode = ""): string {
  if (typeof title !== "string") return fallbackCode;
  const cleaned = title
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned || fallbackCode;
}
