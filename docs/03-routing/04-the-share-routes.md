---
title: "Share Routes & Payloads"
description: "a timetable fits in a URL; a friend opening the link receives an entire week, no server involved."
---

# 04 — Share Routes & Payloads

> **In one line:** a timetable fits in a URL; a friend opening the link receives an entire week,
> no server involved.
> **Read first:** `src/lib/ffcsShare.ts`, `ffcsShareInput.ts`, `src/app/share/`.

## Outbound flow (send a plan)

1. User taps **Share** in the FFCS planner (FFCSDashboardHeader → export options).
2. `buildShareUrl` / `buildCompactShareUrl` (in `ffcsShare.ts`) serialize _their added courses_
   via lz-string `compressToEncodedURIComponent` with a version prefix (`FFCS_SHARE_VERSION`).
3. Result: `https://amazecc.com/share/ffcs/?d=<payload>` — one line of text, ~500–1200 chars.

## Inbound flow (receive a plan)

1. Friend opens the link → `/share/ffcs/` route renders `FFCSShareView` — read-only week view.
2. `decodeSharePayload` enforces the version match **exactly**; mismatch → clear error UI
   (not a broken week). This is the one hard migration boundary — future versions must
   namespace payloads.
3. Alternative: "Add friend" inside the planner accepts raw codes/URLs —
   `ffcsShareInput.ts` parses `?d|x|q|r=` links _or_ bare short codes pasted by hand.

## The Web Share Target (`/share`)

`public/manifest.json` declares `share_target` with `action: "/share"`, `method: "GET"`,
`params: { title, text, url }`. When the student shares _something_ at AmazeCC from any app,
the OS lands on `/share?title=…&text=…&url=…` → `ShareTargetView` recognizes FFCS-flavored
payloads and routes them into the planner; anything else shows a friendly "we can't read
that yet" with the research-friendly mention that it extracts `d=` from any URL it sees.

## What never travels

- No credentials, ever, in any share payload.
- No timetables beyond the current week for the shared plan.
- Demo mode: share links still work; they just carry demo data.

## Quiz

1. What breaks first if the payload version string in `FFCSShareView` doesn't match `ffcsShare.ts`?
2. Where in the manifest is the share target declared, and what params does it carry?
3. Why don't academics share links round-trip through a server?
