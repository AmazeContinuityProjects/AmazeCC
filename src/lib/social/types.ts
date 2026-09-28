/**
 * Shared shapes for the social timetable feature.
 *
 * Mirrored on the backend in `AmazeCC-API/src/lib/socialTypes.ts`. Kept in one
 * place per repo so the two cannot drift silently — the wire contract is
 * documented in docs/social-tt/07-api-contract.md.
 */

export type SocialVisibility = "coarse" | "full";

/** One occupied slot. Coarse mode returns `{}` — keys only, no values. */
export type BusyEntry = {
  c?: string; // course code
  t?: string; // course title
  v?: string; // venue
};

/** Keyed `"DAY:SLOTID"` — e.g. `"MON:A1"`. See docs/social-tt/09-schedule-math.md. */
export type BusyMap = Record<string, BusyEntry>;

/** A grant secret as the sync response returns it. */
export type SocialStoredGrant = {
  grantId: string;
  secret: string;
  peerHandle: string | null;
  visibility: SocialVisibility;
  createdAt: string;
};

/**
 * The `POST /api/social/identity/sync` response, as the sync op consumes it.
 *
 * Declared here rather than in `client.ts` because `operations.ts` needs the
 * shape and must not import the client — the client goes through `api`, while
 * the op goes through `ctx.request` for retry and in-flight dedupe.
 */
export type SocialSyncPayload = {
  success: boolean;
  identity: SocialIdentity;
  semesterSource: string;
  version: number;
  busyMap: BusyMap;
  courses: SocialCourse[];
  peers: SocialPeer[];
  grantSecrets: SocialStoredGrant[];
};

export type SocialCourse = {
  code: string;
  title: string;
  venue: string;
  ltpjc: string;
  /**
   * The `Category` COLUMN — a course taxonomy, not a component type:
   * "University Core Courses", "Programme Core Courses", …
   */
  category: string;
  /**
   * The component type from the parenthesised suffix of VTOP's `Course` cell:
   * "Lab Only", "Embedded Theory", "Embedded Lab", "Theory Only".
   *
   * This is the authoritative theory/lab discriminator. Not `category`, and
   * not whether a slot id begins with "L" — the existing
   * `fetchTimeTable.ts` makes that last mistake and misclassifies `F1+TF1`,
   * an Embedded **Theory** course, as a lab.
   */
  componentType: string;
  /** VTOP class id, e.g. "CH2026270102069" — embeds the semester code. */
  classId: string;
  faculty: string;
};

export interface SocialIdentity {
  /** Cached for display and short-circuiting only. Never trusted server-side. */
  ownerKey: string;
  /** Public, hand-typeable, e.g. "AMZ-4F7K-2Q9X". */
  handle: string;
  displayName: string;
  semesterId: string;
  semesterLabel: string;
  derivedAt: string;
  slotmapVersion: string;
}

export interface SocialTimetable {
  ownerKey: string;
  semesterId: string;
  semesterLabel: string;
  version: number;
  busyMap: BusyMap;
  courses: SocialCourse[];
  publishedAt: string;
  slotmapVersion: string;
}

export interface SocialGrant {
  grantId: string;
  /**
   * Plaintext bearer credential. Stored client-side under a namespaced key and,
   * server-side, only as `secret_enc` (AES-256-GCM) — never as plaintext.
   */
  secret: string;
  peerHandle: string;
  peerName: string;
  visibility: SocialVisibility;
  createdAt: string;
  semesters: string[];
}

export interface SocialPeer {
  handle: string;
  name: string;
  visibility: SocialVisibility;
  shared: boolean;
  lastPublishedAt: string | null;
  semesterId: string | null;
  isSelf: boolean;
}

/**
 * A peer's record older than this is badged as stale. It is not neutral
 * information: someone who dropped a class still reads as busy until they
 * sync, so the comparison built on it can be actively wrong.
 */
export const STALE_AFTER_DAYS = 14;

/** Pull `c`/`t`/`v` out of a busy map for a `coarse` grant. */
export function toCoarse(busyMap: BusyMap): BusyMap {
  const out: BusyMap = {};
  for (const key of Object.keys(busyMap)) out[key] = {};
  return out;
}
