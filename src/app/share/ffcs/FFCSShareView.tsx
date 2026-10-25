"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Map as MapIcon, AlertTriangle, CalendarDays, Layers, Clock } from "lucide-react";
import {
  decodeCompactTimetableShare,
  decodeTimetableShare,
} from "@/lib/ffcsShare";
import { CAMPUS_SCHEMAS, GLOBAL_CAMPUS } from "@/lib/campusSchema";
import { timetableMetrics, formatHours } from "@/lib/timetableMetrics";
import { downloadModernTimetableImage } from "@/lib/exportTimetable";
import { storage } from "@/lib/storage";
import { track } from "@/lib/analytics";
import { TimetableGrid } from "@/components/custom/exams/FFCS/components/TimetableGrid";
import { DAYS } from "@/components/custom/exams/FFCS/constants";
import type { ParsedCourse, TimetablePeriod, TimetableState } from "@/components/custom/exams/FFCS/types";
import { getFFCSSemester, parseReportRows } from "@/components/custom/exams/FFCS/reports";
import { COLORS } from "@/components/custom/exams/FFCS/constants";
import { splitSlots } from "@/components/custom/exams/FFCS/logic/generate";
import { getAssetPath } from "@/lib/utils";

/**
 * The receiver's side of a share link: the plan, read-only, plus the two
 * things worth doing with it — keep it as an image, or open it in the
 * planner on this device.
 *
 * "Open in planner" writes into `ffcs_timetables` under a fresh id and
 * switches the active plan to it, which is exactly what the planner hydrates
 * from on its next mount — the hand-off needs no channel between the two
 * pages because storage already is the channel the planner trusts.
 */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`card-surface border border-border-strong rounded-2xl p-5 ${className}`}>{children}</div>;
}

export default function FFCSShareView() {
  const searchParams = useSearchParams();
  const encoded = searchParams.get("d") ?? "";
  const compactEncoded = searchParams.get("x") ?? "";
  const fullDecoded = useMemo(() => decodeTimetableShare(encoded), [encoded]);
  const compactPayload = useMemo(
    () => decodeCompactTimetableShare(compactEncoded),
    [compactEncoded]
  );
  const [compactDecoded, setCompactDecoded] = useState<{
    timetable: TimetableState;
    campus: string;
  } | null>(null);
  const [compactLoadState, setCompactLoadState] = useState<"idle" | "loading" | "ready" | "invalid">("idle");
  const decoded = compactEncoded ? compactDecoded : fullDecoded;

  useEffect(() => {
    if (!compactEncoded) {
      setCompactDecoded(null);
      setCompactLoadState("idle");
      return;
    }
    if (!compactPayload) {
      setCompactDecoded(null);
      setCompactLoadState("invalid");
      return;
    }

    let active = true;
    setCompactDecoded(null);
    setCompactLoadState("loading");
    const loadCompactTimetable = async () => {
      try {
        const semester = getFFCSSemester(compactPayload.s);
        const response = await fetch(getAssetPath(semester.path));
        if (!response.ok) throw new Error(`Failed to fetch ${semester.path}`);
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
        const reportCourses = parseReportRows(rows);
        const selectedCourses = compactPayload.i.map((suffix) =>
          reportCourses.find((course) => course.CLASS_ID === `${compactPayload.p}${suffix}`)
        );
        if (selectedCourses.some((course) => !course)) {
          throw new Error("One or more shared class IDs are not in the selected semester report.");
        }
        const resolvedCourses = selectedCourses.filter(
          (course): course is ParsedCourse => Boolean(course)
        );

        const timetable: TimetableState = {
          id: `share-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          name: compactPayload.n,
          courses: resolvedCourses.map((course, index) => ({
            id: `share-${course.CLASS_ID}`,
            code: course.CODE,
            title: course.TITLE,
            slots: splitSlots(course.SLOT),
            faculty: course.FACULTY,
            employeeId: course.ERP_ID,
            classId: course.CLASS_ID,
            venue: course.ROOM,
            credits: course.CREDITS,
            type: course.TYPE || (course.SLOT.includes("L") ? "Lab" : "Theory"),
            color: COLORS[index % COLORS.length],
            batch: course!.BATCH,
          })),
        };
        if (!active) return;
        setCompactDecoded({ timetable, campus: GLOBAL_CAMPUS });
        setCompactLoadState("ready");
      } catch {
        if (!active) return;
        setCompactDecoded(null);
        setCompactLoadState("invalid");
      }
    };
    void loadCompactTimetable();
    return () => {
      active = false;
    };
  }, [compactEncoded, compactPayload]);

  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (decoded) {
      track("share_opened", { courses: decoded.timetable.courses.length });
    }
  }, [decoded]);

  const schema = useMemo(() => {
    if (!decoded) return null;
    return (CAMPUS_SCHEMAS[decoded.campus] ?? CAMPUS_SCHEMAS[GLOBAL_CAMPUS]) as any;
  }, [decoded]);

  const theoryPeriods = useMemo(
    () => ((schema?.theory ?? []) as TimetablePeriod[]).filter((p) => !p.lunch),
    [schema]
  );
  const labPeriods = useMemo(
    () => ((schema?.lab ?? []) as TimetablePeriod[]).filter((p) => !p.lunch),
    [schema]
  );

  const metrics = useMemo(() => {
    if (!decoded || !schema) return null;
    try {
      return timetableMetrics(decoded.timetable.courses, schema);
    } catch {
      return null; // a metric failure must never cost the student the plan itself
    }
  }, [decoded, schema]);

  const downloadImage = async (format: "jpg" | "png") => {
    if (!decoded) return;
    setIsDownloading(true);
    try {
      await downloadModernTimetableImage({
        timetableName: decoded.timetable.name,
        courses: decoded.timetable.courses,
        theoryPeriods,
        labPeriods,
        days: DAYS,
        viewMode: "horizontal",
        format,
        themeBgColor: "#090d16",
      });
      track("export_image", { format, viewMode: "horizontal" });
    } catch (err) {
      console.error(err);
    } finally {
      setIsDownloading(false);
    }
  };

  const openInPlanner = () => {
    if (!decoded) return;
    const existing = storage.ffcsTimetables.get();
    const list: TimetableState[] = Array.isArray(existing) ? (existing as TimetableState[]) : [];
    storage.ffcsTimetables.set([...list, decoded.timetable]);
    storage.ffcsActiveTimetableId.set(decoded.timetable.id);
    track("timetable_saved", { source: "share" });
  };

  if (!decoded) {
    if (compactEncoded && (compactLoadState === "idle" || compactLoadState === "loading")) {
      return (
        <main className="min-h-screen bg-surface text-text-heading flex items-center justify-center p-4">
          <Card className="max-w-md w-full text-center space-y-3">
            <h1 className="text-lg font-bold">Opening short timetable link…</h1>
            <p className="text-sm text-muted-foreground">
              Loading the selected semester report to resolve its class IDs.
            </p>
          </Card>
        </main>
      );
    }
    return (
      <main className="min-h-screen bg-surface text-text-heading flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold">This link isn&rsquo;t a timetable plan</h1>
          <p className="text-sm text-muted-foreground">
            {compactEncoded
              ? "The selected semester report could not resolve every class ID in this short link. Ask for a fresh link or use the full timetable link instead."
              : "It may have been cut off in transit, or it was made by a different version of the planner. Ask for the link again, or build one of your own."}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
          >
            <MapIcon className="w-4 h-4" /> Open the FFCS Planner
          </Link>
        </Card>
      </main>
    );
  }

  const { timetable, campus } = decoded;

  return (
    <main className="min-h-screen bg-surface text-text-heading">
      <div className="w-full p-4 md:p-8 space-y-5">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <MapIcon className="text-blue-500 w-6 h-6" /> {timetable.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {timetable.courses.length} course{timetable.courses.length === 1 ? "" : "s"} ·{" "}
              {campus} campus · shared from AmazeCC FFCS Planner
            </p>
          </div>
        </header>

        {metrics && (
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border-strong">
              <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
              {metrics.halfDays} half-day{metrics.halfDays === 1 ? "" : "s"} off
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border-strong">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              {formatHours(metrics.gaps)} of gaps
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-secondary border border-border-strong">
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
              {timetable.courses.length} classes a week
            </span>
          </div>
        )}

        <Card>
          <div className="rounded-xl overflow-hidden">
            <TimetableGrid
              courses={timetable.courses}
              customCourses={timetable.courses}
              fullSize
              blockedSlots={new Set<string>()}
              toggleBlockSlot={() => {
                /* read-only here: `customCourses` is what keeps cells out of
                   block mode, so this is never invoked */
              }}
              theoryPeriods={theoryPeriods}
              labPeriods={labPeriods}
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-bold text-sm mb-3">The courses in this plan</h2>
          <ul className="divide-y divide-border/40">
            {timetable.courses.map((course) => (
              <li key={course.id} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold truncate">
                    {course.code}
                    <span className="ml-2 font-normal text-muted-foreground truncate">
                      {course.title}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {course.faculty || "Faculty unstated"}
                    {course.venue ? ` · ${course.venue}` : ""}
                  </p>
                </div>
                <span className="text-xs font-mono text-muted-foreground shrink-0">
                  {course.slots.join(" + ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => void downloadImage("png")}
            disabled={isDownloading}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? "Preparing image…" : "Download as PNG"}
          </button>
          <button
            type="button"
            onClick={() => void downloadImage("jpg")}
            disabled={isDownloading}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? "Preparing image…" : "Download as JPEG"}
          </button>
          <Link
            href="/ffcs"
            onClick={openInPlanner}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-3 rounded-xl transition-colors"
          >
            <MapIcon className="w-4 h-4" /> Open in planner
          </Link>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pb-6">
          {compactEncoded
            ? "This short link contains the semester and selected class IDs; the matching public semester report supplies the timetable details."
            : "Plans travel inside the link itself — nothing was uploaded, and opening one here keeps it on this device."}
        </p>
      </div>
    </main>
  );
}
