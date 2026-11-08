/**
 * Exam and Question Paper Categorization Engine
 *
 * Analyzes OCR text from scanned academic papers and extracts structured
 * examination details:
 *
 * 1. Assessment Category:
 *    - FAT (Final Assessment Test / Term End Exam / SEE / End Term)
 *    - CAT 1 (Continuous Assessment Test 1 / CAT-I / Midterm 1)
 *    - CAT 2 (Continuous Assessment Test 2 / CAT-II / Midterm 2)
 *    - Lab FAT (Laboratory Final Assessment Test)
 *    - Supplementary (Arrear / Special / Re-exam)
 *
 * 2. Session (Month & Year):
 *    - Extracts exam month and year (e.g. "May 2024", "November 2026")
 *
 * 3. Academic Semester Deduction:
 *    - Automatically infers academic semester from Month & Year:
 *      • Jan - Jun -> Winter Semester (Even Semester), e.g. "Winter Semester 2023-24"
 *      • Jul - Dec -> Fall Semester (Odd Semester), e.g. "Fall Semester 2024-25"
 *    - Honors explicit mentions if present in the paper header.
 *
 * 4. Academic Metadata:
 *    - Course code (e.g. "BGER101L", "BCSE204L")
 *    - Course title (e.g. "German", "Operating Systems")
 *    - Slot (e.g. "C1", "A1+TA1")
 *    - Class NBR (e.g. "5493")
 *    - Register Number (e.g. "21600019")
 *    - Maximum marks (e.g. 100, 50)
 *    - Time duration (e.g. "Three Hours", "90 Minutes")
 */

import type { ExamCategory, ExamDetails } from "./types";

export const MONTH_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

export const MONTH_DISPLAY: readonly string[] = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Course code pattern: 3-5 letters + 3 digits + optional suffix */
const COURSE_CODE_REGEX = /\b([A-Z]{3,5}[0-9]{3}[A-Z0-9]{0,3})\b/;

export interface InferSemesterOptions {
  /** Explicit hint that this paper belongs to a summer/intersession/weekend term */
  isSummerHint?: boolean;
  /** Explicit term override if extracted from header (e.g. "Winter" | "Fall" | "Summer") */
  explicitTerm?: "Winter" | "Fall" | "Summer";
}

/**
 * Infer semester and academic year from an exam month & year following VIT's academic calendar:
 * - Winter Semester: Dec - April/May (e.g. Dec 2023 -> Winter Semester 2023-24, May 2024 -> Winter Semester 2023-24)
 * - Summer Semester: May - June (e.g. June 2024 -> Summer Semester 2023-24; May with summer hint -> Summer Semester 2023-24)
 * - Fall Semester: July - Nov (e.g. July 2024 -> Fall Semester 2024-25, Nov 2024 -> Fall Semester 2024-25)
 */
export function inferSemesterFromMonthYear(
  monthNum: number,
  year: number,
  options?: InferSemesterOptions,
): { semester: string; shortSemester: string; academicYear: string; term: "Winter" | "Fall" | "Summer" } {
  const isSummer = options?.explicitTerm === "Summer" || Boolean(options?.isSummerHint);

  // 1. Summer Semester: June (month 6) or May (month 5) with summer hint, or explicit Summer term
  if (monthNum === 6 || (monthNum === 5 && isSummer) || options?.explicitTerm === "Summer") {
    const prevYear = year - 1;
    const currShort = String(year).slice(-2);
    const academicYear = `${prevYear}-${currShort}`;
    return {
      semester: `Summer Semester ${academicYear}`,
      shortSemester: `Summer ${academicYear}`,
      academicYear,
      term: "Summer",
    };
  }

  // 2. Winter Semester: December (month 12) starts the Winter Semester of academic year year -> (year + 1)
  // e.g. Dec 2023 -> Winter Semester 2023-24
  if (monthNum === 12 || (options?.explicitTerm === "Winter" && monthNum >= 11)) {
    const currYear = year;
    const nextShort = String(year + 1).slice(-2);
    const academicYear = `${currYear}-${nextShort}`;
    return {
      semester: `Winter Semester ${academicYear}`,
      shortSemester: `Winter ${academicYear}`,
      academicYear,
      term: "Winter",
    };
  }

  // 3. Winter Semester: Jan - April/May (months 1 - 5) continues Winter Semester of academic year (year - 1) -> year
  // e.g. May 2024 -> Winter Semester 2023-24
  if (monthNum >= 1 && monthNum <= 5) {
    const prevYear = year - 1;
    const currShort = String(year).slice(-2);
    const academicYear = `${prevYear}-${currShort}`;
    return {
      semester: `Winter Semester ${academicYear}`,
      shortSemester: `Winter ${academicYear}`,
      academicYear,
      term: "Winter",
    };
  }

  // 4. Fall Semester: July - November (months 7 - 11) of academic year year -> (year + 1)
  // e.g. November 2024 -> Fall Semester 2024-25
  const currYear = year;
  const nextShort = String(year + 1).slice(-2);
  const academicYear = `${currYear}-${nextShort}`;
  return {
    semester: `Fall Semester ${academicYear}`,
    shortSemester: `Fall ${academicYear}`,
    academicYear,
    term: "Fall",
  };
}

/** Clean course title candidate */
function sanitizeTitle(raw: string): string {
  return raw
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/[!?,;]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses OCR text from an exam question paper and returns structured ExamDetails,
 * or null if the document does not show exam characteristics.
 */
export function classifyExamPaper(text: string): ExamDetails | null {
  if (!text || text.trim().length === 0) return null;

  const upper = text.toUpperCase();

  // ── 1. Detect Assessment Category ──
  let category: ExamCategory | null = null;
  let rawExamName = "";

  // Check Lab FAT first
  const labFatMatch = text.match(
    /\b(?:lab(?:oratory)?\s+(?:final\s+assessment\s+test|\bfat\b|exam(?:ination)?)|fat\s+lab|practical\s+exam(?:ination)?)\b/i,
  );
  if (labFatMatch) {
    category = "Lab FAT";
    rawExamName = labFatMatch[0].trim();
  }

  // Check CAT 2 (before CAT 1 to prevent "CAT II" prefix matching "CAT I")
  if (!category) {
    const cat2Match = text.match(
      /\b(?:continuous\s+assessment\s+test|cat|assessment\s+test|internal\s+assessment|mid\s*term|mid\s*sem(?:ester)?)[–\-—\s]*(?:2\b|ii\b|two\b|second\b)|\bcat[\s\-_]*2\b|\bcat2\b/i,
    );
    if (cat2Match) {
      category = "CAT 2";
      rawExamName = cat2Match[0].trim();
    }
  }

  // Check CAT 1
  if (!category) {
    const cat1Match = text.match(
      /\b(?:continuous\s+assessment\s+test|cat|assessment\s+test|internal\s+assessment|mid\s*term|mid\s*sem(?:ester)?)[–\-—\s]*(?:1\b|i\b|one\b|first\b)|\bcat[\s\-_]*1\b|\bcat1\b/i,
    );
    if (cat1Match) {
      category = "CAT 1";
      rawExamName = cat1Match[0].trim();
    }
  }

  // Check FAT
  if (!category) {
    const fatMatch = text.match(
      /\b(?:final\s+assessment\s+test|\bfat\b|term\s+end\s+exam(?:ination)?|\btee\b|semester\s+end\s+exam(?:ination)?|\bsee\b|end\s+term\s+exam(?:ination)?|end\s+semester\s+exam(?:ination)?|final\s+exam(?:ination)?)\b/i,
    );
    if (fatMatch) {
      category = "FAT";
      rawExamName = fatMatch[0].trim();
    }
  }

  // Check Supplementary / Arrear / Re-exam
  if (!category) {
    const suppMatch = text.match(
      /\b(?:supplementary\s+exam(?:ination)?|arrear\s+exam(?:ination)?|re[\s-]?exam(?:ination)?|special\s+assessment\s+test|\bsat\b)\b/i,
    );
    if (suppMatch) {
      category = "Supplementary";
      rawExamName = suppMatch[0].trim();
    }
  }

  // ── 2. Month & Year (Session) ──
  let sessionMonth: string | undefined;
  let sessionYear: number | undefined;
  let monthNum = 0;

  // Pattern: "May 2024", "November 2026", "14-Nov-2026", "May - 2024"
  const monthYearMatch = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)[.\s\-–—,]+((?:20|19)\d\d)\b/i,
  );

  if (monthYearMatch) {
    const mStr = monthYearMatch[1].toLowerCase();
    monthNum = MONTH_MAP[mStr] ?? 0;
    sessionYear = Number.parseInt(monthYearMatch[2], 10);
    sessionMonth = MONTH_DISPLAY[monthNum] || monthYearMatch[1];
  } else {
    // Reverse pattern: "2024 May" or date pattern "14-Nov-2026"
    const dateMatch = text.match(
      /\b\d{1,2}[-\s](jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[-\s]((?:20|19)\d\d)\b/i,
    );
    if (dateMatch) {
      const mStr = dateMatch[1].toLowerCase();
      monthNum = MONTH_MAP[mStr] ?? 0;
      sessionYear = Number.parseInt(dateMatch[2], 10);
      sessionMonth = MONTH_DISPLAY[monthNum] || dateMatch[1];
    }
  }

  const session = sessionMonth && sessionYear ? `${sessionMonth} ${sessionYear}` : undefined;

  // ── 3. Semester Deduction ──
  let semester: string | undefined;
  let shortSemester: string | undefined;
  let academicYear: string | undefined;
  let term: "Winter" | "Fall" | "Summer" | undefined;

  // Check if explicit semester text is in the document
  const explicitSemesterMatch = text.match(
    /\b(winter|fall|spring|summer)\s*(?:semester|sem)?\s*((?:20|19)\d\d\s*[-–—/]\s*(?:\d\d(?:\d\d)?))?\b/i,
  );

  const hasSummerHint = /\b(summer|weekend|intersession)\b/i.test(text);

  if (explicitSemesterMatch) {
    const rawTerm = explicitSemesterMatch[1].toLowerCase();
    term =
      rawTerm.startsWith("win") || rawTerm.startsWith("spr")
        ? "Winter"
        : rawTerm.startsWith("fal") || rawTerm.startsWith("aut")
          ? "Fall"
          : "Summer";

    let rawYear = explicitSemesterMatch[2] ? explicitSemesterMatch[2].replace(/\s+/g, "").replace(/[–—/]/g, "-") : "";
    if (rawYear) {
      // Normalize 2023-2024 to 2023-24
      const parts = rawYear.split("-");
      if (parts.length === 2 && parts[1].length === 4) {
        rawYear = `${parts[0]}-${parts[1].slice(-2)}`;
      }
      academicYear = rawYear;
      semester = `${term} Semester ${academicYear}`;
      shortSemester = `${term} ${academicYear}`;
    }
  }

  // If no explicit semester was found or it lacked an academic year, infer from Month & Year
  if (!semester && monthNum > 0 && sessionYear) {
    const inferred = inferSemesterFromMonthYear(monthNum, sessionYear, {
      isSummerHint: hasSummerHint || term === "Summer",
      explicitTerm: term,
    });
    semester = inferred.semester;
    shortSemester = inferred.shortSemester;
    academicYear = inferred.academicYear;
    term = inferred.term;
  }

  // ── 4. Slot Extraction ──
  // E.g. "Slot: C1", "Slot : A1+TA1", "Slot: L31+L32"
  let slot: string | undefined;
  const slotMatch = text.match(
    /\bslot\s*[:.+=\-–—]*\s*([A-G][12](?:\s*\+\s*T[A-G][12](?:\s*\+\s*T[A-G]{2}[12])?)?|[A-Za-z0-9+]+)/i,
  );
  if (slotMatch) {
    slot = slotMatch[1].replace(/\s+/g, "").toUpperCase();
  }

  // ── 5. Class NBR ──
  // E.g. "Class NBR(s): 5493", "Class No: 1234"
  let classNbr: string | undefined;
  const classMatch = text.match(/\bclass\s*(?:nbr|number|no|#)[(s)]*\s*[:.+=\-–—]*\s*(\d{3,6})\b/i);
  if (classMatch) {
    classNbr = classMatch[1];
  }

  // ── 6. Student Register Number ──
  // E.g. "Reg. No: 21600019", "Reg No: 21BCE1234"
  let regNo: string | undefined;
  const regMatch = text.match(
    /\breg(?:istration)?\.?\s*(?:no|number|num)?\s*[:.+=\-–—]*\s*([0-9]{2}[A-Z]{3}[0-9]{4,5}|[0-9]{7,10})\b/i,
  );
  if (regMatch) {
    regNo = regMatch[1].toUpperCase();
  }

  // ── 7. Course Code & Course Title ──
  let courseCode: string | undefined;
  let courseTitle: string | undefined;

  const courseLineMatch = text.match(
    /\b(?:course|subject)\s*(?:code\b)?[^a-z0-9\n]{0,10}([A-Z]{3,5}[0-9]{3}[A-Z0-9]{0,3})(?:[\s\-–—:]+([^\n\r]+))?/i,
  );
  if (courseLineMatch) {
    courseCode = courseLineMatch[1].toUpperCase();
    if (courseLineMatch[2]) {
      const clean = sanitizeTitle(courseLineMatch[2]);
      if (clean.length > 0 && clean.length <= 80) {
        courseTitle = clean;
      }
    }
  } else {
    // Standalone course code search
    const bareCode = text.match(COURSE_CODE_REGEX);
    if (bareCode) {
      courseCode = bareCode[1].toUpperCase();
    }
  }

  // ── 8. Max Marks ──
  let maxMarks: number | undefined;
  const marksMatch = text.match(/\bmax(?:imum)?\.?\s*marks?\s*[:.+=\-–—]*\s*(\d{2,3})\b/i);
  if (marksMatch) {
    maxMarks = Number.parseInt(marksMatch[1], 10);
  }

  // ── 9. Duration / Time ──
  let duration: string | undefined;
  const timeMatch = text.match(/\btime\s*[:.+=\-–—]*\s*([^\n\r,;|]+(?:hours?|hrs?|minutes?|mins?))\b/i);
  if (timeMatch) {
    duration = timeMatch[1].trim();
  }

  // ── Deciding whether this is an exam ──
  // An exam is confirmed if an exam category (FAT, CAT 1, CAT 2, etc.) was identified,
  // or if multiple exam indicators (slot, class nbr, max marks, reg no) exist.
  if (!category) {
    const hasExamIndicators =
      (slot ? 1 : 0) +
      (classNbr ? 1 : 0) +
      (maxMarks ? 1 : 0) +
      (regNo ? 1 : 0) +
      (upper.includes("QUESTION PAPER") || upper.includes("EXAMINATION") ? 1 : 0);

    if (hasExamIndicators >= 2) {
      category = "Other";
      rawExamName = "Examination";
    } else {
      return null;
    }
  }

  return {
    category,
    rawExamName: rawExamName || category,
    session,
    month: sessionMonth,
    year: sessionYear,
    semester,
    shortSemester,
    academicYear,
    term,
    slot,
    classNbr,
    regNo,
    maxMarks,
    duration,
    courseCode,
    courseTitle,
  };
}

/**
 * Generate a clean, descriptive document title from extracted exam details.
 * E.g. "BGER101L German — FAT (May 2024)"
 */
export function buildExamTitle(exam: ExamDetails): string {
  const parts: string[] = [];

  const subject = [exam.courseCode, exam.courseTitle].filter(Boolean).join(" ");
  if (subject) parts.push(subject);

  const examTag = exam.category || "Exam";
  const sessionTag = exam.session || exam.shortSemester;

  if (sessionTag) {
    parts.push(`${examTag} (${sessionTag})`);
  } else {
    parts.push(examTag);
  }

  return parts.join(" — ") || exam.category || "Exam Paper";
}
