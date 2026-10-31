# Rollout: merge and deploy order

Faculty Reviews spans three repositories. **The flag is OFF in all of them by
default**, so merging and deploying any step below cannot change production
behaviour. Only step 6 does.

| Repo | Branch | Contains |
| --- | --- | --- |
| `AmazeCC-api` | `feature/faculty-reviews` | review routes, validation, `migrate_reviews.sql` |
| `AmazeCC` | `feature/faculty-reviews` | frontend UI **and** this Worker (`faculty-review/`) |
| `AmazeUI` | none | unchanged, no PR |

## Order, checks and rollback

| # | Step | Check | Rollback |
| --- | --- | --- | --- |
| 1 | **Supabase migration present.** Run `AmazeCC-api/migrate_reviews.sql` in the Supabase SQL editor (idempotent, safe to re-run; does not alter tables that already exist) | tables `faculty`, `enrollments`, `reviews`, `faculty_aggregates`, `unmatched_faculty` exist | additive; nothing to undo |
| 2 | **Worker to staging, then production.** Merge the `AmazeCC` PR, then follow DEPLOYMENT.md (resources, secrets, deploy) | `scripts/smoke-test.sh` passes on both | dashboard rollback to the previous version, or leave the flag off |
| 3 | **API deploys with the flag off.** Merge the `AmazeCC-api` PR; leave `ENABLE_AMAZE_REVIEWS` unset or `false`; set `REVIEWS_WORKER_URL`, `REVIEWS_INGEST_SECRET`, `REVIEW_HASH_SECRET` | `/api/reviews/submit` returns 503 JSON; existing endpoints unaffected | redeploy the previous API build |
| 4 | **Frontend deploys with the flag off.** `NEXT_PUBLIC_ENABLE_AMAZE_REVIEWS=false` (default); set `NEXT_PUBLIC_REVIEWS_API_URL` | no reviews nav, tab or modal; FFCS and vitfac review pills unchanged | redeploy the previous frontend build |
| 5 | **Smoke tests**, then **clean test data** (CLEANUP_STEPS.md) and populate the faculty catalog (`POST /api/reviews/sync-catalog` as an admin) | catalog shows "Not enough reviews yet" everywhere; a staging submission works end to end | restore from the pre-cleanup backup |
| 6 | **Flip the flag on**, in this order: Worker (dashboard var), then API env, then frontend build | first real review appears after the next recompute; vitfac still works | flip each back to off (Worker: dashboard, no deploy) |

Notes:

- The Worker and the API read their flag at runtime. The frontend flag is
  inlined at **build** time (`NEXT_PUBLIC_*`), so enabling or disabling the UI
  needs a rebuild and deploy of the frontend.
- Turn the flag on in the order above so the data path is ready before the UI is shown.
- Roll back in the reverse order. The fastest user-visible rollback is the
  Worker flag (reads and ingest return 503; the UI shows the legacy vitfac data).
- No step changes `vitfac.amazecc.com`.

## Merge commands

Nothing in this handover pushes. The maintainer runs the push and PR commands
printed in `_dev-archive/PR_DESCRIPTION.md` (local workspace, outside the repos),
in the order: `AmazeCC-api`, then `AmazeCC`.
