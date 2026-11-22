/**
 * Web Worker for parsing campus master course catalogs.
 *
 * Runs CSV parsing and row normalization in the background so the main
 * thread never hitches when loading multi-megabyte course catalogs.
 */

import { parseFastCSV } from "../fastCsv";
import { parseCourseRows, type FreeRoomCourse } from "../freeClassrooms";

export interface CatalogParserRequest {
  id: string;
  text: string;
  /**
   * `"parsed"` (default) returns normalized `FreeRoomCourse[]` for the free
   * classroom catalog. `"raw"` returns just the CSV rows, so a caller that
   * owns its own row→domain mapping (the FFCS report's `parseReportRows`) can
   * do that mapping on the main thread without parsing CSV there.
   */
  mode?: "parsed" | "raw";
}

export interface CatalogParserReply {
  id: string;
  /** Present when `mode` is `"parsed"` (the default). */
  parsed?: FreeRoomCourse[];
  /** Present when `mode` is `"raw"` — the untouched CSV rows. */
  rawRows?: Record<string, string>[];
  error?: string;
}

self.onmessage = (event: MessageEvent<CatalogParserRequest>) => {
  const req = event.data;
  if (!req || typeof req !== "object") return;

  const { id, text, mode } = req;
  try {
    // The expensive part — the CSV tokenization — runs here either way. Only
    // the cheap, caller-specific mapping stays on the main thread for "raw".
    const rawRows = parseFastCSV(text);
    if (mode === "raw") {
      self.postMessage({ id, rawRows });
      return;
    }
    const parsed = parseCourseRows(rawRows);
    self.postMessage({ id, parsed });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage({ id, parsed: [], error });
  }
};
