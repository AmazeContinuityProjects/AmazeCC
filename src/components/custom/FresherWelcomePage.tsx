"use client";
import { ExternalLink, Bus, BookOpen, FileText, GraduationCap, MapPin, CalendarDays, ArrowRight, Sparkles, CheckCircle, FileText as FileTextIcon } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 midnight:bg-black flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 px-6 pt-16 pb-12 md:pt-20 md:pb-16 md:px-12 text-white">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-2xl bg-white/20 backdrop-blur-sm">
              <GraduationCap className="w-6 h-6 text-blue-200" />
            </div>
            <span className="text-sm font-semibold text-blue-200 uppercase tracking-widest">Welcome to VIT</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
            Hello, {displayName}!
          </h1>
          <p className="text-lg text-blue-100 max-w-2xl leading-relaxed">
            We&apos;re excited to have you here. Your EPT schedule is ready and we&apos;ve put together some helpful resources to get you started on your journey.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 md:py-12 space-y-8">
        {/* EPT Schedule Card */}
        {eptData && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-900/30 midnight:bg-amber-900/20">
                <CalendarDays className="w-5 h-5 text-amber-700 dark:text-amber-400 midnight:text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Your EPT Schedule</h2>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 dark:from-amber-900/20 dark:via-orange-900/10 dark:to-red-900/10 midnight:from-amber-900/10 midnight:via-orange-900/5 midnight:to-red-900/5 border border-amber-200/50 dark:border-amber-800/30 midnight:border-amber-800/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-amber-200/20 dark:border-amber-800/10 midnight:border-amber-800/5 bg-amber-100/30 dark:bg-amber-900/10 midnight:bg-amber-900/5">
                      {(eptData.tables?.[0]?.headers || []).map((h: string, i: number) => (
                        <th key={i} className="px-4 py-3 text-left font-semibold text-amber-800 dark:text-amber-400 midnight:text-amber-400 text-xs uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(eptData.tables?.[0]?.rows || []).map((row: any, ri: number) => (
                      <tr key={ri} className="border-b border-amber-200/10 dark:border-amber-800/5 midnight:border-amber-800/5 last:border-0 hover:bg-amber-50/50 dark:hover:bg-amber-900/5 transition-colors">
                        {(eptData.tables?.[0]?.headers || []).map((h: string, ci: number) => (
                          <td key={ci} className="px-4 py-3 text-amber-900 dark:text-amber-200 midnight:text-amber-200 whitespace-nowrap">{row[h] || ""}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Key-Value Pairs */}
            {eptData?.keyValuePairs && Object.keys(eptData.keyValuePairs).length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                {Object.entries(eptData.keyValuePairs).map(([key, val]) => (
                  <div key={key} className="px-4 py-3 rounded-xl bg-white dark:bg-slate-800/50 midnight:bg-white/5 border border-gray-200/50 dark:border-gray-700/50 midnight:border-white/10">
                    <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 capitalize mb-0.5">{key.replace(/([A-Z])/g, " $1")}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 midnight:text-white">{String(val)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Acknowledgement Section */}
        {acknowledgementData?.tables?.[1]?.rows?.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 midnight:bg-emerald-900/20">
                <CheckCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400 midnight:text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Document Acknowledgement</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {acknowledgementData.tables[1].rows.map((row: any, idx: number) => {
                const headers = acknowledgementData.tables[1].headers || [];
                const docName = row[headers[1]] || "";
                const status = row[headers[2]] || "";
                const isSubmitted = /submitted/i.test(status);
                return (
                  <div key={idx} className="flex items-start gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800/50 midnight:bg-white/5 border border-gray-200/50 dark:border-gray-700/50 midnight:border-white/10">
                    <div className={`p-2.5 rounded-xl shrink-0 ${isSubmitted ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" : "bg-gray-100 dark:bg-gray-800 text-gray-400"}`}>
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 midnight:text-white break-words">{docName}</p>
                      <span className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${isSubmitted ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Resources */}
        {resources.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/30 midnight:bg-blue-900/20">
                <Sparkles className="w-5 h-5 text-blue-700 dark:text-blue-400 midnight:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Helpful Resources</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.map((r) => {
                const resourceType = r.type || 'link';
                if (resourceType === 'md') {
                  return (
                    <div key={r.id} className="p-5 rounded-2xl bg-white dark:bg-slate-800/50 midnight:bg-white/5 border border-gray-200/50 dark:border-gray-700/50 midnight:border-white/10 col-span-full">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 midnight:text-white mb-3">{r.title}</h3>
                      <div className="text-sm text-gray-700 dark:text-gray-300 midnight:text-gray-300 space-y-2 leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_h3]:text-sm [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800 [&_code]:bg-gray-100 [&_code]:dark:bg-gray-800 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-gray-100 [&_pre]:dark:bg-gray-800 [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_blockquote]:border-l-4 [&_blockquote]:border-blue-300 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-500 [&_blockquote]:dark:text-gray-400 [&_hr]:border-gray-300 [&_hr]:dark:border-gray-700">
                        <ReactMarkdown>{r.content || ''}</ReactMarkdown>
                      </div>
                    </div>
                  );
                }
                if (resourceType === 'text') {
                  return (
                    <div key={r.id} className="col-span-full p-5 rounded-2xl bg-white dark:bg-slate-800/50 midnight:bg-white/5 border border-gray-200/50 dark:border-gray-700/50 midnight:border-white/10">
                      <div className="flex items-center gap-3 mb-2">
                        <FileTextIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 midnight:text-white">{r.title}</h3>
                      </div>
                      {r.description && <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400 mb-1">{r.description}</p>}
                      {r.content && <p className="text-sm text-gray-700 dark:text-gray-300 midnight:text-gray-300 whitespace-pre-line">{r.content}</p>}
                    </div>
                  );
                }
                return (
                  <a
                    key={r.id}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-4 p-5 rounded-2xl bg-white dark:bg-slate-800/50 midnight:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/20 midnight:hover:bg-blue-900/10 border border-gray-200/50 dark:border-gray-700/50 midnight:border-white/10 hover:border-blue-200 dark:hover:border-blue-800/30 midnight:hover:border-blue-800/20 transition-all"
                  >
                    <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30 midnight:bg-blue-900/20 text-blue-600 dark:text-blue-400 midnight:text-blue-400 shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                      {iconMap[r.icon] || <ExternalLink className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100 midnight:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{r.title}</p>
                        <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                      {r.description && <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-400 mt-1 leading-relaxed">{r.description}</p>}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}

        {/* Dismiss */}
        <div className="pt-4 pb-8 text-center">
          <button
            onClick={onDismiss}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold text-base shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all active:scale-[0.98]"
          >
            Got it, let&apos;s go!
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export { hasFutureExam, parseEPTDate, iconMap };
