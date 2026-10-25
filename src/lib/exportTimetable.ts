import * as htmlToImage from "html-to-image";
import { jsPDF } from "jspdf";
import type { AddedCourse, TimetablePeriod, ParsedCourse } from "@/components/custom/exams/FFCS/types";
import { buildVerticalGrid } from "@/components/custom/timetable";
import { COLOR_HEX_MAP, typeLabels } from "@/components/custom/exams/FFCS/constants";
import { getFacultyReview, getVitfacProfileUrl, loadVitfacCatalog, normalizeFacultyName, type VitfacFaculty } from "./vitfacService";
import { ensureLunchPeriod, hasSlot } from "./slots";
import { sameSlotFacultyAlternatives, expandCourseHalves } from "@/components/custom/exams/FFCS/logic/generate";

export { createPortraitDossierPdf } from "./portraitDossier";

/**
 * Modern Timetable Export Parameters
 */
export interface ModernTimetableExportParams {
  timetableName: string;
  courses: AddedCourse[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  viewMode: "vertical" | "horizontal";
  format?: "jpg" | "png";
  themeBgColor?: string;
  totalCredits?: number;
}

/**
 * Build Vertical Heatmap HTML Table for Export
 */
function renderVerticalGridHtml(
  courses: AddedCourse[],
  theoryPeriods: TimetablePeriod[],
  labPeriods: TimetablePeriod[],
  daysList: { id: string; name: string }[],
  isLight = false
): string {
  const vGrid = buildVerticalGrid({
    courses,
    theoryPeriods,
    labPeriods,
    days: daysList,
  });

  const borderColor = isLight ? "#cbd5e1" : "rgba(255,255,255,0.08)";
  const cellBorderColor = isLight ? "#e2e8f0" : "rgba(255,255,255,0.06)";
  const thBg = isLight ? "#f1f5f9" : "rgba(30, 41, 59, 0.7)";
  const thColor = isLight ? "#1e293b" : "#93c5fd";
  const timeColBg = isLight ? "#f8fafc" : "rgba(15, 23, 42, 0.6)";
  const timeStartColor = isLight ? "#0f172a" : "#f1f5f9";
  const timeEndColor = isLight ? "#64748b" : "#64748b";
  const lunchBg = isLight ? "rgba(245, 158, 11, 0.14)" : "rgba(245, 158, 11, 0.12)";
  const lunchBorder = isLight ? "rgba(245, 158, 11, 0.45)" : "rgba(245, 158, 11, 0.3)";
  const lunchText = isLight ? "#b45309" : "#fbbf24";
  const emptyCellBg = isLight ? "#ffffff" : "rgba(15, 23, 42, 0.3)";
  const emptyBorder = isLight ? "1px dashed #cbd5e1" : "1px dashed rgba(255,255,255,0.04)";
  const emptyDash = isLight ? "#94a3b8" : "#334155";
  const slotPillBg = isLight ? "rgba(0,0,0,0.07)" : "rgba(0,0,0,0.35)";
  const slotPillColor = isLight ? "#334155" : "#cbd5e1";
  const titleColor = isLight ? "#0f172a" : "#f8fafc";
  const metaBorder = isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.08)";
  const venueColor = isLight ? "#475569" : "#cbd5e1";
  const facColor = isLight ? "#64748b" : "#94a3b8";
  const wrapperBg = isLight ? "#ffffff" : "#0c1222";
  const wrapperBorder = isLight ? "#cbd5e1" : "rgba(255,255,255,0.1)";

  const headerCells = daysList
    .map(
      (d) => `
    <th style="padding: 10px 8px; font-size: 12px; font-weight: 800; color: ${thColor}; background: ${thBg}; border: 1px solid ${borderColor}; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
      ${escapeHtml(d.name.slice(0, 3).toUpperCase())}
    </th>
  `
    )
    .join("");

  const rowsHtml = vGrid.bands
    .map((band) => {
      if (band.isLunch) {
        return `
        <tr style="height: 34px;">
          <td colspan="${daysList.length + 1}" style="background: ${lunchBg}; border: 1px dashed ${lunchBorder}; text-align: center; color: ${lunchText}; font-size: 11px; font-weight: 800; letter-spacing: 1px; border-radius: 6px;">
            🍽️ LUNCH BREAK · 1:20 PM – 2:00 PM
          </td>
        </tr>
      `;
      }

      const timeCol = `
      <td style="padding: 6px 10px; font-size: 11px; font-weight: 700; color: ${timeEndColor}; border: 1px solid ${cellBorderColor}; background: ${timeColBg}; white-space: nowrap; vertical-align: top; text-align: center; width: 110px;">
        <span style="color: ${timeStartColor}; display: block; font-size: 11px;">${escapeHtml(band.start)}</span>
        <span style="color: ${timeEndColor}; font-size: 10px;">${escapeHtml(band.end)}</span>
      </td>
    `;

      const dayCells = daysList
        .map((day) => {
          const cell = vGrid.cells[day.id]?.[band.index];
          if (cell === null) {
            // Covered by previous rowSpan
            return "";
          }
          if (cell && cell.kind === "course" && cell.course) {
            const c = cell.course;
            const colorHex = COLOR_HEX_MAP[c.color] || "#2563eb";
            const rowSpan = (cell as any).run?.bands?.length || 1;
            const slotText = cell.slots.join("+");
            const boxBg = isLight ? `${colorHex}18` : `${colorHex}26`;
            const boxBorder = isLight ? `${colorHex}77` : `${colorHex}88`;
            return `
          <td rowspan="${rowSpan}" style="padding: 4px; border: 1px solid ${cellBorderColor}; vertical-align: top; width: calc((100% - 110px) / ${daysList.length});">
            <div style="background: ${boxBg}; border: 1px solid ${boxBorder}; border-left: 4px solid ${colorHex}; border-radius: 6px; padding: 6px 8px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 3px;">
                  <span style="background: ${colorHex}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 2px 5px; border-radius: 4px; letter-spacing: 0.3px;">
                    ${escapeHtml(c.code)}
                  </span>
                  <span style="font-size: 10px; font-weight: 700; color: ${slotPillColor}; background: ${slotPillBg}; padding: 1px 5px; border-radius: 4px;">
                    ${escapeHtml(slotText)}
                  </span>
                </div>
                <div style="font-size: 11px; font-weight: 600; color: ${titleColor}; line-height: 1.25; margin-bottom: 4px;">
                  ${escapeHtml(c.title)}
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: ${facColor}; border-top: 1px solid ${metaBorder}; padding-top: 3px; margin-top: 3px;">
                <span style="font-weight: 600; color: ${venueColor};">${escapeHtml(c.venue || "TBA")}</span>
                <span style="max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.faculty?.split("/")[0]?.trim() || "")}</span>
              </div>
            </div>
          </td>
        `;
          }
          return `
        <td style="padding: 4px; border: 1px solid ${cellBorderColor}; background: ${emptyCellBg}; vertical-align: top; width: calc((100% - 110px) / ${daysList.length});">
          <div style="height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; border: ${emptyBorder};">
            <span style="color: ${emptyDash}; font-size: 10px;">—</span>
          </div>
        </td>
      `;
        })
        .join("");

      return `
      <tr>
        ${timeCol}
        ${dayCells}
      </tr>
    `;
    })
    .join("");

  return `
    <div style="overflow: hidden; border-radius: 12px; border: 1px solid ${wrapperBorder}; background: ${wrapperBg}; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr>
            <th style="padding: 10px 8px; font-size: 12px; font-weight: 800; color: ${thColor}; background: ${thBg}; border: 1px solid ${borderColor}; text-align: center; width: 110px;">
              TIME
            </th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Build Horizontal Schedule Grid HTML Table for Export
 */
function renderHorizontalGridHtml(
  courses: AddedCourse[],
  theoryPeriods: TimetablePeriod[],
  labPeriods: TimetablePeriod[],
  daysList: { id: string; name: string }[],
  isLight = false
): string {
  const effectiveTheory = ensureLunchPeriod(theoryPeriods);
  const effectiveLab = ensureLunchPeriod(labPeriods);
  const numPeriods = Math.max(effectiveTheory.length, effectiveLab.length);
  const lunchIdx = effectiveTheory.findIndex((p) => p?.lunch);

  const borderColor = isLight ? "#cbd5e1" : "rgba(255,255,255,0.08)";
  const cellBorderColor = isLight ? "#e2e8f0" : "rgba(255,255,255,0.06)";
  const thBg = isLight ? "#f1f5f9" : "rgba(30, 41, 59, 0.7)";
  const thColor = isLight ? "#1e293b" : "#93c5fd";
  const thSubColor = isLight ? "#64748b" : "#cbd5e1";
  const lunchThBg = isLight ? "rgba(245, 158, 11, 0.16)" : "rgba(245, 158, 11, 0.2)";
  const lunchThBorder = isLight ? "rgba(245, 158, 11, 0.45)" : "rgba(245, 158, 11, 0.35)";
  const lunchText = isLight ? "#b45309" : "#fbbf24";
  const lunchSubText = isLight ? "#92400e" : "#fde68a";
  const lunchColBg = isLight ? "rgba(245, 158, 11, 0.14)" : "rgba(245, 158, 11, 0.15)";
  const lunchColBorder = isLight ? "rgba(245, 158, 11, 0.4)" : "rgba(245, 158, 11, 0.35)";
  const lunchDivider = isLight ? "rgba(245, 158, 11, 0.5)" : "rgba(245, 158, 11, 0.5)";
  const cellBg = isLight ? "#ffffff" : "rgba(15, 23, 42, 0.4)";
  const emptyBorder = isLight ? "1px dashed #cbd5e1" : "1px dashed rgba(255,255,255,0.05)";
  const emptyText = isLight ? "#64748b" : "#475569";
  const slotPillBg = isLight ? "rgba(0,0,0,0.07)" : "rgba(0,0,0,0.3)";
  const slotPillColor = isLight ? "#334155" : "#cbd5e1";
  const venueColor = isLight ? "#475569" : "#94a3b8";
  const dayThBg = isLight ? "#f1f5f9" : "rgba(30, 41, 59, 0.7)";
  const dayThColor = isLight ? "#0f172a" : "#f8fafc";
  const wrapperBg = isLight ? "#ffffff" : "#0c1222";
  const wrapperBorder = isLight ? "#cbd5e1" : "rgba(255,255,255,0.1)";

  const thHeaders: string[] = [];
  for (let i = 0; i < numPeriods; i++) {
    const tp = effectiveTheory[i];
    if (tp?.lunch) {
      thHeaders.push(`
        <th class="lunch-column lunch-header" style="padding: 6px 2px; background: ${lunchThBg}; border-left: 1px solid ${lunchThBorder}; border-right: 1px solid ${lunchThBorder}; border-top: 1px solid ${lunchThBorder}; border-bottom: 1px solid ${lunchThBorder}; text-align: center; width: 36px; min-width: 36px; max-width: 42px; vertical-align: middle;" title="LUNCH (1:20 PM - 2:00 PM)">
          <span style="display: none;">LUNCH</span>
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.1;">
            <span class="lunch-label" style="font-size: 9.5px; font-weight: 900; color: ${lunchText}; letter-spacing: 0.5px;">LUNCH</span>
            <span class="lunch-time" style="font-size: 7.5px; font-weight: 700; color: ${lunchSubText}; opacity: 0.9; margin-top: 2px;">1:20-2:00</span>
          </div>
        </th>
      `);
    } else {
      let pNum: number;
      if (lunchIdx !== -1 && i > lunchIdx) {
        pNum = 6 + (i - (lunchIdx + 1));
      } else {
        pNum = Math.min(i + 1, 5);
      }
      thHeaders.push(`
        <th style="padding: 6px 4px; font-size: 10px; font-weight: 700; color: ${thColor}; background: ${thBg}; border: 1px solid ${borderColor}; text-align: center; min-width: 95px;">
          P${pNum} <span style="font-weight: 400; color: ${thSubColor}; font-size: 9px;">(${escapeHtml(tp?.start || "")})</span>
        </th>
      `);
    }
  }

  const dayRowsHtml = daysList
    .map((day, dayIdx) => {
      const periodCells: string[] = [];
      for (let i = 0; i < numPeriods; i++) {
        const tp = effectiveTheory[i];
        const lp = effectiveLab[i];
        if (tp?.lunch) {
          if (dayIdx === 0) {
            periodCells.push(`
            <td class="lunch-column lunch-cell" rowspan="${daysList.length}" style="width: 36px; min-width: 36px; max-width: 42px; background: ${lunchColBg}; border-left: 1px solid ${lunchColBorder}; border-right: 1px solid ${lunchColBorder}; border-top: 1px solid ${lunchColBorder}; border-bottom: 1px solid ${lunchColBorder}; text-align: center; vertical-align: middle; padding: 6px 2px;">
              <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
                <span style="font-size: 12px; font-weight: 900; color: ${lunchText}; letter-spacing: 1px; line-height: 1.25;">L</span>
                <span style="font-size: 12px; font-weight: 900; color: ${lunchText}; letter-spacing: 1px; line-height: 1.25;">U</span>
                <span style="font-size: 12px; font-weight: 900; color: ${lunchText}; letter-spacing: 1px; line-height: 1.25;">N</span>
                <span style="font-size: 12px; font-weight: 900; color: ${lunchText}; letter-spacing: 1px; line-height: 1.25;">C</span>
                <span style="font-size: 12px; font-weight: 900; color: ${lunchText}; letter-spacing: 1px; line-height: 1.25;">H</span>
                <div style="width: 14px; height: 1px; background: ${lunchDivider}; margin: 6px 0;"></div>
                <span style="font-size: 8px; font-weight: 900; color: ${lunchSubText}; line-height: 1.1;">1:20</span>
                <span style="font-size: 7px; color: ${isLight ? '#b45309' : '#d97706'}; line-height: 1;">-</span>
                <span style="font-size: 8px; font-weight: 900; color: ${lunchSubText}; line-height: 1.1;">2:00</span>
              </div>
            </td>
          `);
          }
        } else {
          const theorySlot = tp?.days?.[day.id];
          const labSlot = lp?.days?.[day.id];

          const tCourse = theorySlot ? courses.find((c) => hasSlot(c.slots, theorySlot)) : null;
          const lCourse = labSlot ? courses.find((c) => hasSlot(c.slots, labSlot)) : null;

          const renderHalf = (slotName?: string, course?: AddedCourse | null) => {
            if (!slotName) return `<div style="height: 28px;"></div>`;
            if (course) {
              const colorHex = COLOR_HEX_MAP[course.color] || "#2563eb";
              const boxBg = isLight ? `${colorHex}18` : `${colorHex}33`;
              const boxBorder = isLight ? `${colorHex}77` : `${colorHex}88`;
              const codeColor = isLight ? "#0f172a" : "#ffffff";
              return `
              <div style="background: ${boxBg}; border: 1px solid ${boxBorder}; border-radius: 4px; padding: 3px 5px; margin: 2px 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 2px;">
                  <span style="font-size: 10px; font-weight: 800; color: ${codeColor};">${escapeHtml(course.code)}</span>
                  <span style="font-size: 8px; font-weight: 700; color: ${slotPillColor}; background: ${slotPillBg}; padding: 0 3px; border-radius: 2px;">${escapeHtml(slotName)}</span>
                </div>
                <div style="font-size: 8px; color: ${venueColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(course.venue || "TBA")}</div>
              </div>
            `;
            }
            return `
            <div style="display: flex; align-items: center; justify-content: center; height: 26px; border: ${emptyBorder}; border-radius: 4px; margin: 2px 0;">
              <span style="font-size: 9px; color: ${emptyText}; font-weight: 600;">${escapeHtml(slotName)}</span>
            </div>
          `;
          };

          periodCells.push(`
          <td style="padding: 4px; border: 1px solid ${cellBorderColor}; background: ${cellBg}; vertical-align: top;">
            ${renderHalf(theorySlot, tCourse)}
            ${renderHalf(labSlot, lCourse)}
          </td>
        `);
        }
      }

      return `
      <tr>
        <td style="padding: 8px 6px; font-size: 11px; font-weight: 800; color: ${dayThColor}; background: ${dayThBg}; border: 1px solid ${borderColor}; text-align: center; text-transform: uppercase;">
          ${escapeHtml(day.name.slice(0, 3))}
        </td>
        ${periodCells.join("")}
      </tr>
    `;
    })
    .join("");

  return `
    <div class="pdf-timetable-grid" style="overflow-x: auto; border-radius: 12px; border: 1px solid ${wrapperBorder}; background: ${wrapperBg}; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr>
            <th style="padding: 8px 6px; font-size: 11px; font-weight: 800; color: ${thSubColor}; background: ${thBg}; border: 1px solid ${borderColor}; text-align: center; width: 65px;">
              DAY
            </th>
            ${thHeaders.join("")}
          </tr>
        </thead>
        <tbody>
          ${dayRowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Build Selected Courses Reference Table HTML with Faculty Reviews
 */
function renderCourseTableHtml(
  groupedCourses: (AddedCourse & { ids: string[]; batches: string[] })[],
  isLight = false
): string {
  const containerBg = isLight ? "#ffffff" : "rgba(15, 23, 42, 0.85)";
  const containerBorder = isLight ? "#cbd5e1" : "rgba(255, 255, 255, 0.1)";
  const headerBorder = isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const titleColor = isLight ? "#0f172a" : "#ffffff";
  const subColor = isLight ? "#64748b" : "#94a3b8";
  const thRowBorder = isLight ? "#cbd5e1" : "rgba(255,255,255,0.1)";
  const thTextColor = isLight ? "#475569" : "#94a3b8";
  const rowBorder = isLight ? "#e2e8f0" : "rgba(255,255,255,0.06)";
  const rowEvenBg = isLight ? "#ffffff" : "rgba(15, 23, 42, 0.4)";
  const rowOddBg = isLight ? "#f8fafc" : "rgba(15, 23, 42, 0.2)";
  const courseTitleColor = isLight ? "#0f172a" : "#ffffff";
  const batchColor = isLight ? "#0284c7" : "#38bdf8";
  const typeColor = isLight ? "#2563eb" : "#93c5fd";
  const creditsColor = isLight ? "#0f172a" : "#f8fafc";
  const slotBg = isLight ? "#f1f5f9" : "rgba(30, 41, 59, 0.8)";
  const slotBorder = isLight ? "#cbd5e1" : "rgba(255,255,255,0.1)";
  const slotColor = isLight ? "#334155" : "#cbd5e1";
  const venueColor = isLight ? "#475569" : "#cbd5e1";
  const facNameColor = isLight ? "#0f172a" : "#f1f5f9";
  const unreviewedBg = isLight ? "#f1f5f9" : "rgba(255,255,255,0.04)";
  const unreviewedBorder = isLight ? "#cbd5e1" : "rgba(255,255,255,0.08)";
  const unreviewedText = isLight ? "#64748b" : "#64748b";
  const metricsTextColor = isLight ? "#64748b" : "#94a3b8";

  const rows = groupedCourses
    .map((c, idx) => {
      const colorHex = COLOR_HEX_MAP[c.color] || "#2563eb";
      const typeLabel = typeLabels[c.type] || c.type || "Theory";

      const facultyNames = c.faculty ? c.faculty.split(/\s*\/\s*/).filter(Boolean) : ["TBA"];
      const facultyReviewsHtml = facultyNames
        .map((fac) => {
          const rev = getFacultyReview({ employeeId: (c as any).employeeId, name: fac });
          let badgeHtml = "";
          if (rev && rev.reviews > 0) {
            const isGreen = rev.wPct >= 70;
            const isAmber = rev.wPct >= 40 && rev.wPct < 70;
            const bg = isGreen
              ? "rgba(16,185,129,0.18)"
              : isAmber
              ? "rgba(245,158,11,0.18)"
              : "rgba(239,68,68,0.18)";
            const border = isGreen
              ? "rgba(16,185,129,0.35)"
              : isAmber
              ? "rgba(245,158,11,0.35)"
              : "rgba(239,68,68,0.35)";
            const text = isGreen ? (isLight ? "#059669" : "#34d399") : isAmber ? (isLight ? "#b45309" : "#fbbf24") : (isLight ? "#dc2626" : "#f87171");
            const metricsStr = rev.metrics
              ? `<span style="font-size: 10px; color: ${metricsTextColor}; margin-left: 6px;">Vibe: ${rev.metrics.vibe.toFixed(1)} · DA: ${rev.metrics.da.toFixed(1)}</span>`
              : "";
            badgeHtml = `
            <div style="display: inline-flex; align-items: center; margin-top: 2px;">
              <span style="background: ${bg}; border: 1px solid ${border}; color: ${text}; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">
                ★ ${rev.wPct}% W (${rev.reviews})
              </span>
              ${metricsStr}
            </div>
          `;
          } else {
            badgeHtml = `
            <span style="background: ${unreviewedBg}; border: 1px solid ${unreviewedBorder}; color: ${unreviewedText}; font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 4px; margin-top: 2px; display: inline-block;">
              Unreviewed
            </span>
          `;
          }
          return `
          <div style="margin-bottom: 4px;">
            <div style="font-weight: 700; color: ${facNameColor}; font-size: 12px;">${escapeHtml(fac)}</div>
            ${badgeHtml}
          </div>
        `;
        })
        .join("");

      const slotPills = c.slots
        .map(
          (s) =>
            `<span style="background: ${slotBg}; border: 1px solid ${slotBorder}; color: ${slotColor}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-right: 3px; display: inline-block;">${escapeHtml(s)}</span>`
        )
        .join("");

      return `
      <tr style="border-bottom: 1px solid ${rowBorder}; background: ${
        idx % 2 === 0 ? rowEvenBg : rowOddBg
      };">
        <td style="padding: 10px 8px; font-size: 12px; font-weight: 700; color: #64748b; text-align: center; vertical-align: middle;">
          ${idx + 1}
        </td>
        <td class="pdf-course-cell" style="padding: 10px 12px; vertical-align: middle;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="pdf-course-code" style="background: ${colorHex}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 7px; border-radius: 5px; letter-spacing: 0.5px;">
              ${escapeHtml(c.code)}
            </span>
            <div>
              <div class="pdf-course-title" style="font-weight: 700; color: ${courseTitleColor}; font-size: 12px;">${escapeHtml(c.title)}</div>
              ${
                c.batches && c.batches.length > 0
                  ? `<div style="font-size: 10px; color: ${batchColor}; font-weight: 600;">Batch: ${escapeHtml(
                      c.batches.join(", ")
                    )}</div>`
                  : ""
              }
            </div>
          </div>
        </td>
        <td style="padding: 10px 8px; font-size: 11px; color: ${typeColor}; font-weight: 600; vertical-align: middle;">
          ${escapeHtml(typeLabel)}
        </td>
        <td style="padding: 10px 8px; font-size: 12px; font-weight: 800; color: ${creditsColor}; text-align: center; vertical-align: middle;">
          ${escapeHtml(c.credits || "0")}
        </td>
        <td style="padding: 10px 8px; vertical-align: middle;">
          ${slotPills}
        </td>
        <td style="padding: 10px 8px; font-size: 11px; color: ${venueColor}; font-weight: 600; vertical-align: middle;">
          ${escapeHtml(c.venue || "TBA")}
        </td>
        <td style="padding: 10px 12px; vertical-align: middle;">
          ${facultyReviewsHtml}
        </td>
      </tr>
    `;
    })
    .join("");

  return `
    <div class="pdf-course-section" style="background: ${containerBg}; border: 1px solid ${containerBorder}; border-radius: 14px; padding: 18px 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid ${headerBorder};">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px; font-weight: 800; color: ${titleColor};">📋 ENROLLED COURSES &amp; FACULTY REVIEWS</span>
          <span style="font-size: 11px; color: ${subColor};">(Vitfac Sentiment &amp; Ratings)</span>
        </div>
      </div>
      <table class="pdf-course-table" style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="border-bottom: 1px solid ${thRowBorder}; font-size: 10px; font-weight: 800; color: ${thTextColor}; text-transform: uppercase;">
            <th style="padding: 8px 8px; text-align: center; width: 30px;">#</th>
            <th style="padding: 8px 12px;">Course</th>
            <th style="padding: 8px 8px; width: 130px;">Type</th>
            <th style="padding: 8px 8px; text-align: center; width: 60px;">Credits</th>
            <th style="padding: 8px 8px; width: 140px;">Slots</th>
            <th style="padding: 8px 8px; width: 90px;">Venue</th>
            <th style="padding: 8px 12px;">Faculty &amp; Vitfac Review</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

/**
 * Generate Modern Standalone Timetable HTML Representation for Image Capture
 */
export function generateModernTimetableHtml(params: ModernTimetableExportParams): string {
  const {
    timetableName,
    courses,
    theoryPeriods,
    labPeriods,
    days,
    viewMode,
    totalCredits,
  } = params;

  const defaultDays = [
    { id: "mon", name: "Monday" },
    { id: "tue", name: "Tuesday" },
    { id: "wed", name: "Wednesday" },
    { id: "thu", name: "Thursday" },
    { id: "fri", name: "Friday" },
  ];
  const daysList = days && days.length > 0 ? days : defaultDays;

  // Group courses by code
  const groupedCoursesMap = new Map<string, AddedCourse & { ids: string[]; batches: string[] }>();
  for (const c of courses) {
    if (groupedCoursesMap.has(c.code)) {
      const g = groupedCoursesMap.get(c.code)!;
      g.ids.push(c.id);
      if (!g.faculty.includes(c.faculty)) g.faculty += ` / ${c.faculty}`;
      if (!g.venue.includes(c.venue)) g.venue += ` / ${c.venue}`;
      if (!g.type.includes(c.type)) g.type += ` + ${c.type}`;
      for (const s of c.slots) {
        if (!g.slots.includes(s)) g.slots.push(s);
      }
      if (c.batch) {
        c.batch
          .split(",")
          .map((b) => b.trim())
          .forEach((b) => {
            if (b && !g.batches.includes(b)) g.batches.push(b);
          });
      }
      g.credits = String(parseFloat(g.credits || "0") + parseFloat(c.credits || "0"));
    } else {
      const batches = c.batch ? c.batch.split(",").map((b) => b.trim()).filter(Boolean) : [];
      groupedCoursesMap.set(c.code, {
        ...c,
        ids: [c.id],
        faculty: c.faculty,
        venue: c.venue,
        type: c.type,
        slots: [...c.slots],
        batches,
      });
    }
  }
  const groupedCourses = Array.from(groupedCoursesMap.values());
  const calculatedCredits =
    totalCredits ?? groupedCourses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0);
  const containerWidth = viewMode === "vertical" ? 1280 : 1540;

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const gridHtml =
    viewMode === "vertical"
      ? renderVerticalGridHtml(courses, theoryPeriods, labPeriods, daysList)
      : renderHorizontalGridHtml(courses, theoryPeriods, labPeriods, daysList);

  const tableHtml = renderCourseTableHtml(groupedCourses);

  return `
    <div style="width: ${containerWidth}px; background: #090d16; color: #f8fafc; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; box-sizing: border-box; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
      <!-- Header -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 18px; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; font-size: 10px; font-weight: 900; padding: 3px 8px; border-radius: 6px; letter-spacing: 1px; text-transform: uppercase;">
              AmazeCC FFCS
            </span>
            <span style="font-size: 11px; font-weight: 700; color: #94a3b8;">
              ${viewMode === "vertical" ? "📱 Mobile Vertical Heatmap" : "🖥️ Horizontal University Grid"}
            </span>
          </div>
          <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
            ${escapeHtml(timetableName)}
          </h1>
          <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">
            Exported on ${escapeHtml(dateStr)} • Built for VITians
          </p>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <div style="background: rgba(59, 130, 246, 0.12); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 10px; padding: 8px 14px; text-align: right;">
            <div style="font-size: 10px; font-weight: 700; color: #93c5fd; text-transform: uppercase;">Total Credits</div>
            <div style="font-size: 18px; font-weight: 900; color: #ffffff;">${calculatedCredits}</div>
          </div>
          <div style="background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.3); border-radius: 10px; padding: 8px 14px; text-align: right;">
            <div style="font-size: 10px; font-weight: 700; color: #c4b5fd; text-transform: uppercase;">Courses</div>
            <div style="font-size: 18px; font-weight: 900; color: #ffffff;">${groupedCourses.length}</div>
          </div>
        </div>
      </div>

      <!-- Schedule Grid (Vertical or Horizontal) -->
      ${gridHtml}

      <!-- Selected Courses Table with Faculty Reviews -->
      ${tableHtml}

      <!-- Footer Note -->
      <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748b;">
        <span>Generated with AmazeCC FFCS Planner • All times reflect official VIT Chennai schema</span>
        <span>Faculty sentiment data powered by Vitfac</span>
      </div>
    </div>
  `;
}

/**
 * Downloads a modern, high-res timetable JPEG/PNG using offscreen container rendering
 */
export async function downloadModernTimetableImage(
  params: ModernTimetableExportParams
): Promise<void> {
  const html = generateModernTimetableHtml(params);
  let container: HTMLElement | null = null;
  try {
    const toImageFn = params.format === "png" ? htmlToImage.toPng : htmlToImage.toJpeg;
    if (typeof toImageFn !== "function") {
      throw new Error("htmlToImage export function is not available");
    }

    container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.zIndex = "-1000";
    container.innerHTML = html;
    document.body.appendChild(container);

    const targetElement = (container.firstElementChild as HTMLElement) || container;
    const format = params.format || "jpg";
    const dataUrl = await toImageFn(targetElement, {
      quality: 0.95,
      backgroundColor: params.themeBgColor || "#090d16",
      pixelRatio: 2,
    });

    if (dataUrl) {
      const link = document.createElement("a");
      const cleanName = params.timetableName.replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `${cleanName}_${params.viewMode.toUpperCase()}_FFCS.${
        format === "jpg" ? "jpeg" : "png"
      }`;
      link.href = dataUrl;
      link.click();
    }
  } finally {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Marks an element as UI chrome — a view switcher, a "swipe to see more" hint —
 * rather than timetable content, so it can be pulled out before a capture.
 *
 * Both export paths serialise the live DOM (`html-to-image` clones it, the
 * printable page takes `innerHTML`), so a control that happens to sit inside
 * the captured subtree would end up baked into a shared PNG. The timetable's
 * view switcher is the first thing to need this.
 */
export const EXPORT_CHROME_ATTR = "data-export-chrome";

/** `innerHTML` of `element` with every chrome subtree removed. */
export function exportableHtml(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll<HTMLElement>(`[${EXPORT_CHROME_ATTR}]`)
    .forEach((el) => el.remove());
  return clone.innerHTML;
}

export async function downloadTimetableImage(
  element: HTMLElement,
  timetableName: string,
  themeBgColor: string,
  format: "jpg" | "png" = "jpg"
): Promise<void> {
  const originalStyle = element.style.cssText;

  const tableContainers = element.querySelectorAll(".overflow-x-auto");
  tableContainers.forEach((container) => {
    container.classList.remove("overflow-x-auto");
  });

  const chrome = Array.from(
    element.querySelectorAll<HTMLElement>(`[${EXPORT_CHROME_ATTR}]`)
  );
  const chromeDisplay = chrome.map((el) => el.style.display);
  chrome.forEach((el) => {
    el.style.display = "none";
  });

  element.classList.add("flex", "flex-col", "w-max", "min-w-full");

  try {
    await new Promise((resolve) => setTimeout(resolve, 150));

    const scrollWidth = element.scrollWidth;
    const scrollHeight = element.scrollHeight;
    const viewportWidth = window.innerWidth;
    const safeWidth = viewportWidth * 0.9;
    const scale = scrollWidth > safeWidth ? safeWidth / scrollWidth : 1;

    const opts = {
      quality: 0.98,
      backgroundColor: themeBgColor,
      pixelRatio: ((1 / scale) * 3),
      width: scrollWidth * scale,
      height: scrollHeight * scale,
      style: {
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: `${scrollWidth}px`,
        height: `${scrollHeight}px`,
        padding: "24px",
        margin: "0",
        maxWidth: "none",
      },
    };

    const dataUrl =
      format === "png"
        ? await htmlToImage.toPng(element, opts)
        : await htmlToImage.toJpeg(element, opts);

    const link = document.createElement("a");
    link.download = `${timetableName.replace(/\s+/g, "_")}_FFCS.${format}`;
    link.href = dataUrl;
    link.click();
  } finally {
    element.style.cssText = originalStyle;
    element.classList.remove("flex", "flex-col", "w-max", "min-w-full");
    tableContainers.forEach((container) => {
      container.classList.add("overflow-x-auto");
    });
    chrome.forEach((el, i) => {
      el.style.display = chromeDisplay[i];
    });
  }
}

function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };
  return str.replace(/[&<>"']/g, (ch) => map[ch]);
}

/**
 * Comprehensive Printable Dossier Parameters
 */
export interface ModernPrintableReportParams {
  timetableName: string;
  courses: AddedCourse[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days?: { id: string; name: string }[];
  viewMode?: "vertical" | "horizontal";
  totalCredits?: number;
  masterCourses?: readonly ParsedCourse[];
  themeHtmlClass?: string;
  themeBgColor?: string;
  themeTextColor?: string;
  autoPrint?: boolean;
  theme?: "light" | "dark";
  pageOrientation?: "portrait" | "landscape";
}

/**
 * Build Detailed Faculty Intelligence & Sentiment Dossier HTML
 */
type FacultyImageMap = ReadonlyMap<string, string>;

function facultyImageLookupKeys(employeeId?: string | null, name?: string | null): string[] {
  const keys: string[] = [];
  if (employeeId?.trim()) keys.push(`id:${employeeId.trim()}`);
  const normalizedName = name ? normalizeFacultyName(name) : "";
  if (normalizedName) keys.push(`name:${normalizedName}`);
  return keys;
}

function findFacultyImage(images: FacultyImageMap | undefined, employeeId?: string | null, name?: string | null): string | undefined {
  for (const key of facultyImageLookupKeys(employeeId, name)) {
    const image = images?.get(key);
    if (image) return image;
  }
  return undefined;
}

function renderDetailedFacultyReviewsDossierHtml(courses: AddedCourse[], isLight = false, facultyImages?: FacultyImageMap): string {
  interface FacEntry {
    name: string;
    employeeId?: string;
    courseCodes: string[];
  }
  const facMap = new Map<string, FacEntry>();

  for (const c of courses) {
    const rawNames = c.faculty
      ? c.faculty
          .split(/\s*\/\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    if (rawNames.length === 0) rawNames.push("TBA");

    const empIds = c.employeeId
      ? c.employeeId
          .split(/\s*\/\s*/)
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    rawNames.forEach((name, i) => {
      const empId = empIds[i] || (empIds.length === 1 ? empIds[0] : undefined);
      const key = `${name.toLowerCase()}|${empId || ""}`;
      if (!facMap.has(key)) {
        facMap.set(key, {
          name,
          employeeId: empId,
          courseCodes: [c.code],
        });
      } else {
        const entry = facMap.get(key)!;
        if (!entry.courseCodes.includes(c.code)) {
          entry.courseCodes.push(c.code);
        }
      }
    });
  }

  const faculties = Array.from(facMap.values());
  if (faculties.length === 0) return "";

  const cardBg = isLight ? "#ffffff" : "rgba(15, 23, 42, 0.88)";
  const cardBorder = isLight ? "#cbd5e1" : "rgba(255,255,255,0.1)";
  const headerBorder = isLight ? "#e2e8f0" : "rgba(255,255,255,0.08)";
  const headingTitleColor = isLight ? "#0f172a" : "#ffffff";
  const headingSubColor = isLight ? "#64748b" : "#94a3b8";
  const instructorBadgeBg = isLight ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.15)";
  const instructorBadgeBorder = isLight ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.3)";
  const instructorBadgeColor = isLight ? "#1d4ed8" : "#93c5fd";
  const subcardBg = isLight ? "#f8fafc" : "rgba(30, 41, 59, 0.5)";
  const subcardBorder = isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const facNameColor = isLight ? "#0f172a" : "#f8fafc";
  const facMetaColor = isLight ? "#475569" : "#94a3b8";
  const unreviewedBg = isLight ? "#f1f5f9" : "rgba(255,255,255,0.05)";
  const unreviewedBorder = isLight ? "#cbd5e1" : "rgba(255,255,255,0.1)";
  const unreviewedColor = isLight ? "#64748b" : "#94a3b8";
  const metricSubcardBg = isLight ? "#ffffff" : "rgba(30, 41, 59, 0.5)";
  const metricSubcardBorder = isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const metricLabelColor = isLight ? "#64748b" : "#94a3b8";
  const linkDivider = isLight ? "#e2e8f0" : "rgba(255,255,255,0.06)";
  const linkColor = isLight ? "#0284c7" : "#38bdf8";

  const cardsHtml = faculties
    .map((f) => {
      const rev = getFacultyReview({ employeeId: f.employeeId, name: f.name });
      const profileUrl = f.employeeId ? getVitfacProfileUrl(f.employeeId) : null;
      const facultyImage = findFacultyImage(facultyImages, f.employeeId, f.name);

      let scoreBadge = "";
      let metricsHtml = "";
      let loreHtml = "";

      if (rev && rev.reviews > 0) {
        const wPct = rev.wPct;
        const isGreen = wPct >= 70;
        const isAmber = wPct >= 40 && wPct < 70;
        const bg = isGreen
          ? "rgba(16, 185, 129, 0.15)"
          : isAmber
          ? "rgba(245, 158, 11, 0.15)"
          : "rgba(239, 68, 68, 0.15)";
        const border = isGreen
          ? "rgba(16, 185, 129, 0.35)"
          : isAmber
          ? "rgba(245, 158, 11, 0.35)"
          : "rgba(239, 68, 68, 0.35)";
        const text = isGreen ? (isLight ? "#059669" : "#34d399") : isAmber ? (isLight ? "#b45309" : "#fbbf24") : (isLight ? "#dc2626" : "#f87171");

        scoreBadge = `
          <div style="background: ${bg}; border: 1px solid ${border}; color: ${text}; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 11.5px; display: inline-flex; align-items: center; gap: 4px;">
            <span>★ ${wPct}% Win Rate</span>
            <span style="opacity: 0.8; font-weight: 600; font-size: 10.5px;">(${rev.reviews} reviews)</span>
          </div>
        `;

        if (rev.metrics) {
          const lecColor = isLight ? "#0284c7" : "#38bdf8";
          const daColor = isLight ? "#7c3aed" : "#a78bfa";
          const vibeColor = isLight ? "#059669" : "#34d399";
          metricsHtml = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin: 10px 0;">
              <div style="background: ${metricSubcardBg}; border: 1px solid ${metricSubcardBorder}; border-radius: 6px; padding: 6px 8px; text-align: center;">
                <div style="font-size: 9px; color: ${metricLabelColor}; font-weight: 700; text-transform: uppercase;">🎓 Teaching</div>
                <div style="font-size: 13px; font-weight: 900; color: ${lecColor};">${rev.metrics.lecture.toFixed(1)}<span style="font-size: 9px; color: #64748b;">/5</span></div>
              </div>
              <div style="background: ${metricSubcardBg}; border: 1px solid ${metricSubcardBorder}; border-radius: 6px; padding: 6px 8px; text-align: center;">
                <div style="font-size: 9px; color: ${metricLabelColor}; font-weight: 700; text-transform: uppercase;">📝 DA Score</div>
                <div style="font-size: 13px; font-weight: 900; color: ${daColor};">${rev.metrics.da.toFixed(1)}<span style="font-size: 9px; color: #64748b;">/5</span></div>
              </div>
              <div style="background: ${metricSubcardBg}; border: 1px solid ${metricSubcardBorder}; border-radius: 6px; padding: 6px 8px; text-align: center;">
                <div style="font-size: 9px; color: ${metricLabelColor}; font-weight: 700; text-transform: uppercase;">✨ Vibe / Leniency</div>
                <div style="font-size: 13px; font-weight: 900; color: ${vibeColor};">${rev.metrics.vibe.toFixed(1)}<span style="font-size: 9px; color: #64748b;">/5</span></div>
              </div>
            </div>
          `;
        }

        const greenTags = (rev.lore?.green || [])
          .slice(0, 3)
          .map(
            (item) => `
          <span style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25); color: ${isLight ? '#059669' : '#34d399'}; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">
            ✓ ${escapeHtml(item.text)}
          </span>
        `
          )
          .join("");

        const redTags = (rev.lore?.red || [])
          .slice(0, 2)
          .map(
            (item) => `
          <span style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.25); color: ${isLight ? '#dc2626' : '#f87171'}; font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">
            ⚠ ${escapeHtml(item.text)}
          </span>
        `
          )
          .join("");

        if (greenTags || redTags) {
          loreHtml = `
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
              ${greenTags}
              ${redTags}
            </div>
          `;
        }
      } else {
        scoreBadge = `
          <span style="background: ${unreviewedBg}; border: 1px solid ${unreviewedBorder}; color: ${unreviewedColor}; padding: 3px 8px; border-radius: 5px; font-size: 11px; font-weight: 600;">
            Unreviewed on Vitfac
          </span>
        `;
      }

      const initials = f.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0]?.toUpperCase() || "")
        .join("");

      return `
        <div style="background: ${subcardBg}; border: 1px solid ${subcardBorder}; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; page-break-inside: avoid; break-inside: avoid;">
          <div>
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 8px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; font-weight: 900; font-size: 13px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: 0 2px 8px rgba(59,130,246,0.3); overflow: hidden;">
                  ${facultyImage ? `<img src="${facultyImage}" alt="${escapeHtml(f.name)}" width="36" height="36" style="width:36px;height:36px;object-fit:cover;border-radius:50%;" />` : escapeHtml(initials || "FAC")}
                </div>
                <div>
                  <h4 style="margin: 0; font-size: 13.5px; font-weight: 800; color: ${facNameColor}; line-height: 1.2;">
                    ${escapeHtml(f.name)}
                  </h4>
                  <div style="font-size: 10.5px; color: ${facMetaColor}; margin-top: 2px;">
                    ${f.employeeId ? `Emp ID: <strong>${escapeHtml(f.employeeId)}</strong> • ` : ""}${escapeHtml(
        f.courseCodes.join(", ")
      )}
                  </div>
                </div>
              </div>
              ${scoreBadge}
            </div>
            ${metricsHtml}
            ${loreHtml}
          </div>
          ${
            profileUrl
              ? `<div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid ${linkDivider}; text-align: right;">
                  <a href="${escapeHtml(
                    profileUrl
                  )}" target="_blank" rel="noopener noreferrer" style="font-size: 10.5px; color: ${linkColor}; text-decoration: none; font-weight: 700;">
                    View Detailed Vitfac Reviews ↗
                  </a>
                </div>`
              : ""
          }
        </div>
      `;
    })
    .join("");

  return `
    <div style="background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 16px; margin-top: 24px; padding: 22px 24px; page-break-inside: avoid; break-inside: avoid;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid ${headerBorder};">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 15px; font-weight: 900; color: ${headingTitleColor};">⭐ FACULTY INTELLIGENCE &amp; SENTIMENT REPORT</span>
          <span style="font-size: 11px; color: ${headingSubColor};">(Vitfac Student Ratings &amp; Metrics)</span>
        </div>
        <div style="font-size: 11px; font-weight: 700; color: ${instructorBadgeColor}; background: ${instructorBadgeBg}; border: 1px solid ${instructorBadgeBorder}; padding: 3px 8px; border-radius: 6px;">
          ${faculties.length} Instructors Evaluated
        </div>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 14px;">
        ${cardsHtml}
      </div>
    </div>
  `;
}

/**
 * Build Emergency Drop-In Slot Replacements Dossier HTML
 */
function renderDropInReplacementsDossierHtml(
  courses: AddedCourse[],
  masterCourses?: readonly ParsedCourse[],
  isLight = false,
  facultyImages?: FacultyImageMap
): string {
  const cardBg = isLight ? "#ffffff" : "rgba(15, 23, 42, 0.88)";
  const cardBorder = isLight ? "#cbd5e1" : "rgba(255, 255, 255, 0.1)";
  const headerBorder = isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const titleColor = isLight ? "#0f172a" : "#ffffff";
  const subColor = isLight ? "#64748b" : "#94a3b8";
  const subcardBg = isLight ? "#f8fafc" : "rgba(30, 41, 59, 0.5)";
  const subcardBorder = isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const courseTitleColor = isLight ? "#0f172a" : "#f8fafc";
  const typeColor = isLight ? "#64748b" : "#94a3b8";
  const slotBadgeBg = isLight ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.15)";
  const slotBadgeBorder = isLight ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.3)";
  const slotBadgeColor = isLight ? "#1d4ed8" : "#93c5fd";
  const currentFacColor = isLight ? "#0f172a" : "#f1f5f9";
  const altRowBg = isLight ? "#ffffff" : "rgba(255,255,255,0.03)";
  const altRowBorder = isLight ? "#e2e8f0" : "rgba(255,255,255,0.06)";
  const altFacColor = isLight ? "#0f172a" : "#f8fafc";
  const altEmpColor = isLight ? "#64748b" : "#94a3b8";
  const altVenueColor = isLight ? "#0284c7" : "#38bdf8";

  if (!masterCourses || masterCourses.length === 0) {
    return `
      <div style="background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 16px; margin-top: 24px; padding: 20px 22px; page-break-inside: avoid; break-inside: avoid;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="font-size: 15px; font-weight: 900; color: ${titleColor};">🔄 EMERGENCY DROP-IN SLOT REPLACEMENTS</span>
        </div>
        <p style="font-size: 12px; color: ${subColor}; margin: 0;">
          Load the master FFCS course catalog to discover zero-clash drop-in faculty replacements for course registration rush.
        </p>
      </div>
    `;
  }

  const expandedHalves = expandCourseHalves(courses);

  const dropInRows = expandedHalves
    .map((half) => {
      const alts = sameSlotFacultyAlternatives(
        half.code,
        half.slots,
        { faculty: half.faculty, employeeId: half.employeeId },
        masterCourses
      );

      const slotStr = half.slots.join("+");
      const currentFac = half.faculty ? half.faculty.split("/")[0]?.trim() : "TBA";
      const colorHex = COLOR_HEX_MAP[half.color] || "#2563eb";

      let altsHtml = "";
      if (alts.length === 0) {
        altsHtml = `
          <div style="font-size: 11.5px; color: #64748b; font-style: italic; padding: 6px 4px;">
            Unique slot allocation · No identical-slot alternative faculties found in catalog
          </div>
        `;
      } else {
        const altItems = alts
          .map((alt) => {
            const rev = getFacultyReview({ employeeId: alt.ERP_ID, name: alt.FACULTY });
            const facultyImage = findFacultyImage(facultyImages, alt.ERP_ID, alt.FACULTY);
            const initials = alt.FACULTY.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
            let revBadge = "";
            if (rev && rev.reviews > 0) {
              const isGood = rev.wPct >= 70;
              const isAmber = rev.wPct >= 40 && rev.wPct < 70;
              const color = isGood ? (isLight ? "#059669" : "#34d399") : isAmber ? (isLight ? "#b45309" : "#fbbf24") : (isLight ? "#dc2626" : "#f87171");
              revBadge = `
                <span style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); color: ${color}; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">
                  ★ ${rev.wPct}% W (${rev.reviews})
                </span>
              `;
            }

            return `
              <div style="display: flex; align-items: center; justify-content: space-between; background: ${altRowBg}; border: 1px solid ${altRowBorder}; border-radius: 8px; padding: 8px 12px; margin-top: 5px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="width:24px;height:24px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;font-size:9px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;">
                    ${facultyImage ? `<img src="${facultyImage}" alt="${escapeHtml(alt.FACULTY)}" width="24" height="24" style="width:24px;height:24px;object-fit:cover;border-radius:50%;" />` : escapeHtml(initials || "FAC")}
                  </span>
                  <span style="font-weight: 800; font-size: 12.5px; color: ${altFacColor};">${escapeHtml(
                    alt.FACULTY
                  )}</span>
                  ${
                    alt.ERP_ID
                      ? `<span style="font-size: 10.5px; color: ${altEmpColor};">(ID: ${escapeHtml(
                          alt.ERP_ID
                        )})</span>`
                      : ""
                  }
                  ${revBadge}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 11px; color: ${altVenueColor}; font-weight: 700;">Venue: ${escapeHtml(
                    alt.ROOM || "TBA"
                  )}</span>
                  <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: ${isLight ? '#059669' : '#34d399'}; font-size: 9.5px; font-weight: 900; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">
                    ✓ 0 Clash Risk
                  </span>
                </div>
              </div>
            `;
          })
          .join("");

        altsHtml = `<div style="display: flex; flex-direction: column; gap: 4px;">${altItems}</div>`;
      }

      return `
        <div style="background: ${subcardBg}; border: 1px solid ${subcardBorder}; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: ${colorHex}; color: #ffffff; font-size: 11px; font-weight: 900; padding: 3px 8px; border-radius: 5px; letter-spacing: 0.5px;">
                ${escapeHtml(half.code)}
              </span>
              <span style="font-size: 13.5px; font-weight: 800; color: ${courseTitleColor};">
                ${escapeHtml(half.title)}
              </span>
              <span style="font-size: 11px; color: ${typeColor}; font-weight: 600;">
                (${escapeHtml(half.type || "Theory")})
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: ${slotBadgeBg}; border: 1px solid ${slotBadgeBorder}; color: ${slotBadgeColor}; font-size: 11px; font-weight: 800; padding: 2px 8px; border-radius: 5px;">
                Slots: ${escapeHtml(slotStr)}
              </span>
              <span style="font-size: 11px; color: ${subColor};">
                Current Choice: <strong style="color: ${currentFacColor};">${escapeHtml(currentFac)}</strong>
              </span>
            </div>
          </div>
          ${altsHtml}
        </div>
      `;
    })
    .join("");

  return `
    <div style="background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 16px; margin-top: 24px; padding: 22px 24px; page-break-inside: avoid; break-inside: avoid;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid ${headerBorder};">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 15px; font-weight: 900; color: ${titleColor};">🔄 EMERGENCY DROP-IN SLOT REPLACEMENTS</span>
            <span style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: ${isLight ? '#059669' : '#34d399'}; font-size: 10px; font-weight: 800; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">
              Registration Rush Guide
            </span>
          </div>
          <p style="font-size: 11.5px; color: ${subColor}; margin: 0;">
            If your target faculty fills up during FFCS registration, swap into any identical-slot drop-in below with <strong>zero clash risk</strong>.
          </p>
        </div>
      </div>
      <div>
        ${dropInRows}
      </div>
    </div>
  `;
}

/**
 * Generate Inner Modern Standalone Timetable Dossier HTML for Image/PDF capture and Print
 */
export function generateModernDossierInnerHtml(
  params: ModernPrintableReportParams,
  isLight: boolean,
  facultyImages?: FacultyImageMap
): string {
  const {
    timetableName,
    courses,
    theoryPeriods,
    labPeriods,
    days,
    viewMode = "horizontal",
    totalCredits,
    masterCourses,
  } = params;

  const defaultDays = [
    { id: "mon", name: "Monday" },
    { id: "tue", name: "Tuesday" },
    { id: "wed", name: "Wednesday" },
    { id: "thu", name: "Thursday" },
    { id: "fri", name: "Friday" },
  ];
  const daysList = days && days.length > 0 ? days : defaultDays;

  // Group courses by code
  const groupedCoursesMap = new Map<string, AddedCourse & { ids: string[]; batches: string[] }>();
  for (const c of courses) {
    if (groupedCoursesMap.has(c.code)) {
      const g = groupedCoursesMap.get(c.code)!;
      g.ids.push(c.id);
      if (!g.faculty.includes(c.faculty)) g.faculty += ` / ${c.faculty}`;
      if (!g.venue.includes(c.venue)) g.venue += ` / ${c.venue}`;
      if (!g.type.includes(c.type)) g.type += ` + ${c.type}`;
      for (const s of c.slots) {
        if (!g.slots.includes(s)) g.slots.push(s);
      }
      if (c.batch) {
        c.batch
          .split(",")
          .map((b) => b.trim())
          .forEach((b) => {
            if (b && !g.batches.includes(b)) g.batches.push(b);
          });
      }
      g.credits = String(parseFloat(g.credits || "0") + parseFloat(c.credits || "0"));
    } else {
      const batches = c.batch ? c.batch.split(",").map((b) => b.trim()).filter(Boolean) : [];
      groupedCoursesMap.set(c.code, {
        ...c,
        ids: [c.id],
        faculty: c.faculty,
        venue: c.venue,
        type: c.type,
        slots: [...c.slots],
        batches,
      });
    }
  }
  const groupedCourses = Array.from(groupedCoursesMap.values());
  const calculatedCredits =
    totalCredits ?? groupedCourses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0);

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const cardBg = isLight ? "#ffffff" : "rgba(15, 23, 42, 0.88)";
  const cardBorder = isLight ? "#cbd5e1" : "rgba(255, 255, 255, 0.1)";
  const titleColor = isLight ? "#0f172a" : "#ffffff";
  const subColor = isLight ? "#64748b" : "#94a3b8";
  const creditsBg = isLight ? "rgba(59, 130, 246, 0.08)" : "rgba(59, 130, 246, 0.12)";
  const creditsBorder = isLight ? "rgba(59, 130, 246, 0.25)" : "rgba(59, 130, 246, 0.3)";
  const creditsLabel = isLight ? "#1d4ed8" : "#93c5fd";
  const coursesBg = isLight ? "rgba(139, 92, 246, 0.08)" : "rgba(139, 92, 246, 0.12)";
  const coursesBorder = isLight ? "rgba(139, 92, 246, 0.25)" : "rgba(139, 92, 246, 0.3)";
  const coursesLabel = isLight ? "#6d28d9" : "#c4b5fd";
  const footerBorder = isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const footerColor = isLight ? "#64748b" : "#64748b";

  const gridHtml =
    viewMode === "vertical"
      ? renderVerticalGridHtml(courses, theoryPeriods, labPeriods, daysList, isLight)
      : renderHorizontalGridHtml(courses, theoryPeriods, labPeriods, daysList, isLight);

  const tableHtml = renderCourseTableHtml(groupedCourses, isLight);
  const facultyDossierHtml = renderDetailedFacultyReviewsDossierHtml(courses, isLight, facultyImages);
  const dropInsHtml = renderDropInReplacementsDossierHtml(courses, masterCourses, isLight, facultyImages);

  return `
    <div style="width: 100%; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: ${isLight ? '#0f172a' : '#f8fafc'};">
      <!-- Executive Header Banner -->
      <div style="background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 16px; padding: 24px 28px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; font-size: 10px; font-weight: 900; padding: 3px 8px; border-radius: 6px; letter-spacing: 1px; text-transform: uppercase;">
              Official Registration Dossier
            </span>
            <span style="font-size: 11px; font-weight: 700; color: ${subColor};">
              ${viewMode === "vertical" ? "📱 Mobile Vertical Heatmap" : "🖥️ Horizontal University Grid"}
            </span>
          </div>
          <h1 style="margin: 0; font-size: 28px; font-weight: 900; color: ${titleColor}; letter-spacing: -0.5px;">
            ${escapeHtml(timetableName)}
          </h1>
          <p style="margin: 4px 0 0; font-size: 12px; color: ${subColor};">
            Vellore Institute of Technology, Chennai • Generated on ${escapeHtml(dateStr)}
          </p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <div style="background: ${creditsBg}; border: 1px solid ${creditsBorder}; border-radius: 12px; padding: 10px 16px; text-align: right;">
            <div style="font-size: 10px; font-weight: 800; color: ${creditsLabel}; text-transform: uppercase;">Total Credits</div>
            <div style="font-size: 20px; font-weight: 900; color: ${titleColor};">${calculatedCredits}</div>
          </div>
          <div style="background: ${coursesBg}; border: 1px solid ${coursesBorder}; border-radius: 12px; padding: 10px 16px; text-align: right;">
            <div style="font-size: 10px; font-weight: 800; color: ${coursesLabel}; text-transform: uppercase;">Courses</div>
            <div style="font-size: 20px; font-weight: 900; color: ${titleColor};">${groupedCourses.length}</div>
          </div>
        </div>
      </div>

      <!-- Timetable Schedule Grid -->
      ${gridHtml}

      <!-- Selected Courses Master Table -->
      ${tableHtml}

      <!-- Detailed Faculty Intelligence & Sentiment Dossier -->
      ${facultyDossierHtml}

      <!-- Emergency Drop-In Slot Replacements Matrix -->
      ${dropInsHtml}

      <!-- Footer / Attribution -->
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid ${footerBorder}; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: ${footerColor};">
        <span>Generated with AmazeCC FFCS Planner • All times reflect official VIT Chennai schema</span>
        <span>Faculty sentiment &amp; reviews powered by Vitfac (vitfac.pages.dev)</span>
      </div>
    </div>
  `;
}

/**
 * Generate Modern Standalone Timetable Dossier HTML for Print & PDF
 */
export function generateModernPrintableHtml(params: ModernPrintableReportParams): string {
  const {
    timetableName,
    viewMode = "horizontal",
    themeHtmlClass = "dark",
    autoPrint = false,
    pageOrientation = "landscape",
  } = params;

  const isLight =
    params.theme === "light" ||
    (!params.theme && (!themeHtmlClass.includes("dark") || themeHtmlClass.includes("light")));

  const containerWidth = viewMode === "vertical" ? 1280 : 1540;
  const innerHtml = generateModernDossierInnerHtml(params, isLight);
  const portraitPrint = pageOrientation === "portrait";
  const pageBand = isLight ? "#e8eef7" : "#090d16";
  const pageSurface = isLight ? "#ffffff" : "#0c1222";
  const pageBorder = isLight ? "#cbd5e1" : "rgba(255,255,255,0.12)";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(timetableName)} — FFCS Schedule &amp; Registration Dossier</title>
      <style>
        * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body {
          margin: 0;
          padding: 72px 24px 48px;
          background: ${isLight ? "#f8fafc" : "#090d16"};
          color: ${isLight ? "#0f172a" : "#f8fafc"};
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: background 0.2s ease, color 0.2s ease;
        }

        body.portrait-print {
          padding: 10mm;
          display: block;
          min-height: 100vh;
          background: ${pageBand};
        }

        body.portrait-print.light-theme { background: #e8eef7 !important; }

        body.portrait-print .report-container {
          max-width: 100%;
          width: 100%;
          padding: 7mm;
          background: ${pageSurface};
          border: 1px solid ${pageBorder};
          border-radius: 3mm;
          box-shadow: 0 1.5mm 5mm rgba(15, 23, 42, 0.12);
          -webkit-box-decoration-break: clone;
          box-decoration-break: clone;
        }

        .report-container {
          width: 100%;
          max-width: ${containerWidth}px;
        }

        /* Light Theme (Ink-Saver for Paper Print & Screen) */
        body.light-theme {
          background: #f8fafc !important;
          color: #0f172a !important;
        }

        /* Floating Toolbar */
        .print-toolbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(15, 23, 42, 0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          padding: 12px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 9999;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        }

        @page {
          size: ${portraitPrint ? "A4 portrait" : "landscape"};
          margin: ${portraitPrint ? "0" : "10mm 12mm"};
        }

        @media print {
          body {
            padding: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .print-toolbar {
            display: none !important;
          }
          .report-container {
            max-width: 100% !important;
            width: 100% !important;
          }

          body.portrait-print {
            padding: 10mm !important;
            display: block !important;
            min-height: auto !important;
            background: ${pageBand} !important;
            color: ${isLight ? "#0f172a" : "#f8fafc"} !important;
          }

          body.portrait-print.light-theme { background: #e8eef7 !important; }

          body.portrait-print .report-container {
            max-width: none !important;
            width: 100% !important;
            padding: 7mm !important;
            margin: 0 !important;
            background: ${pageSurface} !important;
            border: 1px solid ${pageBorder} !important;
            border-radius: 3mm !important;
            box-shadow: none !important;
            -webkit-box-decoration-break: clone;
            box-decoration-break: clone;
          }

          body.portrait-print .report-container > div { width: 100% !important; }
          body.portrait-print .report-container .overflow-x-auto { overflow: visible !important; }
          body.portrait-print .report-container table {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            table-layout: fixed !important;
          }
          body.portrait-print .report-container th,
          body.portrait-print .report-container td {
            min-width: 0 !important;
            padding: 1.2mm 0.7mm !important;
            font-size: 6pt !important;
            overflow-wrap: normal !important;
            word-break: normal !important;
            position: static !important;
            left: auto !important;
          }
          body.portrait-print .report-container .rounded-2xl table th,
          body.portrait-print .report-container .rounded-2xl table td { font-size: 5.2pt !important; }
          body.portrait-print .report-container .rounded-2xl table td > div {
            height: auto !important;
            min-height: 3.5mm !important;
            margin: 0.4mm 0 !important;
            padding: 0.5mm !important;
            overflow: visible !important;
          }
          body.portrait-print .report-container .rounded-2xl table td > div div,
          body.portrait-print .report-container .rounded-2xl table td > div span {
            font-size: 5pt !important;
            line-height: 1.1 !important;
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: clip !important;
          }
          body.portrait-print .report-container tr { break-inside: avoid; page-break-inside: avoid; }
          body.portrait-print .pdf-timetable-grid { overflow: visible !important; }
          body.portrait-print .pdf-timetable-grid table {
            width: 100% !important;
            min-width: 0 !important;
            max-width: 100% !important;
            table-layout: fixed !important;
          }
          body.portrait-print .pdf-timetable-grid th,
          body.portrait-print .pdf-timetable-grid td {
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            padding: 0.8mm 0.45mm !important;
            font-size: 5.2pt !important;
            overflow-wrap: anywhere !important;
          }
          body.portrait-print .pdf-timetable-grid th:first-child { width: 11mm !important; }
          body.portrait-print .pdf-timetable-grid .lunch-column { width: 10mm !important; min-width: 10mm !important; max-width: 10mm !important; }
          body.portrait-print .pdf-timetable-grid .lunch-cell { width: 12mm !important; min-width: 12mm !important; max-width: 12mm !important; }
          body.portrait-print .pdf-timetable-grid .lunch-cell > div > span:nth-of-type(-n+5) {
            font-size: 7pt !important;
            letter-spacing: 0.25pt !important;
          }
          body.portrait-print .pdf-timetable-grid .lunch-cell > div > span:nth-of-type(n+6) { font-size: 5.5pt !important; }
          body.portrait-print .pdf-timetable-grid .lunch-header { width: 14mm !important; min-width: 14mm !important; max-width: 14mm !important; }
          body.portrait-print .pdf-timetable-grid .lunch-header .lunch-label {
            white-space: nowrap !important;
            font-size: 5.2pt !important;
            letter-spacing: 0 !important;
          }
          body.portrait-print .pdf-timetable-grid .lunch-header .lunch-time {
            white-space: nowrap !important;
            font-size: 4.2pt !important;
          }
          body.portrait-print .pdf-timetable-grid td > div {
            height: auto !important;
            min-height: 1.5mm !important;
            margin: 0.3mm 0 !important;
            padding: 0.5mm !important;
            overflow: visible !important;
          }
          body.portrait-print .pdf-timetable-grid td > div[style*="height: 28px"] { height: 1.5mm !important; }
          body.portrait-print .pdf-timetable-grid td > div[style*="height: 26px"] { height: 5mm !important; }
          body.portrait-print .pdf-timetable-grid td > div > div:first-child {
            display: flex !important;
            flex-wrap: wrap !important;
            justify-content: center !important;
            gap: 0.4mm !important;
          }
          body.portrait-print .pdf-timetable-grid td > div > div:last-child {
            white-space: normal !important;
            overflow: visible !important;
            text-overflow: clip !important;
          }
          body.portrait-print .pdf-timetable-grid td > div span { font-size: 5pt !important; }
          body.portrait-print .pdf-course-section { padding: 2.5mm !important; }
          body.portrait-print table.pdf-course-table {
            table-layout: fixed !important;
            width: 100% !important;
            min-width: 0 !important;
            overflow-wrap: normal !important;
            word-break: normal !important;
          }
          body.portrait-print .pdf-course-table th,
          body.portrait-print .pdf-course-table td {
            padding: 0.8mm 0.55mm !important;
            font-size: 5.6pt !important;
            line-height: 1.15 !important;
            overflow-wrap: normal !important;
            word-break: normal !important;
          }
          body.portrait-print .pdf-course-table th:nth-child(1),
          body.portrait-print .pdf-course-table td:nth-child(1) { width: 4% !important; }
          body.portrait-print .pdf-course-table th:nth-child(2),
          body.portrait-print .pdf-course-table td:nth-child(2) { width: 31% !important; }
          body.portrait-print .pdf-course-table th:nth-child(3),
          body.portrait-print .pdf-course-table td:nth-child(3) { width: 12% !important; }
          body.portrait-print .pdf-course-table th:nth-child(4),
          body.portrait-print .pdf-course-table td:nth-child(4) { width: 6% !important; }
          body.portrait-print .pdf-course-table th:nth-child(5),
          body.portrait-print .pdf-course-table td:nth-child(5) { width: 13% !important; }
          body.portrait-print .pdf-course-table th:nth-child(6),
          body.portrait-print .pdf-course-table td:nth-child(6) { width: 11% !important; }
          body.portrait-print .pdf-course-table th:nth-child(7),
          body.portrait-print .pdf-course-table td:nth-child(7) { width: 23% !important; }
          body.portrait-print .pdf-course-cell > div {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: flex-start !important;
            gap: 0.8mm !important;
          }
          body.portrait-print .pdf-course-cell > div > div { flex: 1 1 24mm !important; min-width: 24mm !important; }
          body.portrait-print .pdf-course-table .pdf-course-code {
            flex: 0 0 auto !important;
            white-space: nowrap !important;
            font-size: 5.2pt !important;
            letter-spacing: 0 !important;
            padding: 0.5mm 1mm !important;
          }
          body.portrait-print .pdf-course-table .pdf-course-title {
            min-width: 24mm !important;
            font-size: 5.6pt !important;
            white-space: normal !important;
            overflow-wrap: break-word !important;
            word-break: normal !important;
          }
          body.portrait-print .pdf-course-table td:nth-child(5) span { white-space: nowrap !important; }
        }
      </style>
    </head>
    <body class="${[isLight ? "light-theme" : "", portraitPrint ? "portrait-print" : ""].filter(Boolean).join(" ")}">
      <div class="print-toolbar">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; font-size: 10px; font-weight: 900; padding: 4px 9px; border-radius: 6px; letter-spacing: 1px; text-transform: uppercase;">
            AmazeCC FFCS
          </span>
          <span style="font-weight: 800; font-size: 15px; color: #ffffff;">
            ${escapeHtml(timetableName)}
          </span>
          <span style="font-size: 12px; color: #94a3b8;">
            • Detailed Dossier &amp; Registration Guide
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <button onclick="toggleTheme()" id="theme-toggle-btn" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.18); color: #ffffff; padding: 8px 14px; border-radius: 9px; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
            ${isLight ? "🌙 Dark Mode" : "☀️ Ink-Saver Light"}
          </button>
          <button onclick="window.print()" style="background: linear-gradient(135deg, #3b82f6, #6366f1); border: none; color: #ffffff; padding: 8px 18px; border-radius: 9px; font-size: 12px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(59,130,246,0.35);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
            Print / Save PDF
          </button>
          <button onclick="window.close()" style="background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94a3b8; padding: 8px 12px; border-radius: 9px; font-size: 12px; cursor: pointer;">
            ✕
          </button>
        </div>
      </div>

      <div class="report-container">
        ${innerHtml}
      </div>

      <script>
        function toggleTheme() {
          var b = document.body;
          b.classList.toggle('light-theme');
          var isLight = b.classList.contains('light-theme');
          var btn = document.getElementById('theme-toggle-btn');
          if (btn) {
            btn.innerHTML = isLight ? '🌙 Dark Mode' : '☀️ Ink-Saver Light';
          }
        }
        ${autoPrint ? "window.addEventListener('load', function() { setTimeout(function() { window.print(); }, 400); });" : ""}
      </script>
    </body>
    </html>
  `;
}

/**
 * Build a standalone, responsive HTML dossier from the same grouped report
 * content used by the printable view. This document has no print controls or
 * print handlers and always uses the modern horizontal schedule.
 */
export function generateModernDossierHtml(params: ModernPrintableReportParams, facultyImages?: FacultyImageMap): string {
  const timetableName = params.timetableName || "Timetable";
  const isLight = params.theme === "light" || (!params.theme && (!params.themeHtmlClass?.includes("dark") || Boolean(params.themeHtmlClass?.includes("light"))));
  const pageBand = isLight ? "#e8eef7" : "#090d16";
  const surface = isLight ? "#ffffff" : "#0c1222";
  const border = isLight ? "#cbd5e1" : "rgba(255,255,255,0.12)";
  const content = generateModernDossierInnerHtml({ ...params, viewMode: "horizontal" }, isLight, facultyImages);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="${isLight ? "light" : "dark"}">
  <title>${escapeHtml(timetableName)} - FFCS Registration Dossier</title>
  <style>
    * { box-sizing: border-box; }
    html { min-width: 320px; background: ${pageBand}; }
    body {
      margin: 0;
      min-height: 100vh;
      padding: clamp(12px, 3vw, 36px);
      background: ${pageBand};
      color: ${isLight ? "#0f172a" : "#f8fafc"};
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .dossier-shell {
      width: min(1540px, 100%);
      margin: 0 auto;
      padding: clamp(14px, 2.5vw, 32px);
      border: 1px solid ${border};
      border-radius: clamp(12px, 2vw, 24px);
      background: ${surface};
      box-shadow: 0 12px 40px rgba(15, 23, 42, 0.16);
    }
    .dossier-content { width: 100%; min-width: 0; }
    .pdf-timetable-grid, .pdf-course-section { max-width: 100%; }
    .pdf-timetable-grid { overflow-x: auto; overscroll-behavior-inline: contain; -webkit-overflow-scrolling: touch; }
    .pdf-timetable-grid table { width: 100%; min-width: 1000px; border-collapse: collapse; }
    .pdf-course-section { overflow-x: auto; overscroll-behavior-inline: contain; -webkit-overflow-scrolling: touch; }
    .pdf-course-table { min-width: 780px; }
    @media (max-width: 640px) {
      body { padding: 10px; }
      .dossier-shell { padding: 12px; border-radius: 12px; }
      .dossier-content { font-size: 14px; }
      .pdf-timetable-grid, .pdf-course-section { margin-inline: -2px; }
    }
  </style>
</head>
<body class="${isLight ? "light-theme" : "dark-theme"}">
  <main class="dossier-shell">
    <div class="dossier-content">${content}</div>
  </main>
</body>
</html>`;
}

interface FacultyImageTarget {
  employeeId?: string;
  name?: string;
}

function collectFacultyImageTargets(params: ModernPrintableReportParams): FacultyImageTarget[] {
  const targets = new Map<string, FacultyImageTarget>();
  const add = (employeeId?: string | null, name?: string | null) => {
    const cleanId = employeeId?.trim();
    const cleanName = name?.trim();
    const key = cleanId ? `id:${cleanId}` : `name:${cleanName ? normalizeFacultyName(cleanName) : ""}`;
    if ((cleanId || cleanName) && !targets.has(key)) targets.set(key, { employeeId: cleanId || undefined, name: cleanName || undefined });
  };

  for (const course of params.courses) {
    const names = (course.faculty || "").split(/\s*\/\s*/).map((name) => name.trim()).filter(Boolean);
    const ids = (course.employeeId || "").split(/\s*\/\s*/).map((id) => id.trim()).filter(Boolean);
    names.forEach((name, index) => add(ids[index] || (ids.length === 1 ? ids[0] : undefined), name));
  }

  for (const half of expandCourseHalves(params.courses)) {
    const alternatives = sameSlotFacultyAlternatives(
      half.code,
      half.slots,
      { faculty: half.faculty, employeeId: half.employeeId },
      params.masterCourses
    );
    alternatives.forEach((alternative) => add(alternative.ERP_ID, alternative.FACULTY));
  }
  return [...targets.values()];
}

async function shrinkFacultyImageToDataUrl(sourceUrl: string): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl, { mode: "cors", credentials: "omit" });
    if (!response.ok) return null;
    const bitmap = await createImageBitmap(await response.blob());
    try {
      const maxDimension = 96;
      const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0, width, height);
      return canvas.toDataURL("image/jpeg", 0.78);
    } finally {
      bitmap.close();
    }
  } catch {
    // Cross-origin images without CORS support intentionally fall back to initials.
    return null;
  }
}

async function buildFacultyImageMap(
  params: ModernPrintableReportParams,
  catalog: Map<string, VitfacFaculty>
): Promise<Map<string, string>> {
  const targets = collectFacultyImageTargets(params);
  const facultyByTarget = new Map<string, VitfacFaculty>();
  const catalogEntries = [...new Set(catalog.values())];
  for (const target of targets) {
    const normalizedName = target.name ? normalizeFacultyName(target.name) : "";
    const faculty = catalog.get(target.employeeId || "") || catalogEntries.find((entry) =>
      (target.employeeId && entry.employeeId === target.employeeId) ||
      (normalizedName && normalizeFacultyName(entry.name) === normalizedName)
    );
    if (faculty?.image_url) facultyByTarget.set(target.employeeId ? `id:${target.employeeId}` : `name:${normalizedName}`, faculty);
  }

  const imageMap = new Map<string, string>();
  const embeddedImages = await Promise.all(
    [...facultyByTarget].map(async ([targetKey, faculty]) => ({
      targetKey,
      faculty,
      dataUrl: await shrinkFacultyImageToDataUrl(faculty.image_url!),
    }))
  );
  for (const { targetKey, faculty, dataUrl } of embeddedImages) {
    if (!dataUrl) continue;
    imageMap.set(targetKey, dataUrl);
    // Also index by catalog identity to support a selected name whose catalog ID was resolved.
    facultyImageLookupKeys(faculty.employeeId, faculty.name).forEach((key) => imageMap.set(key, dataUrl));
  }
  return imageMap;
}

/** Wait for VITFAC review data, then download a standalone dossier HTML file. */
export async function downloadModernDossierHtml(params: ModernPrintableReportParams): Promise<void> {
  const catalog = await loadVitfacCatalog();
  const facultyImages = await buildFacultyImageMap(params, catalog);
  const html = generateModernDossierHtml({ ...params, viewMode: "horizontal" }, facultyImages);
  const isLight = params.theme === "light" || (!params.theme && (!params.themeHtmlClass?.includes("dark") || Boolean(params.themeHtmlClass?.includes("light"))));
  const themeTag = isLight ? "LIGHT" : "DARK";
  const cleanName = (params.timetableName || "Timetable").replace(/[^a-zA-Z0-9_-]/g, "_");
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${cleanName}_${themeTag}_FFCS_Dossier.html`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * Compiles the multi-page PDF document inline on the main thread
 * (fallback when Worker or OffscreenCanvas is unavailable).
 */
export async function compileDossierPdfInline(params: {
  timetableName: string;
  theme?: "light" | "dark";
  isLight: boolean;
  dataUrl: string;
  imgNaturalWidth?: number;
  imgNaturalHeight?: number;
}): Promise<{ pdfBuffer: ArrayBuffer; fileName: string }> {
  const { timetableName, isLight, dataUrl, imgNaturalWidth, imgNaturalHeight } = params;

  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load captured timetable image"));
  });

  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 10;
  const printWidth = pageWidth - margin * 2; // 277mm
  const printHeight = pageHeight - margin * 2; // 190mm

  const totalCanvasWidth = imgNaturalWidth || img.naturalWidth;
  const totalCanvasHeight = imgNaturalHeight || img.naturalHeight;
  const pxPerMm = totalCanvasWidth / printWidth;
  const pageHeightPx = Math.floor(printHeight * pxPerMm);

  let remainingHeight = totalCanvasHeight;
  let sourceY = 0;
  let pageIndex = 0;

  while (remainingHeight > 0) {
    if (pageIndex > 0) {
      pdf.addPage("a4", "landscape");
    }
    const sliceHeightPx = Math.min(pageHeightPx, remainingHeight);
    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = totalCanvasWidth;
    sliceCanvas.height = sliceHeightPx;
    const ctx = sliceCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = isLight ? "#ffffff" : "#090d16";
      ctx.fillRect(0, 0, totalCanvasWidth, sliceHeightPx);
      ctx.drawImage(
        img,
        0,
        sourceY,
        totalCanvasWidth,
        sliceHeightPx,
        0,
        0,
        totalCanvasWidth,
        sliceHeightPx
      );
      const sliceDataUrl = sliceCanvas.toDataURL("image/jpeg", 0.95);
      const sliceHeightMm = sliceHeightPx / pxPerMm;
      pdf.addImage(sliceDataUrl, "JPEG", margin, margin, printWidth, sliceHeightMm);
    }
    sourceY += sliceHeightPx;
    remainingHeight -= sliceHeightPx;
    pageIndex++;
  }

  const themeTag = isLight ? "LIGHT" : "DARK";
  const cleanName = (timetableName || "Timetable").replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `${cleanName}_${themeTag}_FFCS_Dossier.pdf`;
  const pdfBuffer = pdf.output("arraybuffer");
  return { pdfBuffer, fileName };
}

/**
 * Compiles the sliced multi-page PDF document on a background Web Worker thread,
 * with graceful fallback to inline main thread execution if Web Workers or
 * OffscreenCanvas are unsupported.
 */
export async function compileDossierPdf(params: {
  timetableName: string;
  theme: "light" | "dark";
  isLight: boolean;
  dataUrl: string;
  imgNaturalWidth?: number;
  imgNaturalHeight?: number;
}): Promise<{ pdfBuffer: ArrayBuffer; fileName: string }> {
  // 1. Try background worker thread if Worker and OffscreenCanvas are available
  if (typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined") {
    try {
      const worker = new Worker(
        new URL("../components/custom/exams/FFCS/workers/pdf.worker.ts", import.meta.url),
        { type: "module" }
      );

      return await new Promise<{ pdfBuffer: ArrayBuffer; fileName: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          worker.terminate();
          reject(new Error("PDF worker timed out"));
        }, 30000);

        worker.onmessage = (event) => {
          clearTimeout(timeout);
          worker.terminate();
          if (event.data.type === "success") {
            resolve({
              pdfBuffer: event.data.pdfBuffer,
              fileName: event.data.fileName,
            });
          } else {
            reject(new Error(event.data.message || "PDF worker failed"));
          }
        };

        worker.onerror = (err) => {
          clearTimeout(timeout);
          worker.terminate();
          reject(err);
        };

        worker.postMessage({
          type: "build_dossier_pdf",
          timetableName: params.timetableName,
          theme: params.theme,
          isLight: params.isLight,
          dataUrl: params.dataUrl,
        });
      });
    } catch (workerErr) {
      console.warn("PDF worker execution failed or unavailable, falling back to inline main thread:", workerErr);
    }
  }

  // 2. Inline fallback (guarantees compatibility in all environments, unit tests, and older browsers)
  return compileDossierPdfInline(params);
}

/**
 * Automatically downloads a modern, high-res PDF dossier with Light and Dark mode compatibility
 */
export async function downloadModernTimetablePdf(
  params: ModernPrintableReportParams & { theme?: "light" | "dark" }
): Promise<void> {
  const isLight =
    params.theme === "light" ||
    (!params.theme && ((params.themeHtmlClass?.includes("light") && !params.themeHtmlClass?.includes("dark")) || false));

  const dossierInnerHtml = generateModernDossierInnerHtml(params, isLight);
  let container: HTMLElement | null = null;

  try {
    if (typeof htmlToImage.toPng !== "function") {
      throw new Error("htmlToImage export function is not available");
    }

    container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "1400px";
    container.style.minWidth = "1400px";
    container.style.maxWidth = "1400px";
    container.style.zIndex = "-1000";
    container.style.background = isLight ? "#ffffff" : "#090d16";
    container.style.padding = "28px";
    container.style.boxSizing = "border-box";
    container.innerHTML = dossierInnerHtml;
    document.body.appendChild(container);

    // Allow browser layout and fonts to settle
    await new Promise((resolve) => setTimeout(resolve, 150));

    const targetElement = (container.firstElementChild as HTMLElement) || container;
    const dataUrl = await htmlToImage.toPng(targetElement, {
      quality: 0.98,
      backgroundColor: isLight ? "#ffffff" : "#090d16",
      pixelRatio: 2,
    });

    if (!dataUrl) {
      throw new Error("Failed to render timetable image for PDF generation.");
    }

    // Clean up DOM container immediately to release memory
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
      container = null;
    }

    const img = new Image();
    img.src = dataUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load captured timetable image"));
    });

    // Compile multi-page PDF on worker thread (or fallback inline)
    const { pdfBuffer, fileName } = await compileDossierPdf({
      timetableName: params.timetableName,
      theme: isLight ? "light" : "dark",
      isLight,
      dataUrl,
      imgNaturalWidth: img.naturalWidth,
      imgNaturalHeight: img.naturalHeight,
    });

    // Save and download PDF
    const blob = new Blob([pdfBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } finally {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Open Standalone Detailed Timetable Dossier in a New Tab
 */
export function openModernPrintableDossier(params: ModernPrintableReportParams): Window | null {
  const html = generateModernPrintableHtml(params);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return null;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return printWindow;
}

export function openTimetablePrintablePage(
  contentOrParams: string | ModernPrintableReportParams,
  timetableName?: string,
  themeHtmlClass?: string,
  _themeBgColor?: string,
  themeTextColor?: string
): Window | null {
  if (typeof contentOrParams !== "string") {
    return openModernPrintableDossier(contentOrParams);
  }
  const htmlContent = contentOrParams;
  const tName = timetableName || "Timetable";
  const tClass = themeHtmlClass || "dark";
  const tTextColor = themeTextColor || "#ffffff";

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join("\n");

  const isDarkMode = tClass.includes("dark");
  const bgGrad = isDarkMode
    ? "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)"
    : "linear-gradient(135deg, #f8fafc 0%, #e0e7ff 30%, #fce7f3 70%, #f8fafc 100%)";
  const cardBg = isDarkMode ? "#1e293bcc" : "rgba(255,255,255,0.85)";
  const cardBorder = isDarkMode
    ? "1px solid rgba(99,102,241,0.25)"
    : "1px solid rgba(99,102,241,0.15)";
  const accentGrad = "linear-gradient(135deg, #6366f1, #a855f7, #ec4899)";

  const fullHtml = `
    <!DOCTYPE html>
        <html class="${escapeHtml(tClass)}">
      <head>
        <title>${escapeHtml(tName)} - Timetable</title>
        ${styles}
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body {
            margin: 0;
            min-height: 100vh;
            background: ${bgGrad};
            font-family: system-ui, -apple-system, sans-serif;
          }
          @page { size: landscape; margin: 0; }
          .print-toolbar {
            position: fixed; top: 0; left: 0; right: 0;
            background: linear-gradient(135deg, #1e293b, #1e1b4b);
            color: white; padding: 14px 32px;
            display: flex; align-items: center;
            justify-content: space-between;
            z-index: 9999; backdrop-filter: blur(12px);
            font-family: system-ui, -apple-system, sans-serif;
            box-shadow: 0 4px 32px rgba(0,0,0,0.4);
          }
          .print-toolbar button {
            background: ${accentGrad}; color: white; border: none;
            padding: 10px 24px; border-radius: 10px; font-size: 14px;
            font-weight: 600; cursor: pointer; display: flex;
            align-items: center; gap: 8px;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 4px 16px rgba(99,102,241,0.4);
          }
          .print-toolbar button:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 24px rgba(99,102,241,0.6);
          }
          .print-toolbar .hint { font-size: 13px; color: #a5b4fc; }
          .print-wrapper {
            padding: 72px 48px 48px;
            min-height: 100vh; box-sizing: border-box;
            display: flex; align-items: flex-start; justify-content: center;
          }
          .print-card {
            width: 100%; max-width: 1400px;
            background: ${cardBg};
            backdrop-filter: blur(16px);
            border-radius: 24px;
            border: ${cardBorder};
            padding: 48px 40px 40px;
            box-shadow: 0 8px 64px rgba(0,0,0,0.12), 0 2px 8px rgba(99,102,241,0.08);
            overflow-x: auto; overflow-y: visible;
            color: ${tTextColor};
          }
          @media print {
            .print-toolbar { display: none !important; }
            .print-wrapper { padding: 0; display: block; }
            .print-card {
              border-radius: 0; box-shadow: none;
              padding: 48px 56px;
              max-width: none;
              background: ${isDarkMode ? "#0f172a" : "#ffffff"};
              border: none;
              backdrop-filter: none;
              -webkit-backdrop-filter: none;
            }
            body { background: ${isDarkMode ? "#0f172a" : "#ffffff"}; }
            .overflow-x-auto {
              overflow: visible !important;
              overflow-x: visible !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="print-toolbar">
          <div style="display:flex;align-items:center;gap:12px">
            <span style="font-weight:700;font-size:16px;background:${accentGrad};-webkit-background-clip:text;-webkit-text-fill-color:transparent">${escapeHtml(tName)}</span>
            <span class="hint">— Timetable</span>
          </div>
          <div style="display:flex;align-items:center;gap:12px">
            <span class="hint hidden sm:inline">Use browser Print / Save as PDF</span>
            <button onclick="window.print()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
              Print / PDF
            </button>
          </div>
        </div>
        <div class="print-wrapper">
          <div class="print-card">
            ${htmlContent}
          </div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return null;

  printWindow.document.open();
  printWindow.document.write(fullHtml);
  printWindow.document.close();
  return printWindow;
}
