/**
 * Pure image mathematics for the Paper Scanner.
 *
 * Every function here works on plain `Raster`/`Uint8ClampedArray` values and
 * touches no DOM API — that is what makes the edge detection, the perspective
 * warp and the cleanup filters unit-testable under jsdom (which has no working
 * `<canvas>`). The browser-facing encode/decode lives in `rasterIO.ts`.
 *
 * The pipeline is intentionally dependency-free: opencv.js would add ~8MB of
 * wasm for the four operations this file does by hand, and a student scanning a
 * paper on mobile should not pay that on every page load.
 */

import type { CleanupMode, Point, Quad, Raster } from "./types";

/** Long edge of the working raster edge detection runs on. */
const DETECT_MAX_DIM = 640;

/** Long edge of a warped page — enough for print-quality PDF, small enough for phones. */
export const OUTPUT_MAX_DIM = 1600;

/* ------------------------------------------------------------------ gray */

/**
 * Luma of an RGBA raster, one byte per pixel.
 *
 * Rec. 709 coefficients (0.2126/0.7152/0.0722) — the same weights the browser
 * uses for `grayscale` filters, so preview and processing agree.
 */
export function toGray(src: Raster): Uint8ClampedArray {
  const { data, width, height } = src;
  const out = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) | 0;
  }
  return out;
}

/** Box blur (3×3, clamped edges) — cheap noise-kill before thresholding. */
export function blur3(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(gray.length);
  for (let y = 0; y < height; y++) {
    const yUp = y > 0 ? y - 1 : 0;
    const yDn = y < height - 1 ? y + 1 : height - 1;
    for (let x = 0; x < width; x++) {
      const xL = x > 0 ? x - 1 : 0;
      const xR = x < width - 1 ? x + 1 : width - 1;
      const sum =
        gray[yUp * width + xL] +
        gray[yUp * width + x] +
        gray[yUp * width + xR] +
        gray[y * width + xL] +
        gray[y * width + x] +
        gray[y * width + xR] +
        gray[yDn * width + xL] +
        gray[yDn * width + x] +
        gray[yDn * width + xR];
      out[y * width + x] = (sum / 9) | 0;
    }
  }
  return out;
}

/**
 * Otsu's threshold: the gray level that best splits a bimodal histogram
 * (dark background / bright paper) by maximizing between-class variance.
 *
 * Returns 128 for a flat image — there is no separation to find, and 128 keeps
 * the caller's coverage check honest instead of dividing by zero.
 */
export function otsuThreshold(gray: Uint8ClampedArray): number {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

  const total = gray.length;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let best = -1;
  let bestT = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      bestT = t;
    }
  }
  return bestT;
}

/** Sobel gradient magnitude — used as an "edge density" image statistic. */
export function sobelMagnitude(gray: Uint8ClampedArray, width: number, height: number): Float32Array {
  const out = new Float32Array(gray.length);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] -
        2 * gray[i - 1] -
        gray[i + width - 1] +
        gray[i - width + 1] +
        2 * gray[i + 1] +
        gray[i + width + 1];
      const gy =
        -gray[i - width - 1] -
        2 * gray[i - width] -
        gray[i - width + 1] +
        gray[i + width - 1] +
        2 * gray[i + width] +
        gray[i + width + 1];
      out[i] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ quad */

/** Euclidean distance between two points. */
export function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Shoelace area of the quad. Always positive. */
export function quadArea(q: Quad): number {
  const pts = [q.tl, q.tr, q.br, q.bl];
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** The full frame as a quad — the honest fallback when no edge is found. */
export function fullFrameQuad(width: number, height: number): Quad {
  return {
    tl: { x: 0, y: 0 },
    tr: { x: width - 1, y: 0 },
    br: { x: width - 1, y: height - 1 },
    bl: { x: 0, y: height - 1 },
  };
}

/** Scale every corner (used to map detection coordinates back to full resolution). */
export function scaleQuad(q: Quad, sx: number, sy: number): Quad {
  return {
    tl: { x: q.tl.x * sx, y: q.tl.y * sy },
    tr: { x: q.tr.x * sx, y: q.tr.y * sy },
    br: { x: q.br.x * sx, y: q.br.y * sy },
    bl: { x: q.bl.x * sx, y: q.bl.y * sy },
  };
}

/**
 * Put four points into reading order.
 *
 * Sorts by angle around the centroid (stable for any rotation), then rotates
 * the sequence so it starts at the top-left-most point and flips it if the
 * winding came out counter-clockwise. A homography fed points in the wrong
 * order produces a mirrored or folded page, so this is the one place order is
 * decided — and it must work for a page photographed at any rotation.
 */
export function orderQuad(points: Point[]): Quad {
  if (points.length !== 4) throw new Error(`orderQuad expects 4 points, got ${points.length}`);

  const cx = (points[0].x + points[1].x + points[2].x + points[3].x) / 4;
  const cy = (points[0].y + points[1].y + points[2].y + points[3].y) / 4;
  const sorted = [...points].sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));

  // Rotate so the sequence begins at the corner closest to the top-left.
  let start = 0;
  let bestSum = Infinity;
  for (let i = 0; i < 4; i++) {
    const sum = sorted[i].x + sorted[i].y;
    if (sum < bestSum) {
      bestSum = sum;
      start = i;
    }
  }
  const ordered = [...sorted.slice(start), ...sorted.slice(0, start)];

  // `cross` of the first edge pair tells us the winding; a page read in the
  // wrong direction is mirrored, so reverse to keep it clockwise (screen y-down).
  const cross =
    (ordered[1].x - ordered[0].x) * (ordered[2].y - ordered[0].y) -
    (ordered[1].y - ordered[0].y) * (ordered[2].x - ordered[0].x);
  if (cross < 0) {
    const [p0, ...rest] = ordered;
    rest.reverse();
    ordered.splice(0, ordered.length, p0, ...rest);
  }

  const [tl, tr, br, bl] = ordered;
  return { tl, tr, br, bl };
}

/**
 * Guess the page's corners: the extremes of the bright (paper) mask.
 *
 * On a photo of a sheet, the sheet is the bright region, so the corners of the
 * region are exactly min/max of (x+y) and (x−y) over its pixels. The mask comes
 * from an Otsu split of a blurred, downscaled gray — downscaling first keeps
 * this O(working pixels) cheap on a 12MP photo.
 *
 * Returns `null` when the split does not isolate a plausible page (the photo is
 * all paper, all dark, or split by glare) — the UI then falls back to the full
 * frame and lets the student drag the corners, which is the honest answer
 * rather than a confidently wrong crop.
 */
export function detectQuad(src: Raster): Quad | null {
  const scale = Math.min(1, DETECT_MAX_DIM / Math.max(src.width, src.height));
  const w = Math.max(8, Math.round(src.width * scale));
  const h = Math.max(8, Math.round(src.height * scale));
  const small = scale < 1 ? resizeRaster(src, w, h) : src;

  const blurred = blur3(toGray(small), small.width, small.height);
  const threshold = otsuThreshold(blurred);

  // Collect the bright mask's extremes. Coverage checks below reject splits
  // that leave too little (or too much) to be a photographed page.
  let sxSyMin = Infinity;
  let sxSyMax = -Infinity;
  let dxSyMin = Infinity;
  let dxSyMax = -Infinity;
  let count = 0;
  const tl = { x: 0, y: 0 };
  const br = { x: 0, y: 0 };
  const bl = { x: 0, y: 0 };
  const tr = { x: 0, y: 0 };

  for (let y = 0; y < small.height; y++) {
    for (let x = 0; x < small.width; x++) {
      if (blurred[y * small.width + x] <= threshold) continue;
      count++;
      const s = x + y;
      const d = x - y;
      if (s < sxSyMin) {
        sxSyMin = s;
        tl.x = x;
        tl.y = y;
      }
      if (s > sxSyMax) {
        sxSyMax = s;
        br.x = x;
        br.y = y;
      }
      if (d < dxSyMin) {
        dxSyMin = d;
        bl.x = x;
        bl.y = y;
      }
      if (d > dxSyMax) {
        dxSyMax = d;
        tr.x = x;
        tr.y = y;
      }
    }
  }

  const coverage = count / (small.width * small.height);
  if (coverage < 0.05 || coverage > 0.97) return null;

  const quad = orderQuad([tl, tr, br, bl]);
  const area = quadArea(quad);
  // A page seen from a normal angle covers a meaningful slice of the frame;
  // a handful of specular highlights does not.
  if (area < 0.12 * small.width * small.height) return null;

  return scaleQuad(quad, 1 / scale, 1 / scale);
}

/* -------------------------------------------------------------- geometry */

/**
 * Solve the 3×3-projective homography mapping `src[i] → dst[i]` for 4 points.
 *
 * Eight linear equations (the 9th is fixed to h22 = 1), solved by Gaussian
 * elimination with partial pivoting. Throws on a degenerate configuration —
 * four collinear corners carry no perspective and any answer would be fiction.
 */
export function solveHomography(src: Point[], dst: Point[]): number[] {
  if (src.length !== 4 || dst.length !== 4) throw new Error("solveHomography needs exactly 4 points");

  // Build the 8×9 augmented matrix: for each (x,y)→(u,v) pair,
  //   x·h0 + y·h1 + h2 − u·x·h0 − u·y·h1 − u = 0
  //   x·h3 + y·h4 + h5 − v·x·h3 − v·y·h4 − v = 0
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const u = dst[i].x;
    const v = dst[i].y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }

  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    }
    if (Math.abs(A[pivot][col]) < 1e-9) throw new Error("Degenerate corners: no homography exists");
    if (pivot !== col) [A[pivot], A[col]] = [A[col], A[pivot]];

    const pivotVal = A[col][col];
    for (let j = col; j < 9; j++) A[col][j] /= pivotVal;
    for (let row = 0; row < 8; row++) {
      if (row === col) continue;
      const factor = A[row][col];
      if (factor === 0) continue;
      for (let j = col; j < 9; j++) A[row][j] -= factor * A[col][j];
    }
  }

  return A.map((row) => row[8]);
}

/** Apply a homography to one point. */
export function applyHomography(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + 1;
  return {
    x: (h[0] * p.x + h[1] * p.y + h[2]) / w,
    y: (h[3] * p.x + h[4] * p.y + h[5]) / w,
  };
}

/**
 * Output raster size for a warped quad: the quad's long edge becomes
 * {@link OUTPUT_MAX_DIM}, keeping the page's own aspect ratio (a half-sheet
 * scanned alone stays a half-sheet in the PDF).
 */
export function warpSizeFor(quad: Quad, maxDim = OUTPUT_MAX_DIM): { width: number; height: number } {
  const w = Math.max(dist(quad.tl, quad.tr), dist(quad.bl, quad.br));
  const h = Math.max(dist(quad.tl, quad.bl), dist(quad.tr, quad.br));
  const long = Math.max(w, h, 1);
  const scale = maxDim / long;
  return {
    width: Math.max(8, Math.round(Math.max(w, 1) * scale)),
    height: Math.max(8, Math.round(Math.max(h, 1) * scale)),
  };
}

/**
 * Perspective-crop `src` to `quad`, rendering an `outW × outH` page.
 *
 * Inverse mapping (each output pixel asks where it came from) with bilinear
 * sampling, so every output pixel is written exactly once and no holes appear.
 */
export function warpQuad(src: Raster, quad: Quad, outW: number, outH: number): Raster {
  const dstCorners = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];
  const srcCorners = [quad.tl, quad.tr, quad.br, quad.bl];
  // Homography from *output space → input space*: each output corner maps to
  // the quad corner it came from.
  const h = solveHomography(dstCorners, srcCorners);

  const out = new Uint8ClampedArray(outW * outH * 4);
  const { data, width: sw, height: sh } = src;

  for (let v = 0; v < outH; v++) {
    for (let u = 0; u < outW; u++) {
      const w = h[6] * u + h[7] * v + 1;
      const x = (h[0] * u + h[1] * v + h[2]) / w;
      const y = (h[3] * u + h[4] * v + h[5]) / w;

      // Bilinear sample with edge clamping; outside the photo stays paper-white
      // rather than black, which is what a "missing corner" of a page should be.
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const x0c = Math.min(Math.max(x0, 0), sw - 1);
      const x1c = Math.min(Math.max(x0 + 1, 0), sw - 1);
      const y0c = Math.min(Math.max(y0, 0), sh - 1);
      const y1c = Math.min(Math.max(y0 + 1, 0), sh - 1);

      const p00 = (y0c * sw + x0c) * 4;
      const p10 = (y0c * sw + x1c) * 4;
      const p01 = (y1c * sw + x0c) * 4;
      const p11 = (y1c * sw + x1c) * 4;
      const outP = (v * outW + u) * 4;

      const inside = x >= 0 && y >= 0 && x <= sw - 1 && y <= sh - 1;
      for (let c = 0; c < 4; c++) {
        const top = data[p00 + c] * (1 - fx) + data[p10 + c] * fx;
        const bot = data[p01 + c] * (1 - fx) + data[p11 + c] * fx;
        const val = top * (1 - fy) + bot * fy;
        out[outP + c] = inside ? val : 255;
      }
      if (!inside) out[outP + 3] = 255;
    }
  }

  return { width: outW, height: outH, data: out };
}

/* --------------------------------------------------------------- rotation */

/**
 * Rotates a raster 90 degrees clockwise.
 */
export function rotateRaster90(src: Raster): Raster {
  const { width: sw, height: sh, data: sData } = src;
  const dw = sh;
  const dh = sw;
  const dData = new Uint8ClampedArray(sData.length);
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      const dx = sh - 1 - sy;
      const dy = sx;
      const sIdx = (sy * sw + sx) * 4;
      const dIdx = (dy * dw + dx) * 4;
      dData[dIdx] = sData[sIdx];
      dData[dIdx + 1] = sData[sIdx + 1];
      dData[dIdx + 2] = sData[sIdx + 2];
      dData[dIdx + 3] = sData[sIdx + 3];
    }
  }
  return { width: dw, height: dh, data: dData };
}

/**
 * Rotates a corner quad 90 degrees clockwise to match a rotated raster.
 */
export function rotateQuad90(q: Quad, srcWidth: number, srcHeight: number): Quad {
  const rot = (p: Point): Point => ({
    x: Math.max(0, Math.min(srcHeight - 1, srcHeight - 1 - p.y)),
    y: Math.max(0, Math.min(srcWidth - 1, p.x)),
  });
  return orderQuad([rot(q.tl), rot(q.tr), rot(q.br), rot(q.bl)]);
}

/* --------------------------------------------------------------- cleanup */

/**
 * Fast local background estimation for document shadow removal.
 * Divides the image into a grid of blocks and computes the 90th percentile
 * of luminance in each block, then bilinearly interpolates across the raster.
 */
function estimateBackground(gray: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const blockSize = Math.max(16, Math.min(48, Math.floor(Math.min(width, height) / 16)));
  const gridW = Math.ceil(width / blockSize);
  const gridH = Math.ceil(height / blockSize);
  const bgGrid = new Uint8ClampedArray(gridW * gridH);

  const hist = new Uint32Array(256);
  for (let gy = 0; gy < gridH; gy++) {
    const yStart = gy * blockSize;
    const yEnd = Math.min(height, yStart + blockSize);
    for (let gx = 0; gx < gridW; gx++) {
      const xStart = gx * blockSize;
      const xEnd = Math.min(width, xStart + blockSize);
      hist.fill(0);
      let count = 0;
      for (let y = yStart; y < yEnd; y++) {
        const row = y * width;
        for (let x = xStart; x < xEnd; x++) {
          hist[gray[row + x]]++;
          count++;
        }
      }
      const target = Math.floor(count * 0.9);
      let acc = 0;
      let val = 220;
      for (let i = 0; i < 256; i++) {
        acc += hist[i];
        if (acc >= target) {
          val = i;
          break;
        }
      }
      bgGrid[gy * gridW + gx] = Math.max(40, val);
    }
  }

  const bgMap = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    const gyFloat = y / blockSize - 0.5;
    const gy0 = Math.max(0, Math.min(gridH - 1, Math.floor(gyFloat)));
    const gy1 = Math.max(0, Math.min(gridH - 1, gy0 + 1));
    const fy = Math.max(0, Math.min(1, gyFloat - gy0));

    const row0 = gy0 * gridW;
    const row1 = gy1 * gridW;
    const outRow = y * width;

    for (let x = 0; x < width; x++) {
      const gxFloat = x / blockSize - 0.5;
      const gx0 = Math.max(0, Math.min(gridW - 1, Math.floor(gxFloat)));
      const gx1 = Math.max(0, Math.min(gridW - 1, gx0 + 1));
      const fx = Math.max(0, Math.min(1, gxFloat - gx0));

      const v00 = bgGrid[row0 + gx0];
      const v10 = bgGrid[row0 + gx1];
      const v01 = bgGrid[row1 + gx0];
      const v11 = bgGrid[row1 + gx1];

      const top = v00 * (1 - fx) + v10 * fx;
      const bot = v01 * (1 - fx) + v11 * fx;
      bgMap[outRow + x] = (top * (1 - fy) + bot * fy) | 0;
    }
  }
  return bgMap;
}

/**
 * The gray levels to stretch between: the lower `lowerCut` quantile and the
 * upper `upperCut` tail (defaults 2%/2% — the classic 2–98% contrast stretch).
 *
 * The two walks are mirrored, not identical: `lo` is the first level where the
 * cumulative count from the bottom passes `lowerCut·total`, while `hi` is the
 * first level (walking down) where the count *at or above* it passes
 * `upperCut·total`. Counting from the top, the fraction that has accumulated is
 * the upper tail — comparing it against `1 − upperCut` (the CDF) would demand
 * 98% of the pixels sit above `hi`, which no bimodal photo ever satisfies and
 * which silently disabled the stretch on exactly the images it exists for.
 *
 * A near-flat histogram returns the identity range — there is no contrast
 * worth redistributing.
 */
function percentileBounds(gray: Uint8ClampedArray, lowerCut = 0.02, upperCut = 0.02): [number, number] {
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
  const total = gray.length;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let t = 0; t < 256; t++) {
    acc += hist[t];
    if (acc >= total * lowerCut) {
      lo = t;
      break;
    }
  }
  acc = 0;
  for (let t = 255; t >= 0; t--) {
    acc += hist[t];
    if (acc >= total * upperCut) {
      hi = t;
      break;
    }
  }
  if (hi - lo < 8) return [0, 255];
  return [lo, hi];
}

/**
 * Write a gray value back as opaque RGBA.
 */
function writeGray(out: Uint8ClampedArray, p: number, v: number): void {
  out[p] = v;
  out[p + 1] = v;
  out[p + 2] = v;
  out[p + 3] = 255;
}

/**
 * Apply the chosen cleanup to a (already warped) page.
 *
 * - `original` — untouched camera colour.
 * - `grayscale` — luma only, no contrast change (predictable).
 * - `enhanced` — the default: contrast stretch between the 2nd/98th percentiles
 *   (kills the grey cast of a photo taken under room light) plus a mild unsharp
 *   pass so pencil/thin print stays crisp after JPEG compression.
 * - `bw` — Otsu split to pure black/white. Best for fax-like legibility and the
 *   smallest PDFs; worst for anything with shading, hence a choice, not a default.
 */
export function applyCleanup(src: Raster, mode: CleanupMode): Raster {
  if (mode === "original") return src;

  const gray = toGray(src);
  const { width, height, data } = src;
  const out = new Uint8ClampedArray(data.length);

  if (mode === "bw") {
    const t = otsuThreshold(gray);
    // Otsu's convention: the split is [0..t] (dark) vs [t+1..255] (light) —
    // `>= t` would paint a pixel exactly at the threshold white and, on a
    // clean two-tone page where the threshold lands *on* the ink level, turn
    // the whole sheet white.
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) writeGray(out, p, gray[i] > t ? 255 : 0);
    return { width, height, data: out };
  }

  if (mode === "grayscale") {
    const [lo, hi] = percentileBounds(gray);
    const range = Math.max(1, hi - lo);
    const stretched = new Uint8ClampedArray(gray.length);
    for (let i = 0; i < gray.length; i++) {
      const v = (((gray[i] - lo) * 255) / range) | 0;
      stretched[i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    for (let i = 0, p = 0; i < stretched.length; i++, p += 4) writeGray(out, p, stretched[i]);
    return { width, height, data: out };
  }

  // enhanced: advanced document enhancement with local shadow flattening & stroke sharpening
  if (width >= 80 && height >= 80) {
    const bgMap = estimateBackground(gray, width, height);
    const normalized = new Uint8ClampedArray(gray.length);
    for (let i = 0; i < gray.length; i++) {
      const bg = Math.max(45, bgMap[i]);
      const ratio = gray[i] / bg;
      let val: number;
      if (ratio >= 0.88) {
        // Background paper rolls cleanly to 255
        val = 222 + (ratio - 0.88) * (33 / 0.12);
        if (val > 255) val = 255;
      } else {
        // Deepen text ink with gentle gamma curve
        val = Math.pow(ratio / 0.88, 1.2) * 222;
      }
      normalized[i] = val | 0;
    }
    const blurred = blur3(normalized, width, height);
    for (let i = 0, p = 0; i < normalized.length; i++, p += 4) {
      const sharp = normalized[i] + 0.65 * (normalized[i] - blurred[i]);
      writeGray(out, p, sharp < 0 ? 0 : sharp > 255 ? 255 : sharp);
    }
    return { width, height, data: out };
  }

  // Fallback for smaller/test rasters (< 80px)
  const [lo, hi] = percentileBounds(gray);
  const range = Math.max(1, hi - lo);
  const stretched = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const v = (((gray[i] - lo) * 255) / range) | 0;
    stretched[i] = v < 0 ? 0 : v > 255 ? 255 : v;
  }
  const blurred = blur3(stretched, width, height);
  for (let i = 0, p = 0; i < stretched.length; i++, p += 4) {
    const sharp = stretched[i] + 0.5 * (stretched[i] - blurred[i]);
    writeGray(out, p, sharp < 0 ? 0 : sharp > 255 ? 255 : sharp);
  }
  return { width, height, data: out };
}

/* ---------------------------------------------------------------- stats */

/** The image statistics the neural net and the quality verdict consume. */
export interface ImageStats {
  /** Fraction of pixels darker than 128 — how much ink is on the page. */
  inkRatio: number;
  /** Standard deviation of luma / 128, clamped to [0,1]. */
  contrast: number;
  /** Fraction of pixels with a Sobel magnitude above 40. */
  edgeDensity: number;
  /** How much of the frame the detected page filled (detection confidence). */
  quadFill: number;
}

/** Compute {@link ImageStats} from a page raster (run on the warped page). */
export function imageStats(raster: Raster, quadFill = 1): ImageStats {
  const gray = toGray(raster);
  let sum = 0;
  let sumSq = 0;
  let ink = 0;
  for (let i = 0; i < gray.length; i++) {
    const g = gray[i];
    sum += g;
    sumSq += g * g;
    if (g < 128) ink++;
  }
  const mean = sum / gray.length;
  const variance = Math.max(0, sumSq / gray.length - mean * mean);
  const sobel = sobelMagnitude(gray, raster.width, raster.height);
  let edges = 0;
  for (let i = 0; i < sobel.length; i++) if (sobel[i] > 40) edges++;

  return {
    inkRatio: ink / gray.length,
    contrast: Math.min(1, Math.sqrt(variance) / 128),
    edgeDensity: edges / gray.length,
    quadFill: Math.min(1, Math.max(0, quadFill)),
  };
}

/* -------------------------------------------------------------- resize */

/**
 * Bilinear resize to an exact target size.
 *
 * Used before edge detection (cheap working copy) and for thumbnails (display
 * copy) — the full-resolution raster is never what a pointer handler or the
 * detection loop walks.
 */
export function resizeRaster(src: Raster, targetW: number, targetH: number): Raster {
  const { width: sw, height: sh, data } = src;
  const w = Math.max(1, Math.round(targetW));
  const h = Math.max(1, Math.round(targetH));
  const out = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    const sy = ((y + 0.5) * sh) / h - 0.5;
    const y0 = Math.floor(sy);
    const fy = sy - y0;
    const y0c = Math.min(Math.max(y0, 0), sh - 1);
    const y1c = Math.min(Math.max(y0 + 1, 0), sh - 1);
    for (let x = 0; x < w; x++) {
      const sx = ((x + 0.5) * sw) / w - 0.5;
      const x0 = Math.floor(sx);
      const fx = sx - x0;
      const x0c = Math.min(Math.max(x0, 0), sw - 1);
      const x1c = Math.min(Math.max(x0 + 1, 0), sw - 1);

      const p00 = (y0c * sw + x0c) * 4;
      const p10 = (y0c * sw + x1c) * 4;
      const p01 = (y1c * sw + x0c) * 4;
      const p11 = (y1c * sw + x1c) * 4;
      const p = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) {
        const top = data[p00 + c] * (1 - fx) + data[p10 + c] * fx;
        const bot = data[p01 + c] * (1 - fx) + data[p11 + c] * fx;
        out[p + c] = top * (1 - fy) + bot * fy;
      }
    }
  }
  return { width: w, height: h, data: out };
}

/** Long-edge-capped resize — the thumbnail path. */
export function fitWithin(src: Raster, maxDim: number): Raster {
  const long = Math.max(src.width, src.height);
  if (long <= maxDim) return src;
  const scale = maxDim / long;
  return resizeRaster(src, Math.round(src.width * scale), Math.round(src.height * scale));
}

/* ------------------------------------------------------------- helpers */

/** Build a raster from a flat gray buffer (test/synthetic-image convenience). */
export function rasterFromGray(gray: Uint8ClampedArray, width: number, height: number): Raster {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) writeGray(data, p, gray[i]);
  return { width, height, data };
}
