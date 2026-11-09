"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, RotateCw, ShieldCheck } from "lucide-react";
import { getAssetPath } from "@/lib/utils";
import { downloadStudentReportPdf } from "@/lib/studentReportPdf";
import { computeCoursePrediction, createPredictorAssessmentsFromVTOP } from "@/lib/marksPredictor";
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
    const theory = item.marks.find(
      (c: any) =>
        !String(c.slot || "")
          .toUpperCase()
          .startsWith("L") && !/lab/i.test(c.courseType),
    );
    const lab = item.marks.find(
      (c: any) =>
        String(c.slot || "")
          .toUpperCase()
          .startsWith("L") || /lab/i.test(c.courseType),
    );
    const saved = data.predictor?.[item.code] || {};
    const theoryAssessments = saved.theoryAssessments || createPredictorAssessmentsFromVTOP(theory, "theory");
    const labAssessments = saved.labAssessments || createPredictorAssessmentsFromVTOP(lab, "lab");
    for (const assessment of [...theoryAssessments, ...labAssessments]) {
      if (saved.simulations?.[assessment.id] !== undefined) {
        assessment.scoredMark = Number(saved.simulations[assessment.id]);
        assessment.isSimulated = true;
        assessment.status = "Simulated";
      }
    }
    const courseType =
      item.attendance
        .map((c: any) => c.courseType)
        .filter(Boolean)
        .join(" + ") ||
      theory?.courseType ||
      lab?.courseType ||
      "Course";
    const stats = theory?.classNbr
      ? data.marksStats?.[theory.classNbr]?.overall
      : lab?.classNbr
        ? data.marksStats?.[lab.classNbr]?.overall
        : null;
    item.prediction =
      theoryAssessments.length || labAssessments.length
        ? computeCoursePrediction({
            courseCode: item.code,
            courseTitle: item.title,
            courseType,
            theoryAssessments,
            labAssessments,
            theoryCredits: Number(saved.theoryCredits ?? theory?.credits ?? 3),
            labCredits: Number(saved.labCredits ?? lab?.credits ?? 1),
            courseSystem: theory?.courseSystem || lab?.courseSystem,
            classStats: stats,
          })
        : null;
  }
  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section">
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
  const [mode, setMode] = useState<"color" | "greyscale">("greyscale");
  const [includeFinance, setIncludeFinance] = useState(false);
  const [includeServices, setIncludeServices] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [exportError, setExportError] = useState("");
  useEffect(() => setData(collectReportData()), []);
  const snapshot = data;
  const attendanceCourses = Array.isArray(snapshot?.attendance?.attendance) ? snapshot.attendance.attendance : [];
  const gradeMap = snapshot?.allGrades?.grades || (snapshot?.grades as any)?.grades || snapshot?.grades || {};
  const semesterEntries = Object.entries(gradeMap)
    .filter(([, value]) => value && typeof value === "object")
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
  const attendanceMonths = attendanceByMonth(attendanceCourses);
  const totalPresentDays = attendanceMonths.reduce((sum, month) => sum + month.presentDays, 0);
  const subjects = useMemo(() => (snapshot ? subjectsFrom(snapshot) : []), [snapshot]);

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
    const root = document.getElementById("student-report");
    if (!root) return;
    const exportRoot = root.cloneNode(true) as HTMLElement;
    exportRoot.querySelector(".report-controls")?.remove();
    setIsDownloading(true);
    setExportError("");
    try {
      const styles = Array.from(root.querySelectorAll("style"))
        .map((style) => style.textContent || "")
        .join("\n");
      const html = `<div class="report-capture"><style>${styles}.report-capture{width:820px;background:#fff}.mb-4{margin-bottom:1rem}.mb-3{margin-bottom:.75rem}.mb-1{margin-bottom:.25rem}.font-bold{font-weight:700}.text-xs{font-size:12px}.text-center{text-align:center}.whitespace-pre-wrap{white-space:pre-wrap}.break-words{overflow-wrap:anywhere}.grid{display:grid}.place-items-center{place-items:center}</style>${exportRoot.outerHTML}</div>`;
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

  return (
    <main id="student-report" className={`student-report ${mode}`}>
      <style>{`
        .student-report{--ink:#172033;--muted:#596579;--line:#cbd2dc;--band:#eaf0f7;--paper:#fff;--accent:#173b67;color:var(--ink);background:var(--paper);font:14px/1.45 Arial,Helvetica,sans-serif;padding:clamp(16px,3vw,36px);max-width:1120px;margin:0 auto}
        .student-report.greyscale{--ink:#171717;--muted:#555;--line:#bdbdbd;--band:#ededed;--accent:#222}
        .student-report.color{--ink:#172033;--muted:#596579;--line:#cbd2dc;--band:#eaf0f7;--accent:#173b67}
        .report-controls{display:flex;flex-wrap:wrap;align-items:center;gap:14px;padding:14px;border:1px solid var(--line);border-radius:10px;margin-bottom:20px;background:var(--band)}
        .report-controls button,.report-controls select{font:inherit;padding:8px 12px;border:1px solid var(--line);border-radius:7px;background:var(--paper);color:var(--ink)}
        .report-controls button{display:inline-flex;align-items:center;gap:7px;font-weight:700;cursor:pointer}.report-controls label{display:inline-flex;align-items:center;gap:6px}
        .report-cover{display:grid;grid-template-columns:64px 1fr 88px;gap:16px;align-items:center;padding:16px 0 20px;border-bottom:3px double var(--ink)}
        .report-logo{width:58px;height:58px;object-fit:contain}.report-photo{width:78px;height:92px;object-fit:cover;border:1px solid var(--line);border-radius:4px}
        .report-cover h1{font-family:Georgia,serif;font-size:25px;line-height:1.15;margin:0 0 5px;color:var(--accent)}.report-cover p{margin:2px 0;color:var(--muted)}
        .report-notice{font-size:11px;color:var(--muted);margin:14px 0 26px;padding:10px 12px;border-left:3px solid var(--line);background:var(--band)}.report-section{margin:34px 0 42px;padding-top:4px;break-inside:auto}.report-section h2{font:700 16px Georgia,serif;color:var(--accent);padding:8px 11px;margin:0 0 18px;background:var(--band);border-left:3px solid var(--accent)}.report-section>*+*{margin-top:18px}.report-section h3{margin-top:26px}.report-section .report-chart{margin:18px 0 22px}
        .report-table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid var(--line);padding:5px 7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group}th{background:var(--band);font-weight:700}tr{break-inside:avoid}
        .report-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:10px;margin:16px 0}.report-summary div{border:1px solid var(--line);border-top:3px solid var(--accent);padding:11px 12px;background:var(--paper);min-height:58px}.report-summary strong{display:block;font:700 19px Georgia,serif}.report-summary span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
        .report-chart{border:1px solid var(--line);padding:12px;margin:10px 0 14px;break-inside:avoid}.report-chart h4{margin:0 0 9px;font:700 12px Georgia,serif;color:var(--accent)}.report-bars{display:flex;align-items:end;gap:5px;height:110px;border-bottom:1px solid var(--line);padding:0 4px;overflow:hidden}.report-bar-item{flex:1;min-width:16px;text-align:center;font-size:8px;color:var(--muted)}.report-bar-pair{height:86px;display:flex;align-items:end;justify-content:center;gap:2px}.report-bar{min-height:2px;background:#2d6a9f;border-radius:3px 3px 0 0;width:40%;max-width:13px}.report-bar.absent{background:#c55454}.report-chart-legend{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:7px;font-size:9px;color:var(--muted)}.report-chart-legend span{display:inline-flex;align-items:center;gap:4px}.report-chart-legend i{display:inline-block;width:8px;height:8px;background:#2d6a9f}.report-chart-legend .absent-key{background:#c55454}.report-pie-layout{display:flex;align-items:center;gap:20px}.report-pie-disc{width:116px;height:116px;flex:0 0 116px;border-radius:50%;position:relative}.report-pie-disc:after{content:"";position:absolute;inset:30px;border-radius:50%;background:var(--paper);border:1px solid var(--line)}.report-pie-disc>i{display:none}.report-pie .report-chart-legend{display:grid}.report-month{break-before:page}.report-month h3,.report-subject h3,.report-curriculum-category h3{font:700 15px Georgia,serif;color:var(--accent);border-bottom:1px solid var(--line);padding-bottom:8px;margin-bottom:16px}.report-subject{break-before:page;padding-top:8px}.report-subject>*+*{margin-top:18px}.report-subject h4,.report-curriculum-basket h4{font:700 12px Georgia,serif;color:var(--accent);margin:22px 0 9px;padding-bottom:5px;border-bottom:1px solid var(--line)}.report-faculty-card{display:flex;align-items:center;gap:12px;border:1px solid var(--line);border-left:4px solid var(--accent);padding:12px 14px;margin:14px 0;background:var(--band);break-inside:avoid}.report-faculty-card img,.report-faculty-placeholder{width:58px;height:68px;object-fit:cover;border:1px solid var(--line);background:var(--paper);flex:none}.report-faculty-placeholder{display:grid;place-items:center;font:700 18px Georgia,serif;color:var(--accent)}.report-faculty-card-copy{display:grid;gap:3px;flex:1}.report-faculty-card-copy strong{font:700 14px Georgia,serif;color:var(--accent)}.report-faculty-card-copy span,.report-faculty-card-stat span{font-size:10px;color:var(--muted)}.report-faculty-card-stat{text-align:right}.report-faculty-card-stat strong{display:block;font:700 18px Georgia,serif;color:var(--accent)}.report-curriculum-category{break-before:page}.report-curriculum-basket{margin-bottom:24px}
        .report-empty{color:var(--muted);font-style:italic;font-size:12px}.report-foot{border-top:1px solid var(--line);padding-top:8px;margin-top:24px;color:var(--muted);font-size:10px}
        @media(max-width:600px){.report-cover{grid-template-columns:44px 1fr 60px;gap:9px}.report-logo{width:42px;height:42px}.report-photo{width:56px;height:68px}.report-cover h1{font-size:19px}}
      `}</style>
      <div className="report-controls" aria-label="Report export options">
        <label>
          PDF style{" "}
          <select value={mode} onChange={(event) => setMode(event.target.value as "color" | "greyscale")}>
            <option value="greyscale">Greyscale</option>
            <option value="color">Color</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeFinance}
            onChange={(event) => setIncludeFinance(event.target.checked)}
          />{" "}
          Include financial records
        </label>
        <label>
          <input
            type="checkbox"
            checked={includeServices}
            onChange={(event) => setIncludeServices(event.target.checked)}
          />{" "}
          Include student services
        </label>
        <button type="button" onClick={refresh}>
          <RotateCw size={16} /> Refresh data
        </button>
        <button type="button" onClick={downloadPdf} disabled={isDownloading || !snapshot}>
          <Download size={16} /> {isDownloading ? "Generating PDF…" : "Download PDF"}
        </button>
        <span className="text-xs text-muted-foreground">
          <ShieldCheck size={14} className="inline" /> Generated on this device
        </span>
        {exportError && (
          <span role="alert" className="text-xs text-red-700">
            {exportError}
          </span>
        )}
      </div>

      {snapshot && (
        <article>
          <header className="report-cover">
            <img className="report-logo" src={getAssetPath("/logo.png")} alt="AmazeCC" />
            <div>
              <h1>Student Academic Report</h1>
              <p>
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
              <p>
                Generated {snapshot.collectedAt.toLocaleString("en-IN")}
                {snapshot.attendance?.semesterId ? ` · Current semester ${snapshot.attendance.semesterId}` : ""}
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
              <div className="report-photo grid place-items-center text-xs text-center text-muted-foreground">
                Photo
                <br />
                not synced
              </div>
            )}
          </header>
          <p className="report-notice">
            Student generated informational report from data currently available in AmazeCC. This is not an official
            institutional transcript or certificate. Missing source details are not inferred.
          </p>

          <Section title="Academic summary">
            <div className="report-summary">
              <div>
                <strong>{text(snapshot.marks?.cgpa?.cgpa || snapshot.marks?.cgpa || snapshot.profile?.cgpa)}</strong>
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
            <p className="report-empty">
              *Derived from current semester aggregate counts. Daily absence details are listed only where VTOP provides
              datewise records.
            </p>
          </Section>

          <Section title="Performance and attendance comparisons">
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

          <Section title="Current semester attendance">
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
          </Section>

          <Section title="Datewise attendance register">
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
                const peak = Math.max(1, ...chartData.map((item) => Math.max(item.present, item.absent)));
                return (
                  <div className="report-month" key={month.label}>
                    <h3>{month.label}</h3>
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

          {snapshot.attendanceHistory.length > 0 && (
            <Section title="Archived semester attendance summaries">
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

          <Section title="Complete grade history">
            {semesterEntries.length ? (
              semesterEntries.map(([semester, result]: [string, any]) => (
                <div key={semester} className="mb-4">
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
                          <p>
                            Type: {text(grade.courseType)} · Credits: {text(grade.credits ?? courseMeta?.credits)} ·
                            Grand total: {text(grade.grandTotal)} · Grade: {text(grade.grade)}
                          </p>
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

          <Section title="OD usage and official coverage">
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
                  headers={["Subject", "OD hours claimed*", "Valid / recovered", "Wasted", "Official OD date match"]}
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
                  *Hours use AmazeCC OD Tracker's convention: theory session = 1 hour, lab session = 2 hours. The source
                  does not publish a total OD allowance, so this shows valid/wasted share and official date matches
                  rather than a quota-consumed percentage. Official records are matched by date, not by course.
                </p>
              </>
            ) : (
              <Empty>No datewise On Duty entries are available to calculate OD usage.</Empty>
            )}
          </Section>

          <Section title="Current semester subject dossiers">
            <p>
              Each dossier combines current semester attendance, marks, course metadata, default AmazeCC grade
              predictions, and available faculty review information.
            </p>
            {subjects.map((subject) => {
              const faculty = facultyProfiles[subject.faculty.id || subject.faculty.name];
              const review = faculty?.bundle?.prof || faculty?.review;
              const directory = faculty?.profile;
              const facultyName = review?.name || directory?.name || subject.faculty.name || subject.faculty.raw;
              const department = review?.dept || directory?.dept || subject.faculty.raw.split(/\s+-\s+/).slice(-1)[0];
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
                (assessment: any) => Number.isFinite(Number(assessment.scoredMark)) && Number(assessment.maxMark) > 0,
              );
              const assessmentPeak = Math.max(
                1,
                ...marked.map((assessment: any) => (Number(assessment.scoredMark) / Number(assessment.maxMark)) * 100),
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
                <div className="report-subject" key={subject.code}>
                  <h3>
                    {subject.code} · {subject.title}
                  </h3>
                  <div className="report-summary">
                    <div>
                      <strong>{subject.attendancePct == null ? "—" : `${subject.attendancePct.toFixed(1)}%`}</strong>
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
                    <div>
                      <strong>{text(currentGrade?.grade, "—")}</strong>
                      <span>Published grade</span>
                    </div>
                    <div>
                      <strong>{text(currentGrade?.grandTotal, "—")}</strong>
                      <span>Published total</span>
                    </div>
                  </div>
                  <div className="report-summary report-subject-highlights" aria-label="Additional subject statistics">
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
                          <strong>{subject.prediction.isCurved ? "Yes" : "No"}</strong>
                          <span>Relative grade curve used</span>
                        </div>
                      </div>
                      <p className="report-empty">
                        Default uses AmazeCC's current marks and default assessment regimen. Any saved simulated marks
                        are included in the prediction.{" "}
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
                    headers={["Component", "Assessment", "Status", "Score", "Maximum", "Weightage", "Weighted score"]}
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
                          <strong>
                            {text(review?.wPct ?? directory?.wPct, "Not rated")}
                            {review?.wPct != null || directory?.wPct != null ? "%" : ""}
                          </strong>
                          <span>VITFAC win / recommendation rate</span>
                        </div>
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
                          ["Employee / faculty ID", review?.employeeId || directory?.employeeId || subject.faculty.id],
                          ["Designation", review?.designation || directory?.designation],
                          ["Department / school", department],
                          ["Email", review?.email || directory?.email],
                          ["Intercom", review?.intercom || directory?.intercom],
                          ["Research areas", (review?.researchArea || directory?.researchArea || []).join("; ")],
                          [
                            "Specialization",
                            (review?.areasOfSpecialization || directory?.areasOfSpecialization || []).join("; "),
                          ],
                          [
                            "Education",
                            (directory?.education || review?.education || [])
                              .map((x: any) => (typeof x === "string" ? x : Object.values(x).join(" · ")))
                              .join("; "),
                          ],
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
                      {Array.isArray(review?.lore?.green) && review.lore.green.length > 0 && (
                        <p>
                          Common positive review themes:{" "}
                          {review.lore.green.map((x: any) => `${x.text} (${x.count})`).join("; ")}
                        </p>
                      )}
                      {Array.isArray(review?.lore?.red) && review.lore.red.length > 0 && (
                        <p>
                          Common critical review themes:{" "}
                          {review.lore.red.map((x: any) => `${x.text} (${x.count})`).join("; ")}
                        </p>
                      )}
                      <p className="report-empty">
                        Faculty review data is community supplied by VITFAC and may not represent the full class.
                        Ratings are not institutional evaluations.
                      </p>
                    </>
                  ) : (
                    <Empty>Faculty review/profile details are unavailable or the VITFAC integration is disabled.</Empty>
                  )}
                </div>
              );
            })}
          </Section>

          <Section title="Curriculum and credit progress">
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

          <Section title="Exam schedule">
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

          <Section title="Academic calendar">
            {calendarRows.length ? (
              <Table headers={["Date", "Academic calendar event", "Type", "Category"]}>
                {calendarRows.flatMap((day) =>
                  day.events.map((event, index) => (
                    <tr key={`${day.key}-${index}`}>
                      <td>{day.label}</td>
                      <td>{text(event.text)}</td>
                      <td>{text(event.type)}</td>
                      <td>{text(event.category)}</td>
                    </tr>
                  )),
                )}
              </Table>
            ) : (
              <Empty />
            )}
          </Section>

          <Section title="Official OD records">
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
              <Empty />
            )}
          </Section>

          <Section title="Semester performance by course">
            {semesterEntries.length ? (
              semesterEntries.map(([semester, result]: [string, any]) => (
                <div key={semester} className="mb-3">
                  <h3 className="font-bold">{semester}</h3>
                  <p>
                    GPA: {text(result?.gpa)} · Courses: {Array.isArray(result?.grades) ? result.grades.length : 0}
                  </p>
                </div>
              ))
            ) : (
              <Empty />
            )}
          </Section>

          {includeFinance && (
            <Section title="Financial record (sensitive)">
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
                Cached records provide current payment states and ledger entries; transition history is not supplied.
              </p>
            </Section>
          )}
          {includeServices && (
            <Section title="Other student services (sensitive)">
              {snapshot.transport && (
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
              {snapshot.library && (
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
              {snapshot.moodle.length > 0 && (
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
              {snapshot.events.length > 0 && (
                <>
                  <h3>Registered events</h3>
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
                    items={eventAnalytics(snapshot.events).map((month) => ({ label: month.label, value: month.count }))}
                    unit="Registrations"
                  />
                  <ComparisonChart
                    title="Distinct event days by month"
                    items={eventAnalytics(snapshot.events).map((month) => ({ label: month.label, value: month.days }))}
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
                </>
              )}
              {!snapshot.transport && !snapshot.library && !snapshot.moodle.length && !snapshot.events.length && (
                <Empty />
              )}
            </Section>
          )}
          <footer className="report-foot">
            AmazeCC student-generated report · Generated {snapshot.collectedAt.toLocaleString("en-IN")} · Cached source
            records may be incomplete or stale.
          </footer>
        </article>
      )}
    </main>
  );
}
