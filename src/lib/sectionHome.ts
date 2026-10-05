/**
 * Where a "double-tap the nav icon" lands.
 *
 * The bottom bar is a flat list of icons, and a single tap only ever calls
 * `selectTab(tab)` - which switches the tab but leaves whatever sub-screen was
 * last open inside it. So tapping "Academics" while sitting in
 * `academics:cgpa-predictor` looks like it did nothing: you are already on
 * Academics, and you stay on the predictor. Android's own launcher solves this
 * with double-tap-to-top, and the same gesture here should mean "take me to this
 * section's home".
 *
 * The home of each section is the value it lands on when you tap its icon today,
 * so it stays the app's own idea of a landing screen rather than a second list
 * that can drift from it.
 */

/** Sub-screen a section opens on. */
export const SECTION_HOME: Readonly<Record<string, string>> = {
  // Attendance's landing value is the calendar, which is what tapping the icon
  // has always opened (`activeAttendanceSubTabAtom` still defaults to
  // "attendance", but nothing navigates there any more).
  attendance: "calendar",
  // The rest mirror the `uiAtoms.ts` defaults.
  academics: "courses-simplified",
  tools: "overview",
  transport: "finder",
  more: "social",
  profile: "settings",
  // A nav pin rather than a section, but it lands inside Profile.
  credentials: "credentials",
};

/** Tabs that are a single screen, so "home" is just "the tab". */
export const SINGLE_SCREEN_TABS = [
  "home",
  "payments",
  "libraries",
  "events",
  "clubs",
  "community",
  "free-class",
  "cabshare",
] as const;

/**
 * Icons with no section to go home to.
 *
 * "Search" opens the command palette and "Modules" opens the app library; both
 * are toggles rather than destinations, so a double tap has nothing to reset and
 * is deliberately a no-op.
 */
export const NO_HOME_TABS = ["search", "modules"] as const;

export type SectionSetters = {
  setActiveAttendanceSubTab?: (v: string) => void;
  setActiveSubTab?: (v: string) => void;
  setActiveToolsSubTab?: (v: string) => void;
  setActiveDayscholarSubTab?: (v: string) => void;
  setActiveMoreSubTab?: (v: string) => void;
  setActiveProfileSubTab?: (v: string) => void;
};

/**
 * Reset `tabId` to its home sub-screen, if it has one.
 *
 * Returns the sub-screen it moved to, or `null` when the tab is a single screen
 * or a toggle — which is the signal for the caller to skip its own action.
 */
export function sectionHomeFor(tabId: string, setters: SectionSetters): string | null {
  const home = SECTION_HOME[tabId];
  if (!home) return null;

  switch (tabId) {
    case "attendance":
      setters.setActiveAttendanceSubTab?.(home);
      return home;
    case "academics":
      setters.setActiveSubTab?.(home);
      return home;
    case "tools":
      setters.setActiveToolsSubTab?.(home);
      return home;
    case "transport":
      setters.setActiveDayscholarSubTab?.(home);
      return home;
    case "more":
      setters.setActiveMoreSubTab?.(home);
      return home;
    case "profile":
    case "credentials":
      setters.setActiveProfileSubTab?.(home);
      return home;
    default:
      return null;
  }
}

/** Whether a double tap on this icon has anything to do. */
export function hasSectionHome(tabId: string): boolean {
  return tabId in SECTION_HOME;
}

/**
 * Whether two taps are a double tap.
 *
 * A window rather than a "second click" flag, so a slow second tap is two single
 * taps and a triple tap is a pair followed by a single — which is what
 * consuming the pair is for.
 */
export const DOUBLE_TAP_MS = 350;

export type TapOutcome =
  /** A plain tap: do the icon's normal thing. */
  | { kind: "single" }
  /**
   * A double tap: go to the section home.
   *
   * `collapseFirstTap` is set when the *first* tap already navigated - i.e. the
   * icon belonged to a section you were not in. That first tap committed and was
   * written to history as its own screen, so the second tap has to merge into
   * that entry rather than push a second one, or Back walks through a screen you
   * never chose to visit.
   */
  | { kind: "home"; collapseFirstTap: boolean };

export type TapTracker = {
  /** Record a tap and report what it meant. */
  tap: (id: string, opts?: { now?: number; wasActive?: boolean }) => TapOutcome;
  /** Forget an id, so the next tap starts a fresh window. */
  reset: (id: string) => void;
  clear: () => void;
};

export function createTapTracker(windowMs: number = DOUBLE_TAP_MS): TapTracker {
  const last = new Map<string, { now: number; wasActive: boolean }>();
  return {
    tap(id, opts = {}) {
      const now = opts.now ?? Date.now();
      const prev = last.get(id);
      if (prev !== undefined && now - prev.now <= windowMs) {
        // Consume it, so the *next* tap starts a new window instead of pairing
        // with this one and firing home again.
        last.delete(id);
        return { kind: "home", collapseFirstTap: !prev.wasActive };
      }
      last.set(id, { now, wasActive: opts.wasActive ?? false });
      return { kind: "single" };
    },
    reset(id) {
      last.delete(id);
    },
    clear() {
      last.clear();
    },
  };
}
