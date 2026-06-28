"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { UserPlus, Camera, QrCode, CameraOff } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import Modal from "../shared/Modal";
import FetchButton from "../shared/FetchButton";
import { Textarea, Input } from "../shared/Input";
import { importScheduleCode, saveFriend } from "@/lib/socialUtils";

export default function AddFriendModal({ onClose, onFriendAdded }) {
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
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (!cancelled) {
              setCode(decodedText);
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
    <Modal onClose={onClose}>
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-bold text-gray-900  dark:text-gray-100">
          Add a Friend
        </h2>
      </div>

      <form onSubmit={handleAdd} className="space-y-4">
        <p className="text-sm text-gray-500  dark:text-gray-400">
          Paste your friend&apos;s schedule code below, or scan their QR code.
        </p>

        <div>
          <div className="relative">
            <Textarea
              label="Friend's Schedule Code *"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste code here..."
              rows={3}
            />
            {!scanning && (
              <button
                type="button"
                onClick={() => setScanning(true)}
                className="absolute right-2 bottom-2 p-2 rounded-lg bg-gray-100  dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-slate-600 dark:hover:bg-gray-700 transition-colors"
                title="Scan QR code"
              >
                <Camera size={18} className="text-gray-500  dark:text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {scanning && (
          <div className="border border-gray-200  dark:border-gray-800 rounded-xl overflow-hidden bg-black">
            <div id={SCANNER_ID} className="w-full min-h-[200px]" />
            <div className="p-3 bg-gray-50  dark:bg-gray-900/50 flex items-center justify-between">
              <span className="text-xs text-gray-500  dark:text-gray-400 flex items-center gap-1.5">
                <QrCode size={14} />
                Point camera at a QR code
              </span>
              <button
                type="button"
                onClick={stopScanner}
                className="text-xs font-medium text-red-500 hover:text-red-600 flex items-center gap-1"
              >
                <CameraOff size={14} />
                Cancel
              </button>
            </div>
          </div>
        )}

        <Input
          label="Nickname (Optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Leave blank to use their real name"
        />

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-lg">
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
