import { getOp, allOps } from "./operation-registry";
import { ALL_BULK_ENDPOINTS } from "./operations";

/**
 * Named sync modes: ordered op lists the user can switch between, plus their
 * own custom creations.
 *
 * This module is deliberately engine-free (no import of `./index`): it is pure
 * data + validation + localStorage persistence, so it is importable from
 * components, tests, and the engine itself without a dependency cycle. The
 * runner lives on `SyncEngine.syncMode` in `./index`.
 */

export interface SyncModeStep {
  /** Registered op name, e.g. `"attendanceMarks"` or `"grades"`. */
  op: string;
  /** Extra args merged over the base args the run was started with. */
  args?: Record<string, unknown>;
  /** Background steps run concurrently after the foreground chain settles. */
  background?: boolean;
  /**
   * Staleness window in days. The runner skips this step when the op's last
   * success is younger than the window, unless the run was forced. Built-in
   * tiers use it to encode their cadence; custom steps may set it too.
   */
  every?: number;
}

export interface SyncMode {
  id: string;
  label: string;
  description: string;
  builtIn: boolean;
  steps: SyncModeStep[];
}

export const CUSTOM_MODES_KEY = "sync_custom_modes_v1";
export const MAX_MODE_STEPS = 20;

const step = (op: string, extra?: Partial<SyncModeStep>): SyncModeStep => ({
  op,
  ...extra,
});

/**
 * Tiered sync presets.
 *
 * Everyday data is split into four cumulative tiers by how often VTOP actually
 * changes: `daily` for what moves class-period to class-period, `quarterly`
 * for identity/profile data that is effectively static. Each deeper tier
 * includes every shallower one — the `steps` lists below are built on top of
 * each other deliberately.
 *
 * Every `every` on a step is a staleness window in days: the runner skips the
 * step when it last succeeded within the window (unless `args.force`). An
 * explicit pick of a tier therefore only pays for what is actually stale.
 */
export interface CadenceTierMeta {
  id: "daily" | "weekly" | "monthly" | "quarterly";
  label: string;
  cadence: string;
  description: string;
}

const DAILY_STEPS: SyncModeStep[] = [
  step("attendanceMarks"),
  step("marksStats", { background: true }),
  step("hostel", { background: true }),
];

const WEEKLY_STEPS: SyncModeStep[] = [
  ...DAILY_STEPS,
  step("ffcs", { background: true, every: 7 }),
  step("coursePage", { background: true, every: 7 }),
];

const MONTHLY_STEPS: SyncModeStep[] = [
  step("attendanceMarks"),
  step("marksStats", { background: true }),
  step("hostel", { background: true }),
  step("ffcs", { background: true, every: 7 }),
  step("coursePage", { background: true, every: 7 }),
  step("grades", { every: 30 }),
  step("all-grades", { every: 30 }),
  step("calendar", { every: 30 }),
  step("bulk", { background: true, every: 30 }),
  step("transport", { background: true, every: 30 }),
  step("events", { background: true, every: 30 }),
  step("buses", { background: true, every: 30 }),
  step("lms", { background: true, every: 30 }),
  step("circulars", { background: true, every: 30 }),
  step("officialOd", { background: true, every: 30 }),
  step("curriculum", { background: true, every: 30 }),
  step("fresher", { background: true, every: 30 }),
  step("pastAttendance", { background: true, every: 30 }),
  step("social", { background: true, every: 30 }),
];

const QUARTERLY_STEPS: SyncModeStep[] = [
  step("attendanceMarks"),
  step("marksStats", { background: true }),
  step("hostel", { background: true }),
  step("ffcs", { background: true, every: 7 }),
  step("coursePage", { background: true, every: 7 }),
  step("grades", { every: 30 }),
  step("all-grades", { every: 30 }),
  step("calendar", { every: 30 }),
  step("bulk", { background: true, every: 30 }),
  step("transport", { background: true, every: 30 }),
  step("events", { background: true, every: 30 }),
  step("buses", { background: true, every: 30 }),
  step("lms", { background: true, every: 30 }),
  step("circulars", { background: true, every: 30 }),
  step("officialOd", { background: true, every: 30 }),
  step("curriculum", { background: true, every: 30 }),
  step("fresher", { background: true, every: 30 }),
  step("pastAttendance", { background: true, every: 30 }),
  step("social", { background: true, every: 30 }),
  step("whoami", { every: 90 }),
];

/** The four built-in tiers, shallow to deep. */
export const BUILT_IN_TIERS: readonly CadenceTierMeta[] = [
  {
    id: "daily",
    label: "Daily Sync",
    cadence: "Every day",
    description: "Attendance and marks — the per-class check, hostellers' hostel folded in.",
  },
  {
    id: "weekly",
    label: "Weekly Sync",
    cadence: "Once a week",
    description: "Daily + FFCS (exam schedule, feedback, wishlist, QCM) and course-page details.",
  },
  {
    id: "monthly",
    label: "Monthly Sync",
    cadence: "Once a month",
    description: "Weekly + curriculum, calendar, finance, transport, grades and the rest.",
  },
  {
    id: "quarterly",
    label: "Quarterly Sync",
    cadence: "Every 3 months",
    description: "Monthly + identity & profile (whoami). Everything the app can pull.",
  },
];

export const BUILT_IN_MODES: SyncMode[] = [
  {
    id: "daily",
    label: "Daily Sync",
    description: "Attendance and marks — the per-class check, hostellers' hostel folded in.",
    builtIn: true,
    steps: DAILY_STEPS,
  },
  {
    id: "weekly",
    label: "Weekly Sync",
    description: "Daily + FFCS (exam schedule, feedback, wishlist, QCM) and course-page details.",
    builtIn: true,
    steps: WEEKLY_STEPS,
  },
  {
    id: "monthly",
    label: "Monthly Sync",
    description: "Weekly + curriculum, calendar, finance, transport, grades and the rest.",
    builtIn: true,
    steps: MONTHLY_STEPS,
  },
  {
    id: "quarterly",
    label: "Quarterly Sync",
    description: "Monthly + identity & profile (whoami). Everything the app can pull.",
    builtIn: true,
    steps: QUARTERLY_STEPS,
  },
];

export const BUILT_IN_MODE_IDS = new Set(BUILT_IN_MODES.map((m) => m.id));

// ── Cadence overrides ────────────────────────────────────────────────────
/**
 * Per-op enable/disable for the built-in tiers, persisted by the cadence
 * guide. A `false` here means "never run this op from a tiered preset" —
 * the user explicitly turned it off. Shallow ops are always run.
 */
export const CADENCE_OVERRIDES_KEY = "sync_cadence_overrides_v1";

export function loadCadenceOverrides(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(CADENCE_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, v !== false]))
      : {};
  } catch {
    return {};
  }
}

export function setCadenceOverride(op: string, enabled: boolean): void {
  try {
    const overrides = loadCadenceOverrides();
    const next = { ...overrides, [op]: enabled };
    localStorage.setItem(CADENCE_OVERRIDES_KEY, JSON.stringify(next));
  } catch {
    /* persistence is best-effort */
  }
}

export function resetCadenceOverrides(): void {
  try {
    localStorage.removeItem(CADENCE_OVERRIDES_KEY);
  } catch {
    /* ignore */
  }
}

/** A built-in tier with the user's disabled ops removed. */
function applyCadenceOverrides(mode: SyncMode): SyncMode {
  const overrides = loadCadenceOverrides();
  const enabled = (op: string) => overrides[op] !== false;
  return { ...mode, steps: mode.steps.filter((s) => enabled(s.op)) };
}

/**
 * Every cache endpoint the `bulk` op can fetch, with the words the advanced
 * editor shows. The `bulk` op stays one step at runtime; the editor expands it
 * into these rows and collapses the selection back into `args.only`.
 */
export interface BulkEndpointMeta {
  endpoint: string;
  label: string;
  description: string;
}

export const BULK_ENDPOINT_META: BulkEndpointMeta[] = [
  { endpoint: "exc-registration", label: "EXC registration", description: "Extra-curricular registrations" },
  { endpoint: "course-completion", label: "Course completion", description: "Completed coursework records" },
  { endpoint: "registration-schedule", label: "Registration schedule", description: "Course registration windows" },
  { endpoint: "library-due", label: "Library dues", description: "Borrowed books and fines" },
  { endpoint: "hostel-counselling", label: "Hostel counselling", description: "Counselling sessions" },
  { endpoint: "payments", label: "Payments & dues", description: "Fee dues" },
  { endpoint: "payment-receipts", label: "Payment receipts", description: "Paid fee receipts" },
  { endpoint: "wallet", label: "Wallet", description: "Campus wallet balance" },
];

/** Endpoints the engine actually knows, for validating editor selections. */
export const KNOWN_BULK_ENDPOINTS: ReadonlySet<string> = new Set([
  ...ALL_BULK_ENDPOINTS,
  ...BULK_ENDPOINT_META.map((m) => m.endpoint),
]);

/**
 * Split a mode's steps for the advanced editor: bulk steps expand into their
 * endpoint selections, everything else stays as-is. Returns the non-bulk
 * steps, the selected endpoints, and where the first bulk step sat (so saving
 * collapses back to the same position).
 */
export function expandBulkSteps(steps: SyncModeStep[]): {
  steps: SyncModeStep[];
  bulkEndpoints: string[];
  bulkPos: number;
} {
  const rest: SyncModeStep[] = [];
  let bulkEndpoints: string[] | null = null;
  let bulkPos = -1;
  steps.forEach((s) => {
    if (s.op !== "bulk") {
      rest.push({ ...s });
      return;
    }
    if (bulkPos === -1) bulkPos = rest.length;
    const only = (s.args?.only as string[] | undefined)?.filter((e) => KNOWN_BULK_ENDPOINTS.has(e));
    if (!only || only.length === 0) {
      bulkEndpoints = [...BULK_ENDPOINT_META.map((m) => m.endpoint)];
    } else if (bulkEndpoints) {
      for (const e of only) if (!bulkEndpoints.includes(e)) bulkEndpoints.push(e);
    } else {
      bulkEndpoints = [...only];
    }
  });
  return { steps: rest, bulkEndpoints: bulkEndpoints ?? [], bulkPos };
}

/**
 * Collapse editor selections back into steps: at most one `bulk` step carrying
 * `only`, omitted entirely when nothing is selected. A full house saves as a
 * bare `{ op: "bulk" }` so future endpoints join automatically.
 */
export function collapseBulkSteps(steps: SyncModeStep[], bulkEndpoints: string[], bulkPos: number): SyncModeStep[] {
  const known = bulkEndpoints.filter((e) => KNOWN_BULK_ENDPOINTS.has(e));
  const out = steps.filter((s) => s.op !== "bulk").map((s) => ({ ...s }));
  if (known.length === 0) return out;
  const all = BULK_ENDPOINT_META.map((m) => m.endpoint);
  const bulkStep: SyncModeStep =
    known.length >= all.length && all.every((e) => known.includes(e))
      ? { op: "bulk" }
      : { op: "bulk", args: { only: [...known] } };
  const at = bulkPos >= 0 ? Math.min(bulkPos, out.length) : out.length;
  out.splice(at, 0, bulkStep);
  return out;
}

export interface ModeValidation {
  ok: boolean;
  errors: string[];
}

/**
 * Validate a mode shape. `knownOpNames` defaults to the live registry; tests
 * pass an explicit list so they do not depend on the registration side effect.
 */
export function validateMode(
  mode: Partial<SyncMode> | null | undefined,
  knownOpNames?: Iterable<string>,
): ModeValidation {
  const errors: string[] = [];
  if (!mode || typeof mode !== "object") return { ok: false, errors: ["Mode is not an object"] };
  if (!mode.id || typeof mode.id !== "string") errors.push("Mode needs an id");
  if (!mode.label || typeof mode.label !== "string" || mode.label.trim().length === 0) {
    errors.push("Mode needs a label");
  }
  if (!Array.isArray(mode.steps) || mode.steps.length === 0) {
    errors.push("Mode needs at least one op");
  } else if (mode.steps.length > MAX_MODE_STEPS) {
    errors.push(`Mode has more than ${MAX_MODE_STEPS} steps`);
  } else {
    // Default to the live registry so built-ins and customs validate against
    // whatever operations.ts registered. Tests pass an explicit list to avoid
    // depending on that import side effect.
    const names: Set<string> = knownOpNames ? new Set(knownOpNames) : new Set(allOps().map((o) => o.name));
    // Registry empty (operations.ts not imported in this bundle yet): fall
    // back to per-step getOp so valid modes are not all rejected at once.
    const useGetOp = !knownOpNames && names.size === 0;
    mode.steps.forEach((s, i) => {
      if (!s || typeof s.op !== "string" || s.op.length === 0) {
        errors.push(`Step ${i + 1} has no op`);
        return;
      }
      const knownOk = useGetOp ? !!getOp(s.op) : names.has(s.op);
      if (!knownOk) errors.push(`Unknown op: ${s.op}`);
    });
  }
  return { ok: errors.length === 0, errors };
}

/** Built-in or custom mode by id. Customs override nothing — ids must differ. */
export function resolveMode(id: string, customModes: SyncMode[] = []): SyncMode | undefined {
  const found = customModes.find((m) => m.id === id) ?? BUILT_IN_MODES.find((m) => m.id === id);
  if (!found) return undefined;
  return found.builtIn ? applyCadenceOverrides(found) : found;
}

/**
 * Which mode an open/reload runs when the user may have switched semester.
 *
 * A semester change invalidates every cached module — attendance, marks and
 * grades are all keyed to the term just left — so a switch forces the deepest
 * tier, whatever the caller asked for. Everything else keeps the explicit
 * mode, then the user's default, then the auto sweep (everything that is
 * due, cadence-pruned).
 */
export function resolveReloadModeId(opts: {
  switchedSemester: boolean;
  modeId?: string;
  defaultSyncMode?: string;
}): string {
  if (opts.switchedSemester) return "quarterly";
  return opts.modeId ?? opts.defaultSyncMode ?? "quarterly";
}

export function listModes(customModes: SyncMode[] = []): SyncMode[] {
  return [...BUILT_IN_MODES.map(applyCadenceOverrides), ...customModes];
}

export function foregroundSteps(mode: SyncMode): SyncModeStep[] {
  return mode.steps.filter((s) => !s.background);
}

export function backgroundSteps(mode: SyncMode): SyncModeStep[] {
  return mode.steps.filter((s) => s.background);
}

function readStorage(): unknown {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(CUSTOM_MODES_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Load customs, dropping anything that no longer validates. */
export function loadCustomModes(): SyncMode[] {
  const raw = readStorage();
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (m): m is SyncMode =>
      !!m &&
      typeof m === "object" &&
      typeof (m as SyncMode).id === "string" &&
      !BUILT_IN_MODE_IDS.has((m as SyncMode).id) &&
      validateMode(m as SyncMode).ok,
  );
}

function writeStorage(modes: SyncMode[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(CUSTOM_MODES_KEY, JSON.stringify(modes));
  } catch {
    /* persistence is best-effort */
  }
}

function slug(label: string): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "custom";
  return `custom-${base}-${Date.now().toString(36)}`;
}

export interface CustomModeInput {
  label: string;
  description?: string;
  steps: SyncModeStep[];
}

export function createCustomMode(input: CustomModeInput): SyncMode {
  const mode: SyncMode = {
    id: slug(input.label),
    label: input.label.trim(),
    description: input.description?.trim() || "Custom sync mode.",
    builtIn: false,
    steps: input.steps,
  };
  const v = validateMode(mode);
  if (!v.ok) throw new Error(`Invalid sync mode: ${v.errors.join("; ")}`);
  const next = [...loadCustomModes(), mode];
  writeStorage(next);
  return mode;
}

export function updateCustomMode(
  id: string,
  patch: Partial<Pick<SyncMode, "label" | "description" | "steps">>,
): SyncMode {
  const modes = loadCustomModes();
  const idx = modes.findIndex((m) => m.id === id);
  if (idx === -1) throw new Error(`Unknown custom sync mode: ${id}`);
  const next: SyncMode = {
    ...modes[idx],
    ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.steps !== undefined ? { steps: patch.steps } : {}),
    builtIn: false,
  };
  const v = validateMode(next);
  if (!v.ok) throw new Error(`Invalid sync mode: ${v.errors.join("; ")}`);
  modes[idx] = next;
  writeStorage(modes);
  return next;
}

export function deleteCustomMode(id: string): void {
  writeStorage(loadCustomModes().filter((m) => m.id !== id));
}

export function duplicateMode(source: SyncMode, label?: string): SyncMode {
  return createCustomMode({
    label: label || `${source.label} (copy)`,
    description: source.description,
    steps: source.steps.map((s) => ({ ...s, args: s.args ? { ...s.args } : undefined })),
  });
}

/** Rough network weight for picker badges: ⚡ light / 🔄 standard / 📦 heavy. */
export function estimateModeCost(mode: SyncMode): { score: number; label: string } {
  const score = mode.steps.length + mode.steps.filter((s) => !s.background).length;
  if (score <= 3) return { score, label: "⚡ Light" };
  if (score <= 10) return { score, label: "🔄 Standard" };
  return { score, label: "📦 Heavy" };
}
