"use client";

/**
 * Usage analytics: consent-gated, count-only, and queued when the sink is not
 * ready.
 *
 * ## Why a queue
 *
 * Google Analytics arrives as a deferred script (`@next/third-parties`), so
 * `window.gtag` may not exist for the first few hundred milliseconds — which is
 * exactly when the most interesting events fire (a tour step, a first import,
 * a generation started on mount of a cached plan). Dropping those would bias
 * every count toward slow loads; buffering them costs a bounded
 * `localStorage` write.
 *
 * ## Why count-only
 *
 * Every event in {@link AnalyticsEventMap} carries numbers and enums, never
 * names, codes a user typed, or anything derived from a timetable. A share
 * link's payload is a full study plan; a course code in an analytics
 * parameter is one student away from being a timetable. The type makes the
 * rule structural: the map admits only what the events below declare.
 *
 * ## Consent
 *
 * One switch, {@link setAnalyticsEnabled}, backed by its own key so the
 * settings sheet and the library do not have to know about each other's shape.
 * Revoking consent drops the queue — a pending event is consent held in
 * escrow, and escrow does not survive a "no".
 */

const ENABLED_KEY = "ffcs_analytics_enabled";
const QUEUE_KEY = "ffcs_analytics_queue";

/**
 * Backlog ceiling.
 *
 * gtag is normally available within a second, so a queue longer than this
 * means the sink is gone (blocked, offline for a session, script failed) and
 * the events are not worth keeping. Oldest dropped first, like the rest of the
 * app's caches.
 */
const MAX_QUEUE = 100;

/**
 * The event vocabulary.
 *
 * Adding an event means editing this map, which is the point: an untyped
 * `track("something", {...})` at a call site would quietly allow arbitrary
 * keys and values past the count-only rule.
 */
export interface AnalyticsEventMap {
  /** A solve was requested — `courses` is the target-course count. */
  generation_started: { courses: number; ranking: string };
  /** A solve settled, however it ended. `capped` true when stopped early. */
  generation_done: { found: number; capped: boolean; ms: number };
  /** A share link was built. `bytes` is the encoded payload length. */
  share_created: { courses: number; bytes: number };
  /** The share page successfully decoded a link. */
  share_opened: { courses: number };
  /** A timetable was saved from the generator into the planner. */
  timetable_saved: { source: "generator" | "share" };
  /** An image export finished. */
  export_image: { format: "jpg" | "png" };
  /** The printable page was opened. */
  export_printable: Record<string, never>;
  /** Smart paste parsed a selection. */
  import_pasted: { courses: number };
  /** A CSV/XLSX file parsed. `format` is the file extension. */
  import_file: { courses: number; format: string };
  /** One setting changed — `key` is its name, not its value. */
  settings_changed: { key: string };
  /** A tour step was shown or advanced. */
  tour_step: { step: number; total: number };
  /** A preview course was handed to another faculty at the same slots. */
  slot_faculty_swap: Record<string, never>;
  /** Registered courses were pasted directly into timetable. */
  ffcs_paste_registered_courses: { count: number; mode: string; replace: boolean };
}

export type AnalyticsEvent = keyof AnalyticsEventMap;

interface QueuedEvent {
  e: AnalyticsEvent;
  p?: Record<string, unknown>;
  /** Epoch ms, so a stale backlog can be recognised in a dump. */
  t: number;
}

type Gtag = (command: "event", name: string, params?: Record<string, unknown>) => void;

function sink(): Gtag | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { gtag?: Gtag }).gtag;
}

function readQueue(): QueuedEvent[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    // A hand-edited or half-written entry must not take the whole flush down.
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e.e === "string") : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedEvent[]): void {
  try {
    if (queue.length === 0) localStorage.removeItem(QUEUE_KEY);
    else localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    /* quota exceeded: analytics is the first thing that should give up */
  }
}

/** Whether the user has analytics on. Opt-out, matching the app's GA load. */
export function isAnalyticsEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) !== "false";
  } catch {
    return false; // no storage means no consent record means no tracking
  }
}

/**
 * Flip consent.
 *
 * Turning it off drops the backlog in the same tick — queued events are
 * consent held in escrow. Turning it on flushes what was already queued, in
 * order, oldest first.
 */
export function setAnalyticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(ENABLED_KEY, enabled ? "true" : "false");
  } catch {
    /* no storage, no consent record */
  }
  if (enabled) flush();
  else writeQueue([]);
}

function flush(): void {
  const send = sink();
  if (!send) return;
  const queue = readQueue();
  if (queue.length === 0) return;
  writeQueue([]);
  for (const event of queue) {
    try {
      send("event", event.e, event.p);
    } catch {
      /* a throwing sink must not break the caller's feature */
    }
  }
}

/**
 * Record one event.
 *
 * No-op when consent is off. Straight to `gtag` when it is there; otherwise
 * queued for the next flush — which happens on the next `track`, so a session
 * that only ever fires one event still gets it out on the following load's
 * first event. Never throws: this sits inside feature code paths.
 */
export function track<E extends AnalyticsEvent>(
  event: E,
  props?: AnalyticsEventMap[E]
): void {
  if (!isAnalyticsEnabled() || typeof window === "undefined") return;

  const send = sink();
  if (send) {
    flush();
    try {
      send("event", event, props as Record<string, unknown> | undefined);
    } catch {
      /* ditto */
    }
    return;
  }

  const queue = readQueue();
  queue.push({ e: event, p: props as Record<string, unknown> | undefined, t: Date.now() });
  writeQueue(queue);
}

/** Backlog size, for tests and for a settings row that wants to show it. */
export function pendingEventCount(): number {
  return readQueue().length;
}
