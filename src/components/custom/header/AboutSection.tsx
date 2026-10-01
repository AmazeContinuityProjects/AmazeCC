"use client";
import { AboutSection as AboutSectionUI } from "../shared";
import { getAssetPath } from "../../../lib/utils";
import { version as pkgVersion } from "../../../../package.json";
import buildInfo from "@/data/buildInfo.json";

/**
 * Version and build identity for the About page.
 *
 * These were hardcoded to `v2.0.4` / `2026.0627` while the package is on 3.x
 * and `prebuild` has been generating a real build number on every build, so the
 * page the app points people at for its version was wrong. `buildInfo.json` is
 * written by `scripts/generate-build-info.js` before dev/test/typecheck/build,
 * so it is always current at the moment this renders.
 */
const buildDate = new Date(`${buildInfo.date}T00:00:00`);

export function AboutSection() {
  return (
    <AboutSectionUI
      wordmarkLightSrc={getAssetPath("/images/icons/wordmarkLight.svg")}
      wordmarkDarkSrc={getAssetPath("/images/icons/wordmarkDark.svg")}
      tagline="Your ultimate college companion application."
      version={`v${pkgVersion}`}
      buildNumber={`#${buildInfo.buildNumber}`}
      lastUpdated={buildDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })}
      platform="Web App"
    />
  );
}
