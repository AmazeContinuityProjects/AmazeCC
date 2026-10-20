"use client";
import { AboutSection as AboutSectionUI } from "../shared";
import { getAssetPath } from "../../../lib/utils";
import buildInfo from "@/data/buildInfo.json";

/**
 * Version and build identity for the About page.
 *
 * The app no longer advertises a package.json semver that drifted from the
 * running code anyway (the page once claimed v2.0.4 while the package was on
 * 3.x). The "version number" is now the commit id the running copy was cut
 * from — `#<short sha>` from the generated `buildInfo.json` — which is also
 * what the Live Changelog and every commit chip elsewhere label builds with,
 * so About, the log and history all speak the same identifier.
 *
 * `buildInfo.json` is written by `scripts/generate-build-info.js` before
 * dev/test/typecheck/build, so it is always current at the moment this
 * renders.
 */
const buildDate = new Date(`${buildInfo.date}T00:00:00`);

export function AboutSection() {
  return (
    <AboutSectionUI
      wordmarkLightSrc={getAssetPath("/images/icons/wordmarkLight.svg")}
      wordmarkDarkSrc={getAssetPath("/images/icons/wordmarkDark.svg")}
      tagline="Your ultimate college companion application."
      version={`#${buildInfo.commitHash}`}
      lastUpdated={buildDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}
      platform="Web App"
    />
  );
}
