---
title: "Reporting a Security Issue"
description: "email the maintainers, not the issue tracker; we fix silently before we announce."
---

# Reporting a Security Issue

> **In one line:** email the maintainers, not the issue tracker; we fix silently before we announce.
> **Audience:** anyone who finds something. **Reading time:** 2 min.

## In-scope examples

- Credential exposure anywhere in this repo or its published bundle beyond the documented public tokens
- A way to read another student's data via the app or the API contract as documented
- XSS achieving content exfiltration from the app's origin
- Marks-sync bypass enabling forging cohort stats at scale
- Session/vault arithmetic flaws (e.g., predictable IV reuse, key-wrap misuse)

## Out of scope

- VIT's own portals (report to VIT)
- Theoretical attacks requiring the student's unlocked device + a personal XSS
- Social engineering of classmates
- Missing rate-limiting on the API's own public data (buses, laundry) — tell us; low priority

## How to report

- Preferred: a private message to the org maintainers on GitHub (`AmazeContinuityProjects`) with subject "SECURITY — AmazeCC".
- Include: minimal PoC, affected version (build number from Settings → About), your handle if you want credit.
- Do not create a public issue, do not open a PR with the technique, do not test against other students' accounts.

## Our commitment

- Acknowledge within 7 days
- Fix or mitigate on a documented timeline
- Credit with your permission after release (release notes, Hall of Fame)
- Never legal threats for good-faith research — report with respect and we respond in kind

## Hall of Fame

Security research that finds real issues ships in the release notes. Thank you in advance for not
being annoying about report timing.
