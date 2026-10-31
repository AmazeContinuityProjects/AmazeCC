"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Scale, Plus, Trash2, BookOpen, Sparkles, Check, AlertCircle } from "lucide-react";
import { FacultyAvatar } from "@/components/custom/exams/FFCS/components/FacultyAvatar";
import { getFacultyProfileSnapshot } from "@/lib/reviewsService";
import { TEACHING_CONFIG } from "@/config/reviewQuestions";

interface FacultyCompareModalProps {
  open: boolean;
  onClose: () => void;
  courseCode?: string;
  initialFacultyIds?: string[];
  catalogFaculty?: Array<{ id: string; name: string; school: string | null }>;
}

export default function FacultyCompareModal({
  open,
  onClose,
  courseCode,
  initialFacultyIds = [],
  catalogFaculty = [],
}: FacultyCompareModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialFacultyIds.slice(0, 3));
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (initialFacultyIds.length > 0) {
      setSelectedIds(initialFacultyIds.slice(0, 3));
    }
  }, [open, initialFacultyIds]);

  useEffect(() => {
    if (!open || selectedIds.length === 0) return;

    setLoading(true);
    Promise.all(selectedIds.map((id) => getFacultyProfileSnapshot(id)))
      .then((results) => {
        const map: Record<string, any> = {};
        results.forEach((res, i) => {
          if (res) map[selectedIds[i]] = res;
        });
        setProfiles(map);
      })
      .finally(() => setLoading(false));
  }, [open, selectedIds]);

  if (!open || !mounted) return null;

  const removeFaculty = (id: string) => {
    setSelectedIds((prev) => prev.filter((item) => item !== id));
  };

  const addFaculty = (id: string) => {
    if (selectedIds.length >= 3 || selectedIds.includes(id)) return;
    setSelectedIds((prev) => [...prev, id]);
  };

  const questionsToCompare = [
    { id: "T_CLARITY", label: "Concept Clarity" },
    { id: "T_DOUBTS", label: "Doubt Helpfulness" },
    { id: "T_ALIGN", label: "CAT / FAT Prep" },
    { id: "T_FAIR", label: "Marking Fairness" },
    { id: "T_AGAIN", label: "Would Pick Again" },
  ];

  const stylesToCompare = [
    { id: "S_PACE", label: "Pace" },
    { id: "S_ATTEND", label: "Attendance Strictness" },
    { id: "S_MARKS", label: "Marks Generosity" },
    { id: "S_WORKLOAD", label: "Workload" },
    { id: "S_PAPER", label: "Paper Toughness" },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-surface border border-border-strong rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-strong bg-surface-secondary/40 shrink-0">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-base text-text-heading">Compare Faculty</h3>
              <p className="text-xs text-muted-foreground">
                Side-by-side comparison{courseCode ? ` for ${courseCode}` : ""} (up to 3 faculty)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-text-heading hover:bg-surface-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {selectedIds.length < 3 && catalogFaculty.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Add to comparison:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    addFaculty(e.target.value);
                    e.target.value = "";
                  }
                }}
                className="px-3 py-1.5 rounded-xl border border-border-strong bg-surface text-text-heading text-xs font-semibold"
                defaultValue=""
              >
                <option value="" disabled>
                  Select a faculty member…
                </option>
                {catalogFaculty
                  .filter((f) => !selectedIds.includes(f.id))
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.school || "Faculty"})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {selectedIds.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No faculty selected for comparison. Select up to 3 faculty members to compare metrics side by side.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Faculty Cards Column Header */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {selectedIds.map((id) => {
                  const prof = profiles[id];
                  const facultyInfo = prof?.faculty;
                  const teaching = prof?.teaching;

                  return (
                    <div
                      key={id}
                      className="p-4 rounded-xl border border-border-strong bg-surface flex flex-col justify-between relative space-y-3"
                    >
                      <button
                        onClick={() => removeFaculty(id)}
                        className="absolute top-3 right-3 text-muted-foreground hover:text-red-500 p-1"
                        title="Remove from comparison"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="flex items-center gap-3 pr-6">
                        <FacultyAvatar name={facultyInfo?.name} size="md" tone="amber" />
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-text-heading truncate">
                            {facultyInfo?.name || "Loading…"}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {facultyInfo?.school || "Faculty"}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-border flex items-baseline justify-between">
                        <div>
                          <span className="text-xs text-muted-foreground font-semibold">Teaching Grade</span>
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-extrabold text-amber-500">
                              {teaching?.grade !== null && teaching?.grade !== undefined
                                ? teaching.grade.toFixed(1)
                                : "—"}
                            </span>
                            <span className="text-xs text-muted-foreground">/ 5.0</span>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {teaching?.n_reviews || 0} reviews
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quality Questions Comparison Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Teaching Quality Comparison
                </h4>
                <div className="divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
                  {questionsToCompare.map((q) => (
                    <div key={q.id} className="p-3 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                      <span className="text-xs font-semibold text-text-heading col-span-1">
                        {q.label}
                      </span>
                      <div className="col-span-3 grid grid-cols-3 gap-4">
                        {selectedIds.map((id) => {
                          const prof = profiles[id];
                          const score = prof?.teaching?.per_question?.[q.id]?.avg;
                          return (
                            <div key={id} className="text-xs font-bold text-amber-500">
                              {score !== undefined ? `${score.toFixed(1)} / 5` : "—"}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Style Spectrums Comparison */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Atmosphere & Workload Comparison
                </h4>
                <div className="divide-y divide-border border border-border rounded-xl bg-surface overflow-hidden">
                  {stylesToCompare.map((s) => (
                    <div key={s.id} className="p-3 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                      <span className="text-xs font-semibold text-text-heading col-span-1">
                        {s.label}
                      </span>
                      <div className="col-span-3 grid grid-cols-3 gap-4">
                        {selectedIds.map((id) => {
                          const prof = profiles[id];
                          const val = prof?.teaching?.style?.[s.id]?.avg;
                          return (
                            <div key={id} className="text-xs font-bold text-blue-500">
                              {val !== undefined ? `${val.toFixed(1)} / 5` : "—"}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Tags Comparison */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Top Student Tags
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedIds.map((id) => {
                    const prof = profiles[id];
                    const green = prof?.teaching?.top_tags_green || [];
                    const red = prof?.teaching?.top_tags_red || [];

                    return (
                      <div key={id} className="p-3 rounded-xl border border-border bg-surface space-y-2">
                        <div className="flex flex-wrap gap-1">
                          {green.slice(0, 3).map((t: any) => (
                            <span
                              key={t.tag}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            >
                              +{t.tag}
                            </span>
                          ))}
                          {green.length === 0 && (
                            <span className="text-[10px] text-muted-foreground">No top green tags</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {red.slice(0, 3).map((t: any) => (
                            <span
                              key={t.tag}
                              className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400"
                            >
                              -{t.tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
