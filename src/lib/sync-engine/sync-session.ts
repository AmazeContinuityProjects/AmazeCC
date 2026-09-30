import { useSyncExternalStore } from "react";
import type { ProgressEvent } from "./types";
import { subscribeUniccLogEvents } from "../unicc-fallback";

export type SyncLineStatus = "success" | "error" | "pending" | "info" | "loading";

export interface SyncLogLine {
  text: string;
  status: SyncLineStatus;
}

export type SyncOutcome = "success" | "error" | null;

/** Non-run reasons the sheet can be opened; drives a notice instead of progress. */
export type SyncNotice = "offline" | null;

interface SyncSessionState {
  open: boolean;
  title: string;
  lines: SyncLogLine[];
  progress: number;
  runId: number;
  /** Set when the run finishes; drives the success tick. Null while running. */
  outcome: SyncOutcome;
  /** Set when the sheet was opened to report a condition, not a live run. */
  notice: SyncNotice;
}

const MAX_LINES = 60;
const DEFAULT_HOLD_MS = 2500;

let state: SyncSessionState = { open: false, title: "", lines: [], progress: 0, runId: 0, outcome: null, notice: null };
const listeners = new Set<() => void>();
let closeTimer: ReturnType<typeof setTimeout> | null = null;
// Run dismissed by the user mid-flight: later events from the same run must
// not pop the sheet back open.
let dismissedRunId = -1;

function emit() {
  listeners.forEach((l) => l());
}

export function openSyncSession(title: string, notice: SyncNotice = null) {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  dismissedRunId = -1;
  state = {
    open: true,
    title,
    lines: [{ text: `${title}…`, status: "loading" }],
    progress: 0,
    runId: state.runId + 1,
    outcome: null,
    notice,
  };
  emit();
}

/**
 * Open the sheet as a connectivity notice instead of a sync run: no request is
 * fired, the sheet just explains the browser is offline and offers a retry.
 */
export function openOfflineSyncSession() {
  openSyncSession("You're Offline", "offline");
}

/** Open only when no session is active (safe for concurrent flows). */
export function ensureSyncSession(title: string) {
  if (!state.open && dismissedRunId !== state.runId) {
    openSyncSession(title);
  }
}

export function appendSyncLine(text: string, status: SyncLineStatus = "info") {
  if (!state.open) return;
  state = { ...state, lines: [...state.lines, { text, status }].slice(-MAX_LINES) };
  emit();
}

export function setSyncProgress(n: number) {
  if (!state.open) return;
  state = { ...state, progress: Math.max(0, Math.min(100, n)) };
  emit();
}

export function bumpSyncProgress(delta: number) {
  setSyncProgress(state.progress + delta);
}

/**
 * Close the session, holding the final state visible for holdMs first so a
 * success tick (or the error log) is actually seen before dismissing.
 */
export function closeSyncSession(
  holdMs: number = DEFAULT_HOLD_MS,
  outcome: Exclude<SyncOutcome, null> = "success"
) {
  if (!state.open) return;
  setSyncProgress(100);
  state = { ...state, outcome };
  emit();
  const runId = state.runId;
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => {
    if (state.runId === runId) {
      state = { ...state, open: false };
      emit();
    }
    closeTimer = null;
  }, holdMs);
}

/** User-dismissed mid-flight: close now and suppress re-opens from this run. */
export function dismissSyncSession() {
  dismissedRunId = state.runId;
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
  if (state.open) {
    state = { ...state, open: false };
    emit();
  }
}

export function isSyncSessionOpen() {
  return state.open;
}

function getSnapshot(): SyncSessionState {
  return state;
}

/** Test/consumer read access to the current snapshot. */
export function getSyncSessionSnapshot(): SyncSessionState {
  return getSnapshot();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useSyncSession(): SyncSessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const STATUS_EMOJI: Record<SyncLineStatus, string> = {
  success: "✅",
  error: "❌",
  pending: "⏳",
  info: "📝",
  loading: "⏳",
};

/** Serialize session lines into the legacy message-string format. */
export function formatSessionMessage(lines: SyncLogLine[]): string {
  return lines.map((l) => `${STATUS_EMOJI[l.status]} ${l.text}`).join("\n");
}

// Engine op -> human label + progress weight for a full login sweep (~100).
// Includes per-request child ops emitted inside the "core" parent op.
const OP_LABELS: Record<string, { label: string; delta: number }> = {
  attendanceMarks: { label: "Attendance & Marks", delta: 25 },
  studentProfile: { label: "Profile details", delta: 5 },
  core: { label: "Core data bundle", delta: 9 },
  grades: { label: "Grades", delta: 8 },
  schedule: { label: "Exam schedule", delta: 8 },
  hostel: { label: "Hostel details", delta: 5 },
  calendar: { label: "Academic calendar", delta: 8 },
  "all-grades": { label: "All grades history", delta: 8 },
  "profile-images": { label: "Profile images", delta: 2 },
  transport: { label: "Transport data", delta: 5 },
  events: { label: "Registered events", delta: 5 },
  officialOd: { label: "Official OD records", delta: 5 },
  pastAttendance: { label: "Past semester attendance", delta: 5 },
  fresher: { label: "Fresher / EPT data", delta: 5 },
  buses: { label: "Bus routes", delta: 5 },
  bulk: { label: "Additional records cache", delta: 5 },
  lms: { label: "Moodle data", delta: 10 },
  social: { label: "Friends & groups", delta: 5 },
};

/** Routes the request layer can hand to UniCC, in the words the log uses. */
const UNICC_ROUTE_LABELS: Record<string, string> = {
  login: "sign-in",
  attendance: "attendance",
  grades: "grades",
  "all-grades": "all-grades",
  calendar: "academic calendar",
  schedule: "exam schedule",
  hostel: "hostel details",
  "lms-data": "Moodle data",
  "vitol-data": "VITOL data",
};

const routeLabel = (path: string) => UNICC_ROUTE_LABELS[path] ?? path;

/**
 * Say, per request, who answered it and when the other server was skipped.
 *
 * The op lines say *what* was fetched; this says *who fetched it*. Without it a
 * third party can end up serving a student's whole login and the log looks
 * identical to a normal one — which is the invisibility that made the earlier
 * origin-swap bug so easy to miss.
 *
 * Only the interesting transitions are logged. A request AmazeCC answers with no
 * trouble produces no line, because the op line already covers it; emitting one
 * per routine request would bury the two a student actually needs to see.
 *
 * `appendSyncLine` no-ops when no session is open, so nothing is recorded
 * outside a visible run.
 */
subscribeUniccLogEvents((e) => {
  if (e.type === "unicc_served") {
    appendSyncLine(`${routeLabel(e.path)} served by UniCC API`, "info");
  } else if (e.type === "fell_back_to_unicc") {
    appendSyncLine(`AmazeCC API failed — falling back to UniCC for ${routeLabel(e.path)}`, "error");
  } else {
    appendSyncLine(`UniCC API could not answer ${routeLabel(e.path)} — using AmazeCC API`, "error");
  }
});

/**
 * Feed a raw engine progress event into the session so the log reflects
 * what actually fetched — success or failure — per module.
 */
export function handleEngineProgressEvent(e: ProgressEvent) {
  const meta = OP_LABELS[e.op] || { label: e.op, delta: 5 };
  if (e.phase === "start") {
    ensureSyncSession("VTOP Sync");
    appendSyncLine(`Fetching ${meta.label}…`, "loading");
  } else if (e.phase === "done") {
    ensureSyncSession("VTOP Sync");
    appendSyncLine(`${meta.label} fetched`, "success");
    bumpSyncProgress(meta.delta);
  } else if (e.phase === "error") {
    ensureSyncSession("VTOP Sync");
    const detail = e.error && "message" in e.error ? ` — ${e.error.message}` : "";
    appendSyncLine(`${meta.label} failed${detail}`, "error");
  }
}
