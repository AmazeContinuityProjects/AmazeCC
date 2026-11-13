# 10 — Visual & Accessibility Assertions

> **In one line:** we assert roles, accessible names, and aria attrs — not pixels and not CSS classes.

- `a11yClickable.test.tsx` — fake `<div onClick>`s must behave like buttons: role, keydown, focus
- `role="dialog"`, `aria-modal`, `aria-labelledby` on BottomSheet; focus trap asserted in `BottomSheet.test.tsx`
- `aria-live="polite"` on toast region (screen readers announce errors without looking)
- color-alone indicators banned: tone maps always pair label + color (10 status chips use text too)
- Touch targets ≥ 44×44 (SettingRow and SegmentedControl do this via padding)
