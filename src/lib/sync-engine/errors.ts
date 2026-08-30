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
