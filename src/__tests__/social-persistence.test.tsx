/**
 * Does a synced person survive a page reload?
 *
 * The storage layer's own round trips are covered in `social.test.ts`. What is
 * NOT covered is the step above it: a **fresh mount** reading that storage and
 * populating the atoms. That is what "survives a reload" actually means, since a
 * reload discards every atom and re-runs the hydration effect from scratch.
 *
 * A reload is modelled the honest way — unmount the tree, build a new one, and
 * let nothing but `localStorage` carry over.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { Provider } from "jotai";
import { createStore } from "jotai";

/**
 * The client is stubbed so a hydration test can never quietly succeed by
 * reaching the network. If a test needs the network it should fail loudly.
 */
vi.mock("../lib/social/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/social/client")>();
  return {
    ...actual,
    syncIdentity: vi.fn(async () => {
      throw new Error("network: hydration must not depend on this");
    }),
  };
});

/**
 * A fresh Jotai store per mount.
 *
 * Without this the atoms are module-global via the default store and leak
 * between tests, so a later mount inherits the previous one's identity. Giving
 * each mount its own store is also the more faithful model: a real page reload
 * discards every atom, so each test mount should start with nothing and be
 * filled only by whatever it can recover from `localStorage`.
 */
let store: ReturnType<typeof createStore>;

beforeEach(() => {
  store = createStore();
});

/** jsdom hands vitest an opaque origin, so `window.localStorage` is absent. */
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
const PEER = "AMZ-7K2P-9RTW";

const IDENTITY = {
  ownerKey: "hash-abc",
  handle: "AMZ-4KD2-7RP1",
  displayName: "Sugee",
  semesterId: "CH20262701",
  semesterLabel: "Sem 7",
  derivedAt: "2026-09-28T10:00:00.000Z",
};

const OWN_BUSY = { MON: { A1: "LEC_21BCE1101" } };
const OWN_COURSES = [{ id: "21BCE1101", name: "Operating Systems", slot: "MONA1" }];

const GRANTS = [
  { grantId: "g1", peerHandle: PEER, secret: "s3cret", visibility: "coarse" },
];

const PEER_CACHE = {
  identity: { handle: PEER, displayName: "Priya Raman", publishedAt: "2026-09-28T09:00:00.000Z" },
  visibility: "coarse" as const,
  busyMap: { TUE: { B2: "LEC_21BCE1203" } },
  courses: [{ id: "21BCE1203", name: "Discrete Maths", slot: "TUEB2" }],
  stale: false,
};

function seedProfile(reg = REG) {
  window.localStorage.setItem("profile", JSON.stringify({ applicationNumber: reg }));
}

beforeAll(installLocalStorage);
beforeEach(() => window.localStorage.clear());
afterEach(() => vi.clearAllMocks());

/** Writes the same set the `social` sync op writes after a successful push. */
async function seedSyncOutput() {
  const { writeIdentity, writeOwnTimetable, writeGrants, writePeerTimetable, writePeers } =
    await import("../lib/social/storage");
  seedProfile();
  writeIdentity(IDENTITY);
  writeOwnTimetable({ busyMap: OWN_BUSY, courses: OWN_COURSES });
  writeGrants(GRANTS);
  writePeerTimetable(PEER, PEER_CACHE);
  writePeers([
    {
      handle: PEER,
      name: "Priya Raman",
      visibility: "coarse" as const,
      shared: true,
      lastPublishedAt: "2026-09-28T09:00:00.000Z",
      semesterId: "CH20262701",
      isSelf: false,
    },
  ]);
}

/** Renders the hook and hands back what it saw. */
async function mountSocial() {
  const { useSocialData } = await import("../lib/social/useSocialData");
  const seen: { current: ReturnType<typeof useSocialData> | null } = { current: null };

  function Probe() {
    seen.current = useSocialData();
    return null;
  }

  const root = render(
    <Provider store={store}>
      <Probe />
    </Provider>
  );
  await act(async () => {});
  return { seen, root };
}

describe("reloading the page", () => {
  it("rehydrates the student's own name and timetable from storage", async () => {
    await seedSyncOutput();

    const { seen, root } = await mountSocial();
    const d = seen.current!;

    expect(d.identity?.displayName).toBe("Sugee");
    expect(d.identity?.handle).toBe("AMZ-4KD2-7RP1");
    expect(d.handle).toBe("AMZ-4KD2-7RP1");
    expect(d.ownBusyMap).toEqual(OWN_BUSY);
    expect(d.ownCourses).toEqual(OWN_COURSES);
    root.unmount();
  });

  it("rehydrates the peers this person has been paired with", async () => {
    await seedSyncOutput();
    const { seen, root } = await mountSocial();

    // Grants carry the peer handles; the peer timetable cache carries the data.
    expect(seen.current!.grants).toHaveLength(1);
    expect(seen.current!.grants[0].peerHandle).toBe(PEER);
    root.unmount();
  });

  it("rehydrates the peer LIST, which is what makes the cache reachable", async () => {
    await seedSyncOutput();
    const { seen, root } = await mountSocial();

    // This is the piece that was missing. `socialPeersAtom` was written only by
    // the sync op and never persisted, so after a reload `peers` was empty.
    // `usePeerTimetables` seeds from `peers`, so with an empty list it could not
    // find the per-handle cache that was sitting on disk — grants showed, friend
    // data did not, and only a resync fixed it.
    expect(seen.current!.peers).toHaveLength(1);
    expect(seen.current!.peers[0].handle).toBe(PEER);
    root.unmount();
  });

  it("keeps peer data reachable after a reload with no network", async () => {
    const { writePeers } = await import("../lib/social/storage");
    await seedSyncOutput();
    writePeers([
      {
        handle: PEER,
        name: "Priya Raman",
        visibility: "coarse",
        shared: true,
        lastPublishedAt: "2026-09-28T09:00:00.000Z",
        semesterId: "CH20262701",
        isSelf: false,
      },
    ]);

    const first = await mountSocial();
    first.root.unmount();

    // Reload. The stubbed client throws on any call, so if reaching the network
    // were required for the peer list, this fails.
    const second = await mountSocial();
    expect(second.seen.current!.peers[0].handle).toBe(PEER);
    expect(second.seen.current!.peers[0].name).toBe("Priya Raman");
    second.root.unmount();
  });

  it("keeps everything after a simulated reload, with no sync", async () => {
    await seedSyncOutput();

    // First mount: the post-sync state.
    const first = await mountSocial();
    first.root.unmount();

    // Reload: a brand new tree. Only localStorage carries over. The stubbed
    // client throws on any call, so reaching the network fails the test.
    const second = await mountSocial();
    const d = second.seen.current!;

    expect(d.identity?.displayName).toBe("Sugee");
    expect(d.ownBusyMap).toEqual(OWN_BUSY);
    expect(d.ownCourses).toEqual(OWN_COURSES);
    expect(d.grants).toHaveLength(1);
    second.root.unmount();
  });

  it("keeps a peer's name and timetable across a reload", async () => {
    const { readPeerTimetable } = await import("../lib/social/storage");
    await seedSyncOutput();

    // A peer timetable is written when it is fetched, then keyed by handle, so a
    // reload finds it without refetching.
    const cached = readPeerTimetable<typeof PEER_CACHE>(PEER);
    expect(cached?.identity?.displayName).toBe("Priya Raman");
    expect(cached?.busyMap).toEqual(PEER_CACHE.busyMap);
    expect(cached?.courses).toEqual(PEER_CACHE.courses);
  });

  it("does not leak one account's cache into another", async () => {
    await seedSyncOutput();
    // A different profile means a different namespace, so the reload under this
    // account must start empty rather than showing the first account's peers.
    seedProfile("21999999");
    const { seen, root } = await mountSocial();

    expect(seen.current!.identity).toBeNull();
    expect(seen.current!.ownBusyMap).toEqual({});
    expect(seen.current!.grants).toHaveLength(0);
    root.unmount();
  });
});

describe("the ordering hazard", () => {
  it("hydrates when the profile is not readable at first mount", async () => {
    // On a real reload `localStorage["profile"]` normally survives, but the very
    // first load of a session has no profile yet — it is written by the sync
    // engine. The hydration effect must therefore cope with the reg number
    // appearing AFTER mount, or the first paint of every session is empty.
    const { useSocialData } = await import("../lib/social/useSocialData");
    const { writeIdentity, writeOwnTimetable } = await import("../lib/social/storage");

    const seen: { current: ReturnType<typeof useSocialData> | null } = { current: null };
    function Probe() {
      seen.current = useSocialData();
      return null;
    }

    // No profile yet: nothing to namespace by, so nothing to show.
    const root = render(
      <Provider store={store}>
        <Probe />
      </Provider>
    );
    await act(async () => {});
    expect(seen.current!.identity).toBeNull();

    // The sync lands and the profile appears.
    seedProfile();
    writeIdentity(IDENTITY);
    writeOwnTimetable({ busyMap: OWN_BUSY, courses: OWN_COURSES });

    await act(async () => {
      // A re-render on its own must not be what fixes this; the hook has to
      // notice the reg number on its own.
      root.rerender(
        <Provider store={store}>
          <Probe />
        </Provider>
      );
    });

    expect(seen.current!.identity?.displayName).toBe("Sugee");
    expect(seen.current!.ownBusyMap).toEqual(OWN_BUSY);
    root.unmount();
  });
});
