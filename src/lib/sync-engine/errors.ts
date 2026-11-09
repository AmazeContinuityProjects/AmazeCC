import type { AuthDomain, EngineError } from "./types";

export class AuthError extends Error {
  domain: AuthDomain;
  constructor(message: string, domain: AuthDomain) {
    super(message);
    this.name = "AuthError";
    this.domain = domain;
  }
}

export class TransientError extends Error {
  retryAfterMs: number;
  constructor(message: string, retryAfterMs = 1000) {
    super(message);
    this.name = "TransientError";
    this.retryAfterMs = retryAfterMs;
  }
}

export function isAuthError(e: unknown): e is AuthError {
  return e instanceof AuthError;
}

export function toEngineError(e: unknown): EngineError {
  if (e instanceof AuthError) return { kind: "auth", domain: e.domain, message: e.message };
  if (e instanceof TransientError)
    return { kind: "transient", message: e.message, retryAfterMs: e.retryAfterMs };
  if (e && typeof e === "object" && "name" in e && (e as { name?: string }).name === "AbortError")
    return { kind: "aborted" };
  return { kind: "unknown", message: e instanceof Error ? e.message : String(e) };
}

/**
 * Backend errors sometimes arrive as HTTP 200 with `{ success: false }`.
 * Treat those as failures so a broken module logs loudly instead of being
 * persisted or displayed as if it were real data.
 */
export function assertApiSuccess(result: unknown, label: string): void {
  if (
    result &&
    typeof result === "object" &&
    (result as { success?: unknown }).success === false
  ) {
    const r = result as { message?: unknown; error?: unknown };
    const detail =
      typeof r.message === "string" && r.message
        ? r.message
        : typeof r.error === "string" && r.error
          ? r.error
          : "server returned an error";
    throw new Error(`${label} failed: ${detail}`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function backoff(baseMs: number, attempt: number): number {
  return Math.min(baseMs * 2 ** attempt, 8000);
}

const AUTH_FAIL_HINTS = [
  "invalid",
  "incorrect",
  "wrong",
  "unauthorized",
  "unauthorised",
  "denied",
  "captcha",
  "authentication failed",
  "login failed",
  "not logged",
];

export function isAuthFailMessage(msg?: string): boolean {
  if (!msg) return false;
  const m = msg.toLowerCase();
  return AUTH_FAIL_HINTS.some((h) => m.includes(h));
}

/**
 * Why a sign-in was rejected, as far as the message can tell.
 *
 * `"bad-credentials"` — the server named the username/password as wrong, so
 * updating the saved password is the fix.
 *
 * `"unknown"` — the sign-in failed for a reason the app cannot name: a rate
 * limit, a lock-out, a captcha, or a bare "login failed". The password may
 * still need changing, but only VTOP can say so — the student has to go
 * there. `null` means this is not a sign-in failure at all.
 */
export type AuthFailureKind = "bad-credentials" | "unknown";

/**
 * Phrasing that names the username or password as the wrong one. These are
 * anchored to a credential word on purpose: a bare "incorrect" says nothing
 * about what was wrong, and guessing "wrong password" there would be a lie.
 */
const BAD_CREDENTIAL_HINTS = [
  "invalid username",
  "invalid password",
  "invalid credential",
  "invalid user",
  "invalid login",
  "incorrect password",
  "incorrect username",
  "incorrect credential",
  "password is incorrect",
  "username is incorrect",
  "credentials are incorrect",
  "incorrect details",
  "wrong password",
  "wrong username",
  "wrong credential",
  "password is wrong",
  "stopped retrying",
  "edit credentials",
];

/** Rate limits, lock-outs and captchas: a new password will not clear these. */
const TOO_MANY_ATTEMPT_HINTS = [
  "too many",
  "max attempts",
  "maximum attempts",
  "attempts exceeded",
  "login attempt",
  "rate limit",
  "locked",
  "lockout",
  "try again later",
  "captcha",
];

/** Words that mark a message as being about the sign-in itself. */
const AUTH_CONTEXT_HINTS = [
  "login",
  "log in",
  "sign in",
  "signin",
  "auth",
  "credential",
  "password",
  "username",
  "user name",
  "session",
  "unauthorized",
  "unauthorised",
  "denied",
  "not logged",
];

/**
 * Classify a failure message into the two sign-in failures the app can talk
 * about, or `null` when it is not a sign-in failure.
 *
 * The "unknown" bucket is deliberately wide: a bare "login failed" says
 * nothing about the cause, and the advice for it is the same as for a
 * rate-limit — go and change the password on VTOP.
 */
export function classifyAuthFailure(msg?: string): AuthFailureKind | null {
  if (!msg) return null;
  const m = msg.toLowerCase();

  if (BAD_CREDENTIAL_HINTS.some((h) => m.includes(h))) return "bad-credentials";
  if (TOO_MANY_ATTEMPT_HINTS.some((h) => m.includes(h))) return "unknown";

  // The generic auth-failure wording only counts when the message is about
  // signing in: "invalid" on its own can be about anything.
  const authFailure = AUTH_FAIL_HINTS.some((h) => m.includes(h));
  if (authFailure && AUTH_CONTEXT_HINTS.some((h) => m.includes(h))) return "unknown";

  return null;
}

/**
 * Raw failure text from VTOP, the API or the browser, rewritten as one plain
 * sentence that says what happened and what to do. Unknown messages come back
 * unchanged, so nothing is ever hidden.
 *
 * Every rewrite keeps the words `classifyAuthFailure` keys on ("password is
 * wrong", "captcha", "too many"), so the sign-in screen's "change password"
 * offer behaves exactly as it did with the raw text (see the tests).
 */
const FRIENDLY_ERRORS: { test: RegExp; text: string }[] = [
  {
    test: /expired|change your password|3 month/i,
    text: "Your VTOP password has expired. Change it on VTOP, then update it here.",
  },
  {
    test: /invalid (username|user name)\s*\/\s*password|invalid username|invalid password|invalid credential/i,
    text: "VTOP says your username or password is wrong. Check them, or reset your password on VTOP.",
  },
  {
    test: /invalid captcha|captcha/i,
    text: "VTOP's captcha check failed. This usually clears up on its own; try again in a minute.",
  },
  {
    test: /too many|rate limit|429/i,
    text: "Too many sign-in attempts in a short time. Wait a minute, then try again.",
  },
  {
    test: /vtop.*(unreachable|is down)|vtopcc\.vit\.ac\.in.*(down|unreachable)/i,
    // Keeps "VTOP is down": sync-session and SyncNotification detect outages by it.
    text: "VTOP is down or not responding right now. This is on VIT's side; your saved data is still shown.",
  },
  {
    test: /timed? ?out|deadline|exceeded \d+ ?ms|took too long/i,
    text: "VTOP took too long to answer. It is probably busy; try again in a few minutes.",
  },
  {
    test: /failed to fetch|networkerror|network request failed|load failed/i,
    // SyncNotification matches "couldn't reach AmazeCC" to tell gateway trouble from a VTOP outage.
    text: "Couldn't reach AmazeCC's servers. Check your internet connection and try again.",
  },
  {
    test: /not logged in|add your vtop credentials/i,
    text: "You're not logged in to VTOP yet. Sign in to load this.",
  },
  {
    test: /internal server error|\b50[0234]\b/i,
    text: "AmazeCC's server hit an error. Try again in a moment; if it keeps happening, report it from Settings.",
  },
];

export function friendlyErrorMessage(raw: string | null | undefined): string {
  const msg = (raw ?? "").trim();
  if (!msg) return "Something went wrong. Please try again.";
  for (const { test, text } of FRIENDLY_ERRORS) if (test.test(msg)) return text;
  return msg;
}

/**
 * Friendly text plus the raw message in brackets, for logs people also use to
 * report bugs ("... try again in a moment. (HTTP 500)"). Raw text is shown
 * once, and trimmed so a stack trace cannot flood the sheet.
 */
export function friendlyErrorWithDetail(raw: string | null | undefined): string {
  const friendly = friendlyErrorMessage(raw);
  const detail = (raw ?? "").trim();
  if (!detail || friendly === detail) return friendly;
  const short = detail.length > 80 ? `${detail.slice(0, 77)}...` : detail;
  return `${friendly} (${short})`;
}
