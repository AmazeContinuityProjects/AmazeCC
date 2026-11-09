/**
 * Export and restore the student's own local data.
 *
 * Everything AmazeCC knows lives in this browser's localStorage, so switching
 * phones or clearing site data used to lose tasks, saved FFCS plans and
 * friends for good. A backup is a small JSON file of exactly those keys.
 *
 * WHAT IS IN A BACKUP (an allowlist, so nothing sensitive slips in later):
 *  - settings, theme, app icon, display name, activity history
 *  - tasks, Pomodoro sessions, homework, notes, OD tracker, GPA goal
 *  - marks predictor state, custom sync modes, scanner settings
 *  - friends and groups, and every `ffcs_*` planner key
 *
 * WHAT IS NOT: passwords, IDs, session tokens and the encrypted credential
 * vault, and anything that is just a copy of VTOP data (attendance, marks,
 * caches), which a sync fetches again.
 *
 * Restore writes only allowlisted keys, so a hand-edited file cannot plant a
 * credential or overwrite anything else.
 */

export const BACKUP_FORMAT = "amazecc-backup";
export const BACKUP_VERSION = 1;

export const BACKUP_KEYS: ReadonlySet<string> = new Set([
  "settings",
  "theme",
  "app-icon",
  "friendlyName",
  "activityTree",
  "tasks",
  "pomodoroSessions",
  "customHomework",
  "notesTracker",
  "uniCC_notes_tracker",
  "wastedODsTracker",
  "uni_cc_gpa_goal",
  "uni_cc_marks_predictor_state",
  "uni_cc_marks_predictor_custom_courses",
  "sync_custom_modes_v1",
  "paperScannerSettings",
  "friends_schedules",
  "friends_groups",
  "predictor_tour_seen",
]);

const BACKUP_PREFIXES = ["ffcs_"] as const;
/** Inside allowed prefixes, but transient or device-specific. */
const EXCLUDED_KEYS: ReadonlySet<string> = new Set(["ffcs_analytics_queue"]);

export function isBackupKey(key: string): boolean {
  if (EXCLUDED_KEYS.has(key)) return false;
  return BACKUP_KEYS.has(key) || BACKUP_PREFIXES.some((p) => key.startsWith(p));
}

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** Raw localStorage strings, exactly as stored. */
  data: Record<string, string>;
}

type ReadableStorage = Pick<Storage, "length" | "key" | "getItem">;

export function createBackup(store: ReadableStorage = localStorage, now = new Date()): Backup {
  const data: Record<string, string> = {};
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (key === null || !isBackupKey(key)) continue;
    const value = store.getItem(key);
    if (value !== null) data[key] = value;
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: now.toISOString(), data };
}

export function backupFilename(now = new Date()): string {
  return `amazecc-backup-${now.toISOString().slice(0, 10)}.json`;
}

export type ParseResult = { ok: true; backup: Backup; keys: string[]; skipped: string[] } | { ok: false; error: string };

/** Validate a backup file's text. Keys outside the allowlist are dropped and reported. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't valid JSON. Pick the .json file AmazeCC exported." };
  }
  const b = raw as Partial<Backup> | null;
  if (!b || typeof b !== "object" || b.format !== BACKUP_FORMAT) {
    return { ok: false, error: "This isn't an AmazeCC backup file." };
  }
  if (typeof b.version !== "number" || b.version > BACKUP_VERSION) {
    return { ok: false, error: "This backup was made by a newer version of AmazeCC. Update the app and try again." };
  }
  if (!b.data || typeof b.data !== "object") {
    return { ok: false, error: "This backup has no data in it." };
  }
  const data: Record<string, string> = {};
  const skipped: string[] = [];
  for (const [k, v] of Object.entries(b.data)) {
    if (isBackupKey(k) && typeof v === "string") data[k] = v;
    else skipped.push(k);
  }
  return {
    ok: true,
    backup: { format: BACKUP_FORMAT, version: b.version, exportedAt: String(b.exportedAt ?? ""), data },
    keys: Object.keys(data),
    skipped,
  };
}

/** Write a parsed backup. Existing values for the same keys are replaced; other keys are left alone. */
export function restoreBackup(backup: Backup, store: Pick<Storage, "setItem"> = localStorage): number {
  let n = 0;
  for (const [k, v] of Object.entries(backup.data)) {
    if (!isBackupKey(k)) continue;
    store.setItem(k, v);
    n++;
  }
  return n;
}

/** Short human summary of what a backup holds, for the confirm step. */
export function describeBackup(backup: Backup): string[] {
  const has = (k: string) => k in backup.data;
  const count = (k: string) => {
    try {
      const v = JSON.parse(backup.data[k] ?? "null");
      return Array.isArray(v) ? v.length : v && typeof v === "object" ? Object.keys(v).length : 0;
    } catch {
      return 0;
    }
  };
  const lines: string[] = [];
  if (has("tasks")) lines.push(`${count("tasks")} tasks`);
  if (has("ffcs_timetables")) lines.push(`${count("ffcs_timetables")} FFCS plans`);
  if (has("friends_schedules") || has("ffcs_friends")) lines.push("friends");
  if (has("settings")) lines.push("settings");
  if (has("pomodoroSessions")) lines.push(`${count("pomodoroSessions")} focus sessions`);
  if (has("uni_cc_marks_predictor_state")) lines.push("marks predictor");
  return lines;
}
