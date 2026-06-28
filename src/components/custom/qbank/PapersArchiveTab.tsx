import React, { useState, useEffect } from "react";
import { FileText, UploadCloud, BookOpen, ArrowLeft, ChevronRight, GraduationCap } from "lucide-react";
import EmptyState from "../shared/EmptyState";
import SearchInput from "../shared/SearchInput";
import { LoadingSpinner } from "../shared";
import UploadPaperModal from "./UploadPaperModal";
import ExamQuestion from "./ExamQuestion";
import { API_BASE } from "@/components/custom/Main";
import SubpageLayout from "../shared/SubpageLayout";

type ViewState = "courses" | "course-detail";

export default function PapersArchiveTab({ allGradesData, marksData, username, setActiveSubTab }: { allGradesData: any; marksData: any; username: string; setActiveSubTab?: (tab: string) => void }) {
  const [courses, setCourses] = useState<{ code: string; title: string }[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<{ code: string; title: string } | null>(null);
  const [papers, setPapers] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewState>("courses");
  const [detailTab, setDetailTab] = useState<"papers" | "questions">("papers");
  const [searchQuery, setSearchQuery] = useState("");
  const [courseFilter, setCourseFilter] = useState<"all" | "current" | "completed" | "global">("all");

  const [globalCourses, setGlobalCourses] = useState<{ code: string; title: string }[]>([]);

  // Fetch global approved courses
  useEffect(() => {
    fetch(`${API_BASE}/api/qbank/courses`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setGlobalCourses(d.data);
      })
      .catch(err => console.error("Failed to fetch global courses:", err));
  }, []);

  // Extract courses from grades data and marks data
  useEffect(() => {
    const uniqueCourses = new Map();
    
    // Add past courses from allGradesData
    if (allGradesData && allGradesData.grades) {
      const gradesArr = Array.isArray(allGradesData.grades)
        ? allGradesData.grades
        : Object.values(allGradesData.grades);

      gradesArr.forEach((sem: any) => {
        const courseList = sem?.grades ?? sem?.courseGrades ?? sem?.courses ?? [];
        const items = Array.isArray(courseList) ? courseList : Object.values(courseList);
        items.forEach((course: any) => {
          const code = course.courseCode ?? course.code;
          const title = course.courseTitle ?? course.title ?? code;
          if (code) uniqueCourses.set(code, title);
        });
      });
    }

    // Add current semester courses from marksData
    if (marksData && marksData.courses && Array.isArray(marksData.courses)) {
      marksData.courses.forEach((course: any) => {
        const code = course?.classId?.split('_')[0] ?? course?.courseCode ?? course?.code;
        const title = course?.courseTitle ?? course?.title ?? code;
        if (code && !uniqueCourses.has(code)) {
          uniqueCourses.set(code, title);
        }
      });
    }

    if (uniqueCourses.size > 0) {
      setCourses(Array.from(uniqueCourses).map(([code, title]) => ({ code, title: title as string })));
    }
  }, [allGradesData, marksData]);

  const handleSelectCourse = async (course: { code: string; title: string }) => {
    setSelectedCourse(course);
    setView("course-detail");
    setDetailTab("papers");
    setLoading(true);

    try {
      // Fetch papers via API route
      const papersRes = await fetch(`${API_BASE}/api/qbank/papers?course=` + encodeURIComponent(course.code));
      const papersJson = await papersRes.json();
      const papersData = papersJson.success ? papersJson.data : [];
      setPapers(papersData);

      // Fetch questions via API route
      if (papersData && papersData.length > 0) {
        const questionsRes = await fetch(`${API_BASE}/api/qbank/questions?course=` + encodeURIComponent(course.code));
        const questionsJson = await questionsRes.json();
        setQuestions(questionsJson.success ? questionsJson.data : []);
      } else {
        setQuestions([]);
      }
    } catch (err) {
      console.error(err);
      setPapers([]);
      setQuestions([]);
    }

    setLoading(false);
  };

  const handleGoBack = () => {
    setView("courses");
    setSelectedCourse(null);
    setPapers([]);
    setQuestions([]);
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
  if (courseFilter === "current") {
    const currentCodes = new Set((marksData?.courses || []).map((course: any) => course?.classId?.split('_')[0] ?? course?.courseCode ?? course?.code));
    filteredCourses = filteredCourses.filter(c => currentCodes.has(c.code));
  } else if (courseFilter === "completed") {
    const currentCodes = new Set((marksData?.courses || []).map((course: any) => course?.classId?.split('_')[0] ?? course?.courseCode ?? course?.code));
    filteredCourses = filteredCourses.filter(c => !currentCodes.has(c.code));
  } else if (courseFilter === "global") {
    const globalCodes = new Set(globalCourses.map(c => c.code));
    filteredCourses = filteredCourses.filter(c => globalCodes.has(c.code));
  }

  // ─── COURSE LIST VIEW ───
  if (view === "courses") {
    return (
      <div className="py-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            {setActiveSubTab && (
              <button onClick={() => setActiveSubTab("overview")} className="hidden md:block p-2 rounded-full bg-white  dark:bg-gray-900 shadow-sm border border-gray-200  dark:border-gray-800 hover:bg-gray-100">
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-gray-900  dark:text-white">
                Q-Bank Archive
              </h1>
              <p className="text-sm text-gray-500  dark:text-gray-500 mt-1">
                Browse past papers and extracted questions by course
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            <UploadCloud className="w-4 h-4" /> Upload Paper
          </button>
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
          <SearchInput placeholder="Search by course code or title..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>

        {/* Course Grid */}
        {filteredCourses.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="w-12 h-12" />}
            title="No courses found"
            description="Load your grades data or upload a paper for any course."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map((c) => {
              const isCurrent = (marksData?.courses || []).some((course: any) => (course?.classId?.split('_')[0] ?? course?.courseCode ?? course?.code) === c.code);
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
                  <ChevronRight className="w-4 h-4 shrink-0 text-gray-400 transition-colors group-hover:text-blue-500" />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">Papers</span>
                  <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-950/40 dark:text-gray-300">Questions</span>
                  {isCurrent && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">Current</span>}
                  {hasCommunity && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">Community</span>}
                </div>
              </button>
            )})}
          </div>
        )}

        {isUploadModalOpen && (
          <UploadPaperModal
            isOpen={isUploadModalOpen}
            onClose={() => setIsUploadModalOpen(false)}
            courses={courses}
            username={username}
          />
        )}
      </div>
    );
  }

  // ─── COURSE DETAIL VIEW ───
  return (
    <SubpageLayout
      title={selectedCourse?.code || ""}
      subtitle={selectedCourse?.title || undefined}
      onBack={handleGoBack}
      action={
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          <UploadCloud className="w-4 h-4" /> Upload Paper
        </button>
      }
    >

      {/* Papers / Questions Toggle */}
      <div className="flex bg-gray-100  dark:bg-black rounded-lg p-1 w-full md:w-max mb-6">
        <button
          onClick={() => setDetailTab("papers")}
          className={`flex-1 md:flex-none px-5 py-2 text-sm font-semibold rounded-md transition-all ${
            detailTab === "papers"
              ? "bg-white text-blue-600  dark:bg-slate-800  dark:text-blue-400 shadow-sm"
              : "text-gray-600  dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          Papers ({papers.length})
        </button>
        <button
          onClick={() => setDetailTab("questions")}
          className={`flex-1 md:flex-none px-5 py-2 text-sm font-semibold rounded-md transition-all ${
            detailTab === "questions"
              ? "bg-white text-blue-600  dark:bg-slate-800  dark:text-blue-400 shadow-sm"
              : "text-gray-600  dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          Questions ({questions.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : detailTab === "papers" ? (
        papers.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="No papers yet for this course"
            action={
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="text-blue-500 hover:underline text-sm"
              >
                Be the first to upload one!
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {papers.map((p) => (
              <a
                key={p.source_id}
                href={p.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-4 bg-white  dark:bg-slate-900 border border-gray-200  dark:border-gray-800 rounded-xl hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-blue-50  dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-gray-900  dark:text-gray-100 truncate">
                      {p.title}
                    </h4>
                    <p className="text-xs text-gray-500  dark:text-gray-500">
                      {p.source_type} • {p.exam_semester} {p.exam_year}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-blue-600  dark:text-blue-400 group-hover:underline text-right">
                  View PDF →
                </div>
              </a>
            ))}
          </div>
        )
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-12 h-12" />}
          title="No extracted questions found"
          description="Questions will appear here once an admin approves them."
        />
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <ExamQuestion key={q.question_id || idx} question={q} index={idx} />
          ))}
        </div>
      )}

      {isUploadModalOpen && (
        <UploadPaperModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
          courses={courses}
          username={username}
        />
      )}
    </SubpageLayout>
  );
}
