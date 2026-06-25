"use client";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  RefreshCcw, ChevronDown, ChevronRight, AlertCircle, Info,
  ScrollText, BookOpen, Hash, Tag, User, Calendar, GraduationCap,
  FileText, Layers, ClipboardList
} from "lucide-react";
import SubpageLayout from "../shared/SubpageLayout";
import { Card, Badge, EmptyState } from "../shared";
import { API_BASE } from "../Main";

interface SemesterOption {
  value: string;
  text: string;
}

interface SemesterData {
  semester: string;
  tables: { caption?: string; headers: string[]; rows: Record<string, string>[] }[];
  keyValuePairs: Record<string, string>;
  messages?: string[];
  plainText?: string;
  error?: string;
}

function humanize(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

function fieldIcon(key: string) {
  const k = key.toLowerCase();
  if (k.includes("course") && k.includes("code")) return <Hash className="w-3.5 h-3.5" />;
  if (k.includes("course") && k.includes("title")) return <BookOpen className="w-3.5 h-3.5" />;
  if (k.includes("course") && k.includes("type")) return <Tag className="w-3.5 h-3.5" />;
  if (k.includes("faculty") || k.includes("staff")) return <User className="w-3.5 h-3.5" />;
  if (k.includes("sem")) return <Calendar className="w-3.5 h-3.5" />;
  if (k.includes("slot")) return <Layers className="w-3.5 h-3.5" />;
  if (k.includes("credit")) return <GraduationCap className="w-3.5 h-3.5" />;
  if (k.includes("grade") || k.includes("mark")) return <ClipboardList className="w-3.5 h-3.5" />;
  return <FileText className="w-3.5 h-3.5" />;
}

function formatSemesterName(text: string): { label: string; badge: string } {
  if (text.includes("Fall") || text.includes("Winter") || text.includes("Summer")) {
    return { label: text, badge: "" };
  }
  const m = text.match(/([A-Z]{2})(\d{4})(\d{2})(\d)/);
  if (m) {
    const campus = m[1] === "CH" ? "Chennai" : m[1] === "AP" ? "AP" : m[1] === "VL" ? "Vellore" : m[1];
    const startYear = m[2];
    const endYear = "20" + m[3];
    const term = m[4] === "1" ? "Fall" : m[4] === "5" ? "Winter" : m[4] === "9" ? "Summer" : "";
    return { label: `${term} Semester ${startYear}–${endYear}`, badge: campus };
  }
  return { label: text, badge: "" };
}

function courseTypeBadgeVariant(type: string): "default" | "success" | "info" | "warning" | "purple" | "danger" {
  const t = type.toUpperCase();
  if (t.includes("THEORY") || t === "TH") return "info";
  if (t.includes("LAB") || t === "LO") return "purple";
  if (t.includes("PROJECT") || t === "PJ") return "warning";
  if (t.includes("EMBED") || t === "ELA") return "success";
  return "default";
}

// Gradient accent based on index for visual variety
const cardAccents = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-cyan-500 to-teal-600",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-fuchsia-500 to-purple-600",
  "from-sky-500 to-blue-600",
];

// Detect well-known column roles from header names
function detectColumns(headers: string[]) {
  const find = (keywords: string[]) =>
    headers.find(h => keywords.every(k => h.toLowerCase().includes(k))) || null;

  return {
    slNo: find(["sl"]) || find(["s.no"]) || find(["no"]) || find(["#"]),
    courseCode: find(["course", "code"]),
    courseTitle: find(["course", "title"]) || find(["title"]),
    courseType: find(["course", "type"]) || find(["type"]),
    faculty: find(["faculty"]) || find(["staff"]),
    slot: find(["slot"]),
    credit: find(["credit"]),
  };
}

function CourseCard({
  row,
  headers,
  index,
}: {
  row: Record<string, string>;
  headers: string[];
  index: number;
}) {
  const cols = detectColumns(headers);
  const code = cols.courseCode ? row[cols.courseCode] || "" : "";
  const title = cols.courseTitle ? row[cols.courseTitle] || "" : "";
  const type = cols.courseType ? row[cols.courseType] || "" : "";
  const faculty = cols.faculty ? row[cols.faculty] || "" : "";
  const slot = cols.slot ? row[cols.slot] || "" : "";
  const credit = cols.credit ? row[cols.credit] || "" : "";

  // Determine which headers are "extra" (not primary card fields)
  const primaryKeys = new Set([cols.slNo, cols.courseCode, cols.courseTitle, cols.courseType, cols.faculty, cols.slot, cols.credit].filter(Boolean));
  const extraFields = headers.filter(h => !primaryKeys.has(h) && (row[h] || "").trim());

  const hasSmartLayout = code || title;
  const accent = cardAccents[index % cardAccents.length];

  return (
    <div className="group relative rounded-2xl bg-white dark:bg-slate-800/60 midnight:bg-white/[0.03] border border-gray-100/80 dark:border-gray-700/40 midnight:border-white/[0.06] shadow-sm hover:shadow-md dark:hover:shadow-lg/10 transition-all duration-300 overflow-hidden">
      {/* Accent top bar */}
      <div className={`h-1 bg-gradient-to-r ${accent}`} />

      <div className="p-4 space-y-3">
        {hasSmartLayout ? (
          <>
            {/* Row 1: Course Code + Type Badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {code && (
                  <span className="font-mono font-bold text-violet-600 dark:text-violet-400 midnight:text-violet-400 text-sm tracking-tight">
                    {code}
                  </span>
                )}
                {slot && (
                  <Badge variant="default" size="sm">{slot}</Badge>
                )}
              </div>
              {type && (
                <Badge variant={courseTypeBadgeVariant(type)} size="md">{type}</Badge>
              )}
            </div>

            {/* Row 2: Course Title */}
            {title && (
              <p className="font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100 text-[15px] leading-snug">
                {title}
              </p>
            )}

            {/* Row 3: Metadata chips */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400">
              {faculty && (
                <span className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-slate-700/50 midnight:bg-white/[0.04] px-2.5 py-1 rounded-lg border border-gray-100/80 dark:border-gray-700/30 midnight:border-white/5">
                  <User className="w-3 h-3 text-gray-400" />
                  <span className="truncate max-w-[180px]">{faculty}</span>
                </span>
              )}
              {credit && (
                <span className="inline-flex items-center gap-1.5 bg-gray-50 dark:bg-slate-700/50 midnight:bg-white/[0.04] px-2.5 py-1 rounded-lg border border-gray-100/80 dark:border-gray-700/30 midnight:border-white/5">
                  <GraduationCap className="w-3 h-3 text-gray-400" />
                  {credit} credits
                </span>
              )}
            </div>

            {/* Row 4: Extra fields as a mini grid */}
            {extraFields.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2.5 border-t border-gray-100/60 dark:border-gray-700/20 midnight:border-white/5">
                {extraFields.map((h) => (
                  <div key={h}>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold mb-0.5">
                      {h}
                    </p>
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 midnight:text-gray-300">
                      {row[h]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Fallback: generic field grid if no course code/title detected */
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {headers.map((h) => {
              const val = row[h] || "";
              if (!val) return null;
              return (
                <div key={h}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-gray-400">{fieldIcon(h)}</span>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold">
                      {h}
                    </p>
                  </div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 midnight:text-gray-200">
                    {val}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function QCMViewTab({ loginToVTOP, setActiveSubTab }: { loginToVTOP: any; setActiveSubTab: any }) {
  const [semesters, setSemesters] = useState<SemesterOption[]>([]);
  const [semesterData, setSemesterData] = useState<Record<string, SemesterData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchAllData = async () => {
    setLoading(true);
    setError("");
    try {
      const creds = await loginToVTOP();
      const res = await fetch(`${API_BASE}/api/qcm-view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }),
      });
      const result = await res.json();
      if (result.success) {
        setSemesters(result.semesters || []);
        setSemesterData(result.data || {});
        // Auto-expand first semester with data
        const firstWithData = (result.semesters || []).find((s: SemesterOption) => {
          const d = (result.data || {})[s.value];
          return d && !d.error && (d.tables?.length > 0 || Object.keys(d.keyValuePairs || {}).length > 0);
        });
        if (firstWithData) setExpanded({ [firstWithData.value]: true });
      } else {
        setError(result.error || "Failed to fetch QCM data");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAllData() }, []);

  if (loading) {
    return (
      <div className="space-y-4 px-1">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-36 rounded-lg" />
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-20 w-full rounded-2xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <SubpageLayout
      title="QCM View"
      subtitle="Quality Circle Meeting Records"
      onBack={() => setActiveSubTab("overview")}
      action={
        <button
          onClick={fetchAllData}
          className="p-2.5 rounded-full bg-violet-50 dark:bg-violet-900/30 midnight:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/50 transition-all duration-200 active:scale-95"
          title="Reload"
        >
          <RefreshCcw className="w-5 h-5" />
        </button>
      }
    >
      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/15 border border-red-200/60 dark:border-red-800/40 text-red-600 dark:text-red-400 text-sm font-medium mb-5 animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Empty */}
      {semesters.length === 0 && !error && (
        <EmptyState
          icon={<ScrollText className="w-16 h-16" />}
          title="No QCM Records"
          description="No Quality Circle Meeting data found for your account."
        />
      )}

      {/* Semester List */}
      {semesters.length > 0 && (
        <div className="space-y-3">
          {semesters.map((sem) => {
            const semData = semesterData[sem.value];
            const isExpanded = expanded[sem.value];
            const hasTables = semData?.tables && semData.tables.length > 0;
            const hasKV = semData?.keyValuePairs && Object.keys(semData.keyValuePairs).length > 0;
            const hasMessages = semData?.messages && semData.messages.length > 0;
            const hasPlainText = !!semData?.plainText;
            const hasContent = hasTables || hasKV || hasMessages || hasPlainText;
            const hasError = !!semData?.error;
            const totalCourses = hasTables ? semData.tables.reduce((s, t) => s + t.rows.length, 0) : 0;
            const { label: semLabel, badge: campusBadge } = formatSemesterName(sem.text);

            return (
              <Card key={sem.value} variant="glass" className="overflow-hidden">
                {/* Semester Header */}
                <button
                  onClick={() => setExpanded(p => ({ ...p, [sem.value]: !p[sem.value] }))}
                  className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-white/50 dark:hover:bg-slate-700/20 midnight:hover:bg-white/[0.02] transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`
                      w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300
                      ${isExpanded
                        ? "bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25"
                        : "bg-violet-100 dark:bg-violet-900/30 midnight:bg-violet-900/20 text-violet-600 dark:text-violet-400"
                      }
                    `}>
                      <ScrollText className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 midnight:text-gray-100 truncate text-[15px]">
                        {semLabel}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {campusBadge && <Badge variant="info" size="sm">{campusBadge}</Badge>}
                        {totalCourses > 0 && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {totalCourses} course{totalCourses !== 1 ? "s" : ""}
                          </span>
                        )}
                        {hasError && <Badge variant="danger" size="sm">Error</Badge>}
                        {!hasContent && !hasError && <span className="text-xs text-gray-400">No data</span>}
                      </div>
                    </div>
                  </div>
                  <div className={`transition-transform duration-300 ${isExpanded ? "rotate-90" : ""}`}>
                    <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
                  </div>
                </button>

                {/* Expanded Content */}
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"}`}>
                  <div className="px-4 sm:px-5 pb-5 space-y-4 border-t border-gray-100/80 dark:border-gray-800/60 midnight:border-white/5 pt-4">

                    {/* Error */}
                    {hasError && (
                      <div className="flex items-center gap-3 p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/15 border border-red-200/50 dark:border-red-800/30 text-sm text-red-600 dark:text-red-400">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{semData!.error}</span>
                      </div>
                    )}

                    {/* Messages */}
                    {hasMessages && semData!.messages!.map((msg, i) => (
                      <div key={i} className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-50/80 dark:bg-blue-900/15 midnight:bg-blue-900/10 border border-blue-200/50 dark:border-blue-800/30 text-blue-700 dark:text-blue-300 text-sm">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{msg}</span>
                      </div>
                    ))}

                    {/* Key-Value Info Cards */}
                    {hasKV && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {Object.entries(semData!.keyValuePairs).map(([key, val]) => (
                          <div
                            key={key}
                            className="p-3 rounded-xl bg-gray-50/80 dark:bg-slate-800/40 midnight:bg-white/[0.03] border border-gray-100/80 dark:border-gray-700/30 midnight:border-white/5"
                          >
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <span className="text-gray-400 dark:text-gray-500">{fieldIcon(key)}</span>
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold truncate">
                                {humanize(key)}
                              </p>
                            </div>
                            <p className="font-semibold text-gray-800 dark:text-gray-200 midnight:text-gray-200 text-sm truncate">
                              {String(val)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Course Cards */}
                    {hasTables && semData!.tables.map((table, ti) => (
                      <div key={ti} className="space-y-3">
                        {table.caption && (
                          <div className="flex items-center gap-2 mb-1">
                            <ClipboardList className="w-4 h-4 text-violet-500" />
                            <p className="text-sm font-bold text-gray-600 dark:text-gray-300 midnight:text-gray-300">
                              {table.caption}
                            </p>
                            <Badge variant="purple" size="sm">{table.rows.length}</Badge>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {table.rows.map((row, ri) => (
                            <CourseCard key={ri} row={row} headers={table.headers} index={ri} />
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Plain text fallback */}
                    {hasPlainText && !hasTables && !hasKV && (
                      <div className="p-4 rounded-xl bg-gray-50/80 dark:bg-slate-800/30 midnight:bg-white/[0.02] border border-gray-100/80 dark:border-gray-700/30 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {semData!.plainText}
                      </div>
                    )}

                    {/* Empty semester */}
                    {!hasContent && !hasError && (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 midnight:bg-gray-900 flex items-center justify-center mb-3">
                          <FileText className="w-6 h-6 text-gray-300 dark:text-gray-600" />
                        </div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No data available</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">No QCM records for this semester</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </SubpageLayout>
  );
}
