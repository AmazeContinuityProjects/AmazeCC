/**
 * Scanner settings — device-local, like every other setting in this app.
 *
 * Persisted in `localStorage` under its own key: the scanner's choices are
 * per-device (this phone's camera, this student's OCR key) and local-first
 * says they travel nowhere unless the student says so.
 *
 * Two honest trade-offs:
 *
 *   • The OCR.space API key is stored in plain text — it is the student's own
 *     key, on their own device, used from their own browser. Encrypting it
 *     with a key we also ship would be theatre.
 *   • A failed write (private-mode quota) keeps the session's settings in the
 *     returned record rather than pretending the save happened twice.
 *
 * Follows the `ffcsSettings` house pattern: frozen defaults, a `sanitize*`
 * function that falls back **per field** (a typo in one value must not reset
 * the other four), and a `revision` stamp for one-shot migrations.
 */

import type { OcrEngineChoice } from "./ocr";
import type { CleanupMode } from "./types";

export const SCANNER_SETTINGS_KEY = "paperScannerSettings";

export interface ScannerSettings {
  /**
   * Schema stamp — see {@link SETTINGS_REVISION}. Records without one are
   * treated as pre-revision and reconciled field by field.
   */
  revision: number;
  /** Which engine reads text: local by default, cloud only when chosen. */
  ocrEngine: OcrEngineChoice;
  /** OCR.space key; `""` when the student has not configured one. */
  ocrApiKey: string;
  /** Cleanup applied to newly captured pages until the student changes it. */
  defaultCleanup: CleanupMode;
  /** Push new scans to the endpoint automatically (only ever on top of local-first). */
  autoUpload: boolean;
  /**
   * Upload endpoint; `""` until one exists. The adapter in `upload.ts` speaks
   * the papers-codechef `FormData → {file_url}` contract, but no endpoint is
   * shipped before there is a backend to call — a guessed URL would fail at
   * the worst possible moment (right after a scan the student cannot re-take).
   */
  uploadEndpoint: string;
}

/** First schema; bump when a stored value's meaning changes and needs a one-shot fix. */
export const SETTINGS_REVISION = 1;

export const ScannerSettingsDefaults: Readonly<ScannerSettings> = Object.freeze({
  revision: SETTINGS_REVISION,
  ocrEngine: "tesseract" as OcrEngineChoice,
  ocrApiKey: "",
  defaultCleanup: "enhanced" as CleanupMode,
  autoUpload: false,
  uploadEndpoint: "",
});

const OCR_ENGINES: readonly OcrEngineChoice[] = ["tesseract", "ocr.space", "auto"];
const CLEANUP_MODES: readonly CleanupMode[] = ["original", "grayscale", "enhanced", "bw"];

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Coerce persisted-or-hand-edited data into a whole settings record.
 *
 * Every unrecognised field falls back alone — settings are data, and data is
 * edited by hands, by older app versions, and by keyboards that drop keys.
 */
export function sanitizeScannerSettings(raw: unknown): ScannerSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // No migration runs yet: SETTINGS_REVISION is still 1, so there is no
  // older schema to reconcile. When you bump it, read `r.revision` here and
  // upgrade the affected field once — the `resultCap` case in `ffcsSettings`
  // is the house example (a stored value only means "pick" after the stamp
  // that defined it as a pick).
  return {
    revision: SETTINGS_REVISION,
    ocrEngine: OCR_ENGINES.includes(r.ocrEngine as OcrEngineChoice)
      ? (r.ocrEngine as OcrEngineChoice)
      : ScannerSettingsDefaults.ocrEngine,
    ocrApiKey: asString(r.ocrApiKey, ScannerSettingsDefaults.ocrApiKey),
    defaultCleanup: CLEANUP_MODES.includes(r.defaultCleanup as CleanupMode)
      ? (r.defaultCleanup as CleanupMode)
      : ScannerSettingsDefaults.defaultCleanup,
    autoUpload: asBool(r.autoUpload, ScannerSettingsDefaults.autoUpload),
    uploadEndpoint: asString(r.uploadEndpoint, ScannerSettingsDefaults.uploadEndpoint),
  };
}

/** Current settings, or defaults when storage is empty, corrupt or forbidden. */
export function loadScannerSettings(): ScannerSettings {
  try {
    const raw = localStorage.getItem(SCANNER_SETTINGS_KEY);
    if (raw === null) return { ...ScannerSettingsDefaults };
    return sanitizeScannerSettings(JSON.parse(raw));
  } catch {
    return { ...ScannerSettingsDefaults };
  }
}

/**
 * Merge `patch` into the stored settings and persist the result.
 *
 * Always returns the record that was actually written (or that which *would*
 * have been, if storage refused), so callers never need to re-read.
 */
export function saveScannerSettings(patch: Partial<ScannerSettings>): ScannerSettings {
  const next = sanitizeScannerSettings({ ...loadScannerSettings(), ...patch });
  try {
    localStorage.setItem(SCANNER_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    /* quota or private mode: the session keeps working with `next` */
  }
  return next;
}
