import { describe, expect, it } from "vitest";
import {
  applyCleanup,
  applyHomography,
  detectQuad,
  dist,
  fitWithin,
  fullFrameQuad,
  imageStats,
  orderQuad,
  otsuThreshold,
  quadArea,
  rasterFromGray,
  resizeRaster,
  rotateQuad90,
  rotateRaster90,
  solveHomography,
  toGray,
  warpQuad,
  warpSizeFor,
} from "../lib/scanner/imageOps";
import type { Quad, Raster } from "../lib/scanner/types";

/** A `width × height` raster filled with one gray level. */
function flatGray(width: number, height: number, value: number): Raster {
  const gray = new Uint8ClampedArray(width * height).fill(value);
  return rasterFromGray(gray, width, height);
}

/**
 * A dark frame with a bright axis-aligned rectangle — a synthetic "photo of a
 * sheet on a desk". Returns both the raster and the exact rectangle used.
 */
function photoWithSheet(
  width: number,
  height: number,
  rect: { x: number; y: number; w: number; h: number },
): { raster: Raster; rect: { x: number; y: number; w: number; h: number } } {
  const gray = new Uint8ClampedArray(width * height);
  gray.fill(30); // desk
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      gray[y * width + x] = 235; // paper
    }
  }
  return { raster: rasterFromGray(gray, width, height), rect };
}

describe("scanner imageOps: gray & threshold", () => {
  it("computes luma per Rec. 709 and Otsu's split for a bimodal image", () => {
    const data = new Uint8ClampedArray(8); // 2 pixels × RGBA
    data.set([255, 0, 0, 255]); // pure red → 0.2126*255 ≈ 54
    data.set([0, 255, 0, 255], 4); // green → 0.7152*255 ≈ 182
    const gray = toGray({ width: 2, height: 1, data });
    expect(gray[0]).toBe(54);
    expect(gray[1]).toBe(182);

    // On a perfectly bimodal image Otsu's answer is the first level of the
    // optimal split — here the dark mode itself (30). What matters is that
    // the split cleanly separates the two modes, so assert that directly.
    const split = photoWithSheet(64, 64, { x: 8, y: 8, w: 48, h: 48 });
    const splitGray = toGray(split.raster);
    const threshold = otsuThreshold(splitGray);
    const dark = splitGray.filter((g) => g <= threshold).length;
    const bright = splitGray.filter((g) => g > threshold).length;
    expect(dark).toBe(64 * 64 - 48 * 48); // the desk
    expect(bright).toBe(48 * 48); // the sheet
    expect(threshold).toBeGreaterThanOrEqual(30);
    expect(threshold).toBeLessThan(235);

    // A perfectly flat image has no split to find; 128 keeps callers sane.
    expect(otsuThreshold(toGray(flatGray(16, 16, 77)))).toBe(128);
  });
});

describe("scanner imageOps: quad detection", () => {
  it("finds the sheet's corners inside a photo", () => {
    const { raster, rect } = photoWithSheet(320, 240, { x: 40, y: 30, w: 220, h: 170 });
    const quad = detectQuad(raster);
    expect(quad).not.toBeNull();

    // Detection runs on a downscaled copy, so allow a scaled tolerance
    // (~half a percent of the frame, plus the downscale rounding).
    const tol = 6;
    expect(Math.abs(quad!.tl.x - rect.x)).toBeLessThanOrEqual(tol);
    expect(Math.abs(quad!.tl.y - rect.y)).toBeLessThanOrEqual(tol);
    expect(Math.abs(quad!.br.x - (rect.x + rect.w - 1))).toBeLessThanOrEqual(tol);
    expect(Math.abs(quad!.br.y - (rect.y + rect.h - 1))).toBeLessThanOrEqual(tol);

    // Reading order: the left edge stays vertical and the top edge horizontal
    // (±2px — the 3×3 blur before thresholding softens each corner by a pixel
    // or two, so exact corner coordinates legitimately differ by that much).
    expect(Math.abs(quad!.bl.x - quad!.tl.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(quad!.tr.y - quad!.tl.y)).toBeLessThanOrEqual(2);
  });

  it("gives up rather than guessing when the photo has no page edge", () => {
    // All paper: nothing to detect against.
    expect(detectQuad(flatGray(200, 200, 230))).toBeNull();
    // All dark: same.
    expect(detectQuad(flatGray(200, 200, 20))).toBeNull();
    // A couple of specular specks are not a page.
    const specks = new Uint8ClampedArray(200 * 200);
    specks.fill(25);
    specks[10 * 200 + 10] = 255;
    specks[150 * 200 + 170] = 255;
    expect(detectQuad(rasterFromGray(specks, 200, 200))).toBeNull();
  });
});

describe("scanner imageOps: ordering & homography", () => {
  it("orders shuffled corners into a non-folded reading order", () => {
    const pts = [
      { x: 10, y: 200 }, // bl
      { x: 200, y: 10 }, // tr
      { x: 10, y: 10 }, // tl
      { x: 200, y: 200 }, // br
    ];
    const quad = orderQuad([...pts].reverse());
    expect(quad.tl).toEqual({ x: 10, y: 10 });
    expect(quad.tr).toEqual({ x: 200, y: 10 });
    expect(quad.br).toEqual({ x: 200, y: 200 });
    expect(quad.bl).toEqual({ x: 10, y: 200 });
  });

  it("orders rotated corners too — a page is rarely square to the camera", () => {
    // A square rotated ~40°: ordering must still read TL→TR→BR→BL by angle.
    const center = { x: 100, y: 100 };
    const angle = (40 * Math.PI) / 180;
    const corners = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 150 },
      { x: 50, y: 150 },
    ].map((p) => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      return {
        x: center.x + dx * Math.cos(angle) - dy * Math.sin(angle),
        y: center.y + dx * Math.sin(angle) + dy * Math.cos(angle),
      };
    });
    const quad = orderQuad(corners);
    // Winding must be clockwise on screen: (tr−tl)×(br−tl) > 0 in y-down space.
    const cross = (quad.tr.x - quad.tl.x) * (quad.br.y - quad.tl.y) - (quad.tr.y - quad.tl.y) * (quad.br.x - quad.tl.x);
    expect(cross).toBeGreaterThan(0);
    // And tl really is the top-left-most of the four.
    expect(quad.tl.x + quad.tl.y).toBeLessThanOrEqual(
      Math.min(quad.tr.x + quad.tr.y, quad.br.x + quad.br.y, quad.bl.x + quad.bl.y),
    );
  });

  it("solves a homography that round-trips the four corners", () => {
    const src = fullFrameQuad(100, 100);
    const dst: Quad = {
      tl: { x: 12, y: 8 },
      tr: { x: 95, y: 20 },
      br: { x: 88, y: 96 },
      bl: { x: 4, y: 90 },
    };
    const h = solveHomography([src.tl, src.tr, src.br, src.bl], [dst.tl, dst.tr, dst.br, dst.bl]);
    const pairs: [typeof src.tl, typeof dst.tl][] = [
      [src.tl, dst.tl],
      [src.tr, dst.tr],
      [src.br, dst.br],
      [src.bl, dst.bl],
    ];
    for (const [a, b] of pairs) {
      const mapped = applyHomography(h, a);
      expect(mapped.x).toBeCloseTo(b.x, 6);
      expect(mapped.y).toBeCloseTo(b.y, 6);
    }
  });

  it("refuses a degenerate (collinear) corner set instead of inventing one", () => {
    const src = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    const dst = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 3 },
    ];
    expect(() => solveHomography(src, dst)).toThrow(/Degenerate/);
  });

  it("reports quad area and refuses nothing else", () => {
    expect(quadArea(fullFrameQuad(10, 20))).toBe(171); // (10−1)·(20−1)
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("scanner imageOps: warp", () => {
  it("keeps the sheet's content when warping a perspective quad back to a rectangle", () => {
    // Source: a dark frame with a *perspective* bright trapezoid.
    const W = 120;
    const H = 160;
    const gray = new Uint8ClampedArray(W * H);
    gray.fill(25);
    const quad: Quad = {
      tl: { x: 30, y: 20 },
      tr: { x: 95, y: 35 },
      br: { x: 110, y: 140 },
      bl: { x: 12, y: 125 },
    };
    // Fill the quad by scanline (convex, so y-range per row is bounded by edges).
    for (let y = 0; y < H; y++) {
      const xs: number[] = [];
      const edges: [typeof quad.tl, typeof quad.tr][] = [
        [quad.tl, quad.tr],
        [quad.tr, quad.br],
        [quad.br, quad.bl],
        [quad.bl, quad.tl],
      ];
      for (const [a, b] of edges) {
        if ((a.y <= y && y < b.y) || (b.y <= y && y < a.y)) {
          xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
        }
      }
      if (xs.length >= 2) {
        const lo = Math.max(0, Math.ceil(Math.min(...xs)));
        const hi = Math.min(W - 1, Math.floor(Math.max(...xs)));
        for (let x = lo; x <= hi; x++) gray[y * W + x] = 240;
      }
    }
    const src = rasterFromGray(gray, W, H);

    const { width: outW, height: outH } = warpSizeFor(quad, 96);
    const warped = warpQuad(src, quad, outW, outH);

    // The warped page must be overwhelmingly "paper" (interior samples), with
    // only the anti-aliased border free to differ.
    let paper = 0;
    for (let i = 0; i < warped.data.length; i += 4) {
      if (warped.data[i] > 200) paper++;
    }
    const paperRatio = paper / (outW * outH);
    expect(paperRatio).toBeGreaterThan(0.9);
    // Aspect ratio tracks the quad's *containment* box (the wider of top/bottom
    // edges over the taller of left/right — `warpSizeFor` sizes to contain the
    // whole page, never to crop an edge), not the source frame.
    const quadW = Math.max(dist(quad.tl, quad.tr), dist(quad.bl, quad.br));
    const quadH = Math.max(dist(quad.tl, quad.bl), dist(quad.tr, quad.br));
    expect(outW / outH).toBeCloseTo(quadW / quadH, 1);
  });

  it("leaves sampling outside the photo white, not black", () => {
    const src = flatGray(40, 40, 10);
    const quad: Quad = {
      tl: { x: -10, y: -10 }, // deliberately hangs off the frame
      tr: { x: 30, y: -10 },
      br: { x: 30, y: 30 },
      bl: { x: -10, y: 30 },
    };
    const warped = warpQuad(src, quad, 20, 20);
    // Top-left output pixel samples outside → white (255), not black.
    expect(warped.data[0]).toBe(255);
    // A sample well inside the frame keeps the source gray.
    const inside = warpQuad(src, fullFrameQuad(40, 40), 10, 10);
    expect(inside.data[0]).toBe(10);
  });
});

describe("scanner imageOps: cleanup modes", () => {
  /** A 40×40 photo: mid-grey background, two-tone "print" block. */
  function scruffyPage(): Raster {
    const W = 40;
    const H = 40;
    const gray = new Uint8ClampedArray(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        // Background sits at ~150 (room-light grey), "ink" at ~110.
        gray[y * W + x] = x > 5 && x < 35 && y % 4 < 2 ? 110 : 150;
      }
    }
    return rasterFromGray(gray, W, H);
  }

  it("returns the original untouched for `original`", () => {
    const src = scruffyPage();
    expect(applyCleanup(src, "original")).toBe(src);
  });

  it("`enhanced` stretches the grey cast away and deepens the print", () => {
    const src = scruffyPage();
    const out = applyCleanup(src, "enhanced");
    // Background (was 150) is pushed to near-white by the percentile stretch.
    expect(out.data[0]).toBeGreaterThan(230);
    // Ink is darker than before relative to background — contrast grew.
    const ink = out.data[(20 * 40 + 20) * 4];
    expect(ink).toBeLessThan(out.data[0] - 80);
    // Still grayscale: r = g = b on every pixel.
    for (let p = 0; p < out.data.length; p += 4) {
      expect(out.data[p]).toBe(out.data[p + 1]);
      expect(out.data[p + 1]).toBe(out.data[p + 2]);
    }
  });

  it("`bw` produces only pure black and pure white", () => {
    const out = applyCleanup(scruffyPage(), "bw");
    const values = new Set<number>();
    for (let p = 0; p < out.data.length; p += 4) values.add(out.data[p]);
    for (const v of values) expect([0, 255]).toContain(v);
    expect(values.size).toBe(2);
  });

  it("`grayscale` converts colour to luma channel-for-channel", () => {
    // Two colour modes across enough pixels for the stretch to be real:
    // "ink" red vs "paper" grey. Luma of ink is low, paper high.
    const W = 10;
    const H = 10;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4;
        const ink = x < 5;
        data[p] = ink ? 110 : 240;
        data[p + 1] = ink ? 0 : 240;
        data[p + 2] = ink ? 0 : 240;
        data[p + 3] = 255;
      }
    }
    const out = applyCleanup({ width: W, height: H, data }, "grayscale");
    // Every pixel is now grey…
    for (let p = 0; p < out.data.length; p += 4) {
      expect(out.data[p]).toBe(out.data[p + 1]);
      expect(out.data[p + 1]).toBe(out.data[p + 2]);
    }
    // …with the red ink read dark and the grey paper read bright.
    const inkLuma = out.data[0];
    const paperLuma = out.data[5 * 4];
    expect(inkLuma).toBeLessThan(paperLuma - 100);
    // The red pixel's luma (0.2126·110 ≈ 23) was stretched to the floor.
    expect(inkLuma).toBeLessThan(30);
  });

  it("`enhanced` flattens shadows across a large page using local background estimation", () => {
    const W = 96;
    const H = 96;
    const data = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const p = (y * W + x) * 4;
        // Shadow gradient: left side is 140 (shadowed), right side is 210 (bright paper)
        const shadowLuma = 140 + Math.round((x / W) * 70);
        // Add some ink text in both the shadowed and bright areas
        const isInk = y % 8 === 0 && x % 4 === 0;
        const luma = isInk ? 40 : shadowLuma;
        data[p] = luma;
        data[p + 1] = luma;
        data[p + 2] = luma;
        data[p + 3] = 255;
      }
    }
    const out = applyCleanup({ width: W, height: H, data }, "enhanced");
    // Both left (shadowed) and right paper backgrounds are lifted to bright white
    const leftPaper = out.data[(49 * W + 5) * 4];
    const rightPaper = out.data[(49 * W + 89) * 4];
    expect(leftPaper).toBeGreaterThan(200);
    expect(rightPaper).toBeGreaterThan(200);
    // And ink is dark
    const inkPixel = out.data[(48 * W + 4) * 4];
    expect(inkPixel).toBeLessThan(100);
  });

  it("rotates rasters and quads 90 degrees clockwise", () => {
    const W = 4;
    const H = 2;
    const data = new Uint8ClampedArray(W * H * 4);
    // Top-left pixel is red, bottom-right pixel is blue
    data[0] = 255; // red
    data[3] = 255;
    data[(1 * W + 3) * 4 + 2] = 255; // blue
    data[(1 * W + 3) * 4 + 3] = 255;

    const rotated = rotateRaster90({ width: W, height: H, data });
    expect(rotated.width).toBe(2);
    expect(rotated.height).toBe(4);
    // (0,0) red rotates to top-right: (dx = 2-1-0 = 1, dy = 0)
    expect(rotated.data[(0 * 2 + 1) * 4]).toBe(255);

    const quad: Quad = {
      tl: { x: 0, y: 0 },
      tr: { x: 3, y: 0 },
      br: { x: 3, y: 1 },
      bl: { x: 0, y: 1 },
    };
    const rQuad = rotateQuad90(quad, W, H);
    expect(rQuad.tl.x).toBeLessThanOrEqual(rQuad.tr.x);
    expect(rQuad.tl.y).toBeLessThanOrEqual(rQuad.bl.y);
  });
});

describe("scanner imageOps: stats & resize", () => {
  it("summarises ink, contrast, edges and quad fill", () => {
    const { raster } = photoWithSheet(64, 64, { x: 8, y: 8, w: 48, h: 48 });
    const stats = imageStats(raster, 0.8);
    // ~56% of the frame is the bright sheet → the rest reads as ink/dark.
    expect(stats.inkRatio).toBeGreaterThan(0.3);
    expect(stats.inkRatio).toBeLessThan(0.7);
    expect(stats.contrast).toBeGreaterThan(0.3); // two clear modes
    expect(stats.edgeDensity).toBeGreaterThan(0.005); // the sheet border is an edge
    expect(stats.quadFill).toBe(0.8);
  });

  it("resizes to an exact target and caps by long edge", () => {
    const src = flatGray(100, 50, 9);
    const small = resizeRaster(src, 25, 12);
    expect(small.width).toBe(25);
    expect(small.height).toBe(12);
    expect(small.data.length).toBe(25 * 12 * 4);
    // Interior gray survives resampling.
    expect(small.data[0]).toBeGreaterThanOrEqual(8);
    expect(small.data[0]).toBeLessThanOrEqual(10);

    const thumb = fitWithin(src, 40);
    expect(Math.max(thumb.width, thumb.height)).toBe(40);
    expect(thumb.width / thumb.height).toBeCloseTo(2, 1);
    // Already small enough → same raster back, no needless copy.
    expect(fitWithin(thumb, 40)).toBe(thumb);
  });
});
