"use client";

import { useState } from "react";
import { MANUAL_MEAN_RANGE, MANUAL_SD_RANGE, manualClassStats, type ClassStats } from "@/lib/gradeBoundaries";
import { FIELD_INPUT } from "@/lib/uiTokens";

/**
 * "What if the class averages 62 with σ 11?" — the reader's own curve.
 *
 * A curve built from a handful of synced classmates is a rough guess, and
 * seniors or the faculty often know last term's numbers better. This lets the
 * reader type a mean and σ for one course; the predictor then grades against
 * exactly those (no pooling, no early-estimate flag) until they switch back to
 * class data. Saved per course with the rest of its what-ifs.
 */
export default function ClassCurveEditor({
  synced,
  override,
  onChange,
}: {
  /** The synced class statistics, used to prefill the fields. */
  synced: ClassStats | null;
  /** The reader's current override, if any. */
  override: { mean: number; sd: number } | null;
  /** Set a new override, or null to go back to the synced statistics. */
  onChange: (next: { mean: number; sd: number } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const start = override ?? (synced && synced.count > 0 ? { mean: synced.mean, sd: synced.sd } : { mean: 60, sd: 12 });
  const [meanText, setMeanText] = useState(String(round1(start.mean)));
  const [sdText, setSdText] = useState(String(round1(start.sd)));

  const candidate = { mean: Number(meanText), sd: Number(sdText) };
  const valid = meanText.trim() !== "" && sdText.trim() !== "" && manualClassStats(candidate) !== null;

  const apply = () => {
    if (!valid) return;
    onChange(candidate);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="cursor-pointer text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {override ? "Edit your μ and σ" : "Use your own μ and σ"}
        </button>
        {override ? (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setOpen(false);
            }}
            className="cursor-pointer text-[11px] font-bold text-text-secondary dark:text-text-muted hover:underline"
          >
            {synced && synced.count > 0 ? "Back to class data" : "Clear"}
          </button>
        ) : null}
      </div>

      {open ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Mean μ</span>
            <input
              type="number"
              inputMode="decimal"
              min={MANUAL_MEAN_RANGE[0]}
              max={MANUAL_MEAN_RANGE[1]}
              step="0.1"
              value={meanText}
              onChange={(e) => setMeanText(e.target.value)}
              aria-label="Class mean"
              className={`${FIELD_INPUT} w-20 text-center`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Std dev σ</span>
            <input
              type="number"
              inputMode="decimal"
              min={MANUAL_SD_RANGE[0]}
              max={MANUAL_SD_RANGE[1]}
              step="0.1"
              value={sdText}
              onChange={(e) => setSdText(e.target.value)}
              aria-label="Class standard deviation"
              className={`${FIELD_INPUT} w-20 text-center`}
            />
          </label>
          <button
            type="submit"
            disabled={!valid}
            className="cursor-pointer h-9 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply
          </button>
          {!valid ? (
            <p className="basis-full text-[11px] font-medium text-amber-700 dark:text-amber-400">
              μ between {MANUAL_MEAN_RANGE[0]} and {MANUAL_MEAN_RANGE[1]}, σ between {MANUAL_SD_RANGE[0]} and{" "}
              {MANUAL_SD_RANGE[1]}.
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

const round1 = (x: number) => Math.round(x * 10) / 10;
