"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  ChevronUp,
  ImageUp,
  RotateCw,
  Smartphone,
  VideoOff,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import Button from "@/components/custom/shared/Button";
import { captureFrame, decodeToRaster } from "@/lib/scanner/rasterIO";
import type { Raster } from "@/lib/scanner/types";

/**
 * Full-screen live camera viewfinder for capturing document pages.
 *
 * Provides:
 * - Proper responsive DOM scaling (stage fills available flex height without overflow)
 * - Whole-frame video display via object-contain (no aspect-ratio cropping or distortion)
 * - Live A4 framing guide centered and properly bounded
 * - Reliable gallery and system camera import with file array retention
 * - Hardware torch toggle and front/rear camera switcher
 */

interface ScannerCameraProps {
  /** The captured frame, ready for the corner editor. */
  onCapture: (raster: Raster) => void;
  /** The decoded raster of an imported image file. */
  onImport: (raster: Raster) => void;
  /** Multiple files imported at once */
  onImportMultiple?: (rasters: Raster[]) => void;
  onCancel: () => void;
  pageNumber?: number;
}

type CameraState = "starting" | "live" | "denied" | "unavailable";

export default function ScannerCamera({
  onCapture,
  onImport,
  onImportMultiple,
  onCancel,
  pageNumber,
}: ScannerCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const systemInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<CameraState>("starting");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [mounted, setMounted] = useState(false);
  /** Alternate capture paths live behind one disclosure under the shutter. */
  const [showMoreWays, setShowMoreWays] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /* Acquire and tear down the stream. */
  useEffect(() => {
    let cancelled = false;
    let localStream: MediaStream | null = null;
    const video = videoRef.current;

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      return;
    }

    setState("starting");

    (async () => {
      try {
        const isPortrait = typeof window !== "undefined" && window.innerHeight > window.innerWidth;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: isPortrait ? 1080 : 1920 },
            height: { ideal: isPortrait ? 1920 : 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = stream;
        streamRef.current = stream;

        // Check torch capability
        const track = stream.getVideoTracks()[0];
        const capabilities = (track as any)?.getCapabilities?.();
        if (capabilities && "torch" in capabilities) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }

        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {
            /* autoplay policy */
          });
        }
        setState("live");
      } catch (err) {
        if (cancelled) return;
        const name = (err as { name?: string }).name;
        setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "unavailable");
      }
    })();

    return () => {
      cancelled = true;
      localStream?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [facingMode]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torch;
      await (track as any).applyConstraints?.({
        advanced: [{ torch: next }],
      });
      setTorch(next);
    } catch (err) {
      console.warn("Torch constraint error", err);
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || state !== "live" || busy) return;
    setBusy(true);
    setError(null);
    try {
      onCapture(captureFrame(video));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read a frame from the camera.");
      setBusy(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // Retain selected files in an array BEFORE resetting input value
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (selectedFiles.length > 1 && onImportMultiple) {
        const rasters: Raster[] = [];
        for (const f of selectedFiles) {
          rasters.push(await decodeToRaster(f));
        }
        onImportMultiple(rasters);
      } else {
        onImport(await decodeToRaster(selectedFiles[0]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "That image could not be read.");
    } finally {
      try {
        e.target.value = "";
      } catch {}
      setBusy(false);
    }
  };

  const handleSystemCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      onImport(await decodeToRaster(selectedFiles[0]));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That photo could not be read.");
    } finally {
      try {
        e.target.value = "";
      } catch {}
      setBusy(false);
    }
  };

  const importButton = (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => fileRef.current?.click()}
      disabled={busy}
      icon={<ImageUp className="h-4 w-4" />}
    >
      Choose from photos
    </Button>
  );

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white select-none overflow-hidden touch-none h-[100dvh] w-screen">
      {/* ── Top Bar (Fixed height shrink-0) ── */}
      <div className="shrink-0 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] pb-3 bg-gradient-to-b from-black/90 via-black/60 to-transparent z-20">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close camera"
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-black/60 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-white border border-white/15">
            {pageNumber ? `Scan Page ${pageNumber}` : "Paper Scanner"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-label="Toggle flashlight"
              className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-full transition-colors active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                torch ? "bg-amber-500 text-black shadow-lg" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {torch ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
            </button>
          )}
          <button
            type="button"
            onClick={switchCamera}
            aria-label="Flip camera"
            title="Switch front / rear camera"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Viewfinder stage (Takes exact remaining flex space with min-h-0) ── */}
      <div
        className="relative flex-1 min-h-0 w-full flex items-center justify-center overflow-hidden bg-black"
        style={{ containerType: "size" }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          aria-label="Camera preview"
          className={`w-full h-full object-contain pointer-events-none transition-opacity duration-300 ${
            state === "live" ? "opacity-100" : "opacity-0"
          }`}
        />

        {state === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center z-10">
            <Camera className="h-8 w-8 animate-pulse text-zinc-400" aria-hidden />
            <p className="text-sm font-bold text-zinc-300 font-outfit">Opening camera…</p>
          </div>
        )}

        {state === "denied" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-zinc-950 z-10 max-w-sm mx-auto">
            <AlertTriangle className="h-8 w-8 text-amber-400" aria-hidden />
            <p className="text-base font-black text-white font-outfit">Camera Access Blocked</p>
            <p className="text-pretty text-xs text-zinc-400 leading-relaxed mb-2">
              Enable camera permissions in your browser settings, or use the device's system camera or photo gallery.
            </p>
            <div className="flex flex-col w-full gap-2 pt-2">
              <Button
                variant="primary"
                onClick={() => systemInputRef.current?.click()}
                icon={<Smartphone className="h-4 w-4" />}
              >
                Use device camera
              </Button>
              {importButton}
            </div>
          </div>
        )}

        {state === "unavailable" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-zinc-950 z-10 max-w-sm mx-auto">
            <VideoOff className="h-8 w-8 text-zinc-500" aria-hidden />
            <p className="text-base font-black text-white font-outfit">No Camera Available</p>
            <p className="text-pretty text-xs text-zinc-400 leading-relaxed mb-2">
              We couldn't detect a live camera stream on this device. You can still scan via system camera or photos.
            </p>
            <div className="flex flex-col w-full gap-2 pt-2">
              <Button
                variant="primary"
                onClick={() => systemInputRef.current?.click()}
                icon={<Smartphone className="h-4 w-4" />}
              >
                Use device camera
              </Button>
              {importButton}
            </div>
          </div>
        )}

        {/* Live A4 Framing Guide Overlay */}
        {state === "live" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 sm:p-6">
            <div className="relative aspect-[1/1.414] h-[min(78cqh,520px)] w-auto max-w-[min(88cqw,400px)] rounded-2xl border-2 border-indigo-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              {/* Corner L-brackets */}
              <span className="absolute -left-1 -top-1 h-7 w-7 rounded-tl-xl border-l-[3.5px] border-t-[3.5px] border-white shadow-sm" />
              <span className="absolute -right-1 -top-1 h-7 w-7 rounded-tr-xl border-r-[3.5px] border-t-[3.5px] border-white shadow-sm" />
              <span className="absolute -right-1 -bottom-1 h-7 w-7 rounded-br-xl border-r-[3.5px] border-b-[3.5px] border-white shadow-sm" />
              <span className="absolute -left-1 -bottom-1 h-7 w-7 rounded-bl-xl border-l-[3.5px] border-b-[3.5px] border-white shadow-sm" />

              <div className="absolute inset-x-0 bottom-3 text-center">
                <span className="rounded-full bg-black/75 px-3.5 py-1 text-xs font-bold text-white border border-white/20">
                  Align document within frame
                </span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-x-4 top-4 rounded-xl border border-red-500/30 bg-red-500/25 px-3.5 py-2.5 text-xs font-bold text-red-200 z-30">
            {error}
          </div>
        )}
      </div>

      {/* ── Bottom Controls (Fixed height shrink-0, always visible) ── */}
      <div className="shrink-0 z-20 bg-gradient-to-t from-black/95 via-black/75 to-transparent pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] sm:pb-8">
        {/* Single disclosure for the two alternate capture paths. */}
        {showMoreWays && (
          <div className="mx-4 mb-3 space-y-2 rounded-2xl border border-white/15 bg-black/80 p-3 backdrop-blur-md">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setShowMoreWays(false);
                systemInputRef.current?.click();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Smartphone className="h-5 w-5 text-indigo-400" />
              Use device camera
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setShowMoreWays(false);
                fileRef.current?.click();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-white transition-colors hover:bg-white/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ImageUp className="h-5 w-5 text-emerald-400" />
              Choose from photos
            </button>
          </div>
        )}

        <div className="flex items-center justify-between px-6">
          {/* Spacer keeps the single shutter visually centred. */}
          <div className="w-14" aria-hidden />

          {/* Capture Shutter Button — the one primary action. */}
          <button
            type="button"
            onClick={handleCapture}
            disabled={state !== "live" || busy}
            aria-label="Scan with camera"
            className="relative flex h-18 w-18 cursor-pointer items-center justify-center rounded-full border-4 border-white bg-transparent transition-transform duration-150 hover:scale-105 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:cursor-not-allowed disabled:opacity-40 shadow-2xl"
          >
            <span className="h-14 w-14 rounded-full bg-white transition-all group-active:scale-95" />
          </button>

          {/* More ways to add disclosure */}
          <button
            type="button"
            onClick={() => setShowMoreWays((v) => !v)}
            aria-expanded={showMoreWays}
            className="flex w-14 flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-1 text-white/80 transition-all hover:text-white active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {showMoreWays ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            <span className="text-center text-xs font-bold leading-tight">More ways</span>
          </button>
        </div>

        {/* Hidden inputs — all three paths remain reachable. */}
        <input
          ref={systemInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          disabled={busy}
          className="sr-only"
          onChange={handleSystemCapture}
          tabIndex={0}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          disabled={busy}
          className="sr-only"
          onChange={handleFile}
          tabIndex={0}
        />
      </div>
    </div>,
    document.body,
  );
}
