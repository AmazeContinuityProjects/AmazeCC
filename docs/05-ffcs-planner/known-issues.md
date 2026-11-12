# FFCS Planner — Known Issues & Sharp Edges

> Read this before filing a bug here; half of these are intended behavior.

1. **Slot-token drift.** New slot tokens (`S5`, `S11`, …) arrive with every semester. The
   vocabulary lives in `slots.ts`; if VTOP starts spelling a slot differently, the grid renders
   nothing without error — add the token and a test; do not hand-patch screens.

2. **`ffcsReport.csv` ≠ the live registration page.** It's the _printed_ report when VIT last
   printed it. A student with a stale CSV sees stale sections; adding the `winter mock` file
   solved the mid-season case but the fix remains: reload the file from the current printing
   when sections shift (register page ≠ hourly CSV).

3. **Timetables can go weird after semester switch** if any surface writes semester-hardcoded
   state — the semester broadcast (`broadcastGlobalSemesterChange`) is the sanctioned path.

4. **Drop-ladder UX misfire** (guidance): when the generator drops a course per user-approved
   policy, the UI explains which course was dropped — keep explanations in terms of
   `coursesSatisfy` rules, not internals.

5. **Share payload drift** — older shared links die loudly if `FFCS_SHARE_VERSION` bumps without
   a compat window. If you increase the version, decide deliberately.

6. **SW precache exclusions** — CSV fetches in the planner are runtime-cache, not precache;
   first-ever offline session after install never had a chance to download them.

7. **Targeted `.split()` on CSV rows** — some report lines have embedded commas inside quotes;
   `ffcsReports.ts` parses properly, but ad-hoc `split(",")` anywhere else will silently corrupt.
   Don't.

8. **Guided mode memory** — on low-RAM Androids, >8k candidates can trigger worker OOM-ish stalls;
   the generator caps candidate volume by default (`HARD_RESULT_LIMIT`); respect it.

## Quiz

1. A course that exists on VTOP doesn't appear in search results — what's the _first_ thing to check?
2. What happens to saved week state when a student flips Fall → Winter and back?
