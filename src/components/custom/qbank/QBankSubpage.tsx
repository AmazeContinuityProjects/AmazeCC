import { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  BookOpen,
  ChevronRight,
  FileText,
  GraduationCap,
  RefreshCcw,
  UploadCloud,
} from "lucide-react";
import {
  ChipTabs,
  EmptyPanel,
  GhostButton,
  ListSkeleton,
  PageShell,
  SectionHeader,
  SegmentedControl,
  SubpageScreen,
  ToneBadge,
  useSubpageStack,
} from "../shared/primitives";
import { SEARCH_FIELD, TILE_CARD, TILE_INTERACTIVE } from "@/lib/uiTokens";
import UploadPaperModal from "./UploadPaperModal";
import ExamQuestion from "./ExamQuestion";
import { api } from "@/lib/sync-engine";
import { useQBankCourses } from "./useQBankCourses";
import { QBankCourse, QBankPaper, QBankQuestion } from "@/types/qbank.types";

/**
 * One page for the whole question bank.
 *
 * This was two pages — a "Papers Archive" and a "Pure QBank" — reached through a
 * two-item sub-tab strip. They rendered the *same* course grid from the same
 * hook, with the same four filters and the same search box, and differed only in
 * what the drill-down showed: the archive had papers plus a Papers/Questions
 * toggle and an upload button, the pure one had questions only. The archive was
 * a strict superset, so the second page was the first page with the toggle
 * removed — which is why selecting "Pure QBank" showed fewer things for the
 * same click.
 *
 * The drill-down now always offers both tabs, so "Pure QBank" is a filter state
 * (Questions tab preselected) rather than a separate destination.
 */

const SCREENS = ["courses", "course"] as const;
type Screen = (typeof SCREENS)[number];

type CourseFilter = "all" | "current" | "completed" | "global";
type DetailTab = "papers" | "questions";

const COURSE_FILTERS: ReadonlyArray<{ value: CourseFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "current", label: "Current Semester" },
  { value: "completed", label: "Completed" },
  { value: "global", label: "Community" },
];

export default function QBankSubpage({
  allGradesData,
  marksData,
  username,
  setActiveSubTab,
}: {
  allGradesData: any;
  marksData: any;
  /** Only needed to upload; the read paths work signed out. */
  username?: string;
  setActiveSubTab?: (tab: string) => void;
}) {
  const { courses, globalCourses, globalCoursesLoading } = useQBankCourses(allGradesData, marksData);
  const stack = useSubpageStack<Screen>({
    screens: SCREENS,
    onExit: () => setActiveSubTab?.("overview"),
  });

  const [selectedCourse, setSelectedCourse] = useState<QBankCourse | null>(null);
  const [papers, setPapers] = useState<QBankPaper[]>([]);
  const [questions, setQuestions] = useState<QBankQuestion[]>([]);
  const [detailTab, setDetailTab] = useState<DetailTab>("papers");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<CourseFilter>("all");

  const handleSelectCourse = async (course: QBankCourse) => {
    setSelectedCourse(course);
    setDetailTab("papers");
    setLoading(true);
    setError(null);
    stack.go("course");

    try {
      // Both lists in one pass. They were fetched sequentially in the two old
      // pages, which put a full round trip between the grid appearing and the
      // second tab having anything in it.
      const [papersJson, questionsJson] = (await Promise.all([
        api("qbank/papers?course=" + encodeURIComponent(course.code)),
        api("qbank/questions?course=" + encodeURIComponent(course.code)),
      ])) as any[];

      setPapers(papersJson.success ? papersJson.data : []);
      setQuestions(questionsJson.success ? questionsJson.data : []);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to load QBank data");
      setPapers([]);
      setQuestions([]);
    }

    setLoading(false);
  };

  const handleGoBack = () => {
    stack.back();
    setSelectedCourse(null);
    setPapers([]);
    setQuestions([]);
    setError(null);
  };

  /** Class code of every course in the current semester, from the marks payload. */
  const currentCodes = useMemo(
    () =>
      new Set(
        (marksData?.courses || []).map(
          (course: any) => course?.classId?.split("_")[0] ?? course?.courseCode ?? course?.code
        )
      ),
    [marksData]
  );

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const mine = courses;
    const shared = globalCourses;

    // An empty search shows only the student's own courses, matching what both
    // pages did. Typing widens it to community, because that is when you are
    // looking for a course you do not have.
    const base = q
      ? Array.from(new Map([...mine, ...shared].map((c) => [c.code, c])).values())
      : mine;

    const matches = base.filter(
      (c) =>
        !q || c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
    );

    if (courseFilter === "current") return matches.filter((c) => currentCodes.has(c.code));
    if (courseFilter === "completed") return matches.filter((c) => !currentCodes.has(c.code));
    if (courseFilter === "global") {
      const sharedCodes = new Set(shared.map((c) => c.code));
      return matches.filter((c) => sharedCodes.has(c.code));
    }
    return matches;
  }, [courses, globalCourses, searchQuery, courseFilter, currentCodes]);

  const uploadModal = (
    <AnimatePresence>
      {isUploadModalOpen && (
        <UploadPaperModal
          isOpen={isUploadModalOpen}
          onClose={() => {
            setIsUploadModalOpen(false);
            // Re-fetch: an upload that lands after the modal closes should show
            // up without the reader having to go back and re-enter.
            if (selectedCourse) void handleSelectCourse(selectedCourse);
          }}
          courses={courses}
          username={username}
        />
      )}
    </AnimatePresence>
  );

  const uploadButton = (
    <GhostButton onClick={() => setIsUploadModalOpen(true)} title="Upload a past paper">
      <UploadCloud className="w-3.5 h-3.5" />
      Upload Paper
    </GhostButton>
  );

  // ─── Course list ───
  if (stack.isRoot) {
    return (
      <PageShell
        eyebrow="Tools · Question Bank"
        title="Question Bank"
        subtitle="Past papers and extracted questions, by course."
        onBack={setActiveSubTab ? () => setActiveSubTab("overview") : undefined}
        actions={uploadButton}
      >
        <ChipTabs
          options={COURSE_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          value={courseFilter}
          onChange={setCourseFilter}
        />

        <div className="relative">
          <GraduationCap className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by course code or title..."
            aria-label="Search courses"
            className={`${SEARCH_FIELD} pl-10`}
          />
        </div>

        {globalCoursesLoading && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading community courses…</p>
        )}

        <SectionHeader title="Courses" count={filteredCourses.length} />

        {filteredCourses.length === 0 ? (
          <EmptyPanel
            icon={<GraduationCap className="w-7 h-7" />}
            title="No courses found"
            description="Load your grades data, or upload a paper for any course."
            variant="dashed"
            action={uploadButton}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((c) => {
              const isCurrent = currentCodes.has(c.code);
              const hasCommunity = globalCourses.some((g) => g.code === c.code);
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => void handleSelectCourse(c)}
                  className={`${TILE_INTERACTIVE} p-4`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-zinc-900 dark:text-white">{c.code}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                        {c.title}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0 text-zinc-400" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <ToneBadge tone="zinc">Papers</ToneBadge>
                    <ToneBadge tone="zinc">Questions</ToneBadge>
                    {isCurrent && <ToneBadge tone="indigo">Current</ToneBadge>}
                    {hasCommunity && <ToneBadge tone="emerald">Community</ToneBadge>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {uploadModal}
      </PageShell>
    );
  }

  // ─── Course detail ───
  return (
    <PageShell
      eyebrow="Question Bank"
      title={selectedCourse?.code || ""}
      subtitle={selectedCourse?.title}
      wrap
      onBack={handleGoBack}
      actions={uploadButton}
    >
      <SegmentedControl
        grow
        options={[
          { value: "papers" as DetailTab, label: `Papers (${papers.length})` },
          { value: "questions", label: `Questions (${questions.length})` },
        ]}
        value={detailTab}
        onChange={setDetailTab}
        className="max-w-md"
      />

      {error && (
        <div className="p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="font-semibold text-sm">Failed to load QBank data</h3>
            <p className="text-sm mt-1 break-words">{error}</p>
            <button
              type="button"
              onClick={() => selectedCourse && void handleSelectCourse(selectedCourse)}
              className="mt-3 text-xs font-bold flex items-center gap-1 hover:underline cursor-pointer"
            >
              <RefreshCcw className="w-3 h-3" /> Retry
            </button>
          </div>
        </div>
      )}

      <SubpageScreen id={`${stack.screen}-${detailTab}`}>
        {loading ? (
          <ListSkeleton rows={3} />
        ) : detailTab === "papers" ? (
          papers.length === 0 ? (
            <EmptyPanel
              icon={<FileText className="w-7 h-7" />}
              title="No papers yet for this course"
              description="Be the first to upload one."
              variant="dashed"
              action={uploadButton}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {papers.map((p) => (
                <a
                  key={p.source_id}
                  href={p.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${TILE_CARD} p-4 hover:border-sky-500/30 transition-colors`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-white truncate">
                        {p.title}
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {p.source_type} • {p.exam_semester} {p.exam_year}
                      </p>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )
        ) : questions.length === 0 ? (
          <EmptyPanel
            icon={<BookOpen className="w-7 h-7" />}
            title="No extracted questions found"
            description="Questions appear here once an admin approves the OCR results."
            variant="dashed"
          />
        ) : (
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <ExamQuestion key={q.question_id || idx} question={q} index={idx} />
            ))}
          </div>
        )}
      </SubpageScreen>

      {uploadModal}
    </PageShell>
  );
}
