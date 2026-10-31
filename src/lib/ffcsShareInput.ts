/**
 * Reading a shared plan back from a link — or from the short code inside it.
 *
 * The share feature *emits* links (`/share/ffcs/?d|x|q|r=…`, see
 * `./ffcsShare.ts`) and the receiver's own page (`app/share/ffcs`) decodes
 * them for viewing. Two other surfaces need the same reading, most recently
 * "add a friend from their share link", where the student pastes either the
 * whole URL or just the code after `?q=` — the code is what a chat app most
 * reliably delivers intact, since long links get wrapped or truncated.
 *
 * This module is the single place that answers *which payload is this?* and
 * *turn it into a timetable*. Two halves:
 *
 *   - {@link parseShareInput} — a pure shape check. It recognises a URL with
 *     any of the four parameters, a bare `d=`/`q=`-style query, or a bare code,
 *     by attempting each decoder (they are strict: wrong-shape payloads decode
 *     to null, never to a half-read plan). It never touches the network.
 *   - {@link resolveShareInput} — turns a parsed input into a real
 *     `TimetableState`. Three of the four formats store only class IDs, so the
 *     semester's registration report must be loaded to turn an ID back into a
 *     course; callers that already hold that report (the planner does) pass it
 *     in and nothing is fetched.
 *
 * Failures are typed ({@link ShareInputError}) rather than stringly, because
 * "that is not a link" and "your connection is down" must not be shown as the
 * same message — the mistake there is indistinguishable from a broken friend.
 */

import {
  decodeCompactTimetableShare,
  decodeNumericTimetableShapeShare,
  decodeTimetableShapeShare,
  decodeTimetableShare,
} from "@/lib/ffcsShare";
import { getFFCSSemester, parseReportRows, type FFCSSemesterId } from "@/components/custom/exams/FFCS/reports";
import { groupSharedReportCourses } from "@/lib/ffcsCourseGrouping";
import { COLORS } from "@/components/custom/exams/FFCS/constants";
import { splitSlots } from "@/components/custom/exams/FFCS/logic/generate";
import { GLOBAL_CAMPUS } from "@/lib/campusSchema";
import { getAssetPath } from "@/lib/utils";
import type { ParsedCourse, TimetableState } from "@/components/custom/exams/FFCS/types";

/** Which of the four share payloads a pasted value turned out to be. */
export type ShareInputFormat = "full" | "compact" | "shape" | "numeric-shape";

export interface ParsedShareInput {
  format: ShareInputFormat;
  /** The payload exactly as it appears after the parameter — already decoded. */
  encoded: string;
}

export interface ResolvedShare {
  timetable: TimetableState;
  campus: string;
}

export type ShareInputErrorCode =
  /** Nothing in the paste looked like any of the four payloads. */
  | "unreadable"
  /** Read fine, but a class ID is not in the semester's registration report. */
  | "report"
  /** The registration report itself could not be loaded. */
  | "network";

export class ShareInputError extends Error {
  readonly code: ShareInputErrorCode;

  constructor(code: ShareInputErrorCode, message: string) {
    super(message);
    this.name = "ShareInputError";
    this.code = code;
  }
}

/** Parameter letter → payload format, in the order the features were added. */
const PARAM_FORMATS = {
  d: "full",
  x: "compact",
  q: "shape",
  r: "numeric-shape",
} as const satisfies Record<string, ShareInputFormat>;

const UNREADABLE_MESSAGE =
  "That does not look like a share link or a TT-shape code. Paste the whole link, or just the code that follows ?q=.";

function readQueryParam(value: string): ParsedShareInput | null {
  // Matches the parameter in a full URL (`…/?q=`), a bare query (`?q=`), or a
  // pasted fragment (`q=`). Codes never contain `=`, so a value cannot be
  // mistaken for the key, and an unparsable URL is no obstacle — this does not
  // need `new URL` to succeed, which it would not for a protocol-less paste.
  const match = /(?:^|[?\s&])([dxqr])=([^\s&#]+)/.exec(value);
  if (!match) return null;
  const key = match[1] as keyof typeof PARAM_FORMATS;
  let encoded = match[2];
  if (encoded.includes("%")) {
    // Only when it is actually percent-encoded: most payloads are already
    // URI-safe and decodeURIComponent would leave them alone anyway.
    try {
      encoded = decodeURIComponent(encoded);
    } catch {
      return null;
    }
  }
  return { format: PARAM_FORMATS[key], encoded };
}

/**
 * Identify a bare code by decoding it, in the order of strictness.
 *
 * `compact` is tried before `shape` on purpose: a compact payload has the same
 * `p`/`i` keys a shape payload has plus `v`/`s`/`n`, so it also satisfies the
 * shape decoder, while the reverse is not true. Reading a compact code as a
 * shape would infer its semester from the prefix instead of the explicit `s`
 * it carries — the same report in practice, but a guess where the truth was
 * available.
 */
function detectBareCode(value: string): ParsedShareInput | null {
  let candidate = value;
  if (candidate.includes("%")) {
    try {
      candidate = decodeURIComponent(candidate);
    } catch {
      /* keep the raw value — it may be a payload that merely contains % */
    }
  }
  if (decodeTimetableShare(candidate)) return { format: "full", encoded: candidate };
  if (decodeCompactTimetableShare(candidate)) return { format: "compact", encoded: candidate };
  if (decodeNumericTimetableShapeShare(candidate)) {
    return { format: "numeric-shape", encoded: candidate };
  }
  if (decodeTimetableShapeShare(candidate)) return { format: "shape", encoded: candidate };
  return null;
}

/**
 * What did they paste? Returns null when it is none of the four share shapes.
 *
 * Deliberately free of side effects: the add-friend field validates on blur
 * without spending a report fetch, and a typo still fails before any network
 * round trip.
 */
export function parseShareInput(raw: string): ParsedShareInput | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return readQueryParam(trimmed) ?? detectBareCode(trimmed);
}

/**
 * Load a semester's registration report: the class-ID → course table that
 * every report-backed share payload is written against.
 *
 * No cache here on purpose — the planner already holds the current semester's
 * report in state and passes it to {@link resolveShareInput}, so this runs
 * only for a semester the caller does not have (the standalone share page, or
 * a friend's link written against the previous term).
 */
export async function fetchSemesterReport(semesterId: FFCSSemesterId): Promise<ParsedCourse[]> {
  const semester = getFFCSSemester(semesterId);
  let response: Response;
  try {
    response = await fetch(getAssetPath(semester.path));
  } catch {
    throw new ShareInputError(
      "network",
      `Could not download the ${semester.name}. Check your connection and try again.`,
    );
  }
  if (!response.ok) {
    throw new ShareInputError("network", `Could not download the ${semester.name} (HTTP ${response.status}).`);
  }
  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return parseReportRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet));
  } catch (err) {
    if (err instanceof ShareInputError) throw err;
    throw new ShareInputError(
      "network",
      `The ${semester.name} could not be read. Try again once your connection is stable.`,
    );
  }
}

interface ReportBackedPayload {
  semesterId: FFCSSemesterId;
  classIds: string[];
  /** Shape links carry no name (that is what makes them short). */
  name: string;
}

function readReportBacked(input: ParsedShareInput): ReportBackedPayload {
  if (input.format === "shape") {
    const payload = decodeTimetableShapeShare(input.encoded);
    if (payload) return { ...payload, name: "Shared timetable" };
  } else if (input.format === "numeric-shape") {
    const payload = decodeNumericTimetableShapeShare(input.encoded);
    if (payload) return { ...payload, name: "Shared timetable" };
  } else if (input.format === "compact") {
    const wire = decodeCompactTimetableShare(input.encoded);
    if (wire) {
      return {
        semesterId: wire.s,
        classIds: wire.i.map((suffix) => `${wire.p}${suffix}`),
        name: wire.n,
      };
    }
  }
  throw new ShareInputError("unreadable", UNREADABLE_MESSAGE);
}

/** A resolved report row as the planner stores it inside a timetable. */
function toSharedCourse(course: ParsedCourse, index: number) {
  const classIds = course.CLASS_IDS?.length ? course.CLASS_IDS : course.CLASS_ID ? [course.CLASS_ID] : [];
  const isSoftSkill = course.CODE.trim().toUpperCase().startsWith("BASTS");
  return {
    id: `share-${classIds.join("-") || course.CLASS_ID || index}`,
    code: course.CODE,
    title: course.TITLE,
    slots: splitSlots(course.SLOT),
    faculty: course.FACULTY,
    employeeId: course.ERP_ID,
    classId: course.CLASS_ID,
    classIds,
    venue: course.ROOM,
    credits: course.CREDITS,
    type: isSoftSkill ? "SS" : course.TYPE || (course.SLOT.includes("L") ? "Lab" : "Theory"),
    color: COLORS[index % COLORS.length],
    batch: course.BATCH,
  };
}

export interface ResolveShareOptions {
  /**
   * The caller's already-parsed report for `reportSemesterId`. Used only when
   * it matches the semester the payload was written against, so a link from
   * last term still forces its own download.
   */
  reportCourses?: readonly ParsedCourse[] | null;
  reportSemesterId?: FFCSSemesterId | null;
}

/**
 * Turn a parsed link or code into the timetable it carries.
 *
 * The three report-backed formats resolve identically: class IDs → rows of
 * the semester's report → batched groups → timetable. That is the same path
 * the share page takes, which is what makes a link opened by a friend and a
 * link pasted into "add friend" show the same courses.
 */
export async function resolveShareInput(
  input: ParsedShareInput,
  options: ResolveShareOptions = {},
): Promise<ResolvedShare> {
  if (input.format === "full") {
    // Self-contained: the full link carries the courses themselves, so it
    // needs no report and no network at all.
    const decoded = decodeTimetableShare(input.encoded);
    if (!decoded) throw new ShareInputError("unreadable", UNREADABLE_MESSAGE);
    return decoded;
  }

  const payload = readReportBacked(input);
  const semester = getFFCSSemester(payload.semesterId);
  const hasReport = Boolean(options.reportCourses?.length) && options.reportSemesterId === payload.semesterId;
  const reportCourses = hasReport
    ? (options.reportCourses as readonly ParsedCourse[])
    : await fetchSemesterReport(payload.semesterId);

  const selected = payload.classIds.map((classId) =>
    reportCourses.find((course) => course.CLASS_ID?.trim() === classId),
  );
  if (selected.some((course) => !course)) {
    throw new ShareInputError(
      "report",
      `This code was written against a different course list: one or more of its class IDs are not in the ${semester.name}.`,
    );
  }
  const resolved = selected.filter((course): course is ParsedCourse => Boolean(course));
  const grouped = groupSharedReportCourses(resolved);

  return {
    timetable: {
      id: `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: payload.name,
      courses: grouped.map(toSharedCourse),
    },
    campus: GLOBAL_CAMPUS,
  };
}

/** Parse and resolve in one call — the shape the add-friend field uses. */
export async function loadShareInput(raw: string, options: ResolveShareOptions = {}): Promise<ResolvedShare> {
  const input = parseShareInput(raw);
  if (!input) throw new ShareInputError("unreadable", UNREADABLE_MESSAGE);
  return resolveShareInput(input, options);
}
