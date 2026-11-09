"use client";

import { useEffect, useState } from "react";
import { Download, RotateCw, ShieldCheck } from "lucide-react";
import { getAssetPath } from "@/lib/utils";
import { downloadStudentReportPdf } from "@/lib/studentReportPdf";

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

export default function StudentReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
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
        .report-notice{font-size:11px;color:var(--muted);margin:10px 0 18px}.report-section{margin:22px 0;break-inside:auto}.report-section h2{font:700 16px Georgia,serif;color:var(--accent);padding:6px 9px;margin:0 0 10px;background:var(--band);border-left:3px solid var(--accent)}
        .report-table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid var(--line);padding:5px 7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}thead{display:table-header-group}th{background:var(--band);font-weight:700}tr{break-inside:avoid}
        .report-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px}.report-summary div{border:1px solid var(--line);padding:9px}.report-summary strong{display:block;font:700 18px Georgia,serif}.report-summary span{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
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
            {attendanceCourses.some((course: any) => Array.isArray(course.viewLink)) ? (
              <Table headers={["Date", "Course", "Class", "Status"]}>
                {attendanceCourses
                  .flatMap((course: any) =>
                    Array.isArray(course.viewLink)
                      ? course.viewLink.map((entry: any, index: number) => ({ course, entry, index }))
                      : [],
                  )
                  .sort((a: any, b: any) => String(a.entry.date || "").localeCompare(String(b.entry.date || "")))
                  .map(({ course, entry, index }: any) => (
                    <tr key={`${course.courseCode}-${entry.date}-${index}`}>
                      <td>{dateLabel(entry.date)}</td>
                      <td>
                        {text(course.courseCode)} · {text(course.courseTitle)}
                      </td>
                      <td>{text(course.courseType || course.category)}</td>
                      <td>{text(entry.status)}</td>
                    </tr>
                  ))}
              </Table>
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

          <Section title="Assessment marks">
            {marksCourses.length ? (
              <Table headers={["Course", "Assessment", "Status", "Score / max", "Weightage", "Weighted score"]}>
                {marksCourses.flatMap((course: any) =>
                  (course.assessments || []).map((assessment: any, index: number) => (
                    <tr key={`${course.courseCode}-${index}`}>
                      <td>
                        {text(course.courseCode)} · {text(course.courseTitle)}
                      </td>
                      <td>{text(assessment.title)}</td>
                      <td>{text(assessment.status)}</td>
                      <td>
                        {text(assessment.scoredMark)} / {text(assessment.maxMark)}
                      </td>
                      <td>{text(assessment.weightagePercent)}%</td>
                      <td>{text(assessment.weightageMark)}</td>
                    </tr>
                  )),
                )}
              </Table>
            ) : (
              <Empty />
            )}
            {snapshot.predictor && Object.keys(snapshot.predictor).length > 0 && (
              <>
                <h3>Saved grade predictor scenarios (what-if inputs)</h3>
                <Table
                  headers={["Course", "Target score", "Ignored in GPA", "Simulated marks", "Assessment overrides"]}
                >
                  {Object.entries(snapshot.predictor).map(([code, state]: [string, any]) => (
                    <tr key={code}>
                      <td>{code}</td>
                      <td>{text(state.targetScore)}</td>
                      <td>{state.ignored ? "Yes" : "No"}</td>
                      <td>
                        {Object.entries(state.simulations || {})
                          .map(([id, score]) => `${id}: ${score}`)
                          .join("; ") || "None"}
                      </td>
                      <td>
                        {[
                          ...(state.theoryAssessments || []),
                          ...(state.labAssessments || []),
                          ...(state.projectAssessments || []),
                        ]
                          .map((item: any) => `${text(item.title || item.name)} (${text(item.weightage)}%)`)
                          .join("; ") || text(state.regimenPresetId, "Default")}
                      </td>
                    </tr>
                  ))}
                </Table>
                <p className="report-empty">
                  These are saved what-if settings, not published marks or predicted grades.
                </p>
              </>
            )}
          </Section>

          <Section title="Complete grade history">
            {semesterEntries.length ? (
              semesterEntries.map(([semester, result]: [string, any]) => (
                <div key={semester} className="mb-4">
                  <h3 className="font-bold mb-1">
                    {semester} · GPA {text(result?.gpa)}
                  </h3>
                  {Array.isArray(result?.grades) && result.grades.length ? (
                    <Table
                      headers={[
                        "Course code",
                        "Course",
                        "Type",
                        "Credits",
                        "Grand total",
                        "Grade",
                        "Assessment details",
                      ]}
                    >
                      {result.grades.map((grade: any, index: number) => (
                        <tr key={`${grade.courseCode}-${index}`}>
                          <td>{text(grade.courseCode)}</td>
                          <td>{text(grade.courseTitle)}</td>
                          <td>{text(grade.courseType)}</td>
                          <td>
                            {text(
                              (snapshot.marks?.courses || []).find((c: any) => c.courseCode === grade.courseCode)
                                ?.credits,
                            )}
                          </td>
                          <td>{text(grade.grandTotal)}</td>
                          <td>
                            <strong>{text(grade.grade)}</strong>
                          </td>
                          <td>
                            {(grade.details || [])
                              .map(
                                (detail: any) =>
                                  `${text(detail.component)}: ${text(detail.scoredMark)}/${text(detail.maxMark)}${detail.status ? ` (${detail.status})` : ""}`,
                              )
                              .join("; ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </Table>
                  ) : (
                    <Empty>No course grades are published for this semester.</Empty>
                  )}
                </div>
              ))
            ) : (
              <Empty>Complete semester grade history is not synced.</Empty>
            )}
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
              <Table headers={["Category / basket", "Course code", "Course", "Credits", "Type"]}>
                {snapshot.curriculum.details.flatMap((category: any) =>
                  (category.baskets || []).flatMap((basket: any) =>
                    (basket.items || []).map((item: any, index: number) => (
                      <tr key={`${category.code}-${basket.title}-${index}`}>
                        <td>
                          {text(category.name)} · {text(basket.title)}
                        </td>
                        <td>{text(item.code)}</td>
                        <td>{text(item.name)}</td>
                        <td>{text(item.credits)}</td>
                        <td>{text(item.type)}</td>
                      </tr>
                    )),
                  ),
                )}
              </Table>
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
