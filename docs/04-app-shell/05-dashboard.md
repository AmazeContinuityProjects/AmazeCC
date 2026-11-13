---
title: "Dashboard.tsx (the shell under the gate)"
description: 'the app''s wiring hub — dynamic imports of every feature boundary, the global modals, semester switching, nav wiring. The word "dashboard" is a relic; it is the _shell_. Read once, with coffee…'
---

# Dashboard.tsx (the shell under the gate)

> **In one line:** the app's wiring hub — dynamic imports of every feature boundary, the global
> modals, semester switching, nav wiring. The word "dashboard" is a relic; it is the _shell_.
> **Read once, with coffee:** `src/components/custom/Dashboard.tsx` (~430 lines).

## Why it's smaller than you fear

It looks like a mess until you see the pattern: **one line per feature boundary**:

```tsx
const DashboardAttendanceFeature = dynamic(() => import("./dashboard/DashboardAttendanceFeature"), { loading: FeatureLoading });
…
<DashboardRoute route="attendance"><DashboardAttendanceFeature … /></DashboardRoute>
```

Everything else is props plumbing into those boundaries — settings, data atoms, fetch callbacks.
It resists extraction because anything it provides is needed _somewhere below_; extracting would
just move the prop-drilling into context machinery.

## Its three jobs (current truth — verify imports at HEAD)

1. **Mount feature boundaries** for home/attendance/academics/tools/hostel/utility routes/profile
2. **Own cross-feature modals** — `GradesModal`, `FeedbackStatusModal`
3. **Own cross-feature wiring** — `broadcastGlobalSemesterChange`, `mapToFinalSemesterId`,
   command-palette open state callbacks

## The wiring you will touch

- `setCurrSemesterID(val)` — settings + global semester broadcast (FFCS surfaces listen)
- `setGradesDisplayIsOpen` atom — the grades sheet from anywhere
- `onOpenFeedbackStatus` → opens `FeedbackStatusModal` (user-initiated FFCS sync — never on mount!)
- ⚠ History note: this file once auto-called `/api/ffcs` on mount to pre-warm the feedback
  badge — removed in the 2026-11 performance pass. Keep network off mount.

## The export

`export default memo(DashboardContent)` — prop-identity matters to the gate above it.

## Quiz

1. Why does this file exist if "the shell" is AuthenticatedWorkspace? Where's the seam?
2. What's the rule for where a new feature boundary goes (and where it doesn't)?
3. Name the two modals it owns and what triggers each.
