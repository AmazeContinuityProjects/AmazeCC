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
  ChevronRight,
} from "lucide-react";
import {
  PredictorAssessment,
  PRESET_REGIMENS,
  normalizeWeights,
  safeNumber,
  RegimenPreset,
} from "@/lib/marksPredictor";
import {
  GhostButton,
  IconButton,
  ListRowText,
  ListShell,
  SectionHeader,
  SegmentedControl,
  ToneBadge,
} from "../../shared/primitives";
import { FIELD_INPUT, LIST_ROW, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";

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
    <div className={`${TILE_CARD} w-full max-w-full space-y-4 max-h-[85vh] overflow-y-auto overscroll-contain`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={`h-9 w-9 rounded-2xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE.indigo}`}>
            <Sliders className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit truncate">Assessment Regimen Editor</h3>
            <p className="text-[11px] text-zinc-400 font-medium truncate">Configure weightages for {courseCode}</p>
          </div>
        </div>
        <IconButton title="Close editor" onClick={onClose}>
          <X className="w-4 h-4" />
        </IconButton>
      </div>

      {isEmbedded && (
        <SegmentedControl
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "theory", label: `Theory (${currTheoryCreds})` },
            { value: "lab", label: `Lab (${currLabCreds})` },
          ]}
        />
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

      <div className="space-y-3 min-w-0">
        <SectionHeader
          icon={Sparkles}
          title="Quick presets"
          count={
            PRESET_REGIMENS.filter(
              (p) => (activeTab === "theory" && (p.category === "theory" || p.category === "softskill")) || (activeTab === "lab" && p.category === "lab") || p.category === "project"
            ).length
          }
        />
        <ListShell>
          {PRESET_REGIMENS.filter(
            (p) => (activeTab === "theory" && (p.category === "theory" || p.category === "softskill")) || (activeTab === "lab" && p.category === "lab") || p.category === "project"
          ).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className={`${LIST_ROW} cursor-pointer group`}
            >
              <ListRowText title={preset.name} subtitle={preset.description} />
              <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            </button>
          ))}
        </ListShell>
      </div>

      <div className="space-y-3 min-w-0">
        <div className="flex flex-col gap-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <SectionHeader
              icon={Sliders}
              title={`Assessments (${currentList.length})`}
              right={
                <ToneBadge tone={isWeightValid ? "emerald" : "red"}>
                  {totalWeight.toFixed(1)}% / 100%
                </ToneBadge>
              }
            />
          </div>
          {!isWeightValid && (
            <GhostButton onClick={handleNormalize} title="Auto-normalize weightages">
              <Wand2 className="w-3.5 h-3.5" />
              Auto-Normalize to 100%
            </GhostButton>
          )}
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 -mr-1 min-w-0">
          {currentList.map((item, idx) => (
            <div key={item.id} className="flex flex-col gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-zinc-400 shrink-0">#{idx + 1}</span>
                <input type="text" value={item.title} onChange={(e) => handleEditItem(item.id, "title", e.target.value)} placeholder="Assessment Name" aria-label="Assessment name" className={`${FIELD_INPUT} min-w-0`} />
                <IconButton title="Remove assessment" onClick={() => handleRemoveItem(item.id)}>
                  <Trash2 className="w-4 h-4" />
                </IconButton>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-bold text-zinc-400 shrink-0">Max:</span>
                  <input type="number" min="1" max="100" value={item.maxMark} onChange={(e) => handleEditItem(item.id, "maxMark", e.target.value)} aria-label="Maximum marks" className={`${FIELD_INPUT} min-w-0 text-center`} />
                </div>
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <span className="text-[11px] font-bold text-zinc-400 shrink-0">Wt:</span>
                  <input type="number" min="1" max="100" value={item.weightagePercent} onChange={(e) => handleEditItem(item.id, "weightagePercent", e.target.value)} aria-label="Weightage percent" className={`${FIELD_INPUT} min-w-0 text-center`} />
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
        <div className="flex items-center justify-center sm:justify-start min-w-0">
          {isWeightValid ? (
            <ToneBadge tone="emerald" icon={<Check className="w-3.5 h-3.5" />}>
              Regimen valid — ready to apply
            </ToneBadge>
          ) : (
            <ToneBadge tone="red" icon={<AlertCircle className="w-3.5 h-3.5" />}>
              Must total 100% (now {totalWeight.toFixed(1)}%)
            </ToneBadge>
          )}
        </div>
        <div className="flex gap-2">
          <span className="flex-1">
            <GhostButton onClick={onClose} title="Cancel without saving" className="w-full justify-center">
              Cancel
            </GhostButton>
          </span>
          <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs cursor-pointer active:scale-95">
            <Save className="w-4 h-4" />
            Apply Regimen
          </button>
        </div>
      </div>
    </div>
  );
}
