import React, { useState } from "react";
import { BookOpen, GraduationCap, ChevronRight, ArrowLeft, AlertCircle, RefreshCcw } from "lucide-react";
import EmptyState from "../shared/EmptyState";
import SearchInput from "../shared/SearchInput";
import { LoadingSpinner } from "../shared";
import ExamQuestion from "./ExamQuestion";
import { API_BASE } from "@/components/custom/Main";
import SubpageLayout from "../shared/SubpageLayout";
import { useQBankCourses } from "./useQBankCourses";
import { QBankCourse, QBankQuestion } from "@/types/qbank.types";

type ViewState = "courses" | "questions";

export default function PureQBankTab({ allGradesData, marksData, setActiveSubTab }: { allGradesData: any; marksData: any; setActiveSubTab?: (tab: string) => void }) {
  const { courses, globalCourses, globalCoursesLoading } = useQBankCourses(allGradesData, marksData);
  const [selectedCourse, setSelectedCourse] = useState<QBankCourse | null>(null);
  const [questions, setQuestions] = useState<QBankQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>("courses");
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<"all" | "current" | "completed" | "global">("all");

  const handleSelectCourse = async (course: QBankCourse) => {
    setSelectedCourse(course);
    setView("questions");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/qbank/questions?course=` + encodeURIComponent(course.code));
      if (!res.ok) throw new Error("Failed to fetch questions");
      const json = await res.json();
      if (json.success && json.data) {
        setQuestions(json.data);
      } else {
        setQuestions([]);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load questions");
      setQuestions([]);
    }

    setLoading(false);
  };

  const handleGoBack = () => {
    setView("courses");
    setSelectedCourse(null);
    setQuestions([]);
    setError(null);
  };

  const myFilteredCourses = courses.filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const globalFilteredCourses = globalCourses.filter(
    (c) =>
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  let filteredCourses = searchQuery.trim().length > 0
    ? Array.from(new Map([...myFilteredCourses, ...globalFilteredCourses].map(c => [c.code, c])).values())
    : myFilteredCourses;
  const currentCodes = new Set((marksData?.courses || []).map((course: any) => course?.classId?.split('_')[0] ?? course?.courseCode ?? course?.code));
  if (courseFilter === "current") filteredCourses = filteredCourses.filter(c => currentCodes.has(c.code));
  else if (courseFilter === "completed") filteredCourses = filteredCourses.filter(c => !currentCodes.has(c.code));
  else if (courseFilter === "global") {
    const globalCodes = new Set(globalCourses.map(c => c.code));
    filteredCourses = filteredCourses.filter(c => globalCodes.has(c.code));
  }

  // ─── COURSE LIST ───
  if (view === "courses") {
    return (
      <div className="py-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3 mb-6 px-4 md:px-0">
          {setActiveSubTab && (
            <button onClick={() => setActiveSubTab("overview")} className="hidden md:block p-2 rounded-full bg-white  dark:bg-gray-900 shadow-sm border border-gray-200  dark:border-gray-800 hover:bg-gray-100">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-gray-900  dark:text-white">
              Pure Question Bank
            </h1>
            <p className="text-sm text-gray-500  dark:text-gray-500 mt-1">
              Browse all extracted questions by course — no PDFs, just problems
            </p>
          </div>
        </div>

        <div className="mb-5 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              ["all", "All"],
              ["current", "Current Semester"],
              ["completed", "Completed"],
              ["global", "Community"],
            ].map(([value, label]) => (
              <button
                key={value}
                onClick={() => setCourseFilter(value as any)}
                className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors duration-150 ${
                  courseFilter === value
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mb-5 space-y-3 px-4 md:px-0">
          <SearchInput value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search courses by code or title..." />

          {globalCoursesLoading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 my-2">
              <LoadingSpinner size="sm" /> Loading community courses...
            </div>
          )}  </div>
        </div>

        {filteredCourses.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="w-12 h-12" />}
            title="No courses found"
            description="Load your grades data to populate the course list."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((c) => {
              const isCurrent = currentCodes.has(c.code);
              const hasCommunity = globalCourses.some(g => g.code === c.code);
              return (
              <button
                key={c.code}
                onClick={() => handleSelectCourse(c)}
                className="group rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors duration-150 hover:bg-gray-50   dark:hover:bg-slate-800/70 dark:border-gray-800 dark:bg-black"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-gray-900  dark:text-gray-100">{c.code}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-500  dark:text-gray-500">{c.title}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 shrink-0 text-gray-400 transition-colors group-hover:text-purple-500" />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">Questions</span>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">OCR</span>
                  {isCurrent && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">Current</span>}
                  {hasCommunity && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">Community</span>}
                </div>
              </button>
            )})}
          </div>
        )}
      </div>
    );
  }

  // ─── QUESTIONS VIEW ───
  return (
    <SubpageLayout
      title={selectedCourse?.code || ""}
      subtitle={selectedCourse?.title ? `${selectedCourse.title} — ${questions.length} questions` : undefined}
      onBack={handleGoBack}
    >

      {error && (
        <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-sm">Failed to load Questions</h3>
            <p className="text-sm mt-1">{error}</p>
            <button 
              onClick={() => selectedCourse && handleSelectCourse(selectedCourse)} 
              className="mt-3 text-xs font-bold flex items-center gap-1 hover:underline"
            >
              <RefreshCcw className="w-3 h-3" /> Retry
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-12 h-12" />}
          title="No extracted questions yet"
          description="Questions will appear once an admin has approved OCR results."
        />
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <ExamQuestion key={q.question_id || idx} question={q} index={idx} />
          ))}
        </div>
      )}
    </SubpageLayout>
  );
}
