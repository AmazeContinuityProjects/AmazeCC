---
name: AmazeCC
description: A calm, mobile-first student operating system that turns scattered university portals into one fast command center.
colors:
  background: "oklch(0.982 0.004 247)"
  surface: "oklch(1 0 0)"
  surface-secondary: "oklch(0.965 0.005 247)"
  surface-tertiary: "oklch(0.935 0.008 247)"
  surface-raised: "oklch(1 0 0)"
  border-muted: "oklch(0.88 0.008 247)"
  border-strong: "oklch(0.78 0.011 247)"
  text-heading: "oklch(0.18 0.026 255)"
  text-primary: "oklch(0.25 0.024 255)"
  text-secondary: "oklch(0.42 0.023 255)"
  text-muted: "oklch(0.52 0.02 255)"
  theme-accent: "#0ea5e9"
  theme-accent-deep: "#0284c7"
  neon-pink: "#ff2bd6"
  forest: "#059669"
  rose: "#e11d48"
  amber: "#d97706"
  success: "oklch(0.47 0.135 152)"
  warning: "oklch(0.58 0.142 72)"
  danger: "oklch(0.52 0.2 27)"
  info: "oklch(0.52 0.16 255)"
typography:
  display:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "DM Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.08em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  sheet: "28px"
  panel: "32px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  2xl: "32px"
  3xl: "48px"
  4xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.theme-accent}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 24px"
  button-primary-hover:
    backgroundColor: "{colors.theme-accent-deep}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 24px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    height: "40px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "24px"
  badge:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.sm}"
    padding: "4px 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    height: "40px"
    padding: "0 12px"
  page-header:
    backgroundColor: "{colors.surface-secondary}"
    textColor: "{colors.text-heading}"
    rounded: "{rounded.lg}"
    padding: "18px 24px"
---

# Design System: AmazeCC

## Overview

**Creative North Star: "The Calm Command Center"**

AmazeCC is a Student Operating System, not a showcase. Its visual identity is defined by a single promise: a student walking between classes should be able to open the app and understand their whole academic picture in seconds, with no hunting and no cognitive noise. The interface is calm, helpful, friendly, academic, modern, and trustworthy — deliberately _not_ corporate, enterprise, futuristic, gaming-oriented, social-media-like, or overly decorative.

The system is 70% functional student OS, 20% Material Design principles, and 10% organic personality. "Organic" here is a softening agent, not a theme: softer corners, softer colors, softer shadows, comfortable spacing, and a natural visual rhythm — never leaf icons, plant illustrations, gardening motifs, or irregular navigation. Density is tuned for a phone first: the viewport starts at 85% zoom on mobile so roughly 17% more of the app fits per screen, with pinch-zoom still available and safe-area insets respected for the bottom navigation, sheets, and docked bars.

Three surfaces carry every screen: a near-white neutral canvas (`oklch(0.982 0.004 247)`), layered neutral surfaces, and one user-chosen accent used for actions and state. Light and Dark are both first-class modes over the same structure, with Dark the default; a palette only tints the surfaces, never the geometry. Consistency outranks creativity at every turn: reuse an existing component or token before inventing a new one, and when a choice improves aesthetics but reduces usability, choose usability.

**Key Characteristics:**

- Mobile-first, touch-first, and offline-capable; 44px minimum touch targets and a 16px input font floor on coarse pointers.
- Neutral-first canvas with a single opt-in accent; semantic colors reserved for attendance status and feedback.
- Softer, geometric, Material-adjacent form language — generous radii, quiet tonal layering, no decorative illustration.
- Dense but readable: a strict six-step type scale, an eight-step spacing scale, and a six-step radius scale.
- Two first-class themes (light and dark, dark by default) plus four selectable accent palettes and a custom accent, all driven by the same tokens.

## Colors

The palette is neutral-first: cool blue-grey ink and layered paper-like surfaces carry the interface, while one accent and four semantic colors do all of the signalling. Every value is a token; hardcoded colors are forbidden.

### Primary

- **Theme Accent** (`#0ea5e9`, deeper hover `#0284c7`): the single action color — filled primary buttons, active track fills, focus rings, links, and gradient starts. The default palette actually removes the override and inherits the library's neutral `--primary` (`oklch(0.205 0 0)` light / `oklch(0.922 0 0)` dark), so the accent is a _user choice_, not a fixed brand blue.
- **Selectable Accents** — Neon Pink (`#ff2bd6`), Forest Green (`#059669`), Rose (`#e11d48`), Amber (`#d97706`): the four accents offered in the profile picker alongside Default and Custom. Default drops the accent override and inherits the library's neutral `--primary`; Custom takes any user-supplied hex. Only the accent and its tinted surfaces change; layout, spacing, and component geometry stay identical.

### Secondary

- Semantic colors are the secondary vocabulary, tied to meaning rather than decoration: success, warning, danger, and info.

### Tertiary

- **Chart Sequence** (`--chart-1` through `--chart-5`): analytics series, re-tinted from the active accent in non-default palettes so charts stay on-theme.

### Neutral

- **Canvas / Background** (`oklch(0.982 0.004 247)`; dark `oklch(0.09 0.015 255)`): the page behind all cards.
- **Surface** (`oklch(1 0 0)`; dark `oklch(0.2 0 0)`): cards, list shells, and inputs. **Surface Secondary** (`oklch(0.965 0.005 247)`) and **Surface Tertiary** (`oklch(0.935 0.008 247)`) step content back; **Surface Raised** (`oklch(1 0 0)`) floats above.
- **Ink** — Heading (`oklch(0.18 0.026 255)`), Primary (`oklch(0.25 0.024 255)`), Secondary (`oklch(0.42 0.023 255)`), Muted (`oklch(0.52 0.02 255)`), Disabled (`oklch(0.68 0.015 255)`); in dark these invert to `oklch(0.985 0.003 247)` → `oklch(0.55 0.01 247)`.
- **Borders** — Muted (`oklch(0.88 0.008 247)`) and Strong (`oklch(0.78 0.011 247)`) in light; alpha-white (`oklch(0.98 0.004 247 / 0.22)` / `/0.36`) in dark. The zinc/gray/slate Tailwind families are aliased to this same neutral chain so an accent change recolours every surface, not just the semantic layer.
- **Status** — Success (`oklch(0.47 0.135 152)`), Warning (`oklch(0.58 0.142 72)`), Danger (`oklch(0.52 0.2 27)`), Info (`oklch(0.52 0.16 255)`), each with a `-foreground` text color and a soft `-surface` tint.

### Named Rules

**The Token-Only Rule.** No hardcoded color in a component. Write the semantic token (`bg-surface`, `text-text-secondary`, `bg-danger-surface`) or the aliased neutral family, never a raw hex or an off-scale step.

**The One-Accent Rule.** One accent per screen. It signals action, selection, or progress; it is never used as a background wash for whole pages or as body text.

**The Meaning Rule.** Green / amber / red are attendance and status language (safe / watch / critical) first. They must not be repurposed as decorative category colors.

## Typography

**Display / Heading Font:** DM Sans via `next/font/google` (`--font-dm-sans`, aliased as `--font-outfit`; the design docs call this role "Outfit") with system sans fallback.
**Body Font:** Geist (`--font-geist`) with Inter / system sans fallback.
**Mono Font:** Geist Mono (`--font-geist-mono`).

**Character:** A geometric, slightly compressed display face for titles and large numbers, paired with a neutral, highly legible Grotesk for body copy. Headings lean on `font-black` (900) and tight tracking; body stays quiet at regular weight. All six roles are real — do not introduce a seventh size.

### Hierarchy

- **Display** (900, 32px / 2rem, 1.15 line-height, -0.025em): page and marketing hero titles, large stats.
- **Headline** (900, 24px / 1.5rem, 1.2): section headings and prominent banner titles.
- **Subheading / Title** (700–800, 20px / 1.25rem, 1.3): card titles and sub-section labels.
- **Body** (400, 16px / 1rem, 1.5): primary copy; keep measures near 65–75ch where prose is long.
- **Caption** (500, 14px / 0.875rem): secondary copy, metadata, helper text.
- **Small Label** (700, 12px / 0.75rem, wide tracking, often uppercase): course codes, eyebrows, badges, action-button caps.

### Named Rules

**The Six-Sizes Rule.** Display 32 / Heading 24 / Subheading 20 / Body 16 / Caption 14 / Label 12 — nothing between, nothing beyond. Use weight and color for emphasis, not a new font size.

**The Heavy-Heading Rule.** Headings are `font-black` in DM Sans with tight tracking (`tracking-tight`); body copy never borrows that weight.

## Layout

Mobile-first single-column stacks that expand into multi-column dashboards at `md` and up. A page follows a fixed reading order: **Page Title → Description → Primary Action → Content**, with current student needs, then important information, then supporting information. The shared `PageHeader` is a semi-pill block anchored to the top (`rounded-b-2xl`, `py-4.5 px-6`, `shadow-sm`) carrying the title in DM Sans black, inline simulation metrics, and right-aligned 11px extra-bold action buttons.

The dashboard shell is a responsive grid of content cards and tiles; on phones a floating bottom navigation pill (`mobile-bottom-nav-bar`) owns navigation, lifted with `env(safe-area-inset-bottom)` and raised above FFCS action bars when that tool is mounted. Spacing follows an eight-step rhythm — 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 — with no custom values. Content reserves extra bottom padding so the last row clears fixed bars.

Breakpoints are the Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280), but the mobile 85% initial scale means the _device-pixel_ flip points are ≈544 / 653 / 870 / 1088. Do not compensate by hand-editing breakpoints: CSS and JS both read the same widened layout viewport, so they already agree.

## Elevation & Depth

Depth is quiet and tonal first, shadow second. Cards sit on layered neutral surfaces with a hairline border, and shadows appear mostly as state or elevation — not as permanent decoration. We ship four named shadow steps (`shadow-2xs`, `shadow-xs`, `shadow-sm`, `shadow-2xl`) and no custom `shadow-[…]` values; the sole exception is the bottom sheet's upward directional lift (`shadow-[0_-15px_…]`) in `components/custom/shared/BottomSheet.tsx`.

### Shadow Vocabulary

- **Resting card / row / input** (`shadow-2xs`): the default; `.surface-card` paints `0 1px 3px rgba(0,0,0,0.05)` and `.solid-card` uses `0 1px 2px color-mix(in oklab, var(--text-heading) 8%, transparent)`.
- **Interactive tile / raised surface** (`shadow-xs`): tiles and hovered cards; `.surface-card:hover` deepens to `0 4px 12px rgba(0,0,0,0.08)`.
- **Floating control** (`shadow-sm`): switch thumbs, popovers, menus, page-header semi-pill.
- **Overlay** (`shadow-2xl`): icon buttons, dialogs, bottom sheets, sidebars.
- **Card interior** (`.card-surface`): solid `--surface` by default (`--surface-secondary` in dark), or the optional "zinc glass" look — `--surface` at 80% light / 70% dark with `backdrop-blur-xl` (24px).

### Named Rules

**The Flat-At-Rest Rule.** Surfaces are flat at rest; a shadow is a response to state (hover, focus, elevation) or a genuine overlay. Never stack shadows to fake importance.

## Shapes

Rounded, soft, and geometric. Six radius steps are permitted and nothing else: **8px** (`rounded-lg`, segmented-control segments, inner chips), **12px** (`rounded-xl`, icon buttons, tone icon tiles, inputs), **16px** (`rounded-2xl`, list shells, chips, content cards, row icons), **24px** (`rounded-[24px]`, tile surfaces, insight carousels, dialogs), **28px** (`rounded-[28px]`, bottom sheets, dashed empty states), and **32px** (`rounded-[32px]`, large empty panels). The three largest steps are written in Tailwind's arbitrary-value syntax on purpose — they are named steps, not arbitrary values.

`rounded-3xl` is not permitted: Tailwind renders it as 24px, which the scale already expresses as `rounded-[24px]`. Two spellings of one surface defeat grep-based drift checks. The shared AmazeUI library also emits `rounded-md` / `rounded-xl` / `rounded-2xl` utilities from a 10px `--radius` base; treat those as the current utility spellings of the small steps and prefer the named scale in new code.

Borders are hairline (`--border-muted`) or one step stronger (`--border-strong`). Chips, tiles, and icon buttons use the radius step above their container's so inner elements never look like they are touching the edge — the 8px step exists for this reason inside 12px icon buttons.

## Components

Reuse from `@amazecontinuityprojects/amazeui` before building anything new. The shared set includes `Button`, `Card` (+ header/title/description/content/footer), `Badge`, `Input`, `Textarea`, `Select`, `Modal`, `PageHeader`, `SubpageLayout`, `SubTabStrip`, `SearchInput`, `BackButton`, `EmptyState`, `Skeleton`, `CircularProgress`, `InfoRow`, `SectionHeader`, `ViewModeToggle`, `ErrorDisplay`, and `SyncNotification`. Icons are Lucide only — no custom sets, no botanical decoration.

App-specific surfaces come from `src/lib/uiTokens.ts`: `TILE` / `TILE_INTERACTIVE` / `TILE_CARD` (24px, `--border-strong` edge, `shadow-xs`), `LIST_SHELL` / `LIST_ROW` (16px shell with hairline dividers), `CHIP` (8px uppercase micro chip), `ICON_BUTTON` (12px, `shadow-2xs`), `FIELD_INPUT` / `SEARCH_FIELD` (16px fields), `TONE_BADGE` / `TONE_TEXT` / `TONE_ICON_TILE` (semantic hue recipes), `EMPTY_STATE` (28px dashed panel), and `GHOST_BUTTON`. The local shadcn-style primitives in `src/components/ui/` (`Button`, `Card`, `Input`, `Badge`, `Dialog`, `Sheet`, `Tabs`, `ToggleGroup`, `Skeleton`, `Separator`) remain available for feature-local work.

### Buttons

- **Shape:** 8px radius (`rounded-sm`); 40px tall at default size, 24px horizontal padding; inline-flex, gap-2, medium weight, `transition-all duration-150`.
- **Primary:** solid accent background (`--theme-accent`, default neutral `--primary`), high-contrast white / primary-foreground text; hover darkens one step (`hover:bg-primary/90`, 150ms).
- **Secondary:** transparent on `--surface` with a `--border` hairline and primary text; hover adds a neutral surface tint.
- **Ghost:** no background or border, secondary text; hover applies a light neutral or accent tint.
- **Danger:** solid `--danger` with white text; hover deepens red.
- **Disabled / Focus:** 50% opacity with `cursor: not-allowed` and pointer-events off; focus-visible shows a 2px accent ring with a 2px offset gap.

### Chips & Badges

- **Style:** 16px pill (`rounded-2xl`) or 8px inner chip; soft semantic surface (`--success-surface`, `--warning-surface`, `--danger-surface`, `--info-surface`) with the matching foreground text.
- **State:** selected filters use an accent tint; unselected stay neutral. Status badges read as Healthy / Watch / Critical for attendance.

### Cards / Containers

- **Corner Style:** 16px (`rounded-2xl`) for content cards and list shells; 24px for tiles and carousels.
- **Background:** `--surface`, optionally `--surface-secondary` / `--surface-tertiary` for nested blocks; optional zinc-glass interior.
- **Shadow Strategy:** resting `shadow-2xs`, interactive `shadow-xs` (see Elevation).
- **Border:** 1px `--border-muted` hairline. **Internal Padding:** 16px or 24px.

### Inputs / Fields

- **Style:** 40px tall, 12px radius, 1px neutral border, `--surface` background, Geist body/caption text with `--text-muted` placeholder.
- **Focus:** 2px accent outline/ring; hover darkens the border.
- **Error / Disabled:** 1.5px `--danger` border with helper text beneath; disabled uses muted text and no pointer events. On coarse pointers every field is forced to 16px to stop iOS zoom-on-focus; a 1000px inset `--surface` shadow repaints autofilled fields.

### Navigation

- **Desktop:** left sidebar at 24px radius with `--sidebar` tokens, 8px-radius icon rows, 150ms hover transitions, and 2px accent focus rings.
- **Mobile:** a floating bottom navigation pill with discoverable labels and safe-area-aware positioning; the active item is the only accented element.
- **Sub-navigation:** `SubTabStrip` / segmented controls use 8px-radius segments inside a 12px track; navigation is always a tool, never decoration.

### Page Header (signature component)

- **Style:** flat pastel semi-pill anchored to the top (`rounded-b-2xl`, `bg-*-50/40` light / `bg-*-950/20` dark, `shadow-sm`, `py-4.5 px-6`), no gradient overlays.
- **Content:** DM Sans `font-black` title at Display/Headline scale, optional inline simulation metrics, and right-aligned 11px `font-extrabold` uppercase action buttons with 16px icons.

### Material 3 Slider (signature component)

- **Track:** 14px tall pill; filled share uses the accent; rest is `#e4e4e7` light / `#3f3f46` dark.
- **Thumb:** 20px hit target drawing an 8px accent dot via radial gradient; swells to `scale(1.35)` while dragging; 150ms transition.

## Do's and Don'ts

### Do:

- **Do** reuse an existing component, token, spacing step, shadow, or type role before adding anything new.
- **Do** keep the mobile viewport at 85% initial scale, respect `env(safe-area-inset-*)`, and give small icon buttons a 44px hit area (`.hit-expand`).
- **Do** use the six radius steps (8 / 12 / 16 / 24 / 28 / 32px) and the eight spacing steps (4–64px) exactly.
- **Do** keep the four semantic colors tied to status, and let the neutral chain carry every surface so palette changes propagate.
- **Do** ship WCAG AA contrast, keyboard navigation, visible focus states, screen-reader labels, and the reduced-motion opt-out for looping animations.
- **Do** answer "what does the student need right now?" before showing analytics or secondary information.

### Don't:

- **Don't** introduce a new color, hardcoded hex, new card style, new button style, new spacing scale, or new shadow system.
- **Don't** use `rounded-3xl`, `rounded-[18px]`, `rounded-[22px]`, custom `shadow-[…]` values, or off-scale spacing.
- **Don't** use leaf/plant icons, botanical illustrations, random blobs, or irregular navigation — "organic" affects atmosphere only.
- **Don't** make the interface feel corporate, enterprise, futuristic, gaming-oriented, or social-media-like.
- **Don't** add a seventh font size, use decorative illustration over comprehension, or let a design choice win over usability or consistency.
