/**
 * Reading the current user's registration number and name.
 *
 * There are two live shapes for the `profile` localStorage blob and three
 * readers in the app, all of which were wrong:
 *
 *   - Live, written by `ProfilePage` from `/api/student` → `parseStudentProfile`:
 *     `{ registerNo, name }`
 *   - Demo, from `src/data/demoData.json`: `{ registerNumber, studentName }`
 *
 *   - `Main.tsx` read `p?.regNo`          → undefined on both
 *   - `socialUtils.ts` read `parsed?.regNumber` → undefined on the live shape
 *   - `SocialTab` read `attendanceData?.studentInfo?.regNumber`, but
 *     `attendanceRes` has no `studentInfo` field at all
 *
 * So the register number silently resolved to `""`, which meant the friends
 * list was stored under the un-namespaced global key and the cloud POST
 * early-returned. The chain below tries every spelling in order rather than
 * picking one and hoping.
 *
 * Server-side normalisation of the same value is `registerNo ||
 * applicationNumber` — see `AmazeCC-API/src/lib/identity.ts:175`.
 */

import { storage } from "@/lib/storage";

const REG_NO_RE = /^\d{2}[A-Z]{2,5}\d{3,5}$/i;

function normalizeRegNo(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().toUpperCase();
}

function isLikelyRegNo(value: unknown): value is string {
  return typeof value === "string" && REG_NO_RE.test(value.trim());
}

const REG_KEYS = ["registerNo", "registerNumber", "regNo", "regNumber", "applicationNumber"] as const;

const NAME_KEYS = ["name", "studentName", "fullName"] as const;

/** Values that mean "not actually set". */
function isUsable(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readJson(key: string): Record<string, unknown> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The current user's registration number, or "" when it cannot be determined.
 *
 * A returned value is used to namespace local storage and to label a share.
 * It is never used as an identity assertion: the server derives its own
 * `owner_key` from the VTOP session, and ignores any reg number in the body.
 */
export function getActiveRegNumber(): string {
  const profile = readJson("profile");
  if (profile) {
    for (const key of REG_KEYS) {
      if (isUsable(profile[key])) return normalizeRegNo(profile[key]);
    }
  }

  // The attendance blob is only a secondary source. `attendanceRes` declares
  // no studentInfo, so this is checked defensively rather than assumed.
  const attendance = readJson("attendance");
  const info = attendance?.studentInfo;
  if (info && typeof info === "object") {
    const rec = info as Record<string, unknown>;
    for (const key of REG_KEYS) {
      if (isUsable(rec[key])) return normalizeRegNo(rec[key]);
    }
  }

  // Login/sync flows persist the VTOP username/authorizedID as the registration
  // number before profile hydration completes; use them as a reliable fallback.
  try {
    const ids = storage.ids.get();
    const candidates = [ids?.VtopUsername, storage.username.get(), storage.vtopSession.get()?.authorizedID];
    for (const c of candidates) {
      if (isLikelyRegNo(c)) return normalizeRegNo(c);
    }
  } catch {
    // storage unavailable
  }

  return "";
}

export function getActiveDisplayName(): string {
  const profile = readJson("profile");
  if (profile) {
    for (const key of NAME_KEYS) {
      if (isUsable(profile[key])) return profile[key].trim();
    }
  }
  return "";
}

export function hasIdentity(): boolean {
  return getActiveRegNumber().length > 0;
}
