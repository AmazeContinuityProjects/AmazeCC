---
title: "PostHog Identity Verification (HMAC)"
description: "analytics events are tied to a verified user without shipping the secret — the server mints a hash; the client attaches it."
---

# 04 — PostHog Identity Verification (HMAC)

> **In one line:** analytics events are tied to a verified user without shipping the secret —
> the server mints a hash; the client attaches it.
> **Read:** `lib/posthog.ts`, `03-architecture/…` analytics placement, AmazeCC-API
> `/support/identity-hash`.

## Why it exists

Without verification, anyone knowing your `distinct_id` (e.g. registration number) could forge
your analytics identity. PostHog's docs recommend signing `distinct_id` with a server-held HMAC
so events from impersonators are dropped.

## The flow

```
launch → posthog.identify(distinct_id=roll, …)
       → `syncPostHogIdentityVerification()`:
           fetch {NEXT_PUBLIC_API_URL}/support/identity-hash?distinct_id=<id>
           server computes HMAC-SHA256(secret, id) → returns it
       → `posthog.setIdentityHash(hash)` — future events carry it;
         PostHog discards unsigned events from unverified clients
```

The webhook/`error-utils` logger path adds the hash automatically — no per-call code.

## Secret location

On the server only (`ID_SALT`/PostHog env side). Nothing in this repo could compute a valid
hash for a different identity; the convenience helper `computePostHogIdentityHash` in
`posthog.ts` exists only for server-side use/tests and is never called at runtime by the app.

## Quiz

1. Why doesn't the client just store the secret? (Answer belongs in one breath.)
2. What request mints the hash, and who is trusted to know the secret?
