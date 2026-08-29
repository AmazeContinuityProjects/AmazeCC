import { API_BASE, fetchWithTimeout } from "./fetch-utils";

let globalLoginPromise: Promise<{ cookies: string[]; authorizedID: string; csrf: string }> | null = null;
let cachedVTOPCredentials: { cookies: string[]; authorizedID: string; csrf: string } | null = null;
let failedLogin: { username: string; password: string } | null = null;

export interface LoginCredentials {
  cookies: string[];
  authorizedID: string;
  csrf: string;
}

export async function loginToVTOP(
  ids: { VtopUsername: string; VtopPassword: string },
  demoMode: boolean,
  retry = false,
  forceNew = false,
  onProgress?: (msg: string, progress: number) => void,
): Promise<LoginCredentials> {
  if (demoMode || ids.VtopUsername === "demo") {
    return { cookies: [], authorizedID: "DEMO123", csrf: "" };
  }
  if (cachedVTOPCredentials && !forceNew && !retry) return cachedVTOPCredentials;
  if (globalLoginPromise) return globalLoginPromise;

  // Give up immediately on a known-bad credential pair so we don't keep
  // hammering the API (and VTOP) with the same wrong username/password,
  // which can lock the account. A retry/captcha attempt or fresh creds bypass this.
  if (
    failedLogin &&
    !forceNew &&
    !retry &&
    failedLogin.username === ids.VtopUsername &&
    failedLogin.password === ids.VtopPassword
  ) {
    throw new Error(
      "Login failed — please check your credentials and try again. (Stopped retrying to avoid locking your account.)"
    );
  }

  globalLoginPromise = (async () => {
    try {
      onProgress?.("Logging in and fetching data...", 10);
      const loginRes = await fetchWithTimeout(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: ids.VtopUsername,
          password: ids.VtopPassword,
        }),
      }, 60000);

      const data = await loginRes.json();

      if (data.message?.includes("Invalid Captcha") && !retry) {
        globalLoginPromise = null;
        return loginToVTOP(ids, demoMode, true, forceNew, onProgress);
      }

      if (!data.success || !data.authorizedID || !data.cookies) {
        failedLogin = { username: ids.VtopUsername, password: ids.VtopPassword };
        let rawMsg = (data.message || "Login failed").trim().replace(/\.+$/, "");
        let msg = `${rawMsg}.`;
        const msgLower = rawMsg.toLowerCase();
        if (
          msgLower.includes("unknown reason") ||
          msgLower.includes("reset") ||
          msgLower.includes("too many") ||
          msgLower.includes("lock")
        ) {
          msg = `${rawMsg}. VTOP may require a password reset due to frequent logins. Try signing into vtopcc.vit.ac.in directly.`;
        }
        throw new Error(msg);
      }

      onProgress?.("Login successful", 40);

      cachedVTOPCredentials = {
        cookies: data.cookies,
        authorizedID: data.authorizedID,
        csrf: data.csrf,
      };
      failedLogin = null;
      return cachedVTOPCredentials;
    } finally {
      globalLoginPromise = null;
    }
  })();
  return globalLoginPromise;
}

export function clearCachedCredentials(): void {
  cachedVTOPCredentials = null;
  globalLoginPromise = null;
  failedLogin = null;
}
