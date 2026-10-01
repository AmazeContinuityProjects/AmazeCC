"use client";
import { PageShell, useSubpageStack } from "./shared/primitives";
import AboutBody, { type AboutSubpage } from "./header/AboutBody";
import HallOfFameModal from "./header/HallOfFameModal";
import ChangelogModal from "./header/ChangelogModal";
import TeamModal from "./header/TeamModal";

/**
 * About & Resources, plus the three subpages it drills into.
 *
 * The hub plus its drill-downs used to be a `useState<"main" | …>` union with an
 * early return per screen, so the chrome lived inside whichever subpage was
 * showing and the hub had none of its own. Each screen is now a named entry in
 * one stack, and each subpage is a page in its own right with its own
 * `PageShell` — which is also why they are returned rather than nested: a
 * `PageShell` inside a `PageShell` would double the header, the back button and
 * the max-width. `PageShell`'s own enter animation covers the transition.
 *
 * The body itself is shared with the Settings "About & Community" section — see
 * `AboutBody`.
 */
const SCREENS = ["main", "hallOfFame", "changelog", "team"] as const;
type Screen = (typeof SCREENS)[number];

export default function AboutTab() {
  const stack = useSubpageStack<Screen>({ screens: SCREENS });
  const { screen } = stack;

  if (screen === "team") return <TeamModal handleClose={stack.reset} />;
  if (screen === "changelog") return <ChangelogModal handleClose={stack.reset} />;
  if (screen === "hallOfFame") return <HallOfFameModal handleClose={stack.reset} />;

  return (
    <PageShell
      eyebrow="AmazeCC"
      title="About & Resources"
      subtitle="Information about AmazeCC and helpful links"
    >
      <AboutBody setActiveSubpage={(page) => stack.go(page as AboutSubpage)} />
    </PageShell>
  );
}
