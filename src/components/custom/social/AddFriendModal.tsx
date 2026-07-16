"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { UserPlus, Camera, QrCode, CameraOff, ClipboardPaste, Focus } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import Modal from "../shared/Modal";
import FetchButton from "../shared/FetchButton";
import { Textarea, Input } from "../shared/Input";
import { importScheduleCode, saveFriend } from "@/lib/socialUtils";

export default function AddFriendModal({ onClose, onFriendAdded }) {
  const [activeTab, setActiveTab] = useState<"scan" | "text">("scan");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const SCANNER_ID = "qr-scanner-container";

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
        scannerRef.current = null;
      }
    } catch {}
    setScanning(false);
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    (async () => {
      try {
        const scanner = new Html5Qrcode(SCANNER_ID);
        if (cancelled) return;
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => {
            if (!cancelled) {
              setCode(decodedText);
              // Switch to text tab so they can review/add
              setActiveTab("text");
              stopScanner();
            }
          },
          () => {}
        );
      } catch {
        if (!cancelled) {
          setError("Camera access denied or not available.");
          setScanning(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [scanning, stopScanner]);

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  // If tab changes and we are scanning, stop the scanner
  useEffect(() => {
    if (activeTab !== "scan") {
      stopScanner();
    }
  }, [activeTab, stopScanner]);

  const handleAdd = (e) => {
    e.preventDefault();
    setError("");
    try {
      const friend = importScheduleCode(code, nickname || undefined);
      saveFriend(friend);
      onFriendAdded?.(friend);
      onClose();
      setCode("");
      setNickname("");
    } catch (err) {
      setError((err as Error).message || "Invalid code format.");
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="w-5 h-5 text-indigo-500" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
          Add a Friend
        </h2>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-4 leading-normal">
        Import a classmate&apos;s schedule via QR scan or by entering their schedule profile code.
      </p>

      {/* Tab Selector */}
      <div className="flex w-full gap-1 rounded-xl bg-zinc-100 dark:bg-zinc-950 p-1 mb-4">
        <button
          type="button"
          onClick={() => setActiveTab("scan")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer border border-transparent ${
            activeTab === "scan"
              ? "bg-white text-info border-zinc-200/50 shadow-2xs dark:bg-zinc-900 dark:border-zinc-800/50"
              : "text-zinc-400 hover:text-zinc-900 dark:text-zinc-500 dark:hover:text-white"
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          Scan QR Code
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
          <ClipboardPaste className="w-3.5 h-3.5" />
          Enter Text Code
        </button>
      </div>

      <form onSubmit={handleAdd} className="space-y-4">
        {activeTab === "scan" ? (
          <div className="flex flex-col gap-3">
            {!scanning ? (
              <div className="flex flex-col items-center justify-center p-8 border border-zinc-200/50 dark:border-zinc-800/80 bg-gradient-to-br from-white to-zinc-50/20 dark:from-zinc-900/60 dark:to-zinc-950/40 rounded-2xl shadow-2xs text-center">
                <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 rounded-full text-indigo-500 mb-3 animate-pulse">
                  <QrCode className="w-8 h-8 stroke-[1.8]" />
                </div>
                <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Ready to scan
                </h3>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 max-w-[200px] mb-4">
                  Open your camera to scan a friend&apos;s schedule QR code directly.
                </p>
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  Start Camera Scanner
                </button>
              </div>
            ) : (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-black relative shadow-lg">
                {/* Camera Screen */}
                <div id={SCANNER_ID} className="w-full min-h-[220px]" />

                {/* Cyberpunk Scan Target Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[180px] h-[180px] border-2 border-emerald-500/80 rounded-xl relative shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                    {/* Glowing corners */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br" />
                    {/* Laser Line */}
                    <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 shadow-[0_0_10px_#10b981] scanner-laser" />
                  </div>
                </div>

                <div className="p-3 bg-zinc-50/90 dark:bg-zinc-950/90 border-t border-zinc-150 dark:border-zinc-900 flex items-center justify-between z-10 relative">
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5 font-medium">
                    <Focus size={12} className="text-emerald-500 animate-spin" />
                    Align QR inside green square
                  </span>
                  <button
                    type="button"
                    onClick={stopScanner}
                    className="text-[10px] font-black text-red-500 hover:text-red-600 flex items-center gap-1"
                  >
                    <CameraOff size={12} />
                    Stop Camera
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Textarea
              label="Schedule Profile Code *"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste schedule code here (e.g. v5|...)"
              rows={4}
            />
          </div>
        )}

        <Input
          label="Nickname (Optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Leave blank to use their real name"
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg leading-normal">
            {error}
          </div>
        )}

        <FetchButton type="submit" variant="gradient" className="w-full justify-center py-2.5">
          Add Friend
        </FetchButton>
      </form>
    </Modal>
  );
}
