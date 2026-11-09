"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  CalendarX,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  FileDown,
  Loader2,
  Printer,
  RefreshCcw,
  CalendarPlus,
} from "lucide-react";
import { useTheme } from "next-themes";
import { downloadExamSchedulePdf } from "@/lib/exportTimetable";
import { generateExamScheduleHtml } from "@/lib/exportTimetableHtml";
import { downloadHtmlImage } from "@/lib/imageDownload";
import BottomSheet from "../shared/BottomSheet";
import { GHOST_BUTTON, SECTION_CHIP } from "@/lib/uiTokens";
import {
  buildExamRows,
  nextExamLabel,
  prettyDate,
  seatLabel,
  seriesTone,
  shortDate,
  type ExamRow,
} from "@/lib/examSchedule";
import {
  PageShell,
  IconButton,
  GhostButton,
  SegmentedControl,
  SectionHeader,
  StatTile,
  ListShell,
  ToneBadge,
  ToneDot,
  EmptyPanel,
} from "../shared/primitives";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const ALL_TYPES = "__all__";
/** Sentinel: every row expanded — used for PNG/print capture. */
const EXPAND_ALL = "__all_rows__";

/** Reporting time + the exam series' duration -> UTC bounds for the VEVENT. */
function computeExamTimes(reportingTimeStr: string, examDateStr: string, examType: string) {
  if (!reportingTimeStr || !examDateStr) return {};

  const [day, monthStr, year] = examDateStr.split(/[-/]/);
  const month = MONTHS.findIndex((m) => monthStr.toLowerCase().startsWith(m));

  const match = reportingTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return {};
  const [, hours, minutes, meridian] = match;
  let h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  if (meridian.toUpperCase() === "PM" && h !== 12) h += 12;
  if (meridian.toUpperCase() === "AM" && h === 12) h = 0;

  const start = new Date(parseInt(year, 10), month, parseInt(day, 10), h, m);

  const upper = String(examType).toUpperCase();
  const duration = upper.includes("CAT") ? 1 * 60 + 45 : upper.includes("FAT") ? 3 * 60 + 30 : 0;

  const end = new Date(start.getTime() + duration * 60000);

  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  return { startUTC: fmt(start), endUTC: fmt(end) };
}

function generateICSFile(subjects: any[], examType: string) {
  const events = subjects
    .filter((s) => s.reportingTime && s.examSession)
    .map((subj) => {
      const { startUTC, endUTC } = computeExamTimes(subj.reportingTime, subj.examDate, examType);
      const uid = crypto.randomUUID();
      const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

      return [
        "BEGIN:VEVENT",
        `SUMMARY:${subj.courseTitle} (${examType})`,
        `DESCRIPTION:${subj.courseCode} — ${subj.reportingTime} @ ${subj.venue === "-" ? "TBA" : subj.venue}`,
        `LOCATION:${subj.venue === "-" ? "TBA" : subj.venue}`,
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${startUTC}`,
        `DTEND:${endUTC}`,
        "END:VEVENT",
      ].join("\n");
    })
    .join("\n\n");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AmazeCC//Schedule Export//EN",
    events,
    "END:VCALENDAR",
  ].join("\n");

  return URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
}

export default function ExamSchedule({ data, handleScheduleFetch, onBack }: any) {
  const scheduleObj = data?.Schedule || data?.schedule;
  const semester = data?.semester;

  const captureRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedModalSeries, setSelectedModalSeries] = useState<string>(ALL_TYPES);
  const [, setCopied] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme || "light";

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
  }, []);

  const examTypes = useMemo(
    () => (scheduleObj && typeof scheduleObj === "object" ? Object.keys(scheduleObj) : []),
    [scheduleObj],
  );

  const allRows = useMemo<ExamRow[]>(() => buildExamRows(scheduleObj), [scheduleObj]);

  const visibleRows = useMemo(
    () => (typeFilter === ALL_TYPES ? allRows : allRows.filter((r) => r.examType === typeFilter)),
    [allRows, typeFilter],
  );

  const upcomingRows = useMemo(() => allRows.filter((r) => r.state !== "past"), [allRows]);
  const todayCount = useMemo(() => allRows.filter((r) => r.state === "today").length, [allRows]);
  const nextRow = upcomingRows[0] ?? null;

  const allCourseCodes = useMemo(
    () => [...new Set(allRows.map((r) => r.raw?.courseCode).filter(Boolean))] as string[],
    [allRows],
  );

  const handleCopyCodes = useCallback(async () => {
    if (allCourseCodes.length === 0) return;
    try {
      await navigator.clipboard.writeText(allCourseCodes.join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [allCourseCodes]);

  const handleDownloadPdf = useCallback(
    async (seriesOverride?: string) => {
      if (!scheduleObj || allRows.length === 0) return;
      const targetSeries =
        typeof seriesOverride === "string" ? seriesOverride : typeFilter !== ALL_TYPES ? typeFilter : undefined;

      setIsDownloadingPdf(true);
      try {
        await downloadExamSchedulePdf({
          scheduleObj,
          semester,
          layout: "document",
          selectedSeries: targetSeries,
        });
      } catch (err) {
        console.error("Failed to generate and download exam schedule PDF:", err);
      } finally {
        setIsDownloadingPdf(false);
      }
    },
    [scheduleObj, allRows.length, semester, typeFilter],
  );

  const handleDownloadImage = useCallback(
    async (seriesOverride?: string) => {
      if (!scheduleObj || allRows.length === 0) return;
      const targetSeries =
        typeof seriesOverride === "string" ? seriesOverride : typeFilter !== ALL_TYPES ? typeFilter : undefined;

      setIsDownloading(true);
      try {
        const isLight = currentTheme.includes("light");
        const html = generateExamScheduleHtml({
          scheduleObj,
          semester,
          isLight,
          layout: "cards",
          selectedSeries: targetSeries,
        });
        const fileTag = targetSeries ? `_${targetSeries}` : "";
        await downloadHtmlImage(html, `Exam_Schedule${fileTag}_FFCS`, {
          format: "png",
          backgroundColor: isLight ? "#ffffff" : "#090d16",
        });
      } catch (err) {
        console.error(err);
      } finally {
        setIsDownloading(false);
      }
    },
    [scheduleObj, allRows.length, currentTheme, semester, typeFilter],
  );

  const actions = (
    <>
      <IconButton onClick={handleScheduleFetch} title="Reload exam schedule">
        <RefreshCcw className="w-4 h-4" />
      </IconButton>
      <IconButton onClick={handleCopyCodes} title="Copy all course codes" disabled={allCourseCodes.length === 0}>
        <ClipboardList className="w-4 h-4" />
      </IconButton>
      {examTypes.length > 1 && (
        <IconButton
          onClick={() => {
            setSelectedModalSeries(typeFilter);
            setShowDownloadModal(true);
          }}
          title="Choose exam to download"
          disabled={isDownloading || isDownloadingPdf}
        >
          <FileDown className="w-4 h-4 text-indigo-500" />
        </IconButton>
      )}
      <IconButton
        onClick={() => handleDownloadImage()}
        title={typeFilter !== ALL_TYPES ? `Download ${typeFilter} as PNG` : "Download as PNG"}
        disabled={isDownloading || isDownloadingPdf}
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </IconButton>
      <IconButton
        onClick={() => handleDownloadPdf()}
        title={typeFilter !== ALL_TYPES ? `Download ${typeFilter} Schedule (PDF)` : "Download Exam Schedule (PDF)"}
        disabled={isDownloading || isDownloadingPdf}
      >
        {isDownloadingPdf ? (
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
        ) : (
          <Printer className="w-4 h-4" />
        )}
      </IconButton>
    </>
  );

  const shellProps = {
    eyebrow: "Academics",
    title: "Exam Schedule",
    subtitle: semester ? `Session ${semester}` : undefined,
    actions,
    onBack,
  };

  if (!scheduleObj || Object.keys(scheduleObj).length === 0) {
    return (
      <PageShell {...shellProps}>
        <EmptyPanel
          icon={<CalendarX className="w-7 h-7" />}
          title="No exam schedule yet"
          description="Your CAT, FAT and lab timetables appear here once they are synced from VTOP."
          action={
            <GhostButton onClick={handleScheduleFetch}>
              <RefreshCcw className="w-3.5 h-3.5" />
              Sync now
            </GhostButton>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell {...shellProps}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile
          label="Next exam"
          tone={nextRow?.state === "today" ? "amber" : "emerald"}
          badge={nextRow ? (nextRow.state === "today" ? "Today" : "Next") : undefined}
          value={nextExamLabel(nextRow)}
          sub={nextRow ? `${nextRow.raw.courseCode} · ${prettyDate(nextRow.date)}` : "Nothing scheduled"}
        />
        <StatTile
          label="Exams left"
          tone="neutral"
          badge={todayCount > 0 ? `${todayCount} today` : undefined}
          value={
            <>
              {upcomingRows.length}
              <span className="text-base sm:text-lg font-extrabold text-zinc-400 dark:text-zinc-500 ml-1">
                of {allRows.length}
              </span>
            </>
          }
          sub={`${examTypes.length} series`}
        />
      </div>

      {/* `space-y-4` is what separates the filter strip from the first series
          header, and it has to be here rather than on either child. The list
          below carries `space-y-6`, which margins every child *except the
          first* — so the topmost `SectionHeader` gets nothing — and the filter
          row has no bottom margin of its own. The two sat flush, and because
          the shell spaces `captureRef` by 1.5rem from the stat tiles, the
          filter read as part of them and the header as an overlap.

          1rem rather than the list's 1.5rem: the filter is a control strip
          governing the list underneath it, not another section of it. */}
      <div ref={captureRef} className="space-y-4">
        {/* ── EXAM SERIES ── */}
        {examTypes.length > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl
              options={[{ value: ALL_TYPES, label: "All" }, ...examTypes.map((t) => ({ value: t, label: t }))]}
              value={typeFilter}
              onChange={setTypeFilter}
            />
            <span className={`${SECTION_CHIP} shrink-0`}>{visibleRows.length}</span>
          </div>
        )}

        <div className="space-y-6 sm:space-y-7">
          {examTypes
            .filter((examType) => typeFilter === ALL_TYPES || typeFilter === examType)
            .map((examType) => {
              const subjects = (scheduleObj as Record<string, any>)[examType];
              if (!Array.isArray(subjects)) return null;
              const rows = allRows.filter((r) => r.examType === examType);
              const hasCalendarData = subjects.some((s: any) => s.examSession && s.reportingTime);
              const tone = seriesTone(examType);

              return (
                <div key={examType} className="space-y-2.5">
                  <SectionHeader
                    leading={<ToneDot tone={tone} size="md" />}
                    title={examType}
                    count={rows.length}
                    right={
                      <div className="flex items-center gap-1 sm:gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownloadPdf(examType)}
                          title={`Download ${examType} Schedule (PDF)`}
                          disabled={isDownloading || isDownloadingPdf}
                          className={GHOST_BUTTON}
                        >
                          <Printer className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-[11px] font-bold">{examType} PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadImage(examType)}
                          title={`Download ${examType} as PNG`}
                          disabled={isDownloading || isDownloadingPdf}
                          className={GHOST_BUTTON}
                        >
                          <Download className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[11px] font-bold">{examType} PNG</span>
                        </button>
                        {isIOS && hasCalendarData ? (
                          <a
                            href={generateICSFile(subjects, examType)}
                            download={`${examType}_Schedule_iOS.ics`}
                            title="Add to Calendar"
                            aria-label={`Add ${examType} schedule to Calendar`}
                            className={GHOST_BUTTON}
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline text-[11px] font-bold">Add to Calendar</span>
                          </a>
                        ) : null}
                      </div>
                    }
                  />

                  <ListShell>
                    {rows.map((row) => {
                      const subj = row.raw;
                      const isOpen = expandedKey === EXPAND_ALL || expandedKey === row.key;

                      return (
                        <div key={row.key}>
                          <button
                            type="button"
                            onClick={() => setExpandedKey(isOpen && expandedKey !== EXPAND_ALL ? null : row.key)}
                            className="w-full relative py-3.5 px-4 flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
                          >
                            {row.state === "past" ? (
                              /* A tick reads faster than a faint dot for finished papers. */
                              <Check className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" strokeWidth={2.5} />
                            ) : (
                              <ToneDot tone={row.state === "today" ? "amber" : "emerald"} />
                            )}
                            <div className="min-w-0 flex-1">
                              <p
                                className={`text-sm font-bold truncate font-outfit leading-tight ${
                                  row.state === "past"
                                    ? "text-zinc-400 dark:text-zinc-500 line-through"
                                    : "text-zinc-900 dark:text-white"
                                }`}
                              >
                                {subj.courseTitle || subj.courseCode}
                              </p>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-1 truncate">
                                {subj.courseCode} · {shortDate(row.date)} · {subj.examSession || "TBA"} ·{" "}
                                {subj.venue === "-" ? "TBA" : subj.venue}
                              </p>
                            </div>
                            {/* Only "today" needs calling out — the tick and the
                                strikethrough already carry past/upcoming. */}
                            {row.state === "today" && (
                              <ToneBadge tone="amber" size="sm">
                                Today
                              </ToneBadge>
                            )}
                            <ChevronDown
                              className={`w-4 h-4 text-zinc-400 transition-transform duration-200 shrink-0 ${
                                isOpen ? "rotate-180" : ""
                              }`}
                            />
                          </button>

                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <m.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.22, ease: "easeInOut" }}
                                className="overflow-hidden"
                              >
                                <div className="px-4 pb-4 pt-2 space-y-2.5 border-t border-zinc-100 dark:border-zinc-800/80 mt-1.5">
                                  <div className="grid grid-cols-2 gap-3.5">
                                    {[
                                      { label: "Date", value: subj.examDate || "TBA" },
                                      { label: "Exam Time", value: subj.examTime || "TBA" },
                                      { label: "Session", value: subj.examSession || "TBA" },
                                      { label: "Reporting", value: subj.reportingTime || "TBA" },
                                      { label: "Venue", value: subj.venue === "-" ? "TBA" : subj.venue || "TBA" },
                                      { label: "Slot", value: subj.slot === "-" ? "TBA" : subj.slot || "TBA" },
                                    ].map((field) => (
                                      <div key={field.label} className="min-w-0">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                                          {field.label}
                                        </p>
                                        <p className="text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100 truncate mt-0.5">
                                          {field.value}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="flex items-center justify-between gap-3 min-w-0 pt-1.5">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 shrink-0">
                                      Seat
                                    </p>
                                    <p className="text-[12.5px] font-bold text-zinc-800 dark:text-zinc-100 truncate">
                                      Loc: {seatLabel(subj) || "TBA"} · No: {subj.seatNo || "TBA"}
                                    </p>
                                  </div>
                                </div>
                              </m.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </ListShell>
                </div>
              );
            })}
        </div>

        {visibleRows.length === 0 && (
          <EmptyPanel
            icon={<CalendarX className="w-7 h-7" />}
            title="Nothing under this filter"
            description="Try a different exam series to see the rest of your timetable."
          />
        )}
      </div>

      {showDownloadModal && (
        <BottomSheet
          onClose={() => setShowDownloadModal(false)}
          overlayId="download-exam-modal"
          maxWidth="max-w-md"
          title="Download Exam Schedule"
          subtitle="Choose an exam series and file format"
          icon={<Download className="w-5 h-5 text-indigo-500" />}
        >
          <div className="p-4 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-2">
                Exam Series
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedModalSeries(ALL_TYPES)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    selectedModalSeries === ALL_TYPES
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">All Series</div>
                  <div className="text-sm font-extrabold mt-0.5">All Exams ({allRows.length})</div>
                </button>
                {examTypes.map((t) => {
                  const count = allRows.filter((r) => r.examType === t).length;
                  const isSel = selectedModalSeries === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedModalSeries(t)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSel
                          ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200"
                      }`}
                    >
                      <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Series</div>
                      <div className="text-sm font-extrabold mt-0.5">
                        {t} ({count})
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 block mb-2">
                Download Format
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isDownloading || isDownloadingPdf}
                  onClick={async () => {
                    const target = selectedModalSeries === ALL_TYPES ? undefined : selectedModalSeries;
                    await handleDownloadPdf(target);
                    setShowDownloadModal(false);
                  }}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-4 h-4" />
                  PDF (Schedule)
                </button>
                <button
                  type="button"
                  disabled={isDownloading || isDownloadingPdf}
                  onClick={async () => {
                    const target = selectedModalSeries === ALL_TYPES ? undefined : selectedModalSeries;
                    await handleDownloadImage(target);
                    setShowDownloadModal(false);
                  }}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200 font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  PNG (Image)
                </button>
              </div>
            </div>

            <p className="text-[11px] text-zinc-400 dark:text-zinc-500 text-center pt-2">
              AmazeCC is an independent student initiative. Cross-check your schedule with official VTOP notices.
            </p>
          </div>
        </BottomSheet>
      )}
    </PageShell>
  );
}
