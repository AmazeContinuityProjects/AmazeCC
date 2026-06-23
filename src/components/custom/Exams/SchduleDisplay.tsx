"use client";

import { Button } from "@/components/ui/button";
import NoContentFound from "../NoContentFound";
import { RefreshCcw, Download, Printer, ClipboardList } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { downloadTimetableImage, openTimetablePrintablePage } from "@/lib/exportTimetable";
import { useTheme } from "next-themes";

export default function ExamSchedule({ data, handleScheduleFetch }) {
  const scheduleObj = data?.Schedule || data?.schedule;
  const captureRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const { theme, resolvedTheme } = useTheme();
  const isDark = theme === "dark" || resolvedTheme === "dark";
  const isMidnight = theme === "midnight";
  const themeBgColor = isMidnight ? "#020617" : isDark ? "#0f172a" : "#ffffff";
  const themeTextColor = isDark ? "#ffffff" : "#000000";
  const themeHtmlClass = isMidnight ? "dark midnight" : isDark ? "dark" : "light";
  
  const allCourseCodes = scheduleObj
    ? [...new Set(Object.values(scheduleObj).flat().map((s: any) => s.courseCode).filter(Boolean))]
    : [];

  const handleCopyCodes = useCallback(() => {
    if (allCourseCodes.length === 0) return;
    navigator.clipboard.writeText(allCourseCodes.join(", "));
  }, [allCourseCodes]);

  const handlePrint = useCallback(() => {
    if (!captureRef.current) return;
    setIsDownloading(true);
    try {
      openTimetablePrintablePage(
        captureRef.current.innerHTML,
        "Exam Schedule",
        themeHtmlClass,
        themeBgColor,
        themeTextColor
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  }, [themeHtmlClass, themeBgColor, themeTextColor]);

  const handleDownloadImage = useCallback(async () => {
    if (!captureRef.current) return;
    setIsDownloading(true);
    try {
      await downloadTimetableImage(captureRef.current, "Exam_Schedule", themeBgColor, "png");
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  }, [themeBgColor]);
  
  if (!scheduleObj || Object.keys(scheduleObj).length === 0) {
    return (
      <div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
          {/* Mobile View: Inline Center */}
          <h1 className="md:hidden text-xl font-bold text-center text-gray-900 dark:text-gray-100 midnight:text-gray-100">
            Exam Schedule <button onClick={handleScheduleFetch} className="inline-flex ml-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors align-middle">
              <RefreshCcw className={`w-4 h-4`} />
            </button>
          </h1>
          
          {/* Desktop View: Left Aligned Heading + Right Aligned Button */}
          <h1 className="hidden md:block text-3xl font-bold text-left text-gray-900 dark:text-gray-100 midnight:text-gray-100">
            Exam Schedule
          </h1>
          <div className="hidden md:flex items-center justify-end">
            <button onClick={handleScheduleFetch} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm">
              <RefreshCcw className={`w-4 h-4`} /> <span className="text-sm">Reload</span>
            </button>
          </div>
        </div>
        <NoContentFound />
      </div>
    );
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !window.MSStream
    );
  }, []);


  const parseExamDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split(/[-/]/);
    if (parts.length === 3) {
      let [d, m, y] = parts;
      d = parseInt(d);
      if (isNaN(d)) return null;

      if (isNaN(m)) {
        const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const mIndex = monthNames.findIndex((x) => x === m.toLowerCase().slice(0, 3));
        if (mIndex === -1) return null;
        return new Date(y, mIndex, d);
      } else {
        return new Date(y, m - 1, d);
      }
    }
    return new Date(dateStr);
  };

  function computeExamTimes(reportingTimeStr, examDateStr, examType) {
    if (!reportingTimeStr || !examDateStr) return {};

    const [day, monthStr, year] = examDateStr.split(/[-/]/);
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = monthNames.findIndex(m => monthStr.toLowerCase().startsWith(m));

    const [hours, minutes, meridian] = reportingTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i).slice(1);
    let h = parseInt(hours);
    let m = parseInt(minutes);
    if (meridian.toUpperCase() === "PM" && h !== 12) h += 12;
    if (meridian.toUpperCase() === "AM" && h === 12) h = 0;

    const start = new Date(year, month, day, h, m);

    const duration =
      examType.toUpperCase().includes("CAT") ? 1 * 60 + 45 :
        examType.toUpperCase().includes("FAT") ? 3 * 60 + 30 :
          0;

    const end = new Date(start.getTime() + duration * 60000);

    const fmt = (d) =>
      d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

    return {
      startUTC: fmt(start),
      endUTC: fmt(end),
    };
  }


  const generateICSFile = (subjects, examType) => {
    const events = subjects
      .filter((s) => s.reportingTime && s.examSession)
      .map((subj) => {
        const { startUTC, endUTC } = computeExamTimes(subj.reportingTime, subj.examDate, examType);
        const uid = crypto.randomUUID();
        const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

        return [
          "BEGIN:VEVENT",
          `SUMMARY:${subj.courseTitle} (${examType})`,
          `DESCRIPTION:${subj.courseCode} — ${subj.reportingTime} @ ${subj.venue == "-" ? "TBA" : subj.venue}`,
          `LOCATION:${subj.venue == "-" ? "TBA" : subj.venue}`,
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


    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    return URL.createObjectURL(blob);
  };

  const todayExams = Object.entries(scheduleObj)
    .flatMap(([examType, subjects]) =>
      (subjects as any[]).filter((subj: any) => {
        const examDate = parseExamDate(subj.examDate);
        return examDate && examDate.getTime() === today.getTime();
      }).map((subj: any) => ({ ...subj, examType }))
    );

  const compareExamDates = (left, right) => {
    const leftDate = parseExamDate(left.examDate);
    const rightDate = parseExamDate(right.examDate);

    if (!leftDate && !rightDate) return 0;
    if (!leftDate) return 1;
    if (!rightDate) return -1;

    const dateDiff = leftDate.getTime() - rightDate.getTime();
    if (dateDiff !== 0) return dateDiff;

    return `${left.examTime ?? ""} ${left.courseCode ?? ""}`.localeCompare(
      `${right.examTime ?? ""} ${right.courseCode ?? ""}`
    );
  };

  const sortedTodayExams = [...todayExams].sort(compareExamDates);


  return (
    <div className="space-y-6 p-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
        {/* Mobile View: Inline Center */}
        <div className="md:hidden flex items-center justify-between w-full mb-3">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-gray-100">
            Exam Schedule
          </h1>
          <div className="flex items-center gap-1.5">
            <button onClick={handleCopyCodes} disabled={allCourseCodes.length === 0} className="p-2 rounded-lg bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white transition-colors" title="Copy course codes">
              <ClipboardList className="w-4 h-4" />
            </button>
            <button onClick={handleDownloadImage} disabled={isDownloading} className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white transition-colors" title="Download PNG">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={handlePrint} disabled={isDownloading} className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white transition-colors" title="Print / PDF">
              <Printer className="w-4 h-4" />
            </button>
            <button onClick={handleScheduleFetch} className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
              <RefreshCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Desktop View: Left Aligned Heading + Right Aligned Buttons */}
        <h1 className="hidden md:block text-3xl font-bold text-left text-gray-900 dark:text-gray-100 midnight:text-gray-100">
          Exam Schedule
        </h1>
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={handleCopyCodes}
            disabled={allCourseCodes.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white text-sm font-medium transition-colors shadow-sm"
            title="Copy all course codes"
          >
            <ClipboardList className="w-4 h-4" /> <span className="text-sm">Copy Codes</span>
          </button>
          <button
            onClick={handleDownloadImage}
            disabled={isDownloading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> <span className="text-sm">{isDownloading ? "..." : "PNG"}</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={isDownloading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" /> <span className="text-sm">{isDownloading ? "..." : "Print / PDF"}</span>
          </button>
          <button onClick={handleScheduleFetch} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors shadow-sm">
            <RefreshCcw className={`w-4 h-4`} /> <span className="text-sm">Reload</span>
          </button>
        </div>
      </div>

      <div ref={captureRef}>  
      {sortedTodayExams.length > 0 && (
        <div className="bg-green-100 dark:bg-green-700/40 midnight:bg-green-800/40 
                  rounded-xl p-4 shadow mb-6 border border-green-300 
                  dark:border-green-600 midnight:border-green-700">

          <div className="space-y-6">
            {sortedTodayExams.map((exam, i) => (
              <div
                key={i}
                className="grid grid-cols-2 lg:grid-cols-3 gap-4
                     bg-white/40 dark:bg-black/20 midnight:bg-black/20
                     p-4 rounded-lg border border-green-200 
                     dark:border-green-600/40 midnight:border-green-700/40"
              >
                <div>
                  <p className="font-semibold">Course:</p>
                  <p>{exam.courseCode} — {exam.courseTitle}</p>
                </div>

                <div>
                  <p className="font-semibold">Exam Time:</p>
                  <p>{exam.examTime}</p>
                </div>

                <div>
                  <p className="font-semibold">Session:</p>
                  <p>{exam.examSession}</p>
                </div>

                <div>
                  <p className="font-semibold">Reporting Time:</p>
                  <p>{exam.reportingTime}</p>
                </div>

                <div>
                  <p className="font-semibold">Venue:</p>
                  <p>{exam.venue}</p>
                </div>

                <div>
                  <p className="font-semibold">Seat:</p>
                  <p>{exam.seatLocation === "-" && exam.seatNo && exam.seatNo !== "-"
                    ? calculateSeatLocation(exam.seatNo, exam.courseTitle)
                    : exam.seatLocation}, #{exam.seatNo}</p>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {Object.entries(scheduleObj).map(([examType, subjects]: [string, any]) => {
        const sortedSubjects = [...subjects].sort(compareExamDates);
        const hasCalendarData = sortedSubjects.some((s) => s.examSession && s.reportingTime);
        const icsUrl = hasCalendarData ? generateICSFile(sortedSubjects, examType) : null;

        return (
          <div
            key={examType}
            className="bg-slate-50 dark:bg-slate-800 midnight:bg-black shadow rounded-2xl p-4 midnight:outline midnight:outline-1 midnight:outline-gray-800"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-blue-700 dark:text-blue-400 midnight:text-white">
                {examType}
              </h2>

              {hasCalendarData && isIOS && (
                <div className="flex gap-2">
                  <a
                    href={icsUrl}
                    download={`${examType}_Schedule_iOS.ics`}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black px-3 py-1.5 rounded-md text-sm font-medium"
                  >
                    Add to Calendar
                  </a>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-2">
              {sortedSubjects.map((subj, idx) => {
                const examDate = parseExamDate(subj.examDate);
                const isPast = examDate && examDate < today;
                const isToday = examDate && examDate.getTime() === today.getTime();

                let cardClass =
                  "flex flex-col p-4 rounded-xl shadow-sm border transition-all ";
                
                if (isPast) {
                  cardClass += "bg-gray-100 dark:bg-gray-800/50 midnight:bg-gray-900/50 border-gray-200 dark:border-gray-700 midnight:border-gray-800 opacity-60";
                } else if (isToday) {
                  cardClass += "bg-green-50 dark:bg-green-900/20 midnight:bg-green-900/30 border-green-300 dark:border-green-700 midnight:border-green-800";
                } else {
                  cardClass += "bg-white dark:bg-slate-800 midnight:bg-gray-900 border-gray-200 dark:border-slate-700 midnight:border-gray-800 hover:shadow-md";
                }

                const finalSeatLocation = subj.seatLocation === "-" && subj.seatNo && subj.seatNo !== "-"
                  ? calculateSeatLocation(subj.seatNo, subj.courseTitle)
                  : subj.seatLocation;

                return (
                  <div key={idx} className={cardClass}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className={`font-bold text-lg ${isPast ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-blue-700 dark:text-blue-400 midnight:text-blue-400'}`}>
                          {subj.courseCode}
                        </h3>
                        <p className={`text-sm font-medium ${isPast ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-300 midnight:text-gray-300'}`}>
                          {subj.courseTitle}
                        </p>
                      </div>
                      {subj.slot && subj.slot !== "-" && (
                        <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-md">
                          Slot: {subj.slot}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm mt-auto pt-3 border-t border-gray-100 dark:border-slate-700 midnight:border-gray-800">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Date & Time</p>
                        <p className={`font-medium ${isPast ? 'text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                          {subj.examDate}<br/>{subj.examTime}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Venue</p>
                        <p className={`font-medium ${isPast ? 'text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                          {subj.venue}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Session & Reporting</p>
                        <p className={`font-medium ${isPast ? 'text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                          {subj.examSession}<br/>{subj.reportingTime}
                        </p>
                      </div>

                      <div>
                        <p className="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">Seat</p>
                        <p className={`font-medium ${isPast ? 'text-gray-500' : 'text-gray-900 dark:text-gray-100'}`}>
                          Loc: {finalSeatLocation}<br/>No: {subj.seatNo}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

function calculateSeatLocation(seatNo: string, courseTitle: string): string {
  const n = Number(seatNo);
  if (isNaN(n) || n <= 0) return "-";
  if (courseTitle.startsWith("Qualitative") || courseTitle.startsWith("Quantitative") || courseTitle.startsWith("French") || courseTitle.startsWith("German") || courseTitle.startsWith("Spanish") || courseTitle.startsWith("Japanese")) {
    return "-";
  }

  const groupIndex = Math.floor((n - 1) / 18);
  const C1 = groupIndex * 2 + 1;
  const C2 = C1 + 1;

  const pos = (n - 1) % 18;
  const row = Math.floor(pos / 2) + 1;

  const col = (pos % 2 === 0) ? C1 : C2;

  return `R${row}C${col}`;
}
