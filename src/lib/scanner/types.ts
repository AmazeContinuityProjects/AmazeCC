/**
 * Shared shapes for the Paper Scanner feature.
 *
 * Everything here is deliberately plain data (numbers, strings, typed arrays)
 * with no DOM types, so the pipeline logic in `imageOps`/`nn`/`pipeline` can be
 * unit-tested under jsdom — which has no working `<canvas>` — and the browser
 * only enters the picture in `rasterIO.ts` and the components.
 */

/** A pixel-space point. Origin is the top-left corner of the raster. */
export interface Point {
  x: number;
  y: number;
}

/**
 * The four corners of a page, in reading order (top-left, top-right,
 * bottom-right, bottom-left).
 *
 * Keeping them *named* rather than an array of four means every call site
 * states which corner it means — the classic scanner bug is swapping the
 * diagonal while feeding a homography solver.
 */
export interface Quad {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
}

/**
 * A raw RGBA image.
 *
 * The same shape `getImageData` hands back, kept as its own type so the pure
 * pipeline never touches `ImageData` (which jsdom does not implement).
 * `data.length` is always `width * height * 4`.
 */
export interface Raster {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** How a captured page is cleaned before it becomes PDF/OCR input. */
export type CleanupMode = "original" | "grayscale" | "enhanced" | "bw";

/**
 * What the neural net decided the paper is.
 *
 * These labels are the training script's classes — `nn/weights.json` carries
 * the list it was trained on and `nn/model.ts` refuses to classify against a
 * model whose class list it does not know.
 */
export type PaperKind = "exam" | "assignment" | "notes" | "worksheet" | "form" | "other";

/** Human-facing paper kinds, in menu order. */
export const PAPER_KINDS: readonly PaperKind[] = ["exam", "assignment", "notes", "worksheet", "form", "other"];

/** Specific exam categories recognized from question papers and assessments. */
export type ExamCategory = "FAT" | "CAT 1" | "CAT 2" | "Lab FAT" | "Supplementary" | "Other";

export interface ExamDetails {
  category: ExamCategory;
  rawExamName?: string;
  session?: string; // e.g. "May 2024"
  month?: string; // e.g. "May"
  year?: number; // e.g. 2024
  semester?: string; // e.g. "Winter Semester 2023-24"
  shortSemester?: string; // e.g. "Winter 2023-24"
  academicYear?: string; // e.g. "2023-24"
  term?: "Winter" | "Fall" | "Summer";
  slot?: string; // e.g. "C1"
  classNbr?: string; // e.g. "5493"
  regNo?: string; // e.g. "21600019"
  maxMarks?: number; // e.g. 100
  duration?: string; // e.g. "Three Hours"
  courseCode?: string; // e.g. "BGER101L"
  courseTitle?: string; // e.g. "German"
}

/** Where OCR text came from — surfaced in the UI so results are never a mystery. */
export type OcrEngineId = "tesseract" | "ocr.space" | "none";

/**
 * Upload state of a saved scan.
 *
 * Local-first: everything starts as `local` (safe in this device's IndexedDB).
 * The rest only ever happen if the student has configured an upload endpoint.
 */
export type UploadStatus = "local" | "queued" | "uploading" | "uploaded" | "failed";

/** Crude readability verdict — heuristic, never presented as the neural net's. */
export interface QualityVerdict {
  /** 0–100. */
  score: number;
  label: "clean" | "usable" | "poor";
}

/** The metadata half of a saved scan — everything `list()` returns. */
export interface ScanMeta {
  id: string;
  createdAt: number;
  /** Student-editable. Starts from the neural net's guess + extracted hints. */
  title: string;
  /** Extracted hints, best-effort — `""` when the paper did not carry one. */
  subjectCode: string;
  kind: PaperKind;
  /** 0–1 — the net's softmax confidence in `kind`. */
  kindConfidence: number;
  pageCount: number;
  /** Bytes of the generated PDF, for the storage-safety row. */
  sizeBytes: number;
  quality: QualityVerdict;
  /** Structured exam details if this scan is an exam paper or assessment */
  exam?: ExamDetails | null;
  /** Null when OCR was unavailable (e.g. offline with no API key). */
  ocr: {
    engine: OcrEngineId;
    /** 0–100 when the engine reported one, else null. */
    confidence: number | null;
    /** First characters of the extracted text, for the library list. */
    preview: string;
  } | null;
  upload: {
    status: UploadStatus;
    url?: string;
    error?: string;
    lastTriedAt?: number;
  };
}

/** A saved scan: the metadata plus the heavy payloads kept out of `list()`. */
export interface ScanRecord {
  meta: ScanMeta;
  /** The generated PDF. */
  pdf: Blob;
  /** Small preview image for the library list, when one could be made. */
  thumbnail?: Blob;
  /** Full OCR text (already capped) — kept with the payload, not the meta. */
  ocrText?: string;
}
