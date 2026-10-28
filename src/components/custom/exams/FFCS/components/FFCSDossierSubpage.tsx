"use client";

import React, { useState, useMemo } from "react";
import { useOverlayBack } from "@/lib/overlayStack";
import {
  ArrowLeft,
  Printer,
  Sun,
  Moon,
  LayoutGrid,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  BookOpen,
  Award,
  Users,
  Clock,
  MapPin,
  Calendar,
  Download,
  Loader2,
} from "lucide-react";
import ModernHorizontalTimetableGrid from "../../../timetable/ModernHorizontalTimetableGrid";
import VerticalTimetableGrid from "../../../timetable/VerticalTimetableGrid";
import type { AddedCourse, TimetablePeriod, ParsedCourse, TimetableState } from "../types";
import { COLOR_HEX_MAP, typeLabels, getCourseBadgeProps } from "../constants";
import { getFacultyReview, getVitfacProfileUrl } from "@/lib/vitfacService";
import { sameSlotFacultyAlternatives, expandCourseHalves } from "../logic/generate";
import { downloadModernDossierHtml } from "@/lib/exportTimetable";
import PdfGenerationBadge from "./PdfGenerationBadge";

export interface FFCSDossierSubpageProps {
  timetable: TimetableState;
  courses: AddedCourse[];
  theoryPeriods: TimetablePeriod[];
  labPeriods: TimetablePeriod[];
  days: { id: string; name: string }[];
  masterCourses: readonly ParsedCourse[];
  initialViewMode?: "horizontal" | "vertical";
  onClose: () => void;
}

export default function FFCSDossierSubpage({
  timetable,
  courses,
  theoryPeriods,
  labPeriods,
  days,
  masterCourses,
  initialViewMode = "horizontal",
  onClose,
}: FFCSDossierSubpageProps) {
  const [isLightMode, setIsLightMode] = useState(false);
  const [viewMode, setViewMode] = useState<"horizontal" | "vertical">(initialViewMode);

  useOverlayBack("ffcs-dossier", true, onClose);

  // Group courses by course code
  const groupedCourses = useMemo(() => {
    const map = new Map<string, AddedCourse & { ids: string[]; batches: string[]; allSlots: string[] }>();
    for (const c of courses) {
      if (map.has(c.code)) {
        const g = map.get(c.code)!;
        g.ids.push(c.id);
        if (!g.faculty.includes(c.faculty)) g.faculty += ` / ${c.faculty}`;
        if (!g.venue.includes(c.venue)) g.venue += ` / ${c.venue}`;
        if (!g.type.includes(c.type)) g.type += ` + ${c.type}`;
        for (const s of c.slots) {
          if (!g.allSlots.includes(s)) g.allSlots.push(s);
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
        map.set(c.code, {
          ...c,
          ids: [c.id],
          faculty: c.faculty,
          venue: c.venue,
          type: c.type,
          allSlots: [...c.slots],
          batches,
        });
      }
    }
    return Array.from(map.values());
  }, [courses]);

  const totalCredits = useMemo(() => {
    return groupedCourses.reduce((sum, c) => sum + (parseFloat(c.credits) || 0), 0);
  }, [groupedCourses]);

  // Distinct faculties for intelligence dossier
  const evaluatedFaculties = useMemo(() => {
    interface FacEntry {
      name: string;
      employeeId?: string;
      courses: { code: string; title: string }[];
    }
    const map = new Map<string, FacEntry>();

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
        if (!map.has(key)) {
          map.set(key, {
            name,
            employeeId: empId,
            courses: [{ code: c.code, title: c.title }],
          });
        } else {
          const entry = map.get(key)!;
          if (!entry.courses.some((x) => x.code === c.code)) {
            entry.courses.push({ code: c.code, title: c.title });
          }
        }
      });
    }

    return Array.from(map.values()).map((f) => {
      const review = getFacultyReview({ employeeId: f.employeeId, name: f.name });
      return {
        ...f,
        review,
        profileUrl: f.employeeId ? getVitfacProfileUrl(f.employeeId) : null,
      };
    });
  }, [courses]);

  // Drop-in replacements for every course component
  const dropInAnalysis = useMemo(() => {
    if (!masterCourses || masterCourses.length === 0) return [];

    const halves = expandCourseHalves(courses);
    return halves.map((half) => {
      const alts = sameSlotFacultyAlternatives(
        half.code,
        half.slots,
        { faculty: half.faculty, employeeId: half.employeeId },
        masterCourses
      );

      const enrichedAlts = alts.map((alt) => {
        const review = getFacultyReview({ employeeId: alt.ERP_ID, name: alt.FACULTY });
        return {
          faculty: alt.FACULTY,
          employeeId: alt.ERP_ID,
          venue: alt.ROOM,
          slot: alt.SLOT,
          type: alt.TYPE,
          review,
        };
      });

      return {
        half,
        alternatives: enrichedAlts,
      };
    });
  }, [courses, masterCourses]);

  const dateStr = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }, []);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfToast, setPdfToast] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      await downloadModernDossierHtml({
        timetableName: timetable.name,
        courses,
        theoryPeriods,
        labPeriods,
        days,
        masterCourses,
        viewMode: "horizontal",
        totalCredits,
        theme: isLightMode ? "light" : "dark",
      });
      setPdfToast("HTML dossier downloaded successfully.");
      setTimeout(() => setPdfToast(null), 3500);
    } catch (err) {
      console.error("Failed to download HTML dossier:", err);
      setPdfToast("Failed to download HTML dossier. Please try again.");
      setTimeout(() => setPdfToast(null), 3500);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Base theme classes
  const themeBg = isLightMode ? "bg-slate-50 text-slate-900" : "bg-[#090d16] text-slate-100";
  const cardBg = isLightMode
    ? "bg-white border-slate-200 shadow-xs"
    : "bg-slate-900/85 border-white/10 shadow-xl";
  const subcardBg = isLightMode
    ? "bg-slate-50 border-slate-200 text-slate-800"
    : "bg-slate-800/60 border-white/8 text-slate-200";
  const textHeading = isLightMode ? "text-slate-900 font-extrabold" : "text-white font-extrabold";
  const textMuted = isLightMode ? "text-slate-600" : "text-slate-400";
  const borderSubtle = isLightMode ? "border-slate-200" : "border-white/10";

  return (
    <div
      data-prevent-swipe="true"
      className={`min-h-screen w-full transition-colors duration-200 ${themeBg}`}
    >
      {/* Global Print Style for In-App Native Print */}
      <style>{`
        @page {
          size: landscape;
          margin: 8mm 10mm;
        }
        @media print {
          body {
            background: #ffffff !important;
            color: #0f172a !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .dossier-no-print,
          nav,
          header,
          footer,
          aside,
          [data-tour-id] {
            display: none !important;
          }
          #ffcs-dossier-root {
            display: block !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            background: #ffffff !important;
            color: #0f172a !important;
          }
          .dossier-card {
            background: #ffffff !important;
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
            box-shadow: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 20px !important;
            border-radius: 8px !important;
          }
          .dossier-subcard {
            background: #f8fafc !important;
            border: 1px solid #e2e8f0 !important;
            color: #1e293b !important;
          }
          .dossier-heading-text {
            color: #0f172a !important;
          }
          .dossier-muted-text {
            color: #475569 !important;
          }
          th {
            background: #f1f5f9 !important;
            color: #334155 !important;
            border-color: #cbd5e1 !important;
          }
          td {
            border-color: #e2e8f0 !important;
            color: #1e293b !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Floating In-App Toolbar */}
      <div
        className={`sticky top-0 z-50 dossier-no-print backdrop-blur-md px-4 md:px-8 pb-3.5 pt-[calc(env(safe-area-inset-top,0px)+0.875rem)] border-b flex flex-wrap items-center justify-between gap-3 shadow-md ${
          isLightMode
            ? "bg-white/90 border-slate-200"
            : "bg-[#0f172a]/90 border-white/10"
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer ${
              isLightMode
                ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10"
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Timetable</span>
          </button>
          <div className="hidden sm:block h-4 w-[1px] bg-slate-400/30" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-black px-2 py-0.5 rounded-md bg-blue-600 text-white tracking-wider uppercase">
              FFCS Dossier
            </span>
            <span className={`text-sm font-bold truncate max-w-[200px] md:max-w-md ${textHeading}`}>
              {timetable.name}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div
            className={`flex items-center p-0.5 rounded-xl border ${
              isLightMode ? "bg-slate-100 border-slate-200" : "bg-slate-800/80 border-white/10"
            }`}
          >
            <button
              type="button"
              onClick={() => setViewMode("horizontal")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "horizontal"
                  ? "bg-blue-600 text-white shadow-xs"
                  : isLightMode
                  ? "text-slate-600 hover:text-slate-900"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Horizontal</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("vertical")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "vertical"
                  ? "bg-blue-600 text-white shadow-xs"
                  : isLightMode
                  ? "text-slate-600 hover:text-slate-900"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Vertical</span>
            </button>
          </div>

          {/* Theme Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsLightMode(!isLightMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isLightMode
                ? "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/15"
            }`}
            title="Toggle between Ink-Saver Light Mode and Dark Mode"
          >
            {isLightMode ? (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Dark Theme</span>
              </>
            ) : (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Ink-Saver Light</span>
              </>
            )}
          </button>

          {/* Automatic PDF Download Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
                title="Download a standalone HTML dossier"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Preparing HTML dossier...</span>
              </>
            ) : (
              <>
                <Printer className="w-4 h-4" />
                <span>Download HTML Dossier</span>
              </>
            )}
          </button>

          {/* Browser Paper Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              isLightMode
                ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/15"
            }`}
            title="Open browser print dialog for paper printing"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {/* Collapsed Sync-Engine Style Generation Badge */}
      <PdfGenerationBadge
        isGenerating={isGeneratingPdf}
        successMessage={pdfToast && !pdfToast.startsWith("Failed") ? pdfToast : undefined}
        errorMessage={pdfToast && pdfToast.startsWith("Failed") ? pdfToast : undefined}
        timetableName={timetable.name}
        theme={isLightMode ? "light" : "dark"}
        onDismiss={() => setPdfToast(null)}
      />

      {/* Main Dossier Container */}
      <div id="ffcs-dossier-root" className="w-full max-w-7xl mx-auto p-4 md:p-8 space-y-6">
        {/* Executive Header Banner */}
        <div className={`dossier-card rounded-2xl border p-6 md:p-8 ${cardBg}`}>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider">
                  Official Registration Dossier
                </span>
                <span className={`text-xs font-semibold ${textMuted}`}>
                  {viewMode === "vertical" ? "Mobile Vertical Heatmap" : "Horizontal University Grid"}
                </span>
              </div>
              <h1 className={`text-2xl md:text-3xl tracking-tight mb-1 dossier-heading-text ${textHeading}`}>
                {timetable.name}
              </h1>
              <p className={`text-xs dossier-muted-text ${textMuted} flex items-center gap-2`}>
                <span>Vellore Institute of Technology, Chennai</span>
                <span>•</span>
                <span>Generated on {dateStr}</span>
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div
                className={`px-4 py-2.5 rounded-xl border text-right ${
                  isLightMode
                    ? "bg-blue-50/80 border-blue-200 text-blue-900"
                    : "bg-blue-500/10 border-blue-500/20 text-blue-200"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Total Credits
                </div>
                <div className="text-xl md:text-2xl font-black">{totalCredits}</div>
              </div>
              <div
                className={`px-4 py-2.5 rounded-xl border text-right ${
                  isLightMode
                    ? "bg-purple-50/80 border-purple-200 text-purple-900"
                    : "bg-purple-500/10 border-purple-500/20 text-purple-200"
                }`}
              >
                <div className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Courses
                </div>
                <div className="text-xl md:text-2xl font-black">{groupedCourses.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Schedule Grid Section */}
        <div className={`dossier-card rounded-2xl border p-4 md:p-6 ${cardBg}`}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-inherit">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <h2 className={`text-base font-bold dossier-heading-text ${textHeading}`}>
                Weekly Academic Schedule
              </h2>
            </div>
            <span className={`text-xs ${textMuted}`}>Official VIT Chennai Slot Matrix</span>
          </div>

          <div className="overflow-x-auto">
            {viewMode === "horizontal" ? (
              <ModernHorizontalTimetableGrid
                courses={courses}
                theoryPeriods={theoryPeriods}
                labPeriods={labPeriods}
                days={days}
                title={timetable.name}
              />
            ) : (
              <VerticalTimetableGrid
                courses={courses}
                theoryPeriods={theoryPeriods}
                labPeriods={labPeriods}
                days={days}
              />
            )}
          </div>
        </div>

        {/* Enrolled Courses Master Table */}
        <div className={`dossier-card rounded-2xl border p-4 md:p-6 ${cardBg}`}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-inherit">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-indigo-500" />
              <h2 className={`text-base font-bold dossier-heading-text ${textHeading}`}>
                Enrolled Courses Summary
              </h2>
            </div>
            <span className={`text-xs ${textMuted}`}>{groupedCourses.length} Registered Offerings</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className={isLightMode ? "bg-slate-100 text-slate-700" : "bg-slate-800/60 text-slate-300"}>
                  <th className="py-2.5 px-3 font-bold w-12 text-center">#</th>
                  <th className="py-2.5 px-3 font-bold">Course</th>
                  <th className="py-2.5 px-3 font-bold">Type</th>
                  <th className="py-2.5 px-3 font-bold text-center">Credits</th>
                  <th className="py-2.5 px-3 font-bold">Slots</th>
                  <th className="py-2.5 px-3 font-bold">Venue</th>
                  <th className="py-2.5 px-3 font-bold">Faculty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit">
                {groupedCourses.map((c, i) => {
                  const badgeProps = getCourseBadgeProps(c.color, true);
                  return (
                    <tr
                      key={c.code}
                      className={
                        i % 2 === 0
                          ? isLightMode
                            ? "bg-white"
                            : "bg-slate-900/30"
                          : isLightMode
                          ? "bg-slate-50/80"
                          : "bg-slate-900/60"
                      }
                    >
                      <td className={`py-3 px-3 text-center font-bold ${textMuted}`}>{i + 1}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={badgeProps.className}
                            style={{
                              ...badgeProps.style,
                              color: isLightMode ? "#0f172a" : undefined,
                            }}
                          >
                            {c.code}
                          </span>
                          <div>
                            <div className={`font-bold ${isLightMode ? "text-slate-900" : "text-white"}`}>
                              {c.title}
                            </div>
                            {c.batches && c.batches.length > 0 && (
                              <div className="text-[10px] text-blue-500 font-semibold">
                                Batch: {c.batches.join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {typeLabels[c.type] || c.type}
                        </span>
                      </td>
                      <td className={`py-3 px-3 text-center font-black ${isLightMode ? "text-slate-900" : "text-white"}`}>
                        {c.credits}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {c.allSlots.map((s) => (
                            <span
                              key={s}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                isLightMode
                                  ? "bg-slate-100 text-slate-800 border-slate-300"
                                  : "bg-slate-800 text-slate-200 border-white/10"
                              }`}
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={`py-3 px-3 font-semibold ${isLightMode ? "text-slate-800" : "text-slate-200"}`}>
                        {c.venue || "TBA"}
                      </td>
                      <td className={`py-3 px-3 font-medium ${isLightMode ? "text-slate-800" : "text-slate-300"}`}>
                        {c.faculty}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Faculty Intelligence & Sentiment Report */}
        <div className={`dossier-card rounded-2xl border p-4 md:p-6 ${cardBg}`}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-inherit">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              <h2 className={`text-base font-bold dossier-heading-text ${textHeading}`}>
                Faculty Intelligence &amp; Sentiment Report
              </h2>
            </div>
            <span className={`text-xs ${textMuted}`}>Powered by Vitfac Student Ratings</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {evaluatedFaculties.map((f) => {
              const rev = f.review;
              const hasReviews = rev && rev.reviews > 0;
              const wPct = rev?.wPct ?? 0;
              const isGreen = wPct >= 70;
              const isAmber = wPct >= 40 && wPct < 70;

              const badgeColor = isGreen
                ? isLightMode
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                  : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : isAmber
                ? isLightMode
                  ? "bg-amber-50 text-amber-800 border-amber-300"
                  : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                : isLightMode
                ? "bg-rose-50 text-rose-800 border-rose-300"
                : "bg-rose-500/15 text-rose-300 border-rose-500/30";

              const initials = f.name
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0]?.toUpperCase() || "")
                .join("");

              return (
                <div
                  key={f.name + (f.employeeId || "")}
                  className={`dossier-subcard rounded-xl border p-4 flex flex-col justify-between ${subcardBg}`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {initials || "FAC"}
                        </div>
                        <div>
                          <h3
                            className={`text-xs font-bold leading-tight ${
                              isLightMode ? "text-slate-900" : "text-white"
                            }`}
                          >
                            {f.name}
                          </h3>
                          <div className={`text-[10.5px] mt-0.5 ${textMuted}`}>
                            {f.employeeId ? `ID: ${f.employeeId} • ` : ""}
                            {f.courses.map((x) => x.code).join(", ")}
                          </div>
                        </div>
                      </div>

                      {hasReviews ? (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 ${badgeColor}`}
                        >
                          ★ {wPct}% W ({rev.reviews})
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
                            isLightMode
                              ? "bg-slate-100 text-slate-600 border-slate-300"
                              : "bg-slate-800 text-slate-400 border-white/10"
                          }`}
                        >
                          Unreviewed
                        </span>
                      )}
                    </div>

                    {/* Numerical Metrics */}
                    {hasReviews && rev.metrics && (
                      <div className="grid grid-cols-3 gap-2 my-2.5 text-center">
                        <div
                          className={`p-1.5 rounded-lg border ${
                            isLightMode ? "bg-white border-slate-200" : "bg-slate-900/50 border-white/5"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-slate-500">🎓 Teaching</div>
                          <div className="text-xs font-black text-blue-600 dark:text-blue-400">
                            {rev.metrics.lecture.toFixed(1)}/5
                          </div>
                        </div>
                        <div
                          className={`p-1.5 rounded-lg border ${
                            isLightMode ? "bg-white border-slate-200" : "bg-slate-900/50 border-white/5"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-slate-500">📝 DA Score</div>
                          <div className="text-xs font-black text-purple-600 dark:text-purple-400">
                            {rev.metrics.da.toFixed(1)}/5
                          </div>
                        </div>
                        <div
                          className={`p-1.5 rounded-lg border ${
                            isLightMode ? "bg-white border-slate-200" : "bg-slate-900/50 border-white/5"
                          }`}
                        >
                          <div className="text-[10px] font-bold uppercase text-slate-500">✨ Vibe</div>
                          <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                            {rev.metrics.vibe.toFixed(1)}/5
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lore Tags */}
                    {hasReviews && (rev.lore?.green?.length || rev.lore?.red?.length) ? (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {(rev.lore?.green || []).slice(0, 2).map((item) => (
                          <span
                            key={item.text}
                            className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded border ${
                              isLightMode
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                : "bg-emerald-500/10 text-emerald-300 border-emerald-500/20"
                            }`}
                          >
                            ✓ {item.text}
                          </span>
                        ))}
                        {(rev.lore?.red || []).slice(0, 1).map((item) => (
                          <span
                            key={item.text}
                            className={`text-[9.5px] font-semibold px-1.5 py-0.5 rounded border ${
                              isLightMode
                                ? "bg-rose-50 text-rose-800 border-rose-200"
                                : "bg-rose-500/10 text-rose-300 border-rose-500/20"
                            }`}
                          >
                            ⚠ {item.text}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  {f.profileUrl && (
                    <div className="mt-3 pt-2 border-t border-inherit text-right">
                      <a
                        href={f.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10.5px] font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        <span>Vitfac Profile</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Emergency Drop-In Slot Replacements Matrix */}
        <div className={`dossier-card rounded-2xl border p-4 md:p-6 ${cardBg}`}>
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-inherit">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h2 className={`text-base font-bold dossier-heading-text ${textHeading}`}>
                  Emergency Drop-In Slot Replacements
                </h2>
                <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase">
                  Zero Clash Risk
                </span>
              </div>
              <p className={`text-xs dossier-muted-text ${textMuted}`}>
                Identical-slot backup faculties teaching the exact same schedule. Swap safely if your target seat fills up during FFCS.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {dropInAnalysis.map(({ half, alternatives }) => {
              const currentTeacher = half.faculty ? half.faculty.split("/")[0]?.trim() : "TBA";
              const colorHex = COLOR_HEX_MAP[half.color] || "#2563eb";

              return (
                <div
                  key={half.id || half.code + half.slots.join("+")}
                  className={`dossier-subcard rounded-xl border p-4 ${subcardBg}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-white text-xs font-black px-2.5 py-1 rounded-md"
                        style={{ backgroundColor: colorHex }}
                      >
                        {half.code}
                      </span>
                      <span className={`text-sm font-bold ${isLightMode ? "text-slate-900" : "text-white"}`}>
                        {half.title}
                      </span>
                      <span className={`text-xs ${textMuted}`}>({half.type || "Theory"})</span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-mono font-bold px-2 py-0.5 rounded border ${
                          isLightMode
                            ? "bg-blue-50 text-blue-800 border-blue-200"
                            : "bg-blue-500/15 text-blue-300 border-blue-500/30"
                        }`}
                      >
                        Slots: {half.slots.join("+")}
                      </span>
                      <span className={textMuted}>
                        Current: <strong className={isLightMode ? "text-slate-900" : "text-white"}>{currentTeacher}</strong>
                      </span>
                    </div>
                  </div>

                  {alternatives.length === 0 ? (
                    <div className={`text-xs italic py-1 ${textMuted}`}>
                      Unique slot allocation • No identical-slot alternative faculties found in catalog
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                      {alternatives.map((alt) => {
                        const rev = alt.review;
                        return (
                          <div
                            key={alt.faculty + (alt.employeeId || "")}
                            className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                              isLightMode ? "bg-white border-slate-200" : "bg-slate-900/50 border-white/5"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div>
                                <div className={`text-xs font-bold ${isLightMode ? "text-slate-900" : "text-white"}`}>
                                  {alt.faculty}
                                </div>
                                <div className={`text-[10px] ${textMuted}`}>
                                  Room: {alt.venue || "TBA"} {alt.employeeId ? `• ID: ${alt.employeeId}` : ""}
                                </div>
                              </div>
                              {rev && rev.reviews > 0 && (
                                <span
                                  className={`text-[9.5px] font-black px-1.5 py-0.5 rounded border shrink-0 ${
                                    rev.wPct >= 70
                                      ? isLightMode
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                        : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                      : isLightMode
                                      ? "bg-amber-50 text-amber-800 border-amber-300"
                                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                  }`}
                                >
                                  ★ {rev.wPct}% ({rev.reviews})
                                </span>
                              )}
                            </div>

                            <span className="text-[9.5px] font-black px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shrink-0 uppercase">
                              ✓ 0 Clash
                            </span>
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

        {/* Footer / Legal Disclaimer */}
        <div className="pt-4 border-t border-inherit flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>Generated via AmazeCC FFCS Engine • VIT Chennai</span>
          <span>Faculty sentiment &amp; ratings sourced via Vitfac (vitfac.pages.dev)</span>
        </div>
      </div>
    </div>
  );
}
