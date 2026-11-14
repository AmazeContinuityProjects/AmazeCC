import { fetchWithTimeout } from "../fetch-utils";
import { resolveApiRoute } from "../workerBase";
import { resolveOperation } from "../apis/registry";
import { AuthError, TransientError, sleep, backoff, isAuthFailMessage } from "./errors";
import type { AuthDomain } from "./types";

export interface RequestOpts {
  method?: "GET" | "POST";
  auth?: AuthDomain | "none";
  authFailDomain?: AuthDomain;
  signal?: AbortSignal;
  timeoutMs?: number;
  dedupeKey?: string;
  retry?: { max?: number; baseMs?: number };
  bypassDedupe?: boolean;
}

/**
 * What a session looks like to the request layer.
 *
 * Exported because `CredentialManager.getCreds` returns the same shape and used
 * to declare its own copy of it. Three declarations of one contract is how the
 * `cookies` type drifted out of step with what the backends actually send.
 */
export interface AuthCreds {
  cookies?: string | string[];
  authorizedID?: string;
  csrf?: string;
  jsessionid?: string;
}

type AuthProvider = (domain: AuthDomain) => Promise<AuthCreds | null>;

let authProvider: AuthProvider | null = null;
export function setAuthProvider(p: AuthProvider): void {
  authProvider = p;
}

const inflight = new Map<string, Promise<unknown>>();

let activeAbortController: AbortController | null = null;

export function getActiveSignal(): AbortSignal | undefined {
  return activeAbortController?.signal;
}

export function cancelAllRequests(reason = "Sync cancelled"): void {
  inflight.clear();
  if (activeAbortController) {
    try {
      activeAbortController.abort(new DOMException(reason, "AbortError"));
    } catch {
      activeAbortController.abort();
    }
    activeAbortController = null;
  }
}

export function resetActiveSignal(): AbortSignal {
  if (activeAbortController && !activeAbortController.signal.aborted) {
    try {
      activeAbortController.abort(new DOMException("New session started", "AbortError"));
    } catch {
      activeAbortController.abort();
    }
  }
  activeAbortController = new AbortController();
  return activeAbortController.signal;
}

export async function request(path: string, body?: unknown, opts: RequestOpts = {}): Promise<any> {
  const method = opts.method ?? "POST";
  const auth = opts.auth ?? "vtop";
  const mountChain = resolveOperation(path, auth);
  if (mountChain.length === 0) {
    throw new TransientError(`No API mount serves '${path}' with auth '${auth}'`, 0);
  }
  const dedupeKey = opts.dedupeKey ?? `${method}:${path}:${JSON.stringify(body ?? "")}`;

  if (!opts.bypassDedupe) {
    const existing = inflight.get(dedupeKey);
    if (existing) return existing as Promise<any>;
  }

  const effectiveSignal = opts.signal ?? getActiveSignal();
  if (effectiveSignal?.aborted) {
    throw effectiveSignal.reason ?? new DOMException("Request cancelled", "AbortError");
  }

  const max = opts.retry?.max ?? 2;
  const base = opts.retry?.baseMs ?? 1000;

  const run = async (): Promise<any> => {
    let lastErr: unknown;
    let mountIndex = 0;
    for (let attempt = 0; attempt <= max; attempt++) {
      const mount = mountChain[Math.min(mountIndex, mountChain.length - 1)];
      try {
        let finalBody: unknown = body;
        if (opts.auth === "vtop" || opts.auth === "eventhub") {
          if (!authProvider) throw new TransientError("Auth provider not configured");
          const creds = await authProvider(opts.auth);
          if (!creds) throw new AuthError("Not authenticated", opts.auth);
          if (opts.auth === "vtop") {
            finalBody = {
              ...(body as Record<string, unknown>),
              cookies: creds.cookies,
              authorizedID: creds.authorizedID,
              csrf: creds.csrf,
            };
          } else {
            finalBody = {
              ...(body as Record<string, unknown>),
              jsessionid: (creds as { jsessionid?: string }).jsessionid,
            };
          }
        }

        const res = await fetchWithTimeout(
          mount.url,
          {
            method: mount.method,
            headers: { "Content-Type": "application/json" },
            body: finalBody && mount.method !== "GET" ? JSON.stringify(finalBody) : undefined,
            signal: effectiveSignal,
          },
          opts.timeoutMs ?? 60000,
        );

        const json = await res.json().catch(() => ({}) as Record<string, unknown>);
        const failed = json && (json as { success?: boolean }).success === false;
        if (failed && isAuthFailMessage((json as { message?: string }).message)) {
          const domain: AuthDomain =
            opts.auth === "vtop" || opts.auth === "eventhub" ? opts.auth : (opts.authFailDomain ?? "vtop");
          throw new AuthError((json as { message?: string }).message || "Authentication failed", domain);
        }
        if (!res.ok) throw new TransientError(`HTTP ${res.status}`, backoff(base, attempt));
        return json;
      } catch (err) {
        lastErr = err;
        if (err instanceof AuthError) throw err;
        // Caller-cancelled: never retry, never wrap - propagate the AbortError as-is
        // so UI can silently ignore it instead of showing "TransientError: AbortError".
        if (effectiveSignal?.aborted || (err instanceof Error && err.name === "AbortError" && effectiveSignal)) {
          throw err;
        }
        if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError") && !effectiveSignal) {
          // No caller signal involved, so this abort came from our own timeout.
          // Fail over to the next mount if there is one, else retry it like any
          // transient failure with a clear message.
          const timeoutErr = new TransientError(
            `Request to ${path} timed out after ${opts.timeoutMs ?? 60000}ms - please retry`,
            backoff(base, attempt),
          );
          if (mountIndex < mountChain.length - 1) {
            mountIndex++;
            continue;
          }
          if (attempt < max) {
            await sleep(timeoutErr.retryAfterMs);
            continue;
          }
          throw timeoutErr;
        }
        // A transient failure (5xx / network): fail over to the next mount if
        // one is left; only spend the retry budget on the last mount.
        if (mountIndex < mountChain.length - 1) {
          mountIndex++;
          continue;
        }
        if (err instanceof TransientError) {
          if (attempt < max) {
            await sleep(err.retryAfterMs);
            continue;
          }
          throw err;
        }
        if (attempt < max) {
          await sleep(backoff(base, attempt));
          continue;
        }
        throw new TransientError(
          err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          backoff(base, attempt),
        );
      }
    }
    throw lastErr;
  };

  const p = run();
  if (!opts.bypassDedupe) inflight.set(dedupeKey, p);
  try {
    return await p;
  } finally {
    if (!opts.bypassDedupe) inflight.delete(dedupeKey);
  }
}

/**
 * Public, single-chokepoint network client. Every component should call this
 * instead of `fetch`/`fetchWithTimeout`. Attaches VTOP/EventHub credentials for
 * `auth` modes, supports JSON/FormData/string bodies, query strings, and returns
 * raw/blob/text/json. Auth-failure responses trigger an AuthError (give-up flow).
 */
export interface ApiOptions {
  method?: "GET" | "POST";
  body?: unknown;
  query?: Record<string, string | number>;
  auth?: AuthDomain | "none";
  parse?: "json" | "raw" | "text" | "blob";
  headers?: Record<string, string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export async function apiRequest(path: string, opts: ApiOptions = {}): Promise<any> {
  const auth = opts.auth ?? "none";
  const method = opts.method ?? (opts.body !== undefined ? "POST" : "GET");

  let url: string;
  if (/^https?:\/\//.test(path)) {
    url = path;
  } else {
    const clean = path.replace(/^\/+/, "").replace(/^api\//, "");
    url = resolveApiRoute(clean, auth);
  }

  if (opts.query && Object.keys(opts.query).length) {
    const qs = Object.entries(opts.query)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");
    url += (url.includes("?") ? "&" : "?") + qs;
  }

  const headers: Record<string, string> = { ...(opts.headers || {}) };
  let body: BodyInit | undefined;

  if (method === "POST" && opts.body !== undefined) {
    if (opts.body instanceof FormData) {
      body = opts.body;
    } else if (typeof opts.body === "string") {
      body = opts.body;
      headers["Content-Type"] = headers["Content-Type"] || "application/x-www-form-urlencoded";
    } else {
      // Only ask the credential manager for something when this request is
      // actually authenticated. Fetching creds for an `auth: "none"` post was
      // pure waste — neither branch below uses them — but not free waste:
      // `getCreds("vtop")` re-authenticates when its session is stale, and a
      // VTOP re-auth solves a captcha. So an unauthenticated EventHub action
      // could block for the length of a captcha solve before it was even sent.
      const creds = (auth === "vtop" || auth === "eventhub") && authProvider ? await authProvider(auth) : null;
      const merged: Record<string, unknown> = { ...(opts.body as Record<string, unknown>) };
      if (auth === "vtop" && creds) {
        if (creds.cookies) merged.cookies = creds.cookies;
        if (creds.authorizedID) merged.authorizedID = creds.authorizedID;
        if (creds.csrf) merged.csrf = creds.csrf;
      } else if (auth === "eventhub" && creds?.jsessionid) {
        merged.jsessionid = creds.jsessionid;
      }
      body = JSON.stringify(merged);
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
  }

  const effectiveSignal = opts.signal ?? getActiveSignal();
  if (effectiveSignal?.aborted) {
    throw effectiveSignal.reason ?? new DOMException("Request cancelled", "AbortError");
  }

  const res = await fetchWithTimeout(url, { method, headers, body, signal: effectiveSignal }, opts.timeoutMs ?? 60000);

  if (opts.parse === "raw") return res;
  if (opts.parse === "blob") return await res.blob();
  if (opts.parse === "text") return await res.text();

  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (
    json &&
    (json as { success?: boolean }).success === false &&
    isAuthFailMessage((json as { message?: string }).message)
  ) {
    throw new AuthError(
      (json as { message?: string }).message || "Authentication failed",
      auth === "eventhub" ? "eventhub" : "vtop",
    );
  }
  return json;
}
