---
title: "The Design System"
description: "zinc-on-black, Tailwind v4 utilities, an internal primitive dialect (PageShell / Subpage / SettingRow), and @amazecontinuityprojects/amazeui re-homed inside components/custom/shared/ as shims."
---

# The Design System

> **In one line:** zinc-on-black, Tailwind v4 utilities, an internal primitive dialect
> (PageShell / Subpage / SettingRow), and `@amazecontinuityprojects/amazeui` re-homed inside
> `components/custom/shared/` as shims.
> **Audience:** everyone building UI. **Reading time:** ~9 min.

## Layers, from atoms to pages

1. **Tokens** — `globals.css` CSS variables + `lib/uiTokens.ts` (surfaces, list rows, tiles,
   chips). `--color-*` zinc scale; dark default (`<ThemeProvider defaultTheme="dark">`).
2. **Tailwind v4 utilities** — `bg-zinc-900`, `text-zinc-400`, `rounded-2xl`, `shadow-2xs`…
   No component framework on top — you will see the same 15 utility combos everywhere.
3. **`shared/` amazeui shims** — ~18 files that re-export amazeui primitives so a later swap
   is possible without touching hundreds of imports. They are _deliberate_, not accidental
   wrappers — do not "inline" them.
4. **`shared/primitives/`** — the app's own dialect: `PageShell`, `Subpage` (+ `useSubpageStack`),
   `SettingRow`, `SubpageScreen`, `InsightCarousel`, `ToneBadge`, `Switch`, `OptionPicker`.
   Every new page should compose these, not ad-hoc divs.
5. **`BottomSheet.tsx`** — the canonical modal (portal, focus trap, Escape, overlay-stack back,
   scroll lock, keyboard inset). If a spec says "dialog", open this file first.

## Color semantics (memorized or fail)

| Role           | Zinc example                                                                               |
| -------------- | ------------------------------------------------------------------------------------------ |
| page bg (dark) | `bg-zinc-950` / `bg-black` in some sheets                                                  |
| raised surface | `bg-zinc-900` (cards)                                                                      |
| borders        | `border-zinc-800/80`                                                                       |
| primary text   | `text-zinc-100` / `text-zinc-400` secondary                                                |
| accents        | violet/fuchsia gradients for marks, emerald for success, amber for warning, red for danger |

## Typography

Geist (sans), Geist Mono (code/ids), DM Sans (default body class). Loaded in `layout.tsx` via
`next/font/google` — no `<link>` tags, no FOUT.

## Motion

Framer Motion: sheets, page fades (`animate-fadeIn`), view transitions for the theme toggle.
Ambient glows in the background shell (`AnimatePresence` + blurred radial gradients) are
purely decorative — respect `prefers-reduced-motion` by not depending on them for meaning.

## Icons

`lucide-react` everywhere; FFCS grid uses text markers; `FFCS.png` FFCS-specific favicon.

## Quiz

1. You're building a new settings row — which primitive do you start from, and where does it live?
2. Why do ~18 files in `shared/` contain only `export … from "@amazecontinuityprojects/amazeui"`?
3. What's the canonical modal, and what behavior must your custom dialog implement if you
   don't use it?
