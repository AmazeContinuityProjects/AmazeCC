import { describe, expect, it } from "vitest";
import { buildScanPdf, fitOnA4 } from "../lib/scanner/pdf";
import type { Raster } from "../lib/scanner/types";

/** A solid `width × height` RGBA raster — a stand-in for a cleaned page. */
function testRaster(width: number, height: number, fill = 240): Raster {
  return { width, height, data: new Uint8ClampedArray(width * height * 4).fill(fill) };
}

/** Every `/Type /Page` object (the `\b` keeps `/Pages` out of the count). */
const countPages = (buffer: ArrayBuffer): number =>
  (
    Buffer.from(buffer)
      .toString("latin1")
      .match(/\/Type\s*\/Page\b/g) ?? []
  ).length;

const latin1 = (buffer: ArrayBuffer): string => Buffer.from(buffer).toString("latin1");

describe("scanner pdf: fitOnA4", () => {
  it("fills the page with an A4-proportioned capture", () => {
    const fit = fitOnA4(1600, 2263); // √2 portrait, like a phone shot of a sheet
    // Integer pixels can't be exactly √2, so the fit is within a hair of the
    // page edge rather than on it — precision 1 (0.05mm) is the honest bound.
    expect(fit.w).toBeCloseTo(210, 1);
    expect(fit.h).toBeCloseTo(297, 3);
    expect(fit.x).toBeCloseTo(0, 1);
    expect(fit.y).toBeCloseTo(0, 3);
  });

  it("letterboxes a wide capture, centred top and bottom", () => {
    const fit = fitOnA4(2000, 1000);
    expect(fit.w).toBeCloseTo(210, 5);
    expect(fit.h).toBeCloseTo(105, 5);
    expect(fit.x).toBeCloseTo(0, 5);
    expect(fit.y).toBeCloseTo((297 - 105) / 2, 5);
  });

  it("side-bars a tall capture, centred left and right", () => {
    const fit = fitOnA4(500, 3000);
    expect(fit.h).toBeCloseTo(297, 5);
    expect(fit.w).toBeCloseTo(49.5, 5);
    expect(fit.x).toBeCloseTo((210 - 49.5) / 2, 5);
    expect(fit.y).toBeCloseTo(0, 5);
  });

  it("rejects degenerate sizes instead of dividing by zero", () => {
    expect(() => fitOnA4(0, 100)).toThrow(/bad raster size/);
    expect(() => fitOnA4(100, -1)).toThrow(/bad raster size/);
    expect(() => fitOnA4(Number.NaN, 100)).toThrow(/bad raster size/);
  });
});

describe("scanner pdf: buildScanPdf", () => {
  it("refuses an empty document", async () => {
    await expect(buildScanPdf([])).rejects.toThrow(/no pages/);
  });

  it("refuses a raster whose buffer does not match its size", async () => {
    await expect(buildScanPdf([{ width: 2, height: 2, data: new Uint8ClampedArray(3) }])).rejects.toThrow(
      /expected 16/,
    );
  });

  it("writes a real single-page PDF", async () => {
    const blob = await buildScanPdf([testRaster(1600, 2263)]);

    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);

    const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
    expect(String.fromCharCode(...head)).toBe("%PDF-");
    expect(countPages(await blob.arrayBuffer())).toBe(1);
  });

  it("writes one page per raster, in order", async () => {
    const blob = await buildScanPdf([testRaster(400, 600), testRaster(600, 400), testRaster(100, 100)]);
    expect(countPages(await blob.arrayBuffer())).toBe(3);
  });

  it("carries the paper title and creator into the PDF metadata", async () => {
    const blob = await buildScanPdf([testRaster(100, 140)], { title: "Thermodynamics CAT-2" });
    const raw = latin1(await blob.arrayBuffer());
    expect(raw).toContain("Thermodynamics CAT-2");
    expect(raw).toContain("AmazeCC");
  });

  it("falls back to a default title when none is given", async () => {
    const blob = await buildScanPdf([testRaster(100, 140)]);
    expect(latin1(await blob.arrayBuffer())).toContain("Scanned document");
  });
});
