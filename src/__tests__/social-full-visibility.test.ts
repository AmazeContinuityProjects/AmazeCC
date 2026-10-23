import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Existing pairings were minted when coarse was a choice. The sharing UI no
 * longer offers that choice, so those grants have to be raised to full or the
 * user's old pairs stay permanently redacted with no control to fix them.
 */
const fetchMock = vi.fn();

vi.mock("@/lib/sync-engine", () => ({
  api: (path: string, opts: { method?: string; body?: unknown }) =>
    fetchMock(path, { method: opts?.method, body: opts?.body }),
}));

import { upgradeGrantsToFull } from "../lib/social/visibility";
import type { StoredGrant } from "../lib/social/client";

function grant(id: string, visibility: "coarse" | "full"): StoredGrant {
  return {
    grantId: id,
    secret: "s".repeat(43),
    peerHandle: `AMZ-${id.toUpperCase()}`,
    visibility,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("upgradeGrantsToFull", () => {
  beforeEach(() => fetchMock.mockReset());

  it("does nothing when every grant is already full", async () => {
    await expect(upgradeGrantsToFull([grant("g1", "full")])).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("raises a coarse grant to full", async () => {
    fetchMock.mockResolvedValueOnce({ success: true, grantId: "g1", visibility: "full" });

    const upgraded = await upgradeGrantsToFull([grant("g1", "coarse")]);

    expect(upgraded.map((g) => g.grantId)).toEqual(["g1"]);
    expect(upgraded[0].visibility).toBe("full");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("social/grant/visibility", {
      method: "POST",
      body: { grantId: "g1", visibility: "full" },
    });
  });

  it("keeps upgrading the rest after one grant fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ success: false, error: "grant_invalid" })
      .mockResolvedValueOnce({ success: true, grantId: "g2", visibility: "full" });

    const upgraded = await upgradeGrantsToFull([
      grant("g1", "coarse"),
      grant("g2", "coarse"),
    ]);

    expect(upgraded.map((g) => g.grantId)).toEqual(["g2"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reports no upgrade when every request fails", async () => {
    fetchMock.mockResolvedValueOnce({ success: false, error: "grant_invalid" });

    await expect(upgradeGrantsToFull([grant("g1", "coarse")])).resolves.toEqual([]);
  });

  it("coalesces two mounts into one upgrade pass", async () => {
    fetchMock.mockResolvedValue({ success: true, grantId: "g1", visibility: "full" });

    const [first, second] = await Promise.all([
      upgradeGrantsToFull([grant("g1", "coarse")]),
      upgradeGrantsToFull([grant("g1", "coarse")]),
    ]);

    expect(first.map((g) => g.grantId)).toEqual(["g1"]);
    expect(second.map((g) => g.grantId)).toEqual(["g1"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
