import { atom } from "jotai";
import type { BusyMap, SocialCourse, SocialIdentity, SocialPeer } from "@/lib/social/types";
import type { StoredGrant } from "@/lib/social/client";

/**
 * Social feature state.
 *
 * These exist because `SocialTab` is mounted twice — by `MoreTab.tsx:33` and by
 * `ToolsTab.tsx:134` — so its local `useState` gave two independent copies of
 * the list and reset the sub-tab when moving between them. Atoms give both
 * mounts one source of truth.
 *
 * NOTE: `strictNullChecks` is off in this repo, so `atom<T | null>(null)` would
 * resolve to jotai's read-function overload and produce a READ-ONLY atom. The
 * `as unknown as T` casts keep the runtime `null` while selecting the
 * PrimitiveAtom overload. See the same note in `dataAtoms.ts:16-18`.
 */

export const socialIdentityAtom = atom<SocialIdentity | null>(null as unknown as SocialIdentity);

export const socialPeersAtom = atom<SocialPeer[]>([]);

/** Grant secrets for pairings the user participates in. Needed to read peers. */
export const socialGrantsAtom = atom<StoredGrant[]>([]);

/** The user's own derived busy map, so the grid does not refetch to draw "me". */
export const socialOwnBusyMapAtom = atom<BusyMap>({});
export const socialOwnCoursesAtom = atom<SocialCourse[]>([]);

/**
 * Which account's cached social data to read, published once it is knowable.
 *
 * Every social storage key is namespaced by reg number, and the reg number
 * comes from `localStorage["profile"]` — which the sync engine writes *asynchronously*.
 * A component that read it during the first render would see "" and, with no
 * reactive source to wait on, would never look again. That left the social page
 * empty until something else forced a remount.
 *
 * So the reg number is published here instead, and readers depend on this atom.
 * It starts empty and is filled by the `studentProfile` op once the profile
 * lands; readers fall back to a direct read, so a reload that already has a
 * cached profile still hydrates on the first paint.
 */
export const activeRegNumberAtom = atom<string>("");

export type SocialSyncState = {
  /** Server's own version counter for the current term. */
  version: number;
  lastSyncedAt: string | null;
  /** Set when the last push failed, so the UI can offer a retry. */
  lastError: string | null;
  /** True while a push is in flight. */
  syncing: boolean;
};

export const socialSyncStateAtom = atom<SocialSyncState>({
  version: 0,
  lastSyncedAt: null,
  lastError: null,
  syncing: false,
});
