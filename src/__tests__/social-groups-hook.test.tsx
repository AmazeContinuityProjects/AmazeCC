/**
 * The group hook, through its real behaviour rather than its internals.
 *
 * The maths and the storage are covered in `social-groups.test.ts`. What matters
 * here is the thing that actually broke in production: a member can stop being a
 * peer. Pairings are revocable, so a group can outlive its members, and if the
 * hook does not prune them then a group's count is permanently inflated and its
 * common-free figures are computed against people whose data no longer exists.
 *
 * A network stub throws on every call, so a test that quietly refetched would
 * fail rather than pass by accident.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { Provider } from "jotai";
import { createStore } from "jotai";

vi.mock("../lib/social/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/social/client")>();
  return {
    ...actual,
    readPeerTimetable: vi.fn(async () => {
      throw new Error("network: a hydration test must not depend on this");
    }),
  };
});

function installLocalStorage() {
  const w = window as unknown as { localStorage?: Storage };
  if (w.localStorage) return;
  const map = new Map<string, string>();
  const shim: Storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  Object.defineProperty(w, "localStorage", { value: shim, configurable: true });
}

const REG = "20626703";
const { readGroups, writeGroups, _resetForTests } = await import("../lib/social/storage");
const { useSocialGroups } = await import("../lib/social/useSocialGroups");
const { orderedDays, slotKey, slotMap } = await import("../lib/social/schedule");
import type { BusyEntry } from "../lib/social/types";

type BusyMapType = Record<string, BusyEntry>;

function firstKeys(n: number): string[] {
  const out: string[] = [];
  for (const d of orderedDays(slotMap))
    for (const { day, slotId } of d) {
      out.push(slotKey(day, slotId));
      if (out.length >= n) return out;
    }
  return out;
}
const [K1, K2] = firstKeys(2);

const MINE: BusyMapType = { [K1]: { c: "LEC_MINE" } };
const A: BusyMapType = { [K1]: { c: "LEC_A" } };
const B: BusyMapType = { [K2]: { c: "LEC_B" } };

type Api = ReturnType<typeof useSocialGroups>;

let store: ReturnType<typeof createStore>;

function mountGroups(params: { known: string[]; busy: Record<string, BusyMapType> }) {
  const busyMap = new Map(Object.entries(params.busy));
  const seen: { current: Api | null } = { current: null };

  function Probe() {
    seen.current = useSocialGroups({
      ownBusyMap: MINE,
      knownHandles: params.known,
      busyByHandle: busyMap,
    });
    return null;
  }

  const root = render(
    <Provider store={store}>
      <Probe />
    </Provider>
  );
  return { seen, root, act: () => act(async () => {}) };
}

beforeAll(installLocalStorage);
beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("profile", JSON.stringify({ applicationNumber: REG }));
  store = createStore();
});
afterEach(() => {
  _resetForTests(REG);
  vi.clearAllMocks();
});

describe("hydration", () => {
  it("reads the stored groups on first mount", async () => {
    writeGroups(
      [{ id: "g1", name: "Team", handles: ["AMZ-AAAA-1111"], createdAt: 1 }],
      REG
    );
    const { seen, root, act: flush } = mountGroups({
      known: ["AMZ-AAAA-1111"],
      busy: {},
    });
    await flush();
    expect(seen.current!.groups).toHaveLength(1);
    expect(seen.current!.groups[0].name).toBe("Team");
    root.unmount();
  });

  it("starts empty with nothing stored", async () => {
    const { seen, root, act: flush } = mountGroups({ known: [], busy: {} });
    await flush();
    expect(seen.current!.groups).toEqual([]);
    root.unmount();
  });
});

describe("membership", () => {
  it("creates a group with the chosen members", async () => {
    const { seen, root, act: flush } = mountGroups({
      known: ["AMZ-AAAA-1111", "AMZ-BBBB-2222"],
      busy: {},
    });
    await flush();

    await act(async () => {
      seen.current!.createGroup("  Project   team ", ["AMZ-AAAA-1111", "AMZ-BBBB-2222"]);
    });

    expect(seen.current!.groups).toHaveLength(1);
    expect(seen.current!.groups[0].name).toBe("Project team");
    expect(seen.current!.groups[0].handles).toEqual(["AMZ-AAAA-1111", "AMZ-BBBB-2222"]);
    root.unmount();
  });

  it("refuses to create a group with a blank name", async () => {
    const { seen, root, act: flush } = mountGroups({ known: [], busy: {} });
    await flush();
    await act(async () => {
      expect(seen.current!.createGroup("   ")).toBeNull();
    });
    expect(seen.current!.groups).toEqual([]);
    root.unmount();
  });

  it("ignores handles for people you are not paired with", async () => {
    const { seen, root, act: flush } = mountGroups({ known: ["AMZ-AAAA-1111"], busy: {} });
    await flush();
    await act(async () => {
      seen.current!.createGroup("Team", ["AMZ-AAAA-1111", "AMZ-NOBODY-9999"]);
    });
    // A group cannot be a back door to someone the user has no grant for.
    expect(seen.current!.groups[0].handles).toEqual(["AMZ-AAAA-1111"]);
    root.unmount();
  });

  it("toggles a member on and off", async () => {
    const { seen, root, act: flush } = mountGroups({
      known: ["AMZ-AAAA-1111", "AMZ-BBBB-2222"],
      busy: {},
    });
    await flush();
    await act(async () => {
      const g = seen.current!.createGroup("Team", ["AMZ-AAAA-1111"]);
      seen.current!.toggleMember(g!.id, "AMZ-BBBB-2222");
    });
    expect(seen.current!.groups[0].handles).toEqual([
      "AMZ-AAAA-1111",
      "AMZ-BBBB-2222",
    ]);

    await act(async () => {
      seen.current!.toggleMember(seen.current!.groups[0].id, "AMZ-AAAA-1111");
    });
    expect(seen.current!.groups[0].handles).toEqual(["AMZ-BBBB-2222"]);
    root.unmount();
  });
});

describe("a member stops being a peer", () => {
  it("prunes a revoked handle from the summary and the count", async () => {
    writeGroups(
      [{ id: "g1", name: "Team", handles: ["AMZ-AAAA-1111", "AMZ-GONE-7777"], createdAt: 1 }],
      REG
    );

    // Only AMZ-AAAA-1111 is still a peer: the other pairing was revoked.
    const { seen, root, act: flush } = mountGroups({
      known: ["AMZ-AAAA-1111"],
      busy: { "AMZ-AAAA-1111": A },
    });
    await flush();

    expect(seen.current!.summaries[0].metrics.memberCount).toBe(1);
    root.unmount();
  });

  it("reports a group as empty once every member is gone", async () => {
    writeGroups(
      [{ id: "g1", name: "Team", handles: ["AMZ-GONE-7777"], createdAt: 1 }],
      REG
    );
    const { seen, root, act: flush } = mountGroups({ known: [], busy: {} });
    await flush();

    // Not hidden — an empty group still appears, saying it has no members, so a
    // revoke does not look like a deletion.
    expect(seen.current!.summaries).toHaveLength(1);
    expect(seen.current!.summaries[0].empty).toBe(true);
    expect(seen.current!.summaries[0].metrics.commonFreeSlots).toBe(0);
    root.unmount();
  });

  it("persists the pruned membership when prune is called", async () => {
    writeGroups(
      [{ id: "g1", name: "Team", handles: ["AMZ-AAAA-1111", "AMZ-GONE-7777"], createdAt: 1 }],
      REG
    );
    const { seen, root, act: flush } = mountGroups({
      known: ["AMZ-AAAA-1111"],
      busy: {},
    });
    await flush();

    await act(async () => {
      seen.current!.prune();
    });

    expect(readGroups(REG)[0].handles).toEqual(["AMZ-AAAA-1111"]);
    root.unmount();
  });
});

describe("figures with an unloaded member", () => {
  it("counts a loading member as pending, not as free", async () => {
    writeGroups(
      [
        {
          id: "g1",
          name: "Team",
          handles: ["AMZ-AAAA-1111", "AMZ-LOADING-5555"],
          createdAt: 1,
        },
      ],
      REG
    );
    const { seen, root, act: flush } = mountGroups({
      known: ["AMZ-AAAA-1111", "AMZ-LOADING-5555"],
      busy: { "AMZ-AAAA-1111": A },
    });
    await flush();

    const s = seen.current!.summaries[0];
    // Excluded from the maths: treating "unknown" as "free" would make the group
    // look better than the evidence supports.
    expect(s.metrics.memberCount).toBe(1);
    expect(s.pending).toBe(1);
    root.unmount();
  });

  it("excludes a member who is busy from another's free time", async () => {
    // A is busy in K1, which the viewer is also busy in; B is busy in K2. The
    // common-free figure must not be inflated by treating B as free in K1.
    writeGroups(
      [
        {
          id: "g1",
          name: "Team",
          handles: ["AMZ-AAAA-1111", "AMZ-BBBB-2222"],
          createdAt: 1,
        },
      ],
      REG
    );
    const withBoth = mountGroups({
      known: ["AMZ-AAAA-1111", "AMZ-BBBB-2222"],
      busy: { "AMZ-AAAA-1111": A, "AMZ-BBBB-2222": B },
    });
    await withBoth.act();
    const both = withBoth.seen.current!.summaries[0].metrics.commonFreeSlots;
    withBoth.root.unmount();

    // A alone is free in K2, so the two-member group must be strictly narrower.
    const withA = mountGroups({
      known: ["AMZ-AAAA-1111", "AMZ-BBBB-2222"],
      busy: { "AMZ-AAAA-1111": A },
    });
    await withA.act();
    const alone = withA.seen.current!.summaries[0].metrics.commonFreeSlots;
    withA.root.unmount();

    expect(both).toBeLessThan(alone);
  });
});
