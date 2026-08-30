import { API_BASE, fetchWithTimeout } from "../fetch-utils";
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

type AuthProvider = (
  domain: AuthDomain,
) => Promise<{ cookies?: string[]; authorizedID?: string; csrf?: string; jsessionid?: string } | null>;

let authProvider: AuthProvider | null = null;
export function setAuthProvider(p: AuthProvider): void {
  authProvider = p;
}

const inflight = new Map<string, Promise<unknown>>();

export async function request(
  path: string,
  body?: unknown,
  opts: RequestOpts = {},
): Promise<any> {
  const method = opts.method ?? "POST";
  const dedupeKey =
    opts.dedupeKey ?? `${method}:${path}:${JSON.stringify(body ?? "")}`;

  if (!opts.bypassDedupe) {
    const existing = inflight.get(dedupeKey);
    if (existing) return existing as Promise<any>;
  }

  const max = opts.retry?.max ?? 2;
  const base = opts.retry?.baseMs ?? 1000;

  const run = async (): Promise<any> => {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= max; attempt++) {
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
          `${API_BASE}/api/${path}`,
          {
            method,
            headers: { "Content-Type": "application/json" },
            body: finalBody ? JSON.stringify(finalBody) : undefined,
            signal: opts.signal,
          },
          opts.timeoutMs ?? 60000,
        );

        const json = await res.json().catch(() => ({} as Record<string, unknown>));
        const failed = json && (json as { success?: boolean }).success === false;
        if (failed && isAuthFailMessage((json as { message?: string }).message)) {
          const domain: AuthDomain =
            opts.auth === "vtop" || opts.auth === "eventhub"
              ? opts.auth
              : (opts.authFailDomain ?? "vtop");
          throw new AuthError((json as { message?: string }).message || "Authentication failed", domain);
        }
        if (!res.ok) throw new TransientError(`HTTP ${res.status}`, backoff(base, attempt));
        return json;
      } catch (err) {
        lastErr = err;
        if (err instanceof AuthError) throw err;
        if (opts.signal?.aborted) {
          const e = new Error("AbortError");
          e.name = "AbortError";
          throw e;
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
        throw new TransientError(String(err), backoff(base, attempt));
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
    url = `${API_BASE}/api/${clean}`;
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
      const creds = authProvider ? await authProvider(auth === "eventhub" ? "eventhub" : "vtop") : null;
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

  const res = await fetchWithTimeout(
    url,
    { method, headers, body, signal: opts.signal },
    opts.timeoutMs ?? 60000,
  );

  if (opts.parse === "raw") return res;
  if (opts.parse === "blob") return await res.blob();
  if (opts.parse === "text") return await res.text();

  const json = await res.json().catch(() => ({} as Record<string, unknown>));
  if (json && (json as { success?: boolean }).success === false && isAuthFailMessage((json as { message?: string }).message)) {
    throw new AuthError((json as { message?: string }).message || "Authentication failed", auth === "eventhub" ? "eventhub" : "vtop");
  }
  return json;
}
