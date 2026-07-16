"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Share2, QrCode, Clipboard } from "lucide-react";
import Modal from "../shared/Modal";
import FetchButton from "../shared/FetchButton";
import { exportScheduleCode } from "@/lib/socialUtils";

export default function ShareScheduleModal({
  attendanceData,
  onClose,
}) {
  const [activeTab, setActiveTab] = useState<"qr" | "text">("qr");
  const [copied, setCopied] = useState(false);

  const name = attendanceData?.studentInfo?.name || "Unknown";
  const regNumber = attendanceData?.studentInfo?.regNumber || "0000";
  const attendance = Array.isArray(attendanceData?.attendance) ? attendanceData.attendance : [];
  const code = exportScheduleCode(attendance, name, regNumber);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-xs">
      <div className="flex items-center gap-2 mb-3">
        <Share2 className="w-5 h-5 text-indigo-500 animate-pulse" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Share Schedule
        </h2>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4 leading-normal">
        Share your schedule with friends to compare timetables and coordinate free slots.
      </p>

      {/* Tab Selector */}
      <div className="flex w-full gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 p-1 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab("qr")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer border border-transparent ${
            activeTab === "qr"
              ? "bg-white text-info border-zinc-200/50 shadow-2xs dark:bg-zinc-900 dark:border-zinc-800/50"
              : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          QR Code
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("text")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer border border-transparent ${
            activeTab === "text"
              ? "bg-white text-info border-zinc-200/50 shadow-2xs dark:bg-zinc-900 dark:border-zinc-800/50"
              : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
          }`}
        >
          <Clipboard className="w-3.5 h-3.5" />
          Text Code
        </button>
      </div>

      {activeTab === "qr" ? (
        <div className="flex flex-col items-center justify-center p-4 border border-zinc-200/50 dark:border-zinc-800/80 bg-gradient-to-br from-white to-zinc-55/20 dark:from-zinc-900/60 dark:to-zinc-950/40 rounded-2xl shadow-2xs">
          <div className="bg-white p-2.5 rounded-2xl shadow-xs mb-3 border border-zinc-100">
            <QRCodeSVG value={code} size={120} />
          </div>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center font-medium max-w-[210px] leading-relaxed">
            Have your friend scan this code using their <strong>Add Friend</strong> camera scanner.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="bg-zinc-50/50 dark:bg-zinc-900/20 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-3">
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-550 block mb-1.5">
              Copy-Paste Code
            </label>
            <div className="max-h-[80px] overflow-y-auto text-xs font-mono text-zinc-650 dark:text-zinc-350 break-all select-all pr-1" style={{ scrollbarWidth: "none" }}>
              {code}
            </div>
          </div>

          <FetchButton onClick={handleCopy} className="w-full justify-center py-2.5">
            {copied ? "Copied!" : "Copy Code"}
          </FetchButton>
        </div>
      )}
    </Modal>
  );
}
