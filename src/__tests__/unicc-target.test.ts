/**
 * Tests for the user-selectable target server.
 *
 * The login screen and the sync sheet both offer "UniCC" as a target, and every
 * internal request flows through `fetchWithFailover`, so this is where the
 * opt-in has to actually do something.
 *
 * ## The one property that must never break
 *
 * Choosing UniCC must not buy a second attempt at VTOP. Both hosts authenticate
 * against real VTOP with real credentials, and VTOP locks an account after
 * repeated failures — so a `401` from UniCC has to end the request, not be
 * caught and retried against AmazeCC. That is the difference between
 * "try UniCC first" and "try UniCC and then carry on regardless", and it is
 * asserted directly rather than inferred.
 *
 * Everything else here is about the preference being honest: it must not move
 * the global active URL, and it must not claim credit for routes UniCC does not
 * have.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PRIMARY = "https://api.amazecc.com";
const BACKUP = "https://mirror.amazecc.deno.net";
const UNICC = "https://api.uni-cc.site";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const netFail = () => Promise.reject(new TypeError("Failed to fetch"));

let originalWindowFetch: typeof fetch;
let realEnv: Record<string, string | undefined>;

/**
 * jsdom's own `localStorage` is shadowed by Node's experimental global, which is
 * `undefined` without `--localstorage-file`. The target preference is persisted,
 * so these tests need a store that works.
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
 * A complete, consistent instance of the request layer and its UniCC module.
 *
 * Both have to come from the same `vi.resetModules()` cycle. The activity tally
 * and the target preference are module state, and the request layer records into
 * the copy it imported — so pulling `unicc-fallback` in separately would read a
 * different store and every counter would sit at zero, which is a test that
 * passes for the wrong reason.
 */
async function load(env: Record<string, string | undefined> = {}) {
  vi.resetModules();
  for (const [k, v] of Object.entries({
    NEXT_PUBLIC_API_URL: PRIMARY,
    NEXT_PUBLIC_BACKUP_API_URL: BACKUP,
    NEXT_PUBLIC_UNICC_API_URL: UNICC,
  })) {
    process.env[k] = v;
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const un = await import("../lib/unicc-fallback");
  const fu = await import("../lib/fetch-utils");
  return {
    ...fu,
    setUniccTarget: un.setUniccTarget,
    getUniccTarget: un.getUniccTarget,
    getUniccActivity: un.getUniccActivity,
    resetUniccActivity: un.resetUniccActivity,
    uniccRouteName: un.uniccRouteName,
    subscribeUniccLogEvents: un.subscribeUniccLogEvents,
  };
}

const urlsCalled = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.map(([u]: [unknown]) => String(u));

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
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  window.fetch = originalWindowFetch;
  for (const [k, v] of Object.entries(realEnv)) {
    const key = k === "primary" ? "NEXT_PUBLIC_API_URL"
      : k === "backup" ? "NEXT_PUBLIC_BACKUP_API_URL"
      : k === "unicc" ? "NEXT_PUBLIC_UNICC_API_URL"
      : "NEXT_PUBLIC_UNICC_FALLBACK";
    if (v === undefined) delete process.env[key];
    else process.env[key] = v;
  }
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("the default target", () => {
  it("is AmazeCC, so nothing changes for a student who never opts in", async () => {
    const { fetchWithFailover, getUniccTarget, setOriginalFetchForTest } = await load();
    const mock = vi.fn().mockResolvedValue(json({ ok: true }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    await fetchWithFailover(`${PRIMARY}/api/attendance`);

    expect(getUniccTarget()).toBe("amazecc");
    expect(mock).toHaveBeenCalledTimes(1);
    expect(urlsCalled(mock)[0]).toBe(`${PRIMARY}/api/attendance`);
  });

  it("still uses UniCC as a last resort when both AmazeCC hosts are down", async () => {
    const { fetchWithFailover, getUniccActivity, setOriginalFetchForTest } = await load();
    const mock = vi
      .fn()
      .mockImplementationOnce(netFail)
      .mockImplementationOnce(netFail)
      .mockResolvedValueOnce(json({ source: "unicc" }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY}/api/attendance`);

    expect(await res.json()).toEqual({ source: "unicc" });
    // Recorded even though nobody asked for it, because a third party quietly
    // serving a student's data is exactly what should not be invisible.
    const a = getUniccActivity();
    expect(a.served).toBe(1);
    expect(a.lastPath).toBe("attendance");
  });
});

describe("opting in to UniCC", () => {
  it("asks UniCC first", async () => {
    const { fetchWithFailover, setUniccTarget, getUniccActivity, setOriginalFetchForTest } =
      await load();
    setUniccTarget("unicc");
    const mock = vi.fn().mockResolvedValue(json({ source: "unicc" }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY}/api/grades`);

    expect(mock).toHaveBeenCalledTimes(1);
    expect(urlsCalled(mock)[0]).toBe(`${UNICC}/api/grades`);
    expect(await res.json()).toEqual({ source: "unicc" });
    // The control for the "a rejected login is not a served request" test below:
    // this proves the counter moves when UniCC really does answer.
    expect(getUniccActivity().served).toBe(1);
  });

  it("does not touch AmazeCC at all when UniCC answers", async () => {
    const { fetchWithFailover, setUniccTarget, setOriginalFetchForTest } = await load();
    setUniccTarget("unicc");
    const mock = vi.fn().mockResolvedValue(json({ ok: true }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    await fetchWithFailover(`${PRIMARY}/api/attendance`);

    expect(urlsCalled(mock).some((u) => u.includes("amazecc"))).toBe(false);
  });

  it("leaves the global active URL on AmazeCC", async () => {
    // A preference, not a takeover. If this moved, the 20-odd routes UniCC does
    // not implement would start 404ing again — the exact bug this feature sits
    // next to.
    const { fetchWithFailover, setUniccTarget, getActiveApiUrl, setOriginalFetchForTest } =
      await load();
    setUniccTarget("unicc");
    setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ ok: true })) as unknown as typeof fetch
    );

    await fetchWithFailover(`${PRIMARY}/api/attendance`);

    expect(getActiveApiUrl()).toBe(PRIMARY);
  });

  it("sends the body, because a login that lost it would be an empty login", async () => {
    const { fetchWithFailover, setUniccTarget, setOriginalFetchForTest } = await load();
    setUniccTarget("unicc");
    const mock = vi.fn().mockResolvedValue(json({ success: true }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const body = JSON.stringify({ username: "u", password: "p" });
    await fetchWithFailover(`${PRIMARY}/api/login`, { method: "POST", body });

    expect(urlsCalled(mock)[0]).toBe(`${UNICC}/api/login`);
    expect(mock.mock.calls[0][1].body).toBe(body);
  });

  it("can be turned back off again, and stops preferring UniCC", async () => {
    const { fetchWithFailover, setUniccTarget, setOriginalFetchForTest } = await load();
    setUniccTarget("unicc");
    setUniccTarget("amazecc");
    const mock = vi.fn().mockResolvedValue(json({ ok: true }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    await fetchWithFailover(`${PRIMARY}/api/attendance`);

    expect(urlsCalled(mock)).toEqual([`${PRIMARY}/api/attendance`]);
  });
});

describe("opting in must not cost a second attempt at VTOP", () => {
  it("stops on a 401 from UniCC rather than trying AmazeCC", async () => {
    // The most important assertion in this file. A catch-and-carry-on would
    // re-send the same wrong password to a second host that logs into the same
    // real VTOP, which is how accounts get locked.
    const { fetchWithFailover, setUniccTarget, setOriginalFetchForTest } = await load();
    setUniccTarget("unicc");
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
    expect(urlsCalled(mock).some((u) => u.includes("amazecc"))).toBe(false);
  });

  it("does not count a rejection as a served request", async () => {
    const { fetchWithFailover, setUniccTarget, getUniccActivity, setOriginalFetchForTest } =
      await load();
    setUniccTarget("unicc");
    setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ success: false, message: "invalid" }, 401)) as unknown as typeof fetch
    );

    await fetchWithFailover(`${PRIMARY}/api/login`, { method: "POST", body: "{}" });

    // Showing "UniCC served 1 request" after a failed login would be a lie the
    // user would act on. The paired success case above proves this counter is
    // live, so a zero here means zero and not "never measured".
    expect(getUniccActivity().served).toBe(0);
  });
});

describe("opting in when UniCC cannot help", () => {
  it("carries on to AmazeCC when UniCC is unreachable", async () => {
    const { fetchWithFailover, setUniccTarget, getUniccActivity, setOriginalFetchForTest } =
      await load();
    setUniccTarget("unicc");
    const mock = vi
      .fn()
      .mockImplementationOnce(netFail)
      .mockResolvedValueOnce(json({ source: "amazecc" }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY}/api/grades`);

    expect(await res.json()).toEqual({ source: "amazecc" });
    expect(getUniccActivity().failed).toBe(1);
  });

  it("carries on when UniCC answers 503, which is an outage not a verdict", async () => {
    const { fetchWithFailover, setUniccTarget, getUniccActivity, setOriginalFetchForTest } =
      await load();
    setUniccTarget("unicc");
    const mock = vi
      .fn()
      .mockResolvedValueOnce(json("down", 503))
      .mockResolvedValueOnce(json({ source: "amazecc" }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${PRIMARY}/api/grades`);

    expect(await res.json()).toEqual({ source: "amazecc" });
    expect(getUniccActivity().failed).toBe(1);
  });

  it("still goes to AmazeCC for a route UniCC does not have", async () => {
    const { fetchWithFailover, setUniccTarget, setOriginalFetchForTest } = await load();
    setUniccTarget("unicc");
    const mock = vi.fn().mockResolvedValue(json({ ok: true }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    await fetchWithFailover(`${PRIMARY}/api/student`, { method: "POST", body: "{}" });

    expect(urlsCalled(mock)).toEqual([`${PRIMARY}/api/student`]);
  });

  it("counts those, so the sync sheet can admit the preference has limits", async () => {
    // Without this the UI would read "UniCC is serving your data" while the bus
    // route, dues and the wallet quietly came from somewhere else.
    const { fetchWithFailover, setUniccTarget, getUniccActivity, setOriginalFetchForTest } =
      await load();
    setUniccTarget("unicc");
    setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ ok: true })) as unknown as typeof fetch
    );

    await fetchWithFailover(`${PRIMARY}/api/transport`, { method: "POST", body: "{}" });
    await fetchWithFailover(`${PRIMARY}/api/wallet`, { method: "POST", body: "{}" });

    const a = getUniccActivity();
    expect(a.unsupported).toBe(2);
    expect(a.served).toBe(0);
    expect(a.lastPath).toBe("wallet");
  });

  it("does not count unsupported routes when the user did not opt in", async () => {
    // Otherwise every ordinary request would inflate a counter nobody asked to
    // see, and the sync sheet would be permanently noisy.
    const { fetchWithFailover, getUniccActivity, setOriginalFetchForTest } = await load();
    setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ ok: true })) as unknown as typeof fetch
    );

    await fetchWithFailover(`${PRIMARY}/api/student`, { method: "POST", body: "{}" });

    expect(getUniccActivity().unsupported).toBe(0);
  });
});

describe("the target setting itself", () => {
  it("persists the opt-in and clears it again", async () => {
    const { setUniccTarget, getUniccTarget } = await load();
    setUniccTarget("unicc");
    expect(getUniccTarget()).toBe("unicc");
    expect(store.get("amazecc_unicc_target")).toBe("unicc");

    setUniccTarget("amazecc");
    expect(getUniccTarget()).toBe("amazecc");
    // Removed rather than set to "amazecc", so a later change to the default is
    // not pinned by a value written by an older version.
    expect(store.has("amazecc_unicc_target")).toBe(false);
  });

  it("is restored on the next load", async () => {
    const first = await load();
    first.setUniccTarget("unicc");
    expect(store.get("amazecc_unicc_target")).toBe("unicc");

    // A fresh module graph, standing in for a page reload: the preference has to
    // survive without the user picking it again.
    const reloaded = await load();
    expect(reloaded.getUniccTarget()).toBe("unicc");
  });

  it("ignores a repeated set to the same value", async () => {
    const { setUniccTarget, getUniccTarget } = await load();
    setUniccTarget("amazecc");
    setUniccTarget("amazecc");
    expect(getUniccTarget()).toBe("amazecc");
  });

  it("keeps AmazeCC active when the fallback is switched off entirely", async () => {
    // The hard kill-switch has to beat the per-user opt-in, or turning UniCC off
    // at the deployment level would be silently ignored for anyone who had
    // previously opted in.
    const { fetchWithFailover, setUniccTarget, setOriginalFetchForTest } = await load({
      NEXT_PUBLIC_UNICC_FALLBACK: "off",
    });
    setUniccTarget("unicc");
    const mock = vi.fn().mockResolvedValue(json({ ok: true }));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    await fetchWithFailover(`${PRIMARY}/api/attendance`);

    expect(urlsCalled(mock)).toEqual([`${PRIMARY}/api/attendance`]);
  });
});

describe("reporting who is serving", () => {
  it("says AmazeCC answered when AmazeCC answered", async () => {
    const { fetchWithFailover, getUniccActivity, setOriginalFetchForTest } = await load();
    setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ ok: true })) as unknown as typeof fetch
    );

    await fetchWithFailover(`${PRIMARY}/api/attendance`);

    // The line the sync sheet leads with is derived from exactly this.
    expect(getUniccActivity().lastServer).toBe("amazecc");
    expect(getUniccActivity().lastPath).toBe("attendance");
  });

  it("says UniCC answered when UniCC answered", async () => {
    const { fetchWithFailover, setUniccTarget, getUniccActivity, setOriginalFetchForTest } =
      await load();
    setUniccTarget("unicc");
    setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ ok: true })) as unknown as typeof fetch
    );

    await fetchWithFailover(`${PRIMARY}/api/all-grades`);

    expect(getUniccActivity().lastServer).toBe("unicc");
    expect(getUniccActivity().lastPath).toBe("all-grades");
  });

  it("flips back to AmazeCC when a request UniCC cannot serve comes along", async () => {
    // Otherwise the sheet keeps claiming UniCC is serving after the app has
    // quietly moved on without it.
    const { fetchWithFailover, setUniccTarget, getUniccActivity, setOriginalFetchForTest } =
      await load();
    setUniccTarget("unicc");
    setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ ok: true })) as unknown as typeof fetch
    );

    await fetchWithFailover(`${PRIMARY}/api/attendance`);
    expect(getUniccActivity().lastServer).toBe("unicc");

    await fetchWithFailover(`${PRIMARY}/api/student`, { method: "POST", body: "{}" });
    expect(getUniccActivity().lastServer).toBe("amazecc");
  });

  it("says AmazeCC again if UniCC is tried and turns out to be down", async () => {
    const { fetchWithFailover, setUniccTarget, getUniccActivity, setOriginalFetchForTest } =
      await load();
    setUniccTarget("unicc");
    const mock = vi
      .fn()
      .mockImplementationOnce(netFail) // UniCC unreachable
      .mockResolvedValueOnce(json({ ok: true })); // AmazeCC answers
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    await fetchWithFailover(`${PRIMARY}/api/grades`);

    expect(getUniccActivity().lastServer).toBe("amazecc");
    expect(getUniccActivity().failed).toBe(1);
  });

  it("does not count a routine AmazeCC request as a UniCC statistic", async () => {
    // Otherwise the sync log would claim a hand-off that never happened.
    const { fetchWithFailover, getUniccActivity, setOriginalFetchForTest } = await load();
    setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ ok: true })) as unknown as typeof fetch
    );

    await fetchWithFailover(`${PRIMARY}/api/attendance`);

    const a = getUniccActivity();
    expect(a.served).toBe(0);
    expect(a.failed).toBe(0);
  });
});

describe("the log events the sync sheet renders", () => {
  const collect = async (api: Awaited<ReturnType<typeof load>>) => {
    const events: string[] = [];
    api.subscribeUniccLogEvents((e) => events.push(`${e.type}:${e.path}`));
    return events;
  };

  it("reports the hand-off when AmazeCC fails and UniCC takes over", async () => {
    // The line the user actually asked for: "AmazeCC failed, we fell back".
    const api = await load();
    const events = await collect(api);
    const mock = vi
      .fn()
      .mockImplementationOnce(netFail)
      .mockImplementationOnce(netFail)
      .mockResolvedValueOnce(json({ ok: true }));
    api.setOriginalFetchForTest(mock as unknown as typeof fetch);

    await api.fetchWithFailover(`${PRIMARY}/api/attendance`);

    expect(events).toContain("fell_back_to_unicc:attendance");
    expect(events).toContain("unicc_served:attendance");
  });

  it("reports which server took over when UniCC was preferred", async () => {
    const api = await load();
    const events = await collect(api);
    api.setUniccTarget("unicc");
    api.setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ ok: true })) as unknown as typeof fetch
    );

    await api.fetchWithFailover(`${PRIMARY}/api/grades`);

    expect(events).toEqual(["unicc_served:grades"]);
  });

  it("reports UniCC being unavailable, naming the endpoint", async () => {
    const api = await load();
    const events = await collect(api);
    api.setUniccTarget("unicc");
    const mock = vi
      .fn()
      .mockImplementationOnce(netFail)
      .mockResolvedValueOnce(json({ ok: true }));
    api.setOriginalFetchForTest(mock as unknown as typeof fetch);

    await api.fetchWithFailover(`${PRIMARY}/api/hostel`);

    expect(events).toEqual(["unicc_unavailable:hostel"]);
  });

  it("stays quiet for a route UniCC does not have, because nothing was handed over", async () => {
    const api = await load();
    const events = await collect(api);
    api.setUniccTarget("unicc");
    api.setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ ok: true })) as unknown as typeof fetch
    );

    await api.fetchWithFailover(`${PRIMARY}/api/student`, { method: "POST", body: "{}" });

    // Logging "UniCC" here would be inventing a hand-off.
    expect(events).toEqual([]);
  });

  it("stays quiet when the primary works and no server had to be substituted", async () => {
    const api = await load();
    const events = await collect(api);
    api.setOriginalFetchForTest(
      vi.fn().mockResolvedValue(json({ ok: true })) as unknown as typeof fetch
    );

    await api.fetchWithFailover(`${PRIMARY}/api/attendance`);

    expect(events).toEqual([]);
  });
});

describe("reporting helpers", () => {
  it("names a route for display, supported or not", async () => {
    const { uniccRouteName } = await load();
    expect(uniccRouteName(`${UNICC}/api/all-grades`)).toBe("all-grades");
    expect(uniccRouteName(`${PRIMARY}/api/hostel-counselling`)).toBe("hostel-counselling");
  });
});
