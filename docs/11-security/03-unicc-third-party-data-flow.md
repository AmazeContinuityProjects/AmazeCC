---
title: "UniCC's Third-Party Data Flow (exact path)"
description: "the exact sequence of bytes that reaches a third party, when it happens, and how to stop it — because this is the one non-first-party path that carries credentials."
---

# UniCC's Third-Party Data Flow (exact path)

> **In one line:** the exact sequence of bytes that reaches a third party, when it happens,
> and how to stop it — because this is the one non-first-party path that carries credentials.
> **Read:** `lib/unicc-fallback.ts`, `ADR-0006`.

## Byte-level story

```
Primary API request fails (timeout / 5xx / network blip)
 → `isUniccPreferred()` + `shouldUseUnicc(path)` checks:
    1) path ∈ UNICC_SUPPORTED_PATHS? no → give up (stay on primary error)
    2) NEXT_PUBLIC_UNICC_FALLBACK === "off"? → give up
    3) error irreversible (401/403/4xx)? → give up (never ship creds on wrong password)
 → `uniccUrlFor(path)` rewrites origin to https://api-unicc.arya22.dev/<path>
 → request rebuilt WITH the same body {username, password} + cache-bust nonce? no — same request
 → response normalized by the UniCC adapter (grade/attendance/marks shapes)
 → `noteUniccServed(path)` telemetry; cache untouched until next online check
```

## What the third party sees

Your VTOP username + password on that one login call. They do not see: payments, marks stats
submission, cohort receipts, push subscriptions, feedback identity — none of those flow even
when UniCC is consulted for reads. UniCC answers for _your_ reads only; it can't proxy admin.

## Why this is a documented exception and not a bug

VIT locks and rate-limits entire NAT ranges for whole buildings. A campus DNS hiccup during
exams leaves students staring at spinners for official portals that already saw their
credentials. UniCC uptime is independent of ours — with an allowlist small enough to audit
line-by-line. The env kill switch makes it a deployment-time decision, not a commit-time one.

## Your duty

- Never add a path to `UNICC_SUPPORTED_PATHS` without an ADR update + security sign-off.
- Never log request bodies with creds — ever (middleware error paths included).
- If a student disables it, respect it; the UI must gray out "get my attendance" gracefully.

## Quiz

1. List everything that must be true before one byte of credential touches UniCC.
2. Student clicks "Fetch marks" while primary is down and their password is wrong — UniCC
   invoked? Explain.
