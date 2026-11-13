---
title: "Hostel — Architecture (deep)"
description: "three sources — static Worker JSON (mess/laundry, read-only), VTOP (leave/counselling), and a peer table (cab-share) — never merged, always labeled."
---

# Hostel — Architecture (deep)

> **In one line:** three sources — static Worker JSON (mess/laundry, read-only), VTOP (leave/counselling), and a peer table (cab-share) — never merged, always labeled.

## 1. Mess (read-only, Worker)

- `cache.amazecc.com/mess/*.json` — one file per canteen per day (VITC-M-N, VITC-M-S, etc.)
- delivered with long-cache S3 headers; app fetches on mount, caches in memory for the tab lifetime
- never written to localStorage — staleness corrections are instant on tab refresh

## 2. Laundry (read-only, Worker)

- `cache.amazecc.com/laundry/<block>-<gender>.json` — slot hours per block/qtr
- schedule-derived notifications happen client-side only (never push — too chatty for a student)

## 3. Leave (VTOP)

- `/api/hostel?section=leave_history` → current + past leaves; apply CTA opens VTOP's official leave portal — we never submit on the student's behalf (cookie-driven VTOP screens are an anti-phishing reality)

## 4. Counselling (VTOP read-only)

- cached view of counselling schedule/pins via GenericApiView — read-only table; "book" opens VTOP portal link

## 5. Cab share (peer-to-peer opt-in)

- Supabase-backed ride table: opt-in post/search; matched locally; contact revealed only on explicit accept
- VTOP-verified identity for posting (anti-troll gate) — a bus ticket doesn't prove identity; VTOP does
