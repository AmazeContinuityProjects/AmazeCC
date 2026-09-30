"use client";

/**
 * React bindings for the target-server preference and UniCC activity.
 *
 * The state itself lives in `unicc-fallback.ts` rather than in a jotai atom, and
 * that is deliberate. The request layer has to read the target *synchronously*,
 * at the moment a request is built, and it must be correct before React has
 * mounted anything — the very first login request happens on a screen that is
 * already interactive but whose atoms have not necessarily been hydrated from
 * `localStorage` yet. A store the network layer can read synchronously, with
 * thin hooks over the top, is the only arrangement where those two cannot
 * disagree.
 *
 * `useSyncExternalStore` is the right primitive here rather than
 * `useState` + `useEffect`: it subscribes during render, so there is no window
 * in which a component shows one value and the request layer is using another.
 * That window is exactly the bug class this feature could otherwise introduce.
 */

import { useSyncExternalStore } from "react";
import {
  getUniccActivity,
  getUniccTarget,
  isUniccFallbackEnabled,
  setUniccTarget,
  subscribeUniccActivity,
  subscribeUniccTarget,
  type UniccActivity,
  type UniccTarget,
} from "./unicc-fallback";

export type { UniccActivity, UniccTarget };
export { isUniccFallbackEnabled, setUniccTarget };

/** The user's chosen target server, live. */
export function useUniccTarget(): UniccTarget {
  return useSyncExternalStore(subscribeUniccTarget, getUniccTarget, () => "amazecc" as const);
}

/**
 * What UniCC has been doing this session, live.
 *
 * Returns a stable snapshot object that only changes identity when something was
 * actually recorded, so this is safe to use directly in a `useMemo` dependency
 * without causing an update loop.
 */
export function useUniccActivity(): UniccActivity {
  return useSyncExternalStore(subscribeUniccActivity, getUniccActivity, getUniccActivity);
}
