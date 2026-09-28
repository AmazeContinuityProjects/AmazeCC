/**
 * Guards the hydration mismatch that the intro-song gate originally caused.
 *
 * The bug: `IntroSong` decides whether to render its `<audio>` from
 * `getActiveRegNumber()`, which reads `localStorage`. On the server that returns
 * "", so the server rendered `null`. On the client localStorage is populated, so
 * the first client render produced an `<audio>` where the server had produced
 * nothing. React then threw "Hydration failed because the server rendered HTML
 * didn't match the client" and rebuilt the whole tree.
 *
 * The direction that matters is the *client* rendering markup the *server* did
 * not. So these tests assert all three halves:
 *   1. the server output contains no `<audio>`
 *   2. hydrating that output produces no hydration error
 *   3. the `<audio>` still appears after mount, i.e. the fix did not simply
 *      disable the feature
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { hydrateRoot, createRoot, type Root } from "react-dom/client";
import { act } from "@testing-library/react";
import IntroSong from "../lib/introSong/IntroSong";

/** jsdom hands vitest an opaque origin, so `window.localStorage` is absent. */
function installLocalStorage() {
  const w = window as unknown as { localStorage?: Storage };
  if (w.localStorage) return;
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
  };
  Object.defineProperty(w, "localStorage", { value: storage, configurable: true });
}

/** The cached profile shape `getActiveRegNumber()` reads the reg number from. */
function seedAllowedProfile() {
  window.localStorage.setItem(
    "profile",
    JSON.stringify({ applicationNumber: "20626703" })
  );
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeAll(installLocalStorage);
beforeEach(() => window.localStorage.clear());

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    root = null;
  }
  container?.remove();
  container = null;
  vi.restoreAllMocks();
});

/**
 * Collects React's console.error output so a hydration failure can be detected
 * by message rather than by the global error React would otherwise throw.
 */
function captureConsoleErrors(): string[] {
  const seen: string[] = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    seen.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(" "));
  });
  return seen;
}

describe("server/client agreement", () => {
  it("renders no <audio> on the server even when the reg number is allowlisted", () => {
    seedAllowedProfile();

    // This is the exact hazard. On a real server `window` is undefined, but even
    // with localStorage reachable the component must not emit markup before it
    // knows it is hydrated, or the two trees disagree.
    expect(renderToString(<IntroSong authorizedId="" />)).not.toContain("<audio");
  });

  it("hydrates the server markup without a mismatch", async () => {
    seedAllowedProfile();

    const html = renderToString(<IntroSong authorizedId="" />);
    const errors = captureConsoleErrors();

    container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
      root = hydrateRoot(container, <IntroSong authorizedId="" />);
    });

    const mismatched = errors.filter(
      (e) => /hydrat|did not match|server rendered/i.test(e)
    );
    expect(mismatched).toEqual([]);
  });

  it("still renders the <audio> once mounted, so the fix did not disable it", async () => {
    seedAllowedProfile();

    container = document.createElement("div");
    document.body.appendChild(container);
    const rootRef = { current: null as Root | null };
    await act(async () => {
      rootRef.current = createRoot(container as HTMLDivElement);
      rootRef.current.render(<IntroSong authorizedId="" />);
    });
    root = rootRef.current;

    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    expect(audio?.getAttribute("src")).toMatch(/^https:\/\/secure-res\.craft\.do\//);
  });

  it("stays silent after mount for someone who is not allowlisted", async () => {
    window.localStorage.setItem(
      "profile",
      JSON.stringify({ applicationNumber: "99999999" })
    );

    container = document.createElement("div");
    document.body.appendChild(container);
    const rootRef = { current: null as Root | null };
    await act(async () => {
      rootRef.current = createRoot(container as HTMLDivElement);
      rootRef.current.render(<IntroSong authorizedId="21BCE1234" />);
    });
    root = rootRef.current;

    expect(container.querySelector("audio")).toBeNull();
  });
});

describe("StrictMode double-invocation", () => {
  it("does not mismatch when effects run twice", async () => {
    // Next.js runs StrictMode in development, so the mount effect fires, unmounts,
    // and refires. The `mounted` flag has to survive that.
    seedAllowedProfile();

    const html = renderToString(
      <StrictMode>
        <IntroSong authorizedId="" />
      </StrictMode>
    );
    const errors = captureConsoleErrors();

    container = document.createElement("div");
    container.innerHTML = html;
    document.body.appendChild(container);

    await act(async () => {
      root = hydrateRoot(
        container,
        <StrictMode>
          <IntroSong authorizedId="" />
        </StrictMode>
      );
    });

    expect(errors.filter((e) => /hydrat|did not match/i.test(e))).toEqual([]);
  });
});
