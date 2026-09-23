"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { officialOdDataAtom } from "@/store";
import { Badge } from "../shared";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { CalendarClock, ChevronDown, FileText, Inbox, RefreshCw, ScrollText, XCircle } from "lucide-react";
import { syncEngine } from "@/lib/sync-engine";
import { storage } from "@/lib/storage";
import { DEMO_OFFICIAL_OD, formatSemesterName, getOfficialOd } from "@/lib/officialOd";
import type { OfficialOdResponse } from "@/types/data/od";

interface Props {
  currSemesterID: string;
  allGradesData?: any;
}

export default function OfficialOdSection({ currSemesterID, allGradesData }: Props) {
  const [engineOd] = useAtom(officialOdDataAtom);
  const [demoMode] = useState(() => {
    try {
      return storage.demoMode.get();
    } catch {
      return false;
    }
  });
  const [semesterId, setSemesterId] = useState(currSemesterID);
  const [otherSemData, setOtherSemData] = useState<Record<string, OfficialOdResponse>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const semesterOptions = useMemo(() => {
    const ids = new Set<string>();
    if (currSemesterID) ids.add(currSemesterID);
    const grades = allGradesData?.grades;
    if (grades && typeof grades === "object") {
      Object.keys(grades).forEach((k) => {
        if (!k || k === "Current" || k === "curriculum" || k === "effectiveGrades") return;
        ids.add(k);
      });
    }
    return Array.from(ids)
      .sort((a, b) => b.localeCompare(a))
      .map((id) => ({ value: id, label: id === currSemesterID ? `${formatSemesterName(id)} (Current)` : formatSemesterName(id) }));
  }, [currSemesterID, allGradesData]);

  useEffect(() => {
    setSemesterId(currSemesterID);
  }, [currSemesterID]);

  // Resolve display data: engine atom (current sem) -> other-sem cache -> local storage
  const data: OfficialOdResponse | null = useMemo(() => {
    if (demoMode) return { ...DEMO_OFFICIAL_OD, semesterId };
    if (engineOd && engineOd.semesterId === semesterId) return engineOd;
    if (otherSemData[semesterId]) return otherSemData[semesterId];
    return getOfficialOd(semesterId);
  }, [demoMode, engineOd, otherSemData, semesterId]);

  const fetchViaEngine = useCallback(
    async (sem: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await syncEngine.sync<OfficialOdResponse | null>("officialOd", { semesterId: sem });
        if (result && result.semesterId !== currSemesterID) {
          setOtherSemData((prev) => ({ ...prev, [sem]: result }));
        }
        if (!result) {
          const fallback = getOfficialOd(sem);
          if (!fallback) setError("No official OD records found for this semester");
        }
      } catch (err: any) {
        if (!getOfficialOd(sem)) setError(err?.message || "Failed to load official OD records");
      } finally {
        setLoading(false);
      }
    },
    [currSemesterID],
  );

  // Lazy-fill semesters the engine hasn't synced yet (e.g. past semesters)
  useEffect(() => {
    if (demoMode) return;
    if (data || loading) return;
    fetchViaEngine(semesterId);
  }, [semesterId, demoMode, data, loading, fetchViaEngine]);

  const refresh = () => {
    if (demoMode) return;
    fetchViaEngine(semesterId);
  };

  return (
    <div className="bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-gray-100  dark:border-gray-800 flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900  dark:text-gray-100 flex items-center gap-2">
              <ScrollText size={18} className="text-blue-600 dark:text-blue-400" />
              Official OD Records
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Straight from VTOP — why each On-Duty was granted.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            {data && (
              <Badge variant="success" size="sm">
                Total Count: {data.totalCount}
              </Badge>
            )}
            <button
              onClick={refresh}
              disabled={loading}
              title="Refresh from VTOP"
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        {semesterOptions.length > 1 && (
          <div className="relative max-w-xs">
            <select
              value={semesterId}
              onChange={(e) => setSemesterId(e.target.value)}
              className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl bg-white  dark:bg-gray-800 border border-gray-200  dark:border-gray-700 text-gray-800  dark:text-gray-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {semesterOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {loading && !data && (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40 rounded-lg" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 p-4 text-red-600  dark:text-red-500">
            <XCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        {!loading && !error && data && data.records.length === 0 && (
          <div className="flex flex-col items-center py-8 text-gray-400  dark:text-gray-500">
            <Inbox className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">No official OD records for this semester</p>
          </div>
        )}
        {!loading && !error && data && data.records.length > 0 && (
          <div className="space-y-3">
            {data.records.map((r) => (
              <div
                key={r.slNo}
                className="p-3 sm:p-4 rounded-xl bg-gray-50/70  dark:bg-gray-900/60 border border-gray-100  dark:border-gray-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900  dark:text-gray-100">{r.reason}</p>
                    <p className="text-xs text-gray-600  dark:text-gray-300 mt-1 flex items-start gap-1.5">
                      <FileText size={12} className="mt-0.5 shrink-0 text-gray-400" />
                      <span className="break-words">{r.remarks || "—"}</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded  dark:bg-blue-900/30 dark:text-blue-400">
                    #{r.slNo}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <CalendarClock size={12} />
                    {r.date}
                  </span>
                  <span className="font-medium">{r.time}</span>
                  <span className="uppercase tracking-wider font-semibold">{r.basis}</span>
                </div>
              </div>
            ))}
            {data.note && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed pt-1">{data.note}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
