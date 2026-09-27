"use client";

/**
 * Share your handle.
 *
 * Replaces `ShareScheduleModal`, which emitted a v6 token or a share link that
 * carried a compressed copy of the whole timetable. Nothing about the schedule
 * needs to travel any more: the server already has it, and pairing is what
 * grants access. The mutuality disclosure is here because "send them your handle"
 * is the moment someone should learn that pairing is two-way.
 */

import { useCallback, useState } from "react";
import { Check, Copy, Download, Link2, Loader2, MessageSquare, RefreshCcw, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import BottomSheet from "../shared/BottomSheet";
import { useSocialData } from "@/lib/social/useSocialData";

export default function ShareHandleSheet({ onClose }: { onClose: () => void }) {
  const { handle, identity, markDirty } = useSocialData();
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [qrError, setQrError] = useState(false);

  const name = identity?.displayName || "Student";

  const copy = useCallback(() => {
    if (!handle) return;
    void navigator.clipboard.writeText(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [handle]);

  const requestSync = useCallback(() => {
    setSyncing(true);
    markDirty();
    setTimeout(() => setSyncing(false), 1500);
  }, [markDirty]);

  const downloadQR = useCallback(() => {
    if (!handle) return;
    const svg = document.querySelector("#social-handle-qr svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 60;
      canvas.height = img.height + 60;
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 30, 30);
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${name.replace(/\s+/g, "_")}_amaze_handle.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.onerror = () => setQrError(true);
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, [handle, name]);

  const shareWhatsApp = useCallback(() => {
    if (!handle) return;
    const text = encodeURIComponent(`Share your timetable with me on AmazeCC. My handle is ${handle}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  }, [handle]);

  return (
    <BottomSheet onClose={onClose} overlayId="social-share-handle" maxWidth="max-w-md">
      <div className="text-left space-y-5">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl flex items-center justify-center border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Link2 className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit leading-tight truncate">
              {name}
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Your handle</p>
          </div>
        </div>

        {handle ? (
          <>
            <button
              type="button"
              onClick={copy}
              title="Tap to copy"
              className="w-full text-center text-2xl font-black font-mono tracking-[0.2em] rounded-2xl px-3 py-5 text-indigo-700 dark:text-indigo-300 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors cursor-pointer"
            >
              {handle}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={copy}
                className="py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy handle"}
              </button>
              <button
                type="button"
                onClick={shareWhatsApp}
                className="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                WhatsApp
              </button>
            </div>

            <div className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
              {qrError ? (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium py-6 text-center">
                  The QR code could not be drawn on this browser. Copy the handle instead.
                </p>
              ) : (
                <div id="social-handle-qr" className="bg-white p-4 rounded-2xl">
                  <QRCodeSVG value={handle} size={160} level="M" />
                </div>
              )}
              {!qrError && (
                <button
                  type="button"
                  onClick={downloadQR}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer text-[11px] font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Save as image
                </button>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 space-y-1.5">
              <p className="flex items-center gap-1.5 text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                What your handle gives away
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                Nothing. The handle identifies you, not your schedule. A student who enters it can
                request a pairing, and{" "}
                <strong className="text-zinc-700 dark:text-zinc-200">that grants them your
                timetable for this term</strong> — pairing is mutual, and you choose coarse or full
                detail before it happens. End it any time from Pairs.
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className="p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 text-center space-y-3">
              <span className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center border border-zinc-200 dark:border-zinc-800">
                <RefreshCcw className="w-5 h-5 text-zinc-400" />
              </span>
              <h4 className="text-sm font-black text-zinc-800 dark:text-zinc-100 font-outfit">
                Your handle is not ready yet
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-[280px] mx-auto">
                A handle is issued the first time your timetable is derived from VTOP. Run a sync and
                it will appear here.
              </p>
            </div>
            <button
              type="button"
              onClick={requestSync}
              disabled={syncing}
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
              {syncing ? "Syncing…" : "Sync now"}
            </button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
