"use client";

import React, { useEffect, useState } from "react";
import {
  ExternalLink,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  BookOpen,
  GraduationCap,
  Award,
  AlertTriangle,
  Smile,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import BottomSheet from "../../../shared/BottomSheet";
import {
  ENABLE_VITFAC_INTEGRATION,
  useVitfacReview,
  getFacultyProfileBundle,
  getVitfacProfileUrl,
  type VitfacFaculty,
  type VitfacProfileBundle,
} from "@/lib/vitfacService";

export interface FacultyReviewSheetProps {
  open: boolean;
  onClose: () => void;
  facultyName: string;
  employeeId?: string;
  courseCode?: string;
}

export function VitfacReviewPill({
  employeeId,
  name,
  onClick,
  className = "",
}: {
  employeeId?: string | null;
  name?: string | null;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  if (!ENABLE_VITFAC_INTEGRATION) return null;
  const { review } = useVitfacReview(employeeId, name);
  if (!review || review.reviews === 0) return null;

  const isGreen = review.wPct >= 70;
  const isAmber = review.wPct >= 40 && review.wPct < 70;

  const colorClass = isGreen
    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
    : isAmber
    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
    : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20";

  return (
    <button
      type="button"
      onClick={onClick}
      title={`vitfac rating: ${review.wPct}% W (${review.reviews} reviews). Click to view breakdown.`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-bold transition-colors cursor-pointer shrink-0 ${colorClass} ${className}`.trim()}
    >
      <span>{review.wPct}% W</span>
      <span className="text-[10px] opacity-70">({review.reviews})</span>
    </button>
  );
}

export interface FacultyAvatarProps {
  employeeId?: string | null;
  name?: string | null;
  fallbackImageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  tone?: "blue" | "amber" | "indigo";
  className?: string;
  alt?: string;
}

export function getFacultyInitials(name?: string | null, avatar?: string | null): string {
  if (avatar && avatar.trim()) return avatar.trim();
  if (!name || !name.trim()) return "?";
  const clean = name.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase() || "?";
}

export function FacultyAvatar({
  employeeId,
  name,
  fallbackImageUrl,
  size = "md",
  tone = "blue",
  className = "",
  alt,
}: FacultyAvatarProps) {
  const { review } = useVitfacReview(employeeId, name);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);

  const vitfacUrl = ENABLE_VITFAC_INTEGRATION ? review?.image_url : null;
  const effectiveUrl =
    vitfacUrl && !failedUrls.includes(vitfacUrl)
      ? vitfacUrl
      : fallbackImageUrl && !failedUrls.includes(fallbackImageUrl)
      ? fallbackImageUrl
      : null;

  const sizeClasses = {
    xs: "w-6 h-6 rounded-md text-[10px]",
    sm: "w-9 h-9 rounded-xl text-xs",
    md: "w-11 h-11 rounded-2xl text-sm",
    lg: "w-14 h-14 rounded-2xl text-base",
    xl: "w-16 h-16 rounded-2xl text-lg",
  }[size];

  const toneClasses = {
    blue: "bg-blue-500/10 border-blue-500/20 text-blue-500",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-500",
    indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
  }[tone];

  const initials = getFacultyInitials(name, review?.avatar);

  return (
    <div
      className={`relative shrink-0 overflow-hidden flex items-center justify-center font-bold select-none border border-border-strong/60 ${sizeClasses} ${className}`}
    >
      {effectiveUrl ? (
        <img
          src={effectiveUrl}
          alt={alt || name || "Faculty"}
          loading="lazy"
          decoding="async"
          onError={() => {
            if (effectiveUrl) {
              setFailedUrls((prev) => [...prev, effectiveUrl]);
            }
          }}
          className="w-full h-full object-cover rounded-[inherit]"
        />
      ) : (
        <span className={`w-full h-full flex items-center justify-center font-bold ${toneClasses}`}>
          {initials}
        </span>
      )}
    </div>
  );
}

export default function FacultyReviewSheet({
  open,
  onClose,
  facultyName,
  employeeId,
  courseCode,
}: FacultyReviewSheetProps) {
  const { review, loading } = useVitfacReview(employeeId, facultyName);
  const [bundle, setBundle] = useState<VitfacProfileBundle | null>(null);
  const [loadingBundle, setLoadingBundle] = useState(false);

  useEffect(() => {
    if (!open) {
      setBundle(null);
      return;
    }

    const targetId = review?.id || employeeId;
    if (targetId) {
      setLoadingBundle(true);
      getFacultyProfileBundle(targetId)
        .then((b) => {
          if (b) setBundle(b);
        })
        .finally(() => setLoadingBundle(false));
    }
  }, [open, review?.id, employeeId]);

  if (!ENABLE_VITFAC_INTEGRATION || !open) return null;

  const prof = bundle?.prof || review;
  const profileUrl = prof?.id || employeeId ? getVitfacProfileUrl(prof?.id || employeeId!) : "https://vitfac.pages.dev";

  const wPct = prof ? prof.wPct : 0;
  const reviewsCount = prof ? prof.reviews : 0;
  const wCount = prof ? prof.wCount : 0;
  const lCount = prof ? prof.lCount : 0;

  const lecture = prof?.metrics?.lecture ?? 0;
  const da = prof?.metrics?.da ?? 0;
  const vibe = prof?.metrics?.vibe ?? 0;

  const greenLore = prof?.lore?.green || [];
  const redLore = prof?.lore?.red || [];

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="vitfac-review-sheet"
      maxWidth="max-w-lg"
      panelZIndex={320}
      backdropZIndex={315}
      contentClassName="space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-border-strong pb-4">
        <div className="flex items-center gap-3">
          <FacultyAvatar
            employeeId={prof?.employeeId || employeeId}
            name={prof?.name || facultyName}
            fallbackImageUrl={prof?.image_url}
            size="lg"
            tone="amber"
          />
          <div className="min-w-0">
            <h3 className="font-bold text-lg text-text-heading leading-tight truncate">
              {prof?.name || facultyName}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {prof?.designation ? `${prof.designation} · ` : ""}
              {prof?.dept || (employeeId ? `ERP: ${employeeId}` : "Faculty")}
            </p>
          </div>
        </div>

        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-strong bg-surface hover:bg-surface-secondary text-text-heading text-xs font-semibold transition-colors shrink-0"
        >
          <span>vitfac</span>
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </a>
      </div>

      {loading && !prof ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          <span className="text-xs">Loading faculty reviews…</span>
        </div>
      ) : !prof || reviewsCount === 0 ? (
        <div className="py-8 text-center bg-surface-secondary/20 rounded-2xl border border-dashed border-border-strong p-6">
          <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="text-sm font-semibold text-text-heading">No reviews yet on vitfac</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            This faculty has not received any reviews yet on vitfac.pages.dev.
          </p>
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-amber-500 font-bold hover:underline mt-4"
          >
            Be the first to review on vitfac <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      ) : (
        <>
          {/* Win / Loss Rating Hero */}
          <div className="bg-surface rounded-2xl border border-border-strong p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Community Rating
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {reviewsCount} {reviewsCount === 1 ? "student review" : "student reviews"}
              </span>
            </div>

            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <span
                  className={`text-3xl font-black font-outfit ${
                    wPct >= 70
                      ? "text-emerald-500"
                      : wPct >= 40
                      ? "text-amber-500"
                      : "text-red-500"
                  }`}
                >
                  {wPct}%
                </span>
                <span className="text-sm font-bold text-text-heading">Win Rate</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ThumbsUp className="w-3.5 h-3.5" /> {wCount} W
                </span>
                <span className="text-red-500 flex items-center gap-1">
                  <ThumbsDown className="w-3.5 h-3.5" /> {lCount} L
                </span>
              </div>
            </div>

            {/* Progress split bar */}
            <div className="w-full h-2.5 rounded-full bg-red-500/20 overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${wPct}%` }}
              />
            </div>
          </div>

          {/* 3 Metric Gauges */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="bg-surface rounded-xl border border-border-strong p-3 text-center">
              <BookOpen className="w-4 h-4 mx-auto mb-1 text-blue-500" />
              <div className="text-base font-black text-text-heading">
                {lecture ? lecture.toFixed(1) : "—"}
                <span className="text-[10px] font-normal text-muted-foreground">/5</span>
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">
                Lecture
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-border-strong p-3 text-center">
              <FileText className="w-4 h-4 mx-auto mb-1 text-purple-500" />
              <div className="text-base font-black text-text-heading">
                {da ? da.toFixed(1) : "—"}
                <span className="text-[10px] font-normal text-muted-foreground">/5</span>
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">
                DA Marks
              </div>
            </div>

            <div className="bg-surface rounded-xl border border-border-strong p-3 text-center">
              <Smile className="w-4 h-4 mx-auto mb-1 text-amber-500" />
              <div className="text-base font-black text-text-heading">
                {vibe ? vibe.toFixed(1) : "—"}
                <span className="text-[10px] font-normal text-muted-foreground">/5</span>
              </div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">
                Vibe
              </div>
            </div>
          </div>

          {/* Green Flags */}
          {greenLore.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Green Flags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {greenLore.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium"
                  >
                    <span>{item.text}</span>
                    <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1 rounded text-[10px] font-bold">
                      +{item.count}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Red Flags */}
          {redLore.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-bold uppercase tracking-wider text-red-500 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Red Flags
              </div>
              <div className="flex flex-wrap gap-1.5">
                {redLore.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-300 text-xs font-medium"
                  >
                    <span>{item.text}</span>
                    <span className="bg-red-500/20 text-red-500 px-1 rounded text-[10px] font-bold">
                      +{item.count}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Courses Taught */}
          {prof.courses && prof.courses.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border-strong/40">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Known Courses
              </div>
              <div className="flex flex-wrap gap-1">
                {prof.courses.map((c) => (
                  <span
                    key={c}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${
                      courseCode && c.toUpperCase().includes(courseCode.toUpperCase())
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-500 font-bold"
                        : "bg-surface-secondary/40 border-border-strong text-muted-foreground"
                    }`}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer attribution & review CTA */}
      <div className="pt-3 border-t border-border-strong/30 flex flex-col items-center gap-2.5">
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all shadow-xs"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span>Leave a Review for this Faculty on vitfac.pages.dev</span>
        </a>
        <div className="text-[10px] text-muted-foreground/70 text-center leading-relaxed">
          <p>
            Disclaimer: Ratings and reviews are sourced from a third-party platform (
            <a
              href="https://vitfac.pages.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
            >
              vitfac.pages.dev
            </a>
            ). AmazeCC does not create, endorse, or verify these opinions; we provide this integration solely as a viewer for student convenience.
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
