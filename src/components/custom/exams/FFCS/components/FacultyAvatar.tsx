"use client";

import React, { useState } from "react";

import { ENABLE_AMAZE_REVIEWS, useFacultyReview } from "@/lib/reviewsService";
import { ENABLE_VITFAC_INTEGRATION, useVitfacReview, useCachedImage, useChennaiImage } from "@/lib/vitfacService";

/*
 * Lightweight display bits — avatar, review pill, initials.
 * Supports both first-party AmazeCC Faculty Reviews and legacy vitfac data.
 */

export function VitfacReviewPill({
  employeeId,
  name,
  facultyId,
  onClick,
  className = "",
}: {
  employeeId?: string | null;
  name?: string | null;
  facultyId?: string | null;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
}) {
  const { review } = useFacultyReview(employeeId, name, facultyId);

  if (!ENABLE_AMAZE_REVIEWS && !ENABLE_VITFAC_INTEGRATION) return null;
  if (!review) return null;

  // First-party Amaze Review
  if (review.isFirstParty) {
    if (review.teachingGrade !== null) {
      const grade = review.teachingGrade;
      const isGreen = grade >= 4.0;
      const isAmber = grade >= 3.0 && grade < 4.0;

      const colorClass = isGreen
        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
        : isAmber
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
        : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 hover:bg-red-500/20";

      return (
        <button
          type="button"
          onClick={onClick}
          title={`Teaching Grade: ${grade.toFixed(1)} / 5 (${review.reviews} reviews). Click to view details.`}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-bold transition-all cursor-pointer shrink-0 relative hit-expand touch-press active:scale-[0.97] ${colorClass} ${className}`.trim()}
        >
          <span>{grade.toFixed(1)} / 5</span>
          <span className="text-[10px] opacity-70">({review.reviews})</span>
        </button>
      );
    }

    // Unreviewed / Insufficient reviews state (honest state, prompt rule 5)
    return (
      <button
        type="button"
        onClick={onClick}
        title="Not enough student reviews yet. Click to view or leave a review."
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-border-strong/60 bg-surface text-muted-foreground text-[10px] font-medium transition-all cursor-pointer shrink-0 hit-expand touch-press active:scale-[0.97] ${className}`.trim()}
      >
        <span>Unreviewed</span>
      </button>
    );
  }

  // Legacy vitfac review
  if (review.reviews === 0) return null;

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
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-bold transition-all cursor-pointer shrink-0 relative hit-expand touch-press active:scale-[0.97] ${colorClass} ${className}`.trim()}
    >
      <span>{review.wPct}% W</span>
      <span className="text-[10px] opacity-70">({review.reviews})</span>
    </button>
  );
}

export interface FacultyAvatarProps {
  employeeId?: string | null;
  name?: string | null;
  facultyId?: string | null;
  fallbackImageUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  tone?: "blue" | "amber" | "indigo" | "zinc";
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
  facultyId,
  fallbackImageUrl,
  size = "md",
  tone = "blue",
  className = "",
  alt,
}: FacultyAvatarProps) {
  const { review } = useFacultyReview(employeeId, name, facultyId);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);

  const directUrl = ENABLE_VITFAC_INTEGRATION && review?.image ? `data:image/jpeg;base64,${review.image}` : null;
  const chennaiUrl = useChennaiImage(employeeId);
  const externalUrl = directUrl
    ? null
    : (ENABLE_VITFAC_INTEGRATION ? review?.image_url : null) || chennaiUrl || fallbackImageUrl || null;
  const sourceUrl = directUrl || externalUrl;
  const cachedUrl = useCachedImage(sourceUrl);
  const effectiveUrl =
    cachedUrl && !failedUrls.includes(cachedUrl)
      ? cachedUrl
      : sourceUrl && !failedUrls.includes(sourceUrl)
        ? sourceUrl
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
    zinc: "bg-zinc-800/40 border-zinc-700/40 text-zinc-500",
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
        <span className={`w-full h-full flex items-center justify-center font-bold ${toneClasses}`}>{initials}</span>
      )}
    </div>
  );
}
