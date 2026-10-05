/**
 * Where "back" goes inside a two-level settings tree.
 *
 * Settings is `hub → section → drill-down`. That is a hierarchy, not a linear
 * chain of siblings, and the difference is exactly what a back gesture walks.
 *
 * It was previously modelled as one flat array of every screen with
 * `useSubpageStack`, which derives "back" from an array index — so every section
 * was one back step away from every other section. Opening "Appearance & Theme"
 * (third of eight) made back go to "VTOP Credentials", then "Student Profile",
 * then the hub: three presses to leave a screen the reader had never opened.
 * The drill-down `storage` was worse: appended last, it backed out into "About &
 * Community" rather than the "Advanced & System" section it lives in.
 *
 * Pure and dependency-free so the rule can be pinned by tests without importing
 * the 2,900-line page that uses it.
 */

/** The root of the settings tree. */
export const HUB = "hub";

/**
 * Drill-down → the section that owns it.
 *
 * Sections are absent on purpose: they are direct children of the hub, which is
 * what "not listed here" means. Add an entry when a drill-down is added.
 */
export const DRILLDOWN_PARENT: Readonly<Record<string, string>> = {
  storage: "advanced",
};

/**
 * The screen back should land on, from `screen`.
 *
 * A drill-down goes to its owning section; any section goes to the hub; the hub
 * goes to itself, so a caller can call this unconditionally and let its own
 * "am I at the root" test decide whether there is anywhere left to go.
 */
export function parentOf(screen: string, hub: string = HUB): string {
  if (!screen || screen === hub) return hub;
  return DRILLDOWN_PARENT[screen] ?? hub;
}

/**
 * The whole path from the hub down to `screen`, root first.
 *
 * What a back gesture should traverse, so the number of presses is the depth the
 * reader actually descended rather than a position in a list.
 */
export function settingsBackPath(screen: string, hub: string = HUB): string[] {
  const path = [screen];
  let current = screen;
  // Bounded: three levels is the whole tree, and a cycle in DRILLDOWN_PARENT
  // must not hang a gesture handler.
  for (let depth = 0; depth < 8; depth++) {
    const next = parentOf(current, hub);
    if (next === current) break;
    path.unshift(next);
    current = next;
  }
  return path;
}