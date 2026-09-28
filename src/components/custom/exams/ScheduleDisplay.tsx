"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  CalendarX,
  Check,
  ChevronDown,
  ClipboardList,
  Download,
  Loader2,
  Printer,
  RefreshCcw,
  CalendarPlus,
} from "lucide-react";
import { useTheme } from "next-themes";
import { downloadTimetableImage, openTimetablePrintablePage } from "@/lib/exportTimetable";
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
/** Must outlast the 0.22s expand transition before the DOM is captured. */
const EXPAND_SETTLE_MS = 280;

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
  const duration =
    upper.includes("CAT") ? 1 * 60 + 45 : upper.includes("FAT") ? 3 * 60 + 30 : 0;

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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [copied, setCopied] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  const { theme, resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme || theme || "light";
  const rootStyles = typeof window === "undefined" ? null : getComputedStyle(document.documentElement);
  const themeBgColor = rootStyles?.getPropertyValue("--background").trim() || "#ffffff";
  const themeTextColor = rootStyles?.getPropertyValue("--text-primary").trim() || "#111827";
  const themeHtmlClass =
    typeof document === "undefined" ? currentTheme : document.documentElement.className || currentTheme;

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream);
  }, []);

  const examTypes = useMemo(
    () => (scheduleObj && typeof scheduleObj === "object" ? Object.keys(scheduleObj) : []),
    [scheduleObj]
  );

  const allRows = useMemo<ExamRow[]>(() => buildExamRows(scheduleObj), [scheduleObj]);

  const visibleRows = useMemo(
    () => (typeFilter === ALL_TYPES ? allRows : allRows.filter((r) => r.examType === typeFilter)),
    [allRows, typeFilter]
  );

  const upcomingRows = useMemo(() => allRows.filter((r) => r.state !== "past"), [allRows]);
  const todayCount = useMemo(() => allRows.filter((r) => r.state === "today").length, [allRows]);
  const nextRow = upcomingRows[0] ?? null;

  const allCourseCodes = useMemo(
    () => [...new Set(allRows.map((r) => r.raw?.courseCode).filter(Boolean))] as string[],
    [allRows]
  );

  const handleCopyCodes = useCallback(async () => {
    if (allCourseCodes.length === 0) return;
    try {
      await navigator.clipboard.writeText(allCourseCodes.join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [allCourseCodes]);

  /**
   * PNG/print capture the live DOM, and collapsed bodies are unmounted by
   * AnimatePresence — so open every row, drop any active series filter, let the
   * transition land, capture, then put the user's own view state back.
   */
  const withFullScheduleExpanded = useCallback(async (run: () => Promise<void> | void) => {
    const restoreExpanded = expandedKey;
    const restoreFilter = typeFilter;
    setExpandedKey(EXPAND_ALL);
    setTypeFilter(ALL_TYPES);
    await new Promise((resolve) => setTimeout(resolve, EXPAND_SETTLE_MS));
    try {
      await run();
    } finally {
      setExpandedKey(restoreExpanded);
      setTypeFilter(restoreFilter);
    }
  }, [expandedKey, typeFilter]);

  const handlePrint = useCallback(() => {
    if (!captureRef.current) return;
    withFullScheduleExpanded(() => {
      try {
        openTimetablePrintablePage(
          captureRef.current!.innerHTML,
          "Exam Schedule",
          themeHtmlClass,
          themeBgColor,
          themeTextColor
        );
      } catch (err) {
        console.error(err);
      }
    });
  }, [withFullScheduleExpanded, themeHtmlClass, themeBgColor, themeTextColor]);

  const handleDownloadImage = useCallback(async () => {
    if (!captureRef.current) return;
    await withFullScheduleExpanded(async () => {
      setIsDownloading(true);
      try {
        await downloadTimetableImage(captureRef.current!, "Exam_Schedule", themeBgColor, "png");
      } catch (err) {
        console.error(err);
      } finally {
        setIsDownloading(false);
      }
    });
  }, [withFullScheduleExpanded, themeBgColor]);

  const actions = (
    <>
      <IconButton onClick={handleScheduleFetch} title="Reload exam schedule">
        <RefreshCcw className="w-4 h-4" />
      </IconButton>
      <IconButton
        onClick={handleCopyCodes}
        title="Copy all course codes"
        disabled={allCourseCodes.length === 0}
      >
        <ClipboardList className="w-4 h-4" />
      </IconButton>
      <IconButton onClick={handleDownloadImage} title="Download as PNG" disabled={isDownloading}>
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </IconButton>
      <IconButton onClick={handlePrint} title="Print / PDF" disabled={isDownloading}>
        <Printer className="w-4 h-4" />
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
          sub={
            nextRow ? `${nextRow.raw.courseCode} · ${prettyDate(nextRow.date)}` : "Nothing scheduled"
          }
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

      <div ref={captureRef}>
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
                      isIOS && hasCalendarData ? (
                        <a
                          href={generateICSFile(subjects, examType)}
                          download={`${examType}_Schedule_iOS.ics`}
                          title="Add to Calendar"
                          aria-label={`Add ${examType} schedule to Calendar`}
                          className={GHOST_BUTTON}
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          {/* Icon-only on phones, where the label is what
                              collides with the series name. */}
                          <span className="hidden sm:inline text-[11px] font-bold">
                            Add to Calendar
                          </span>
                        </a>
                      ) : undefined
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
                            onClick={() =>
                              setExpandedKey(isOpen && expandedKey !== EXPAND_ALL ? null : row.key)
                            }
                            className="w-full relative py-3.5 px-4 flex items-center justify-between gap-3 text-left cursor-pointer active:scale-[0.99] transition-transform"
                          >
                            {row.state === "past" ? (
                              /* A tick reads faster than a faint dot for finished papers. */
                              <Check
                                className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0"
                                strokeWidth={2.5}
                              />
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
                                {subj.courseCode} · {shortDate(row.date)} ·{" "}
                                {subj.examSession || "TBA"} · {subj.venue === "-" ? "TBA" : subj.venue}
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
    </PageShell>
  );
}
