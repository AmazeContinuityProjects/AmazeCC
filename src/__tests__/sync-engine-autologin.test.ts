/**
 * `syncEngine.sync` signs the student in by itself.
 *
 * Every VTOP-scoped op used to fail on a page that *looked* signed in but had
 * a cold engine: the session lives only in memory, so after a reload (or a
 * cache transfer into a fresh browser) `sync()` went out unauthenticated and
 * the student had no way to act on "Not authenticated" — they WERE signed in,
 * from the app's point of view. The engine now restores the session itself:
 *
 *   1. ids fall back to the persisted credentials (no login from this page)
 *   2. a missing/stale VTOP session is ensured before a vtop op runs
 *   3. a fresh session is NOT re-logged-in (a login costs a captcha solve)
 *   4. demo mode never talks to VTOP, so it never signs in
 *
 * The request layer is mocked; the engine and credential manager are real.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { storage } from "../lib/storage";

/** jsdom hands vitest an opaque origin, so `window.localStorage` is absent. */
function installLocalStorage() {
  const w = window as unknown as { localStorage?: Storage };
  if (w.localStorage) return;
  const map = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  Object.defineProperty(w, "localStorage", { value: shim, configurable: true });
}

const requestMock = vi.fn();
vi.mock("../lib/sync-engine/request-layer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/sync-engine/request-layer")>();
  return { ...actual, request: (...args: unknown[]) => requestMock(...args) };
});

const { syncEngine } = await import("../lib/sync-engine");
const { credentialManager } = await import("../lib/sync-engine/credential-manager");

const IDS = {
  VtopUsername: "25BCE1234",
  VtopPassword: "secret",
  MoodleUsername: "",
  MoodlePassword: "",
};

/** Routes a request by name so each test controls only what it cares about. */
function routeRequests() {
  requestMock.mockImplementation(async (path: string) => {
    if (path === "login") {
      return { success: true, authorizedID: "25BCE1234", cookies: ["JSESSIONID=x"], csrf: "c" };
    }
    if (path === "curriculum") {
      return { success: true, details: [], categories: [] };
    }
    return { success: true };
  });
}

/** Names of the requests made, in order, for asserting on sequence. */
function callOrder(): string[] {
  return requestMock.mock.calls.map((c) => String(c[0]));
}

beforeAll(installLocalStorage);
beforeEach(() => {
  requestMock.mockReset();
  credentialManager.clearCache();
  storage.ids.set({ ...IDS });
  storage.demoMode.set(false);
  // `syncEngine.ids` is private and set by `login`; start cold, the way a
  // reloaded page starts, so the storage fallback is what is under test.
  (syncEngine as unknown as { ids: unknown }).ids = null;
  routeRequests();
});
afterEach(() => {
  vi.clearAllMocks();
  storage.demoMode.remove();
});

describe("sync auto sign-in", () => {
  it("signs in before a vtop op when the engine is cold", async () => {
    // No `login()` call from this page, no session in memory — only the
    // credentials the student persisted at their real login.
    await syncEngine.sync("curriculum", {}, { silent: true });

    const order = callOrder();
    expect(order).toContain("login");
    expect(order).toContain("curriculum");
    // A request before the login would have gone out unauthenticated — the
    // exact bug this whole path exists to avoid.
    expect(order.indexOf("login")).toBeLessThan(order.indexOf("curriculum"));
  });

  it("does not sign in again when the session is still fresh", async () => {
    await credentialManager.ensureVtopSession(); // a session, established

    await syncEngine.sync("curriculum", {}, { silent: true });

    expect(callOrder().filter((name) => name === "login")).toHaveLength(1);
    expect(callOrder()).toContain("curriculum");
  });

  it("never signs in in demo mode", async () => {
    storage.demoMode.set(true);

    await syncEngine.sync("curriculum", {}, { silent: true });

    expect(callOrder()).not.toContain("login");
    expect(callOrder()).toContain("curriculum");
  });

  it("still demands credentials that do not exist", async () => {
    storage.ids.remove();

    await expect(syncEngine.sync("curriculum", {}, { silent: true })).rejects.toThrow("SyncEngine: not logged in");
  });

  it("reports a failed sign-in as itself, not as an op failure", async () => {
    requestMock.mockImplementation(async (path: string) => {
      if (path === "login") throw new Error("VTOP unreachable");
      return { success: true };
    });

    await expect(syncEngine.sync("curriculum", {}, { silent: true })).rejects.toThrow("VTOP unreachable");
  });
});
