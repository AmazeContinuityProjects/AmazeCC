"use client";

import { useCallback, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Info, UploadCloud } from "lucide-react";
import { importFile, type FileImport } from "@/features/import/importFile";
import { IMPORTABLE_FIELDS, REQUIRED_FIELDS } from "@/features/import/normalizeColumns";
import { buildSampleCourseListCsv, SAMPLE_COURSE_LIST_FILENAME } from "@/features/import/sampleCourseList";
import { track } from "@/lib/analytics";
import type { ParsedCourse } from "../types";

/**
 * The "bring your own list" flow, one level below the Switch Course List
 * picker — reached from its own menu row and presented as a sheet of its own.
 *
 * The planner ships two verified reports, and a student whose courses are not
 * on either — an off-campus elective, a hand-maintained department sheet —
 * had nowhere to go from this sheet. This section gives them the whole shape
 * of the file up front: the sample download is built from the same field
 * constants the importer matches against, the legend marks which columns a row
 * cannot exist without, and the preview names every column the importer
 * ignored before anything joins the list.
 *
 * The import merges by course code rather than replacing the list, exactly
 * like the Target Courses upload: a corrected re-upload takes over the codes
 * it fixes, and courses it does not mention are left alone.
 */

interface CourseListImportSectionProps {
  /** Called with the parsed rows. The parent merges them into the list. */
  onImport: (courses: ParsedCourse[]) => void;
}

/** How many preview rows are shown before the rest are summarised. */
const PREVIEW_LIMIT = 8;

export function CourseListImportSection({ onImport }: CourseListImportSectionProps) {
  const [result, setResult] = useState<FileImport | null>(null);
  const [reading, setReading] = useState(false);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const readFiles = useCallback(async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setReading(true);
    setImportedCount(null);
    setResult(await importFile(file));
    setReading(false);
  }, []);

  const handleImport = useCallback(() => {
    if (!result || result.courses.length === 0) return;
    track("import_file", {
      courses: result.courses.length,
      format: result.source.includes(".") ? result.source.split(".").pop()!.toLowerCase() : "unknown",
    });
    onImport(result.courses);
    setImportedCount(result.courses.length);
    setResult(null);
  }, [result, onImport]);

  const downloadSample = useCallback(() => {
    const blob = new Blob([buildSampleCourseListCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = SAMPLE_COURSE_LIST_FILENAME;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Download the sample sheet, fill in your courses, and import it back. Columns can be
        renamed or reordered — only the required ones must stay.
      </p>

      <FieldLegend />

      <button
        type="button"
        onClick={downloadSample}
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border-strong/70 bg-surface hover:bg-surface-secondary text-xs font-bold text-text-heading transition-colors cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
        Download sample CSV ({SAMPLE_COURSE_LIST_FILENAME})
      </button>

      <label className="border-2 border-dashed rounded-xl px-4 py-4 text-center cursor-pointer transition-colors border-border-strong hover:border-teal-500/50 focus-within:border-teal-500/50">
        <input
          type="file"
          accept=".csv,.tsv,.txt,.xlsx"
          onChange={(event) => {
            void readFiles(event.target.files);
            // Cleared so re-picking the same corrected file still fires change.
            event.target.value = "";
          }}
          className="sr-only"
          aria-label="Upload course list file"
        />
        {reading ? (
          <span className="text-xs text-muted-foreground">Reading…</span>
        ) : (
          <>
            <UploadCloud className="w-5 h-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-text-heading font-medium">Choose your CSV or XLSX file</p>
          </>
        )}
      </label>

      {importedCount !== null && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2" aria-live="polite">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Imported {importedCount} course{importedCount === 1 ? "" : "s"}. Same codes were
          replaced; the rest of your list is untouched.
        </p>
      )}

      {result && <ImportPreview result={result} onImport={handleImport} />}
    </div>
  );
}

/**
 * The required/optional legend, straight from the importer's own constants.
 *
 * Written as chips rather than prose so it can never promise a field the
 * importer does not accept, or mark optional a column it would refuse.
 */
function FieldLegend() {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {IMPORTABLE_FIELDS.map((field) => {
          const required = REQUIRED_FIELDS.includes(field);
          return (
            <span
              key={field}
              title={required ? "Required — a row without it is dropped" : "Optional — safe to leave out"}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-bold ${
                required
                  ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30"
                  : "bg-surface-secondary text-muted-foreground border-border-strong/50"
              }`}
            >
              {field}
              <span className="font-medium opacity-70">{required ? "required" : "optional"}</span>
            </span>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">
        A row with no course code or no slot is dropped; everything else has a default.
      </p>
    </div>
  );
}

/** The parsed sheet: what will be imported, and what the importer could not use. */
function ImportPreview({ result, onImport }: { result: FileImport; onImport: () => void }) {
  const shown = result.rows.slice(0, PREVIEW_LIMIT);
  const missingRequired = REQUIRED_FIELDS.filter((field) => result.missingFields.includes(field));

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {result.error ? (
          <span className="text-red-500">{result.error}</span>
        ) : (
          <>
            <span className="text-text-heading">{result.courses.length}</span> course
            {result.courses.length === 1 ? "" : "s"} ready from{" "}
            <span className="font-mono">{result.source}</span>
            {result.skipped > 0 ? ` · ${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped` : ""}
          </>
        )}
      </p>

      {(result.ignoredHeaders.length > 0 || missingRequired.length > 0) && (
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
          <div className="max-h-40 overflow-y-auto custom-scrollbar">
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
                    <td className="px-2.5 py-1.5 text-text-heading/70 max-w-[9rem] truncate" title={row.FACULTY}>
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

      <button
        type="button"
        onClick={onImport}
        disabled={result.courses.length === 0}
        className="self-end bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
        Import {result.courses.length} course{result.courses.length === 1 ? "" : "s"}
      </button>
    </div>
  );
}
