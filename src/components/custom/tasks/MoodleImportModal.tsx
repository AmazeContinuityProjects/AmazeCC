"use client";

import React, { useState, useMemo } from "react";
import { useAtom } from "jotai";
import { Download, Clock, BookOpen } from "lucide-react";
import BottomSheet from "../shared/BottomSheet";
import { moodleDataAtom, tasksAtom } from "@/store/dataAtoms";
import { previewMoodleImport, importMoodleTasks } from "@/lib/moodleImport";

interface MoodleImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function MoodleImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: MoodleImportModalProps) {
  const [moodleData] = useAtom(moodleDataAtom);
  const [tasks, setTasks] = useAtom(tasksAtom);

  const previews = useMemo(() => {
    return previewMoodleImport(moodleData || [], tasks);
  }, [moodleData, tasks]);

  // Track selected URLs
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(() => {
    const set = new Set<string>();
    previews.forEach((p) => {
      if (!p.alreadyImported && !p.isPast) {
        set.add(p.url || p.title);
      }
    });
    return set;
  });

  const availableToImport = previews.filter((p) => !p.alreadyImported);

  const toggleSelectAll = () => {
    if (selectedUrls.size === availableToImport.length) {
      setSelectedUrls(new Set());
    } else {
      setSelectedUrls(new Set(availableToImport.map((p) => p.url || p.title)));
    }
  };

  const toggleItem = (key: string) => {
    const next = new Set(selectedUrls);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedUrls(next);
  };

  const handleImport = () => {
    const itemsToImport = previews.filter((p) =>
      selectedUrls.has(p.url || p.title)
    );
    const updated = importMoodleTasks(itemsToImport);
    setTasks(updated);
    onImportComplete();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="moodle-import-modal"
      maxWidth="max-w-lg"
      title="Import from Moodle LMS"
      subtitle="Sync pending digital assignments into your timetable tasks"
      icon={<Download className="w-5 h-5" />}
      accent="bg-warn-soft text-warn border-warn/40"
      closeLabel="Close Moodle import"
    >
      <div className="flex flex-col max-h-[80vh] text-left">
        {/* Assignment list */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto min-h-0 flex-1">
          {previews.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <BookOpen className="w-8 h-8 text-zinc-300 dark:text-zinc-600 mx-auto" />
              <p className="text-xs font-semibold text-muted">
                No LMS assignments found in Moodle data.
              </p>
              <p className="text-[11px] text-zinc-400">
                Make sure you are logged in to LMS or have synced Moodle.
              </p>
            </div>
          ) : (
            <>
              {availableToImport.length > 0 && (
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                    {availableToImport.length} new assignment
                    {availableToImport.length === 1 ? "" : "s"} found
                  </span>
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {selectedUrls.size === availableToImport.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {previews.map((item, idx) => {
                  const key = item.url || item.title || String(idx);
                  const isChecked = selectedUrls.has(key);

                  return (
                    <div
                      key={key}
                      onClick={() => !item.alreadyImported && toggleItem(key)}
                      className={`p-3 rounded-md border flex items-start gap-3 transition-all ${
                        item.alreadyImported
                          ? "bg-surface-2 border-zinc-200/50 dark:border-zinc-800/50 opacity-60 cursor-default"
                          : isChecked
                          ? "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-500/40 cursor-pointer shadow-2xs"
                          : "bg-surface border-zinc-200/80 dark:border-zinc-800 cursor-pointer hover:border-zinc-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked || item.alreadyImported}
                        disabled={item.alreadyImported}
                        onChange={() => toggleItem(key)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-1">
                          {item.courseCode && (
                            <span className="text-[9.5px] font-semibold px-1.5 py-0.2 rounded bg-surface-2 text-zinc-700 dark:text-zinc-300">
                              {item.courseCode}
                            </span>
                          )}
                          {item.alreadyImported && (
                            <span className="text-[11px] font-semibold text-ok bg-ok-soft px-1.5 py-0.2 rounded">
                              Already Imported
                            </span>
                          )}
                          {item.isPast && !item.alreadyImported && (
                            <span className="text-[11px] font-semibold text-danger bg-danger-soft px-1.5 py-0.2 rounded">
                              Past Due
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-semibold text-ink font-outfit leading-snug">
                          {item.title}
                        </h4>

                        {item.dueDate && (
                          <p className="text-[10.5px] text-muted mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            Due: {new Date(item.dueDate).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-line flex items-center justify-between gap-3 bg-surface-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={selectedUrls.size === 0}
            className="px-5 py-2 rounded-sm text-xs font-medium bg-accent hover:bg-accent/90 disabled:opacity-50 text-background transition-colors cursor-pointer flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Import ({selectedUrls.size})</span>
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
