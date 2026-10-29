"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, Map as MapIcon, AlertTriangle, CalendarDays, Layers, Clock } from "lucide-react";
import { decodeTimetableShare } from "@/lib/ffcsShare";
import { resolveShareInput, type ParsedShareInput } from "@/lib/ffcsShareInput";
import { CAMPUS_SCHEMAS, GLOBAL_CAMPUS } from "@/lib/campusSchema";
import { timetableMetrics, formatHours } from "@/lib/timetableMetrics";
import { downloadModernTimetableImage } from "@/lib/exportTimetable";
import { storage } from "@/lib/storage";
import { track } from "@/lib/analytics";
import { TimetableGrid } from "@/components/custom/exams/FFCS/components/TimetableGrid";
import SelectedCoursesList from "@/components/custom/exams/FFCS/components/SelectedCoursesList";
import FacultyReviewSheetHost from "@/components/custom/exams/FFCS/components/FacultyReviewSheetHost";
import { DAYS } from "@/components/custom/exams/FFCS/constants";
import type { TimetablePeriod, TimetableState } from "@/components/custom/exams/FFCS/types";
import { useOverlayBackBoundary } from "@/lib/overlayStack";
import { useFacultyReviewSheet } from "@/components/custom/exams/FFCS/hooks/useFacultyReviewSheet";

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
  useOverlayBackBoundary("ffcs-share-route");
  const searchParams = useSearchParams();
  const encoded = searchParams.get("d") ?? "";
  const compactEncoded = searchParams.get("x") ?? "";
  const shapeEncoded = searchParams.get("q") ?? "";
  const numericShapeEncoded = searchParams.get("r") ?? "";
  const fullDecoded = useMemo(() => decodeTimetableShare(encoded), [encoded]);
  const hasReportBackedLink = Boolean(compactEncoded || shapeEncoded || numericShapeEncoded);
  // Which parameter is present names the payload's format outright — this
  // page never has to guess, unlike the add-friend field, which is why the
  // formats are declared here rather than detected. Report-backed wins over
  // `d=` when a URL carries both, as it always has. Memoized because the load
  // effect keys off identity: an object rebuilt each render would refetch
  // forever.
  const shareInput = useMemo<ParsedShareInput | null>(
    () =>
      shapeEncoded
        ? { format: "shape", encoded: shapeEncoded }
        : numericShapeEncoded
          ? { format: "numeric-shape", encoded: numericShapeEncoded }
          : compactEncoded
            ? { format: "compact", encoded: compactEncoded }
            : encoded
              ? { format: "full", encoded }
              : null,
    [shapeEncoded, numericShapeEncoded, compactEncoded, encoded],
  );
  const [resolvedReport, setResolvedReport] = useState<{
    timetable: TimetableState;
    campus: string;
  } | null>(null);
  const [compactLoadState, setCompactLoadState] = useState<"idle" | "loading" | "ready" | "invalid">("idle");
  const decoded = hasReportBackedLink ? resolvedReport : fullDecoded;

  useEffect(() => {
    if (!hasReportBackedLink || !shareInput) {
      setResolvedReport(null);
      setCompactLoadState(hasReportBackedLink ? "invalid" : "idle");
      return;
    }

    let active = true;
    setResolvedReport(null);
    setCompactLoadState("loading");
    // `resolveShareInput` loads the semester report and turns the shared class
    // IDs back into courses — the same path the add-friend field takes, so a
    // link opened by a friend and one pasted into the planner cannot disagree.
    resolveShareInput(shareInput)
      .then((result) => {
        if (!active) return;
        setResolvedReport(result);
        setCompactLoadState("ready");
      })
      .catch(() => {
        if (!active) return;
        setResolvedReport(null);
        setCompactLoadState("invalid");
      });
    return () => {
      active = false;
    };
  }, [hasReportBackedLink, shareInput]);

  const [isDownloading, setIsDownloading] = useState(false);
  const { target: facultyReviewTarget, open: openFacultyReview, close: closeFacultyReview } = useFacultyReviewSheet();

  useEffect(() => {
    if (decoded) {
      track("share_opened", { courses: decoded.timetable.courses.length });
    }
  }, [decoded]);

  const schema = useMemo(() => {
    if (!decoded) return null;
    return (CAMPUS_SCHEMAS[decoded.campus] ?? CAMPUS_SCHEMAS[GLOBAL_CAMPUS]) as any;
  }, [decoded]);

  const theoryPeriods = useMemo(() => ((schema?.theory ?? []) as TimetablePeriod[]).filter((p) => !p.lunch), [schema]);
  const labPeriods = useMemo(() => ((schema?.lab ?? []) as TimetablePeriod[]).filter((p) => !p.lunch), [schema]);

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
    if (hasReportBackedLink && (compactLoadState === "idle" || compactLoadState === "loading")) {
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
            {hasReportBackedLink
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
              {timetable.courses.length} course{timetable.courses.length === 1 ? "" : "s"} · {campus} campus · shared
              from AmazeCC FFCS Planner
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
          <SelectedCoursesList
            courses={timetable.courses}
            title="The courses in this plan"
            onReviewClick={openFacultyReview}
          />
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
          {shapeEncoded || numericShapeEncoded
            ? numericShapeEncoded
              ? "This numeric TT shape link contains delta-packed class IDs. Its numeric code selects the semester report used to rebuild the timetable."
              : "This TT shape link contains only class IDs. Their shared prefix identifies the semester report used to rebuild the timetable."
            : compactEncoded
              ? "This short link contains the semester and selected class IDs; the matching public semester report supplies the timetable details."
              : "Plans travel inside the link itself — nothing was uploaded, and opening one here keeps it on this device."}
        </p>
        <FacultyReviewSheetHost target={facultyReviewTarget} onClose={closeFacultyReview} />
      </div>
    </main>
  );
}
