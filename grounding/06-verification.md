# 06 — Verification: Definition of Done for the Docs Rebuild

Run these checks per work package and a final full pass in WP-12. Where a script is given,
operators may implement it ad hoc (grep/node one-liners); the _claims_ below are what must
hold, not the letter of any command.

## V1 — Structural completeness (blocking)

- Every directory in `03-target-docs-structure.md` exists and contains a non-stub `README.md`.
- Every page named in `03` exists (or a `<!-- TODO(docs): -->` marker is explicitly listed in
  the WP report — zero markers allowed in WP-12).
- `docs/README.md` links to every top-level section; every section README links its pages.
- Orphan check: every `.md` under `docs/` is reachable from `docs/README.md` within 3 hops
  (excluding `docs/archive/`).

## V2 — Link & reference integrity

- Zero broken relative links under `docs/` (automate: `npx linkinator docs/ --recurse`,
  or a node script; GitHub-flavored anchors must resolve case-insensitively).
- No links into `node_modules/`, `.next/`, `out/`, `public/sw.js`, or non-public absolute paths.
- No links into `docs/archive/` except ones explicitly labeled "(historical)" or "design notes".
- Every `file.tsx:line` citation in docs points at an existing line range (spot-check 30
  random citations per WP).
- Grep sweeps post-rebuild: `grep -ri "src/app/api" docs --exclude-dir=archive` → empty;
  `grep -ri "HMAC token" docs --exclude-dir=archive` → empty; `grep -ri "this dashboard" docs`
  → manually reviewed (stale era vocabulary).

## V3 — Accuracy spot-checks (per WP)

1. **Commands:** paste every terminal command from the WP's pages into a clean shell in
   demo mode; each must succeed or carry an explicit "requires live VTOP" label.
2. **Env vars:** every `NEXT_PUBLIC_*` named in docs exists in `.env.example` or in a source
   grep (`git grep "NEXT_PUBLIC_"`) and is listed in `env-var-reference.md`.
3. **Atoms & keys:** `atom-catalog.md` rows == `git grep -o "[A-Za-z]*Atom" src/store | wc -l`
   count ± documented exceptions; `storage-key-catalog.md` rows == union of `KEYS` in
   `lib/storage.ts` + raw `localStorage.*` greps (documented technique).
4. **Routes:** every path in `routing/01-next-routes.md` maps to a real `page.tsx`;
   `scripts` mentioned in `scripts.md` all exist on disk.
5. **Network calls:** `network-calls-catalog.md` coverage — every `api(`, `apiRequest(`,
   `fetch(` call site under `src/` is catalogued (provide the exact grep used in the doc's
   footer, e.g. `git grep -n "apiRequest(" src` | wc -l = N and the N matches are indexed).
6. **Tests:** `suite-map.md` lists ≥204 entries (or notes retuned/renamed ones); counts match
   `git grep -l "\.test\.\(ts\|tsx\)" src/__tests__ | wc -l`.

## V4 — Staleness tripwires (grep for era-words)

Any occurrence outside `archive/` must be intentional and labeled:
`"HMAC token"`, `"src/app/api"`, "the dashboard cards", "StatsCards", "localhost:3000",
"HMAC-JWT"`, "redux", "midnight theme" (removed theme), "Next dev default port".

## V5 — The newbie test (WP-12 gate)

Recruit or simulate a reader with: no VTOP account, no Next.js knowledge. They must, from
docs alone: install, run demo mode, see the app, open DevTools, find the atoms in the console
(or storage), change one visible string, run one test file, and open a docs-only PR — without
asking the author anything. Document any failure point as a doc bug and fix it.

## V6 — CI still green

`pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build` all pass after the
rebuild (docs must not be imported by code; only risk is husky/lint-staged markdown churn).

## V7 — Coverage sign-off

`09-coverage-checklist.md` — every box ticked; two independent passes (author + reviewer).
Any unticked box needs an explicit waiver written in the checklist file (e.g. "intentionally
documented in external repo").

## Metrics to report at the end

- File count of `docs/` (excluding archive), words, longest page, orphan count (goal: 0).
- Coverage: routes documented (X/X), feature folders complete (26/26), lib modules cataloged,
  suites mapped, env vars cataloged, atoms cataloged.
- Open `TODO(docs)` markers (goal: 0).
