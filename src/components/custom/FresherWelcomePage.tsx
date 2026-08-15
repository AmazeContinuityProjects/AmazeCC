"use client";

import React from "react";
import { 
  ExternalLink, Bus, BookOpen, FileText, GraduationCap, MapPin, 
  CalendarDays, ArrowRight, Sparkles, CheckCircle, FileText as FileTextIcon, 
  AlertCircle, X, ChevronRight, Check
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const iconMap: Record<string, React.ReactNode> = {
  Bus: <Bus className="w-4 h-4" />,
  BookOpen: <BookOpen className="w-4 h-4" />,
  FileText: <FileText className="w-4 h-4" />,
  GraduationCap: <GraduationCap className="w-4 h-4" />,
  MapPin: <MapPin className="w-4 h-4" />,
  CalendarDays: <CalendarDays className="w-4 h-4" />,
  ExternalLink: <ExternalLink className="w-4 h-4" />,
};

interface Resource {
  id: number;
  title: string;
  description: string;
  url: string;
  icon: string;
  type?: string;
  content?: string;
}

interface FresherWelcomePageProps {
  onDismiss: () => void;
  username: string;
  friendlyName: string;
  eptData?: any;
  acknowledgementData?: any;
  resources?: Resource[];
}

function parseEPTDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) return parsed;
  const d = Date.parse(dateStr.replace(/(\d{2})-(\w{3})-(\d{4})/, "$2 $1, $3"));
  if (!isNaN(d)) return new Date(d);
  return null;
}

function hasFutureExam(tables: any[]): boolean {
  if (!tables?.length) return false;
  for (const table of tables) {
    const dateKeys = (table.headers || []).filter((h: string) =>
      /date|exam|schedule|slot|session/i.test(h)
    );
    if (dateKeys.length === 0 && table.rows?.length) {
      for (const row of table.rows) {
        for (const val of Object.values(row)) {
          const dt = parseEPTDate(String(val));
          if (dt && dt > new Date()) return true;
        }
      }
    }
    for (const row of table.rows || []) {
      for (const key of dateKeys) {
        const dt = parseEPTDate(row[key]);
        if (dt && dt > new Date()) return true;
      }
    }
  }
  return false;
}

export default function FresherWelcomePage({
  onDismiss,
  username,
  friendlyName,
  eptData,
  acknowledgementData,
  resources = [],
}: FresherWelcomePageProps) {
  const displayName = friendlyName || username || "Student";

  // Calculate Acknowledgement progress
  const ackRows = acknowledgementData?.tables?.[1]?.rows || [];
  const totalAckDocs = ackRows.length;
  const submittedAckDocs = ackRows.filter((row: any) => {
    const headers = acknowledgementData?.tables?.[1]?.headers || [];
    const status = row[headers[2]] || "";
    return /submitted/i.test(status);
  }).length;
  const ackProgressPct = totalAckDocs > 0 ? (submittedAckDocs / totalAckDocs) * 100 : 0;

  // Check if there is an upcoming EPT exam
  const upcomingEpt = eptData?.tables ? hasFutureExam(eptData.tables) : false;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Top Fixed Navigation & Dismiss Bar */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 tracking-wide font-outfit">
            Fresher Onboarding Hub
          </span>
        </div>

        <button
          onClick={onDismiss}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
        >
          <span>Launch Dashboard</span>
          <ArrowRight size={13} />
        </button>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 md:py-8 space-y-6">
        {/* Subtle Welcome Hero Banner */}
        <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 dark:border-indigo-500/15 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[11px] font-bold">
                <Sparkles size={12} />
                <span>VIT Campus Onboarding</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white font-outfit">
                Welcome, {displayName}! 👋
              </h1>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
                Here are your essential English Proficiency Test (EPT) schedules, onboarding document checklists, and quick VIT portal links.
              </p>
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex sm:flex-col gap-2 shrink-0">
              {totalAckDocs > 0 && (
                <div className="px-3.5 py-2 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Documents</p>
                  <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    {submittedAckDocs}/{totalAckDocs} Submitted
                  </p>
                </div>
              )}
              {eptData && (
                <div className="px-3.5 py-2 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">EPT Test</p>
                  <p className="text-xs font-black text-amber-600 dark:text-amber-400">
                    {upcomingEpt ? "Upcoming" : "Scheduled"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* EPT Schedule Section */}
        {eptData && (
          <section className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <CalendarDays size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white font-outfit">
                    English Proficiency Test (EPT) Schedule
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Official venue and timing for your EPT exam</p>
                </div>
              </div>
              {upcomingEpt && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20">
                  <AlertCircle size={12} /> Upcoming Exam
                </span>
              )}
            </div>

            {/* EPT Table */}
            <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200/80 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/50">
                      {(eptData.tables?.[0]?.headers || []).map((h: string, i: number) => (
                        <th key={i} className="px-3.5 py-2.5 text-left font-bold text-zinc-500 uppercase tracking-wider text-[10px]">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                    {(eptData.tables?.[0]?.rows || []).map((row: any, ri: number) => (
                      <tr key={ri} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                        {(eptData.tables?.[0]?.headers || []).map((h: string, ci: number) => (
                          <td key={ci} className="px-3.5 py-2.5 font-medium text-zinc-800 dark:text-zinc-200 whitespace-nowrap">
                            {row[h] || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* EPT Details Grid */}
            {eptData?.keyValuePairs && Object.keys(eptData.keyValuePairs).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                {Object.entries(eptData.keyValuePairs).map(([key, val]) => (
                  <div key={key} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-0.5">
                      {key.replace(/([A-Z])/g, " $1")}
                    </p>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                      {String(val)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Onboarding Documents Checklist */}
        {totalAckDocs > 0 && (
          <section className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white font-outfit">
                    Onboarding Documents Checklist
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Track required document submissions</p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {Math.round(ackProgressPct)}% Completed
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${ackProgressPct}%` }}
              />
            </div>

            {/* Document Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ackRows.map((row: any, idx: number) => {
                const headers = acknowledgementData?.tables?.[1]?.headers || [];
                const docName = row[headers[1]] || "";
                const status = row[headers[2]] || "";
                const isSubmitted = /submitted/i.test(status);
                return (
                  <div
                    key={idx}
                    className="flex items-start justify-between p-3 rounded-xl bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60"
                  >
                    <div className="flex items-start gap-2.5 min-w-0 pr-2">
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${isSubmitted ? "bg-emerald-500/10 text-emerald-600" : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400"}`}>
                        <FileText size={14} />
                      </div>
                      <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-2">
                        {docName}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase shrink-0 ${isSubmitted ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"}`}>
                      {isSubmitted && <Check size={11} />}
                      {status}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Resources & Portals Grid */}
        <section className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white font-outfit">
                University Portals & Quick Links
              </h2>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Direct shortcuts to official VIT portals</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* VTOP Portal Direct Card */}
            <a
              href="https://vtopcc.vit.ac.in"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col justify-between p-4 rounded-xl bg-gradient-to-br from-indigo-500/5 to-transparent border border-indigo-500/20 hover:border-indigo-500/40 transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                  <GraduationCap size={16} />
                </div>
                <ExternalLink size={14} className="text-zinc-400 group-hover:text-indigo-500 transition-colors" />
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  VTOP Student Portal
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">vtopcc.vit.ac.in</p>
              </div>
            </a>

            {/* Custom Resources */}
            {resources.map((r) => {
              const resourceType = r.type || "link";
              if (resourceType === "md") {
                return (
                  <div key={r.id} className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60 col-span-full">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white mb-2">{r.title}</h3>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1 leading-relaxed">
                      <ReactMarkdown>{r.content || ""}</ReactMarkdown>
                    </div>
                  </div>
                );
              }
              if (resourceType === "text") {
                return (
                  <div key={r.id} className="col-span-full p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60 space-y-1">
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">{r.title}</h3>
                    {r.description && <p className="text-[11px] text-zinc-500">{r.description}</p>}
                    {r.content && <p className="text-xs text-zinc-600 dark:text-zinc-400 whitespace-pre-line">{r.content}</p>}
                  </div>
                );
              }

              return (
                <a
                  key={r.id}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col justify-between p-4 rounded-xl bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-zinc-800/60 hover:border-indigo-500/40 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="p-2 rounded-lg bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 group-hover:scale-105 transition-transform">
                      {iconMap[r.icon] || <ExternalLink size={16} />}
                    </div>
                    <ChevronRight size={14} className="text-zinc-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                      {r.title}
                    </p>
                    {r.description && (
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                        {r.description}
                      </p>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* Bottom Centered Launch Dashboard Action */}
        <div className="py-4 text-center">
          <button
            onClick={onDismiss}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            <span>Proceed to Dashboard</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </main>
    </div>
  );
}

export { hasFutureExam, parseEPTDate, iconMap };
