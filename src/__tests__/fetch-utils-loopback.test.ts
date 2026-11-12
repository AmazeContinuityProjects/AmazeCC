/**
 * A loopback primary (`NEXT_PUBLIC_API_URL=http://localhost:3000`) gets no
 * automatic failover to the hosted backup.
 *
 * The hosted backup does not serve a CORS preflight from the dev server, so
 * the hop dies at the network layer with `TypeError: Failed to fetch` and
 * replaces the primary's real error — the one that says why the dev API
 * failed — with a message that points the reader at the wrong host. In this
 * setup the hop is worth neither its latency nor the misdirection.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as FetchUtils from "../lib/fetch-utils";

const PRIMARY = "http://localhost:3000";
const BACKUP = "https://mirror.amazecc.deno.net";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

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

async function loadFetchUtils(env: Record<string, string | undefined>): Promise<typeof FetchUtils> {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return await import("../lib/fetch-utils");
}

let originalWindowFetch: typeof fetch;
let realEnv: Record<string, string | undefined>;

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
  vi.spyOn(console, "log").mockImplementation(() => {});
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

describe("loopback primary", () => {
  const env = {
    NEXT_PUBLIC_API_URL: PRIMARY,
    NEXT_PUBLIC_BACKUP_API_URL: BACKUP,
    // No UniCC target configured, so the last hop is unavailable too.
    NEXT_PUBLIC_UNICC_FALLBACK: "0",
  };

  it("surfaces the primary's error instead of a backup CORS TypeError", async () => {
    const { fetchWithFailover, setOriginalFetchForTest } = await loadFetchUtils(env);

    const mock = vi.fn().mockRejectedValue(new Error("Server error 500"));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    await expect(fetchWithFailover(`${PRIMARY}/api/course-page`, { method: "POST" })).rejects.toThrow(
      "Server error 500",
    );
    // Exactly one attempt: the doomed backup hop never happens.
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("does not swap the process-wide active API URL for the loopback default", async () => {
    const { fetchWithFailover, getActiveApiUrl, setOriginalFetchForTest } = await loadFetchUtils(env);

    const mock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    await expect(fetchWithFailover(`${PRIMARY}/api/course-page`)).rejects.toBeDefined();
    expect(getActiveApiUrl()).toBe(PRIMARY);
  });

  it("still fails over for a hosted primary", async () => {
    const hostedEnv = { ...env, NEXT_PUBLIC_API_URL: "https://api.amazecc.com" };
    const { fetchWithFailover, setOriginalFetchForTest } = await loadFetchUtils(hostedEnv);

    const mock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("mirror")) return Promise.resolve(json({ source: "backup" }));
      return Promise.reject(new TypeError("Failed to fetch"));
    });
    setOriginalFetchForTest(mock as unknown as typeof fetch);

    const res = await fetchWithFailover(`${hostedEnv.NEXT_PUBLIC_API_URL}/api/course-page`);
    expect(res.ok).toBe(true);
    expect(await res.json()).toEqual({ source: "backup" });
    expect(mock).toHaveBeenCalledTimes(2);
  });
});
