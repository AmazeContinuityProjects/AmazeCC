"use client";

import { useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  BookOpen,
  CalendarRange,
  ChevronRight,
  FlaskConical,
  Gauge,
  GraduationCap,
  Info,
  Layers,
  RefreshCcw,
  TrendingUp,
} from "lucide-react";
import { cn } from "@amazecontinuityprojects/amazeui";
import {
  ChipTabs,
  EmptyPanel,
  IconButton,
  InsightCarousel,
  KeyValue,
  ListRowText,
  ListShell,
  ListSkeleton,
  MiniBar,
  PageShell,
  SectionHeader,
  StatTile,
  SubpageScreen,
  ToneBadge,
  useCarousel,
  useSubpageStack,
  type InsightSlide,
} from "../shared/primitives";
import { LIST_ROW, TILE, TILE_CARD, TONE_TEXT } from "@/lib/uiTokens";
import {
  averageByType,
  bestTerm,
  cumulativeGpa,
  embeddedSegments,
  gradeDistribution,
  gradePoints,
  isEmbeddedCourse,
  latestSemester,
  segmentBlend,
  semesterRows,
  toneForGrade,
  weightedTotal,
  weightedTotalDiffers,
  type SemesterRow,
} from "@/lib/gradeHistory";
import type { GradeItem, GradeResultsMap } from "@/types/data/allgrades";

/**
 * Grade history.
 *
 * This was a hero card, a row of hand-rolled semester pills, three `recharts`
 * charts, four stat tiles and a list of expandable course cards — nine surfaces,
 * and the three charts shipped `recharts` in the first-load bundle for a screen
 * most people open a few times a term. The numbers are all still here; what
 * changed is that the trend and the semester picker became one object (the chip
 * strip), the radar became the sorted course list (which is the same data, and
 * readable), and the per-subject detail moved into a subpage where it has room
 * to be a page instead of an accordion.
 *
 * The arithmetic lives in `@/lib/gradeHistory`, not here. This file is layout
 * and tone.
 */

const SCREENS = ["overview", "insights", "course"] as const;
type Screen = (typeof SCREENS)[number];

/** A bar's hue, keyed on the same grade tones the pills use. */
const GRADE_BAR: Record<string, string> = {
  S: "bg-amber-500",
  A: "bg-emerald-500",
  B: "bg-blue-500",
  C: "bg-cyan-500",
  D: "bg-violet-500",
  E: "bg-red-500",
  F: "bg-red-600",
  N: "bg-zinc-400",
  P: "bg-violet-500",
};

export default function MarksHistoryTab({
  data,
  marksData,
  pastSemesters,
  onRefresh,
  refreshing,
  onBack,
}: {
  data: { grades?: GradeResultsMap } | null;
  marksData: any;
  /**
   * Frozen per-semester data from `pastDataSync`, keyed by semester id. Only
   * `marks` is read here, and only to split an embedded course into its theory
   * and lab halves - VTOP does not publish those in `all-grades`.
   */
  pastSemesters?: Record<string, { attendance?: any; marks?: any }> | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  onBack?: () => void;
}) {
  const stack = useSubpageStack<Screen>({ screens: SCREENS });
  const { screen, isRoot } = stack;

  const rows = useMemo(() => semesterRows(data?.grades), [data]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openCourse, setOpenCourse] = useState<{ item: GradeItem; semesterId: string } | null>(null);

  // The newest term with courses in it, unless the reader has picked another.
  const active: SemesterRow | undefined = useMemo(
    () => rows.find((r) => r.id === activeId) ?? latestSemester(rows),
    [rows, activeId]
  );

  const cumulative = useMemo(
    () => cumulativeGpa(rows, marksData?.cgpa),
    [rows, marksData]
  );
  const best = useMemo(() => bestTerm(rows), [rows]);

  // Computed up here rather than beside the insights screen below, because that
  // screen is behind an early `return` and a `useMemo` after one is a
  // conditional hook — the count of hooks would change with the data.
  const allCourses = useMemo(() => rows.flatMap((r) => r.courses), [rows]);
  const distribution = useMemo(() => gradeDistribution(allCourses), [allCourses]);
  const byType = useMemo(() => averageByType(allCourses), [allCourses]);

  // The opened course, and the two halves behind it if it is embedded. Also up
  // here for the same reason as the three above: the course screen renders
  // after an early `return`, so a hook down there would be conditional.
  const opened = openCourse;
  const course = opened?.item ?? null;

  // VTOP publishes an embedded course as one blended grade with a flat
  // breakdown. The theory and lab halves are only in that term's marks
  // payload, which `pastDataSync` already caches as `frozen_marks_<semesterId>`.
  const frozenMarks = opened ? pastSemesters?.[opened.semesterId]?.marks : null;
  const segments = useMemo(
    () => embeddedSegments(course?.courseCode ?? "", frozenMarks),
    [course?.courseCode, frozenMarks]
  );
  const blend = segments ? segmentBlend(segments, course?.grandTotal) : null;

  const insightSlides = useMemo<InsightSlide[]>(() => {
    const out: InsightSlide[] = [];
    if (active && active.courses.length > 0) {
      out.push({
        id: "term",
        label: "This term",
        value: active.gpa > 0 ? active.gpa.toFixed(2) : "—",
        sub: `${active.label} · ${active.courses.length} courses`,
        badge: "GPA",
        tone: active.gpa >= 9 ? "emerald" : active.gpa >= 8 ? "indigo" : "amber",
      });
    }
    if (best) {
      out.push({
        id: "best",
        label: "Best term",
        value: best.gpa.toFixed(2),
        sub: best.label,
        badge: "Peak",
        tone: "emerald",
      });
    }
    out.push({
      id: "terms",
      label: "Terms recorded",
      value: String(rows.filter((r) => r.courses.length > 0).length),
      sub: rows.length > 1 ? `across ${rows.length} published` : "so far",
      badge: "History",
      tone: "neutral",
    });
    return out;
  }, [active, best, rows]);

  const carousel = useCarousel(insightSlides.length);

  // ── Nothing to show ──────────────────────────────────────────────────
  // A payload that has not arrived yet is a different state from one that
  // arrived empty, and only the second is something to offer the reader.
  if (!data && refreshing) {
    return (
      <PageShell
        eyebrow="Academics · Grades"
        title="Grade History"
        subtitle="Every term's results in one place."
        onBack={onBack}
      >
        <ListSkeleton rows={5} leading="dot" trailing />
      </PageShell>
    );
  }

  if (rows.length === 0) {
    return (
      <PageShell
        eyebrow="Academics · Grades"
        title="Grade History"
        subtitle="Every term's results in one place."
        onBack={onBack}
        selectable
      >
        <EmptyPanel
          icon={<GraduationCap className="h-7 w-7" />}
          title="No grades yet"
          description="Pull your grades from VTOP and every term's GPA, letter grades and assessment breakdowns will collect here."
          action={
            onRefresh ? (
              <button
                type="button"
                onClick={onRefresh}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-indigo-700"
              >
                <RefreshCcw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Sync grades
              </button>
            ) : null
          }
        />
      </PageShell>
    );
  }

  // ── Hero: cumulative CGPA + a rotating read on where the standing is ──
  const hero = (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <div className={cn(TILE, "min-h-32 sm:min-h-36")}>
        <div className="flex items-center justify-between gap-1">
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
            Cumulative
          </span>
          {cumulative.creditsRequired > 0 && (
            <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 border bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20">
              {cumulative.creditsEarned.toFixed(0)}/{cumulative.creditsRequired.toFixed(0)} cr
            </span>
          )}
        </div>
        <div className="my-auto min-w-0">
          <span
            className={cn(
              "text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block truncate",
              cumulative.value > 0 ? TONE_TEXT.indigo : "text-zinc-900 dark:text-white"
            )}
          >
            {cumulative.value > 0 ? cumulative.value.toFixed(2) : "—"}
          </span>
        </div>
        <p className="text-[10.5px] sm:text-xs text-text-secondary dark:text-text-muted font-medium truncate">
          {cumulative.source === "derived" ? "Mean of terms, not weighted" : "Credit-weighted CGPA"}
        </p>
      </div>

      <InsightCarousel
        slides={insightSlides}
        carousel={carousel}
        height="min-h-32 sm:min-h-36"
      />
    </div>
  );

  // ── Overview ──────────────────────────────────────────────────────────
  const overview = (
    <div className="space-y-6">
      {hero}

      <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
        GPA is the figure VTOP published for that term. Cumulative is credit-weighted across
        every term so far, so it moves less than a single term&apos;s average does.
      </p>

      <div className="space-y-3">
        <SectionHeader
          icon={BookOpen}
          title="Courses"
          count={active?.courses.length}
          right={
            rows.length > 1 ? (
              <ChipTabs
                size="sm"
                options={rows.map((r) => ({ value: r.id, label: r.label }))}
                value={active?.id ?? ""}
                onChange={setActiveId}
                className="max-w-[190px]"
              />
            ) : null
          }
        />

        {!active || active.courses.length === 0 ? (
          <EmptyPanel
            variant="dashed"
            title="No courses for this term"
            description="VTOP has not published a course list for this semester yet."
          />
        ) : (
          <ListShell>
            {sortByGrade(active.courses).map((c, i) => (
              <CourseRow
                key={`${c.courseCode}-${i}`}
                course={c}
                onOpen={() => {
                  setOpenCourse({ item: c, semesterId: active.id });
                  stack.go("course");
                }}
              />
            ))}
          </ListShell>
        )}
      </div>

      {/* The trend, below the list. Reading it is a deliberate act; deciding
          which term to look at is not, so it does not sit above the courses. */}
      <div className="space-y-3">
        <SectionHeader
          icon={TrendingUp}
          title="Across terms"
          count={rows.length}
        />
        <ListShell>
          {rows.map((r) => {
            const isActive = r.id === active?.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setActiveId(r.id)}
                className={`${LIST_ROW} cursor-pointer`}
              >
                <span className="w-24 shrink-0 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 truncate">
                  {r.label}
                </span>
                <span className="min-w-0 flex-1">
                  <MiniBar pct={(r.gpa / 10) * 100} tone={gpaBarTone(r.gpa)} />
                </span>
                <span
                  className={cn(
                    "shrink-0 text-sm font-black font-outfit tracking-tight leading-none w-10 text-right",
                    isActive ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-800 dark:text-zinc-100"
                  )}
                >
                  {r.gpa > 0 ? r.gpa.toFixed(2) : "—"}
                </span>
              </button>
            );
          })}
        </ListShell>
      </div>

      <button
        type="button"
        onClick={() => stack.go("insights")}
        className={`${TILE_CARD} w-full flex items-center gap-3 text-left cursor-pointer hover:border-border-strong dark:hover:border-border transition-colors`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400">
          <BarChart3 className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-text-heading font-outfit tracking-tight">
            Grade insights
          </span>
          <span className="block text-[11px] text-text-secondary dark:text-text-muted font-medium mt-0.5 truncate">
            Grade distribution, theory against lab, and score by term
          </span>
        </span>
        <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
      </button>
    </div>
  );

  // ── Insights ──────────────────────────────────────────────────────────
  const insights = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile
          label="Terms recorded"
          value={rows.filter((r) => r.courses.length > 0).length}
          badge="All time"
          tone="indigo"
          sub={
            rows.length > 1 ? `${rows.length} terms published` : "so far"
          }
        />
        <StatTile
          label="Best term"
          value={best ? best.gpa.toFixed(2) : "—"}
          badge={best?.label}
          tone="emerald"
          sub={best ? "highest GPA on record" : "no GPA published yet"}
        />
      </div>

      <div className="space-y-3">
        <SectionHeader
          icon={Award}
          title="Grade distribution"
          count={distribution.reduce((s, r) => s + r.count, 0)}
        />
        <p className="px-1 -mt-1 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
          Every graded course across all terms. Ungraded results are left out of the share
          entirely, so a term you have not been assessed on yet cannot distort it.
        </p>
        {distribution.length === 0 ? (
          <EmptyPanel variant="dashed" title="No letter grades published yet" />
        ) : (
          <ListShell>
            {distribution.map((d) => (
              <div key={d.grade} className={LIST_ROW}>
                <span className="w-14 shrink-0">
                  <ToneBadge tone={d.tone}>{d.grade}</ToneBadge>
                </span>
                <span className="min-w-0 flex-1">
                  <MiniBar pct={d.share} tone={GRADE_BAR[d.grade] ?? "bg-zinc-400"} />
                </span>
                <span className="shrink-0 text-sm font-black font-outfit text-zinc-800 dark:text-zinc-100 w-10 text-right">
                  {d.count}
                </span>
                <span className="shrink-0 text-[11px] font-bold text-zinc-400 dark:text-zinc-500 w-12 text-right">
                  {d.share.toFixed(0)}%
                </span>
              </div>
            ))}
          </ListShell>
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader icon={Gauge} title="Theory against lab" count={byType.length} />
        <p className="px-1 -mt-1 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
          An embedded course is published as two entries under one code, so averaging
          everything together hides whether it is your labs dragging the number.
        </p>
        {byType.length === 0 ? (
          <EmptyPanel variant="dashed" title="No scored courses to compare" />
        ) : (
          <ListShell>
            {byType.map((t) => (
              <div key={t.type} className={LIST_ROW}>
                <ListRowText
                  title={t.type}
                  subtitle={`${t.count} course${t.count === 1 ? "" : "s"}`}
                />
                <span className="w-20 shrink-0">
                  <MiniBar pct={t.avg} tone={t.avg >= 80 ? "bg-emerald-500" : t.avg >= 65 ? "bg-amber-500" : "bg-red-500"} />
                </span>
                <span className="shrink-0 text-sm font-black font-outfit text-zinc-800 dark:text-zinc-100 w-12 text-right">
                  {t.avg.toFixed(1)}%
                </span>
              </div>
            ))}
          </ListShell>
        )}
      </div>

      <div className="space-y-3">
        <SectionHeader icon={CalendarRange} title="Score by term" count={rows.length} />
        <ListShell>
          {rows.map((r) => (
            <div key={r.id} className={LIST_ROW}>
              <span className="w-24 shrink-0 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 truncate">
                {r.label}
              </span>
              <span className="min-w-0 flex-1">
                <MiniBar pct={r.avgScore} tone={r.avgScore >= 80 ? "bg-emerald-500" : r.avgScore >= 65 ? "bg-amber-500" : "bg-red-500"} />
              </span>
              <span className="shrink-0 text-sm font-black font-outfit text-zinc-800 dark:text-zinc-100 w-12 text-right">
                {r.scored.length > 0 ? `${r.avgScore.toFixed(1)}%` : "—"}
              </span>
            </div>
          ))}
        </ListShell>
      </div>
    </div>
  );

  // ── One course's grade, in full ───────────────────────────────────────
  const courseScreen = !course ? null : (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatTile
          label="Overall"
          value={`${numOrDash(course.grandTotal)}%`}
          badge={course.courseType}
          tone="neutral"
          sub="as recorded by VTOP"
        />
        <StatTile
          label="Grade"
          value={course.grade || "—"}
          badge={pointsLabel(course.grade)}
          tone={toneForGrade(course.grade)}
          sub={`${course.details?.length ?? 0} assessment${(course.details?.length ?? 0) === 1 ? "" : "s"}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <KeyValue label="Course" value={course.courseCode} />
        <KeyValue label="Type" value={course.courseType || "—"} />
      </div>

      {/* The halves, when the term's marks are cached. */}
      {isEmbeddedCourse(course) && segments && (
        <div className="space-y-3">
          <SectionHeader
            icon={Layers}
            title="Theory and lab"
            count={segments.length}
          />
          <p className="px-1 -mt-1 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
            VTOP records an embedded course as a single blended grade. These are the two
            halves it blends, each scored out of 100 on its own.
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {segments.map((s) => (
              <StatTile
                key={s.kind}
                label={s.kind}
                value={s.score == null ? "—" : `${s.score.toFixed(1)}%`}
                badge={s.credits == null ? undefined : `${s.credits} cr`}
                tone="neutral"
                sub={`${s.assessments.length} assessment${s.assessments.length === 1 ? "" : "s"}`}
              />
            ))}
          </div>

          {blend && (
            <p className="px-1 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
              <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
              Weighted by {blend.theoryCredits} and {blend.labCredits} credits, the halves come to{" "}
              <span className="font-bold text-zinc-600 dark:text-zinc-300">
                {blend.blended.toFixed(2)}
              </span>
              , against the {blend.published} VTOP recorded.
            </p>
          )}

          {segments.map((s) => (
            <div key={s.kind} className="space-y-2">
              <SectionHeader
                icon={s.kind === "Theory" ? BookOpen : FlaskConical}
                title={`${s.kind} assessments`}
                count={s.assessments.length}
              />
              {s.assessments.length === 0 ? (
                <EmptyPanel variant="dashed" title={`No ${s.kind.toLowerCase()} assessments published`} />
              ) : (
                <ListShell>
                  {s.assessments.map((a, i) => (
                    <div key={`${a.title}-${i}`} className="flex items-center gap-3 py-2.5 px-4">
                      <ListRowText
                        title={a.title}
                        subtitle={`${a.weightagePercent || "-"}% weightage`}
                      />
                      <span className="shrink-0 text-sm font-black font-outfit text-zinc-800 dark:text-zinc-100">
                        {a.scoredMark || "-"}
                        <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 ml-0.5">
                          /{a.maxMark || "-"}
                        </span>
                      </span>
                    </div>
                  ))}
                </ListShell>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Embedded with no cached halves: say so rather than show a flat list the
          reader will read as the whole story. */}
      {isEmbeddedCourse(course) && !segments && (
        <p className="px-1 flex items-start gap-2 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
          <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
          VTOP records embedded courses as one blended grade, so the theory and lab halves
          are not part of the published record. Refresh to pull this term&apos;s marks and
          split them.
        </p>
      )}

      <div className="space-y-3">
        <SectionHeader
          icon={Award}
          title={isEmbeddedCourse(course) && segments ? "Published breakdown" : "Assessments"}
          count={course.details?.length ?? 0}
        />
        {!course.details || course.details.length === 0 ? (
          <EmptyPanel
            variant="dashed"
            title="No assessment breakdown"
            description="VTOP published a final grade for this course without the per-assessment marks behind it."
          />
        ) : (
          <ListShell>
            {byWeightage(course.details).map((d, i) => (
              <div key={`${d.component}-${i}`} className="flex items-center gap-3 py-2.5 px-4">
                <ListRowText
                  title={d.component}
                  subtitle={`${d.weightagePercent ?? "-"}% weightage`}
                />
                <span className="shrink-0 text-sm font-black font-outfit text-zinc-800 dark:text-zinc-100">
                  {d.scoredMark ?? "-"}
                  <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 ml-0.5">
                    /{d.maxMark ?? "-"}
                  </span>
                </span>
              </div>
            ))}
          </ListShell>
        )}

        {/* The assessment list sums to a number, and that number is not always the
            one VTOP recorded. Saying so beats a reader adding up the column and
            concluding the app is wrong. */}
        {weightedTotalDiffers(course) && (
          <p className="px-1 flex items-start gap-2 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400 font-medium">
            <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
            The weightage above sums to {weightedTotal(course.details)?.toFixed(2)}, while VTOP
            records {numOrDash(course.grandTotal)}%. The recorded total is shown here.
          </p>
        )}
      </div>

      {course.range && (
        <div className="space-y-3">
          <SectionHeader
            icon={GraduationCap}
            title="Grade scale"
            count={Object.keys(course.range).length}
          />
          <ListShell>
            {Object.entries(course.range).map(([grade, rangeStr]) => (
              <div key={grade} className={LIST_ROW}>
                <span className="w-14 shrink-0">
                  <ToneBadge tone={toneForGrade(grade)}>{grade}</ToneBadge>
                </span>
                <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 truncate">
                  {String(rangeStr)}
                </span>
                {String(grade).toUpperCase() === String(course.grade ?? "").toUpperCase() && (
                  <ToneBadge tone="indigo" className="ml-auto">
                    Yours
                  </ToneBadge>
                )}
              </div>
            ))}
          </ListShell>
        </div>
      )}
    </div>
  );

  // ── Chrome ────────────────────────────────────────────────────────────
  // One shell for all three screens, so the header is described once and a
  // drill-down is genuinely a subpage. Back returns to the overview rather than
  // stepping through insights: neither is a child of the other, which is the
  // same reason `CurriculumPage` calls `reset()` here.
  const title =
    screen === "insights" ? "Grade Insights" : screen === "course" ? course?.courseCode ?? "Course" : "Grade History";
  const subtitle =
    screen === "insights"
      ? "How your grades are spread, across every term."
      : screen === "course"
        ? course?.courseTitle
        : "Every term's results in one place.";

  return (
    <PageShell
      eyebrow="Academics · Grades"
      title={title}
      subtitle={subtitle}
      wrap
      selectable
      onBack={isRoot ? onBack : stack.reset}
      actions={
        screen === "overview" && onRefresh ? (
          <IconButton onClick={onRefresh} title="Sync grades" disabled={refreshing}>
            <RefreshCcw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </IconButton>
        ) : null
      }
    >
      {screen === "overview" && (
        <SubpageScreen id="overview">{overview}</SubpageScreen>
      )}
      {screen === "insights" && <SubpageScreen id="insights">{insights}</SubpageScreen>}
      {screen === "course" && course && (
        // Keyed on the course, not the screen, so opening a different subject
        // re-runs the enter animation rather than swapping content in place.
        <SubpageScreen id={`course:${course.courseCode}`}>{courseScreen}</SubpageScreen>
      )}
    </PageShell>
  );
}

// ── Local bits ───────────────────────────────────────────────────────────

function numOrDash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.round(n * 100) / 100) : "—";
}

function gpaBarTone(gpa: number): string {
  if (gpa <= 0) return "bg-zinc-300 dark:bg-zinc-700";
  if (gpa >= 9) return "bg-emerald-500";
  if (gpa >= 8) return "bg-indigo-500";
  return "bg-amber-500";
}

function pointsLabel(grade: string | undefined): string {
  const p = gradePoints(grade);
  if (p === null) return "—";
  return `${p} / 10`;
}

/**
 * Best grade first, unscored courses last.
 *
 * The old page listed courses in whatever order VTOP sent them. Sorting by points
 * answers the question a student opens a grade list to ask — where am I weakest
 * — without a control, and it is what makes the radar chart redundant.
 */
function sortByGrade(courses: GradeItem[]): GradeItem[] {
  return [...courses].sort((a, b) => {
    const pa = gradePoints(a.grade) ?? -1;
    const pb = gradePoints(b.grade) ?? -1;
    if (pa !== pb) return pb - pa;
    return Number(a.grandTotal || 0) - Number(b.grandTotal || 0);
  });
}

/**
 * Heaviest assessment first.
 *
 * There is deliberately no Theory/Lab grouping here. The old screen split the
 * breakdown on `detail.type`, but `GradeBreakdown` has no such field — every
 * assessment fell into a single "Theory" bucket and the group headings never
 * rendered, so the split was decoration. The `component` names ("FAT", "Quiz 1",
 * "Lab Exam") already say what each one is, and sorting by weightage puts the
 * assessments that decide the grade at the top, which is what the reader came
 * for.
 */
function byWeightage(details: NonNullable<GradeItem["details"]>) {
  return [...details].sort(
    (a, b) => (Number(b.weightagePercent) || 0) - (Number(a.weightagePercent) || 0)
  );
}

/** One course, as a row that opens its own subpage. */
function CourseRow({ course, onOpen }: { course: GradeItem; onOpen: () => void }) {
  const embedded = isEmbeddedCourse(course);
  return (
    <button type="button" onClick={onOpen} className={`${LIST_ROW} cursor-pointer`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border-muted bg-surface-secondary text-zinc-500 dark:text-zinc-400">
        {embedded ? (
          <Layers className="h-4.5 w-4.5" />
        ) : (
          <GraduationCap className="h-4.5 w-4.5" />
        )}
      </span>
      <ListRowText
        title={course.courseCode}
        subtitle={course.courseTitle}
        titleTooltip={course.courseTitle}
      />
      {embedded && (
        /* The published number blends both halves, so a reader comparing it to
           their own marks needs to know that before they wonder why the
           subpage has two scores in it. */
        <span className="hidden shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-indigo-700 sm:inline dark:bg-indigo-900/30 dark:text-indigo-300">
          T+L
        </span>
      )}
      <span className="shrink-0 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 w-12 text-right">
        {numOrDash(course.grandTotal)}%
      </span>
      <ToneBadge tone={toneForGrade(course.grade)}>{course.grade || "—"}</ToneBadge>
      <ChevronRight className="h-4 w-4 text-zinc-400 shrink-0" />
    </button>
  );
}
