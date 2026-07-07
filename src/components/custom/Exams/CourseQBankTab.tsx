import React, { useState, useEffect } from "react";
import { FileText, BookOpen, UploadCloud, AlertCircle } from "lucide-react";
import { LoadingSpinner } from "../shared";
import EmptyState from "../shared/EmptyState";
import { API_BASE } from "@/components/custom/Main";
import ExamQuestion from "../qbank/ExamQuestion";
import FetchButton from "../shared/FetchButton";

export default function CourseQBankTab({ courseCode, username }: { courseCode: string, username: string }) {
  const [detailTab, setDetailTab] = useState<"papers" | "questions">("papers");
  const [papers, setPapers] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Upload Form State
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [title, setTitle] = useState("");
  const [paperType, setPaperType] = useState("CAT 1");
  const [fileUrl, setFileUrl] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const fetchData = async () => {
      try {
        setError(null);
        const papersRes = await fetch(`${API_BASE}/api/qbank/papers?course=${encodeURIComponent(courseCode)}`);
        if (!papersRes.ok) throw new Error("Failed to fetch papers");
        const papersJson = await papersRes.json();
        const papersData = papersJson.success ? papersJson.data : [];
        if (!isMounted) return;
        setPapers(papersData);

        const questionsRes = await fetch(`${API_BASE}/api/qbank/questions?course=${encodeURIComponent(courseCode)}`);
        if (!questionsRes.ok) throw new Error("Failed to fetch questions");
        const questionsJson = await questionsRes.json();
        if (isMounted) setQuestions(questionsJson.success ? questionsJson.data : []);
      } catch (err: any) {
        console.error("Failed to fetch QBank data:", err);
        if (isMounted) {
          setError(err.message || "Failed to load QBank data");
          setPapers([]);
          setQuestions([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [courseCode]);

  const [uploadError, setUploadError] = useState("");

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl || !title || !courseCode) return;

    setIsUploading(true);
    setUploadError("");
    try {
      const payload = {
        courseCode: courseCode.toUpperCase(),
        title,
        paperType,
        examSemester: "Current",
        examYear: new Date().getFullYear().toString(),
        uploaderRegNo: username,
        fileUrl,
        isAdmin: false
      };

      const res = await fetch(`${API_BASE}/api/qbank/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Upload failed");
      }

      setUploadSuccess(true);
      setTitle("");
      setFileUrl("");
      setTimeout(() => {
        setUploadSuccess(false);
        setShowUploadForm(false);
      }, 3000);
    } catch (err: any) {
      setUploadError("Failed to upload paper. " + (err.message || ""));
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 mt-6">
      
      {/* Tab Navigation & Upload Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex bg-gray-100 dark:bg-black rounded-lg p-1 w-full sm:w-max">
          <button
            onClick={() => setDetailTab("papers")}
            className={`flex-1 sm:flex-none px-5 py-2 text-sm font-semibold rounded-md transition-all ${
              detailTab === "papers"
                ? "bg-white text-blue-600 dark:bg-slate-800 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            Papers ({papers.length})
          </button>
          <button
            onClick={() => setDetailTab("questions")}
            className={`flex-1 sm:flex-none px-5 py-2 text-sm font-semibold rounded-md transition-all ${
              detailTab === "questions"
                ? "bg-white text-blue-600 dark:bg-slate-800 dark:text-blue-400 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
            }`}
          >
            Questions ({questions.length})
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 flex items-start gap-3 w-full">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-sm">Failed to load QBank data</h3>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {!showUploadForm && detailTab === "papers" && (
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm w-full sm:w-auto"
          >
            <UploadCloud className="w-4 h-4" /> Share a Paper
          </button>
        )}
      </div>

      {/* Inline Upload Form (Frictionless) */}
      {showUploadForm && (
        <div className="mb-8 p-5 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800/50 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
          
          {uploadSuccess ? (
            <div className="py-6 text-center animate-in fade-in zoom-in duration-300">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3">
                <UploadCloud className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">Thanks for contributing!</h3>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Your paper has been queued for admin review.</p>
            </div>
          ) : (
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <UploadCloud className="w-4 h-4 text-blue-500" /> Share a Past Paper
                </h3>
                <button type="button" onClick={() => setShowUploadForm(false)} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Cancel</button>
              </div>

              {uploadError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-3">
                  <input
                    type="url"
                    required
                    value={fileUrl}
                    onChange={(e) => setFileUrl(e.target.value)}
                    placeholder="Link to PDF (GDrive, Dropbox, etc)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-800 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Winter Semester 2023 Paper"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-800 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <select
                    value={paperType}
                    onChange={(e) => setPaperType(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-800 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option>CAT 1</option>
                    <option>CAT 2</option>
                    <option>FAT</option>
                    <option>Quiz</option>
                    <option>Assignment</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Document Title (e.g. Winter 2024 CAT 1)"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-800 rounded-lg bg-white dark:bg-black text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <FetchButton
                  type="submit"
                  loading={isUploading}
                  className="w-full md:w-auto shrink-0 justify-center px-6"
                >
                  Upload
                </FetchButton>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Content Area */}
      {detailTab === "papers" ? (
        papers.length === 0 && !showUploadForm ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title="No papers yet"
            action={
              <button onClick={() => setShowUploadForm(true)} className="text-blue-500 hover:underline text-sm font-semibold">
                Be the first to share one!
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
                className="group p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-xl hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                      {p.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {p.source_type} • {p.exam_semester} {p.exam_year}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-blue-600 dark:text-blue-400 group-hover:underline text-right font-medium">
                  View PDF →
                </div>
              </a>
            ))}
          </div>
        )
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="w-12 h-12" />}
          title="No extracted questions"
          description="Questions will appear here once an admin approves uploaded papers."
        />
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <ExamQuestion key={q.question_id || idx} question={q} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}
