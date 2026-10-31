# ROLLOUT — Faculty Reviews production merge & deploy order

The authoritative merge/deploy order for go-live, with the rollback for each
step. Flags stay OFF in every repo until step 6 — merging cannot change
production behaviour.

## Merge and deploy order

| Step | What | Land in | Checks | Rollback |
| --- | --- | --- | --- | --- |
| 1 | Supabase migration present | `AmazeCC-api` repo (`migrate_reviews.sql`, idempotent `IF NOT EXISTS`; safe to re-run against prod where tables already exist) | run once; verify tables exist; do NOT modify schema/RLS | migration is additive — no rollback needed |
| 2 | Worker to staging then production | `AmazeCC` repo, `faculty-review/` (staging, then production) | smoke tests in `faculty-review/docs/DEPLOYMENT.md` §6; reads 503 + unsigned ingest 401 (flag OFF) | disable route or rollback Worker version |
| 3 | API deploys with the flag OFF | `AmazeCC-api` repo (`ENABLE_AMAZE_REVIEWS=false`) | `/api/reviews/submit` 503/disabled; existing API unaffected | redeploy previous API image; flag stays off |
| 4 | Frontend deploys with the flag OFF | `AmazeCC` repo (`NEXT_PUBLIC_ENABLE_AMAZE_REVIEWS=false`) | `faculty-reviews` tab absent; FFCS/vitfac pills unchanged | redeploy previous frontend |
| 5 | Smoke tests | all | catalog read when flag on, unsigned ingest 401, submit round-trip on staging | — |
| 6 | Flip the flag ON | Worker `ENABLE_AMAZE_REVIEWS="true"` (dashboard), API env, frontend env | verify first reviews appear; vitfac pills coexist per `hybrid` mode | flip env back to `false` (per repo or globally); no deploy needed for the Worker |

## Detailed steps

1. **Merge order**: `AmazeCC-api` (migration + review API), then `AmazeCC`
   (frontend + faculty-review worker). No order dependency exists for
   `AmazeUI` (untouched).
2. **Worker first**: staging deploy → custom domain OK → DLQ OK → then
   production deploy. Both with flags off.
3. **Then API** (`REVIEWS_WORKER_URL=https://reviews-api.amazecc.com`,
   `REVIEWS_INGEST_SECRET=<same as worker>`, `ENABLE_AMAZE_REVIEWS=false`).
4. **Then frontend** (`NEXT_PUBLIC_REVIEWS_API_URL=https://reviews-api.amazecc.com`,
   `NEXT_PUBLIC_ENABLE_AMAZE_REVIEWS=false` everywhere).
5. **Flag flip (step 6)** is the ONLY step that changes user-visible behaviour:
   - Worker dashboard var `ENABLE_AMAZE_REVIEWS="true"`,
   - API `ENABLE_AMAZE_REVIEWS=true` (redeploy env),
   - Frontend `NEXT_PUBLIC_ENABLE_AMAZE_REVIEWS=true` (rebuild).
   Enable in that order (worker → api → frontend) so the edge cache is warm
   before the UI surfaces.

## PR descriptions

Per-repo PR bodies live in `_dev-archive/PR_DESCRIPTION.md` (workspace level)
with the exact push/PR commands and merge order. **Nobody pushes as part of
this handover** — the maintainer runs the printed commands.
