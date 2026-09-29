import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import LocalStorageSubpage from "../components/custom/footer/LocalStorageSubpage";

/**
 * The local storage viewer, as a settings subpage.
 *
 * This replaced a full-screen overlay that dumped raw JSON cards at the reader
 * with no count, no search, and no sizes. What is worth pinning here is the
 * behaviour that page actually needed and did not have: find a key (by name
 * *or* by a fragment of what's inside it), tell a 12-byte flag from a 40KB
 * cache, and not print a token on screen because someone was inspecting the
 * store.
 *
 * It reads `localStorage` itself rather than taking a snapshot, so the tests
 * write to the real store and assert against what a reload would show.
 */

/**
 * This jsdom environment has no `localStorage` — not even on `window`, and
 * despite a valid `http://localhost:3000` origin. Stubbed here rather than by
 * touching `vitest.config.ts`, because a global `setupFiles` polyfill would
 * change the environment for every other suite in the repo.
 */
function installLocalStorage() {
  const map = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: stub,
    configurable: true,
    writable: true,
  });
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: stub,
      configurable: true,
      writable: true,
    });
  }
  return stub;
}

const store = installLocalStorage();

function seed(entries: Record<string, string>) {
  store.clear();
  for (const [k, v] of Object.entries(entries)) store.setItem(k, v);
}

const row = (key: string) => screen.getByText(key).closest("div.flex.items-center.gap-3") as HTMLElement;

/** Key names in the order the list draws them. */
function renderedKeys(): string[] {
  return screen
    .getAllByRole("button", { expanded: false })
    .filter((b) => b.getAttribute("aria-expanded") !== null)
    .map((b) => b.querySelector("[title]")?.getAttribute("title") ?? "");
}

describe("local storage subpage", () => {
  beforeEach(() => {
    seed({
      settings: JSON.stringify({ theme: "dark", compact: true }),
      cache_courses: "x".repeat(2000),
      username: "22BCE1234",
      IDs: JSON.stringify({ reg: "22BCE1234", campus: "AB1" }),
    });
  });

  afterEach(() => {
    store.clear();
    vi.restoreAllMocks();
  });

  it("lists every key with a readable size", () => {
    render(<LocalStorageSubpage />);
    expect(screen.getByText("settings")).toBeTruthy();
    expect(screen.getByText("cache_courses")).toBeTruthy();
    // 2000 bytes is 2.0 KB. Scoped to the row: the summary panel above the list
    // also carries a "2.0 KB", and an unscoped query cannot tell them apart.
    const cacheRow = row("cache_courses");
    expect(within(cacheRow.parentElement as HTMLElement).getByText("2.0 KB")).toBeTruthy();
  });

  it("sorts keys, so the list does not reshuffle between reads", () => {
    render(<LocalStorageSubpage />);
    // `localStorage` preserves insertion order, which is fine until something
    // deletes a key and writes it again — then every row below the gap jumps.
    // A viewer you are scanning has to be stable, so assert the order rather
    // than the count (counting buttons passes either way).
    //
    // `localeCompare`, not `<`: it sorts case-insensitively, so `cache_courses`
    // lands before `IDs`. An ASCII sort would file every capitalised key at the
    // top, which reads as two lists stacked on each other.
    expect(renderedKeys()).toEqual(["cache_courses", "IDs", "settings", "username"]);
  });

  it("searches by key name", () => {
    render(<LocalStorageSubpage />);
    fireEvent.change(screen.getByLabelText("Search stored keys"), {
      target: { value: "cache" },
    });
    expect(screen.getByText("cache_courses")).toBeTruthy();
    expect(screen.queryByText("settings")).toBeNull();
  });

  it("searches by a fragment of the value, not just the key", () => {
    // You rarely know the key. You know the thing you stored in it.
    render(<LocalStorageSubpage />);
    fireEvent.change(screen.getByLabelText("Search stored keys"), {
      target: { value: "22BCE1234" },
    });
    expect(screen.getByText("username")).toBeTruthy();
    expect(screen.getByText("IDs")).toBeTruthy();
    expect(screen.queryByText("settings")).toBeNull();
  });

  it("says so when a search matches nothing, instead of showing an empty list", () => {
    render(<LocalStorageSubpage />);
    fireEvent.change(screen.getByLabelText("Search stored keys"), {
      target: { value: "zzzz-nope" },
    });
    expect(screen.getByText(/No key matches/)).toBeTruthy();
  });

  it("hides sensitive values until they are revealed", () => {
    render(<LocalStorageSubpage />);
    // The username is in the store and the page is showing it, so it has to
    // arrive covered. An inspector that prints a portal id on open is a leak
    // with a nicer font. The cover is on the text block (the expand target),
    // not the whole row — the key name itself is the thing you are looking up.
    // `flex-1` is `ListRowText`'s outer wrapper; `min-w-0` alone also matches
    // the title line inside it, which is not what carries the class.
    const usernameText = screen.getByText("username").closest("div.flex-1") as HTMLElement;
    expect(usernameText.className).toContain("blur");

    // A non-sensitive key is not covered, or the blur means nothing.
    const settingsText = screen.getByText("settings").closest("div.flex-1") as HTMLElement;
    expect(settingsText.className).not.toContain("blur");
  });

  it("summarises total size and how many keys are sensitive", () => {
    render(<LocalStorageSubpage />);
    expect(screen.getByText("Total size")).toBeTruthy();
    // username and IDs both match; the count the reader is looking for.
    expect(screen.getByText("2 of 4")).toBeTruthy();
  });

  it("expands a row to the full pretty-printed value", () => {
    const { container } = render(<LocalStorageSubpage />);
    // The row subtitle is a flattened one-liner, so "is there a <pre>" is the
    // question — searching for a fragment of the JSON would match the collapsed
    // row too, since the flattened subtitle contains the same text.
    expect(container.querySelector("pre")).toBeNull();

    fireEvent.click(screen.getByText("settings"));
    const pre = container.querySelector("pre") as HTMLElement;
    expect(pre).not.toBeNull();
    // Pretty-printed, so it has the indentation a blob viewer is for.
    expect(pre.textContent).toContain('\n  "compact": true');
  });

  it("deletes a key from storage and from the list", () => {
    render(<LocalStorageSubpage />);
    fireEvent.click(screen.getByTitle("Delete settings"));
    expect(screen.queryByText("settings")).toBeNull();
    expect(store.getItem("settings")).toBeNull();
  });

  it("re-reads storage on demand", () => {
    render(<LocalStorageSubpage />);
    // The old page snapshotted storage once, on open, in the parent's state.
    // A key written by anything else afterwards was invisible until you
    // reopened the overlay.
    store.setItem("written_elsewhere", "1");
    expect(screen.queryByText("written_elsewhere")).toBeNull();

    fireEvent.click(screen.getByTitle("Re-read local storage"));
    expect(screen.getByText("written_elsewhere")).toBeTruthy();
  });

  it("explains an empty store rather than rendering a blank page", () => {
    seed({});
    render(<LocalStorageSubpage />);
    expect(screen.getByText("Nothing stored yet")).toBeTruthy();
    // No search box when there is nothing to search.
    expect(screen.queryByLabelText("Search stored keys")).toBeNull();
  });

  it("never nests the delete and copy buttons inside the expand button", () => {
    // A row that is one big <button> cannot legally hold the delete button, and
    // the usual workaround (a div with onClick) is not keyboard reachable.
    render(<LocalStorageSubpage />);
    const expand = screen.getByText("settings").closest("button") as HTMLElement;
    expect(expand.querySelector("button")).toBeNull();
    expect(within(expand).queryByTitle(/Delete/)).toBeNull();
  });
});
