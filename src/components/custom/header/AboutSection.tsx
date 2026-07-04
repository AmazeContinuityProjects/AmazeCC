import { getAssetPath } from '../../../lib/utils';
import { AboutSection as AboutSectionUI } from '../shared';

export function AboutSection() {
  return (
    <AboutSectionUI
      wordmarkLightSrc={getAssetPath("/images/icons/wordmarkLight.svg")}
      wordmarkDarkSrc={getAssetPath("/images/icons/wordmarkDark.svg")}
      tagline="Your ultimate college companion application."
      version="v2.0.4"
      buildNumber="2026.0627"
      lastUpdated="June 2026"
      platform="Web App"
    />
  );
}
