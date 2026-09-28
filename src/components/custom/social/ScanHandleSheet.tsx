"use client";

/**
 * Scan a peer's handle QR.
 *
 * `ShareHandleSheet` puts a `QRCodeSVG` of your own handle on screen with a
 * download button, and `html5-qrcode` has been a dependency since then — but
 * nothing ever imported it, so the scan half of the exchange simply did not
 * exist and pairing was type-the-other-handle only. This is that half.
 *
 * ## The library is imported dynamically, at scan time
 *
 * `html5-qrcode` touches `document` and `navigator.mediaDevices` while it is
 * being evaluated. A static import would put it in the server bundle for a
 * component that only ever needs the camera on a device, and would throw during
 * SSR. `await import()` inside the effect keeps it out of both.
 *
 * ## Anything that is not a handle is rejected, not shown
 *
 * The camera will happily decode any QR in the room — a wifi password, a
 * restaurant menu, a UPI link. Only text that `isValidHandle` accepts is
 * handed back; anything else is reported and the scan continues, so pointing at
 * the wrong code never fills the field with garbage.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2 } from "lucide-react";
import BottomSheet from "../shared/BottomSheet";
import { isValidHandle, normaliseHandle } from "@/lib/social/handle";

/** Must match the `id` on the element below — the library looks it up by id. */
const REGION_ID = "social-peer-qr-region";

type ScannerState = "starting" | "scanning" | "denied" | "unsupported" | "failed";

/** The slice of `Html5Qrcode` this component uses, so the type is not leaked. */
type ScannerHandle = {
  isScanning: boolean;
  stop: () => Promise<void>;
  clear: () => void;
};

export default function ScanHandleSheet({
  onClose,
  onScanned,
}: {
  onClose: () => void;
  onScanned: (handle: string) => void;
}) {
  const [state, setState] = useState<ScannerState>("starting");
  const [message, setMessage] = useState<string>("");

  const scannerRef = useRef<ScannerHandle | null>(null);
  // A decoded QR stays in frame for many frames, and the success callback fires
  // on every one of them. Without this the sheet would call `onScanned` (and
  // close) several times in a row.
  const settledRef = useRef(false);

  /** Release the camera. Safe to call more than once. */
  const teardown = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      if (scanner.isScanning) await scanner.stop();
    } catch {
      // Already stopped, or the stream died with the tab. Nothing to salvage.
    }
    try {
      scanner.clear();
    } catch {
      // clear() throws if the element is already gone; unmount order is not
      // something this component controls.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // `getUserMedia` needs a secure context. localhost counts; a phone on the
      // LAN pointed at a dev server over http does not, and the failure there
      // is opaque, so it is named up front instead of surfacing as "no camera".
      if (typeof window === "undefined") return;
      if (!window.isSecureContext) {
        if (!cancelled) {
          setState("unsupported");
          setMessage(
            "Scanning a QR needs a secure connection. Open the app over HTTPS and try again."
          );
        }
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setState("unsupported");
          setMessage("This browser cannot use the camera, so scanning is unavailable here.");
        }
        return;
      }

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode(REGION_ID, { verbose: false });
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decodedText) => {
            if (settledRef.current) return;
            // `normaliseHandle` never edits what it is given — that is how it
            // stays honest for typed input — so a decoder that hands back a
            // stray newline would be rejected here. The trim belongs at this
            // boundary, not in the normaliser.
            const candidate = normaliseHandle(String(decodedText).trim());
            if (!isValidHandle(candidate)) {
              // Wrong code, or a real QR that is not a handle. Say what was read
              // so the mismatch is obvious, and keep the camera up.
              setMessage(
                `That QR is not a handle (read "${String(decodedText).slice(0, 32)}"). Point the camera at a peer's Share screen.`
              );
              return;
            }
            settledRef.current = true;
            onScanned(candidate);
          },
          // Fires on every frame that fails to decode. There is nothing to do
          // with that, and surfacing it would flicker the UI nonstop.
          () => {}
        );

        if (cancelled) {
          void teardown();
          return;
        }
        setState("scanning");
      } catch (err: unknown) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          setState("denied");
          setMessage(
            "Camera access was blocked. Allow it in your browser's site settings, or type the handle instead."
          );
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setState("unsupported");
          setMessage("No usable camera was found on this device.");
        } else {
          setState("failed");
          setMessage(
            err instanceof Error && err.message
              ? `The camera would not start: ${err.message}`
              : "The camera would not start."
          );
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      void teardown();
    };
  }, [onScanned, teardown]);

  const busy = state === "starting";

  return (
    <BottomSheet onClose={onClose} overlayId="social-scan-peer" maxWidth="max-w-md">
      <div className="text-left space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-2xl flex items-center justify-center border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Camera className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit leading-tight">
              Scan their handle
            </h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
              Point the camera at the QR on their Social &rarr; Share screen
            </p>
          </div>
        </div>

        {/*
          Always mounted, even on the error paths. The library injects its video
          element into this node and `clear()` expects to find it, so swapping
          this out on failure would strand the camera stream.
        */}
        <div
          id={REGION_ID}
          className="w-full min-h-[240px] overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800 bg-zinc-950"
        />

        {busy && (
          <p className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Starting the camera&hellip;
          </p>
        )}

        {state === "scanning" && !message && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
            Looking for a handle&hellip;
          </p>
        )}

        {message && (
          <p
            className={`p-3 rounded-2xl border text-xs font-bold flex items-start gap-2 ${
              state === "scanning"
                ? "border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300"
                : "border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400"
            }`}
          >
            <CameraOff className="w-4 h-4 shrink-0 mt-px" />
            <span>{message}</span>
          </p>
        )}

        {state !== "scanning" && (
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
