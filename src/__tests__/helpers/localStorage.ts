import { vi } from "vitest";

/**
 * Installs a working `localStorage` on both `globalThis` and `window`.
 *
 * This jsdom environment ships without one — not even on `window`, despite a
 * valid `http://localhost:3000` origin — so any suite touching persisted
 * state needs this. It lives in a helper rather than a global `setupFiles`
 * polyfill on purpose: a setup file would change the environment for every
 * suite in the repo, including the ones that pin the absence.
 *
 * Returns the backing stub so a test can inspect raw values or clear the
 * store between cases.
 */
export function installLocalStorage(): Storage {
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

/**
 * jsdom has no layout engine and no `scrollIntoView`; components that measure
 * or reveal elements would throw without this. A no-op is all they need —
 * whether the browser actually scrolled is not what any unit test asserts.
 */
export function stubScrollIntoView(): void {
  Element.prototype.scrollIntoView = vi.fn();
}
