"use client";

import React, { useState } from "react";
import {
  Sliders,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  Sparkles,
  Wand2,
  Save,
  Lock,
  ChevronRight,
} from "lucide-react";
import {
  PredictorAssessment,
  PRESET_REGIMENS,
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
import { FIELD_INPUT, LIST_ROW, TONE_ICON_TILE } from "@/lib/uiTokens";
import BottomSheet from "../../shared/BottomSheet";
import {
  isAssessmentPublished,
  remainingWeightFor,
  weightFreezeFor,
} from "./useCoursePredictionScope";

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

  // Freeze enforcement: published rows are cohort facts and the final exam's
  // 40% is reserved, so neither their weightage can be re-typed, their row
  // removed, nor a preset rewrite over them. The remaining share is all a
  // user's own addenda can ever claim.
  const frozenWeight = currentList
    .filter((item) => weightFreezeFor(item).frozen)
    .reduce((sum, item) => sum + safeNumber(item.weightagePercent, 0), 0);
  const remaining = remainingWeightFor(currentList);
  const anyPublished = currentList.some(isAssessmentPublished);
  const anyFrozen = currentList.some((item) => weightFreezeFor(item).frozen);

  const handleApplyPreset = (preset: RegimenPreset) => {
    // A preset rewrites the whole component — that is exactly the change the
    // freeze forbids once marks have published. Declined with the same rule
    // the weight inputs follow.
    if (anyPublished) return;
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
    // A new assessment claims only the weight still open — published facts and
    // the reserved final exam are not spendable.
    if (remaining <= 0) return;
    const newItem: PredictorAssessment = {
      id: `${activeTab}-custom-${Date.now()}`,
      title: `Assessment ${currentList.length + 1}`,
      maxMark: 50,
      weightagePercent: Math.min(10, remaining),
      scoredMark: null,
      status: "Pending",
      isSimulated: false,
      component: activeTab,
    };
    setCurrentList((prev) => [...prev, newItem]);
  };

  const handleRemoveItem = (id: string) => {
    const item = currentList.find((it) => it.id === id);
    // Frozen rows cannot be deleted: a published fact is not the user's to
    // drop, and the reserved final exam must stay in the prediction.
    if (!item || weightFreezeFor(item).frozen) return;
    setCurrentList((prev) => prev.filter((it) => it.id !== id));
  };

  const handleEditItem = (id: string, field: keyof PredictorAssessment, val: any) => {
    setCurrentList((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        // A weightage edit stays inside the component total: every frozen row
        // keeps its share, so the editable envelope is the non-frozen rest.
        if (field === "weightagePercent" && weightFreezeFor(item).frozen) return item;
        if (field === "weightagePercent") {
          const frozenSum = prev
            .filter((it) => it.id !== id && weightFreezeFor(it).frozen)
            .reduce((sum, it) => sum + safeNumber(it.weightagePercent, 0), 0);
          const editableSum = prev
            .filter((it) => it.id !== id && !weightFreezeFor(it).frozen)
            .reduce((sum, it) => sum + safeNumber(it.weightagePercent, 0), 0);
          const capped = Math.min(
            safeNumber(val, 0),
            Math.max(0, 100 - frozenSum - editableSum)
          );
          return { ...item, weightagePercent: safeNumber(capped, 0) };
        }
        return {
          ...item,
          [field]: field === "maxMark" ? safeNumber(val, 0) : val,
        };
      })
    );
  };

  const handleNormalize = () => {
    // Scale only what the freeze leaves editable: frozen rows keep their share
    // and the rest refills (100 − frozenSum) proportionally.
    const editable = currentList.filter((item) => !weightFreezeFor(item).frozen);
    if (editable.length === 0 || frozenWeight >= 100) return;
    const editableSum = editable.reduce((sum, item) => sum + safeNumber(item.weightagePercent, 0), 0);
    const target = 100 - frozenWeight;
    setCurrentList((prev) =>
      prev.map((item) => {
        if (weightFreezeFor(item).frozen) return item;
        const weight =
          editableSum > 0
            ? (safeNumber(item.weightagePercent, 0) / editableSum) * target
            : target / editable.length;
        return { ...item, weightagePercent: Math.round(weight * 10) / 10 };
      })
    );
  };

  const handleSave = () => {
    onUpdateAssessments(currTheory, currLab, currTheoryCreds, currLabCreds);
    onClose();
  };

  return (
    <BottomSheet
      onClose={onClose}
      overlayId={`predictor-regimen-${courseCode}`}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pb-2">
        {/* Header — the sheet carries the X, grabber and dismissal gestures */}
        <div className="flex items-center gap-3 min-w-0">
          <span className={`h-9 w-9 rounded-2xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE.indigo}`}>
            <Sliders className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit truncate">Assessment Regimen Editor</h3>
            <p className="text-[11px] text-zinc-400 font-medium truncate">Configure weightages for {courseCode} · apply to save, swipe down to discard</p>
          </div>
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

      {/* Quick presets only exist to start a regimen from nothing. A component
          that already carries assessments — from VTOP, storage, or the user's
          own adds — would only be torn down by applying one, so the offer
          disappears instead of dangling a dangerous rewrite. */}
      {currentList.length === 0 && (
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
                title={preset.description}
                className={`${LIST_ROW} cursor-pointer group`}
              >
                <ListRowText title={preset.name} subtitle={preset.description} />
                <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
              </button>
            ))}
          </ListShell>
        </div>
      )}

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

        {/* Flat list — no inner scroller; the sheet body scrolls everything. */}
        <div className="space-y-2 min-w-0">
          {currentList.map((item, idx) => {
            const freeze = weightFreezeFor(item);
            return (
              <div key={item.id} className="flex flex-col gap-2 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-800/60 min-w-0 overflow-hidden">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-zinc-400 shrink-0">#{idx + 1}</span>
                  <input type="text" value={item.title} onChange={(e) => handleEditItem(item.id, "title", e.target.value)} placeholder="Assessment Name" aria-label="Assessment name" className={`${FIELD_INPUT} min-w-0`} />
                  {freeze.frozen ? (
                    <ToneBadge tone={isAssessmentPublished(item) ? "emerald" : "amber"}>
                      {isAssessmentPublished(item) ? "Published" : "Reserved"}
                    </ToneBadge>
                  ) : null}
                  <IconButton
                    title={freeze.frozen ? "Frozen — published facts and the reserved FAT stay" : "Remove assessment"}
                    onClick={() => handleRemoveItem(item.id)}
                    className={freeze.frozen ? "opacity-30 cursor-not-allowed" : ""}
                  >
                    <Trash2 className={freeze.frozen ? "w-4 h-4" : "w-4 h-4"} />
                  </IconButton>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-zinc-400 shrink-0">Max:</span>
                    <input type="number" min="1" max="100" value={item.maxMark} onChange={(e) => handleEditItem(item.id, "maxMark", e.target.value)} aria-label="Maximum marks" className={`${FIELD_INPUT} min-w-0 text-center`} />
                  </div>
                  <div className="flex-1 flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-zinc-400 shrink-0">Wt:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={item.weightagePercent}
                      onChange={(e) => handleEditItem(item.id, "weightagePercent", e.target.value)}
                      disabled={freeze.frozen}
                      aria-label="Weightage percent"
                      aria-disabled={freeze.frozen}
                      className={`${FIELD_INPUT} min-w-0 text-center ${freeze.frozen ? "opacity-60 cursor-not-allowed" : ""}`}
                    />
                    {freeze.frozen ? (
                      <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" aria-label="Weightage frozen" />
                    ) : null}
                    <span className="text-xs font-bold text-zinc-400 shrink-0">%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {remaining > 0 ? (
          <button onClick={handleAddItem} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 text-xs font-black transition-all cursor-pointer">
            <Plus className="w-4 h-4" />
            Add Assessment ({remaining.toFixed(1)} wt open)
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs font-black">
            <Lock className="w-3.5 h-3.5" />
            No weightage left — published facts and the reserved FAT hold {frozenWeight.toFixed(1)}%
          </div>
        )}
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
        <button onClick={handleSave} className="w-full flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs cursor-pointer active:scale-95">
          <Save className="w-4 h-4" />
          Apply Regimen
        </button>
      </div>
      </div>
    </BottomSheet>
  );
}
