"use client";

import { Award, ChevronRight, Flame, Sparkles } from "lucide-react";
import { FacultyAvatar } from "./FacultyAvatar";
import { useVitfacEnabled, useVitfacReview } from "@/lib/vitfacService";

/**
 * The faculty-stats cluster of FFCSGuidedSelector: per-course score badges, the
 * score list for one offering, a single review stat and the whole review strip
 * the guided flow shows next to a recommendation. Extracted verbatim; every
 * piece is internal to the selector and gates itself on `useVitfacEnabled`.
 */

/**
 * Faculty Score Badge displayed alongside faculty in recommendations.
 */
export function FacultyScoreBadge({
  employeeId,
  name,
  onOpenReview,
  className = "",
}: {
  employeeId?: string | null;
  name?: string | null;
  onOpenReview?: () => void;
  className?: string;
}) {
  const { review, loading } = useVitfacReview(employeeId, name);
  const vitfacEnabled = useVitfacEnabled();

  // Off, the chip goes too: it would say "Unrated" for everything *and*
  // open a review pane that no longer renders.
  if (!vitfacEnabled) return null;

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 animate-pulse">
        <span>★</span>
        <span>Score...</span>
      </span>
    );
  }

  if (!review || review.reviews === 0) {
    return (
      <button
        type="button"
        onClick={onOpenReview}
        title={`Faculty: ${name || "Unknown"}\nNo community reviews logged yet on Vitfac`}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-zinc-900/80 border border-zinc-800 text-[10.5px] font-bold text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-colors cursor-pointer shrink-0 ${className}`.trim()}
      >
        <span className="text-[10px] opacity-70">★</span>
        <span>Unrated</span>
      </button>
    );
  }

  const wPct = review.wPct ?? 0;
  const isHigh = wPct >= 75;
  const isMid = wPct >= 50 && wPct < 75;

  const toneClass = isHigh
    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
    : isMid
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25"
      : "bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25";

  const metricsTitle = review.metrics
    ? `\nTeaching: ${typeof review.metrics.lecture === "number" ? review.metrics.lecture.toFixed(1) : "-"}/5 • DA: ${typeof review.metrics.da === "number" ? review.metrics.da.toFixed(1) : "-"}/5 • Vibe: ${typeof review.metrics.vibe === "number" ? review.metrics.vibe.toFixed(1) : "-"}/5`
    : "";

  return (
    <button
      type="button"
      onClick={onOpenReview}
      title={`Faculty Rating: ${wPct}% Score based on ${review.reviews} reviews${metricsTitle}\nClick to view full review.`}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-black transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 shrink-0 ${toneClass} ${className}`.trim()}
    >
      <span className="text-[10px]">★</span>
      <span>{wPct}% Score</span>
      <span className="text-[9.5px] font-normal opacity-75 font-mono">({review.reviews})</span>
    </button>
  );
}

export function FacultyScoresForCourse({
  facultyString,
  employeeId,
  courseCode,
  onOpenFacultyReview,
}: {
  facultyString: string;
  employeeId?: string;
  courseCode?: string;
  onOpenFacultyReview?: (target: { name: string; employeeId?: string; courseCode?: string }) => void;
}) {
  const parts = facultyString.includes("/") ? facultyString.split("/").map((f) => f.trim()) : [facultyString];

  if (parts.length === 1) {
    return (
      <FacultyScoreBadge
        name={parts[0]}
        employeeId={employeeId}
        onOpenReview={
          onOpenFacultyReview ? () => onOpenFacultyReview({ name: parts[0], employeeId, courseCode }) : undefined
        }
      />
    );
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {parts.map((name, idx) => (
        <FacultyScoreBadge
          key={`${name}-${idx}`}
          name={name}
          employeeId={idx === 0 ? employeeId : undefined}
          onOpenReview={
            onOpenFacultyReview
              ? () =>
                  onOpenFacultyReview({
                    name,
                    employeeId: idx === 0 ? employeeId : undefined,
                    courseCode,
                  })
              : undefined
          }
        />
      ))}
    </div>
  );
}

/**
 * Individual faculty vitfac metrics card displaying rating, reviews,
 * lecture/da/vibe scores, and highlights directly inside the Review & Place step.
 */
export function FacultySingleReviewStat({
  name,
  employeeId,
  role,
  onOpenReviewModal,
}: {
  name: string;
  employeeId?: string;
  role?: string;
  onOpenReviewModal: () => void;
}) {
  const { review, loading } = useVitfacReview(employeeId, name);
  const vitfacEnabled = useVitfacEnabled();

  // This whole row exists to point at Vitfac (rating, or the directory when
  // unreviewed) — with the integration off there is nothing to point at.
  if (!vitfacEnabled) return null;

  if (loading) {
    return (
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 animate-pulse flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-zinc-800 rounded" />
          <div className="h-3 w-20 bg-zinc-800/60 rounded" />
        </div>
        <div className="h-8 w-16 bg-zinc-800 rounded-xl" />
      </div>
    );
  }

  if (!review || review.reviews === 0) {
    return (
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5 text-xs text-zinc-400 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs shrink-0 font-bold text-zinc-400">
            ★
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white truncate">
              {role && <span className="text-zinc-400 mr-1.5 font-normal">[{role}]</span>}
              {name}
            </p>
            <p className="text-[10px] text-zinc-500">No community reviews logged yet on Vitfac</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenReviewModal}
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
        >
          Check Directory →
        </button>
      </div>
    );
  }

  const winPct = review.wPct ?? 0;
  const isHighRating = winPct >= 80;
  const isMidRating = winPct >= 60 && winPct < 80;

  return (
    <div className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950/70 border border-zinc-800 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <FacultyAvatar employeeId={employeeId} name={name} size="md" tone={isHighRating ? "indigo" : "zinc"} />
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-extrabold text-white truncate font-outfit">
              {role && <span className="text-zinc-400 mr-1.5 font-normal text-xs">[{role}]</span>}
              {name}
            </p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Based on <strong className="text-zinc-200">{review.reviews}</strong> verified student reviews
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end shrink-0">
          <div
            className={`px-2.5 py-1 rounded-xl flex items-center gap-1.5 text-xs font-black shadow-xs ${
              isHighRating
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : isMidRating
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
            }`}
          >
            <span>★</span>
            <span>{winPct}%</span>
            <span className="text-[9px] font-normal opacity-70">W</span>
          </div>
          {isHighRating && (
            <span className="text-[9px] font-bold text-emerald-400 mt-1 flex items-center gap-1">
              <Award className="w-2.5 h-2.5" /> High Recommended
            </span>
          )}
        </div>
      </div>

      {review.metrics && (
        <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-zinc-800/60">
          <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/60">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-400 mb-0.5">
              <Flame className="w-3 h-3 text-rose-400" />
              <span>Teaching</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-white font-outfit">
              {typeof review.metrics.lecture === "number" ? review.metrics.lecture.toFixed(1) : "—"}
              <span className="text-[9px] font-normal text-zinc-500"> / 5</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/60">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-400 mb-0.5">
              <Award className="w-3 h-3 text-indigo-400" />
              <span>DA / Assign</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-white font-outfit">
              {typeof review.metrics.da === "number" ? review.metrics.da.toFixed(1) : "—"}
              <span className="text-[9px] font-normal text-zinc-500"> / 5</span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/60">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-400 mb-0.5">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Class Vibe</span>
            </div>
            <div className="text-xs sm:text-sm font-black text-white font-outfit">
              {typeof review.metrics.vibe === "number" ? review.metrics.vibe.toFixed(1) : "—"}
              <span className="text-[9px] font-normal text-zinc-500"> / 5</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800/60 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Top Lore:</span>
          {review.lore?.green && review.lore.green.length > 0 ? (
            review.lore.green.slice(0, 3).map((item, idx) => (
              <span
                key={idx}
                className="text-[10.5px] font-semibold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg border border-emerald-500/20 truncate max-w-[170px]"
              >
                ✓ {item.text}
              </span>
            ))
          ) : (
            <span className="text-[10px] text-zinc-500">No tags recorded</span>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenReviewModal}
          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 shrink-0 ml-auto cursor-pointer"
        >
          <span>Full Lore</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function GuidedFacultyReviewStats({
  facultyString,
  employeeId,
  courseCode,
  onOpenFacultyReview,
}: {
  facultyString: string;
  employeeId?: string;
  courseCode?: string;
  onOpenFacultyReview: (target: { name: string; employeeId?: string; courseCode?: string }) => void;
}) {
  const parts = facultyString
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return (
      <FacultySingleReviewStat
        name={parts[0] || facultyString}
        employeeId={employeeId}
        onOpenReviewModal={() => onOpenFacultyReview({ name: parts[0] || facultyString, employeeId, courseCode })}
      />
    );
  }

  return (
    <div className="space-y-3">
      {parts.map((name, idx) => (
        <FacultySingleReviewStat
          key={name}
          name={name}
          employeeId={idx === 0 ? employeeId : undefined}
          role={idx === 0 ? "Theory" : "Lab"}
          onOpenReviewModal={() =>
            onOpenFacultyReview({ name, employeeId: idx === 0 ? employeeId : undefined, courseCode })
          }
        />
      ))}
    </div>
  );
}
