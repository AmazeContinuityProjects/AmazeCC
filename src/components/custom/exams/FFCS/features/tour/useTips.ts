"use client";

import { useCallback, useEffect, useState } from "react";
import { storage } from "@/lib/storage";

/**
 * Dismissible one-liners above the planner.
 *
 * ## Why these and not a tour
 *
 * A tour interrupts; a hint sits where its advice applies and leaves when
 * read. The two coexist on purpose — the tour is the once-per-version
 * walkthrough, the hints are the evergreen tips that stay useful after it
 * (and the entry point for people who skipped it: each hint can start the
 * tour again).
 *
 * Dismissals are remembered per id in `ffcs_tips_dismissed`, not per version:
 * "I know where the shortcuts are" should not come back because someone
 * bumped a tour script.
 */

export interface FFCSHint {
  /** Stable id — the dismissal key, so rewording keeps the dismissal. */
  id: string;
  text: string;
}

/** Shown in order above the grid until each is dismissed. */
export const FFCS_HINTS: readonly FFCSHint[] = [
  {
    id: "import",
    text: "No need to type codes by hand — Target Courses takes a pasted list or a CSV of your registration sheet.",
  },
  {
    id: "blocked-slots",
    text: "Blocked slots are hard constraints: the generator will never place a class in a slot you blocked.",
  },
  {
    id: "friends",
    text: "Add your friends' course codes and every week gets a social score — how many classes you would actually share.",
  },
  {
    id: "shortcuts",
    text: "Press the keyboard button up top for the full shortcut list, and ? to bring it back any time.",
  },
];

export function useTips(hints: readonly FFCSHint[] = FFCS_HINTS) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    // Read after mount: storage does not exist during SSR, and guessing here
    // would flash hints at users who dismissed them.
    const stored = storage.ffcsTipsDismissed.get();
    setDismissed(new Set(Array.isArray(stored) ? stored : []));
  }, []);

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      storage.ffcsTipsDismissed.set([...next]);
      return next;
    });
  }, []);

  const visible = hints.filter((hint) => !dismissed.has(hint.id));
  return { visible, dismiss };
}
