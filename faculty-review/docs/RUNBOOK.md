# RUNBOOK — AmazeCC Faculty Reviews Worker

Day-2 operations. Deployment steps are in `DEPLOYMENT.md`; the merge/deploy
order lives in `ROLLOUT.md`.

---

## 1) Monitoring & alerts

- **Worker Logs**: `observability.enabled: true` streams structured JSON logs
  (Dashboard → Workers → amazecc-reviews-worker → Logs). Every line is
  PII-scrubbed by design (authorizedID, student hashes, tokens, bodies, tags
  and answers can never be emitted — enforced by the log sanitizer).
- Recommended **Cloudflare alerts** (Dashboard → Notifications):
  1. *Worker crash/failure rate* — any request failures over 1% for 5 min.
  2. *Queue backlog / DLQ* — messages in `amazecc-reviews-dlq` > 0 (Queue
     insights; checked weekly below if no native alert is available).
  3. *Cron failure* — email on `aggregation_failed` log events (Worker Logs →
     alert matching `[reviews] {"event":"aggregation_failed"`), or set a 
    Workers notification "Cron job failed".
  4. *KV spend anomaly* — Cloudflare billing notification at a monthly budget.
- Key log events to watch: `aggregation_complete` (written/skipped),
  `consumer_batch` (size/ok), `ingest_rejected_hmac` (spikes = auth noise),
  `ingest_rejected_flag/readonly` (expected while flags off).

## 2) Dead-letter handling

- DLQ: `amazecc-reviews-dlq` (prod) / `amazecc-reviews-dlq-staging`. Messages land there after
  `max_retries` (3) failed consumer attempts.
- **Inspect**: Dashboard → Queues → amazecc-reviews-dlq → View messages
  (shows count + sample). CLI: `npx wrangler queues messages list` where available
  (or Queue insights → DLQ metrics).
- **Cause triage**: `consumer_batch` error logs (Supabase 4xx/5xx), retry
  storms, oversized batches. The most common cause: expired Supabase OTP/key
  (401) — rotate the key (below) and replay.
- **Replay**: Dashboard → Queues → DLQ → *Replay messages* (re-pushes to the
  source queue). CLI equivalent: `npx wrangler queues messages replay <dlq>`.
  Verify Postgres counts increased, then re-run aggregation.

## 3) Rollback

- Worker versions: Dashboard → Workers → amazecc-reviews-worker → Deployments →
  select previous version → *Rollback*. OR re-deploy a previous git tag:
  `npx wrangler deploy --env production` from the tag; `git checkout <tag>` first.
- Roll back the CUSTOM DOMAIN separately if needed by disabling the route
  (Dashboard → Workers → Routes): remove `reviews-api.amazecc.com` temporarily —
  frontend keeps answering from `AmazeCC-api` proxied catalog (flag-off path).

## 4) Killswitch / flags (all dashboard-only, no deploy)

| Situation | Action |
| --- | --- |
| Any review-feature incident, keep legacy vitfac | Dashboard → Settings → Variables → `ENABLE_AMAZE_REVIEWS="false"` (prod + staging as needed) |
| FFCS day write freeze (reads stay served) | `READ_ONLY_MODE="true"`; revert same way |
| Take vitfac pills down | `NEXT_PUBLIC_ENABLE_VITFAC_INTEGRATION=false` in **AmazeCC frontend** build env — unrelated to this Worker |
| Turn the feature on/off for maintenance | `ENABLE_AMAZE_REVIEWS` toggling only |

## 5) Secret rotation

Generate: `openssl rand -hex 32`

- **REVIEWS_INGEST_SECRET (zero-downtime, dual-secret window):**
  1. Put NEW value as `REVIEWS_INGEST_SECRET` (Worker) — old value temporarily
     set as `REVIEWS_INGEST_SECRET_PREVIOUS` so both signatures accepted.
  2. Update `AmazeCC-api/.env` (`REVIEWS_INGEST_SECRET`) and redeploy/restart API.
  3. After one aggregation cycle (~30 min, confirm `ingest_rejected_hmac` stops
     rising), DELETE `REVIEWS_INGEST_SECRET_PREVIOUS` from the Worker.
  4. Never log secret values; rotate `REVIEW_HASH_SECRET` only if a leak is
     proven — it changes every reviewer hash at once.
- **SUPABASE_SERVICE_ROLE_KEY**: rotate in Supabase dashboard
  (Settings → API → rotate), then `wrangler secret put` the new value for both
  environments. A brief 401 window is acceptable (queue retries cover it).
- **CLOUDFLARE_API_TOKEN** (CI only): create a new scoped token, update GitHub
  secret, then revoke the old one. Scope: Account → Workers scripts:Edit,
  Workers KV:Edit, Queues:Edit, R2:Edit; Zone → DNS:Edit for amazecc.com
  (custom-domain route creation), Workers Routes:Edit — nothing else.

## 6) Switching `SNAPSHOT_STORE` safely (kv ↔ r2)

1. Enable the new backend first: create/verify the R2 bucket (or KV ns) and
   set `SNAPSHOT_STORE="r2"` on **staging**; deploy; smoke test
   (`catalog` 200, ETag works).
2. **Backfill**: run one ingest-free aggregation against the new backend:
   `curl -X POST https://reviews-api-staging.amazecc.com/internal/recompute -H "x-timestamp: .." -H "x-signature: .."` — it writes all snapshots to the new backend (manifest rebuilt; write-diffing restarts at zero).
3. Verify catalog + profile JSON in the dashboard; then repeat on production.
4. Rollback = set `SNAPSHOT_STORE="kv"` back and re-run recompute (KV retains
   the old data until the next clean write covers it).

## 7) Limits & pricing used (Cloudflare docs, Oct 2026)

Workers Paid base **$5/mo**; 10M requests/mo included, then ~$0.30/million.

| Item | Included (Paid) | Extra |
| --- | --- | --- |
| KV writes/deletes/lists | 1M / month | $5.00 per extra million |
| Writes to the same KV key | 1/sec per key | — (write-diffing keeps us far below) |
| Queues operations | 1M ops/month | $0.40 per extra million (≈3 ops per delivered message; retries cost reads) |
| Queue message retention | 4 days (configurable to 14) | — |
| `max_batch_size` | default 10, we use **25** (max 100) | — |
| R2 storage | 10 GB free tier | $0.015 /GB-month |
| R2 Class A (writes/lists) | 1M free tier | $4.50 /million |
| R2 Class B (reads) | 10M free tier | $0.36 /million |
| Worker size | 64 MiB | — |

Configurable constants (all in `wrangler.jsonc` `vars`): `MAX_KV_WRITES_PER_RUN`
(staging/prod **200**; the current faculty size needs ~120 snapshots/cycle), 
aggregation cron 10 min. If the faculty list grows past ~500 official
professors, raise the cap or increase the cron budget with the same
write-diffing (unchanged snapshots cost nothing).

## 8) Weekly checklist (2 min)

1. `cloudflare dashboard` → Workers → Logs: any `aggregation_failed`?
2. Queues → DLQ count == 0?
3. `GET /api/reviews/catalog` → 200, `updated_at` within last 15 min.
4. KV usage dashboard within monthly budget.
