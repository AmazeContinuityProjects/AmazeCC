# Deployment: Faculty Reviews Worker

Ordered, hand-executed steps for the maintainer. The Worker lives in
`faculty-review/` of the `AmazeCC` repository. Run every command below from
that folder unless stated otherwise.

The merge/deploy order across the three repos is in [ROLLOUT.md](./ROLLOUT.md).
Everything ships with the feature **OFF**: the Worker answers 503 for reviews
routes until you turn the flag on (step 8).

---

## 0. Paid items and prerequisites

- [ ] Cloudflare account that owns the `amazecc.com` zone, on the **Workers Paid** plan
      (required for Queues; also covers KV, R2 access and Cron Triggers).
- [ ] R2 enabled on the account (needed even if you stay on KV, because the
      staging/production configs bind a bucket; R2 has a free tier).
- [ ] A GitHub repository admin for `amazedCC/AmazeCC` (environments and secrets).
- [ ] Node 22 and pnpm (`corepack enable`), and `npx wrangler login` on your machine.

Figures used for capacity and cost are in [RUNBOOK.md](./RUNBOOK.md) section 7.

## 1. DNS and custom domains

`wrangler.jsonc` claims exact hostnames with `custom_domain: true`:

| Environment | Hostname |
| --- | --- |
| production | `reviews-api.amazecc.com` |
| staging | `reviews-api-staging.amazecc.com` |

Rules this config follows (do not change them):

- Custom Domains, not route patterns: each entry is one exact hostname, never a
  wildcard, so it cannot capture `vitfac.amazecc.com` or any existing host.
- `workers_dev` is `false`: no `*.workers.dev` URL exists.
- Wrangler creates the DNS record and certificate on first deploy. **A hostname
  must not already have a DNS record**, or the deploy fails. Check first:

```bash
nslookup reviews-api.amazecc.com            # expect NXDOMAIN before first deploy
nslookup reviews-api-staging.amazecc.com    # expect NXDOMAIN before first deploy
nslookup vitfac.amazecc.com                 # untouched; must keep resolving as today
```

To use different hostnames, edit the two `pattern` values in `wrangler.jsonc`
and the `BASE` URLs in `.github/workflows/faculty-review-deploy-*.yml`.

## 2. Create resources per environment

```bash
npx wrangler login

# staging
npx wrangler kv namespace create REVIEWS_SNAPSHOTS_STAGING
npx wrangler kv namespace create REVIEWS_SNAPSHOTS_STAGING_PREVIEW
npx wrangler r2 bucket create amazecc-faculty-reviews-staging
npx wrangler queues create amazecc-reviews-queue-staging
npx wrangler queues create amazecc-reviews-dlq-staging

# production
npx wrangler kv namespace create REVIEWS_SNAPSHOTS_PRODUCTION
npx wrangler kv namespace create REVIEWS_SNAPSHOTS_PRODUCTION_PREVIEW
npx wrangler r2 bucket create amazecc-faculty-reviews
npx wrangler queues create amazecc-reviews-queue
npx wrangler queues create amazecc-reviews-dlq
```

Copy the printed namespace ids into `wrangler.jsonc`, replacing:

| Placeholder | Value |
| --- | --- |
| `REPLACE_WITH_STAGING_KV_ID` | staging namespace id |
| `REPLACE_WITH_STAGING_PREVIEW_KV_ID` | staging preview namespace id |
| `REPLACE_WITH_PRODUCTION_KV_ID` | production namespace id |
| `REPLACE_WITH_PRODUCTION_PREVIEW_KV_ID` | production preview namespace id |

KV ids are not secrets, but they are account-specific. Commit them in the repo
only if you are comfortable with that; otherwise keep them in a deploy-time
patch. Queue consumers, the dead-letter queues, cron triggers and the R2
bucket names are already in the config. No account id, zone id or route from
any developer account is committed.

## 3. Secrets (per environment)

Generate each value fresh and independently:

```bash
openssl rand -hex 32
```

Set the three Worker secrets for each environment (you are prompted for each value;
nothing is echoed or stored in git):

```bash
npx wrangler secret put SUPABASE_URL --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
npx wrangler secret put REVIEWS_INGEST_SECRET --env staging

npx wrangler secret put SUPABASE_URL --env production
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
npx wrangler secret put REVIEWS_INGEST_SECRET --env production
```

- `SUPABASE_URL`: Supabase dashboard, Project Settings, API, Project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: same page, service-role / secret key. It bypasses
  RLS, so it lives **only** in the Worker secret store.
- `REVIEWS_INGEST_SECRET`: must be **identical** to `REVIEWS_INGEST_SECRET` in
  `AmazeCC-api`. Use a different value for staging and production.
- `REVIEW_HASH_SECRET` is **not** a Worker secret. It lives only in `AmazeCC-api`
  and must differ from every other secret. Never rotate it casually; it changes
  every reviewer hash (see RUNBOOK section 5).

Never put these in `vars`. List what is set with
`npx wrangler secret list --env production`.

## 4. First deploy

```bash
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test
pnpm build                        # credential-free dry run of the bundle

pnpm deploy:staging               # wrangler deploy --env staging
bash scripts/smoke-test.sh https://reviews-api-staging.amazecc.com

pnpm deploy:production            # after staging looks right
bash scripts/smoke-test.sh https://reviews-api.amazecc.com
```

Both environments deploy with the flags **unset**, which means feature OFF and
not read-only.

## 5. Dashboard-only hardening (numbered, do all of them)

These cannot be expressed in `wrangler.jsonc`. Do them on the `amazecc.com` zone.

1. **Rate limiting rules** (Security, WAF, Rate limiting rules). Create:
   1. *Ingest*: expression `http.host eq "reviews-api.amazecc.com" and http.request.uri.path eq "/internal/ingest"`,
      count per IP, **30 requests per 10 seconds**, action **Block** for 10 minutes.
      Ingest comes only from `AmazeCC-api`; the HMAC check remains the real gate.
   2. *Recompute*: same host, path `/internal/recompute`, **5 requests per minute**, action Block.
   3. *Public reads*: same host, path starts with `/api/reviews/`, **120 requests per minute per IP**,
      action Managed Challenge.
   4. Repeat 1 to 3 for `reviews-api-staging.amazecc.com`.
   Pick the periods your plan allows; tune after watching real traffic.
2. **Rate limit submits at the API.** `/api/reviews/submit` lives on `AmazeCC-api`,
   not this Worker. It has an in-process per-student limiter (10 per 5 minutes),
   which is per server instance. Add a WAF rate rule on the API hostname for
   `/api/reviews/submit` and `/api/reviews/enrollment-snapshot` as well.
3. **WAF managed rules**: confirm the Cloudflare Managed Ruleset is deployed on the zone.
4. **Bot protection**: enable Bot Fight Mode (or Super Bot Fight Mode on Pro and
   above). It does not affect HMAC-signed server-to-server calls from the API
   if they come from a datacentre IP; if the API is challenged, add a skip rule
   for `/internal/*` scoped to the API's egress IPs.
5. **Cache Rules**: none are required. The Worker sets `Cache-Control` and
   `ETag` itself. Do **not** add a rule that caches `/internal/*`.
6. **Notifications** (Notifications, Add): create alerts for Worker error rate, and
   for the queue backlog and the dead-letter queue if your plan offers them.
7. **Cron failure alerting**: Cloudflare has no per-cron failure alert, so alert on
   the `aggregation_failed` log event (RUNBOOK section 1) and check the weekly list.
8. **Billing**: set a billing notification threshold so a cost spike is noticed.

## 6. GitHub setup for CI/CD

Workflows live in `.github/workflows/`:

| File | Trigger | What it does |
| --- | --- | --- |
| `faculty-review-ci.yml` | PR / push touching `faculty-review/**` | install, typecheck, lint, test, dry-run build, audit, secrets scan |
| `faculty-review-deploy-staging.yml` | push to `main` touching `faculty-review/**`, or manual | tests, deploy to staging, smoke test |
| `faculty-review-deploy-production.yml` | tag `faculty-review@v*`, or manual with typed confirmation | tests, deploy to production, smoke test; **requires environment approval** |

Set up, in GitHub (Settings):

1. **Secrets and variables, Actions, Repository secrets**:
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. (Add `CLOUDFLARE_ZONE_ID`
   only if you later purge cache by API; nothing uses it today.)
2. **Environments, New environment, `production`**: enable **Required reviewers**
   (at least one maintainer who is not the deployer), restrict to protected
   branches/tags, and optionally move the two Cloudflare secrets here so only
   production runs can use them.
3. **Environments, `staging`** (optional): no reviewers needed.
4. **Branch protection** on `main`: require the `faculty-review-ci` and `CI` checks.

### Cloudflare API token

Create an **Account API token** (Manage Account, Account API tokens). Start from the
**Edit Cloudflare Workers** template, which is Cloudflare's documented template for CI
deploys, then confirm it covers what this Worker needs and nothing more:

| Scope | Permission | Why |
| --- | --- | --- |
| Account | Workers Scripts: Edit | deploy the Worker |
| Account | Workers KV Storage: Edit | bind and use KV |
| Account | Workers R2 Storage: Edit | bind the bucket |
| Account | Queues: Edit | queue and consumer config |
| Zone (`amazecc.com` only) | Workers Routes: Edit | custom domain attachment |
| Zone (`amazecc.com` only) | DNS: Edit | Wrangler creates the custom-domain record |

Resources: **this one account and this one zone only**. Set a TTL if you can.
If a deploy fails with an authentication or permission error, the message names
the missing permission; add exactly that one. Do not use a Global API Key.

## 7. Smoke test

`scripts/smoke-test.sh <base-url>` runs three checks and works with the flag on
or off:

1. `GET /health` returns `{ "ok": true }`.
2. `GET /api/reviews/catalog` returns valid JSON (200 flag on, 503 flag off).
3. `POST /internal/ingest` without a signature returns 401.

CI runs it after every deploy.

## 8. Go-live checklist

Work through [ROLLOUT.md](./ROLLOUT.md). Specifically for this Worker:

- [ ] Staging smoke test passes; production smoke test passes.
- [ ] `nslookup vitfac.amazecc.com` unchanged; the legacy vitfac integration still works.
- [ ] `REVIEWS_INGEST_SECRET` matches on the API and the Worker (per environment).
- [ ] Dead-letter queue exists and is empty; dashboard alerts and rate limits (section 5) are in place.
- [ ] Test reviews removed ([CLEANUP_STEPS.md](./CLEANUP_STEPS.md)) and the catalog shows
      "Not enough reviews yet" everywhere.
- [ ] Turn the flag on in the dashboard: Workers, `amazecc-reviews-worker`, Settings,
      Variables and Secrets, add `ENABLE_AMAZE_REVIEWS` = `true` (text). No deploy needed.
      Turn it off the same way (RUNBOOK section 4).
