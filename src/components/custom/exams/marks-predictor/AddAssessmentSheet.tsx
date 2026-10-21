"use client";

import React, { useState } from "react";
import { Plus } from "lucide-react";
import BottomSheet from "../../shared/BottomSheet";
import { ToneBadge } from "../../shared/primitives";

const FIELD =
  "w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-sm font-bold text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500";

/**
 * The add-an-assessment sheet.
 *
 * A new assessment can only claim what the component has left: published
 * weightages are facts and the final exam's 40% is reserved, so the remaining
 * share arrives precomputed and the form refuses to overbook it. The row lands
 * pending with no marks — the what-if mark comes later through the row.
 */
export default function AddAssessmentSheet({
  component,
  remaining,
  onAdd,
  onClose,
}: {
  component: "theory" | "lab";
  /** Weight still claimable in this component. */
  remaining: number;
  onAdd: (assessment: {
    title: string;
    maxMark: number;
    weightagePercent: number;
    component: "theory" | "lab";
  }) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [maxMark, setMaxMark] = useState("100");
  const [weight, setWeight] = useState(
    remaining > 0 ? String(Math.min(remaining, Math.max(10, 0))) : "0"
  );

  const maxMarkNum = Math.max(1, Number(maxMark) || 1);
  const weightNum = Number(weight) || 0;
  const weightValid = weightNum > 0 && weightNum <= remaining + 1e-9;
  const titleValid = title.trim().length > 0;
  const valid = titleValid && weightValid;

  const componentLabel = component === "theory" ? "Theory" : "Lab";

  return (
    <BottomSheet
      onClose={onClose}
      overlayId={`predictor-add-${component}`}
      maxWidth="max-w-md"
      avoidKeyboard
      title={`Add ${componentLabel} assessment`}
      subtitle={
        <>
          Published weightages are frozen facts, and the FAT holds 40% of the
          {componentLabel === "Theory" ? " theory" : " lab"} total — the rest is what a new
          assessment may claim.
        </>
      }
      trailing={
        <ToneBadge tone={remaining > 0 ? "emerald" : "red"}>
          {remaining.toFixed(1)} wt left
        </ToneBadge>
      }
      closeLabel="Close add assessment"
    >
      <div className="space-y-4 pb-2">
        {/* Fields */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="add-title" className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Name
            </label>
            <input
              id="add-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Quiz 2 · Assignment · Final"
              className={FIELD}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-max" className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Maximum marks
            </label>
            <input
              id="add-max"
              type="number"
              inputMode="decimal"
              min={1}
              max={500}
              value={maxMark}
              onChange={(e) => setMaxMark(e.target.value)}
              className={`${FIELD} w-28`}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="add-weight" className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
              Weightage (% of component)
            </label>
            <input
              id="add-weight"
              type="number"
              inputMode="decimal"
              min={0}
              max={remaining}
              step="0.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className={`${FIELD} w-28`}
            />
            {!weightValid && weight !== "" ? (
              <p className="text-[11px] font-bold text-red-500">
                Only {remaining.toFixed(1)} wt is still open in {componentLabel.toLowerCase()}.
              </p>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <button
          type="button"
          disabled={!valid}
          onClick={() => {
            if (!valid) return;
            onAdd({
              title: title.trim(),
              maxMark: maxMarkNum,
              weightagePercent: weightNum,
              component,
            });
            onClose();
          }}
          className={`w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black active:scale-95 transition-all ${
            valid
              ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
              : "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
          }`}
        >
          <Plus className="w-4 h-4" />
          Add assessment
        </button>
      </div>
    </BottomSheet>
  );
}
