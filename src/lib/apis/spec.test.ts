import { describe, it, expect, beforeEach, vi } from "vitest";

describe("mount spec loader", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("falls back to the bundled spec when the env var is unset", async () => {
    const { loadMountSpec } = await import("./spec");
    const spec = loadMountSpec();
    expect(spec.order).toEqual(["cache", "hono", "legacy", "unicc"]);
    expect(spec.mounts.hono.name).toBe("AmazeCC");
  });

  it("env override replaces the whole spec (order included)", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_API_MOUNTS",
      JSON.stringify({
        order: ["hono", "legacy"],
        mounts: {
          hono: { lib: "hono", enabled: true, baseUrl: "https://hono.amazecc.com", name: "AmazeCC (EU)" },
          legacy: { lib: "legacy", enabled: true },
        },
      }),
    );
    const { loadMountSpec } = await import("./spec");
    const spec = loadMountSpec();
    expect(spec.order).toEqual(["hono", "legacy"]);
    expect(spec.mounts.hono.name).toBe("AmazeCC (EU)");
    expect(spec.mounts.legacy.enabled).toBe(true);
  });

  it("invalid JSON falls back to the bundled spec", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_MOUNTS", "{not json");
    const { loadMountSpec } = await import("./spec");
    expect(loadMountSpec().order).toEqual(["cache", "hono", "legacy", "unicc"]);
  });

  it("unknown lib entries are dropped, not mounted", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_API_MOUNTS",
      JSON.stringify({
        order: ["hono", "bogus"],
        mounts: {
          hono: { lib: "hono", enabled: true },
          bogus: { lib: "does-not-exist", enabled: true },
        },
      }),
    );
    const { loadMountSpec } = await import("./spec");
    const spec = loadMountSpec();
    expect(spec.mounts.bogus).toBeDefined(); // declared but registry drops it
    expect(spec.order).toContain("bogus"); // order preserved; registry skips unknown lib
  });

  it("entries with no lib are dropped with a warning", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_API_MOUNTS",
      JSON.stringify({
        order: ["hono", "broken"],
        mounts: {
          hono: { lib: "hono", enabled: true },
          broken: { baseUrl: "https://x" },
        },
      }),
    );
    const { loadMountSpec } = await import("./spec");
    const spec = loadMountSpec();
    expect(spec.mounts.broken).toBeUndefined();
    expect(spec.order).toEqual(["hono"]);
  });
});
