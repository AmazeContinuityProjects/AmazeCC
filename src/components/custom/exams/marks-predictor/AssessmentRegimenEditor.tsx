"use client";

import React, { useState } from "react";
import {
  Sliders,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Sparkles,
  X,
  Wand2,
  Save,
} from "lucide-react";
import {
  PredictorAssessment,
  PRESET_REGIMENS,
  normalizeWeights,
  safeNumber,
  RegimenPreset,
} from "@/lib/marksPredictor";

interface AssessmentRegimenEditorProps {
  courseCode: string;
  isEmbedded: boolean;
  theoryAssessments: PredictorAssessment[];
  labAssessments: PredictorAssessment[];
  theoryCredits: number;
  labCredits: number;
  onUpdateAssessments: (
    theory: PredictorAssessment[],
    lab: PredictorAssessment[],
    theoryCreds?: number,
    labCreds?: number
  ) => void;
  onClose: () => void;
}

export default function AssessmentRegimenEditor({
  courseCode,
  isEmbedded,
  theoryAssessments,
  labAssessments,
  theoryCredits,
  labCredits,
  onUpdateAssessments,
  onClose,
}: AssessmentRegimenEditorProps) {
  const [activeTab, setActiveTab] = useState<"theory" | "lab">(
    theoryAssessments.length > 0 ? "theory" : "lab"
  );

  const [currTheory, setCurrTheory] = useState<PredictorAssessment[]>(theoryAssessments);
  const [currLab, setCurrLab] = useState<PredictorAssessment[]>(labAssessments);
  const [currTheoryCreds, setCurrTheoryCreds] = useState<number>(theoryCredits);
  const [currLabCreds, setCurrLabCreds] = useState<number>(labCredits);

  const currentList = activeTab === "theory" ? currTheory : currLab;
  const setCurrentList = (updater: (prev: PredictorAssessment[]) => PredictorAssessment[]) => {
    if (activeTab === "theory") setCurrTheory(updater);
    else setCurrLab(updater);
  };

  const totalWeight = currentList.reduce((sum, item) => sum + safeNumber(item.weightagePercent, 0), 0);
  const isWeightValid = Math.abs(totalWeight - 100) < 0.05;

  const handleApplyPreset = (preset: RegimenPreset) => {
    const newItems: PredictorAssessment[] = preset.items.map((item, idx) => ({
      id: `${activeTab}-preset-${Date.now()}-${idx}`,
      title: item.title,
      maxMark: item.maxMark,
      weightagePercent: item.weightagePercent,
      scoredMark: null,
      status: "Pending",
      isSimulated: false,
      component: activeTab,
    }));
    setCurrentList(() => newItems);
  };

  const handleAddItem = () => {
    const newItem: PredictorAssessment = {
      id: `${activeTab}-custom-${Date.now()}`,
      title: `Assessment ${currentList.length + 1}`,
      maxMark: 50,
      weightagePercent: 10,
      scoredMark: null,
      status: "Pending",
      isSimulated: false,
      component: activeTab,
    };
    setCurrentList((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    setCurrentList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleEditItem = (id: string, field: keyof PredictorAssessment, val: any) => {
    setCurrentList((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          [field]: field === "maxMark" || field === "weightagePercent" ? safeNumber(val, 0) : val,
        };
      })
    );
  };

  const handleNormalize = () => {
    const normalized = normalizeWeights(currentList);
    setCurrentList(() => normalized as PredictorAssessment[]);
  };

  const handleSave = () => {
    onUpdateAssessments(currTheory, currLab, currTheoryCreds, currLabCreds);
    onClose();
  };

  return (
    <div className="w-full max-w-full overflow-hidden rounded-[22px] border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3.5 sm:p-4 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain">
      {/* Header — simple, no overflow */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Sliders className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit truncate">Assessment Regimen Editor</h3>
            <p className="text-[11px] text-zinc-400 font-medium truncate">Configure weightages for {courseCode}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isEmbedded && (
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 min-w-0">
          <button
            onClick={() => setActiveTab("theory")}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer truncate ${
              activeTab === "theory" ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Theory ({currTheoryCreds})
          </button>
          <button
            onClick={() => setActiveTab("lab")}
            className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer truncate ${
              activeTab === "lab" ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Lab ({currLabCreds})
          </button>
        </div>
      )}

      {isEmbedded && (
        <div className="flex flex-col gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 text-xs min-w-0">
          <span className="font-bold text-zinc-700 dark:text-zinc-300">Credit Weighting</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-500 font-medium text-[11px]">Theory:</span>
            <input type="number" min="1" max="5" value={currTheoryCreds} onChange={(e) => setCurrTheoryCreds(Math.max(1, safeNumber(e.target.value, 3)))} className="w-14 px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-center font-bold text-zinc-900 dark:text-white" />
            <span className="text-zinc-500 font-medium text-[11px]">Lab:</span>
            <input type="number" min="1" max="4" value={currLabCreds} onChange={(e) => setCurrLabCreds(Math.max(1, safeNumber(e.target.value, 1)))} className="w-14 px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-center font-bold text-zinc-900 dark:text-white" />
          </div>
        </div>
      )}

      <div className="space-y-2 min-w-0">
        <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Quick Presets</label>
        <div className="grid grid-cols-1 gap-2">
          {PRESET_REGIMENS.filter(
            (p) => (activeTab === "theory" && (p.category === "theory" || p.category === "softskill")) || (activeTab === "lab" && p.category === "lab") || p.category === "project"
          ).map((preset) => (
            <button
              key={preset.id}
              onClick={() => handleApplyPreset(preset)}
              className="flex flex-col p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/50 hover:border-indigo-500/40 hover:bg-white dark:hover:bg-zinc-800 text-left transition-all cursor-pointer group min-w-0 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-xs font-black text-zinc-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate min-w-0">{preset.name}</span>
                <Sparkles className="w-3.5 h-3.5 text-zinc-400 group-hover:text-indigo-500 shrink-0" />
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-2 break-words">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <label className="text-[11px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Assessments ({currentList.length})</label>
            <span className={`px-2 py-1 rounded-lg text-[11px] font-black border ${isWeightValid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"}`}>
              {totalWeight.toFixed(1)}% / 100%
            </span>
          </div>
          {!isWeightValid && (
            <button onClick={handleNormalize} className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-black border border-amber-500/20 cursor-pointer">
              <Wand2 className="w-3.5 h-3.5" />
              Auto-Normalize to 100%
            </button>
          )}
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 -mr-1 min-w-0">
          {currentList.map((item, idx) => (
            <div key={item.id} className="flex flex-col gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-zinc-400 shrink-0">#{idx + 1}</span>
                <input type="text" value={item.title} onChange={(e) => handleEditItem(item.id, "title", e.target.value)} placeholder="Assessment Name" className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-zinc-900 dark:text-white" />
                <button onClick={() => handleRemoveItem(item.id)} className="p-2 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-bold text-zinc-400 shrink-0">Max:</span>
                  <input type="number" min="1" max="100" value={item.maxMark} onChange={(e) => handleEditItem(item.id, "maxMark", e.target.value)} className="flex-1 min-w-0 px-2 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-center text-zinc-900 dark:text-white" />
                </div>
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-bold text-zinc-400 shrink-0">Wt:</span>
                  <input type="number" min="1" max="100" value={item.weightagePercent} onChange={(e) => handleEditItem(item.id, "weightagePercent", e.target.value)} className="flex-1 min-w-0 px-2 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs font-bold text-center text-zinc-900 dark:text-white" />
                  <span className="text-xs font-bold text-zinc-400 shrink-0">%</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={handleAddItem} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 text-xs font-black transition-all cursor-pointer">
          <Plus className="w-4 h-4" />
          Add Assessment
        </button>
      </div>

      <div className="flex flex-col gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="text-xs text-center sm:text-left min-w-0">
          {!isWeightValid ? (
            <span className="flex items-center justify-center sm:justify-start gap-1.5 text-rose-500 font-bold break-words">
              <AlertCircle className="w-4 h-4 shrink-0" />
              Weightages must sum to 100% (now {totalWeight.toFixed(1)}%)
            </span>
          ) : (
            <span className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <Check className="w-4 h-4" />
              Regimen valid — ready to apply
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-black transition-all cursor-pointer">
            Cancel
          </button>
          <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs cursor-pointer active:scale-95">
            <Save className="w-4 h-4" />
            Apply Regimen
          </button>
        </div>
      </div>
    </div>
  );
}
