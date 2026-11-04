"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, Copy, Download, ExternalLink, FileText, Trash2, UploadCloud } from "lucide-react";
import BottomSheet from "@/components/custom/shared/BottomSheet";
import Button from "@/components/custom/shared/Button";
import { DotPill, EmptyPanel, GhostButton, KeyValue, SectionHeader } from "@/components/custom/shared/primitives";
import { scanFilename, uploadStoredScan } from "@/lib/scanner/pipeline";
import { loadScannerSettings } from "@/lib/scanner/settings";
import type { ScanStore } from "@/lib/scanner/store";
import type { ExamCategory, ExamDetails, ScanMeta, ScanRecord, UploadStatus } from "@/lib/scanner/types";

/**
 * One scan, in full: preview, the net's classification, extracted text, the
 * PDF, and the upload state.
 *
 * The record arrives fully loaded (the parent fetched it), so the sheet never
 * shows a spinner for data it already has; edits and uploads go straight
 * through the store and report back via `onChanged`, which is what keeps the
 * library row and this sheet in agreement.
 */

const UPLOAD_TONE: Record<UploadStatus, string> = {
  local: "zinc",
  queued: "sky",
  uploading: "indigo",
  uploaded: "emerald",
  failed: "red",
};

const UPLOAD_LABEL: Record<UploadStatus, string> = {
  local: "On this device",
  queued: "Queued",
  uploading: "Uploading…",
  uploaded: "Uploaded",
  failed: "Upload failed",
};

const ENGINE_LABEL: Record<string, string> = {
  tesseract: "On device",
  "ocr.space": "Cloud",
  none: "None",
};

const INPUT =
  "w-full px-3 py-2 rounded-lg border border-border-muted dark:border-border bg-surface dark:bg-surface-secondary text-sm font-bold text-text-heading placeholder:text-text-muted placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150";

const fmtSize = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const fmtDate = (ts: number): string =>
  new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

interface PaperDetailSheetProps {
  record: ScanRecord;
  store: ScanStore;
  onClose: () => void;
  /** The list row's meta was edited or re-updated; keep it in sync. */
  onChanged: (meta: ScanMeta) => void;
  onDeleted: (id: string) => void;
}

export default function PaperDetailSheet({ record, store, onClose, onChanged, onDeleted }: PaperDetailSheetProps) {
  const { meta } = record;

  const [title, setTitle] = useState(meta.title);
  const [subjectCode, setSubjectCode] = useState(meta.subjectCode);
  const [examCategory, setExamCategory] = useState<string>(
    meta.exam?.category || (meta.kind === "exam" ? "FAT" : "None"),
  );
  const [semester, setSemester] = useState<string>(meta.exam?.semester || "");
  const [session, setSession] = useState<string>(meta.exam?.session || "");
  const [slot, setSlot] = useState<string>(meta.exam?.slot || "");
  const [classNbr, setClassNbr] = useState<string>(meta.exam?.classNbr || "");
  const [maxMarks, setMaxMarks] = useState<string>(meta.exam?.maxMarks ? String(meta.exam.maxMarks) : "");
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  // Editing is only offered against the copy this sheet opened with; a
  // concurrent change elsewhere would silently win otherwise.
  const initialCat = meta.exam?.category || (meta.kind === "exam" ? "FAT" : "None");
  const dirty =
    title !== meta.title ||
    subjectCode !== meta.subjectCode ||
    examCategory !== initialCat ||
    semester !== (meta.exam?.semester || "") ||
    session !== (meta.exam?.session || "") ||
    slot !== (meta.exam?.slot || "") ||
    classNbr !== (meta.exam?.classNbr || "") ||
    maxMarks !== (meta.exam?.maxMarks ? String(meta.exam.maxMarks) : "");

  const thumbUrl = useMemo(() => (record.thumbnail ? URL.createObjectURL(record.thumbnail) : null), [record.thumbnail]);
  useEffect(
    () => () => {
      if (thumbUrl) URL.revokeObjectURL(thumbUrl);
    },
    [thumbUrl],
  );

  const saveEdits = async () => {
    const updatedExam: ExamDetails | null =
      examCategory !== "None"
        ? {
            category: examCategory as ExamCategory,
            rawExamName: meta.exam?.rawExamName || examCategory,
            semester: semester.trim() || undefined,
            session: session.trim() || undefined,
            slot: slot.trim().toUpperCase() || undefined,
            classNbr: classNbr.trim() || undefined,
            maxMarks: maxMarks.trim() ? Number.parseInt(maxMarks.trim(), 10) : undefined,
            duration: meta.exam?.duration,
            regNo: meta.exam?.regNo,
            courseCode: subjectCode.trim().toUpperCase() || undefined,
            courseTitle: meta.exam?.courseTitle,
          }
        : null;

    const patched = await store.patch(meta.id, {
      title: title.trim() || meta.title,
      subjectCode: subjectCode.trim().toUpperCase(),
      kind: examCategory !== "None" ? "exam" : meta.kind,
      exam: updatedExam,
    });
    onChanged(patched);
  };

  const runUpload = async () => {
    if (uploading) return;
    setUploading(true);
    try {
      const updated = await uploadStoredScan(meta.id, { store }, { settings: loadScannerSettings() });
      onChanged(updated);
    } catch {
      // The store already carries the failed status + error; re-read it so the
      // sheet shows the real reason instead of a generic toast.
      const fresh = await store.get(meta.id);
      if (fresh) onChanged(fresh.meta);
    } finally {
      setUploading(false);
    }
  };

  const copyText = async () => {
    if (!record.ocrText) return;
    try {
      await navigator.clipboard.writeText(record.ocrText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard refused (permissions/insecure context) — the text is selectable below */
    }
  };

  const downloadPdf = () => {
    const url = URL.createObjectURL(record.pdf);
    const a = document.createElement("a");
    a.href = url;
    a.download = scanFilename(meta.title);
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const removeScan = async () => {
    await store.remove(meta.id);
    onDeleted(meta.id);
  };

  const canRetryUpload =
    meta.upload.status === "local" || meta.upload.status === "queued" || meta.upload.status === "failed";

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="paper-scanner-detail"
      title={meta.title}
      subtitle={
        [meta.subjectCode, fmtDate(meta.createdAt), `${meta.pageCount} ${meta.pageCount === 1 ? "page" : "pages"}`]
          .filter(Boolean)
          .join(" · ") || undefined
      }
      icon={<FileText className="h-5 w-5" />}
      maxWidth="max-w-lg"
    >
      <div className="space-y-5 pt-3">
        {/* Preview + headline facts */}
        <div className="flex items-start gap-4">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob, static export
            <img
              src={thumbUrl}
              alt=""
              className="h-20 w-20 shrink-0 rounded-xl border border-border-muted dark:border-border object-cover shadow-2xs"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border border-border-muted dark:border-border bg-surface-secondary dark:bg-surface-secondary/60">
              <FileText className="h-6 w-6 text-text-muted" aria-hidden />
            </div>
          )}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            <KeyValue
              label="Kind"
              value={
                meta.exam?.category
                  ? `${meta.exam.category} · ${meta.exam.shortSemester || meta.exam.semester || meta.exam.session || "Exam"}`
                  : `${meta.kind} · ${Math.round(meta.kindConfidence * 100)}%`
              }
              valueClassName="text-sm truncate"
            />
            <KeyValue
              label="Semester"
              value={meta.exam?.shortSemester || meta.exam?.semester || (meta.exam?.session ? meta.exam.session : "—")}
              valueClassName="text-sm truncate"
            />
            <KeyValue label="Size" value={fmtSize(meta.sizeBytes)} valueClassName="text-sm" />
            <KeyValue
              label="Text"
              value={
                meta.ocr
                  ? `${meta.ocr.confidence ?? "—"}% · ${ENGINE_LABEL[meta.ocr.engine] ?? meta.ocr.engine}`
                  : "None"
              }
              valueClassName="text-sm truncate"
            />
          </div>
        </div>

        {/* Upload state — local-first, so this row is informational until it isn't */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-muted dark:border-border bg-surface-secondary dark:bg-surface/60 px-4 py-3">
          <div className="min-w-0">
            <DotPill tone={UPLOAD_TONE[meta.upload.status]}>{UPLOAD_LABEL[meta.upload.status]}</DotPill>
            {meta.upload.error && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-bold text-red-600 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {meta.upload.error}
              </p>
            )}
          </div>
          {meta.upload.status === "uploaded" && meta.upload.url ? (
            <GhostButton
              onClick={() => window.open(meta.upload.url, "_blank", "noreferrer")}
              title="Open uploaded copy"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Open
            </GhostButton>
          ) : canRetryUpload ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={runUpload}
              loading={uploading}
              icon={<UploadCloud className="h-4 w-4" />}
            >
              {meta.upload.status === "failed" ? "Retry upload" : "Upload now"}
            </Button>
          ) : null}
        </div>

        {/* Editable identity */}
        <div className="space-y-3">
          <SectionHeader title="Details" />
          <div className="space-y-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">Title</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={INPUT}
                maxLength={120}
                placeholder="Scan title"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Subject code
              </span>
              <input
                value={subjectCode}
                onChange={(e) => setSubjectCode(e.target.value.toUpperCase())}
                className={INPUT}
                maxLength={16}
                placeholder="e.g. BCSE204L"
                spellCheck={false}
              />
            </label>

            {/* Examination & Assessment categorization */}
            <div className="pt-2 border-t border-border-muted dark:border-border space-y-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-text-muted">
                Examination &amp; Assessment
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="mb-1 block text-[10px] font-medium text-text-secondary dark:text-text-muted">
                    Assessment
                  </span>
                  <select value={examCategory} onChange={(e) => setExamCategory(e.target.value)} className={INPUT}>
                    <option value="None">None (Not an Exam)</option>
                    <option value="FAT">FAT (Final Assessment Test)</option>
                    <option value="CAT 1">CAT 1 (Assessment I)</option>
                    <option value="CAT 2">CAT 2 (Assessment II)</option>
                    <option value="Lab FAT">Lab FAT</option>
                    <option value="Supplementary">Supplementary / Arrear</option>
                    <option value="Other">Other Examination</option>
                  </select>
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-medium text-text-secondary dark:text-text-muted">
                    Semester
                  </span>
                  <input
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className={INPUT}
                    placeholder="e.g. Winter Semester 2023-24"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="mb-1 block text-[10px] font-medium text-text-secondary dark:text-text-muted">
                    Session
                  </span>
                  <input
                    value={session}
                    onChange={(e) => setSession(e.target.value)}
                    className={INPUT}
                    placeholder="e.g. May 2024"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-medium text-text-secondary dark:text-text-muted">
                    Slot
                  </span>
                  <input
                    value={slot}
                    onChange={(e) => setSlot(e.target.value.toUpperCase())}
                    className={INPUT}
                    placeholder="e.g. C1"
                  />
                </div>
                <div>
                  <span className="mb-1 block text-[10px] font-medium text-text-secondary dark:text-text-muted">
                    Max Marks
                  </span>
                  <input
                    value={maxMarks}
                    onChange={(e) => setMaxMarks(e.target.value)}
                    className={INPUT}
                    placeholder="100"
                  />
                </div>
              </div>
            </div>

            {dirty && (
              <div className="flex justify-end pt-1">
                <Button variant="secondary" size="sm" onClick={saveEdits} icon={<Check className="h-4 w-4" />}>
                  Save changes
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Extracted text */}
        <div className="space-y-3">
          <SectionHeader
            title="Extracted text"
            right={
              record.ocrText ? (
                <GhostButton onClick={copyText} title="Copy extracted text">
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                  ) : (
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {copied ? "Copied" : "Copy"}
                </GhostButton>
              ) : null
            }
          />
          {record.ocrText ? (
            <div className="max-h-56 overflow-y-auto overscroll-y-contain rounded-2xl border border-border-muted dark:border-border bg-surface-secondary dark:bg-surface/60 px-4 py-3">
              <p className="whitespace-pre-wrap break-words text-left text-xs font-medium leading-relaxed text-text-secondary dark:text-text-muted">
                {record.ocrText}
              </p>
            </div>
          ) : (
            <EmptyPanel
              variant="dashed"
              title="No text extracted"
              description={
                meta.ocr === null
                  ? "OCR was unavailable for this scan. The PDF is still complete."
                  : "This page carried no readable text."
              }
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 border-t border-border-muted dark:border-border pt-4">
          <Button
            variant={confirmDelete ? "danger" : "ghost"}
            size="sm"
            onClick={() => (confirmDelete ? void removeScan() : setConfirmDelete(true))}
            icon={<Trash2 className="h-4 w-4" />}
          >
            {confirmDelete ? "Tap again to delete" : "Delete"}
          </Button>
          <Button variant="primary" onClick={downloadPdf} icon={<Download className="h-4 w-4" />}>
            Download PDF
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
