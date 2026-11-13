---
title: "Rate Limits, Backoff & the Captcha Budget"
description: "every login costs a human-captcha solve; the engine is choreographed so that cost is paid as rarely as possible — never twice for the same tap, never for app boot."
---

# 15 — Rate Limits, Backoff & the Captcha Budget

> **In one line:** every login costs a human-captcha solve; the engine is choreographed so that
> cost is paid as rarely as possible — never twice for the same tap, never for app boot.
> **Read:** `credential-manager.ts`, `errors.ts`, `fetch-utils.ts`, `useAppDataActions.ts`.

## The captcha economy

VIT solves the login captcha server-side in the API. It costs:

- ~4–10 s of wall time (and an HTTP round-trip that can fail on its own)
- one VTOP attempt slot — burned on failure (VTOP _does_ lockout)

So: **never login for reading cached data**, **never login twice for one user action**, **always
prefer a 10-minute session**.

## Rules enforced in code

| Rule                        | Mechanism                                                                                |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| Boot must not login         | session restore from `storage.vtopSession` (fresh ⇒ reuse); Dashboard mount does no sync |
| One user action ⇒ one login | single-flight `refreshingVtop`; pinvoke from every credentialed request                  |
| VTOP down ⇒ fail fast       | `pingVtopDirectly(4 s)` precedes a fresh `loginVtop`; skips captcha when obvious outage  |
| Repeated failure ⇒ stop     | `FailedPair` lockout + exponential badge (`classifyAuthFailure`); user edits credentials |
| Refresh storms              | `fetchWithFailover` retries only after timeout/5xx, not 4xx; global `cancelAllRequests`  |
| Offline ⇒ never fire        | banner hides actions; sync-sheet short-circuits to the offline sheet                     |
| Demo ⇒ never login          | `demoMode` short-circuits all of the above                                               |

## What the student experiences on a bad morning

Cold app → taps Refresh → session stale → one login (~7 s) → sync completes. If VTOP is clogged
(cat season), the login itself 502s → `classifyAuthFailure` → "VTOP is unavailable" banner with
retry; **no captcha burned** beyond the one attempt.

## Quiz

1. Cold start at 8:15 am, stale session, user taps Refresh — count captcha solves; justify.
2. Why does the app ping VTOP _before_ attempting a login instead of timing out harder later?
