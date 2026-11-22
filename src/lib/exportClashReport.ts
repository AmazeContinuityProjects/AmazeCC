/**
 * Public entry point for the structured clash report.
 *
 * The pure renderer lives in `exportClashReport.render.ts` so the PDF worker
 * can import it without pulling in the worker bridge (which would create a
 * circular chunk dependency).
 */
import { renderClashReportPdf, type ClashReportParams } from "./exportClashReport.render";

export * from "./exportClashReport.render";

/**
 * Build the clash report as an A4 portrait PDF.
 * Dispatches generation to a Web Worker when available, falling back to inline rendering.
 */
export async function createClashReportPdf(params: ClashReportParams): Promise<ArrayBuffer> {
  try {
    const { buildClashReportPdfInWorker } = await import("./pdfWorkerBridge");
    const workerBuffer = await buildClashReportPdfInWorker(params);
    if (workerBuffer) {
      return workerBuffer;
    }
  } catch {}
  return renderClashReportPdf(params);
}

/**
 * Build the clash report and hand it to the browser as a download.
 */
export async function downloadClashReportPdf(params: ClashReportParams): Promise<void> {
  const buffer = await createClashReportPdf(params);
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const cleanName = (params.planName || "Timetable").replace(/[^a-zA-Z0-9_-]/g, "_");
  link.href = url;
  link.download = `${cleanName}_FFCS_Clash_Report.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL?.(url), 2000);
}
