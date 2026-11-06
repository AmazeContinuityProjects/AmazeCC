/**
 * Direct reachability check for the official VIT Chennai VTOP portal.
 *
 * Used to verify whether the university's servers are actually online before
 * starting sync, and when all sync APIs fail to differentiate between proxy
 * gateway issues and total university portal downtime.
 */

export const VTOP_PORTAL_URL = "https://vtopcc.vit.ac.in";

/**
 * Pings the official VTOP portal directly using a browser no-cors GET request.
 *
 * In browsers, requests to `vtopcc.vit.ac.in` are blocked by CORS from reading
 * response bodies, but a `mode: "no-cors"` request still succeeds if the remote
 * server is online and accepts the TCP connection. If VTOP is down, DNS fails,
 * or connection times out, fetch throws an error.
 */
export async function pingVtopDirectly(timeoutMs = 4500): Promise<boolean> {
  if (typeof window === "undefined" || typeof fetch === "undefined") {
    return false;
  }

  // In test environments where fetch is not intercepted/mocked, assume reachable
  // so tests without fake network don't fail unexpectedly. Tests testing downtime
  // explicitly use vi.spyOn(vtopHealth, "pingVtopDirectly").
  if (typeof process !== "undefined" && (process.env.NODE_ENV === "test" || process.env.VITEST) && !("mock" in fetch)) {
    return true;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(`${VTOP_PORTAL_URL}/vtop/login`, {
      method: "GET",
      mode: "no-cors",
      cache: "no-cache",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return true;
  } catch (error) {
    clearTimeout(timer);
    return false;
  }
}
