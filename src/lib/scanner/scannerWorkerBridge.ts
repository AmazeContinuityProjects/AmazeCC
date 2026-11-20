/**
 * Bridge for offloading scanner pixel math to `scanner.worker.ts`.
 *
 * Provides async wrappers for quad detection, page warping, and batch processing.
 * Falls back to main-thread inline execution automatically if Web Workers are
 * unavailable (e.g. under jsdom in tests, during SSR, or in restricted environments).
 *
 * One worker is shared by every call — detection in the crop editor, batch
 * processing in the pipeline, and anything added later. Replies are routed by
 * request id so overlapping calls cannot cross-talk, and `shutdownScannerWorker`
 * is the single teardown point a host can call on unmount.
 */

import {
  applyCleanup,
  detectQuad,
  fullFrameQuad,
  imageStats,
  quadArea,
  warpQuad,
  warpSizeFor,
  type ImageStats,
} from "./imageOps";
import type { ProcessScanPage } from "./pipeline";
import type { CleanupMode, Quad, Raster } from "./types";
import type { ScannerWorkerReply, ScannerWorkerRequest } from "./workers/scanner.worker";

let nextRequestId = 0;
function uniqueId(): string {
  return `scan-req-${Date.now()}-${++nextRequestId}`;
}

/* --------------------------------------------------------- shared worker */

interface PendingRequest {
  /** One reply from the worker; the handler decides whether to settle or continue. */
  reply: (msg: ScannerWorkerReply, finish: () => void, fail: () => void) => void;
  /** Main-thread path used when the worker is missing, errors or times out. */
  fallback: () => void;
  /** Set in `dispatch` so `failRequest` can clear it from the worker's single handler. */
  timer?: ReturnType<typeof setTimeout>;
}

/** `undefined` means "not created yet"; `null` means "unavailable". */
let sharedWorker: Worker | null | undefined;
const pending = new Map<string, PendingRequest>();

function createScannerWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./workers/scanner.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch (err) {
    console.warn("[ScannerWorker] Worker creation failed, using main thread fallback:", err);
    return null;
  }
}

/** Lazily create the one worker and wire its two app-wide handlers. */
function getScannerWorker(): Worker | null {
  if (sharedWorker !== undefined) return sharedWorker;

  const worker = createScannerWorker();
  if (worker) {
    worker.onmessage = (event: MessageEvent<ScannerWorkerReply>) => {
      const msg = event.data;
      if (!msg || typeof msg.id !== "string") return;
      pending.get(msg.id)?.reply(
        msg,
        () => finishRequest(msg.id),
        () => failRequest(msg.id),
      );
    };
    worker.onerror = () => {
      // A crashed worker cannot serve anyone: settle every in-flight request
      // through its own inline fallback instead of letting each hit its timer.
      console.warn("[ScannerWorker] Worker runtime error, falling back inline.");
      for (const id of Array.from(pending.keys())) failRequest(id);
    };
  }
  sharedWorker = worker;
  return worker;
}

function finishRequest(id: string): void {
  const entry = pending.get(id);
  if (!entry) return;
  if (entry.timer !== undefined) clearTimeout(entry.timer);
  pending.delete(id);
}

function failRequest(id: string): void {
  const entry = pending.get(id);
  if (!entry) return;
  finishRequest(id);
  entry.fallback();
}

interface DispatchOptions {
  id: string;
  timeoutMs: number;
  reply: PendingRequest["reply"];
  fallback: () => void;
}

/**
 * Send one request to the shared worker. Returns a canceller that removes the
 * pending entry *without* running the fallback (used when a caller aborts).
 */
function dispatch(req: ScannerWorkerRequest, options: DispatchOptions): () => void {
  const worker = getScannerWorker();
  if (!worker) {
    options.fallback();
    return () => {};
  }

  const entry: PendingRequest = {
    reply: options.reply,
    fallback: options.fallback,
  };
  pending.set(options.id, entry);
  entry.timer = setTimeout(() => {
    console.warn("[ScannerWorker] Timed out waiting for worker reply, falling back inline.");
    failRequest(options.id);
  }, options.timeoutMs);

  try {
    worker.postMessage(req);
  } catch {
    failRequest(options.id);
  }
  return () => finishRequest(options.id);
}

/**
 * Terminate the shared worker and settle anything still in flight via its
 * inline fallback. A later call lazily creates a fresh worker. Call this from
 * the owning component's unmount cleanup — not from a single request, so one
 * finished batch never tears down work another caller still needs.
 */
export function shutdownScannerWorker(): void {
  const worker = sharedWorker;
  sharedWorker = undefined;
  for (const id of Array.from(pending.keys())) failRequest(id);
  pending.clear();
  try {
    worker?.terminate();
  } catch {
    /* a worker that already died needs no teardown */
  }
}

/* ---------------------------------------------------------------- detect */

/**
 * Detect document corner quad asynchronously in the Web Worker (with inline fallback).
 */
export async function detectQuadAsync(raster: Raster): Promise<Quad | null> {
  const id = uniqueId();
  return new Promise<Quad | null>((resolve) => {
    dispatch(
      { type: "detect_quad", id, raster },
      {
        id,
        timeoutMs: 4000,
        fallback: () => resolve(detectQuad(raster)),
        reply: (msg, finish, fail) => {
          if (msg.type === "detect_quad_result") {
            finish();
            resolve(msg.quad);
          } else if (msg.type === "error") {
            console.warn("[ScannerWorker] Detect failed, falling back inline:", msg.message);
            fail();
          }
        },
      },
    );
  });
}

/* --------------------------------------------------------------- process */

/**
 * Process a batch of scan pages asynchronously off the main thread.
 * Emits progress as each page is warped and cleaned.
 */
export async function processScanPagesAsync(
  pages: readonly ProcessScanPage[],
  cleanup: CleanupMode,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ cleaned: Raster[]; stats: ImageStats }> {
  signal?.throwIfAborted();

  const id = uniqueId();
  return new Promise<{ cleaned: Raster[]; stats: ImageStats }>((resolve, reject) => {
    let settled = false;
    let cancelPending = () => {};

    // Declared before `clearAbort` and `fallback`: the inline path can run
    // synchronously when no worker exists, so every referenced binding must
    // already be initialised at that point.
    const abortHandler = () => {
      if (settled) return;
      settled = true;
      cancelPending();
      reject(signal?.reason ?? new Error("Scan processing aborted"));
    };
    const clearAbort = () => signal?.removeEventListener("abort", abortHandler);
    const succeed = (value: { cleaned: Raster[]; stats: ImageStats }) => {
      if (settled) return;
      settled = true;
      clearAbort();
      resolve(value);
    };

    const fallback = () => {
      if (settled) return;
      if (signal?.aborted) {
        settled = true;
        clearAbort();
        reject(signal.reason ?? new Error("Scan processing aborted"));
        return;
      }
      clearAbort();
      // The inline path walks the same signal, so a cancellation during it is
      // still an AbortError rather than a partially processed result.
      processPagesInline(pages, cleanup, onProgress, signal).then(resolve, reject);
    };

    cancelPending = dispatch(
      {
        type: "process_batch",
        id,
        pages: pages.map((p) => ({ raster: p.raster, quad: p.quad })),
        cleanup,
      },
      {
        id,
        timeoutMs: Math.max(15000, pages.length * 8000),
        fallback,
        reply: (msg, finish, fail) => {
          if (msg.type === "batch_progress") {
            onProgress?.(msg.done, msg.total);
          } else if (msg.type === "process_batch_result") {
            finish();
            succeed({ cleaned: msg.cleaned, stats: msg.stats });
          } else if (msg.type === "error") {
            console.warn("[ScannerWorker] Batch failed, falling back inline:", msg.message);
            fail();
          }
        },
      },
    );

    if (!settled) signal?.addEventListener("abort", abortHandler, { once: true });
  });
}

function processPagesInline(
  pages: readonly ProcessScanPage[],
  cleanup: CleanupMode,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ cleaned: Raster[]; stats: ImageStats }> {
  signal?.throwIfAborted();
  const cleaned: Raster[] = [];
  let stats: ImageStats | null = null;

  for (let i = 0; i < pages.length; i++) {
    signal?.throwIfAborted();
    const { raster, quad: settled } = pages[i];
    const quad = settled ?? detectQuad(raster) ?? fullFrameQuad(raster.width, raster.height);
    const { width, height } = warpSizeFor(quad);
    const page = applyCleanup(warpQuad(raster, quad, width, height), cleanup);
    cleaned.push(page);
    if (stats === null) {
      const frameArea = raster.width * raster.height;
      stats = imageStats(page, frameArea > 0 ? quadArea(quad) / frameArea : 1);
    }
    onProgress?.(i + 1, pages.length);
  }

  const fallbackStats: ImageStats = stats ?? {
    contrast: 0.5,
    inkRatio: 0.05,
    edgeDensity: 0.05,
    quadFill: 1,
  };

  return Promise.resolve({ cleaned, stats: fallbackStats });
}
