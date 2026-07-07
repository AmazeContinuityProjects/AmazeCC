import React, { useState } from "react";
import { X, UploadCloud, AlertCircle, Plus } from "lucide-react";
import { API_BASE } from "@/components/custom/Main";
import Modal from "../shared/Modal";
import { Input, Select, Button } from "@amazecontinuityprojects/amazeui";
import { QBankCourse } from "@/types/qbank.types";

export default function UploadPaperModal({ isOpen, onClose, courses, username, isAdmin = false }: { isOpen: boolean, onClose: () => void, courses: QBankCourse[], username: string, isAdmin?: boolean }) {
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
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const effectiveCourseCode = useCustomCode ? customCourseCode.trim().toUpperCase() : courseCode;

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileUrl || !effectiveCourseCode || !title) return;

    setUploading(true);
    setError("");
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

      const res = await fetch(`${API_BASE}/api/qbank/upload`, {
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
      setError("Failed to upload paper. " + (err.message || ""));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal onClose={onClose} noPadding>
      {/* Header */}
      <div className="flex justify-between items-center p-5 pr-12 border-b border-border/50">
        <div>
          <h2 className="text-xl font-bold text-foreground">Upload Past Paper Link</h2>
          {isAdmin && <span className="inline-block mt-1 bg-green-100 text-green-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full dark:bg-green-900/30 dark:text-green-400">Admin Mode</span>}
        </div>
      </div>

      {success ? (
        <div className="p-10 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-green-100  dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mb-4">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-2">Upload Successful!</h3>
          <p className="text-muted-foreground text-sm">
            Your paper has been sent to the Admin queue for question extraction and approval.
          </p>
        </div>
      ) : (
        <form onSubmit={handleUpload} className="p-5 space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Course Code */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-foreground">Course Code</label>
                <button
                  type="button"
                  onClick={() => setUseCustomCode(!useCustomCode)}
                  className="flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  {useCustomCode ? "Select from list" : "Enter custom code"}
                </button>
              </div>
              {useCustomCode ? (
                <Input
                  type="text"
                  required
                  value={customCourseCode}
                  onChange={(e: any) => setCustomCourseCode(e.target.value)}
                  placeholder="e.g. CSE2001"
                  className="uppercase placeholder:normal-case"
                />
              ) : (
                <Select
                  value={courseCode}
                  onChange={(e: any) => setCourseCode(e.target.value)}
                  options={[
                    { value: "", label: "Select a course" },
                    ...courses.map((c: any) => ({
                      value: c.code,
                      label: `${c.code} - ${c.title}`
                    }))
                  ]}
                />
              )}
            </div>

            {/* Paper Type + Sem + Year */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Type</label>
                <Select
                  value={paperType}
                  onChange={(e: any) => setPaperType(e.target.value)}
                  options={[
                    { value: "CAT 1", label: "CAT 1" },
                    { value: "CAT 2", label: "CAT 2" },
                    { value: "FAT", label: "FAT" },
                    { value: "Quiz", label: "Quiz" },
                    { value: "Assignment", label: "Assignment" }
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Sem</label>
                <Select
                  value={semester}
                  onChange={(e: any) => setSemester(e.target.value)}
                  options={[
                    { value: "Fall", label: "Fall" },
                    { value: "Winter", label: "Winter" },
                    { value: "Summer", label: "Summer" }
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Year</label>
                <Input
                  type="number"
                  required
                  value={year}
                  onChange={(e: any) => setYear(e.target.value)}
                />
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Title</label>
              <Input
                type="text"
                required
                placeholder="e.g. Winter Semester FAT Question Paper"
                value={title}
                onChange={(e: any) => setTitle(e.target.value)}
              />
            </div>

            {/* PDF File Link */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Link to Document (Google Drive, Dropbox, etc.)
              </label>
              <Input
                type="url"
                required
                value={fileUrl}
                onChange={(e: any) => setFileUrl(e.target.value)}
                placeholder="https://drive.google.com/..."
              />
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
              <div className="text-sm text-yellow-600 dark:text-yellow-400">
                <strong>Important:</strong> Please ensure the link is set to "Anyone with the link can view" before submitting. Your paper will be reviewed by an admin before being published to the Q-Bank.
              </div>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={!effectiveCourseCode || uploading}
                className="w-full flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-5 h-5" /> Submit Paper
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
    </Modal>
  );
}
