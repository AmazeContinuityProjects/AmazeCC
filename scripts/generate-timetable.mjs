/**
 * Generate every timetable projection from the canonical campus vocabulary.
 *
 *   node scripts/generate-timetable.mjs            # write generated files
 *   node scripts/generate-timetable.mjs --check    # fail if output is stale
 *
 * The canonical JSON in src/data/timetable/campuses/ is the ONLY source of
 * truth. config.json and src/data/campus/*.json are compatibility projections
 * emitted here; never hand-edit them.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..");
const CANON = path.join(ROOT, "src/data/timetable/campuses/chennai.json");
const OUT_TS = path.join(ROOT, "src/lib/generated/timetable.ts");
const OUT_SLOTMAP = path.join(ROOT, "src/lib/generated/slotMap.json");
const OUT_CAMPUS = path.join(ROOT, "src/lib/generated/campusSchema.json");
const CHECK = process.argv.includes("--check");

const fail = (msg) => {
  console.error(`[timetable] ${msg}`);
  process.exit(1);
};
const writeIfChanged = (file, content) => {
  const before = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (before === content) return false;
  if (CHECK) fail(`${path.relative(ROOT, file)} is stale — run pnpm timetable:generate`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
};

const canonical = JSON.parse(fs.readFileSync(CANON, "utf8"));

/* ── validation ─────────────────────────────────────────────────────────── */
function validate(t) {
  const errors = [];
  const check = (cond, msg) => {
    if (!cond) errors.push(msg);
  };
  check(t.schemaVersion === 1, "schemaVersion must be 1");
  check(typeof t.campusId === "string" && t.campusId.length > 0, "campusId required");

  const dayIds = new Set(t.days.map((d) => d.id));
  check(dayIds.size === t.days.length, "duplicate day id");
  const periodIds = new Set(t.periods.map((p) => p.id));
  check(periodIds.size === t.periods.length, "duplicate period id");
  const programmeIds = new Set(t.programmes.map((p) => p.id));
  check(programmeIds.size === t.programmes.length, "duplicate programme id");

  const slots = Object.values(t.slots);
  for (const s of slots) {
    check(s.key === `${s.day}:${s.token}`, `slot key mismatch: ${s.key}`);
    check(dayIds.has(s.day), `slot ${s.key}: unknown day ${s.day}`);
    check(periodIds.has(s.periodId), `slot ${s.key}: unknown period ${s.periodId}`);
    check(programmeIds.has(s.programme), `slot ${s.key}: unknown programme ${s.programme}`);
    check(s.endMin > s.startMin, `slot ${s.key}: non-positive span`);
    const p = t.periods.find((x) => x.id === s.periodId);
    check(Boolean(p?.slots[s.day]?.includes(s.token)), `period ${s.periodId} missing ${s.key}`);
  }
  for (const p of t.periods) {
    for (const [day, tokens] of Object.entries(p.slots)) {
      check(dayIds.has(day), `period ${p.id}: unknown day ${day}`);
      for (const token of tokens) {
        const s = t.slots[`${day}:${token}`];
        check(Boolean(s), `period ${p.id}: ${day}:${token} has no slot record`);
        check(s?.periodId === p.id, `period ${p.id}: ${day}:${token} points at ${s?.periodId}`);
      }
    }
    if (!p.lunch) check(p.endMin > p.startMin, `period ${p.id}: non-positive span`);
  }
  // Aliases must be unique per (day, system); two programmes cannot mint the
  // same alias token for the same day, or a VTOP cell becomes ambiguous.
  const aliasOwners = new Map();
  for (const s of slots)
    for (const a of s.aliases) {
      const k = `${s.day}:${a.system}:${a.token}`;
      check(!aliasOwners.has(k), `alias ${k} claimed by ${aliasOwners.get(k)} and ${s.key}`);
      aliasOwners.set(k, s.key);
    }
  // The whole point of the schema: at least one physical period has several
  // programme tokens. If this ever fails, the overlap model has been lost.
  const overlaps = Object.values(t.periods).flatMap((p) =>
    Object.entries(p.slots)
      .filter(([, tokens]) => tokens.length > 1)
      .map(([day, tokens]) => `${day}:${p.id}=${tokens.join("+")}`),
  );
  check(overlaps.length > 0, "no overlapping programme tokens found — overlap model lost");
  if (t.baseline) {
    check(slots.length === t.baseline.slotCount, `slot count drift: ${slots.length} != ${t.baseline.slotCount}`);
    check(t.periods.length === t.baseline.periodCount, `period count drift`);
  }
  if (errors.length) fail(`validation failed:\n  - ${errors.join("\n  - ")}`);
  return overlaps;
}
const overlaps = validate(canonical);

/* ── vocabulary version + canonical writeback ──────────────────────────── */
const { vocabularyVersion: _old, ...fingerprintInput } = canonical;
const vocabularyVersion = crypto
  .createHash("sha256")
  .update(JSON.stringify(fingerprintInput))
  .digest("hex")
  .slice(0, 16);
canonical.vocabularyVersion = vocabularyVersion;
const canonicalJson = JSON.stringify(canonical, null, 2) + "\n";
if (!CHECK && fs.readFileSync(CANON, "utf8") !== canonicalJson) fs.writeFileSync(CANON, canonicalJson);

/* ── projections ────────────────────────────────────────────────────────── */
const fmt = (mins) => {
  const h24 = Math.floor(mins / 60) % 24,
    mm = mins % 60;
  const suffix = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
};

// Flat projection for social / attendance / codec consumers. Every token is
// present, including tokens that share a period with another programme.
const flatSlotMap = {};
for (const day of canonical.days.map((d) => d.id)) {
  flatSlotMap[day] = {};
  for (const s of Object.values(canonical.slots).filter((x) => x.day === day && x.status === "active")) {
    flatSlotMap[day][s.token] = { time: s.time };
  }
}

// Legacy campus projection for FFCS / free-classroom / iCal consumers. Only
// campus-origin periods and their core/lab tokens, so this matches the old
// src/data/campus/chennai.json shape byte-for-shape.
const campusSchema = { theory: [], lab: [] };
for (const p of canonical.periods.filter((x) => x.origin === "campus")) {
  if (p.lunch) {
    (p.kind === "lab" ? campusSchema.lab : campusSchema.theory).push({ lunch: true });
    continue;
  }
  const days = {};
  for (const [day, tokens] of Object.entries(p.slots)) {
    const core = tokens.filter((token) => {
      const s = canonical.slots[`${day}:${token}`];
      return s && (s.programme === "core" || s.programme === "lab");
    });
    if (core.length) days[day.toLowerCase()] = core.join("+");
  }
  (p.kind === "lab" ? campusSchema.lab : campusSchema.theory).push({
    start: fmt(p.startMin),
    end: fmt(p.endMin),
    days,
  });
}

const ts = `/* GENERATED by scripts/generate-timetable.mjs — do not edit. */
import canonical from "@/data/timetable/campuses/chennai.json";
import flatSlotMap from "./slotMap.json";
import campusSchema from "./campusSchema.json";

export type DayId = ${canonical.days.map((d) => JSON.stringify(d.id)).join(" | ")};
export type ProgrammeId = ${canonical.programmes.map((p) => JSON.stringify(p.id)).join(" | ")};
export type PeriodKind = "theory" | "lab" | "break";

export interface Alias { token: string; system: string; }
export interface TimetableSlot {
  key: string; token: string; day: DayId; periodId: string;
  kind: "theory" | "lab"; programme: ProgrammeId;
  time: string; startMin: number; endMin: number;
  aliases: Alias[]; flags: string[]; status: "active" | "retired";
}
export interface TimetablePeriod {
  id: string; kind: PeriodKind; startMin: number | null; endMin: number | null;
  lunch: boolean; origin: "campus" | "config";
  slots: Partial<Record<DayId, string[]>>;
}

export const TIMETABLE = canonical as unknown as {
  schemaVersion: 1; vocabularyVersion: string; campusId: string;
  timezone: string; effectiveFrom: string;
  days: { id: DayId; label: string; order: number; follows?: string }[];
  programmes: { id: ProgrammeId; label: string; note?: string }[];
  periods: TimetablePeriod[];
  slots: Record<string, TimetableSlot>;
  baseline: { slotCount: number; periodCount: number; tokenCount: number };
};
export const DAYS = TIMETABLE.days.map((d) => d.id);
export const SLOT_KEYS = Object.keys(TIMETABLE.slots);
export const TOTAL_SLOTS = SLOT_KEYS.length;

/** Legacy flat shape (day -> token -> {time}) for social / attendance / codecs. */
export const SLOT_MAP: Record<string, Record<string, { time: string }>> = flatSlotMap;
/** Legacy campus shape for FFCS / free classrooms / iCal. */
export const CAMPUS_SCHEMA: { theory: any[]; lab: any[] } = campusSchema;

/** Resolve a programme token in a day to its canonical slot record. */
export function resolveSlot(day: string, token: string): TimetableSlot | undefined {
  return TIMETABLE.slots[\`\${day}:\${token}\`];
}
/** The physical period a token belongs to — the identity for clashes and grids. */
export function periodOf(day: string, token: string): TimetablePeriod | undefined {
  const slot = resolveSlot(day, token);
  return slot ? TIMETABLE.periods.find((p) => p.id === slot.periodId) : undefined;
}
/** Every programme token naming one physical period on a day. */
export function tokensForPeriod(day: DayId, periodId: string): string[] {
  return TIMETABLE.periods.find((p) => p.id === periodId)?.slots[day] ?? [];
}
/** All slots sharing a physical period, across programmes and days. */
export function slotsOfPeriod(periodId: string): TimetableSlot[] {
  return Object.values(TIMETABLE.slots).filter((s) => s.periodId === periodId);
}
/** All tokens that name the same physical period, including other programmes. */
export function equivalentTokens(day: string, token: string): string[] {
  const slot = resolveSlot(day, token);
  if (!slot) return [];
  return tokensForPeriod(slot.day, slot.periodId).flatMap((t) => [t, ...(resolveSlot(slot.day, t)?.aliases.map((a) => a.token) ?? [])]);
}
`;

let changed = 0;
changed += writeIfChanged(OUT_SLOTMAP, JSON.stringify(flatSlotMap, null, 2) + "\n") ? 1 : 0;
changed += writeIfChanged(OUT_CAMPUS, JSON.stringify(campusSchema, null, 2) + "\n") ? 1 : 0;
changed += writeIfChanged(OUT_TS, ts) ? 1 : 0;
console.log(
  `[timetable] ${canonical.campusId} v${vocabularyVersion}: ${Object.keys(canonical.slots).length} slots, ${canonical.periods.length} periods, ${overlaps.length} overlapping (day,period) groups`,
);
console.log(`[timetable] ${CHECK ? "check OK" : `${changed} file(s) written`}`);
