import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { detectQuad, rasterFromGray, warpSizeFor } from "../lib/scanner/imageOps";
import { OcrUnavailableError, type OcrOptions } from "../lib/scanner/ocr";
import {
  assessQuality,
  extractPaperHints,
  processScan,
  scanFilename,
  uploadStoredScan,
  type ScanPipelineDeps,
  type ScanWarning,
} from "../lib/scanner/pipeline";
import { ScannerDomError } from "../lib/scanner/rasterIO";
import { ScannerSettingsDefaults, type ScannerSettings } from "../lib/scanner/settings";
import { memoryScanStore, type ScanStore } from "../lib/scanner/store";
import {
  PAPER_KINDS,
  type Quad,
  type Raster,
  type ScanMeta,
  type ScanRecord,
  type UploadStatus,
} from "../lib/scanner/types";
import { UploadError } from "../lib/scanner/upload";

/* ------------------------------------------------------------- fixtures */

const NOW = 1_700_000_000_000;
const ENDPOINT = "https://backend.example/api/upload";

/** The OCR text of a real-ish exam header — code, name, marks, instructions. */
const EXAM_TEXT = [
  "B.TECH. DEGREE EXAMINATION",
  "(CAT - II)",
  "Course Code : BCSE204L",
  "Course Name + Data Structures and Algorithms",
  "TIME: 3 HOURS",
  "MAXIMUM MARKS: 50",
  "Register Number: 21BCE10234",
  "SECTION A — Answer ALL questions",
  "1. Define normalisation and list its types with examples.",
  "2. Explain the working of the system with a neat diagram.",
  "Signature of the Invigilator",
].join("\n");

/** Net's guess as default title — mirrors `KIND_TITLE` in pipeline.ts. */
const KIND_TITLE = {
  exam: "Exam paper",
  assignment: "Assignment",
  notes: "Notes",
  worksheet: "Worksheet",
  form: "Form",
  other: "Scanned paper",
} as const;

/** A dark desk with a bright sheet — the synthetic capture all suites use. */
function photoWithSheet(): Raster {
  const width = 320;
  const height = 240;
  const rect = { x: 40, y: 30, w: 220, h: 170 };
  const gray = new Uint8ClampedArray(width * height);
  gray.fill(30);
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) gray[y * width + x] = 235;
  }
  return rasterFromGray(gray, width, height);
}

const settings = (over: Partial<ScannerSettings> = {}): ScannerSettings => ({ ...ScannerSettingsDefaults, ...over });

/** The exact seam types, so the fakes typecheck as `ScanPipelineDeps`. */
type OcrFn = NonNullable<ScanPipelineDeps["runOcr"]>;
type UploadFn = NonNullable<ScanPipelineDeps["uploadScan"]>;
type ThumbFn = NonNullable<ScanPipelineDeps["makeThumbnail"]>;

interface Deps extends ScanPipelineDeps {
  runOcr: Mock<OcrFn>;
  uploadScan: Mock<UploadFn>;
  makeThumbnail: Mock<ThumbFn>;
}

function makeDeps(overrides: Partial<Deps> = {}): Deps {
  let seq = 0;
  const runOcr = vi.fn<OcrFn>(async (images, options = {}) => {
    options.onProgress?.(images.length, images.length);
    return { engine: "tesseract", text: EXAM_TEXT, confidence: 82, pages: images.length };
  });
  const uploadScan = vi.fn<UploadFn>(async () => ({ url: "https://cdn.example/paper.pdf" }));
  const makeThumbnail = vi.fn<ThumbFn>(async () => new Blob(["thumb"], { type: "image/jpeg" }));
  return {
    store: memoryScanStore(),
    now: () => NOW,
    newId: () => `scan-${++seq}`,
    runOcr,
    uploadScan,
    makeThumbnail,
    ...overrides,
  };
}

/** Wrap a store to record the upload-status transitions written through `patch`. */
function recordingStore(inner: ScanStore): { store: ScanStore; statuses: UploadStatus[] } {
  const statuses: UploadStatus[] = [];
  const store: ScanStore = {
    list: () => inner.list(),
    get: (id) => inner.get(id),
    put: (record) => inner.put(record),
    patch: async (id, patch) => {
      if (patch.upload) statuses.push(patch.upload.status);
      return inner.patch(id, patch);
    },
    remove: (id) => inner.remove(id),
  };
  return { store, statuses };
}

const pdfHeader = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...bytes);
};

const countPdfPages = async (blob: Blob): Promise<number> =>
  (
    Buffer.from(await blob.arrayBuffer())
      .toString("latin1")
      .match(/\/Type\s*\/Page\b/g) ?? []
  ).length;

/* --------------------------------------------------------------- hints */

describe("scanner pipeline: paper hints", () => {
  it("reads a labeled course code and a labeled course name", () => {
    const hints = extractPaperHints(EXAM_TEXT);
    expect(hints.subjectCode).toBe("BCSE204L");
    expect(hints.title).toBe("Data Structures and Algorithms");
  });

  it("reads the combined 'code and name' line real papers carry", () => {
    const hints = extractPaperHints(
      ["Course Code and Course Name : BECE312L, Robotics and Automation", "Page 1"].join("\n"),
    );
    expect(hints.subjectCode).toBe("BECE312L");
    expect(hints.title).toBe("Robotics and Automation");
  });

  it("survives OCR's odd separators (dot instead of colon)", () => {
    const hints = extractPaperHints("Course Code . BMEE303L\nCourse Name + Thermal Engineering Systems");
    expect(hints.subjectCode).toBe("BMEE303L");
    expect(hints.title).toBe("Thermal Engineering Systems");
  });

  it("falls back to a bare code when no label survived", () => {
    const hints = extractPaperHints("SCHOOL OF MECHANICAL ENGINEERING\nBCSE332L\nFAT — Winter 2025");
    expect(hints.subjectCode).toBe("BCSE332L");
  });

  it("rejects code-shaped footer junk and register numbers", () => {
    expect(extractPaperHints("PAGE123 of 300").subjectCode).toBe("");
    expect(extractPaperHints("Reg No: 21BCE10234").subjectCode).toBe("");
    expect(extractPaperHints("").subjectCode).toBe("");
    expect(extractPaperHints("").title).toBe("");
  });

  it("falls back to a keyword heading when no course line exists", () => {
    const hints = extractPaperHints("Lecture Notes — Unit II\nChapter 4: Data Structures");
    expect(hints.subjectCode).toBe("");
    expect(hints.title).toBe("Lecture Notes — Unit II");
  });
});

/* -------------------------------------------------------------- quality */

describe("scanner pipeline: quality verdict", () => {
  const good = { contrast: 0.5, inkRatio: 0.1, edgeDensity: 0.05, quadFill: 0.9 };

  it("scores a crisp, well-framed, confidently-read page as clean", () => {
    expect(assessQuality(good, 85)).toEqual({ score: 100, label: "clean" });
  });

  it("scores a blank page as poor — nothing to read", () => {
    const verdict = assessQuality({ contrast: 0.02, inkRatio: 0, edgeDensity: 0, quadFill: 1 }, null);
    expect(verdict.label).toBe("poor");
    expect(verdict.score).toBeLessThan(45);
  });

  it("lands a dim-but-readable page in 'usable'", () => {
    const verdict = assessQuality({ contrast: 0.15, inkRatio: 0.1, edgeDensity: 0.008, quadFill: 0.4 }, 50);
    expect(verdict.label).toBe("usable");
    expect(verdict.score).toBeGreaterThanOrEqual(45);
    expect(verdict.score).toBeLessThan(75);
  });

  it("lets a bad OCR confidence pull a good image down", () => {
    const sharp = assessQuality(good, 85).score;
    const unreadable = assessQuality(good, 20).score;
    expect(unreadable).toBeLessThan(sharp);
  });
});

/* ------------------------------------------------------------ filename */

describe("scanner pipeline: upload filename", () => {
  it("sanitises the title into a safe .pdf name", () => {
    expect(scanFilename('Thermodynamics: CAT/II?"')).toBe("Thermodynamics CAT II.pdf");
    expect(scanFilename("Data Structures and Algorithms")).toBe("Data Structures and Algorithms.pdf");
  });

  it("falls back for empty titles and caps absurd ones", () => {
    expect(scanFilename("   ")).toBe("scan.pdf");
    expect(scanFilename("x".repeat(200)).length).toBeLessThanOrEqual(64); // 60 + ".pdf"
  });
});

/* ----------------------------------------------------------- processScan */

describe("scanner pipeline: processScan", () => {
  it("walks capture → detect → warp → cleanup → PDF → OCR → classify → store", async () => {
    const deps = makeDeps();
    const record = await processScan([{ raster: photoWithSheet() }], deps, { settings: settings() });

    // Saved exactly once, readable back, payloads where they belong.
    const listed = await deps.store.list();
    expect(listed).toHaveLength(1);
    const stored = await deps.store.get(record.meta.id);
    expect(stored?.meta).toEqual(record.meta);
    expect(await stored!.pdf.text()).toBeTruthy();

    // The artifact.
    expect(record.pdf.type).toBe("application/pdf");
    expect(record.pdf.size).toBeGreaterThan(1000);
    expect(await pdfHeader(record.pdf)).toBe("%PDF-");

    // Metadata from the model + the paper's own words.
    expect(record.meta.id).toMatch(/^scan-\d+$/);
    expect(record.meta.createdAt).toBe(NOW);
    expect(record.meta.title).toBe("Data Structures and Algorithms");
    expect(record.meta.subjectCode).toBe("BCSE204L");
    expect(PAPER_KINDS).toContain(record.meta.kind);
    expect(record.meta.kindConfidence).toBeGreaterThan(0);
    expect(record.meta.kindConfidence).toBeLessThanOrEqual(1);
    expect(record.meta.pageCount).toBe(1);
    expect(record.meta.quality.label).toMatch(/^(clean|usable|poor)$/);
    expect(record.meta.ocr).toEqual({ engine: "tesseract", confidence: 82, preview: expect.any(String) });
    expect(record.meta.ocr?.preview.length).toBeLessThanOrEqual(120);
    expect(record.meta.upload).toEqual({ status: "local" }); // local-first, no endpoint

    // Full text and thumbnail ride along with the record.
    expect(record.ocrText).toBe(EXAM_TEXT);
    expect(record.thumbnail?.type).toBe("image/jpeg");

    // The engine was fed encoded pages with the configured engine + key.
    expect(deps.runOcr).toHaveBeenCalledTimes(1);
    const [images, ocrOptions] = deps.runOcr.mock.calls[0] as [readonly Blob[], OcrOptions];
    expect(images).toHaveLength(1);
    expect(images[0].type).toBe("image/png");
    expect(ocrOptions.engine).toBe("tesseract");
    expect(ocrOptions.apiKey).toBeUndefined();
  });

  it("warps to exactly the detected quad's size", async () => {
    const raster = photoWithSheet();
    let warped: Raster | undefined;
    const deps = makeDeps({
      makeThumbnail: vi.fn(async (page: Raster) => {
        warped = page;
        return new Blob(["thumb"], { type: "image/jpeg" });
      }),
    });

    await processScan([{ raster }], deps, { settings: settings() });

    const expected = warpSizeFor(detectQuad(raster) as Quad); // same deterministic detection
    expect(warped).toBeDefined();
    expect(warped!.width).toBe(expected.width);
    expect(warped!.height).toBe(expected.height);
    expect(warped!.width / warped!.height).toBeCloseTo(220 / 170, 1); // page aspect kept
  });

  it("applies the cleanup from settings, and the per-scan override wins", async () => {
    const observed: number[][] = [];
    const capture = vi.fn(async (page: Raster) => {
      const sampled: number[] = [];
      for (let i = 0; i < page.data.length; i += 4 * 97) sampled.push(page.data[i]);
      observed.push(sampled);
      return new Blob(["thumb"], { type: "image/jpeg" });
    });

    const deps = makeDeps({ makeThumbnail: capture });
    await processScan([{ raster: photoWithSheet() }], deps, { settings: settings({ defaultCleanup: "bw" }) });
    await processScan([{ raster: photoWithSheet() }], deps, { settings: settings(), cleanup: "original" });

    // Default from settings: binarised — every sample is pure black or white.
    expect(observed[0].every((v) => v === 0 || v === 255)).toBe(true);
    // Override: untouched grayscale — the sheet's own 235 survives.
    expect(observed[1].some((v) => v === 235)).toBe(true);
  });

  it("passes the configured cloud engine and key into OCR", async () => {
    const deps = makeDeps();
    await processScan([{ raster: photoWithSheet() }], deps, {
      settings: settings({ ocrEngine: "ocr.space", ocrApiKey: "secret" }),
    });

    const options = deps.runOcr.mock.calls[0][1] as OcrOptions;
    expect(options.engine).toBe("ocr.space");
    expect(options.apiKey).toBe("secret");
  });

  it("processes multiple pages into one multi-page PDF", async () => {
    const deps = makeDeps();
    const record = await processScan([{ raster: photoWithSheet() }, { raster: photoWithSheet() }], deps, {
      settings: settings(),
    });

    expect(record.meta.pageCount).toBe(2);
    expect(await countPdfPages(record.pdf)).toBe(2);
    const images = deps.runOcr.mock.calls[0][0] as readonly Blob[];
    expect(images).toHaveLength(2);
  });

  it("saves with no text (and warns) when OCR is unavailable", async () => {
    const warnings: ScanWarning[] = [];
    const deps = makeDeps({
      runOcr: vi.fn(async () => {
        throw new OcrUnavailableError("tesseract", "OCR could not start — check your connection and try again.");
      }),
    });

    const record = await processScan([{ raster: photoWithSheet() }], deps, {
      settings: settings(),
      onWarning: (w) => warnings.push(w),
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].kind).toBe("ocr-unavailable");
    expect(record.meta.ocr).toBeNull();
    expect(record.ocrText).toBeUndefined();
    expect(record.pdf.size).toBeGreaterThan(0); // the scan itself survived
    expect(record.meta.title).toBe(KIND_TITLE[record.meta.kind]); // no hints → the net's guess
    expect(await deps.store.list()).toHaveLength(1);
  });

  it("saves without a thumbnail when the thumbnail cannot be made", async () => {
    const warnings: ScanWarning[] = [];
    const deps = makeDeps({
      makeThumbnail: vi.fn(async () => {
        throw new ScannerDomError("canvas 2d context");
      }),
    });

    const record = await processScan([{ raster: photoWithSheet() }], deps, {
      settings: settings(),
      onWarning: (w) => warnings.push(w),
    });

    expect(warnings.map((w) => w.kind)).toEqual(["thumbnail-failed"]);
    expect(record.thumbnail).toBeUndefined();
    expect(await deps.store.list()).toHaveLength(1);
  });

  it("does nothing at all when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const deps = makeDeps();

    const error = await processScan([{ raster: photoWithSheet() }], deps, {
      settings: settings(),
      signal: controller.signal,
    }).then(
      () => null,
      (e: unknown) => e,
    );

    expect(error).toMatchObject({ name: "AbortError" });
    expect(await deps.store.list()).toEqual([]);
    expect(deps.runOcr).not.toHaveBeenCalled();
  });

  it("honours title and subject-code typed in the editor", async () => {
    const deps = makeDeps();
    const record = await processScan([{ raster: photoWithSheet() }], deps, {
      settings: settings(),
      title: "  My handwritten copy  ",
      subjectCode: "bcse999l",
    });
    expect(record.meta.title).toBe("My handwritten copy");
    expect(record.meta.subjectCode).toBe("BCSE999L");
  });

  it("reports every stage in pipeline order", async () => {
    const events: Array<{ stage: string; done: number; total: number }> = [];
    const deps = makeDeps();

    await processScan([{ raster: photoWithSheet() }], deps, {
      settings: settings(),
      onProgress: (p) => events.push(p),
    });

    expect(events[0]).toEqual({ stage: "pages", done: 1, total: 1 });
    expect(events.at(-1)).toEqual({ stage: "done", done: 1, total: 1 });
    expect(events.map((e) => e.stage)).toEqual(["pages", "ocr", "pdf", "pdf", "save", "done"]);

    const rank = ["pages", "ocr", "pdf", "save", "upload", "done"];
    for (let i = 1; i < events.length; i++) {
      expect(rank.indexOf(events[i].stage)).toBeGreaterThanOrEqual(rank.indexOf(events[i - 1].stage));
    }
  });

  /* --------------------------------------------------------- upload leg */

  it("uploads after the save when auto-upload is on, and says so", async () => {
    const { store, statuses } = recordingStore(memoryScanStore());
    const deps = makeDeps({ store });

    const record = await processScan([{ raster: photoWithSheet() }], deps, {
      settings: settings({ autoUpload: true, uploadEndpoint: ENDPOINT }),
    });

    expect(statuses).toEqual(["queued", "uploading", "uploaded"]);
    expect(record.meta.upload).toEqual({
      status: "uploaded",
      url: "https://cdn.example/paper.pdf",
      lastTriedAt: NOW,
    });
    const [input, options] = deps.uploadScan.mock.calls[0] as [{ pdf: Blob }, { endpoint: string; filename: string }];
    expect(input.pdf.type).toBe("application/pdf");
    expect(options.endpoint).toBe(ENDPOINT);
    expect(options.filename).toBe("Data Structures and Algorithms.pdf");
  });

  it("keeps the scan and records the error when the upload fails", async () => {
    const warnings: ScanWarning[] = [];
    const { store, statuses } = recordingStore(memoryScanStore());
    const deps = makeDeps({
      store,
      uploadScan: vi.fn(async () => {
        throw new UploadError("Upload could not reach the server — check your connection.", true);
      }),
    });

    const record = await processScan([{ raster: photoWithSheet() }], deps, {
      settings: settings({ autoUpload: true, uploadEndpoint: ENDPOINT }),
      onWarning: (w) => warnings.push(w),
    });

    expect(statuses).toEqual(["queued", "uploading", "failed"]);
    expect(record.meta.upload.status).toBe("failed");
    expect(record.meta.upload.error).toMatch(/check your connection/);
    expect(warnings.map((w) => w.kind)).toEqual(["upload-failed"]);
    const stored = await store.get(record.meta.id);
    expect(stored?.pdf.size).toBeGreaterThan(0); // local-first: the PDF never left because of a network
  });

  it("never touches the network without an endpoint", async () => {
    const deps = makeDeps();
    const record = await processScan([{ raster: photoWithSheet() }], deps, {
      settings: settings({ autoUpload: true, uploadEndpoint: "" }),
    });
    expect(deps.uploadScan).not.toHaveBeenCalled();
    expect(record.meta.upload.status).toBe("local");
  });

  it("stays local when upload: false overrides auto-upload", async () => {
    const deps = makeDeps();
    const record = await processScan([{ raster: photoWithSheet() }], deps, {
      settings: settings({ autoUpload: true, uploadEndpoint: ENDPOINT }),
      upload: false,
    });
    expect(deps.uploadScan).not.toHaveBeenCalled();
    expect(record.meta.upload.status).toBe("local");
  });
});

/* ------------------------------------------------------- uploadStoredScan */

describe("scanner pipeline: uploadStoredScan", () => {
  const savedScan = async (store: ScanStore, id = "scan-1"): Promise<ScanRecord> => {
    const meta: ScanMeta = {
      id,
      createdAt: NOW,
      title: "Data Structures and Algorithms",
      subjectCode: "BCSE204L",
      kind: "exam",
      kindConfidence: 0.9,
      pageCount: 1,
      sizeBytes: 100,
      quality: { score: 80, label: "clean" },
      ocr: null,
      upload: { status: "local" },
    };
    const record: ScanRecord = { meta, pdf: new Blob(["pdf"], { type: "application/pdf" }) };
    await store.put(record);
    return record;
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it("refuses without an endpoint, touching no status", async () => {
    const { store, statuses } = recordingStore(memoryScanStore());
    await savedScan(store);

    const error = await uploadStoredScan("scan-1", { store, now: () => NOW }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UploadError);
    expect((error as UploadError).retryable).toBe(false);
    expect((error as Error).message).toMatch(/stays on this device/);
    expect(statuses).toEqual([]);
    expect((await store.get("scan-1"))?.meta.upload.status).toBe("local");
  });

  it("refuses a scan that no longer exists", async () => {
    const { store, statuses } = recordingStore(memoryScanStore());
    const deps: ScanPipelineDeps = { store, now: () => NOW, uploadScan: vi.fn() };

    const error = await uploadStoredScan("missing", deps, {
      settings: settings({ uploadEndpoint: ENDPOINT }),
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UploadError);
    expect((error as Error).message).toMatch(/no longer on this device/);
    expect(statuses).toEqual([]);
    expect(deps.uploadScan).not.toHaveBeenCalled();
  });

  it("walks queued → uploading → uploaded and returns the patched meta", async () => {
    const { store, statuses } = recordingStore(memoryScanStore());
    await savedScan(store);
    const uploadScan = vi.fn<UploadFn>(async () => ({ url: "https://cdn.example/x.pdf" }));
    const events: number[] = [];

    const meta = await uploadStoredScan(
      "scan-1",
      { store, now: () => NOW, uploadScan },
      {
        settings: settings({ uploadEndpoint: ENDPOINT }),
        onProgress: (p) => events.push(p.done),
      },
    );

    expect(statuses).toEqual(["queued", "uploading", "uploaded"]);
    expect(meta.upload).toEqual({ status: "uploaded", url: "https://cdn.example/x.pdf", lastTriedAt: NOW });
    expect(events).toEqual([0, 1]);
    expect((uploadScan.mock.calls[0][1] as { filename: string }).filename).toBe("Data Structures and Algorithms.pdf");
  });

  it("records the failure on the meta and rethrows", async () => {
    const { store, statuses } = recordingStore(memoryScanStore());
    await savedScan(store);
    const deps: ScanPipelineDeps = {
      store,
      now: () => NOW,
      uploadScan: vi.fn(async () => {
        throw new UploadError("Upload failed (HTTP 400).", false);
      }),
    };

    await expect(
      uploadStoredScan("scan-1", deps, { settings: settings({ uploadEndpoint: ENDPOINT }) }),
    ).rejects.toThrow("Upload failed (HTTP 400).");
    expect(statuses).toEqual(["queued", "uploading", "failed"]);
    const meta = (await store.get("scan-1"))?.meta;
    expect(meta?.upload.status).toBe("failed");
    expect(meta?.upload.error).toBe("Upload failed (HTTP 400).");
  });

  it("falls back to queued — not failed — when the student cancels", async () => {
    const { store, statuses } = recordingStore(memoryScanStore());
    await savedScan(store);
    const controller = new AbortController();
    controller.abort();
    const cancelled = Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
    const deps: ScanPipelineDeps = {
      store,
      now: () => NOW,
      uploadScan: vi.fn(async () => {
        throw cancelled;
      }),
    };

    const error = await uploadStoredScan("scan-1", deps, {
      settings: settings({ uploadEndpoint: ENDPOINT }),
      signal: controller.signal,
    }).catch((e: unknown) => e);

    expect(error).toBe(cancelled);
    expect(statuses).toEqual(["queued", "uploading", "queued"]);
    expect((await store.get("scan-1"))?.meta.upload.status).toBe("queued");
  });
});
