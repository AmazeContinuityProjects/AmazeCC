---
title: "PostHog Runbook"
description: "errors and crashes land in PostHog — find the fire or confirm the peace."
---

# PostHog Runbook

> **In one line:** errors and crashes land in PostHog — find the fire or confirm the peace.

## Where things are

- Project: `shoot.amazecc.com` (first-party proxy) → upstream project `phc_obkUK…`
- **Error tracking** — auto-captures boundary catches + explicit `reportError()` calls; search by sha (from buildInfo) to match reports to code
- **Events** — app_opens, sync_runs, feature_uses; query with the warehouse for funnel questions (see `docs/archive/reports/` for examples)
- **Conversations** — student support tickets via in-app feedback → reply threads (privacy: you're reading student-reported content; handle accordingly)

## Triage flow

1. PostHog → Insights → most-hit errors last 24h
2. Filter by build SHA → match to commit → read diff
3. Repro in demo mode if possible (much faster than VTOP repro)
4. Fix → merge → Pages deploys → watch the curve for 24h

## What we never do

- Never export PII collections, never query by registration number identity hash without support need
- Never change CSP to "make PostHog work" without understanding why it failed
- Never silence errors with client-side try/catch + no telemetry
