---
title: "Free Classrooms — Data Model (precise)"
---

# Free Classrooms — Data Model (precise)

```ts
FreeRoomCourse = { roomId, slot, type: "TH"|"LAB"|"THEORY_LAB", facultyHint?: string }
RoomOccupancy = {
  rooms: Array<{ room: string, status: "free" | "occupied" | "unknown", source: "client"|"server" }>,
  silentFailures: string[],
}
```

`slot → periodBand[]` mapping via `pointsForSlot()` in slots.ts; clash semantics via `periodListsClash()`.

Campus table is bundled as data — the bundle references it; no runtime fetch — but the VIT PDF snapshot
passes through `parseCourseRows` at import time to build the internal index.
