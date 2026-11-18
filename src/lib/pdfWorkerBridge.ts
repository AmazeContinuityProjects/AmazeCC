/**
 * PDF Generation Worker Bridge.
 *
 * Dispatches heavy PDF document generation (A4 landscape raster dossiers,
 * print-friendly form dossiers, portrait vector dossiers, and clash reports)
 * to `pdf.worker.ts` so the main UI thread stays at 60fps without hitching.
 *
 * Automatically falls back to inline main-thread execution when Web Workers
 * are unavailable (e.g. under SSR, jsdom during unit tests, or environments
 * without worker support).
 */

import type { PrintDossierParams } from "./formDossier";
import type { ModernPrintableReportParams } from "./exportTimetable";
import type { DossierGridMode } from "./portraitDossier";
import type { ClashReportParams } from "./exportClashReport";

export interface BuildDossierRequest {
  type: "build_dossier_pdf";
  timetableName: string;
  theme: "light" | "dark";
  isLight: boolean;
  imageBitmap?: ImageBitmap;
  dataUrl?: string;
  pageWidth?: number;
  pageHeight?: number;
  margin?: number;
}

export interface BuildFormDossierRequest {
  type: "build_form_dossier_pdf";
  params: PrintDossierParams;
}

export interface BuildPortraitDossierRequest {
  type: "build_portrait_dossier_pdf";
  params: ModernPrintableReportParams & { theme?: "light" | "dark"; gridMode?: DossierGridMode };
}

export interface BuildClashReportRequest {
  type: "build_clash_report_pdf";
  params: ClashReportParams;
}

export type PdfWorkerRequest =
  BuildDossierRequest | BuildFormDossierRequest | BuildPortraitDossierRequest | BuildClashReportRequest;

export type PdfWorkerReply =
  { type: "success"; pdfBuffer: ArrayBuffer; fileName: string } | { type: "error"; message: string };

function createPdfWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../components/custom/exams/FFCS/workers/pdf.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch (err) {
    console.warn("[PdfWorkerBridge] Failed to create PDF Worker, falling back to inline execution:", err);
    return null;
  }
}

/**
 * Execute a PDF task on the worker thread. Returns null if the worker cannot be created
 * or if the operation fails, signaling that the caller should fall back to inline generation.
 */
export async function executeInPdfWorker(
  request: PdfWorkerRequest,
  transfer: Transferable[] = [],
  timeoutMs = 30000,
): Promise<{ pdfBuffer: ArrayBuffer; fileName: string } | null> {
  const worker = createPdfWorker();
  if (!worker) return null;

  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      worker.terminate();
      console.warn(`[PdfWorkerBridge] PDF worker timed out after ${timeoutMs}ms, falling back inline`);
      resolve(null);
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent<PdfWorkerReply>) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      worker.terminate();

      if (event.data?.type === "success") {
        resolve({
          pdfBuffer: event.data.pdfBuffer,
          fileName: event.data.fileName,
        });
      } else {
        console.warn("[PdfWorkerBridge] PDF worker returned error:", event.data?.message);
        resolve(null);
      }
    };

    worker.onerror = (err) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      worker.terminate();
      console.warn("[PdfWorkerBridge] PDF worker errored:", err);
      resolve(null);
    };

    try {
      worker.postMessage(request, transfer);
    } catch (postErr) {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      worker.terminate();
      console.warn("[PdfWorkerBridge] Failed to post message to PDF worker:", postErr);
      resolve(null);
    }
  });
}

export async function buildFormDossierPdfInWorker(params: PrintDossierParams): Promise<ArrayBuffer | null> {
  const result = await executeInPdfWorker({
    type: "build_form_dossier_pdf",
    params,
  });
  return result ? result.pdfBuffer : null;
}

export async function buildPortraitDossierPdfInWorker(
  params: ModernPrintableReportParams & { theme?: "light" | "dark"; gridMode?: DossierGridMode },
): Promise<ArrayBuffer | null> {
  const result = await executeInPdfWorker({
    type: "build_portrait_dossier_pdf",
    params,
  });
  return result ? result.pdfBuffer : null;
}

export async function buildClashReportPdfInWorker(params: ClashReportParams): Promise<ArrayBuffer | null> {
  const result = await executeInPdfWorker({
    type: "build_clash_report_pdf",
    params,
  });
  return result ? result.pdfBuffer : null;
}
