---
title: "Free Classrooms — Storage & State"
---

# Free Classrooms — Storage & State

> Nothing persisted; every open is a fresh read.

Slot tables live in the bundle. Server occupancy is requested op-on-demand via the `roomAvailability` op
(auth: vtop) — result kept in component memory for the tab's lifetime. No atoms, no localStorage keys,
no sync participation. Deliberately: occupancy changes by the minute; yesterday's cached answer is worse
than no answer.
