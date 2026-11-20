/**
 * Public entry point for the print-friendly FFCS dossier.
 *
 * The pure renderer lives in `formDossier.render.ts` so the PDF worker can
 * import it without pulling in the worker bridge (which would create a
 * circular chunk dependency). Everything else is re-exported for existing
 * consumers.
 */
import { renderFormDossierPdf, type PrintDossierParams } from "./formDossier.render";

export * from "./formDossier.render";

/**
 * Build the print-friendly dossier as an A4 portrait PDF.
 * Offloads generation to a Web Worker when available, falling back to inline main-thread rendering.
 */
export async function createPrintDossierPdf(params: PrintDossierParams): Promise<ArrayBuffer> {
  try {
    const { buildFormDossierPdfInWorker } = await import("./pdfWorkerBridge");
    const workerBuffer = await buildFormDossierPdfInWorker(params);
    if (workerBuffer) {
      return workerBuffer;
    }
  } catch {}
  return renderFormDossierPdf(params);
}

/**
 * Build the print-friendly dossier and hand it to the browser as a download.
 */
export async function downloadPrintDossierPdf(params: PrintDossierParams): Promise<void> {
  const buffer = await createPrintDossierPdf(params);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const cleanName = (params.timetableName || "Timetable").replace(/[^a-zA-Z0-9_-]/g, "_");
  link.href = url;
  link.download = `${cleanName}_FFCS_Print_Dossier.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL?.(url), 2000);
}
