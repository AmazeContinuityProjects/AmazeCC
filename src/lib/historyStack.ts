"use client";

/**
 * Writing the app's history entries.
 *
 * The app drives system back (including Android predictive back) with real
 * `history.pushState`/`replaceState` entries rather than a single-page stack,
 * so every back-able op the user performs is a browser history entry. Next.js's
 * App Router patches both methods, and its popstate handler reloads the page
 * when the entry it lands on lacks the internal `__NA` marker:
 *
 *     function F(e) { if (e) { if (!e.__NA) return void window.location.reload(); ... } }
 *
 * A reload re-mounts the app, which resets its own back stack — the classic
 * "back only goes back a couple of screens, then the app starts over" symptom.
 * Relying on the spread of the previous entry to carry the marker is not safe
 * (the first write races Next's hydration write), so it is written explicitly.
 *
 * `__PRIVATE_NEXTJS_INTERNALS_TREE` is preserved from the current entry so
 * Next's `traverse` on pop sees a coherent state; the app never changes the
 * URL, so the tree is the same for every entry.
 */

/** The app's own keys — see {@link writeHistoryEntry} for why they are dropped. */
const APP_ENTRY_KEYS = ["op", "screen"] as const;

/**
 * Write one history entry.
 *
 * `op` and `screen` are stripped from the entry being written *on top of*
 * before the new state is applied: an entry must describe exactly one thing.
 * The spread used to carry the previous entry's keys forward, so an overlay
 * entry inherited the screen it was opened from and a screen entry inherited
 * the overlay op it was written above. Back then landed on entries that meant
 * two things — an overlay entry that also named a screen read as a screen
 * change (nothing dismissed), and the gesture did nothing.
 */
export function writeHistoryEntry(
  method: "push" | "replace",
  state: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  try {
    const prev = window.history.state;
    const base: Record<string, unknown> =
      prev && typeof prev === "object" ? { ...(prev as Record<string, unknown>) } : {};
    for (const key of APP_ENTRY_KEYS) delete base[key];
    const data = { ...base, ...state, __NA: true };
    if (method === "push") window.history.pushState(data, "");
    else window.history.replaceState(data, "");
  } catch {
    /* history access can throw in a sandboxed/blocked frame; the app's own
       stack is the source of truth, so a failed write is not fatal. */
  }
}

/**
 * Keep walking back past a history entry that is not a step the user can land
 * on: one whose overlay was already dismissed in-app, or a duplicate of the
 * screen currently showing.
 *
 * The entry an overlay left behind when it was closed with its X has nothing
 * left to dismiss. Doing nothing there spends the user's gesture on a screen
 * that does not move — which is what makes the back stack feel like it only
 * remembers the last step or two. The pop is repeated so the *same* gesture
 * continues to the step beneath it instead.
 *
 * One repeated pop per popstate, never nested: browsers (and jsdom) dispatch
 * popstate as a queued task, so the next pop's handler runs after this one
 * returns. The walk therefore cannot overshoot — each landing is re-examined
 * on its own, and the chain ends at the first real step or at the start of
 * history (where `back()` is a no-op and no popstate fires at all).
 *
 * `event` dedupes the case where two popstate handlers are mounted at once
 * (the dashboard's and a standalone route's boundary, during a route
 * transition) — both see the same event object, and only the first may pop.
 */
export function continueBackPastDeadEntry(event?: PopStateEvent): void {
  if (typeof window === "undefined") return;
  if (event) {
    if (continuedEvents.has(event)) return;
    continuedEvents.add(event);
  }
  try {
    window.history.back();
  } catch {
    /* a blocked frame can refuse; the gesture falls through to the entry it
       landed on, which is no worse than the dead entry it skipped. */
  }
}

/** Events already walked past — one pop per event, however many handlers ran. */
const continuedEvents = new WeakSet<PopStateEvent>();

/**
 * Read the app's op marker off a history entry, if any. `null` means the entry
 * predates the app's own navigation (before the app's first push), which the
 * popstate handler treats as "let the browser do its default thing".
 */
export function readHistoryOp(state: unknown): { kind?: string; id?: string } | null {
  if (!state || typeof state !== "object") return null;
  const op = (state as { op?: unknown }).op;
  return op && typeof op === "object" ? (op as { kind?: string; id?: string }) : null;
}
