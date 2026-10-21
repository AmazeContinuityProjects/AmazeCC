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
export function writeHistoryEntry(
  method: "push" | "replace",
  state: Record<string, unknown>
): void {
  if (typeof window === "undefined") return;
  try {
    const prev = window.history.state;
    const data = {
      ...(prev && typeof prev === "object" ? prev : {}),
      ...state,
      __NA: true,
    };
    if (method === "push") window.history.pushState(data, "");
    else window.history.replaceState(data, "");
  } catch {
    /* history access can throw in a sandboxed/blocked frame; the app's own
       stack is the source of truth, so a failed write is not fatal. */
  }
}

/**
 * Read the app's op marker off a history entry, if any. `null` means the entry
 * predates the app's own navigation (before the app's first push), which the
 * popstate handler treats as "let the browser do its default thing".
 */
export function readHistoryOp(state: unknown): { kind?: string } | null {
  if (!state || typeof state !== "object") return null;
  const op = (state as { op?: unknown }).op;
  return op && typeof op === "object" ? (op as { kind?: string }) : null;
}
