# 05 — Feedback & Report Uploads (what leaves the device)

> **In one line:** feedback is a form the student fills — it sends exactly what's typed,
> optionally with a session replay blob; nothing auto-enriches it.
> **Read:** `feedback/FeedbackModal.tsx`, `feedback/FeedbackReportPage.tsx`,
> `BugRecordingFloatingBar.tsx`.

## What's in a bug report from this app

1. **Text** — title, category, what happened, steps.
2. **Diagnostics** — build SHA (`buildInfo.json`), browser UA class, route/tab, timestamps.
3. **Optional**: a PostHog session-replay export (90 s recording, canvas-rendered replay inline)
   — consented per submission; nothing is captured before opening the recorder.
4. **Identity** — anonymous PostHog ticket submission; contact only if the student supplies it.

## What is _never_ in it

- Credentials (they never exist as serializeable state), cookies, vault blob
- localStorage dumps (the LocalStorage Inspector is a local-only tool, opt-in per look)
- Screenshots without explicit action — the floating bar records only between start/stop taps
- Marks/grades of anyone but the reporter (report-gen happens fully client-side)

## Data minimization posture

FeedbackReportPage prose is student-authored — that is the whole payload. The form explicitly
mentions PostHog storage in fine print ("Support tickets go to PostHog"), which is the consent
surface for the ticket being written into Conversations.

## Quiz

1. Student never tapped record — what video lands in the ticket?
2. Can the admin of PostHog see the student's VTOP password via a ticket? Why not, technically?
