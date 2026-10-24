"use client";

/**
 * The same-slot faculty picker, summoned from the preview's Selected Courses
 * table.
 *
 * Tapping a course's Faculty cell asks a question the variant sheet only
 * answers across a whole timetable: who else teaches *this course* at *this
 * exact time*? This sheet lists those people straight from the master report
 * and hands the tapped course to the one chosen — same slot tokens, same
 * periods, so every metric the preview displays stays true.
 *
 * It also provides an instant downloadable JPEG reference cheat sheet
 * containing all faculties teaching this slot and a step-by-step FFCS registration
 * strategy guide so students can pick backup faculties immediately during registration rush.
 */

import React, { useMemo, useState } from "react";
import { Search, Users, Download, Loader2, Sparkles, AlertCircle } from "lucide-react";
import * as htmlToImage from "html-to-image";
import BottomSheet from "../../../shared/BottomSheet";
import SearchInput from "../../../shared/SearchInput";
import { sameSlotFacultyAlternatives, expandCourseHalves } from "../logic/generate";
import { offeringId } from "../reports";
import type { AddedCourse, ParsedCourse } from "../types";
import FacultyReviewSheet, { VitfacReviewPill, FacultyAvatar } from "./FacultyReviewSheet";
import { getFacultyReview, ENABLE_VITFAC_INTEGRATION } from "@/lib/vitfacService";

export interface SlotFacultySwapSheetProps {
  /** The clicked row's course code. */
  code: string;
  /** The clicked row's title, for the subtitle. */
  courseTitle: string;
  /**
   * The unmerged courses behind the clicked row — usually one embedded
   * offering; two halves when a code's theory and lab run as separate rows.
   */
  halves: AddedCourse[];
  masterCourses: ParsedCourse[];
  /** Hand `courseId` to `offering`'s faculty at the same slots. */
  onSwap?: (courseId: string, offering: ParsedCourse) => void;
  onClose: () => void;
  backdropZIndex?: number;
  panelZIndex?: number;
}

function generateFacultyGuideHtml(
  code: string,
  courseTitle: string,
  halves: AddedCourse[],
  allBlocks: { half: AddedCourse; allMatches: ParsedCourse[] }[]
): string {
  const escape = (s?: string) =>
    (s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const targetSlots = halves
    .map((h) => h.slots.join("+"))
    .filter((v, i, a) => a.indexOf(v) === i)
    .join(" / ");

  const blocksHtml = allBlocks
    .map(({ half, allMatches }, i) => {
      const halfTitle = half.type ? `${half.type} Offering` : `Offering ${i + 1}`;
      const slotBadges = half.slots
        .map(
          (s) =>
            `<span style="background:#1e293b;border:1px solid #334155;color:#e2e8f0;font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;">${escape(s)}</span>`
        )
        .join(" ");

      const currentVenue = half.venue || (half.employeeId ? `ERP ${half.employeeId}` : "Venue TBA");
      const currentRev = getFacultyReview({ employeeId: half.employeeId, name: half.faculty });
      const currentRatingBadge = currentRev && currentRev.reviews > 0
        ? `<span style="background:${currentRev.wPct >= 70 ? 'rgba(16,185,129,0.2)' : currentRev.wPct >= 40 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'};color:${currentRev.wPct >= 70 ? '#34d399' : currentRev.wPct >= 40 ? '#fbbf24' : '#f87171'};font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px;">${currentRev.wPct}% W (${currentRev.reviews})</span>`
        : '';

      const currentTeacherHtml = `
        <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:10px;padding:10px 14px;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="background:#10b981;color:#022c22;font-size:10px;font-weight:900;padding:2px 6px;border-radius:4px;letter-spacing:0.5px;">PRIMARY PICK</span>
            <span style="font-weight:700;color:#ffffff;font-size:14px;">${escape(half.faculty)}</span>
            ${currentRatingBadge}
          </div>
          <span style="color:#6ee7b7;font-size:12px;font-weight:600;">${escape(currentVenue)}</span>
        </div>
      `;

      let alternativesHtml = "";
      if (allMatches.length > 0) {
        const rows = allMatches
          .map(
            (m, mIdx) => {
              const mRev = getFacultyReview({ employeeId: m.ERP_ID, name: m.FACULTY });
              const mRatingBadge = mRev && mRev.reviews > 0
                ? `<span style="background:${mRev.wPct >= 70 ? 'rgba(16,185,129,0.2)' : mRev.wPct >= 40 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'};color:${mRev.wPct >= 70 ? '#34d399' : mRev.wPct >= 40 ? '#fbbf24' : '#f87171'};font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px;">${mRev.wPct}% W (${mRev.reviews})</span>`
                : '';
              return `
            <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(30,41,59,0.7);border:1px solid rgba(51,65,85,0.7);border-radius:8px;padding:8px 12px;margin-bottom:6px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="background:#334155;color:#cbd5e1;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">#${mIdx + 1} BACKUP</span>
                <span style="font-weight:600;color:#f1f5f9;font-size:13px;">${escape(m.FACULTY)}</span>
                ${mRatingBadge}
              </div>
              <span style="color:#94a3b8;font-size:12px;">${escape(m.ROOM || (m.ERP_ID ? `ERP ${m.ERP_ID}` : "TBA"))}</span>
            </div>
          `;
            }
          )
          .join("");

        alternativesHtml = `
          <div style="margin-top:10px;">
            <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:6px;padding-left:2px;">
              Backup Options (Exact Same Slot · Zero Clash Risk)
            </div>
            ${rows}
          </div>
        `;
      } else {
        alternativesHtml = `
          <div style="font-size:12px;color:#94a3b8;font-style:italic;padding:4px 2px;">
            No alternative faculties for this time slot — ${escape(half.faculty)} is the only choice.
          </div>
        `;
      }

      return `
        <div style="background:rgba(15,23,42,0.9);border:1px solid #1e293b;border-radius:14px;padding:16px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e293b;padding-bottom:10px;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:13px;font-weight:700;color:#e2e8f0;">${escape(halfTitle)}</span>
              <span style="font-size:11px;color:#94a3b8;">(${1 + allMatches.length} ${1 + allMatches.length === 1 ? "faculty" : "faculties"} in this slot)</span>
            </div>
            <div style="display:flex;gap:6px;">${slotBadges}</div>
          </div>
          ${currentTeacherHtml}
          ${alternativesHtml}
        </div>
      `;
    })
    .join("");

  return `
    <div style="width:640px;background:#090d16;color:#f1f5f9;padding:28px;border-radius:18px;border:1px solid #1e293b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;box-sizing:border-box;">
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:1px solid #1e293b;padding-bottom:16px;margin-bottom:20px;">
        <div>
          <div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#60a5fa;margin-bottom:4px;display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#3b82f6;"></span>
            AmazeCC • FFCS Slot Faculty Sheet
          </div>
          <h1 style="font-size:20px;font-weight:900;color:#ffffff;margin:0;letter-spacing:-0.3px;line-height:1.2;">
            ${escape(code)} — ${escape(courseTitle)}
          </h1>
        </div>
        <div style="text-align:right;">
          <span style="font-size:10px;color:#94a3b8;font-weight:600;display:block;">Target Schedule</span>
          <span style="font-size:12px;font-weight:800;color:#fbbf24;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.3);padding:3px 8px;border-radius:6px;display:inline-block;margin-top:2px;">
            ${escape(targetSlots)}
          </span>
        </div>
      </div>

      <!-- Offerings / Faculties -->
      <div style="margin-bottom:18px;">
        ${blocksHtml}
      </div>

      <!-- Registration Strategy -->
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:14px;padding:16px;margin-bottom:16px;">
        <div style="font-size:12px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px;">
          ⚡ How to Pick It Out in FFCS (Registration Strategy)
        </div>
        <div style="font-size:12px;color:#cbd5e1;line-height:1.6;">
          <div style="margin-bottom:6px;"><strong style="color:#fbbf24;">1. Search Course:</strong> In VTOP Course Registration, search by Course Code <strong style="color:#ffffff;">${escape(code)}</strong>.</div>
          <div style="margin-bottom:6px;"><strong style="color:#fbbf24;">2. Filter Slot:</strong> Locate the row matching slot <strong style="color:#fde68a;">${escape(targetSlots)}</strong>.</div>
          <div style="margin-bottom:6px;"><strong style="color:#fbbf24;">3. Target Primary Pick:</strong> Try to select your primary teacher (${escape(halves.map((h) => h.faculty).join(" / "))}).</div>
          <div style="margin-bottom:6px;"><strong style="color:#fbbf24;">4. Instant Fallback:</strong> If seats fill instantly, pick the next available teacher from the backup list above without hesitation. Because the slot is identical, your overall timetable will NOT clash!</div>
          <div><strong style="color:#fbbf24;">5. Lock It In:</strong> Submit immediately to secure your seat.</div>
        </div>
      </div>

      <!-- Footer -->
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#64748b;border-top:1px solid #1e293b;padding-top:12px;">
        <span>Generated with AmazeCC &bull; Ratings sourced from third-party vitfac.pages.dev</span>
        <span>Clash-Free Timetable Builder</span>
      </div>
    </div>
  `;
}

export default function SlotFacultySwapSheet({
  code,
  courseTitle,
  halves,
  masterCourses,
  onSwap,
  onClose,
  backdropZIndex = 215,
  panelZIndex = 220,
}: SlotFacultySwapSheetProps) {
  const [query, setQuery] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<{ name: string; employeeId?: string } | null>(null);

  const expandedHalves = useMemo(() => expandCourseHalves(halves), [halves]);

  // All alternatives in the exact same slot, unfiltered by search query.
  // Used for both calculating total counts and rendering the downloadable JPEG cheat sheet.
  const allBlocks = useMemo(
    () =>
      expandedHalves.map((half) => ({
        half,
        allMatches: sameSlotFacultyAlternatives(
          half.code,
          half.slots,
          { faculty: half.faculty, employeeId: half.employeeId },
          masterCourses
        ),
      })),
    [expandedHalves, masterCourses]
  );

  // Filtered by search query for modal interaction.
  const blocks = useMemo(
    () =>
      allBlocks.map(({ half, allMatches }) => ({
        half,
        allMatches,
        matches: allMatches.filter((o) =>
          query ? o.FACULTY.toLowerCase().includes(query.toLowerCase()) : true
        ),
      })),
    [allBlocks, query]
  );

  const totalMatches = blocks.reduce((n, b) => n + b.matches.length, 0);

  const handleDownloadJpeg = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    let container: HTMLElement | null = null;
    try {
      const toJpegFn = htmlToImage?.toJpeg;
      if (typeof toJpegFn !== "function") {
        throw new Error("htmlToImage is not available");
      }
      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.zIndex = "-1000";
      container.innerHTML = generateFacultyGuideHtml(code, courseTitle, expandedHalves, allBlocks);
      document.body.appendChild(container);

      const targetElement = (container.firstElementChild as HTMLElement) || container;
      const dataUrl = await toJpegFn(targetElement, {
        quality: 0.95,
        backgroundColor: "#090d16",
        pixelRatio: 2,
      });

      if (dataUrl) {
        const link = document.createElement("a");
        const cleanCode = code.replace(/[^a-zA-Z0-9_-]/g, "_");
        const allSlotTokens = expandedHalves
          .flatMap((h) => h.slots)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join("_");
        link.download = `${cleanCode}_${allSlotTokens || "Slot"}_Faculty_Guide.jpeg`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error("Failed to generate JPEG:", err);
      setDownloadError("Could not generate JPEG. Please try again.");
    } finally {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
      setIsDownloading(false);
    }
  };

  return (
    <>
    <BottomSheet
      onClose={onClose}
      overlayId="ffcs-generator-slot-faculty"
      maxWidth="max-w-lg"
      panelZIndex={panelZIndex}
      backdropZIndex={backdropZIndex}
      contentClassName="flex flex-col gap-3"
      title={onSwap ? "Switch Faculty" : "Faculty in this Slot"}
      subtitle={`${code} — ${courseTitle}`}
      icon={<Users className="w-5 h-5 text-blue-400" />}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
          {onSwap
            ? "Everyone below teaches this course at the exact same time slot — a swap changes the teacher only."
            : "Everyone below teaches this course at the exact same time slot."}
        </p>
        <button
          type="button"
          onClick={handleDownloadJpeg}
          disabled={isDownloading}
          data-testid="download-faculty-jpeg-btn"
          title="Download a JPEG reference sheet with all faculties in this slot and FFCS picking instructions"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 active:bg-blue-500/30 text-blue-400 border border-blue-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shrink-0 shadow-sm"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Generating JPEG...</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Download JPEG</span>
            </>
          )}
        </button>
      </div>

      {downloadError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Guide: How to pick it out in FFCS */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 font-bold text-amber-500 text-xs">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>How to Pick It Out in FFCS:</span>
        </div>
        <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-[11px] leading-relaxed pl-0.5">
          <li>Search course code <strong className="text-text-heading">{code}</strong> in VTOP Course Registration.</li>
          <li>Look for slot row <strong className="text-text-heading">{halves.map((h) => h.slots.join("+")).join(" & ")}</strong>.</li>
          <li>Target your primary faculty, or if seats fill up, pick any backup faculty listed below.</li>
          <li>Since all listed faculties share the exact same slot, your timetable remains 100% clash-free!</li>
        </ol>
      </div>

      <SearchInput
        placeholder="Search by faculty name..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="bg-surface-secondary/50 border-border-strong pl-10 pr-4 py-3 focus:border-amber-500/50 placeholder:text-muted-foreground"
      />

      <div className="p-2 overflow-y-auto max-h-[50vh] custom-scrollbar bg-surface-secondary/5 rounded-xl">
        {blocks.map(({ half, matches }, i) => (
          <div
            key={half.id}
            className={`flex flex-col gap-1.5 px-2 py-2 ${
              i > 0 ? "border-t border-border-strong/40 mt-1" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Current:</span>
                <FacultyAvatar
                  employeeId={half.employeeId}
                  name={half.faculty}
                  size="xs"
                  tone="amber"
                />
                <span className="font-semibold text-text-heading text-sm">
                  {half.faculty}
                </span>
                <VitfacReviewPill
                  employeeId={half.employeeId}
                  name={half.faculty}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedReview({ name: half.faculty, employeeId: half.employeeId });
                  }}
                />
              </div>
              <span className="flex flex-wrap gap-1 justify-end">
                {half.slots.map((s) => (
                  <span
                    key={s}
                    className="bg-accent/50 border border-border-strong text-text-heading/80 text-[10px] px-1.5 py-0.5 rounded-md"
                  >
                    {s}
                  </span>
                ))}
              </span>
            </div>

            <div className="flex flex-col">
              {matches.map((off) => (
                <button
                  key={offeringId(off)}
                  type="button"
                  onClick={() => {
                    if (onSwap) {
                      onSwap(half.id, off);
                    }
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 my-0.5 rounded-xl transition-colors border border-transparent ${onSwap ? 'hover:bg-surface-secondary/80 cursor-pointer' : 'hover:bg-surface-secondary/40 cursor-default'} text-left group`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FacultyAvatar
                      employeeId={off.ERP_ID}
                      name={off.FACULTY}
                      size="xs"
                      tone="amber"
                    />
                    <span className="font-bold text-sm text-text-heading truncate">
                      {off.FACULTY}
                    </span>
                    <VitfacReviewPill
                      employeeId={off.ERP_ID}
                      name={off.FACULTY}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReview({ name: off.FACULTY, employeeId: off.ERP_ID });
                      }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {off.ROOM || (off.ERP_ID ? `ERP ${off.ERP_ID}` : "TBA")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}

        {totalMatches === 0 && (
          <div className="text-center py-8 flex flex-col items-center justify-center border border-dashed border-border-strong/50 rounded-xl m-2">
            {query ? (
              <>
                <Search className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <span className="text-muted-foreground font-medium">
                  No faculty matches &ldquo;{query}&rdquo;
                </span>
                <span className="text-xs text-muted-foreground/70 mt-1">
                  Clear the search to see everyone.
                </span>
              </>
            ) : (
              <>
                <Users className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <span className="text-muted-foreground font-medium">
                  No other faculty at this time slot
                </span>
                <span className="text-xs text-muted-foreground/70 mt-1">
                  The current teacher is the only choice here.
                </span>
              </>
            )}
          </div>
        )}

        {ENABLE_VITFAC_INTEGRATION && (
          <p className="text-[10px] text-muted-foreground/60 text-center pt-2 border-t border-border-strong/30 leading-tight">
            Disclaimer: Ratings are sourced from third-party platform <a href="https://vitfac.pages.dev" target="_blank" rel="noopener noreferrer" className="hover:underline text-muted-foreground font-medium">vitfac.pages.dev</a>. AmazeCC is not affiliated with nor responsible for these user reviews.
          </p>
        )}
      </div>
    </BottomSheet>

    <FacultyReviewSheet
      open={!!selectedReview}
      onClose={() => setSelectedReview(null)}
      facultyName={selectedReview?.name || ""}
      employeeId={selectedReview?.employeeId}
      courseCode={code}
    />
    </>
  );
}
