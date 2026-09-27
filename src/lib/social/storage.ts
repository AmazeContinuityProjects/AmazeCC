/**
 * Namespaced local storage for the social feature.
 *
 * Two problems with the previous scheme, which lived inline in
 * `socialUtils.ts` and is replaced by this module:
 *
 * 1. **Every write hit two keys.** `saveFriend` wrote both
 *    `friends_schedules_<reg>` and the bare `friends_schedules`:
 *
 *        localStorage.setItem(key, JSON.stringify(friends));
 *        localStorage.setItem("friends_schedules", JSON.stringify(friends));
 *
 *    The global mirror handed the last-touched student's friends to any other
 *    account on the same browser, and `getFriends()` with no active reg
 *    returned exactly that leak.
 *
 * 2. **Reg resolution always failed**, so in practice every read and write
 *    went to the bare global key anyway. There is nothing to preserve here:
 *    the data is one blob under one key, and the copy-forward below carries it
 *    into the namespaced key on first use.
 *
 * Writes here are namespaced only. The global keys are read exactly once, as
 * a migration source, and are never written again.
 */

import { getActiveRegNumber } from "./identity";

/** Legacy un-namespaced keys. Read-only from here on. */
export const LEGACY_FRIENDS_KEY = "friends_schedules";
export const LEGACY_GROUPS_KEY = "friends_groups";

/** Marker so the migration runs at most once per reg number. */
const MIGRATED_FLAG = "social_storage_migrated_v1";

export function friendsKey(reg: string): string {
  return `social_friends_v1_${reg}`;
}

export function groupsKey(reg: string): string {
  return `social_groups_v1_${reg}`;
}

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Quota or private-mode. Losing a social list is not worth a throw.
  }
}

function parseArray<T>(raw: string | null): T[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/**
 * One-time copy-forward from the legacy global keys.
 *
 * Returns true when a migration actually happened. Safe to call on every
 * read: the flag makes it idempotent, and it is a no-op when the namespaced
 * key already has data (so it can never clobber a real list with the
 * leftovers of another account).
 */
export function migrateLegacyStore(reg: string): boolean {
  if (typeof window === "undefined" || !reg) return false;

  const flag = `${MIGRATED_FLAG}_${reg}`;
  if (safeGet(flag) === "1") return false;

  let migrated = false;

  const targetFriends = friendsKey(reg);
  if (!safeGet(targetFriends)) {
    const legacy = parseArray<unknown>(safeGet(LEGACY_FRIENDS_KEY));
    if (legacy && legacy.length > 0) {
      safeSet(targetFriends, JSON.stringify(legacy));
      migrated = true;
    }
  }

  const targetGroups = groupsKey(reg);
  if (!safeGet(targetGroups)) {
    const legacy = parseArray<unknown>(safeGet(LEGACY_GROUPS_KEY));
    if (legacy && legacy.length > 0) {
      safeSet(targetGroups, JSON.stringify(legacy));
      migrated = true;
    }
  }

  safeSet(flag, "1");
  return migrated;
}

function readNamespaced<T>(key: string, legacyKey: string, reg: string): T[] {
  const own = parseArray<T>(safeGet(key));
  if (own) return own;
  // Pre-migration read: fall back to the legacy blob so the list is not lost
  // on the very first load after the reg fix.
  const legacy = parseArray<T>(safeGet(legacyKey));
  return legacy ?? [];
}

export function readList<T>(kind: "friends" | "groups", reg?: string): T[] {
  const resolved = reg || getActiveRegNumber();
  if (!resolved) return [];
  migrateLegacyStore(resolved);
  return kind === "friends"
    ? readNamespaced<T>(friendsKey(resolved), LEGACY_FRIENDS_KEY, resolved)
    : readNamespaced<T>(groupsKey(resolved), LEGACY_GROUPS_KEY, resolved);
}

export function writeList<T>(kind: "friends" | "groups", value: T[], reg?: string): boolean {
  const resolved = reg || getActiveRegNumber();
  if (!resolved) return false;
  safeSet(
    kind === "friends" ? friendsKey(resolved) : groupsKey(resolved),
    JSON.stringify(value)
  );
  return true;
}

/* ------------------------------------------------------------------ *
 * Server-derived state
 * ------------------------------------------------------------------ */

/**
 * The grant secret is a bearer credential: whoever holds it can read the
 * other person's timetable. It is stored per reg number, never in a global
 * key, for the same reason the friends list is — the global mirror handed one
 * account's data to another account on the same browser.
 *
 * This is the existing posture for this app (VTOP credentials already live in
 * `localStorage`), not an endorsement of it. It is called out in
 * docs/social-tt/08-security-and-privacy.md as the one risk this design does
 * not address.
 */
export function grantsKey(reg: string): string {
  return `social_grants_v1_${reg}`;
}

export function identityKey(reg: string): string {
  return `social_identity_v1_${reg}`;
}

/** Cached peer timetables, keyed by handle so a term switch can invalidate. */
function peerTimetableKey(reg: string, handle: string): string {
  return `social_peer_tt_v1_${reg}_${handle}`;
}

function readJson<T>(key: string): T | null {
  const raw = safeGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Grant secrets and the derived identity.
 *
 * A write is a full replace, not a merge: the server is authoritative about
 * which pairings exist, so a locally-orphaned secret would otherwise linger
 * forever and keep being sent on reads that 403.
 */
export function readGrants<T>(reg?: string): T[] {
  const resolved = reg || getActiveRegNumber();
  if (!resolved) return [];
  return readJson<T[]>(grantsKey(resolved)) ?? [];
}

export function writeGrants<T>(value: T[], reg?: string): boolean {
  const resolved = reg || getActiveRegNumber();
  if (!resolved) return false;
  safeSet(grantsKey(resolved), JSON.stringify(value));
  return true;
}

export function readIdentity<T>(reg?: string): T | null {
  const resolved = reg || getActiveRegNumber();
  if (!resolved) return null;
  return readJson<T>(identityKey(resolved));
}

export function writeIdentity<T>(value: T, reg?: string): boolean {
  const resolved = reg || getActiveRegNumber();
  if (!resolved) return false;
  safeSet(identityKey(resolved), JSON.stringify(value));
  return true;
}

/**
 * The user's OWN derived timetable, cached so the app can draw the grid and
 * the comparison before the first sync of the session finishes.
 */
export function readOwnTimetable<T>(reg?: string): T | null {
  const resolved = reg || getActiveRegNumber();
  if (!resolved) return null;
  return readJson<T>(identityKey(resolved) + "_tt");
}

export function writeOwnTimetable<T>(value: T, reg?: string): boolean {
  const resolved = reg || getActiveRegNumber();
  if (!resolved) return false;
  safeSet(identityKey(resolved) + "_tt", JSON.stringify(value));
  return true;
}

export function readPeerTimetable<T>(handle: string, reg?: string): T | null {
  const resolved = reg || getActiveRegNumber();
  if (!resolved) return null;
  return readJson<T>(peerTimetableKey(resolved, handle));
}

export function writePeerTimetable<T>(handle: string, value: T, reg?: string): boolean {
  const resolved = reg || getActiveRegNumber();
  if (!resolved) return false;
  safeSet(peerTimetableKey(resolved, handle), JSON.stringify(value));
  return true;
}

/**
 * Drop every cached peer timetable, called when the term changes. A busy map
 * from the previous semester is not "slightly off", it is a different
 * schedule, so it must not survive a switch.
 */
export function clearPeerTimetables(reg?: string): void {
  const resolved = reg || getActiveRegNumber();
  if (!resolved || typeof window === "undefined") return;
  const prefix = `social_peer_tt_v1_${resolved}_`;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) doomed.push(k);
    }
    for (const k of doomed) window.localStorage.removeItem(k);
  } catch {
    /* private mode; nothing to clear */
  }
}

/** Test seam: clears only this module's keys for one reg number. */
export function _resetForTests(reg: string): void {
  if (typeof window === "undefined") return;
  const peerPrefix = `social_peer_tt_v1_${reg}_`;
  const doomed: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (k && k.startsWith(peerPrefix)) doomed.push(k);
  }
  for (const k of [
    friendsKey(reg),
    groupsKey(reg),
    grantsKey(reg),
    identityKey(reg),
    identityKey(reg) + "_tt",
    `${MIGRATED_FLAG}_${reg}`,
    ...doomed,
  ]) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}
