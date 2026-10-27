"use client";

import { useState } from "react";
import { CalendarDays, Download, ExternalLink, FileDown, FileText, Save } from "lucide-react";
import { SegmentedControl } from "../../../shared/primitives";

type DossierThemeChoice = "current" | "light" | "dark";
type ImageLayoutChoice = "active" | "horizontal" | "vertical";

export interface ExportDossierWidgetProps {
  courseCount: number;
  isDownloading?: boolean;
  onDownloadHtmlDossier?: (theme?: "light" | "dark") => void;
  onDownloadImage?: (format: "jpg" | "png", orientation?: "horizontal" | "vertical") => void;
  onExportIcal: () => void;
  onExportTimetablesJson: () => void;
  onOpenPrintablePage?: () => void;
  onOpenDetachedPrintablePage?: () => void;
}

export default function ExportDossierWidget({
  courseCount,
  isDownloading = false,
  onDownloadHtmlDossier,
  onDownloadImage,
  onExportIcal,
  onExportTimetablesJson,
  onOpenPrintablePage,
  onOpenDetachedPrintablePage,
}: ExportDossierWidgetProps) {
  const [themeChoice, setThemeChoice] = useState<DossierThemeChoice>("current");
  const [imageLayout, setImageLayout] = useState<ImageLayoutChoice>("active");
  const [imageFormat, setImageFormat] = useState<"jpg" | "png">("jpg");
  const imageFormatLabel = imageFormat === "jpg" ? "JPEG" : "PNG";
  const canExport = courseCount > 0 && !isDownloading;

  return (
    <section
      aria-label="Export Dossier widget"
      className="@container min-w-0 space-y-5 rounded-2xl border border-border-strong dark:border-border card-surface p-4 sm:p-5 shadow-xs"
      data-tour-id="ffcs-export"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-text-heading">Export Dossier</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose a format and save the timetable for sharing or printing.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-x-5 gap-y-5 @lg:grid-cols-2">
        <div className="space-y-2.5">
          <div>
            <h5 className="text-xs font-bold text-text-heading">HTML dossier</h5>
            <p className="mt-0.5 text-[11px] text-muted-foreground">A standalone, copyable course report.</p>
          </div>
          <div role="group" aria-label="HTML dossier theme" className="space-y-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Theme</span>
            <SegmentedControl
              value={themeChoice}
              onChange={setThemeChoice}
              grow
              className="w-full [&_button]:min-h-11"
              options={[
                { value: "current", label: "Current" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => onDownloadHtmlDossier?.(themeChoice === "current" ? undefined : themeChoice)}
            disabled={!canExport}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            title="Download a standalone HTML dossier"
          >
            <Download className="h-4 w-4" />
            <span>{isDownloading ? "Preparing dossier…" : "Download HTML dossier"}</span>
          </button>
        </div>

        <div className="space-y-2.5 border-t border-border-strong/40 pt-4 @lg:border-l @lg:border-t-0 @lg:pl-5 @lg:pt-0">
          <div>
            <h5 className="text-xs font-bold text-text-heading">Timetable image</h5>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Pick the layout and image format.</p>
          </div>
          <div className="grid grid-cols-1 gap-2 @sm:grid-cols-[minmax(0,1fr)_auto] @sm:items-center">
            <div role="group" aria-label="Image layout" className="min-w-0 space-y-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Layout</span>
              <SegmentedControl
                value={imageLayout}
                onChange={setImageLayout}
                grow
                className="w-full [&_button]:min-h-11"
                options={[
                  { value: "active", label: "Active" },
                  { value: "horizontal", label: "Grid" },
                  { value: "vertical", label: "Vertical" },
                ]}
              />
            </div>
            <div role="group" aria-label="Image format" className="space-y-1 @sm:w-36">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Format</span>
              <SegmentedControl
                value={imageFormat}
                onChange={setImageFormat}
                grow
                className="w-full [&_button]:min-h-11"
                options={[
                  { value: "jpg", label: "JPEG" },
                  { value: "png", label: "PNG" },
                ]}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDownloadImage?.(imageFormat, imageLayout === "active" ? undefined : imageLayout)}
            disabled={!canExport}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-semibold text-text-heading transition-colors hover:bg-surface-secondary disabled:cursor-not-allowed disabled:opacity-50"
            title={`Download ${imageFormatLabel} timetable image`}
          >
            <FileDown className="h-4 w-4 text-blue-500" />
            <span>{isDownloading ? "Preparing image…" : `Download ${imageFormatLabel} image`}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-border-strong/40 border-y border-border-strong/40 @sm:grid-cols-2 @sm:divide-x @sm:divide-y-0">
        <button
          type="button"
          onClick={onExportIcal}
          className="flex min-h-14 items-center gap-3 py-2.5 text-left transition-colors hover:text-blue-600 dark:hover:text-blue-400 @sm:pr-3"
          title="Export the active timetable to Apple or Google Calendar"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
            <CalendarDays className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-text-heading">Calendar file</span>
            <span className="block text-[10px] text-muted-foreground">iCal · active timetable</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onExportTimetablesJson}
          className="flex min-h-14 items-center gap-3 py-2.5 text-left transition-colors hover:text-indigo-600 dark:hover:text-indigo-400 @sm:pl-3"
          title="Export all saved timetables as JSON"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
            <Save className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold text-text-heading">Backup JSON</span>
            <span className="block text-[10px] text-muted-foreground">All saved timetables</span>
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-2 @sm:flex-row @sm:items-center">
        {onOpenPrintablePage && (
          <button
            type="button"
            onClick={onOpenPrintablePage}
            className="flex min-h-10 items-center justify-center gap-2 rounded-lg bg-surface-secondary/60 px-3 text-xs font-semibold text-text-heading transition-colors hover:bg-surface-secondary"
          >
            <FileText className="h-3.5 w-3.5 text-indigo-500" />
            <span>In-app dossier</span>
          </button>
        )}
        {onOpenDetachedPrintablePage && (
          <button
            type="button"
            onClick={onOpenDetachedPrintablePage}
            className="flex min-h-10 items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground transition-colors hover:text-text-heading"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open print tab</span>
          </button>
        )}
      </div>
    </section>
  );
}
