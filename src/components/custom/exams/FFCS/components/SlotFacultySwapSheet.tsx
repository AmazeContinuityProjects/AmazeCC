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
import { Search, Users, Download, Loader2, Sparkles, AlertCircle, X } from "lucide-react";
import BottomSheet from "../../../shared/BottomSheet";
import SearchInput from "../../../shared/SearchInput";
import { sameSlotFacultyAlternatives, expandCourseHalves, allCourseOfferings } from "../logic/generate";
import { offeringId } from "../reports";
import type { AddedCourse, ParsedCourse } from "../types";
import { VitfacReviewPill, FacultyAvatar } from "./FacultyReviewSheet";
import FacultyReviewSheetHost from "./FacultyReviewSheetHost";
import { getFacultyReview, ENABLE_VITFAC_INTEGRATION } from "@/lib/vitfacService";
import { getTimetableSchema } from "@/lib/campusSchema";
import { periodsForSlot, findPeriodClash, splitSlots } from "@/lib/slots";
import { useFacultyReviewSheet } from "../hooks/useFacultyReviewSheet";

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
  /** All courses in the current timetable, used for clash checking when viewing other faculties. */
  allTimetableCourses?: AddedCourse[];
  /** Blocked slot spellings to avoid. */
  blockedSlots?: ReadonlySet<string>;
  /** Hand `courseId` to `offering`'s faculty at the same slots. */
  onSwap?: (courseId: string, offering: ParsedCourse) => void;
  onClose: () => void;
  backdropZIndex?: number;
  panelZIndex?: number;
}

function checkOfferingClash(
  offSlots: string[],
  otherCourses: AddedCourse[],
  blocked: ReadonlySet<string> = new Set()
): { clashes: boolean; reason?: string } {
  try {
    const schema = getTimetableSchema();
    for (const s of offSlots) {
      if (blocked.has(s)) {
        return { clashes: true, reason: `Blocked slot (${s})` };
      }
    }

    const offPeriods = offSlots.flatMap((s) => periodsForSlot(schema, s));

    for (const oc of otherCourses) {
      const ocPeriods = oc.slots.flatMap((s) => periodsForSlot(schema, s));
      const clash = findPeriodClash(offPeriods, ocPeriods);
      if (clash) {
        return {
          clashes: true,
          reason: `Clashes with ${oc.code} (${oc.slots.join("+")}) on ${clash.periodB.day.toUpperCase()}`,
        };
      }
    }
  } catch {
    // If schema is not available, fail safe
  }

  return { clashes: false };
}

function generateFacultyGuideHtml(
  code: string,
  courseTitle: string,
  halves: AddedCourse[],
  allBlocks: { half: AddedCourse; allMatches: ParsedCourse[] }[],
  dropInMatches: ParsedCourse[] = [],
  isEmbedded: boolean = false,
  otherOfferings: { offering: ParsedCourse; slots: string[]; clashes: boolean; clashReason?: string }[] = []
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

  const dropInHtml = dropInMatches.length > 0 ? `
    <div style="background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.3);border-radius:14px;padding:16px;margin-bottom:14px;">
      <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(59,130,246,0.25);padding-bottom:10px;margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:13px;font-weight:700;color:#93c5fd;">⚡ FULL DROP-IN COMBINED REPLACEMENTS</span>
          <span style="font-size:11px;color:#cbd5e1;">(Zero Clash Risk · Same Slots)</span>
        </div>
      </div>
      ${dropInMatches.map((m, mIdx) => {
        const mRev = getFacultyReview({ employeeId: m.ERP_ID, name: m.FACULTY });
        const mRatingBadge = mRev && mRev.reviews > 0
          ? `<span style="background:${mRev.wPct >= 70 ? 'rgba(16,185,129,0.2)' : mRev.wPct >= 40 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'};color:${mRev.wPct >= 70 ? '#34d399' : mRev.wPct >= 40 ? '#fbbf24' : '#f87171'};font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px;">${mRev.wPct}% W (${mRev.reviews})</span>`
          : '';
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(30,41,59,0.7);border:1px solid rgba(59,130,246,0.3);border-radius:8px;padding:8px 12px;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="background:#2563eb;color:#ffffff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">#${mIdx + 1} DROP-IN</span>
              <span style="font-weight:700;color:#f1f5f9;font-size:13px;">${escape(m.FACULTY)}</span>
              ${mRatingBadge}
            </div>
            <span style="color:#94a3b8;font-size:12px;">${escape(m.ROOM || "TBA")}</span>
          </div>
        `;
      }).join("")}
    </div>
  ` : '';

  const clashFreeOther = otherOfferings.filter((o) => !o.clashes);
  const otherHtml = isEmbedded && clashFreeOther.length > 0 ? `
    <div style="background:rgba(15,23,42,0.9);border:1px solid #1e293b;border-radius:14px;padding:16px;margin-bottom:14px;">
      <div style="font-size:12px;font-weight:700;color:#93c5fd;margin-bottom:10px;">
        ⚡ OTHER AVAILABLE OFFERINGS (Clash-Free · Other Slots)
      </div>
      ${clashFreeOther.slice(0, 6).map((o) => {
        const off = o.offering;
        const mRev = getFacultyReview({ employeeId: off.ERP_ID, name: off.FACULTY });
        const mRatingBadge = mRev && mRev.reviews > 0
          ? `<span style="background:${mRev.wPct >= 70 ? 'rgba(16,185,129,0.2)' : mRev.wPct >= 40 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'};color:${mRev.wPct >= 70 ? '#34d399' : mRev.wPct >= 40 ? '#fbbf24' : '#f87171'};font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-left:6px;">${mRev.wPct}% W (${mRev.reviews})</span>`
          : '';
        return `
          <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(30,41,59,0.7);border:1px solid rgba(51,65,85,0.7);border-radius:8px;padding:8px 12px;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="background:#0284c7;color:#ffffff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;">EMBEDDED</span>
              <span style="font-weight:600;color:#f1f5f9;font-size:13px;">${escape(off.FACULTY)}</span>
              ${mRatingBadge}
            </div>
            <div style="text-align:right;">
              <span style="color:#fbbf24;font-size:11px;font-weight:700;">${escape(o.slots.join("+"))}</span>
              <span style="color:#64748b;font-size:11px;margin-left:6px;">${escape(off.ROOM || "TBA")}</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  ` : '';

  const blocksHtml = isEmbedded ? '' : allBlocks
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
        ${dropInHtml}
        ${blocksHtml}
        ${otherHtml}
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
  allTimetableCourses = [],
  blockedSlots = new Set(),
  onSwap,
  onClose,
  backdropZIndex = 215,
  panelZIndex = 220,
}: SlotFacultySwapSheetProps) {
  const [query, setQuery] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const {
    target: selectedReview,
    open: openFacultyReview,
    close: closeFacultyReview,
  } = useFacultyReviewSheet();
  const [showTutorial, setShowTutorial] = useState(() => {
    try {
      if (typeof window !== "undefined") {
        return window.localStorage?.getItem("ffcs_dismiss_faculty_guide") !== "true";
      }
    } catch {}
    return true;
  });

  const handleDismissTutorial = () => {
    setShowTutorial(false);
    try {
      if (typeof window !== "undefined") {
        window.localStorage?.setItem("ffcs_dismiss_faculty_guide", "true");
      }
    } catch {}
  };

  const handleRestoreTutorial = () => {
    setShowTutorial(true);
    try {
      if (typeof window !== "undefined") {
        window.localStorage?.removeItem("ffcs_dismiss_faculty_guide");
      }
    } catch {}
  };

  const allSlots = useMemo(
    () => Array.from(new Set(halves.flatMap((h) => h.slots))),
    [halves]
  );
  const theorySlots = useMemo(
    () => allSlots.filter((s) => !s.toUpperCase().startsWith("L") && s.toUpperCase() !== "NIL"),
    [allSlots]
  );
  const labSlots = useMemo(
    () => allSlots.filter((s) => s.toUpperCase().startsWith("L")),
    [allSlots]
  );
  const isEmbedded = theorySlots.length > 0 && labSlots.length > 0;

  // Other courses in the active timetable (excluding this course) for clash checking
  const otherCourses = useMemo(() => {
    const halfIds = new Set(halves.map((h) => h.id));
    return (allTimetableCourses || []).filter(
      (c) => !halfIds.has(c.id) && c.code !== code
    );
  }, [allTimetableCourses, halves, code]);

  // 1. Drop-In Combined Replacements (Top Priority!)
  // Exactly matching all slots together with the same faculty for theory and lab
  const dropInMatches = useMemo(() => {
    if (!isEmbedded) return [];
    return sameSlotFacultyAlternatives(
      code,
      allSlots,
      { faculty: halves[0]?.faculty, employeeId: halves[0]?.employeeId },
      masterCourses
    );
  }, [code, allSlots, halves, masterCourses, isEmbedded]);

  // 2. All offerings for this course code from masterCourses (preserving embedded pairings)
  const allOfferings = useMemo(() => {
    return allCourseOfferings(code, masterCourses);
  }, [code, masterCourses]);

  const expandedHalves = useMemo(() => expandCourseHalves(halves), [halves]);

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

  // 3. Other available faculties (not drop-ins, and not current offering) with clash checking
  const otherOfferings = useMemo(() => {
    const dropInKeys = new Set(
      dropInMatches.map(
        (o) => `${o.FACULTY.toLowerCase()}|${splitSlots(o.SLOT).sort().join("+")}`
      )
    );
    const currentExactSlot = allSlots.slice().sort().join("+");

    const blockKeys = new Set(
      allBlocks.flatMap((b) =>
        b.allMatches.map((m) => `${m.FACULTY.toLowerCase()}|${splitSlots(m.SLOT).sort().join("+")}`)
      )
    );

    return allOfferings
      .filter((off) => {
        const offSlots = splitSlots(off.SLOT);
        const offSlotExact = offSlots.slice().sort().join("+");
        const offFacNorm = (off.FACULTY || "").toLowerCase();

        // Exclude exact drop-ins (they are shown first in their own dedicated section)
        if (dropInKeys.has(`${offFacNorm}|${offSlotExact}`)) return false;

        // Exclude offerings that match the current exact slot
        if (offSlotExact === currentExactSlot) return false;

        // If course is embedded, only show grouped combined offerings (both theory and lab).
        // Individual half-slots of faculties must not occupy the slot list.
        const offTheory = offSlots.filter((s) => !s.startsWith("L") && s !== "NIL");
        const offLab = offSlots.filter((s) => s.startsWith("L"));
        const offIsEmbedded = offTheory.length > 0 && offLab.length > 0;
        if (isEmbedded && !offIsEmbedded) return false;

        // For non-embedded courses, exclude if already matched in same-slot component blocks
        if (!isEmbedded) {
          if (blockKeys.has(`${offFacNorm}|${offSlotExact}`)) return false;

          if (
            allBlocks.some(
              (b) =>
                b.allMatches.some((m) => m.FACULTY.toLowerCase() === offFacNorm) &&
                b.half.slots.every((s) => offSlots.includes(s))
            )
          ) {
            return false;
          }
        }

        return true;
      })
      .map((off) => {
        const offSlots = splitSlots(off.SLOT);
        const offTheory = offSlots.filter((s) => !s.startsWith("L") && s !== "NIL");
        const offLab = offSlots.filter((s) => s.startsWith("L"));
        const offIsEmbedded = offTheory.length > 0 && offLab.length > 0;
        const clashInfo = checkOfferingClash(offSlots, otherCourses, blockedSlots);
        return {
          offering: off,
          slots: offSlots,
          theorySlots: offTheory,
          labSlots: offLab,
          isEmbedded: offIsEmbedded,
          clashes: clashInfo.clashes,
          clashReason: clashInfo.reason,
        };
      })
      .sort((a, b) => {
        // Clash-free offerings first, then clashing offerings
        if (a.clashes !== b.clashes) return a.clashes ? 1 : -1;
        return a.offering.FACULTY.localeCompare(b.offering.FACULTY);
      });
  }, [allOfferings, dropInMatches, allSlots, allBlocks, isEmbedded, otherCourses, blockedSlots]);

  const filteredDropIns = useMemo(
    () =>
      dropInMatches.filter((o) =>
        query ? o.FACULTY.toLowerCase().includes(query.toLowerCase()) : true
      ),
    [dropInMatches, query]
  );

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

  const filteredOtherOfferings = useMemo(
    () =>
      otherOfferings.filter((item) =>
        query ? item.offering.FACULTY.toLowerCase().includes(query.toLowerCase()) : true
      ),
    [otherOfferings, query]
  );

  const totalMatches =
    filteredDropIns.length +
    (!isEmbedded ? blocks.reduce((n, b) => n + b.matches.length, 0) : 0) +
    filteredOtherOfferings.length;

  const handleDownloadJpeg = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    let container: HTMLElement | null = null;
    try {
      // Lazy: the sheet ships in the planner bundle, html-to-image only needs
      // to exist once someone actually asks for the JPEG.
      const toJpegFn = (await import("html-to-image"))?.toJpeg;
      if (typeof toJpegFn !== "function") {
        throw new Error("htmlToImage is not available");
      }
      container = document.createElement("div");
      container.style.position = "fixed";
      container.style.left = "-9999px";
      container.style.top = "0";
      container.style.zIndex = "-1000";
      container.innerHTML = generateFacultyGuideHtml(
        code,
        courseTitle,
        expandedHalves,
        allBlocks,
        dropInMatches,
        isEmbedded,
        otherOfferings
      );
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
      avoidKeyboard={true}
      contentClassName="flex flex-col gap-3 !pb-0"
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
        <div className="flex items-center gap-2 shrink-0">
          {!showTutorial && (
            <button
              type="button"
              onClick={handleRestoreTutorial}
              title="Show registration strategy guide"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 active:bg-amber-500/30 text-amber-500 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Guide</span>
            </button>
          )}
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
      </div>

      {downloadError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Guide: How to pick it out in FFCS (Dismissible tutorial) */}
      {showTutorial && (
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs flex flex-col gap-1.5 transition-all">
          <div className="flex items-center justify-between gap-1.5 font-bold text-amber-500 text-xs">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>How to Pick It Out in FFCS:</span>
            </div>
            <button
              type="button"
              onClick={handleDismissTutorial}
              aria-label="Dismiss guide"
              title="Dismiss guide"
              className="p-1 -mr-1 -my-1 rounded-md text-amber-500/70 hover:text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ol className="list-decimal list-inside text-muted-foreground space-y-1 text-[11px] leading-relaxed pl-0.5">
            <li>Search course code <strong className="text-text-heading">{code}</strong> in VTOP Course Registration.</li>
            <li>Look for slot row <strong className="text-text-heading">{halves.map((h) => h.slots.join("+")).join(" & ")}</strong>.</li>
            <li>Target your primary faculty, or if seats fill up, pick any backup faculty listed below.</li>
            <li>Since all listed faculties share the exact same slot, your timetable remains 100% clash-free!</li>
          </ol>
        </div>
      )}

      {/* Unstick faculty list: fully scrollable with upper info */}
      <div className="flex flex-col gap-3 pb-2">
        {/* SECTION 1: Drop-In Combined Replacements (Shown First & Prioritized!) */}
        {isEmbedded && (filteredDropIns.length > 0 || !query) && (
          <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border border-blue-500/25 rounded-2xl p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[11px] font-bold tracking-wide uppercase">
                  <Sparkles className="w-3 h-3 text-blue-400" /> Drop-In Combined Replacements
                </span>
                <span className="text-xs text-muted-foreground font-medium">
                  (Same Theory + Lab Slots · Zero Clash Risk)
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {allSlots.map((s) => (
                  <span
                    key={s}
                    className="bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[10px] font-semibold px-1.5 py-0.5 rounded-md"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {filteredDropIns.length > 0 ? (
              <div className="flex flex-col gap-1 mt-1">
                {filteredDropIns.map((off) => (
                  <button
                    key={offeringId(off)}
                    type="button"
                    onClick={() => {
                      if (onSwap) {
                        onSwap(halves[0].id, off);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 my-0.5 rounded-xl transition-colors border border-blue-500/25 bg-blue-500/5 ${
                      onSwap
                        ? "hover:bg-blue-500/15 cursor-pointer"
                        : "cursor-default"
                    } text-left group`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FacultyAvatar
                        employeeId={off.ERP_ID}
                        name={off.FACULTY}
                        size="xs"
                        tone="blue"
                      />
                      <span className="font-bold text-sm text-text-heading truncate">
                        {off.FACULTY}
                      </span>
                      <span className="text-[10px] text-blue-400 font-bold px-1.5 py-0.2 rounded bg-blue-500/20 border border-blue-500/30 shrink-0">
                        Full Drop-In
                      </span>
                      <VitfacReviewPill
                        employeeId={off.ERP_ID}
                        name={off.FACULTY}
                        onClick={(e) => {
                          e.stopPropagation();
                          openFacultyReview({ name: off.FACULTY, employeeId: off.ERP_ID });
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 font-medium">
                      {off.ROOM || (off.ERP_ID ? `ERP ${off.ERP_ID}` : "TBA")}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground italic py-1 px-1">
                No single faculty takes both your exact theory ({theorySlots.join("+")}) and lab ({labSlots.join("+")}) slots together. See options below.
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: Same-Slot Faculty Alternatives (Only for pure non-embedded courses; embedded courses use drop-ins and grouped offerings) */}
        {!isEmbedded && (
          <div className="flex flex-col gap-1.5">
            {blocks.map(({ half, matches }, i) => (
              <div
                key={half.id}
                className={`flex flex-col gap-1.5 px-2 py-2 ${
                  i > 0 ? "border-t border-border-strong/40 mt-1" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    {half.type && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {half.type}
                      </span>
                    )}
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
                        openFacultyReview({ name: half.faculty, employeeId: half.employeeId });
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
                            openFacultyReview({ name: off.FACULTY, employeeId: off.ERP_ID });
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {off.ROOM || (off.ERP_ID ? `ERP ${off.ERP_ID}` : "TBA")}
                      </span>
                    </button>
                  ))}
                  {matches.length === 0 && !query && (
                    <div className="text-xs text-muted-foreground/70 italic px-2 py-2">
                      No other faculty at this time slot
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* SECTION 3: All Other Available Faculties for this Subject (with Clash Prevention) */}
        {filteredOtherOfferings.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-border-strong/40">
            <div className="flex items-center justify-between gap-2 px-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span>
                  {isEmbedded
                    ? `Other Available Offerings for ${code} (Other Slots)`
                    : `Other Available Faculties for ${code}`}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">
                {isEmbedded ? "(Grouped Theory + Lab · Clash checked)" : "(Clash checked)"}
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {filteredOtherOfferings.map(
                ({ offering: off, slots: offSlots, theorySlots: offTheory, labSlots: offLab, isEmbedded: offIsEmbedded, clashes, clashReason }) => (
                  <button
                    key={offeringId(off)}
                    type="button"
                    disabled={clashes || !onSwap}
                    onClick={() => {
                      if (onSwap && !clashes) {
                        onSwap(halves[0].id, off);
                      }
                    }}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 my-0.5 rounded-xl transition-all border ${
                      clashes
                        ? "opacity-25 bg-black/60 dark:bg-black/80 border-zinc-800/40 dark:border-zinc-900/60 cursor-not-allowed select-none saturate-0"
                        : onSwap
                        ? "hover:bg-surface-secondary/80 border-border/40 hover:border-amber-500/30 cursor-pointer bg-surface-secondary/20 shadow-xs"
                        : "border-transparent cursor-default"
                    } text-left group`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FacultyAvatar
                        employeeId={off.ERP_ID}
                        name={off.FACULTY}
                        size="xs"
                        tone={clashes ? "zinc" : "blue"}
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`text-sm truncate ${
                              clashes
                                ? "text-zinc-500 dark:text-zinc-500 font-medium"
                                : "text-text-heading font-bold"
                            }`}
                          >
                            {off.FACULTY}
                          </span>
                          {(offIsEmbedded || isEmbedded) && (
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                                clashes
                                  ? "bg-zinc-800/40 text-zinc-600 border-zinc-700/30"
                                  : "bg-blue-500/15 text-blue-400 border-blue-500/30"
                              }`}
                            >
                              Embedded
                            </span>
                          )}
                          <VitfacReviewPill
                            employeeId={off.ERP_ID}
                            name={off.FACULTY}
                            onClick={(e) => {
                              e.stopPropagation();
                              openFacultyReview({ name: off.FACULTY, employeeId: off.ERP_ID });
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {offTheory && offTheory.length > 0 && offLab && offLab.length > 0 ? (
                            <>
                              <span className={`text-[10px] font-semibold ${clashes ? "text-zinc-600" : "text-amber-400/90"}`}>
                                TH: {offTheory.join("+")}
                              </span>
                              <span className="text-[10px] text-muted-foreground/30">•</span>
                              <span className={`text-[10px] font-semibold ${clashes ? "text-zinc-600" : "text-sky-600 dark:text-sky-400"}`}>
                                LAB: {offLab.join("+")}
                              </span>
                            </>
                          ) : (
                            <span className={`text-[10px] font-medium ${clashes ? "text-zinc-600" : "text-muted-foreground"}`}>
                              {offSlots.join("+")}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground/30">•</span>
                          <span className={`text-[10px] ${clashes ? "text-zinc-600" : "text-muted-foreground"}`}>
                            {off.ROOM || "TBA"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      {clashes ? (
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-red-950/50 text-red-400/60 border border-red-900/30 max-w-[160px] truncate"
                          title={clashReason}
                        >
                          ⚠️ Clash
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          ✓ No Clash
                        </span>
                      )}
                    </div>
                  </button>
                )
              )}
            </div>
          </div>
        )}

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

      {/* Sticky Bottom Search Box (Mobile-friendly thumb zone) */}
      <div className="sticky bottom-0 -mx-4 sm:-mx-5 px-4 sm:px-5 py-2.5 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-border-strong/40 z-20 shadow-[0_-8px_16px_-4px_rgba(0,0,0,0.06)] dark:shadow-[0_-8px_20px_-4px_rgba(0,0,0,0.4)] mt-auto">
        <SearchInput
          placeholder="Search by faculty name..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-surface-secondary/50 border-border-strong pl-10 pr-4 py-2.5 focus:border-amber-500/50 placeholder:text-muted-foreground w-full"
        />
      </div>
    </BottomSheet>

    <FacultyReviewSheetHost
      target={selectedReview ? { ...selectedReview, courseCode: code } : null}
      onClose={closeFacultyReview}
    />
    </>
  );
}
