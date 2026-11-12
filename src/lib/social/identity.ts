/**
 * Reading the current user's registration number and name.
 *
 * There are two live shapes for the `profile` localStorage blob and three
 * readers in the app, all of which were wrong:
 *
 *   - Live, written by `ProfilePage` from `/api/whoami` (identity/profile data):
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

function isLikelyRegNo(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return REG_NO_RE.test(trimmed) || /^[0-9]{2}[A-Z]+[0-9]+$/i.test(trimmed);
}

function normalizeRegNo(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return isLikelyRegNo(trimmed) ? trimmed.toUpperCase() : trimmed;
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
 * It prioritizes genuine VIT registration numbers (e.g. 25BLC1081) across
 * credentials, payments, profile, and attendance over purely numeric enrollment/
 * application numbers (e.g. 20626703).
 */
export function getActiveRegNumber(): string {
  const regCandidates: string[] = [];
  const fallbackCandidates: string[] = [];

  const addCandidate = (val: unknown) => {
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (!trimmed || trimmed.toUpperCase() === "DEMO" || trimmed.toUpperCase() === "DEMO123") return;
      const normalized = normalizeRegNo(trimmed);
      if (isLikelyRegNo(trimmed)) {
        if (!regCandidates.includes(normalized)) regCandidates.push(normalized);
      } else {
        if (!fallbackCandidates.includes(normalized)) fallbackCandidates.push(normalized);
      }
    }
  };

  // 1. Storage credentials / session identifiers (VTOP username / authorizedID)
  try {
    const ids = storage.ids.get();
    addCandidate(ids?.VtopUsername);
    addCandidate(storage.username.get());
    addCandidate(storage.vtopSession.get()?.authorizedID);
  } catch {}

  // 2. Payments cache (authoritative receipt info where VTOP always records registerNo)
  const payments = readJson("payments");
  const payInfo = (payments?.studentInfo ?? payments) as Record<string, unknown> | null;
  if (payInfo && typeof payInfo === "object") {
    for (const key of REG_KEYS) {
      if (isUsable(payInfo[key])) addCandidate(payInfo[key]);
    }
  }

  // 3. Profile
  const profile = readJson("profile");
  if (profile) {
    for (const key of REG_KEYS) {
      if (isUsable(profile[key])) addCandidate(profile[key]);
    }
  }

  // 4. Attendance
  const attendance = readJson("attendance");
  const info = attendance?.studentInfo;
  if (info && typeof info === "object") {
    const rec = info as Record<string, unknown>;
    for (const key of REG_KEYS) {
      if (isUsable(rec[key])) addCandidate(rec[key]);
    }
  }

  // If any candidate is a genuine VIT registration number (e.g. 25BLC1081), it always wins
  if (regCandidates.length > 0) {
    return regCandidates[0];
  }

  // Otherwise fall back to the first usable identifier (e.g. numeric application number 20626703)
  if (fallbackCandidates.length > 0) {
    return fallbackCandidates[0];
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
