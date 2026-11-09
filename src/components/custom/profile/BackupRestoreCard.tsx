"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { backupFilename, createBackup, describeBackup, parseBackup, restoreBackup, type Backup } from "@/lib/backup";

type Pending = { backup: Backup; summary: string[]; skipped: number };

/**
 * Settings > Advanced: download a backup of tasks, FFCS plans, friends and
 * settings, or restore one on a new phone. Passwords are never included.
 */
export default function BackupRestoreCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const download = () => {
    const backup = createBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage({ tone: "ok", text: `Saved ${Object.keys(backup.data).length} items to ${a.download}.` });
  };

  const onFile = async (file: File | undefined) => {
    setPending(null);
    setMessage(null);
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if ("error" in parsed) {
      setMessage({ tone: "error", text: parsed.error });
      return;
    }
    if (parsed.keys.length === 0) {
      setMessage({ tone: "error", text: "This backup is empty, so there is nothing to restore." });
      return;
    }
    setPending({ backup: parsed.backup, summary: describeBackup(parsed.backup), skipped: parsed.skipped.length });
  };

  const confirmRestore = () => {
    if (!pending) return;
    const n = restoreBackup(pending.backup);
    setPending(null);
    setMessage({ tone: "ok", text: `Restored ${n} items. Reloading…` });
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
          <Download size={18} />
        </div>
        <div className="min-w-0">
          <span className="font-bold text-xs text-zinc-900 dark:text-white block">Backup & restore</span>
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
            Save your tasks, FFCS plans, friends and settings to a file, and restore them on a new phone or after
            clearing your browser. Passwords are never included.
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
        >
          <Download size={14} aria-hidden="true" />
          Download backup
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <Upload size={14} aria-hidden="true" />
          Restore from file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Backup file"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {pending && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-xs text-amber-900 dark:text-amber-100">
          <p className="font-bold">
            Restore this backup
            {pending.backup.exportedAt ? ` from ${new Date(pending.backup.exportedAt).toLocaleDateString()}` : ""}?
          </p>
          <p>
            It contains {pending.summary.length ? pending.summary.join(", ") : `${Object.keys(pending.backup.data).length} items`}.
            Matching data on this device will be replaced; anything else is kept.
            {pending.skipped ? ` ${pending.skipped} unrecognised entries will be ignored.` : ""}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={confirmRestore}
              className="rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700 cursor-pointer"
            >
              Restore and reload
            </button>
            <button
              type="button"
              onClick={() => setPending(null)}
              className="rounded-lg px-3 py-1.5 font-bold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role="status"
          className={`text-[11px] font-medium ${message.tone === "error" ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
