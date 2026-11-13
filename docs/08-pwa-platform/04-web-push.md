---
title: "Web Push (VAPID)"
description: "opt-in, category-scoped, quiet-hours-respecting notifications delivered by the service worker."
---

# Web Push (VAPID)

> **In one line:** opt-in, category-scoped, quiet-hours-respecting notifications delivered by the service worker.

## Flow

1. Settings → Notifications → toggle category → browser requests `push` permission
2. `PushNotificationManager.tsx` POSTs subscription to AmazeCC-API (`/api/push/subscribe`) — keys: `p256dh`, `auth`, endpoint
3. Server (Supabase `push_subscriptions` table, `sql/supabase_setup.sql`) stores it
4. Event occurs (VIT publishes circulars / marks freeze / deadlines) → server signs and sends
5. SW `push` handler → `showNotification` → click → `/` focused or opened

## Categories (each off by default)

Attendance-miss alert · marks-freeze · deadline approaching · changelog/ci · events/cabin · feedback ack

## Quiet hours

`settings.quietHours: {start: "22:30", end: "07:00"}` — client suppresses display; server checks
delivery windows on send; both must agree (defense in depth; either alone defaults to noisy).

## What happens on permission denial

Opt-in UI hides entirely; Supabase subscription never created; no nagging — student can revisit
Settings forever.
