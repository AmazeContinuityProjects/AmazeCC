import React, { useState, useEffect } from "react";
import { FileText, Search, UploadCloud, BookOpen, ArrowLeft, ChevronRight, GraduationCap } from "lucide-react";
import UploadPaperModal from "./UploadPaperModal";
import ExamQuestion from "./ExamQuestion";

type ViewState = "courses" | "course-detail";

export default function PapersArchiveTab({ allGradesData, marksData, username }) {
  const [courses, setCourses] = useState<{ code: string; title: string }[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<{ code: string; title: string } | null>(null);
  const [papers, setPapers] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<ViewState>("courses");
  const [detailTab, setDetailTab] = useState<"papers" | "questions">("papers");
  const [searchQuery, setSearchQuery] = useState("");

  const [globalCourses, setGlobalCourses] = useState<{ code: string; title: string }[]>([]);

  // Fetch global approved courses
  useEffect(() => {
    fetch('/api/qbank/courses')
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
      const papersRes = await fetch('/api/qbank/papers?course=' + encodeURIComponent(course.code));
      const papersJson = await papersRes.json();
      const papersData = papersJson.success ? papersJson.data : [];
      setPapers(papersData);

      // Fetch questions via API route
      if (papersData && papersData.length > 0) {
        const questionsRes = await fetch('/api/qbank/questions?course=' + encodeURIComponent(course.code));
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

  const filteredCourses = searchQuery.trim().length > 0 
    ? Array.from(new Map([...myFilteredCourses, ...globalFilteredCourses].map(c => [c.code, c])).values())
    : myFilteredCourses;

  // ─── COURSE LIST VIEW ───
  if (view === "courses") {
    return (
      <div className="py-2">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">
              Q-Bank Archive
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-500 mt-1">
              Browse past papers and extracted questions by course
            </p>
          </div>
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
          >
            <UploadCloud className="w-4 h-4" /> Upload Paper
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by course code or title..."
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 midnight:bg-slate-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-lg text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          />
        </div>

        {/* Course Grid */}
        {filteredCourses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 midnight:text-gray-600">
            <GraduationCap className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-medium">No courses found</p>
            <p className="text-sm mt-1">Load your grades data or upload a paper for any course.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredCourses.map((c) => (
              <button
                key={c.code}
                onClick={() => handleSelectCourse(c)}
                className="group flex items-center justify-between p-4 bg-white dark:bg-slate-800 midnight:bg-slate-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-xl hover:border-blue-300 dark:hover:border-blue-600 midnight:hover:border-blue-700 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/30 text-blue-600 dark:text-blue-400 midnight:text-blue-400 rounded-lg shrink-0">
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
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors shrink-0 ml-2" />
              </button>
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
      </div>
    );
  }

  // ─── COURSE DETAIL VIEW ───
  return (
    <div className="py-2">
      {/* Back + Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={handleGoBack}
            className="p-2 bg-gray-100 dark:bg-slate-800 midnight:bg-slate-900 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-700 midnight:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300 midnight:text-gray-400" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">
              {selectedCourse?.code}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 midnight:text-gray-500">
              {selectedCourse?.title}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsUploadModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
        >
          <UploadCloud className="w-4 h-4" /> Upload Paper
        </button>
      </div>

      {/* Papers / Questions Toggle */}
      <div className="flex bg-gray-100 dark:bg-slate-800 midnight:bg-black rounded-lg p-1 w-full md:w-max mb-6">
        <button
          onClick={() => setDetailTab("papers")}
          className={`flex-1 md:flex-none px-5 py-2 text-sm font-semibold rounded-md transition-all ${
            detailTab === "papers"
              ? "bg-white text-blue-600 dark:bg-slate-700 midnight:bg-slate-800 dark:text-blue-400 midnight:text-blue-400 shadow-sm"
              : "text-gray-600 dark:text-gray-400 midnight:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          Papers ({papers.length})
        </button>
        <button
          onClick={() => setDetailTab("questions")}
          className={`flex-1 md:flex-none px-5 py-2 text-sm font-semibold rounded-md transition-all ${
            detailTab === "questions"
              ? "bg-white text-blue-600 dark:bg-slate-700 midnight:bg-slate-800 dark:text-blue-400 midnight:text-blue-400 shadow-sm"
              : "text-gray-600 dark:text-gray-400 midnight:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
          }`}
        >
          Questions ({questions.length})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : detailTab === "papers" ? (
        papers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
            <FileText className="w-12 h-12 mb-3 opacity-50" />
            <p className="font-medium">No papers yet for this course</p>
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-3 text-blue-500 hover:underline text-sm"
            >
              Be the first to upload one!
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {papers.map((p) => (
              <a
                key={p.source_id}
                href={p.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group p-4 bg-white dark:bg-slate-800 midnight:bg-slate-900 border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-xl hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 midnight:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 midnight:text-gray-100 truncate">
                      {p.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 midnight:text-gray-500">
                      {p.source_type} • {p.exam_semester} {p.exam_year}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 midnight:text-blue-400 group-hover:underline text-right">
                  View PDF →
                </div>
              </a>
            ))}
          </div>
        )
      ) : questions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
          <BookOpen className="w-12 h-12 mb-3 opacity-50" />
          <p className="font-medium">No extracted questions found</p>
          <p className="text-sm mt-1">Questions will appear here once an admin approves them.</p>
        </div>
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
    </div>
  );
}
