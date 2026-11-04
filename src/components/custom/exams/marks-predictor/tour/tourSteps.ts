/**
 * The predictor's tour script: one step per anchor the page marks with a
 * `data-tour-id`.
 *
 * Targets are ids, not selectors built at the call site — moving a section
 * around the page is a rename in one file rather than a hunt through the
 * provider and the page for a CSS string that has to agree with itself.
 *
 * A step whose target is missing renders the card centred with no spotlight
 * rather than skipping: an anchor lost to a layout change should still teach,
 * not silently vanish from the tour. The last step deliberately targets the
 * "Grade insights" header, so the tour points at where the ladder lives.
 */

export interface TourStep {
  /** Value of the `data-tour-id` attribute to spotlight. */
  target: string;
  title: string;
  body: string;
}

/**
 * Stored in `predictor_tour_seen`. Bump when the tour's script changes enough
 * that everyone — including those who already sat through it — should see it
 * again.
 */
export const TOUR_VERSION = 1;

export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: "predictor-stats",
    title: "Your predicted grade",
    body: "Everything on this page reacts to the marks you enter. This card shows where the course is heading — swipe it for the ceiling, the points you have pocketed, and what is already lost.",
  },
  {
    target: "predictor-assessments",
    title: "Enter your marks",
    body: "Tap any test to set what you expect on it. Marks faculty already posted open locked, with an 'Edit anyway' way past. Use Simulate… to fill every blank at once.",
  },
  {
    target: "predictor-target",
    title: "Set a goal",
    body: "Pick the grade you are aiming for. Once every other assessment has a mark, this card answers exactly what you need in the FAT.",
  },
  {
    target: "predictor-ladder",
    title: "Your standing, scaled to 100",
    body: "Your entered marks are scaled onto the grade ladder — tests you have left empty don't count against you.",
  },
];
