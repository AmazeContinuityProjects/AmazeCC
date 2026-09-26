import { useSyncExternalStore } from "react";
import type { ProgressEvent } from "./types";

export type SyncLineStatus = "success" | "error" | "pending" | "info" | "loading";

export interface SyncLogLine {
  text: string;
  status: SyncLineStatus;
}

interface SyncSessionState {
  open: boolean;
  title: string;
  lines: SyncLogLine[];
  progress: number;
  runId: number;
}

const MAX_LINES = 60;
const DEFAULT_HOLD_MS = 2500;

let state: SyncSessionState = { open: false, title: "", lines: [], progress: 0, runId: 0 };
const listeners = new Set<() => void>();
let closeTimer: ReturnType<typeof setTimeout> | null = null;
// Run dismissed by the user mid-flight: later events from the same run must
// not pop the sheet back open.
let dismissedRunId = -1;

function emit() {
  listeners.forEach((l) => l());
}

export function openSyncSession(title: string) {
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
  };
  emit();
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

/** Close the session, holding the final log visible for holdMs first. */
export function closeSyncSession(holdMs: number = DEFAULT_HOLD_MS) {
  if (!state.open) return;
  setSyncProgress(100);
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
const OP_LABELS: Record<string, { label: string; delta: number }> = {
  attendanceMarks: { label: "Attendance & Marks", delta: 25 },
  studentProfile: { label: "Profile details", delta: 5 },
  core: { label: "Core data (grades, schedule, calendar)", delta: 35 },
  transport: { label: "Transport data", delta: 5 },
  events: { label: "Registered events", delta: 5 },
  officialOd: { label: "Official OD records", delta: 5 },
  pastAttendance: { label: "Past semester attendance", delta: 5 },
  fresher: { label: "Fresher / EPT data", delta: 5 },
  buses: { label: "Bus routes", delta: 5 },
  bulk: { label: "Additional records cache", delta: 5 },
  lms: { label: "Moodle data", delta: 10 },
};

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
