"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RotateCw, ShieldCheck, FileText, FileJson2, Code2, FileArchive, ChevronRight } from "lucide-react";
import PageShell from "@/components/custom/shared/primitives/PageShell";
import { ListShell, SectionHeader } from "@/components/custom/shared/primitives/Surfaces";
import SettingRow from "@/components/custom/shared/primitives/SettingRow";
import Switch from "@/components/custom/shared/primitives/Switch";
import { getAssetPath } from "@/lib/utils";
import { downloadStudentReportPdf } from "@/lib/studentReportPdf";
import { computeCoursePrediction } from "@/lib/marksPredictor";
import { remapCohortStats } from "@/lib/marksSync";
import {
  buildCourseConfig,
  buildEnrolledCourses,
} from "@/components/custom/exams/marks-predictor/useCoursePredictionScope";
import {
  getFacultyDirectoryProfile,
  getFacultyProfileBundle,
  getFacultyReview,
  isVitfacIntegrationEnabled,
  loadVitfacCatalog,
  type FacultyDirectoryProfile,
  type VitfacProfileBundle,
} from "@/lib/vitfacService";

type ReportData = {
  profile: any;
  profileImages: any;
  attendance: any;
  attendanceHistory: Array<{ semesterId: string; data: any }>;
  marks: any;
  grades: any;
  allGrades: any;
  schedule: any;
  calendar: any;
  curriculum: any;
  officialOd: any[];
  payments: any;
  receipts: any;
  wallet: any;
  hostel: any;
  transport: any;
  moodle: any[];
  events: any[];
  library: any;
  predictor: any;
  customPredictorCourses: any;
  marksStats: any;
  wastedODsTracker: any;
  collectedAt: Date;
};

const read = (key: string): any => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

function collectReportData(): ReportData {
  const profile = read("profile") || {};
  const officialOd = Object.keys(localStorage)
    .filter((key) => key.startsWith("official_od_"))
    .flatMap((key) => {
      const value = read(key);
      return Array.isArray(value?.records)
        ? value.records.map((row: any) => ({ ...row, semesterId: value.semesterId }))
        : [];
    });
  const attendanceHistory = Object.keys(localStorage)
    .filter((key) => key.startsWith("frozen_att_"))
    .map((key) => ({ semesterId: key.slice("frozen_att_".length), data: read(key) }))
    .filter((item) => item.data);
  return {
    profile,
    profileImages: read("profileImages"),
    attendance: read("attendance"),
    attendanceHistory,
    marks: read("marks"),
    grades: read("grades"),
    allGrades: read("allGrades"),
    schedule: read("schedule"),
    calendar: read("calender"),
    curriculum: read("curriculum"),
    officialOd,
    payments: read("payments_dues") || read("cache_payments"),
    receipts: read("payments_receipts") || read("cache_payment-receipts"),
    wallet: read("payments_wallet") || read("cache_wallet"),
    hostel: read("hostel"),
    transport: read("transportData"),
    moodle: read("moodleData") || [],
    events: read("registeredEvents") || [],
    library: read("cache_library_due"),
    predictor: read("uni_cc_marks_predictor_state"),
    customPredictorCourses: read("uni_cc_marks_predictor_custom_courses"),
    marksStats: read("marksStats"),
    wastedODsTracker: read("wastedODsTracker") || {},
    collectedAt: new Date(),
  };
}

function text(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function dateLabel(value: unknown): string {
  if (!value) return "—";
  const dmy = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[1].padStart(2, "0")}/${dmy[2].padStart(2, "0")}/${dmy[3]}`;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString("en-IN");
}

function rows(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object")
    return Object.values(value as Record<string, unknown>).flatMap((v) => (Array.isArray(v) ? v : []));
  return [];
}

function normalizedPhoto(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:image/")) return value;
  const encoded = value
    .replace(/^data:null;base64,/i, "")
    .replace(/^null;base64,/i, "")
    .replace(/^base64,/i, "");
  return `data:${encoded.startsWith("/9j/") ? "image/jpeg" : "image/png"};base64,${encoded}`;
}

async function embedReportImages(root: HTMLElement): Promise<void> {
  await Promise.all(
    Array.from(root.querySelectorAll<HTMLImageElement>("img[src]")).map(async (image) => {
      const src = image.getAttribute("src") || "";
      if (!src || src.startsWith("data:")) return;
      try {
        const response = await fetch(new URL(src, window.location.href).toString());
        if (!response.ok) return;
        const blob = await response.blob();
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        image.src = `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
      } catch {
        // Keep the source URL if a remote image host blocks fetching.
      }
    }),
  );
}

function academicCalendar(calendar: any): Array<{ key: string; label: string; events: any[] }> {
  const months = Array.isArray(calendar?.calendars) ? calendar.calendars : [];
  return months.flatMap((month: any) => {
    const match = String(month.month || "").match(/^([A-Z]+)\s+(\d{4})$/i);
    const monthIndex = match ? new Date(`${match[1]} 1, ${match[2]}`).getMonth() : -1;
    const year = match ? Number(match[2]) : NaN;
    return (Array.isArray(month.days) ? month.days : []).map((day: any) => {
      const date = new Date(year, monthIndex, Number(day.date));
      return {
        key: `${year}-${monthIndex}-${day.date}`,
        label: Number.isNaN(date.getTime())
          ? `${day.date} ${month.month}`
          : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
        events: Array.isArray(day.events) ? day.events : [],
      };
    });
  });
}

function parseReportDate(value: unknown): Date | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function officialOdDay(value: unknown): Date | null {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return parseReportDate(value);
  const month = new Date(`${match[2]} 1, ${match[3]}`);
  return Number.isNaN(month.getTime()) ? null : new Date(Number(match[3]), month.getMonth(), Number(match[1]));
}

function attendanceByMonth(courses: any[]) {
  const grouped = new Map<string, { label: string; sort: number; rows: any[] }>();
  courses.forEach((course) =>
    (Array.isArray(course.viewLink) ? course.viewLink : []).forEach((entry: any, index: number) => {
      const date = parseReportDate(entry.date);
      const key = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` : "unknown";
      const bucket = grouped.get(key) || {
        label: date ? date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Date not supplied",
        sort: date?.getTime() || 0,
        rows: [],
      };
      bucket.rows.push({
        date,
        dateText: date
          ? date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
          : text(entry.date),
        course,
        status: String(entry.status || "Unknown"),
        index,
      });
      grouped.set(key, bucket);
    }),
  );
  return [...grouped.values()]
    .sort((a, b) => b.sort - a.sort)
    .map((month) => {
      month.rows.sort(
        (a, b) =>
          (a.date?.getTime() || 0) - (b.date?.getTime() || 0) ||
          String(a.course.courseCode).localeCompare(String(b.course.courseCode)),
      );
      const byDate = new Map<string, { present: number; absent: number; od: number; other: number }>();
      for (const row of month.rows) {
        const key = row.dateText;
        const counts = byDate.get(key) || { present: 0, absent: 0, od: 0, other: 0 };
        const status = row.status.toLowerCase();
        if (status.includes("present")) counts.present++;
        else if (status.includes("absent")) counts.absent++;
        else if (status.includes("duty") || status === "od") counts.od++;
        else counts.other++;
        byDate.set(key, counts);
      }
      const days = [...byDate.values()];
      return {
        ...month,
        days: byDate.size,
        presentDays: days.filter((x) => x.present > 0 && !x.absent && !x.other).length,
        absentDays: days.filter((x) => x.absent > 0).length,
        presentSessions: days.reduce((n, x) => n + x.present, 0),
        absentSessions: days.reduce((n, x) => n + x.absent, 0),
        odSessions: days.reduce((n, x) => n + x.od, 0),
      };
    });
}

function eventAnalytics(events: any[]) {
  const grouped = new Map<string, { label: string; count: number; days: Set<string> }>();
  for (const event of events) {
    const date = parseReportDate(event.date);
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const month = grouped.get(key) || {
      label: date.toLocaleDateString("en-IN", { month: "short", year: "numeric" }),
      count: 0,
      days: new Set<string>(),
    };
    month.count++;
    month.days.add(date.toISOString().slice(0, 10));
    grouped.set(key, month);
  }
  return [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, month]) => ({ label: month.label, count: month.count, days: month.days.size }));
}

function baseCourseCode(value: unknown) {
  return String(value || "")
    .replace(/\s*\([TL]\)$/i, "")
    .trim()
    .toUpperCase();
}

function facultyIdentity(value: unknown) {
  const raw = String(value || "").trim();
  const id = raw.match(/^(\d{3,7})\b/)?.[1] || "";
  const name = raw
    .replace(/^\d{3,7}\s*[-–—]?\s*/, "")
    .replace(/\s+-\s+[^-]+$/, "")
    .trim();
  return { id, name, raw };
}

function subjectsFrom(data: ReportData) {
  const byCode = new Map<string, any>();
  for (const attendance of Array.isArray(data.attendance?.attendance) ? data.attendance.attendance : []) {
    const code = baseCourseCode(attendance.courseCode);
    if (!code) continue;
    const item = byCode.get(code) || {
      code,
      title: attendance.courseTitle,
      attendance: [],
      marks: [],
      odHours: 0,
      odValidHours: 0,
      odWastedHours: 0,
      odDates: new Set<string>(),
      officialOdDates: new Set<string>(),
    };
    item.attendance.push(attendance);
    byCode.set(code, item);
  }
  for (const marks of Array.isArray(data.marks?.courses) ? data.marks.courses : []) {
    const code = baseCourseCode(marks.courseCode);
    if (!code) continue;
    const item = byCode.get(code) || {
      code,
      title: marks.courseTitle,
      attendance: [],
      marks: [],
      odHours: 0,
      odValidHours: 0,
      odWastedHours: 0,
      odDates: new Set<string>(),
      officialOdDates: new Set<string>(),
    };
    item.marks.push(marks);
    if (!item.title || item.title === code) item.title = marks.courseTitle;
    byCode.set(code, item);
  }
  for (const item of byCode.values()) {
    for (const course of item.attendance) {
      if (!Array.isArray(course.viewLink)) continue;
      for (const entry of course.viewLink) {
        if (!/on duty|partial od/i.test(String(entry.status || ""))) continue;
        const hours = /lab/i.test(String(course.courseType || course.slotName)) ? 2 : 1;
        item.odHours += hours;
        item.odDates.add(String(entry.date));
        const odDate = parseReportDate(entry.date);
        const isOfficialDate = data.officialOd.some((record: any) => {
          const range = String(record.date || "").split(/\s+to\s+/i);
          const start = officialOdDay(range[0]);
          const end = officialOdDay(range[1] || range[0]);
          return Boolean(odDate && start && end && odDate >= start && odDate <= end);
        });
        if (isOfficialDate) item.officialOdDates.add(String(entry.date));
        const tracked = data.wastedODsTracker?.[entry.date]?.[course.courseCode];
        if (tracked?.status === "wasted") item.odWastedHours += hours;
        else item.odValidHours += hours;
      }
    }
    item.attended = item.attendance.reduce((n: number, c: any) => n + (Number(c.attendedClasses) || 0), 0);
    item.total = item.attendance.reduce((n: number, c: any) => n + (Number(c.totalClasses) || 0), 0);
    item.attendancePct = item.total ? (item.attended / item.total) * 100 : null;
    item.facultyRaw =
      item.attendance.find((c: any) => c.faculty)?.faculty || item.marks.find((c: any) => c.faculty)?.faculty || "";
    item.faculty = facultyIdentity(item.facultyRaw);
    item.classes = item.attendance.map((c: any) => ({
      id: c.classId,
      type: c.courseType,
      slot: c.slotName,
      venue: c.slotVenue,
      credits: c.credits,
    }));
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function Section({
  title,
  children,
  className = "",
  id,
  segment,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  id?: string;
  segment?: string;
}) {
  return (
    <section id={id} data-report-segment={segment} className={`report-section ${className}`.trim()}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Empty({ children = "No data is available in the current AmazeCC cache." }: { children?: string }) {
  return <p className="report-empty">{children}</p>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="report-table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function PieChart({
  title,
  slices,
}: {
  title: string;
  slices: Array<{ label: string; value: number; color: string }>;
}) {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  if (!total) return <Empty>No values are available for this comparison.</Empty>;
  let offset = 0;
  const stops = slices
    .map((slice) => {
      const start = offset;
      offset += (Math.max(0, slice.value) / total) * 100;
      return `${slice.color} ${start}% ${offset}%`;
    })
    .join(", ");
  return (
    <div className="report-chart report-pie" data-report-chart="pie" data-chart-title={title}>
      <h4>{title}</h4>
      <div className="report-pie-layout">
        <div
          className="report-pie-disc"
          style={{ background: `conic-gradient(${stops})` }}
          aria-label={`${title}, ${slices.map((slice) => `${slice.label}: ${slice.value}`).join(", ")}`}
        >
          {slices.map((slice, index) => (
            <i
              key={`${slice.label}-${index}`}
              data-label={slice.label}
              data-value={slice.value}
              data-color={slice.color}
            />
          ))}
        </div>
        <div className="report-chart-legend">
          {slices.map((slice, index) => (
            <span key={`${slice.label}-${index}`}>
              <i style={{ background: slice.color }} />
              {slice.label}: {slice.value} ({((slice.value / total) * 100).toFixed(1)}%)
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComparisonChart({
  title,
  items,
  unit = "",
}: {
  title: string;
  items: Array<{ label: string; value: number }>;
  unit?: string;
}) {
  if (!items.length) return <Empty>No values are available for this comparison.</Empty>;
  const peak = Math.max(1, ...items.map((item) => item.value));
  return (
    <div className="report-chart" data-report-chart="comparison" data-chart-title={title}>
      <h4>{title}</h4>
      <div className="report-bars">
        {items.map((item, index) => (
          <div
            className="report-bar-item"
            data-label={item.label}
            data-value={item.value}
            data-absent="0"
            data-peak={peak}
            key={`${item.label}-${index}`}
          >
            <div className="report-bar-pair">
              <i
                className="report-bar"
                title={`${item.value}${unit}`}
                style={{ height: `${Math.max(2, (item.value / peak) * 80)}px` }}
              />
            </div>
            <small>{item.label}</small>
          </div>
        ))}
      </div>
      <div className="report-chart-legend">
        <span>
          <i />
          {unit || "Value"}
        </span>
      </div>
    </div>
  );
}

export default function StudentReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [facultyProfiles, setFacultyProfiles] = useState<
    Record<string, { review: any; profile: FacultyDirectoryProfile | null; bundle: VitfacProfileBundle | null }>
  >({});
  const [mode, setMode] = useState<"color" | "greyscale">("color");
  const segmentOptions = [
    ["overview", "Academic performance overview", "Summary, comparisons, and academic calendar"],
    ["curriculum", "Curriculum and credit progress", "Course baskets and degree requirements"],
    ["attendance", "Current semester attendance", "Subject summary and datewise register"],
    ["od", "On Duty records", "OD usage comparison and official records"],
    ["exams", "Current semester exam schedule", "CAT and FAT schedules"],
    ["subjects", "Current semester subject dossiers", "Assessments, predictions, and faculty details"],
    ["history", "Archived academic records", "Previous semesters and complete grade history"],
    ["events", "Registered events", "Event registrations and payment status"],
    ["finance", "Financial records", "Dues, receipts, and wallet information"],
    ["services", "Other student services", "Transport, library, and Moodle details"],
  ] as const;
  type SegmentKey = (typeof segmentOptions)[number][0];
  const [segments, setSegments] = useState<Record<SegmentKey, boolean>>({
    overview: true,
    curriculum: true,
    attendance: true,
    od: true,
    exams: true,
    subjects: true,
    history: true,
    events: true,
    finance: true,
    services: true,
  });
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportError, setExportError] = useState("");
  const reportMarkup = () => {
    const root = document.querySelector("#student-report-preview-source #student-report");
    const article = root?.querySelector("article");
    if (!root || !article) return null;
    const exportArticle = article.cloneNode(true) as HTMLElement;
    exportArticle.querySelectorAll<HTMLElement>("[data-report-segment]").forEach((node) => {
      const key = node.dataset.reportSegment as SegmentKey | undefined;
      if (key && !segments[key]) node.remove();
    });
    const styles = Array.from(root.querySelectorAll("style"))
      .map((style) => style.textContent || "")
      .join("\n");
    return { styles, article: exportArticle };
  };
  const [enginePredictions, setEnginePredictions] = useState<Record<string, any>>({});
  const [engineClassStats, setEngineClassStats] = useState<Record<string, any>>({});
  useEffect(() => setData(collectReportData()), []);
  const snapshot = data;
  const attendanceCourses = Array.isArray(snapshot?.attendance?.attendance) ? snapshot.attendance.attendance : [];
  const gradeMap = snapshot?.allGrades?.grades || (snapshot?.grades as any)?.grades || snapshot?.grades || {};
  const semesterEntries = Object.entries(gradeMap)
    .filter(
      ([, value]) =>
        value && typeof value === "object" && Array.isArray((value as any).grades) && (value as any).grades.length > 0,
    )
    .sort(([a], [b]) =>
      a === snapshot?.attendance?.semesterId ? -1 : b === snapshot?.attendance?.semesterId ? 1 : b.localeCompare(a),
    );
  const marksCourses = Array.isArray(snapshot?.marks?.courses) ? snapshot.marks.courses : [];
  const studentName =
    snapshot?.profile?.studentName || snapshot?.profile?.name || snapshot?.profile?.fullName || "Student";
  const regNo = snapshot?.profile?.registerNumber || snapshot?.profile?.regNo || snapshot?.profile?.registrationNumber;
  const profilePhoto = normalizedPhoto(
    snapshot?.profile?.image ||
      snapshot?.profileImages?.student?.photoBase64 ||
      snapshot?.profileImages?.student?.photo ||
      "",
  );
  const totals = attendanceCourses.reduce(
    (acc: { attended: number; total: number }, course: any) => ({
      attended: acc.attended + (Number(course.attendedClasses) || 0),
      total: acc.total + (Number(course.totalClasses) || 0),
    }),
    { attended: 0, total: 0 },
  );
  const percentage = totals.total ? ((totals.attended / totals.total) * 100).toFixed(1) : "—";
  const calendarRows = academicCalendar(snapshot?.calendar);
  const calendarMonths = useMemo(() => {
    const grouped = new Map<
      string,
      { label: string; year: number; monthIndex: number; offset: number; days: Map<number, any[]> }
    >();
    calendarRows.forEach((day) => {
      const [year, monthIndex, dayNumber] = day.key.split("-").map(Number);
      if (![year, monthIndex, dayNumber].every(Number.isFinite) || monthIndex < 0) return;
      const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
      const month = grouped.get(key) || {
        label: new Date(year, monthIndex, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
        year,
        monthIndex,
        offset: new Date(year, monthIndex, 1).getDay(),
        days: new Map<number, any[]>(),
      };
      month.days.set(dayNumber, [...(month.days.get(dayNumber) || []), ...day.events]);
      grouped.set(key, month);
    });
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, month]) => month);
  }, [calendarRows]);
  const attendanceMonths = attendanceByMonth(attendanceCourses);
  const totalPresentDays = attendanceMonths.reduce((sum, month) => sum + month.presentDays, 0);
  const subjects = useMemo(
    () =>
      snapshot
        ? subjectsFrom(snapshot).map((subject) => ({
            ...subject,
            prediction: enginePredictions[subject.code] ?? null,
            classStats: engineClassStats[subject.code] ?? null,
          }))
        : [],
    [snapshot, enginePredictions, engineClassStats],
  );

  useEffect(() => {
    if (!snapshot) return;
    let cancelled = false;
    (async () => {
      const enrolled = buildEnrolledCourses(
        snapshot.marks,
        snapshot.attendance?.attendance || [],
        snapshot.customPredictorCourses || [],
      );
      const remapped = await remapCohortStats(
        snapshot.marksStats || {},
        enrolled.map((course) => ({ theory: course.theoryCourse, lab: course.labCourse })),
      );
      const predictions: Record<string, any> = {};
      const classStatsByCourse: Record<string, any> = {};
      for (const course of enrolled) {
        const config = buildCourseConfig(course, snapshot.predictor?.[course.courseCode] || null);
        const classNbr = course.theoryCourse?.classNbr || course.labCourse?.classNbr;
        const overall = classNbr ? remapped?.[classNbr]?.overall : null;
        const classStats = overall && Number.isFinite(overall.mean) ? overall : null;
        const prediction = computeCoursePrediction({
          courseCode: course.courseCode,
          courseTitle: course.courseTitle,
          courseType: course.courseType,
          theoryAssessments: config.theory,
          labAssessments: config.lab,
          theoryCredits: config.theoryCredits,
          labCredits: config.labCredits,
          courseSystem: course.courseSystem ?? null,
          classStats,
        });
        predictions[course.courseCode] = prediction;
        classStatsByCourse[course.courseCode] = classStats;
      }
      if (!cancelled) {
        setEnginePredictions(predictions);
        setEngineClassStats(classStatsByCourse);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot]);

  useEffect(() => {
    if (!snapshot || !isVitfacIntegrationEnabled()) return;
    let cancelled = false;
    const people = [
      ...new Map(subjects.map((subject) => [subject.faculty.id || subject.faculty.name, subject.faculty])).values(),
    ].filter((person) => person.id || person.name);
    (async () => {
      await loadVitfacCatalog().catch(() => new Map());
      const results = await Promise.all(
        people.map(async (person) => {
          const review = getFacultyReview({ employeeId: person.id, name: person.name });
          const [profile, bundle] = person.id
            ? await Promise.all([
                getFacultyDirectoryProfile(person.id).catch(() => null),
                getFacultyProfileBundle(person.id).catch(() => null),
              ])
            : [null, null];
          return [person.id || person.name, { review, profile, bundle }] as const;
        }),
      );
      if (!cancelled) setFacultyProfiles(Object.fromEntries(results));
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot, subjects]);

  const refresh = () => setData(collectReportData());
  const downloadPdf = async () => {
    const markup = reportMarkup();
    if (!markup) return;
    setIsDownloading(true);
    setExportError("");
    try {
      const html = `<div class="report-capture"><style>${markup.styles}.report-capture{width:820px;background:#fff}.mb-4{margin-bottom:1rem}.mb-3{margin-bottom:.75rem}.mb-1{margin-bottom:.25rem}.font-bold{font-weight:700}.text-xs{font-size:12px}.text-center{text-align:center}.whitespace-pre-wrap{white-space:pre-wrap}.break-words{overflow-wrap:anywhere}.grid{display:grid}.place-items-center{place-items:center}</style><main id="student-report" class="student-report ${mode}">${markup.article.outerHTML}</main></div>`;
      await downloadStudentReportPdf(
        html,
        `AmazeCC-Student-Report-${new Date().toISOString().slice(0, 10)}.pdf`,
        mode === "greyscale",
      );
    } catch (error) {
      console.error("Failed to generate student report PDF:", error);
      setExportError("PDF generation failed. Refresh the report and try again.");
    } finally {
      setIsDownloading(false);
    }
  };
  const downloadHtml = () => {
    void createHtmlDownload();
  };
  const createHtmlDownload = async () => {
    const markup = reportMarkup();
    if (!markup) return;
    await embedReportImages(markup.article);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AmazeCC Student Academic Report</title><style>${markup.styles}.mb-4{margin-bottom:1rem}.mb-3{margin-bottom:.75rem}.mb-1{margin-bottom:.25rem}.font-bold{font-weight:700}.text-xs{font-size:12px}.text-center{text-align:center}.whitespace-pre-wrap{white-space:pre-wrap}.break-words{overflow-wrap:anywhere}.grid{display:grid}.place-items-center{place-items:center}</style></head><body><main id="student-report" class="student-report ${mode}">${markup.article.outerHTML}</main></body></html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AmazeCC-Student-Report-${new Date().toISOString().slice(0, 10)}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const downloadJson = () => {
    if (!snapshot) return;
    const payload = {
      schema: "amazecc.student-report.v1",
      generatedAt: snapshot.collectedAt.toISOString(),
      student: {
        name: studentName,
        registerNumber: regNo || null,
        programme: snapshot.profile?.branch || snapshot.profile?.program || snapshot.profile?.programme || null,
        campus: snapshot.profile?.campus || null,
      },
      currentSemester: {
        semesterId: snapshot.attendance?.semesterId || null,
        summary: { cgpa: snapshot.marks?.cgpa, gpa: snapshot.grades?.gpa || snapshot.grades?.sgpa, attendance: totals },
        ...(segments.attendance ? { attendance: attendanceCourses } : {}),
        ...(segments.subjects ? { assessments: marksCourses } : {}),
        ...(segments.subjects
          ? {
              subjects: subjects.map(({ odDates, officialOdDates, ...subject }) => ({
                ...subject,
                odDates: [...odDates],
                officialOdDates: [...officialOdDates],
                facultyProfile: facultyProfiles[subject.faculty.id || subject.faculty.name]?.profile || null,
                facultyReviews:
                  facultyProfiles[subject.faculty.id || subject.faculty.name]?.bundle ||
                  facultyProfiles[subject.faculty.id || subject.faculty.name]?.review ||
                  null,
              })),
            }
          : {}),
        ...(segments.exams ? { schedule: snapshot.schedule?.Schedule || {} } : {}),
        ...(segments.od ? { odUsage: snapshot.wastedODsTracker } : {}),
      },
      ...(segments.history ? { history: { semesters: gradeMap, attendance: snapshot.attendanceHistory } } : {}),
      ...(segments.curriculum
        ? { curriculum: snapshot.allGrades?.curriculum || snapshot.grades?.curriculum || snapshot.curriculum }
        : {}),
      ...(segments.overview ? { academicCalendar: snapshot.calendar } : {}),
      ...(segments.od ? { officialOdRecords: snapshot.officialOd } : {}),
      ...(segments.finance
        ? { finance: { payments: snapshot.payments, receipts: snapshot.receipts, wallet: snapshot.wallet } }
        : {}),
      ...(segments.services || segments.events
        ? {
            services: {
              ...(segments.services
                ? {
                    hostel: snapshot.hostel,
                    transport: snapshot.transport,
                    library: snapshot.library,
                    moodle: snapshot.moodle,
                  }
                : {}),
              ...(segments.events ? { events: snapshot.events } : {}),
            },
          }
        : {}),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `AmazeCC-Student-Report-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen px-4 pb-12">
      <PageShell
        eyebrow="Academics · Reports"
        title="Student academic report"
        subtitle="Choose an export format, then tailor the report sections to include. Your report data stays on this device."
        selectable
      >
        <section className="space-y-3">
          <SectionHeader icon={Download} title="Download report" />
          <ListShell className="divide-y divide-border-muted">
            {[
              {
                key: "pdf",
                title: "Download as PDF",
                description: isDownloading ? "Preparing your report…" : "Print ready, with color or greyscale styling",
                icon: FileText,
                action: downloadPdf,
                disabled: isDownloading || !snapshot,
                tint: "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-900",
              },
              {
                key: "json",
                title: "Download as JSON",
                description: "Structured report data for your own designs",
                icon: FileJson2,
                action: downloadJson,
                disabled: !snapshot,
                tint: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900",
              },
              {
                key: "html",
                title: "Download as HTML",
                description: "Formatted report with images embedded for offline viewing",
                icon: Code2,
                action: downloadHtml,
                disabled: !snapshot,
                tint: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-900",
              },
            ].map(({ key, title, description, icon: Icon, action, disabled, tint }) => (
              <button
                key={key}
                type="button"
                onClick={action}
                disabled={disabled}
                className="group flex w-full items-center gap-3.5 p-3.5 text-left transition-colors hover:bg-surface-secondary/70 disabled:cursor-not-allowed disabled:opacity-50 sm:p-4"
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform group-hover:scale-105 ${tint}`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-text-heading group-hover:text-indigo-600">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-xs text-text-secondary">{description}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </button>
            ))}
          </ListShell>
        </section>

        <section className="space-y-3">
          <SectionHeader
            icon={FileArchive}
            title="Customize report contents"
            right={
              <button
                type="button"
                className="text-xs font-bold text-indigo-600"
                onClick={() =>
                  setSegments(
                    Object.fromEntries(segmentOptions.map(([key]) => [key, true])) as Record<SegmentKey, boolean>,
                  )
                }
              >
                Select all
              </button>
            }
          />
          <ListShell className="divide-y divide-border-muted">
            {segmentOptions.map(([key, title, description]) => (
              <SettingRow
                key={key}
                title={title}
                description={description}
                control={
                  <Switch
                    checked={segments[key]}
                    onCheckedChange={(checked) => setSegments((current) => ({ ...current, [key]: checked }))}
                    size="md"
                    label={title}
                  />
                }
              />
            ))}
          </ListShell>
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              PDF color{" "}
              <select
                className="rounded-lg border border-border-muted bg-surface px-3 py-2 text-text-heading"
                value={mode}
                onChange={(event) => setMode(event.target.value as "color" | "greyscale")}
              >
                <option value="greyscale">Greyscale</option>
                <option value="color">Color</option>
              </select>
            </label>
            <button
              type="button"
              onClick={refresh}
              className="inline-flex items-center gap-2 rounded-lg border border-border-muted bg-surface px-3 py-2 text-xs font-bold text-text-heading hover:bg-surface-secondary"
            >
              <RotateCw size={14} />
              Refresh data
            </button>
            <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
              <ShieldCheck size={14} />
              Generated on this device
            </span>
          </div>
          {exportError && (
            <p role="alert" className="text-sm text-red-700">
              {exportError}
            </p>
          )}
        </section>
      </PageShell>

      <div
        id="student-report-preview-source"
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-100000px",
          top: 0,
          width: "1120px",
          visibility: "hidden",
          pointerEvents: "none",
        }}
      >
        <main id="student-report" className={`student-report ${mode}`}>
          <style>{`
        .student-report{--ink:#172033;--muted:#596579;--line:#cbd2dc;--band:#eaf0f7;--paper:#fff;--accent:#173b67;color:var(--ink);background:var(--paper);font:14px/1.45 Arial,Helvetica,sans-serif;padding:clamp(16px,3vw,36px);max-width:1120px;margin:0 auto}
        .student-report.greyscale{--ink:#171717;--muted:#555;--line:#bdbdbd;--band:#ededed;--accent:#222}
        .student-report.color{--ink:#172033;--muted:#596579;--line:#cbd2dc;--band:#eaf0f7;--accent:#173b67}
        .report-controls{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:14px;border:1px solid var(--line);border-radius:10px;margin-bottom:20px;background:var(--band)}
        .report-controls button,.report-controls select{font:inherit;padding:8px 12px;border:1px solid var(--line);border-radius:7px;background:var(--paper);color:var(--ink)}
        .report-controls button{display:inline-flex;align-items:center;gap:7px;font-weight:700;cursor:pointer}.report-controls label{display:inline-flex;align-items:center;gap:6px}
        .report-cover{position:relative;isolation:isolate;overflow:hidden;min-height:78vh;display:grid;grid-template-columns:1fr 150px;gap:24px;align-items:center;padding:clamp(30px,7vw,82px);margin:0 -1px 34px;border:1px solid color-mix(in srgb,var(--accent) 16%,white);border-radius:28px;background:radial-gradient(ellipse at 84% 16%,color-mix(in srgb,#f3bd61 42%,white),transparent 31%),radial-gradient(ellipse at 76% 79%,color-mix(in srgb,#60b8a5 30%,white),transparent 34%),linear-gradient(135deg,color-mix(in srgb,var(--accent) 10%,white),var(--paper) 72%)}.report-cover:before,.report-cover:after{content:"";position:absolute;z-index:-1;border-radius:50%;animation:report-bounce 5s ease-in-out infinite}.report-cover:before{width:210px;height:210px;right:17%;top:9%;background:color-mix(in srgb,#e4a7c6 45%,white)}.report-cover:after{width:120px;height:120px;right:4%;bottom:10%;background:color-mix(in srgb,#f3bd61 55%,white);animation-delay:-2.1s}.report-cover-copy{max-width:620px}.report-cover-eyebrow{font-size:11px!important;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)!important}.report-cover h1{font:700 clamp(38px,7vw,72px)/1.02 Georgia,serif;max-width:600px;margin:15px 0 22px;color:var(--accent)}.report-cover p{margin:6px 0;color:var(--muted)}.report-cover-student{font-size:17px!important;color:var(--ink)!important}.report-cover-chips{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0}.report-cover-chips span{padding:7px 12px;border:1px solid color-mix(in srgb,var(--accent) 20%,white);border-radius:999px;background:color-mix(in srgb,var(--paper) 82%,transparent);font-size:10px;font-weight:700;color:var(--accent);box-shadow:0 5px 14px #173b6715}.report-logo{position:absolute;left:24px;top:22px;width:44px;height:44px;object-fit:contain}.report-photo{width:132px;height:160px;object-fit:cover;border:5px solid white;border-radius:26px;box-shadow:0 18px 46px #173b6730;transform:rotate(3deg)}.report-cover-photo-placeholder{display:grid;place-items:center;text-align:center;background:color-mix(in srgb,var(--paper) 84%,transparent);color:var(--accent);font-weight:700}
        @keyframes report-bounce{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-18px) rotate(7deg)}}
        .report-index{break-before:page;break-after:page;page-break-before:always;page-break-after:always;min-height:84vh;margin:0;padding:36px 28px;border:1px solid color-mix(in srgb,var(--accent) 18%,white);border-radius:22px;background:radial-gradient(ellipse at 100% 0%,color-mix(in srgb,#60b8a5 22%,white),transparent 35%),linear-gradient(145deg,var(--band),var(--paper) 72%);display:flex;flex-direction:column;justify-content:center}.report-index h2{font:700 26px Georgia,serif;color:var(--accent);margin:0 0 20px;text-align:center}.report-index ol{list-style:none;counter-reset:toc;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0;padding:0}.report-index li{counter-increment:toc}.report-index a{display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;background:var(--paper);color:var(--ink);text-decoration:none;border:1px solid color-mix(in srgb,var(--accent) 12%,white);font-size:11px}.report-index a:before{content:counter(toc,decimal-leading-zero);color:var(--accent);font-weight:700;font-size:10px}.report-index li ol{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 7px;margin:4px 0 5px 15px}.report-index li ol a{padding:5px 8px;font-size:9px;background:color-mix(in srgb,var(--accent) 3%,white)}
        .report-logo{width:58px;height:58px;object-fit:contain}.report-photo{width:78px;height:92px;object-fit:cover;border:1px solid var(--line);border-radius:4px}
        .report-cover h1{font-family:Georgia,serif;font-size:25px;line-height:1.15;margin:0 0 5px;color:var(--accent)}.report-cover p{margin:2px 0;color:var(--muted)}
        .report-notice{font-size:11px;color:var(--muted);margin:14px 0 26px;padding:10px 12px;border-left:3px solid var(--line);background:var(--band)}.report-section{margin:34px 0 42px;padding-top:4px;break-inside:auto}.report-section h2{font:700 16px Georgia,serif;color:var(--accent);padding:8px 11px;margin:0 0 18px;background:var(--band);border-left:3px solid var(--accent);text-align:center}.report-section>*+*{margin-top:18px}.report-section h3{margin-top:26px}.report-section .report-chart{margin:18px 0 22px}
        .report-table-wrap{overflow-x:auto;border:1px solid color-mix(in srgb,var(--accent) 24%,white);border-radius:7px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:0;border-bottom:1px solid color-mix(in srgb,var(--accent) 14%,white);padding:7px 9px;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group}th{background:color-mix(in srgb,var(--accent) 9%,white);color:var(--accent);font-weight:700;border-bottom:1px solid color-mix(in srgb,var(--accent) 25%,white)}tbody tr:nth-child(even){background:color-mix(in srgb,var(--accent) 3.5%,white)}tbody tr:last-child td{border-bottom:0}tr{break-inside:avoid}
        .report-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin:16px 0}.report-summary div{border:1px solid var(--line);border-top:3px solid var(--accent);padding:11px 12px;background:var(--paper);min-height:58px}.report-summary strong{display:block;font:700 19px Georgia,serif}.report-summary span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
        .report-chart{border:1px solid var(--line);padding:12px;margin:10px 0 14px;break-inside:avoid}.report-chart h4{margin:0 0 9px;font:700 12px Georgia,serif;color:var(--accent)}.report-bars{display:flex;align-items:end;gap:5px;height:110px;border-bottom:1px solid var(--line);padding:0 4px;overflow:hidden}.report-bar-item{flex:1;min-width:16px;text-align:center;font-size:8px;color:var(--muted)}.report-bar-pair{height:86px;display:flex;align-items:end;justify-content:center;gap:2px}.report-bar{min-height:2px;background:#2d6a9f;border-radius:3px 3px 0 0;width:40%;max-width:13px}.report-bar.absent{background:#c55454}.report-chart-legend{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:7px;font-size:9px;color:var(--muted)}.report-chart-legend span{display:inline-flex;align-items:center;gap:4px}.report-chart-legend i{display:inline-block;width:8px;height:8px;background:#2d6a9f}.report-chart-legend .absent-key{background:#c55454}.report-pie-layout{display:flex;align-items:center;gap:20px}.report-pie-disc{width:116px;height:116px;flex:0 0 116px;border-radius:50%;position:relative}.report-pie-disc:after{content:"";position:absolute;inset:30px;border-radius:50%;background:var(--paper);border:1px solid var(--line)}.report-pie-disc>i{display:none}.report-pie .report-chart-legend{display:grid}.report-month{break-before:page}.report-month h3,.report-subject h3,.report-curriculum-category h3{font:700 15px Georgia,serif;color:var(--accent);border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:16px}.report-subject{break-before:page;padding-top:8px}.report-subject>*+*{margin-top:18px}.report-subject h4,.report-curriculum-basket h4{font:700 12px Georgia,serif;color:var(--accent);margin:22px 0 9px;padding-bottom:5px;border-bottom:1px solid var(--line)}.report-faculty-card{display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-left:4px solid var(--accent);padding:12px 14px;margin:14px 0;background:var(--band);break-inside:avoid}.report-faculty-card img,.report-faculty-placeholder{width:58px;height:68px;object-fit:cover;border:1px solid var(--line);background:var(--paper);flex:none}.report-faculty-placeholder{display:grid;place-items:center;font:700 18px Georgia,serif;color:var(--accent)}.report-faculty-card-copy{display:grid;gap:3px;flex:1}.report-faculty-card-copy strong{font:700 14px Georgia,serif;color:var(--accent)}.report-faculty-card-copy span,.report-faculty-card-stat span{font-size:10px;color:var(--muted)}.report-faculty-card-stat{text-align:right}.report-faculty-card-stat strong{display:block;font:700 18px Georgia,serif;color:var(--accent)}.report-curriculum-category{break-before:page}.report-curriculum-basket{margin-bottom:24px}
        .report-empty{color:var(--muted);font-style:italic;font-size:12px}.report-foot{border-top:1px solid var(--line);padding-top:8px;margin-top:24px;color:var(--muted);font-size:10px}
        .report-curriculum-section{break-before:page;page-break-before:always}.report-divider{position:relative;isolation:isolate;overflow:hidden;break-before:page;page-break-before:always;break-after:page;page-break-after:always;min-height:90vh;display:flex;flex-direction:column;justify-content:center;padding:48px;border:1px solid color-mix(in srgb,var(--accent) 20%,white);border-radius:32px;background:radial-gradient(ellipse at 13% 12%,color-mix(in srgb,#e4a7c6 33%,white),transparent 32%),linear-gradient(145deg,color-mix(in srgb,var(--accent) 10%,white),var(--paper) 65%);text-align:center;color:var(--accent)}.report-divider:before,.report-divider:after{content:"";position:absolute;z-index:-1;left:-10%;width:120%;height:24%;border-radius:48% 52% 0 0 / 24% 38% 0 0}.report-divider:before{bottom:-7%;background:color-mix(in srgb,#60b8a5 23%,white);transform:rotate(-3deg)}.report-divider:after{bottom:-12%;left:-14%;height:18%;background:color-mix(in srgb,#f3bd61 30%,white);transform:rotate(3deg)}.report-divider span{font-size:10px;letter-spacing:.16em}.report-divider h2{font:700 30px Georgia,serif;margin:14px 0}.report-divider p{color:var(--muted);font-size:13px}.report-calendar{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin:12px 0 22px}.report-calendar-weekday{padding:6px 3px;text-align:center;background:var(--band);color:var(--accent);font-weight:700;font-size:10px}.report-calendar-day{min-height:76px;padding:5px;border:1px solid color-mix(in srgb,var(--accent) 18%,white);background:var(--paper);font-size:9px}.report-calendar-day.empty{border-color:transparent;background:transparent}.report-calendar-day strong{display:block;margin-bottom:4px;color:var(--accent)}.report-calendar-day span{display:block;margin:2px 0;padding:2px 3px;background:var(--band);border-radius:3px;color:var(--ink);overflow-wrap:anywhere}.report-attendance-calendar{gap:3px;margin:12px 0 16px}.report-attendance-calendar .report-calendar-day{min-height:43px;padding:4px;border-radius:7px;font-size:8px}.report-attendance-calendar .report-calendar-weekday{padding:4px 2px;border-radius:5px;font-size:8px}.report-attendance-calendar .attendance-day.all-present{background:#eaf5ee;border-color:#c6e3d0}.report-attendance-calendar .attendance-day.has-absence{background:#fff0ed;border-color:#f1c9c1}.report-attendance-calendar .attendance-day.on-duty{background:#edf4fb;border-color:#ccdeef}.report-attendance-calendar .attendance-day span{background:transparent;font-size:7px}.report-grade-history-section{break-before:page;page-break-before:always}.report-overview-subheading{text-align:center;color:var(--accent);font:700 14px Georgia,serif;margin:24px 0 8px}.report-subject{border:1px solid color-mix(in srgb,var(--accent) 16%,white);border-radius:18px;background:linear-gradient(145deg,var(--paper),color-mix(in srgb,var(--accent) 3%,white));padding:18px 20px;margin:30px 0;box-shadow:0 8px 24px #173b6710}.report-subject h3{text-align:center}.report-subject h4{margin-top:24px}.report-faculty-card{border-radius:13px}.report-education-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin:12px 0}.report-education-card{display:flex;flex-direction:column;gap:5px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--accent) 13%,white);border-radius:10px;background:color-mix(in srgb,var(--accent) 3%,white);font-size:10px;line-height:1.4}.report-education-card strong{font:700 12px Georgia,serif;color:var(--accent)}.report-education-year{font-weight:700;color:var(--muted)}.report-grade-cards{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}.report-grade-cards div{min-width:100px;padding:9px 12px;border-top:3px solid var(--accent);border-radius:8px;background:var(--band)}.report-grade-cards strong,.report-grade-cards span{display:block}.report-grade-cards strong{font:700 14px Georgia,serif;color:var(--accent)}.report-grade-cards span{font-size:8px;text-transform:uppercase;color:var(--muted)}.report-basket-index{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 16px}.report-basket-index span{padding:5px 10px;border:1px solid color-mix(in srgb,var(--accent) 16%,white);border-radius:999px;background:var(--band);font-size:9px;color:var(--accent)}.report-theme-group.critical .report-theme-pill{background:#fff0ed;border-color:#efb7ad;color:#842c20}.report-theme-group.critical .report-theme-pill b{color:#a82e20}
        .report-theme-group{margin:14px 0}.report-theme-group>strong{display:block;font:700 11px Georgia,serif;color:var(--muted);margin-bottom:7px}.report-theme-list{display:flex;flex-wrap:wrap;gap:7px}.report-theme-pill{display:inline-flex;align-items:center;gap:7px;padding:5px 9px;border:1px solid color-mix(in srgb,var(--accent) 17%,white);border-radius:999px;background:color-mix(in srgb,var(--accent) 6%,white);color:var(--ink);font-size:10px;line-height:1.3}.report-theme-group.positive .report-theme-pill{background:#eef7f2;border-color:#c8e4d4}.report-theme-group.critical .report-theme-pill{background:#fbf1ef;border-color:#ecd0cb}.report-theme-pill b{color:var(--accent);font-size:9px}
        .report-page-start{break-before:page;page-break-before:always}
        @media(max-width:600px){.report-cover{grid-template-columns:1fr 72px;min-height:68vh;padding:72px 20px 28px;border-radius:20px}.report-logo{width:34px;height:34px;left:16px;top:16px}.report-photo{width:68px;height:88px;border-width:3px;border-radius:16px}.report-cover h1{font-size:39px}.report-index ol{grid-template-columns:1fr}}
        @media(prefers-reduced-motion:reduce){.report-cover:before,.report-cover:after{animation:none}}
        @media print{.report-cover:before,.report-cover:after{animation:none}}
      `}</style>

          {snapshot && (
            <article>
              <header className="report-cover">
                <img className="report-logo" src={getAssetPath("/logo.png")} alt="AmazeCC" />
                <div className="report-cover-copy">
                  <p className="report-cover-eyebrow">AmazeCC · Academic portfolio</p>
                  <h1>Student Academic Report</h1>
                  <p className="report-cover-student">
                    <strong>{text(studentName)}</strong>
                    {regNo ? ` · ${text(regNo)}` : ""}
                  </p>
                  <p>
                    {text(
                      snapshot.profile?.branch || snapshot.profile?.program || snapshot.profile?.programme,
                      "Academic profile not synced",
                    )}
                    {snapshot.profile?.campus ? ` · ${snapshot.profile.campus}` : ""}
                  </p>
                  <div className="report-cover-chips">
                    <span>Academic summary</span>
                    <span>Current semester</span>
                    <span>Historic record</span>
                  </div>
                  <p>
                    Generated {snapshot.collectedAt.toLocaleString("en-IN")}
                    {snapshot.attendance?.semesterId ? ` · ${snapshot.attendance.semesterId}` : ""}
                  </p>
                </div>
                {profilePhoto ? (
                  <img
                    className="report-photo"
                    src={
                      profilePhoto.startsWith("data:") || profilePhoto.startsWith("http")
                        ? profilePhoto
                        : `data:image/jpeg;base64,${profilePhoto}`
                    }
                    alt="Student profile"
                  />
                ) : (
                  <div className="report-photo report-cover-photo-placeholder">
                    Photo
                    <br />
                    not synced
                  </div>
                )}
              </header>
              <nav className="report-index" aria-label="Report contents">
                <h2>Inside your report</h2>
                <ol className="report-index-list">
                  <li>
                    <a href="#academic-summary">Academic performance overview</a>
                  </li>
                  <li>
                    <a href="#curriculum-cover">Curriculum and credit progress</a>
                  </li>
                  <li>
                    <a href="#current-record">Current academic records</a>
                    <ol>
                      <li>
                        <a href="#current-attendance">Attendance</a>
                      </li>
                      <li>
                        <a href="#exam-schedule">Exam schedule</a>
                      </li>
                      <li>
                        <a href="#od-records">OD records and comparisons</a>
                      </li>
                      {subjects.map((subject) => (
                        <li key={subject.code}>
                          <a href={`#subject-${subject.code}`}>
                            {subject.code} · {subject.title}
                          </a>
                        </li>
                      ))}
                      {attendanceMonths.map((month) => (
                        <li key={month.label}>
                          <a href={`#attendance-${month.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}>
                            {month.label} attendance calendar
                          </a>
                        </li>
                      ))}
                    </ol>
                  </li>
                  <li>
                    <a href="#historic-record">Archived semester records</a>
                    <ol>
                      {semesterEntries.map(([semester]) => (
                        <li key={semester}>
                          <a href={`#history-${semester}`}>{semester} grade record</a>
                        </li>
                      ))}
                      <li>
                        <a href="#complete-grade-history">Complete grade history</a>
                      </li>
                    </ol>
                  </li>
                  {(segments.services || segments.finance || segments.events) && (
                    <>
                      {segments.events && (
                        <li>
                          <a href="#registered-events-cover">Registered events</a>
                        </li>
                      )}
                      <li>
                        <a href="#student-services-cover">Other student services</a>
                      </li>
                    </>
                  )}
                </ol>
              </nav>
              <p className="report-notice">
                Student generated informational report from data currently available in AmazeCC. This is not an official
                institutional transcript or certificate. Missing source details are not inferred.
              </p>

              <Section id="academic-summary" title="Academic summary" segment="overview">
                <div className="report-summary">
                  <div>
                    <strong>
                      {text(snapshot.marks?.cgpa?.cgpa || snapshot.marks?.cgpa || snapshot.profile?.cgpa)}
                    </strong>
                    <span>CGPA</span>
                  </div>
                  <div>
                    <strong>{text(snapshot.grades?.gpa || snapshot.grades?.sgpa)}</strong>
                    <span>Current term GPA</span>
                  </div>
                  <div>
                    <strong>
                      {percentage}
                      {percentage !== "—" ? "%" : ""}
                    </strong>
                    <span>Current attendance</span>
                  </div>
                  <div>
                    <strong>
                      {totals.attended}/{totals.total || "—"}
                    </strong>
                    <span>Classes attended</span>
                  </div>
                  <div>
                    <strong>{totalPresentDays}</strong>
                    <span>Days with no recorded absence</span>
                  </div>
                  <div>
                    <strong>{Math.max(0, totals.total - totals.attended)}</strong>
                    <span>Classes missed*</span>
                  </div>
                  <div>
                    <strong>{text(snapshot.marks?.cgpa?.creditsEarned)}</strong>
                    <span>Credits earned</span>
                  </div>
                </div>
                <h3 className="report-overview-subheading">Semester performance by course</h3>
                {semesterEntries.length ? (
                  <div className="report-summary report-semester-cards">
                    {semesterEntries.map(([semester, result]: [string, any]) => (
                      <div key={semester}>
                        <strong>{text(result?.gpa)}</strong>
                        <span>
                          {semester} · {Array.isArray(result?.grades) ? result.grades.length : 0} courses
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Empty>Semester performance history is not synced.</Empty>
                )}
                <p className="report-empty">
                  *Derived from current semester aggregate counts. Daily absence details are listed only where VTOP
                  provides datewise records.
                </p>
                <div id="academic-calendar" className="report-overview-calendar">
                  <h3 className="report-overview-subheading">Academic calendar events</h3>
                  {calendarMonths.length ? (
                    calendarMonths.map((month) => {
                      const daysInMonth = new Date(month.year, month.monthIndex + 1, 0).getDate();
                      return (
                        <div className="report-calendar-month" key={month.label}>
                          <h3>{month.label}</h3>
                          <div className="report-calendar">
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                              <div className="report-calendar-weekday" key={day}>
                                {day}
                              </div>
                            ))}
                            {Array.from({ length: month.offset }, (_, index) => (
                              <div className="report-calendar-day empty" key={`blank-${index}`} />
                            ))}
                            {Array.from({ length: daysInMonth }, (_, index) => {
                              const number = index + 1;
                              const events = month.days.get(number) || [];
                              return (
                                <div className="report-calendar-day" key={number}>
                                  <strong>{number}</strong>
                                  {events.map((event: any, eventIndex: number) => (
                                    <span key={eventIndex}>{text(event.text || event.category)}</span>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Empty />
                  )}
                </div>
              </Section>

              <Section title="Performance and attendance comparisons" segment="overview">
                <p>
                  Charts compare the current cached semester records. Session counts and calendar days are separate
                  measures.
                </p>
                <PieChart
                  title="Current semester class sessions"
                  slices={[
                    { label: "Present", value: totals.attended, color: "#26836d" },
                    { label: "Missed", value: Math.max(0, totals.total - totals.attended), color: "#c55454" },
                  ]}
                />
                <PieChart
                  title="Recorded days: no absences vs days with absence"
                  slices={[
                    {
                      label: "No recorded absences",
                      value: attendanceMonths.reduce((n, month) => n + month.presentDays, 0),
                      color: "#26836d",
                    },
                    {
                      label: "Days with absence",
                      value: attendanceMonths.reduce((n, month) => n + month.absentDays, 0),
                      color: "#c55454",
                    },
                  ]}
                />
                <ComparisonChart
                  title="Attendance rate by subject"
                  items={subjects
                    .filter((subject) => subject.attendancePct != null)
                    .map((subject) => ({ label: subject.code, value: subject.attendancePct }))}
                  unit="Attendance percent"
                />
                <ComparisonChart
                  title="On Duty hours claimed by subject"
                  items={subjects
                    .filter((subject) => subject.odHours > 0)
                    .map((subject) => ({ label: subject.code, value: subject.odHours }))}
                  unit="OD hours"
                />
                <ComparisonChart
                  title="Semester GPA history"
                  items={[...semesterEntries]
                    .reverse()
                    .map(([semester, result]: [string, any]) => ({ label: semester, value: Number(result?.gpa) || 0 }))}
                  unit="GPA"
                />
              </Section>

              <div
                id="curriculum-cover"
                className="report-divider report-curriculum-divider"
                data-report-segment="curriculum"
                aria-label="Curriculum and credit progress"
              >
                <span>AMAZECC · DEGREE MAP</span>
                <h2>Curriculum and credit progress</h2>
                <p>Course baskets, programme requirements, and progress through the degree</p>
              </div>
              <Section
                id="curriculum"
                title="Curriculum and credit progress"
                className="report-curriculum-section"
                segment="curriculum"
              >
                {Array.isArray(snapshot.allGrades?.curriculum || snapshot.grades?.curriculum) &&
                (snapshot.allGrades?.curriculum || snapshot.grades?.curriculum).length ? (
                  <Table headers={["Basket / distribution", "Credits required", "Credits earned", "Progress"]}>
                    {(snapshot.allGrades?.curriculum || snapshot.grades?.curriculum).map((item: any, index: number) => (
                      <tr key={index}>
                        <td>{text(item.basketTitle || item.distributionType || item.title)}</td>
                        <td>{text(item.creditsRequired)}</td>
                        <td>{text(item.creditsEarned)}</td>
                        <td>
                          {Number(item.creditsRequired) > 0
                            ? `${((Number(item.creditsEarned || 0) / Number(item.creditsRequired)) * 100).toFixed(1)}%`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </Table>
                ) : Array.isArray(snapshot.curriculum?.details) ? (
                  <div className="report-curriculum-groups">
                    {snapshot.curriculum.details.map((category: any, categoryIndex: number) => (
                      <section
                        className="report-curriculum-category"
                        key={`${category.code || category.name}-${categoryIndex}`}
                      >
                        <h3>{text(category.name || category.code, "Curriculum category")}</h3>
                        <div className="report-basket-index" aria-label="Baskets in this category">
                          {(category.baskets || []).map((basket: any, basketIndex: number) => (
                            <span key={`${basket.title}-${basketIndex}`}>{text(basket.title, "Course basket")}</span>
                          ))}
                        </div>
                        {(category.baskets || []).map((basket: any, basketIndex: number) => (
                          <div className="report-curriculum-basket" key={`${basket.title}-${basketIndex}`}>
                            <h4>{text(basket.title, "Course basket")}</h4>
                            <Table headers={["Course code", "Course", "Credits", "Type"]}>
                              {(basket.items || []).map((item: any, itemIndex: number) => (
                                <tr key={`${item.code}-${itemIndex}`}>
                                  <td>{text(item.code)}</td>
                                  <td>{text(item.name)}</td>
                                  <td>{text(item.credits)}</td>
                                  <td>{text(item.type)}</td>
                                </tr>
                              ))}
                            </Table>
                          </div>
                        ))}
                      </section>
                    ))}
                  </div>
                ) : (
                  <Empty />
                )}
              </Section>

              <div
                id="current-record"
                className="report-divider report-current-divider"
                data-report-segment="attendance"
                aria-label="Current semester academic record"
              >
                <span>AMAZECC · STUDENT RECORD</span>
                <h2>Current semester academic record</h2>
                <p>Attendance, assessments, course details, and grade predictions for the active semester</p>
              </div>
              <Section title="Datewise attendance register" segment="attendance">
                <h3 id="current-attendance">Current semester attendance by subject</h3>
                {attendanceCourses.length ? (
                  <Table headers={["Course", "Type", "Faculty", "Slot / venue", "Attended", "Total", "Attendance"]}>
                    {attendanceCourses.map((course: any, index: number) => (
                      <tr key={`${course.courseCode}-${index}`}>
                        <td>
                          <strong>{text(course.courseCode)}</strong>
                          <br />
                          {text(course.courseTitle)}
                        </td>
                        <td>{text(course.courseType || course.category)}</td>
                        <td>{text(course.faculty)}</td>
                        <td>
                          {text(course.slotName)}
                          {course.slotVenue ? ` / ${course.slotVenue}` : ""}
                        </td>
                        <td>{text(course.attendedClasses)}</td>
                        <td>{text(course.totalClasses)}</td>
                        <td>{text(course.attendancePercentage)}%</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Empty />
                )}
                {attendanceMonths.length ? (
                  attendanceMonths.map((month) => {
                    const daily = new Map<string, { present: number; absent: number; od: number }>();
                    month.rows.forEach((row: any) => {
                      const counts = daily.get(row.dateText) || { present: 0, absent: 0, od: 0 };
                      const status = row.status.toLowerCase();
                      if (status.includes("present")) counts.present++;
                      else if (status.includes("absent")) counts.absent++;
                      else if (status.includes("duty") || status === "od") counts.od++;
                      daily.set(row.dateText, counts);
                    });
                    const chartData = [...daily.entries()].map(([label, counts]) => ({
                      label: label.slice(0, 6),
                      ...counts,
                    }));
                    const calendarDate = month.rows.find((row: any) => row.date)?.date as Date | undefined;
                    const calendarDays = new Map<number, { present: number; absent: number; od: number }>();
                    daily.forEach((counts, label) => {
                      const parsed = parseReportDate(label);
                      if (parsed) calendarDays.set(parsed.getDate(), counts);
                    });
                    const peak = Math.max(1, ...chartData.map((item) => Math.max(item.present, item.absent)));
                    return (
                      <div
                        className="report-month"
                        id={`attendance-${month.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                        key={month.label}
                      >
                        <h3>{month.label}</h3>
                        {calendarDate && (
                          <div
                            className="report-calendar report-attendance-calendar"
                            aria-label={`${month.label} attendance calendar`}
                          >
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                              <div className="report-calendar-weekday" key={day}>
                                {day}
                              </div>
                            ))}
                            {Array.from({ length: calendarDate.getDay() }, (_, i) => (
                              <div className="report-calendar-day empty" key={`gap-${i}`} />
                            ))}
                            {Array.from(
                              {
                                length: new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate(),
                              },
                              (_, i) => {
                                const day = i + 1;
                                const c = calendarDays.get(day);
                                const tint = !c ? "" : c.absent ? "has-absence" : c.od ? "on-duty" : "all-present";
                                return (
                                  <div className={`report-calendar-day attendance-day ${tint}`} key={day}>
                                    <strong>{day}</strong>
                                    {c && (
                                      <span>
                                        {c.present} present{c.absent ? ` · ${c.absent} absent` : ""}
                                        {c.od ? ` · ${c.od} OD` : ""}
                                      </span>
                                    )}
                                  </div>
                                );
                              },
                            )}
                          </div>
                        )}
                        <div className="report-summary">
                          <div>
                            <strong>{month.days}</strong>
                            <span>Days recorded</span>
                          </div>
                          <div>
                            <strong>{month.presentDays}</strong>
                            <span>Days without absence</span>
                          </div>
                          <div>
                            <strong>{month.presentSessions}</strong>
                            <span>Present sessions</span>
                          </div>
                          <div>
                            <strong>{month.absentSessions}</strong>
                            <span>Absent sessions</span>
                          </div>
                          <div>
                            <strong>{month.odSessions}</strong>
                            <span>OD sessions</span>
                          </div>
                        </div>
                        <div
                          className="report-chart"
                          data-report-chart="attendance"
                          data-chart-title={`${month.label} daily attendance`}
                        >
                          <h4>Daily attendance sessions</h4>
                          <div className="report-bars">
                            {chartData.map((item, index) => (
                              <div
                                className="report-bar-item"
                                data-label={item.label}
                                data-value={item.present}
                                data-absent={item.absent}
                                data-peak={peak}
                                key={`${item.label}-${index}`}
                              >
                                <div className="report-bar-pair">
                                  <i
                                    className="report-bar"
                                    style={{ height: `${Math.max(2, (item.present / peak) * 80)}px` }}
                                  />
                                  <i
                                    className="report-bar absent"
                                    style={{ height: `${Math.max(2, (item.absent / peak) * 80)}px` }}
                                  />
                                </div>
                                <small>{item.label}</small>
                              </div>
                            ))}
                          </div>
                          <div className="report-chart-legend">
                            <span>
                              <i /> Present
                            </span>
                            <span>
                              <i className="absent-key" /> Absent
                            </span>
                          </div>
                        </div>
                        <Table headers={["Date", "Course", "Class", "Status"]}>
                          {month.rows.map((row: any) => (
                            <tr key={`${row.course.courseCode}-${row.dateText}-${row.index}`}>
                              <td>{row.dateText}</td>
                              <td>
                                {text(row.course.courseCode)} · {text(row.course.courseTitle)}
                              </td>
                              <td>{text(row.course.courseType || row.course.category)}</td>
                              <td>{row.status}</td>
                            </tr>
                          ))}
                        </Table>
                      </div>
                    );
                  })
                ) : (
                  <Empty>VTOP has not supplied datewise attendance details in the cached data.</Empty>
                )}
              </Section>

              <Section
                id="od-records"
                title="OD usage and official coverage"
                className="report-page-start"
                segment="od"
              >
                {subjects.some((subject) => subject.odHours > 0) ? (
                  <>
                    <div className="report-summary">
                      <div>
                        <strong>{subjects.reduce((n, subject) => n + subject.odHours, 0)}</strong>
                        <span>OD hours claimed*</span>
                      </div>
                      <div>
                        <strong>{subjects.reduce((n, subject) => n + subject.odValidHours, 0)}</strong>
                        <span>Valid / recovered hours</span>
                      </div>
                      <div>
                        <strong>{subjects.reduce((n, subject) => n + subject.odWastedHours, 0)}</strong>
                        <span>Wasted hours</span>
                      </div>
                      <div>
                        <strong>{subjects.reduce((n, subject) => n + subject.odDates.size, 0)}</strong>
                        <span>Course OD dates</span>
                      </div>
                    </div>
                    <PieChart
                      title="OD claim status: valid/recovered vs wasted"
                      slices={[
                        {
                          label: "Valid / recovered",
                          value: subjects.reduce((n, subject) => n + subject.odValidHours, 0),
                          color: "#26836d",
                        },
                        {
                          label: "Wasted",
                          value: subjects.reduce((n, subject) => n + subject.odWastedHours, 0),
                          color: "#c55454",
                        },
                      ]}
                    />
                    <Table
                      headers={[
                        "Subject",
                        "OD hours claimed*",
                        "Valid / recovered",
                        "Wasted",
                        "Official OD date match",
                      ]}
                    >
                      {subjects
                        .filter((subject) => subject.odHours > 0)
                        .map((subject) => (
                          <tr key={subject.code}>
                            <td>
                              {subject.code} · {subject.title}
                            </td>
                            <td>{subject.odHours}</td>
                            <td>{subject.odValidHours}</td>
                            <td>{subject.odWastedHours}</td>
                            <td>
                              {subject.odDates.size
                                ? `${subject.officialOdDates.size}/${subject.odDates.size} days (${((subject.officialOdDates.size / subject.odDates.size) * 100).toFixed(1)}%)`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                    </Table>
                    <p className="report-empty">
                      *Hours use AmazeCC OD Tracker's convention: theory session = 1 hour, lab session = 2 hours. The
                      source does not publish a total OD allowance, so this shows valid/wasted share and official date
                      matches rather than a quota-consumed percentage. Official records are matched by date, not by
                      course.
                    </p>
                  </>
                ) : (
                  <Empty>No datewise On Duty entries are available to calculate OD usage.</Empty>
                )}
                <h3>Official OD records</h3>
                {snapshot.officialOd.length ? (
                  <Table headers={["Date", "Type", "Reason", "Basis", "Time", "Remarks"]}>
                    {snapshot.officialOd.map((item: any, index: number) => (
                      <tr key={index}>
                        <td>{dateLabel(item.date)}</td>
                        <td>{text(item.type)}</td>
                        <td>{text(item.reason)}</td>
                        <td>{text(item.basis)}</td>
                        <td>{text(item.time)}</td>
                        <td>{text(item.remarks)}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Empty>No official OD records are available.</Empty>
                )}
              </Section>

              <Section
                id="exam-schedule"
                title="Current semester examination schedule"
                className="report-page-start"
                segment="exams"
              >
                {snapshot.schedule?.Schedule && Object.keys(snapshot.schedule.Schedule).length ? (
                  Object.entries(snapshot.schedule.Schedule).map(([type, exams]: [string, any]) => (
                    <div key={type} className="mb-3">
                      <h3 className="font-bold mb-1">{type}</h3>
                      <Table headers={["Course", "Date", "Session", "Time", "Venue", "Seat"]}>
                        {(Array.isArray(exams) ? exams : []).map((exam: any, index: number) => (
                          <tr key={index}>
                            <td>
                              {text(exam.courseCode)} · {text(exam.courseTitle)}
                            </td>
                            <td>{dateLabel(exam.examDate)}</td>
                            <td>{text(exam.examSession)}</td>
                            <td>{text(exam.examTime || exam.reportingTime)}</td>
                            <td>{text(exam.venue || exam.examVenue)}</td>
                            <td>{text(exam.seatLocation || exam.seatNo)}</td>
                          </tr>
                        ))}
                      </Table>
                    </div>
                  ))
                ) : (
                  <Empty />
                )}
              </Section>

              <div
                id="subject-dossiers-cover"
                data-report-segment="subjects"
                className="report-divider"
                aria-label="Current semester subject dossiers"
              >
                <span>AMAZECC · STUDENT RECORD</span>
                <h2>Current semester subject dossiers</h2>
                <p>Course attendance, assessment performance, grade predictions, faculty, and On Duty details</p>
              </div>
              <Section title="Current semester subject dossiers" segment="subjects">
                <p>
                  Each dossier combines current semester attendance, marks, course metadata, default AmazeCC grade
                  predictions, and available faculty review information.
                </p>
                {subjects.map((subject) => {
                  const faculty = facultyProfiles[subject.faculty.id || subject.faculty.name];
                  const review = faculty?.bundle?.prof || faculty?.review;
                  const directory = faculty?.profile;
                  const facultyName = review?.name || directory?.name || subject.faculty.name || subject.faculty.raw;
                  const department =
                    review?.dept || directory?.dept || subject.faculty.raw.split(/\s+-\s+/).slice(-1)[0];
                  const facultyPhoto = normalizedPhoto(
                    directory?.imageUrl || directory?.image || review?.image_url || review?.image || review?.avatar,
                  );
                  const assessments = subject.marks.flatMap((course: any) =>
                    (course.assessments || []).map((assessment: any) => ({
                      ...assessment,
                      component: course.courseType,
                      classNbr: course.classNbr,
                    })),
                  );
                  const marked = assessments.filter(
                    (assessment: any) =>
                      Number.isFinite(Number(assessment.scoredMark)) && Number(assessment.maxMark) > 0,
                  );
                  const assessmentPeak = Math.max(
                    1,
                    ...marked.map(
                      (assessment: any) => (Number(assessment.scoredMark) / Number(assessment.maxMark)) * 100,
                    ),
                  );
                  const currentGrade = semesterEntries
                    .flatMap(([, result]: [string, any]) => result?.grades || [])
                    .find((grade: any) => baseCourseCode(grade.courseCode) === subject.code);
                  const attendanceRows = subject.attendance;
                  const credits = attendanceRows.reduce(
                    (sum: number, course: any) => sum + (Number(course.credits) || 0),
                    0,
                  );
                  const assessmentAverage = marked.length
                    ? marked.reduce(
                        (sum: number, assessment: any) =>
                          sum + (Number(assessment.scoredMark) / Number(assessment.maxMark)) * 100,
                        0,
                      ) / marked.length
                    : null;
                  return (
                    <div className="report-subject" id={`subject-${subject.code}`} key={subject.code}>
                      <h3>
                        {subject.code} · {subject.title}
                      </h3>
                      <div className="report-summary">
                        <div>
                          <strong>
                            {subject.attendancePct == null ? "—" : `${subject.attendancePct.toFixed(1)}%`}
                          </strong>
                          <span>Attendance</span>
                        </div>
                        <div>
                          <strong>
                            {subject.attended}/{subject.total || "—"}
                          </strong>
                          <span>Present sessions</span>
                        </div>
                        <div>
                          <strong>{subject.odHours}</strong>
                          <span>OD hours claimed</span>
                        </div>
                        {currentGrade?.grade != null && currentGrade.grade !== "" && (
                          <div>
                            <strong>{text(currentGrade.grade)}</strong>
                            <span>Published grade</span>
                          </div>
                        )}
                        {currentGrade?.grandTotal != null && currentGrade.grandTotal !== "" && (
                          <div>
                            <strong>{text(currentGrade.grandTotal)}</strong>
                            <span>Published total</span>
                          </div>
                        )}
                      </div>
                      <div
                        className="report-summary report-subject-highlights"
                        aria-label="Additional subject statistics"
                      >
                        <div>
                          <strong>{Math.max(0, subject.total - subject.attended)}</strong>
                          <span>Missed sessions</span>
                        </div>
                        <div>
                          <strong>{credits || "—"}</strong>
                          <span>Registered credits</span>
                        </div>
                        <div>
                          <strong>{marked.length || "—"}</strong>
                          <span>Assessments with marks</span>
                        </div>
                        <div>
                          <strong>{assessmentAverage == null ? "—" : `${assessmentAverage.toFixed(1)}%`}</strong>
                          <span>Average assessment score</span>
                        </div>
                      </div>
                      <h4>Attendance comparison</h4>
                      <PieChart
                        title={`${subject.code}: present vs missed sessions`}
                        slices={[
                          { label: "Present", value: subject.attended, color: "#26836d" },
                          { label: "Missed", value: Math.max(0, subject.total - subject.attended), color: "#c55454" },
                        ]}
                      />
                      <h4>Course and class particulars</h4>
                      <Table
                        headers={[
                          "Course type",
                          "Credits",
                          "Class ID",
                          "Faculty ID",
                          "Faculty",
                          "Department",
                          "Slot",
                          "Venue",
                        ]}
                      >
                        {attendanceRows.map((course: any, index: number) => (
                          <tr key={`${course.courseType}-${index}`}>
                            <td>{text(course.courseType)}</td>
                            <td>{text(course.credits)}</td>
                            <td>
                              {text(
                                course.classId ||
                                  subject.marks.find((c: any) => c.courseType === course.courseType)?.classNbr,
                              )}
                            </td>
                            <td>{text(review?.employeeId || subject.faculty.id)}</td>
                            <td>{text(facultyName)}</td>
                            <td>{text(department)}</td>
                            <td>{text(course.slotName)}</td>
                            <td>{text(course.slotVenue)}</td>
                          </tr>
                        ))}
                      </Table>
                      {subject.prediction && (
                        <>
                          <h4>AmazeCC default grade prediction</h4>
                          <div className="report-summary">
                            <div>
                              <strong>{text(subject.prediction.optimalGrade?.letter, "Pending")}</strong>
                              <span>At current pace</span>
                            </div>
                            <div>
                              <strong>{text(subject.prediction.maximisableGrade?.letter)}</strong>
                              <span>Best reachable grade</span>
                            </div>
                            <div>
                              <strong>{subject.prediction.currentStandingPct.toFixed(1)}%</strong>
                              <span>Current scored standing</span>
                            </div>
                            <div>
                              <strong>{subject.prediction.maxPossibleScaled.toFixed(1)}%</strong>
                              <span>Maximum possible score</span>
                            </div>
                            <div>
                              <strong>{subject.classStats ? `${subject.classStats.mean.toFixed(1)}%` : "—"}</strong>
                              <span>
                                Class average{subject.classStats ? ` · n=${subject.classStats.count}` : " unavailable"}
                              </span>
                            </div>
                          </div>
                          <p className="report-empty">
                            Uses the grade prediction page engine, current class average when available, and the saved
                            assessment setup and simulated marks.{" "}
                            {subject.prediction.optimalGrade?.description ||
                              "No marked assessments yet; current-pace grade is not available."}
                          </p>
                        </>
                      )}
                      <h4>Assessment score distribution</h4>
                      {marked.length ? (
                        <div
                          className="report-chart"
                          data-report-chart="histogram"
                          data-chart-title={`${subject.code} assessment scores`}
                        >
                          <h4>Assessment marks as percentage of maximum</h4>
                          <div className="report-bars">
                            {marked.map((assessment: any, index: number) => {
                              const pct = (Number(assessment.scoredMark) / Number(assessment.maxMark)) * 100;
                              return (
                                <div
                                  className="report-bar-item"
                                  data-label={String(assessment.title || `Assessment ${index + 1}`).slice(0, 9)}
                                  data-value={pct}
                                  data-absent="0"
                                  data-peak={assessmentPeak}
                                  key={`${assessment.title}-${index}`}
                                >
                                  <div className="report-bar-pair">
                                    <i
                                      className="report-bar"
                                      style={{ height: `${Math.max(3, (pct / assessmentPeak) * 80)}px` }}
                                    />
                                  </div>
                                  <small>{String(assessment.title || `Assessment ${index + 1}`).slice(0, 9)}</small>
                                </div>
                              );
                            })}
                          </div>
                          <div className="report-chart-legend">
                            <span>
                              <i /> Score percent of maximum
                            </span>
                          </div>
                        </div>
                      ) : (
                        <Empty>No marked assessments are available for a score histogram.</Empty>
                      )}
                      <Table
                        headers={[
                          "Component",
                          "Assessment",
                          "Status",
                          "Score",
                          "Maximum",
                          "Weightage",
                          "Weighted score",
                        ]}
                      >
                        {assessments.map((assessment: any, index: number) => (
                          <tr key={`${assessment.component}-${assessment.title}-${index}`}>
                            <td>{text(assessment.component)}</td>
                            <td>{text(assessment.title)}</td>
                            <td>{text(assessment.status)}</td>
                            <td>{text(assessment.scoredMark)}</td>
                            <td>{text(assessment.maxMark)}</td>
                            <td>{text(assessment.weightagePercent)}%</td>
                            <td>{text(assessment.weightageMark)}</td>
                          </tr>
                        ))}
                      </Table>
                      <h4>OD claim status</h4>
                      {subject.odHours > 0 ? (
                        <>
                          <PieChart
                            title={`${subject.code}: valid/recovered vs wasted OD hours`}
                            slices={[
                              { label: "Valid / recovered", value: subject.odValidHours, color: "#26836d" },
                              { label: "Wasted", value: subject.odWastedHours, color: "#c55454" },
                            ]}
                          />
                          <p className="report-empty">
                            Official OD application date matched:{" "}
                            {subject.odDates.size
                              ? `${subject.officialOdDates.size} of ${subject.odDates.size} dates`
                              : "No OD dates"}
                            . This date match does not establish subject-level approval.
                          </p>
                        </>
                      ) : (
                        <p className="report-empty">No OD claims recorded for this subject.</p>
                      )}
                      <h4>Faculty review and public details</h4>
                      {review || directory ? (
                        <>
                          <div className="report-faculty-card">
                            {facultyPhoto ? (
                              <img src={facultyPhoto} alt={`${facultyName} faculty portrait`} />
                            ) : (
                              <div className="report-faculty-placeholder" aria-hidden="true">
                                {facultyName
                                  .split(/\s+/)
                                  .slice(0, 2)
                                  .map((part: string) => part[0])
                                  .join("")
                                  .toUpperCase()}
                              </div>
                            )}
                            <div className="report-faculty-card-copy">
                              <strong>{text(facultyName)}</strong>
                              <span>{text(review?.designation || directory?.designation, "Faculty")}</span>
                              <span>
                                {text(department)} · ID{" "}
                                {text(review?.employeeId || directory?.employeeId || subject.faculty.id)}
                              </span>
                            </div>
                            <div className="report-faculty-card-stat">
                              <strong>
                                {text(review?.wPct ?? directory?.wPct, "—")}
                                {review?.wPct != null || directory?.wPct != null ? "%" : ""}
                              </strong>
                              <span>recommendation</span>
                            </div>
                          </div>
                          <div className="report-summary">
                            <div>
                              <strong>{text(review?.reviews ?? directory?.reviews, "0")}</strong>
                              <span>Review count</span>
                            </div>
                            <div>
                              <strong>{text(review?.metrics?.lecture ?? directory?.metrics?.lecture, "—")}</strong>
                              <span>Lecture / explanation rating</span>
                            </div>
                            <div>
                              <strong>{text(review?.metrics?.da ?? directory?.metrics?.da, "—")}</strong>
                              <span>DA rating</span>
                            </div>
                            <div>
                              <strong>{text(review?.metrics?.vibe ?? directory?.metrics?.vibe, "—")}</strong>
                              <span>Class vibe</span>
                            </div>
                          </div>
                          <Table headers={["Faculty information", "Details"]}>
                            {[
                              [
                                "Employee / faculty ID",
                                review?.employeeId || directory?.employeeId || subject.faculty.id,
                              ],
                              ["Designation", review?.designation || directory?.designation],
                              ["Department / school", department],
                              ["Email", review?.email || directory?.email],
                              ["Intercom", review?.intercom || directory?.intercom],
                              ["Research areas", (review?.researchArea || directory?.researchArea || []).join("; ")],
                              [
                                "Specialization",
                                (review?.areasOfSpecialization || directory?.areasOfSpecialization || []).join("; "),
                              ],
                              ["Education", null],
                              ["Awards", (directory?.awards || review?.awards || []).join("; ")],
                              ["Scopus h-index", directory?.hIndexScopus ?? review?.hIndexScopus],
                              ["i10-index", directory?.i10Index ?? review?.i10Index],
                            ]
                              .filter(([, value]) => value !== undefined && value !== null && value !== "")
                              .map(([label, value]) => (
                                <tr key={String(label)}>
                                  <td>{String(label)}</td>
                                  <td>{text(value)}</td>
                                </tr>
                              ))}
                          </Table>
                          {Array.isArray(directory?.education || review?.education) &&
                            (directory?.education || review?.education).length > 0 && (
                              <div className="report-education-list" aria-label="Faculty education">
                                {(directory?.education || review?.education).map((entry: any, entryIndex: number) => {
                                  const values = typeof entry === "string" ? { degree: entry } : entry;
                                  const degree =
                                    values.degree ||
                                    values.qualification ||
                                    values.title ||
                                    values.program ||
                                    "Education";
                                  const year = [
                                    values.startYear || values.fromYear,
                                    values.endYear || values.year || values.toYear,
                                  ]
                                    .filter(Boolean)
                                    .join("–");
                                  const field =
                                    values.field || values.specialization || values.discipline || values.major;
                                  const institution =
                                    values.institution || values.university || values.institute || values.school;
                                  return (
                                    <div className="report-education-card" key={entryIndex}>
                                      <strong>{text(degree)}</strong>
                                      {year && <span className="report-education-year">{text(year)}</span>}
                                      {field && <span>{text(field)}</span>}
                                      {institution && <span>{text(institution)}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          {Array.isArray(review?.lore?.green) && review.lore.green.length > 0 && (
                            <div className="report-theme-group positive">
                              <strong>Common positive review themes</strong>
                              <div className="report-theme-list">
                                {review.lore.green.map((x: any, index: number) => (
                                  <span className="report-theme-pill" key={`${x.text}-${index}`}>
                                    {x.text} <b>{x.count}</b>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {Array.isArray(review?.lore?.red) && review.lore.red.length > 0 && (
                            <div className="report-theme-group critical">
                              <strong>Common critical review themes</strong>
                              <div className="report-theme-list">
                                {review.lore.red.map((x: any, index: number) => (
                                  <span className="report-theme-pill" key={`${x.text}-${index}`}>
                                    {x.text} <b>{x.count}</b>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <p className="report-empty">
                            Faculty review data is community supplied by VITFAC and may not represent the full class.
                            Ratings are not institutional evaluations.
                          </p>
                        </>
                      ) : (
                        <Empty>
                          Faculty review/profile details are unavailable or the VITFAC integration is disabled.
                        </Empty>
                      )}
                    </div>
                  );
                })}
              </Section>

              <div
                id="historic-record"
                data-report-segment="history"
                className="report-divider"
                aria-label="Historical academic report"
              >
                <span>AMAZECC · STUDENT RECORD</span>
                <h2>Historical academic report</h2>
                <p>Previously recorded semesters and archived academic results</p>
              </div>

              {snapshot.attendanceHistory.length > 0 && (
                <Section title="Archived semester attendance summaries" segment="history">
                  {snapshot.attendanceHistory.map(({ semesterId, data: archived }) => (
                    <div key={semesterId} className="mb-3">
                      <h3 className="font-bold mb-1">{semesterId}</h3>
                      {Array.isArray(archived.attendance) ? (
                        <Table headers={["Course", "Type", "Attended", "Total", "Attendance", "Date detail"]}>
                          {archived.attendance.map((course: any, index: number) => (
                            <tr key={`${course.courseCode}-${index}`}>
                              <td>
                                {text(course.courseCode)} · {text(course.courseTitle)}
                              </td>
                              <td>{text(course.courseType)}</td>
                              <td>{text(course.attendedClasses)}</td>
                              <td>{text(course.totalClasses)}</td>
                              <td>{text(course.attendancePercentage)}%</td>
                              <td>{Array.isArray(course.viewLink) ? course.viewLink.length : "Not supplied"}</td>
                            </tr>
                          ))}
                        </Table>
                      ) : (
                        <Empty />
                      )}
                    </div>
                  ))}
                </Section>
              )}

              <Section
                id="complete-grade-history"
                title="Complete grade history"
                className="report-grade-history-section"
                segment="history"
              >
                {semesterEntries.length ? (
                  semesterEntries.map(([semester, result]: [string, any]) => (
                    <div key={semester} id={`history-${semester}`} className="mb-4">
                      <h3 className="font-bold mb-1">
                        {semester} · GPA {text(result?.gpa)}
                      </h3>
                      {Array.isArray(result?.grades) && result.grades.length ? (
                        result.grades.map((grade: any, index: number) => {
                          const code = String(grade.courseCode || "")
                            .replace(/\s*\([TL]\)$/i, "")
                            .toUpperCase();
                          const courseMeta = (snapshot.marks?.courses || []).find(
                            (c: any) =>
                              String(c.courseCode || "")
                                .replace(/\s*\([TL]\)$/i, "")
                                .toUpperCase() === code,
                          );
                          return (
                            <div className="mb-3 report-course" key={`${grade.courseCode}-${index}`}>
                              <h4 className="font-bold">
                                {text(grade.courseCode)} · {text(grade.courseTitle)}
                              </h4>
                              <div className="report-grade-cards">
                                <div>
                                  <strong>{text(grade.courseType)}</strong>
                                  <span>Type</span>
                                </div>
                                {(grade.credits ?? courseMeta?.credits) != null && (
                                  <div>
                                    <strong>{text(grade.credits ?? courseMeta?.credits)}</strong>
                                    <span>Credits</span>
                                  </div>
                                )}
                                {grade.grandTotal != null && grade.grandTotal !== "" && (
                                  <div>
                                    <strong>{text(grade.grandTotal)}</strong>
                                    <span>Grand total</span>
                                  </div>
                                )}
                                {grade.grade != null && grade.grade !== "" && (
                                  <div>
                                    <strong>{text(grade.grade)}</strong>
                                    <span>Grade</span>
                                  </div>
                                )}
                              </div>
                              {Array.isArray(grade.details) && grade.details.length ? (
                                <Table headers={["Assessment / component", "Status", "Score", "Maximum"]}>
                                  {grade.details.map((detail: any, detailIndex: number) => (
                                    <tr key={`${grade.courseCode}-${detailIndex}`}>
                                      <td>{text(detail.component)}</td>
                                      <td>{text(detail.status)}</td>
                                      <td>{text(detail.scoredMark)}</td>
                                      <td>{text(detail.maxMark)}</td>
                                    </tr>
                                  ))}
                                </Table>
                              ) : (
                                <Empty>No assessment details supplied for this course.</Empty>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <Empty>No course grades are published for this semester.</Empty>
                      )}
                    </div>
                  ))
                ) : (
                  <Empty>Complete semester grade history is not synced.</Empty>
                )}
              </Section>

              {(segments.services || segments.finance || segments.events) && (
                <>
                  {segments.events && snapshot.events.length > 0 && (
                    <div id="registered-events-cover" data-report-segment="events" className="report-divider">
                      <span>AMAZECC · STUDENT SERVICES</span>
                      <h2>Registered events</h2>
                      <p>Event registrations, attendance dates, and payment status</p>
                    </div>
                  )}
                  {segments.events && snapshot.events.length > 0 && (
                    <Section id="registered-events" title="Registered events" segment="events">
                      <div className="report-summary">
                        <div>
                          <strong>{snapshot.events.length}</strong>
                          <span>Registrations</span>
                        </div>
                        <div>
                          <strong>
                            {
                              new Set(
                                snapshot.events
                                  .map((event: any) => parseReportDate(event.date)?.toISOString().slice(0, 10))
                                  .filter(Boolean),
                              ).size
                            }
                          </strong>
                          <span>Event days</span>
                        </div>
                      </div>
                      <ComparisonChart
                        title="Event registrations by month"
                        items={eventAnalytics(snapshot.events).map((month) => ({
                          label: month.label,
                          value: month.count,
                        }))}
                        unit="Registrations"
                      />
                      <ComparisonChart
                        title="Distinct event days by month"
                        items={eventAnalytics(snapshot.events).map((month) => ({
                          label: month.label,
                          value: month.days,
                        }))}
                        unit="Days"
                      />
                      <PieChart
                        title="Registered events by payment state"
                        slices={Object.entries(
                          snapshot.events.reduce((counts: Record<string, number>, event: any) => {
                            const state = String(event.paymentStatus || "Unknown");
                            counts[state] = (counts[state] || 0) + 1;
                            return counts;
                          }, {}),
                        ).map(([label, value], index) => ({
                          label,
                          value: Number(value),
                          color: ["#26836d", "#d59b32", "#6d83a3", "#c55454", "#8056a3"][index % 5],
                        }))}
                      />
                      <Table headers={["Event", "Date", "Time", "Venue", "Payment status"]}>
                        {snapshot.events.map((item: any, i: number) => (
                          <tr key={i}>
                            <td>{text(item.name)}</td>
                            <td>{dateLabel(item.date)}</td>
                            <td>{text(item.time)}</td>
                            <td>{text(item.venue)}</td>
                            <td>{text(item.paymentStatus)}</td>
                          </tr>
                        ))}
                      </Table>
                    </Section>
                  )}
                  {segments.services && (
                    <div id="student-services-cover" data-report-segment="services" className="report-divider">
                      <span>AMAZECC · STUDENT SERVICES</span>
                      <h2>Other student services</h2>
                      <p>Transport, library, learning platform, and financial records</p>
                    </div>
                  )}
                  {(segments.services || segments.finance) && (
                    <Section id="student-services" title="Other student services (sensitive)">
                      {segments.finance && (
                        <div data-report-segment="finance">
                          <h3>Financial record</h3>
                          <p>
                            Dues:{" "}
                            {snapshot.payments?.hasDues === false
                              ? "No dues reported"
                              : snapshot.payments?.hasDues === true
                                ? "Dues reported"
                                : text(snapshot.payments?.message || snapshot.payments?.status)}
                          </p>
                          {Array.isArray(snapshot.receipts?.receipts) && (
                            <Table headers={["Receipt", "Date", "Amount", "Campus"]}>
                              {snapshot.receipts.receipts.map((item: any, i: number) => (
                                <tr key={i}>
                                  <td>{text(item.receiptNumber)}</td>
                                  <td>{text(item.date)}</td>
                                  <td>{text(item.amount)}</td>
                                  <td>{text(item.campusCode)}</td>
                                </tr>
                              ))}
                            </Table>
                          )}
                          {Array.isArray(snapshot.wallet?.ledgerINR) && (
                            <Table headers={["Date", "Receipt", "Type", "Amount", "Refund", "Balance", "Refund date"]}>
                              {snapshot.wallet.ledgerINR.map((item: any, i: number) => (
                                <tr key={i}>
                                  <td>{text(item.transactionDate)}</td>
                                  <td>{text(item.receiptNumber)}</td>
                                  <td>{text(item.transactionType)}</td>
                                  <td>{text(item.amount)}</td>
                                  <td>{text(item.refundAmount)}</td>
                                  <td>{text(item.bookBalanceAmount)}</td>
                                  <td>{text(item.refundDate)}</td>
                                </tr>
                              ))}
                            </Table>
                          )}
                          <p className="report-empty">
                            Cached records provide current payment states and ledger entries; transition history is not
                            supplied.
                          </p>
                        </div>
                      )}
                      {segments.services && snapshot.transport && (
                        <>
                          <h3>Transport</h3>
                          <Table headers={["Field", "Value"]}>
                            {[
                              ["Registration", snapshot.transport.hasRegistration ? "Registered" : "Not registered"],
                              ["Route", snapshot.transport.routeSelected],
                              ["Payment status", snapshot.transport.paymentStatus],
                              ["Bus route", snapshot.transport.busRouteId],
                              ["Programme", snapshot.transport.programme],
                              ["Branch", snapshot.transport.branch],
                            ]
                              .filter(([, value]) => value != null && value !== "")
                              .map(([field, value]) => (
                                <tr key={String(field)}>
                                  <td>{String(field)}</td>
                                  <td>{text(value)}</td>
                                </tr>
                              ))}
                          </Table>
                        </>
                      )}
                      {segments.services && snapshot.library && (
                        <>
                          <h3>Library</h3>
                          <Table headers={["Item", "Value"]}>
                            {Object.entries(snapshot.library.keyValuePairs || {})
                              .filter(([key]) => !/csrf|authori[sz]edid|token|secret/i.test(key))
                              .map(([key, value]) => (
                                <tr key={key}>
                                  <td>{key}</td>
                                  <td>{text(value)}</td>
                                </tr>
                              ))}
                          </Table>
                        </>
                      )}
                      {segments.services && snapshot.moodle.length > 0 && (
                        <>
                          <h3>Moodle</h3>
                          <Table headers={["Course", "Activity", "Due", "Status"]}>
                            {snapshot.moodle.map((item: any, i: number) => (
                              <tr key={i}>
                                <td>{text(item.course || item.courseName)}</td>
                                <td>{text(item.name || item.title || item.activity)}</td>
                                <td>{text(item.dueDate || item.due)}</td>
                                <td>{text(item.status)}</td>
                              </tr>
                            ))}
                          </Table>
                        </>
                      )}
                      {segments.services && !snapshot.transport && !snapshot.library && !snapshot.moodle.length && (
                        <Empty />
                      )}
                    </Section>
                  )}
                </>
              )}
              <footer className="report-foot">
                AmazeCC student-generated report · Generated {snapshot.collectedAt.toLocaleString("en-IN")} · Cached
                source records may be incomplete or stale.
              </footer>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
