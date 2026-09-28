/**
 * Typed wrappers for the social routes.
 *
 * Two things this deliberately does NOT do:
 *
 * 1. **It does not cache.** Every call is a fresh read of server truth. The
 *    cache lives in `storage.ts` and is written by the `social` sync op, not
 *    here, so there is exactly one writer.
 * 2. **It does not swallow errors.** These return the parsed envelope and let
 *    the caller decide, because "the pair was not found" and "VTOP is down" are
 *    different things a UI must say differently.
 *
 * Route shapes are documented in docs/social-tt/07-api-contract.md.
 */

import { api } from "@/lib/sync-engine";
import type {
  BusyMap,
  SocialCourse,
  SocialIdentity,
  SocialPeer,
  SocialStoredGrant,
  SocialSyncPayload,
  SocialVisibility,
} from "./types";

/* ------------------------------------------------------------------ *
 * Envelopes
 * ------------------------------------------------------------------ */

/** What the server tells us about a peer when we read their timetable. */
export type PeerTimetableIdentity = Omit<SocialIdentity, "ownerKey" | "derivedAt"> & {
  publishedAt: string;
};

export type StoredGrant = SocialStoredGrant;

export type SyncResponse = SocialSyncPayload;

export type ClaimResponse = {
  success: boolean;
  grantId: string;
  secret: string;
  /** false when the pair already existed and the secret was NOT rotated. */
  created: boolean;
  visibility: SocialVisibility;
  peer: {
    handle: string;
    name: string;
    lastPublishedAt: string | null;
    semesters: string[];
  };
};

export type PeerTimetableResponse = {
  success: boolean;
  identity: PeerTimetableIdentity;
  visibility: SocialVisibility;
  /** true when publishedAt is older than STALE_AFTER_DAYS. */
  stale: boolean;
  version: number;
  busyMap: BusyMap;
  courses: SocialCourse[];
};

export type PersonResponse = {
  success: boolean;
  person: { handle: string; displayName: string; alreadyPaired: boolean };
};

export type SemesterResponse = {
  success: boolean;
  semesterId: string;
  semesterLabel: string;
  resolvedAt: string | null;
};

/* ------------------------------------------------------------------ *
 * Error handling
 * ------------------------------------------------------------------ */

/**
 * A failed social call, carrying the server's machine-readable `error` code.
 *
 * This type exists because `apiRequest` **does not throw on a non-2xx status** —
 * it only throws for auth-flavoured bodies and otherwise returns the parsed JSON
 * whether it succeeded or not. A `404 { success: false, error: "handle_not_found" }`
 * therefore arrives as an ordinary object.
 *
 * That is a live trap: a caller that treats "did not throw" as "it worked" shows
 * a success state for a handle nobody has. So every wrapper below runs its
 * response through `unwrap`, which turns an error body into a thrown
 * `SocialApiError`, and then checks the expected field is actually present.
 */
export class SocialApiError extends Error {
  /** The server's `error` code, e.g. "handle_not_found". */
  readonly code: string;
  /** The server's human-readable `detail`, when it sent one. */
  readonly detail?: string;

  constructor(code: string, detail?: string) {
    super(detail || code);
    this.name = "SocialApiError";
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Throws if the body is an error envelope, or is missing what we need.
 *
 * `require` probes the RAW body, so it is typed `(v: any)`: a runtime shape
 * check cannot be expressed against the declared `T`, which for some routes is
 * narrower than what the predicate needs to look at. The returned `T` is still
 * the caller's declared type, so callers keep their own type safety.
 */
function unwrap<T>(json: unknown, require: (v: any) => boolean, what: string): T {
  const body = (json ?? {}) as Record<string, unknown>;
  if (body.success === false) {
    throw new SocialApiError(
      String(body.error || "unknown"),
      typeof body.detail === "string" ? body.detail : undefined
    );
  }
  if (!require(json as T)) {
    // A 2xx-shaped body that is not the shape we asked for. Usually a proxy
    // answering instead of the API, so the message says so rather than
    // pretending the peer does not exist.
    throw new SocialApiError("unexpected_response", `The server did not return ${what}.`);
  }
  return json as T;
}

/* ------------------------------------------------------------------ *
 * Calls
 * ------------------------------------------------------------------ */

/**
 * Push our own derived state and pull peers + grant secrets.
 *
 * Goes through `api` (not `ctx.request`) because this module is also called
 * from the debounced auto-push, outside the sync engine. The engine's own
 * invocation uses `ctx.request` so it gets retry and in-flight dedupe.
 */
export async function syncIdentity(proposedSemesterId?: string): Promise<SyncResponse> {
  const json = await api("social/identity/sync", {
    method: "POST",
    auth: "vtop",
    body: proposedSemesterId ? { proposedSemesterId } : {},
  });
  return unwrap<SyncResponse>(json, (v) => Boolean(v?.identity?.handle), "an identity");
}

export async function lookupPerson(handle: string): Promise<PersonResponse> {
  const json = await api("social/people", {
    method: "POST",
    auth: "vtop",
    body: { handle },
  });
  // The field check is the part that matters: without it a `handle_not_found`
  // body (or a proxy's HTML) resolves as a person-shaped object.
  return unwrap<PersonResponse>(json, (v) => typeof v?.person?.handle === "string", "a person");
}

export async function claimPair(
  handle: string,
  visibility: SocialVisibility = "coarse"
): Promise<ClaimResponse> {
  const json = await api("social/pair/claim", {
    method: "POST",
    auth: "vtop",
    body: { handle, visibility },
  });
  return unwrap<ClaimResponse>(json, (v) => Boolean(v?.grantId && v?.secret), "a pairing");
}

/**
 * Read a peer's timetable.
 *
 * POST, not GET: `secret` is a bearer credential and a credential in a query
 * string ends up in access logs and browser history.
 */
export async function readPeerTimetable(
  secret: string,
  handle: string,
  semester?: string
): Promise<PeerTimetableResponse> {
  const json = await api("social/timetable", {
    method: "POST",
    auth: "vtop",
    body: { secret, handle, ...(semester ? { semester } : {}) },
  });
  return unwrap<PeerTimetableResponse>(json, (v) => Boolean(v?.identity?.handle), "a timetable");
}

export async function revokeGrant(grantId: string, secret: string): Promise<{ success: boolean }> {
  const json = await api("social/grant/revoke", {
    method: "POST",
    auth: "vtop",
    body: { grantId, secret },
  });
  return unwrap<{ success: boolean }>(json, (v) => Boolean(v?.grantId), "a revocation");
}

export async function setGrantVisibility(
  grantId: string,
  visibility: SocialVisibility
): Promise<{ success: boolean; visibility: SocialVisibility }> {
  const json = await api("social/grant/visibility", {
    method: "POST",
    auth: "vtop",
    body: { grantId, visibility },
  });
  return unwrap<{ success: boolean; visibility: SocialVisibility }>(
    json,
    (v) => Boolean(v?.grantId),
    "a visibility change"
  );
}

/** The only route that needs no credentials — a semester code is not private. */
export async function fetchCurrentSemester(): Promise<SemesterResponse> {
  const json = await api("social/semester", { method: "GET", auth: "none" });
  return unwrap<SemesterResponse>(json, (v) => typeof v?.semesterId === "string", "a semester");
}
