# AmazeCC Types Documentation

> This document was automatically generated to assist in translating and understanding the codebase.

Total Files: 14

---

## File: `AmazeCC\src\types\components\props.d.ts`

### Source Code
<details><summary>Click to view full source code</summary>

```typescript

```
</details>

---

## File: `AmazeCC\src\types\custom.d.ts`

### Exports
```typescript
export interface RequestBody {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
declare module 'cheerio';
declare module 'p-limit';

export interface RequestBody {
    cookies: string[] | string;
    dashboardHtml: string,
    semesterId?: string;
}
```
</details>

---

## File: `AmazeCC\src\types\data\allgrades.d.ts`

### Exports
```typescript
export type GradeBreakdown = {
export type GradeRange = {
export type GradeItem = {
export type SemesterGradeResult = {
export type GradeResultsMap = Record<string, SemesterGradeResult>;
export type SettledSemesterResult =
export type AllGradesRes = {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export type GradeBreakdown = {
    slNo: string;
    component: string;
    maxMark: string;
    weightagePercent: string;
    status: string;
    scoredMark: string;
    weightageMark: string;
};

export type GradeRange = {
    S: string;
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
    F: string;
} | null;

export type GradeItem = {
    slNo: string;
    courseCode: string;
    courseTitle: string;
    courseType: string;
    grandTotal: string;
    grade: string;
    courseId: string | null;
    details?: GradeBreakdown[] | null;
    range?: GradeRange;
};

export type SemesterGradeResult = {
    gpa: string | null;
    grades: GradeItem[];
} | null;

export type GradeResultsMap = Record<string, SemesterGradeResult>;

export type SettledSemesterResult =
    | { status: "fulfilled"; value: SemesterGradeResult }
    | { status: "rejected"; reason: any };

export type AllGradesRes = {
    semesterId?: string;
    grades?: GradeResultsMap;
    error?: string;
};
```
</details>

---

## File: `AmazeCC\src\types\data\attendance.d.ts`

### Exports
```typescript
export type courseItem = {
export type attendanceItem = {
export type attendanceRes = {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export type courseItem = {
    slNo: string,
    course: string,
    courseCode: string,
    LTPJC: string,
    category: string,
    classId: string,
    slotVenue: string,
    facultyDetails: string,
}

type detailed = {
    date: string,
    status: string
}

export type attendanceItem = {
    slNo: string,
    courseCode: string,
    courseTitle: string,
    courseType: string,
    slotName: string,
    faculty: string,
    registrationDate: string,
    attendanceDate: string,
    attendedClasses: number,
    totalClasses: number,
    attendancePercentage: string,
    viewLink: string | detailed[] | null,
    classId?: string | null,
    credits?: string | null,
    slotVenue?: string | null,
    category?: string | null,
}

export type attendanceRes = {
    semesterId?: string,
    attendance?: attendanceItem[],
    error?: string,
}

type ODEntry = {
  title: string;
  type: "LAB" | "TH";
  hours: number;
};

type ODListItem = {
  date: string;
  courses: ODEntry[];
  total: number;
};

type ODListRaw = {
  [date: string]: ODEntry[];
};
```
</details>

---

## File: `AmazeCC\src\types\data\eventhub.ts`

### Exports
```typescript
export interface EventHubEvent {
export interface EventHubPreview {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export interface EventHubEvent {
    eid: string;
    title: string;
    eligibility: string;
    type: string;
    date: string;
    location: string;
    price: string;
    time?: string;
    registeredDetails?: any;
    isPastEvent?: boolean;
}

export interface EventHubPreview {
    eid: string;
    imageSrc?: string;
    description?: string;
    metaDetails?: Record<string, string>;
}

```
</details>

---

## File: `AmazeCC\src\types\data\grades.d.ts`

### Exports
```typescript
export type EffectiveGrade = {
export type CurriculumItem = {
export type CGPA = {
export type FeedbackStatus = {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export type EffectiveGrade = {
  basketTitle: string;
  distributionType: string;
  creditsRequired: string;
  creditsEarned: string;
}

export type CurriculumItem = {
  basketTitle: string;
  creditsRequired: string;
  creditsEarned: string;
}

type GradeCounts = {
  S?: number;
  A?: number;
  B?: number;
  C?: number;
  D?: number;
  E?: number;
  F?: number;
  N?: number;
}

export type CGPA = {
  grades?: GradeCounts;
}

type feedbackCategoryStatus = {
  Curriculum: boolean;
  Course: boolean;
}

export type FeedbackStatus = {
  MidSem: feedbackCategoryStatus;
  EndSem: feedbackCategoryStatus;
}
```
</details>

---

## File: `AmazeCC\src\types\data\hostel.d.ts`

### Exports
```typescript
export type hostel = {
export type leaveItem = {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export type hostel = {
    gender?: string,
    isHosteller?: boolean,
    blockName?: string,
    roomNo?: string,
    messInfo?: string,
}

export type leaveItem = {
    leaveId?: string,
    visitPlace?: string,
    reason?: string,
    leaveType?: string,
    from?: string,
    to?: string,
    status?: string,
    remarks?: string,
}
```
</details>

---

## File: `AmazeCC\src\types\data\login.d.ts`

### Exports
```typescript
export type CaptchaType = "GRECAPTCHA" | "DEFAULT";
export type CaptchaResponse = {
export type CaptchaResponseError = {
export type CaptchaResult = CaptchaResponse | CaptchaResponseError;
export interface LoginRequestBody {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export type CaptchaType = "GRECAPTCHA" | "DEFAULT";

export type CaptchaResponse = {
    captchaType: CaptchaType;
    captchaBase64: string;
    cookies: string[];
    csrf: string;
}

export type CaptchaResponseError = {
    error: string;
}

export type CaptchaResult = CaptchaResponse | CaptchaResponseError;

export interface LoginRequestBody {
  username: string;
  password: string;
  captcha: string;
  csrf: string;
  cookies: string[];
}
```
</details>

---

## File: `AmazeCC\src\types\data\marks.d.ts`

### Exports
```typescript
export type CourseItem = {
export type AssessmentItem = {
export type CGPA = {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export type CourseItem = {
    slNo: string;
    classNbr: string;
    courseCode: string;
    courseTitle: string;
    courseType: string;
    courseSystem: string;
    credits?: number | string;
    faculty: string;
    slot: string;
    courseMode: string;
    assessments: AssessmentItem[];
};

export type AssessmentItem = {
    slNo: string;
    title: string;
    maxMark: string;
    weightagePercent: string;
    status: string;
    scoredMark: string;
    weightageMark: string;
};

export type CGPA = {
    creditsRequired?: string;
    creditsEarned?: string;
    cgpa?: string;
    nonGradedRequirement?: string;
};
```
</details>

---

## File: `AmazeCC\src\types\data\schedule.d.ts`

### Exports
```typescript
export interface ExamItem {
export type Schedule = Record<string, ExamItem[]>
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export interface ExamItem {
    courseCode: string,
    courseTitle: string,
    classId: string,
    slot: string,
    examDate: string,
    examSession: string,
    reportingTime: string,
    examTime: string,
    venue: string,
    seatLocation: string,
    seatNo: string,
}

export type Schedule = Record<string, ExamItem[]>
```
</details>

---

## File: `AmazeCC\src\types\data\semTT.d.ts`

### Imports
```typescript
import { RequestBody } from "../custom";
```

### Exports
```typescript
export type CalendarType =
export interface CalendarEvent {
export interface CalendarDay {
export interface CalendarMonth {
export interface HolidayEvent extends CalendarEvent {
export type ParsedCalendarFn = (html: string) => Promise<CalendarMonth>;
export type AddHolidayFn = (
export interface CalendarRequestBody extends RequestBody {
export type CalendarInput = {
export type AnalyzedDay = {
export type CalendarSummary = {
export type CalendarResult = {
export type ImportantEvent = {
export type AnalyzeCalendarReturn = {
export type AnalyzeAllCalendarsReturn = {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { RequestBody } from "../custom";

export type CalendarType =
    | "ALL"
    | "ALL02"
    | "ALL03"
    | "ALL05"
    | "ALL06"
    | "ALL08"
    | "ALL11"
    | "WEI";

export interface CalendarEvent {
    type: "Instructional Day" | "Holiday" | "Other";
    text: string;
    color?: string;
    category: string;
}

export interface CalendarDay {
    date: number;
    events: CalendarEvent[];
}

export interface CalendarMonth {
    month: string;
    days: CalendarDay[];
}

export interface HolidayEvent extends CalendarEvent {
    text: string;
    type: "Holiday";
    color: string;
    category?: string;
}

export type ParsedCalendarFn = (html: string) => Promise<CalendarMonth>;

export type AddHolidayFn = (
    calendar: CalendarMonth,
    dayNum: number,
    eventObj: HolidayEvent
) => void;

export interface CalendarRequestBody extends RequestBody {
    type: CalendarType;
}

export type CalendarInput = {
    year?: number | string;
    month?: number | string;
    totalDays?: number;
    days?: CalendarDay[];
};

export type AnalyzedDay = {
    date: number;
    weekday: string;
    type: "working" | "holiday" | "other";
    events: CalendarEvent[];
};

export type CalendarSummary = {
    total: number;
    working: number;
    holiday: number;
    other: number;
};

export type CalendarResult = {
    month: string | number;
    year: number;
    days: AnalyzedDay[];
    summary: CalendarSummary;
};

export type ImportantEvent = {
    event: string;
    date: number;
    weekday: string;
    month: string | number;
    year: number;
    formattedDate: Date;
};

export type AnalyzeCalendarReturn = {
    result: CalendarResult;
    importantEvents: Map<string, ImportantEvent>;
};

export type AnalyzeAllCalendarsReturn = {
    results: CalendarResult[];
    importantEvents: Map<string, ImportantEvent>;
};
```
</details>

---

## File: `AmazeCC\src\types\global.d.ts`

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
declare module '*.css';
declare module "swiper/css";
declare module "swiper/css/mousewheel";
declare module "swiper/css/free-mode";
declare module "multer";

type Matrix = number[][];
type Vector = number[];
```
</details>

---

## File: `AmazeCC\src\types\qbank.types.ts`

### Exports
```typescript
export interface QBankCourse {
export interface QBankPaper {
export interface QBankQuestion {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export interface QBankCourse {
  code: string;
  title: string;
}

export interface QBankPaper {
  source_id: string;
  title: string;
  file_url: string;
  source_type: string;
  exam_semester: string;
  exam_year: string;
  course_code: string;
}

export interface QBankQuestion {
  question_id: string;
  question_text: string;
  question_type: 'MCQ' | 'Descriptive' | string;
  options?: Record<string, string>;
  correct_answer?: string;
  marks?: number;
  topic_name?: string;
  source_type?: string;
  exam_semester?: string;
  exam_year?: string;
  image_url?: string;
}

```
</details>

---

## File: `AmazeCC\src\types\transport.ts`

### Exports
```typescript
export interface BusStop {
export interface BusPlacement {
export interface BusRoute {
export interface TransportData {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export interface BusStop {
  stopOrder: number;
  stopName: string;
  pickupTime?: string;
}

export interface BusPlacement {
  zone: string;
  dispersalTime: string;
}

export interface BusRoute {
  id: string;
  type: string;
  route: string;
  boardingPoints: string[];
  driverPhone: string;
  driverName: string;
  whatsappGroup: string;
  busLocation: string;
  supervisorName?: string;
  supervisorPhone?: string;
  driverInchargeName?: string;
  driverInchargePhone?: string;
  stops?: BusStop[];
  placements?: BusPlacement[];
}

export interface TransportData {
  hasRegistration: boolean;
  registerNumber?: string;
  name?: string;
  programme?: string;
  branch?: string;
  routeSelected?: string;
  fpReference?: string;
  paymentStatus?: string;
  busRouteId?: string;
  qrCode?: string;
  pageCsrf?: string;
}

```
</details>

---

