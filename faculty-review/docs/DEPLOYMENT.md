# DEPLOYMENT — AmazeCC Faculty Reviews Worker

Ordered, hand-executed steps for the maintainer. Worktop-level: `AmazeCC/faculty-review/`.
Everything here uses the Cloudflare Paid plan (Workers Paid: Queues, CRON
triggers, KV, R2 are paid-line items — see RUNBOOK for the limits/pricing used).

---

## 0) Prerequisites (paid items)

- [ ] Cloudflare account owning zone **amazecc.com**, Workers Paid plan active.
- [ ] Repo: `AmazeCC` (worker lives in `faculty-review/` of that repo).

## 1) DNS & custom domains

Domains are claimed automatically by `routes` with `custom_domain: true`:

- `reviews-api.amazecc.com` → production
- `reviews-api-staging.amazecc.com` → staging

You do **not** pre-create DNS records; Wrangler creates them on first deploy.
Before the first deploy there is nothing to configure manually in the
dashboard. After deploy, verify:

```
nslookup reviews-api.amazecc.com          # resolves to Cloudflare
nslookup vitfac.amazecc.com              # must NOT point at this Worker
```

## 2) Create resources per environment

```bash
cd faculty-review
npx wrangler login

# --- staging ---
npx wrangler kv namespace create REVIEWS_SNAPSHOTS --env staging
npx wrangler r2 bucket create amazecc-faculty-reviews-staging
npx wrangler queues create amazecc-reviews-queue-staging
npx wrangler queues create amazecc-reviews-dlq-staging

# --- production ---
npx wrangler kv namespace create REVIEWS_SNAPSHOTS --env production
npx wrangler r2 bucket create amazecc-faculty-reviews
npx wrangler queues create amazecc-reviews-queue
npx wrangler queues create amazecc-reviews-dlq
```

Copy the returned KV namespace `id` values into
`wrangler.jsonc` (`env.staging` / `env.production` → `REPLACE_WITH_KV_NAMESPACE_ID_*`).

## 3) Secrets (per environment)

Generate two NEW secrets — never copy a value from anywhere:

```bash
openssl rand -hex 32   # → REVIEWS_INGEST_SECRET *worker side*? NO — see note
```

> **Note:** `REVIEWS_INGEST_SECRET` must be IDENTICAL on both sides
> (`AmazeCC-api` computes the signature). Generate it once and set it in
> both places. `REVIEW_HASH_SECRET` lives only in AmazeCC-api.

```bash
# staging
npx wrangler secret put SUPABASE_URL --env staging
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env staging
npx wrangler secret put REVIEWS_INGEST_SECRET --env staging

# production
npx wrangler secret put SUPABASE_URL --env production
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --env production
npx wrangler secret put REVIEWS_INGEST_SECRET --env production
```

Never set these in `vars` — secrets live ONLY in the secret store.

## 4) First deploy

```bash
npx wrangler deploy --env staging
npx wrangler deploy --env production       # after staging smoke test
```

Both deploy with `ENABLE_AMAZE_REVIEWS="false"`. The Worker answers 503 until
the maintainer turns the flag on.

## 5) Dashboard rules (manual, numbered)

1. **Rate limiting** (Security → WAF → Rate limiting rules):
   - Rule A: `http.request.uri.path eq "/internal/ingest"` and `http.request.method eq "POST"` → *Block* over 30 requests / 10 min from the API egress IP range (tune to the API's actual egress; the HMAC check remains the real gate).
   - Rule B: public read paths (`http.request.uri.path contains "/api/reviews/"` and `http.request.method eq "GET"`) → *Managed Challenge* over 300 requests / 1 min per IP.
2. **WAF managed rules**: leave *Cloudflare Managed Ruleset* ON for the zone; the API exposes no free-text and internal routes require HMAC.
3. **Bot protection**: enable *Bot Fight Mode* (zone-level) — has no effect on HMAC-signed machine-to-machine traffic.
4. **Cache Rules**: default cache is sufficient; snapshots are served by the
   Worker itself with `s-maxage` + SWR. Do NOT add a page rule caching
   `/internal/*`.
5. **Zone → Security → Bots / Super Bot Fight Mode**: recommended ON (paid).

## 6) Smoke test after first deploy

```bash
BASE=https://reviews-api-staging.amazecc.com
# 1. health: catalog read returns valid JSON
curl -s "$BASE/api/reviews/catalog" | head -c 120        # {"schemaVersion":"1.0.0",...
# 2. ingest rejects an unsigned request
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/internal/ingest" \
  -H "Content-Type: application/json" --data '{}'         # 401
# 3. signed ingest still 503 while the flag is OFF (proves flag gating)
_ts=$(date +%s000); _b='{"schemaVersion":"1.0.0"}'
_sig=$(printf '%s' "$_ts.$_b" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/internal/ingest" \
  -H "x-timestamp: $_ts" -H "x-signature: $_sig" --data "$_b"   # 503 while flag OFF
```

Then run the go-live checklist in docs/ROLLOUT.md.
