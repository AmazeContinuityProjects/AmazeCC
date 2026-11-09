/**
 * Groups: a local arrangement of people you are already paired with.
 *
 * ## Why groups are client-side
 *
 * The server models **pairs**, and a group introduces no new relationship — every
 * member is someone the user already holds a grant for, so their timetable is
 * already readable. There is nothing to consent to and nothing to sync, so a
 * group is stored locally and applied as a filter over data the server already
 * sent.
 *
 * ## The pruning rule
 *
 * `handles` is treated as a *set of candidates*, never as truth. A pairing can be
 * revoked, so a group can outlive a member. `pruneHandles` drops handles that are
 * no longer known peers, and a group that loses all of them is reported as
 * `empty` rather than as a group with zero members. Without this, revoked peers
 * would linger in the UI forever and inflate every count.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getActiveRegNumber } from "./identity";
import { readGroups, writeGroups } from "./storage";
import { computeGroupOverlap, type GroupOverlapMetrics } from "./schedule";
import { GROUP_NAME_MAX, type BusyMap, type SocialGroup } from "./types";

/**
 * A stable-enough id for a locally created group.
 *
 * Not `crypto.randomUUID` because this runs in older WebViews where it is
 * absent, and not a counter because two groups created in the same millisecond
 * would collide. Time plus randomness is enough for a local list.
 */
function newGroupId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `g_${Date.now().toString(36)}_${rand}`;
}

/** Collapse a user-typed name to something safe to store and display. */
export function normaliseGroupName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, GROUP_NAME_MAX);
}

/** Keep only handles we still know about, without duplicates. */
export function pruneHandles(handles: readonly string[], known: readonly string[]): string[] {
  const knownSet = new Set(known);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of handles) {
    if (knownSet.has(h) && !seen.has(h)) {
      seen.add(h);
      out.push(h);
    }
  }
  return out;
}

export type GroupSummary = {
  group: SocialGroup;
  metrics: GroupOverlapMetrics;
  /** Members whose timetable has not loaded, so counts are not yet final. */
  pending: number;
  /** True when the group has no members left, or none could be loaded. */
  empty: boolean;
};

export function useSocialGroups(params: {
  ownBusyMap: BusyMap;
  /** Every peer currently known, by handle. */
  knownHandles: readonly string[];
  /** handle -> busy map. Missing entries count as "not loaded", never as free. */
  busyByHandle: ReadonlyMap<string, BusyMap>;
}) {
  const { ownBusyMap, knownHandles, busyByHandle } = params;
  const [groups, setGroups] = useState<SocialGroup[]>([]);
  const hydratedFor = useRef<string | null>(null);

  /**
   * The authoritative list, readable synchronously by the mutators below.
   *
   * Kept in a ref rather than reading `groups` because two mutations in the same
   * React batch both see the same rendered value, and the second would overwrite
   * the first. `createGroup` then `toggleMember` in one handler is a realistic
   * case, and with state alone that silently dropped the group.
   *
   * Written ONLY by `commit`, `prune` and the hydration effect. Deliberately not
   * re-assigned during render, since a render that has not yet seen a pending
   * `commit` would clobber it.
   */
  const groupsRef = useRef<SocialGroup[]>([]);

  const reg = getActiveRegNumber();

  // Same reasoning as `useSocialData`: the reg number is what namespaces the
  // cache, and it is not readable on the very first render of a first session.
  useEffect(() => {
    if (!reg || hydratedFor.current === reg) return;
    hydratedFor.current = reg;
    // The ref is seeded too, or a mutation made before this effect ran would
    // read an empty list and write back a version with the stored groups gone.
    const stored = readGroups(reg);
    groupsRef.current = stored;
    setGroups(stored);
  }, [reg]);

  /**
   * Apply an updater to the current list and persist the result.
   *
   * A single writer, so a group can never end up persisted differently from what
   * is on screen. The updater is passed the value at call time rather than the
   * rendered one, which is what makes back-to-back calls safe.
   */
  const commit = useCallback(
    (update: (prev: SocialGroup[]) => SocialGroup[]) => {
      const next = update(groupsRef.current);
      groupsRef.current = next;
      setGroups(next);
      if (reg) writeGroups(next, reg);
    },
    [reg]
  );

  const createGroup = useCallback(
    (rawName: string, handles: string[] = []): SocialGroup | null => {
      const name = normaliseGroupName(rawName);
      if (!name) return null;
      const group: SocialGroup = {
        id: newGroupId(),
        name,
        handles: pruneHandles(handles, knownHandles),
        createdAt: Date.now(),
      };
      commit((prev) => [...prev, group]);
      return group;
    },
    [commit, knownHandles]
  );

  const renameGroup = useCallback(
    (id: string, rawName: string) => {
      const name = normaliseGroupName(rawName);
      // An empty name would leave an unidentifiable row, so it is rejected
      // rather than silently renamed to "".
      if (!name) return;
      commit((prev) => prev.map((g) => (g.id === id ? { ...g, name } : g)));
    },
    [commit]
  );

  const deleteGroup = useCallback(
    (id: string) => {
      commit((prev) => prev.filter((g) => g.id !== id));
    },
    [commit]
  );

  const setMembers = useCallback(
    (id: string, handles: string[]) => {
      commit((prev) =>
        prev.map((g) =>
          g.id === id ? { ...g, handles: pruneHandles(handles, knownHandles) } : g
        )
      );
    },
    [commit, knownHandles]
  );

  const toggleMember = useCallback(
    (id: string, handle: string) => {
      commit((prev) =>
        prev.map((g) => {
          if (g.id !== id) return g;
          const has = g.handles.includes(handle);
          return {
            ...g,
            handles: has ? g.handles.filter((h) => h !== handle) : [...g.handles, handle],
          };
        })
      );
    },
    [commit]
  );

  /** Drop handles that are no longer peers, and persist the pruned list. */
  const prune = useCallback(() => {
    let changed = false;
    const next = groupsRef.current.map((g) => {
      const handles = pruneHandles(g.handles, knownHandles);
      if (handles.length !== g.handles.length) changed = true;
      return handles.length === g.handles.length ? g : { ...g, handles };
    });
    if (changed) {
      groupsRef.current = next;
      setGroups(next);
      if (reg) writeGroups(next, reg);
    }
  }, [knownHandles, reg]);

  /**
   * Per-group figures.
   *
   * Only loaded timetables are passed in. A member with no data is counted as
   * `pending` and excluded, because treating "unknown" as "free" would make a
   * group look better than it is.
   */
  const summaries = useMemo<GroupSummary[]>(
    () =>
      groups.map((group) => {
        const members = pruneHandles(group.handles, knownHandles);
        const loaded = members
          .map((h) => busyByHandle.get(h))
          .filter((m): m is BusyMap => Boolean(m));
        return {
          group: { ...group, handles: members },
          metrics: computeGroupOverlap(ownBusyMap, loaded),
          pending: members.length - loaded.length,
          empty: members.length === 0,
        };
      }),
    [groups, knownHandles, busyByHandle, ownBusyMap]
  );

  return {
    groups,
    summaries,
    hydrated: Boolean(reg && hydratedFor.current === reg),
    createGroup,
    renameGroup,
    deleteGroup,
    setMembers,
    toggleMember,
    prune,
  };
}
