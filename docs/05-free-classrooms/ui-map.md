---
title: "Free Classrooms — UI Map"
---

# Free Classrooms — UI Map

| File                          | ~Lines | Job                                                      |
| ----------------------------- | ------ | -------------------------------------------------------- |
| `tools/FreeClassroomsTab.tsx` | ~1,000 | tab entry — period picker, building filter, results grid |
| `exams/ClassDetailsModal.tsx` | ~600   | occupant detail sheet (no names; class & slot)           |

Everything else lives in `lib/freeClassrooms.ts`, `lib/roomAvailability.ts`, `lib/roomMerge.ts`,
`lib/slots.ts` — the UI is intentionally dumb; the math is the feature.
