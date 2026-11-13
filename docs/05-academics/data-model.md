# Academics — Data Model (precise shapes)

## `allGradesDataAtom` (permanent — survives refresh)

```ts
type AllGrades = {
  grades: Record<
    string /* semesterId like "CH20252602" */,
    {
      gpa?: { gpa?: number | string } | number;
      grades: GradeBreakdown[];
    }
  >;
};
```

`GradeBreakdown` (types/data/allgrades.d.ts): `{ courseCode, courseTitle, courseType, credits,
creditsEarned, grade, gradePoints?, effective?{ …same fields…, distributionType, examMonth,
resultDeclared } }`.

## `marksDataAtom` (current semester only)

```ts
type MarksPayload = {
  success: boolean;
  courses: Array<{
    courseCode;
    courseTitle;
    courseType;
    marks: Array<{
      assessment;
      component;
      obtained;
      maximum;
      weightage?;
      category?;
      catNo?;
    }>;
  }>;
};
```

Component names come from VTOP strings — "Assignment 1", "FAT", "LabFAT", "Quiz 2" — raw, un-normalized;
`examSeries.ts` handles series normalization for CAT/FAT only.

## `scheduleDataAtom` — exam schedule (from the FFCS bundle)

```ts
type ExamSchedule = {
  CAT?: ExamItem[];
  FAT?: ExamItem[];
  [series: string]: ExamItem[]; // CAT/FAT open
};
type ExamItem = {
  courseCode;
  courseTitle;
  classId;
  slot;
  examDate;
  examSession;
  reportingTime;
  examTime;
  venue;
  seatLocation;
  seatNo;
};
```

## Date handling

All dates in this payload are _strings_ in `dd-MMM-yyyy` or `MM/dd/yyyy` from VTOP — every
comparator in `examSchedule.ts` parses them once, never in render.
