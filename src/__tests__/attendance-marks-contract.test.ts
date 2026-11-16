import { describe, expect, it, vi } from "vitest";
import { getOp } from "../lib/sync-engine/operation-registry";
import "../lib/sync-engine/operations";

describe("attendance marks response contract", () => {
  it("rejects a successful attendance response that omits marks data", async () => {
    const op = getOp("attendanceMarks");
    const ctx = {
      ids: { VtopUsername: "test", VtopPassword: "test" },
      emit: vi.fn(),
      bridge: { setAtom: vi.fn(), getAtom: vi.fn() },
      request: vi.fn().mockResolvedValue({ attRes: { attendance: [] } }),
    } as never;

    await expect(op?.run(ctx, { semesterId: "CH20262701" })).rejects.toThrow(
      "Marks fetch failed: the API response did not include marks data.",
    );
  });
});
