"use client";
import { ExternalLink, Bus, BookOpen, FileText, GraduationCap, MapPin, CalendarDays, ArrowRight, Sparkles, CheckCircle, FileText as FileTextIcon, AlertCircle } from "lucide-react";
import ReactMarkdown from 'react-markdown';

const iconMap: Record<string, React.ReactNode> = {
  Bus: <Bus className="w-5 h-5" />,
  BookOpen: <BookOpen className="w-5 h-5" />,
  FileText: <FileText className="w-5 h-5" />,
  GraduationCap: <GraduationCap className="w-5 h-5" />,
  MapPin: <MapPin className="w-5 h-5" />,
  CalendarDays: <CalendarDays className="w-5 h-5" />,
  ExternalLink: <ExternalLink className="w-5 h-5" />,
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

export default function FresherWelcomePage({ onDismiss, username, friendlyName, eptData, acknowledgementData, resources = [] }: FresherWelcomePageProps) {
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
    <div className="min-h-screen bg-slate-50/50 dark:bg-black flex flex-col transition-colors duration-300">
      {/* Header banner */}
      <div className="relative bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 px-6 pt-16 pb-12 md:pt-20 md:pb-20 md:px-12 text-white overflow-hidden shadow-lg">
        {/* Decorative background blur shapes */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -ml-32 -mb-32" />

        <div className="max-w-5xl mx-auto relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15">
              <GraduationCap className="w-6 h-6 text-blue-200" />
            </div>
            <span className="text-[10px] md:text-xs font-black uppercase tracking-widest text-blue-150">Welcome to VIT University</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black mb-1 tracking-tight">
              Hello, {displayName}!
            </h1>
            <p className="text-sm md:text-base text-blue-100/90 max-w-2xl leading-relaxed">
              We&apos;re thrilled to welcome you. Your official EPT schedule is now available, and we&apos;ve gathered important document checklists and resources to guide your onboarding.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12 space-y-10">
        
        {/* EPT Schedule Section */}
        {eptData && (
          <section className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">English Proficiency Test (EPT)</h2>
              </div>
              {upcomingEpt && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200/35 text-[10px] font-bold text-amber-800 dark:text-amber-400">
                  <AlertCircle className="w-3.5 h-3.5" /> Upcoming Exam
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-250/60 dark:border-gray-850 bg-white dark:bg-[#0a0a0a] shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-150 dark:border-gray-850 bg-gray-50/50 dark:bg-neutral-900/10">
                      {(eptData.tables?.[0]?.headers || []).map((h: string, i: number) => (
                        <th key={i} className="px-4 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(eptData.tables?.[0]?.rows || []).map((row: any, ri: number) => (
                      <tr key={ri} className="border-b border-gray-150 dark:border-gray-850 last:border-0 hover:bg-gray-50/30 dark:hover:bg-neutral-900/5 transition-colors">
                        {(eptData.tables?.[0]?.headers || []).map((h: string, ci: number) => (
                          <td key={ci} className="px-4 py-3 text-gray-900 dark:text-gray-200 font-medium whitespace-nowrap">{row[h] || "-"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Key-Value Details */}
            {eptData?.keyValuePairs && Object.keys(eptData.keyValuePairs).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(eptData.keyValuePairs).map(([key, val]) => (
                  <div key={key} className="p-3.5 rounded-2xl bg-white dark:bg-[#0a0a0a] border border-gray-200/55 dark:border-gray-850 shadow-2xs">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">{key.replace(/([A-Z])/g, " $1")}</p>
                    <p className="text-xs font-black text-gray-800 dark:text-gray-200">{String(val)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Acknowledgement Checklists */}
        {totalAckDocs > 0 && (
          <section className="space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Onboarding Documents Checklist</h2>
              </div>
            </div>

            {/* Submission Progress bar */}
            <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-500/[0.03] border border-emerald-500/20 dark:border-emerald-500/10 space-y-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-400">
                <span>Document Status</span>
                <span>{submittedAckDocs} of {totalAckDocs} Submitted ({Math.round(ackProgressPct)}%)</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-neutral-800 overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                  style={{ width: `${ackProgressPct}%` }}
                />
              </div>
            </div>

            {/* Documents List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ackRows.map((row: any, idx: number) => {
                const headers = acknowledgementData?.tables?.[1]?.headers || [];
                const docName = row[headers[1]] || "";
                const status = row[headers[2]] || "";
                const isSubmitted = /submitted/i.test(status);
                return (
                  <div key={idx} className="flex items-start gap-4.5 p-4 rounded-2xl bg-white dark:bg-[#0a0a0a] border border-gray-200/50 dark:border-gray-850 shadow-2xs hover:border-gray-300 dark:hover:border-neutral-800 transition-colors">
                    <div className={`p-2.5 rounded-xl shrink-0 ${isSubmitted ? "bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400" : "bg-gray-100 dark:bg-gray-900 text-gray-400"}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs font-bold text-gray-900 dark:text-white leading-snug break-words">{docName}</p>
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isSubmitted ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400"}`}>
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Resources Section */}
        {resources.length > 0 && (
          <section className="space-y-4 animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">University Resources & Guides</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.map((r) => {
                const resourceType = r.type || 'link';
                if (resourceType === 'md') {
                  return (
                    <div key={r.id} className="p-5 rounded-2xl bg-white dark:bg-[#0a0a0a] border border-gray-250/50 dark:border-gray-850 shadow-2xs col-span-full">
                      <h3 className="text-sm font-black text-gray-900 dark:text-white mb-3">{r.title}</h3>
                      <div className="text-xs text-gray-700 dark:text-gray-300 space-y-2 leading-relaxed [&_h1]:text-sm [&_h1]:font-black [&_h2]:text-xs [&_h2]:font-bold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_pre]:bg-gray-100 [&_pre]:dark:bg-gray-800 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto">
                        <ReactMarkdown>{r.content || ''}</ReactMarkdown>
                      </div>
                    </div>
                  );
                }
                if (resourceType === 'text') {
                  return (
                    <div key={r.id} className="col-span-full p-5 rounded-2xl bg-white dark:bg-[#0a0a0a] border border-gray-250/50 dark:border-gray-850 shadow-2xs">
                      <div className="flex items-center gap-3 mb-2">
                        <FileTextIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-sm font-black text-gray-900 dark:text-white">{r.title}</h3>
                      </div>
                      {r.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{r.description}</p>}
                      {r.content && <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">{r.content}</p>}
                    </div>
                  );
                }
                return (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col justify-between p-4.5 rounded-2xl bg-white dark:bg-[#0a0a0a] border border-gray-200/50 dark:border-gray-850 shadow-2xs hover:border-blue-400 dark:hover:border-blue-700/50 transition-all hover:shadow-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="p-2.5 rounded-xl bg-blue-100/60 dark:bg-blue-950/30 text-blue-600 dark:text-blue-450 group-hover:scale-105 transition-transform">
                          {iconMap[r.icon] || <ExternalLink className="w-5 h-5" />}
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-black text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">{r.title}</p>
                        {r.description && <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-normal">{r.description}</p>}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Centered Dismiss Button */}
        <div className="pt-8 pb-10 text-center">
          <button
            onClick={onDismiss}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold text-sm shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/25 transition-all active:scale-[0.98] cursor-pointer"
          >
            Launch Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { hasFutureExam, parseEPTDate, iconMap };
