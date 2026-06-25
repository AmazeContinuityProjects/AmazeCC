import React, { useState, useEffect } from "react";
import { BookOpen, GraduationCap, ChevronRight, ArrowLeft } from "lucide-react";
import EmptyState from "../shared/EmptyState";
import SearchInput from "../shared/SearchInput";
import { LoadingSpinner } from "../shared";
import ExamQuestion from "./ExamQuestion";
import { API_BASE } from "@/components/custom/Main";
import SubpageLayout from "../shared/SubpageLayout";

type ViewState = "courses" | "questions";

export default function PureQBankTab({ allGradesData, marksData, setActiveSubTab }: { allGradesData: any; marksData: any; setActiveSubTab?: (tab: string) => void }) {
  const [courses, setCourses] = useState<{ code: string; title: string }[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<{ code: string; title: string } | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewState>("courses");
  const [searchQuery, setSearchQuery] = useState("");

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
      setCourses(
        Array.from(uniqueCourses).map(([code, title]) => ({ code, title: title as string }))
      );
    }
  }, [allGradesData, marksData]);

  const handleSelectCourse = async (course: { code: string; title: string }) => {
    setSelectedCourse(course);
    setView("questions");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/qbank/questions?course=` + encodeURIComponent(course.code));
      const json = await res.json();
      if (json.success && json.data) {
        setQuestions(json.data);
      } else {
        setQuestions([]);
      }
    } catch (err) {
      console.error(err);
      setQuestions([]);
    }

    setLoading(false);
  };

  const handleGoBack = () => {
    setView("courses");
    setSelectedCourse(null);
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

  const filteredCourses = searchQuery.trim().length > 0 
    ? Array.from(new Map([...myFilteredCourses, ...globalFilteredCourses].map(c => [c.code, c])).values())
    : myFilteredCourses;

  // ─── COURSE LIST ───
  if (view === "courses") {
    return (
      <div className="py-2 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-3 mb-6 px-4 md:px-0">
          {setActiveSubTab && (
            <button onClick={() => setActiveSubTab("overview")} className="hidden md:block p-2 rounded-full bg-white dark:bg-slate-800 midnight:bg-gray-900 shadow-sm border border-gray-200 dark:border-gray-700 midnight:border-gray-800 hover:bg-gray-100">
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">
              Pure Question Bank
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-500 mt-1">
              Browse all extracted questions by course — no PDFs, just problems
            </p>
          </div>
        </div>

        <SearchInput placeholder="Search by course code or title..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} containerClassName="mb-5" />

        {filteredCourses.length === 0 ? (
          <EmptyState
            icon={<GraduationCap className="w-12 h-12" />}
            title="No courses found"
            description="Load your grades data to populate the course list."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCourses.map((c) => (
              <button
                key={c.code}
                onClick={() => handleSelectCourse(c)}
                className="group flex items-center justify-between p-4 bg-white dark:bg-slate-800 midnight:bg-slate-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 midnight:hover:border-blue-700 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-purple-50 dark:bg-purple-900/20 midnight:bg-purple-900/30 text-purple-600 dark:text-purple-400 midnight:text-purple-400 rounded-lg shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-gray-800 dark:text-gray-200 midnight:text-gray-100">
                      {c.code}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-500 truncate">
                      {c.title}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-500 transition-colors shrink-0 ml-2" />
              </button>
            ))}
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
