"use client";

import { useCallback, useMemo, useState } from "react";
import { Zap, CalendarRange, CalendarDays, CalendarClock, Layers, RotateCcw, type LucideIcon } from "lucide-react";
import {
  BUILT_IN_MODES,
  loadCadenceOverrides,
  setCadenceOverride,
  resetCadenceOverrides,
} from "@/lib/sync-engine/sync-modes";
import { getOpLabel } from "@/lib/sync-engine/sync-session";
import { getSyncTimes, formatSyncAge } from "@/lib/syncTimes";

const TIER_ICONS: Record<string, LucideIcon> = {
  daily: Zap,
  weekly: CalendarRange,
  monthly: CalendarDays,
  quarterly: CalendarClock,
};

const CADENCE_CHIP: Record<string, string> = {
  daily: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  weekly: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  monthly: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  quarterly: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

/**
 * The cadence guide: what each built-in sync tier pulls, when it is due, and
 * one switch per op to leave it out — e.g. drop Social or Events and the
 * tiered presets will skip them forever. Read top-to-bottom the tiers are
 * cumulative: quarterly runs everything above it.
 *
 * The staleness gate in the engine skips any op whose last success is inside
 * its cadence window, so an everyday app sweep costs almost nothing while
 * silently picking up whatever has come due.
 */
export default function SyncCadenceGuide() {
  const [overrides, setOverrides] = useState(() => loadCadenceOverrides());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [, forceRender] = useState(0);
  const times = getSyncTimes();

  const tiers = useMemo(() => BUILT_IN_MODES, []);

  const toggle = useCallback((tierId: string, op: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [op]: prev[op] === false };
      setCadenceOverride(op, next[op]);
      return next;
    });
    forceRender((n) => n + 1);
  }, []);

  const lastSynced = (op: string) => {
    const at = times[op];
    return typeof at === "number" ? formatSyncAge(at, Date.now()) : "never";
  };

  const anyDisabled = Object.values(overrides).some((v) => v === false);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="w-4 h-4 text-indigo-500 shrink-0" />
          <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white font-outfit truncate">
            What syncs, how often
          </h3>
        </div>
        {anyDisabled && (
          <button
            type="button"
            onClick={() => {
              resetCadenceOverrides();
              setOverrides({});
            }}
            className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer shrink-0"
            title="Re-enable every preset op"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
        Everything is cumulative. Windows below gate automatic/background sync — picking a tier manually (or a semester
        switch) runs it fully, now. Turning an op off removes it from every tier; it will not be fetched automatically
        again until you turn it back on.
      </p>

      <div className="space-y-2">
        {tiers.map((tier) => {
          const Icon = TIER_ICONS[tier.id] ?? CalendarDays;
          const open = expanded === tier.id;
          const disabledCount = tier.steps.filter((s) => overrides[s.op] === false).length;
          const due = lastSynced(tier.steps[0]?.op ?? "nope");
          return (
            <div
              key={tier.id}
              className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? null : tier.id)}
                aria-expanded={open}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left cursor-pointer hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/15">
                  <Icon className="w-4 h-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100 font-outfit">
                      {tier.label}
                    </span>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border shrink-0 ${CADENCE_CHIP[tier.id]}`}
                    >
                      {tier.id === "daily"
                        ? "Daily"
                        : tier.id === "weekly"
                          ? "Weekly"
                          : tier.id === "monthly"
                            ? "Monthly"
                            : "3 months"}
                    </span>
                    {disabledCount > 0 && (
                      <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                        {disabledCount} off
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-500 truncate mt-0.5">{tier.description}</p>
                </div>
                <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 shrink-0 tabular-nums">
                  {due === "never" ? "" : `synced ${due}`}
                </span>
              </button>

              {open && (
                <div className="border-t border-zinc-100 dark:border-zinc-800/80 px-3 py-2 space-y-1">
                  {tier.steps.map((step) => {
                    const enabled = overrides[step.op] !== false;
                    return (
                      <div
                        key={step.op}
                        role="group"
                        className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-zinc-100/70 dark:hover:bg-zinc-800/50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                            {getOpLabel(step.op)}
                          </p>
                          <p className="text-[9px] text-zinc-400 dark:text-zinc-500">
                            {step.every ? `every ${step.every}d` : "every run"} · synced {lastSynced(step.op)}
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={enabled}
                          aria-label={`${enabled ? "Disable" : "Enable"} ${getOpLabel(step.op)} in automatic syncs`}
                          onClick={(e) => {
                            e.preventDefault();
                            toggle(tier.id, step.op);
                          }}
                          className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer shrink-0 ${
                            enabled ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                              enabled ? "left-[18px]" : "left-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                  <p className="text-[9px] text-zinc-400 dark:text-zinc-500 pt-1">
                    Unchecking removes the op from <span className="font-bold">every</span> tier. Custom modes are
                    unaffected.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
