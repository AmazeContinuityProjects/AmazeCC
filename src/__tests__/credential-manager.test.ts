/**
 * The 10-minute VTOP session rule.
 *
 * Before this, `CredentialManager.vtop` was cached with no expiry: it survived
 * forever within a page and vanished on reload. The social op sent its request
 * with whatever was there, so an aged session produced an error envelope,
 * `res.identity` was undefined, and the op returned `null` — the social page
 * silently showed stale data with no red line. On a reload there was no session
 * at all, so the same request went out unauthenticated.
 *
 * These tests pin the four properties that fix depends on:
 *   1. a fresh session is reused without a second captcha solve
 *   2. an aged session is re-fetched, exactly once, even under concurrency
 *   3. a refresh never deadlocks against the login request that triggers it
 *   4. a missing session is NOT repaired by a side effect of some unrelated
 *      request, because a login costs a captcha
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * jsdom hands vitest an opaque origin, so `window.localStorage` is absent and
 * `storage.ts` swallows the resulting failure — `ids.set()` would silently
 * write nothing and every `ids.get()` would return null.
 */
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
beforeAll(installLocalStorage);

import { storage } from "../lib/storage";

/**
 * Only `request` is faked. `setAuthProvider` is the real one, so the manager
 * still registers itself and the re-entrancy path in test 3 is genuinely
 * exercised rather than short-circuited by the mock.
 */
const requestMock = vi.fn();
vi.mock("../lib/sync-engine/request-layer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/sync-engine/request-layer")>();
  return { ...actual, request: (...args: unknown[]) => requestMock(...args) };
});

const { credentialManager, VTOP_SESSION_MAX_AGE_MS } = await import(
  "../lib/sync-engine/credential-manager"
);
type Creds = Awaited<ReturnType<typeof credentialManager.getCreds>>;

const IDS = {
  VtopUsername: "25BCE1234",
  VtopPassword: "secret",
  MoodleUsername: "",
  MoodlePassword: "",
};

function seedIds() {
  storage.ids.set({ ...IDS });
}

/** A login response shaped like `/api/login` returns. */
function loginResponse(n: number) {
  return {
    success: true,
    authorizedID: "25BCE1234",
    cookies: [`JSESSIONID=abc${n}`],
    csrf: `csrf-${n}`,
  };
}

/** Number of times the login route was actually hit. */
function loginCount(): number {
  return requestMock.mock.calls.filter((c) => c[0] === "login").length;
}

beforeEach(() => {
  requestMock.mockReset();
  credentialManager.clearCache();
  storage.ids.set({ ...IDS });
  storage.eventHubSession.remove();
  vi.useFakeTimers();
  // `shouldAdvanceTime` matters: the concurrency test relies on a real 50 ms
  // delay inside the mocked request, which plain fake timers would freeze
  // forever and turn into a timeout.
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // A fixed clock so the 10-minute boundary is testable without sleeping.
  vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  credentialManager.clearCache();
});

describe("ensureVtopSession", () => {
  it("logs in when there is no session", async () => {
    requestMock.mockResolvedValue(loginResponse(1));
    const creds = await credentialManager.ensureVtopSession();
    expect(creds?.authorizedID).toBe("25BCE1234");
    expect(loginCount()).toBe(1);
  });

  it("reuses a session that is younger than 10 minutes", async () => {
    requestMock.mockResolvedValue(loginResponse(1));
    await credentialManager.ensureVtopSession();

    vi.setSystemTime(new Date(Date.now() + VTOP_SESSION_MAX_AGE_MS - 1000));
    await credentialManager.ensureVtopSession();

    // A second captcha solve here would be the bug this rule exists to avoid.
    expect(loginCount()).toBe(1);
  });

  it("re-logs-in once the session passes 10 minutes", async () => {
    requestMock.mockResolvedValueOnce(loginResponse(1)).mockResolvedValueOnce(loginResponse(2));
    const first = await credentialManager.ensureVtopSession();

    vi.setSystemTime(new Date(Date.now() + VTOP_SESSION_MAX_AGE_MS + 1));
    const second = await credentialManager.ensureVtopSession();

    expect(loginCount()).toBe(2);
    // Proof the session was actually replaced, not merely re-requested.
    expect(second?.csrf).toBe("csrf-2");
    expect(second?.csrf).not.toBe(first?.csrf);
  });

  it("shares one login between concurrent callers", async () => {
    requestMock.mockImplementation(async () => {
      // Long enough that three overlapping callers are genuinely in flight.
      await new Promise((r) => setTimeout(r, 50));
      return loginResponse(1);
    });

    const [a, b, c] = await Promise.all([
      credentialManager.ensureVtopSession(),
      credentialManager.ensureVtopSession(),
      credentialManager.ensureVtopSession(),
    ]);

    // Three captcha solves for one stale session would be the failure mode.
    expect(loginCount()).toBe(1);
    expect(a?.csrf).toBe("csrf-1");
    expect(b?.csrf).toBe("csrf-1");
    expect(c?.csrf).toBe("csrf-1");
  });

  it("throws rather than logging in with no stored credentials", async () => {
    storage.ids.remove();
    await expect(credentialManager.ensureVtopSession()).rejects.toThrow(/credentials/i);
    expect(loginCount()).toBe(0);
  });
});

describe("getCreds", () => {
  it("returns null when there is no session, without logging in", async () => {
    // A request must not be able to trigger a captcha solve as a side effect.
    const creds = await credentialManager.getCreds("vtop");
    expect(creds).toBeNull();
    expect(loginCount()).toBe(0);
  });

  it("replaces an aged session before handing it to a request", async () => {
    requestMock.mockResolvedValueOnce(loginResponse(1)).mockResolvedValueOnce(loginResponse(2));
    await credentialManager.ensureVtopSession();

    vi.setSystemTime(new Date(Date.now() + VTOP_SESSION_MAX_AGE_MS + 1));
    const creds: Creds = await credentialManager.getCreds("vtop");

    expect(loginCount()).toBe(2);
    expect(creds?.csrf).toBe("csrf-2");
  });

  it("keeps a stale session when the refresh fails", async () => {
    // Better to try a possibly-dead session than to fail the request outright;
    // the server is the authority on whether it still works.
    requestMock.mockResolvedValueOnce(loginResponse(1));
    await credentialManager.ensureVtopSession();

    vi.setSystemTime(new Date(Date.now() + VTOP_SESSION_MAX_AGE_MS + 1));
    requestMock.mockRejectedValue(new Error("VTOP is down"));

    const creds = await credentialManager.getCreds("vtop");
    expect(creds?.csrf).toBe("csrf-1");
  });

  it("does not deadlock when a refresh's login request asks for creds", async () => {
    // The hazard, which needs a *stale but present* session. A first-ever login
    // has `this.vtop === null` and short-circuits, so it cannot prove anything
    // about this loop.
    //
    //   getCreds (stale) -> ensureVtopSession -> loginVtop -> request("login")
    //     -> body building awaits authProvider("vtop") -> getCreds (still stale)
    //     -> ensureVtopSession -> the refresh in flight -> the login request
    //     that is waiting on this.  Cycle.
    //
    // Note the counter approach: `mockResolvedValueOnce` would shadow a
    // `mockImplementation` set afterwards, so the re-entrant branch would never
    // execute and this test would pass without testing anything.
    let call = 0;
    let reentrant: Promise<unknown> | null = null;
    requestMock.mockImplementation(async () => {
      const seq = (call += 1);
      if (seq === 2) {
        // Mirrors the real request layer, which AWAITS the provider while
        // building the body: `await authProvider(...)`.
        reentrant = credentialManager.getCreds("vtop");
        await reentrant;
      }
      return loginResponse(seq);
    });

    // Seed a session, then age it so the next getCreds must refresh.
    await credentialManager.ensureVtopSession();
    expect(call).toBe(1);
    expect(credentialManager.getStoredVtop()).not.toBeNull();
    vi.setSystemTime(new Date(Date.now() + VTOP_SESSION_MAX_AGE_MS + 1));

    const creds = await credentialManager.getCreds("vtop");
    expect(reentrant).not.toBeNull();
    await reentrant;

    expect(creds?.csrf).toBe("csrf-2");
    // The initial login plus exactly one refresh. A nested duplicate login
    // would show up here as 3.
    expect(loginCount()).toBe(2);
  });

  it("stamps fetchedAt so the clock starts at login time", async () => {
    requestMock.mockResolvedValue(loginResponse(1));
    const before = Date.now();
    const creds = await credentialManager.ensureVtopSession();
    expect(creds?.fetchedAt).toBeGreaterThanOrEqual(before);
  });

  it("leaves the EventHub session alone", async () => {
    const eventHub = await credentialManager.getCreds("eventhub");
    expect(eventHub).toBeNull();
    expect(loginCount()).toBe(0);
  });
});
