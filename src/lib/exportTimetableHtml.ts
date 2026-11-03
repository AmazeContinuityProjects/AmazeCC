import type { AddedCourse, TimetablePeriod } from "@/lib/ffcsTypes";
import { buildVerticalGrid } from "@/components/custom/timetable";
import { COLOR_HEX_MAP, typeLabels } from "@/lib/ffcsConstants";
import { getFacultyReview, isVitfacIntegrationEnabled } from "./vitfacService";
import { ensureLunchPeriod, hasSlot } from "./slots";

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

  const headerCells = daysList
    .map(
      (d) => `
    <th style="padding: 10px 8px; font-size: 12px; font-weight: 800; color: ${thColor}; background: ${thBg}; border: 1px solid ${borderColor}; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
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
