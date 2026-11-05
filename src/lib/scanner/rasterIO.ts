/**
 * The scanner's browser boundary: the only file in `lib/scanner` allowed to
 * touch `<canvas>`, `createImageBitmap` or an `<img>` element.
 *
 * Everything above this file (pipeline, store, pdf, OCR) works on plain
 * `Raster` typed arrays, which is what makes the whole feature unit-testable
 * under jsdom — a DOM that has no working 2D canvas. So every entry point
 * here fails *loudly and typed* (`ScannerDomError`) when the capability is
 * missing, instead of returning half-decoded pixels or `null`.
 *
 * The canvas is always sized to the image (never CSS-sized): pixel dimensions
 * are the contract, and `getImageData` must return exactly `width × height × 4`.
 */

import { fitWithin } from "./imageOps";
import type { Raster } from "./types";

/**
 * A browser capability the call needed is not present.
 *
 * Callers degrade on this deliberately: OCR unavailable → save without text,
 * thumbnail unavailable → list without an image. Never a silent `null`.
 */
export class ScannerDomError extends Error {
  constructor(capability: string, detail?: string) {
    super(detail ? `${capability} unavailable — ${detail}` : `${capability} unavailable in this environment`);
    this.name = "ScannerDomError";
  }
}

/** Guard the raster shape before it reaches a canvas — a wrong length would be silently truncated. */
function assertRaster(raster: Raster): void {
  const expected = raster.width * raster.height * 4;
  if (raster.width <= 0 || raster.height <= 0 || raster.data.length !== expected) {
    throw new Error(
      `raster is ${raster.width}×${raster.height} with ${raster.data.length} bytes, expected ${expected}`,
    );
  }
}

/** A canvas plus its 2D context, or a typed failure when jsdom/SSR has neither. */
function canvas2d(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (typeof document === "undefined") throw new ScannerDomError("canvas", "no document (server-side?)");
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ScannerDomError("canvas 2d context");
  return { canvas, ctx };
}

/** Read the canvas back as a `Raster` — `getImageData`'s shape is the type's shape. */
function readPixels(ctx: CanvasRenderingContext2D, width: number, height: number): Raster {
  const image = ctx.getImageData(0, 0, width, height);
  return { width, height, data: image.data };
}

/** Paint a raster onto a fresh canvas, ready to encode. */
function rasterToCanvas(raster: Raster): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  assertRaster(raster);
  const { canvas, ctx } = canvas2d(raster.width, raster.height);
  const image = ctx.createImageData(raster.width, raster.height);
  image.data.set(raster.data);
  ctx.putImageData(image, 0, 0);
  return { canvas, ctx };
}

/** `HTMLCanvasElement.toBlob` is callback-based; it also legitimately returns null when the type is unsupported. */
function encodeCanvas(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new ScannerDomError("image encode", `encoder rejected ${type}`))),
        type,
        quality,
      );
    } catch (err) {
      reject(new ScannerDomError("image encode", err instanceof Error ? err.message : String(err)));
    }
  });
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

/**
 * Decode a blob into something drawable.
 *
 * `createImageBitmap` first — it decodes off the main thread and is what a
 * camera pipeline wants. The `<img>` + object-URL path covers browsers (and
 * formats) where it fails. Both are attempted before giving up, because "this
 * image cannot be opened" is a user-facing dead end otherwise.
 */
async function decodeSource(blob: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, cleanup: () => bitmap.close() };
    } catch {
      /* fall through to the <img> path */
    }
  }
  if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    throw new ScannerDomError("image decode", "createImageBitmap and createObjectURL are both missing");
  }
  let url: string;
  try {
    url = URL.createObjectURL(blob);
  } catch (err) {
    // Notably Node's URL.createObjectURL rejects jsdom's Blob realm — any
    // failure here means the <img> path is dead too, so fail typed, not raw.
    throw new ScannerDomError("image decode", err instanceof Error ? err.message : String(err));
  }
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("image failed to load"));
      el.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      cleanup: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw new ScannerDomError("image decode", err instanceof Error ? err.message : String(err));
  }
}

/** Decode any image the browser can open (camera JPEG, saved PNG, …) into a `Raster`. */
export async function decodeToRaster(blob: Blob): Promise<Raster> {
  const { source, width, height, cleanup } = await decodeSource(blob);
  try {
    if (!width || !height) throw new ScannerDomError("image decode", "image reports no pixels");
    const { ctx } = canvas2d(width, height);
    ctx.drawImage(source, 0, 0);
    return readPixels(ctx, width, height);
  } finally {
    cleanup();
  }
}

/** Encode a raster as PNG — lossless, what the PDF embeds for scanned pages. */
export function encodePng(raster: Raster): Promise<Blob> {
  const { canvas } = rasterToCanvas(raster);
  return encodeCanvas(canvas, "image/png");
}

/** Encode a raster as JPEG at `quality` (0–1) — thumbnails and light pages. */
export function encodeJpeg(raster: Raster, quality = 0.82): Promise<Blob> {
  const { canvas } = rasterToCanvas(raster);
  return encodeCanvas(canvas, "image/jpeg", quality);
}

/**
 * Synchronous data URL — what `jspdf.addImage` consumes.
 *
 * Sync on purpose: PDF assembly is a single pass, and a promise per page
 * would only add ordering surface for no benefit.
 */
export function rasterToDataUrl(raster: Raster, type = "image/png", quality?: number): string {
  const { canvas } = rasterToCanvas(raster);
  return canvas.toDataURL(type, quality);
}

/** Small JPEG for the library list, capped at `maxDim` on the long edge. */
export function makeThumbnail(raster: Raster, maxDim = 320): Promise<Blob> {
  return encodeJpeg(fitWithin(raster, maxDim), 0.72);
}

/**
 * Grab the current frame of a live camera `<video>` as a `Raster`.
 *
 * Throws when the stream has not produced dimensions yet — drawing a 0×0
 * frame would "succeed" and hand the pipeline an empty image.
 */
export function captureFrame(video: HTMLVideoElement): Raster {
  const { videoWidth: width, videoHeight: height } = video;
  if (!width || !height) throw new ScannerDomError("camera frame", "stream has no dimensions yet");
  const { ctx } = canvas2d(width, height);
  ctx.drawImage(video, 0, 0, width, height);
  return readPixels(ctx, width, height);
}
