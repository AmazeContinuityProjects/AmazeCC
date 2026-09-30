# AmazeCC Design Language

Version: 1.0

---

# 1. Introduction

AmazeCC is a Student Operating System.

It brings together academics, attendance, timetable, campus life, student tools, and productivity features into a unified experience.

The goal of AmazeCC is not to look futuristic or corporate.

The goal is to help students navigate university life quickly, confidently, and with minimal cognitive load.

---

# 2. Product Principles

Every design decision must follow these principles.

## 2.1 Student First

Every screen should answer:

"What does the student need right now?"

before showing analytics, charts, or secondary information.

---

## 2.2 Clarity Over Decoration

Visual beauty should never reduce usability.

Information must always be easier to understand than it is beautiful.

---

## 2.3 Fast Navigation

Students frequently use AmazeCC while:

* Walking between classes
* Standing in queues
* Checking attendance quickly
* Looking up exam information

Navigation must always be fast and obvious.

---

## 2.4 Consistency Over Creativity

A consistent interface is more valuable than a creative interface.

Reusing existing patterns is preferred over inventing new ones.

---

# 3. Visual Identity

## Personality

AmazeCC should feel:

* Calm
* Helpful
* Friendly
* Academic
* Modern
* Trustworthy

AmazeCC should NOT feel:

* Corporate
* Enterprise
* Futuristic
* Gaming-oriented
* Social-media-like
* Overly decorative

---

# 4. Design Style

## Core Style

70% Functional Student OS

20% Material Design Principles

10% Organic Personality

---

## Organic Interpretation

Organic design means:

* Softer corners
* Softer colors
* Softer shadows
* Comfortable spacing
* Natural visual rhythm

Organic design DOES NOT mean:

* Leaf icons
* Plant illustrations everywhere
* Gardening themes
* Random blob shapes
* Irregular navigation layouts

Organic should influence atmosphere, not usability.

---

# 5. Radius System

Only these six values may be used.

| Step | Class | Used for |
|------|-------|----------|
| 8px | `rounded-lg` | Segmented-control segments, inner chips |
| 12px | `rounded-xl` | Icon buttons, tone icon tiles |
| 16px | `rounded-2xl` | List shells, chips, content cards, row icons |
| 24px | `rounded-[24px]` | Tile surfaces, insight carousels |
| 28px | `rounded-[28px]` | Bottom sheets, dashed empty states |
| 32px | `rounded-[32px]` | Large empty-panel variant |

`rounded-[24px]`, `rounded-[28px]` and `rounded-[32px]` are the named steps written in
Tailwind's arbitrary-value syntax. They are not arbitrary values, and they are not
violations of this scale.

**`rounded-3xl` is not permitted.** Tailwind's `rounded-3xl` is 24px, which this scale
expresses as `rounded-[24px]`. The two are visually identical but a source file using
both produces two spellings of the same surface, which defeats grepping for a single
step and hides drift when one is edited and the other is not.

The 8px step is not a rounding artefact: it is what keeps a chip inside a 12px icon
button from looking like it is touching the edge.

No values outside this scale. In particular no `rounded-[18px]`, `rounded-[22px]` or
`rounded-[28px]`-as-a-typo — snap to the nearest step above or below and say which in
review.

---

# 6. Shadow System

| Class | Used for |
|-------|----------|
| `shadow-2xs` | Resting cards, rows, inputs |
| `shadow-xs` | Interactive tiles, raised surfaces |
| `shadow-sm` | Floating controls (switch thumb, popovers) |
| `shadow-2xl` | Icon buttons, dialogs, bottom sheets, overlays |

No custom `shadow-[…]` values. The one current exception is the bottom sheet's
upward lift (`shadow-[0_-15px_…]` in `shared/BottomSheet.tsx`), which is a
directional shadow rather than a step on this scale; if more directional shadows
appear, promote it to a named step here rather than adding a second arbitrary
value.

---

# 7. Spacing System

Only use the following spacing values:

4
8
12
16
24
32
48
64

No custom spacing values.

---

# 8. Motion

## Fast

150ms

Used for:

* Hover states
* Buttons

---

## Standard

250ms

Used for:

* Panels
* Navigation

---

## Slow

350ms

Used for:

* Dialogs
* Large transitions

Avoid excessive animation.

Motion should assist understanding.

---

# 9. Icons

Icon Library:
Lucide

Rules:

* Use standard Lucide icons.
* Do not create custom icon sets.
* Do not use decorative botanical icons.
* Maintain visual consistency.

---

# 10. Layout Rules

Every page should follow:

Page Title

Description

Primary Action

Content

---

Pages should prioritize:

1. Current student needs
2. Important information
3. Supporting information

---

# 11. Accessibility

Minimum Requirements:

* WCAG AA compliance
* Keyboard navigation support
* Focus states on all interactive elements
* Adequate color contrast
* Screen-reader compatibility

Accessibility is mandatory.

---

# 12. Future Expansion Rules

As AmazeCC grows:

* Prefer composition over creation.
* Extend existing patterns.
* Maintain consistency across all modules.
* Avoid feature-specific design languages.

Every new page should feel like part of the same product.

---

# Final Principle

If a design choice improves aesthetics but reduces usability:

Choose usability.

If a design choice improves consistency but reduces creativity:

Choose consistency.

Students use AmazeCC to accomplish tasks, not to admire the interface.
