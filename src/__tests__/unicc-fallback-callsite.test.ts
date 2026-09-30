/**
 * The UniCC fallback, tested where it actually happens: inside
 * `fetchWithFailover`, as the last hop after both AmazeCC hosts have failed.
 *
 * The mechanism is deliberately not a login special-case. UniCC was found to
 * share AmazeCC's `types/data/*.ts` almost verbatim — `login`, `schedule`,
 * `grades`, `hostel`, `marks` and `semTT` are byte-identical files — so the same
 * per-request hop that rescues a login also rescues grades and attendance. One
 * mechanism, one place to reason about, instead of a per-feature special case
 * that would need adding for every endpoint.
 *
 * ## The two properties that matter
 *
 * **A rejected password is never retried.** `fetchWithFailover` throws only on
 * `500/502/503/504` and on a thrown network error. A `401` carrying
 * `{"success": false}` is `res.ok === false` but is never thrown, so it flows
 * through untouched and `request()` turns it into an `AuthError`. Both backends
 * log in against real VTOP and VTOP locks an account after repeated failures, so
 * a mistyped password getting a second real attempt is a lockout risk, not a
 * nicety. The protection is structural, not a condition somebody has to remember.
 *
 * **The origin never becomes the global active URL.** The two AmazeCC hosts are
 * the same service, so switching globally between them is correct. UniCC is a
 * different service implementing a subset of routes, so a global switch would
 * point social sync, EventHub and student profile at a host that 404s them and
 * the app would look healthy while returning nothing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BACKUP_API_URL,
  PRIMARY_API_URL,
  fetchWithFailover,
  getActiveApiUrl,
  setActiveApiUrl,
  setOriginalFetchForTest,
} from "../lib/fetch-utils";
import { UNICC_API_URL, uniccPathFor, uniccUrlFor } from "../lib/unicc-fallback";

const UNICC = "https://api.uni-cc.site";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

let originalFetch: typeof fetch;

beforeEach(() => {
  originalFetch = window.fetch;
  setActiveApiUrl(PRIMARY_API_URL);
  setOriginalFetchForTest(originalFetch as typeof fetch);
});

afterEach(() => {
  window.fetch = originalFetch;
  setOriginalFetchForTest(originalFetch as typeof fetch);
  vi.restoreAllMocks();
});

describe("the endpoint allowlist", () => {
  it("covers the routes UniCC actually serves", () => {
    for (const p of [
      "login",
      "grades",
      "all-grades",
      "attendance",
      "calendar",
      "schedule",
      "hostel",
      "lms-data",
      "vitol-data",
    ]) {
      expect(uniccPathFor(`/api/${p}`)).toBe(p);
    }
  });

  it("refuses the routes it does not", () => {
    // These have no UniCC equivalent, and a request for one must fail rather
    // than be answered by a host that would 404 it.
    for (const p of [
      "social/sync",
      "events/login",
      "events/profile",
      "events/register",
      "student",
      "timetable",
      "ept-schedule",
      "registration-schedule",
      "hostel-attendance",
      "qbank/papers",
    ]) {
      expect(uniccPathFor(`/api/${p}`)).toBeNull();
    }
  });

  it("works from a full URL, and tolerates a missing or doubled /api/", () => {
    expect(uniccPathFor(`${PRIMARY_API_URL}/api/attendance`)).toBe("attendance");
    expect(uniccPathFor(`${PRIMARY_API_URL}/attendance`)).toBe("attendance");
    expect(uniccPathFor(`${PRIMARY_API_URL}/api/attendance/`)).toBe("attendance");
  });

  it("builds the UniCC URL, or null when there is nothing to build", () => {
    expect(uniccUrlFor(`${PRIMARY_API_URL}/api/grades`)).toBe(`${UNICC_API_URL}/api/grades`);
    expect(uniccUrlFor(`${PRIMARY_API_URL}/api/social/sync`)).toBeNull();
  });
});

describe("a working primary", () => {
  it("never touches UniCC", async () => {
    const mockFetch = vi.fn().mockResolvedValue(json({ ok: true }));
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY_API_URL}/api/attendance`);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("does not probe UniCC either", async () => {
    const mockFetch = vi.fn().mockResolvedValue(json({ ok: true }));
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);
    await fetchWithFailover(`${PRIMARY_API_URL}/api/grades`);
    expect(mockFetch.mock.calls.every(([u]: [string]) => !u.includes("uni-cc"))).toBe(true);
  });
});

describe("a rejected password", () => {
  it("is not retried, because a 401 is an answer and not a failure", async () => {
    // The whole lockout argument in one test. VTOP sees exactly one attempt.
    const mockFetch = vi.fn().mockResolvedValue(
      json({ success: false, message: "Invalid Username / Password" }, 401)
    );
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY_API_URL}/api/login`, {
      method: "POST",
      body: JSON.stringify({ username: "u", password: "wrong" }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(401);
    expect(mockFetch.mock.calls.every(([u]: [string]) => !u.includes("uni-cc"))).toBe(true);
  });
});

describe("both AmazeCC hosts down", () => {
  const bothDown = (uniccResponse?: () => Promise<Response>) => {
    const mock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch (primary down)"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch (backup down)"));
    if (uniccResponse) mock.mockImplementationOnce(uniccResponse);
    return mock;
  };

  it("retries the request on UniCC and returns its answer", async () => {
    const mockFetch = bothDown(() => Promise.resolve(json({ source: "unicc" })));
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY_API_URL}/api/attendance`);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenNthCalledWith(3, `${UNICC_API_URL}/api/attendance`, undefined);
    expect(await res.json()).toEqual({ source: "unicc" });
  });

  it("does not move the global active URL to UniCC", async () => {
    // The architectural guard. A global switch would send social sync, EventHub
    // and student profile to a host that 404s them.
    const mockFetch = bothDown(() => Promise.resolve(json({ ok: true })));
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    await fetchWithFailover(`${PRIMARY_API_URL}/api/grades`);

    expect(getActiveApiUrl()).toBe(BACKUP_API_URL);
    expect(getActiveApiUrl()).not.toBe(UNICC_API_URL);
  });

  it("keeps the global switch for the two AmazeCC hosts, which is the same service", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("primary down"))
      .mockResolvedValueOnce(json({ source: "backup" }));
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY_API_URL}/api/grades`);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(getActiveApiUrl()).toBe(BACKUP_API_URL);
    expect(await res.json()).toEqual({ source: "backup" });
  });

  it("preserves the request body, so a login is re-sent intact", async () => {
    // The body carries the credentials. Losing it would turn the fallback into
    // an empty login against a third party.
    const body = JSON.stringify({ username: "u", password: "p" });
    const init = { method: "POST", body };
    const mockFetch = bothDown(() => Promise.resolve(json({ ok: true })));
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    await fetchWithFailover(`${PRIMARY_API_URL}/api/login`, init);

    const thirdCall = mockFetch.mock.calls[2];
    expect(thirdCall[0]).toBe(`${UNICC_API_URL}/api/login`);
    expect(thirdCall[1]).toBe(init);
    expect((thirdCall[1] as RequestInit).body).toBe(body);
  });

  it("does not try UniCC for a route it does not serve", async () => {
    const mockFetch = bothDown();
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    await expect(
      fetchWithFailover(`${PRIMARY_API_URL}/api/social/sync`, { method: "POST", body: "{}" })
    ).rejects.toBeDefined();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("rethrows the backup's error when UniCC cannot help either", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("primary down"))
      .mockRejectedValueOnce(new TypeError("backup down"))
      .mockRejectedValueOnce(new TypeError("unicc down"));
    setOriginalFetchForTest(mockFetch as unknown as typeof fetch);

    await expect(fetchWithFailover(`${PRIMARY_API_URL}/api/grades`)).rejects.toThrow(
      /backup down/
    );
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("is skipped when the fallback is turned off", async () => {
    process.env.NEXT_PUBLIC_UNICC_FALLBACK = "off";
    try {
      const mockFetch = bothDown();
      setOriginalFetchForTest(mockFetch as unknown as typeof fetch);
      await expect(
        fetchWithFailover(`${PRIMARY_API_URL}/api/grades`)
      ).rejects.toBeDefined();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    } finally {
      delete process.env.NEXT_PUBLIC_UNICC_FALLBACK;
    }
  });
});

describe("the deployment default", () => {
  it("is the public UniCC host over HTTPS", () => {
    // HTTPS is not cosmetic: the app is a secure page, and a browser refuses to
    // send plain-HTTP requests from one, so an http:// default would never fire.
    expect(UNICC_API_URL).toBe(UNICC);
    expect(new URL(UNICC_API_URL).protocol).toBe("https:");
  });
});
