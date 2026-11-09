import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOp } from "../lib/sync-engine/operation-registry";
import "../lib/sync-engine/operations";
import { PEER_CACHE_MAX_AGE_MS, peerNeedsFetch } from "../lib/social/usePeerTimetables";

const NOW = Date.parse("2026-11-10T12:00:00.000Z");

function cached(over: Record<string, unknown> = {}) {
  return {
    identity: { handle: "AMZ-AAAA-BBBB", publishedAt: "2026-11-09T10:00:00.000Z", semesterId: "CH20262701" },
    visibility: "full" as const,
    stale: false,
    busyMap: {},
    courses: [],
    fetchedAt: "2026-11-10T11:00:00.000Z",
    ...over,
  };
}

describe("peerNeedsFetch", () => {
  const base = {
    serverPublishedAt: "2026-11-09T10:00:00.000Z",
    grantVisibility: "full" as const,
    ownSemesterId: "CH20262701",
    now: NOW,
  };

  it("reads a peer with no cached copy", () => {
    expect(peerNeedsFetch({ ...base, cached: null })).toBe(true);
  });

  it("leaves a fresh, current copy alone", () => {
    expect(peerNeedsFetch({ ...base, cached: cached() })).toBe(false);
  });

  it("re-reads when the peer published after our copy", () => {
    expect(peerNeedsFetch({ ...base, serverPublishedAt: "2026-11-10T09:00:00.000Z", cached: cached() })).toBe(true);
  });

  it("re-reads a copy from another semester", () => {
    expect(
      peerNeedsFetch({ ...base, cached: cached({ identity: { ...cached().identity, semesterId: "CH20252605" } }) }),
    ).toBe(true);
  });

  it("re-reads a coarse copy once the grant is full", () => {
    expect(peerNeedsFetch({ ...base, cached: cached({ visibility: "coarse" }) })).toBe(true);
  });

  it("re-reads a copy older than the max age, or one with no fetch time", () => {
    const old = new Date(NOW - PEER_CACHE_MAX_AGE_MS - 1000).toISOString();
    expect(peerNeedsFetch({ ...base, cached: cached({ fetchedAt: old }) })).toBe(true);
    expect(peerNeedsFetch({ ...base, cached: cached({ fetchedAt: undefined }) })).toBe(true);
  });
});

describe("social op sync state", () => {
  beforeEach(() => localStorage.clear());

  function ctxWith(request: ReturnType<typeof vi.fn>, prev: unknown) {
    const setAtom = vi.fn();
    const ctx = {
      ids: { VtopUsername: "realuser", VtopPassword: "x" },
      emit: vi.fn(),
      bridge: { setAtom, getAtom: vi.fn(() => prev) },
      request,
    } as never;
    return { ctx, setAtom };
  }

  const states = (setAtom: ReturnType<typeof vi.fn>) =>
    setAtom.mock.calls.map((c) => c[1]).filter((v) => v && typeof v === "object" && "syncing" in v);

  it("flags syncing while the request runs", async () => {
    const request = vi.fn().mockResolvedValue({ success: false, message: "nope" });
    const { ctx, setAtom } = ctxWith(request, { version: 3, lastSyncedAt: null, lastError: null, syncing: false });
    await getOp("social")!.run(ctx, {});
    expect(states(setAtom)[0].syncing).toBe(true);
    expect(states(setAtom).at(-1).syncing).toBe(false);
  });

  it("keeps the last good sync time and version when a sync fails", async () => {
    const request = vi.fn().mockRejectedValue(new Error("VTOP down"));
    const prev = { version: 7, lastSyncedAt: "2026-11-10T11:55:00.000Z", lastError: null, syncing: false };
    const { ctx, setAtom } = ctxWith(request, prev);
    await getOp("social")!.run(ctx, {});
    const last = states(setAtom).at(-1);
    expect(last.lastSyncedAt).toBe(prev.lastSyncedAt);
    expect(last.version).toBe(7);
    expect(last.lastError).toMatch(/VTOP down/);
  });
});
