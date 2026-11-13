---
title: "Marks Sync & Privacy Architecture"
description: "students can _contribute_ anonymized class-averages for free — computed server-side, keyed by a one-way hash, whose receipts the client freezes forever."
---

# 11 — Marks Sync & Privacy Architecture

> **In one line:** students can _contribute_ anonymized class-averages for free — computed
> server-side, keyed by a one-way hash, whose receipts the client freezes forever.
> **Read:** `src/lib/marksSync.ts`, `stores/dataAtoms.ts` (`marksStatsAtom`), `useDashboardDataActions.ts`.

## What it is — in plain English to write on the Settings screen

Your own marks are yours. But when you tap **Sync class statistics**, the app publishes the
following: _which class (e.g. "CSE1001-A"), which assessment (component + title), and your
raw score_. No name, no registration number, no date — the server groups by class and returns
mean / σ / top-fraction. That's it. The switch is off by default.

## How identity is actually handled (the clever bit)

- The wire payload has **no** `userHash`, `timestamp`, `type` — just class id, component, title,
  score — intentionally flat to make abuse detectable (`marksSync.ts` header comment).
- `assessmentKey = sha256("<classId>::<component>::<normalizedTitle>")` — mirrored server-side in
  `marksStats.ts`; used only for dedupe and the HMAC receipt cycle.
- The server returns **HMAC receipts** for every accepted write; the client stores them
  (`marksFrozenV1`) and treats them as **frozen keys** — a mismatch later means server state
  _moved_ (re-uploaded paper, DP upload, error), which is surfaced honestly to you as
  "N cohort receipt(s) changed unexpectedly" in the log instead of silently diverging.

## Frozen keys & backfill

- `BACKFILL_KEY` one-time flag in storage; `FROZEN_KEY` holds the receipt set
- The backfill pass re-hashes classIds actually present in localStorage and re-sends anything
  missing — never anything else, never anyone's else
- `frozen_marks_<semesterId>` stores are the permanent per-term anchor for charts

## Where UI shows it

- Settings → **Contribute marks for class statistics** toggle
- Class statistics sheet → merged local + cohort stats (server wins on drift, logged)
- The log line: unexpected

## The threat model we accept

- The server learns an _assessment score_ tied to a class id — it cannot tie it to you (no
  identifiers flow, hash is one-way, tally is statistical)
- A malicious student can pollute _their own_ stats submissions — that's server rate-limiting's
  problem to solve, not ours; contract documented server-side
- The line we won't cross: uploading grades without explicit opt-in

## Quiz

1. What exact fields transit the wire on a marks contribution?
2. What happens when the server's frozen receipt set diverges from the client's?
3. Why can't the server know whose marks it just stored?
