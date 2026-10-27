import type { jsPDF } from "jspdf";
import type { AddedCourse } from "@/components/custom/exams/FFCS/types";
import { COLOR_HEX_MAP, typeLabels } from "@/components/custom/exams/FFCS/constants";
import { expandCourseHalves, sameSlotFacultyAlternatives } from "@/components/custom/exams/FFCS/logic/generate";
import { ensureLunchPeriod } from "@/lib/slots";
import type { ModernPrintableReportParams } from "./exportTimetable";

export type DossierGridMode = "vector" | "image";

const PAGE_W = 210;
const PAGE_H = 297;
// The 38px inset is the dossier's 28px card padding plus its 10px border rhythm,
// converted at 96dpi and rounded to a print-friendly value.
const INSET = 10;
const CONTENT_X = 18;
const CONTENT_W = PAGE_W - CONTENT_X * 2;
const CONTENT_TOP = 18;
const CONTENT_BOTTOM = 277;
const DEFAULT_DAYS = [
  { id: "mon", name: "Monday" }, { id: "tue", name: "Tuesday" },
  { id: "wed", name: "Wednesday" }, { id: "thu", name: "Thursday" },
  { id: "fri", name: "Friday" },
];

type Palette = {
  band: string; surface: string; panel: string; border: string; text: string;
  muted: string; accent: string; accent2: string; soft: string; empty: string;
};

function palette(light: boolean): Palette {
  return light
    ? { band: "#e8eef7", surface: "#ffffff", panel: "#f8fafc", border: "#cbd5e1", text: "#0f172a", muted: "#64748b", accent: "#2563eb", accent2: "#7c3aed", soft: "#eff6ff", empty: "#f8fafc" }
    : { band: "#090d16", surface: "#0f172a", panel: "#172033", border: "#334155", text: "#f8fafc", muted: "#94a3b8", accent: "#60a5fa", accent2: "#a78bfa", soft: "#172554", empty: "#111827" };
}

function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

function color(pdf: jsPDF, method: "setTextColor" | "setDrawColor" | "setFillColor", hex: string) {
  pdf[method](...rgb(hex));
}

function groupCourses(courses: AddedCourse[]) {
  const groups = new Map<string, AddedCourse & { batches: string[] }>();
  for (const course of courses) {
    const current = groups.get(course.code);
    if (!current) {
      groups.set(course.code, { ...course, slots: [...course.slots], batches: course.batch ? course.batch.split(",").map(x => x.trim()).filter(Boolean) : [] });
      continue;
    }
    if (course.faculty && !current.faculty.includes(course.faculty)) current.faculty = [current.faculty, course.faculty].filter(Boolean).join(" / ");
    if (course.venue && !current.venue.includes(course.venue)) current.venue = [current.venue, course.venue].filter(Boolean).join(" / ");
    if (course.type && !current.type.includes(course.type)) current.type = [current.type, course.type].filter(Boolean).join(" + ");
    for (const slot of course.slots) if (!current.slots.includes(slot)) current.slots.push(slot);
    for (const batch of (course.batch || "").split(",").map(x => x.trim()).filter(Boolean)) if (!current.batches.includes(batch)) current.batches.push(batch);
    current.credits = String((parseFloat(current.credits || "0") || 0) + (parseFloat(course.credits || "0") || 0));
  }
  return [...groups.values()];
}

function wrap(pdf: jsPDF, value: string, width: number, size: number): string[] {
  pdf.setFontSize(size);
  return pdf.splitTextToSize(value || "-", width) as string[];
}

function drawSectionTitle(pdf: jsPDF, title: string, subtitle: string, y: number, theme: Palette): number {
  color(pdf, "setTextColor", theme.text);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.text(title, CONTENT_X, y);
  color(pdf, "setTextColor", theme.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7.5);
  pdf.text(subtitle, CONTENT_X, y + 4.5);
  color(pdf, "setDrawColor", theme.border);
  pdf.setLineWidth(0.25);
  pdf.line(CONTENT_X, y + 7, CONTENT_X + CONTENT_W, y + 7);
  return y + 12;
}

function makeGridHtml(params: ModernPrintableReportParams, theme: Palette): string {
  const days = params.days?.length ? params.days : DEFAULT_DAYS;
  const theoryPeriods = ensureLunchPeriod(params.theoryPeriods);
  const labPeriods = ensureLunchPeriod(params.labPeriods);
  const periods = Math.max(theoryPeriods.length, labPeriods.length);
  const cell = (dayId: string, index: number, dayIndex: number) => {
    const theory = theoryPeriods[index]?.days?.[dayId];
    const lab = labPeriods[index]?.days?.[dayId];
    if (theoryPeriods[index]?.lunch) return dayIndex > 0 ? "" : `<td rowspan="${days.length}" style="border:1px solid #f59e0b;background:#f59e0b22;padding:3px;font-size:8px;color:#b45309;vertical-align:middle;text-align:center;font-weight:bold;writing-mode:vertical-rl">LUNCH&nbsp;&nbsp;1:20-2:00</td>`;
    const half = (slot?: string) => {
      if (!slot) return "";
      const course = params.courses.find(item => item.slots.includes(slot));
      if (!course) return escapeHtml(slot);
      const colorHex = COLOR_HEX_MAP[course.color] || "#2563eb";
      return `<div style="border:1px solid ${colorHex}77;background:${colorHex}22;margin:1px;padding:2px;border-radius:3px;font-weight:bold">${escapeHtml(course.code)} / ${escapeHtml(slot)}<br><span style="font-weight:normal">${escapeHtml(course.venue || "TBA")}</span></div>`;
    };
    return `<td style="border:1px solid ${theme.border};background:${theme.empty};height:44px;padding:2px;font-size:8px;color:${theme.text};vertical-align:middle;text-align:center">${half(theory)}${half(lab)}</td>`;
  };
  const lunchIndex = theoryPeriods.findIndex(period => period?.lunch);
  const header = Array.from({ length: periods }, (_, i) => theoryPeriods[i]?.lunch
    ? `<th style="background:#f59e0b22;border:1px solid #f59e0b55;padding:5px 2px;font-size:8px;color:#b45309">LUNCH<br>1:20-2:00</th>`
    : `<th style="background:${theme.panel};border:1px solid ${theme.border};padding:5px 2px;font-size:9px;color:${theme.accent}">P${lunchIndex >= 0 && i > lunchIndex ? i : i + 1}<br>${theoryPeriods[i]?.start || ""}</th>`).join("");
  const rows = days.map((day, dayIndex) => `<tr><th style="background:${theme.panel};border:1px solid ${theme.border};padding:4px;font-size:9px;color:${theme.text}">${escapeHtml(day.name.slice(0, 3).toUpperCase())}</th>${Array.from({ length: periods }, (_, i) => cell(day.id, i, dayIndex)).join("")}</tr>`).join("");
  return `<div style="width:1060px;font-family:Arial,sans-serif;background:${theme.surface};color:${theme.text};padding:8px"><div style="font-size:14px;font-weight:bold;padding:8px 4px">Modern Horizontal Timetable / ${escapeHtml(params.timetableName)}</div><table style="border-collapse:collapse;width:100%;table-layout:fixed"><thead><tr><th style="background:${theme.panel};border:1px solid ${theme.border};padding:5px;color:${theme.text}">DAY</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function gridImage(params: ModernPrintableReportParams, theme: Palette): Promise<string> {
  const htmlToImage = await import("html-to-image");
  const node = document.createElement("div");
  node.style.cssText = "position:fixed;left:-20000px;top:0;width:1080px;z-index:-1";
  node.innerHTML = makeGridHtml(params, theme);
  document.body.appendChild(node);
  try {
    return await htmlToImage.toPng(node.firstElementChild as HTMLElement, { pixelRatio: 2, backgroundColor: theme.surface });
  } finally {
    node.remove();
  }
}

function addPage(pdf: jsPDF, theme: Palette, pageNumber: number) {
  if (pageNumber > 1) pdf.addPage("a4", "portrait");
  color(pdf, "setFillColor", theme.band);
  pdf.rect(0, 0, PAGE_W, PAGE_H, "F");
  color(pdf, "setFillColor", theme.surface);
  color(pdf, "setDrawColor", theme.border);
  pdf.setLineWidth(0.25);
  pdf.roundedRect(INSET, INSET, PAGE_W - INSET * 2, PAGE_H - INSET * 2, 2.5, 2.5, "FD");
  color(pdf, "setTextColor", theme.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("AmazeCC FFCS Dossier", CONTENT_X, 284);
  pdf.text(`Page ${pageNumber}`, PAGE_W - CONTENT_X, 284, { align: "right" });
}

function drawVectorGrid(pdf: jsPDF, params: ModernPrintableReportParams, theme: Palette, y: number): number {
  const days = params.days?.length ? params.days : DEFAULT_DAYS;
  const theoryPeriods = ensureLunchPeriod(params.theoryPeriods);
  const labPeriods = ensureLunchPeriod(params.labPeriods);
  const periodCount = Math.max(theoryPeriods.length, labPeriods.length);
  if (!periodCount) {
    color(pdf, "setTextColor", theme.muted);
    pdf.setFontSize(8);
    pdf.text("No timetable periods were provided.", CONTENT_X, y + 6);
    return y + 15;
  }
  const dayW = 12;
  const colW = (CONTENT_W - dayW) / periodCount;
  const headerH = 13;
  const rowH = Math.min(12.5, Math.max(9.2, (CONTENT_BOTTOM - y - 30) / days.length));
  pdf.setFillColor(...rgb(theme.panel));
  pdf.setDrawColor(...rgb(theme.border));
  pdf.setTextColor(...rgb(theme.accent));
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(5.8);
  pdf.rect(CONTENT_X, y, dayW, headerH, "FD");
  pdf.text("DAY", CONTENT_X + dayW / 2, y + 6.1, { align: "center" });
  for (let col = 0; col < periodCount; col++) {
    const x = CONTENT_X + dayW + col * colW;
    pdf.setFillColor(...rgb(theoryPeriods[col]?.lunch ? "#fef3c7" : theme.panel));
    pdf.setDrawColor(...rgb(theoryPeriods[col]?.lunch ? "#f59e0b" : theme.border));
    pdf.rect(x, y, colW, headerH, "FD");
    const period = theoryPeriods[col] || labPeriods[col];
    if (theoryPeriods[col]?.lunch) {
      pdf.setTextColor(180, 83, 9);
      pdf.setFontSize(5.9);
      pdf.text("LUNCH", x + colW / 2, y + 5, { align: "center" });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(4.2);
      pdf.text("1:20-2:00", x + colW / 2, y + 10, { align: "center" });
    } else {
      const lunchIndex = theoryPeriods.findIndex(item => item?.lunch);
      pdf.setTextColor(...rgb(theme.accent));
      pdf.setFontSize(6.3);
      pdf.text(`P${lunchIndex >= 0 && col > lunchIndex ? col : col + 1}`, x + colW / 2, y + 5, { align: "center" });
      pdf.setTextColor(...rgb(theme.muted));
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(5.7);
      pdf.text(period?.start || "", x + colW / 2, y + 10.2, { align: "center", maxWidth: colW - 1.2 });
    }
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(5.8);
  }
  days.forEach((day, row) => {
    const rowY = y + headerH + row * rowH;
    color(pdf, "setFillColor", theme.panel);
    color(pdf, "setTextColor", theme.text);
    pdf.rect(CONTENT_X, rowY, dayW, rowH, "FD");
    pdf.setFontSize(5.2);
    pdf.text(day.name.slice(0, 3).toUpperCase(), CONTENT_X + dayW / 2, rowY + rowH / 2 + 1.5, { align: "center" });
    for (let col = 0; col < periodCount; col++) {
      const x = CONTENT_X + dayW + col * colW;
      const theoryPeriod = theoryPeriods[col];
      const theorySlot = theoryPeriod?.days?.[day.id];
      const labSlot = labPeriods[col]?.days?.[day.id];
      const theoryCourse = theorySlot ? params.courses.find(item => item.slots.includes(theorySlot)) : undefined;
      const labCourse = labSlot ? params.courses.find(item => item.slots.includes(labSlot)) : undefined;
      if (theoryPeriod?.lunch) {
        if (row === 0) {
          const lunchY = y + headerH;
          const lunchH = days.length * rowH;
          pdf.setFillColor(254, 243, 199);
          pdf.setDrawColor(245, 158, 11);
          pdf.rect(x, lunchY, colW, lunchH, "FD");
          pdf.setTextColor(180, 83, 9);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7);
          pdf.text("LUNCH", x + colW / 2, lunchY + lunchH / 2 - 3, { align: "center", angle: 90 });
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(5.2);
          pdf.text("1:20-2:00", x + colW / 2, lunchY + lunchH / 2 + 16, { align: "center", angle: 90 });
        }
        continue;
      }
      color(pdf, "setFillColor", theme.empty);
      color(pdf, "setDrawColor", theme.border);
      pdf.rect(x, rowY, colW, rowH, "FD");
      if (theoryCourse || labCourse || theorySlot || labSlot) {
        const halves = [
          { slot: theorySlot, course: theoryCourse },
          { slot: labSlot, course: labCourse },
        ].filter(half => half.slot || half.course);
        halves.slice(0, 2).forEach((half, halfIndex) => {
          const halfHeight = rowH / halves.length;
          const centerY = rowY + halfIndex * halfHeight + halfHeight / 2;
          color(pdf, "setTextColor", half.course ? (COLOR_HEX_MAP[half.course.color] || theme.accent) : theme.muted);
          pdf.setFont("helvetica", half.course ? "bold" : "normal");
          const codeSize = Math.min(5, Math.max(4.7, colW * 0.34));
          pdf.setFontSize(codeSize);
          pdf.text(half.course?.code || half.slot || "", x + colW / 2, centerY - 0.55, { align: "center", maxWidth: colW - 1.2 });
          if (half.course && half.slot) {
            color(pdf, "setTextColor", theme.muted);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(4.5);
            pdf.text(half.slot, x + colW / 2, centerY + 1.65, { align: "center", maxWidth: colW - 1.2 });
          }
        });
      }
    }
  });
  return y + headerH + days.length * rowH;
}

export async function createPortraitDossierPdf(params: ModernPrintableReportParams & { theme?: "light" | "dark"; gridMode?: DossierGridMode }): Promise<ArrayBuffer> {
  const light = params.theme === "light" || (!params.theme && Boolean(params.themeHtmlClass?.includes("light") && !params.themeHtmlClass?.includes("dark")));
  const theme = palette(light);
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title: `${params.timetableName} - FFCS Registration Dossier`, subject: "Portrait A4 timetable dossier", creator: "AmazeCC" });
  const groups = groupCourses(params.courses);
  const credits = params.totalCredits ?? groups.reduce((sum, item) => sum + (parseFloat(item.credits || "0") || 0), 0);
  let pageNumber = 1;
  let y = CONTENT_TOP;
  addPage(pdf, theme, pageNumber);
  const newPage = () => { pageNumber += 1; addPage(pdf, theme, pageNumber); y = CONTENT_TOP; };

  // Cover header and compact registration summary. Shrink titles until one
  // line fits, then add banner height for any remaining wrapped lines.
  const title = params.timetableName || "Timetable";
  let titleSize = 18;
  let titleLines: string[] = [];
  do {
    titleLines = wrap(pdf, title, 108, titleSize);
    if (titleLines.length <= 1 || titleSize <= 9) break;
    titleSize -= 1;
  } while (titleSize >= 9);
  const titleLineStep = Math.max(4.8, titleSize * 0.42);
  const bannerHeight = Math.max(32, 27 + Math.max(0, titleLines.length - 1) * titleLineStep);
  color(pdf, "setFillColor", theme.soft);
  color(pdf, "setDrawColor", theme.border);
  pdf.roundedRect(CONTENT_X, y, CONTENT_W, bannerHeight, 2, 2, "FD");
  color(pdf, "setFillColor", theme.accent);
  pdf.roundedRect(CONTENT_X + 4, y + 4, 2, bannerHeight - 8, 0.8, 0.8, "F");
  color(pdf, "setTextColor", theme.accent);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("OFFICIAL REGISTRATION DOSSIER", CONTENT_X + 10, y + 8);
  color(pdf, "setTextColor", theme.text);
  pdf.setFontSize(titleSize);
  pdf.text(titleLines, CONTENT_X + 10, y + 16, { lineHeightFactor: 1.05 });
  color(pdf, "setTextColor", theme.muted);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(7);
  pdf.text("Vellore Institute of Technology, Chennai", CONTENT_X + 10, y + bannerHeight - 4.5);
  color(pdf, "setTextColor", theme.accent2);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text(`${groups.length} COURSES  |  ${credits} CREDITS`, CONTENT_X + CONTENT_W - 5, y + 12, { align: "right" });
  color(pdf, "setTextColor", theme.muted);
  pdf.setFont("helvetica", "normal");
  pdf.text(new Date().toLocaleDateString(), CONTENT_X + CONTENT_W - 5, y + 18, { align: "right" });
  y += bannerHeight + 6;

  y = drawSectionTitle(pdf, "Weekly Academic Schedule", "Modern horizontal timetable / fitted to portrait A4", y, theme);
  if (params.gridMode === "image") {
    const data = await gridImage(params, theme);
    const dims = pdf.getImageProperties(data);
    const scale = Math.min(CONTENT_W / dims.width, (CONTENT_BOTTOM - y) / dims.height);
    const w = dims.width * scale;
    const h = dims.height * scale;
    pdf.addImage(data, "PNG", CONTENT_X + (CONTENT_W - w) / 2, y, w, h, undefined, "FAST");
    y += h;
  } else {
    y = drawVectorGrid(pdf, params, theme, y);
  }
  y += 7;

  // Course register: split cleanly across pages; every label/value remains text.
  if (y + 28 > CONTENT_BOTTOM) newPage();
  y = drawSectionTitle(pdf, "Enrolled Courses & Faculty", "Course, registration type, credits, slots, venue and faculty", y, theme);
  const columns = [25, 51, 20, 12, 23, 22, 18];
  const headers = ["CODE", "COURSE", "TYPE", "CR", "SLOTS", "VENUE", "FACULTY"];
  const drawCourseTableHeader = () => {
    pdf.setFont("helvetica", "bold");
    let headerX = CONTENT_X;
    headers.forEach((label, i) => {
      pdf.setFillColor(...rgb(theme.panel));
      pdf.setDrawColor(...rgb(theme.border));
      pdf.rect(headerX, y, columns[i], 8, "FD");
      pdf.setTextColor(...rgb(theme.text));
      pdf.setFontSize(6.2);
      pdf.text(label, headerX + 1.2, y + 5.3);
      headerX += columns[i];
    });
    y += 8;
  };
  const continueCourseTable = () => {
    newPage();
    y = drawSectionTitle(pdf, "Enrolled Courses & Faculty (continued)", "Course details continue on this page", y, theme);
    drawCourseTableHeader();
  };
  drawCourseTableHeader();
  for (let index = 0; index < groups.length; index++) {
    const item = groups[index];
    const values = [item.code, item.title, typeLabels[item.type] || item.type || "Theory", item.credits || "0", item.slots.join(", "), item.venue || "TBA", item.faculty || "TBA"];
    const wrapped = values.map((value, i) => wrap(pdf, value, columns[i] - 2.5, 5.8));
    const lineCount = Math.max(1, ...wrapped.map(lines => lines.length));
    let lineOffset = 0;
    while (lineOffset < lineCount) {
      const availableLines = Math.floor((CONTENT_BOTTOM - y - 3) / 3.25);
      if (availableLines < 1) {
        continueCourseTable();
        continue;
      }
      const chunkLines = Math.min(lineCount - lineOffset, availableLines);
      const rowHeight = Math.max(lineCount === 1 ? 9.5 : 0, chunkLines * 3.25 + 3);
      color(pdf, "setFillColor", index % 2 === 0 ? theme.surface : theme.panel);
      color(pdf, "setDrawColor", theme.border);
      pdf.rect(CONTENT_X, y, CONTENT_W, rowHeight, "FD");
      let cellX = CONTENT_X;
      wrapped.forEach((lines, i) => {
        const slice = lines.slice(lineOffset, lineOffset + chunkLines);
        if (slice.length) {
          color(pdf, "setTextColor", i === 0 ? (COLOR_HEX_MAP[item.color] || theme.accent) : theme.text);
          pdf.setFont("helvetica", i === 0 ? "bold" : "normal");
          pdf.setFontSize(5.8);
          pdf.text(slice, cellX + 1.2, y + 3.8, { lineHeightFactor: 1.1 });
        }
        cellX += columns[i];
      });
      y += rowHeight;
      lineOffset += chunkLines;
      if (lineOffset < lineCount) continueCourseTable();
    }
  }
  y += 6;

  if (y + 20 > CONTENT_BOTTOM) newPage();
  const faculty = new Map<string, { name: string; codes: Set<string>; ids: Set<string> }>();
  params.courses.forEach(course => {
    const names = (course.faculty || "TBA").split(/\s*\/\s*/).filter(Boolean);
    names.forEach((name, i) => {
      const key = `${name.toLowerCase()}|${course.employeeId || ""}`;
      if (!faculty.has(key)) faculty.set(key, { name, codes: new Set(), ids: new Set() });
      faculty.get(key)!.codes.add(course.code);
      if (course.employeeId) faculty.get(key)!.ids.add(course.employeeId);
    });
  });
  y = drawSectionTitle(pdf, "Faculty Dossier", "Faculty attached to selected courses", y, theme);
  for (const entry of faculty.values()) {
    const nameLines = wrap(pdf, entry.name, 70, 6.5);
    const courseLines = wrap(pdf, `Courses: ${[...entry.codes].join(", ")}`, CONTENT_W - 80, 5.8);
    const lineCount = Math.max(nameLines.length, courseLines.length);
    let lineOffset = 0;
    while (lineOffset < lineCount) {
      const availableLines = Math.floor((CONTENT_BOTTOM - y - 3) / 3.4);
      if (availableLines < 1) {
        newPage();
        y = drawSectionTitle(pdf, "Faculty Dossier (continued)", "Faculty attached to selected courses", y, theme);
        continue;
      }
      const chunkLines = Math.min(lineCount - lineOffset, availableLines);
      const height = Math.max(8, chunkLines * 3.4 + 3);
      color(pdf, "setFillColor", theme.panel);
      color(pdf, "setDrawColor", theme.border);
      pdf.roundedRect(CONTENT_X, y, CONTENT_W, height, 1.2, 1.2, "FD");
      const namePart = nameLines.slice(lineOffset, lineOffset + chunkLines);
      const coursePart = courseLines.slice(lineOffset, lineOffset + chunkLines);
      if (namePart.length) {
        color(pdf, "setTextColor", theme.text);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.5);
        pdf.text(namePart, CONTENT_X + 2, y + 4.5, { lineHeightFactor: 1.05 });
      }
      if (coursePart.length) {
        color(pdf, "setTextColor", theme.muted);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(5.8);
        pdf.text(coursePart, CONTENT_X + 78, y + 4.5, { lineHeightFactor: 1.05 });
      }
      y += height;
      lineOffset += chunkLines;
      if (lineOffset < lineCount) {
        newPage();
        y = drawSectionTitle(pdf, "Faculty Dossier (continued)", "Faculty attached to selected courses", y, theme);
      }
    }
  }
  y += 5;

  if (y + 23 > CONTENT_BOTTOM) newPage();
  y = drawSectionTitle(pdf, "Emergency Drop-In Replacements", "Same-slot faculty alternatives from the master course catalog", y, theme);
  if (!params.masterCourses?.length) {
    color(pdf, "setTextColor", theme.muted);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("Load the master FFCS catalog to discover matching-slot alternatives.", CONTENT_X, y + 2);
    y += 9;
  } else {
    const halves = expandCourseHalves(params.courses);
    for (const half of halves) {
      const candidates = sameSlotFacultyAlternatives(half.code, half.slots, { faculty: half.faculty, employeeId: half.employeeId }, params.masterCourses);
      const text = `${half.code} / ${half.slots.join("+")} / Current: ${half.faculty || "TBA"} / Alternatives: ${candidates.map(c => `${c.FACULTY} (${c.ROOM || "TBA"})`).join(", ") || "No matching faculty found"}`;
      const lines = wrap(pdf, text, CONTENT_W - 6, 6);
      let lineOffset = 0;
      while (lineOffset < lines.length) {
        const availableLines = Math.floor((CONTENT_BOTTOM - y - 3) / 3.4);
        if (availableLines < 1) {
          newPage();
          y = drawSectionTitle(pdf, "Emergency Drop-In Replacements (continued)", "Same-slot faculty alternatives from the master course catalog", y, theme);
          continue;
        }
        const chunkLines = Math.min(lines.length - lineOffset, availableLines);
        const segment = lines.slice(lineOffset, lineOffset + chunkLines);
        const height = Math.max(8, segment.length * 3.4 + 3);
        color(pdf, "setFillColor", theme.panel);
        color(pdf, "setDrawColor", theme.border);
        pdf.roundedRect(CONTENT_X, y, CONTENT_W, height, 1, 1, "FD");
        color(pdf, "setTextColor", theme.text);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6);
        pdf.text(segment, CONTENT_X + 3, y + 4, { lineHeightFactor: 1.1 });
        y += height + 2;
        lineOffset += chunkLines;
        if (lineOffset < lines.length) {
          newPage();
          y = drawSectionTitle(pdf, "Emergency Drop-In Replacements (continued)", "Same-slot faculty alternatives from the master course catalog", y, theme);
        }
      }
    }
  }

  return pdf.output("arraybuffer");
}

