import { API_BASE, fetchWithTimeout } from "./fetch-utils";

let globalLoginPromise: Promise<{ cookies: string[]; authorizedID: string; csrf: string }> | null = null;
let cachedVTOPCredentials: { cookies: string[]; authorizedID: string; csrf: string } | null = null;

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

      if (!data.success || !data.authorizedID || !data.cookies)
        throw new Error(data.message || "Login failed.");

      onProgress?.("Login successful", 40);

      cachedVTOPCredentials = {
        cookies: data.cookies,
        authorizedID: data.authorizedID,
        csrf: data.csrf,
      };
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
}
