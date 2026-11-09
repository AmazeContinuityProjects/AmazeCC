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
import { readPeerTimetable as fetchPeerTimetable, SocialApiError } from "./client";
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
  /**
   * When we last read this copy from the server. Absent on caches written
   * before it existed, which therefore count as old and get one refresh.
   */
  fetchedAt?: string;
};

/** A cached copy older than this is re-read even if nothing says it changed. */
export const PEER_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
/** Parallel peer reads. Enough to be quick with a long friends list, few enough to be polite. */
const PEER_FETCH_CONCURRENCY = 4;

function cachedFor(handle: string): Cached | null {
  const raw = readPeerTimetable<Cached>(handle);
  if (!raw || !raw.identity) return null;
  return raw;
}

function toMs(iso: string | null | undefined): number {
  if (!iso) return NaN;
  return new Date(iso).getTime();
}

/**
 * Whether a peer's timetable has to be read from the server.
 *
 * This used to be "only when nothing is cached", so once a friend's timetable
 * landed on disk it was never read again: they could change every class and
 * this device would keep showing the first copy it saw. Sync now did not help
 * either, because it refreshes the peer list, not the timetables.
 */
export function peerNeedsFetch(opts: {
  cached: Cached | null;
  /** From the peer list the social sync returned. */
  serverPublishedAt: string | null | undefined;
  grantVisibility: SocialVisibility | undefined;
  ownSemesterId: string | null | undefined;
  now?: number;
}): boolean {
  const { cached, serverPublishedAt, grantVisibility, ownSemesterId, now = Date.now() } = opts;
  if (!cached) return true;
  // The grant was raised to full but we only hold the coarse copy.
  if (cached.visibility === "coarse" && grantVisibility === "full") return true;
  // Copy from another term (e.g. cached before a semester switch).
  if (ownSemesterId && cached.identity.semesterId && cached.identity.semesterId !== ownSemesterId) return true;
  // They published after the copy we hold.
  const server = toMs(serverPublishedAt);
  const ours = toMs(cached.identity.publishedAt);
  if (Number.isFinite(server) && (!Number.isFinite(ours) || server > ours)) return true;
  // Nothing says it changed, but it has been a while since we checked.
  const fetched = toMs(cached.fetchedAt);
  if (!Number.isFinite(fetched) || now - fetched > PEER_CACHE_MAX_AGE_MS) return true;
  return false;
}

/**
 * One read per peer at a time, shared by every mounted hook. The social tab,
 * Free Now, Common Free Grid, Groups and the group sheet each mount this hook,
 * and each used to fire its own request for the same friends.
 */
const inFlightReads = new Map<string, Promise<Cached>>();

function isAuthFailure(err: unknown): boolean {
  // `SocialApiError` is the server answering with a reason (revoked grant,
  // unknown handle): signing in again will not change it. Anything else from
  // `apiRequest` is the session.
  return !(err instanceof SocialApiError);
}

async function readFromServer(secret: string, handle: string): Promise<Cached> {
  const existing = inFlightReads.get(handle);
  if (existing) return existing;
  const p = (async () => {
    let res;
    try {
      res = await fetchPeerTimetable(secret, handle);
    } catch (err) {
      if (!isAuthFailure(err)) throw err;
      // After a reload the VTOP session is gone and every peer read failed
      // with an auth error until something else happened to sign in. Sign in
      // (single-flighted by the credential manager) and try once more.
      const { credentialManager } = await import("@/lib/sync-engine/credential-manager");
      await credentialManager.ensureVtopSession();
      res = await fetchPeerTimetable(secret, handle);
    }
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
      fetchedAt: new Date().toISOString(),
    };
    writePeerTimetable(handle, payload);
    return payload;
  })();
  inFlightReads.set(handle, p);
  try {
    return await p;
  } finally {
    inFlightReads.delete(handle);
  }
}

export function usePeerTimetables() {
  const { peers, grants, identity } = useSocialData();
  const ownSemesterId = identity?.semesterId ?? null;
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

  /** handle -> grant visibility, used to spot a stale coarse cache. */
  const visibilityFor = useMemo(() => {
    const map = new Map<string, SocialVisibility>();
    for (const g of grants ?? []) {
      if (g.peerHandle) map.set(g.peerHandle, g.visibility);
    }
    return map;
  }, [grants]);

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

  const lastForced = useRef(0);

  useEffect(() => {
    // `refresh()` re-reads everyone we hold a grant for; otherwise only the
    // peers whose copy is missing, outdated or from another term.
    const forced = nonce !== lastForced.current;
    lastForced.current = nonce;
    const serverPublished = new Map((peers ?? []).map((p) => [p.handle, p.lastPublishedAt]));
    const targets = Object.values(seed).filter((p) => {
      if (p.noGrant || !secretFor.has(p.handle)) return false;
      if (forced) return true;
      return peerNeedsFetch({
        cached: cachedFor(p.handle),
        serverPublishedAt: serverPublished.get(p.handle),
        grantVisibility: visibilityFor.get(p.handle),
        ownSemesterId,
      });
    });
    if (!targets.length) {
      setLoading(false);
      return;
    }
    // Only a peer with nothing on screen counts as loading; a background
    // refresh of a cached copy should not flash a spinner over real data.
    setLoading(targets.some((t) => !t.loaded));
    let cancelled = false;

    const readOne = async (peer: PeerTimetable) => {
      const secret = secretFor.get(peer.handle);
      if (!secret) return;
      try {
        const payload = await readFromServer(secret, peer.handle);
        if (cancelled || !alive.current) return;
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
        // Keep whatever copy is on screen: an old timetable with a red line
        // beats a blank one.
        setState((prev) => ({
          ...prev,
          [peer.handle]: { ...prev[peer.handle], loaded: true, error: message },
        }));
      }
    };

    (async () => {
      const queue = [...targets];
      const workers = Array.from({ length: Math.min(PEER_FETCH_CONCURRENCY, queue.length) }, async () => {
        while (queue.length && !cancelled && alive.current) {
          await readOne(queue.shift()!);
        }
      });
      await Promise.all(workers);
      if (!cancelled && alive.current) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [seed, peers, secretFor, visibilityFor, ownSemesterId, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const ordered = useMemo(() => Object.values(state).sort((a, b) => a.name.localeCompare(b.name)), [state]);

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
