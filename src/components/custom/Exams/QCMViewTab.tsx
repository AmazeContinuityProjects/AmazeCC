"use client";
import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { RefreshCcw, ChevronDown, ChevronRight } from "lucide-react";
import SubpageLayout from "../shared/SubpageLayout";
import { API_BASE } from "../Main";

interface SemesterData {
  semester: string;
  tables: { caption?: string; headers: string[]; rows: Record<string, string>[] }[];
  keyValuePairs: Record<string, string>;
  error?: string;
}

export default function QCMViewTab({ loginToVTOP, setActiveSubTab }: { loginToVTOP: any; setActiveSubTab: any }) {
  const [data, setData] = useState<Record<string, SemesterData> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
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
      if (result.success) setData(result.data);
      else setError(result.error || "Failed to fetch QCM data");
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData() }, []);

  const toggleSemester = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  if (loading) return <div className="space-y-4"><Skeleton className="h-8 w-48 rounded-lg" /><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" /></div>;

  return (
    <SubpageLayout
      title="QCM View"
      subtitle="Quality Circle Meeting"
      onBack={() => setActiveSubTab("overview")}
      action={
        <button onClick={fetchData} className="p-2.5 rounded-full bg-blue-50  dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors" title="Reload">
          <RefreshCcw className="w-5 h-5" />
        </button>
      }
    >
      {error && <div className="error-banner mb-4">{error}</div>}

      {data && Object.keys(data).length === 0 && (
        <div className="solid-card">
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg font-semibold">No QCM Data</p>
            <p className="text-sm">No Quality Circle Meeting records found.</p>
          </div>
        </div>
      )}

      {data && Object.entries(data).map(([semId, semData]) => (
        <div key={semId} className="solid-card mb-4">
          <button onClick={() => toggleSemester(semId)} className="w-full flex items-center justify-between p-4 hover:bg-white/40 dark:hover:bg-slate-700/30 transition-colors">
            <div className="flex items-center gap-3">
              {expanded[semId] ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
              <span className="font-semibold text-gray-900  dark:text-gray-100">{semData.semester}</span>
            </div>
          </button>

          {expanded[semId] && (
            <div className="px-4 pb-4 space-y-4 border-t border-gray-100  dark:border-gray-800 pt-4">
              {semData.error ? (
                <p className="text-sm text-red-500">{semData.error}</p>
              ) : (
                <>
                  {Object.keys(semData.keyValuePairs).length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(semData.keyValuePairs).map(([key, val]) => (
                        <div key={key}>
                          <p className="text-xs text-gray-400 uppercase tracking-wider">{key}</p>
                          <p className="font-medium text-gray-800  dark:text-gray-200 text-sm">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {semData.tables.map((table, ti) => (
                    <div key={ti}>
                      {table.caption && <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">{table.caption}</p>}
                      <div className="overflow-x-auto rounded-xl border border-gray-100  dark:border-gray-800">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50  dark:bg-gray-800/50">
                              {table.headers.map((h, hi) => (
                                <th key={hi} className="px-3 py-2 text-left font-semibold text-gray-600  dark:text-gray-300 text-xs uppercase tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {table.rows.map((row, ri) => (
                              <tr key={ri} className="border-t border-gray-100  dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                {table.headers.map((h, hi) => (
                                  <td key={hi} className="px-3 py-2 text-gray-800  dark:text-gray-200">{row[h] || row[`col${hi}`] || ""}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                  {Object.keys(semData.keyValuePairs).length === 0 && semData.tables.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">No data available for this semester</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </SubpageLayout>
  );
}
