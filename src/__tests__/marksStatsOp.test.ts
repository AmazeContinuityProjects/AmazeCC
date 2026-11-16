import { describe, it, expect, beforeEach } from "vitest";
import { getOp } from "@/lib/sync-engine/operation-registry";
import "@/lib/sync-engine/operations";
import { marksStatsAtom } from "@/store/dataAtoms";

/**
 * The `marksStats` engine op.
 *
 * The engine requests the FFCS-enrollment-gated `/curves` batch route for the
 * requested semester and uses `/attendance` only to seed missing enrollment.
 */
/**
 * jsdom hands vitest an opaque origin, so `localStorage` is absent — and the op reads
 * it bare (`localStorage.key`), so the stub goes on `globalThis`, not just `window`.
 * Same pattern as `localStorageSubpage.test.tsx`.
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

installLocalStorage();

function fakeCtx() {
  const calls: Array<{ path: string; body: unknown; opts: unknown }> = [];
  const atoms = new Map<unknown, unknown>();
  return {
    calls,
    ctx: {
      request: async (path: string, body: unknown, opts: unknown) => {
        calls.push({ path, body, opts });
        return {
          success: true,
          stats: {
            C1: { count: 10, mean: 70, sd: 5, assessments: {} },
            C2: { count: 8, mean: 75, sd: 4, assessments: {} },
          },
        };
      },
      ids: {},
      emit: () => {},
      bridge: {
        setAtom: (a: unknown, v: unknown) => {
          atoms.set(a, v);
        },
        getAtom: (a: unknown) => atoms.get(a),
      },
    } as never,
    atoms,
  };
}

const MARKS = {
  courses: [
    { classNbr: "C1", courseCode: "AAA1001" },
    { classNbr: "C2", courseCode: "AAA1002" },
    { courseCode: "AAA1003" },
  ],
};
const FROZEN = {
  courses: [
    { classNbr: "C3", courseCode: "AAA2001" },
    { classNbr: "C1", courseCode: "AAA1001" },
  ],
};

describe("marksStats op", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("marks", JSON.stringify(MARKS));
    localStorage.setItem("frozen_marks_CH20252601", JSON.stringify(FROZEN));
  });

  it("is registered", () => {
    expect(getOp("marksStats")?.name).toBe("marksStats");
  });

  it("fetches only current-semester classes and sends the semester", async () => {
    const op = getOp("marksStats")!;
    const { ctx, calls } = fakeCtx();
    await op.run(ctx, { semesterId: "CH20262701" });
    expect(calls).toHaveLength(1);
    expect(calls[0].path).toBe("curves");
    expect(calls[0].body).toEqual({
      classIds: expect.arrayContaining(["C1", "C2"]),
      semesterId: "CH20262701",
    });
    // The historical C3 entry is ignored, and the codeless course is skipped.
    expect((calls[0].body as { classIds: string[] }).classIds).toHaveLength(2);
  });

  it("persists and bridges the merged result", async () => {
    const op = getOp("marksStats")!;
    const { ctx, atoms } = fakeCtx();
    const out = (await op.run(ctx, { semesterId: "CH20262701" })) as { stats: Record<string, unknown> };
    expect(out.stats).toHaveProperty("C1");
    expect(atoms.get(marksStatsAtom)).toHaveProperty("C1");
    expect(JSON.parse(localStorage.getItem("marksStats") || "{}")).toHaveProperty("C1");
  });

  it("replaces stale stats from a previous semester", async () => {
    const op = getOp("marksStats")!;
    const { ctx, atoms } = fakeCtx();
    atoms.set(marksStatsAtom, { C9: { count: 1 } });
    await op.run(ctx, { semesterId: "CH20262701" });
    const merged = atoms.get(marksStatsAtom) as Record<string, unknown>;
    expect(merged).not.toHaveProperty("C9");
    expect(merged).toHaveProperty("C1");
  });

  it("returns empty without calling when there are no classes", async () => {
    localStorage.clear();
    const op = getOp("marksStats")!;
    const { ctx, calls } = fakeCtx();
    const out = (await op.run(ctx, {})) as { stats: Record<string, unknown> };
    expect(out).toEqual({ stats: {} });
    expect(calls).toHaveLength(0);
  });
});
