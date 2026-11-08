"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Pencil, Play, Plus, Star, Trash2, X } from "lucide-react";
import BottomSheet from "./BottomSheet";
import { Switch } from "./primitives";
import { FIELD_INPUT } from "@/lib/uiTokens";
import { listOpMeta, type SyncOpCategory } from "@/lib/sync-engine/operation-registry";
import { getOpLabel } from "@/lib/sync-engine/sync-session";
import {
  BULK_ENDPOINT_META,
  BUILT_IN_MODES,
  collapseBulkSteps,
  createCustomMode,
  deleteCustomMode,
  duplicateMode,
  estimateModeCost,
  expandBulkSteps,
  loadCustomModes,
  updateCustomMode,
  validateMode,
  type SyncMode,
  type SyncModeStep,
} from "@/lib/sync-engine/sync-modes";

const CATEGORY_LABEL: Record<SyncOpCategory, string> = {
  academics: "Academics",
  stay: "Stay & Transport",
  campus: "Campus Life",
  profile: "Profile & Records",
};

const COST_CHIP: Record<string, string> = {
  light: "bg-ok-soft text-ok",
  medium: "bg-accent-soft text-accent",
  heavy: "bg-warn-soft text-warn",
};

const AUTH_BADGE: Record<string, string> = {
  vtop: "bg-course-3/10 text-course-3",
  eventhub: "bg-course-1/10 text-course-1",
  none: "bg-zinc-500/10 text-muted",
};

const AUTH_LABEL: Record<string, string> = {
  vtop: "VTOP",
  eventhub: "HUB",
  none: "OPEN",
};

interface Draft {
  id: string | null;
  label: string;
  description: string;
  steps: SyncModeStep[];
  /** Selected `bulk` cache endpoints; collapses to one bulk step on save. */
  bulkSel: string[];
  bulkBg: boolean;
  bulkPos: number;
}

export interface SyncModeEditorContentProps {
  /** Fired after any create/update/delete/duplicate with the fresh customs. */
  onChanged?: (modes: SyncMode[]) => void;
  /** Optional: run a mode immediately. */
  onRun?: (modeId: string) => void;
  /** Currently-default mode id; starred in the lists. */
  defaultId?: string;
  /** Set a mode as default without running it. */
  onSetDefault?: (modeId: string) => void;
}

/**
 * The full editor UI without any overlay chrome, so the settings page can
 * render it inline while the sheet wrapper stays for modal use.
 */
export function SyncModeEditorContent({ onChanged, onRun, defaultId, onSetDefault }: SyncModeEditorContentProps) {
  const [customs, setCustoms] = useState<SyncMode[]>(() => loadCustomModes());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const ops = useMemo(() => {
    try {
      // `bulk` is expanded into its endpoints below, so the single row hides.
      return listOpMeta().filter((o) => o.name !== "bulk");
    } catch {
      return [];
    }
  }, []);

  const endpointQuery = query.trim().toLowerCase();
  const visibleEndpoints = useMemo(
    () =>
      !endpointQuery
        ? BULK_ENDPOINT_META
        : BULK_ENDPOINT_META.filter(
            (m) =>
              m.label.toLowerCase().includes(endpointQuery) ||
              m.endpoint.toLowerCase().includes(endpointQuery) ||
              m.description.toLowerCase().includes(endpointQuery),
          ),
    [endpointQuery],
  );

  const grouped = useMemo(() => {
    const list = !endpointQuery
      ? ops
      : ops.filter(
          (o) =>
            o.label.toLowerCase().includes(endpointQuery) ||
            o.name.toLowerCase().includes(endpointQuery) ||
            o.description.toLowerCase().includes(endpointQuery),
        );
    const groups = new Map<SyncOpCategory, typeof list>();
    for (const o of list) {
      const g = groups.get(o.category) ?? [];
      g.push(o);
      groups.set(o.category, g);
    }
    return [...groups.entries()];
  }, [ops, endpointQuery]);

  const refresh = () => {
    const next = loadCustomModes();
    setCustoms(next);
    onChanged?.(next);
  };

  const startCreate = () => {
    setError(null);
    setDraft({
      id: null,
      label: "",
      description: "",
      steps: [{ op: "attendanceMarks" }],
      bulkSel: [],
      bulkBg: true,
      bulkPos: -1,
    });
  };

  const startEdit = (m: SyncMode) => {
    setError(null);
    const expanded = expandBulkSteps(m.steps);
    const firstBulk = m.steps.find((s) => s.op === "bulk");
    setDraft({
      id: m.id,
      label: m.label,
      description: m.description,
      steps: expanded.steps,
      bulkSel: expanded.bulkEndpoints,
      bulkBg: !!firstBulk?.background,
      bulkPos: expanded.bulkPos,
    });
  };

  const saveDraft = () => {
    if (!draft) return;
    const steps = collapseBulkSteps(draft.steps, draft.bulkSel, draft.bulkPos).map((s) =>
      s.op === "bulk" ? { ...s, background: draft.bulkBg || undefined } : s,
    );
    const candidate = {
      id: draft.id ?? "new",
      label: draft.label.trim(),
      description: draft.description.trim(),
      builtIn: false as const,
      steps,
    };
    // Validate against the live op list so typos fail here, not at sync time.
    const v = validateMode(candidate, [...ops.map((o) => o.name), "bulk"]);
    if (!v.ok) {
      setError(v.errors[0] ?? "Invalid mode");
      return;
    }
    try {
      if (draft.id) {
        updateCustomMode(draft.id, {
          label: candidate.label,
          description: candidate.description,
          steps: candidate.steps,
        });
      } else {
        createCustomMode({
          label: candidate.label,
          description: candidate.description,
          steps: candidate.steps,
        });
      }
      setDraft(null);
      setError(null);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save mode");
    }
  };

  const toggleStepOp = (op: string) => {
    if (!draft) return;
    setDraft((d) => {
      if (!d) return d;
      const has = d.steps.some((s) => s.op === op);
      return {
        ...d,
        steps: has ? d.steps.filter((s) => s.op !== op) : [...d.steps, { op }],
      };
    });
  };

  const toggleEndpoint = (endpoint: string) => {
    if (!draft) return;
    setDraft((d) => {
      if (!d) return d;
      const has = d.bulkSel.includes(endpoint);
      const bulkSel = has ? d.bulkSel.filter((e) => e !== endpoint) : [...d.bulkSel, endpoint];
      // First endpoint picked lands the bulk step at the end of the order.
      const bulkPos = d.bulkPos >= 0 || bulkSel.length === 0 ? d.bulkPos : d.steps.length;
      return { ...d, bulkSel, bulkPos };
    });
  };

  const selectAllEndpoints = () => {
    if (!draft) return;
    setDraft((d) =>
      d
        ? {
            ...d,
            bulkSel: BULK_ENDPOINT_META.map((m) => m.endpoint),
            bulkPos: d.bulkPos >= 0 ? d.bulkPos : d.steps.length,
          }
        : d,
    );
  };

  const clearEndpoints = () => {
    if (!draft) return;
    setDraft((d) => (d ? { ...d, bulkSel: [], bulkPos: -1 } : d));
  };

  // Combined order list: op steps with the bulk pseudo-row at its position.
  const ordered: Array<{ key: string; kind: "op" | "bulk"; step?: SyncModeStep }> = (() => {
    if (!draft) return [];
    const rows: Array<{ key: string; kind: "op" | "bulk"; step?: SyncModeStep }> = draft.steps.map((s, i) => ({
      key: `${s.op}-${i}`,
      kind: "op",
      step: s,
    }));
    if (draft.bulkSel.length > 0) {
      const at = draft.bulkPos >= 0 ? Math.min(draft.bulkPos, rows.length) : rows.length;
      rows.splice(at, 0, { key: "__bulk", kind: "bulk" as const });
    }
    return rows;
  })();

  const moveRow = (idx: number, dir: -1 | 1) => {
    if (!draft) return;
    setDraft((d) => {
      if (!d) return d;
      const rows = [...ordered];
      const j = idx + dir;
      if (j < 0 || j >= rows.length) return d;
      [rows[idx], rows[j]] = [rows[j], rows[idx]];
      return {
        ...d,
        steps: rows.filter((r) => r.kind === "op").map((r) => r.step!),
        bulkPos: rows.findIndex((r) => r.kind === "bulk"),
      };
    });
  };

  const setStepBackground = (opIndex: number, background: boolean) => {
    if (!draft) return;
    setDraft((d) => {
      if (!d) return d;
      // opIndex counts op rows only, skipping the bulk pseudo-row.
      let seen = -1;
      const steps = d.steps.map((s) => {
        seen += 1;
        return seen === opIndex ? { ...s, background } : s;
      });
      return { ...d, steps };
    });
  };

  const stepSet = new Set(draft?.steps.map((s) => s.op) ?? []);
  const bulkSet = new Set(draft?.bulkSel ?? []);

  const starButton = (m: SyncMode) => {
    if (!onSetDefault) return null;
    const isDefault = defaultId === m.id;
    return (
      <button
        onClick={() => onSetDefault(m.id)}
        className={`p-1.5 rounded-lg cursor-pointer ${
          isDefault ? "text-warn" : "text-slate-300 dark:text-zinc-600 hover:text-warn"
        }`}
        title={isDefault ? "Default sync mode" : "Set as default"}
      >
        <Star size={13} fill={isDefault ? "currentColor" : "none"} />
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex justify-end">
        <button
          onClick={startCreate}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm bg-accent hover:bg-accent/90 text-background text-[11px] font-medium transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Plus size={12} /> New
        </button>
      </div>

      {draft ? (
        <div className="flex flex-col gap-3">
          <input
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            placeholder="Mode name — e.g. Exam week"
            className={FIELD_INPUT}
            maxLength={40}
          />
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="What is this for? (optional)"
            className={FIELD_INPUT}
            maxLength={120}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules and endpoints…"
            className={FIELD_INPUT}
          />
          <div className="max-h-[220px] overflow-y-auto space-y-3 pr-0.5">
            {grouped.map(([cat, list]) => (
              <div key={cat}>
                <p className="text-[11px] font-semibold text-slate-400 dark:text-gray-500 mb-1">
                  {CATEGORY_LABEL[cat]}
                </p>
                <div className="space-y-1">
                  {list.map((o) => {
                    const checked = stepSet.has(o.name);
                    return (
                      <button
                        key={o.name}
                        onClick={() => toggleStepOp(o.name)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition-colors cursor-pointer ${
                          checked
                            ? "bg-accent-soft border-accent/30"
                            : "bg-surface-2 border-slate-200 dark:border-zinc-800"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 text-[11px] font-semibold ${
                            checked
                              ? "bg-accent border-accent/40 text-background"
                              : "border-slate-300 dark:border-zinc-700 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 truncate">
                              {o.label}
                            </span>
                            <code className="text-[11px] font-mono px-1 py-px rounded bg-slate-200/70 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 shrink-0">
                              {o.name}
                            </code>
                            <span
                              className={`text-[11px] font-semibold px-1 py-px rounded shrink-0 ${AUTH_BADGE[o.auth]}`}
                            >
                              {AUTH_LABEL[o.auth]}
                            </span>
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-gray-500 truncate">
                            {o.description}
                          </span>
                        </span>
                        <span
                          className={`text-[11px] font-semibold tracking-wide px-1.5 py-0.5 rounded-md shrink-0 ${COST_CHIP[o.cost]}`}
                        >
                          {o.cost}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {visibleEndpoints.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold text-slate-400 dark:text-gray-500">
                    Additional records · bulk endpoints ({bulkSet.size}/{BULK_ENDPOINT_META.length})
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={selectAllEndpoints}
                      className="text-[11px] font-semibold text-accent hover:underline cursor-pointer"
                    >
                      All
                    </button>
                    <button
                      onClick={clearEndpoints}
                      className="text-[11px] font-semibold text-slate-400 hover:underline cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {visibleEndpoints.map((m) => {
                    const checked = bulkSet.has(m.endpoint);
                    return (
                      <button
                        key={m.endpoint}
                        onClick={() => toggleEndpoint(m.endpoint)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md border text-left transition-colors cursor-pointer ${
                          checked
                            ? "bg-course-3/10 border-course-3/30"
                            : "bg-surface-2 border-slate-200 dark:border-zinc-800"
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 text-[11px] font-semibold ${
                            checked
                              ? "bg-course-3 border-course-3/40 text-white"
                              : "border-slate-300 dark:border-zinc-700 text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 truncate">
                              {m.label}
                            </span>
                            <code className="text-[11px] font-mono px-1 py-px rounded bg-slate-200/70 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 shrink-0">
                              bulk:{m.endpoint}
                            </code>
                          </span>
                          <span className="block text-[11px] text-slate-500 dark:text-gray-500 truncate">
                            {m.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {ordered.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-gray-500 mb-1">
                Order & background ({ordered.length} steps ·{" "}
                {
                  estimateModeCost({
                    id: "",
                    label: "",
                    description: "",
                    builtIn: false,
                    steps: collapseBulkSteps(draft.steps, draft.bulkSel, draft.bulkPos),
                  }).label
                }
                )
              </p>
              <div className="space-y-1 max-h-[140px] overflow-y-auto">
                {ordered.map((row, i) =>
                  row.kind === "bulk" ? (
                    <div
                      key={row.key}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-course-3/10 border border-course-3/20"
                    >
                      <span className="text-[11px] font-semibold text-slate-400 w-4 shrink-0">{i + 1}</span>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 flex-1 truncate">
                        Additional records ({draft.bulkSel.length} endpoints)
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">bg</span>
                      <Switch checked={draft.bulkBg} onCheckedChange={(v) => setDraft({ ...draft, bulkBg: !!v })} />
                      <button
                        onClick={() => moveRow(i, -1)}
                        disabled={i === 0}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                        aria-label="Move up"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => moveRow(i, 1)}
                        disabled={i === ordered.length - 1}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                        aria-label="Move down"
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  ) : (
                    <div
                      key={row.key}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-surface-2 border border-slate-200 dark:border-zinc-800"
                    >
                      <span className="text-[11px] font-semibold text-slate-400 w-4 shrink-0">{i + 1}</span>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-300 flex-1 truncate">
                        {getOpLabel(row.step!.op)}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-400">bg</span>
                      <Switch
                        checked={!!row.step!.background}
                        onCheckedChange={(v) => {
                          // Index among op rows, skipping the bulk pseudo-row.
                          const opIndex = ordered.slice(0, i).filter((r) => r.kind === "op").length;
                          setStepBackground(opIndex, !!v);
                        }}
                      />
                      <button
                        onClick={() => moveRow(i, -1)}
                        disabled={i === 0}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                        aria-label="Move up"
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        onClick={() => moveRow(i, 1)}
                        disabled={i === ordered.length - 1}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 disabled:opacity-30 cursor-pointer"
                        aria-label="Move down"
                      >
                        <ArrowDown size={12} />
                      </button>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {error && <p className="text-[11px] font-semibold text-danger">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setDraft(null);
                setError(null);
              }}
              className="flex-1 py-2.5 rounded-md bg-surface-2 text-zinc-700 dark:text-zinc-200 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={saveDraft}
              className="flex-1 py-2.5 rounded-sm bg-accent hover:bg-accent/90 text-background text-xs font-medium cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {draft.id ? "Save" : "Create"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto">
          {customs.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-400 dark:text-gray-500 mb-1">
                Custom
              </p>
              <div className="space-y-1.5">
                {customs.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-md bg-indigo-500/5 border border-indigo-500/20"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 truncate">{m.label}</p>
                      <p className="text-[11px] text-slate-500 dark:text-gray-500 truncate">
                        {m.steps.length} ops · {estimateModeCost(m).label}
                      </p>
                    </div>
                    {starButton(m)}
                    {onRun && (
                      <button
                        onClick={() => onRun(m.id)}
                        className="p-1.5 rounded-lg text-ok hover:bg-ok-soft cursor-pointer"
                        title="Run now"
                      >
                        <Play size={13} />
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(m)}
                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-500/10 cursor-pointer"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => {
                        deleteCustomMode(m.id);
                        refresh();
                      }}
                      className="p-1.5 rounded-lg text-danger hover:bg-danger-soft cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-[11px] font-semibold text-slate-400 dark:text-gray-500 mb-1">
              Built-in
            </p>
            <div className="space-y-1.5">
              {BUILT_IN_MODES.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-1 px-2.5 py-2 rounded-md bg-surface-2 border border-slate-200 dark:border-zinc-800"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 truncate">{m.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-gray-500 truncate">
                      {m.description} · {m.steps.length} ops
                    </p>
                  </div>
                  {starButton(m)}
                  {onRun && (
                    <button
                      onClick={() => onRun(m.id)}
                      className="p-1.5 rounded-lg text-ok hover:bg-ok-soft cursor-pointer"
                      title="Run now"
                    >
                      <Play size={13} />
                    </button>
                  )}
                  <button
                    onClick={() => {
                      duplicateMode(m);
                      refresh();
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-500/10 cursor-pointer"
                    title="Duplicate as custom"
                  >
                    <Copy size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Create, edit, duplicate and delete custom sync modes. Rendered inside a
 * BottomSheet so it stacks with the sync sheet and settings pages.
 */
export default function SyncModeEditor({
  open,
  onClose,
  onChanged,
  onRun,
  defaultId,
  onSetDefault,
}: SyncModeEditorContentProps & {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="sync-mode-editor"
      maxWidth="max-w-md"
      title="Sync Modes"
      subtitle="Pick what a sync fetches. Star a mode to make it the default."
      closeLabel="Close sync mode editor"
    >
      <div className="relative">
        <SyncModeEditorContent onChanged={onChanged} onRun={onRun} defaultId={defaultId} onSetDefault={onSetDefault} />
      </div>
    </BottomSheet>
  );
}
