# Code review: Faculty Reviews (frontend and Worker)

Branch `feature/faculty-reviews`, 2026-10-31. Covers `src/components/custom/reviews/*`,
`src/lib/reviewsService.ts`, the FFCS/vitfac touch points, and `faculty-review/`.
Items marked **fixed** were changed in this branch; the rest are reported only.

## 1. Correctness

### Aggregation (`faculty-review/src/aggregation/engine.ts`)

| Item | Result |
| --- | --- |
| Per-review score | question-weighted mean, weights re-normalised per component; `1.0` to `5.0` |
| Weights | verified 1.0 / unverified 0.5 (teaching), 1.0 / 0.7 (project); recency half-life 4 semesters (0.5^(age/180 days / 4)) |
| Shrinkage | `n_eff/(n_eff+8)*mean + 8/(n_eff+8)*prior` (priors 3.65 and 3.75) |
| Outlier trim | 5% each end when `n >= 20` |
| Minimum reviews | **`minReviewsToShowGrade = 1`** and "Early" for 1 to 7 reviews. `types.ts` still comments "null if n_eff < 3" and "3 <= n_eff <= 7": the comments disagree with the config (Medium W1). The k-anonymity consequence is High H3 in SECURITY_AUDIT.md |
| Threshold uses | `n_reviews` (a count), not `n_eff`; a stack of old unverified reviews can show a grade (Low W2) |
| Distributions and tags | distributions at `>= 5` answers, tags at `>= 3` votes: correct |
| Per-question averages | use all reviews, while the headline grade uses the trimmed pool. Inconsistent at `n >= 20` (Low W3) |
| Time | recency uses `Date.now()` inside the pure function, so output is not strictly reproducible: the weights decay continuously (half-life about 2 years of 180-day semesters), so a rounded grade eventually ticks over (Low W4) |
| Write-diffing | **proven**: zero writes on a repeat run, and zero writes one cron interval (10 minutes) later with reviews present (`aggregation.test.ts`). Only when decay pushes a value across a rounding boundary does a snapshot rewrite, which is a few keys at most per day |

**W4 detail.** Optional hardening: compute recency against a stored `as_of` date (for
example the start of the day) so every run within a day is identical and snapshot
churn is exactly zero when no review changed.

### Queue consumer and cron

- Consumer: batch of up to 25, `ack` on success, `retryAll` on failure, 3 retries then the DLQ. The insert is
  `ignore-duplicates` (**fixed**, was `merge-duplicates`, which would unique-violate for every row the API
  already wrote).
- Cron: reads are strict now (**fixed**: a failed read used to publish empty snapshots).
  `MAX_KV_WRITES_PER_RUN` truncates silently: a run that hits the cap writes the catalog first and
  leaves the rest for the next run; it does not log that it was capped (Low W5).
- The queue consumer does not check `ENABLE_AMAZE_REVIEWS` or `READ_ONLY_MODE`, so messages already
  queued still apply while the flag is off. This is intentional (they were accepted while on) but should be known.

### Frontend logic

- Eligibility fetch uses the header only (**fixed**); `getStudentAuthorizedId()` returns `""` when unauthenticated (**fixed**).
- Flag default off in the client (**fixed**).
- Hardcoded `FALL2026-27` in `operations.ts:104`, `FacultyReviewsTab.tsx:239`, `WriteReviewModal.tsx:84` (Medium W6).
- A "verified" badge can show from a fallback enrollment built locally (`FacultyReviewsTab.tsx` around 225 to 240) when the
  server has none; the server still rejects the submit, so this is a UI-only misrepresentation (Medium W7).
- `project_term` is `"<semester> <project type>"`, so two projects of the same type in a semester collide on the
  unique key and the second overwrites the first within the edit window (Medium W8).
- Name-collision fallback in `vitfacService.ts` (`resolveVitfacId`) can match two faculty with the same normalised name (Medium W9).

## 2. Maintainability

| Item | Finding |
| --- | --- |
| File size | `FacultyReviewsTab.tsx` 1,280 lines, `WriteReviewModal.tsx` 1,047, `AdminFacultyModal.tsx` 805: split view, data and form logic (Medium W10) |
| Duplicated config | the question config exists in three repos by design; guarded by the fingerprint test |
| Duplicated logic | `normalizeFacultyName` in three API files; catalog fetch endpoints list repeated in `reviewsService.ts` |
| Unused code | `PROFILE_ID_PATTERN` etc. fine; `REVIEWS_QUEUE` and the `AMAZE_REVIEWS_KV/R2` and `SNAPSHOT_BUCKET` binding aliases in `types.ts` and the store factory are unused by the shipped config (the canonical names are `REVIEWS_SNAPSHOTS`, `REVIEWS_BUCKET`, `amazecc_reviews_queue`); remove the aliases once nothing depends on them (Low W11) |
| Magic numbers | cache TTL (now `CACHE_TTL_SECONDS` / `CACHE_SWR_SECONDS`), 6 s and 4 s fetch timeouts, catalog TTL: partly config |
| Naming | mixed `snake_case` (API and snapshots) and `camelCase` (UI) at the mapping layer is deliberate |
| Leftovers | `key={i}` list keys in the review UI (Low W12); console logging in `FacultyReviewsTab.tsx:181` on error only |
| Stray files | none in the repos. Developer patch and scratch scripts were archived outside them |

## 3. Types and tests

- `any` in the feature: `SnapshotStore.ts` (KV/R2 duck-typing in the factory) and the API handlers. Justified in the factory
  (it distinguishes a test double from a real binding); the rest is Low W13.
- Worker tests (67): aggregation math and diffing, `SnapshotStore` contract on **memory, KV and R2** (`store.test.ts`),
  factory selection, HMAC verification (valid, wrong secret, stale, previous secret), flag and read-only gating, CORS,
  security headers, health, cache TTLs, ingest validation with the no-free-text proof, consumer write semantics, cron
  failure behaviour, question-config fingerprint.
- Frontend: 125 test files pass, including `reviewsSchemaContract` and `reviewQuestionConfigDrift`. There is **no component
  test for the reviews UI** (loading, empty, error) (Medium W14).
- Write-diffing: tested with and without reviews, including a 10-minute clock advance.

## 4. Frontend states, themes, mobile, accessibility

| Check | Result |
| --- | --- |
| Loading | skeleton and `loading` state in the catalog and eligibility panels |
| Error and degraded | a visible banner ("Unable to connect to edge reviews catalog. Showing cached data if available."); falls back to sessionStorage cache, then legacy vitfac |
| Empty | "Not enough reviews yet" style states in the catalog |
| Flag off | `/reviews` renders "Page not available" and redirects home; nav, tools, mobile home and command-palette entries are hidden; no request is made to the reviews API; existing FFCS and vitfac review pills are unchanged (the vitfac fallback is the pre-existing path) |
| Themes | uses `dark:` variants and the shared `ThemeToggle`; the three AmazeUI themes were not visually re-verified in this environment (no browser available) |
| Mobile | responsive classes throughout (`sm:` breakpoints); not device-tested here |
| Accessibility | only 2 `aria-*` / `role` attributes across the four review components (Medium W15): icon buttons, modals and the rating controls need labels, `role="dialog"`/focus handling and keyboard support |

## 5. Performance and bundle

- Reads never hit Postgres: the Worker serves published snapshots; the API falls back to Postgres only when the Worker is down.
  Cache headers (`max-age`, `stale-while-revalidate`, `ETag`/304, `Vary: Origin`) are covered by tests.
- Bundle impact, measured on clean builds of `main` and the branch: total static JS **6,102 KB to 6,213 KB raw
  (+111 KB, +1.8%)** and **1,813 KB to 1,842 KB gzip (+29 KB, +1.6%)**; 161 to 167 chunk files. The new `/reviews` route is
  statically prerendered.
- Worker bundle: about 50 KB (12 KB gzip), no runtime dependencies.

## 6. Verification (clean checkout of the local commits, no `.env`)

| Project | install | typecheck | lint | test | build |
| --- | --- | --- | --- | --- | --- |
| `faculty-review/` | pass | pass | pass (`tsc --strict`) | pass (67) | pass (dry run, placeholders unset) |
| `AmazeCC` | pass | pass | pass (0 errors, 141 pre-existing warnings) | 124 of 125 files in the clean run; see below | pass |

Frontend tests: one file (`ffcs-generate-stream`, a 30,000-result stress test) timed out at the
5 s default in the full parallel run on this machine; it passes alone and other heavy FFCS render
tests flaked the same way across runs. The same files pass on `main` in isolation. This is load
sensitivity of the existing FFCS suite, unrelated to reviews (Low W16: raise their timeouts).
