"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";

/**
 * Subpage organisation.
 *
 * Most pages in this app are not one screen: a landing view plus a handful of
 * drill-downs (Libraries -> dues, Curriculum -> catalog, Social -> people), and
 * each one hand-rolled the same `type Screen = "landing" | ...` union, a
 * `back()` that pops to landing, and a "back at the root leaves the page"
 * escape hatch. That is what this owns.
 *
 * The stack is intentionally shallow and explicit rather than a router: it is
 * local UI state, it must not survive a reload, and it must never outlive the
 * page that owns it.
 */

export interface SubpageStackOptions<T extends string> {
  /** Every screen this page can show, base/root first. */
  screens: readonly T[];
  /** Screen to start on. Defaults to the first entry. */
  initial?: T;
  /**
   * Fired when back is pressed while already on the root screen — the hook's
   * job is to do nothing, the host decides what "leaving" means (usually
   * switching the parent tab).
   */
  onExit?: () => void;
}

export interface SubpageStack<T extends string> {
  /** The screen currently on show. */
  screen: T;
  /** True when on the first entry of `screens`. */
  isRoot: boolean;
  /** Whether a back affordance should render at all. */
  canGoBack: boolean;
  go: (screen: T) => void;
  /** Pop one level, or call `onExit` when already at the root. */
  back: () => void;
  /** Return to the root screen. */
  reset: () => void;
}

export function useSubpageStack<T extends string>({
  screens,
  initial,
  onExit,
}: SubpageStackOptions<T>): SubpageStack<T> {
  const root = screens[0];
  const [screen, setScreen] = useState<T>(initial ?? root);

  const index = screens.indexOf(screen);
  const isRoot = index <= 0;

  const go = useCallback((next: T) => setScreen(next), []);

  const back = useCallback(() => {
    if (isRoot) {
      onExit?.();
      return;
    }
    // index > 0 is guaranteed here, so screens[index - 1] exists.
    setScreen(screens[index - 1]);
  }, [isRoot, onExit, screens, index]);

  const reset = useCallback(() => setScreen(root), [root]);

  return useMemo(
    () => ({ screen, isRoot, canGoBack: !isRoot || !!onExit, go, back, reset }),
    [screen, isRoot, onExit, go, back, reset]
  );
}

const SCREEN_ENTER = "animate-in fade-in slide-in-from-bottom-4 duration-300";

/**
 * Body of one screen. Keying it on the screen id re-runs the enter animation
 * on every drill-down, which is the whole point — it reads as pushing into a
 * new level rather than re-rendering in place.
 */
export function SubpageScreen({
  id,
  className = "",
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div key={id} className={`${SCREEN_ENTER} ${className}`.trim()}>
      {children}
    </div>
  );
}
