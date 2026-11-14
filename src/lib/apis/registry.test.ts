import { describe, it, expect } from "vitest";
import { resolveOperation, isFailoverStatus, listMounts } from "./registry";

describe("API registry", () => {
  it("mounts hono before legacy before unicc for allowlisted ops", () => {
    const chain = resolveOperation("attendance", "vtop");
    expect(chain.map((r) => r.mount.id)).toEqual(["hono", "legacy", "unicc"]);
    expect(chain[0].url).toBe("https://hono.amazecc.com/attendance");
    expect(chain[1].url).toBe("https://api.amazecc.com/attendance");
  });

  it("drops UniCC from the chain when it does not serve the op", () => {
    const chain = resolveOperation("whoami", "vtop");
    expect(chain.map((r) => r.mount.id)).toEqual(["hono", "legacy"]);
  });

  it("maps marks/stats onto the hono /services prefix and legacy's flat path", () => {
    const chain = resolveOperation("marks/stats", "vtop");
    expect(chain.map((r) => r.mount.id)).toEqual(["hono", "legacy"]);
    expect(chain[0].route.path).toBe("/services/marks/stats");
    expect(chain[1].route.path).toBe("/marks/stats");
  });

  it("diverts public GETs to the cache worker, never to legacy first", () => {
    const chain = resolveOperation("buses", "none");
    expect(chain[0].mount.id).toBe("cache");
    expect(chain[0].method).toBe("GET");
    expect(chain[0].route.path).toBe("/transport/buses");
  });

  it("diverts fresher-resources to the cache worker", () => {
    const chain = resolveOperation("fresher-resources", "none");
    expect(chain[0].mount.id).toBe("cache");
  });

  it("refuses to route unauthenticated calls to authenticated mounts", () => {
    // buses/fresher-resources are the only no-auth operations; a vtop-authed
    // call must still be allowed (legacy serves them publicly), but a none-
    // authed call to a vtop route must not pick one.
    const chain = resolveOperation("whoami", "none");
    expect(chain).toEqual([]);
  });

  it("never puts UniCC in front of an AmazeCC host; allowlist only", () => {
    const chain = resolveOperation("events", "vtop");
    expect(chain.map((r) => r.mount.id)).toEqual(["hono", "legacy"]);
    expect(chain.find((r) => r.mount.id === "unicc")).toBeUndefined();
  });

  it("marks failover statuses correctly (5xx only, never 4xx)", () => {
    expect(isFailoverStatus(500)).toBe(true);
    expect(isFailoverStatus(502)).toBe(true);
    expect(isFailoverStatus(503)).toBe(true);
    expect(isFailoverStatus(504)).toBe(true);
    expect(isFailoverStatus(401)).toBe(false);
    expect(isFailoverStatus(404)).toBe(false);
    expect(isFailoverStatus(200)).toBe(false);
  });

  it("lists mounts in priority order with titles", () => {
    const mounts = listMounts();
    expect(mounts.map((m) => m.id)).toEqual(["cache", "hono", "legacy", "unicc"]);
    expect(mounts.every((m) => m.baseUrl.startsWith("https://"))).toBe(true);
  });
});
