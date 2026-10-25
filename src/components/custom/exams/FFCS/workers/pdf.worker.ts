/**
 * Dedicated Web Worker for Offscreen PDF Dossier Building.
 *
 * Slices the high-res captured timetable dossier, encodes page bitmaps,
 * and compiles the multi-page A4 landscape PDF document via jsPDF
 * on a background worker thread — keeping the main UI thread at 60fps
 * with a smooth, responsive rotating loading spinner.
 */

import { jsPDF } from "jspdf";

export interface PdfWorkerRequest {
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

export type PdfWorkerReply =
  | { type: "success"; pdfBuffer: ArrayBuffer; fileName: string }
  | { type: "error"; message: string };

const post = (reply: PdfWorkerReply, transfer: Transferable[] = []) => {
  self.postMessage(reply, transfer);
};

self.onmessage = async (event: MessageEvent<PdfWorkerRequest>) => {
  const data = event.data;
  if (!data || data.type !== "build_dossier_pdf") {
    post({ type: "error", message: "Invalid worker request type" });
    return;
  }

  const {
    timetableName,
    isLight,
    pageWidth = 297,
    pageHeight = 210,
    margin = 10,
  } = data;

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
          ctx.drawImage(
            bitmap,
            0,
            sourceY,
            totalWidth,
            sliceHeightPx,
            0,
            0,
            totalWidth,
            sliceHeightPx
          );
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
};
