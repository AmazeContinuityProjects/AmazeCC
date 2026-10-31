export interface ParsedSemester {
  academicYear: string;
  term: "Fall" | "Winter" | "Summer";
  startYear: number;
  endYear: number;
}

export interface SemesterReviewStatus {
  semesterId: string;
  label: string; // e.g. "Fall 2025–26" or "Winter 2025–26"
  isPastSemester: boolean;
  isOpen: boolean;
  endDate: Date;
  openDate: Date; // Exactly 30 days before semester end date
  reason?: string;
}

export function parseSemester(semesterId: string): ParsedSemester {
  const clean = String(semesterId || "").trim().toUpperCase();

  // VTOP code e.g. CH20252601, CH20252605, CH20262701
  const vtopMatch = clean.match(/^CH(\d{4})(\d{2})(\d{2})$/);
  if (vtopMatch) {
    const startYear = parseInt(vtopMatch[1], 10);
    const endYear = startYear + 1;
    const termCode = vtopMatch[3];
    const term: "Fall" | "Winter" | "Summer" =
      termCode === "01" ? "Fall" : termCode === "05" || termCode === "07" ? "Winter" : "Summer";
    return {
      academicYear: `${startYear}–${String(endYear).slice(-2)}`,
      term,
      startYear,
      endYear,
    };
  }

  // Text code e.g. FALL2025-26, WINTER2025-26
  const textMatch = clean.match(/(FALL|WINTER|SUMMER)[\s\-_]*(\d{4})/i);
  if (textMatch) {
    const term: "Fall" | "Winter" | "Summer" =
      textMatch[1].toUpperCase() === "FALL"
        ? "Fall"
        : textMatch[1].toUpperCase() === "WINTER"
        ? "Winter"
        : "Summer";
    const startYear = parseInt(textMatch[2], 10);
    const endYear = startYear + 1;
    return {
      academicYear: `${startYear}–${String(endYear).slice(-2)}`,
      term,
      startYear,
      endYear,
    };
  }

  // Fallback
  const now = new Date();
  const currentYear = now.getFullYear();
  return {
    academicYear: `${currentYear}–${String(currentYear + 1).slice(-2)}`,
    term: "Fall",
    startYear: currentYear,
    endYear: currentYear + 1,
  };
}

/**
 * Determines whether a student is within the allowed review window for a semester.
 * Rule: Reviews can only be submitted 1 month before the semester ends (or any time for past semesters).
 */
export function getSemesterReviewStatus(
  semesterId: string,
  currentDate: Date = new Date()
): SemesterReviewStatus {
  const parsed = parseSemester(semesterId);
  let endDate: Date;
  let openDate: Date;

  if (parsed.term === "Fall") {
    // Fall runs ~July/Aug to late Nov (LID/FAT)
    endDate = new Date(parsed.startYear, 10, 30, 23, 59, 59); // Nov 30
    openDate = new Date(parsed.startYear, 9, 30, 0, 0, 0);     // Oct 30 (1 month before)
  } else if (parsed.term === "Winter") {
    // Winter runs ~Jan to late April
    endDate = new Date(parsed.endYear, 3, 30, 23, 59, 59);    // April 30
    openDate = new Date(parsed.endYear, 2, 31, 0, 0, 0);       // March 31 (1 month before)
  } else {
    // Summer runs ~June to mid July
    endDate = new Date(parsed.endYear, 6, 15, 23, 59, 59);    // July 15
    openDate = new Date(parsed.endYear, 5, 15, 0, 0, 0);       // June 15 (1 month before)
  }

  const isPastSemester = currentDate.getTime() > endDate.getTime();
  const isOpen = currentDate.getTime() >= openDate.getTime();
  const label = `${parsed.term} ${parsed.academicYear}`;

  let reason: string | undefined;
  if (!isOpen) {
    const formattedOpen = openDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    reason = `Reviews open 1 month before semester end (from ${formattedOpen})`;
  }

  return {
    semesterId,
    label,
    isPastSemester,
    isOpen,
    endDate,
    openDate,
    reason,
  };
}
