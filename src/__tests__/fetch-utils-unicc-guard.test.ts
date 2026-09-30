/**
 * Regression tests for the misconfiguration that broke the app in production.
 *
 * ## What happened
 *
 * `NEXT_PUBLIC_BACKUP_API_URL` was set to `api.uni-cc.site`, which is the natural
 * knob to reach for when you want UniCC involved. It is the worst possible
 * choice, and worth locking down with a test.
 *
 * That slot is the only place the app rewrites the origin of *every* request, so
 * setting it to UniCC sent `/api/student`, `/api/transport`, `/api/buses`,
 * `/api/wallet`, `/api/od`, `/api/acknowledgement`, `/api/payments` and about
 * fifteen more routes to a host that does not implement them. Every one came
 * back 404, and because a 404 is an *answer* rather than a failure, the failover
 * logic never even noticed. The app looked healthy and returned nothing.
 *
 * The allowlist in `unicc-fallback.ts` did not help, and could not: it guards the
 * per-request hop, and this traffic never reached it.
 *
 * ## What is asserted here
 *
 * That a UniCC host cannot become the global active API URL by any of the three
 * routes available to it — environment variable, stored custom URL, or a direct
 * `setActiveApiUrl` call — and that a 5xx from a real backup still reaches the
 * allowlisted UniCC hop instead of being handed to the caller as data.
 *
 * The module is re-imported per test with `vi.resetModules()` because
 * `PRIMARY_API_URL` and `BACKUP_API_URL` are read from the environment at module
 * scope, and these tests need different configurations of the same module.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as FetchUtils from "../lib/fetch-utils";

const PRIMARY = "https://api.amazecc.com";
const BACKUP = "https://mirror.amazecc.deno.net";
const UNICC = "https://api.uni-cc.site";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const netFail = () => Promise.reject(new TypeError("Failed to fetch"));

let originalWindowFetch: typeof fetch;
let realEnv: Record<string, string | undefined>;

/**
 * In-memory `localStorage`.
 *
 * jsdom's is not reachable here: Node exposes its own experimental `localStorage`
 * global, which resolves to `undefined` without `--localstorage-file`, and that
 * one shadows the jsdom property. These tests are specifically about state that
 * survives a reload, so they need a store that actually works — and the
 * production code only ever calls four methods, so a stub is a faithful
 * substitute rather than a fudge.
 */
const store = new Map<string, string>();

function installLocalStorageStub(): void {
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  });
}

/**
 * Import a fresh copy of the module under a specific environment.
 */
async function loadFetchUtils(
  env: Record<string, string | undefined>
): Promise<typeof FetchUtils> {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return await import("../lib/fetch-utils");
}

function urlsCalled(mock: ReturnType<typeof vi.fn>): string[] {
  return mock.mock.calls.map(([u]: [unknown]) => String(u));
}

beforeEach(() => {
  originalWindowFetch = window.fetch;
  realEnv = {
    primary: process.env.NEXT_PUBLIC_API_URL,
    backup: process.env.NEXT_PUBLIC_BACKUP_API_URL,
    unicc: process.env.NEXT_PUBLIC_UNICC_API_URL,
    off: process.env.NEXT_PUBLIC_UNICC_FALLBACK,
  };
  installLocalStorageStub();
  store.clear();
  // Silence the deliberate configuration warnings; the behaviour is asserted,
  // not the logging.
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  window.fetch = originalWindowFetch;
  store.clear();
  process.env.NEXT_PUBLIC_API_URL = realEnv.primary;
  if (realEnv.backup === undefined) delete process.env.NEXT_PUBLIC_BACKUP_API_URL;
  else process.env.NEXT_PUBLIC_BACKUP_API_URL = realEnv.backup;
  if (realEnv.unicc === undefined) delete process.env.NEXT_PUBLIC_UNICC_API_URL;
  else process.env.NEXT_PUBLIC_UNICC_API_URL = realEnv.unicc;
  if (realEnv.off === undefined) delete process.env.NEXT_PUBLIC_UNICC_FALLBACK;
  else process.env.NEXT_PUBLIC_UNICC_FALLBACK = realEnv.off;
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("UniCC configured as the backup gateway", () => {
  const env = {
    NEXT_PUBLIC_API_URL: PRIMARY,
    NEXT_PUBLIC_BACKUP_API_URL: UNICC,
    NEXT_PUBLIC_UNICC_API_URL: UNICC,
  };

  it("is not reported as a usable backup to offer the user", async () => {
    const { hasBackupApi } = await loadFetchUtils(env);
    // Settings should not offer to "switch to" a host that breaks the app.
    expect(hasBackupApi()).toBe(false);
  });

  it("never becomes the active API URL, even after the primary fails", async () => {
    const { fetchWithFailover, getActiveApiUrl, setOriginalFetchForTest } =
      await loadFetchUtils(env);

    // Both attempts fail, so the failure path runs to completion.
    const mock = vi.fn().mockImplementationOnce(netFail).mockImplementationOnce(netFail);
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    await expect(fetchWithFailover(`${PRIMARY}/api/grades`)).rejects.toBeDefined();

    expect(getActiveApiUrl()).not.toBe(UNICC);
    expect(getActiveApiUrl()).toBe(PRIMARY);
  });

  it("refuses to be set as the active URL by an explicit call", async () => {
    const { setActiveApiUrl, getActiveApiUrl } = await loadFetchUtils(env);
    setActiveApiUrl(UNICC);
    expect(getActiveApiUrl()).toBe(PRIMARY);
  });

  it("is ignored as a stored custom URL, and cleared", async () => {
    window.localStorage.setItem("amazecc_custom_api_url", UNICC);
    const { getActiveApiUrl } = await loadFetchUtils(env);

    // A stale custom URL would otherwise keep breaking the app until cleared by
    // hand, for a user who has no idea that is why it is broken.
    expect(getActiveApiUrl()).toBe(PRIMARY);
    expect(window.localStorage.getItem("amazecc_custom_api_url")).toBeNull();
  });

  it("leaves a real AmazeCC mirror alone", async () => {
    window.localStorage.setItem("amazecc_custom_api_url", BACKUP);
    // A real mirror in the backup slot, so `hasBackupApi()` is the control: the
    // guard is against a partial host, not against custom URLs in general.
    const { getActiveApiUrl, hasBackupApi } = await loadFetchUtils({
      NEXT_PUBLIC_API_URL: PRIMARY,
      NEXT_PUBLIC_BACKUP_API_URL: BACKUP,
      NEXT_PUBLIC_UNICC_API_URL: UNICC,
    });
    expect(getActiveApiUrl()).toBe(BACKUP);
    expect(hasBackupApi()).toBe(true);
  });
});

describe("with every host down", () => {
  const env = {
    NEXT_PUBLIC_API_URL: PRIMARY,
    NEXT_PUBLIC_BACKUP_API_URL: BACKUP,
    NEXT_PUBLIC_UNICC_API_URL: UNICC,
  };

  it("never asks UniCC for a route it does not have", async () => {
    const { fetchWithFailover, setOriginalFetchForTest } = await loadFetchUtils(env);
    const mock = vi.fn().mockImplementationOnce(netFail).mockImplementationOnce(netFail);
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    // The full list of paths that 404'd in the browser console.
    for (const path of [
      "student",
      "profile-images",
      "transport",
      "events/login",
      "od",
      "acknowledgement",
      "ept-schedule",
      "buses",
      "social/identity/sync",
      "payments",
      "library-due",
      "bank-info",
      "course-completion",
      "credentials",
      "hostel-counselling",
      "dayboarder",
      "exc-registration",
      "minor-honour",
      "registration-schedule",
      "wallet",
      "payment-receipts",
    ]) {
      mock.mockImplementationOnce(netFail).mockImplementationOnce(netFail);
      await expect(
        fetchWithFailover(`${PRIMARY}/api/${path}`, { method: "POST", body: "{}" })
      ).rejects.toBeDefined();
    }

    expect(urlsCalled(mock).some((u) => u.includes("uni-cc"))).toBe(false);
  });

  it("still asks UniCC for a route it does have", async () => {
    const { fetchWithFailover, setOriginalFetchForTest } = await loadFetchUtils(env);
    const mock = vi
      .fn()
      .mockImplementationOnce(netFail)
      .mockImplementationOnce(netFail)
      .mockResolvedValueOnce(json({ source: "unicc" }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY}/api/attendance`);
    expect(urlsCalled(mock)).toContain(`${UNICC}/api/attendance`);
    expect(await res.json()).toEqual({ source: "unicc" });
  });

  it("tries UniCC when the backup answers 503 rather than throwing", async () => {
    // The gap that let a broken backup end the chain: a 5xx is a response, so
    // without an explicit check it was returned to the caller as if it were
    // data and the UniCC hop was never reached.
    const { fetchWithFailover, setOriginalFetchForTest } = await loadFetchUtils(env);
    const mock = vi
      .fn()
      .mockImplementationOnce(netFail)
      .mockResolvedValueOnce(json("bad gateway", 503))
      .mockResolvedValueOnce(json({ source: "unicc" }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY}/api/grades`);
    expect(urlsCalled(mock)).toContain(`${UNICC}/api/grades`);
    expect(await res.json()).toEqual({ source: "unicc" });
  });

  it("does not treat a 404 as an outage, because a 404 is an answer", async () => {
    const { fetchWithFailover, setOriginalFetchForTest } = await loadFetchUtils(env);
    const mock = vi
      .fn()
      .mockImplementationOnce(netFail)
      .mockResolvedValueOnce(json("not found", 404));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY}/api/grades`);
    // Handing this to the caller as a result would be worse than an error.
    expect(res.status).toBe(404);
    expect(mock).toHaveBeenCalledTimes(2);
  });

  it("goes back to the primary when the backup is the one that is down", async () => {
    // Without this, once the global URL had failed over, a dead backup ended the
    // chain and UniCC was never consulted.
    const { fetchWithFailover, getActiveApiUrl, setActiveApiUrl, setOriginalFetchForTest } =
      await loadFetchUtils(env);
    setActiveApiUrl(BACKUP);

    const mock = vi
      .fn()
      .mockImplementationOnce(netFail) // backup is down
      .mockResolvedValueOnce(json({ source: "primary" })); // primary recovers
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY}/api/grades`);
    expect(await res.json()).toEqual({ source: "primary" });
    expect(getActiveApiUrl()).toBe(PRIMARY);
  });

  it("keeps a rejected password to exactly one attempt", async () => {
    // VTOP locks accounts after repeated failures, so a 401 must never be
    // retried anywhere. This is the single most important assertion in the file.
    const { fetchWithFailover, setOriginalFetchForTest } = await loadFetchUtils(env);
    const mock = vi
      .fn()
      .mockResolvedValue(json({ success: false, message: "Invalid Username / Password" }, 401));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY}/api/login`, {
      method: "POST",
      body: JSON.stringify({ username: "u", password: "wrong" }),
    });

    expect(res.status).toBe(401);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(urlsCalled(mock).some((u) => u.includes("uni-cc"))).toBe(false);
  });
});

describe("with a real mirror configured", () => {
  it("still swaps the global URL between the two AmazeCC hosts", async () => {
    // The guard added for UniCC must not have broken the mechanism it shares.
    const env = {
      NEXT_PUBLIC_API_URL: PRIMARY,
      NEXT_PUBLIC_BACKUP_API_URL: BACKUP,
      NEXT_PUBLIC_UNICC_API_URL: UNICC,
    };
    const { fetchWithFailover, getActiveApiUrl, setOriginalFetchForTest } =
      await loadFetchUtils(env);

    const mock = vi
      .fn()
      .mockImplementationOnce(netFail)
      .mockResolvedValueOnce(json({ source: "mirror" }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY}/api/grades`);
    expect(urlsCalled(mock)).toContain(`${BACKUP}/api/grades`);
    expect(await res.json()).toEqual({ source: "mirror" });
    expect(getActiveApiUrl()).toBe(BACKUP);
  });

  it("passes a request explicitly addressed to UniCC straight through", async () => {
    // UniCC is the fallback destination, not a failover target, so it must not
    // be classified and rewritten to the AmazeCC origin.
    const env = {
      NEXT_PUBLIC_API_URL: PRIMARY,
      NEXT_PUBLIC_BACKUP_API_URL: BACKUP,
      NEXT_PUBLIC_UNICC_API_URL: UNICC,
    };
    const { fetchWithFailover, setOriginalFetchForTest } = await loadFetchUtils(env);
    const mock = vi.fn().mockResolvedValue(json({ text: "API is working" }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${UNICC}/api/status`);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
