/**
 * The Social page's "Sync now" button.
 *
 * It exists because every social route is `auth: "vtop"`. Without a live
 * session the op fails in a way the user cannot act on, and the op swallows
 * that failure into `lastError`. So the button does the login and the sync as
 * one action, and the properties that matter are:
 *
 *   1. a session is ensured BEFORE the social op runs
 *   2. a missing set of credentials is a clear message, not "not logged in"
 *   3. a rejected sync surfaces, rather than the spinner stopping silently
 *   4. a second click while in flight does not start a second login
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

const SYNC_PAYLOAD = {
  success: true,
  identity: { handle: "AMZ-4KD2-7RP1", displayName: "Sugee", semesterId: "CH20262701" },
  peers: [],
  grantSecrets: [],
  busyMap: {},
  courses: [],
};

/** Routes a request by name so each test controls only what it cares about. */
function routeRequests(overrides: Record<string, () => unknown> = {}) {
  requestMock.mockImplementation(async (path: string) => {
    // Overrides win, so a test can replace the social response.
    if (overrides[path]) return overrides[path]();
    if (path === "login") {
      return { success: true, authorizedID: "25BCE1234", cookies: ["JSESSIONID=x"], csrf: "c" };
    }
    if (path === "social/identity/sync") {
      return SYNC_PAYLOAD;
    }
    return {};
  });
}

/** Names of the calls made, in order, for asserting on sequence. */
function callOrder(): string[] {
  return requestMock.mock.calls.map((c) => String(c[0]));
}

beforeAll(installLocalStorage);
beforeEach(() => {
  requestMock.mockReset();
  credentialManager.clearCache();
  storage.ids.set({ ...IDS });
  // `syncEngine.ids` is private and set by `login`; start from logged-out so the
  // storage fallback is what is under test.
  (syncEngine as unknown as { ids: unknown }).ids = null;
  routeRequests();
});
afterEach(() => vi.clearAllMocks());

describe("syncSocial", () => {
  it("ensures a session before running the social op", async () => {
    await syncEngine.syncSocial({ semesterId: "CH20262701" });

    const order = callOrder();
    expect(order).toContain("login");
    expect(order).toContain("social/identity/sync");
    // A social request before the login would have gone out unauthenticated,
    // which is the bug this whole path exists to avoid.
    expect(order.indexOf("login")).toBeLessThan(order.indexOf("social/identity/sync"));
  });

  it("falls back to persisted credentials when login has not run", async () => {
    // `this.ids` is null here, so without the storage fallback this throws
    // "SyncEngine: not logged in" even though the user IS signed in.
    expect((syncEngine as unknown as { ids: unknown }).ids).toBeNull();
    await expect(syncEngine.syncSocial({})).resolves.toBeDefined();
  });

  it("does not log in twice when a session is already fresh", async () => {
    await syncEngine.syncSocial({});
    const first = callOrder().filter((p) => p === "login").length;
    await syncEngine.syncSocial({});
    const second = callOrder().filter((p) => p === "login").length;
    expect(first).toBe(1);
    expect(second).toBe(1);
  });

  it("gives an actionable message when there are no credentials at all", async () => {
    storage.ids.remove();
    await expect(syncEngine.syncSocial({})).rejects.toThrow(/credentials/i);
  });

  it("propagates a rejected social sync instead of reporting success", async () => {
    routeRequests({ "social/identity/sync": () => ({ success: false, error: "handle_not_found" }) });
    // The op records the failure in lastError and returns null rather than
    // throwing, so the caller must not treat a null result as a success.
    const result = await syncEngine.syncSocial({});
    expect(result).toBeNull();
  });

  it("returns the sync payload on success", async () => {
    const res = await syncEngine.syncSocial({}) as { identity?: { handle?: string } };
    expect(res?.identity?.handle).toBe("AMZ-4KD2-7RP1");
  });
});
