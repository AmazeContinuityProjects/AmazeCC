import * as htmlToImage from "html-to-image";
import type { AddedCourse, TimetablePeriod } from "@/components/custom/exams/FFCS/types";
import { buildVerticalGrid } from "@/components/custom/timetable";
import { COLOR_HEX_MAP, typeLabels } from "@/components/custom/exams/FFCS/constants";
import { getFacultyReview } from "./vitfacService";
import { hasSlot } from "./slots";

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
  daysList: { id: string; name: string }[]
): string {
  const vGrid = buildVerticalGrid({
    courses,
    theoryPeriods,
    labPeriods,
    days: daysList,
  });

  const headerCells = daysList
    .map(
      (d) => `
    <th style="padding: 10px 8px; font-size: 12px; font-weight: 800; color: #93c5fd; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">
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
          <td colspan="${daysList.length + 1}" style="background: rgba(245, 158, 11, 0.12); border: 1px dashed rgba(245, 158, 11, 0.3); text-align: center; color: #fbbf24; font-size: 11px; font-weight: 800; letter-spacing: 1px; border-radius: 6px;">
            🍽️ LUNCH BREAK · 1:20 PM – 2:00 PM
          </td>
        </tr>
      `;
      }

      const timeCol = `
      <td style="padding: 6px 10px; font-size: 11px; font-weight: 700; color: #94a3b8; border: 1px solid rgba(255,255,255,0.06); background: rgba(15, 23, 42, 0.6); white-space: nowrap; vertical-align: top; text-align: center; width: 110px;">
        <span style="color: #f1f5f9; display: block; font-size: 11px;">${escapeHtml(band.start)}</span>
        <span style="color: #64748b; font-size: 10px;">${escapeHtml(band.end)}</span>
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
            return `
          <td rowspan="${rowSpan}" style="padding: 4px; border: 1px solid rgba(255,255,255,0.06); vertical-align: top; width: calc((100% - 110px) / ${daysList.length});">
            <div style="background: ${colorHex}26; border: 1px solid ${colorHex}88; border-left: 4px solid ${colorHex}; border-radius: 6px; padding: 6px 8px; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 3px;">
                  <span style="background: ${colorHex}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 2px 5px; border-radius: 4px; letter-spacing: 0.3px;">
                    ${escapeHtml(c.code)}
                  </span>
                  <span style="font-size: 10px; font-weight: 700; color: #cbd5e1; background: rgba(0,0,0,0.35); padding: 1px 5px; border-radius: 4px;">
                    ${escapeHtml(slotText)}
                  </span>
                </div>
                <div style="font-size: 11px; font-weight: 600; color: #f8fafc; line-height: 1.25; margin-bottom: 4px;">
                  ${escapeHtml(c.title)}
                </div>
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: #94a3b8; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 3px; margin-top: 3px;">
                <span style="font-weight: 600; color: #cbd5e1;">${escapeHtml(c.venue || "TBA")}</span>
                <span style="max-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(c.faculty?.split("/")[0]?.trim() || "")}</span>
              </div>
            </div>
          </td>
        `;
          }
          return `
        <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.04); background: rgba(15, 23, 42, 0.3); vertical-align: top; width: calc((100% - 110px) / ${daysList.length});">
          <div style="height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 4px; border: 1px dashed rgba(255,255,255,0.04);">
            <span style="color: #334155; font-size: 10px;">—</span>
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
    <div style="overflow: hidden; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: #0c1222; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr>
            <th style="padding: 10px 8px; font-size: 12px; font-weight: 800; color: #94a3b8; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); text-align: center; width: 110px;">
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
  daysList: { id: string; name: string }[]
): string {
  const numPeriods = Math.max(theoryPeriods.length, labPeriods.length);

  const thHeaders: string[] = [];
  for (let i = 0; i < numPeriods; i++) {
    const tp = theoryPeriods[i];
    if (tp?.lunch) {
      thHeaders.push(`
        <th style="padding: 8px 4px; font-size: 10px; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.25); text-align: center; width: 44px; vertical-align: middle;">
          LUNCH
        </th>
      `);
    } else {
      const pNum = i < 6 ? i + 1 : i;
      thHeaders.push(`
        <th style="padding: 6px 4px; font-size: 10px; font-weight: 700; color: #93c5fd; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); text-align: center; min-width: 95px;">
          P${pNum} <span style="font-weight: 400; color: #cbd5e1; font-size: 9px;">(${escapeHtml(tp?.start || "")})</span>
        </th>
      `);
    }
  }

  const dayRowsHtml = daysList
    .map((day) => {
      const periodCells: string[] = [];
      for (let i = 0; i < numPeriods; i++) {
        const tp = theoryPeriods[i];
        const lp = labPeriods[i];
        if (tp?.lunch) {
          periodCells.push(`
          <td style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.15); text-align: center; color: #fbbf24; font-size: 10px; font-weight: 700;">
            ·
          </td>
        `);
        } else {
          const theorySlot = tp?.days?.[day.id];
          const labSlot = lp?.days?.[day.id];

          const tCourse = theorySlot ? courses.find((c) => hasSlot(c.slots, theorySlot)) : null;
          const lCourse = labSlot ? courses.find((c) => hasSlot(c.slots, labSlot)) : null;

          const renderHalf = (slotName?: string, course?: AddedCourse | null) => {
            if (!slotName) return `<div style="height: 28px;"></div>`;
            if (course) {
              const colorHex = COLOR_HEX_MAP[course.color] || "#2563eb";
              return `
              <div style="background: ${colorHex}33; border: 1px solid ${colorHex}88; border-radius: 4px; padding: 3px 5px; margin: 2px 0;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 2px;">
                  <span style="font-size: 10px; font-weight: 800; color: #ffffff;">${escapeHtml(course.code)}</span>
                  <span style="font-size: 8px; font-weight: 700; color: #cbd5e1; background: rgba(0,0,0,0.3); padding: 0 3px; border-radius: 2px;">${escapeHtml(slotName)}</span>
                </div>
                <div style="font-size: 8px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(course.venue || "TBA")}</div>
              </div>
            `;
            }
            return `
            <div style="display: flex; align-items: center; justify-content: center; height: 26px; border: 1px dashed rgba(255,255,255,0.05); border-radius: 4px; margin: 2px 0;">
              <span style="font-size: 9px; color: #475569; font-weight: 600;">${escapeHtml(slotName)}</span>
            </div>
          `;
          };

          periodCells.push(`
          <td style="padding: 4px; border: 1px solid rgba(255,255,255,0.06); background: rgba(15, 23, 42, 0.4); vertical-align: top;">
            ${renderHalf(theorySlot, tCourse)}
            ${renderHalf(labSlot, lCourse)}
          </td>
        `);
        }
      }

      return `
      <tr>
        <td style="padding: 8px 6px; font-size: 11px; font-weight: 800; color: #f8fafc; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); text-align: center; text-transform: uppercase;">
          ${escapeHtml(day.name.slice(0, 3))}
        </td>
        ${periodCells.join("")}
      </tr>
    `;
    })
    .join("");

  return `
    <div style="overflow-x: auto; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: #0c1222; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr>
            <th style="padding: 8px 6px; font-size: 11px; font-weight: 800; color: #94a3b8; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.08); text-align: center; width: 65px;">
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
  groupedCourses: (AddedCourse & { ids: string[]; batches: string[] })[]
): string {
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
            const text = isGreen ? "#34d399" : isAmber ? "#fbbf24" : "#f87171";
            const metricsStr = rev.metrics
              ? `<span style="font-size: 10px; color: #94a3b8; margin-left: 6px;">Vibe: ${rev.metrics.vibe.toFixed(1)} · DA: ${rev.metrics.da.toFixed(1)}</span>`
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
            <span style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); color: #64748b; font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 4px; margin-top: 2px; display: inline-block;">
              Unreviewed
            </span>
          `;
          }
          return `
          <div style="margin-bottom: 4px;">
            <div style="font-weight: 700; color: #f1f5f9; font-size: 12px;">${escapeHtml(fac)}</div>
            ${badgeHtml}
          </div>
        `;
        })
        .join("");

      const slotPills = c.slots
        .map(
          (s) =>
            `<span style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; margin-right: 3px; display: inline-block;">${escapeHtml(s)}</span>`
        )
        .join("");

      return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); background: ${
        idx % 2 === 0 ? "rgba(15, 23, 42, 0.4)" : "rgba(15, 23, 42, 0.2)"
      };">
        <td style="padding: 10px 8px; font-size: 12px; font-weight: 700; color: #64748b; text-align: center; vertical-align: middle;">
          ${idx + 1}
        </td>
        <td style="padding: 10px 12px; vertical-align: middle;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: ${colorHex}; color: #ffffff; font-size: 11px; font-weight: 800; padding: 3px 7px; border-radius: 5px; letter-spacing: 0.5px;">
              ${escapeHtml(c.code)}
            </span>
            <div>
              <div style="font-weight: 700; color: #ffffff; font-size: 12px;">${escapeHtml(c.title)}</div>
              ${
                c.batches && c.batches.length > 0
                  ? `<div style="font-size: 10px; color: #38bdf8; font-weight: 600;">Batch: ${escapeHtml(
                      c.batches.join(", ")
                    )}</div>`
                  : ""
              }
            </div>
          </div>
        </td>
        <td style="padding: 10px 8px; font-size: 11px; color: #93c5fd; font-weight: 600; vertical-align: middle;">
          ${escapeHtml(typeLabel)}
        </td>
        <td style="padding: 10px 8px; font-size: 12px; font-weight: 800; color: #f8fafc; text-align: center; vertical-align: middle;">
          ${escapeHtml(c.credits || "0")}
        </td>
        <td style="padding: 10px 8px; vertical-align: middle;">
          ${slotPills}
        </td>
        <td style="padding: 10px 8px; font-size: 11px; color: #cbd5e1; font-weight: 600; vertical-align: middle;">
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
    <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 18px 20px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 14px; font-weight: 800; color: #ffffff;">📋 ENROLLED COURSES &amp; FACULTY REVIEWS</span>
          <span style="font-size: 11px; color: #94a3b8;">(Vitfac Sentiment &amp; Ratings)</span>
        </div>
      </div>
      <table style="width: 100%; border-collapse: collapse; text-align: left;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">
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

export function openTimetablePrintablePage(
  htmlContent: string,
  timetableName: string,
  themeHtmlClass: string,
  _themeBgColor: string,
  themeTextColor: string
): Window | null {
  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((el) => el.outerHTML)
    .join("\n");

  const isDarkMode = themeHtmlClass.includes("dark");
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
        <html class="${escapeHtml(themeHtmlClass)}">
      <head>
        <title>${escapeHtml(timetableName)} - Timetable</title>
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
            color: ${themeTextColor};
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
            <span style="font-weight:700;font-size:16px;background:${accentGrad};-webkit-background-clip:text;-webkit-text-fill-color:transparent">${escapeHtml(timetableName)}</span>
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
