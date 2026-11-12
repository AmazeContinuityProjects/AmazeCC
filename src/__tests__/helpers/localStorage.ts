import { vi } from "vitest";

/**
 * jsdom's own `localStorage` is shadowed by Node's experimental global, which is
 * `undefined` without `--localstorage-file`. This suite ships without one on
 * `globalThis` — not even on `window` — so any suite touching persisted state
 * needs this. It lives in a helper rather than a global `setupFiles` polyfill on
 * purpose: a setup file would change the environment for every suite in the repo,
 * including the ones that pin the absence.
 *
 * The stub is class-based so `Object.getPrototypeOf(stub)` carries the storage
 * methods. Code that patches `Storage.prototype`-style (see `credentialVault`)
 * walks the prototype chain, and a plain object literal would leave it with
 * nothing to patch.
 *
 * Returns the backing stub so a test can inspect raw values or clear the
 * store between cases.
 */
/**
 * In-memory Storage implementation.
 *
 * Stored keys are installed as own enumerable properties on the instance rather
 * than inside a private Map. Tests read "what is physically on disk" with
 * `Object.keys(localStorage)` and `Object.getOwnPropertyDescriptor(localStorage, key)`,
 * which only works when the keys are own properties — exactly how a real Storage
 * object behaves. `length` and `key()` are defined over the same own-key set so the
 * contract matches too.
 */
class MemoryStorage implements Storage {
  get length(): number {
    return ownKeys(this).length;
  }

  key(index: number): string | null {
    return ownKeys(this)[index] ?? null;
  }

  getItem(k: string): string | null {
    const d = Object.getOwnPropertyDescriptor(this, k);
    return d && "value" in d ? d.value : null;
  }

  setItem(k: string, v: string): void {
    Object.defineProperty(this, k, {
      value: String(v),
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }

  removeItem(k: string): void {
    delete (this as unknown as Record<string, string>)[k];
  }

  clear(): void {
    for (const k of ownKeys(this)) delete (this as unknown as Record<string, string>)[k];
  }
}

function ownKeys(s: Storage): string[] {
  return Object.keys(s);
}

export function installLocalStorage(): Storage {
  const stub = new MemoryStorage();
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

export function stubScrollIntoView(): void {
  Element.prototype.scrollIntoView = vi.fn();
}
