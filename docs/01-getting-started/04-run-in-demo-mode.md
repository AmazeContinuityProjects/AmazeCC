---
title: "Your First Run: Demo Mode"
description: "one click → the entire app populated with a fictional student's life — no VTOP account required."
---

# 04 — Your First Run: Demo Mode

> **In one line:** one click → the entire app populated with a fictional student's life —
> no VTOP account required.
> **Reading time:** ~6 min.

## Start the app

```bash
pnpm dev        # HTTPS on https://localhost:3001 (self-signed cert; click through the warning)
# or, to skip certs:
pnpm dev:http   # plain HTTP on http://localhost:3001
```

Open the URL. You'll see the **guest landing**: hero, "Get Started", "Try the demo".

## Press "Try the demo"

What happens under the hood:

1. `handleDemoClick()` in `src/components/custom/Main.tsx` fetches `/data/demoData.json`
   (a committed fixture — 150 KB of invented attendance/marks/grades).
2. It sets `demoMode` atoms + storage; every screen hydrates from the fixture.
3. VTOP/captcha/network are fully short-circuited: the sync engine logs a fake progress flow
   (30 % → 100 %) instead of hitting anything.
4. "Demo Student" (`22BCE1234`) appears in the header — you are **not** logged in anywhere.

Every tab now works: attendance calendar, marks history, FFCS planner, tasks, friend finder
mock, hostel (demo hostel data), library fixtures, payments (`DEMO_OFFICIAL_OD` + fixture),
and the FFCS planner with its built-in CSVs.

> 💡 **Tip:** demo mode is the only supported way to develop UI here without VTOP credentials,
> and 100 % of screenshots/tests/demos are built this way. If something doesn't work in demo
> mode, that's a bug in _demo-mode plumbing_, not "your account".

## What demo mode is **not**

- Not a sandbox for VTOP mutations — nothing writes anywhere (no network at all).
- Not identical to live: some live-only code paths (captcha refresh, failover) never run.
- Do not screenshot it and claim it's the real portal.

## Reset demo mode

Open **Settings → Forget credentials** (or clear site data) — or just close the tab;
demo data never leaves your browser.

## Next

- Own a screen? Run `pnpm run test` first — demo-mode suites pin the fixtures.
- Want your first change? → [05-your-first-change](05-your-first-change.md)
