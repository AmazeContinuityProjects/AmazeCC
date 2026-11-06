"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  ChevronRight,
  FileText,
  ImageUp,
  ScanLine,
  Settings,
  Smartphone,
  X,
} from "lucide-react";
import Button from "@/components/custom/shared/Button";
import BottomSheet from "@/components/custom/shared/BottomSheet";
import {
  DotPill,
  EmptyPanel,
  GhostButton,
  IconButton,
  ListRowText,
  ListSkeleton,
  ListShell,
  PageShell,
  SectionHeader,
  ToneBadge,
} from "@/components/custom/shared/primitives";
import { LIST_ROW } from "@/lib/uiTokens";
import { processScan, type ProcessScanPage, type ScanProgress, type ScanWarning } from "@/lib/scanner/pipeline";
import { createScanStore, isIndexedDbAvailable, type ScanStore } from "@/lib/scanner/store";
import { loadScannerSettings } from "@/lib/scanner/settings";
import { decodeToRaster } from "@/lib/scanner/rasterIO";
import type { CleanupMode, PaperKind, Quad, Raster, ScanMeta, ScanRecord } from "@/lib/scanner/types";
import posthog from "posthog-js";
import ScannerCamera from "./ScannerCamera";
import ScannerEditor from "./ScannerEditor";
import PaperDetailSheet from "./PaperDetailSheet";
import ScannerSettingsSheet from "./ScannerSettingsSheet";

const posthogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

/**
 * Paper Scanner: capture → edge detect → warp/cleanup → PDF → OCR → classify,
 * stored locally first and uploaded only when the student has wired an
 * endpoint.
 *
 * Provides:
 * - Immersive full-screen camera with live A4 guides, torch, and flip camera
 * - Direct invocation of device native System Camera / Document Scanner
 * - Multi-page scanning and gallery multi-image batch queue
 * - Full-screen corner crop editor with precision magnifying loupe and 90° rotation
 * - Shadow-cancelling, contrast-enhanced document cleanup
 */

type Mode =
  | { name: "library" }
  | { name: "camera" }
  | { name: "editor"; raster: Raster }
  | { name: "processing"; raster: Raster };

const STAGE_LABEL: Record<ScanProgress["stage"], string> = {
  pages: "Cleaning pages",
  ocr: "Reading text",
  pdf: "Building PDF",
  save: "Saving to this device",
  upload: "Uploading",
  done: "Done",
};

const STAGE_SUB: Record<ScanProgress["stage"], string> = {
  pages: "Detecting edges and straightening each page",
  ocr: "Extracting text from the cleaned pages",
  pdf: "Assembling the PDF",
  save: "Writing to this device's storage",
  upload: "Pushing a copy to the endpoint",
  done: "",
};

const WARNING_TEXT: Record<ScanWarning["kind"], string> = {
  "ocr-unavailable": "Text recognition was unavailable — the scan saved without extracted text.",
  "thumbnail-failed": "The list preview couldn't be generated.",
  "upload-failed": "Upload failed — the scan is safe on this device.",
};

const KIND_TONE: Record<PaperKind, string> = {
  exam: "violet",
  assignment: "sky",
  notes: "emerald",
  worksheet: "amber",
  form: "blue",
  other: "zinc",
};

const EXAM_CATEGORY_TONE: Record<string, string> = {
  FAT: "violet",
  "CAT 1": "blue",
  "CAT 2": "amber",
  "Lab FAT": "emerald",
  Supplementary: "rose",
  Other: "zinc",
};

const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

interface PaperScannerPageProps {
  onBack?: () => void;
}

export default function PaperScannerPage({ onBack }: PaperScannerPageProps) {
  const [store, setStore] = useState<ScanStore | null>(null);
  const [metas, setMetas] = useState<ScanMeta[] | null>(null); // null = still loading
  const [listError, setListError] = useState<string | null>(null);
  const [memoryOnly, setMemoryOnly] = useState(false);

  const [mode, setMode] = useState<Mode>({ name: "library" });
  const [pending, setPending] = useState<ProcessScanPage[]>([]);
  const [unprocessedQueue, setUnprocessedQueue] = useState<Raster[]>([]);
  const [cleanup, setCleanup] = useState<CleanupMode>(() => loadScannerSettings().defaultCleanup);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [warnings, setWarnings] = useState<ScanWarning[]>([]);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showAddSheet, setShowAddSheet] = useState(false);

  const [detail, setDetail] = useState<{ id: string; record: ScanRecord | null } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>("all");

  const fileRef = useRef<HTMLInputElement>(null);
  const systemInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Store + first list read. `createScanStore` falls back to memory when
     IndexedDB is unavailable (private mode), which the badge surfaces. */
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const s = await createScanStore();
        if (!alive) return;
        setStore(s);
        setMemoryOnly(!isIndexedDbAvailable());
        const list = await s.list();
        if (alive) setMetas(list);
      } catch (err) {
        if (!alive) return;
        setMetas([]);
        setListError(err instanceof Error ? err.message : "Saved scans could not be opened.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const openScan = useCallback(
    async (id: string, record?: ScanRecord) => {
      if (!store) return;
      setDetail({ id, record: record ?? null });
      const full = record ?? (await store.get(id));
      if (!full) {
        setDetail(null);
        return;
      }
      setDetail({ id, record: full });
    },
    [store],
  );

  const handleDetailChanged = useCallback((meta: ScanMeta) => {
    setMetas((prev) => (prev ? prev.map((m) => (m.id === meta.id ? meta : m)) : prev));
    setDetail((d) => (d?.record ? { ...d, record: { ...d.record, meta } } : d));
  }, []);

  const handleDetailDeleted = useCallback((id: string) => {
    setMetas((prev) => (prev ? prev.filter((m) => m.id !== id) : prev));
    setDetail(null);
  }, []);

  /* ---------------------------------------------------------- capture flow */

  const enterCamera = () => {
    setFlowError(null);
    setMode({ name: "camera" });
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0 || importing) return;
    setImporting(true);
    setFlowError(null);
    setShowAddSheet(false);
    try {
      const rasters: Raster[] = [];
      for (const f of selectedFiles) {
        rasters.push(await decodeToRaster(f));
      }
      if (rasters.length === 0) return;
      if (mode.name === "editor") {
        setMode({ name: "editor", raster: rasters[0] });
        if (rasters.length > 1) {
          setUnprocessedQueue((prev) => [...prev, ...rasters.slice(1)]);
        }
      } else {
        setPending([]);
        setUnprocessedQueue(rasters.slice(1));
        setMode({ name: "editor", raster: rasters[0] });
      }
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : "That image could not be read.");
    } finally {
      try {
        e.target.value = "";
      } catch {}
      setImporting(false);
    }
  };

  const handleSystemCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0 || importing) return;
    setImporting(true);
    setFlowError(null);
    setShowAddSheet(false);
    try {
      const raster = await decodeToRaster(selectedFiles[0]);
      if (mode.name === "editor") {
        setMode({ name: "editor", raster });
      } else {
        setPending([]);
        setUnprocessedQueue([]);
        setMode({ name: "editor", raster });
      }
    } catch (err) {
      setFlowError(err instanceof Error ? err.message : "That photo could not be read.");
    } finally {
      try {
        e.target.value = "";
      } catch {}
      setImporting(false);
    }
  };

  const handleImportMultipleRasters = (rasters: Raster[]) => {
    if (rasters.length === 0) return;
    setShowAddSheet(false);
    setUnprocessedQueue((prev) => [...prev, ...rasters.slice(1)]);
    setMode({ name: "editor", raster: rasters[0] });
  };

  const handleAddPage = (quad: Quad, rotatedRaster?: Raster) => {
    if (mode.name !== "editor") return;
    const finalRaster = rotatedRaster ?? mode.raster;
    setPending((prev) => [...prev, { raster: finalRaster, quad }]);

    if (unprocessedQueue.length > 0) {
      const [nextRaster, ...rest] = unprocessedQueue;
      setUnprocessedQueue(rest);
      setMode({ name: "editor", raster: nextRaster });
    } else {
      setShowAddSheet(true);
    }
  };

  const handleConfirm = async (quad: Quad, rotatedRaster?: Raster) => {
    if (mode.name !== "editor" || !store) return;
    const finalRaster = rotatedRaster ?? mode.raster;
    const pages: ProcessScanPage[] = [...pending, { raster: finalRaster, quad }];

    if (unprocessedQueue.length > 0) {
      setPending(pages);
      const [nextRaster, ...rest] = unprocessedQueue;
      setUnprocessedQueue(rest);
      setMode({ name: "editor", raster: nextRaster });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setWarnings([]);
    setFlowError(null);
    setProgress({ stage: "pages", done: 0, total: pages.length });
    setMode({ name: "processing", raster: finalRaster });

    let warningCount = 0;
    try {
      const record = await processScan(
        pages,
        { store },
        {
          cleanup,
          signal: controller.signal,
          onProgress: setProgress,
          onWarning: (w) => {
            warningCount += 1;
            setWarnings((prev) => [...prev, w]);
          },
        },
      );
      if (posthogConfigured) {
        posthog.capture("paper_scan_completed", {
          page_count: pages.length,
          cleanup_mode: cleanup,
          warning_count: warningCount,
        });
      }
      setMetas((prev) => [record.meta, ...(prev ?? [])]);
      setPending([]);
      setUnprocessedQueue([]);
      setMode({ name: "library" });
      void openScan(record.meta.id, record);
    } catch (err) {
      const aborted = controller.signal.aborted || (err as { name?: string })?.name === "AbortError";
      if (aborted) {
        setMode({ name: "editor", raster: finalRaster });
        return;
      }
      setFlowError(err instanceof Error ? err.message : "The scan could not be processed.");
      setMode({ name: "editor", raster: finalRaster });
    } finally {
      abortRef.current = null;
    }
  };

  const cancelProcessing = () => abortRef.current?.abort();

  /** System back: unwind the capture flow first, then leave the tab. */
  const handleBack = () => {
    if (mode.name === "processing") {
      abortRef.current?.abort();
      return;
    }
    if (mode.name !== "library") {
      setPending([]);
      setUnprocessedQueue([]);
      setWarnings([]);
      setFlowError(null);
      setMode({ name: "library" });
      return;
    }
    onBack?.();
  };

  /* ------------------------------------------------------------- render */

  const loading = metas === null;
  const stage = progress?.stage ?? "pages";
  const stagePct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;
  const detailRecord = detail?.record && detail.record.meta.id === detail.id ? detail.record : null;

  const filteredMetas = useMemo(() => {
    if (!metas) return null;
    if (selectedFilter === "all") return metas;
    if (selectedFilter === "FAT") return metas.filter((m) => m.exam?.category === "FAT");
    if (selectedFilter === "CAT 1") return metas.filter((m) => m.exam?.category === "CAT 1");
    if (selectedFilter === "CAT 2") return metas.filter((m) => m.exam?.category === "CAT 2");
    if (selectedFilter === "exams") return metas.filter((m) => m.kind === "exam" || !!m.exam);
    if (selectedFilter === "other") return metas.filter((m) => m.kind !== "exam" && !m.exam);
    return metas;
  }, [metas, selectedFilter]);

  return (
    <PageShell
      eyebrow="Tools"
      title="Paper Scanner"
      subtitle="Scan papers into clean PDFs, extract their text, and keep them on this device"
      onBack={handleBack}
      actions={
        <IconButton title="Scanner settings" onClick={() => setShowSettings(true)}>
          <Settings className="h-4 w-4" />
        </IconButton>
      }
    >
      {/* ── Primary actions (library state) ── */}
      {mode.name === "library" && (
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <Button onClick={enterCamera} icon={<Camera className="h-4 w-4" />}>
            Scan paper
          </Button>
          <Button
            variant="secondary"
            onClick={() => systemInputRef.current?.click()}
            icon={<Smartphone className="h-4 w-4 text-emerald-500" />}
          >
            System Camera
          </Button>
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            loading={importing}
            icon={<ImageUp className="h-4 w-4" />}
          >
            Import image
          </Button>

          {/* Hidden inputs */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleImportFile}
            aria-hidden
            tabIndex={-1}
          />
          <input
            ref={systemInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleSystemCapture}
            aria-hidden
            tabIndex={-1}
          />
        </div>
      )}

      {/* ── Flow-level errors and post-run warnings ── */}
      {flowError && mode.name !== "processing" && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          <p className="min-w-0 flex-1 text-left text-[11px] font-bold text-red-700 dark:text-red-300">{flowError}</p>
          <button
            type="button"
            onClick={() => setFlowError(null)}
            aria-label="Dismiss error"
            className="shrink-0 rounded-lg p-1 text-red-500 transition-colors duration-150 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {warnings.length > 0 && mode.name === "library" && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1 text-left">
            {warnings.map((w, i) => (
              <p key={i} className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                {WARNING_TEXT[w.kind]}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setWarnings([])}
            aria-label="Dismiss warnings"
            className="shrink-0 rounded-lg p-1 text-amber-600 transition-colors duration-150 hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── Camera (Full-Screen) ── */}
      {mode.name === "camera" && (
        <ScannerCamera
          pageNumber={pending.length + 1}
          onCapture={(raster) => setMode({ name: "editor", raster })}
          onImport={(raster) => {
            if (pending.length === 0) {
              setPending([]);
            }
            setMode({ name: "editor", raster });
          }}
          onImportMultiple={handleImportMultipleRasters}
          onCancel={() => {
            if (pending.length > 0) {
              // Return to the first pending page in editor if available
              const last = pending[pending.length - 1];
              setPending(pending.slice(0, -1));
              setMode({ name: "editor", raster: last.raster });
            } else {
              setPending([]);
              setUnprocessedQueue([]);
              setMode({ name: "library" });
            }
          }}
        />
      )}

      {/* ── Corner editor & Crop Mode (Full-Screen) ── */}
      {mode.name === "editor" && (
        <ScannerEditor
          raster={mode.raster}
          confirmedPages={pending.length}
          cleanup={cleanup}
          onCleanupChange={setCleanup}
          onRetake={() => setMode({ name: "camera" })}
          onAddPage={handleAddPage}
          onConfirm={handleConfirm}
        />
      )}

      {/* ── Processing ── */}
      {mode.name === "processing" && (
        <div className="flex flex-col items-center gap-4 rounded-[24px] border border-border-strong dark:border-border card-surface px-6 py-8 text-center shadow-xs">
          <span
            className="h-10 w-10 animate-spin rounded-full border-[3px] border-indigo-500 border-t-transparent"
            aria-hidden
          />
          <div className="space-y-1">
            <p className="text-sm font-black text-text-heading font-outfit">{STAGE_LABEL[stage]}</p>
            <p className="text-[11px] font-medium text-text-secondary dark:text-text-muted">
              {progress && progress.total > progress.done
                ? `${progress.done} of ${progress.total} — ${STAGE_SUB[stage]}`
                : STAGE_SUB[stage] || "Working…"}
            </p>
          </div>
          <div className="h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-surface-tertiary dark:bg-surface-secondary">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-250"
              style={{ width: `${stagePct}%` }}
            />
          </div>
          <GhostButton onClick={cancelProcessing} title="Cancel this scan">
            Cancel
          </GhostButton>
        </div>
      )}

      {/* ── Library ── */}
      {mode.name === "library" && (
        <div className="space-y-4">
          <SectionHeader
            icon={ScanLine}
            title="Your scans"
            count={metas?.length ?? undefined}
            right={memoryOnly ? <DotPill tone="amber">Session storage</DotPill> : null}
          />

          {/* Exam & category filter pills */}
          {metas && metas.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              {[
                { id: "all", label: "All" },
                { id: "FAT", label: "FAT" },
                { id: "CAT 1", label: "CAT 1" },
                { id: "CAT 2", label: "CAT 2" },
                { id: "exams", label: "Exams" },
                { id: "other", label: "Other" },
              ].map((tab) => {
                const active = selectedFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedFilter(tab.id)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      active
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-surface-secondary dark:bg-surface-secondary/60 text-text-secondary dark:text-text-muted hover:text-text-primary hover:bg-surface-tertiary"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          {loading ? (
            <ListSkeleton rows={3} leading="dot" trailing titleWidth="w-1/3" subtitleWidth="w-1/4" />
          ) : listError ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-left text-[11px] font-bold text-red-700 dark:text-red-300">
              {listError}
            </div>
          ) : metas && metas.length === 0 ? (
            <EmptyPanel
              variant="dashed"
              icon={
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <ScanLine className="h-6 w-6" aria-hidden />
                </span>
              }
              title="No scans yet"
              description="Point the camera at a page — edges are detected automatically, then it becomes a PDF with extractable text."
              action={
                <Button onClick={enterCamera} icon={<Camera className="h-4 w-4" />}>
                  Scan your first paper
                </Button>
              }
            />
          ) : (
            <ListShell>
              {(filteredMetas ?? []).map((meta) => {
                const examTag = meta.exam?.category;
                const semTag = meta.exam?.shortSemester || meta.exam?.semester || meta.exam?.session;
                const slotTag = meta.exam?.slot ? `Slot ${meta.exam.slot}` : null;
                const badgeTone = examTag ? (EXAM_CATEGORY_TONE[examTag] ?? "violet") : KIND_TONE[meta.kind];

                return (
                  <button
                    key={meta.id}
                    type="button"
                    onClick={() => void openScan(meta.id)}
                    className={`${LIST_ROW} group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500`}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-muted dark:border-border bg-surface-secondary dark:bg-surface-secondary/60 text-text-secondary dark:text-text-muted">
                      <FileText className="h-4 w-4" aria-hidden />
                    </span>
                    <ListRowText
                      title={meta.title}
                      titleTooltip={meta.title}
                      subtitle={[
                        meta.subjectCode,
                        examTag,
                        semTag,
                        slotTag,
                        fmtDate(meta.createdAt),
                        `${meta.pageCount} ${meta.pageCount === 1 ? "page" : "pages"}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    />
                    <div className="flex shrink-0 items-center gap-2">
                      {meta.upload.status === "failed" && <DotPill tone="red">Failed</DotPill>}
                      <ToneBadge tone={badgeTone} size="sm">
                        {examTag || meta.kind}
                      </ToneBadge>
                      <ChevronRight
                        className="h-4 w-4 text-zinc-400 transition-colors group-hover:text-indigo-500 dark:text-zinc-600 dark:group-hover:text-indigo-400"
                        aria-hidden
                      />
                    </div>
                  </button>
                );
              })}
            </ListShell>
          )}
        </div>
      )}

      {/* ── Add Document Page Sheet ── */}
      {showAddSheet && (
        <BottomSheet overlayId="scanner-add-page-sheet" onClose={() => setShowAddSheet(false)}>
          <div className="space-y-4 p-2 text-left">
            <div>
              <h3 className="text-base font-black text-text-heading font-outfit">Add Document Page</h3>
              <p className="text-xs text-text-secondary dark:text-text-muted mt-0.5">
                Choose how you would like to capture or import the next page
              </p>
            </div>

            <div className="grid gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowAddSheet(false);
                  enterCamera();
                }}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-border-muted dark:border-border hover:bg-surface-secondary dark:hover:bg-surface-secondary/60 transition-all cursor-pointer text-left group active:scale-[0.99]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-primary">Live In-App Scanner</p>
                  <p className="text-xs text-text-secondary dark:text-text-muted">
                    Interactive full-screen viewfinder with A4 guide &amp; auto-edge detect
                  </p>
                </div>
              </button>

              <label className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-border-muted dark:border-border hover:bg-surface-secondary dark:hover:bg-surface-secondary/60 transition-all cursor-pointer text-left group active:scale-[0.99]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-primary">System Camera / Scanner</p>
                  <p className="text-xs text-text-secondary dark:text-text-muted">
                    Invoke device native camera with hardware lens &amp; HDR
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleSystemCapture}
                />
              </label>

              <label className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-border-muted dark:border-border hover:bg-surface-secondary dark:hover:bg-surface-secondary/60 transition-all cursor-pointer text-left group active:scale-[0.99]">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 group-hover:scale-105 transition-transform">
                  <ImageUp className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-text-primary">Photo Gallery / Files</p>
                  <p className="text-xs text-text-secondary dark:text-text-muted">
                    Pick one or multiple existing photos from this device
                  </p>
                </div>
                <input type="file" accept="image/*" multiple className="sr-only" onChange={handleImportFile} />
              </label>
            </div>
          </div>
        </BottomSheet>
      )}

      {/* ── Detail + settings sheets ── */}
      {detailRecord && store && (
        <PaperDetailSheet
          record={detailRecord}
          store={store}
          onClose={() => setDetail(null)}
          onChanged={handleDetailChanged}
          onDeleted={handleDetailDeleted}
        />
      )}
      {showSettings && <ScannerSettingsSheet onClose={() => setShowSettings(false)} />}
    </PageShell>
  );
}
