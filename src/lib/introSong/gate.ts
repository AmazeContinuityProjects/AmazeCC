/**
 * One-time intro song, gated by the student's VTOP identity.
 *
 * ## Why this is a local audio file and not a streamed YouTube/Drive URL
 *
 * A YouTube iframe cannot be played hidden: the IFrame Player has no audio-only
 * mode, and browser autoplay policies require a user gesture before an iframe can
 * start audio at all, so a `display:none` or 1×1 embed never begins playing. Its
 * embed policies also do not permit background playback outside the official
 * player. A plain `<audio>` element has neither problem.
 *
 * A Google Drive URL is not usable as a source either, for three independent
 * reasons, none of which are fixable in this app:
 *
 *   1. `.../file/d/<id>/view` returns an HTML viewer page, which does not decode.
 *   2. `uc?export=download` responds with `Content-Disposition: attachment`, so
 *      the browser treats it as a file download rather than a media stream.
 *   3. Drive sends no `Access-Control-Allow-Origin` header, so a cross-origin
 *      `fetch()` for the bytes is blocked before the response is even read.
 *
 * So the asset is bundled under `public/audio/`. If you later move it to a real
 * static host that serves the bytes with permissive CORS, change
 * `INTRO_SONG_SRC` to that absolute URL and nothing else needs to move.
 *
 * ## The one-time guarantee
 *
 * The flag is written when playback actually **starts**, not when we try. If the
 * browser refuses to play, the flag is not set, so the song is not silently
 * burned on a device that never heard it.
 *
 * The flag is namespaced per student. Two people sharing a browser (a lab machine,
 * a family tablet) each get their own first play rather than the second one
 * inheriting the first one's. The number is preferred as the key because it is
 * stable across logins, where a session id is minted per login.
 *
 * The `v2` suffix is the reset lever: bump it and every device plays again, which
 * is what to do when the audio is replaced.
 */

import { getActiveRegNumber } from "@/lib/social/identity";
import { storage } from "@/lib/storage";

export const INTRO_SONG_KEY = "intro_song_played_v2";

/**
 * Streamed from a Craft-hosted `secure-res` asset.
 *
 * Verified before wiring: `200`, `Content-Type: video/webm`,
 * `Content-Length: 1654052`, and `206 Partial Content` on a Range request — so
 * the browser can seek without downloading the whole file first. Unlike the
 * YouTube-embed and Google-Drive options, this is a genuine direct media
 * response rather than an HTML wrapper, which is what makes it usable from
 * `<audio src>`.
 *
 * Note the MIME is `video/webm`. Browsers sniff the WebM container and play
 * the Opus track, so it works; `onError` reports a real failure rather than
 * relying on that.
 */
export const INTRO_SONG_SRC =
  "https://secure-res.craft.do/v2/4y9C1L6dYV52EjQbKY52DA8htcqkCbtsJgqX659crTz2XuMxoKn6wpgnKY8ZCrBTW8kzinS9kSfbAAR2WVJAiEDXckQFFrTmFH4KbocRPVG3ZpwdCxVnpSLTHnARCS8jDwUwi6nkd499Zdo5cVQ68sdbXAwcz547aXv1eNsVR4h733MdayFDzLqf7soYjTsYEbDUckq6NSC5p62ShSy2uj7dfzB/The%20Moaning%20Theme%20-%20Vikram%20_%20Kamal%20Haasan%20_%20ANIRUDH%20RAVICHANDER%20_%20Lokesh%20Kanagaraj.webm";

/**
 * Seek past the film sting; the track proper comes in after it.
 *
 * A seek, not a pre-cut file, because the source is remote and immutable — we
 * cannot re-encode it without a local copy. Range requests are supported, so
 * this does not wait for the full 1.6 MB to download.
 */
export const INTRO_SONG_START_SECONDS = 22;

/**
 * The allowlist, and what kind of thing each identifier actually is.
 *
 * There are two different numbers for one person, and the codebase calls both
 * of them a "reg number", which is how this file ended up asserting the wrong
 * one was which:
 *
 *   - the **register number** (`registerNo`, e.g. `25BLC1081`) is the VIT
 *     registration the student is issued. This is the allowlist. The VTOP
 *     payments payload carries it directly, which is why the gate reads it from
 *     there rather than from the profile.
 *   - the **application number** (`applicationNumber`, e.g. `20626022`) is the
 *     admissions number. It is a different identifier for the same person.
 *
 * Nothing in the codebase maps one to the other — they never meet — so they
 * stay in separate lists rather than one flat one, and a future reader cannot
 * assume a value may appear in either position. Both are accepted, so nobody is
 * locked out over which one their client happened to resolve.
 */

/** Register numbers (`registerNo`) — the primary allowlist. */
export const INTRO_SONG_ALLOWED_REG_NUMBERS: readonly string[] = [
  "25BLC1081",
  "25MID1139",
] as const;

/**
 * Application numbers (`applicationNumber`).
 *
 * Secondary, and deliberately so. The cached profile has no `REGISTER NO` row on
 * the VTOP page, so it falls back to the application number; a client that never
 * fetched payments would otherwise be locked out of a feature it is on the
 * allowlist for.
 */
export const INTRO_SONG_ALLOWED_APPLICATION_NUMBERS: readonly string[] = [
  "20626703",
  "2025001264",
] as const;

/** Union, for display in the diagnostic log only. Never used for matching. */
export const INTRO_SONG_ALLOWED_IDS: readonly string[] = [
  ...INTRO_SONG_ALLOWED_REG_NUMBERS,
  ...INTRO_SONG_ALLOWED_APPLICATION_NUMBERS,
] as const;

/** The `storage.cache` name the sync engine writes the VTOP `payments` payload to. */
const PAYMENTS_CACHE = "payments";

/**
 * The spellings `registerNo` has gone by across the payloads that carry it.
 *
 * The payments payload uses `registerNo`; the payments *type* in this repo
 * declares `registerNumber`, and the demo data uses that too. Both are read so a
 * rename in either direction cannot silently stop the song.
 */
const REGISTER_KEYS = [
  "registerNo",
  "registerNumber",
  "regNo",
  "regNumber",
] as const;

/**
 * The `registerNo` from the cached payments payload, or null.
 *
 * This is the authoritative source for the register number, and the reason the
 * gate does not lean on the profile: `getActiveRegNumber()` walks a fallback
 * chain that ends at `applicationNumber`, so a profile without a `REGISTER NO`
 * row yields a *different identifier* rather than no identifier — and matching
 * that against a register-number allowlist silently fails.
 */
export function getCachedRegisterNumber(): string | null {
  try {
    const cached = storage.cache.get(PAYMENTS_CACHE) as Record<string, any> | null;
    // `studentInfo` on the VTOP payload; the bare object is tolerated because
    // the two payments caches in this app are not written by the same code.
    const info = cached?.studentInfo ?? cached;
    if (!info || typeof info !== "object") return null;
    for (const key of REGISTER_KEYS) {
      const value = (info as Record<string, unknown>)[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  } catch {
    // A cache miss or unparseable blob is not an error — it just means this
    // source has nothing to say, and the next one may.
  }
  return null;
}

/**
 * The number to gate on *and* to namespace the flag by.
 *
 * One value for both, deliberately. If the allowlist could be satisfied by a
 * register number from one source while the flag was written under an identifier
 * from another, the song would replay on every visit for exactly the people it
 * was working for.
 */
export function getIntroSongRegisterNumber(): string {
  return getCachedRegisterNumber() || getActiveRegNumber();
}

function normalise(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function inList(
  value: string | null | undefined,
  list: readonly string[]
): boolean {
  const id = normalise(value);
  return id.length > 0 && list.includes(id);
}

export function isAllowedAuthorizedId(authorizedId: string | null | undefined): boolean {
  // A student's `authorizedID` is their register number, so this matches the
  // register list rather than one of its own. It stays a separate function
  // because the caller holds two arguments and should not have to know that
  // they are the same value for a student.
  return inList(authorizedId, INTRO_SONG_ALLOWED_REG_NUMBERS);
}

/** Accepts either kind of number, because the client may only have resolved one. */
export function isAllowedRegNumber(regNumber: string | null | undefined): boolean {
  return (
    inList(regNumber, INTRO_SONG_ALLOWED_REG_NUMBERS) ||
    inList(regNumber, INTRO_SONG_ALLOWED_APPLICATION_NUMBERS)
  );
}

/**
 * True when EITHER identifier is on the allowlist, or when the payments cache
 * names a register number that is.
 *
 * The cache is consulted last and only as a fallback, so an explicit argument
 * always wins — that keeps this a pure function of its arguments whenever the
 * caller has one, which is what makes it testable.
 */
export function isAllowedIdentifier(
  authorizedId?: string | null,
  regNumber?: string | null
): boolean {
  if (isAllowedAuthorizedId(authorizedId)) return true;
  if (isAllowedRegNumber(regNumber)) return true;
  return isAllowedRegNumber(getCachedRegisterNumber());
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
    // Private mode or quota. Worst case the song plays again next visit, which
    // is a far better failure than a thrown error during render.
  }
}

/** Prefers the number, so the flag survives a session id change. */
function flagKey(authorizedId?: string | null, regNumber?: string | null): string | null {
  const reg = String(regNumber ?? "").trim().toUpperCase();
  if (reg) return `${INTRO_SONG_KEY}_${reg}`;
  const id = String(authorizedId ?? "").trim().toUpperCase();
  return id ? `${INTRO_SONG_KEY}_${id}` : null;
}

export function hasPlayedIntroSong(
  authorizedId?: string | null,
  regNumber?: string | null
): boolean {
  const key = flagKey(authorizedId, regNumber);
  if (!key) return false;
  return safeGet(key) === "1";
}

export function markIntroSongPlayed(
  authorizedId?: string | null,
  regNumber?: string | null
): void {
  const key = flagKey(authorizedId, regNumber);
  if (!key) return;
  safeSet(key, "1");
}

/** Test seam, and the reset switch. */
export function clearIntroSongFlag(
  authorizedId?: string | null,
  regNumber?: string | null
): void {
  const key = flagKey(authorizedId, regNumber);
  if (typeof window === "undefined" || !key) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
