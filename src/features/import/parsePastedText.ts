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

import type { ParsedCourse } from "@/components/custom/exams/FFCS/types";

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
 * `S\d{1,2}` is carried over from the reference precisely because law spells
 * two of its periods `S11` and `S15` rather than as a letter, and dropping it
 * would drop the whole law catalogue from a paste.
 */
const THEORY_RE =
  /\b(?:T?[A-G]{1,2}\d{1,2}|S\d{1,2})(?:\s*\+\s*(?:T?[A-G]{1,2}\d{1,2}|S\d{1,2}))*\b/gi;
const LAB_RE = /\bL\d{1,2}(?:\s*\+\s*L\d{1,2})*\b/gi;
const THEORY_TEST_RE =
  /\b(?:T?[A-G]{1,2}[1-9]|S\d{1,2})(?:\s*\+\s*(?:T?[A-G]{1,2}[1-9]|S\d{1,2}))*\b/i;
const LAB_TEST_RE = /\bL\d{1,2}(?:\s*\+\s*L\d{1,2})*\b/i;

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

export function parsePastedText(raw: string): PastedCourseOption[] {
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
      const type =
        hasTheory && hasLab ? (isEmbedded(option.rawLine) ? "ETH + ELA" : "TH") : hasLab ? "LO" : "TH";

      rows.push({
        CODE: option.courseCode,
        TITLE: option.courseName ?? "",
        TYPE: type,
        CREDITS: option.credits != null ? String(option.credits) : "0",
        ROOM: "",
        SLOT: slot,
        FACULTY: option.professorName ?? "",
        BATCH: "",
      });
    }
  }

  return rows;
}

/** Paste → rows, in one step, for callers that only want the result. */
export function parseAndConvert(raw: string): { options: PastedCourseOption[]; courses: ParsedCourse[] } {
  const options = parsePastedText(raw);
  return { options, courses: toParsedCourses(options) };
}
