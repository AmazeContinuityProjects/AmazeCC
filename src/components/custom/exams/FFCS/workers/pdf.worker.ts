/**
 * Dedicated Web Worker for Offscreen PDF Building.
 *
 * Compiles multi-page PDF documents via jsPDF on a background worker thread:
 * 1. High-res captured timetable dossier slices (A4 landscape)
 * 2. Print-friendly monochrome form dossier (A4 portrait vector)
 * 3. Modern horizontal timetable portrait dossier (A4 portrait vector)
 * 4. Curriculum & clash report (A4 portrait vector)
 *
 * Keeping the main UI thread at 60fps with smooth, responsive loading feedback.
 */

import { jsPDF } from "jspdf";
import { renderFormDossierPdf, type PrintDossierParams } from "@/lib/formDossier.render";
import { renderPortraitDossierPdf, type DossierGridMode } from "@/lib/portraitDossier.render";
import { renderClashReportPdf, type ClashReportParams } from "@/lib/exportClashReport.render";
import type { ModernPrintableReportParams } from "@/lib/exportTimetable";

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

const post = (reply: PdfWorkerReply, transfer: Transferable[] = []) => {
  self.postMessage(reply, transfer);
};

self.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  const data = event.data;
  if (!data || typeof data !== "object" || !("type" in data)) {
    post({ type: "error", message: "Invalid worker request type" });
    return;
  }

  if (data.type === "build_dossier_pdf") {
    const { timetableName, isLight, pageWidth = 297, pageHeight = 210, margin = 10 } = data;

    try {
      let bitmap = data.imageBitmap;
      if (!bitmap && data.dataUrl) {
        const resp = await fetch(data.dataUrl);
        const blob = await resp.blob();
        bitmap = await createImageBitmap(blob);
      }

      if (!bitmap) {
        throw new Error("No image data or ImageBitmap provided to PDF worker");
      }

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const printWidth = pageWidth - margin * 2;
      const printHeight = pageHeight - margin * 2;

      const totalWidth = bitmap.width;
      const totalHeight = bitmap.height;
      const pxPerMm = totalWidth / printWidth;
      const pageHeightPx = Math.floor(printHeight * pxPerMm);

      let remainingHeight = totalHeight;
      let sourceY = 0;
      let pageIndex = 0;

      while (remainingHeight > 0) {
        if (pageIndex > 0) {
          pdf.addPage("a4", "landscape");
        }
        const sliceHeightPx = Math.min(pageHeightPx, remainingHeight);

        if (typeof OffscreenCanvas !== "undefined") {
          const canvas = new OffscreenCanvas(totalWidth, sliceHeightPx);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = isLight ? "#ffffff" : "#090d16";
            ctx.fillRect(0, 0, totalWidth, sliceHeightPx);
            ctx.drawImage(bitmap, 0, sourceY, totalWidth, sliceHeightPx, 0, 0, totalWidth, sliceHeightPx);
            const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.95 });
            const arrayBuffer = await blob.arrayBuffer();
            const uint8 = new Uint8Array(arrayBuffer);
            const sliceHeightMm = sliceHeightPx / pxPerMm;
            pdf.addImage(uint8, "JPEG", margin, margin, printWidth, sliceHeightMm);
          }
        }

        sourceY += sliceHeightPx;
        remainingHeight -= sliceHeightPx;
        pageIndex++;
      }

      const themeTag = isLight ? "LIGHT" : "DARK";
      const cleanName = (timetableName || "Timetable").replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `${cleanName}_${themeTag}_FFCS_Dossier.pdf`;
      const pdfBuffer = pdf.output("arraybuffer");

      post({ type: "success", pdfBuffer, fileName }, [pdfBuffer]);
    } catch (err) {
      post({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to compile PDF in worker",
      });
    }
    return;
  }

  if (data.type === "build_form_dossier_pdf") {
    try {
      const pdfBuffer = await renderFormDossierPdf(data.params);
      const cleanName = (data.params.timetableName || "Timetable").replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `${cleanName}_FFCS_Print_Dossier.pdf`;
      post({ type: "success", pdfBuffer, fileName }, [pdfBuffer]);
    } catch (err) {
      post({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to compile Form Dossier PDF",
      });
    }
    return;
  }

  if (data.type === "build_portrait_dossier_pdf") {
    try {
      const pdfBuffer = await renderPortraitDossierPdf(data.params);
      const cleanName = (data.params.timetableName || "Timetable").replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `${cleanName}_FFCS_Portrait_Dossier.pdf`;
      post({ type: "success", pdfBuffer, fileName }, [pdfBuffer]);
    } catch (err) {
      post({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to compile Portrait Dossier PDF",
      });
    }
    return;
  }

  if (data.type === "build_clash_report_pdf") {
    try {
      const pdfBuffer = await renderClashReportPdf(data.params);
      const cleanName = (data.params.planName || "Timetable").replace(/[^a-zA-Z0-9_-]/g, "_");
      const fileName = `${cleanName}_FFCS_Clash_Report.pdf`;
      post({ type: "success", pdfBuffer, fileName }, [pdfBuffer]);
    } catch (err) {
      post({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to compile Clash Report PDF",
      });
    }
    return;
  }

  post({ type: "error", message: "Invalid worker request type" });
};
