# Guest Landing — Architecture (deep)

> **In one line:** a public marketing page — static HTML, no login, no JS dependency beyond React — sells the app to strangers in 8 seconds.

## 1. The page

`/` → `page.tsx` → guest sections — hero ("VIT's portal, rebuilt"), feature cards, social proof ("X students…"), demo CTA, sign-in CTA.

## 2. Build contact

Fully static; ships in `out/index.html`; does not touch VTOP/API/DB; free-tier GitHub Pages host has no warm-up.

## 3. CTAs

Primary: "Sign in" → intro/onboarding · Secondary: "Try demo" → the app without VIT · Tertiary links: Discord, Instagram, docs.

## 4. SEO + share

Minimal OG tags — title/description image; rendered client-side anyway — crawlers take the meta; humans take the visuals.
