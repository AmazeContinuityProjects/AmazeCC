/**
 * "Sign in, then come back here."
 *
 * A page outside the home route (the FFCS planner, `/ffcs`) cannot show the
 * login form itself, so it sends the student to `/?signin=1`, which opens the
 * form directly, and leaves a note of where to return. Once the session
 * exists, `Main` reads the note and sends them back.
 *
 * The note lives in sessionStorage (this tab only), expires after 30 minutes,
 * and is only honoured for same-origin paths on an allowlist, so it can never
 * become an open redirect or ambush a student who abandoned the login and came
 * back hours later.
 */

const KEY = "amaze_signin_return";
const MAX_AGE_MS = 30 * 60 * 1000;

/** The query flag on `/` that opens the login form straight away. */
export const SIGN_IN_PARAM = "signin";

/**
 * Fired on `window` whenever a VTOP login succeeds. "Logged in" alone cannot
 * tell a fresh sign-in from saved credentials that no longer work, so the
 * return trip waits for this.
 */
export const VTOP_LOGIN_EVENT = "amaze:vtop-login";

/** Paths a sign-in may return to. */
const ALLOWED_PREFIXES = ["/ffcs", "/friend-finder"];

export function isAllowedReturnPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("\\") &&
    ALLOWED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`))
  );
}

/**
 * Remember where to come back to, and return the URL of the login form for the
 * caller to navigate to (with the Next router, so it stays a client-side hop).
 */
export function prepareSignIn(returnTo: string): string {
  const signInUrl = `/?${SIGN_IN_PARAM}=1`;
  if (typeof window === "undefined") return signInUrl;
  try {
    if (isAllowedReturnPath(returnTo)) {
      window.sessionStorage.setItem(KEY, JSON.stringify({ path: returnTo, at: Date.now() }));
    }
  } catch {
    // Storage blocked: the student still reaches the login form, just without the return trip.
  }
  return signInUrl;
}

export type SignInNote = { path: string; at: number };

/**
 * The pending return trip, without clearing it. An expired or tampered note is
 * cleared and reported as none.
 */
export function peekSignInReturn(now = Date.now()): SignInNote | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const note = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof note.at === "number" && now - note.at <= MAX_AGE_MS && isAllowedReturnPath(note.path)) {
      return { path: note.path, at: note.at };
    }
    window.sessionStorage.removeItem(KEY);
    return null;
  } catch {
    clearSignInReturn();
    return null;
  }
}

export function clearSignInReturn(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {}
}

/** Read and clear the return path. Returns null when there is none, it expired, or it is not allowed. */
export function takeSignInReturn(now = Date.now()): string | null {
  const note = peekSignInReturn(now);
  if (note) clearSignInReturn();
  return note?.path ?? null;
}
