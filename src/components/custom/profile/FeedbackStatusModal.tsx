"use client";
import { useState, useEffect } from "react";
import { Modal, Card, Badge } from "../shared";
import { Skeleton } from "@/components/ui/Skeleton";
import { API_BASE } from "../Main";
import { XCircle, CheckCircle, Clock, BookOpen, ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
}

export default function FeedbackStatusModal({ isOpen, onClose, loginToVTOP }: Props) {
  const [semesters, setSemesters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    setSemesters([]);

    let creds: any;
    loginToVTOP()
      .then((c) => {
        creds = c;
        return fetch(`${API_BASE}/api/feedback-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }),
        }).then((r) => r.json());
      })
      .then(async (initial) => {
        if (initial.success === false) {
          setError(initial.error || "Failed to load feedback status");
          return;
        }
        const semesterOptions = initial.semesters || [];
        const semList = semesterOptions.map((s: any) => ({ label: s.text, value: s.value, rows: s.selected ? (initial.feedbackTable || []) : [] }));
        const selectedIdx = semesterOptions.findIndex((s: any) => s.selected);
        if (selectedIdx >= 0) {
          setExpanded({ [semList[selectedIdx].label]: true });
        }

        const results = await Promise.allSettled(
          semesterOptions
            .filter((s: any) => !s.selected)
            .map((s: any) =>
              fetch(`${API_BASE}/api/feedback-status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, semesterId: s.value }),
              }).then((r) => r.json())
            )
        );
        results.forEach((res, i) => {
          if (res.status === "fulfilled" && res.value?.success !== false) {
            semList[semesterOptions.findIndex((s: any) => !s.selected) + i].rows = res.value.feedbackTable || [];
          }
        });
        setSemesters(semList);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const toggleExpand = (label: string) => setExpanded((p) => ({ ...p, [label]: !p[label] }));

  const totalRows = semesters.reduce((sum, s) => sum + s.rows.length, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Feedback Status" maxWidth="max-w-2xl">
      <div className="space-y-4">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        )}
        {error && (
          <div className="flex items-center gap-3 p-4 text-red-600 dark:text-red-400 midnight:text-red-500">
            <XCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        {!loading && !error && totalRows === 0 && (
          <div className="flex flex-col items-center py-8 text-gray-400 dark:text-gray-500 midnight:text-gray-500">
            <Clock className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">No feedback data available</p>
          </div>
        )}
        {!loading && !error && semesters.length > 0 && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {semesters.map((sem) => {
              const isExpanded = expanded[sem.label] ?? true;
              const done = sem.rows.filter((r: any) => (r.midSemester || "").toLowerCase().includes("given") || (r.teeSemester || "").toLowerCase().includes("given")).length;
              return (
                <Card key={sem.value} variant="glass" className="overflow-hidden">
                  <button
                    onClick={() => toggleExpand(sem.label)}
                    className="w-full flex items-center justify-between p-4 hover:bg-white/40 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 midnight:text-gray-300">{sem.label}</h4>
                    </div>
                    <Badge variant={done === sem.rows.length && sem.rows.length > 0 ? "success" : "danger"} size="sm">
                      {done}/{sem.rows.length} done
                    </Badge>
                  </button>
                  {isExpanded && sem.rows.length > 0 && (
                    <div className="px-4 pb-4 space-y-2">
                      {sem.rows.map((row: any, i: number) => {
                        const midGiven = (row.midSemester || "").toLowerCase().includes("given");
                        const teeGiven = (row.teeSemester || "").toLowerCase().includes("given");
                        return (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 midnight:bg-gray-800/50 border border-gray-100 dark:border-gray-700 midnight:border-gray-700">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <BookOpen className="w-4 h-4 text-gray-400 shrink-0" />
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 midnight:text-gray-200 truncate">{row.feedbackType || "N/A"}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <Badge variant={midGiven ? "success" : "danger"} size="sm">
                                {midGiven ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                Mid Sem
                              </Badge>
                              <Badge variant={teeGiven ? "success" : "danger"} size="sm">
                                {teeGiven ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                TEE
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isExpanded && sem.rows.length === 0 && (
                    <div className="px-4 pb-4">
                      <p className="text-sm text-gray-400 dark:text-gray-500 midnight:text-gray-500 text-center py-2">No courses found</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
