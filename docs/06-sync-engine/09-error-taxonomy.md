---
title: "Error Taxonomy"
description: "three shapes carry every failure through the engine — AuthError, TransientError, and everything-else — and the UI treats them differently on purpose."
---

# Error Taxonomy

> **In one line:** three shapes carry every failure through the engine — `AuthError`,
> `TransientError`, and everything-else — and the UI treats them differently on purpose.
> **Read:** `src/lib/sync-engine/errors.ts`.

## The four types

| Type             | Carries                                   | Retried?      | User message                                     |
| ---------------- | ----------------------------------------- | ------------- | ------------------------------------------------ |
| `AuthError`      | domain (`vtop`/`eventhub`), human message | never         | "VTOP login failed / expired — edit credentials" |
| `TransientError` | message, retry delay                      | yes (backoff) | "VTOP is having trouble — will retry"            |
| `TimeoutError`   | —                                         | once          | same as transient                                |
| raw `Error`      | anything                                  | once          | "Sync failed" + details in sheet                 |

## `assertApiSuccess`

The API answers `200` for half its failures — `{success:false, message:"Invalid Captcha"}`.
`assertApiSuccess` runs on **every** credentialed response; a 200-with-`success:false` is an
error, full stop. This alone converts cryptic blank screens into actionable messages.

## `classifyAuthFailure`

Buckets failure text into `captcha` / `credentials` / `rateLimit` / `unknown` — drives the
credential editor's helper text and `syncTimes` logging for diagnostics.

## The fallback matrix for `/api/ffcs` specifically

```
400 Missing csrf/authorizedID  → TransientError "Bad request — sign in again" (student state machine)
401                            → AuthError (credential refresh; then Edit-credentials card)
`{success:false,error:…}`      → assertApiSuccess → TransientError "Server error"
network/5xx/timeout            → TransientError + bounded retries (≤2)
```

Quiz — a page calls `sync("ffcs")` and it 401s: which atom flips, which UI appears, what is NOT
automatic, and what does the user do next? Walk the whole chain.
