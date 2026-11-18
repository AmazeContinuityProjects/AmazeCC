/**
 * Web Worker for Paper Scanner image processing.
 *
 * Runs intensive pixel mathematics (Sobel edge detection, perspective warping,
 * adaptive thresholding, cleanup filters, and image statistics calculation)
 * on a background worker thread.
 *
 * Keeps the camera viewfinder, corner editor, and UI at 60fps on mobile devices
 * by offloading CPU-heavy ArrayBuffer operations and transferring buffers with zero copy.
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
} from "../imageOps";
import type { CleanupMode, Quad, Raster } from "../types";

export type ScannerWorkerRequest =
  | {
      type: "detect_quad";
      id: string;
      raster: Raster;
    }
  | {
      type: "process_page";
      id: string;
      raster: Raster;
      quad?: Quad;
      cleanup: CleanupMode;
    }
  | {
      type: "process_batch";
      id: string;
      pages: { raster: Raster; quad?: Quad }[];
      cleanup: CleanupMode;
    };

export type ScannerWorkerReply =
  | {
      type: "detect_quad_result";
      id: string;
      quad: Quad | null;
    }
  | {
      type: "process_page_result";
      id: string;
      cleaned: Raster;
      quad: Quad;
      stats: ImageStats;
    }
  | {
      type: "batch_progress";
      id: string;
      done: number;
      total: number;
    }
  | {
      type: "process_batch_result";
      id: string;
      cleaned: Raster[];
      stats: ImageStats;
    }
  | {
      type: "error";
      id: string;
      message: string;
    };

const post = (reply: ScannerWorkerReply, transfer: Transferable[] = []) => {
  self.postMessage(reply, transfer);
};

self.onmessage = (event: MessageEvent<ScannerWorkerRequest>) => {
  const req = event.data;
  if (!req || typeof req !== "object") {
    post({ type: "error", id: "unknown", message: "Invalid worker request payload" });
    return;
  }

  const { id } = req;

  try {
    switch (req.type) {
      case "detect_quad": {
        const quad = detectQuad(req.raster);
        post({ type: "detect_quad_result", id, quad });
        break;
      }

      case "process_page": {
        const { raster, quad: settled, cleanup } = req;
        const quad = settled ?? detectQuad(raster) ?? fullFrameQuad(raster.width, raster.height);
        const { width, height } = warpSizeFor(quad);
        const warped = warpQuad(raster, quad, width, height);
        const cleaned = applyCleanup(warped, cleanup);
        const frameArea = raster.width * raster.height;
        const stats = imageStats(cleaned, frameArea > 0 ? quadArea(quad) / frameArea : 1);

        post(
          {
            type: "process_page_result",
            id,
            cleaned,
            quad,
            stats,
          },
          [cleaned.data.buffer],
        );
        break;
      }

      case "process_batch": {
        const { pages, cleanup } = req;
        const cleaned: Raster[] = [];
        let firstStats: ImageStats | null = null;
        const transfers: Transferable[] = [];

        for (let i = 0; i < pages.length; i++) {
          const { raster, quad: settled } = pages[i];
          const quad = settled ?? detectQuad(raster) ?? fullFrameQuad(raster.width, raster.height);
          const { width, height } = warpSizeFor(quad);
          const warped = warpQuad(raster, quad, width, height);
          const page = applyCleanup(warped, cleanup);
          cleaned.push(page);
          transfers.push(page.data.buffer);

          if (firstStats === null) {
            const frameArea = raster.width * raster.height;
            firstStats = imageStats(page, frameArea > 0 ? quadArea(quad) / frameArea : 1);
          }

          post({ type: "batch_progress", id, done: i + 1, total: pages.length });
        }

        const fallbackStats: ImageStats = firstStats ?? {
          contrast: 0.5,
          inkRatio: 0.05,
          edgeDensity: 0.05,
          quadFill: 1,
        };

        post(
          {
            type: "process_batch_result",
            id,
            cleaned,
            stats: fallbackStats,
          },
          transfers,
        );
        break;
      }

      default: {
        post({ type: "error", id, message: `Unknown scanner worker action type: ${(req as any).type}` });
        break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    post({ type: "error", id, message });
  }
};
