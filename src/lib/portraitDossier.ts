/**
 * Public entry point for the portrait FFCS dossier.
 *
 * The pure renderer lives in `portraitDossier.render.ts` so the PDF worker can
 * import it without pulling in the worker bridge (which would create a
 * circular chunk dependency).
 */
import { renderPortraitDossierPdf, type DossierGridMode } from "./portraitDossier.render";
import type { ModernPrintableReportParams } from "./exportTimetable";

export * from "./portraitDossier.render";

/**
 * Builds the portrait A4 registration dossier.
 * Dispatches to a Web Worker when in vector grid mode, falling back to inline rendering.
 */
export async function createPortraitDossierPdf(
  params: ModernPrintableReportParams & { theme?: "light" | "dark"; gridMode?: DossierGridMode },
): Promise<ArrayBuffer> {
  if (params.gridMode !== "image") {
    try {
      const { buildPortraitDossierPdfInWorker } = await import("./pdfWorkerBridge");
      const workerBuffer = await buildPortraitDossierPdfInWorker(params);
      if (workerBuffer) {
        return workerBuffer;
      }
    } catch {}
  }
  return renderPortraitDossierPdf(params);
}
