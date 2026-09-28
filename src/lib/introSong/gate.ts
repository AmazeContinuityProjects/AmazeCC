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
 * inheriting the first one's. The reg number is preferred as the key because it
 * is stable across logins, where `authorizedID` is minted per session.
 *
 * The `v2` suffix is the reset lever: bump it and every device plays again, which
 * is what to do when the audio is replaced.
 */

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
 * Allowlist, split by identifier namespace.
 *
 * These are two DIFFERENT identifiers that the app confusingly both calls a
 * "reg number", so they are kept in two lists rather than one flat one:
 *
 *   - `authorizedID` is the VTOP session/login id (`25BLC1081`). It is what
 *     clubs and cabshare persist, and the app parses its first two characters as
 *     an admission year.
 *   - the profile "reg number" is what `getActiveRegNumber()` actually returns.
 *     VTOP's profile page has no `REGISTER NO` row, so it always falls back to
 *     `applicationNumber` (`20626703`).
 *
 * Nothing in the codebase maps one to the other — they never meet. Keeping them
 * apart stops a future reader assuming a value can appear in either position.
 * `isAllowedIdentifier` ORs the two, so a person is let in by either.
 */

/** Matched against the VTOP `authorizedID`. */
export const INTRO_SONG_ALLOWED_AUTHORIZED_IDS: readonly string[] = [
  "25BLC1081",
  "25MID1139",
] as const;

/** Matched against `getActiveRegNumber()` — i.e. the profile `applicationNumber`. */
export const INTRO_SONG_ALLOWED_REG_NUMBERS: readonly string[] = ["20626703","2025001264"] as const;

/** Union, for display in the diagnostic log only. Never used for matching. */
export const INTRO_SONG_ALLOWED_IDS: readonly string[] = [
  ...INTRO_SONG_ALLOWED_AUTHORIZED_IDS,
  ...INTRO_SONG_ALLOWED_REG_NUMBERS,
] as const;

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
  return inList(authorizedId, INTRO_SONG_ALLOWED_AUTHORIZED_IDS);
}

export function isAllowedRegNumber(regNumber: string | null | undefined): boolean {
  return inList(regNumber, INTRO_SONG_ALLOWED_REG_NUMBERS);
}

/** True when EITHER identifier is on the allowlist. */
export function isAllowedIdentifier(
  authorizedId?: string | null,
  regNumber?: string | null
): boolean {
  return isAllowedAuthorizedId(authorizedId) || isAllowedRegNumber(regNumber);
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

/** Prefers the reg number, so the flag survives an `authorizedID` change. */
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
