"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Bus, BookOpen, FileText, GraduationCap, MapPin, CalendarDays } from "lucide-react";
import { API_BASE } from "./Main";

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
}

interface FresherWelcomeModalProps {
  open: boolean;
  onDismiss: () => void;
  username: string;
  friendlyName: string;
  eptData?: any;
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

export default function FresherWelcomeModal({ open, onDismiss, username, friendlyName, eptData, resources = [] }: FresherWelcomeModalProps) {
  const displayName = friendlyName || username || "Student";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50  overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) onDismiss(); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-white  dark:bg-black rounded-3xl shadow-2xl overflow-hidden border border-gray-200/50  dark:border-white/10"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 p-8 text-white">
              <div className="absolute top-4 right-4">
                <button onClick={onDismiss} className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3 mb-3">
                <GraduationCap className="w-8 h-8 text-blue-200" />
                <span className="text-sm font-medium text-blue-200 uppercase tracking-wider">Welcome to VIT</span>
              </div>
              <h2 className="text-3xl font-bold mb-2">Hello, {displayName}!</h2>
              <p className="text-blue-100 text-sm leading-relaxed max-w-md">
                We&apos;re excited to have you here. Your EPT schedule is ready and we&apos;ve put together some helpful resources to get you started.
              </p>
            </div>

            <div className="p-6 space-y-6">
              {/* EPT Schedule Card */}
              {eptData && (
                <div className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-red-50    dark:from-amber-900/10 dark:via-orange-900/5 dark:to-red-900/5 border border-amber-200/50  dark:border-amber-800/20 overflow-hidden">
                  <div className="p-4 border-b border-amber-200/30  dark:border-amber-800/10">
                    <h3 className="font-semibold text-amber-900  dark:text-amber-300 flex items-center gap-2">
                      <CalendarDays className="w-5 h-5" />
                      Your EPT Schedule
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-amber-200/20  dark:border-amber-800/5">
                          {(eptData.tables?.[0]?.headers || []).map((h: string, i: number) => (
                            <th key={i} className="px-3 py-2.5 text-left font-medium text-amber-800  dark:text-amber-400 text-xs uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(eptData.tables?.[0]?.rows || []).map((row: any, ri: number) => (
                          <tr key={ri} className="border-b border-amber-200/10  dark:border-amber-800/5 last:border-0">
                            {(eptData.tables?.[0]?.headers || []).map((h: string, ci: number) => (
                              <td key={ci} className="px-3 py-2.5 text-amber-900  dark:text-amber-200 whitespace-nowrap">{row[h] || ""}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Key-Value Pairs */}
              {eptData?.keyValuePairs && Object.keys(eptData.keyValuePairs).length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(eptData.keyValuePairs).map(([key, val]) => (
                    <div key={key} className="px-4 py-2.5 rounded-xl bg-gray-50  dark:bg-white/5">
                      <p className="text-xs text-gray-500  dark:text-gray-400 capitalize">{key.replace(/([A-Z])/g, " $1")}</p>
                      <p className="text-sm font-medium text-gray-900  dark:text-white">{String(val)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Resources */}
              {resources.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900  dark:text-white mb-3 text-sm uppercase tracking-wider">
                    Helpful Resources
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {resources.map((r) => (
                      <a
                        key={r.id}
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 p-3.5 rounded-2xl bg-gray-50  dark:bg-white/5 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:hover:bg-blue-900/10 border border-gray-100  dark:border-white/10 hover:border-blue-200 dark:hover:border-blue-800/30 transition-all group"
                      >
                        <div className="p-2 rounded-xl bg-blue-100  dark:bg-blue-900/20 text-blue-600  dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                          {iconMap[r.icon] || <ExternalLink className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900  dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{r.title}</p>
                          {r.description && <p className="text-xs text-gray-500  dark:text-gray-400 mt-0.5 line-clamp-2">{r.description}</p>}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Dismiss Button */}
              <button
                onClick={onDismiss}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg shadow-blue-500/25 transition-all active:scale-[0.98]"
              >
                Got it, let&apos;s go!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { hasFutureExam, parseEPTDate, iconMap };
