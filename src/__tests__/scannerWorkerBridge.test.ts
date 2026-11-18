import { describe, expect, it } from "vitest";
import { detectQuadAsync, processScanPagesAsync } from "../lib/scanner/scannerWorkerBridge";
import { detectQuad, rasterFromGray, warpSizeFor } from "../lib/scanner/imageOps";
import type { Quad, Raster } from "../lib/scanner/types";

/** Synthetic dark desk with bright white sheet. */
function photoWithSheet(): Raster {
  const width = 320;
  const height = 240;
  const gray = new Uint8ClampedArray(width * height).fill(30);
  for (let y = 30; y < 210; y++) {
    for (let x = 40; x < 280; x++) {
      gray[y * width + x] = 230;
    }
  }
  return rasterFromGray(gray, width, height);
}

describe("scannerWorkerBridge", () => {
  it("detects document quad correctly", async () => {
    const raster = photoWithSheet();
    const syncQuad = detectQuad(raster);
    const asyncQuad = await detectQuadAsync(raster);

    expect(asyncQuad).not.toBeNull();
    expect(asyncQuad).toEqual(syncQuad);
  });

  it("processes a single page batch with progress callbacks", async () => {
    const raster = photoWithSheet();
    const progress: { done: number; total: number }[] = [];

    const result = await processScanPagesAsync([{ raster }], "enhanced", (done, total) =>
      progress.push({ done, total }),
    );

    expect(result.cleaned).toHaveLength(1);
    expect(result.stats).toBeDefined();
    expect(result.stats.quadFill).toBeGreaterThan(0);
    expect(progress).toEqual([{ done: 1, total: 1 }]);
  });

  it("processes multiple pages and preserves page count and dimensions", async () => {
    const r1 = photoWithSheet();
    const r2 = photoWithSheet();

    const result = await processScanPagesAsync([{ raster: r1 }, { raster: r2 }], "bw");

    expect(result.cleaned).toHaveLength(2);
    expect(result.cleaned[0].width).toBeGreaterThan(0);
    expect(result.cleaned[1].width).toBeGreaterThan(0);
  });

  it("handles user-provided manual quad override without re-detecting", async () => {
    const raster = photoWithSheet();
    const customQuad: Quad = {
      tl: { x: 50, y: 50 },
      tr: { x: 200, y: 50 },
      br: { x: 200, y: 180 },
      bl: { x: 50, y: 180 },
    };

    const expectedSize = warpSizeFor(customQuad);
    const result = await processScanPagesAsync([{ raster, quad: customQuad }], "original");

    expect(result.cleaned[0].width).toBe(expectedSize.width);
    expect(result.cleaned[0].height).toBe(expectedSize.height);
  });
});
