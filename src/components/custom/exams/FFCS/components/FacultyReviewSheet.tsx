"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  ExternalLink,
  Sparkles,
  BookOpen,
  GraduationCap,
  Award,
  AlertTriangle,
  Smile,
  FileText,
  X,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  PenLine,
  Sliders,
  Tag,
} from "lucide-react";
import BottomSheet from "../../../shared/BottomSheet";
import {
  ENABLE_VITFAC_INTEGRATION,
  getFacultyProfileBundle,
  getVitfacProfileUrl,
  type VitfacProfileBundle,
} from "@/lib/vitfacService";
import {
  ENABLE_AMAZE_REVIEWS,
  useFacultyReview,
  getFacultyProfileSnapshot,
} from "@/lib/reviewsService";
import { FacultyAvatar } from "./FacultyAvatar";
import { TEACHING_CONFIG, PROJECT_CONFIG, getComponentQuestion } from "@/config/reviewQuestions";
import LegacyVitfacReviewSheet from "./LegacyVitfacReviewSheet";

// Re-exports so existing importers continue working untouched
export { FacultyAvatar, VitfacReviewPill, getFacultyInitials } from "./FacultyAvatar";
export type { FacultyAvatarProps } from "./FacultyAvatar";

/**
 * The review pane sits above the whole FFCS sheet ladder (tops out at the
 * z-600 Advanced Course Linker) and below the command palette (z-9999), so
 * pills inside any higher pane can open it. Kept in sync with upstream.
 */
const REVIEW_PANEL_Z = 650;
const REVIEW_BACKDROP_Z = 645;

export interface FacultyReviewSheetProps {
  open: boolean;
  onClose: () => void;
  facultyName: string;
  employeeId?: string;
  courseCode?: string;
  facultyId?: string;
}

function FirstPartyReviewSheet({
  open,
  onClose,
  facultyName,
  employeeId,
  courseCode,
  facultyId,
}: FacultyReviewSheetProps) {
  const { review, loading: reviewLoading } = useFacultyReview(employeeId, facultyName, facultyId);

  const [activeTab, setActiveTab] = useState<"teaching" | "project">("teaching");
  const [profileSnapshot, setProfileSnapshot] = useState<any | null>(null);
  const [bundle, setBundle] = useState<VitfacProfileBundle | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [activeCourseFilter, setActiveCourseFilter] = useState<string>("global");

  const inferredComponent = useMemo(() => {
    if (activeCourseFilter !== "global") {
      if (activeCourseFilter.endsWith("L") || activeCourseFilter.includes("LAB") || activeCourseFilter.endsWith("P")) return "Lab";
      if (activeCourseFilter.endsWith("E")) return "Embedded";
      return "Theory";
    }
    const courses: string[] = profileSnapshot?.teaching?.courses || [];
    if (courses.length > 0 && courses.every((c: string) => c.endsWith("L") || c.includes("LAB"))) {
      return "Lab";
    }
    return "Theory";
  }, [activeCourseFilter, profileSnapshot?.teaching?.courses]);

  useEffect(() => {
    if (!open) {
      setProfileSnapshot(null);
      setBundle(null);
      setActiveCourseFilter("global");
      return;
    }

    if (courseCode) {
      setActiveCourseFilter(courseCode.toUpperCase());
    } else {
      setActiveCourseFilter("global");
    }

    const resolvedFacultyId = facultyId || review?.id;

    // Fetch snapshot if first-party ID is present
    if (ENABLE_AMAZE_REVIEWS && resolvedFacultyId) {
      setLoadingData(true);
      getFacultyProfileSnapshot(resolvedFacultyId)
        .then((snap) => {
          if (snap) setProfileSnapshot(snap);
        })
        .finally(() => setLoadingData(false));
    }

    // Fetch legacy vitfac bundle if legacy integration is active
    const vitfacTarget = {
      employeeId: employeeId || review?.employeeId || profileSnapshot?.faculty?.employee_id,
      vitfacId: (review as any)?.vitfac_id || (profileSnapshot?.faculty as any)?.vitfac_id,
      name: profileSnapshot?.faculty?.name || review?.name || facultyName,
      id: review?.id || facultyId,
    };
    if (ENABLE_VITFAC_INTEGRATION && (!profileSnapshot || review?.legacyVitfac)) {
      getFacultyProfileBundle(vitfacTarget).then((b) => {
        if (b) setBundle(b);
      });
    }
  }, [open, facultyId, review?.id, employeeId, courseCode, review?.legacyVitfac]);

  if (!open) return null;

  const isFirstParty = profileSnapshot !== null && !review?.legacyVitfac;

  // Active track stats from first-party snapshot
  const teachingTrack = profileSnapshot?.teaching || null;
  const projectTrack = profileSnapshot?.project || null;
  const currentTrackData =
    activeTab === "teaching"
      ? activeCourseFilter !== "global" && profileSnapshot?.teaching_by_course?.[activeCourseFilter]
        ? profileSnapshot.teaching_by_course[activeCourseFilter]
        : teachingTrack
      : projectTrack;

  // Legacy vitfac fallback calculations
  const legacyProf = bundle?.prof || review;
  const availableLegacyCourses = bundle?.courseStats?.courses || [];
  const selectedLegacyCourse =
    activeCourseFilter !== "global"
      ? availableLegacyCourses.find((c) => c.code.toUpperCase() === activeCourseFilter.toUpperCase())
      : null;
  const legacyStats = selectedLegacyCourse || bundle?.courseStats?.global || null;
  const legacyWPct = legacyStats?.wPct ?? legacyProf?.wPct ?? 0;
  const legacyReviews = legacyStats?.reviews ?? legacyProf?.reviews ?? 0;

  const profileUrl = getVitfacProfileUrl({
    employeeId:
      employeeId ||
      review?.employeeId ||
      profileSnapshot?.faculty?.employee_id ||
      null,
    vitfacId:
      (review as any)?.vitfac_id ||
      (profileSnapshot?.faculty as any)?.vitfac_id ||
      null,
    name:
      profileSnapshot?.faculty?.name ||
      review?.name ||
      facultyName ||
      null,
    id: review?.id || facultyId || null,
  });

  return (
    <>
      <BottomSheet
        onClose={onClose}
        overlayId="faculty-review-sheet"
        maxWidth="max-w-xl"
        panelZIndex={REVIEW_PANEL_Z}
        backdropZIndex={REVIEW_BACKDROP_Z}
        contentClassName="space-y-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border-strong pb-4">
          <div className="flex items-center gap-3">
            <FacultyAvatar
              employeeId={review?.employeeId || employeeId}
              name={profileSnapshot?.faculty?.name || review?.name || facultyName}
              fallbackImageUrl={profileSnapshot?.faculty?.image_url || (review?.image ? `data:image/jpeg;base64,${review.image}` : review?.image_url)}
              size="lg"
              tone="amber"
            />
            <div className="min-w-0">
              <h3 className="font-bold text-lg text-text-heading leading-tight truncate">
                {profileSnapshot?.faculty?.name || review?.name || facultyName}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {profileSnapshot?.faculty?.designation || review?.designation ? `${profileSnapshot?.faculty?.designation || review?.designation} · ` : ""}
                {profileSnapshot?.faculty?.school || review?.dept || (employeeId ? `ERP: ${employeeId}` : "Faculty")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {ENABLE_VITFAC_INTEGRATION && profileUrl && (
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="View on VIT fac"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all cursor-pointer"
              >
                <span>VIT fac</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-text-heading hover:bg-surface-secondary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Two Review Tracks: Teaching vs Project Guide (Side by Side) */}
        <div className="flex items-center p-1 bg-surface-secondary/60 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setActiveTab("teaching")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "teaching"
                ? "bg-surface text-text-heading shadow-sm"
                : "text-muted-foreground hover:text-text-heading"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-500" />
            <span>Teaching Grade</span>
            {teachingTrack?.grade !== null && teachingTrack?.grade !== undefined && (
              <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-extrabold text-[11px]">
                {teachingTrack.grade.toFixed(1)}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("project")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === "project"
                ? "bg-surface text-text-heading shadow-sm"
                : "text-muted-foreground hover:text-text-heading"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
            <span>Project Grade</span>
            {projectTrack?.grade !== null && projectTrack?.grade !== undefined && (
              <span className="px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-[11px]">
                {projectTrack.grade.toFixed(1)}
              </span>
            )}
          </button>
        </div>

        {loadingData ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
            <span className="text-xs">Loading faculty intelligence…</span>
          </div>
        ) : isFirstParty && currentTrackData ? (
          <div className="space-y-5">
            {/* Headline Grade Banner */}
            <div className="p-4 rounded-2xl bg-surface-secondary/40 border border-border-strong flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  {currentTrackData.grade !== null ? (
                    <>
                      <span className="text-3xl font-extrabold text-text-heading">
                        {currentTrackData.grade.toFixed(1)}
                      </span>
                      <span className="text-xs text-muted-foreground font-semibold">/ 5.0</span>
                    </>
                  ) : (
                    <span className="text-lg font-bold text-muted-foreground">
                      Not enough reviews yet
                    </span>
                  )}

                  {currentTrackData.is_early && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                      Early Data
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span>{currentTrackData.n_reviews} student reviews</span>
                  {currentTrackData.n_reviews > 0 && (
                    <>
                      <span>·</span>
                      <span className="flex items-center gap-1 text-emerald-500">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>
                          {Math.round((currentTrackData.n_verified / currentTrackData.n_reviews) * 100)}% verified
                        </span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Course Filter (Teaching track only) */}
              {activeTab === "teaching" && profileSnapshot?.teaching?.courses?.length > 0 && (
                <div>
                  <select
                    value={activeCourseFilter}
                    onChange={(e) => setActiveCourseFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-border-strong bg-surface text-text-heading text-xs font-semibold focus:outline-none"
                  >
                    <option value="global">All Courses</option>
                    {profileSnapshot.teaching.courses.map((c: string) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Per-Question Averages & Distributions */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Question Breakdown
              </h4>
              <div className="space-y-2">
                {(activeTab === "teaching" ? TEACHING_CONFIG : PROJECT_CONFIG).qualityQuestions.map((q) => {
                  const stat = currentTrackData.per_question?.[q.id];
                  if (!stat) return null;
                  return (
                    <div
                      key={q.id}
                      className="p-3 rounded-xl border border-border bg-surface flex flex-col gap-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-text-heading leading-tight">
                          {getComponentQuestion(q.id, q.question, activeTab === "teaching" ? inferredComponent : undefined)}
                        </span>
                        <span className="text-xs font-extrabold text-amber-500 shrink-0">
                          {stat.avg.toFixed(1)} / 5
                        </span>
                      </div>

                      {/* 5-bar distribution (only shown if n >= 5) */}
                      {stat.dist && (
                        <div className="flex items-center gap-1 pt-1">
                          {stat.dist.map((cnt: number, idx: number) => {
                            const total = stat.dist.reduce((a: number, b: number) => a + b, 0);
                            const pct = total > 0 ? (cnt / total) * 100 : 0;
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                                <div className="w-full bg-border-strong rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className="bg-amber-500 h-1.5 rounded-full"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[9px] text-muted-foreground">{idx + 1}★</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Style Spectrums */}
            {Object.keys(currentTrackData.style || {}).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Style & Atmosphere (Neutral Spectrum)</span>
                </h4>
                <div className="space-y-2.5">
                  {(activeTab === "teaching" ? TEACHING_CONFIG : PROJECT_CONFIG).styleQuestions.map((s) => {
                    const stat = currentTrackData.style?.[s.id];
                    if (!stat) return null;
                    const pct = Math.max(0, Math.min(100, ((stat.avg - 1) / 4) * 100));
                    return (
                      <div key={s.id} className="p-3 rounded-xl border border-border bg-surface space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-text-heading">
                          <span>{getComponentQuestion(s.id, s.question, activeTab === "teaching" ? inferredComponent : undefined)}</span>
                          <span className="text-muted-foreground">{stat.avg.toFixed(1)}</span>
                        </div>
                        <div className="relative w-full h-2 bg-border-strong rounded-full">
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-blue-500 border-2 border-white shadow-sm"
                            style={{ left: `calc(${pct}% - 7px)` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{s.minAnchor}</span>
                          {s.midAnchor && <span>{s.midAnchor}</span>}
                          <span>{s.maxAnchor}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Student Tags */}
            {((currentTrackData.top_tags_green && currentTrackData.top_tags_green.length > 0) ||
              (currentTrackData.top_tags_red && currentTrackData.top_tags_red.length > 0)) && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Student Observations (Top Tags)</span>
                </h4>
                <div className="space-y-2">
                  {currentTrackData.top_tags_green?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {currentTrackData.top_tags_green.map((t: any) => (
                        <span
                          key={t.tag}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1"
                        >
                          <span>{t.tag}</span>
                          <span className="text-[10px] opacity-70">+{t.count}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {currentTrackData.top_tags_red?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {currentTrackData.top_tags_red.map((t: any) => (
                        <span
                          key={t.tag}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1"
                        >
                          <span>{t.tag}</span>
                          <span className="text-[10px] opacity-70">+{t.count}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Legacy Vitfac Fallback State */
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center justify-between">
              <span>Legacy vitfac data</span>
              <span className="font-bold">{legacyReviews} reviews</span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-secondary/40 border border-border-strong flex items-center justify-between">
              <div>
                <span className="text-3xl font-extrabold text-text-heading">{legacyWPct}%</span>
                <span className="text-xs font-semibold text-muted-foreground ml-1.5">Win Rate</span>
                <p className="text-xs text-muted-foreground mt-0.5">{legacyReviews} total reviews on vitfac</p>
              </div>
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-xl border border-border-strong bg-surface hover:bg-surface-secondary text-xs font-semibold text-text-heading flex items-center gap-1.5 transition-colors"
              >
                <span>View on vitfac</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </a>
            </div>

            <div className="text-center py-3 text-xs text-muted-foreground italic">
              Verified students who have studied under this faculty can submit reviews from the Write Reviews tab.
            </div>
          </div>
        )}

        {/* Legal and Privacy Disclaimer */}
        <p className="text-[11px] text-muted-foreground text-center border-t border-border pt-4 leading-relaxed">
          Disclaimer: Anonymous student opinions, aggregated. AmazeCC does not endorse or independently verify these submissions; this system provides peer transparency to assist course planning.
        </p>
      </BottomSheet>
    </>
  );
}


/**
 * With ENABLE_AMAZE_REVIEWS off (the default) the original vitfac review pane is
 * rendered untouched. The first-party pane only appears when the flag is on.
 */
export default function FacultyReviewSheet(props: FacultyReviewSheetProps) {
  return ENABLE_AMAZE_REVIEWS ? <FirstPartyReviewSheet {...props} /> : <LegacyVitfacReviewSheet {...props} />;
}
