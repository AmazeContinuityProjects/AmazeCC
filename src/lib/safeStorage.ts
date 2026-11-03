/**
 * `localStorage` with the SSR guard and the quota throw handled once.
 *
 * Extracted from `FFCSTimetableTab`, which defined it while `ffcsGeneratorTargets`
 * (a lib module) carried a byte-for-byte copy — that copy existed only to avoid
 * a lib→component import, which this file makes unnecessary.
 */
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window === "undefined" || !window.localStorage) return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        localStorage.setItem(key, value);
      }
    } catch {}
  },
};
