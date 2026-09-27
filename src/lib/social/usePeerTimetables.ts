/**
 * Loads the timetable of every paired peer.
 *
 * `useSocialData` owns *our* state; this owns *theirs*. It exists because the
 * People, Free-Right-Now and Common-Free-Grid surfaces all need the same thing —
 * each peer's busy map — and computing it in three places is how the three
 * copies of the friend-grid bug happened in the first place.
 *
 * Two rules, both learned the hard way:
 *
 * 1. **Paint from cache first, fetch second.** A peer's timetable is only a
 *    problem if you want to know whether they clash with you right now, and a
 *    spinner in place of a list is worse than a slightly old answer. So the
 *    cached copy renders immediately and the network only refreshes it.
 * 2. **A peer with no secret is not an error.** It just means we hold no grant
 *    for them, and we say so rather than requesting and getting a 403.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readPeerTimetable, writePeerTimetable } from "./storage";
import { readPeerTimetable as fetchPeerTimetable } from "./client";
import { computeOverlap, type OverlapMetrics } from "./schedule";
import type { BusyMap, SocialCourse, SocialVisibility } from "./types";
import { useSocialData } from "./useSocialData";

export type PeerTimetable = {
  handle: string;
  name: string;
  visibility: SocialVisibility;
  busyMap: BusyMap;
  courses: SocialCourse[];
  publishedAt: string | null;
  stale: boolean;
  /** False while the network copy is still in flight and there is no cache. */
  loaded: boolean;
  /** Set when the server refused, most often a revoked grant. */
  error: string | null;
  /** True when we hold no secret for this peer, so no read is even attempted. */
  noGrant: boolean;
};

type Cached = {
  identity: { handle: string; displayName?: string; publishedAt: string | null; semesterId: string };
  visibility: SocialVisibility;
  stale: boolean;
  busyMap: BusyMap;
  courses: SocialCourse[];
};

function cachedFor(handle: string): Cached | null {
  const raw = readPeerTimetable<Cached>(handle);
  if (!raw || !raw.identity) return null;
  return raw;
}

export function usePeerTimetables() {
  const { peers, grants } = useSocialData();
  const [state, setState] = useState<Record<string, PeerTimetable>>({});
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /** handle -> secret, for the peers we actually hold a grant for. */
  const secretFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of grants ?? []) {
      if (g.peerHandle) map.set(g.peerHandle, g.secret);
    }
    return map;
  }, [grants]);

  // Seed from cache on every identity change so the first paint has data.
  const seed = useMemo(() => {
    const next: Record<string, PeerTimetable> = {};
    for (const peer of peers ?? []) {
      const cached = cachedFor(peer.handle);
      next[peer.handle] = {
        handle: peer.handle,
        name: peer.name || cached?.identity?.displayName || "Student",
        visibility: (cached?.visibility ?? peer.visibility ?? "coarse") as SocialVisibility,
        busyMap: cached?.busyMap ?? {},
        courses: cached?.courses ?? [],
        publishedAt: cached?.identity?.publishedAt ?? peer.lastPublishedAt ?? null,
        stale: cached?.stale ?? false,
        loaded: Boolean(cached),
        error: null,
        noGrant: !secretFor.has(peer.handle),
      };
    }
    return next;
  }, [peers, secretFor]);

  useEffect(() => {
    setState(seed);
  }, [seed]);

  // Fill anything missing, in the background.
  useEffect(() => {
    const targets = Object.values(seed).filter((p) => !p.loaded && !p.noGrant);
    if (!targets.length) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;

    (async () => {
      // Sequential on purpose. A peer list of 40 firing 40 parallel reads would
      // hit the server's 120/min ceiling and get the whole list rate-limited
      // because one screen wanted to be fast.
      for (const peer of targets) {
        if (cancelled || !alive.current) return;
        const secret = secretFor.get(peer.handle);
        if (!secret) continue;
        try {
          const res = await fetchPeerTimetable(secret, peer.handle);
          if (cancelled || !alive.current) return;
          const payload: Cached = {
            identity: {
              handle: res.identity.handle,
              displayName: res.identity.displayName,
              publishedAt: res.identity.publishedAt,
              semesterId: res.identity.semesterId,
            },
            visibility: res.visibility,
            stale: res.stale,
            busyMap: res.busyMap ?? {},
            courses: res.courses ?? [],
          };
          writePeerTimetable(peer.handle, payload);
          setState((prev) => ({
            ...prev,
            [peer.handle]: {
              ...prev[peer.handle],
              visibility: payload.visibility,
              stale: payload.stale,
              busyMap: payload.busyMap,
              courses: payload.courses,
              publishedAt: payload.identity.publishedAt,
              loaded: true,
              error: null,
            },
          }));
        } catch (err: unknown) {
          if (cancelled || !alive.current) return;
          const message = err instanceof Error ? err.message : String(err);
          setState((prev) => ({
            ...prev,
            [peer.handle]: { ...prev[peer.handle], loaded: true, error: message },
          }));
        }
      }
      if (!cancelled && alive.current) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [seed, secretFor, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const ordered = useMemo(
    () => Object.values(state).sort((a, b) => a.name.localeCompare(b.name)),
    [state]
  );

  return { peers: ordered, loading, refresh, byHandle: state };
}

/** Overlap of every loaded peer against ours, keyed by handle. */
export function useOverlap(ownBusyMap: BusyMap, peers: PeerTimetable[]) {
  return useMemo(() => {
    const out = new Map<string, OverlapMetrics>();
    for (const peer of peers) {
      if (!peer.loaded) continue;
      out.set(peer.handle, computeOverlap(ownBusyMap, peer.busyMap));
    }
    return out;
  }, [ownBusyMap, peers]);
}

/** "3d ago" / "just now" / "not published". */
export function relativePublished(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "not published";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "not published";
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  return `${months}mo ago`;
}
