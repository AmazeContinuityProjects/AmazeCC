"use client";
import { Link2 } from "lucide-react";
import { AboutSection } from "./AboutSection";
import ResourcesSection from "../ResourcesSection";
import { SectionHeader } from "../shared/primitives";

/** The four destinations the About page drills into. */
export type AboutSubpage = "main" | "hallOfFame" | "changelog" | "team";

/**
 * The About page's body — wordmark, version, and every link.
 *
 * This is deliberately a body and not a page. It used to exist twice: once as
 * the About tab, and once more as the Settings "About & Community" section,
 * which was a hand-copy of the same links with its own (stale) version numbers.
 * Two copies of a link list drift, and these had — the settings copy still
 * claimed v3.2.0 / 2026.0816 while the app moved on.
 *
 * So the body is here, and the two hosts differ only in their chrome: `AboutTab`
 * wraps it in a `PageShell`, the Settings section renders it inside the
 * settings shell that is already on screen. Nesting a `PageShell` here would
 * double the header, the back button and the max-width, which is why this
 * component owns no chrome of its own.
 *
 * `setActiveSubpage` is how the host says where a drill-down should go. AboutTab
 * pushes a screen onto its own stack; Settings opens the modal it already keeps
 * mounted.
 */
export default function AboutBody({
  setActiveSubpage,
}: {
  setActiveSubpage: (page: AboutSubpage) => void;
}) {
  return (
    <div className="space-y-6">
      <AboutSection />
      <div className="space-y-3">
        <SectionHeader icon={Link2} title="Resources" />
        <ResourcesSection setActiveSubpage={setActiveSubpage} />
      </div>
    </div>
  );
}
