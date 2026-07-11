# AmazeCC Logic Core Documentation

> This document was automatically generated to assist in translating and understanding the codebase.

Total Files: 18

---

## File: `AmazeCC\src\lib\activit-tree.ts`

### Exports
```typescript
export interface dayNode {
export interface monthNode {
export interface yearNode {
export interface HeatMapEntry {
export class ActivityTree {
export function loadActivityTree(): ActivityTree {
export function saveActivityTree(activityTree: ActivityTree): void {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export interface dayNode {
    day: number;
    count: number;
}

export interface monthNode {
    month: number;
    days: Record<number, dayNode>;
}

export interface yearNode {
    year: number;
    months: Record<number, monthNode>;
}

export interface HeatMapEntry {
    date: string;
    count: number;
}

export class ActivityTree {
    years: Record<number, yearNode> = {};

    constructor(initialData?: Record<number, yearNode>) {
        if (initialData) {
            this.years = initialData;
        }
    }

    increment(date: Date = new Date()): void {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        if (!this.years[year]) {
            this.years[year] = { year, months: {} };
        }
        if (!this.years[year].months[month]) {
            this.years[year].months[month] = { month, days: {} };
        }
        if (!this.years[year].months[month].days[day]) {
            this.years[year].months[month].days[day] = { day, count: 0 };
        }
        this.years[year].months[month].days[day].count++;
    }

    toHeatMap(): HeatMapEntry[] {
        const heatMap: HeatMapEntry[] = [];

        for (const yearKey in this.years) {
            const yearNode = this.years[parseInt(yearKey)];

            for (const monthKey in yearNode.months) {
                const monthNode = yearNode.months[parseInt(monthKey)];
                for (const dayKey in monthNode.days) {
                    const dayNode = monthNode.days[parseInt(dayKey)];

                    const d = `${yearNode.year}/${monthNode.month}/${dayNode.day}`;
                    heatMap.push({ date: d, count: dayNode.count });
                }
            }
        }
        return heatMap;
    }
}

export function loadActivityTree(): ActivityTree {
    const data = localStorage.getItem("activityTree");
    if (data) {
        return new ActivityTree(JSON.parse(data));
    }
    return new ActivityTree();
}

export function saveActivityTree(activityTree: ActivityTree): void {
    localStorage.setItem("activityTree", JSON.stringify(activityTree.years));
}
```
</details>

---

## File: `AmazeCC\src\lib\analyzeCalendar.ts`

### Imports
```typescript
import { AnalyzeAllCalendarsReturn, AnalyzeCalendarReturn, AnalyzedDay, CalendarEvent, CalendarInput, CalendarResult, ImportantEvent } from "@/types/data/semTT";
import { eachDayOfInterval, endOfMonth, getDay } from "date-fns";
```

### Exports
```typescript
export function analyzeCalendar(calendar: CalendarInput = {}): AnalyzeCalendarReturn {
export function analyzeAllCalendars(calendars: unknown): AnalyzeAllCalendarsReturn {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { AnalyzeAllCalendarsReturn, AnalyzeCalendarReturn, AnalyzedDay, CalendarEvent, CalendarInput, CalendarResult, ImportantEvent } from "@/types/data/semTT";
import { eachDayOfInterval, endOfMonth, getDay } from "date-fns";

const HOLIDAY_KEYWORDS = [
    "holiday", "pooja", "puja", "ayudha", "diwali", "pongal", "eid", "christmas", "good friday",
    "independence", "republic", "onam", "holi", "ramadan", "ganesh", "maha shivaratri", "vesak",
    "vacation", "term end", "no instructional", "noinstructional",
];

function normalize(str = ""): string {
    return String(str).toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

function isHolidayEvent(e: CalendarEvent): boolean {
    if (!e) return false;
    const type = String(e.type || "").toLowerCase();
    const text = normalize(e.text || "");
    const cat = normalize(e.category || "");
    if (type.includes("holiday")) return true;
    if (type.includes("no instructional")) return true;
    if (cat.includes("no instructional")) return true;
    for (const kw of HOLIDAY_KEYWORDS) {
        if (text.includes(kw) || cat.includes(kw)) return true;
    }
    return false;
}

function isInstructionalEvent(e: CalendarEvent): boolean {
    if (!e) return false;
    const type = String(e.type || "").toLowerCase();
    const cat = normalize(e.category || "");
    if (type === "instructional day") return true;
    if (cat.includes("working")) return true;
    return false;
}

const MONTH_NAME_MAP: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function analyzeCalendar(calendar: CalendarInput = {}): AnalyzeCalendarReturn {
    const now = new Date();

    // ---- YEAR ----
    let year = Number(String(calendar.month ?? "").split(" ").pop()) || Number(calendar.year);
    if (!Number.isFinite(year)) year = now.getFullYear();

    // ---- MONTH ----
    let monthIndex: number;
    try {
        const mRaw = calendar.month;
        if (mRaw == null) monthIndex = now.getMonth();
        else if (typeof mRaw === "number") {
            if (mRaw >= 1 && mRaw <= 12) monthIndex = mRaw - 1;
            else if (mRaw >= 0 && mRaw <= 11) monthIndex = mRaw;
            else monthIndex = now.getMonth();
        } else {
            const s = String(mRaw).trim();
            const n = Number(s);
            if (!Number.isNaN(n)) {
                monthIndex = n >= 1 && n <= 12 ? n - 1 : now.getMonth();
            } else {
                const parsed = Date.parse(`${s} 1, ${year}`);
                monthIndex = !Number.isNaN(parsed)
                    ? new Date(parsed).getMonth()
                    : MONTH_NAME_MAP[s.toLowerCase().slice(0, 3)] ?? now.getMonth();
            }
        }
    } catch {
        monthIndex = now.getMonth();
    }

    // ---- DATES ----
    let monthStart = new Date(year, monthIndex, 1);
    let daysInMonth: Date[] = [];
    try {
        const monthEnd = endOfMonth(monthStart);
        daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    } catch {
        const totalDays = Number(calendar.totalDays) || 31;
        daysInMonth = Array.from({ length: totalDays }, (_, i) => new Date(year, monthIndex, i + 1));
    }

    // ---- DAY LABELS ----
    const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    // ---- OUTPUT ----
    const result: CalendarResult = {
        month: calendar.month ?? monthStart.toLocaleString(undefined, { month: "long" }),
        year,
        days: [],
        summary: {
            total: daysInMonth.length,
            working: 0,
            holiday: 0,
            other: 0,
        },
    };

    for (const dateObj of daysInMonth) {
        const date = dateObj.getDate();
        const dayName = weekdayNames[dateObj.getDay()];
        const dayInfo = Array.isArray(calendar.days)
            ? calendar.days.find((d) => Number(d.date) === date)
            : undefined;

        const events = dayInfo?.events || [];

        const hasHoliday = events.some(isHolidayEvent);
        const hasInstructional = events.some(isInstructionalEvent);
        const isEmpty = events.length === 0;

        let dayType: AnalyzedDay["type"] = "other";
        if (hasHoliday || isEmpty || (!hasInstructional && events.length > 0)) dayType = "holiday";
        else if (hasInstructional) dayType = "working";

        result.days.push({
            date,
            weekday: dayName,
            type: dayType,
            events,
        });

        result.summary[dayType]++;
    }

    const IMPORTANT_EVENT_NAMES = [
        { key: "cat i", display: "CAT I" },
        { key: "cat ii", display: "CAT II" },
        {
            key: "lid for laboratory classes",
            display: "LID FOR LABORATORY CLASSES",
            aliases: ["lid for lab"],
        },
        { key: "lid for theory classes", display: "LID FOR THEORY CLASSES" },
        { key: "mid term test", display: "MID TERM TEST" },
    ];

    const importantEvents = new Map<string, ImportantEvent>();

    for (const day of result.days) {
        for (const ev of day.events) {
            const text = normalize(ev.text || "");
            for (const { key, display, aliases = [] } of IMPORTANT_EVENT_NAMES) {
                const matched = text.includes(key) || aliases.some((alias) => text.includes(alias));
                if (matched && !importantEvents.has(key)) {
                    const monthIndex = [
                        "january", "february", "march", "april", "may", "june",
                        "july", "august", "september", "october", "november", "december"
                    ].findIndex((m) => String(result.month).toLowerCase().includes(m));
                    importantEvents.set(key, {
                        event: display,
                        date: day.date,
                        weekday: day.weekday,
                        month: result.month,
                        year: result.year,
                        formattedDate: new Date(result.year, monthIndex, day.date),
                    });
                }
            }
        }
    }
    return { result, importantEvents };
}

export function analyzeAllCalendars(calendars: unknown): AnalyzeAllCalendarsReturn {
    if (!calendars) return { results: [], importantEvents: new Map() };

    const calArray: CalendarInput[] = Array.isArray(calendars)
        ? calendars
        : (calendars as any).calendars
            ? (calendars as any).calendars
            : [calendars];

    const results: CalendarResult[] = [];
    const importantEvents = new Map<string, ImportantEvent>();

    for (const cal of calArray) {
        const { result, importantEvents: imp } = analyzeCalendar(cal);
        results.push(result);
        for (const [key, val] of imp.entries()) {
            if (!importantEvents.has(key)) importantEvents.set(key, val);
        }
    }

    return { results, importantEvents };
}

```
</details>

---

## File: `AmazeCC\src\lib\attendanceTimetable.ts`

### Imports
```typescript
import config from "../../config.json";
```

### Exports
```typescript
export const ATTENDANCE_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
export type AttendanceDay = (typeof ATTENDANCE_DAYS)[number];
export type AttendanceDayCardsMap = Record<AttendanceDay, any[]>;
export function parseAttendanceTime(timeStr: string) {
export function getAttendanceTimeRange(time: string) {
export function getTodayAttendanceDay(date = new Date()): AttendanceDay {
export function buildAttendanceDayCardsMap(
export function getTodayAttendanceClasses(
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import config from "../../config.json";

export const ATTENDANCE_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export type AttendanceDay = (typeof ATTENDANCE_DAYS)[number];
export type AttendanceDayCardsMap = Record<AttendanceDay, any[]>;

export function parseAttendanceTime(timeStr: string) {
  let [h, m] = timeStr.trim().split(":").map(Number);
  if (h < 8) h += 12;
  return h * 60 + (m || 0);
}

export function getAttendanceTimeRange(time: string) {
  const [start, end] = time.split("-").map((t) => t.trim());
  return {
    start: parseAttendanceTime(start),
    end: parseAttendanceTime(end),
  };
}

export function getTodayAttendanceDay(date = new Date()): AttendanceDay {
  const days: AttendanceDay[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  return days[date.getDay()];
}

export function buildAttendanceDayCardsMap(
  attendance: any[] = [],
  slotMap: any = (config as any).slotMap
): AttendanceDayCardsMap {
  const map = ATTENDANCE_DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {} as AttendanceDayCardsMap);

  attendance.forEach((course) => {
    const slots = String(course?.slotName || "")
      .split("+")
      .map((slot) => slot.trim())
      .filter(Boolean);

    slots.forEach((cleanSlot) => {
      ATTENDANCE_DAYS.forEach((day) => {
        const info = slotMap?.[day]?.[cleanSlot];
        if (!info) return;

        const pct = parseInt(course.attendancePercentage);
        const cls = pct < 50 ? "low" : pct < 75 ? "medium" : "high";

        map[day].push({
          ...course,
          courseCode: course.courseCode,
          slotName: cleanSlot,
          time: info.time,
          cls,
        });
      });
    });
  });

  ATTENDANCE_DAYS.forEach((day) => {
    map[day].sort((a, b) => {
      const timeA = getAttendanceTimeRange(a.time);
      const timeB = getAttendanceTimeRange(b.time);
      if (timeA.start !== timeB.start) return timeA.start - timeB.start;
      return String(a.slotName).localeCompare(String(b.slotName), undefined, { numeric: true });
    });

    const merged: any[] = [];
    for (const current of map[day]) {
      const previous = merged[merged.length - 1];

      if (
        previous &&
        previous.courseTitle === current.courseTitle &&
        previous.courseType === current.courseType &&
        previous.faculty === current.faculty &&
        previous.cls === current.cls
      ) {
        const previousRange = getAttendanceTimeRange(previous.time);
        const currentRange = getAttendanceTimeRange(current.time);
        const gapInMinutes = currentRange.start - previousRange.end;

        if (gapInMinutes >= 0 && gapInMinutes <= 5) {
          previous.slotName = `${previous.slotName}+${current.slotName}`;
          previous.time = `${previous.time.split("-")[0]}-${current.time.split("-")[1]}`;
          continue;
        }
      }

      merged.push({ ...current });
    }

    merged.sort((a, b) => parseAttendanceTime(a.time.split("-")[0]) - parseAttendanceTime(b.time.split("-")[0]));
    map[day] = merged;
  });

  return map;
}

export function getTodayAttendanceClasses(
  attendance: any[] = [],
  date = new Date(),
  slotMap: any = (config as any).slotMap
) {
  const dayCardsMap = buildAttendanceDayCardsMap(attendance, slotMap);
  return dayCardsMap[getTodayAttendanceDay(date)] || [];
}

```
</details>

---

## File: `AmazeCC\src\lib\auth.ts`

### Imports
```typescript
import { API_BASE, fetchWithTimeout } from "./fetch-utils";
```

### Exports
```typescript
export interface LoginCredentials {
export async function loginToVTOP(
export function clearCachedCredentials(): void {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { API_BASE, fetchWithTimeout } from "./fetch-utils";

let globalLoginPromise: Promise<{ cookies: string[]; authorizedID: string; csrf: string }> | null = null;
let cachedVTOPCredentials: { cookies: string[]; authorizedID: string; csrf: string } | null = null;

export interface LoginCredentials {
  cookies: string[];
  authorizedID: string;
  csrf: string;
}

export async function loginToVTOP(
  ids: { VtopUsername: string; VtopPassword: string },
  demoMode: boolean,
  retry = false,
  forceNew = false,
  onProgress?: (msg: string, progress: number) => void,
): Promise<LoginCredentials> {
  if (demoMode || ids.VtopUsername === "demo") {
    return { cookies: [], authorizedID: "DEMO123", csrf: "" };
  }
  if (cachedVTOPCredentials && !forceNew && !retry) return cachedVTOPCredentials;
  if (globalLoginPromise) return globalLoginPromise;

  globalLoginPromise = (async () => {
    try {
      onProgress?.("Logging in and fetching data...", 10);
      const loginRes = await fetchWithTimeout(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: ids.VtopUsername,
          password: ids.VtopPassword,
        }),
      }, 60000);

      const data = await loginRes.json();

      if (data.message?.includes("Invalid Captcha") && !retry) {
        globalLoginPromise = null;
        return loginToVTOP(ids, demoMode, true, forceNew, onProgress);
      }

      if (!data.success || !data.authorizedID || !data.cookies)
        throw new Error(data.message || "Login failed.");

      onProgress?.("Login successful", 40);

      cachedVTOPCredentials = {
        cookies: data.cookies,
        authorizedID: data.authorizedID,
        csrf: data.csrf,
      };
      return cachedVTOPCredentials;
    } finally {
      globalLoginPromise = null;
    }
  })();
  return globalLoginPromise;
}

export function clearCachedCredentials(): void {
  cachedVTOPCredentials = null;
  globalLoginPromise = null;
}

```
</details>

---

## File: `AmazeCC\src\lib\data-fetchers.ts`

### Imports
```typescript
import { API_BASE, fetchWithTimeout } from "./fetch-utils";
import { storage } from "./storage";
import { loginToEventHub } from "./event-hub";
import type { LoginCredentials } from "./auth";
```

### Exports
```typescript
export interface AttendanceVerifyResult {
export async function fetchAttendanceAndMarks(
export interface CoreDataResult {
export async function fetchCoreData(
export interface EventDataResult {
export async function fetchEventData(
export async function fetchStudentProfile(
export async function fetchPastAttendance(
export async function fetchFresherData(creds: LoginCredentials): Promise<void> {
export async function fetchBusRoutes(): Promise<void> {
export async function fetchBulkEndpoints(
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { API_BASE, fetchWithTimeout } from "./fetch-utils";
import { storage } from "./storage";
import { loginToEventHub } from "./event-hub";
import type { LoginCredentials } from "./auth";

async function apiPost(path: string, body: unknown): Promise<Response> {
  return fetchWithTimeout(`${API_BASE}/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export interface AttendanceVerifyResult {
  attRes: object;
  marksRes: object;
}

export async function fetchAttendanceAndMarks(
  creds: LoginCredentials,
  currSemesterID: string,
): Promise<AttendanceVerifyResult> {
  const res = await apiPost("attendance", {
    cookies: creds.cookies,
    authorizedID: creds.authorizedID,
    csrf: creds.csrf,
    semesterId: currSemesterID,
  });
  const data = await res.json();

  if (!data.attRes || !data.attRes.attendance) {
    throw new Error("Session verification failed. Please try again.");
  }
  if (data.marksRes && typeof data.marksRes === "string") {
    throw new Error(`Marks fetch failed: ${data.marksRes}`);
  }

  return { attRes: data.attRes as object, marksRes: data.marksRes as object };
}

export interface CoreDataResult {
  gradesRes: object;
  scheduleRes: object;
  hostelRes: object;
  calendarRes: object;
  allGradesRes: object;
  profileImagesRes: object | null;
}

export async function fetchCoreData(
  creds: LoginCredentials,
  currSemesterID: string,
  calendarType: string,
  isHosteller: boolean,
): Promise<CoreDataResult> {
  const [gradesRes, scheduleRes, hostelRes, calendarRes, allGradesRes, profileImagesRes] = await Promise.all([

    apiPost("grades", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, semesterId: currSemesterID }).then(r => r.json()),

    apiPost("schedule", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, semesterId: currSemesterID }).then(r => r.json()),

    isHosteller
      ? apiPost("hostel", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }).then(r => r.json())
      : Promise.resolve({}),

    apiPost("calendar", {
      cookies: creds.cookies,
      authorizedID: creds.authorizedID,
      csrf: creds.csrf,
      type: calendarType || "ALL",
      semesterId: currSemesterID,
    }).then(r => r.json()),

    apiPost("all-grades", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }).then(r => r.json()),

    apiPost("profile-images", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf })
      .then(async r => {
        if (!r.ok) return null;
        const j = await r.json();
        if (j?.success) {
          storage.profileImages.set(j);
          return j;
        }
        return null;
      })
      .catch(() => null),
  ]);

  storage.grades.set(gradesRes);
  storage.schedule.set(scheduleRes);
  storage.hostel.set(hostelRes);
  storage.calendar.set(calendarRes);
  storage.allGrades.set(allGradesRes);

  return { gradesRes: gradesRes as object, scheduleRes: scheduleRes as object, hostelRes: hostelRes as object, calendarRes: calendarRes as object, allGradesRes: allGradesRes as object, profileImagesRes: profileImagesRes as object | null };
}

export interface EventDataResult {
  registeredEvents: unknown[];
  eventHubEvents: unknown[];
}

export async function fetchEventData(
  ids: { VtopUsername: string; VtopPassword: string },
  demoMode: boolean,
): Promise<EventDataResult> {
  const [eventsRes, publicEvents] = await Promise.all([
    (async () => {
      try {
        const jsessionid = await loginToEventHub(ids, demoMode);
        if (!jsessionid) return { events: [] };
        const r = await fetchWithTimeout(`${API_BASE}/api/events/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsessionid }),
        });
        if (!r.ok) return { events: [] };
        return await r.json();
      } catch {
        return { events: [] };
      }
    })(),
    fetch(`${API_BASE}/api/events`)
      .then(async r => {
        if (!r.ok) return [];
        const events = await r.json();
        return Array.isArray(events) ? events : [];
      })
      .catch(() => []),
  ]);

  if (eventsRes?.events) storage.registeredEvents.set(eventsRes.events);

  return {
    registeredEvents: eventsRes?.events || [],
    eventHubEvents: publicEvents,
  };
}

export async function fetchStudentProfile(
  creds: LoginCredentials,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await apiPost("student", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf });
    const data = await res.json();
    if (data?.profile) {
      storage.profile.set(data.profile);
      return data.profile;
    }
  } catch {
    /* background fetch */
  }
  return null;
}

export async function fetchPastAttendance(
  creds: LoginCredentials,
  allGradesRes: { grades?: Record<string, unknown> },
  currSemesterID: string,
): Promise<void> {
  const pastSemesters = Object.keys(allGradesRes?.grades || {}).filter(sem => sem !== currSemesterID);
  if (pastSemesters.length === 0) return;

  await Promise.allSettled(
    pastSemesters.map(sem =>
      apiPost("attendance", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, semesterId: sem })
        .then(r => r.json())
        .then(data => {
          if (data?.attendance) {
            storage.frozenAttendance.set(sem, data);
          }
        })
        .catch(() => {})
    )
  );
}

export async function fetchFresherData(creds: LoginCredentials): Promise<void> {
  try {
    const [eptRes, ackRes] = await Promise.all([
      apiPost("ept-schedule", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }).then(r => r.json()),
      apiPost("acknowledgement", { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }).then(r => r.json()),
    ]);
    if (eptRes.success) storage.cache.set("ept_schedule", eptRes);
    if (ackRes.success) storage.cache.set("acknowledgement", ackRes);
  } catch {
    /* fail silently */
  }
}

export async function fetchBusRoutes(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/buses`);
    const data = await res.json();
    if (data.success) storage.cache.set("buses", data.buses);
  } catch {
    /* fail silently */
  }
}

type BulkSettings = {
  syncArrearData?: boolean;
  syncAdditionalData?: boolean;
  syncCourseOptionChange?: boolean;
  syncExcRegistration?: boolean;
  syncMinorHonour?: boolean;
  syncCourseCompletion?: boolean;
  syncWishlist?: boolean;
  syncAdditionalLearning?: boolean;
  syncProject?: boolean;
  syncProjectCourse?: boolean;
  syncExamData?: boolean;
  syncProfileData?: boolean;
};

export async function fetchBulkEndpoints(
  creds: LoginCredentials,
  settings: BulkSettings,
): Promise<void> {
  const bulkEndpoints: string[] = [];

  if (settings.syncArrearData !== false) {
    bulkEndpoints.push("arrear-schedule", "arrear-details", "arrear-grade");
  }
  if (settings.syncAdditionalData !== false) {
    if (settings.syncCourseOptionChange !== false) bulkEndpoints.push("course-option-change");
    if (settings.syncExcRegistration !== false) bulkEndpoints.push("exc-registration");
    if (settings.syncMinorHonour !== false) bulkEndpoints.push("minor-honour");
    if (settings.syncCourseCompletion !== false) bulkEndpoints.push("course-completion");
    if (settings.syncWishlist !== false) bulkEndpoints.push("wishlist");
    if (settings.syncAdditionalLearning !== false) bulkEndpoints.push("additional-learning");
    if (settings.syncProject !== false) bulkEndpoints.push("project");
    if (settings.syncProjectCourse !== false) bulkEndpoints.push("project-course");
  }
  if (settings.syncExamData !== false) {
    bulkEndpoints.push("makeup-exam", "makeup-schedule", "compre-info");
  }
  if (settings.syncProfileData !== false) {
    bulkEndpoints.push("credentials", "registration-schedule", "dayboarder", "bank-info", "library-due", "hostel-counselling");
  }

  await Promise.allSettled(
    bulkEndpoints.map(path =>
      apiPost(path, { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf })
        .then(r => r.json())
        .then(data => {
          if (data.success !== false) {
            storage.cache.set(path, data);
          }
        })
        .catch(() => {})
    )
  );
}

```
</details>

---

## File: `AmazeCC\src\lib\error-utils.ts`

### Exports
```typescript
export interface ReportErrorOptions {
export function reportError(err: unknown, options: ReportErrorOptions = {}): void {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
type ErrorLevel = "silent" | "log" | "warn" | "error";

export interface ReportErrorOptions {
  level?: ErrorLevel;
  userMessage?: string;
  context?: string;
}

export function reportError(err: unknown, options: ReportErrorOptions = {}): void {
  const { level = "error", userMessage, context } = options;
  const prefix = context ? `[${context}]` : "";
  const message = err instanceof Error ? err.message : String(err);

  switch (level) {
    case "silent":
      break;
    case "log":
      console.log(`${prefix} ${message}`, err);
      break;
    case "warn":
      console.warn(`${prefix} ${message}`, err);
      break;
    case "error":
    default:
      console.error(`${prefix} ${message}`, err);
      break;
  }

  if (userMessage) {
    // Could integrate with a toast/notification system here
  }
}

```
</details>

---

## File: `AmazeCC\src\lib\event-hub.ts`

### Imports
```typescript
import { API_BASE, fetchWithTimeout } from "./fetch-utils";
import { storage } from "./storage";
```

### Exports
```typescript
export function clearEventHubSession(): void {
export async function loginToEventHub(
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { API_BASE, fetchWithTimeout } from "./fetch-utils";
import { storage } from "./storage";

let cachedEventHubSession: string | null = storage.eventHubSession.get() ?? null;
let globalEventHubLoginPromise: Promise<string> | null = null;

export function clearEventHubSession(): void {
  cachedEventHubSession = null;
  globalEventHubLoginPromise = null;
  storage.eventHubSession.remove();
}

export async function loginToEventHub(
  IDs: { VtopUsername: string; VtopPassword: string },
  demoMode: boolean,
  forceNew = false,
): Promise<string> {
  if (demoMode || IDs.VtopUsername === "demo") return "";
  if (cachedEventHubSession && !forceNew) return cachedEventHubSession;
  if (globalEventHubLoginPromise) return globalEventHubLoginPromise;

  globalEventHubLoginPromise = (async () => {
    try {
      const res = await fetchWithTimeout(`${API_BASE}/api/events/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: IDs.VtopUsername, password: IDs.VtopPassword }),
      }, 30000);
      const data = await res.json();
      if (!data.success || !data.jsessionid) {
        throw new Error(data.error || "Event Hub login failed");
      }
      cachedEventHubSession = data.jsessionid;
      storage.eventHubSession.set(data.jsessionid);
      return data.jsessionid;
    } finally {
      globalEventHubLoginPromise = null;
    }
  })();
  return globalEventHubLoginPromise;
}

```
</details>

---

## File: `AmazeCC\src\lib\exportIcal.ts`

### Imports
```typescript
import { TimetableState, AddedCourse } from "@/components/custom/Exams/FFCS/types";
```

### Exports
```typescript
export function exportTimetableIcal(
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { TimetableState, AddedCourse } from "@/components/custom/Exams/FFCS/types";

// Helper to convert time like "8:00 AM" to "080000"
function formatIcalTime(timeStr: string): string {
  const [time, period] = timeStr.trim().split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}${minutes.toString().padStart(2, "0")}00`;
}

function formatIcalDateTime(date: string, timeStr: string): string {
  return `${date.replace(/-/g, "")}T${formatIcalTime(timeStr)}`;
}

function formatIcalDate(date: string): string {
  return `${date.replace(/-/g, "")}T235959Z`;
}

function escapeIcal(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function getFirstOccurrence(fromDate: string, dayShort: string): string {
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const targetDay = days.indexOf(dayShort.toLowerCase());
  const date = new Date(`${fromDate}T00:00:00+05:30`);
  while (date.getDay() !== targetDay) {
    date.setDate(date.getDate() + 1);
  }
  return date.toISOString().slice(0, 10);
}

const DAY_TO_ICAL: Record<string, string> = {
  mon: "MO",
  tue: "TU",
  wed: "WE",
  thu: "TH",
  fri: "FR",
  sat: "SA",
  sun: "SU",
};

export function exportTimetableIcal(
  timetable: TimetableState,
  timetableSchema: any,
  semesterStartDate: string,
  semesterEndDate: string
) {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AmazeCC FFCS Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(timetable.name || "My FFCS Timetable")}`,
    "X-WR-TIMEZONE:Asia/Kolkata",
  ];

  const createdAt = Date.now();

  // Pre-process schema into a quick lookup: slotName -> [{ day, start, end }]
  const slotLookup = new Map<string, { day: string; start: string; end: string }[]>();

  const processCategory = (category: any[]) => {
    category.forEach((period: any) => {
      if (!period.start || !period.end || !period.days) return;
      Object.entries(period.days).forEach(([day, slotsStr]) => {
        const slots = (slotsStr as string).split("/").map((s) => s.trim());
        slots.forEach((slotName) => {
          if (!slotLookup.has(slotName)) {
            slotLookup.set(slotName, []);
          }
          slotLookup.get(slotName)!.push({
            day,
            start: period.start,
            end: period.end,
          });
        });
      });
    });
  };

  if (timetableSchema.theory) processCategory(timetableSchema.theory);
  if (timetableSchema.lab) processCategory(timetableSchema.lab);

  timetable.courses.forEach((course) => {
    course.slots.forEach((slotName) => {
      // Ignore 'NIL'
      if (slotName === "NIL") return;

      const occurrences = slotLookup.get(slotName);
      if (!occurrences) return; // Slot not found in schema

      occurrences.forEach((occ) => {
        const firstDate = getFirstOccurrence(semesterStartDate, occ.day);
        const dtstart = formatIcalDateTime(firstDate, occ.start);
        const dtend = formatIcalDateTime(firstDate, occ.end);
        const until = formatIcalDate(semesterEndDate);

        lines.push(
          "BEGIN:VEVENT",
          `UID:${course.code}-${slotName}-${occ.day}-${createdAt}@amazecc`,
          `SUMMARY:${escapeIcal(`${course.code} - ${course.title}`)}`,
          `DESCRIPTION:${escapeIcal(
            `Faculty: ${course.faculty}\\nSlot: ${slotName}\\nType: ${course.type}`
          )}`,
          `LOCATION:${escapeIcal(course.venue)}`,
          `DTSTART;TZID=Asia/Kolkata:${dtstart}`,
          `DTEND;TZID=Asia/Kolkata:${dtend}`,
          `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_ICAL[occ.day]};UNTIL=${until}`,
          "END:VEVENT"
        );
      });
    });
  });

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${(timetable.name || "timetable").replace(/\s+/g, "_")}.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
}

```
</details>

---

## File: `AmazeCC\src\lib\exportTimetable.ts`

### Imports
```typescript
import * as htmlToImage from "html-to-image";
```

### Exports
```typescript
export async function downloadTimetableImage(
export function openTimetablePrintablePage(
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import * as htmlToImage from "html-to-image";

export async function downloadTimetableImage(
  element: HTMLElement,
  timetableName: string,
  themeBgColor: string,
  format: "jpg" | "png" = "jpg"
): Promise<void> {
  const originalStyle = element.style.cssText;

  const tableContainers = element.querySelectorAll(".overflow-x-auto");
  tableContainers.forEach((container) => {
    container.classList.remove("overflow-x-auto");
  });

  element.classList.add("flex", "flex-col", "w-max", "min-w-full");

  try {
    await new Promise((resolve) => setTimeout(resolve, 150));

    const scrollWidth = element.scrollWidth;
    const scrollHeight = element.scrollHeight;
    const viewportWidth = window.innerWidth;
    const safeWidth = viewportWidth * 0.9;
    const scale = scrollWidth > safeWidth ? safeWidth / scrollWidth : 1;

    const opts = {
      quality: 0.98,
      backgroundColor: themeBgColor,
      pixelRatio: ((1 / scale) * 3),
      width: scrollWidth * scale,
      height: scrollHeight * scale,
      style: {
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: `${scrollWidth}px`,
        height: `${scrollHeight}px`,
        padding: "24px",
        margin: "0",
        maxWidth: "none",
      },
    };

    const dataUrl =
      format === "png"
        ? await htmlToImage.toPng(element, opts)
        : await htmlToImage.toJpeg(element, opts);

    const link = document.createElement("a");
    link.download = `${timetableName.replace(/\s+/g, "_")}_FFCS.${format}`;
    link.href = dataUrl;
    link.click();
  } finally {
    element.style.cssText = originalStyle;
    element.classList.remove("flex", "flex-col", "w-max", "min-w-full");
    tableContainers.forEach((container) => {
      container.classList.add("overflow-x-auto");
    });
  }
}

function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };
  return str.replace(/[&<>"']/g, (ch) => map[ch]);
}

export function openTimetablePrintablePage(
  htmlContent: string,
  timetableName: string,
  themeHtmlClass: string,
  themeBgColor: string,
  themeTextColor: string
): Window | null {
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join("\n");

  const isDarkMode = themeHtmlClass.includes("dark");
  const bgGrad = isDarkMode
    ? "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)"
    : "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 30%, #fce7f3 70%, #f8fafc 100%)";
  const cardBg = isDarkMode ? "#1e293bcc" : "rgba(255,255,255,0.85)";
  const cardBorder = isDarkMode
    ? "1px solid rgba(99,102,241,0.25)"
    : "1px solid rgba(99,102,241,0.15)";
  const accentGrad = "linear-gradient(135deg, #6366f1, #a855f7, #ec4899)";

  const fullHtml = `
    <!DOCTYPE html>
        <html class="${escapeHtml(themeHtmlClass)}">
      <head>
        <title>${escapeHtml(timetableName)} - Timetable</title>
        ${styles}
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body {
            margin: 0;
            min-height: 100vh;
            background: ${bgGrad};
            font-family: system-ui, -apple-system, sans-serif;
          }
          @page { size: landscape; margin: 0; }
          .print-toolbar {
            position: fixed; top: 0; left: 0; right: 0;
            background: linear-gradient(135deg, #1e293b, #1e1b4b);
            color: white; padding: 14px 32px;
            display: flex; align-items: center;
            justify-content: space-between;
            z-index: 9999; backdrop-filter: blur(12px);
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 4px 32px rgba(0,0,0,0.4);
          }
          .print-toolbar button {
            background: ${accentGrad}; color: white; border: none;
            padding: 10px 24px; border-radius: 10px; font-size: 14px;
            font-weight: 600; cursor: pointer; display: flex;
            align-items: center; gap: 8px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 16px rgba(99,102,241,0.4);
          }
          .print-toolbar button:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 24px rgba(99,102,241,0.6);
          }
          .print-toolbar .hint { font-size: 13px; color: #a5b4fc; }
          .print-wrapper {
            padding: 72px 48px 48px;
            min-height: 100vh; box-sizing: border-box;
            display: flex; align-items: flex-start; justify-content: center;
          }
          .print-card {
            width: 100%; max-width: 1400px;
            background: ${cardBg};
            backdrop-filter: blur(16px);
            border-radius: 24px;
            border: ${cardBorder};
            padding: 48px 40px 40px;
            box-shadow: 0 8px 64px rgba(0,0,0,0.12), 0 2px 8px rgba(99,102,241,0.08);
            overflow-x: auto; overflow-y: visible;
            color: ${themeTextColor};
          }
          @media print {
            .print-toolbar { display: none !important; }
            .print-wrapper { padding: 0; display: block; }
            .print-card {
              border-radius: 0; box-shadow: none;
              padding: 48px 56px;
              max-width: none;
              background: ${isDarkMode ? "#0f172a" : "#ffffff"};
              border: none;
              backdrop-filter: none;
              -webkit-backdrop-filter: none;
            }
            body { background: ${isDarkMode ? "#0f172a" : "#ffffff"}; }
            .overflow-x-auto {
              overflow: visible !important;
              overflow-x: visible !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-weight:700;font-size:16px;background:${accentGrad};-webkit-background-clip:text;-webkit-text-fill-color:transparent">${escapeHtml(timetableName)}</span>
            <span class="hint">— Timetable</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span class="hint hidden sm:inline">Use browser Print / Save as PDF</span>
            <button onclick="window.print()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
              Print / PDF
            </button>
          </div>
        </div>
        <div class="print-wrapper">
          <div class="print-card">
            ${htmlContent}
          </div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return null;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
  return printWindow;
}

```
</details>

---

## File: `AmazeCC\src\lib\fetch-utils.ts`

### Exports
```typescript
export const PRIMARY_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.amazecc.com";
export const BACKUP_API_URL = process.env.NEXT_PUBLIC_BACKUP_API_URL || "https://proper-canary-4596.amazecc.deno.net";
export let activeApiUrl = customUrlFromStorage || PRIMARY_API_URL;
export function getActiveApiUrl(): string {
export function setActiveApiUrl(url: string) {
export function setCustomApiUrl(url: string) {
export let API_BASE = activeApiUrl;
export function setOriginalFetchForTest(f: typeof fetch) {
export function rewriteUrlIfNeeded(url: string): string {
export function getRewrittenUrl(url: string): string {
export async function fetchWithFailover(
export async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export const PRIMARY_API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.amazecc.com";
export const BACKUP_API_URL = process.env.NEXT_PUBLIC_BACKUP_API_URL || "https://proper-canary-4596.amazecc.deno.net";

let customUrlFromStorage = "";
if (typeof window !== "undefined") {
  try {
    customUrlFromStorage = localStorage.getItem("amazecc_custom_api_url") || "";
  } catch (e) {}
}

export let activeApiUrl = customUrlFromStorage || PRIMARY_API_URL;

export function getActiveApiUrl(): string {
  return activeApiUrl;
}

export function setActiveApiUrl(url: string) {
  activeApiUrl = url;
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem("amazecc_active_api_url", url);
    } catch (e) {
      // Ignore storage errors
    }
  }
}

export function setCustomApiUrl(url: string) {
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      if (url) {
        window.localStorage.setItem("amazecc_custom_api_url", url);
        activeApiUrl = url;
        API_BASE = url;
      } else {
        window.localStorage.removeItem("amazecc_custom_api_url");
        activeApiUrl = PRIMARY_API_URL;
        API_BASE = PRIMARY_API_URL;
      }
    } catch (e) {}
  }
}

export let API_BASE = activeApiUrl;

const FETCH_TIMEOUT = 90000;

// Store a reference to original fetch
let originalFetch: typeof fetch;
if (typeof window !== "undefined") {
  originalFetch = window.fetch;
} else {
  originalFetch = () => Promise.reject(new Error("Fetch not available"));
}

// Allow overriding the underlying fetch in tests
export function setOriginalFetchForTest(f: typeof fetch) {
  originalFetch = f;
}

export function rewriteUrlIfNeeded(url: string): string {
  try {
    const inputUrl = new URL(url);
    const primaryUrl = new URL(PRIMARY_API_URL);
    const backupUrl = new URL(BACKUP_API_URL);

    if (activeApiUrl === BACKUP_API_URL) {
      if (inputUrl.origin === primaryUrl.origin) {
        inputUrl.protocol = backupUrl.protocol;
        inputUrl.hostname = backupUrl.hostname;
        inputUrl.port = backupUrl.port;
        return inputUrl.toString();
      }
    } else {
      if (inputUrl.origin === backupUrl.origin) {
        inputUrl.protocol = primaryUrl.protocol;
        inputUrl.hostname = primaryUrl.hostname;
        inputUrl.port = primaryUrl.port;
        return inputUrl.toString();
      }
    }
  } catch (e) {
    // If url is not an absolute URL, leave it unchanged.
  }
  return url;
}

export function getRewrittenUrl(url: string): string {
  if (url.startsWith("/")) {
    return getActiveApiUrl() + url;
  }
  return rewriteUrlIfNeeded(url);
}

export async function fetchWithFailover(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let urlStr = "";
  if (typeof input === "string") {
    urlStr = input;
  } else if (input instanceof URL) {
    urlStr = input.toString();
  } else if (input && typeof input === "object" && "url" in input) {
    urlStr = input.url;
  }

  let isPrimary = false;
  let isBackup = false;
  try {
    const parsedUrl = new URL(urlStr);
    const primaryOrigin = new URL(PRIMARY_API_URL).origin;
    const backupOrigin = new URL(BACKUP_API_URL).origin;
    isPrimary = parsedUrl.origin === primaryOrigin;
    isBackup = parsedUrl.origin === backupOrigin;
  } catch (e) {
    // Non-absolute or malformed URL: treat as non-target and pass through.
  }

  if (!isPrimary && !isBackup) {
    return originalFetch(input, init);
  }

  let targetUrl = rewriteUrlIfNeeded(urlStr);

  const prepareInput = (newUrl: string): RequestInfo | URL => {
    if (typeof input === "string") {
      return newUrl;
    } else if (input instanceof URL) {
      return new URL(newUrl);
    } else {
      try {
        return new Request(newUrl, input);
      } catch (e) {
        // Fallback: Copy key request properties to avoid losing headers, auth, or method
        try {
          const initOpts: RequestInit = {};
          if (input.headers) {
            const headers: Record<string, string> = {};
            input.headers.forEach((v, k) => { headers[k] = v; });
            initOpts.headers = headers;
          }
          initOpts.method = input.method;
          initOpts.credentials = input.credentials;
          initOpts.mode = input.mode;
          initOpts.signal = input.signal;
          return new Request(newUrl, initOpts);
        } catch (innerErr) {
          return newUrl;
        }
      }
    }
  };

  try {
    const res = await originalFetch(prepareInput(targetUrl), init);
    if (activeApiUrl === PRIMARY_API_URL && (res.status === 502 || res.status === 503 || res.status === 504)) {
      throw new Error(`Server error ${res.status}`);
    }
    return res;
  } catch (error: any) {
    if (activeApiUrl === PRIMARY_API_URL) {
      if (error.name === "AbortError" && init?.signal?.aborted) {
        throw error;
      }

      console.warn(`Primary API call failed (${urlStr}). Failing over to backup. Error:`, error);
      setActiveApiUrl(BACKUP_API_URL);
      const backupUrl = urlStr.replace(PRIMARY_API_URL, BACKUP_API_URL);

      try {
        console.log(`Retrying request with backup URL: ${backupUrl}`);
        return await originalFetch(prepareInput(backupUrl), init);
      } catch (backupError) {
        console.error(`Backup API call also failed:`, backupError);
        throw backupError;
      }
    }
    throw error;
  }
}

export async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// Override global window.fetch if in browser
if (typeof window !== "undefined") {
  window.fetch = fetchWithFailover;

  // Run a quick check after page load to see if primary API is available again
  if (process.env.NODE_ENV !== "test") {
    setTimeout(async () => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000); // 3-second timeout

        const res = await originalFetch(`${PRIMARY_API_URL}/api/health`, {
          signal: controller.signal,
          headers: { "Accept": "application/json" }
        });
        clearTimeout(timer);

        if (res.ok) {
          if (activeApiUrl !== PRIMARY_API_URL) {
            console.log("Primary API is back online. Switching back from backup.");
            setActiveApiUrl(PRIMARY_API_URL);
          }
        } else {
          if (activeApiUrl === PRIMARY_API_URL) {
            console.warn("Primary API health check returned non-200. Keeping primary URL to avoid unnecessary failovers.");
          }
        }
      } catch (e) {
        // Do not proactively switch to backup on startup.
        // Let the actual fetch failover handle it during requests.
        if (activeApiUrl === PRIMARY_API_URL) {
          console.warn("Primary API is unreachable/blocked in health check. Keeping primary URL to avoid unnecessary failovers on slow connections.");
        }
      }
    }, 1500);
  }
}

```
</details>

---

## File: `AmazeCC\src\lib\marksSync.ts`

### Imports
```typescript
import { API_BASE } from "@/components/custom/Main";
```

### Exports
```typescript
export const syncMarksDiff = async (oldMarksData: any, newMarksData: any, username: string) => {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { API_BASE } from "@/components/custom/Main";
const getNumericValue = (value: any, fallback = 0) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const getAssessmentTotals = (assessments: any[]) => {
  return assessments.reduce(
    (acc, asm) => {
      acc.max += getNumericValue(asm.maxMark);
      acc.scored += getNumericValue(asm.scoredMark);
      acc.weightPercent += getNumericValue(asm.weightagePercent);
      acc.weighted += getNumericValue(asm.weightageMark);
      return acc;
    },
    { max: 0, scored: 0, weightPercent: 0, weighted: 0 }
  );
};

const getCourseCredits = (course: any) => {
  const credits = getNumericValue(course?.credits, -1);
  return credits > 0 ? credits : -1;
};

const getCourseStats = (group: any) => {
  const theoryTotals = getAssessmentTotals(group.theory?.assessments || []);
  const labTotals = getAssessmentTotals(group.lab?.assessments || []);
  
  if (!group.lab) {
    const projected = theoryTotals.weightPercent > 0 ? Math.round((theoryTotals.weighted / theoryTotals.weightPercent) * 100) : 0;
    return { projected };
  }
  
  if (!group.theory) {
    const projected = labTotals.weightPercent > 0 ? Math.round((labTotals.weighted / labTotals.weightPercent) * 100) : 0;
    return { projected };
  }
  
  const theoryCredits = getCourseCredits(group.theory);
  const labCredits = getCourseCredits(group.lab);
  
  if (theoryCredits < 0 || labCredits < 0) {
    return { projected: 0 };
  }
  
  const creditsTotal = theoryCredits + labCredits;
  const combinedWeighted = (theoryCredits * theoryTotals.weighted + labCredits * labTotals.weighted) / creditsTotal;
  const combinedWeightPercent = (theoryCredits * theoryTotals.weightPercent + labCredits * labTotals.weightPercent) / creditsTotal;
  
  const projected = combinedWeightPercent > 0 ? Math.round((combinedWeighted / combinedWeightPercent) * 100) : 0;
  
  return { projected };
};

const hashString = async (str: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const syncMarksDiff = async (oldMarksData: any, newMarksData: any, username: string) => {
    if (!username || !newMarksData?.courses) return;

    try {
        const hasSyncedBefore = localStorage.getItem("hasSyncedMarksV2");
        if (!hasSyncedBefore) {
            oldMarksData = {};
        }

        const buildMap = (marksData: any) => {
            const map = new Map();
            if (!marksData || !marksData.courses) return map;
            marksData.courses.forEach((c: any) => {
                const isLab = c.courseType.toLowerCase().includes("lab") || c.slot?.toLowerCase().startsWith("l");
                if (!map.has(c.courseCode)) {
                    map.set(c.courseCode, {
                        courseCode: c.courseCode,
                        theory: !isLab ? c : null,
                        lab: isLab ? c : null,
                    });
                } else {
                    const existing = map.get(c.courseCode);
                    if (isLab) existing.lab = c;
                    else existing.theory = c;
                }
            });
            return map;
        };

        const oldMap = buildMap(oldMarksData);
        const newMap = buildMap(newMarksData);
        const actions: any[] = [];

        newMap.forEach((newGroup, courseCode) => {
            const oldGroup = oldMap.get(courseCode) || {};
            const mainCourse = newGroup.theory || newGroup.lab;
            const classId = mainCourse.classNbr;

            const oldStats = oldGroup.theory || oldGroup.lab ? getCourseStats(oldGroup) : { projected: undefined };
            const newStats = getCourseStats(newGroup);

            if (newStats.projected > 0) {
                if (oldStats.projected === undefined || oldStats.projected === 0) {
                    actions.push({ type: 'add', classId, assessmentTitle: 'OVERALL', mark: newStats.projected });
                } else if (oldStats.projected !== newStats.projected) {
                    actions.push({ type: 'update', classId, assessmentTitle: 'OVERALL', oldMark: oldStats.projected, mark: newStats.projected });
                }
            }

            const checkAssessments = (oldAsms: any[] = [], newAsms: any[] = []) => {
                const oldAsmMap = new Map(oldAsms.map(a => [a.title, a]));
                newAsms.forEach(newAsm => {
                    const newPct = newAsm.maxMark > 0 ? (getNumericValue(newAsm.scoredMark) / getNumericValue(newAsm.maxMark)) * 100 : 0;
                    if (newPct > 0) {
                        const oldAsm = oldAsmMap.get(newAsm.title);
                        if (!oldAsm) {
                            actions.push({ type: 'add', classId, assessmentTitle: newAsm.title, mark: newPct });
                        } else {
                            const oldPct = oldAsm.maxMark > 0 ? (getNumericValue(oldAsm.scoredMark) / getNumericValue(oldAsm.maxMark)) * 100 : 0;
                            if (oldPct !== newPct) {
                                actions.push({ type: 'update', classId, assessmentTitle: newAsm.title, oldMark: oldPct, mark: newPct });
                            }
                        }
                    }
                });
            };

            checkAssessments(oldGroup.theory?.assessments, newGroup.theory?.assessments);
            checkAssessments(oldGroup.lab?.assessments, newGroup.lab?.assessments);
        });

        if (actions.length > 0) {
            const userHash = await hashString(username);
            const res = await fetch(`${API_BASE}/api/marks/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    actions,
                    userHash,
                    timestamp: Date.now()
                })
            });
            if (res.ok) {
                localStorage.setItem("hasSyncedMarksV2", "true");
            }
        } else if (!hasSyncedBefore) {
            // Even if actions is 0 (somehow no courses), mark as synced so we don't keep trying
            localStorage.setItem("hasSyncedMarksV2", "true");
        }
    } catch (e) {
        console.error("Error during background sync:", e);
    }
};

```
</details>

---

## File: `AmazeCC\src\lib\notifications.ts`

### Imports
```typescript
import { LocalNotifications } from '@capacitor/local-notifications';
import { getTodayAttendanceClasses, getAttendanceTimeRange } from './attendanceTimetable';
```

### Exports
```typescript
export async function requestNotificationPermissions() {
export async function scheduleLocalNotification(title: string, body: string, delayMs: number = 5000) {
export async function testLocalNotification() {
export async function scheduleClassNotifications(attendance: any[], offsetMinutes: number = 15) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { LocalNotifications } from '@capacitor/local-notifications';
import { getTodayAttendanceClasses, getAttendanceTimeRange } from './attendanceTimetable';

export async function requestNotificationPermissions() {
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

export async function scheduleLocalNotification(title: string, body: string, delayMs: number = 5000) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.warn('Notification permissions not granted');
    return false;
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        title,
        body,
        id: new Date().getTime(), // Unique ID
        schedule: { at: new Date(Date.now() + delayMs) },
        actionTypeId: '',
        extra: null,
      },
    ],
  });
  
  return true;
}

export async function testLocalNotification() {
  return await scheduleLocalNotification(
    'AmazeCC Reminder', 
    'This is a local notification triggered from Capacitor!', 
    5000 // 5 seconds
  );
}

export async function scheduleClassNotifications(attendance: any[], offsetMinutes: number = 15) {
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  // Clear existing notifications to avoid duplicates when rescheduling
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length > 0) {
    await LocalNotifications.cancel({ notifications: pending.notifications });
  }

  const now = new Date();
  const notificationsToSchedule = [];
  let idCounter = 1000; // Start at 1000 to avoid ID collisions

  // Schedule for the next 7 days
  for (let i = 0; i < 7; i++) {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + i);
    
    const classes = getTodayAttendanceClasses(attendance, targetDate);
    if (!classes) continue;

    for (const c of classes) {
      const timeRange = getAttendanceTimeRange(c.time);
      const classStartHours = Math.floor(timeRange.start / 60);
      const classStartMins = timeRange.start % 60;
      
      const classStartTime = new Date(targetDate);
      classStartTime.setHours(classStartHours, classStartMins, 0, 0);
      
      const notifyTime = new Date(classStartTime.getTime() - offsetMinutes * 60000);
      
      // Only schedule if the notification time is in the future
      if (notifyTime.getTime() > now.getTime()) {
        notificationsToSchedule.push({
          title: 'Upcoming Class',
          body: `${c.courseTitle} starts in ${offsetMinutes} minutes at ${c.time.split('-')[0].trim()} (${c.courseType})`,
          id: idCounter++,
          schedule: { at: notifyTime },
          actionTypeId: '',
          extra: null,
        });
      }
    }
  }

  if (notificationsToSchedule.length > 0) {
    await LocalNotifications.schedule({ notifications: notificationsToSchedule });
  }
}


```
</details>

---

## File: `AmazeCC\src\lib\pastDataSync.ts`

### Imports
```typescript
import { API_BASE } from "@/components/custom/Main";
```

### Exports
```typescript
export async function syncPastSemesters(allGradesData: any, creds: any): Promise<void> {
export function loadFrozenPastSemesters(allGradesData: any) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { API_BASE } from "@/components/custom/Main";

export async function syncPastSemesters(allGradesData: any, creds: any): Promise<void> {
  if (!allGradesData?.grades || !creds) return;

  let pastSemesters: string[] = [];
  if (Array.isArray(allGradesData.grades)) {
    pastSemesters = allGradesData.grades.map((sem: any) => sem.semesterSubId || sem.semSubId || sem.semesterId).filter(Boolean);
  } else {
    pastSemesters = Object.keys(allGradesData.grades);
  }
  
  if (pastSemesters.length === 0) return;

  for (const semId of pastSemesters) {
    if (semId === "Current" || semId === "curriculum" || semId === "effectiveGrades") continue;
    
    const attKey = `frozen_att_${semId}`;
    const marksKey = `frozen_marks_${semId}`;

    if (!localStorage.getItem(attKey) || !localStorage.getItem(marksKey)) {
      console.log(`Fetching frozen data for past semester: ${semId}`);
      try {
        const res = await fetch(`${API_BASE}/api/attendance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cookies: creds.cookies,
            authorizedID: creds.authorizedID,
            csrf: creds.csrf,
            semesterId: semId,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.attRes?.attendance) {
            localStorage.setItem(attKey, JSON.stringify(data.attRes));
          }
          if (data.marksRes?.courses) {
            localStorage.setItem(marksKey, JSON.stringify(data.marksRes));
          }
        }
      } catch (err) {
        console.error(`Failed to fetch frozen data for ${semId}`, err);
      }
    }
  }
}

export function loadFrozenPastSemesters(allGradesData: any) {
  if (!allGradesData?.grades) return {};

  let pastSemesters: string[] = [];
  if (Array.isArray(allGradesData.grades)) {
    pastSemesters = allGradesData.grades.map((sem: any) => sem.semesterSubId || sem.semSubId || sem.semesterId).filter(Boolean);
  } else {
    pastSemesters = Object.keys(allGradesData.grades);
  }
  
  const frozenData: Record<string, { attendance: any; marks: any }> = {};

  for (const semId of pastSemesters) {
    if (semId === "Current" || semId === "curriculum" || semId === "effectiveGrades") continue;
    
    const attKey = `frozen_att_${semId}`;
    const marksKey = `frozen_marks_${semId}`;

    const attStr = localStorage.getItem(attKey);
    const marksStr = localStorage.getItem(marksKey);

    if (attStr || marksStr) {
      try {
        frozenData[semId] = {
          attendance: attStr ? JSON.parse(attStr) : null,
          marks: marksStr ? JSON.parse(marksStr) : null,
        };
      } catch (e) {
        console.error(`Failed to parse frozen data for ${semId}`);
      }
    }
  }

  return frozenData;
}

```
</details>

---

## File: `AmazeCC\src\lib\settingsVisibility.ts`

### Exports
```typescript
export type SettingsVisibilityState = {
export function shouldShowGpa(settings: SettingsVisibilityState | null | undefined): boolean {
export function shouldShowProfilePhoto(settings: SettingsVisibilityState | null | undefined): boolean {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export type SettingsVisibilityState = {
  showGpa?: boolean;
  showProfilePhoto?: boolean;
};

export function shouldShowGpa(settings: SettingsVisibilityState | null | undefined): boolean {
  return Boolean(settings?.showGpa);
}

export function shouldShowProfilePhoto(settings: SettingsVisibilityState | null | undefined): boolean {
  return Boolean(settings?.showProfilePhoto);
}

```
</details>

---

## File: `AmazeCC\src\lib\socialUtils.ts`

### Imports
```typescript
import config from "../../config.json";
```

### Exports
```typescript
export type FriendClassSlot = {
export type Friend = {
export type FriendGroup = {
export function exportScheduleCode(
export function importScheduleCode(qrData: string, nickname?: string): Friend {
export function getFriends(): Friend[] {
export function saveFriend(friend: Friend) {
export function removeFriend(id: string) {
export function getFriendGroups(): FriendGroup[] {
export function saveFriendGroup(group: FriendGroup) {
export function removeFriendGroup(id: string) {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import config from "../../config.json";

const DAYS_MAP: Record<string, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

export type FriendClassSlot = {
  day: string;
  timeSlot: string;
  courseCode: string;
  courseTitle: string;
  venue: string;
  slotId: string;
};

export type Friend = {
  id: string; // regNumber
  name: string;
  nickname: string;
  regNumber: string;
  classSlots: FriendClassSlot[];
  color: string;
  addedAt: string;
  showInFriendsSchedule: boolean;
  showInHomePage: boolean;
};

export type FriendGroup = {
  id: string;
  name: string;
  friendIds: string[];
  createdAt: string;
};

export function exportScheduleCode(
  attendance: any[],
  name: string,
  regNumber: string
): string {
  if (!Array.isArray(attendance) || attendance.length === 0) return "";
  const slotMap = config.slotMap as any;
  const friendSlots: FriendClassSlot[] = [];

  attendance.forEach((course) => {
    const slots = String(course.slotName || "")
      .split("+")
      .map((s) => s.trim())
      .filter(Boolean);

    slots.forEach((slot) => {
      Object.keys(slotMap).forEach((shortDay) => {
        if (slotMap[shortDay]?.[slot]) {
          friendSlots.push({
            day: DAYS_MAP[shortDay] || shortDay,
            timeSlot: slotMap[shortDay][slot].time,
            courseCode: course.courseCode || "",
            courseTitle: course.courseTitle || "",
            venue: course.slotVenue || "",
            slotId: slot,
          });
        }
      });
    });
  });

  const slotsString = friendSlots
    .map(
      (s) =>
        `${s.day}|${s.timeSlot}|${s.courseCode}|${s.courseTitle}|${s.venue}|${s.slotId}`
    )
    .join("||");

  return `${name}|${regNumber}|${slotsString}`;
}

export function importScheduleCode(qrData: string, nickname?: string): Friend {
  try {
    const parts = qrData.split("|");
    if (parts.length < 2) {
      throw new Error("Invalid QR data format");
    }

    const name = parts[0];
    const regNumber = parts[1];
    const slotsData = parts.length > 2 ? parts.slice(2).join("|") : "";

    const classSlots: FriendClassSlot[] = [];
    if (slotsData.length > 0) {
      const slotStrings = slotsData.split("||");
      for (const slotStr of slotStrings) {
        if (slotStr.length > 0) {
          const sParts = slotStr.split("|");
          if (sParts.length === 6) {
            classSlots.push({
              day: sParts[0],
              timeSlot: sParts[1],
              courseCode: sParts[2],
              courseTitle: sParts[3],
              venue: sParts[4],
              slotId: sParts[5],
            });
          }
        }
      }
    }

    // Generate a consistent color based on regNumber
    const colors = [
      "#EC4899",
      "#10B981",
      "#A855F7",
      "#F59E0B",
      "#3B82F6",
      "#EF4444",
      "#14B8A6",
      "#8B5CF6",
    ];
    let hash = 0;
    for (let i = 0; i < regNumber.length; i++) {
      hash = regNumber.charCodeAt(i) + ((hash << 5) - hash);
    }
    const color = colors[Math.abs(hash) % colors.length];

    return {
      id: regNumber,
      name,
      nickname: nickname || name,
      regNumber,
      classSlots,
      color,
      addedAt: new Date().toISOString(),
      showInFriendsSchedule: true,
      showInHomePage: false,
    };
  } catch (e) {
    throw new Error(`Failed to parse QR data: ${(e as Error).message}`);
  }
}

export function getFriends(): Friend[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem("friends_schedules");
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveFriend(friend: Friend) {
  const friends = getFriends();
  const index = friends.findIndex((f) => f.id === friend.id);
  if (index >= 0) {
    friends[index] = friend;
  } else {
    friends.push(friend);
  }
  localStorage.setItem("friends_schedules", JSON.stringify(friends));
}

export function removeFriend(id: string) {
  const friends = getFriends();
  const filtered = friends.filter((f) => f.id !== id);
  localStorage.setItem("friends_schedules", JSON.stringify(filtered));
}

export function getFriendGroups(): FriendGroup[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem("friends_groups");
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveFriendGroup(group: FriendGroup) {
  const groups = getFriendGroups();
  const index = groups.findIndex((g) => g.id === group.id);
  if (index >= 0) {
    groups[index] = group;
  } else {
    groups.push(group);
  }
  localStorage.setItem("friends_groups", JSON.stringify(groups));
}

export function removeFriendGroup(id: string) {
  const groups = getFriendGroups();
  const filtered = groups.filter((g) => g.id !== id);
  localStorage.setItem("friends_groups", JSON.stringify(filtered));
}

```
</details>

---

## File: `AmazeCC\src\lib\storage.ts`

### Imports
```typescript
import type { attendanceRes } from "@/types/data/attendance";
import type { AllGradesRes } from "@/types/data/allgrades";
import type { CourseItem } from "@/types/data/marks";
```

### Exports
```typescript
export const KEYS = {
export const storage = {
export function clearAllData(): void {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import type { attendanceRes } from "@/types/data/attendance";
import type { AllGradesRes } from "@/types/data/allgrades";
import type { CourseItem } from "@/types/data/marks";

export const KEYS = {
  ATTENDANCE: "attendance",
  MARKS: "marks",
  GRADES: "grades",
  ALL_GRADES: "allGrades",
  CURRICULUM: "curriculum",
  SCHEDULE: "schedule",
  HOSTEL: "hostel",
  CALENDAR: "calender",
  PROFILE: "profile",
  PROFILE_IMAGES: "profileImages",
  USERNAME: "username",
  PASSWORD: "password",
  MOODLE_USERNAME: "moodle_username",
  MOODLE_PASSWORD: "moodle_password",
  IDS: "IDs",
  SETTINGS: "settings",
  DEMO_MODE: "demoMode",
  THEME: "theme",
  APP_ICON: "app-icon",
  FRIENDLY_NAME: "friendlyName",
  TRANSPORT_DATA: "transportData",
  REGISTERED_EVENTS: "registeredEvents",
  EVENT_HUB_SESSION: "eventHubSession",
  MOODLE_DATA: "moodleData",
  VITOL_DATA: "vitolData",
  ACTIVITY_TREE: "activityTree",
  HAS_SYNCED_MARKS_V2: "hasSyncedMarksV2",
  LAST_SEEN_CHANGELOG: "lastSeenChangelogVersion",
  HAS_SEEN_PUSH_PROMPT: "hasSeenPushPrompt",
  WASTED_ODS_TRACKER: "wastedODsTracker",
  UNICC_NOTES_TRACKER: "uniCC_notes_tracker",
  NOTES_TRACKER: "notesTracker",
  CUSTOM_HOMEWORK: "customHomework",
  GPA_GOAL: "uni_cc_gpa_goal",
  QCM_DATA: "qcmData",
  FRIENDS_SCHEDULES: "friends_schedules",
  FRIENDS_GROUPS: "friends_groups",
  KOHA_CARD: "koha_card",
  KOHA_PASSWORD: "koha_password",
  KOHA_DUES_TOTAL: "koha_dues_total",
  KOHA_DUES_COUNT: "koha_dues_count",
  KOHA_PATRON_PAGES: "koha_patron_pages",
  CABSHARE_USER: "cabshare_user",
  VITOL_USERNAME: "vitol_username",
  VITOL_PASSWORD: "vitol_password",
  VITOL_SITE: "vitol_site",
  FFCS_TIMETABLES: "ffcs_timetables",
  FFCS_ACTIVE_TIMETABLE_ID: "ffcs_activeTimetableId",
  FFCS_BLOCKED_SLOTS: "ffcs_blockedSlots",
  FFCS_FRIENDS: "ffcs_friends",
  FFCS_FRIEND_GROUPS: "ffcs_friendGroups",
  FFCS_SOCIAL_SCORE_METHOD: "ffcs_socialScoreGroupMethod",
  FFCS_COURSE_LOCKS: "ffcs_courseLocks",
  FFCS_MANUAL_LINKS: "ffcs_manual_links",
  FFCS_RAW_COURSES: "ffcs_raw_courses",
  CACHE_PREFIX: "cache_",
  FROZEN_ATT_PREFIX: "frozen_att_",
  FROZEN_MARKS_PREFIX: "frozen_marks_",
} as const;

function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* quota exceeded, silently fail */ }
}

function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* silently fail */ }
}

function getString(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function setString(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch { /* silently fail */ }
}

export const storage = {
  attendance: {
    get: () => getItem<attendanceRes>(KEYS.ATTENDANCE),
    set: (data: attendanceRes) => setItem(KEYS.ATTENDANCE, data),
    remove: () => removeItem(KEYS.ATTENDANCE),
  },
  marks: {
    get: () => getItem<{ courses?: CourseItem[]; cgpa?: unknown }>(KEYS.MARKS),
    set: (data: unknown) => setItem(KEYS.MARKS, data),
    remove: () => removeItem(KEYS.MARKS),
  },
  grades: {
    get: () => getItem<unknown>(KEYS.GRADES),
    set: (data: unknown) => setItem(KEYS.GRADES, data),
    remove: () => removeItem(KEYS.GRADES),
  },
  allGrades: {
    get: () => getItem<AllGradesRes>(KEYS.ALL_GRADES),
    set: (data: AllGradesRes) => setItem(KEYS.ALL_GRADES, data),
    remove: () => removeItem(KEYS.ALL_GRADES),
  },
  curriculum: {
    get: () => getItem<unknown>(KEYS.CURRICULUM),
    set: (data: unknown) => setItem(KEYS.CURRICULUM, data),
    remove: () => removeItem(KEYS.CURRICULUM),
  },
  schedule: {
    get: () => getItem<unknown>(KEYS.SCHEDULE),
    set: (data: unknown) => setItem(KEYS.SCHEDULE, data),
    remove: () => removeItem(KEYS.SCHEDULE),
  },
  hostel: {
    get: () => getItem<unknown>(KEYS.HOSTEL),
    set: (data: unknown) => setItem(KEYS.HOSTEL, data),
    remove: () => removeItem(KEYS.HOSTEL),
  },
  calendar: {
    get: () => getItem<unknown>(KEYS.CALENDAR),
    set: (data: unknown) => setItem(KEYS.CALENDAR, data),
    remove: () => removeItem(KEYS.CALENDAR),
  },
  profile: {
    get: () => getItem<Record<string, unknown>>(KEYS.PROFILE),
    set: (data: Record<string, unknown>) => setItem(KEYS.PROFILE, data),
    remove: () => removeItem(KEYS.PROFILE),
  },
  profileImages: {
    get: () => getItem<unknown>(KEYS.PROFILE_IMAGES),
    set: (data: unknown) => setItem(KEYS.PROFILE_IMAGES, data),
    remove: () => removeItem(KEYS.PROFILE_IMAGES),
  },
  ids: {
    get: () => getItem<{ VtopUsername: string; VtopPassword: string; MoodleUsername: string; MoodlePassword: string }>(KEYS.IDS),
    set: (data: { VtopUsername: string; VtopPassword: string; MoodleUsername: string; MoodlePassword: string }) => setItem(KEYS.IDS, data),
    remove: () => removeItem(KEYS.IDS),
  },
  settings: {
    get: () => getItem<Record<string, unknown>>(KEYS.SETTINGS),
    set: (data: Record<string, unknown>) => setItem(KEYS.SETTINGS, data),
    remove: () => removeItem(KEYS.SETTINGS),
  },
  registeredEvents: {
    get: () => getItem<unknown[]>(KEYS.REGISTERED_EVENTS),
    set: (data: unknown[]) => setItem(KEYS.REGISTERED_EVENTS, data),
    remove: () => removeItem(KEYS.REGISTERED_EVENTS),
  },
  demoMode: {
    get: () => getString(KEYS.DEMO_MODE) === "true",
    set: (val: boolean) => setString(KEYS.DEMO_MODE, val ? "true" : "false"),
    remove: () => removeItem(KEYS.DEMO_MODE),
  },
  eventHubSession: {
    get: () => getString(KEYS.EVENT_HUB_SESSION),
    set: (val: string) => setString(KEYS.EVENT_HUB_SESSION, val),
    remove: () => removeItem(KEYS.EVENT_HUB_SESSION),
  },
  moodleData: {
    get: () => getItem<unknown[]>(KEYS.MOODLE_DATA),
    set: (data: unknown[]) => setItem(KEYS.MOODLE_DATA, data),
    remove: () => removeItem(KEYS.MOODLE_DATA),
  },
  vitolData: {
    get: () => getItem<unknown[]>(KEYS.VITOL_DATA),
    set: (data: unknown[]) => setItem(KEYS.VITOL_DATA, data),
    remove: () => removeItem(KEYS.VITOL_DATA),
  },
  transportData: {
    get: () => getItem<unknown>(KEYS.TRANSPORT_DATA),
    set: (data: unknown) => setItem(KEYS.TRANSPORT_DATA, data),
    remove: () => removeItem(KEYS.TRANSPORT_DATA),
  },
  username: {
    get: () => getString(KEYS.USERNAME),
    set: (val: string) => setString(KEYS.USERNAME, val),
    remove: () => removeItem(KEYS.USERNAME),
  },
  password: {
    get: () => getString(KEYS.PASSWORD),
    set: (val: string) => setString(KEYS.PASSWORD, val),
    remove: () => removeItem(KEYS.PASSWORD),
  },
  moodleUsername: {
    get: () => getString(KEYS.MOODLE_USERNAME),
    set: (val: string) => setString(KEYS.MOODLE_USERNAME, val),
    remove: () => removeItem(KEYS.MOODLE_USERNAME),
  },
  moodlePassword: {
    get: () => getString(KEYS.MOODLE_PASSWORD),
    set: (val: string) => setString(KEYS.MOODLE_PASSWORD, val),
    remove: () => removeItem(KEYS.MOODLE_PASSWORD),
  },
  friendlyName: {
    get: () => getString(KEYS.FRIENDLY_NAME),
    set: (val: string) => setString(KEYS.FRIENDLY_NAME, val),
    remove: () => removeItem(KEYS.FRIENDLY_NAME),
  },
  appIcon: {
    get: () => getString(KEYS.APP_ICON),
    set: (val: string) => setString(KEYS.APP_ICON, val),
    remove: () => removeItem(KEYS.APP_ICON),
  },
  theme: {
    get: () => getString(KEYS.THEME),
    set: (val: string) => setString(KEYS.THEME, val),
    remove: () => removeItem(KEYS.THEME),
  },
  hasSyncedMarksV2: {
    get: () => getString(KEYS.HAS_SYNCED_MARKS_V2) === "true",
    set: (val: boolean) => setString(KEYS.HAS_SYNCED_MARKS_V2, val ? "true" : "false"),
    remove: () => removeItem(KEYS.HAS_SYNCED_MARKS_V2),
  },
  lastSeenChangelog: {
    get: () => getString(KEYS.LAST_SEEN_CHANGELOG),
    set: (val: string) => setString(KEYS.LAST_SEEN_CHANGELOG, val),
    remove: () => removeItem(KEYS.LAST_SEEN_CHANGELOG),
  },
  hasSeenPushPrompt: {
    get: () => getString(KEYS.HAS_SEEN_PUSH_PROMPT) === "true",
    set: (val: boolean) => setString(KEYS.HAS_SEEN_PUSH_PROMPT, val ? "true" : "false"),
    remove: () => removeItem(KEYS.HAS_SEEN_PUSH_PROMPT),
  },
  wastedODsTracker: {
    get: () => getItem<Record<string, unknown>>(KEYS.WASTED_ODS_TRACKER),
    set: (data: Record<string, unknown>) => setItem(KEYS.WASTED_ODS_TRACKER, data),
    remove: () => removeItem(KEYS.WASTED_ODS_TRACKER),
  },
  gpaGoal: {
    get: () => getItem<unknown>(KEYS.GPA_GOAL),
    set: (data: unknown) => setItem(KEYS.GPA_GOAL, data),
    remove: () => removeItem(KEYS.GPA_GOAL),
  },
  qcmData: {
    get: () => getItem<unknown>(KEYS.QCM_DATA),
    set: (data: unknown) => setItem(KEYS.QCM_DATA, data),
    remove: () => removeItem(KEYS.QCM_DATA),
  },
  cache: {
    get: (name: string) => getItem<unknown>(KEYS.CACHE_PREFIX + name),
    set: (name: string, data: unknown) => setItem(KEYS.CACHE_PREFIX + name, data),
    remove: (name: string) => removeItem(KEYS.CACHE_PREFIX + name),
  },
  frozenAttendance: {
    get: (semesterId: string) => getItem<attendanceRes>(KEYS.FROZEN_ATT_PREFIX + semesterId),
    set: (semesterId: string, data: attendanceRes) => setItem(KEYS.FROZEN_ATT_PREFIX + semesterId, data),
    remove: (semesterId: string) => removeItem(KEYS.FROZEN_ATT_PREFIX + semesterId),
  },
  noteTracker: {
    get: () => getItem<Record<string, unknown>>(KEYS.UNICC_NOTES_TRACKER),
    set: (data: Record<string, unknown>) => setItem(KEYS.UNICC_NOTES_TRACKER, data),
    remove: () => removeItem(KEYS.UNICC_NOTES_TRACKER),
  },
  customHomework: {
    get: () => getItem<Record<string, unknown>>(KEYS.CUSTOM_HOMEWORK),
    set: (data: Record<string, unknown>) => setItem(KEYS.CUSTOM_HOMEWORK, data),
    remove: () => removeItem(KEYS.CUSTOM_HOMEWORK),
  },
  friendsSchedules: {
    get: () => getItem<unknown>(KEYS.FRIENDS_SCHEDULES),
    set: (data: unknown) => setItem(KEYS.FRIENDS_SCHEDULES, data),
    remove: () => removeItem(KEYS.FRIENDS_SCHEDULES),
  },
  friendsGroups: {
    get: () => getItem<unknown>(KEYS.FRIENDS_GROUPS),
    set: (data: unknown) => setItem(KEYS.FRIENDS_GROUPS, data),
    remove: () => removeItem(KEYS.FRIENDS_GROUPS),
  },
  kohaCard: {
    get: () => getString(KEYS.KOHA_CARD),
    set: (val: string) => setString(KEYS.KOHA_CARD, val),
    remove: () => removeItem(KEYS.KOHA_CARD),
  },
  kohaPassword: {
    get: () => getString(KEYS.KOHA_PASSWORD),
    set: (val: string) => setString(KEYS.KOHA_PASSWORD, val),
    remove: () => removeItem(KEYS.KOHA_PASSWORD),
  },
  ffcsTimetables: {
    get: () => getItem<unknown>(KEYS.FFCS_TIMETABLES),
    set: (data: unknown) => setItem(KEYS.FFCS_TIMETABLES, data),
    remove: () => removeItem(KEYS.FFCS_TIMETABLES),
  },
  ffcsActiveTimetableId: {
    get: () => getString(KEYS.FFCS_ACTIVE_TIMETABLE_ID),
    set: (val: string) => setString(KEYS.FFCS_ACTIVE_TIMETABLE_ID, val),
    remove: () => removeItem(KEYS.FFCS_ACTIVE_TIMETABLE_ID),
  },
  ffcsBlockedSlots: {
    get: () => getItem<unknown>(KEYS.FFCS_BLOCKED_SLOTS),
    set: (data: unknown) => setItem(KEYS.FFCS_BLOCKED_SLOTS, data),
    remove: () => removeItem(KEYS.FFCS_BLOCKED_SLOTS),
  },
  ffcsCourseLocks: {
    get: () => getItem<unknown>(KEYS.FFCS_COURSE_LOCKS),
    set: (data: unknown) => setItem(KEYS.FFCS_COURSE_LOCKS, data),
    remove: () => removeItem(KEYS.FFCS_COURSE_LOCKS),
  },
  ffcsRawCourses: {
    get: () => getItem<unknown>(KEYS.FFCS_RAW_COURSES),
    set: (data: unknown) => setItem(KEYS.FFCS_RAW_COURSES, data),
    remove: () => removeItem(KEYS.FFCS_RAW_COURSES),
  },
  ffcsManualLinks: {
    get: () => getItem<unknown>(KEYS.FFCS_MANUAL_LINKS),
    set: (data: unknown) => setItem(KEYS.FFCS_MANUAL_LINKS, data),
    remove: () => removeItem(KEYS.FFCS_MANUAL_LINKS),
  },
  vitolUsername: {
    get: () => getString(KEYS.VITOL_USERNAME),
    set: (val: string) => setString(KEYS.VITOL_USERNAME, val),
    remove: () => removeItem(KEYS.VITOL_USERNAME),
  },
  vitolPassword: {
    get: () => getString(KEYS.VITOL_PASSWORD),
    set: (val: string) => setString(KEYS.VITOL_PASSWORD, val),
    remove: () => removeItem(KEYS.VITOL_PASSWORD),
  },
  vitolSite: {
    get: () => getString(KEYS.VITOL_SITE),
    set: (val: string) => setString(KEYS.VITOL_SITE, val),
    remove: () => removeItem(KEYS.VITOL_SITE),
  },
  cabshareUser: {
    get: () => getItem<unknown>(KEYS.CABSHARE_USER),
    set: (data: unknown) => setItem(KEYS.CABSHARE_USER, data),
    remove: () => removeItem(KEYS.CABSHARE_USER),
  },
};

export function clearAllData(): void {
  try {
    const keep = new Set<string>([KEYS.USERNAME, KEYS.PASSWORD, KEYS.MOODLE_USERNAME, KEYS.MOODLE_PASSWORD, KEYS.IDS, KEYS.SETTINGS, KEYS.THEME, KEYS.FRIENDLY_NAME, KEYS.APP_ICON]);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && !keep.has(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* silently fail */ }
}

```
</details>

---

## File: `AmazeCC\src\lib\string-similarity.ts`

### Exports
```typescript
export function getSimilarity(s1: string, s2: string): number {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
export function getSimilarity(s1: string, s2: string): number {
    if (!s1 || !s2) return 0;
    const str1 = s1.toLowerCase().trim();
    const str2 = s2.toLowerCase().trim();
    
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) {
        // If one is fully contained in another, weight it highly (0.85 to 0.95 depending on length diff)
        const minLen = Math.min(str1.length, str2.length);
        const maxLen = Math.max(str1.length, str2.length);
        return 0.85 + (0.1 * (minLen / maxLen));
    }
    
    // Levenshtein distance
    const costs = [];
    for (let i = 0; i <= str1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= str2.length; j++) {
            if (i === 0)
                costs[j] = j;
            else {
                if (j > 0) {
                    let newValue = costs[j - 1];
                    if (str1.charAt(i - 1) !== str2.charAt(j - 1))
                        newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                    costs[j - 1] = lastValue;
                    lastValue = newValue;
                }
            }
        }
        if (i > 0) costs[str2.length] = lastValue;
    }
    const maxLen = Math.max(str1.length, str2.length);
    const distance = costs[str2.length];
    return (maxLen - distance) / maxLen;
}

```
</details>

---

## File: `AmazeCC\src\lib\utils.ts`

### Imports
```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge"
```

### Exports
```typescript
export function cn(...inputs: ClassValue[]): string {
export function getAssetPath(path: string): string {
export function getMinimalMessage(message: string): string {
export function getBatchColorClass(batch: string): string {
```

### Source Code
<details><summary>Click to view full source code</summary>

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getAssetPath(path: string): string {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH?.replace(/\/+$/, "") || "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${cleanPath}`;
}

export function getMinimalMessage(message: string): string {
  if (!message) return "";
  
  const lines = message.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  
  const isReload = message.toLowerCase().includes("reload");
  const fetchedCount = lines.filter(l => l.startsWith("✅") || l.includes("✅")).length;
  const totalDetails = isReload ? 8 : 14;
  
  let currentAction = lines[lines.length - 1];
  currentAction = currentAction.replace(/^✅\s*/, "").replace(/^❌\s*/, "");
  
  if (currentAction.toLowerCase().includes("loaded successfully") || currentAction.toLowerCase().includes("all data loaded")) {
    return `All details loaded successfully! (${fetchedCount}/${totalDetails})`;
  }
  if (currentAction.toLowerCase().includes("failed") || currentAction.startsWith("❌")) {
    return currentAction;
  }
  
  return `${currentAction} (${fetchedCount}/${totalDetails} details fetched)`;
}

export function getBatchColorClass(batch: string): string {
  const b = batch.trim().toUpperCase();
  if (b.includes("BCE") || b.includes("CSE") || b.includes("SCOPE")) {
    return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
  }
  if (b.includes("SMEC") || b.includes("MECH") || b.includes("BMH")) {
    return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
  if (b.includes("SENSE") || b.includes("ECE")) {
    return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  }
  if (b.includes("SELECT") || b.includes("EEE")) {
    return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  }
  if (b.includes("SJT") || b.includes("VITS")) {
    return "bg-pink-500/10 text-pink-400 border-pink-500/20";
  }
  if (b.includes("LAW") || b.includes("SSL")) {
    return "bg-red-500/10 text-red-400 border-red-500/20";
  }
  if (b.includes("SASC") || b.includes("SCIENCE")) {
    return "bg-teal-500/10 text-teal-400 border-teal-500/20";
  }
  
  let hash = 0;
  for (let i = 0; i < b.length; i++) {
    hash = b.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "bg-purple-500/10 text-purple-400 border-purple-500/20",
    "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    "bg-rose-500/10 text-rose-400 border-rose-500/20",
    "bg-orange-500/10 text-orange-400 border-orange-500/20",
    "bg-lime-500/10 text-lime-400 border-lime-500/20"
  ];
  return colors[Math.abs(hash) % colors.length];
}

```
</details>

---

