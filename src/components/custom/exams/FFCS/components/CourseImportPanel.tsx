"use client";

import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { AlertTriangle, CheckCircle2, ClipboardPaste, FileSpreadsheet, Info, UploadCloud } from "lucide-react";
import type { ParsedCourse, AddedCourse } from "../types";
import { parsePastedText, toParsedCourses, parsedCoursesToAddedCourses } from "@/features/import/parsePastedText";
import { track } from "@/lib/analytics";
import { importFile, type FileImport } from "@/features/import/importFile";
import { SegmentedControl } from "@/components/custom/shared/primitives";

/**
 * The `Paste` and `File` halves of the Course Selector.
 *
 * The planner has always started from a report it fetches for itself, which
 * is fine right up until the student is looking at a course list from a
 * friend, a club handout, or last semester's export. Both paths here stop at
 * a preview: nothing is added to the planner until the rows have been shown,
 * because the two ways an import goes wrong — unreadable lines and a sheet
 * with the wrong headings — are both invisible until you look.
 *
 * `Search` stays in the modal that owns this panel rather than here, so the
 * segmented control can live in one place and this component only ever deals
 * with getting rows in.
 */

export type ImportMode = "paste" | "file";

/** Confidence as a colour, for the preview. */
const CONFIDENCE_STYLE: Record<"high" | "medium" | "low", string> = {
  high: "text-emerald-500",
  medium: "text-amber-500",
  low: "text-red-500",
};

/** How many preview lines are shown before the rest are summarised. */
const PREVIEW_LIMIT = 20;

interface CourseImportPanelProps {
  mode: ImportMode;
  /** Called with the rows to add. The panel does not mutate anything itself. */
  onImport: (courses: ParsedCourse[]) => void;
  /** Optional callback to also load directly to the active timetable */
  onImportToTimetable?: (courses: AddedCourse[]) => void;
}

export function CourseImportPanel({ mode, onImport, onImportToTimetable }: CourseImportPanelProps) {
  const [text, setText] = useState("");
  const [fileResult, setFileResult] = useState<FileImport | null>(null);
  const [addToTimetable, setAddToTimetable] = useState(true);
  // Kept only so the import event can name the format; the parser works from
  // bytes and never learns the extension.
  const [fileExt, setFileExt] = useState("unknown");
  const [reading, setReading] = useState(false);

  const parsed = useMemo(() => {
    if (mode !== "paste" || !text.trim()) return null;
    const options = parsePastedText(text);
    return { options, courses: toParsedCourses(options) };
  }, [mode, text]);

  const readFiles = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setReading(true);
    setFileExt(file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "unknown");
    setFileResult(await importFile(file));
    setReading(false);
  }, []);

  const dropzone = useDropzone({
    multiple: false,
    onDrop: readFiles,
    // Nothing in the catalogue is a shape SheetJS cannot attempt; refusing
    // extensions here would only mean the student gets the browser's own
    // "not accepted" instead of a message that explains what went wrong.
  });

  const coursesToImport = mode === "paste" ? parsed?.courses ?? [] : fileResult?.courses ?? [];
  const canImport = coursesToImport.length > 0;

  const handleImport = () => {
    if (!canImport) return;
    if (mode === "paste") {
      track("import_pasted", { courses: coursesToImport.length });
    } else {
      track("import_file", { courses: coursesToImport.length, format: fileExt });
    }
    onImport(coursesToImport);
    if (addToTimetable && onImportToTimetable) {
      onImportToTimetable(parsedCoursesToAddedCourses(coursesToImport));
    }
    setText("");
    setFileResult(null);
  };

  return (
    <div className="flex flex-col gap-3" data-tour-id="ffcs-import">
      {mode === "paste" ? (
        <PasteInput value={text} onChange={setText} />
      ) : (
        <FileDropzone dropzone={dropzone} reading={reading} />
      )}

      {mode === "paste" && parsed ? (
        <PastePreview options={parsed.options} rowCount={parsed.courses.length} />
      ) : mode === "file" && fileResult ? (
        <FilePreview result={fileResult} />
      ) : (
        <p className="text-xs text-muted-foreground">
          {mode === "paste"
            ? "Paste one course per line or copy-paste directly from VTOP registration."
            : "CSV, TSV or XLSX. Column headings do not have to match ours."}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border-strong/40">
        {onImportToTimetable ? (
          <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-text-heading font-medium">
            <input
              type="checkbox"
              checked={addToTimetable}
              onChange={(e) => setAddToTimetable(e.target.checked)}
              className="rounded border-border-strong text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Also add directly to active timetable</span>
          </label>
        ) : (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {canImport
              ? `${coursesToImport.length} course${coursesToImport.length === 1 ? "" : "s"} ready to add`
              : "Nothing to add yet"}
          </span>
        )}
        <button
          type="button"
          onClick={handleImport}
          disabled={!canImport}
          className="bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold px-5 py-2 rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CheckCircle2 className="w-4 h-4" />
          Import
        </button>
      </div>
    </div>
  );
}

function PasteInput({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-text-heading">
        <ClipboardPaste className="w-4 h-4 text-purple-500" /> Paste a course list
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={6}
        spellCheck={false}
        placeholder={"BASTS101 Qualitative Skills F1+TF1 - Dr. Nair\nCSE1001 Introduction to Computing - A1+TA1 - Dr. Smith"}
        className="w-full bg-surface border border-border-strong rounded-xl px-3 py-2.5 text-xs font-mono text-text-heading resize-y focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all custom-scrollbar"
      />
    </div>
  );
}

function FileDropzone({
  dropzone,
  reading,
}: {
  dropzone: ReturnType<typeof useDropzone>;
  reading: boolean;
}) {
  const { getRootProps, getInputProps, isDragActive } = dropzone;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-text-heading">
        <FileSpreadsheet className="w-4 h-4 text-purple-500" /> Upload a course sheet
      </div>
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-purple-500 bg-purple-500/10" : "border-border-strong hover:border-purple-500/50"
        }`}
      >
        <input {...getInputProps()} />
        {reading ? (
          <span className="text-xs text-muted-foreground">Reading…</span>
        ) : (
          <>
            <UploadCloud className="w-6 h-6 mx-auto text-muted-foreground mb-1.5" />
            <p className="text-xs text-text-heading font-medium">
              {isDragActive ? "Drop it here" : "Drag a file, or click to choose"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">CSV, TSV or XLSX</p>
          </>
        )}
      </div>
    </div>
  );
}

function PastePreview({
  options,
  rowCount,
}: {
  options: ReturnType<typeof parsePastedText>;
  rowCount: number;
}) {
  const withProblems = options.filter((option) => option.errors.length > 0).length;
  const shown = options.slice(0, PREVIEW_LIMIT);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {rowCount} course{rowCount === 1 ? "" : "s"} ready
        {withProblems > 0 ? ` · ${withProblems} line${withProblems === 1 ? "" : "s"} need attention` : ""}
      </p>

      {withProblems > 0 && (
        <div className="flex items-start gap-2 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>Lines with problems are not imported. Fix them below and paste again.</span>
        </div>
      )}

      <div className="border border-border-strong rounded-xl overflow-hidden">
        <div className="max-h-56 overflow-y-auto custom-scrollbar">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-surface-secondary/60 text-muted-foreground">
              <tr>
                <th className="text-left font-semibold px-2.5 py-1.5">Line</th>
                <th className="text-left font-semibold px-2.5 py-1.5">Slot</th>
                <th className="text-left font-semibold px-2.5 py-1.5">Read as</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((option, index) => (
                <tr key={`${option.rawLine}-${index}`} className="border-t border-border-strong/50">
                  <td className="px-2.5 py-1.5 max-w-[16rem] truncate text-text-heading/80" title={option.rawLine}>
                    {option.rawLine}
                  </td>
                  <td className="px-2.5 py-1.5 font-mono text-text-heading/70 whitespace-nowrap">
                    {[option.theorySlotRaw, option.labSlotRaw].filter(Boolean).join(" + ") || "—"}
                  </td>
                  <td className={`px-2.5 py-1.5 ${CONFIDENCE_STYLE[option.confidence]}`}>
                    {option.errors.length > 0 ? option.errors.join(", ") : "OK"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {options.length > shown.length && (
          <p className="text-[11px] text-muted-foreground px-2.5 py-1.5 border-t border-border-strong/50 bg-surface-secondary/30">
            …and {options.length - shown.length} more
          </p>
        )}
      </div>
    </div>
  );
}

function FilePreview({ result }: { result: FileImport }) {
  const shown = result.rows.slice(0, PREVIEW_LIMIT);
  const missingRequired = result.missingFields.filter((field) => field === "CODE" || field === "SLOT");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {result.error ? (
          <span className="text-red-500">{result.error}</span>
        ) : (
          <>
            <span className="text-text-heading">{result.courses.length}</span> course
            {result.courses.length === 1 ? "" : "s"} ready from <span className="font-mono">{result.source}</span>
            {result.skipped > 0 ? ` · ${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped` : ""}
          </>
        )}
      </p>

      {(result.ignoredHeaders.length > 0 || missingRequired.length > 0 || result.error) && (
        <div className="flex flex-col gap-1 text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          {missingRequired.length > 0 && (
            <span className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>No {missingRequired.join(" or ").toLowerCase()} column found, so this file cannot be imported.</span>
            </span>
          )}
          {result.ignoredHeaders.length > 0 && (
            <span className="flex items-start gap-2">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Ignored: {result.ignoredHeaders.join(", ")}</span>
            </span>
          )}
        </div>
      )}

      {result.rows.length > 0 && (
        <div className="border border-border-strong rounded-xl overflow-hidden">
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-surface-secondary/60 text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold px-2.5 py-1.5">Code</th>
                  <th className="text-left font-semibold px-2.5 py-1.5">Slot</th>
                  <th className="text-left font-semibold px-2.5 py-1.5">Faculty</th>
                  <th className="text-left font-semibold px-2.5 py-1.5">Room</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row, index) => (
                  <tr key={index} className="border-t border-border-strong/50">
                    <td className="px-2.5 py-1.5 font-medium text-text-heading/80 whitespace-nowrap">{row.CODE ?? "—"}</td>
                    <td className="px-2.5 py-1.5 font-mono text-text-heading/70 whitespace-nowrap">{row.SLOT ?? "—"}</td>
                    <td className="px-2.5 py-1.5 text-text-heading/70 max-w-[10rem] truncate" title={row.FACULTY}>
                      {row.FACULTY || "—"}
                    </td>
                    <td className="px-2.5 py-1.5 text-text-heading/70 whitespace-nowrap">{row.ROOM || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > shown.length && (
            <p className="text-[11px] text-muted-foreground px-2.5 py-1.5 border-t border-border-strong/50 bg-surface-secondary/30">
              …and {result.rows.length - shown.length} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
