"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Maximize2, Plus, RotateCcw, RotateCw, ScanLine, Sparkles } from "lucide-react";
import { detectQuad, fitWithin, fullFrameQuad, rotateQuad90, rotateRaster90, scaleQuad } from "@/lib/scanner/imageOps";
import { rasterToDataUrl } from "@/lib/scanner/rasterIO";
import type { CleanupMode, Quad, Raster } from "@/lib/scanner/types";

/**
 * Full-screen document corner editor and filter studio.
 *
 * Provides:
 * - Proper responsive DOM scaling (image wrapper matches raster aspect-ratio 1:1)
 * - Immersive edge-to-edge full-screen interface (no page scrolling needed)
 * - Magnifying loupe while dragging corners for millimeter precision
 * - 90-degree page rotation
 * - Auto-detect & Full-frame edge reset
 * - Live cleanup mode switcher (Enhanced, B&W, Grayscale, Original)
 * - Multi-page queueing and guaranteed button layout
 */

const CORNERS = ["tl", "tr", "br", "bl"] as const;
type Corner = (typeof CORNERS)[number];

const CORNER_LABEL: Record<Corner, string> = {
  tl: "top-left",
  tr: "top-right",
  br: "bottom-right",
  bl: "bottom-left",
};

const CLEANUP_OPTIONS: readonly { value: CleanupMode; label: string; desc: string }[] = [
  { value: "enhanced", label: "Enhanced", desc: "Crisp ink, white paper" },
  { value: "bw", label: "B&W", desc: "Pure black & white" },
  { value: "grayscale", label: "Gray", desc: "Desaturated luma" },
  { value: "original", label: "Color", desc: "Original photo" },
];

const clamp = (v: number, max: number) => Math.min(max, Math.max(0, v));

/** Best-effort page quad: detect on a probe, scale back, never throw. */
function autoQuad(raster: Raster): Quad {
  try {
    const probe = raster.width > 1280 || raster.height > 1280 ? fitWithin(raster, 1280) : raster;
    const found = detectQuad(probe);
    if (found) return scaleQuad(found, raster.width / probe.width, raster.height / probe.height);
  } catch {
    /* detection is a hint, not a gate */
  }
  return fullFrameQuad(raster.width, raster.height);
}

interface ScannerEditorProps {
  raster: Raster;
  /** Pages already confirmed and waiting, not counting this one. */
  confirmedPages: number;
  cleanup: CleanupMode;
  onCleanupChange: (mode: CleanupMode) => void;
  onRetake: () => void;
  /** Shelve this page and open camera/add page for the next one. */
  onAddPage: (quad: Quad, rotatedRaster?: Raster) => void;
  /** Process every page (confirmed + this one). */
  onConfirm: (quad: Quad, rotatedRaster?: Raster) => void;
  busy?: boolean;
}

export default function ScannerEditor({
  raster: initialRaster,
  confirmedPages,
  cleanup,
  onCleanupChange,
  onRetake,
  onAddPage,
  onConfirm,
  busy = false,
}: ScannerEditorProps) {
  const pageCount = confirmedPages + 1;
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragCorner = useRef<Corner | null>(null);

  const [mounted, setMounted] = useState(false);
  const [stageBounds, setStageBounds] = useState<{ width: number; height: number } | null>(null);
  const [raster, setRaster] = useState<Raster>(initialRaster);
  const [quad, setQuad] = useState<Quad>(() => fullFrameQuad(initialRaster.width, initialRaster.height));
  const [detecting, setDetecting] = useState(true);
  const [activeCorner, setActiveCorner] = useState<Corner | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Measure stage size to guarantee subpixel aspect-ratio accuracy
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageBounds({ width: rect.width, height: rect.height });
      }
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  // Sync if raster prop changes
  useEffect(() => {
    setRaster(initialRaster);
    setQuad(fullFrameQuad(initialRaster.width, initialRaster.height));
    setDetecting(true);
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      setQuad(autoQuad(initialRaster));
      setDetecting(false);
    }, 10);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [initialRaster]);

  const dataUrl = useMemo(() => rasterToDataUrl(raster), [raster]);

  const redetect = useCallback(() => {
    setDetecting(true);
    window.setTimeout(() => {
      setQuad(autoQuad(raster));
      setDetecting(false);
    }, 10);
  }, [raster]);

  const resetFullFrame = useCallback(() => {
    setQuad(fullFrameQuad(raster.width, raster.height));
  }, [raster.width, raster.height]);

  const handleRotate = useCallback(() => {
    const rotated = rotateRaster90(raster);
    const rotatedQ = rotateQuad90(quad, raster.width, raster.height);
    setRaster(rotated);
    setQuad(rotatedQ);
  }, [raster, quad]);

  /* Pointer drag: client space → raster space via the wrapper's rect */
  const pointFromEvent = useCallback(
    (clientX: number, clientY: number) => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) return null;
      return {
        x: clamp(((clientX - rect.left) / rect.width) * raster.width, raster.width),
        y: clamp(((clientY - rect.top) / rect.height) * raster.height, raster.height),
      };
    },
    [raster.width, raster.height],
  );

  const startDrag = (corner: Corner) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragCorner.current = corner;
    setActiveCorner(corner);
  };

  const onDragMove = (e: React.PointerEvent) => {
    const corner = dragCorner.current;
    if (!corner) return;
    const point = pointFromEvent(e.clientX, e.clientY);
    if (!point) return;
    setQuad((q) => ({ ...q, [corner]: point }));
  };

  const endDrag = (e: React.PointerEvent) => {
    dragCorner.current = null;
    setActiveCorner(null);
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  const onHandleKeyDown = (corner: Corner) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 1;
    const delta: Record<string, { dx: number; dy: number }> = {
      ArrowLeft: { dx: -step, dy: 0 },
      ArrowRight: { dx: step, dy: 0 },
      ArrowUp: { dx: 0, dy: -step },
      ArrowDown: { dx: 0, dy: step },
    };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    setQuad((q) => ({
      ...q,
      [corner]: {
        x: clamp(q[corner].x + d.dx, raster.width),
        y: clamp(q[corner].y + d.dy, raster.height),
      },
    }));
  };

  const polygonPoints = CORNERS.map((c) => `${quad[c].x},${quad[c].y}`).join(" ");

  // Loupe position coordinates
  const loupeCorner = activeCorner ? quad[activeCorner] : null;
  const loupePctX = loupeCorner ? (loupeCorner.x / raster.width) * 100 : 50;
  const loupePctY = loupeCorner ? (loupeCorner.y / raster.height) * 100 : 50;
  const flipLoupeBelow = loupePctY < 24;

  const imageAspect = raster.width / (raster.height || 1);
  const availW = stageBounds ? Math.max(20, stageBounds.width - 24) : 0;
  const availH = stageBounds ? Math.max(20, stageBounds.height - 24) : 0;

  const boxStyle: React.CSSProperties = {
    maxWidth: "100%",
    maxHeight: "100%",
    aspectRatio: `${raster.width} / ${raster.height}`,
  };

  if (availW > 0 && availH > 0) {
    if (availW / availH > imageAspect) {
      // Stage is wider than image: bounded by height
      boxStyle.height = `${availH}px`;
      boxStyle.width = `${Math.round(availH * imageAspect)}px`;
    } else {
      // Stage is taller than image: bounded by width
      boxStyle.width = `${availW}px`;
      boxStyle.height = `${Math.round(availW / imageAspect)}px`;
    }
  } else {
    boxStyle.width = raster.width >= raster.height ? "100%" : "auto";
    boxStyle.height = raster.height > raster.width ? "100%" : "auto";
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-white select-none overflow-hidden touch-none h-[100dvh] w-screen">
      {/* ── Top Bar ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 bg-zinc-900/95 backdrop-blur-md border-b border-white/10 z-20">
        <button
          type="button"
          onClick={onRetake}
          title="Discard this capture and reopen the camera"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Retake</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-white/90">
            {pageCount > 1 ? `Crop · Page ${pageCount}` : "Crop & Align"}
          </span>
          {detecting && (
            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 rounded-full">
              <Sparkles className="h-3 w-3 animate-spin" />
              Auto
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRotate}
            title="Rotate 90 degrees clockwise"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span className="text-[11px]">90°</span>
          </button>
          <button
            type="button"
            onClick={redetect}
            title="Auto-detect page edges"
            className="flex items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer"
          >
            <Sparkles className="h-4 w-4 text-indigo-400" />
          </button>
          <button
            type="button"
            onClick={resetFullFrame}
            title="Reset to full frame"
            className="flex items-center justify-center p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white transition-all cursor-pointer"
          >
            <Maximize2 className="h-4 w-4 text-zinc-300" />
          </button>
        </div>
      </div>

      {/* ── Center Stage (Interactive Crop Canvas with Exact Aspect-Ratio Mapping) ── */}
      <div
        ref={stageRef}
        className="relative flex-1 min-h-0 w-full flex items-center justify-center p-3 sm:p-6 overflow-hidden bg-zinc-950"
      >
        <div
          ref={wrapRef}
          className="relative touch-none select-none overflow-hidden rounded-xl shadow-2xl border border-white/10 bg-black flex items-center justify-center"
          style={boxStyle}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt="Captured document page"
            draggable={false}
            className="block w-full h-full object-fill pointer-events-none"
          />

          {/* SVG Overlay: Crop polygon + Darkened exterior mask */}
          <svg
            viewBox={`0 0 ${raster.width} ${raster.height}`}
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden
          >
            <defs>
              <mask id="editor-crop-mask">
                <rect x="0" y="0" width={raster.width} height={raster.height} fill="white" />
                <polygon points={polygonPoints} fill="black" />
              </mask>
            </defs>
            {/* Dimmed region outside the polygon */}
            <rect
              x="0"
              y="0"
              width={raster.width}
              height={raster.height}
              fill="rgba(0, 0, 0, 0.52)"
              mask="url(#editor-crop-mask)"
            />
            {/* Polygon boundary */}
            <polygon
              points={polygonPoints}
              className="fill-indigo-500/10 stroke-indigo-400"
              strokeWidth={2.5}
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* 4 Interactive Corner Handles */}
          {CORNERS.map((corner) => {
            const isDragging = activeCorner === corner;
            return (
              <button
                key={corner}
                type="button"
                aria-label={`Move the ${CORNER_LABEL[corner]} corner`}
                onPointerDown={startDrag(corner)}
                onPointerMove={onDragMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onKeyDown={onHandleKeyDown(corner)}
                className="absolute z-20 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none items-center justify-center active:cursor-grabbing focus-visible:outline-none"
                style={{
                  left: `${(quad[corner].x / raster.width) * 100}%`,
                  top: `${(quad[corner].y / raster.height) * 100}%`,
                }}
              >
                {/* Visual handle */}
                <span
                  className={`rounded-full border-2 border-white shadow-2xl transition-all ${
                    isDragging
                      ? "h-6 w-6 bg-indigo-500 ring-4 ring-indigo-400/50 scale-125"
                      : "h-4.5 w-4.5 bg-indigo-600 hover:scale-115 ring-2 ring-black/40"
                  }`}
                />
              </button>
            );
          })}

          {/* Precision Magnifying Loupe while dragging */}
          {activeCorner && wrapRef.current && (
            <div
              className={`pointer-events-none absolute z-30 flex h-26 w-26 -translate-x-1/2 items-center justify-center overflow-hidden rounded-full border-2 border-white shadow-[0_12px_36px_rgba(0,0,0,0.85)] ring-4 ring-indigo-500/40 bg-zinc-950 ${
                flipLoupeBelow ? "translate-y-6" : "-translate-y-28"
              }`}
              style={{
                left: `${loupePctX}%`,
                top: `${loupePctY}%`,
              }}
            >
              {/* Scaled viewport inside loupe */}
              <div
                className="absolute"
                style={{
                  width: `${wrapRef.current.clientWidth * 2.6}px`,
                  height: `${wrapRef.current.clientHeight * 2.6}px`,
                  left: `calc(52px - ${(loupePctX / 100) * wrapRef.current.clientWidth * 2.6}px)`,
                  top: `calc(52px - ${(loupePctY / 100) * wrapRef.current.clientHeight * 2.6}px)`,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={dataUrl} alt="" className="block w-full h-full object-contain pointer-events-none" />
              </div>

              {/* Crosshair target in loupe center */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="h-full w-px bg-indigo-400/70" />
                <span className="absolute w-full h-px bg-indigo-400/70" />
                <span className="h-2 w-2 rounded-full border border-white bg-indigo-500 shadow-md" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Controls ── */}
      <div className="shrink-0 bg-zinc-900/95 backdrop-blur-md border-t border-white/10 px-4 pt-3 pb-6 sm:pb-4 space-y-3 z-20">
        {/* Row 1: Cleanup Enhancement Modes */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2">
          {CLEANUP_OPTIONS.map((opt) => {
            const isSelected = cleanup === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onCleanupChange(opt.value)}
                title={opt.desc}
                className={`flex-1 py-2 px-2.5 rounded-xl text-center text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 border ${
                  isSelected
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-400/30"
                    : "bg-white/5 text-zinc-300 border-white/10 hover:bg-white/10 hover:text-white"
                }`}
              >
                {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Add Page & Scan Primary Action Bar */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={() => onAddPage(quad, raster)}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold transition-all cursor-pointer border border-white/10 disabled:opacity-50"
          >
            <Plus className="h-4 w-4 text-emerald-400" />
            <span>Add page</span>
          </button>

          {pageCount > 1 && (
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-400 px-2">
              {pageCount} {pageCount === 1 ? "page" : "pages"} ready
            </span>
          )}

          <button
            type="button"
            onClick={() => onConfirm(quad, raster)}
            disabled={busy}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black shadow-lg transition-all cursor-pointer disabled:opacity-50 min-w-[130px]"
          >
            <ScanLine className="h-4 w-4" />
            <span>{busy ? "Processing…" : `Scan ${pageCount} ${pageCount === 1 ? "page" : "pages"}`}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
