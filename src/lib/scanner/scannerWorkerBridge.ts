/**
 * Bridge for offloading scanner pixel math to `scanner.worker.ts`.
 *
 * Provides async wrappers for quad detection, page warping, and batch processing.
 * Falls back to main-thread inline execution automatically if Web Workers are
 * unavailable (e.g. under jsdom in tests, during SSR, or in restricted environments).
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

/**
 * Creates a scanner worker instance if supported by the browser runtime.
 */
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

/**
 * Detect document corner quad asynchronously in a Web Worker (with inline fallback).
 */
export async function detectQuadAsync(raster: Raster): Promise<Quad | null> {
  const worker = createScannerWorker();
  if (!worker) {
    return detectQuad(raster);
  }

  const id = uniqueId();
  return new Promise<Quad | null>((resolve) => {
    const timer = setTimeout(() => {
      worker.terminate();
      resolve(detectQuad(raster));
    }, 4000);

    worker.onmessage = (event: MessageEvent<ScannerWorkerReply>) => {
      const msg = event.data;
      if (msg && msg.id === id) {
        clearTimeout(timer);
        worker.terminate();
        if (msg.type === "detect_quad_result") {
          resolve(msg.quad);
        } else {
          resolve(detectQuad(raster));
        }
      }
    };

    worker.onerror = () => {
      clearTimeout(timer);
      worker.terminate();
      resolve(detectQuad(raster));
    };

    const req: ScannerWorkerRequest = {
      type: "detect_quad",
      id,
      raster,
    };
    worker.postMessage(req);
  });
}

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

  const worker = createScannerWorker();

  // Inline fallback when worker cannot be spawned
  if (!worker) {
    return processPagesInline(pages, cleanup, onProgress, signal);
  }

  const id = uniqueId();
  return new Promise<{ cleaned: Raster[]; stats: ImageStats }>((resolve, reject) => {
    let settled = false;

    const cleanupWorker = () => {
      settled = true;
      worker.terminate();
    };

    const abortHandler = () => {
      if (!settled) {
        cleanupWorker();
        reject(signal?.reason ?? new Error("Scan processing aborted"));
      }
    };

    if (signal) {
      signal.addEventListener("abort", abortHandler, { once: true });
    }

    const timer = setTimeout(
      () => {
        if (!settled) {
          console.warn("[ScannerWorker] Timed out waiting for worker reply, falling back to inline.");
          cleanupWorker();
          processPagesInline(pages, cleanup, onProgress, signal).then(resolve, reject);
        }
      },
      Math.max(15000, pages.length * 8000),
    );

    worker.onmessage = (event: MessageEvent<ScannerWorkerReply>) => {
      const msg = event.data;
      if (!msg || msg.id !== id) return;

      if (msg.type === "batch_progress") {
        onProgress?.(msg.done, msg.total);
      } else if (msg.type === "process_batch_result") {
        clearTimeout(timer);
        cleanupWorker();
        resolve({ cleaned: msg.cleaned, stats: msg.stats });
      } else if (msg.type === "error") {
        clearTimeout(timer);
        cleanupWorker();
        console.warn("[ScannerWorker] Worker error, falling back inline:", msg.message);
        processPagesInline(pages, cleanup, onProgress, signal).then(resolve, reject);
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timer);
      cleanupWorker();
      console.warn("[ScannerWorker] Worker runtime error, falling back inline:", err);
      processPagesInline(pages, cleanup, onProgress, signal).then(resolve, reject);
    };

    try {
      const req: ScannerWorkerRequest = {
        type: "process_batch",
        id,
        pages: pages.map((p) => ({ raster: p.raster, quad: p.quad })),
        cleanup,
      };
      worker.postMessage(req);
    } catch (err) {
      clearTimeout(timer);
      cleanupWorker();
      processPagesInline(pages, cleanup, onProgress, signal).then(resolve, reject);
    }
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
