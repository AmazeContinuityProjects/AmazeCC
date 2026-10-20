import { describe, expect, it, beforeEach } from "vitest";
import { readHistoryOp, writeHistoryEntry } from "../lib/historyStack";

/**
 * The history entries the app writes.
 *
 * Next.js's App Router reloads the page on popstate when the entry it lands on
 * lacks `__NA` (see the `F` handler in its router chunk). A reload re-mounts
 * the app and resets its own back stack — which is what makes back navigation
 * look capped after a couple of steps. The marker must be written explicitly:
 * the first write races Next's hydration write, so relying on the spread of the
 * previous entry is not safe.
 */
describe("writeHistoryEntry", () => {
  beforeEach(() => {
    // jsdom starts each test on a fresh document with a null history state.
    window.history.replaceState(null, "");
  });

  it("writes the __NA marker Next's popstate handler needs", () => {
    writeHistoryEntry("push", { screen: "attendance:od" });

    expect(window.history.state).toMatchObject({ screen: "attendance:od", __NA: true });
  });

  it("adds an entry on push and leaves the length alone on replace", () => {
    writeHistoryEntry("push", { screen: "a" });
    const afterPush = window.history.length;

    writeHistoryEntry("replace", { screen: "b" });

    expect(window.history.state).toMatchObject({ screen: "b", __NA: true });
    expect(window.history.length).toBe(afterPush);
  });

  it("preserves fields already on the entry (Next's internals tree)", () => {
    window.history.replaceState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: "t" } }, "");

    writeHistoryEntry("push", { screen: "a" });

    expect(window.history.state).toMatchObject({
      screen: "a",
      __NA: true,
      __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: "t" },
    });
  });

  it("is a no-op on a null previous state rather than throwing", () => {
    expect(() => writeHistoryEntry("push", { screen: "a" })).not.toThrow();
  });
});

describe("readHistoryOp", () => {
  it("returns null for entries that predate the app's own navigation", () => {
    expect(readHistoryOp(null)).toBeNull();
    expect(readHistoryOp({ screen: "a" })).toBeNull();
    expect(readHistoryOp("not an object")).toBeNull();
  });

  it("reads the op marker the overlay stack writes", () => {
    expect(readHistoryOp({ op: { kind: "overlay", id: "x" } })).toEqual({ kind: "overlay", id: "x" });
  });
});
