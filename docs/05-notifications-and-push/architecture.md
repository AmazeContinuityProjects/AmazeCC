---
title: "Notifications & Push — Architecture (deep)"
description: "web push over VAPID — every category opt-in, quiet hours honoured, service worker routes clicks to the right tab — nothing without your tap."
---

# Notifications & Push — Architecture (deep)

> **In one line:** web push over VAPID — every category opt-in, quiet hours honoured, service worker routes clicks to the right tab — nothing without your tap.

## 1. The subscription flow

```
Settings → Notifications → enable category
  → beforeinstallprompt-ish flow: browser push permission prompt
  → PushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC })
  → POST /api/notifications/subscribe {endpoint, keys, categories[]}
  → row lands in Supabase push_subscriptions (server-side)
  → on deregister / sign-out: DELETE row
```

## 2. Delivery contract

Server trigger → push service (FCM/APNs) → SW `push` event → `showNotification({title, body, tag, icon})`
→ click handler: `openWindow('/?tab=<category>')` or focus existing window.

## 3. Quiet hours

`settings.quietHours = { start: "22:30", end: "07:30" }` — client suppresses local reminders during
the window; server-side delivery window filter requires the client's stored timezone (else server
can't gate — an acknowledged hole; messages still arrive without tz).

## 4. Categories vs rows

Each category is a row with `endpoint` + category tags — one subscription can cover many, or user
can split per category into separate requests on multi-device — UI handles the bookkeeping.
