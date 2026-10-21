/**
 * The guided tour's script: one step per anchor the tab marks with a
 * `data-tour-id`.
 *
 * Targets are ids, not selectors built at the call site, so moving a button
 * around the tab is a rename in one file rather than a hunt through the
 * provider and the tab for a CSS string that has to agree with itself.
 *
 * A step whose target is missing renders the card centred with no spotlight
 * rather than skipping: an anchor lost to a layout change should still teach,
 * not silently vanish from the tour.
 */

export interface TourStep {
  /** Value of the `data-tour-id` attribute to spotlight. */
  target: string;
  title: string;
  body: string;
}

/**
 * Stored in `ffcs_tour_seen`. Bump when the tour's script changes enough that
 * everyone — including those who already sat through it — should see it again.
 */
export const TOUR_VERSION = 1;

export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: "ffcs-banner",
    title: "Welcome to FFCS",
    body: "This is your planner. Everything here lives on your device — your timetables, friends and settings never leave this browser.",
  },
  {
    target: "ffcs-add-course",
    title: "Pick your target courses",
    body: "Open Target Courses to search the report, paste a list straight from your registration sheet, or upload a CSV — no typing codes by hand.",
  },
  {
    target: "ffcs-grid",
    title: "Build a week",
    body: "Click slots in the grid to place your courses. Lock the courses and faculties you have decided on, and block the slots you refuse.",
  },
  {
    target: "ffcs-generate",
    title: "Or let it generate",
    body: "The generator streams conflict-free weeks as it searches — filter, sort by half-days or gaps, rank by a profile, compare side by side, then save the ones you like.",
  },
  {
    target: "ffcs-social",
    title: "Plan with friends",
    body: "Add your friends' course codes to see the social score of every week — how many classes you would actually share.",
  },
  {
    target: "ffcs-export",
    title: "Take it with you",
    body: "Download a PNG, print a clean copy, export to your calendar app, or share a link that opens this exact plan for a friend.",
  },
];
