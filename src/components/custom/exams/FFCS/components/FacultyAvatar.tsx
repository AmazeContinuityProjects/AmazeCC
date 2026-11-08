"use client";

import React, { useState } from "react";
import { ENABLE_VITFAC_INTEGRATION, useVitfacReview, useChennaiImage } from "@/lib/vitfacService";
import { getFacultyCdnUrl, toCdnImageUrl } from "@/lib/workerBase";

/*
 * The lightweight vitfac display bits — avatar, review pill, initials —
 * extracted from `FacultyReviewSheet` so routes can render them inline
 * without pulling the whole review sheet into their initial JS bundle.
 * `FacultyReviewSheet` re-exports these for existing importers.
 */

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
    ? "bg-ok-soft text-ok border-ok/30 hover:bg-ok-soft"
    : isAmber
      ? "bg-warn-soft text-warn border-warn/30 hover:bg-warn-soft"
      : "bg-danger-soft text-danger border-danger/30 hover:bg-danger-soft";

  return (
    <button
      type="button"
      onClick={onClick}
      title={`vitfac rating: ${review.wPct}% W (${review.reviews} reviews). Click to view breakdown.`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[11px] font-semibold transition-all cursor-pointer shrink-0 relative hit-expand touch-press ${colorClass} ${className}`.trim()}
    >
      <span>{review.wPct}% W</span>
      <span className="text-[11px] opacity-70">({review.reviews})</span>
    </button>
  );
}

export interface FacultyAvatarProps {
  employeeId?: string | null;
  name?: string | null;
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
  fallbackImageUrl,
  size = "md",
  tone = "blue",
  className = "",
  alt,
}: FacultyAvatarProps) {
  const { review } = useVitfacReview(employeeId, name);
  const [failedUrls, setFailedUrls] = useState<string[]>([]);

  // Resolve employee ID from prop OR from review match (e.g. when only faculty name was passed)
  const resolvedEmpId = employeeId || review?.employeeId || null;

  // 1. Primary candidate: Unified CDN chokepoint by faculty ID
  const cdnUrl = ENABLE_VITFAC_INTEGRATION && resolvedEmpId ? getFacultyCdnUrl(resolvedEmpId) : null;
  // 2. Direct review base64 image (if already loaded in review)
  const directUrl = ENABLE_VITFAC_INTEGRATION && review?.image ? `data:image/jpeg;base64,${review.image}` : null;
  // 3. Fallback sources: review image_url, chennai media, or fallbackImageUrl
  const chennaiUrl = useChennaiImage(resolvedEmpId);
  const externalFallback =
    (ENABLE_VITFAC_INTEGRATION && review?.image_url ? toCdnImageUrl(review.image_url) : null) ||
    chennaiUrl ||
    (fallbackImageUrl ? toCdnImageUrl(fallbackImageUrl) : null) ||
    null;

  // Prefer CDN chokepoint first unless it failed, then direct base64, then external fallbacks
  const primaryUrl = cdnUrl && !failedUrls.includes(cdnUrl) ? cdnUrl : null;
  const secondaryUrl = directUrl && !failedUrls.includes(directUrl) ? directUrl : null;
  const tertiaryUrl = externalFallback && !failedUrls.includes(externalFallback) ? externalFallback : null;

  const sourceUrl = primaryUrl || secondaryUrl || tertiaryUrl;
  const effectiveUrl = sourceUrl && !failedUrls.includes(sourceUrl) ? sourceUrl : null;

  const sizeClasses = {
    xs: "w-6 h-6 rounded-md text-[11px]",
    sm: "w-9 h-9 rounded-md text-xs",
    md: "w-11 h-11 rounded-md text-sm",
    lg: "w-14 h-14 rounded-md text-base",
    xl: "w-16 h-16 rounded-md text-lg",
  }[size];

  const toneClasses = {
    blue: "bg-accent-soft border-accent/20 text-accent",
    amber: "bg-warn-soft border-warn/20 text-warn",
    indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
    zinc: "bg-surface-2 border-line text-muted",
  }[tone];

  const initials = getFacultyInitials(name, review?.avatar);

  return (
    <div
      className={`relative shrink-0 overflow-hidden flex items-center justify-center font-semibold select-none border border-border-strong/60 ${sizeClasses} ${className}`}
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
        <span className={`w-full h-full flex items-center justify-center font-semibold ${toneClasses}`}>{initials}</span>
      )}
    </div>
  );
}
