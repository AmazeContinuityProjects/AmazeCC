---
title: "The UniCC Fallback (scoped, opt-out-able)"
description: 'a third-party "better VTOP" API receives the student''s real credentials for a small allowlist of reads — only when the primary API is unavailable, never on rejected passwords — and can be killed…'
---

# The UniCC Fallback (scoped, opt-out-able)

> **In one line:** a third-party "better VTOP" API receives the student's **real credentials**
> for a small allowlist of reads — only when the primary API is unavailable, never on
> rejected passwords — and can be killed with one env var.
> **Read:** `src/lib/unicc-fallback.ts`; see also `13-failover-and-backup-api.md` and ADR-0006.

## The allowlist (UNICC_SUPPORTED_PATHS)

login, grades, attendance, calendar, schedule, hostel, lms data, vitol — all read-only-ish
"me" endpoints. **`/api/ffcs`, payments, admin, whoami are NOT there.** `/api/whoami` is
also intentionally excluded (heavier personal data than needed).

## The credential truth

UniCC needs a real VTOP session. On fallback, the app POSTs **the student's username and
password** to `https://api-unicc.arya22.dev/api/login` — which is a third party's server.

- It happens **only after** the primary (and backup) API failed for environmental reasons
  (timeouts, 5xx, network unreachable) — never on 4xx/auth failures.
- It is **never** used for marks/grades/attendance _submission_ of any kind that isn't in the list.
- PostHog logs the fallback event (`emitUniccLogEvent`) so its occurrence is measurable.
- `NEXT_PUBLIC_UNICC_FALLBACK=off` kills it outright (recommended for cautious deploys).

## Why it exists anyway

Campus Wi-Fi + VTOP scraping + a single API host = students staring at spinners during VIT
exam week. UniCC uptime is independent; the allowlist keeps the warm-fuzzy benefit cheap.

## The UniCC-shaped responses

UniCC responses aren't identical — the client normalizes shapes (grade/attendance payload
adaptation). Error text is **not** trusted for UI presentation; only status/success flags drive
behavior.

## Quiz

1. Student with a wrong VTOP password — does UniCC get the password? Trace the decision.
2. May UniCC serve `/api/ffcs`? What happens in `NEXT_PUBLIC_UNICC_FALLBACK=off` deploys?
3. What telemetry exists for "this student hit UniCC today"?
