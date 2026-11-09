import { pingVtopDirectly } from "./vtopHealth";

/**
 * App-wide "is VTOP up?" state, so students see that the university portal is
 * down instead of assuming their password or AmazeCC broke.
 *
 * Sources, newest wins:
 *  - a direct ping (on start, every 5 minutes while the tab is visible, and
 *    when the device comes back online);
 *  - the sync engine: any successful VTOP op proves it is up, and a page sync
 *    that finds VTOP unreachable marks it down.
 */
export type VtopState = "unknown" | "up" | "down";

let state: VtopState = "unknown";
let checkedAt = 0;
const listeners = new Set<() => void>();

export function getVtopState(): VtopState {
  return state;
}

export function getVtopCheckedAt(): number {
  return checkedAt;
}

export function setVtopState(next: Exclude<VtopState, "unknown">, at = Date.now()): void {
  checkedAt = at;
  if (state === next) return;
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeVtopState(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

let inFlight: Promise<VtopState> | null = null;

/** Ping VTOP now (single-flight) and publish the result. */
export function checkVtopNow(timeoutMs = 5000): Promise<VtopState> {
  inFlight ??= pingVtopDirectly(timeoutMs)
    .then((up) => {
      setVtopState(up ? "up" : "down");
      return state;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export const VTOP_RECHECK_MS = 5 * 60 * 1000;

/**
 * Keep the state fresh while something is watching it. Returns a stop
 * function. Skips pings while the tab is hidden or the device is offline.
 */
export function watchVtopState(intervalMs = VTOP_RECHECK_MS): () => void {
  const tick = () => {
    if (document.visibilityState !== "visible" || !navigator.onLine) return;
    void checkVtopNow();
  };
  tick();
  const timer = setInterval(tick, intervalMs);
  const onVisible = () => {
    if (Date.now() - checkedAt > intervalMs) tick();
  };
  window.addEventListener("online", tick);
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(timer);
    window.removeEventListener("online", tick);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
