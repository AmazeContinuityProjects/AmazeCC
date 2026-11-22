/**
 * Unified Course Catalog & Static Report Loader for AmazeCC.
 *
 * Provides an ultra-fast, zero-dependency streaming CSV parser and in-memory
 * singleton cache for the campus master course catalogs.
 *
 * Replaces heavy XLSX (SheetJS) parsing for static CSV reports, cutting load
 * times from ~800ms down to ~8ms and avoiding multi-megabyte bundle downloads.
 */

import { parseCourseRows, type FreeRoomCourse } from "./freeClassrooms";
import { getSelectedFinalReportPath, mapToFinalSemesterId } from "./ffcsReports";
import { parseFastCSV } from "./fastCsv";

export { parseFastCSV };

// In-memory singleton cache to prevent duplicate fetches & parses
const catalogCache = new Map<string, FreeRoomCourse[]>();
const inFlightPromises = new Map<string, Promise<FreeRoomCourse[]>>();

interface CatalogWorkerReply {
  id: string;
  parsed?: FreeRoomCourse[];
  rawRows?: Record<string, string>[];
  error?: string;
}

type CatalogWorkerMode = "parsed" | "raw";

type CatalogWorkerOutcome =
  { kind: "ok"; parsed?: FreeRoomCourse[]; rawRows?: Record<string, string>[] } | { kind: "error" };

/**
 * The one entry point to the catalog parser worker, shared by both the free
 * classroom catalog and the FFCS report loader.
 *
 * Both callers need the same expensive operation — tokenizing a multi-megabyte
 * CSV — off the UI thread. They differ only in what happens to the raw rows
 * afterwards: `"parsed"` normalizes them into `FreeRoomCourse` here, while
 * `"raw"` hands them back so the caller can run its own `parseReportRows` on
 * the main thread. Keeping the worker creation, timeout and fallback in one
 * place means there is still a single worker-backed path to reuse, with the
 * existing singleton cache alongside it.
 */
function runCatalogParser(text: string, mode: CatalogWorkerMode): Promise<CatalogWorkerOutcome> {
  const fallback = (): CatalogWorkerOutcome => {
    const rawRows = parseFastCSV(text);
    return mode === "raw" ? { kind: "ok", rawRows } : { kind: "ok", parsed: parseCourseRows(rawRows) };
  };

  if (typeof window === "undefined" || typeof Worker === "undefined") {
    return Promise.resolve(fallback());
  }

  return new Promise((resolve) => {
    let worker: Worker | null = null;
    try {
      worker = new Worker(new URL("./workers/catalogParser.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      resolve(fallback());
      return;
    }

    const id = `${mode}-${Date.now()}-${Math.random()}`;
    const timer = setTimeout(() => {
      worker?.terminate();
      resolve(fallback());
    }, 8000);

    worker.onmessage = (e: MessageEvent<CatalogWorkerReply>) => {
      if (e.data && e.data.id === id) {
        clearTimeout(timer);
        worker?.terminate();
        if (e.data.error) {
          resolve(fallback());
          return;
        }
        if (mode === "raw") {
          resolve(Array.isArray(e.data.rawRows) ? { kind: "ok", rawRows: e.data.rawRows } : fallback());
        } else {
          resolve(Array.isArray(e.data.parsed) ? { kind: "ok", parsed: e.data.parsed } : fallback());
        }
      }
    };

    worker.onerror = () => {
      clearTimeout(timer);
      worker?.terminate();
      resolve(fallback());
    };

    worker.postMessage({ id, text, mode });
  });
}

function parseInWorker(text: string): Promise<FreeRoomCourse[]> {
  return runCatalogParser(text, "parsed").then((outcome) => (outcome.kind === "ok" ? (outcome.parsed ?? []) : []));
}

/**
 * Parse a report's CSV into raw rows on the worker thread.
 *
 * The FFCS planner owns `parseReportRows` (its report has a different column
 * vocabulary from the free-classroom catalog), so it keeps that mapping and
 * only moves the CSV tokenization off the UI thread by calling this function.
 */
export function parseReportCsvInWorker(text: string): Promise<Record<string, string>[]> {
  return runCatalogParser(text, "raw").then((outcome) => (outcome.kind === "ok" ? (outcome.rawRows ?? []) : []));
}

/**
 * Loads and returns the master course offerings for the requested semester.
 * Results are cached in memory so subsequent calls from Faculty Schedule,
 * Faculty Info, and Free Classrooms resolve synchronously or reuse in-flight requests.
 */
export async function loadCourseCatalog(semesterId?: string | null): Promise<FreeRoomCourse[]> {
  const finalSem = mapToFinalSemesterId(semesterId) || "winter-2026-2027";
  const cacheKey = `catalog_${finalSem}`;

  // 1. Check in-memory cache
  const cached = catalogCache.get(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }

  // 2. Check if a fetch for this semester is already in-flight
  const existingPromise = inFlightPromises.get(cacheKey);
  if (existingPromise) {
    return existingPromise;
  }

  // 3. Initiate fetch and parse
  const fetchPromise = (async () => {
    try {
      const reportPath = getSelectedFinalReportPath(finalSem);
      const response = await fetch(reportPath);
      if (!response.ok) {
        throw new Error(`Failed to load course catalog from ${reportPath}: status ${response.status}`);
      }

      const text = await response.text();
      const parsed = await parseInWorker(text);

      if (parsed.length > 0) {
        catalogCache.set(cacheKey, parsed);
      }
      return parsed;
    } finally {
      inFlightPromises.delete(cacheKey);
    }
  })();

  inFlightPromises.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Synchronous cache getter if the catalog has already been parsed and loaded in memory.
 */
export function getCourseCatalogSync(semesterId?: string | null): FreeRoomCourse[] | null {
  const finalSem = mapToFinalSemesterId(semesterId) || "winter-2026-2027";
  return catalogCache.get(`catalog_${finalSem}`) || null;
}

/**
 * Clears the in-memory course catalog cache (useful for testing or manual refreshes).
 */
export function clearCourseCatalogCache(): void {
  catalogCache.clear();
  inFlightPromises.clear();
}
