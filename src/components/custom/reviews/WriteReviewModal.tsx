"use client";

import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Award,
  AlertCircle,
  GraduationCap,
  BookOpen,
  Loader2,
  ShieldCheck,
  Search,
  Lock,
} from "lucide-react";
import {
  TEACHING_CONFIG,
  PROJECT_CONFIG,
  getComponentQuestion,
  getComponentTags,
  type ReviewTrack,
  type CourseComponent,
} from "@/config/reviewQuestions";
import { FacultyAvatar } from "@/components/custom/exams/FFCS/components/FacultyAvatar";
import {
  REVIEWS_API_BASE,
  getStudentAuthorizedId,
  getAllAmazeFaculty,
  loadAmazeCatalog,
  type UnifiedFacultyReview,
} from "@/lib/reviewsService";
import { normalizeFacultyName } from "@/lib/vitfacService";

interface WriteReviewModalProps {
  open: boolean;
  onClose: () => void;
  facultyId?: string;
  facultyName?: string;
  employeeId?: string;
  courseCode?: string;
  semester?: string;
  component?: CourseComponent;
  initialTrack?: ReviewTrack;
  initialAnswers?: Record<string, number>;
  initialGreenTags?: string[];
  initialRedTags?: string[];
  isEditing?: boolean;
  onSubmitted?: () => void;
}

export default function WriteReviewModal({
  open,
  onClose,
  facultyId: initialFacultyId,
  facultyName: initialFacultyName,
  employeeId: initialEmployeeId,
  courseCode: initialCourseCode,
  semester: initialSemester,
  component: initialComponent,
  initialTrack = "teaching",
  initialAnswers = {},
  initialGreenTags = [],
  initialRedTags = [],
  isEditing = false,
  onSubmitted,
}: WriteReviewModalProps) {
  const [track, setTrack] = useState<ReviewTrack>(initialTrack);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [step, setStep] = useState<number>(1); // 1: Context/Eligibility, 2: Quality, 3: Style, 4: Tags

  // Context fields
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>(initialFacultyId || "");
  const [selectedFacultyName, setSelectedFacultyName] = useState<string>(initialFacultyName || "");
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>(initialCourseCode || "");
  const [selectedSemester, setSelectedSemester] = useState<string>(initialSemester || "FALL2026-27");
  const [selectedComponent, setSelectedComponent] = useState<CourseComponent>(initialComponent || "Theory");
  const [projectType, setProjectType] = useState<string>("Capstone");
  const [teamSize, setTeamSize] = useState<string>("Solo");
  const [howAssigned, setHowAssigned] = useState<string>("I chose them");
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);

  // Project guide faculty search
  const [facultySearch, setFacultySearch] = useState<string>("");

  // Answers (Record<questionId, rating 1..5>)
  const [answers, setAnswers] = useState<Record<string, number>>(initialAnswers);

  // Tags
  const [selectedGreenTags, setSelectedGreenTags] = useState<string[]>(initialGreenTags);
  const [selectedRedTags, setSelectedRedTags] = useState<string[]>(initialRedTags);

  // Eligibility data
  const [eligibleEnrollments, setEligibleEnrollments] = useState<any[]>([]);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Reset/populate on open
  useEffect(() => {
    if (!open) {
      setStep(1);
      setSubmitSuccess(false);
      setSubmitError(null);
      setSelectedGreenTags([]);
      setSelectedRedTags([]);
      setAnswers({});
      setSelectedOutcomes([]);
      setFacultySearch("");
      return;
    }

    const t = initialTrack || "teaching";
    setTrack(t);
    if (initialFacultyId) setSelectedFacultyId(initialFacultyId);
    if (initialFacultyName) setSelectedFacultyName(initialFacultyName);
    if (t === "teaching" && initialCourseCode) setSelectedCourseCode(initialCourseCode);
    if (t === "teaching" && initialSemester) setSelectedSemester(initialSemester);
    if (t === "teaching" && initialComponent) setSelectedComponent(initialComponent);
    if (initialAnswers && Object.keys(initialAnswers).length > 0) setAnswers(initialAnswers);
    if (initialGreenTags && initialGreenTags.length > 0) setSelectedGreenTags(initialGreenTags);
    if (initialRedTags && initialRedTags.length > 0) setSelectedRedTags(initialRedTags);

    if (t === "project") {
      setSelectedCourseCode("");
      if (!initialFacultyId) {
        setSelectedFacultyId("");
        setSelectedFacultyName("");
      }
    }

    // Fetch student's verified eligibility with authorized ID (header-only —
    // never put the ID in the URL, which would end up in access logs).
    setLoadingEligibility(true);
    const authId = getStudentAuthorizedId();
    if (!authId) {
      setLoadingEligibility(false);
      return;
    }
    fetch(`${REVIEWS_API_BASE}/api/reviews/eligibility`, {
      headers: { "x-authorized-id": authId },
    })
      .then(async (res) => {
        const ct = res.headers.get("content-type") || "";
        if (res.ok && ct.includes("application/json")) {
          return await res.json().catch(() => null);
        }
        return null;
      })
      .then((data) => {
        if (data && Array.isArray(data.teaching)) {
          setEligibleEnrollments(data.teaching);
          if (t === "teaching" && !initialFacultyId && data.teaching.length > 0) {
            const first = data.teaching[0];
            setSelectedFacultyId(first.faculty.id);
            setSelectedFacultyName(first.faculty.name);
            setSelectedCourseCode(first.course_code);
            setSelectedSemester(first.semester);
            setSelectedComponent(first.component);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingEligibility(false));
  }, [
    open,
    initialFacultyId,
    initialFacultyName,
    initialCourseCode,
    initialSemester,
    initialComponent,
    initialTrack,
  ]);

  // Catalog faculty for project guide search - refresh whenever modal opens
  const [catalogFaculty, setCatalogFaculty] = useState<UnifiedFacultyReview[]>([]);

  useEffect(() => {
    if (open) {
      loadAmazeCatalog(true).then(() => {
        setCatalogFaculty(getAllAmazeFaculty());
      });
    }
  }, [open]);

  // When switching track, reset selections to avoid stale tags or answers
  useEffect(() => {
    if (!isEditing) {
      setSelectedGreenTags([]);
      setSelectedRedTags([]);
      setAnswers({});
      setSelectedOutcomes([]);
    }
  }, [track, isEditing]);

  const currentConfig = track === "teaching" ? TEACHING_CONFIG : PROJECT_CONFIG;

  const filteredCatalogFaculty = useMemo(() => {
    const q = facultySearch.trim().toLowerCase();
    if (!q) return [];
    const normQ = normalizeFacultyName(q);
    const seenEmp = new Set<string>();
    const seenNames = new Set<string>();

    return catalogFaculty.filter((f) => {
      const name = f.name.trim();
      // Ignore scraper junk or unnormalized duplicates
      if (/^\d{4,6}\s+/i.test(name)) return false;
      if (/^(assistant|associate|adjunct)?\s*professor$/i.test(name)) return false;

      // Deduplicate by employeeId
      if (f.employeeId) {
        if (seenEmp.has(f.employeeId)) return false;
        seenEmp.add(f.employeeId);
      }

      // Deduplicate by normalized name
      const norm = normalizeFacultyName(name);
      if (norm) {
        if (seenNames.has(norm)) return false;
        seenNames.add(norm);
      }

      const nameMatch =
        name.toLowerCase().includes(q) ||
        (normQ.length > 0 && norm.includes(normQ));
      const empMatch = f.employeeId && f.employeeId.toLowerCase().includes(q);
      const deptMatch = f.dept && f.dept.toLowerCase().includes(q);
      return Boolean(nameMatch || empMatch || deptMatch);
    });
  }, [catalogFaculty, facultySearch]);

  const handleRatingSelect = (questionId: string, rating: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: rating }));
  };

  const availableTags = useMemo(() => {
    return track === "teaching" ? getComponentTags(selectedComponent) : currentConfig.tags;
  }, [track, selectedComponent, currentConfig]);

  useEffect(() => {
    setSelectedGreenTags((prev) => prev.filter((t) => availableTags.green.includes(t)));
    setSelectedRedTags((prev) => prev.filter((t) => availableTags.red.includes(t)));
  }, [availableTags]);

  const toggleGreenTag = (tag: string) => {
    setSelectedGreenTags((prev) => {
      const validPrev = prev.filter((t) => availableTags.green.includes(t));
      if (validPrev.includes(tag)) return validPrev.filter((t) => t !== tag);
      return [...validPrev, tag];
    });
  };

  const toggleRedTag = (tag: string) => {
    setSelectedRedTags((prev) => {
      const validPrev = prev.filter((t) => availableTags.red.includes(t));
      if (validPrev.includes(tag)) return validPrev.filter((t) => t !== tag);
      return [...validPrev, tag];
    });
  };

  const toggleOutcome = (outcome: string) => {
    setSelectedOutcomes((prev) =>
      prev.includes(outcome) ? prev.filter((o) => o !== outcome) : [...prev, outcome]
    );
  };

  const applicableQualityQuestions = currentConfig.qualityQuestions.filter((q) => {
    if (q.conditional?.field === "component") {
      return q.conditional.matches.includes(selectedComponent);
    }
    return true;
  });

  const selectedEnrollment = eligibleEnrollments.find(
    (e) =>
      (e.faculty?.id === selectedFacultyId || (e.faculty?.name && e.faculty.name === selectedFacultyName)) &&
      (!selectedCourseCode || e.course_code === selectedCourseCode)
  );
  const selectedFaculty = useMemo(() => {
    return catalogFaculty.find(
      (f) =>
        (selectedFacultyId && f.id === selectedFacultyId) ||
        (selectedFacultyName && f.name.toLowerCase() === selectedFacultyName.toLowerCase())
    );
  }, [catalogFaculty, selectedFacultyId, selectedFacultyName]);

  const fallbackEnrollment = useMemo(() => {
    if (!selectedFacultyName && !selectedFacultyId) return null;
    return {
      faculty: {
        id: selectedFacultyId,
        name: selectedFacultyName,
        employee_id: selectedFaculty?.employeeId || (selectedFaculty as any)?.employee_id,
        school: selectedFaculty?.dept,
        image_url: selectedFaculty?.image_url,
      },
      course_code: selectedCourseCode,
      semester: selectedSemester,
      component: selectedComponent,
      timing: { isOpen: true, label: selectedSemester },
    };
  }, [
    selectedFacultyId,
    selectedFacultyName,
    selectedCourseCode,
    selectedSemester,
    selectedComponent,
    selectedFaculty,
  ]);

  const activeEnrollment = selectedEnrollment || fallbackEnrollment;
  const isSelectedTimingLocked = Boolean(
    activeEnrollment?.timing && !activeEnrollment.timing.isOpen
  );

  const canProceedFromStep1 =
    track === "teaching"
      ? Boolean(
          (selectedFacultyId || selectedFacultyName) &&
          (selectedCourseCode || activeEnrollment?.course_code) &&
          !isSelectedTimingLocked
        )
      : Boolean((selectedFacultyId || selectedFacultyName) && projectType);

  const canProceedFromStep2 = applicableQualityQuestions.every(
    (q) => q.allowNA || answers[q.id] !== undefined
  );

  const canProceedFromStep3 = currentConfig.styleQuestions.every(
    (s) => answers[s.id] !== undefined
  );

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    const authId = getStudentAuthorizedId();
    const validGreen = selectedGreenTags.filter((t) => availableTags.green.includes(t));
    const validRed = selectedRedTags.filter((t) => availableTags.red.includes(t));

    const payload = {
      authorizedID: authId,
      faculty_id: selectedFacultyId,
      track,
      course_code: track === "teaching" ? selectedCourseCode : undefined,
      semester: track === "teaching" ? selectedSemester : undefined,
      project_term: track === "project" ? `${selectedSemester} ${projectType}` : undefined,
      answers,
      tags_green: validGreen,
      tags_red: validRed,
      context:
        track === "teaching"
          ? { component: selectedComponent }
          : {
              project_type: projectType,
              team_size: teamSize,
              how_assigned: howAssigned,
              outcomes: selectedOutcomes,
            },
    };

    try {
      const res = await fetch(`${REVIEWS_API_BASE}/api/reviews/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-authorized-id": authId,
        },
        body: JSON.stringify(payload),
      });

      const ct = res.headers.get("content-type") || "";
      let json: any = null;
      if (ct.includes("application/json")) {
        json = await res.json().catch(() => null);
      }

      if (!res.ok) {
        throw new Error(json?.error || `Failed to submit review (Status: ${res.status})`);
      }

      setSubmitSuccess(true);
      await loadAmazeCatalog(true).catch(() => {});
      if (onSubmitted) onSubmitted();
    } catch (err: any) {
      setSubmitError(err.message || "An error occurred while submitting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open || !mounted) return null;

  const validGreenCount = selectedGreenTags.filter((t) => availableTags.green.includes(t)).length;
  const validRedCount = selectedRedTags.filter((t) => availableTags.red.includes(t)).length;

  const modalContent = (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 99999,
      }}
      className="flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <div
        className="w-full max-w-lg bg-surface border border-border-strong rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <FacultyAvatar
              employeeId={
                selectedFaculty?.employeeId ||
                (selectedFaculty as any)?.employee_id ||
                activeEnrollment?.faculty?.employee_id ||
                activeEnrollment?.faculty?.employeeId
              }
              name={selectedFacultyName || (track === "teaching" ? "Faculty" : "Project Guide")}
              facultyId={selectedFacultyId}
              fallbackImageUrl={selectedFaculty?.image_url || activeEnrollment?.faculty?.image_url}
              size="md"
              tone="amber"
            />
            <div className="min-w-0">
              <h2 className="text-base font-bold text-text-heading leading-tight truncate">
                {selectedFacultyName || (track === "teaching" ? "Write Faculty Review" : "Review a Project Guide")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {track === "teaching" ? "Teaching Review" : "Project Guide Review"}
                {track === "teaching" && (selectedCourseCode || activeEnrollment?.course_code)
                  ? ` · ${selectedCourseCode || activeEnrollment?.course_code}`
                  : ""}
                {isEditing ? " (Editing)" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-text-heading hover:bg-surface-secondary transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Indicator */}
        {!submitSuccess && (
          <div className="px-5 pt-3 pb-2 border-b border-border bg-surface-secondary/40">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground mb-1.5">
              <span className={step >= 1 ? "text-amber-500 font-extrabold" : ""}>1. Details</span>
              <span className={step >= 2 ? "text-amber-500 font-extrabold" : ""}>2. Quality</span>
              <span className={step >= 3 ? "text-amber-500 font-extrabold" : ""}>3. Style</span>
              <span className={step >= 4 ? "text-amber-500 font-extrabold" : ""}>4. Tags</span>
            </div>
            <div className="w-full h-1 bg-surface-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {submitSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-heading">Review Submitted!</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                  Your feedback has been verified and buffered for aggregation. You have a 14-day
                  window to edit your ratings if needed.
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* STEP 1: Context & Verification */}
              {step === 1 && (
                <div className="space-y-4">
                  {track === "teaching" ? (
                    <div className="space-y-3">
                      {loadingEligibility && !activeEnrollment ? (
                        <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                          <span>Loading your verified course…</span>
                        </div>
                      ) : activeEnrollment ? (
                        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3.5">
                          <div className="flex items-start gap-3.5">
                            <FacultyAvatar
                              employeeId={activeEnrollment.faculty?.employee_id || selectedFaculty?.employeeId}
                              name={activeEnrollment.faculty?.name || selectedFacultyName}
                              facultyId={activeEnrollment.faculty?.id || selectedFacultyId}
                              fallbackImageUrl={activeEnrollment.faculty?.image_url || selectedFaculty?.image_url}
                              size="lg"
                              tone="amber"
                              className="w-14 h-14 rounded-2xl shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-base text-text-heading truncate">
                                  {activeEnrollment.faculty?.name || selectedFacultyName}
                                </h3>
                                {(activeEnrollment.faculty?.employee_id || selectedFaculty?.employeeId) && (
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-surface border border-border text-muted-foreground">
                                    ID: {activeEnrollment.faculty?.employee_id || selectedFaculty?.employeeId}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {activeEnrollment.faculty?.school ? `${activeEnrollment.faculty.school} · ` : ""}
                                <span className="font-semibold text-text-heading">
                                  {activeEnrollment.course_code || selectedCourseCode}
                                </span>
                                {activeEnrollment.component ? ` (${activeEnrollment.component})` : ""}
                              </p>
                              <div className="flex items-center gap-2 mt-2 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>Verified Course Enrollment</span>
                                </span>
                                <span className="text-[11px] font-medium text-muted-foreground bg-surface-secondary px-2 py-0.5 rounded-md border border-border">
                                  {activeEnrollment.timing?.label || activeEnrollment.semester}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Component Focus if Embedded or Theory & Lab */}
                          {["Embedded", "Theory & Lab"].includes(activeEnrollment.component || "") && (
                            <div className="pt-3 border-t border-amber-500/20 space-y-1.5">
                              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                                Component you are reviewing
                              </label>
                              <div className="flex items-center gap-2">
                                {(["Theory", "Lab"] as const).map((comp) => {
                                  const active = selectedComponent === comp;
                                  return (
                                    <button
                                      key={comp}
                                      type="button"
                                      onClick={() => setSelectedComponent(comp)}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        active
                                          ? "bg-amber-500 text-black shadow-xs font-extrabold"
                                          : "bg-surface border border-border text-muted-foreground hover:text-text-heading"
                                      }`}
                                    >
                                      {comp} Component
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-500 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>No verified timetable enrollment found</span>
                          </div>
                          <p>
                            Teaching reviews can only be submitted for faculty you have verified classes under in your timetable.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Project Guide Faculty Picker */}
                      <div className="space-y-2 relative">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Project Guide (Faculty Member)
                        </label>
                        {selectedFacultyName ? (
                          <div className="flex items-center justify-between p-3.5 rounded-2xl border border-amber-500/50 bg-amber-500/10 text-text-heading">
                            <div className="flex items-center gap-3 min-w-0">
                              <FacultyAvatar
                                name={selectedFacultyName}
                                employeeId={
                                  selectedFaculty?.employeeId ||
                                  (selectedFaculty as any)?.employee_id
                                }
                                fallbackImageUrl={selectedFaculty?.image_url}
                                size="md"
                                tone="amber"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-sm block truncate">{selectedFacultyName}</span>
                                  {(selectedFaculty?.employeeId || (selectedFaculty as any)?.employee_id) && (
                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-surface border border-border text-muted-foreground">
                                      ID: {selectedFaculty?.employeeId || (selectedFaculty as any)?.employee_id}
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground block truncate">
                                  {selectedFaculty?.dept ? `${selectedFaculty.dept} · ` : ""}
                                  {selectedFaculty?.designation || "Project Guide"}
                                </span>
                              </div>
                            </div>
                            {!initialFacultyId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedFacultyId("");
                                  setSelectedFacultyName("");
                                  setFacultySearch("");
                                }}
                                className="px-3 py-1.5 rounded-xl border border-amber-500/30 bg-surface hover:bg-surface-secondary text-xs font-bold text-amber-500 hover:text-amber-400 transition-colors cursor-pointer shrink-0"
                              >
                                Change
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5 relative">
                            <div className="relative">
                              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                placeholder="Type faculty name or employee ID..."
                                value={facultySearch}
                                onChange={(e) => setFacultySearch(e.target.value)}
                                autoFocus
                                className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-border-strong bg-surface text-text-heading text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 shadow-xs"
                              />
                              {facultySearch && (
                                <button
                                  type="button"
                                  onClick={() => setFacultySearch("")}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-text-heading cursor-pointer"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                            {/* Dynamic Dropdown List */}
                            {facultySearch.trim().length > 0 && (
                              <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-border-strong bg-surface shadow-2xl divide-y divide-border">
                                {filteredCatalogFaculty.length === 0 ? (
                                  <div className="p-4 text-center text-xs text-muted-foreground">
                                    No faculty found matching &ldquo;{facultySearch}&rdquo;
                                  </div>
                                ) : (
                                  filteredCatalogFaculty.slice(0, 8).map((fac) => (
                                    <button
                                      key={fac.id}
                                      type="button"
                                      onClick={() => {
                                        setSelectedFacultyId(fac.id);
                                        setSelectedFacultyName(fac.name);
                                        setFacultySearch("");
                                      }}
                                      className="w-full p-3 text-left hover:bg-amber-500/10 hover:border-l-4 hover:border-amber-500 flex items-center justify-between gap-3 transition-colors cursor-pointer group"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <FacultyAvatar
                                          name={fac.name}
                                          employeeId={fac.employeeId}
                                          fallbackImageUrl={fac.image_url}
                                          size="sm"
                                          tone="amber"
                                        />
                                        <div className="min-w-0">
                                          <div className="font-bold text-sm text-text-heading truncate group-hover:text-amber-500 transition-colors">
                                            {fac.name}
                                          </div>
                                          <div className="text-[11px] text-muted-foreground truncate">
                                            {fac.dept ? `${fac.dept} · ` : ""}{fac.designation || "Faculty Member"}
                                          </div>
                                        </div>
                                      </div>
                                      {fac.employeeId && (
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-surface-secondary text-text-muted border border-border shrink-0">
                                          ID: {fac.employeeId}
                                        </span>
                                      )}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Project Type
                        </label>
                        <select
                          value={projectType}
                          onChange={(e) => setProjectType(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-border-strong bg-surface text-text-heading text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                        >
                          {PROJECT_CONFIG.contextFields.projectTypes?.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            Team Size
                          </label>
                          <select
                            value={teamSize}
                            onChange={(e) => setTeamSize(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-border-strong bg-surface text-text-heading text-sm"
                          >
                            {PROJECT_CONFIG.contextFields.teamSizes?.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                            How Assigned
                          </label>
                          <select
                            value={howAssigned}
                            onChange={(e) => setHowAssigned(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-border-strong bg-surface text-text-heading text-sm"
                          >
                            {PROJECT_CONFIG.contextFields.howAssigned?.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Project Outcomes (Optional)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {PROJECT_CONFIG.contextFields.outcomes?.map((outcome) => {
                            const isSelected = selectedOutcomes.includes(outcome);
                            return (
                              <button
                                key={outcome}
                                type="button"
                                onClick={() => toggleOutcome(outcome)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-amber-500/20 text-amber-500 border-amber-500/40"
                                    : "bg-surface border-border-strong text-muted-foreground hover:bg-surface-secondary"
                                }`}
                              >
                                {outcome}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: Quality Questions (Drives the Grade) */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400">
                    <Sparkles className="w-4 h-4 shrink-0" />
                    <span>
                      Quality ratings directly shape the faculty grade. Tap 1 to 5 based on your experience.
                    </span>
                  </div>

                  {applicableQualityQuestions.map((q) => {
                    const currentRating = answers[q.id];
                    return (
                      <div key={q.id} className="space-y-2 border-b border-border pb-4 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <label className="text-sm font-bold text-text-heading leading-snug">
                            {getComponentQuestion(q.id, q.question, track === "teaching" ? selectedComponent : undefined)}
                          </label>
                          {q.allowNA && (
                            <button
                              type="button"
                              onClick={() => {
                                const copy = { ...answers };
                                delete copy[q.id];
                                setAnswers(copy);
                              }}
                              className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                                currentRating === undefined
                                  ? "bg-amber-500/20 border-amber-500 text-amber-500"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              N/A
                            </button>
                          )}
                        </div>

                        {/* 5-Point Tappable Scale */}
                        <div className="pt-1">
                          <div className="grid grid-cols-5 gap-2">
                            {[1, 2, 3, 4, 5].map((val) => {
                              const isSelected = currentRating === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleRatingSelect(q.id, val)}
                                  className={`py-3 rounded-xl font-bold text-sm border flex items-center justify-center transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-amber-500 text-black border-amber-500 shadow-md scale-105"
                                      : "bg-surface border-border-strong text-muted-foreground hover:bg-surface-secondary hover:text-text-heading"
                                  }`}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5 px-0.5">
                            <span className="truncate max-w-[45%] text-left">{q.minAnchor}</span>
                            <span className="truncate max-w-[45%] text-right">{q.maxAnchor}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* STEP 3: Style Spectrums (Neutral Preferences) */}
              {step === 3 && (
                <div className="space-y-6">
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
                    Style questions do not reduce or inflate the score. They help students find the vibe and pace they personally prefer.
                  </div>

                  {currentConfig.styleQuestions.map((s) => {
                    const currentVal = answers[s.id];
                    return (
                      <div key={s.id} className="space-y-2 border-b border-border pb-4 last:border-b-0">
                        <label className="text-sm font-bold text-text-heading leading-snug">
                          {getComponentQuestion(s.id, s.question, track === "teaching" ? selectedComponent : undefined)}
                        </label>

                        <div className="pt-1">
                          <div className="grid grid-cols-5 gap-2">
                            {[1, 2, 3, 4, 5].map((val) => {
                              const isSelected = currentVal === val;
                              return (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => handleRatingSelect(s.id, val)}
                                  className={`py-2.5 rounded-xl font-bold text-sm border flex items-center justify-center transition-all cursor-pointer ${
                                    isSelected
                                      ? "bg-blue-500 text-white border-blue-500 shadow-md scale-105"
                                      : "bg-surface border-border-strong text-muted-foreground hover:bg-surface-secondary hover:text-text-heading"
                                  }`}
                                >
                                  {val}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5 px-0.5">
                            <span>{s.minAnchor}</span>
                            {s.midAnchor && <span>{s.midAnchor}</span>}
                            <span>{s.maxAnchor}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* STEP 4: Fixed Tags Selection */}
              {step === 4 && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                        Green Tags (Strengths)
                      </label>
                      <span className="text-xs text-muted-foreground font-semibold">
                        {validGreenCount} selected
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.green.map((tag) => {
                        const isSelected = selectedGreenTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleGreenTag(tag)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/50 ring-1 ring-emerald-500"
                                : "bg-surface border-border-strong text-muted-foreground hover:bg-surface-secondary"
                            }`}
                          >
                            + {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-red-500 uppercase tracking-wider">
                        Red Warnings (Areas of Concern)
                      </label>
                      <span className="text-xs text-muted-foreground font-semibold">
                        {validRedCount} selected
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {availableTags.red.map((tag) => {
                        const isSelected = selectedRedTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleRedTag(tag)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/50 ring-1 ring-red-500"
                                : "bg-surface border-border-strong text-muted-foreground hover:bg-surface-secondary"
                            }`}
                          >
                            - {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Submission Error Banner */}
          {submitError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {!submitSuccess && (
          <div className="p-4 border-t border-border flex items-center justify-between gap-3 bg-surface-secondary/20">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(1, s - 1))}
                className="px-4 py-2 rounded-xl border border-border-strong text-muted-foreground hover:text-text-heading text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                disabled={
                  (step === 1 && !canProceedFromStep1) ||
                  (step === 2 && !canProceedFromStep2) ||
                  (step === 3 && !canProceedFromStep3)
                }
                onClick={() => setStep((s) => Math.min(4, s + 1))}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmit}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting…</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{isEditing ? "Update Review" : "Submit Review"}</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
