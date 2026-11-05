"use client";

import { useState } from "react";
import { Cloud, Cpu, KeyRound, ShieldCheck, UploadCloud } from "lucide-react";
import BottomSheet from "@/components/custom/shared/BottomSheet";
import { ListShell, SegmentedControl, SettingRow } from "@/components/custom/shared/primitives";
import type { CleanupMode } from "@/lib/scanner/types";
import { loadScannerSettings, saveScannerSettings, type ScannerSettings } from "@/lib/scanner/settings";

/**
 * Scanner settings: OCR engine, cleanup default, and the (optional) upload.
 *
 * Every change persists immediately through `saveScannerSettings` — there is
 * no Apply button to forget, and the sheet reflects what storage actually
 * holds, because that is what the pipeline will read on the next scan.
 */

const ENGINE_OPTIONS: readonly { value: ScannerSettings["ocrEngine"]; label: string; title: string }[] = [
  { value: "tesseract", label: "Local", title: "Runs on this device, works offline after first load" },
  { value: "ocr.space", label: "Cloud", title: "OCR.space API — needs an API key" },
  { value: "auto", label: "Auto", title: "Local first, cloud only when local fails" },
];

const CLEANUP_OPTIONS: readonly { value: CleanupMode; label: string; title: string }[] = [
  { value: "original", label: "Original", title: "Keep the captured colours" },
  { value: "grayscale", label: "Gray", title: "Desaturate only" },
  { value: "enhanced", label: "Enhanced", title: "Contrast-boosted for reading" },
  { value: "bw", label: "B&W", title: "Thresholded black and white" },
];

const INPUT =
  "w-full px-3 py-2 rounded-lg border border-border-muted dark:border-border bg-surface dark:bg-surface-secondary text-sm font-bold text-text-heading placeholder:text-text-muted placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-150";

interface ScannerSettingsSheetProps {
  onClose: () => void;
}

export default function ScannerSettingsSheet({ onClose }: ScannerSettingsSheetProps) {
  const [settings, setSettings] = useState<ScannerSettings>(() => loadScannerSettings());

  const update = (patch: Partial<ScannerSettings>) => setSettings(saveScannerSettings(patch));
  const cloudKeyNeeded = settings.ocrEngine !== "tesseract";

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="paper-scanner-settings"
      title="Scanner settings"
      subtitle="Text recognition, cleanup and upload"
      icon={<ShieldCheck className="h-5 w-5" />}
    >
      <div className="space-y-4 pt-3">
        <ListShell>
          <SettingRow
            title="Text recognition"
            description={
              settings.ocrEngine === "tesseract"
                ? "On-device OCR — private and offline after the first load."
                : settings.ocrEngine === "ocr.space"
                  ? "Cloud OCR via OCR.space — faster, sends page images."
                  : "Local first; falls back to the cloud only when local OCR fails."
            }
            badge={
              settings.ocrEngine === "tesseract" ? (
                <Cpu className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
              ) : (
                <Cloud className="h-3.5 w-3.5 text-sky-500" aria-hidden />
              )
            }
            control={
              <SegmentedControl
                options={ENGINE_OPTIONS}
                value={settings.ocrEngine}
                onChange={(v) => update({ ocrEngine: v })}
              />
            }
            stacked
          />

          {cloudKeyNeeded && (
            <SettingRow
              title="OCR API key"
              description="Stored on this device only. Get a free key at ocr.space."
              control={
                <input
                  type="password"
                  value={settings.ocrApiKey}
                  onChange={(e) => update({ ocrApiKey: e.target.value })}
                  placeholder="Enter API key"
                  className={INPUT}
                  autoComplete="off"
                  spellCheck={false}
                />
              }
              stacked
            />
          )}

          <SettingRow
            title="Default cleanup"
            description="Applied to new scans until you change it per page."
            control={
              <SegmentedControl
                options={CLEANUP_OPTIONS}
                value={settings.defaultCleanup}
                onChange={(v) => update({ defaultCleanup: v })}
              />
            }
            stacked
          />

          <SettingRow
            title="Upload after scanning"
            description="Scans always save to this device first; upload only pushes a copy when an endpoint is set."
            onRowClick={() => update({ autoUpload: !settings.autoUpload })}
            switchChecked={settings.autoUpload}
            control={<SwitchTrackLike checked={settings.autoUpload} />}
          />

          {settings.autoUpload && (
            <SettingRow
              title="Upload endpoint"
              description="Leave empty to keep everything local. Accepts the papers-codechef FormData contract."
              control={
                <input
                  type="url"
                  value={settings.uploadEndpoint}
                  onChange={(e) => update({ uploadEndpoint: e.target.value })}
                  placeholder="https://…"
                  className={INPUT}
                  autoComplete="off"
                  spellCheck={false}
                />
              }
              stacked
            />
          )}
        </ListShell>

        <div className="flex items-start gap-2.5 rounded-2xl border border-border-muted dark:border-border bg-surface-secondary dark:bg-surface/60 px-4 py-3">
          <UploadCloud className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden />
          <p className="text-left text-[11px] font-medium text-text-secondary dark:text-text-muted">
            <span className="font-extrabold text-text-heading">Local-first.</span> Every scan is written to this
            device&apos;s storage before anything touches the network, and an upload failure never loses it.
          </p>
        </div>

        {cloudKeyNeeded && !settings.ocrApiKey && (
          <p className="flex items-center gap-2 px-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
            <KeyRound className="h-3.5 w-3.5 shrink-0" aria-hidden />
            No API key set — cloud OCR will report itself unavailable until one is.
          </p>
        )}
      </div>
    </BottomSheet>
  );
}

/** Decorative track for `SettingRow`'s row-as-switch pattern (aria lives on the row). */
function SwitchTrackLike({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative block h-8 w-14 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? "bg-indigo-500" : "bg-border-muted dark:bg-surface-hover"
      }`}
    >
      <span
        className={`absolute top-1 left-1 block h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-6" : ""
        }`}
      />
    </span>
  );
}
