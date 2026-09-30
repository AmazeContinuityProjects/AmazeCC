import {
  emitUniccLogEvent,
  isUniccHost,
  isUniccPreferred,
  noteAmazeccServing,
  noteUniccFailed,
  noteUniccServed,
  noteUniccUnsupported,
  uniccRouteName,
  uniccUrlFor,
} from "./unicc-fallback";

export const PRIMARY_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.amazecc.com";
export const BACKUP_API_URL = process.env.NEXT_PUBLIC_BACKUP_API_URL || "https://api.amazecc.com";

/**
 * The backup host that is actually safe to swap in globally.
 *
 * This is the one place in the app that rewrites the origin of *every* request,
 * so it is the one place a host that only implements part of the API would do
 * real damage. UniCC is refused here: if it is configured as the backup, the
 * effective backup becomes the primary, which degrades to "retry once, then try
 * the allowlisted UniCC fallback" — the intended behaviour — instead of pointing
 * `/api/student` and friends at a host that 404s them.
 */
function failoverBackupUrl(): string {
  return isUniccHost(BACKUP_API_URL) ? PRIMARY_API_URL : BACKUP_API_URL;
}

let customUrlFromStorage = "";
if (typeof window !== "undefined") {
  try {
    customUrlFromStorage = localStorage.getItem("amazecc_custom_api_url") || "";
    // The custom-URL field in settings will happily accept any host, and a
    // stored UniCC URL would make every request fail until it is cleared by
    // hand. Drop it at boot instead.
    if (customUrlFromStorage && isUniccHost(customUrlFromStorage)) {
      customUrlFromStorage = "";
      localStorage.removeItem("amazecc_custom_api_url");
      console.warn(
        "Ignoring the stored custom API URL because it points at UniCC, " +
          "which does not implement all of AmazeCC's routes."
      );
    }
  } catch (e) {}
}

export let activeApiUrl = customUrlFromStorage || PRIMARY_API_URL;

/**
 * Whether there is a real, distinct backup gateway to show/switch to.
 * Note: failover itself only needs BACKUP_API_URL to be non-empty.
 */
export function hasBackupApi(): boolean {
  const backup = failoverBackupUrl();
  return Boolean(backup) && backup !== PRIMARY_API_URL;
}

export function getActiveApiUrl(): string {
  return activeApiUrl;
}

export function setActiveApiUrl(url: string) {
  if (isUniccHost(url)) {
    console.warn(
      `Refusing to make ${url} the active API URL: it implements only part of ` +
        "AmazeCC's API, so the app would silently 404 the rest."
    );
    url = PRIMARY_API_URL;
  }
  activeApiUrl = url;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem("amazecc_active_api_url", url);
    } catch (e) {
      // Ignore storage errors
    }
  }
}

export function setCustomApiUrl(url: string) {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      if (url) {
        window.localStorage.setItem("amazecc_custom_api_url", url);
        activeApiUrl = url;
        API_BASE = url;
      } else {
        window.localStorage.removeItem("amazecc_custom_api_url");
        activeApiUrl = PRIMARY_API_URL;
        API_BASE = PRIMARY_API_URL;
      }
    } catch (e) {}
  }
}

export let API_BASE = activeApiUrl;

const FETCH_TIMEOUT = 90000;

// Store a reference to original fetch
let originalFetch: typeof fetch;
if (typeof window !== "undefined") {
  originalFetch = window.fetch;
} else {
  originalFetch = () => Promise.reject(new Error("Fetch not available"));
}

// Allow overriding the underlying fetch in tests
export function setOriginalFetchForTest(f: typeof fetch) {
  originalFetch = f;
}

export function rewriteUrlIfNeeded(url: string): string {
  try {
    const inputUrl = new URL(url);
    const primaryUrl = new URL(PRIMARY_API_URL);
    const backupUrl = new URL(failoverBackupUrl());

    if (activeApiUrl === failoverBackupUrl()) {
      if (inputUrl.origin === primaryUrl.origin) {
        inputUrl.protocol = backupUrl.protocol;
        inputUrl.hostname = backupUrl.hostname;
        inputUrl.port = backupUrl.port;
        return inputUrl.toString();
      }
    } else {
      if (inputUrl.origin === backupUrl.origin) {
        inputUrl.protocol = primaryUrl.protocol;
        inputUrl.hostname = primaryUrl.hostname;
        inputUrl.port = primaryUrl.port;
        return inputUrl.toString();
      }
    }
  } catch (e) {
    // If url is not an absolute URL, leave it unchanged.
  }
  return url;
}

export function getRewrittenUrl(url: string): string {
  if (url.startsWith("/")) {
    return getActiveApiUrl() + url;
  }
  return rewriteUrlIfNeeded(url);
}

/**
 * Statuses that mean "this host could not answer", as opposed to a real reply.
 *
 * Deliberately excludes 404 and other 4xx. A 404 is an answer — the route does
 * not exist there — and treating it as an outage would mask a genuine bug
 * behind a failover. It also excludes 401, which is the case that matters most:
 * both backends log in against real VTOP, and VTOP locks an account after
 * repeated failed attempts, so a rejected password must be attempted exactly
 * once. A 401 is never thrown here, so it flows through to the caller untouched.
 */
const FAILOVER_STATUSES: ReadonlySet<number> = new Set([500, 502, 503, 504]);

function isFailoverStatus(status: number): boolean {
  return FAILOVER_STATUSES.has(status);
}

/**
 * The last hop: retry this one request against UniCC, if it serves the route.
 *
 * ## Why this stays per-request
 *
 * The AmazeCC hosts are the same service, which is why swapping the global active
 * URL between them is correct — every endpoint that works on one works on the
 * other. UniCC is a *different* service implementing a subset of the routes, so
 * its origin must never become the global active URL: that would point social
 * sync, EventHub, student profile and the rest at a host that 404s them, and the
 * app would look healthy while returning nothing.
 *
 * So this retries the single request and leaves the global URL alone. Only paths
 * UniCC actually serves are eligible, and only after every AmazeCC host has
 * failed — which also means a request that any host *answered* never gets here,
 * so a rejected password is never retried.
 */
async function attemptUnicc(
  urlStr: string,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  prepareInput: (newUrl: string) => RequestInfo | URL,
  lastError: unknown
): Promise<Response> {
  const uniccUrl = uniccUrlFor(urlStr);
  if (uniccUrl) {
    const route = uniccRouteName(uniccUrl);
    // Every AmazeCC host has already failed by the time this runs, so this is
    // the hand-off the user needs to be told about — not a silent rescue.
    emitUniccLogEvent({ type: "fell_back_to_unicc", path: route });
    try {
      console.log(`Retrying request with UniCC: ${uniccUrl}`);
      const res = await originalFetch(prepareInput(uniccUrl), init);
      if (isFailoverStatus(res.status)) {
        throw new Error(`Server error ${res.status}`);
      }
      if (res.ok) {
        noteUniccServed(route);
        emitUniccLogEvent({ type: "unicc_served", path: route });
      }
      return res;
    } catch (uniccError) {
      console.error(`UniCC fallback also failed:`, uniccError);
      noteUniccFailed(route);
    }
  }
  throw lastError;
}

/**
 * The user's chosen target, tried ahead of the AmazeCC chain.
 *
 * Only reached when the user has explicitly opted in to UniCC, and only for the
 * routes it implements. Everything else is counted and left to AmazeCC, because
 * a preference cannot conjure an endpoint that does not exist there.
 *
 * A `401` is returned as-is rather than thrown, which is the whole reason this
 * function must not be written as "try UniCC, catch, try AmazeCC": a catch-all
 * would re-send the same wrong password to a second host that authenticates
 * against the same real VTOP, and that is how an account gets locked. Returning
 * the response lets `request()` turn it into an `AuthError` and stop.
 */
async function tryPreferredUnicc(
  urlStr: string,
  init: RequestInit | undefined,
  prepareInput: (newUrl: string) => RequestInfo | URL
): Promise<Response | null> {
  const uniccUrl = uniccUrlFor(urlStr);
  if (!uniccUrl) {
    // No UniCC route for this one. Recorded so the sync sheet can say plainly
    // that this part of the data came from AmazeCC rather than implying the
    // whole sync was on UniCC.
    if (isUniccPreferred()) noteUniccUnsupported(uniccRouteName(urlStr));
    return null;
  }

  const route = uniccRouteName(uniccUrl);
  try {
    console.log(`Opted in to UniCC: ${uniccUrl}`);
    const res = await originalFetch(prepareInput(uniccUrl), init);
    if (isFailoverStatus(res.status)) {
      // UniCC is up but broken for this route — an outage, not a verdict on the
      // credentials, so it is safe to carry on to AmazeCC.
      noteUniccFailed(route);
      emitUniccLogEvent({ type: "unicc_unavailable", path: route });
      console.warn(`UniCC returned ${res.status} for ${uniccUrl}. Trying AmazeCC instead.`);
      return null;
    }
    // A 4xx is a real answer but it is not data. Counting a rejected password
    // as "UniCC served your data" would put a success badge on the exact moment
    // the user most needs to be told the login failed.
    if (res.ok) {
      noteUniccServed(route);
      emitUniccLogEvent({ type: "unicc_served", path: route });
    }
    return res;
  } catch (err) {
    noteUniccFailed(route);
    emitUniccLogEvent({ type: "unicc_unavailable", path: route });
    console.warn(`Opted-in UniCC attempt failed for ${uniccUrl}. Trying AmazeCC instead.`, err);
    return null;
  }
}

export async function fetchWithFailover(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let urlStr = "";
  if (typeof input === "string") {
    urlStr = input;
  } else if (input instanceof URL) {
    urlStr = input.toString();
  } else if (input && typeof input === "object" && "url" in input) {
    urlStr = input.url;
  }

  // Never the effective backup: a UniCC host is the fallback destination, not a
  // failover target, so a request explicitly addressed to it must pass through
  // untouched rather than be classified and possibly rewritten to AmazeCC.
  const backup = failoverBackupUrl();
  const isUniccTarget = isUniccHost(urlStr);

  let isPrimary = false;
  let isBackup = false;
  try {
    const parsedUrl = new URL(urlStr);
    const primaryOrigin = new URL(PRIMARY_API_URL).origin;
    const backupOrigin = new URL(backup).origin;
    isPrimary = parsedUrl.origin === primaryOrigin;
    isBackup = parsedUrl.origin === backupOrigin;
  } catch (e) {
    // Non-absolute or malformed URL: treat as non-target and pass through.
  }

  if (isUniccTarget || (!isPrimary && !isBackup)) {
    return originalFetch(input, init);
  }

  let targetUrl = rewriteUrlIfNeeded(urlStr);

  const prepareInput = (newUrl: string): RequestInfo | URL => {
    if (typeof input === "string") {
      return newUrl;
    } else if (input instanceof URL) {
      return new URL(newUrl);
    } else {
      try {
        return new Request(newUrl, input);
      } catch (e) {
        // Fallback: Copy key request properties to avoid losing headers, auth, or method
        try {
          const initOpts: RequestInit = {};
          if (input.headers) {
            const headers: Record<string, string> = {};
            input.headers.forEach((v, k) => { headers[k] = v; });
            initOpts.headers = headers;
          }
          initOpts.method = input.method;
          initOpts.credentials = input.credentials;
          initOpts.mode = input.mode;
          initOpts.signal = input.signal;
          return new Request(newUrl, initOpts);
        } catch (innerErr) {
          return newUrl;
        }
      }
    }
  };

  // The user picked UniCC as their target server: ask it first, for the routes
  // it implements, and carry on to the AmazeCC chain if it cannot answer. This
  // is the only thing that makes the login screen's opt-in do anything — every
  // internal request, background sync included, arrives through this function.
  if (isUniccPreferred()) {
    const preferred = await tryPreferredUnicc(urlStr, init, prepareInput);
    if (preferred) return preferred;
  }

  try {
    const res = await originalFetch(prepareInput(targetUrl), init);
    if (isFailoverStatus(res.status)) {
      throw new Error(`Server error ${res.status}`);
    }
    if (res.ok) noteAmazeccServing(uniccRouteName(urlStr));
    return res;
  } catch (error: any) {
    // Whether the primary or the backup was active, a genuine failure is handled
    // the same way: try the other AmazeCC host, then the allowlisted UniCC
    // fallback. Gating this on "am I the primary" would mean that once the global
    // URL had failed over, a dead backup would return its failure straight to the
    // caller and the UniCC hop would never be reached.
    const isPrimaryActive = activeApiUrl === PRIMARY_API_URL;
    const isBackupActive = activeApiUrl === backup;

    if (isPrimaryActive || isBackupActive) {
      if (error.name === "AbortError" && init?.signal?.aborted) {
        throw error;
      }

      if (!isPrimaryActive) {
        // The backup is down, so go back to the primary rather than giving up.
        console.warn(`Backup API call failed (${urlStr}). Retrying primary. Error:`, error);
        setActiveApiUrl(PRIMARY_API_URL);
        try {
          const recovered = await originalFetch(prepareInput(urlStr), init);
          if (isFailoverStatus(recovered.status)) throw new Error(`Server error ${recovered.status}`);
          if (recovered.ok) noteAmazeccServing(uniccRouteName(urlStr));
          return recovered;
        } catch (primaryError) {
          console.error(`Primary API call also failed:`, primaryError);
          return attemptUnicc(urlStr, input, init, prepareInput, primaryError);
        }
      }

      console.warn(`Primary API call failed (${urlStr}). Failing over to backup. Error:`, error);
      setActiveApiUrl(backup);
      const backupUrl = urlStr.replace(PRIMARY_API_URL, backup);

      try {
        console.log(`Retrying request with backup URL: ${backupUrl}`);
        const backupRes = await originalFetch(prepareInput(backupUrl), init);
        if (isFailoverStatus(backupRes.status)) {
          // A 5xx is a failure, not an answer. Returning it would hand the caller
          // an error page as if it were data and skip the UniCC hop.
          throw new Error(`Server error ${backupRes.status}`);
        }
        if (backupRes.ok) noteAmazeccServing(uniccRouteName(urlStr));
        return backupRes;
      } catch (backupError) {
        console.error(`Backup API call also failed:`, backupError);
        return attemptUnicc(urlStr, input, init, prepareInput, backupError);
      }
    }
    throw error;
  }
}

export async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutReason =
    typeof DOMException !== "undefined"
      ? new DOMException(`Request timed out after ${timeoutMs}ms`, "TimeoutError")
      : Object.assign(new Error(`Request timed out after ${timeoutMs}ms`), { name: "TimeoutError" });
  const timer = setTimeout(() => timeoutController.abort(timeoutReason), timeoutMs);

  const userSignal = options.signal as AbortSignal | undefined | null;
  // Already aborted by the caller — fail fast without starting a request.
  if (userSignal?.aborted) {
    clearTimeout(timer);
    throw userSignal.reason ?? new DOMException("signal is aborted without reason", "AbortError");
  }

  // Combine caller cancellation with our timeout so neither is swallowed.
  // AbortSignal.any is available in modern browsers/Node 20+; fall back otherwise.
  let signal: AbortSignal = timeoutController.signal;
  let detach: (() => void) | undefined;
  if (userSignal) {
    if (typeof (AbortSignal as any).any === "function") {
      signal = (AbortSignal as any).any([userSignal, timeoutController.signal]);
    } else {
      const onAbort = () => timeoutController.abort(userSignal.reason ?? new DOMException("signal is aborted without reason", "AbortError"));
      userSignal.addEventListener("abort", onAbort, { once: true });
      detach = () => userSignal.removeEventListener("abort", onAbort);
    }
  }

  try {
    const res = await fetch(url, { ...options, signal });
    return res;
  } finally {
    clearTimeout(timer);
    detach?.();
  }
}

// Override global window.fetch if in browser
if (typeof window !== "undefined") {
  window.fetch = fetchWithFailover;

  // Run a quick check after page load to see if primary API is available again
  if (process.env.NODE_ENV !== "test") {
    setTimeout(async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000); // 3-second timeout

        const res = await originalFetch(`${PRIMARY_API_URL}/api/health`, {
          signal: controller.signal,
          headers: { "Accept": "application/json" }
        });
        clearTimeout(timer);

        if (res.ok) {
          if (activeApiUrl !== PRIMARY_API_URL) {
            console.log("Primary API is back online. Switching back from backup.");
            setActiveApiUrl(PRIMARY_API_URL);
          }
        } else {
          if (activeApiUrl === PRIMARY_API_URL) {
            console.warn("Primary API health check returned non-200. Keeping primary URL to avoid unnecessary failovers.");
          }
        }
      } catch (e) {
        // Do not proactively switch to backup on startup.
        // Let the actual fetch failover handle it during requests.
        if (activeApiUrl === PRIMARY_API_URL) {
          console.warn("Primary API is unreachable/blocked in health check. Keeping primary URL to avoid unnecessary failovers on slow connections.");
        }
      }
    }, 1500);
  }
}
