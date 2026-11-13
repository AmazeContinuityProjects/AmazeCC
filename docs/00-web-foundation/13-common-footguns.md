---
title: "Footguns & Fumes (read before you type)"
description: "the thirteen sharp edges this codebase carries, and how to step around each."
---

# 13 — Footguns & Fumes (read before you type)

> **In one line:** the thirteen sharp edges this codebase carries, and how to step around each.
> **Audience:** everyone. **Reading time:** ~10 min.

1. **`"use client"` everywhere (and for good reason).** Server components can't touch
   localStorage/VTOP state. Don't convert files just because they _could_ be server components
   unless you verified they really are static.

2. **Hydration mismatch.** The root layout inlines a script that reads localStorage
   **before React boots** and adds `class="has-stored-session"`. If you make a different
   decision during server render than during first paint, React replaces the DOM and the user
   sees a flicker/error. Rule: render from _client state only_ until mounted
   (`useAppBootstrap` pattern), and test on cold load.

3. **`useEffect` double-fire.** In dev with StrictMode, effects re-run; screens that _open a
   fetch on mount without a cancel guard_ will hit the API twice. Always `let cancelled = false`
   - cleanup (see `Dashboard.tsx` history) — and never assume cache hits hide this.

4. **`output: "export"` ≠ your laptop.** Static hosting has no redirects; `/ffcs` without a
   trailing slash 404s; assets always end in `/`. Keep links consistent with `trailingSlash`.

5. **`localStorage` is global and dirty.** Hundreds of keys (see the catalog in
   `07-data-layer/03-local-storage-key-catalog.md`). When in doubt, prefix with a feature
   namespace (`ffcs_*`, `cache_*`) or use `storage.ts` instead of raw `localStorage`.

6. **StrictNullChecks is off — be your own compiler.** Add `?.`/`??` even when the type says
   it's fine; VTOP payloads lie.

7. **`atom(read)` migration shims.** `settingsAtom` merges stored values with new defaults on
   read — tests rely on the merge, and deleting a default key silently re-adds it. Read
   `settingsAtoms.ts` before touching it.

8. **The `Intl` locale trap.** Semester strings like `CH20262705` are _parsed_, not displayed,
   everywhere; "winter/fall" labels come from `formatSemesterName.ts` — don't re-implement.

9. **FFCS slots are a closed vocabulary.** `slots.ts` is the only allowed slot list; hand-typed
   `"A1"` variants that don't exist will render nothing and pass tests… until a student with a
   lab slot reports it.

10. **Big files are big for a reason.** `FFCSGuidedSelector.tsx` (~5,100 lines) is load-bearing;
    split it only with a test net around it (it has suites — run them).

11. **The service worker can serve stale files forever.** After a deploy, students may have old
    HTML pointing at deleted chunks — `chunkRecovery.ts` exists for this; don't remove its
    counter-hygiene (no disable flags) without reading why.

12. **`date` objects and timezones.** `toDateString()`/`dateKey()` functions disagree with
    JSON-serialized dates; all calendar math lives in `calendarDay.ts` — use it rather than
    hand-rolling `new Date()` comparisons.

13. **No secrets, ever.** Demo mode password (`demo`…"demoData.json") is public by design;
    everything else secret lives in the API repo. If you discover a real credential in this repo,
    stop and report it as an incident, not a PR.
