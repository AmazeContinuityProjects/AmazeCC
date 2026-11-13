---
title: "Cab Share — Architecture (deep)"
description: "post your ride → campus peers see it → accept/decline happens privately → identity disclosed only to the fellow rider — nothing else leaks."
---

# Cab Share — Architecture (deep)

> **In one line:** post your ride → campus peers see it → accept/decline happens privately → identity disclosed only to the fellow rider — nothing else leaks.

## 1. Posting model (opt-in only)

```
CreateTrip → form {from, to, date, time, seats, note?}
           → POST /api/cabshare (VTOP-verified — only current hostellers may post)
           → row appears in SearchTrips for peers to browse
```

## 2. Matching (client-side)

- reads visible trips from a shared table
- groups by route similarity + time proximity
- card shows price/seats/time/pickup/drop
- no location is pinpointed on maps — approximate stops only

## 3. Accept flow

Tap Request → poster sees requester's handle (never contact info) → poster accepts → both see each other's preferred contact (if provided on accept screen)

## 4. Storage

`cabshare_trips`, `cabshare_my_trips` (local-only copies) — server reload is always on entry; the
local store exists so "My Trips" works offline.
