import { API_BASE, fetchWithTimeout } from "./fetch-utils";
import { storage } from "./storage";

let cachedEventHubSession: string | null = storage.eventHubSession.get() ?? null;
let globalEventHubLoginPromise: Promise<string> | null = null;

export function clearEventHubSession(): void {
  cachedEventHubSession = null;
  globalEventHubLoginPromise = null;
  storage.eventHubSession.remove();
}

export async function loginToEventHub(
  IDs: { VtopUsername: string; VtopPassword: string },
  demoMode: boolean,
  forceNew = false,
): Promise<string> {
  if (demoMode || IDs.VtopUsername === "demo") return "";
  if (cachedEventHubSession && !forceNew) return cachedEventHubSession;
  if (globalEventHubLoginPromise) return globalEventHubLoginPromise;

  globalEventHubLoginPromise = (async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/events/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: IDs.VtopUsername, password: IDs.VtopPassword }),
      }, 30000);
      const data = await res.json();
      if (!data.success || !data.jsessionid) {
        throw new Error(data.error || "Event Hub login failed");
      }
      cachedEventHubSession = data.jsessionid;
      storage.eventHubSession.set(data.jsessionid);
      return data.jsessionid;
    } finally {
      globalEventHubLoginPromise = null;
    }
  })();
  return globalEventHubLoginPromise;
}
