/**
 * Scan pages → one PDF, without going near a canvas.
 *
 * jsPDF accepts raw RGBA pixels (`RGBAData`) and `Raster` *is* that shape, so
 * page images go straight into jsPDF's own encoder. That keeps the whole PDF
 * path pure TypeScript — no `toDataURL`, no DOM — which is what makes it
 * unit-testable under jsdom like the rest of `lib/scanner`, and lossless
 * (no second JPEG generation on top of an already-compressed camera capture).
 *
 * jspdf is by far the heaviest scanner dependency (~340KB minified), so it is
 * imported on demand: opening the library list or the camera must not pay for
 * it. The memoised dynamic import mirrors `exportTimetable.ts`.
 */

import type { Raster } from "./types";

let jsPdfModule: Promise<typeof import("jspdf")> | undefined;
const loadJsPdf = () => (jsPdfModule ??= import("jspdf"));

/** A4 portrait in jsPDF's `unit: "mm"` coordinates. */
const PAGE_W = 210;
const PAGE_H = 297;

/**
 * Where a `width × height` raster lands on an A4 page: aspect preserved,
 * contained, centred. Contain (never cover) because cutting off a question
 * bank to fill the page would silently lose the paper's content.
 */
export function fitOnA4(width: number, height: number): { x: number; y: number; w: number; h: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`fitOnA4: bad raster size ${width}×${height}`);
  }
  const scale = Math.min(PAGE_W / width, PAGE_H / height);
  const w = width * scale;
  const h = height * scale;
  return { x: (PAGE_W - w) / 2, y: (PAGE_H - h) / 2, w, h };
}

export interface ScanPdfOptions {
  /** PDF metadata title — the student's paper title when they have set one. */
  title?: string;
}

/**
 * Assemble the cleaned page rasters into a single PDF.
 *
 * One page per raster, in order; each is fitted onto A4 (letterboxed — the
 * page background stays white). Rejects rather than writing a corrupt file
 * when a raster's buffer does not match its declared size.
 */
export async function buildScanPdf(pages: readonly Raster[], options: ScanPdfOptions = {}): Promise<Blob> {
  if (pages.length === 0) throw new Error("buildScanPdf: no pages to write");
  for (const page of pages) {
    const expected = page.width * page.height * 4;
    if (page.width <= 0 || page.height <= 0 || page.data.length !== expected) {
      throw new Error(
        `buildScanPdf: raster is ${page.width}×${page.height} with ${page.data.length} bytes, expected ${expected}`,
      );
    }
  }

  const { jsPDF } = await loadJsPdf();
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.setProperties({
    title: options.title ?? "Scanned document",
    creator: "AmazeCC",
    subject: "Scanned with Paper Scanner",
  });

  pages.forEach((raster, index) => {
    if (index > 0) pdf.addPage();
    const { x, y, w, h } = fitOnA4(raster.width, raster.height);
    // No `format`: jsPDF infers the RGBA path from the data's shape, which is
    // the only input this file ever hands it.
    pdf.addImage({ imageData: raster, x, y, width: w, height: h });
  });

  return pdf.output("blob");
}
