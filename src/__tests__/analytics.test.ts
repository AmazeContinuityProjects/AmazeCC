import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isAnalyticsEnabled,
  pendingEventCount,
  setAnalyticsEnabled,
  track,
} from "../lib/analytics";

/**
 * The analytics contract: opt-out really stops it, a missing sink really
 * queues rather than drops, and every payload is a count.
 *
 * The queue behaviour is the part that cannot be seen from a feature test —
 * `gtag` lands late by design, and the first events of a session are the ones
 * a study plan produces before the script arrives. A sink that swallows those
 * would report a session that never started.
 *
 * This jsdom environment has no `localStorage`, so it is stubbed here rather
 * than by a global setup file — the same call the local-storage subpage test
 * makes, for the same reason.
 */
function installLocalStorage() {
  const map = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: stub,
    configurable: true,
    writable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: stub,
      configurable: true,
      writable: true,
    });
  }
  return stub;
}

const store = installLocalStorage();

type GtagArgs = [command: string, name: string, params?: Record<string, unknown>];

function withGtag() {
  const calls: GtagArgs[] = [];
  (window as unknown as { gtag?: unknown }).gtag = (...args: GtagArgs) => {
    calls.push(args);
  };
  return calls;
}

function withoutGtag() {
  delete (window as unknown as { gtag?: unknown }).gtag;
}

beforeEach(() => {
  store.clear();
  withoutGtag();
  vi.restoreAllMocks();
});

describe("consent", () => {
  it("defaults to on, because the app already loads GA unconditionally", () => {
    expect(isAnalyticsEnabled()).toBe(true);
  });

  it("drops events while opted out, and never queues them", () => {
    setAnalyticsEnabled(false);

    const calls = withGtag();
    track("export_printable");

    expect(isAnalyticsEnabled()).toBe(false);
    expect(calls).toHaveLength(0);
    expect(pendingEventCount()).toBe(0);
  });

  it("drops the backlog the moment consent is revoked", () => {
    // No gtag yet, so these pile into the queue…
    track("generation_started", { courses: 5, ranking: "Balanced" });
    track("generation_done", { found: 12, capped: false, ms: 840 });
    expect(pendingEventCount()).toBe(2);

    // …and a "no" wipes escrow rather than sending it later.
    setAnalyticsEnabled(false);
    expect(pendingEventCount()).toBe(0);

    const calls = withGtag();
    setAnalyticsEnabled(true);
    expect(calls).toHaveLength(0);
  });

  it("flushes a backlog carried in from an earlier load once enabled", () => {
    // A previous session, gtag unavailable the whole time: these are sitting
    // in storage when this one starts.
    store.setItem(
      "ffcs_analytics_queue",
      JSON.stringify([
        { e: "generation_started", p: { courses: 5, ranking: "Balanced" }, t: 1 },
        { e: "generation_done", p: { found: 12, capped: false, ms: 840 }, t: 2 },
      ])
    );
    expect(pendingEventCount()).toBe(2);

    const calls = withGtag();
    setAnalyticsEnabled(true);

    expect(calls.map((c) => c[1])).toEqual([
      "generation_started",
      "generation_done",
    ]);
    expect(pendingEventCount()).toBe(0);
  });
});

describe("the sink", () => {
  it("sends straight through when gtag is already there", () => {
    const calls = withGtag();

    track("share_created", { courses: 6, bytes: 421 });

    expect(calls).toEqual([
      ["event", "share_created", { courses: 6, bytes: 421 }],
    ]);
    expect(pendingEventCount()).toBe(0);
  });

  it("queues rather than drops before the script lands, and flushes later", () => {
    track("tour_step", { step: 1, total: 5 });
    expect(pendingEventCount()).toBe(1);

    // The script arrives on the next event.
    const calls = withGtag();
    track("tour_step", { step: 2, total: 5 });

    expect(calls.map((c) => c[1])).toEqual(["tour_step", "tour_step"]);
    expect(pendingEventCount()).toBe(0);
  });

  it("caps the backlog, dropping the oldest", () => {
    for (let i = 0; i < 130; i++) {
      track("tour_step", { step: i, total: 130 });
    }

    expect(pendingEventCount()).toBe(100);

    const calls = withGtag();
    track("export_printable");
    // The oldest 30 are gone; the newest queued step came through first.
    const steps = calls.map((c) => c[2]?.step).filter((s) => typeof s === "number");
    expect(steps[0]).toBe(30);
    expect(steps).toHaveLength(100);
  });

  it("survives a throwing sink and a poisoned queue entry", () => {
    store.setItem(
      "ffcs_analytics_queue",
      JSON.stringify([{ e: "export_printable" }, { nonsense: true }, "junk"])
    );

    (window as unknown as { gtag?: unknown }).gtag = () => {
      throw new Error("script blocked");
    };

    expect(() => track("export_printable")).not.toThrow();
    expect(() => track("export_printable")).not.toThrow();
  });
});

describe("the payloads", () => {
  it("are counts and enums, never names", () => {
    const calls = withGtag();

    track("generation_started", { courses: 4, ranking: "Half Days" });
    track("import_file", { courses: 42, format: "csv" });
    track("share_created", { courses: 4, bytes: 512 });

    for (const [, , params] of calls) {
      for (const value of Object.values(params ?? {})) {
        expect(["string", "number", "boolean"]).toContain(typeof value);
      }
    }
    // A course title is the shape this must never take:
    expect(JSON.stringify(calls)).not.toContain("Data Structures");
  });
});
