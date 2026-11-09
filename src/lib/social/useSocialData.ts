/**
 * One shared instance of the social feature's state.
 *
 * `SocialTab` is mounted by both `MoreTab.tsx:33` and `ToolsTab.tsx:134`. With
 * local `useState` that meant two independent copies of the friends list, and
 * the sub-tab reset when moving between them. Reading the atoms here means both
 * mounts see the same data.
 *
 * It also owns the debounced push, which is the actual fix for the old
 * behaviour: every add/remove/toggle used to fire a full cloud round trip to
 * flip one boolean.
 */

import { useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  socialGrantsAtom,
  socialIdentityAtom,
  socialOwnBusyMapAtom,
  socialOwnCoursesAtom,
  socialPeersAtom,
  socialSyncStateAtom,
  activeRegNumberAtom,
} from "@/store/socialAtoms";
import {
  readGrants,
  readIdentity,
  readOwnTimetable,
  readPeers,
  migrateLegacyStore,
} from "./storage";
import { getActiveRegNumber } from "./identity";
import type { BusyMap, SocialCourse, SocialIdentity, SocialPeer } from "./types";
import type { StoredGrant } from "./client";

/** Matches the ~5s in docs/social-tt/01-overview.md. */
const PUBLISH_DEBOUNCE_MS = 5000;

type OwnTimetable = { busyMap: BusyMap; courses: SocialCourse[] };

/**
 * A debounce that is safe across unmounts.
 *
 * Module-level on purpose: the timer has to survive the component that
 * scheduled it going away, otherwise a push scheduled right before a tab switch
 * is silently dropped.
 */
let publishTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<unknown> | null = null;

function clearPublishTimer() {
  if (publishTimer) {
    clearTimeout(publishTimer);
    publishTimer = null;
  }
}

type PublishFn = () => Promise<unknown>;

/**
 * Schedule a push, coalescing bursts.
 *
 * If a push is already running when the timer fires, the new one is chained
 * behind it rather than dropped — otherwise a change made during a slow push
 * would never reach the server.
 */
export function schedulePublish(push: PublishFn, delayMs = PUBLISH_DEBOUNCE_MS): void {
  clearPublishTimer();
  publishTimer = setTimeout(() => {
    publishTimer = null;
    const next = (async () => {
      if (inFlight) {
        try {
          await inFlight;
        } catch {
          /* the previous attempt's problem, not this one's */
        }
      }
      try {
        inFlight = push();
        await inFlight;
      } catch {
        // Swallowed deliberately. `schedulePublish` is fire-and-forget, so a
        // rejection here would surface as an unhandled promise rejection with
        // no owner. The failure is already recorded by the op itself in
        // `socialSyncStateAtom.lastError`, which is what the UI reads.
      } finally {
        inFlight = null;
      }
    })();
    void next;
  }, delayMs);
}

/** Cancel a pending push. Exposed for tests and for sign-out. */
export function cancelScheduledPublish(): void {
  clearPublishTimer();
}

export interface SocialData {
  identity: SocialIdentity | null;
  peers: SocialPeer[];
  grants: StoredGrant[];
  ownBusyMap: BusyMap;
  ownCourses: SocialCourse[];
  /** Marks the data as changed and schedules a debounced server push. */
  markDirty: () => void;
  /** The user's public handle, for the share sheet. */
  handle: string | null;
  /**
   * The last social-sync failure, or null.
   *
   * The sync op swallows its own errors on purpose (a failed social push must
   * not break the rest of the chain), so this is the only signal the UI has. It
   * was recorded on the atom all along and simply never read.
   */
  syncError: string | null;
  /** True while a social push is in flight. */
  /** Epoch ISO of the last successful social push, or null. */
  lastSyncedAt: string | null;
  syncing: boolean;
}

export function useSocialData(): SocialData {
  const identity = useAtomValue(socialIdentityAtom);
  const peers = useAtomValue(socialPeersAtom);
  const grants = useAtomValue(socialGrantsAtom);
  const ownBusyMap = useAtomValue(socialOwnBusyMapAtom);
  const ownCourses = useAtomValue(socialOwnCoursesAtom);
  const syncState = useAtomValue(socialSyncStateAtom);

  const setIdentity = useSetAtom(socialIdentityAtom);
  const setGrants = useSetAtom(socialGrantsAtom);
  const setPeers = useSetAtom(socialPeersAtom);
  const setOwnBusyMap = useSetAtom(socialOwnBusyMapAtom);
  const setOwnCourses = useSetAtom(socialOwnCoursesAtom);

  const markDirty = useCallback(() => {
    // Imported lazily so this module can be read by tests without pulling the
    // whole sync engine (and its credential manager) into the graph.
    void import("@/lib/sync-engine").then(({ syncEngine }) =>
      schedulePublish(() => syncEngine.sync("social"))
    );
  }, []);

  // Hydrate from the cache once per reg number so the first paint has data
  // instead of an empty grid. The sync op overwrites this with server truth.
  //
  // `reg` is reactive, which is the whole point. It used to be read from
  // `localStorage` inside the effect, whose dependencies were all stable
  // setters — so the effect ran exactly once, bailed when the profile had not
  // arrived yet, and never ran again. On a first session the profile is written
  // by the sync engine a beat after mount, so the page stayed empty.
  const publishedReg = useAtomValue(activeRegNumberAtom);
  const reg = publishedReg || getActiveRegNumber();
  const hydratedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!reg || hydratedFor.current === reg) return;
    hydratedFor.current = reg;

    migrateLegacyStore(reg);
    const cachedIdentity = readIdentity<SocialIdentity>(reg);
    if (cachedIdentity) setIdentity(cachedIdentity);
    const cachedGrants = readGrants<StoredGrant>(reg);
    if (cachedGrants.length) setGrants(cachedGrants);
    // Restores the handles, which is what makes the per-handle timetable cache
    // reachable. Without it `usePeerTimetables` had an empty `peers` list to seed
    // from and could not find cached data even though it was on disk.
    const cachedPeers = readPeers<SocialPeer>(reg);
    if (cachedPeers.length) setPeers(cachedPeers);
    const cachedOwn = readOwnTimetable<OwnTimetable>(reg);
    if (cachedOwn) {
      setOwnBusyMap(cachedOwn.busyMap ?? {});
      setOwnCourses(cachedOwn.courses ?? []);
    }
  }, [reg, setIdentity, setGrants, setPeers, setOwnBusyMap, setOwnCourses]);

  return {
    identity,
    peers,
    grants,
    ownBusyMap,
    ownCourses,
    markDirty,
    handle: identity?.handle ?? null,
    /**
     * The last social-sync failure, from `socialSyncStateAtom.lastError`.
     *
     * Exposed because the sync op deliberately swallows its own errors — a failed
     * social push must not break the rest of the chain — so without this the only
     * symptom is a social page that quietly shows stale data and no red line.
     */
    syncError: syncState?.lastError ?? null,
    syncing: syncState?.syncing ?? false,
    lastSyncedAt: syncState?.lastSyncedAt ?? null,
  };
}

/**
 * Standalone readers/writers, for code that is not a component (the sync op).
 * Kept beside the hook so the atom names are not duplicated across the repo.
 */
export function useSocialWriters() {
  return {
    setIdentity: useSetAtom(socialIdentityAtom),
    setPeers: useSetAtom(socialPeersAtom),
    setGrants: useSetAtom(socialGrantsAtom),
  };
}

/** Convenience for components that only need to read peers. */
export function useSocialPeers(): SocialPeer[] {
  return useAtomValue(socialPeersAtom);
}

export { socialSyncStateAtom };
export type { OwnTimetable };
