---
title: "What the App Refuses to Share"
---

# 02 — What the App Refuses to Share

> **The short list of data flows that are OFF by default, by design, with a switch.**

| Feature                          | Default                  | What leaves the device                    | Opt-out mechanism                                       |
| -------------------------------- | ------------------------ | ----------------------------------------- | ------------------------------------------------------- |
| Marks → class stats contribution | off                      | (classId, component, title, score)        | Settings toggle, honors demo                            |
| Friend Finder pairing            | off (needs explicit add) | class lists, nicknames, busy map          | revoking a pair deletes grants + caches                 |
| Attendance late-lying in reports | off                      | only what you put in the form             | report generated locally (studentReportPdf)             |
| Feedback wording + identity      | —                        | typed; contact optional                   | free text, no auto-identifiers; PostHog ticket separate |
| Share links                      | explicit action only     | only the shared week as a URL token       | never leaves without tap                                |
| Notifications content            | minimal                  | push payload = title + body length-capped | per-category Settings, quiet hours                      |
| Crash/error details (PostHog)    | on, with notice          | stack, build SHA, breadcrumbs             | Settings → Disable analytics (GA + PostHog)             |

## Privacy mode (shoulder-surfing)

`settings.useCampusVisibility`? No — `privacyMode` (settingsAtoms) blurs grades, attendance
percentages, marks and fees via a single `privacy-mode` class on `<body>`; implemented as CSS
`filter: blur(4px)` + `user-select: none` on `.data-private` elements. It is a "safe bus"
feature — expect students to shield their own data from bus seats, not from us.

## Quiz

1. Where does "class stats" get computed — client or server — and what does the client see back?
2. Student revokes a pair; enumerate every artifact that must be considered deleted.
