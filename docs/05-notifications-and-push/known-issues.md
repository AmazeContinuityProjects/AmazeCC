---
title: "Notifications & Push — Known Issues (full)"
---

# Notifications & Push — Known Issues (full)

1. **iOS quirk** — Safari web push needs 16.4+; category list still shows on iOS; no requests ever fire — docs say so.
2. **Stale subscriptions** — endpoint dies silently after a re-install; the next push fails server-side; subscription is re-created on next open.
3. **Quiet-hours timezone drift** — travel without changing device tz = pushes at odd hours — user-configurable remedy only.
4. **Duplicate pushes** — some users see two pings for one event; tag-based dedupe helps but two devices subscribe separately — working as designed.
5. **Marks push weekend** — FAT results land at midnight; pushes arrive at 00:00 unless you set quiet hours.
