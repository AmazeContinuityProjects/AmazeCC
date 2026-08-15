"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { UserPlus, Camera, QrCode, CameraOff, Link as LinkIcon, Clipboard, Focus, Check } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import Modal from "../shared/Modal";
import FetchButton from "../shared/FetchButton";
import { Textarea, Input } from "../shared/Input";
import { importScheduleCode, saveFriend } from "@/lib/socialUtils";

export default function AddFriendModal({
  onClose,
  onFriendAdded,
}: {
  onClose: () => void;
  onFriendAdded: () => void;
}) {
  const [activeTab, setActiveTab] = useState<"text" | "scan">("text");
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const [pasted, setPasted] = useState(false);
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
              setActiveTab("text");
              stopScanner();
            }
          },
          () => {}
        );
      } catch {
        if (!cancelled) {
          setError("Camera access denied or not available on this device.");
          setScanning(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scanning, stopScanner]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const friend = importScheduleCode(code, nickname);
      saveFriend(friend);
      onFriendAdded();
      onClose();
    } catch (err) {
      setError((err as Error).message || "Invalid schedule profile link or code.");
    }
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCode(text.trim());
        setPasted(true);
        setTimeout(() => setPasted(false), 2000);
      }
    } catch {
      setError("Unable to read clipboard automatically. Please paste into the text area manually.");
    }
  };

  return (
    <Modal onClose={() => { stopScanner(); onClose(); }} maxWidth="max-w-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
          <UserPlus className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-foreground font-outfit">
            Add Friend Schedule
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Import schedule via shared link, raw code, or camera QR
          </p>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex w-full gap-1 rounded-2xl bg-zinc-100 dark:bg-zinc-950 p-1 mb-4 border border-zinc-200/50 dark:border-zinc-800/60">
        <button
          type="button"
          onClick={() => { stopScanner(); setActiveTab("text"); }}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer border border-transparent ${
            activeTab === "text"
              ? "bg-white text-indigo-600 border-zinc-200/50 shadow-2xs dark:bg-zinc-900 dark:text-indigo-400 dark:border-zinc-800/50"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          Paste Link / Code
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("scan")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer border border-transparent ${
            activeTab === "scan"
              ? "bg-white text-indigo-600 border-zinc-200/50 shadow-2xs dark:bg-zinc-900 dark:text-indigo-400 dark:border-zinc-800/50"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          Scan QR Card
        </button>
      </div>

      <form onSubmit={handleAdd} className="space-y-4">
        {activeTab === "text" ? (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Textarea
                label="Share Link or Code *"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste share link (e.g. https://amazecc.app/#share=...) or raw code (v5|...)"
                rows={3}
              />
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="absolute top-0 right-0 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer pt-0.5 pr-1"
              >
                {pasted ? <Check className="w-3 h-3 text-emerald-500" /> : <Clipboard className="w-3 h-3" />}
                {pasted ? "Pasted!" : "Paste Clipboard"}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {!scanning ? (
              <div className="flex flex-col items-center justify-center p-6 border border-zinc-200/80 dark:border-zinc-800 bg-gradient-to-br from-white to-zinc-50/20 dark:from-zinc-900/60 dark:to-zinc-950/40 rounded-2xl text-center">
                <div className="bg-indigo-50 dark:bg-indigo-950/40 p-3.5 rounded-2xl text-indigo-500 mb-2.5 shadow-2xs">
                  <QrCode className="w-6 h-6 stroke-[1.8]" />
                </div>
                <p className="text-xs text-muted-foreground max-w-[220px] mb-3.5 font-medium">
                  Scan a friend&apos;s schedule QR card using your camera
                </p>
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  Start Camera Scanner
                </button>
              </div>
            ) : (
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-black relative shadow-lg">
                <div id={SCANNER_ID} className="w-full min-h-[220px]" />
                <div className="p-3 bg-zinc-950 border-t border-zinc-900 flex items-center justify-between z-10 relative">
                  <span className="text-[11px] text-zinc-300 flex items-center gap-1.5 font-medium">
                    <Focus size={14} className="text-emerald-500 animate-spin" />
                    Center QR in frame
                  </span>
                  <button
                    type="button"
                    onClick={stopScanner}
                    className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
                  >
                    <CameraOff size={13} />
                    Stop Camera
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <Input
          label="Nickname (Optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="e.g. Aarav, Neha, Bestie"
        />

        {error && (
          <p className="text-xs text-red-500 font-bold leading-tight bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-900/40">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => { stopScanner(); onClose(); }}
            className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            Cancel
          </button>
          <FetchButton type="submit" className="flex-1 justify-center py-2.5 font-bold" variant="gradient">
            Add Friend
          </FetchButton>
        </div>
      </form>
    </Modal>
  );
}

