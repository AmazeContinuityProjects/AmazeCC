import type { AddedCourse, TimetablePeriod } from "@/lib/ffcsTypes";
import { buildVerticalGrid } from "@/lib/buildBands";
import { COLOR_HEX_MAP, typeLabels } from "@/lib/ffcsConstants";
import { getFacultyReview, isVitfacIntegrationEnabled } from "./vitfacService";
import { ensureLunchPeriod, hasSlot } from "./slots";
import { buildExamRows, seatLabel, seriesTone } from "./examSchedule";
import { formatSemesterName } from "@/lib/formatSemesterName";

/**
 * The HTML-string half of the export module, split out of `exportTimetable`:
 * the three grid/table renderers and the escaper they and the dossier renderers
 * share. Everything here returns markup; the document chrome, PDF and image
 * capture stay in `exportTimetable`.
 */

/**
 * Build Vertical Heatmap HTML Table for Export
 */
export function renderVerticalGridHtml(
  courses: AddedCourse[],
  theoryPeriods: TimetablePeriod[],
  labPeriods: TimetablePeriod[],
  daysList: { id: string; name: string }[],
  isLight = false,
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

  const dayColWidth = `calc((100% - 110px) / ${daysList.length})`;

  const colGroupHtml = `
    <colgroup>
      <col style="width: 110px; min-width: 110px; max-width: 110px;" />
      ${daysList.map(() => `<col style="width: ${dayColWidth};" />`).join("")}
    </colgroup>
  `;

  const headerCells = daysList
    .map(
      (d) => `
    <th style="padding: 10px 8px; font-size: 12px; font-weight: 800; color: ${thColor}; background: ${thBg}; border: 1px solid ${borderColor}; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; width: ${dayColWidth}; box-sizing: border-box;">
      ${escapeHtml(d.name.slice(0, 3).toUpperCase())}
    </th>
  `,
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
      <td style="padding: 6px 10px; font-size: 11px; font-weight: 700; color: ${timeEndColor}; border: 1px solid ${cellBorderColor}; background: ${timeColBg}; white-space: nowrap; vertical-align: top; text-align: center; width: 110px; box-sizing: border-box;">
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
          <td rowspan="${rowSpan}" style="padding: 4px; border: 1px solid ${cellBorderColor}; vertical-align: top; width: ${dayColWidth}; box-sizing: border-box;">
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
                <div style="font-size: 11px; font-weight: 600; color: ${titleColor}; line-height: 1.25; margin-bottom: 4px; word-break: break-word; overflow-wrap: break-word;">
                  ${escapeHtml(c.title)}
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: ${facColor}; border-top: 1px solid ${metaBorder}; padding-top: 3px; margin-top: 3px; min-width: 0;">
                <span style="font-weight: 600; color: ${venueColor}; flex-shrink: 0;">${escapeHtml(c.venue || "TBA")}</span>
                <span style="max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-left: 4px;">${escapeHtml(c.faculty?.split("/")[0]?.trim() || "")}</span>
              </div>
            </div>
          </td>
        `;
          }
          return `
        <td style="padding: 4px; border: 1px solid ${cellBorderColor}; background: ${emptyCellBg}; vertical-align: top; width: ${dayColWidth}; box-sizing: border-box;">
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
      <table style="width: 100%; border-collapse: collapse; text-align: left; table-layout: fixed;">
        ${colGroupHtml}
        <thead>
          <tr>
            <th style="padding: 10px 8px; font-size: 12px; font-weight: 800; color: ${thColor}; background: ${thBg}; border: 1px solid ${borderColor}; text-align: center; width: 110px; box-sizing: border-box;">
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
export function renderHorizontalGridHtml(
  courses: AddedCourse[],
  theoryPeriods: TimetablePeriod[],
  labPeriods: TimetablePeriod[],
  daysList: { id: string; name: string }[],
  isLight = false,
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
                <span style="font-size: 7px; color: ${isLight ? "#b45309" : "#d97706"}; line-height: 1;">-</span>
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
export function renderCourseTableHtml(
  groupedCourses: (AddedCourse & { ids: string[]; batches: string[] })[],
  isLight = false,
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
            const bg = isGreen ? "rgba(16,185,129,0.18)" : isAmber ? "rgba(245,158,11,0.18)" : "rgba(239,68,68,0.18)";
            const border = isGreen
              ? "rgba(16,185,129,0.35)"
              : isAmber
                ? "rgba(245,158,11,0.35)"
                : "rgba(239,68,68,0.35)";
            const text = isGreen
              ? isLight
                ? "#059669"
                : "#34d399"
              : isAmber
                ? isLight
                  ? "#b45309"
                  : "#fbbf24"
                : isLight
                  ? "#dc2626"
                  : "#f87171";
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
          } else if (isVitfacIntegrationEnabled()) {
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
            `<span style="background: ${slotBg}; border: 1px solid ${slotBorder}; color: ${slotColor}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-right: 3px; display: inline-block;">${escapeHtml(s)}</span>`,
        )
        .join("");

      return `
      <tr style="border-bottom: 1px solid ${rowBorder}; background: ${idx % 2 === 0 ? rowEvenBg : rowOddBg};">
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
                      c.batches.join(", "),
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
          <span style="font-size: 14px; font-weight: 800; color: ${titleColor};">📋 ENROLLED COURSES &amp; ${isVitfacIntegrationEnabled() ? "FACULTY REVIEWS" : "FACULTY"}</span>
          ${isVitfacIntegrationEnabled() ? `<span style="font-size: 11px; color: ${subColor};">(Vitfac Sentiment &amp; Ratings)</span>` : ""}
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
            <th style="padding: 8px 12px;">${isVitfacIntegrationEnabled() ? "Faculty &amp; Vitfac Review" : "Faculty"}</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}

export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };
  return str.replace(/[&<>"']/g, (ch) => map[ch]);
}

export interface ExamScheduleExportParams {
  scheduleObj: unknown;
  semester?: string;
  isLight?: boolean;
  layout?: "cards" | "table" | "document" | "admit_card" | "hallticket";
  selectedSeries?: string;
}

function seriesFullName(examType: string): string {
  const upper = examType.trim().toUpperCase();
  if (upper === "CAT1" || upper === "CAT-1" || upper === "CAT 1") {
    return "Continuous Assessment Test - 1 (CAT 1)";
  }
  if (upper === "CAT2" || upper === "CAT-2" || upper === "CAT 2") {
    return "Continuous Assessment Test - 2 (CAT 2)";
  }
  if (upper === "FAT" || upper === "FAT-1" || upper === "FAT 1") {
    return "Final Assessment Test (FAT)";
  }
  return `${examType.trim()} Examination`;
}

function renderExamScheduleDocumentHtml(params: {
  allRows: ReturnType<typeof buildExamRows>;
  examTypes: string[];
  semester?: string;
  formattedSemester: string | null;
  selectedSeries?: string;
  dateStr: string;
}): string {
  const { allRows, examTypes, semester, formattedSemester, selectedSeries, dateStr } = params;

  const isSpecificSeries = selectedSeries && selectedSeries !== "__all__";
  const docTitle = isSpecificSeries
    ? `${escapeHtml(seriesFullName(selectedSeries).toUpperCase())} — EXAMINATION SCHEDULE`
    : `EXAMINATION SCHEDULE — ${escapeHtml(formattedSemester || semester || "ACADEMIC SESSION")}`;

  const headerHtml = `
    <div style="text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
      <div style="font-size: 19px; font-weight: 900; letter-spacing: 1.5px; color: #0f172a; text-transform: uppercase;">
        AmazeCC
      </div>
      <div style="font-size: 11px; font-weight: 700; color: #475569; letter-spacing: 0.8px; text-transform: uppercase; margin-top: 3px;">
        Student Academic Initiative • Exam Schedule &amp; Timetable
      </div>
      <div style="display: inline-block; margin-top: 8px; padding: 4px 18px; background: #0f172a; color: #ffffff; font-size: 12px; font-weight: 800; letter-spacing: 1px; text-transform: uppercase; border-radius: 3px;">
        ${docTitle}
      </div>
    </div>
  `;

  const metaHtml = `
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; margin-bottom: 16px; font-size: 11px;">
      <tbody>
        <tr>
          <td style="padding: 6px 10px; background: #f8fafc; font-weight: 700; color: #334155; border: 1px solid #cbd5e1; width: 18%;">Academic Term:</td>
          <td style="padding: 6px 10px; font-weight: 700; color: #0f172a; border: 1px solid #cbd5e1; width: 32%;">${escapeHtml(formattedSemester || semester || "Current Session")}</td>
          <td style="padding: 6px 10px; background: #f8fafc; font-weight: 700; color: #334155; border: 1px solid #cbd5e1; width: 18%;">Date Generated:</td>
          <td style="padding: 6px 10px; font-weight: 600; color: #0f172a; border: 1px solid #cbd5e1; width: 32%;">${escapeHtml(dateStr)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 10px; background: #f8fafc; font-weight: 700; color: #334155; border: 1px solid #cbd5e1;">Exams Scheduled:</td>
          <td style="padding: 6px 10px; font-weight: 700; color: #0f172a; border: 1px solid #cbd5e1;">${allRows.length} ${allRows.length === 1 ? "Examination" : "Examinations"}</td>
          <td style="padding: 6px 10px; background: #f8fafc; font-weight: 700; color: #334155; border: 1px solid #cbd5e1;">Exam Series:</td>
          <td style="padding: 6px 10px; font-weight: 700; color: #0f172a; border: 1px solid #cbd5e1;">${escapeHtml(examTypes.join(", "))}</td>
        </tr>
      </tbody>
    </table>
  `;

  if (allRows.length === 0) {
    return `
      <div style="width: 820px; background: #ffffff; color: #0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 28px 32px; box-sizing: border-box; border: 1px solid #94a3b8; border-radius: 4px;">
        ${headerHtml}
        ${metaHtml}
        <div style="padding: 40px; text-align: center; color: #64748b; font-size: 13px; font-weight: 600; border: 1px dashed #cbd5e1; border-radius: 4px;">
          No exam schedule data available to export.
        </div>
      </div>
    `;
  }

  const seriesTablesHtml = examTypes
    .map((examType) => {
      const rows = allRows.filter((r) => r.examType === examType);
      if (rows.length === 0) return "";

      const tableRows = rows
        .map((row, idx) => {
          const subj = row.raw;
          const seatText = formatExamSeat(subj);
          const venueText = formatExamVenue(subj.venue);
          const sessionText = formatExamSession(subj.examSession, subj.reportingTime);

          return `
            <tr style="background: ${idx % 2 === 0 ? "#ffffff" : "#f8fafc"}; border-bottom: 1px solid #cbd5e1; font-size: 11px;">
              <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center; vertical-align: middle; font-weight: 700; color: #475569;">
                ${idx + 1}
              </td>
              <td style="padding: 7px 8px; border: 1px solid #cbd5e1; vertical-align: middle;">
                <div style="font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #0f172a; font-size: 11.5px; letter-spacing: 0.2px;">
                  ${escapeHtml(subj.courseCode || "")}
                </div>
                <div style="font-weight: 600; color: #334155; margin-top: 1px; font-size: 10.5px; line-height: 1.25;">
                  ${escapeHtml(subj.courseTitle || subj.courseCode || "Untitled Course")}
                </div>
              </td>
              <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center; vertical-align: middle;">
                <span style="font-size: 10px; font-weight: 700; color: #0f172a;">${escapeHtml(subj.slot && subj.slot !== "-" ? subj.slot : "—")}</span>
              </td>
              <td style="padding: 7px 6px; border: 1px solid #cbd5e1; vertical-align: middle; font-weight: 700; color: #0f172a; white-space: nowrap;">
                ${escapeHtml(subj.examDate || "TBA")}
              </td>
              <td style="padding: 7px 6px; border: 1px solid #cbd5e1; vertical-align: middle; font-size: 10.5px; color: #334155; font-weight: 600;">
                ${escapeHtml(subj.examTime || "TBA")}
              </td>
              <td style="padding: 7px 6px; border: 1px solid #cbd5e1; vertical-align: middle; font-size: 10.5px; color: #0f172a; font-weight: 600;">
                ${escapeHtml(sessionText)}
              </td>
              <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center; vertical-align: middle; font-weight: 700; color: #0f172a;">
                ${escapeHtml(venueText)}
              </td>
              <td style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center; vertical-align: middle; font-size: 10px; font-weight: 700; color: #0f172a;">
                ${escapeHtml(seatText)}
              </td>
            </tr>
          `;
        })
        .join("");

      return `
        <div style="background: #1e293b; color: #ffffff; padding: 7px 12px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; margin-top: 14px; margin-bottom: 0px; border: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center;">
          <span>${escapeHtml(seriesFullName(examType))}</span>
          <span style="font-size: 10.5px; font-weight: 600; opacity: 0.9;">${rows.length} ${rows.length === 1 ? "Course" : "Courses"}</span>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; border-top: none; margin-bottom: 14px; font-size: 11px; table-layout: fixed;">
          <colgroup>
            <col style="width: 5%;" />
            <col style="width: 32%;" />
            <col style="width: 10%;" />
            <col style="width: 13%;" />
            <col style="width: 14%;" />
            <col style="width: 12%;" />
            <col style="width: 7%;" />
            <col style="width: 7%;" />
          </colgroup>
          <thead>
            <tr style="background: #f1f5f9; border-bottom: 1px solid #94a3b8; font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
              <th style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center;">#</th>
              <th style="padding: 7px 8px; border: 1px solid #cbd5e1; text-align: left;">Course Code &amp; Title</th>
              <th style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center;">Slot</th>
              <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: left;">Date</th>
              <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: left;">Timing</th>
              <th style="padding: 7px 6px; border: 1px solid #cbd5e1; text-align: left;">Session &amp; Rep.</th>
              <th style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center;">Venue</th>
              <th style="padding: 7px 4px; border: 1px solid #cbd5e1; text-align: center;">Seat</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      `;
    })
    .join("");

  const instructionsHtml = `
    <div style="border: 1px solid #94a3b8; background: #f8fafc; padding: 10px 14px; margin-top: 14px; margin-bottom: 12px; font-size: 9.5px; color: #334155; line-height: 1.5; border-radius: 4px;">
      <div style="font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px;">
        Important Exam Guidelines &amp; Student Notes
      </div>
      <ol style="margin: 0; padding-left: 16px;">
        <li style="margin-bottom: 2px;"><strong>Reporting &amp; Punctuality:</strong> Arrive at your designated examination venue at least 15 minutes before exam commencement (by the designated Reporting Time).</li>
        <li style="margin-bottom: 2px;"><strong>Identification:</strong> Possession of the physical University Student ID card is compulsory. Candidates without valid ID are not allowed in the exam hall.</li>
        <li style="margin-bottom: 2px;"><strong>Seating Protocols:</strong> Strictly occupy your assigned Seat Number and Row/Column position. Entries marked <em>TBA</em> will be published on venue notice boards.</li>
        <li style="margin-bottom: 2px;"><strong>Prohibited Items:</strong> Electronic gadgets, mobile phones, smartwatches, programmable calculators, bags, and unauthorized papers are strictly forbidden.</li>
        <li style="margin-bottom: 0px;"><strong>Discrepancies:</strong> In case of timetable clashes or course omissions, notify university examination authorities immediately.</li>
      </ol>
    </div>
  `;

  const footerHtml = `
    <div style="border-top: 1px solid #cbd5e1; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 9px; color: #64748b;">
      <span>AmazeCC is an independent student initiative • Not officially affiliated with university administration • Verify with VTOP notices</span>
      <span>Created via AmazeCC • Built by students, for students</span>
    </div>
  `;

  return `
    <div style="width: 820px; background: #ffffff; color: #0f172a; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 28px 32px; box-sizing: border-box; border: 1px solid #94a3b8; border-radius: 4px;">
      ${headerHtml}
      ${metaHtml}
      ${seriesTablesHtml}
      ${instructionsHtml}
      ${footerHtml}
    </div>
  `;
}

function formatExamSeat(subj: any): string {
  const rawLoc = seatLabel(subj);
  const loc =
    rawLoc && typeof rawLoc === "string" && rawLoc.trim() !== "-" && rawLoc.trim() !== "" ? rawLoc.trim() : null;
  const no =
    subj?.seatNo && String(subj.seatNo).trim() !== "-" && String(subj.seatNo).trim() !== ""
      ? String(subj.seatNo).trim()
      : null;

  if (loc && no) return `Loc: ${loc} · No: ${no}`;
  if (loc) return `Loc: ${loc}`;
  if (no) return `No: ${no}`;
  return "TBA";
}

function formatExamVenue(venue: unknown): string {
  if (typeof venue !== "string") return "TBA";
  const trimmed = venue.trim();
  if (trimmed === "" || trimmed === "-") return "TBA";
  return trimmed;
}

function formatExamSession(session: unknown, reporting: unknown): string {
  const sess = typeof session === "string" && session.trim() !== "" && session.trim() !== "-" ? session.trim() : null;
  const rep =
    typeof reporting === "string" && reporting.trim() !== "" && reporting.trim() !== "-" ? reporting.trim() : null;

  if (sess && rep) return `${sess} · Report: ${rep}`;
  if (sess) return sess;
  if (rep) return `Report: ${rep}`;
  return "TBA";
}

/**
 * Build Exam Schedule HTML for Image/PDF Export.
 *
 * Renders every exam in the schedule cleanly as cards (default) or as tables,
 * grouped by series (CAT1, CAT2, FAT, etc.) with complete course, timing,
 * venue, and seat information.
 */
export function generateExamScheduleHtml(params: ExamScheduleExportParams): string {
  const { scheduleObj, semester, isLight = false, layout = "cards", selectedSeries } = params;
  const rawRows = buildExamRows(scheduleObj);
  const rawTypes =
    scheduleObj && typeof scheduleObj === "object" ? Object.keys(scheduleObj as Record<string, unknown>) : [];

  const isSpecific = selectedSeries && selectedSeries !== "__all__";
  const allRows = isSpecific
    ? rawRows.filter((r) => r.examType.toLowerCase() === selectedSeries.toLowerCase())
    : rawRows;

  // Sort series chronologically by their earliest exam date
  const sortedTypes = [...rawTypes].sort((a, b) => {
    const rowA = rawRows.find((r) => r.examType === a);
    const rowB = rawRows.find((r) => r.examType === b);
    const timeA = (rowA?.startAt ?? rowA?.date)?.getTime() ?? 0;
    const timeB = (rowB?.startAt ?? rowB?.date)?.getTime() ?? 0;
    return timeA - timeB;
  });

  const examTypes = isSpecific
    ? sortedTypes.filter((t) => t.toLowerCase() === selectedSeries.toLowerCase())
    : sortedTypes;

  const formattedSemester = semester ? formatSemesterName(semester) : null;

  const containerBg = isLight ? "#ffffff" : "#090d16";
  const containerBorder = isLight ? "#cbd5e1" : "rgba(255, 255, 255, 0.1)";
  const headerBorder = isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const titleColor = isLight ? "#0f172a" : "#ffffff";
  const subtitleColor = isLight ? "#64748b" : "#94a3b8";
  const mutedColor = isLight ? "#64748b" : "#64748b";
  const cardBg = isLight ? "#ffffff" : "rgba(15, 23, 42, 0.75)";
  const cardBorder = isLight ? "#e2e8f0" : "rgba(255, 255, 255, 0.08)";
  const cardDivider = isLight ? "#f1f5f9" : "rgba(255, 255, 255, 0.06)";
  const codeColor = isLight ? "#2563eb" : "#60a5fa";
  const courseTitleColor = isLight ? "#0f172a" : "#f8fafc";
  const labelColor = isLight ? "#64748b" : "#64748b";
  const valueColor = isLight ? "#0f172a" : "#f1f5f9";
  const subValueColor = isLight ? "#64748b" : "#94a3b8";
  const slotBg = isLight ? "rgba(59, 130, 246, 0.08)" : "rgba(59, 130, 246, 0.15)";
  const slotBorder = isLight ? "rgba(59, 130, 246, 0.25)" : "rgba(59, 130, 246, 0.3)";
  const slotColor = isLight ? "#1d4ed8" : "#93c5fd";
  const statBg = isLight ? "rgba(59, 130, 246, 0.08)" : "rgba(59, 130, 246, 0.12)";
  const statBorder = isLight ? "rgba(59, 130, 246, 0.25)" : "rgba(59, 130, 246, 0.3)";
  const statLabelColor = isLight ? "#2563eb" : "#93c5fd";
  const statValColor = isLight ? "#0f172a" : "#ffffff";
  const statBg2 = isLight ? "rgba(139, 92, 246, 0.08)" : "rgba(139, 92, 246, 0.12)";
  const statBorder2 = isLight ? "rgba(139, 92, 246, 0.25)" : "rgba(139, 92, 246, 0.3)";
  const statLabelColor2 = isLight ? "#7c3aed" : "#c4b5fd";
  const statValColor2 = isLight ? "#0f172a" : "#ffffff";

  const dateStr = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  if (layout === "document" || layout === "admit_card" || layout === "hallticket") {
    return renderExamScheduleDocumentHtml({
      allRows,
      examTypes,
      semester,
      formattedSemester,
      selectedSeries,
      dateStr,
    });
  }

  const headerHtml = `
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 18px; border-bottom: 1px solid ${headerBorder};">
      <div>
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #ffffff; font-size: 10px; font-weight: 900; padding: 3px 8px; border-radius: 6px; letter-spacing: 1px; text-transform: uppercase;">
            AmazeCC
          </span>
          <span style="font-size: 11px; font-weight: 700; color: ${subtitleColor};">
            Student Initiative • Exam Timetable
          </span>
        </div>
        <h1 style="margin: 0; font-size: 26px; font-weight: 900; color: ${titleColor}; letter-spacing: -0.5px;">
          ${isSpecific ? `${escapeHtml(selectedSeries)} Exam Schedule` : "Exam Schedule"}
        </h1>
        <p style="margin: 4px 0 0; font-size: 12px; color: ${mutedColor};">
          ${formattedSemester ? `Session ${escapeHtml(formattedSemester)} • ` : ""}Exported on ${escapeHtml(dateStr)} • Built by students, for students
        </p>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <div style="background: ${statBg}; border: 1px solid ${statBorder}; border-radius: 10px; padding: 8px 14px; text-align: right;">
          <div style="font-size: 10px; font-weight: 700; color: ${statLabelColor}; text-transform: uppercase;">Total Exams</div>
          <div style="font-size: 18px; font-weight: 900; color: ${statValColor};">${allRows.length}</div>
        </div>
        <div style="background: ${statBg2}; border: 1px solid ${statBorder2}; border-radius: 10px; padding: 8px 14px; text-align: right;">
          <div style="font-size: 10px; font-weight: 700; color: ${statLabelColor2}; text-transform: uppercase;">Series</div>
          <div style="font-size: 18px; font-weight: 900; color: ${statValColor2};">${examTypes.length}</div>
        </div>
      </div>
    </div>
  `;

  if (allRows.length === 0) {
    return `
      <div style="width: 1080px; background: ${containerBg}; color: ${titleColor}; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; box-sizing: border-box; border-radius: 20px; border: 1px solid ${containerBorder}; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
        ${headerHtml}
        <div style="padding: 48px; text-align: center; color: ${mutedColor}; font-size: 14px; font-weight: 600;">
          No exam schedule data available to export.
        </div>
      </div>
    `;
  }

  const sectionsHtml = examTypes
    .map((examType) => {
      const rows = allRows.filter((r) => r.examType === examType);
      if (rows.length === 0) return "";

      const tone = seriesTone(examType);
      const toneColor = tone === "violet" ? "#8b5cf6" : tone === "sky" ? "#0ea5e9" : "#6366f1";
      const toneBg = isLight
        ? tone === "violet"
          ? "rgba(139, 92, 246, 0.1)"
          : tone === "sky"
            ? "rgba(14, 165, 233, 0.1)"
            : "rgba(99, 102, 241, 0.1)"
        : tone === "violet"
          ? "rgba(139, 92, 246, 0.2)"
          : tone === "sky"
            ? "rgba(14, 165, 233, 0.2)"
            : "rgba(99, 102, 241, 0.2)";
      const toneBorder = isLight
        ? tone === "violet"
          ? "rgba(139, 92, 246, 0.3)"
          : tone === "sky"
            ? "rgba(14, 165, 233, 0.3)"
            : "rgba(99, 102, 241, 0.3)"
        : tone === "violet"
          ? "rgba(139, 92, 246, 0.4)"
          : tone === "sky"
            ? "rgba(14, 165, 233, 0.4)"
            : "rgba(99, 102, 241, 0.4)";

      const sectionHeader = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin: 28px 0 14px 0; padding-bottom: 8px; border-bottom: 1px solid ${headerBorder};">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${toneColor};"></span>
            <span style="font-size: 17px; font-weight: 800; color: ${titleColor}; letter-spacing: -0.3px;">
              ${escapeHtml(examType)}
            </span>
          </div>
          <span style="background: ${toneBg}; color: ${toneColor}; border: 1px solid ${toneBorder}; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 9999px;">
            ${rows.length} ${rows.length === 1 ? "Exam" : "Exams"}
          </span>
        </div>
      `;

      if (layout === "table") {
        const tableRows = rows
          .map((row, idx) => {
            const subj = row.raw;
            const seatText = formatExamSeat(subj);
            const venueText = formatExamVenue(subj.venue);
            const sessionText = formatExamSession(subj.examSession, subj.reportingTime);

            const rowBg =
              idx % 2 === 0
                ? isLight
                  ? "#ffffff"
                  : "rgba(15, 23, 42, 0.4)"
                : isLight
                  ? "#f8fafc"
                  : "rgba(15, 23, 42, 0.2)";
            return `
              <tr style="background: ${rowBg}; border-bottom: 1px solid ${cardBorder}; font-size: 12px;">
                <td style="padding: 10px 12px; vertical-align: middle;">
                  <div style="font-weight: 800; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: ${codeColor}; font-size: 13px;">
                    ${escapeHtml(subj.courseCode || "")}
                  </div>
                  <div style="font-weight: 600; color: ${courseTitleColor}; margin-top: 2px; font-size: 11.5px; line-height: 1.25;">
                    ${escapeHtml(subj.courseTitle || subj.courseCode || "Untitled")}
                  </div>
                </td>
                <td style="padding: 10px 8px; text-align: center; vertical-align: middle;">
                  ${
                    subj.slot && subj.slot !== "-"
                      ? `
                    <span style="font-size: 10.5px; font-weight: 700; background: ${slotBg}; color: ${slotColor}; border: 1px solid ${slotBorder}; padding: 2px 6px; border-radius: 4px;">
                      ${escapeHtml(subj.slot)}
                    </span>
                  `
                      : `<span style="color: ${mutedColor}; font-size: 10px;">—</span>`
                  }
                </td>
                <td style="padding: 10px 10px; vertical-align: middle;">
                  <div style="font-weight: 700; color: ${valueColor};">${escapeHtml(subj.examDate || "TBA")}</div>
                  <div style="font-size: 10.5px; color: ${subValueColor}; margin-top: 1px;">${escapeHtml(subj.examTime || "TBA")}</div>
                </td>
                <td style="padding: 10px 10px; vertical-align: middle;">
                  <div style="font-weight: 600; color: ${valueColor}; font-size: 11.5px;">${escapeHtml(sessionText)}</div>
                </td>
                <td style="padding: 10px 10px; vertical-align: middle;">
                  <div style="font-weight: 700; color: ${valueColor};">${escapeHtml(venueText)}</div>
                </td>
                <td style="padding: 10px 10px; vertical-align: middle;">
                  <div style="font-weight: 600; color: ${valueColor}; font-size: 11px;">${escapeHtml(seatText)}</div>
                </td>
              </tr>
            `;
          })
          .join("");

        return `
          ${sectionHeader}
          <div style="overflow: hidden; border-radius: 12px; border: 1px solid ${cardBorder}; background: ${cardBg}; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; table-layout: fixed;">
              <colgroup>
                <col style="width: 32%;" />
                <col style="width: 10%;" />
                <col style="width: 19%;" />
                <col style="width: 15%;" />
                <col style="width: 10%;" />
                <col style="width: 14%;" />
              </colgroup>
              <thead>
                <tr style="background: ${isLight ? "#f1f5f9" : "rgba(30, 41, 59, 0.7)"}; border-bottom: 1px solid ${cardBorder}; font-size: 10.5px; font-weight: 800; color: ${subtitleColor}; text-transform: uppercase;">
                  <th style="padding: 10px 12px;">COURSE</th>
                  <th style="padding: 10px 8px; text-align: center;">SLOT</th>
                  <th style="padding: 10px 10px;">DATE &amp; TIME</th>
                  <th style="padding: 10px 10px;">SESSION</th>
                  <th style="padding: 10px 10px;">VENUE</th>
                  <th style="padding: 10px 10px;">SEAT</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        `;
      }

      // Default: cards
      const cardsHtml = rows
        .map((row) => {
          const subj = row.raw;
          const seatText = formatExamSeat(subj);
          const venueText = formatExamVenue(subj.venue);
          const sessionText = formatExamSession(subj.examSession, subj.reportingTime);

          return `
            <div style="background: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 12px; padding: 16px 18px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
              <div style="margin-bottom: 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
                  <span style="font-size: 15px; font-weight: 800; color: ${codeColor}; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; letter-spacing: 0.3px;">
                    ${escapeHtml(subj.courseCode || "")}
                  </span>
                  ${
                    subj.slot && subj.slot !== "-"
                      ? `
                    <span style="font-size: 10.5px; font-weight: 700; background: ${slotBg}; color: ${slotColor}; border: 1px solid ${slotBorder}; padding: 2px 7px; border-radius: 5px;">
                      Slot: ${escapeHtml(subj.slot)}
                    </span>
                  `
                      : ""
                  }
                </div>
                <div style="font-size: 13px; font-weight: 700; color: ${courseTitleColor}; line-height: 1.35;">
                  ${escapeHtml(subj.courseTitle || subj.courseCode || "Untitled Course")}
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px 12px; padding-top: 10px; border-top: 1px solid ${cardDivider}; font-size: 12px;">
                <div>
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: ${labelColor}; letter-spacing: 0.5px;">Date &amp; Time</div>
                  <div style="font-weight: 700; color: ${valueColor}; margin-top: 2px;">
                    ${escapeHtml(subj.examDate || "TBA")}
                  </div>
                  <div style="font-size: 11px; color: ${subValueColor}; margin-top: 1px;">
                    ${escapeHtml(subj.examTime || "TBA")}
                  </div>
                </div>
                <div>
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: ${labelColor}; letter-spacing: 0.5px;">Venue</div>
                  <div style="font-weight: 700; color: ${valueColor}; margin-top: 2px;">
                    ${escapeHtml(venueText)}
                  </div>
                </div>
                <div>
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: ${labelColor}; letter-spacing: 0.5px;">Session &amp; Reporting</div>
                  <div style="font-weight: 700; color: ${valueColor}; margin-top: 2px;">
                    ${escapeHtml(sessionText)}
                  </div>
                </div>
                <div>
                  <div style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; color: ${labelColor}; letter-spacing: 0.5px;">Seat</div>
                  <div style="font-weight: 700; color: ${valueColor}; margin-top: 2px;">
                    ${escapeHtml(seatText)}
                  </div>
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      return `
        ${sectionHeader}
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 24px;">
          ${cardsHtml}
        </div>
      `;
    })
    .join("");

  return `
    <div style="width: 1080px; background: ${containerBg}; color: ${titleColor}; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; box-sizing: border-box; border-radius: 20px; border: 1px solid ${containerBorder}; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
      ${headerHtml}
      ${sectionsHtml}
      <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid ${headerBorder}; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: ${mutedColor};">
        <span>Generated with AmazeCC • Student initiative • Always cross-check dates and venues with official VTOP notices</span>
        <span>Best of luck with your exams!</span>
      </div>
    </div>
  `;
}
