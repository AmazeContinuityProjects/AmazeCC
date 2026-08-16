"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { 
  Share2, 
  QrCode, 
  Link as LinkIcon, 
  Copy, 
  Check, 
  MessageSquare, 
  Download, 
  RefreshCcw, 
  Clock, 
  Sparkles, 
  ShieldCheck,
  Zap
} from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"link" | "qr" | "code">("link");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Expiry Duration in Minutes: 5, 15, 60, or 0 (permanent)
  const [expiryMinutes, setExpiryMinutes] = useState<number>(5);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(300);
  const [generationKey, setGenerationKey] = useState<number>(Date.now());

  const qrRef = useRef<HTMLDivElement>(null);

  const name = attendanceData?.studentInfo?.name || "Student";
  const regNumber = attendanceData?.studentInfo?.regNumber || "VIT Student";
  const attendance = Array.isArray(attendanceData?.attendance) ? attendanceData.attendance : [];

  // Generate code & link based on current expiration choice and generationKey
  const code = exportScheduleCode(attendance, name, regNumber, expiryMinutes);
  const shareLink = exportShareableLink(attendance, name, regNumber, expiryMinutes);

  // Handle countdown timer
  useEffect(() => {
    if (expiryMinutes === 0) {
      setRemainingSeconds(0);
      return;
    }

    setRemainingSeconds(expiryMinutes * 60);

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryMinutes, generationKey]);

  const handleRegenerate = useCallback(() => {
    setGenerationKey(Date.now());
  }, []);

  const formatCountdown = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

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
    const tempNote = expiryMinutes > 0 ? ` ⏱️ (Valid for next ${expiryMinutes} minutes)` : "";
    const text = encodeURIComponent(`Hey! Here is my temporary VIT schedule profile on AmazeCC${tempNote}:\n${shareLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;
    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width + 60;
      canvas.height = img.height + 60;
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 30, 30);
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `${name.replace(/\s+/g, "_")}_schedule_pass.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
      }
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-md">
      <div className="text-left space-y-4">
        
        {/* VIP Pass Header */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 text-white shadow-md relative overflow-hidden flex items-center justify-between">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 backdrop-blur-md flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
              {name.substring(0, 1).toUpperCase()}
            </div>
            <div>
              <h3 className="text-sm font-black font-outfit text-white leading-tight">{name}</h3>
              <p className="text-[11px] text-indigo-200 font-mono mt-0.5">{regNumber}</p>
            </div>
          </div>

          <div className="relative z-10 text-right">
            <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-white/20 border border-white/30 backdrop-blur-md text-white shadow-2xs inline-flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-300" />
              <span>Amaze Pass</span>
            </span>
          </div>
        </div>

        {/* Temporary Expiration Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-outfit flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              <span>Link Expiration Timer</span>
            </label>

            {expiryMinutes > 0 && remainingSeconds > 0 && (
              <span className="text-[11px] font-mono font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-lg border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                Expires in {formatCountdown(remainingSeconds)}
              </span>
            )}
            {expiryMinutes > 0 && remainingSeconds === 0 && (
              <span className="text-[11px] font-black text-red-500 bg-red-50 dark:bg-red-950/60 px-2 py-0.5 rounded-lg border border-red-200">
                Expired! Regenerate below
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
            {[
              { label: "⚡ 5 Min", min: 5 },
              { label: "⏱️ 15 Min", min: 15 },
              { label: "⏳ 1 Hour", min: 60 },
              { label: "♾️ Permanent", min: 0 },
            ].map((item) => (
              <button
                key={item.min}
                type="button"
                onClick={() => setExpiryMinutes(item.min)}
                className={`py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                  expiryMinutes === item.min
                    ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex w-full gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 p-1 border border-zinc-200/60 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab("link")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "link"
                ? "bg-white text-indigo-600 shadow-2xs dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Short Link</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "qr"
                ? "bg-white text-indigo-600 shadow-2xs dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>QR Pass</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("code")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "code"
                ? "bg-white text-indigo-600 shadow-2xs dark:bg-zinc-800 dark:text-indigo-400"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Raw Token</span>
          </button>
        </div>

        {/* TAB 1: SHORT LINK */}
        {activeTab === "link" && (
          <div className="space-y-3">
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
                  {expiryMinutes > 0 ? `Temporary Share Link (${expiryMinutes} Min Expiry)` : "Permanent Share Link"}
                </label>
                <button
                  onClick={handleRegenerate}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  title="Generate a brand new temporary token"
                >
                  <RefreshCcw className="w-3 h-3" /> Regenerate
                </button>
              </div>
              <input
                readOnly
                value={shareLink}
                onClick={handleCopyLink}
                className="w-full text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-zinc-800 dark:text-zinc-200 cursor-pointer truncate"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <FetchButton onClick={handleCopyLink} className="justify-center py-2.5 text-xs font-bold">
                {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                {copiedLink ? "Copied!" : "Copy Link"}
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

        {/* TAB 2: QR PASS CARD */}
        {activeTab === "qr" && (
          <div className="flex flex-col items-center justify-center p-4 border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 rounded-2xl space-y-3">
            <div ref={qrRef} className="bg-white p-4 rounded-2xl shadow-md border border-zinc-100 dark:border-zinc-800 relative">
              <QRCodeSVG value={shareLink} size={160} level="M" />
            </div>

            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 text-center font-medium max-w-[240px]">
              Scan with mobile camera or AmazeCC reader to import schedule
            </p>

            <div className="w-full flex gap-2">
              <button
                type="button"
                onClick={handleDownloadQR}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 font-bold text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download Pass Image
              </button>
              <button
                type="button"
                onClick={handleRegenerate}
                className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-300 rounded-xl cursor-pointer"
                title="Regenerate QR"
              >
                <RefreshCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: RAW TOKEN CODE */}
        {activeTab === "code" && (
          <div className="space-y-3">
            <div className="bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/70 dark:border-zinc-800 rounded-2xl p-3.5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">
                  Raw Token Code ({code.length} chars)
                </label>
                <button
                  onClick={handleRegenerate}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCcw className="w-3 h-3" /> New Token
                </button>
              </div>
              <div className="max-h-[85px] overflow-y-auto text-xs font-mono text-zinc-800 dark:text-zinc-200 break-all select-all pr-1 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800">
                {code}
              </div>
            </div>

            <FetchButton onClick={handleCopyCode} className="w-full justify-center py-2.5 text-xs font-bold">
              {copiedCode ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copiedCode ? "Code Copied!" : "Copy Token Code"}
            </FetchButton>
          </div>
        )}

      </div>
    </Modal>
  );
}
