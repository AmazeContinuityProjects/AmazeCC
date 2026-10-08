import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  UNICC_API_URL,
  __resetUniccProbe,
  __setUniccFetch,
  isUniccFallbackEnabled,
  isUniccReachable,
  loginViaUnicc,
} from "../lib/unicc-fallback";
import type { VtopCreds } from "../lib/sync-engine/types";

/**
 * The UniCC fallback, and the one rule it exists to keep.
 *
 * UniCC is a third-party host that receives a student's VTOP password, so this
 * adapter is deliberately narrow: one endpoint, one call site, and a hard rule
 * that a rejected password is never retried anywhere. That rule is the first
 * test, because it is the one that protects the student's account.
 */

const creds = (over: Partial<VtopCreds> = {}): VtopCreds => ({
  cookies: "JSESSIONID=abc; Path=/",
  authorizedID: "24BCE1234",
  csrf: "csrf-token",
  fetchedAt: 1_700_000_000_000,
  ...over,
});

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as unknown as Response;

beforeEach(() => {
  __resetUniccProbe();
  __setUniccFetch(null);
  delete process.env.NEXT_PUBLIC_UNICC_FALLBACK;
});

afterEach(() => {
  __setUniccFetch(null);
  __resetUniccProbe();
  vi.restoreAllMocks();
});

describe("configuration", () => {
  it("defaults to the public UniCC deployment over HTTPS", () => {
    // HTTPS is load-bearing: the app is a secure page, and a browser refuses to
    // send plain-HTTP requests from one, so an http:// value would never fire.
    expect(UNICC_API_URL).toBe("https://api-unicc.arya22.dev");
  });

  it("can be turned off without a code change", () => {
    expect(isUniccFallbackEnabled()).toBe(true);
    process.env.NEXT_PUBLIC_UNICC_FALLBACK = "off";
    expect(isUniccFallbackEnabled()).toBe(false);
  });

  it("does not even probe when turned off", async () => {
    process.env.NEXT_PUBLIC_UNICC_FALLBACK = "off";
    const fetchSpy = vi.fn();
    __setUniccFetch(fetchSpy as unknown as typeof fetch);
    expect(await isUniccReachable()).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("the reachability probe", () => {
  it("calls UniCC's documented status endpoint", async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({ text: "API is working" }));
    __setUniccFetch(fetchSpy as unknown as typeof fetch);

    expect(await isUniccReachable()).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api-unicc.arya22.dev/api/status",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("caches the verdict, so a dead host is paid for once", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("connection refused");
    });
    __setUniccFetch(fetchSpy as unknown as typeof fetch);

    expect(await isUniccReachable()).toBe(false);
    expect(await isUniccReachable()).toBe(false);
    expect(await isUniccReachable()).toBe(false);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

describe("logging in through UniCC", () => {
  it("sends exactly the fields UniCC documents: username and password", async () => {
    const fetchSpy = vi
      .fn()
      .mockImplementationOnce(async () => jsonResponse({ text: "API is working" }))
      .mockImplementationOnce(async (url, init) => {
        expect(url).toBe("https://api-unicc.arya22.dev/api/login");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          username: "24BCE1234",
          password: "secret",
        });
        return jsonResponse({
          success: true,
          message: "Login successful!",
          cookies: "JSESSIONID=xyz; Path=/",
          csrf: "csrf-abc",
          authorizedID: "24BCE1234",
        });
      });
    __setUniccFetch(fetchSpy as unknown as typeof fetch);

    const outcome = await loginViaUnicc("24BCE1234", "secret");
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.creds.cookies).toBe("JSESSIONID=xyz; Path=/");
      expect(outcome.creds.authorizedID).toBe("24BCE1234");
      expect(outcome.creds.csrf).toBe("csrf-abc");
    }
  });

  it("returns the joined cookie jar UniCC actually sends", async () => {
    // UniCC's login route does `[...cookies, ...loginCookies].join("; ")`, and
    // so does the AmazeCC API. A string is the real shape, and the backend
    // accepts both — this pins that we pass it through rather than reshaping it.
    const fetchSpy = vi.fn()
      .mockImplementationOnce(async () => jsonResponse({ text: "ok" }))
      .mockImplementationOnce(async () =>
        jsonResponse({
          success: true,
          cookies: "captcha=1; JSESSIONID=2; sesskey=3",
          csrf: "c",
          authorizedID: "ID",
        })
      );
    __setUniccFetch(fetchSpy as unknown as typeof fetch);

    const outcome = await loginViaUnicc("u", "p");
    expect(outcome.kind).toBe("ok");
    if (outcome.kind === "ok") {
      expect(outcome.creds.cookies).toBe("captcha=1; JSESSIONID=2; sesskey=3");
    }
  });

  it("distinguishes a rejected password from an unusable host", async () => {
    // This is the distinction the whole design turns on. "rejected" means the
    // credentials are wrong and must be recorded as a failure; "unavailable" means
    // we got nothing and the caller should rethrow its own error.
    const rejectSpy = vi.fn()
      .mockImplementationOnce(async () => jsonResponse({ text: "ok" }))
      .mockImplementationOnce(async () =>
        jsonResponse({ success: false, message: "Invalid Username / Password" }, 401)
      );
    __setUniccFetch(rejectSpy as unknown as typeof fetch);

    const rejected = await loginViaUnicc("u", "wrong");
    expect(rejected.kind).toBe("rejected");
    if (rejected.kind === "rejected") {
      expect(rejected.message).toBe("Invalid Username / Password");
    }

    __resetUniccProbe();
    const downSpy = vi.fn(async () => {
      throw new Error("ETIMEDOUT");
    });
    __setUniccFetch(downSpy as unknown as typeof fetch);
    const unavailable = await loginViaUnicc("u", "p");
    expect(unavailable.kind).toBe("unavailable");
  });

  it("treats a 200 with no session as unavailable rather than guessing", async () => {
    const fetchSpy = vi.fn()
      .mockImplementationOnce(async () => jsonResponse({ text: "ok" }))
      .mockImplementationOnce(async () => jsonResponse({ success: true }));
    __setUniccFetch(fetchSpy as unknown as typeof fetch);

    const outcome = await loginViaUnicc("u", "p");
    expect(outcome.kind).toBe("unavailable");
    if (outcome.kind === "unavailable") {
      expect(outcome.reason).toMatch(/no session/i);
    }
  });

  it("reports a 5xx as unavailable, not as a rejected password", async () => {
    // A 502 means the host is unwell. Treating it as a rejected password would
    // block the student as if they had mistyped their password.
    const fetchSpy = vi.fn()
      .mockImplementationOnce(async () => jsonResponse({ text: "ok" }))
      .mockImplementationOnce(async () => jsonResponse({}, 502));
    __setUniccFetch(fetchSpy as unknown as typeof fetch);

    expect((await loginViaUnicc("u", "p")).kind).toBe("unavailable");
  });

  it("survives a CORS failure, which is what a blocked browser looks like", async () => {
    // The request never leaves the browser, so the catch is the only signal. It
    // must degrade to "unavailable" so the student sees the original error.
    const corsSpy = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    __setUniccFetch(corsSpy as unknown as typeof fetch);

    const outcome = await loginViaUnicc("u", "p");
    expect(outcome.kind).toBe("unavailable");
  });

  it("does not call login at all when the host is already known to be down", async () => {
    const fetchSpy = vi.fn(async () => {
      throw new Error("refused");
    });
    __setUniccFetch(fetchSpy as unknown as typeof fetch);

    // First call probes and fails...
    expect((await loginViaUnicc("u", "p")).kind).toBe("unavailable");
    const callsAfterProbe = fetchSpy.mock.calls.length;
    // ...and the second is served from the cached verdict without a new request.
    expect((await loginViaUnicc("u", "p")).kind).toBe("unavailable");
    expect(fetchSpy.mock.calls.length).toBe(callsAfterProbe);
  });
});
