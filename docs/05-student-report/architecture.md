---
title: "Student Report — Architecture (deep)"
description: "a personal academic report — attendance, marks, grades, predictions, timetable — generated into a single PDF entirely on-device."
---

# Student Report — Architecture (deep)

> **In one line:** a personal academic report — attendance, marks, grades, predictions, timetable — generated into a single PDF entirely on-device.

## 1. Input surface (all atoms, zero network)

```
profile (name/reg)     attendanceDataAtom    marksDataAtom    allGradesDataAtom
marksPredictor results scheduleDataAtom       task reminder    officialOdAtom?
calendarDataAtom       settings (cgpa goal?)
```

## 2. Calculation merge (grade-weighted)

Per-semester GPA → total CGPA (credits-weighted) matches the VIT convention; used in report header.

## 3. Report generator (`lib/studentReportPdf.ts`)

jsPDF pipeline: cover page → per-semester section (table: course, credits, grade, effective) →
attandance summary → next-step recommendations (attendance gaps, predicted FAT distances) —
PDF streams to blob download; no server contacted.

## 4. Privacy

Everything computes in-memory in your tab; nothing is uploaded; the PDF binary never crosses the wire — not even base64 in a hidden field.
