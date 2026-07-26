"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Share2, QrCode, Link as LinkIcon, Copy, Check, MessageSquare } from "lucide-react";
import Modal from "../shared/Modal";
import FetchButton from "../shared/FetchButton";
import { exportScheduleCode, exportShareableLink } from "@/lib/socialUtils";

export default function ShareScheduleModal({
  attendanceData,
  onClose,
}: {
  attendanceData: any;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"link" | "code" | "qr">("link");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const name = attendanceData?.studentInfo?.name || "Unknown";
  const regNumber = attendanceData?.studentInfo?.regNumber || "0000";
  const attendance = Array.isArray(attendanceData?.attendance) ? attendanceData.attendance : [];
  
  const code = exportScheduleCode(attendance, name, regNumber);
  const shareLink = exportShareableLink(attendance, name, regNumber);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Hey! Here is my VIT schedule profile on AmazeCC:\n${shareLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Share Profile & Timetable
            </h2>
            <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
              Send a 1-click link or QR code to your friends
            </p>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex w-full gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 p-1 my-4">
        <button
          type="button"
          onClick={() => setActiveTab("link")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer border border-transparent ${
            activeTab === "link"
              ? "bg-white text-indigo-600 border-zinc-200/50 shadow-2xs dark:bg-zinc-900 dark:text-indigo-400 dark:border-zinc-800/50"
              : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          Short Link
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("code")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer border border-transparent ${
            activeTab === "code"
              ? "bg-white text-indigo-600 border-zinc-200/50 shadow-2xs dark:bg-zinc-900 dark:text-indigo-400 dark:border-zinc-800/50"
              : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
          }`}
        >
          <Copy className="w-3.5 h-3.5" />
          Code
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("qr")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer border border-transparent ${
            activeTab === "qr"
              ? "bg-white text-indigo-600 border-zinc-200/50 shadow-2xs dark:bg-zinc-900 dark:text-indigo-400 dark:border-zinc-800/50"
              : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          QR Card
        </button>
      </div>

      {activeTab === "link" && (
        <div className="flex flex-col gap-3">
          <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-3.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-1.5">
              Instant Share Link
            </label>
            <input
              readOnly
              value={shareLink}
              onClick={handleCopyLink}
              className="w-full text-xs font-mono bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-700 dark:text-zinc-300 cursor-pointer truncate"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <FetchButton onClick={handleCopyLink} className="justify-center py-2.5">
              {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? "Link Copied!" : "Copy Link"}
            </FetchButton>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <MessageSquare className="w-4 h-4" />
              WhatsApp
            </button>
          </div>
        </div>
      )}

      {activeTab === "code" && (
        <div className="flex flex-col gap-3">
          <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl p-3.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-1.5">
              Raw Profile Code
            </label>
            <div className="max-h-[80px] overflow-y-auto text-xs font-mono text-zinc-600 dark:text-zinc-300 break-all select-all pr-1">
              {code}
            </div>
          </div>

          <FetchButton onClick={handleCopyCode} className="w-full justify-center py-2.5">
            {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copiedCode ? "Code Copied!" : "Copy Raw Code"}
          </FetchButton>
        </div>
      )}

      {activeTab === "qr" && (
        <div className="flex flex-col items-center justify-center p-4 border border-zinc-200/60 dark:border-zinc-800/80 bg-gradient-to-br from-white to-zinc-50/20 dark:from-zinc-900/60 dark:to-zinc-950/40 rounded-2xl">
          <div className="bg-white p-3 rounded-2xl shadow-xs mb-3 border border-zinc-100">
            <QRCodeSVG value={shareLink} size={140} />
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center font-medium max-w-[220px]">
            Scan with any camera or AmazeCC camera scanner to import schedule
          </p>
        </div>
      )}
    </Modal>
  );
}
