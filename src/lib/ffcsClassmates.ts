/**
 * FFCS friend finder ("Find classmates"): client side.
 *
 * The server does everything that matters. It learns who the caller is from
 * the VTOP session, checks the plan against the semester's registration
 * report (or reads the registered timetable from VTOP itself), and computes
 * the matches. This module only turns a planner timetable into class ids and
 * makes the one call. Route: amazecc-api `POST /api/social/ffcs-match`.
 *
 * A class id is one section (course component + faculty + slot), so sharing a
 * class id means being in the same class.
 */

import { apiRequest } from "@/lib/sync-engine/request-layer";
// Imported directly, not through the sync-engine barrel: on the standalone
// planner route nothing else loads it, and it is what attaches the VTOP session
// to `auth: "vtop"` requests. Without it every call left with no session.
import { credentialManager } from "@/lib/sync-engine/credential-manager";
import { AuthError } from "@/lib/sync-engine/errors";
import type { FFCSSemesterId } from "@/lib/ffcsReports";

export type ClassmateSource = "planned" | "registered";

export type ClassmatePerson = {
  handle: string;
  name: string;
  source: ClassmateSource;
  regNo?: string;
};

export type ClassmateOffering = {
  classId: string;
  code: string;
  title: string;
  type: string;
  credits: string;
  room: string;
  slot: string;
  faculty: string;
};

export type ClassmateSection = {
  classId: string;
  offering: ClassmateOffering | null;
  registerNos?: string[];
  people: ClassmatePerson[];
};

export type ClassmateOverlap = ClassmatePerson & {
  shared: number;
  sharedClassIds: string[];
  identical: boolean;
  updatedAt: string;
  regNo?: string;
};

export type ClassmatesState = {
  semesterId: string;
  participants: number;
  me: {
    handle: string;
    name: string;
    joined: boolean;
    discoverable: boolean;
    source: ClassmateSource | null;
    classIds: string[];
    updatedAt: string | null;
    changesLeft: number;
  };
  sections: ClassmateSection[];
  overlaps: ClassmateOverlap[];
};

export type ClassmatesRequest =
  | { op: "get" }
  | { op: "publish"; source: "registered"; discoverable?: boolean }
  | { op: "visibility"; discoverable: boolean }
  | { op: "leave" };

/** Messages for the server's error codes, written for the student reading them. */
const ERROR_MESSAGES: Record<string, string> = {
  signin_required: "Your VTOP sign-in needs refreshing before you can use the friend finder.",
  missing_credentials: "Your VTOP sign-in needs refreshing before you can use the friend finder.",
  vtop_session_expired: "Your VTOP session expired. Sign in again and retry.",
  vtop_identity_unresolved: "VTOP didn't confirm who you are. Sign in again and retry.",
  vtop_unavailable: "VTOP isn't responding right now. Try again in a bit.",
  semester_not_supported: "The friend finder isn't open for this semester.",
  report_unavailable: "Couldn't load this semester's course list. Try again in a bit.",
  database_unavailable: "The friend finder is temporarily unavailable.",
  empty_plan: "This timetable has no classes yet.",
  plan_too_large: "This timetable has too many classes to share.",
  invalid_class_id: "Some classes in this timetable aren't from the final course list.",
  semester_mismatch: "Some classes in this timetable belong to another semester.",
  class_not_offered: "Some classes in this timetable aren't in the final course list. Re-pick them and try again.",
  duplicate_course: "This timetable has two sections of the same course. Keep one and try again.",
  slot_clash: "This timetable has a slot clash. Fix it and try again.",
  change_limit: "You've changed your classes too many times today. Try again tomorrow.",
  no_registered_classes: "VTOP shows no registered classes for this semester yet.",
  planned_sharing_disabled: "Only VTOP-verified timetables can be shared.",
  not_joined: "Share your classes first.",
};

/** Errors only a fresh VTOP sign-in can fix; "try again" would just fail the same way. */
const SIGN_IN_CODES = new Set([
  "signin_required",
  "missing_credentials",
  "vtop_session_expired",
  "vtop_identity_unresolved",
]);

export class ClassmatesError extends Error {
  readonly code: string;
  constructor(code: string, detail?: string) {
    super(ERROR_MESSAGES[code] ?? detail ?? "Something went wrong. Try again.");
    this.name = "ClassmatesError";
    this.code = code;
  }

  get needsSignIn(): boolean {
    return SIGN_IN_CODES.has(this.code);
  }
}

/**
 * Make sure a VTOP session exists, logging in with the saved credentials if
 * not. The credential manager deliberately never does this as a side effect of
 * a request (a VTOP login solves a captcha), so the friend finder, which the
 * student just opened, is the explicit caller that asks for it.
 */
export async function ensureClassmatesSession(forceNew = false): Promise<void> {
  try {
    await credentialManager.ensureVtopSession({ forceNew });
  } catch (err) {
    if (err instanceof AuthError) throw new ClassmatesError("signin_required", err.message);
    throw new ClassmatesError("vtop_unavailable");
  }
}

/**
 * The VTOP semester the finder runs against. Only the upcoming next semester
 * qualifies (CH20262705): current/previous semesters are disabled for sharing.
 */
export function classmatesSemester(semesterId: FFCSSemesterId): string | null {
  if (semesterId === "winter-2026-2027") return "CH20262705";
  return null;
}

/** Event broadcast on sync success so an open friend finder tab can refresh. */
export const FRIEND_FINDER_REFRESH_EVENT = "amaze_friend_finder_refresh";

/** Dispatches the refresh event to listeners in an open friend finder tab. */
export function broadcastFriendFinderRefresh(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(FRIEND_FINDER_REFRESH_EVENT));
  } catch {
    // SSR or unsupported environment guard
  }
}

/** VTOP names arrive in capitals: "MOHAMMED ANAS" → "Mohammed Anas". */
export function displayName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/(^|[\s.'-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
      // Short codes in brackets are acronyms, not names: "ETHNUS (APT)" → "Ethnus (APT)".
      .replace(/\(([\p{L}]{1,5})\)/gu, (_, code: string) => `(${code.toUpperCase()})`)
      .trim()
  );
}

export async function callClassmates(semesterId: string, request: ClassmatesRequest): Promise<ClassmatesState> {
  await ensureClassmatesSession();
  let json: Record<string, unknown> | null;
  try {
    json = (await apiRequest("social/ffcs-match", {
      method: "POST",
      auth: "vtop",
      body: { ...request, semesterId },
    })) as Record<string, unknown> | null;
  } catch (err) {
    if (err instanceof AuthError) throw new ClassmatesError("signin_required", err.message);
    throw err;
  }

  if (!json || json.success === false) {
    throw new ClassmatesError(
      String(json?.error ?? "unknown"),
      typeof json?.detail === "string" ? json.detail : undefined,
    );
  }
  const state = json as unknown as ClassmatesState;
  if (!state.me || !Array.isArray(state.sections) || !Array.isArray(state.overlaps)) {
    throw new ClassmatesError("unexpected_response", "The server did not return friend finder data.");
  }
  return state;
}
