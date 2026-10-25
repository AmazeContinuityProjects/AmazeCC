/**
 * Reading a semester's courses out of pasted text.
 *
 * Ported from ffcsmaker's `features/paste-import/parsePastedText.ts`. The
 * extraction and the confidence rule are its's; what is added is the adapter
 * at the bottom, because the two apps disagree about what a course *is*:
 * ffcsmaker keeps theory and lab in two fields, whereas AmazeCC's solver takes
 * one `SLOT` per offering — `"A1+TA1"` — and one row per faculty. Getting that
 * translation wrong does not produce an ugly screen, it produces a semester in
 * which a lab never runs.
 *
 * The parser is line-oriented and permissive on purpose. Nobody formats this
 * text the same way twice: it arrives from a club handout, a screenshot's OCR,
 * a WhatsApp message, or a hand-typed list. So each line is read for whatever
 * it can yield, the course's identity carries forward onto following lines that
 * omit it (a common shape is a heading followed by option rows), and every
 * line reports how sure it is rather than being silently kept or dropped.
 *
 * Nothing here reaches the network or a file: the student pastes, sees a
 * preview with per-line confidence and errors, and only then imports.
 */

import type { ParsedCourse, AddedCourse } from "@/components/custom/exams/FFCS/types";
import { COLORS } from "@/components/custom/exams/FFCS/constants";
import { normalizeHeader, type ImportableField } from "./normalizeColumns";

export interface PastedCourseOption {
  /** Exactly what was pasted, so the preview can echo it back unaltered. */
  rawLine: string;
  courseCode: string | null;
  courseName: string | null;
  professorName: string | null;
  /** Comma-separated, as written — `"A1, B1"`. */
  theorySlotRaw: string | null;
  /** Comma-separated, as written — `"TA1, TB1"`. */
  labSlotRaw: string | null;
  credits: number | null;
  confidence: "high" | "medium" | "low";
  errors: string[];
  venue?: string | null;
  type?: string | null;
  classId?: string | null;
  employeeId?: string | null;
}

export interface VtopCourseRow {
  code: string;
  title: string;
  type: string;
  credits: string;
  slot: string;
  venue: string;
  faculty: string;
  employeeId?: string;
  classId?: string;
}

/**
 * A course code: two to six letters, two to four digits, an optional trailing
 * letter.
 *
 * Wider than the reference's `{2,4}`, which is what ffcsmaker's own sample
 * needed and not what this university's look like. VIT codes are eight
 * characters — `BASTS101`, `BAMAT201`, `BABIT314`, `BMAT202P` — so five
 * letters precede the digits and `{2,4}` cannot reach them: 98 of the 497
 * distinct codes in the shipped `ffcsReport.csv` fail it, and a pasted line
 * carrying one of those would import as "Course code not found".
 *
 * The digit run is what keeps this from matching ordinary words, and no slot
 * token can satisfy it either: `A1`, `TA1`, `S11` and `TDD1` all carry a
 * single digit, so nothing in a timetable is ever mistaken for a code.
 */
const COURSE_CODE_RE = /\b([A-Z]{2,6}\d{2,4}[A-Z]?)\b/i;

/**
 * Slots this schema can hold: `A1`…`TAA1`, law's `S11`/`S15`, and any
 * `X1+Y1` chain of them.
 *
 * Matches valid theory slots while avoiding room patterns like `AB4-305`.
 */
const THEORY_RE =
  /\b(?:T?(?:AA|BB|CC|DD|[A-G])\d{1,2}|S\d{1,2}|V\d{1,2})(?:\s*\+\s*(?:T?(?:AA|BB|CC|DD|[A-G])\d{1,2}|S\d{1,2}|V\d{1,2}))*\b/gi;
const LAB_RE = /\bL\d{1,3}(?:\s*\+\s*L\d{1,3})*\b/gi;
const THEORY_TEST_RE =
  /\b(?:T?(?:AA|BB|CC|DD|[A-G])[1-9]|S\d{1,2}|V\d{1,2})(?:\s*\+\s*(?:T?(?:AA|BB|CC|DD|[A-G])[1-9]|S\d{1,2}|V\d{1,2}))*\b/i;
const LAB_TEST_RE = /\bL\d{1,3}(?:\s*\+\s*L\d{1,3})*\b/i;

/** Wording that means "this course has both halves", for the TYPE below. */
const EMBEDDED_RE = /\bembedded\b/i;

/** Values that stand in for "no slot" in every export this is likely to meet. */
const ABSENT = ["-", "NA", "N/A", "NIL", "NONE", "NIL NIL"];

function cleanLine(value: string): string {
  return value
    .replace(/^\s*\d+[.)-]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSlots(value: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s*,\s*/g, ", ")
    .trim()
    .toUpperCase();
  return ABSENT.includes(normalized) ? null : normalized;
}

function findCredits(line: string): number | null {
  const explicit = line.match(/\b([1-9])\s*(?:cr|credit|credits)\b/i);
  if (explicit) return Number(explicit[1]);
  const parenthetical = line.match(/\(([1-9])\)/);
  if (parenthetical) return Number(parenthetical[1]);
  return null;
}

function extractSlots(line: string): { theorySlotRaw: string | null; labSlotRaw: string | null } {
  const labs = Array.from(line.matchAll(LAB_RE)).map((match) => match[0]);
  const theory = Array.from(line.matchAll(THEORY_RE))
    .map((match) => match[0])
    .filter((slot) => !/^L\d/i.test(slot));

  return {
    theorySlotRaw: normalizeSlots(theory.join(", ")),
    labSlotRaw: normalizeSlots(labs.join(", ")),
  };
}

function stripKnownParts(line: string, parts: Array<string | null>): string {
  let next = line;
  for (const part of parts) {
    if (!part) continue;
    next = next.replace(part, " ");
  }
  return next
    .replace(/\b(theory|lab|credits?|cr|option)\b/gi, " ")
    .replace(/\b(NIL|NONE|NA|N\/A)\b/gi, " ")
    .replace(/[|/(),:]+/g, " ")
    .replace(/\s+-\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bestProfessorCandidate(line: string): string | null {
  const segments = line
    .split(/\s*(?:-|\u2013|\||\/)\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .filter((segment) => !COURSE_CODE_RE.test(segment))
    .filter((segment) => !LAB_TEST_RE.test(segment))
    .filter((segment) => !THEORY_TEST_RE.test(segment))
    .filter((segment) => !/\b(?:theory|lab|option|credits?|cr)\b/i.test(segment));

  return segments.sort((a, b) => b.length - a.length)[0] ?? null;
}

function inferCourseName(line: string, courseCode: string | null, credits: number | null): string | null {
  if (!courseCode) return null;

  const afterCode = line.slice(line.toUpperCase().indexOf(courseCode.toUpperCase()) + courseCode.length);
  const beforeCredits = credits
    ? afterCode.replace(new RegExp(`\\(?\\s*${credits}\\s*(?:cr|credits?)?\\s*\\)?`, "i"), "")
    : afterCode;
  const firstChunk = beforeCredits
    .split(/\s*(?:-|\u2013|\||\/)\s*/)
    .map((segment) => segment.trim())
    .find(
      (segment) =>
        segment.length > 2 &&
        !LAB_TEST_RE.test(segment) &&
        !THEORY_TEST_RE.test(segment) &&
        !/\b(?:option|theory|lab)\b/i.test(segment)
    );

  return firstChunk ?? null;
}

function confidenceFor(
  courseCode: string | null,
  professorName: string | null,
  theorySlotRaw: string | null,
  labSlotRaw: string | null
): "high" | "medium" | "low" {
  const hasSlot = Boolean(theorySlotRaw || labSlotRaw);
  if (courseCode && professorName && hasSlot) return "high";
  if (courseCode && (professorName || hasSlot)) return "medium";
  return "low";
}

function isProfessorish(value: string): boolean {
  return /^(dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?)\s+/i.test(value);
}

function segmentHints(line: string, courseCode: string | null): { courseName: string | null; professorName: string | null } {
  const segments = line
    .split(/\s*(?:-|\u2013|\|)\s*/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!courseCode || segments.length < 2) return { courseName: null, professorName: null };

  const firstCodeIndex = segments.findIndex((segment) => segment.toUpperCase().includes(courseCode));
  const candidates = segments
    .slice(firstCodeIndex >= 0 ? firstCodeIndex + 1 : 0)
    .map((segment) => stripKnownParts(segment, [courseCode]))
    .filter(Boolean)
    .filter((segment) => !LAB_TEST_RE.test(segment))
    .filter((segment) => !THEORY_TEST_RE.test(segment))
    .filter((segment) => !/\b(?:option|theory|lab|credits?|cr)\b/i.test(segment));

  if (candidates.length === 0) return { courseName: null, professorName: null };

  const titledProfessor = candidates.find(isProfessorish);
  if (titledProfessor) {
    return {
      courseName: candidates.find((candidate) => candidate !== titledProfessor) ?? null,
      professorName: titledProfessor,
    };
  }

  if (candidates.length === 1) return { courseName: null, professorName: candidates[0] };

  return { courseName: candidates[0], professorName: candidates[candidates.length - 1] };
}

function parseLine(
  rawLine: string,
  inherited: { courseCode: string | null; courseName: string | null; credits: number | null }
): PastedCourseOption {
  const line = cleanLine(rawLine);
  const courseCode = line.match(COURSE_CODE_RE)?.[1]?.toUpperCase() ?? inherited.courseCode;
  const credits = findCredits(line) ?? inherited.credits;
  const { theorySlotRaw, labSlotRaw } = extractSlots(line);
  const hints = segmentHints(line, courseCode);
  const courseName =
    inherited.courseName ??
    hints.courseName ??
    (hints.professorName ? null : inferCourseName(line, courseCode, credits));
  const professorSource = stripKnownParts(line, [
    courseCode,
    courseName,
    theorySlotRaw,
    labSlotRaw,
    credits ? String(credits) : null,
  ]);
  const professorName =
    hints.professorName ??
    bestProfessorCandidate(professorSource) ??
    (professorSource.length > 1 ? professorSource : null);

  const errors: string[] = [];
  if (!courseCode) errors.push("Course code not found");
  if (!professorName) errors.push("Professor not found");
  if (!theorySlotRaw && !labSlotRaw) errors.push("No slots found");

  return {
    rawLine,
    courseCode,
    courseName,
    professorName,
    theorySlotRaw,
    labSlotRaw,
    credits,
    confidence: confidenceFor(courseCode, professorName, theorySlotRaw, labSlotRaw),
    errors,
  };
}

const VALID_SLOT_TOKEN = /^(?:T?(?:AA|BB|CC|DD|[A-G])[12]|S\d{1,2}|V\d{1,2}|L\d{1,3})$/i;

function isValidSlot(slot: string): boolean {
  if (!slot) return false;
  const parts = slot.split("+").map((s) => s.trim().toUpperCase());
  return parts.length > 0 && parts.every((p) => VALID_SLOT_TOKEN.test(p));
}

/** Check if text is copied from VTOP registration or View/Modify page */
export function isVtopRegistrationText(raw: string): boolean {
  const lower = String(raw ?? "").toLowerCase();
  return (
    lower.includes("registered and") ||
    (lower.includes("course details") && lower.includes("class detail")) ||
    (lower.includes("embedded theory") && lower.includes("embedded lab")) ||
    lower.includes("winter semester registration") ||
    lower.includes("fall semester registration") ||
    lower.includes("software development cell, vit")
  );
}

/** Parse full course entries from VTOP registration page */
export function parseVtopRegistrationText(raw: string): VtopCourseRow[] {
  const cleanedText = String(raw ?? "")
    .replace(/(?:WINTER|FALL)\s+SEMESTER\s+REGISTRATION[^\n]*/gi, "")
    .replace(/VIT\s*-\s*CHENNAI\s+CAMPUS/gi, "")
    .replace(/Home\s+View\s*\/\s*Modify/gi, "")
    .replace(/SignOut/gi, "")
    .replace(/Copyright\s+©[^\n]*/gi, "")
    .replace(/Course\s+Details\s+Credit\s+Course\s+Category\s+Course\s*Option\s*Class\s+Detail\s+Slot\s+Faculty\s+Status\s+Modify\s+Delete/gi, "")
    .replace(/Course\s+Details\s+Credit\s+Course\s+Category\s+Course/gi, "")
    .replace(/Option\s*Class\s+Detail\s+Slot\s+Faculty\s+Status\s+Modify\s+Delete/gi, "");

  const courseCodePattern = /(?:^|\n)\s*([A-Z]{2,6}\d{2,4}[A-Z]?)\s*-\s*/g;
  const matches: { index: number; code: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = courseCodePattern.exec(cleanedText)) !== null) {
    matches.push({ index: m.index, code: m[1] });
  }

  const results: VtopCourseRow[] = [];

  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : cleanedText.length;
    const chunk = cleanedText.slice(start, end).trim();
    const code = matches[i].code.toUpperCase();

    // 1. Credits
    const creditsMatch =
      chunk.match(/\b([0-4](?:\.[0-5])?)\s*(?:Concentration|Programme|University|Open Elective|Regular)/i) ||
      chunk.match(/\b([0-4]\.0)\b/);
    const credits = creditsMatch ? creditsMatch[1] : "0";

    // 2. Type
    let type = "TH";
    if (/embedded\s*theory/i.test(chunk)) {
      type = "ETH";
    } else if (/embedded\s*lab/i.test(chunk)) {
      type = "ELA";
    } else if (/theory\s*only/i.test(chunk)) {
      type = "TH";
    } else if (/lab\s*only/i.test(chunk)) {
      type = "LO";
    } else if (/soft\s*skill/i.test(chunk)) {
      type = "SS";
    }

    // 3. Title
    let title = "";
    const typeWordMatch = chunk.match(
      /(?:-\s*)?(Embedded\s+Theory|Embedded\s+Lab|Theory\s+Only|Lab\s+Only|Soft\s+Skill)/i
    );
    if (typeWordMatch && typeWordMatch.index) {
      const titlePortion = chunk.slice(0, typeWordMatch.index);
      title = titlePortion
        .replace(new RegExp(`^\\s*${code}\\s*-\\s*`, "i"), "")
        .replace(/-\s*$/, "")
        .replace(/\s+/g, " ")
        .trim();
    } else {
      const firstLine = chunk.split("\n")[0];
      const parts = firstLine.split("-").map((s) => s.trim());
      title = parts[1] || "";
    }

    // 4. Venue
    const venueMatches = Array.from(chunk.matchAll(/[A-Z]{1,4}\d*[-_]\d+[A-Z]?/gi)).map((match) => match[0]);
    const venue = venueMatches.length > 0 ? venueMatches[venueMatches.length - 1] : "TBA";

    // 5. Slot
    const slotMatches = Array.from(
      chunk.matchAll(
        /\b(?:T?(?:AA|BB|CC|DD|[A-G])[12]|S\d{1,2}|V\d{1,2}|L\d{1,3})(?:\+(?:T?(?:AA|BB|CC|DD|[A-G])[12]|S\d{1,2}|V\d{1,2}|L\d{1,3}))*\b/gi
      )
    ).map((match) => match[0]);
    const validSlots = slotMatches.filter(isValidSlot);
    const slot = validSlots[0] || "";

    // 6. Class ID
    const classIdMatch = chunk.match(/\b([A-Z]{2}\d{12,14})\b/);
    const classId = classIdMatch ? classIdMatch[1] : undefined;

    // 7. Faculty & Employee ID
    let faculty = "";
    let employeeId: string | undefined;

    if (slot) {
      const slotIndex = chunk.indexOf(slot);
      const afterSlot = chunk.slice(slotIndex + slot.length);
      const statusIndex = afterSlot.search(/Registered\s+and|Registered|Status/i);
      const facultyBlock = (statusIndex >= 0 ? afterSlot.slice(0, statusIndex) : afterSlot).trim();

      const inlineEmpMatch = facultyBlock.match(/[-–—]\s*(\d{4,6}|[A-Z]{3}\d{2})\b/);
      if (inlineEmpMatch) {
        employeeId = inlineEmpMatch[1];
      }

      const facultyLines = facultyBlock
        .replace(/[-–—]\s*(\d{4,6}|[A-Z]{3}\d{2})\b/g, "")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (facultyLines.length > 1) {
        const lastLine = facultyLines[facultyLines.length - 1];
        if (/^(\d{4,6}|[A-Z]{2,4}\d{1,4}|[A-Z0-9_-]+)$/i.test(lastLine)) {
          if (!employeeId) employeeId = lastLine;
          facultyLines.pop();
        }
      }

      faculty = facultyLines
        .join(" ")
        .replace(/\b(\d{4,6}|[A-Z]{3}\d{2})\b/g, "")
        .replace(/-\s*$/, "")
        .replace(/^-\s*/, "")
        .replace(/\s+/g, " ")
        .trim();
    }

    results.push({
      code,
      title,
      type,
      credits,
      slot,
      venue,
      faculty,
      employeeId,
      classId,
    });
  }

  return results;
}

/** Delimited row tokenizer supporting CSV quotes and markdown table borders */
function parseDelimitedRow(line: string, delimiter: string): string[] {
  let cleaned = line.trim();
  if (delimiter === "|") {
    if (cleaned.startsWith("|")) cleaned = cleaned.slice(1);
    if (cleaned.endsWith("|")) cleaned = cleaned.slice(0, -1);
  }

  if (delimiter === "\t") {
    return cleaned.split("\t").map((c) => c.trim().replace(/^["']|["']$/g, ""));
  }

  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim().replace(/^["']|["']$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim().replace(/^["']|["']$/g, ""));
  return cells;
}

/** Sniff delimiter across lines (\t > | > ; > ,) */
function detectDelimiter(lines: string[]): string | null {
  const candidates = ["\t", "|", ";", ","];

  for (const delim of candidates) {
    let matchCount = 0;
    for (const line of lines) {
      if (delim === "|") {
        let inner = line.trim();
        if (inner.startsWith("|")) inner = inner.slice(1);
        if (inner.endsWith("|")) inner = inner.slice(0, -1);
        if (inner.includes("|")) matchCount++;
      } else {
        if (line.includes(delim)) matchCount++;
      }
    }

    if (lines.length > 0 && matchCount >= Math.ceil(lines.length * 0.5)) {
      return delim;
    }
  }

  return null;
}

/** Infer column roles from cell content patterns when no header row is present */
function inferColumnMapping(grid: string[][]): Map<number, ImportableField> {
  const colMap = new Map<number, ImportableField>();
  if (grid.length === 0) return colMap;

  const numCols = Math.max(...grid.map((r) => r.length));
  const claimed = new Set<ImportableField>();

  // Pass 1: exact slot token match
  for (let c = 0; c < numCols; c++) {
    const vals = grid.map((r) => r[c] || "").filter(Boolean);
    if (!claimed.has("SLOT") && vals.length > 0 && vals.every((v) => isValidSlot(v))) {
      colMap.set(c, "SLOT");
      claimed.add("SLOT");
      break;
    }
  }

  // Pass 2: exact course code match
  for (let c = 0; c < numCols; c++) {
    if (colMap.has(c)) continue;
    const vals = grid.map((r) => r[c] || "").filter(Boolean);
    if (!claimed.has("CODE") && vals.length > 0 && vals.every((v) => /^[A-Z]{2,6}\d{2,4}[A-Z]?$/i.test(v))) {
      colMap.set(c, "CODE");
      claimed.add("CODE");
      break;
    }
  }

  // Pass 3: credits match (e.g. 1, 2, 3, 4, 1.0, 3.0)
  for (let c = 0; c < numCols; c++) {
    if (colMap.has(c)) continue;
    const vals = grid.map((r) => r[c] || "").filter(Boolean);
    if (!claimed.has("CREDITS") && vals.length > 0 && vals.every((v) => /^[0-9](?:\.[05])?$/.test(v))) {
      colMap.set(c, "CREDITS");
      claimed.add("CREDITS");
      break;
    }
  }

  // Pass 4: venue match (e.g. AB4-305, AB3-102, SJ-101, TT-204)
  for (let c = 0; c < numCols; c++) {
    if (colMap.has(c)) continue;
    const vals = grid.map((r) => r[c] || "").filter(Boolean);
    if (!claimed.has("ROOM") && vals.length > 0 && vals.every((v) => /^[A-Z]{1,4}\d*[-_]\d+[A-Z]?$/i.test(v))) {
      colMap.set(c, "ROOM");
      claimed.add("ROOM");
      break;
    }
  }

  // Pass 5: course type match (e.g. ETH, ELA, TH, LO, SS)
  for (let c = 0; c < numCols; c++) {
    if (colMap.has(c)) continue;
    const vals = grid.map((r) => r[c] || "").filter(Boolean);
    if (
      !claimed.has("TYPE") &&
      vals.length > 0 &&
      vals.every((v) =>
        /^(?:ETH|ELA|TH|LO|SS|EPJ|PJ|Embedded\s+Theory|Embedded\s+Lab|Theory\s+Only|Lab\s+Only|Soft\s+Skill)$/i.test(v)
      )
    ) {
      colMap.set(c, "TYPE");
      claimed.add("TYPE");
      break;
    }
  }

  // Pass 6: Title and Faculty among remaining columns
  const remaining: number[] = [];
  for (let c = 0; c < numCols; c++) {
    if (!colMap.has(c)) remaining.push(c);
  }

  if (remaining.length === 1) {
    colMap.set(remaining[0], "TITLE");
  } else if (remaining.length >= 2) {
    const col0Vals = grid.map((r) => r[remaining[0]] || "");
    const col1Vals = grid.map((r) => r[remaining[1]] || "");
    const col0HasProf = col0Vals.some((v) => isProfessorish(v));
    const col1HasProf = col1Vals.some((v) => isProfessorish(v));

    if (col1HasProf && !col0HasProf) {
      colMap.set(remaining[0], "TITLE");
      colMap.set(remaining[1], "FACULTY");
    } else if (col0HasProf && !col1HasProf) {
      colMap.set(remaining[0], "FACULTY");
      colMap.set(remaining[1], "TITLE");
    } else {
      colMap.set(remaining[0], "TITLE");
      colMap.set(remaining[1], "FACULTY");
    }
  }

  return colMap;
}

/** Parse any table-like delimited text (CSV, TSV, Piped, Markdown, Semicolon) */
function parseDelimitedText(
  raw: string
): { courses: ParsedCourse[]; addedCourses: AddedCourse[]; format: string } | null {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const dataLines = lines.filter((l) => !/^[|\s:-]+$/.test(l));
  if (dataLines.length === 0) return null;

  const delimiter = detectDelimiter(dataLines);
  if (!delimiter) return null;

  const grid = dataLines.map((l) => parseDelimitedRow(l, delimiter));
  if (grid.length === 0) return null;

  const row0 = grid[0];
  const headerMap = new Map<number, ImportableField>();
  let hasHeader = false;

  row0.forEach((cell, idx) => {
    const field = normalizeHeader(cell);
    if (field) {
      headerMap.set(idx, field);
      hasHeader = true;
    }
  });

  const isRealHeader =
    hasHeader &&
    (headerMap.has(0) ||
      Array.from(headerMap.values()).some((f) => f === "CODE" || f === "SLOT"));

  let colMap: Map<number, ImportableField>;
  let contentRows: string[][];

  if (isRealHeader) {
    colMap = headerMap;
    contentRows = grid.slice(1);
  } else {
    contentRows = grid;
    colMap = inferColumnMapping(contentRows.slice(0, 5));
  }

  const hasCode = Array.from(colMap.values()).includes("CODE");
  const hasSlot = Array.from(colMap.values()).includes("SLOT");
  if (!hasCode || !hasSlot) return null;

  const parsedCourses: ParsedCourse[] = [];

  for (const row of contentRows) {
    let code = "";
    let title = "";
    let slot = "";
    let faculty = "";
    let venue = "";
    let credits = "0";
    let type = "Theory";
    let batch = "";

    colMap.forEach((field, colIdx) => {
      const val = row[colIdx]?.trim() ?? "";
      if (field === "CODE") code = val.toUpperCase();
      else if (field === "TITLE") title = val;
      else if (field === "SLOT") slot = val.toUpperCase();
      else if (field === "FACULTY") faculty = val;
      else if (field === "ROOM") venue = val;
      else if (field === "CREDITS") credits = val;
      else if (field === "TYPE") type = val;
      else if (field === "BATCH") batch = val;
    });

    if (!code || !slot || !isValidSlot(slot)) continue;

    if (type === "Theory" || !type) {
      const tokens = slot.split("+");
      const hasLab = tokens.some((t) => t.startsWith("L"));
      const hasTheory = tokens.some((t) => !t.startsWith("L"));
      type = hasTheory && hasLab ? "ETH+ELA" : hasLab ? "LO" : "TH";
    }

    parsedCourses.push({
      CODE: code,
      TITLE: title,
      TYPE: type,
      CREDITS: credits || "0",
      ROOM: venue || "TBA",
      SLOT: slot,
      FACULTY: faculty,
      BATCH: batch,
    });
  }

  if (parsedCourses.length === 0) return null;

  const formatName =
    delimiter === "\t"
      ? "tsv"
      : delimiter === "|"
      ? dataLines[0].startsWith("|")
        ? "markdown"
        : "piped"
      : delimiter === ";"
      ? "semicolon"
      : "csv";

  return {
    courses: parsedCourses,
    addedCourses: parsedCoursesToAddedCourses(parsedCourses),
    format: formatName,
  };
}

/** Parse JSON array or backup export */
function parseJsonPaste(raw: string): { courses: ParsedCourse[]; addedCourses: AddedCourse[] } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return null;

  try {
    const data = JSON.parse(trimmed);
    let items: any[] = [];
    if (Array.isArray(data)) {
      items = data;
    } else if (data && typeof data === "object") {
      if (Array.isArray(data.courses)) {
        items = data.courses;
      } else if (Array.isArray(data.timetables) && data.timetables[0]?.courses) {
        items = data.timetables[0].courses;
      }
    }

    if (items.length === 0) return null;

    const parsedCourses: ParsedCourse[] = [];
    for (const item of items) {
      const code = String(item.code || item.CODE || "").trim().toUpperCase();
      const slot = String(
        item.slot || item.SLOT || (Array.isArray(item.slots) ? item.slots.join("+") : "")
      )
        .trim()
        .toUpperCase();
      if (!code || !slot) continue;

      const title = String(item.title || item.TITLE || item.name || "").trim();
      const faculty = String(item.faculty || item.FACULTY || item.professor || "").trim();
      const venue = String(item.venue || item.VENUE || item.room || item.ROOM || "").trim();
      const credits = String(item.credits || item.CREDITS || "0").trim();
      const type = String(item.type || item.TYPE || "Theory").trim();

      parsedCourses.push({
        CODE: code,
        TITLE: title,
        TYPE: type,
        CREDITS: credits,
        ROOM: venue || "TBA",
        SLOT: slot,
        FACULTY: faculty,
        BATCH: String(item.batch || item.BATCH || ""),
        ERP_ID: item.employeeId || item.ERP_ID,
        CLASS_ID: item.classId || item.CLASS_ID,
      });
    }

    if (parsedCourses.length === 0) return null;

    return {
      courses: parsedCourses,
      addedCourses: parsedCoursesToAddedCourses(parsedCourses),
    };
  } catch {
    return null;
  }
}

export interface UniversalPasteResult {
  addedCourses: AddedCourse[];
  parsedCourses: ParsedCourse[];
  format: "vtop" | "markdown" | "tsv" | "csv" | "piped" | "semicolon" | "json" | "generic";
  totalCredits: number;
  uniqueCount: number;
}

/** Universal parser: accepts JSON, VTOP tables, CSV, TSV, Markdown, Piped, Semicolon, or plain text */
export function parseUniversalPaste(raw: string): UniversalPasteResult {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return {
      addedCourses: [],
      parsedCourses: [],
      format: "generic",
      totalCredits: 0,
      uniqueCount: 0,
    };
  }

  // 1. JSON
  const jsonResult = parseJsonPaste(trimmed);
  if (jsonResult) {
    return {
      addedCourses: jsonResult.addedCourses,
      parsedCourses: jsonResult.courses,
      format: "json",
      totalCredits: jsonResult.addedCourses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0),
      uniqueCount: new Set(jsonResult.addedCourses.map((c) => c.code)).size,
    };
  }

  // 2. VTOP Registration
  if (isVtopRegistrationText(trimmed)) {
    const vtopRows = parseVtopRegistrationText(trimmed);
    if (vtopRows.length > 0) {
      const addedCourses = vtopRowsToAddedCourses(vtopRows);
      const parsedCourses: ParsedCourse[] = vtopRows.map((r) => ({
        CODE: r.code,
        TITLE: r.title,
        TYPE: r.type,
        CREDITS: r.credits,
        ROOM: r.venue,
        SLOT: r.slot,
        FACULTY: r.faculty,
        ERP_ID: r.employeeId,
        CLASS_ID: r.classId,
        BATCH: "",
      }));

      return {
        addedCourses,
        parsedCourses,
        format: "vtop",
        totalCredits: addedCourses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0),
        uniqueCount: new Set(addedCourses.map((c) => c.code)).size,
      };
    }
  }

  // 3. Delimited Table (Markdown, TSV, CSV, Piped, Semicolon)
  const delimited = parseDelimitedText(trimmed);
  if (delimited && delimited.courses.length > 0) {
    return {
      addedCourses: delimited.addedCourses,
      parsedCourses: delimited.courses,
      format: delimited.format as any,
      totalCredits: delimited.addedCourses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0),
      uniqueCount: new Set(delimited.addedCourses.map((c) => c.code)).size,
    };
  }

  // 4. Generic line-by-line fallback
  const options = parsePastedTextLines(trimmed);
  const parsedCourses = toParsedCourses(options);
  const addedCourses = parsedCoursesToAddedCourses(parsedCourses);

  return {
    addedCourses,
    parsedCourses,
    format: "generic",
    totalCredits: addedCourses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0),
    uniqueCount: new Set(addedCourses.map((c) => c.code)).size,
  };
}

export function parsePastedText(raw: string): PastedCourseOption[] {
  const universal = parseUniversalPaste(raw);
  if (universal.format !== "generic" && universal.parsedCourses.length > 0) {
    return universal.parsedCourses.map((c) => ({
      rawLine: `${c.CODE} - ${c.TITLE} - ${c.TYPE} - ${c.SLOT} - ${c.ROOM} - ${c.FACULTY}`,
      courseCode: c.CODE,
      courseName: c.TITLE,
      professorName: c.FACULTY,
      theorySlotRaw: c.SLOT.split("+").some((s) => !s.startsWith("L")) ? c.SLOT : null,
      labSlotRaw: c.SLOT.split("+").some((s) => s.startsWith("L")) ? c.SLOT : null,
      credits: c.CREDITS ? parseFloat(c.CREDITS) : null,
      confidence: "high",
      errors: [],
      venue: c.ROOM,
      type: c.TYPE,
      classId: c.CLASS_ID,
      employeeId: c.ERP_ID,
    }));
  }

  return parsePastedTextLines(raw);
}

function parsePastedTextLines(raw: string): PastedCourseOption[] {
  const lines = String(raw ?? "")
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const parsed: PastedCourseOption[] = [];
  let currentCourse: { courseCode: string | null; courseName: string | null; credits: number | null } = {
    courseCode: null,
    courseName: null,
    credits: null,
  };

  for (const line of lines) {
    const code = line.match(COURSE_CODE_RE)?.[1]?.toUpperCase() ?? null;
    const credits = findCredits(line);
    const looksLikeHeader =
      Boolean(code) &&
      /\b(?:credits?|cr)\b/i.test(line) &&
      !/\b(?:option|theory|lab)\b/i.test(line);

    if (looksLikeHeader) {
      currentCourse = {
        courseCode: code,
        courseName: inferCourseName(line, code, credits),
        credits,
      };
      continue;
    }

    const option = parseLine(line, currentCourse);
    if (option.courseCode) {
      currentCourse = {
        courseCode: option.courseCode,
        courseName: option.courseName,
        credits: option.credits,
      };
    }
    parsed.push(option);
  }

  return parsed;
}

/* ── the adapter to this app ────────────────────────────────────────────── */

/**
 * Split a comma-separated slot list into individual ids.
 *
 * Handles the two ways a list of slots arrives: `"A1, B1"` from a sheet and
 * `"A1+TA1"` from a booking, which is *one* offering rather than a list. The
 * caller decides which meaning applies — this only normalises spelling.
 */
const slotList = (raw: string | null): string[] =>
  (raw ?? "")
    .split(/[,/]+/)
    .map((slot) => slot.trim().toUpperCase())
    .filter(Boolean);

/**
 * Does the pasted line say this is an embedded (theory *and* lab) course?
 *
 * Only ever read where the halves have already been shown to pair up — see
 * `toParsedCourses`, which decides the TYPE from the slots themselves rather
 * than from this word alone.
 */
const isEmbedded = (line: string): boolean => EMBEDDED_RE.test(line);

/**
 * Pasted options as the rows the solver wants: one booking each.
 *
 * The reference keeps theory and lab apart because its planner edits them
 * apart. This solver takes a single `SLOT` per offering, so the two lists are
 * paired index by index — `A1, B1` against `TA1, TB1` becomes `A1+TA1` and
 * `B1+TB1`, which is what a student who wrote them that way meant. When a list
 * is shorter, the missing half is simply absent: a theory-only offering is
 * legal here and gets `LO`/`TH` as below, where a made-up pairing would not be.
 *
 * Two rules keep the rows honest:
 *
 * - A line with no slots at all produces no rows. It may be a heading, and
 *   turning it into a course with an empty `SLOT` would fail much later, in
 *   the solver, as `no_valid_slots` pointing at a course that never existed.
 * - A line with a code but no slots inherits nothing: course identity carries
 *   *forward* from earlier lines, never sideways from a neighbour's options.
 */
export function toParsedCourses(options: readonly PastedCourseOption[]): ParsedCourse[] {
  const rows: ParsedCourse[] = [];

  for (const option of options) {
    if (!option.courseCode) continue;

    const theory = slotList(option.theorySlotRaw);
    const lab = slotList(option.labSlotRaw);
    if (theory.length === 0 && lab.length === 0) continue;

    const count = Math.max(theory.length, lab.length);

    for (let i = 0; i < count; i++) {
      const t = theory[i] ?? null;
      const l = lab[i] ?? null;
      if (!t && !l) continue;

      const slot = [t, l].filter(Boolean).join("+");
      const tokens = slot.split("+");
      // What is actually in this booking, not what the line called it.
      //
      // `ETH`/`ELA`/`EPJ` are the report's names for the *two halves* of an
      // embedded course, which VTOP writes as two separate rows; they only
      // survive to the generator because `processParsedCourses` pairs them
      // across rows first. A pasted line is one row and has nobody to pair
      // with, so a half typed as `ETH` reaches the solver missing its lab and
      // is silently discarded — the student is shown one timetable fewer and
      // no error anywhere. Emitting the type the *slots* justify cannot do
      // that: a row claiming to be embedded is exactly one that has both an
      // `L…` slot and a non-`L` one, which is the solver's own test.
      const hasLab = tokens.some((token) => token.startsWith("L"));
      const hasTheory = tokens.some((token) => !token.startsWith("L"));
      const inferredType =
        hasTheory && hasLab ? (isEmbedded(option.rawLine) ? "ETH + ELA" : "TH") : hasLab ? "LO" : "TH";
      const type = option.type || inferredType;

      rows.push({
        CODE: option.courseCode,
        TITLE: option.courseName ?? "",
        TYPE: type,
        CREDITS: option.credits != null ? String(option.credits) : "0",
        ROOM: option.venue || "",
        SLOT: slot,
        FACULTY: option.professorName ?? "",
        BATCH: "",
        CLASS_ID: option.classId,
        ERP_ID: option.employeeId,
      });
    }
  }

  return rows;
}

/** Convert parsed VTOP rows into complete AddedCourses for the timetable */
export function vtopRowsToAddedCourses(rows: readonly VtopCourseRow[]): AddedCourse[] {
  const codeColorMap = new Map<string, string>();
  let nextColorIndex = 0;

  return rows.map((row) => {
    if (!codeColorMap.has(row.code)) {
      codeColorMap.set(row.code, COLORS[nextColorIndex % COLORS.length]);
      nextColorIndex++;
    }
    const color = codeColorMap.get(row.code)!;
    const slots = row.slot
      .split("+")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && s !== "NIL");

    return {
      id: Math.random().toString(36).substr(2, 9),
      code: row.code,
      title: row.title,
      slots,
      faculty: row.faculty,
      employeeId: row.employeeId,
      venue: row.venue || "TBA",
      credits: row.credits || "0",
      type: row.type || "Theory",
      color,
    };
  });
}

/** Convert ParsedCourses directly into AddedCourses */
export function parsedCoursesToAddedCourses(courses: readonly ParsedCourse[]): AddedCourse[] {
  const codeColorMap = new Map<string, string>();
  let nextColorIndex = 0;

  return courses.map((course) => {
    if (!codeColorMap.has(course.CODE)) {
      codeColorMap.set(course.CODE, COLORS[nextColorIndex % COLORS.length]);
      nextColorIndex++;
    }
    const color = codeColorMap.get(course.CODE)!;
    const slots = course.SLOT
      .split("+")
      .map((s) => s.trim().toUpperCase())
      .filter((s) => s && s !== "NIL");

    return {
      id: Math.random().toString(36).substr(2, 9),
      code: course.CODE,
      title: course.TITLE,
      slots,
      faculty: course.FACULTY,
      employeeId: course.ERP_ID,
      venue: course.ROOM || "TBA",
      credits: course.CREDITS || "0",
      type: course.TYPE || "Theory",
      color,
      batch: course.BATCH,
    };
  });
}

/** Paste → rows, in one step, for callers that only want the result. */
export function parseAndConvert(raw: string): { options: PastedCourseOption[]; courses: ParsedCourse[] } {
  const options = parsePastedText(raw);
  return { options, courses: toParsedCourses(options) };
}
