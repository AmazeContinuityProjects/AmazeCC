"use client";

import { useRef, useState } from "react";
import { Cloud, Download, Upload } from "lucide-react";
import { useAtomValue } from "jotai";
import { backupFilename, createBackup, describeBackup, parseBackup, restoreBackup, type Backup } from "@/lib/backup";
import { demoModeAtom, isLoggedInAtom } from "@/store/authAtoms";

type Pending = { backup: Backup; summary: string[]; skipped: number };

/**
 * Settings > Advanced: download a backup of tasks, FFCS plans, friends and
 * settings, or restore one on a new phone. Passwords are never included.
 */
export default function BackupRestoreCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const isLoggedIn = useAtomValue(isLoggedInAtom);
  const demoMode = useAtomValue(demoModeAtom);
  const [pending, setPending] = useState<Pending | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [cloudUpdatedAt, setCloudUpdatedAt] = useState<string | null>(null);
  const [cloudChecked, setCloudChecked] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [pendingCloudRestore, setPendingCloudRestore] = useState(false);
  const [confirmCloudDelete, setConfirmCloudDelete] = useState(false);
  const [cloudBusy, setCloudBusy] = useState(false);
  const cloudAvailable = isLoggedIn && !demoMode;

  // This module includes the sync engine, so keep it out of the settings
  // chunk until someone explicitly uses cloud backup.
  const loadCloudBackup = () => import("@/lib/cloudBackup");

  const requirePassphrase = () => {
    if (passphrase.length < 8) {
      setMessage({ tone: "error", text: "Use a passphrase of at least 8 characters." });
      return false;
    }
    return true;
  };

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

  const checkCloudBackup = async () => {
    setCloudBusy(true);
    setMessage(null);
    try {
      const { getCloudBackupInfo } = await loadCloudBackup();
      const info = await getCloudBackupInfo();
      setCloudChecked(true);
      setCloudUpdatedAt(info.updatedAt);
      return info;
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not check cloud backup." });
      return null;
    } finally {
      setCloudBusy(false);
    }
  };

  const uploadCloud = async () => {
    if (!requirePassphrase()) return;
    setMessage(null);
    // A first cloud copy (none on the server yet) always asks for the
    // passphrase twice, however the student got here: a typo would make the
    // backup unrecoverable.
    let hasCloudCopy = cloudChecked ? cloudUpdatedAt !== null : false;
    if (!cloudChecked) {
      const info = await checkCloudBackup();
      if (!info) return;
      hasCloudCopy = Boolean(info.envelope);
    }
    if (!hasCloudCopy && !needsConfirmation) {
      setNeedsConfirmation(true);
      return;
    }
    if (needsConfirmation && passphrase !== confirmation) {
      setMessage({ tone: "error", text: "The passphrases do not match." });
      return;
    }
    setCloudBusy(true);
    try {
      const { uploadCloudBackup } = await loadCloudBackup();
      const updatedAt = await uploadCloudBackup(passphrase);
      setCloudUpdatedAt(updatedAt);
      setCloudChecked(true);
      setNeedsConfirmation(false);
      setConfirmation("");
      setMessage({ tone: "ok", text: "Encrypted backup saved to the cloud." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not save cloud backup." });
    } finally {
      setCloudBusy(false);
    }
  };

  const startCloudRestore = async () => {
    if (!requirePassphrase()) return;
    let hasCloudCopy = cloudUpdatedAt !== null;
    if (!cloudChecked) {
      const info = await checkCloudBackup();
      if (!info) return; // the check failed and already said why
      hasCloudCopy = Boolean(info.envelope);
    }
    if (!hasCloudCopy) {
      setMessage({ tone: "error", text: "There is no cloud backup for this account yet." });
      return;
    }
    setPendingCloudRestore(true);
  };

  const confirmCloudRestore = async () => {
    setCloudBusy(true);
    setMessage(null);
    try {
      const { restoreCloudBackup } = await loadCloudBackup();
      const count = await restoreCloudBackup(passphrase);
      setPendingCloudRestore(false);
      setMessage({ tone: "ok", text: `Restored ${count} items. Reloading…` });
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not restore cloud backup." });
    } finally {
      setCloudBusy(false);
    }
  };

  const deleteCloud = async () => {
    if (!confirmCloudDelete) {
      setConfirmCloudDelete(true);
      return;
    }
    setCloudBusy(true);
    setMessage(null);
    try {
      const { deleteCloudBackup } = await loadCloudBackup();
      await deleteCloudBackup();
      setCloudUpdatedAt(null);
      setCloudChecked(true);
      setConfirmCloudDelete(false);
      setMessage({ tone: "ok", text: "Cloud backup deleted." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Could not delete cloud backup." });
    } finally {
      setCloudBusy(false);
    }
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
            It contains{" "}
            {pending.summary.length ? pending.summary.join(", ") : `${Object.keys(pending.backup.data).length} items`}.
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

      <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-3 space-y-3">
        <div className="flex items-start gap-3.5 min-w-0">
          <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 shrink-0">
            <Cloud size={18} />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-xs text-zinc-900 dark:text-white block">Cloud backup (optional)</span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-0.5">
              Your backup is encrypted before it leaves this device. A forgotten passphrase cannot be recovered.
            </span>
            {cloudChecked && (
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 block mt-1">
                {cloudUpdatedAt
                  ? `Last cloud backup: ${new Date(cloudUpdatedAt).toLocaleString()}`
                  : "No cloud backup yet."}
              </span>
            )}
          </div>
        </div>

        {!cloudAvailable && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Sign in to VTOP to use cloud backup. It is unavailable in demo mode.
          </p>
        )}

        <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
          Cloud backup passphrase
          <input
            type="password"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            minLength={8}
            disabled={!cloudAvailable || cloudBusy}
            autoComplete="new-password"
            className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-describedby="cloud-passphrase-help"
          />
        </label>
        <p id="cloud-passphrase-help" className="text-[11px] text-zinc-500 dark:text-zinc-400">
          At least 8 characters. We cannot reset or recover it.
        </p>

        {needsConfirmation && (
          <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
            Confirm passphrase
            <input
              type="password"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              disabled={!cloudAvailable || cloudBusy}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white disabled:cursor-not-allowed disabled:opacity-50"
            />
          </label>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void uploadCloud()}
            disabled={!cloudAvailable || cloudBusy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            <Cloud size={14} aria-hidden="true" />
            {needsConfirmation ? "Confirm and back up" : "Back up to cloud"}
          </button>
          <button
            type="button"
            onClick={() => void startCloudRestore()}
            disabled={!cloudAvailable || cloudBusy}
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            Restore from cloud
          </button>
          <button
            type="button"
            onClick={() => void deleteCloud()}
            disabled={!cloudAvailable || cloudBusy}
            className="rounded-xl px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-400 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
          >
            {confirmCloudDelete ? "Tap again to delete" : "Delete cloud copy"}
          </button>
        </div>

        {pendingCloudRestore && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2 text-xs text-amber-900 dark:text-amber-100">
            <p className="font-bold">Restore and replace matching data on this device?</p>
            <p>Your cloud backup will be decrypted only on this device. Anything else on this device is kept.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void confirmCloudRestore()}
                disabled={cloudBusy}
                className="rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
              >
                Restore and reload
              </button>
              <button
                type="button"
                onClick={() => setPendingCloudRestore(false)}
                disabled={cloudBusy}
                className="rounded-lg px-3 py-1.5 font-bold hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

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
