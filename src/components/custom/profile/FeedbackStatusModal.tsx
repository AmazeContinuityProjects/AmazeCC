"use client";
import { useState, useEffect } from "react";
import { Modal, Card, Badge } from "../shared";
import { Skeleton } from "@/components/ui/Skeleton";
import { API_BASE } from "../Main";
import { XCircle, CheckCircle, Clock, GraduationCap } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
}

export default function FeedbackStatusModal({ isOpen, onClose, loginToVTOP }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    loginToVTOP()
      .then((creds) =>
        fetch(`${API_BASE}/api/feedback-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf }),
        }).then((r) => r.json())
      )
      .then((res) => {
        if (res.success === false) {
          setError(res.error || "Failed to load feedback status");
        } else {
          setData(res);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [isOpen]);

  const semesters = data?.semesters ? Object.entries(data.semesters) : [];
  const hasSemesterResponse = data?.semesters !== undefined;

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
        {!loading && !error && hasSemesterResponse && semesters.length === 0 && (
          <div className="flex flex-col items-center py-8 text-gray-400 dark:text-gray-500 midnight:text-gray-500">
            <Clock className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">No feedback data available</p>
          </div>
        )}
        {!loading && !error && hasSemesterResponse && semesters.length > 0 && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {semesters.map(([semName, semData]: [string, any]) => {
              const rows = semData?.tables?.[0]?.rows || [];
              return (
                <Card key={semName} variant="glass" className="overflow-hidden">
                  <div className="p-4">
                    <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase tracking-wider mb-3">{semName}</h4>
                    {rows.length > 0 ? (
                      <div className="space-y-2">
                        {rows.map((row: any, i: number) => {
                          const courseCode = row["Course Code"] || row[0] || "";
                          const courseTitle = row["Course Title"] || row[1] || "";
                          const curriculumGiven = (row["Curriculum Feedback"] || row[2] || "").toLowerCase().includes("given");
                          const courseGiven = (row["Course Feedback"] || row[3] || "").toLowerCase().includes("given");
                          return (
                            <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 midnight:bg-gray-800/50 border border-gray-100 dark:border-gray-700 midnight:border-gray-700">
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <GraduationCap className="w-4 h-4 text-gray-400 shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 midnight:text-gray-200 truncate">{courseCode}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-400 truncate">{courseTitle}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                <Badge variant={curriculumGiven ? "success" : "danger"} size="sm">
                                  {curriculumGiven ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  Curriculum
                                </Badge>
                                <Badge variant={courseGiven ? "success" : "danger"} size="sm">
                                  {courseGiven ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  Course
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-gray-500 midnight:text-gray-500 text-center py-2">No courses found</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
        {!loading && !error && !hasSemesterResponse && data?.tables && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {data.tables.map((table: any, idx: number) => {
              const rows = table.rows || [];
              return (
                <Card key={idx} variant="glass" className="overflow-hidden">
                  <div className="p-4">
                    {table.caption && <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase tracking-wider mb-3">{table.caption}</h4>}
                    {rows.length > 0 ? (
                      <div className="space-y-2">
                        {rows.map((row: any, i: number) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/50 dark:bg-slate-800/50 midnight:bg-gray-800/50 border border-gray-100 dark:border-gray-700 midnight:border-gray-700">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 midnight:text-gray-200 truncate">{row[0] || row["Course Code"]}</span>
                            <Badge variant={(row[2] || row["Curriculum Feedback"] || "").toLowerCase().includes("given") ? "success" : "danger"} size="sm">
                              {(row[2] || row["Curriculum Feedback"] || "").toLowerCase().includes("given") ? "Given" : "Pending"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-2">No data</p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
