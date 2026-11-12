# Attendance — Data Model (precise shapes)

## VTOP payload (as the API ships it)

```json
{
  "success": true,
  "attRes": {
    "attendance": [
      {
        "courseCode": "21CSE1001",
        "courseTitle": "Data Structures",
        "category": "Theory",
        "totalClasses": 36,
        "attendedClasses": 29,
        "lastAttended": "2026-11-06"
      }
    ]
  },
  "marksRes": { "courses": [/* per-assessment breakdown — see marks model */] }
}
```

Types: `types/data/attendance.d.ts` (singles: `courseItem`) and consumed opaquely elsewhere.

## Client-side state (atoms)

- `attendanceDataAtom: { attendance: CourseRow[] } | null`
- `attendancePercentageAtom: number` (derived — recompute on every write; never stored raw)
- `odHoursDataAtom: { wastedODs, effectiveODs, computed }`

## localStorage (persistent truth for boot)

`storage.attendance` — the raw payload; boot re-seeds atoms before first paint of the tab.
Corrupted shapes fall back to `null` → tab shows the empty state; never crashes.

## Calendar types

`calendarDataAtom: CalendarInput` — `{ events: CalendarEvent[], semester, type }` with
`CalendarEvent = { dateKey, title, class: "holiday" | "instructional" | "cat" | "fat" | "manual", endDate?, venue? }`.
All events are normalized into `dateKey` strings at the parser boundary — comparing Dates elsewhere is a bug.
