/**
 * The Paper Scanner orchestrator — capture frame in, saved scan out.
 *
 * One function, {@link processScan}, walks the whole path the feature is
 * defined by:
 *
 *   raster → detectQuad → warp → cleanup → PDF → OCR → classify → IndexedDB
 *
 * and, only after the scan is safely stored, the upload leg
 * (`local → queued → uploading → uploaded | failed` — see `uploadStoredScan`).
 *
 * Design rules this file keeps:
 *
 * - **Pure-TS inputs.** Pages arrive as `Raster`s (the camera/editor hands
 *   them over); canvas lives in `rasterIO`, so every branch here runs under
 *   jsdom in tests.
 * - **Local-first is structural, not a flag.** The record is `put` before any
 *   network call, and an upload failure (or no endpoint at all) can never
 *   lose the scan — worst case the meta says `failed` with the server's
 *   message and the PDF is still on the device.
 * - **OCR is best-effort, the PDF is not.** An offline engine or a missing
 *   canvas kills only the text leg: the scan saves with `ocr: null` plus an
 *   `onWarning`, because a phone that lost connection while photographing a
 *   paper must still be able to keep it.
 * - **Everything slow reports progress.** `onProgress` walks the stages
 *   `pages → ocr → pdf → save → upload → done`; each stage carries
 *   `done/total` for a determinate indicator.
 */

import {
  applyCleanup,
  detectQuad,
  fullFrameQuad,
  imageStats,
  quadArea,
  warpQuad,
  warpSizeFor,
  type ImageStats,
} from "./imageOps";
import { classifyScan } from "./nn/model";
import { classifyExamPaper, buildExamTitle } from "./examClassifier";
import { OcrUnavailableError, runOcr, type OcrResult } from "./ocr";
import { buildScanPdf } from "./pdf";
import { encodePng, makeThumbnail, ScannerDomError } from "./rasterIO";
import { loadScannerSettings, type ScannerSettings } from "./settings";
import type { ScanMeta, ScanRecord, CleanupMode, PaperKind, Quad, Raster } from "./types";
import { uploadScan, UploadError } from "./upload";
import type { ScanStore } from "./store";

/* ------------------------------------------------------------- shapes */

/** One page handed to the pipeline: the captured frame and (optionally) the corners the student settled on. */
export interface ProcessScanPage {
  raster: Raster;
  /** Final corners — auto-detected when absent, student-adjusted from the editor when present. */
  quad?: Quad;
}

export type ScanStage = "pages" | "ocr" | "pdf" | "save" | "upload" | "done";

export interface ScanProgress {
  stage: ScanStage;
  done: number;
  total: number;
}

/** Non-fatal side quests the UI surfaces as toasts/inline notes. */
export type ScanWarning =
  | { kind: "ocr-unavailable"; error: OcrUnavailableError | ScannerDomError }
  | { kind: "thumbnail-failed"; error: unknown }
  | { kind: "upload-failed"; error: unknown };

/** Injectable seams — every one defaults to the real module, tests pass fakes. */
export interface ScanPipelineDeps {
  store: ScanStore;
  /** Clock, for `createdAt`/`lastTriedAt`. */
  now?: () => number;
  newId?: () => string;
  runOcr?: typeof runOcr;
  uploadScan?: typeof uploadScan;
  makeThumbnail?: typeof makeThumbnail;
}

export interface ProcessScanOptions {
  /** Loaded from storage when omitted. */
  settings?: ScannerSettings;
  /** Editor's per-scan cleanup choice; falls back to `settings.defaultCleanup`. */
  cleanup?: CleanupMode;
  /** Student-typed title — wins over every extraction hint. */
  title?: string;
  /** Student-typed subject code — wins over extraction. */
  subjectCode?: string;
  /** Upload after saving. Defaults to `settings.autoUpload` (endpoint permitting). */
  upload?: boolean;
  signal?: AbortSignal;
  onProgress?: (progress: ScanProgress) => void;
  onWarning?: (warning: ScanWarning) => void;
}

export interface UploadRunOptions {
  settings?: ScannerSettings;
  signal?: AbortSignal;
  onProgress?: (progress: ScanProgress) => void;
}

/* ------------------------------------------------------------ helpers */

function defaultId(): string {
  const c: Crypto | undefined = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Library-row preview: one line, capped — the list renders it as a subtitle. */
const previewOf = (text: string): string => text.replace(/\s+/g, " ").trim().slice(0, 120);

/** Net's guess as a default title when the paper carries no usable heading. */
const KIND_TITLE: Record<PaperKind, string> = {
  exam: "Exam paper",
  assignment: "Assignment",
  notes: "Notes",
  worksheet: "Worksheet",
  form: "Form",
  other: "Scanned paper",
};

/* ---------------------------------------------------- hint extraction */

export interface PaperHints {
  /** `""` when the paper carried no recognisable code. */
  subjectCode: string;
  /** `""` when no heading survived OCR. */
  title: string;
}

/** VIT-style course code: 2–6 letters + 3 digits + 0–2 letters (`BCSE204L`, `BITE312E`). */
const COURSE_CODE = "[A-Z]{2,6}\\d{3}[A-Z]{0,2}";
const BARE_CODE = new RegExp(`\\b${COURSE_CODE}\\b`, "gi");

/** All-caps tokens that fit the code shape without being one — OCR footers, not subjects. */
const CODE_DENY = new Set([
  "PAGE",
  "DATE",
  "TIME",
  "FIG",
  "TABLE",
  "NOTE",
  "FORM",
  "DOC",
  "BOX",
  "ITEM",
  "ROLL",
  "QTY",
  "REV",
  "LINE",
  "SR",
  "NO",
]);

/** Codes named by a label ("Course Code : …") outrank a bare scan of the page. */
const LABELED_CODE = new RegExp(
  String.raw`(?:course|subject|subj)\s*(?:code\b)?[^a-z0-9]{0,10}(?:and\s*(?:course|subject)\s*name\s*)?[:.+=\-–—]*\s*(${COURSE_CODE})`,
  "i",
);

const TITLE_PATTERNS: RegExp[] = [
  /(?:course|subject)\s*name\b[^a-z0-9]{0,10}[:.+=\-–—]*\s*([^\n]{1,80})/i,
  new RegExp(String.raw`(?:course|subject)\s*code\s*[,;:]\s*(${COURSE_CODE})\s*[,;:\-–—]\s*([^\n]{1,80})`, "i"),
  /(?:^|\n)[^\S\n]*(?:course|subject)\s*[:.+=\-–—]+\s*([^\n]{1,80})/i,
];

/** Strip a leading course code and separator junk from a title candidate. */
function cleanTitle(raw: string): string {
  const noCode = raw.replace(new RegExp(String.raw`^\s*${COURSE_CODE}\s*[,;:/\-–—]?\s*`, "i"), "");
  const cleaned = noCode
    .replace(/^[^a-z0-9]+/i, "")
    .replace(/\s*[|]+\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 80 ? `${cleaned.slice(0, 79).trimEnd()}…` : cleaned;
}

/** First heading-ish line of the text — keywords the other patterns missed. */
function headingLine(text: string): string | null {
  for (const line of text.split("\n").slice(0, 40)) {
    const trimmed = line.trim();
    if (
      trimmed.length >= 4 &&
      trimmed.length <= 80 &&
      /(course|subject|unit|chapter|assignment|lecture|tutorial)/i.test(trimmed)
    ) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Best-effort subject code + title from OCR text.
 *
 * Labeled patterns first (they are what real papers actually carry), then a
 * bare code scan filtered through a deny-list, then a keyword heading. Empty
 * strings — never fabricated values: the student fills what OCR lost.
 */
export function extractPaperHints(text: string): PaperHints {
  if (!text.trim()) return { subjectCode: "", title: "" };

  let subjectCode = "";
  /** Letters before the digits — what a code-shaped token shares with `PAGE123`/`PAGE`. */
  const codePrefix = (code: string): string => code.replace(/[^A-Z].*$/, "");
  const labeled = LABELED_CODE.exec(text);
  if (labeled && !CODE_DENY.has(codePrefix(labeled[1].toUpperCase()))) {
    subjectCode = labeled[1].toUpperCase();
  } else {
    for (const match of text.toUpperCase().matchAll(BARE_CODE)) {
      if (!CODE_DENY.has(codePrefix(match[0]))) {
        subjectCode = match[0];
        break;
      }
    }
  }

  let title = "";
  for (const pattern of TITLE_PATTERNS) {
    const match = pattern.exec(text);
    if (!match) continue;
    // Pattern 2 captures code and name in separate groups — prefer the name;
    // the others' value lives in group 1.
    const candidate = match[2] !== undefined && match[2].trim() !== "" ? match[2] : match[1];
    const cleaned = cleanTitle(candidate);
    if (cleaned) {
      title = cleaned;
      break;
    }
  }
  if (!title) title = headingLine(text) ?? "";

  return { subjectCode, title };
}

/* ------------------------------------------------------ quality verdict */

/**
 * Heuristic readability verdict — deliberately *not* the neural net's.
 *
 * Combines what the image looks like (contrast, ink, edges, how well the
 * quad framed the page) with how well OCR did, as a cross-check that the
 * text was actually readable rather than merely present. The label is what
 * the library shows; the score exists so thresholds are testable, not
 * magical.
 */
export function assessQuality(stats: ImageStats, ocrConfidence: number | null): ScanMeta["quality"] {
  let score = 40;

  if (stats.contrast >= 0.2 && stats.contrast <= 0.85) score += 20;
  else if (stats.contrast < 0.1)
    score -= 25; // flat: dim light or blown out
  else score += 5;

  if (stats.inkRatio >= 0.02 && stats.inkRatio <= 0.4) score += 15;
  else if (stats.inkRatio < 0.005)
    score -= 35; // nothing on the page
  else score -= 10; // flooded dark

  if (stats.edgeDensity >= 0.01 && stats.edgeDensity <= 0.35) score += 10;
  else if (stats.edgeDensity < 0.005) score -= 15; // no text structure: blur or blank

  score += stats.quadFill >= 0.5 ? 10 : -5;

  if (ocrConfidence !== null) {
    if (ocrConfidence >= 70) score += 10;
    else if (ocrConfidence < 40) score -= 15;
  }

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return { score: clamped, label: clamped >= 75 ? "clean" : clamped >= 45 ? "usable" : "poor" };
}

/* ------------------------------------------------------------- upload */

/** URL-safe, capped filename for the `files` part — archives stay findable. */
export function scanFilename(title: string): string {
  const base = title
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
  return base ? `${base}.pdf` : "scan.pdf";
}

/**
 * Upload an already-saved scan, persisting every status transition.
 *
 * The chain `queued → uploading → uploaded | failed` is written to the store
 * as it happens, so a reload mid-upload shows an honest state (and a
 * cancellation falls back to `queued`, not `failed` — nothing broke, the
 * bytes just never went out). Rejections propagate after the status is
 * written: the caller decides how loudly to say it.
 */
export async function uploadStoredScan(
  id: string,
  deps: ScanPipelineDeps,
  options: UploadRunOptions = {},
): Promise<ScanMeta> {
  const settings = options.settings ?? loadScannerSettings();
  const endpoint = settings.uploadEndpoint.trim();
  if (!endpoint) {
    // Checked before anything is touched: no endpoint, no status churn.
    throw new UploadError("No upload endpoint is configured — this scan stays on this device.", false);
  }
  const record = await deps.store.get(id);
  if (!record) throw new UploadError(`Upload failed — scan ${id} is no longer on this device.`, false);

  const now = deps.now ?? Date.now;
  const upload = deps.uploadScan ?? uploadScan;
  const emit = (done: number) => options.onProgress?.({ stage: "upload", done, total: 1 });

  emit(0);
  let meta = await deps.store.patch(id, { upload: { status: "queued", lastTriedAt: now() } });
  meta = await deps.store.patch(id, { upload: { status: "uploading", lastTriedAt: now() } });

  try {
    const result = await upload(
      { pdf: record.pdf, thumbnail: record.thumbnail },
      { endpoint, filename: scanFilename(meta.title), signal: options.signal },
    );
    meta = await deps.store.patch(id, { upload: { status: "uploaded", url: result.url, lastTriedAt: now() } });
    emit(1);
    return meta;
  } catch (err) {
    if (options.signal?.aborted || (err instanceof Error && err.name === "AbortError")) {
      await deps.store.patch(id, { upload: { status: "queued", lastTriedAt: now() } });
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    await deps.store.patch(id, { upload: { status: "failed", error: message, lastTriedAt: now() } });
    throw err;
  }
}

/* ----------------------------------------------------------- pipeline */

/**
 * Process captured pages into a saved scan.
 *
 * Order is deliberate: OCR runs *before* the PDF so its extracted course
 * name/code make it into the PDF metadata and record title; the PDF is built
 * before the save (it *is* the artifact); the upload runs last, on top of a
 * record that is already durable.
 */
export async function processScan(
  pages: readonly ProcessScanPage[],
  deps: ScanPipelineDeps,
  options: ProcessScanOptions = {},
): Promise<ScanRecord> {
  if (pages.length === 0) throw new Error("processScan: no pages");
  options.signal?.throwIfAborted();

  const settings = options.settings ?? loadScannerSettings();
  const cleanup = options.cleanup ?? settings.defaultCleanup;
  const now = deps.now ?? Date.now;
  const signal = options.signal;
  const emit = (stage: ScanStage, done: number, total: number) => options.onProgress?.({ stage, done, total });

  /* 1. edges → warp → cleanup, page by page */
  const cleaned: Raster[] = [];
  let stats: ImageStats | null = null;
  for (let i = 0; i < pages.length; i++) {
    signal?.throwIfAborted();
    const { raster, quad: settled } = pages[i];
    const quad = settled ?? detectQuad(raster) ?? fullFrameQuad(raster.width, raster.height);
    const { width, height } = warpSizeFor(quad);
    const page = applyCleanup(warpQuad(raster, quad, width, height), cleanup);
    cleaned.push(page);
    if (stats === null) {
      // quadFill is measured from the corners actually used — an
      // auto-detected miss the student corrected is a *known* fill, not an
      // unknown one.
      const frameArea = raster.width * raster.height;
      stats = imageStats(page, frameArea > 0 ? quadArea(quad) / frameArea : 1);
    }
    emit("pages", i + 1, pages.length);
  }

  /* 2. OCR — best effort; failure narrows to "no text", it never loses the scan */
  let ocr: OcrResult | null = null;
  let ocrText: string | undefined;
  try {
    signal?.throwIfAborted();
    const images: Blob[] = [];
    for (const page of cleaned) images.push(await encodePng(page));
    ocr = await (deps.runOcr ?? runOcr)(images, {
      engine: settings.ocrEngine,
      apiKey: settings.ocrApiKey || undefined,
      signal,
      onProgress: (done, total) => emit("ocr", done, total),
    });
    ocrText = ocr.text.trim() || undefined;
  } catch (err) {
    if (err instanceof OcrUnavailableError || err instanceof ScannerDomError) {
      // Offline first-use, rejected API key, no canvas — all survivable:
      // the scan keeps going with no text, and the UI is told which leg died.
      options.onWarning?.({ kind: "ocr-unavailable", error: err });
    } else {
      throw err; // aborts and genuine bugs are not "OCR unavailable"
    }
  }

  /* 3. classify + hints + exam details + verdict */
  const hints = extractPaperHints(ocrText ?? "");
  const examDetails = ocrText ? classifyExamPaper(ocrText) : null;
  const prediction = classifyScan({
    text: ocrText ?? "",
    ocrConfidence: ocr?.confidence ?? null,
    image: stats,
    pageCount: cleaned.length,
  });

  const finalKind: PaperKind = examDetails?.category ? "exam" : prediction.kind;
  const finalConfidence = examDetails?.category ? Math.max(0.96, prediction.confidence) : prediction.confidence;

  const subjectCode = options.subjectCode?.trim().toUpperCase() || hints.subjectCode || examDetails?.courseCode || "";

  const autoTitle =
    hints.title ||
    (examDetails
      ? buildExamTitle({
          ...examDetails,
          courseCode: subjectCode || examDetails.courseCode,
          courseTitle: hints.title || examDetails.courseTitle,
        })
      : KIND_TITLE[finalKind]);

  const title = options.title?.trim() || autoTitle;
  const quality = assessQuality(stats, ocr?.confidence ?? null);

  /* 4. PDF — the artifact the whole feature exists to produce */
  emit("pdf", 0, 1);
  const pdf = await buildScanPdf(cleaned, { title });
  emit("pdf", 1, 1);

  /* 5. thumbnail — display sugar; its absence is a note, not a failure */
  let thumbnail: Blob | undefined;
  try {
    thumbnail = await (deps.makeThumbnail ?? makeThumbnail)(cleaned[0]);
  } catch (err) {
    options.onWarning?.({ kind: "thumbnail-failed", error: err });
  }

  /* 6. save — the record is durable from here on, no matter what the network does */
  signal?.throwIfAborted();
  const meta: ScanMeta = {
    id: (deps.newId ?? defaultId)(),
    createdAt: now(),
    title,
    subjectCode,
    kind: finalKind,
    kindConfidence: finalConfidence,
    pageCount: cleaned.length,
    sizeBytes: pdf.size,
    quality,
    exam: examDetails,
    ocr: ocr ? { engine: ocr.engine, confidence: ocr.confidence, preview: previewOf(ocr.text) } : null,
    upload: { status: "local" },
  };
  const record: ScanRecord = {
    meta,
    pdf,
    ...(thumbnail ? { thumbnail } : {}),
    ...(ocrText ? { ocrText } : {}),
  };
  await deps.store.put(record);
  emit("save", 1, 1);

  /* 7. upload — strictly after the save, and never fatal to it */
  let finalMeta = meta;
  const wantsUpload = options.upload ?? settings.autoUpload;
  if (wantsUpload && settings.uploadEndpoint.trim()) {
    try {
      finalMeta = await uploadStoredScan(meta.id, deps, {
        settings,
        signal,
        onProgress: (p) => emit(p.stage, p.done, p.total),
      });
    } catch (err) {
      if (signal?.aborted || (err instanceof Error && err.name === "AbortError")) throw err;
      options.onWarning?.({ kind: "upload-failed", error: err });
      finalMeta = (await deps.store.get(meta.id))?.meta ?? meta; // failed status was already patched in
    }
  }

  emit("done", 1, 1);
  return { ...record, meta: finalMeta };
}
