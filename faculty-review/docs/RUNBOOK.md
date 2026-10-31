# Runbook: Faculty Reviews Worker

Day-2 operations. Deployment is in [DEPLOYMENT.md](./DEPLOYMENT.md); the merge and
deploy order is in [ROLLOUT.md](./ROLLOUT.md).

## 0. How the pieces fit (read once)

- The **API** (`AmazeCC-api`) validates a submission, checks eligibility, writes the
  review **directly to Postgres**, then sends a signed copy to the Worker's
  `/internal/ingest`. The Worker validates it again and puts it on the queue; the
  consumer upserts it into Postgres (idempotent: same unique key).
- Because the API already wrote the row, **a lost or dead-lettered queue message
  does not lose a review**. It only means the redundant upsert did not run.
- **Reads never touch Postgres.** Public reads are served from published snapshots
  (KV or R2). Snapshots are rebuilt by the cron (every 10 minutes) or by
  `POST /internal/recompute`.

## 1. Monitoring and alerts

Workers Logs are on (`observability.enabled: true`). Open Workers, the Worker,
Logs. Every line is structured JSON; identifiers, reviewer hashes, tokens, request
bodies, answers and tags are never logged (enforced by the log sanitizer, and
PostgREST error bodies are reduced to a status and error code).

Events to watch:

| Event / field | Meaning |
| --- | --- |
| `job: "queue_consumer"` with `level: "error"` | batch upsert failed; messages retry up to `max_retries` then dead-letter |
| `event: "aggregation_failed"` | cron or recompute failed; snapshots are stale |
| aggregation summary (written / skipped counts) | `written: 0` on an idle system is **correct** (write-diffing) |
| `status: 401` on `/internal/ingest` | bad or expired signature. A spike means a secret mismatch or probing |
| `status: 503` | flag off or read-only mode (expected while off) |

Alerts to create (dashboard, Notifications): Worker error rate, queue backlog and
dead-letter growth where offered, and a billing threshold. Cloudflare has no native
"cron failed" alert, so set a Logs-based alert on `aggregation_failed` if your plan
supports it, and otherwise use the weekly checklist (section 8).

## 2. Dead-letter queue

- Queues: `amazecc-reviews-dlq` (production), `amazecc-reviews-dlq-staging`.
  A message lands there after `max_retries` (3) failed consumer attempts.
- Without a consumer, dead-lettered messages **persist for 4 days** and are then
  deleted. A DLQ is an ordinary queue: it is inspected and drained by attaching a
  consumer to it.
- **Inspect**: Dashboard, Queues, the DLQ: backlog count and metrics. To read the
  messages, attach a temporary consumer Worker (or an HTTP pull consumer) to the DLQ
  and log only counts, never message bodies.
- **Triage**: look at `queue_consumer` errors. The usual causes are an expired or
  rotated `SUPABASE_SERVICE_ROLE_KEY` (401) or a Supabase outage (5xx).
- **Recover** (do in this order):
  1. Fix the cause (e.g. set the correct Supabase secret).
  2. Run `POST /internal/recompute` (signed, see CLEANUP_STEPS.md section 4). It
     rebuilds snapshots from Postgres, which already holds every review the API wrote.
  3. If you want the DLQ messages applied too, attach a consumer that re-sends them
     to `amazecc-reviews-queue`; upserts are idempotent, so replays are safe.
  4. Confirm the DLQ backlog is 0.

## 3. Rollback

- **Worker code**: Dashboard, Workers, the Worker, Deployments: select a previous
  version and roll back. Or `git checkout <tag>` and `pnpm deploy:production`.
- **Fastest mitigation (no deploy)**: turn the flag off (section 4). Public reads and
  ingest return 503; the frontend falls back to legacy vitfac data.
- **Domain**: only as a last resort, remove the custom domain in Workers, Settings,
  Domains and Routes. This does not affect `vitfac.amazecc.com`.

## 4. Flags and the killswitch (dashboard, no deploy)

`ENABLE_AMAZE_REVIEWS` and `READ_ONLY_MODE` are deliberately **not** in
`wrangler.jsonc`. With `keep_vars: true`, Wrangler leaves variables you set in the
dashboard alone, so a later deploy does not reset them.

| Goal | Action |
| --- | --- |
| Feature on | Workers, the Worker, Settings, Variables and Secrets: add `ENABLE_AMAZE_REVIEWS` = `true` (type Text) |
| **Killswitch (feature off)** | set it to `false` or delete it. Strict opt-in: anything other than the exact text `true` is OFF |
| Freeze writes, keep reads (FFCS peak) | add `READ_ONLY_MODE` = `true`; ingest and recompute and cron return 503 / skip, reads keep serving |
| Legacy vitfac | independent: the frontend `NEXT_PUBLIC_ENABLE_VITFAC_INTEGRATION` and API `ENABLE_VITFAC_INTEGRATION`. This Worker never calls `vitfac.amazecc.com` |

Do this per environment (staging and production are separate Workers).
Because variables set in the dashboard are not in git, **record any change** in the
team's change log. The API (`ENABLE_AMAZE_REVIEWS`) and frontend
(`NEXT_PUBLIC_ENABLE_AMAZE_REVIEWS`) flags are separate and need their own change.

## 5. Secret rotation

Generate: `openssl rand -hex 32`. Never reuse a value across secrets or environments.

**`REVIEWS_INGEST_SECRET`** (zero downtime, dual-secret window):

1. Generate NEW. In the Worker: `wrangler secret put REVIEWS_INGEST_SECRET_PREVIOUS --env <env>`
   with the **old** value, then `wrangler secret put REVIEWS_INGEST_SECRET --env <env>`
   with the **new** value. The Worker accepts either signature.
2. Set the new value as `REVIEWS_INGEST_SECRET` in `AmazeCC-api` and redeploy/restart it.
3. Watch `status: 401` on `/internal/ingest` fall to zero (give it one full day for
   in-flight retries).
4. Delete the old one: `wrangler secret delete REVIEWS_INGEST_SECRET_PREVIOUS --env <env>`.

**`SUPABASE_SERVICE_ROLE_KEY`**: rotate in Supabase, then `wrangler secret put` for
both environments. Brief 401s are absorbed by queue retries (the API already wrote
the rows). Run a recompute afterwards.

**`REVIEW_HASH_SECRET`** (API only): do **not** rotate unless it leaked. It is the key
for every reviewer hash, so changing it orphans every existing review's owner
(students could re-review, edit windows reset) and every stored enrollment. A rotation
needs a re-hash migration of `enrollments.student_hash` and `reviews.student_hash`.
If it leaks, treat as an incident (section 9).

**`CLOUDFLARE_API_TOKEN`** (CI only): create the new scoped token, update the GitHub
secret, run a staging deploy to prove it, then revoke the old token.

**Admin signing secret (`ADMIN_SECRET`)** is an existing app secret outside this feature.

## 6. Switching `SNAPSHOT_STORE` safely (kv and r2)

`SNAPSHOT_STORE` is a normal var in `wrangler.jsonc` (default `kv`). Both backends pass
the same contract tests, and each keeps its own manifest and write-diff state, so
switching **republishes everything once**.

1. On **staging**: set `SNAPSHOT_STORE` to `r2` in `wrangler.jsonc`, deploy, then run
   `POST /internal/recompute`. Confirm the response reports snapshots written and
   `GET /api/reviews/catalog` returns 200 with an `ETag`.
2. Compare the catalog JSON against production's. They should match apart from `updated_at`.
3. Repeat on production in a quiet period.
4. **Rollback**: set `SNAPSHOT_STORE` back to `kv`, deploy, recompute. The old KV data
   is untouched until overwritten. A missing binding for the selected backend makes
   the Worker fail loudly (500) instead of silently publishing nowhere.

## 7. Limits and pricing used (looked up 2026-10-31)

Sources: Cloudflare docs, Workers pricing, KV pricing, Queues pricing, R2 pricing,
Workers Logs (all "last updated" Oct 2026). Re-check before relying on them.

| Item | Workers Paid |
| --- | --- |
| Plan | $5 / month minimum |
| Worker requests | 10M / month included, then $0.30 per million. Cached responses served by a Worker still count |
| Worker CPU | 30M CPU-ms / month included, then $0.02 per million; Cron and Queue consumer invocations can run up to 15 min |
| KV reads | 10M / month, then $0.50 per million |
| KV writes / deletes / lists | 1M / month each, then $5.00 per million |
| KV storage | 1 GB, then $0.50 per GB-month |
| Queues | 1M operations / month, then $0.40 per million. About 3 operations per delivered message (write, read, delete); each retry adds a read; per 64 KB |
| Queue retention | 4 days default, up to 14 days |
| R2 storage | $0.015 per GB-month (10 GB-month free) |
| R2 Class A (writes, lists) | $4.50 per million (1M free) |
| R2 Class B (reads) | $0.36 per million (10M free) |
| R2 egress | free |
| Workers Logs | 20M events / month included, then $0.60 per million; 7 days retention. From 1 Dec 2026 billed under Cloudflare Observability pricing |

Configurable values and why:

| Setting | Where | Value | Reason |
| --- | --- | --- | --- |
| `MAX_KV_WRITES_PER_RUN` | `wrangler.jsonc` var | local 50, environments 200 | Caps one aggregation run's writes. The catalog plus a profile per faculty is a few hundred keys at most, and write-diffing writes only changed ones |
| `CACHE_TTL_SECONDS` / `CACHE_SWR_SECONDS` | optional vars | 300 / 86400 | `Cache-Control` for snapshot reads. Lower for fresher grades, raise to save requests |
| cron | `triggers.crons` | every 10 minutes | about 4,300 runs a month; with write-diffing that is near 0 KV writes when idle |
| consumer `max_batch_size` / `max_batch_timeout` / `max_retries` | `queues.consumers` | 25 / 10 s / 3 | one Supabase call per batch; DLQ after 3 retries |
| Daily ingest cap | **not in the Worker** | n/a | The Worker is stateless. Cap abuse with the WAF rate-limit rules (DEPLOYMENT.md section 5) and the API's per-student limiter |

Cost sanity check: a read-heavy launch day of 1M catalog reads is about 1M Worker
requests (inside the included 10M) and at most 1M KV reads (inside the included
10M). Writes stay tiny because snapshots only change when reviews change.

## 8. Weekly checklist (2 minutes)

1. Workers Logs: any `aggregation_failed` or sustained `queue_consumer` errors?
2. Queues: dead-letter backlog is 0?
3. `GET /api/reviews/catalog` returns 200 and `updated_at` is recent.
4. Usage dashboard (KV, Queues, Worker requests) is within budget.
5. `npm audit` / Dependabot for `faculty-review/`.

## 9. Incident steps

1. **Contain**: turn the flag off (section 4). Reads and ingest return 503 and the app
   falls back to legacy vitfac data.
2. **Assess** with logs (no personal data in them). Check Supabase status and the DLQ.
3. **Suspected secret leak**: rotate that secret (section 5). For `REVIEWS_INGEST_SECRET`
   use the dual-secret window; for `SUPABASE_SERVICE_ROLE_KEY` rotate immediately.
4. **Bad data published**: fix the data, then `POST /internal/recompute`; snapshots are
   rewritten only where content changed. Purge the edge cache for the affected URLs.
5. **Recover**: turn the flag on in staging first, then production. Note it in the change log.
