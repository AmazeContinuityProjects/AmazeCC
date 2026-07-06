"use client";
import { useState, useEffect, useRef } from "react";
import { API_BASE } from "../Main";
import SubpageLayout from "../shared/SubpageLayout";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { XCircle } from "lucide-react";

interface Creds {
  cookies: string[];
  authorizedID: string;
  csrf: string;
}

const CardShell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`solid-card mb-5 ${className}`}>
    {children}
  </div>
);

function renderKeyValuePairs(kvp: Record<string, string>) {
  if (!kvp || Object.keys(kvp).length === 0) return null;
  return (
    <CardShell>
      <div className="p-5 space-y-3">
        {Object.entries(kvp).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between py-1">
            <span className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider">{key}</span>
            <span className="text-sm font-medium text-gray-800  dark:text-gray-200 text-right">{val || "—"}</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

function renderTables(tables: any[]) {
  if (!tables || tables.length === 0) return null;
  return tables.map((table: any, idx: number) => {
    const hasRows = table.headers?.length > 0 && table.rows?.length > 0;
    return (
      <CardShell key={idx}>
        <div className="p-5">
          {table.caption && <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4">{table.caption}</h4>}
          {hasRows ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200  dark:border-gray-700">
                    {table.headers.map((h: string, i: number) => (
                      <th key={i} className="text-left py-2 px-2 text-xs font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row: any, ri: number) => (
                    <tr key={ri} className="border-b border-gray-100  dark:border-gray-800/50 last:border-0">
                      {table.headers.map((h: string, ci: number) => (
                        <td key={ci} className="py-2.5 px-2 text-sm text-gray-800  dark:text-gray-200 whitespace-nowrap">{row[h] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400  dark:text-gray-500">No data</p>
          )}
        </div>
      </CardShell>
    );
  });
}

export default function CoursePageTab({ loginToVTOP }: { loginToVTOP: () => Promise<Creds> }) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const credsRef = useRef<Creds | null>(null);
  const [semesters, setSemesters] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [faculties, setFaculties] = useState<any[]>([]);
  const [courseDetails, setCourseDetails] = useState<any>(null);
  const [viewDetail, setViewDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [semesterSubId, setSemesterSubId] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [slotId, setSlotId] = useState("");
  const [faculty, setFaculty] = useState("");

  const doFetch = async (formData: Record<string, string>) => {
    const c = credsRef.current;
    if (!c || Object.keys(formData).length === 0) return null;
    try {
      const res = await fetch(`${API_BASE}/api/course-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: c.cookies, authorizedID: c.authorizedID, csrf: c.csrf, formData }),
      });
      const data = await res.json();
      if (data.success === false) { setError(data.error || "Failed"); return null; }
      return data.results || null;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  const handleSemesterChange = async (value: string) => {
    setSemesterSubId(value);
    setCourseCode("");
    setSlotId("");
    setFaculty("");
    setCourses([]);
    setSlots([]);
    setFaculties([]);
    setCourseDetails(null);
    if (!value) return;
    setFetching("courses");
    setError(null);
    const r = await doFetch({ semesterSubId: value });
    if (r?.selectOptions?.courseCode) setCourses(r.selectOptions.courseCode);
    setFetching(null);
  };

  const handleCourseChange = async (value: string) => {
    setCourseCode(value);
    setSlotId("");
    setFaculty("");
    setSlots([]);
    setFaculties([]);
    setCourseDetails(null);
    if (!value) return;
    setFetching("slots");
    setError(null);
    const r = await doFetch({ semesterSubId, courseCode: value });
    if (r?.selectOptions?.slotId) setSlots(r.selectOptions.slotId);
    setFetching(null);
  };

  const handleSlotChange = async (value: string) => {
    setSlotId(value);
    setFaculty("");
    setFaculties([]);
    setCourseDetails(null);
    if (!value) return;
    setFetching("faculties");
    setError(null);
    const r = await doFetch({ semesterSubId, courseCode, slotId: value });
    if (r?.selectOptions?.faculty) setFaculties(r.selectOptions.faculty);
    setFetching(null);
  };

  const handleFacultyChange = async (value: string) => {
    setFaculty(value);
    setCourseDetails(null);
    setViewDetail(null);
    if (!value) return;
    setFetching("details");
    setError(null);
    const r = await doFetch({ semesterSubId, courseCode, slotId, faculty: value });
    if (r) setCourseDetails(r);
    setFetching(null);
  };

  const handleViewDetail = async (semSubId: string, erpId: string, classId: string) => {
    setViewDetail(null);
    setFetching("viewDetail");
    setError(null);
    const r = await doFetch({ viewDetail: "true", semSubId, erpId, classId });
    if (r) setViewDetail(r);
    setFetching(null);
  };

  const extractErpId = (facultyStr: string) => facultyStr.split("-")[0]?.trim() || facultyStr;

  useEffect(() => {
    loginToVTOP().then(c => {
      credsRef.current = c;
      setCreds(c);
      fetch(`${API_BASE}/api/course-page`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: c.cookies, authorizedID: c.authorizedID, csrf: c.csrf }),
      }).then(r => r.json()).then(d => {
        if (d.semesters) setSemesters(d.semesters);
        if (d.semesters?.length > 0) {
          const sel = d.semesters.find((s: any) => s.selected);
          handleSemesterChange(sel?.value || d.semesters[0].value);
        }
      }).catch(() => setError("Failed to load")).finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  if (!creds || loading) {
    return (
      <SubpageLayout title="Course Page" onBack={() => {}}>
        <Skeleton className="h-8 w-48 rounded-lg mb-4" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </SubpageLayout>
    );
  }

  return (
    <SubpageLayout title="Course Page" onBack={() => {}}>
      {/* Selectors */}
      <CardShell>
        <div className="p-5 space-y-4">
          <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider">Select Course</h4>

          <div>
            <label className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1.5 block">Semester</label>
            <select value={semesterSubId} onChange={(e) => handleSemesterChange(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 rounded-xl border border-gray-200  dark:border-gray-700">
              <option value="">-- Choose Semester --</option>
              {semesters.map((s: any, i: number) => (
                <option key={i} value={s.value}>{s.text}</option>
              ))}
            </select>
          </div>

          {semesterSubId && (
            <div>
              <label className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1.5 block">Course {fetching === "courses" && <span className="text-blue-500 ml-1">loading...</span>}</label>
              <select value={courseCode} onChange={(e) => handleCourseChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 rounded-xl border border-gray-200  dark:border-gray-700">
                <option value="">-- Choose Course --</option>
                {courses.map((c: any, i: number) => (
                  <option key={i} value={c.value}>{c.text}</option>
                ))}
              </select>
            </div>
          )}

          {courseCode && (
            <div>
              <label className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1.5 block">Slot {fetching === "slots" && <span className="text-blue-500 ml-1">loading...</span>}</label>
              <select value={slotId} onChange={(e) => handleSlotChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 rounded-xl border border-gray-200  dark:border-gray-700">
                <option value="">-- Choose Slot --</option>
                {slots.map((s: any, i: number) => (
                  <option key={i} value={s.value}>{s.text}</option>
                ))}
              </select>
            </div>
          )}

          {slotId && (
            <div>
              <label className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-1.5 block">Faculty {fetching === "faculties" && <span className="text-blue-500 ml-1">loading...</span>}</label>
              <select value={faculty} onChange={(e) => handleFacultyChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm text-gray-800  dark:text-gray-200 bg-gray-50  dark:bg-gray-800/50 rounded-xl border border-gray-200  dark:border-gray-700">
                <option value="">-- Choose Faculty --</option>
                {faculties.map((f: any, i: number) => (
                  <option key={i} value={f.value}>{f.text}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </CardShell>

      {error && (
        <div className="p-4 text-sm text-red-600  dark:text-red-500 bg-red-50  dark:bg-red-900/20 rounded-2xl mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {fetching === "details" && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      )}

      {courseDetails && fetching !== "details" && (
        <>
          {courseDetails.messages && (courseDetails.messages.warning || courseDetails.messages.error) && (
            <CardShell>
              <div className={`p-4 text-sm ${courseDetails.messages.error ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                <span dangerouslySetInnerHTML={{ __html: courseDetails.messages.error || courseDetails.messages.warning }} />
              </div>
            </CardShell>
          )}
          {courseDetails.tables?.map((table: any, idx: number) => {
            const isFirstTable = idx === 0;
            const hasActionCol = table.headers?.includes("Action");
            return (
              <CardShell key={idx}>
                <div className="p-5">
                  {table.caption && <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-4">{table.caption}</h4>}
                  {table.headers?.length > 0 && table.rows?.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200  dark:border-gray-700">
                            {table.headers.map((h: string, i: number) => (
                              <th key={i} className="text-left py-2 px-2 text-xs font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row: any, ri: number) => (
                            <tr key={ri} className="border-b border-gray-100  dark:border-gray-800/50 last:border-0">
                              {table.headers.map((h: string, ci: number) => {
                                if (isFirstTable && h === "Action") {
                                  const classId = row["Class Id"] || "";
                                  const erpId = extractErpId(row["Faculty"] || "");
                                  return (
                                    <td key={ci} className="py-2.5 px-2 whitespace-nowrap">
                                      <button onClick={() => handleViewDetail(semesterSubId, erpId, classId)}
                                        disabled={fetching === "viewDetail"}
                                        className="px-3 py-1 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-colors">
                                        View
                                      </button>
                                    </td>
                                  );
                                }
                                return (
                                  <td key={ci} className="py-2.5 px-2 text-sm text-gray-800  dark:text-gray-200 whitespace-nowrap">{row[h] || "—"}</td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No data</p>
                  )}
                </div>
              </CardShell>
            );
          })}
        </>
      )}

      {viewDetail && (
        <>
          {viewDetail.messages && (viewDetail.messages.warning || viewDetail.messages.error) && (
            <CardShell>
              <div className={`p-4 text-sm ${viewDetail.messages.error ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                <span dangerouslySetInnerHTML={{ __html: viewDetail.messages.error || viewDetail.messages.warning }} />
              </div>
            </CardShell>
          )}
          {renderKeyValuePairs(viewDetail.keyValuePairs)}
          {renderTables(viewDetail.tables?.slice(1))}
        </>
      )}
    </SubpageLayout>
  );
}
