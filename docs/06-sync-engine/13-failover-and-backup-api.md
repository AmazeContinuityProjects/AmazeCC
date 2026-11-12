# 13 — Failover & the Backup API

> **In one line:** if the primary API dies, the client holistically swaps origin to the backup
> mirror (`amazecc-api-d402b5.rivendeploy.com`) — UniCC is never the global backup.
> **Read:** `src/lib/fetch-utils.ts`, `workerBase.ts`, `useUniccTarget.ts`.

## The three-tier reality

```
Primary  →  https://api.amazecc.com                (AmazeCC-API, canonical)
Backup   →  https://amazecc-api-d402b5.rivendeploy.com   (mirror; any host that serves it)
UniCC    →  https://api-unicc.arya22.dev           (scoped fallback, see 12-unicc)
```

`failoverBackupUrl()` explicitly maps UniCC → primary, so even a misconfigured backup env can
never global-swap traffic to UniCC.

## What triggers failover

`fetchWithFailover` — one same-route retry against backup on network failure/5xx/timeout;
auth failures never trigger it (they're not transient).

## The switches a student can flip

- **Settings → "Use backup API"** — persists in localStorage (`amazecc_active_api_url`);
  effective for the whole app session including sub-requests; cleared on logout.
- `amazecc_custom_api_url` — developer/operator override; if it points at UniCC it's refused
  loudly at boot (fetch-utils guard).

## Where you _don't_ want it misapplied (already enforced)

- Worker cache routes (`buses`, `fresher-resources`) and the CDN are never failed-over to the
  API hosts — they have their own TTLs and are _not_ VTOP-shaped.
- Marks sync integrity pings (`frozen_marks_*`) always hit the primary first — the mirror may
  have drifted receipts.

## Quiz

1. If `NEXT_PUBLIC_BACKUP_API_URL` were set to UniCC, what happens at `failoverBackupUrl()`?
2. Which requests never see the backup swap?
