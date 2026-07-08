export const PRIMARY_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.amazecc.com";
export const BACKUP_API_URL = process.env.NEXT_PUBLIC_BACKUP_API_URL || "https://proper-canary-4596.amazecc.deno.net";

let customUrlFromStorage = "";
if (typeof window !== "undefined") {
  try {
    customUrlFromStorage = localStorage.getItem("amazecc_custom_api_url") || "";
  } catch (e) {}
}

export let activeApiUrl = customUrlFromStorage || PRIMARY_API_URL;

export function getActiveApiUrl(): string {
  return activeApiUrl;
}

export function setActiveApiUrl(url: string) {
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
    const backupUrl = new URL(BACKUP_API_URL);

    if (activeApiUrl === BACKUP_API_URL) {
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

  let isPrimary = false;
  let isBackup = false;
  try {
    const parsedUrl = new URL(urlStr);
    const primaryOrigin = new URL(PRIMARY_API_URL).origin;
    const backupOrigin = new URL(BACKUP_API_URL).origin;
    isPrimary = parsedUrl.origin === primaryOrigin;
    isBackup = parsedUrl.origin === backupOrigin;
  } catch (e) {
    // Non-absolute or malformed URL: treat as non-target and pass through.
  }

  if (!isPrimary && !isBackup) {
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

  try {
    const res = await originalFetch(prepareInput(targetUrl), init);
    if (activeApiUrl === PRIMARY_API_URL && (res.status === 502 || res.status === 503 || res.status === 504)) {
      throw new Error(`Server error ${res.status}`);
    }
    return res;
  } catch (error: any) {
    if (activeApiUrl === PRIMARY_API_URL) {
      if (error.name === "AbortError" && init?.signal?.aborted) {
        throw error;
      }

      console.warn(`Primary API call failed (${urlStr}). Failing over to backup. Error:`, error);
      setActiveApiUrl(BACKUP_API_URL);
      const backupUrl = urlStr.replace(PRIMARY_API_URL, BACKUP_API_URL);

      try {
        console.log(`Retrying request with backup URL: ${backupUrl}`);
        return await originalFetch(prepareInput(backupUrl), init);
      } catch (backupError) {
        console.error(`Backup API call also failed:`, backupError);
        throw backupError;
      }
    }
    throw error;
  }
}

export async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
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
        }
      } catch (e) {
        // Do not proactively switch to backup on startup.
        // Let the actual fetch failover handle it during requests.
      }
    }, 1500);
  }
}
