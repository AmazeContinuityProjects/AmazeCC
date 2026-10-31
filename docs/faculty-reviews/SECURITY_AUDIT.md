# Security audit: Faculty Reviews (frontend and Worker)

Scope: `src/lib/reviewsService.ts`, `src/components/custom/reviews/*`,
`src/lib/sync-engine/operations.ts` (reviews hook), and the Cloudflare Worker in
`faculty-review/`. The API side is in `AmazeCC-api/docs/SECURITY_AUDIT.md`.
Audit date 2026-10-31, branch `feature/faculty-reviews`.

No secret values appear in this document. Ratings: Critical, High, Medium, Low.

## 1. Summary

| Severity | Open | Fixed in this branch |
| --- | --- | --- |
| Critical | 0 | 3 |
| High | 3 (need a maintainer decision) | 6 |
| Medium | 9 | 0 |
| Low | 5 | 0 |

### Fixed (Critical and High, in small separate commits)

| ID | Sev | Finding | Fix (commit subject) |
| --- | --- | --- | --- |
| F1 | Critical | Identity (`authorizedID`) sent in a URL query string, so it lands in proxy, CDN and access logs | header only (`fix(reviews): default-off flag gating and identity privacy...`) |
| F2 | Critical | Person-specific hardcoded id mapping in the client (one developer's identifiers resolved to a third student's registration number), so one user could file reviews as another | mapping removed; `getStudentAuthorizedId()` returns `""` when unauthenticated |
| F3 | Critical | Feature flag defaulted ON in the client (`flag \|\| true`) | strict opt-in, default off |
| F4 | High | With the flag off, an unrelated attendance sync still posted identity and the full timetable to the reviews API (`src/lib/sync-engine/operations.ts:96`) | gated by the flag |
| F5 | High | Worker: ingest trusted any HMAC-valid body with no schema validation, so a leaked secret could place arbitrary data or free text in the queue and database | `validateIngestMessage` (`src/validation/ingest.ts`); unknown fields dropped; tests prove no free text survives |
| F6 | High | Worker: a Supabase read failure returned a truncated list and the cron then overwrote good snapshots with empty ones (public catalog blanked during an outage) | reads throw; cron logs `aggregation_failed` and fails visibly |
| F7 | High | Worker: queue consumer used `merge-duplicates`, which cannot target the `COALESCE()` unique index, so every message for a row the API already wrote would unique-violate and dead-letter; a replay could also overwrite a student's later edit | `resolution=ignore-duplicates` |
| F8 | High | Worker: a PostgREST error body (which can echo row values such as the reviewer hash) was written to logs | status and error code only |
| F9 | High | Frontend `fetch-utils.ts` change altered API failover for the whole app and broke 28 tests | restored to `main` |

### Open: High, maintainer decision needed

| ID | Finding | Where | Impact | Suggested fix |
| --- | --- | --- | --- | --- |
| H1 | **Identity is client-asserted.** `x-authorized-id` is whatever the browser sends; the API cannot tell a real student from someone who knows a registration number. App-wide, not only reviews | `AmazeCC-api/src/lib/reviews/reviewAuth.ts` | impersonation, brigading, forged eligibility (see H2) | bind identity to a server-issued session or signed token created at VTOP login, and hash that subject; this is an app-wide auth decision |
| H2 | **Enrollment (eligibility) is client-asserted.** `POST /api/reviews/enrollment-snapshot` records whatever timetable the client sends; Teaching eligibility then trusts those rows | `AmazeCC-api/src/lib/reviews/recordEnrollments.ts`, `.../enrollment-snapshot/route.ts` | anyone can self-grant "verified" eligibility for any faculty. Mitigated (caps, shape checks, rate limit) but not solvable without server-side VTOP verification | derive enrollments server-side from the VTOP session, or mark client-sourced enrollments as unverified and weight them as such |
| H3 | **Small-sample de-anonymisation.** `minReviewsToShowGrade` is 1, and per-question averages, style averages and per-course aggregates are published from the first review. With one enrolled student in a niche course, the published numbers are that student's ratings | `src/config/reviewQuestions.ts:345`, `faculty-review/src/aggregation/engine.ts:182-215` | a single reviewer's answers can be attributed by anyone who knows the course roster | publish per-question, style and per-course detail only when `n >= 3` (k-anonymity), raise `minReviewsToShowGrade`, and apply the change in all three copies of the config (see CONTRACTS.md) |

## 2. Secrets (working tree and full git history)

- Tools: `gitleaks` and `trufflehog` are not installed here. Used regex history
  search (`git log --all -G<pattern>`) over every commit of each repo for private
  keys, JWTs, Supabase-style secret tokens, AWS keys, credentialed database URLs
  and `*SECRET/PASSWORD/TOKEN/API_KEY = <24+ chars>` assignments. Values were never printed.
- `AmazeCC` (1,181 commits): **no matches**. `AmazeUI` (62): no matches.
  `AmazeCC-api` (130): two matches, both in `.env.example` and both placeholder
  database URLs (`REPLACE_ME` host and user).
- Working trees: clean for all three repos.
- **Real identifiers in history:** a developer-specific registration number appeared as
  a test fixture in earlier commits of `AmazeCC-api`'s unpushed `feature/faculty-reviews`
  branch. It is removed from the tree but remains in those local commits. A registration
  number is personal data, not a credential. Squashing the branch before the first push
  is the maintainer's choice (this handover never rewrites history).
- **Rotate before pushing:** nothing was found that must be rotated *because of the repos*.
  The root `.env` (not opened) lives outside every repo and is not committed. Because
  the earlier dev setup used real Supabase and Cloudflare accounts, issue **fresh**
  `REVIEWS_INGEST_SECRET`, `REVIEW_HASH_SECRET` and a new Cloudflare token for the
  maintainer's accounts rather than reusing any development value.

## 3. Authentication and authorisation

| Check | Result |
| --- | --- |
| `authorizedID` on every write path | Required on submit and enrollment-snapshot; **client-asserted (H1)** |
| Teaching eligibility server-side | Enforced in the API (enrollment row required), but enrollment rows are client-sourced (H2) |
| Project eligibility | No proof exists, so project reviews are always stored `verified = false` (fixed) |
| Admin routes | All `/api/admin/reviews/*` call `requireAdminAuth`; `sync-catalog` was anonymous and now requires it (fixed). The client allowlist `NEXT_PUBLIC_REVIEW_ADMIN_IDS` is UX only |
| Ingest HMAC | `HMAC-SHA256(secret, "<timestamp>.<raw body>")`; body is signed; +/- 5 minute window; constant-time hex compare; dual-secret rotation. **No nonce store**, so a captured request can be replayed inside the 5 minute window; harmless because ingest is idempotent (`ignore-duplicates`) and the window is short (Medium M1) |
| `/internal/recompute` | HMAC protected, same secret; does a full read, so it is also rate limited in the dashboard (DEPLOYMENT.md section 5) |

## 4. Validation and the no-free-text proof

- The API rejects unknown top-level and `context` keys, validates answers against
  the question config (integers 1 to 5, known ids), tags against the approved lists
  (max 3 each), `context` values and `project_term` against approved option lists,
  and `course_code`/`semester` against identifier patterns.
- The Worker re-validates (`src/validation/ingest.ts`) and rebuilds the message
  from validated parts, so unknown fields never reach the queue or Supabase.
- Database columns: `reviews.answers` (validated ints), `tags_*` (allowlist), `context`
  (allowlisted keys and values), `course_code`, `semester`, `project_term` (patterns or
  option lists), `grade_bucket` (enum). No column can hold prose.
- Proof by test: `AmazeCC-api/.../hardening.test.ts` (unknown fields, free text in every
  slot), `faculty-review/src/__tests__/ingestValidation.test.ts` (including an end-to-end
  test that a smuggled `comment` never appears in the enqueued message).
- Remaining client-controlled text that does reach the public catalog:
  **faculty names auto-provisioned from a client timetable**
  (`recordEnrollments.ts:142`). They are now length and character limited
  (`enrollmentInput.ts`) but still originate from the client (Medium M2).

## 5. Anonymity

- Reviewer identity is stored only as `HMAC-SHA256(REVIEW_HASH_SECRET, id)`.
  `student_hash` is never in a snapshot, a log line or an error message (log keys are
  scrubbed; Supabase error bodies are no longer logged).
- Snapshots contain aggregates only. Distributions appear at `n >= 5`, tags at `>= 3`
  votes. **Grades, averages and per-course detail appear from `n = 1` (H3).**
- Timing: `created_at` is used only for `updated_at` (latest review time per faculty).
  A faculty `updated_at` that changes right after a known student's submission reveals
  that a review arrived, not whose it was (Low L1).
- Logged-out users can read the catalog and profiles (they are public by design).
  Raw reviews, enrollments and `grade_bucket` are never exposed publicly.

## 6. Abuse resistance

- Rate limits: API per-student limiter (10 submits per 5 minutes) is **in-memory per
  server instance** (Medium M3), so it is bypassed by rotating ids (H1) or by scaling
  out. Add the WAF rules in DEPLOYMENT.md section 5.
- Idempotency: unique index on `(student_hash, faculty, track, course, semester, term)`;
  the Worker insert is `ignore-duplicates`; duplicate submits update within a 14-day
  edit window and are locked afterwards.
- Cost exhaustion: the per-submit recompute was removed (reads every row). Recompute
  now happens on the 10-minute cron or by an admin/HMAC call. Queue flooding is bounded
  by the HMAC requirement (only the API can enqueue) plus the rate limits.
- Brigading and sybil: bounded only by H1/H2. Project reviews are unverified (weight 0.7).

## 7. Database (review only; nothing changed)

- `migrate_reviews.sql` enables RLS on all five tables. Public `SELECT` policies exist
  for `faculty` (non-hidden) and `faculty_aggregates`; raw `reviews` and `enrollments`
  have no anon policy (default deny). A `service_role` policy block exists.
- The API uses pooled Postgres credentials (server-side) and the Worker uses the
  service-role key over HTTPS; the key never reaches a browser.
- Indexes cover the unique submission key and the common lookups.
- Finding (Low L2): `faculty_aggregates` is publicly readable via PostgREST with the
  anon key and holds per-question detail from `n = 1`, i.e. H3 also applies directly
  against Supabase, not only through the Worker. Fix with the same k-threshold, or
  remove the anon `SELECT` policy (a schema/RLS change, so left to the maintainer).
- Finding (Low L3): the migration creates `service_role` policies that Supabase
  service-role connections bypass anyway; harmless.

## 8. Web and edge security

- CORS: allowlist of AmazeCC origins plus localhost (for development), `Vary: Origin` always
  set; internal routes answer `OPTIONS` with 405. API review routes answer `OPTIONS`
  with `Access-Control-Allow-Origin: *` (Medium M4: the API uses a header, not cookies, so
  this is not credentialed, but it should follow the same allowlist).
- Security headers on every Worker response: `X-Content-Type-Options`, `X-Frame-Options: DENY`,
  `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`. No CSP is needed on
  a JSON-only Worker; the Next.js app's CSP is outside this feature.
- SSRF: no review route fetches a user-supplied URL. Outbound calls go to `REVIEWS_WORKER_URL`
  (env) and a fixed `vitfac.amazecc.com/faculty` URL. `upstreamUrl.ts` is not used by this feature.
- Injection: all SQL is parameterised; PostgREST filters use fixed paths. The profile route
  validates ids against `^[A-Za-z0-9-]{1,64}$`.
- Error leakage: the Worker returns a generic 500 with a request id; stack traces are never returned.
- XSS: no `dangerouslySetInnerHTML` or `innerHTML` in the reviews UI. Medium M5: the admin token
  is pasted into `sessionStorage` (`AdminFacultyModal.tsx:56,101`), where any XSS could read it.

## 9. Dependencies (`pnpm audit`, 2026-10-31)

| Project | Result |
| --- | --- |
| `faculty-review/` | **No known vulnerabilities** after upgrading `wrangler` to 4.x and `vitest` to 4.x (was 3 critical, 12 high, all dev tooling) |
| `AmazeCC` (prod deps) | 52 advisories: 1 critical (`dompurify` via `jspdf`), 33 high (`@xmldom/xmldom`, `brace-expansion`, `image-size`, `undici`, `follow-redirects`, `zod`, `multer`, `body-parser`, `@opennextjs/cloudflare`), 15 moderate, 3 low. **Pre-existing and app-wide; not in the reviews feature, so not changed here** (High M6) |
| `AmazeCC-api` (prod deps) | 22 advisories: 7 high (`undici`, `follow-redirects`), 12 moderate, 3 low. Same: out of scope, reported |

Suggested fix for the two app repos: bump the `pnpm-workspace.yaml` `overrides` (the `undici`
override pins `7.29.1`, below the patched `7.30.1`) and run `pnpm up` for the rest.
Lockfiles are present and committed for all three projects.

## 10. Cloudflare configuration

- Routes are exact custom domains (`reviews-api.amazecc.com`, `reviews-api-staging.amazecc.com`)
  with `custom_domain: true`; no wildcard route can capture `vitfac.amazecc.com`; `workers_dev` is
  false in every environment.
- KV and R2 are bound to the Worker only; no public bucket domain or `r2.dev` access is configured.
- Secrets are never in `vars`; `ENABLE_AMAZE_REVIEWS` and `READ_ONLY_MODE` are intentionally
  dashboard-owned (`keep_vars`). A dead-letter queue exists for both environments.
- Internal routes are protected by HMAC and are not CORS-exposed.
- Cron failure alerting: Cloudflare has no native per-cron failure alert. The cron now rethrows,
  so failures are visible as failed invocations and as `aggregation_failed` logs; alert on that
  (RUNBOOK section 1) (Low L4).

## 11. Medium and Low (reported, not changed)

| ID | Sev | Finding | Location | Suggested fix |
| --- | --- | --- | --- | --- |
| M1 | Medium | No replay nonce on ingest (5 minute window) | `faculty-review/src/index.ts` `verifyHmacWithSecret` | optional: store seen signatures in KV for 10 minutes |
| M2 | Medium | Faculty rows auto-provisioned from client text | `recordEnrollments.ts:142` | send unknown faculty to `unmatched_faculty` for admin review instead |
| M3 | Medium | In-memory rate limiter is per instance | `AmazeCC-api/src/lib/rateLimit.ts` | WAF rate rules or a shared store |
| M4 | Medium | `OPTIONS` returns `ACAO: *` on review routes | API `eligibility`, `submit`, `enrollment-snapshot` | reuse the origin allowlist |
| M5 | Medium | Admin token stored in `sessionStorage` | `AdminFacultyModal.tsx:56,101` | in-memory only, or an httpOnly cookie |
| M6 | Medium | Vulnerable production dependencies in the app repos | `AmazeCC`, `AmazeCC-api` lockfiles | see section 9 |
| M7 | Medium | Hardcoded `FALL2026-27` defaults | `operations.ts:104`, `FacultyReviewsTab.tsx:239`, `WriteReviewModal.tsx:84`, API `recordEnrollments.ts:49` | derive from `semesterTiming` |
| M8 | Medium | Hardcoded Supabase project host in public image URLs | `reviewsService.ts:140`, `FacultyAvatar.tsx:131`, API `sync-catalog/route.ts:62` | move to config; confirm the project is the maintainer's |
| M9 | Medium | `verified` for Teaching rests on client-sourced enrollments | see H2 | see H2 |
| L1 | Low | Faculty `updated_at` leaks that a review arrived | `engine.ts` | quantise to the day |
| L2 | Low | `faculty_aggregates` readable by anon with detail from n = 1 | migration RLS | see section 7 |
| L3 | Low | Redundant `service_role` policies | migration | none |
| L4 | Low | No native cron-failure alert | Cloudflare | log alert |
| L5 | Low | `introSong` logs `authorizedID` (pre-existing, outside reviews) | app | hash or remove |
