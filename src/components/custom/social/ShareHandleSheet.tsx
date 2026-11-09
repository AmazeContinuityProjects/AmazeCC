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

import { useCallback, useMemo, useState } from "react";
import { Check, Copy, Download, Link2, Loader2, MessageSquare, RefreshCcw, Share2, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import BottomSheet from "../shared/BottomSheet";
import { useSocialData } from "@/lib/social/useSocialData";
import { buildInviteLink } from "@/lib/social/handle";
import { downloadHtmlImage } from "@/lib/imageDownload";
import posthog from "posthog-js";

const posthogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

export default function ShareHandleSheet({ onClose }: { onClose: () => void }) {
  const { handle, identity, markDirty } = useSocialData();
  const [copied, setCopied] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [qrError, setQrError] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  /** `/?add=<handle>`: opens the Add friend sheet on this handle. */
  const inviteLink = useMemo(
    () => (handle && typeof window !== "undefined" ? buildInviteLink(handle, window.location.origin) : null),
    [handle],
  );
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const name = identity?.displayName || "Student";

  const copy = useCallback(() => {
    if (!handle) return;
    void navigator.clipboard.writeText(handle).then(() => {
      if (posthogConfigured) posthog.capture("social_handle_shared", { method: "copy" });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [handle]);

  const copyLink = useCallback(() => {
    if (!inviteLink) return;
    void navigator.clipboard.writeText(inviteLink).then(() => {
      if (posthogConfigured) posthog.capture("social_handle_shared", { method: "copy_link" });
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [inviteLink]);

  const nativeShare = useCallback(() => {
    if (!inviteLink || !handle) return;
    navigator
      .share({
        title: "Pair with me on AmazeCC",
        text: `Pair timetables with me on AmazeCC (handle ${handle}):`,
        url: inviteLink,
      })
      .then(() => {
        if (posthogConfigured) posthog.capture("social_handle_shared", { method: "native_share" });
      })
      .catch(() => {
        /* dismissed */
      });
  }, [inviteLink, handle]);

  const requestSync = useCallback(() => {
    setSyncing(true);
    markDirty();
    setTimeout(() => setSyncing(false), 1500);
  }, [markDirty]);

  const downloadQR = useCallback(() => {
    if (!handle) return;
    const svg = document.querySelector("#social-handle-qr svg");
    if (!svg) return;
    // The QR rides into the capture as markup: white 30px padding on every
    // side (the canvas version's +60px), rendered by the shared engine.
    const svgData = new XMLSerializer().serializeToString(svg);
    void downloadHtmlImage(
      `<div style="display:inline-block;background:#ffffff;padding:30px">${svgData}</div>`,
      `${name.replace(/\s+/g, "_")}_amaze_handle`,
      { format: "png", backgroundColor: "#ffffff" },
    )
      .then(() => {
        if (posthogConfigured) posthog.capture("social_handle_shared", { method: "qr_download" });
      })
      .catch(() => setQrError(true));
  }, [handle, name]);

  const shareWhatsApp = useCallback(() => {
    if (!handle) return;
    const text = encodeURIComponent(
      inviteLink
        ? `Pair timetables with me on AmazeCC. Tap to add me: ${inviteLink}\n(or enter my handle ${handle})`
        : `Share your timetable with me on AmazeCC. My handle is ${handle}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
    if (posthogConfigured) posthog.capture("social_handle_shared", { method: "whatsapp" });
  }, [handle, inviteLink]);

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="social-share-handle"
      maxWidth="max-w-md"
      title={name}
      subtitle="Your handle"
      icon={<Link2 className="w-4.5 h-4.5" />}
      accent="border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
      closeLabel="Close share sheet"
    >
      <div className="text-left space-y-5">
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

            {inviteLink && (
              <div className="p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-black text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                  <Link2 className="w-3.5 h-3.5 text-indigo-500" />
                  Invite link
                </p>
                <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 truncate" title={inviteLink}>
                  {inviteLink}
                </p>
                <div className={`grid gap-2 ${canNativeShare ? "grid-cols-2" : "grid-cols-1"}`}>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    {linkCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {linkCopied ? "Link copied" : "Copy link"}
                  </button>
                  {canNativeShare && (
                    <button
                      type="button"
                      onClick={nativeShare}
                      className="py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" />
                      Share…
                    </button>
                  )}
                </div>
                <p className="text-[10.5px] text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed">
                  Opens AmazeCC with your handle filled in. They still confirm before anything is shared.
                </p>
              </div>
            )}

            <div className="flex flex-col items-center gap-3 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
              {qrError ? (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium py-6 text-center">
                  The QR code could not be drawn on this browser. Copy the handle instead.
                </p>
              ) : (
                <div id="social-handle-qr" className="bg-white p-4 rounded-2xl">
                  <QRCodeSVG value={inviteLink ?? handle} size={160} level="M" />
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
                Nothing. The handle identifies you, not your schedule. A student who enters it can request a pairing,
                and{" "}
                <strong className="text-zinc-700 dark:text-zinc-200">
                  that grants them your timetable for this term
                </strong>{" "}
                — pairing is mutual, and every pair shares full detail: course, venue and title. End it any time from
                Pairs.
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
                A handle is issued the first time your timetable is derived from VTOP. Run a sync and it will appear
                here.
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
