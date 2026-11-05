/**
 * OCR for scanned pages: on-device by default, cloud as an optional upgrade.
 *
 * Two engines, deliberately:
 *
 *   • tesseract.js (default) — runs in the browser, needs no key and no
 *     account. It fetches its wasm + language data from a CDN on *first* use,
 *     so the one thing it genuinely needs is a connection, once. When that is
 *     missing the failure is typed and human ("check your connection and try
 *     again"), never a spinner that never ends.
 *   • OCR.space (opt-in) — for students who paste a key into scanner
 *     settings: faster on low-end phones, keeps the main thread free, costs
 *     their quota instead of their battery.
 *
 * `engine: "auto"` tries local first and only spends API quota when the local
 * leg cannot start — the API is a fallback, not a metered default. An explicit
 * `"ocr.space"` is strict: a chosen engine that silently switches would be
 * harder to reason about than a typed error that names the fix.
 *
 * tesseract's default CDN worker/core paths are used on purpose — they are
 * the only configuration this project can actually verify end to end.
 *
 * Every failure mode is an {@link OcrUnavailableError} carrying the engine it
 * happened on, so the pipeline can decide between "save without text" and
 * "tell the student".
 */

import type { OcrEngineId } from "./types";

/** Which engine to run: the two real ones, or local-then-cloud. */
export type OcrEngineChoice = "tesseract" | "ocr.space" | "auto";

export type OcrResultEngine = Exclude<OcrEngineId, "none">;

export interface OcrResult {
  engine: OcrResultEngine;
  /** Pages' text, joined with a blank line. May be empty — an empty page is a valid read. */
  text: string;
  /** 0–100 when the engine reported one (tesseract does, OCR.space does not). */
  confidence: number | null;
  /** Pages read. */
  pages: number;
}

/** OCR could not run (or stopped early for a real reason) — never a `null` string. */
export class OcrUnavailableError extends Error {
  readonly engine: OcrResultEngine;
  constructor(engine: OcrResultEngine, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "OcrUnavailableError";
    this.engine = engine;
  }
}

export interface OcrOptions {
  /** Default `"tesseract"` — local, keyless, offline after first load. */
  engine?: OcrEngineChoice;
  /** OCR.space key: required for `"ocr.space"`, enables the fallback leg of `"auto"`. */
  apiKey?: string;
  /** Override for tests / self-hosted mirrors. */
  apiEndpoint?: string;
  /** Tesseract/OCR.space language tag. Default `"eng"`. */
  lang?: string;
  /** Called after each page as `(done, total)`. */
  onProgress?: (done: number, total: number) => void;
  /**
   * Cancellation. Honoured before start, between tesseract pages, and passed
   * to `fetch` — tesseract cannot be interrupted mid-page, and pretending
   * otherwise would leave an orphaned worker behind.
   */
  signal?: AbortSignal;
}

const OCR_SPACE_ENDPOINT = "https://api.ocr.space/parse/image";
const TESSERACT_LANG = "eng";
/** Cap so a 60-page booklet cannot balloon a record meant for a preview. */
const MAX_TEXT = 60_000;

/* ------------------------------------------------------------- engines */

let tesseractModule: Promise<typeof import("tesseract.js")> | undefined;
const loadTesseract = () => (tesseractModule ??= import("tesseract.js"));

/** The slice of tesseract's worker this file uses — keeps the mock honest. */
interface TesseractWorker {
  recognize(image: Blob): Promise<{ data: { text?: string; confidence?: number } }>;
  terminate(): Promise<unknown>;
}
type CreateWorker = (lang?: string) => Promise<TesseractWorker>;

/**
 * Start a worker through the CJS/ESM interop seam: bundlers expose named
 * exports, plain Node exposes the namespace on `default`.
 */
async function startTesseract(lang: string): Promise<TesseractWorker> {
  const mod = (await loadTesseract()) as unknown as {
    createWorker?: CreateWorker;
    default?: { createWorker?: CreateWorker };
  };
  const createWorker = mod.createWorker ?? mod.default?.createWorker;
  if (!createWorker) throw new Error("tesseract.js did not export createWorker");
  return createWorker(lang);
}

/** OCR.space's response shape (verified against the live API). */
interface SpaceResponse {
  ParsedResults?: Array<{ ParsedText?: string; ErrorMessage?: string }>;
  OCRExitCode?: number;
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string;
  ErrorDetails?: string;
}

const joinPages = (texts: string[]): string => {
  const joined = texts.join("\n\n");
  return joined.length > MAX_TEXT ? joined.slice(0, MAX_TEXT) : joined;
};

const mean = (values: number[]): number => Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;

const abortError = (signal: AbortSignal | undefined, err: unknown): boolean =>
  signal?.aborted === true || (err instanceof DOMException && err.name === "AbortError");

async function ocrTesseract(images: readonly Blob[], options: OcrOptions): Promise<OcrResult> {
  let worker: TesseractWorker;
  try {
    worker = await startTesseract(options.lang ?? TESSERACT_LANG);
  } catch (err) {
    throw new OcrUnavailableError(
      "tesseract",
      "OCR could not start — the engine downloads itself on first use, so check your connection and try again.",
      err,
    );
  }

  try {
    const texts: string[] = [];
    const confidences: number[] = [];
    for (let i = 0; i < images.length; i++) {
      options.signal?.throwIfAborted();
      const { data } = await worker.recognize(images[i]);
      texts.push(data.text ?? "");
      if (typeof data.confidence === "number") confidences.push(data.confidence);
      options.onProgress?.(i + 1, images.length);
    }
    return {
      engine: "tesseract",
      text: joinPages(texts),
      confidence: confidences.length > 0 ? mean(confidences) : null,
      pages: images.length,
    };
  } catch (err) {
    // An abort is the caller's intent, not an engine failure — never relabel it.
    if (abortError(options.signal, err)) throw err;
    throw new OcrUnavailableError("tesseract", "OCR stopped while reading this scan.", err);
  } finally {
    await worker.terminate().catch(() => {});
  }
}

/** Pull the API's own explanation off an error status, when it bothered to send one. */
async function spaceErrorDetail(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as SpaceResponse;
    return body.ErrorMessage || body.ErrorDetails || body.ParsedResults?.[0]?.ErrorMessage || null;
  } catch {
    return null;
  }
}

async function ocrSpace(images: readonly Blob[], options: OcrOptions): Promise<OcrResult> {
  const apiKey = options.apiKey?.trim();
  if (!apiKey) {
    throw new OcrUnavailableError(
      "ocr.space",
      "Cloud OCR needs an API key — add one in scanner settings, or switch back to on-device OCR.",
    );
  }
  const endpoint = options.apiEndpoint ?? OCR_SPACE_ENDPOINT;
  const texts: string[] = [];

  for (let i = 0; i < images.length; i++) {
    options.signal?.throwIfAborted();
    const form = new FormData();
    form.append("apikey", apiKey);
    form.append("language", options.lang ?? TESSERACT_LANG);
    form.append("isOverlayRequired", "false");
    form.append("file", images[i], `page-${i + 1}.png`);

    let response: Response;
    try {
      response = await fetch(endpoint, { method: "POST", body: form, signal: options.signal });
    } catch (err) {
      if (abortError(options.signal, err)) throw err;
      throw new OcrUnavailableError("ocr.space", "Cloud OCR could not reach OCR.space — check your connection.", err);
    }
    if (!response.ok) {
      // Bad keys and exhausted quota arrive as JSON on an error status.
      const detail = await spaceErrorDetail(response);
      throw new OcrUnavailableError(
        "ocr.space",
        detail ?? `Cloud OCR was rejected (HTTP ${response.status}) — check the API key in scanner settings.`,
      );
    }

    let body: SpaceResponse;
    try {
      body = (await response.json()) as SpaceResponse;
    } catch (err) {
      throw new OcrUnavailableError("ocr.space", "Cloud OCR returned a response the app could not read.", err);
    }
    if (body.IsErroredOnProcessing || body.OCRExitCode !== 1 || !Array.isArray(body.ParsedResults)) {
      throw new OcrUnavailableError(
        "ocr.space",
        body.ErrorMessage || body.ParsedResults?.[0]?.ErrorMessage || "Cloud OCR could not read this page.",
      );
    }
    for (const parsed of body.ParsedResults) texts.push(parsed?.ParsedText ?? "");
    options.onProgress?.(i + 1, images.length);
  }

  return { engine: "ocr.space", text: joinPages(texts), confidence: null, pages: images.length };
}

/* --------------------------------------------------------------- entry */

/**
 * Read every page's text with the configured engine.
 *
 * Images are PNG blobs (see `rasterIO.encodePng`), one per page, in order.
 * Rejects with {@link OcrUnavailableError} when the chosen engine cannot run;
 * resolves with empty `text` when it ran and found nothing — those are
 * different facts and the UI says different things about them.
 */
export async function runOcr(images: readonly Blob[], options: OcrOptions = {}): Promise<OcrResult> {
  if (images.length === 0) throw new Error("runOcr: no images to read");
  options.signal?.throwIfAborted();

  const engine = options.engine ?? "tesseract";
  if (engine === "tesseract") return ocrTesseract(images, options);
  if (engine === "ocr.space") return ocrSpace(images, options);

  // "auto": local first, and the cloud leg only exists when a key does.
  try {
    return await ocrTesseract(images, options);
  } catch (err) {
    if (err instanceof OcrUnavailableError && options.apiKey && !abortError(options.signal, err)) {
      return ocrSpace(images, options);
    }
    throw err;
  }
}
