---
title: "Friend Finder — Known Issues (full)"
---

# Friend Finder — Known Issues (full)

1. **Stale registrations** — a student who dropped the course still can appear until next VTOP sync
   — by design; better than hiding valid matches.
2. **No phone-number handle sharing** — handles are intentionally not phone numbers; students paste them.
3. **Handle harvesting** — rate-limited + LIVE only while the verified modal session holds; harvesting by leaving the page open exploits nothing beyond what the page shows — documented risk.
4. **Demo mode here doesn't exist** — demo fixtures are only in-app; public route requires a real VTOP session (this is correct, not a bug).
5. **Alumni who graduated** — cannot match; their data is never queried by semester-filtered API.
