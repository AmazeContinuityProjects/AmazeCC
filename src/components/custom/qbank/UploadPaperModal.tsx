import React, { useState } from "react";
import { X, UploadCloud, AlertCircle, Plus } from "lucide-react";

export default function UploadPaperModal({ isOpen, onClose, courses, username, isAdmin = false }) {
  const [courseCode, setCourseCode] = useState("");
  const [customCourseCode, setCustomCourseCode] = useState("");
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [paperType, setPaperType] = useState("CAT 1");
  const [semester, setSemester] = useState("Fall");
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const effectiveCourseCode = useCustomCode ? customCourseCode.trim().toUpperCase() : courseCode;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl || !effectiveCourseCode || !title) return;

    setUploading(true);
    try {
      const payload = {
        courseCode: effectiveCourseCode,
        title,
        paperType,
        examSemester: semester,
        examYear: year,
        uploaderRegNo: username,
        fileUrl,
        isAdmin
      };

      const res = await fetch("/api/qbank/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Upload failed");
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      console.error(err);
      alert("Failed to upload paper. " + (err.message || ""));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 midnight:bg-black border border-gray-200 dark:border-gray-700 midnight:border-gray-800 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 dark:border-gray-800 midnight:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 midnight:text-white">Upload Past Paper Link</h2>
            {isAdmin && <span className="inline-block mt-1 bg-green-100 text-green-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full dark:bg-green-900/30 dark:text-green-400">Admin Mode</span>}
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 midnight:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 midnight:hover:bg-slate-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-10 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 midnight:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mb-4">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 midnight:text-white mb-2">Upload Successful!</h3>
            <p className="text-gray-500 dark:text-gray-400 midnight:text-gray-500 text-sm">
              Your paper has been sent to the Admin queue for question extraction and approval.
            </p>
          </div>
        ) : (
          <form onSubmit={handleUpload} className="p-5 space-y-4">
            {/* Course Code */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 midnight:text-gray-300">Course Code</label>
                <button
                  type="button"
                  onClick={() => setUseCustomCode(!useCustomCode)}
                  className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 midnight:text-blue-400 hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  {useCustomCode ? "Select from list" : "Enter custom code"}
                </button>
              </div>
              {useCustomCode ? (
                <input
                  type="text"
                  required
                  value={customCourseCode}
                  onChange={(e) => setCustomCourseCode(e.target.value)}
                  placeholder="e.g. CSE2001"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-800 rounded-lg bg-white dark:bg-slate-800 midnight:bg-slate-900 text-gray-900 dark:text-gray-100 midnight:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase placeholder:normal-case"
                />
              ) : (
                <select
                  required
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-800 rounded-lg bg-white dark:bg-slate-800 midnight:bg-slate-900 text-gray-900 dark:text-gray-100 midnight:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="" disabled>Select a course</option>
                  {courses.map((c: any) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Paper Type + Sem + Year */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 midnight:text-gray-300 mb-1">Type</label>
                <select
                  value={paperType}
                  onChange={(e) => setPaperType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-800 rounded-lg bg-white dark:bg-slate-800 midnight:bg-slate-900 text-gray-900 dark:text-gray-100 midnight:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>CAT 1</option>
                  <option>CAT 2</option>
                  <option>FAT</option>
                  <option>Quiz</option>
                  <option>Assignment</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 midnight:text-gray-300 mb-1">Sem</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-800 rounded-lg bg-white dark:bg-slate-800 midnight:bg-slate-900 text-gray-900 dark:text-gray-100 midnight:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option>Fall</option>
                  <option>Winter</option>
                  <option>Summer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 midnight:text-gray-300 mb-1">Year</label>
                <input
                  type="number"
                  required
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-800 rounded-lg bg-white dark:bg-slate-800 midnight:bg-slate-900 text-gray-900 dark:text-gray-100 midnight:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 midnight:text-gray-300 mb-1">Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Winter Semester FAT Question Paper"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-800 rounded-lg bg-white dark:bg-slate-800 midnight:bg-slate-900 text-gray-900 dark:text-gray-100 midnight:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* PDF File Link */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 midnight:text-gray-300 mb-1">
                Link to Document (Google Drive, Dropbox, etc.)
              </label>
              <input
                type="url"
                required
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 midnight:border-gray-800 rounded-lg bg-white dark:bg-slate-800 midnight:bg-slate-900 text-gray-900 dark:text-gray-100 midnight:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 midnight:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 midnight:border-yellow-700/50 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5 shrink-0" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> Please ensure the link is set to "Anyone with the link can view" before submitting. Your paper will be reviewed by an admin before being published to the Q-Bank.
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={uploading || !effectiveCourseCode}
                className="w-full flex justify-center items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5" /> Submit Paper
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
