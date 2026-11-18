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
}

export interface CatalogParserReply {
  id: string;
  parsed: FreeRoomCourse[];
  error?: string;
}

self.onmessage = (event: MessageEvent<CatalogParserRequest>) => {
  const req = event.data;
  if (!req || typeof req !== "object") return;

  const { id, text } = req;
  try {
    const rawRows = parseFastCSV(text);
    const parsed = parseCourseRows(rawRows);
    self.postMessage({ id, parsed });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    self.postMessage({ id, parsed: [], error });
  }
};
