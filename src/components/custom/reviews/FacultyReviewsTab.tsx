"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  X,
  Filter,
  Scale,
  Sparkles,
  GraduationCap,
  BookOpen,
  AlertCircle,
  ShieldCheck,
  Check,
  RefreshCw,
  PenLine,
  Plus,
  Lock,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  CHIP,
  TILE_CARD,
  SEARCH_FIELD,
} from "@/lib/uiTokens";
import {
  loadAmazeCatalog,
  getAllAmazeFaculty,
  type UnifiedFacultyReview,
  REVIEWS_API_BASE,
  ENABLE_AMAZE_REVIEWS,
  getStudentAuthorizedId,
  isCurrentUserReviewAdmin,
} from "@/lib/reviewsService";
import { normalizeFacultyName } from "@/lib/vitfacService";
import { getSemesterReviewStatus } from "@/lib/semesterTiming";
import { FacultyAvatar } from "../exams/FFCS/components/FacultyAvatar";
import FacultyReviewSheet from "../exams/FFCS/components/FacultyReviewSheet";
import WriteReviewModal from "./WriteReviewModal";
import FacultyCompareModal from "./FacultyCompareModal";
import AdminFacultyModal from "./AdminFacultyModal";

interface FacultyReviewsTabProps {
  onBack?: () => void;
  initialFacultyId?: string | null;
}

const COMMON_SCHOOLS = [
  "All",
  "SCOPE",
  "SENSE",
  "SELECT",
  "SMEC",
  "SAS",
  "SSL",
  "SCHEME",
  "SBST",
  "VSB",
  "VITSOL",
];

function formatFacultySchool(school?: string | null): string {
  if (!school) return "";
  const s = school.trim();
  if (s.includes("/ssl/") || s.toUpperCase().includes("SSL")) return "SSL";
  if (s.includes("/scope/") || s.toUpperCase().includes("SCOPE")) return "SCOPE";
  if (s.includes("/sense/") || s.toUpperCase().includes("SENSE")) return "SENSE";
  if (s.includes("/select/") || s.toUpperCase().includes("SELECT")) return "SELECT";
  if (s.includes("/smec/") || s.toUpperCase().includes("SMEC")) return "SMEC";
  if (s.includes("/sas/") || s.toUpperCase().includes("SAS")) return "SAS";
  if (s.includes("/scheme/") || s.toUpperCase().includes("SCHEME")) return "SCHEME";
  if (s.includes("/sbst/") || s.toUpperCase().includes("SBST")) return "SBST";
  if (s.includes("/vsb/") || s.toUpperCase().includes("VSB")) return "VSB";
  if (s.includes("/vitsol/") || s.toUpperCase().includes("VITSOL")) return "VITSOL";
  if (s.startsWith("http")) return "Faculty";
  return s;
}

export default function FacultyReviewsTab({
  onBack,
  initialFacultyId,
}: FacultyReviewsTabProps) {
  // Top-Level Mode: "read" (Explore & Read Reviews) vs "write" (My Reviews & Write)
  const [viewMode, setViewMode] = useState<"read" | "write">("read");

  const [facultyList, setFacultyList] = useState<UnifiedFacultyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search for Read View
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSchool, setSelectedSchool] = useState("All");
  const [selectedTrack, setSelectedTrack] = useState<"all" | "teaching" | "project">("all");
  const [minReviews, setMinReviews] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"rating" | "reviews" | "name">("rating");

  // Modals
  const [selectedFaculty, setSelectedFaculty] = useState<UnifiedFacultyReview | null>(null);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const isReviewAdmin = useMemo(() => isCurrentUserReviewAdmin(), []);

  // Write Modal Target Context
  const [writeTarget, setWriteTarget] = useState<{
    facultyId?: string;
    facultyName?: string;
    employeeId?: string;
    courseCode?: string;
    semester?: string;
    component?: any;
    track?: "teaching" | "project";
    isEditing?: boolean;
    initialAnswers?: Record<string, number>;
    initialGreenTags?: string[];
    initialRedTags?: string[];
  }>({});

  // Student Eligibility and Past Reviews State (for Write View)
  const [eligibilityData, setEligibilityData] = useState<{
    teaching: any[];
    project: {
      can_review: boolean;
      total_allowed: number;
      remaining_slots: number;
      existing_reviews: any[];
    };
  } | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>("all");

  // Multi-semester grouping with timing status
  const semesterGroups = useMemo(() => {
    if (!eligibilityData?.teaching || eligibilityData.teaching.length === 0) return [];
    const map = new Map<
      string,
      {
        semesterId: string;
        label: string;
        timing: any;
        items: any[];
      }
    >();

    for (const enr of eligibilityData.teaching) {
      const sem = enr.semester || "Unknown";
      if (!map.has(sem)) {
        const timing = enr.timing || getSemesterReviewStatus(sem);
        map.set(sem, {
          semesterId: sem,
          label: timing.label || sem,
          timing,
          items: [],
        });
      }
      map.get(sem)!.items.push(enr);
    }

    // Sort descending by semester ID (latest semester first)
    return Array.from(map.values()).sort((a, b) => b.semesterId.localeCompare(a.semesterId));
  }, [eligibilityData?.teaching]);

  const filteredSemesterGroups = useMemo(() => {
    if (selectedSemesterFilter === "all") return semesterGroups;
    return semesterGroups.filter((g) => g.semesterId === selectedSemesterFilter);
  }, [semesterGroups, selectedSemesterFilter]);

  // Load catalog on mount
  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadAmazeCatalog(true);
      const all = getAllAmazeFaculty();
      setFacultyList(all);
    } catch (err: any) {
      console.error("[FacultyReviewsTab] Error loading catalog:", err);
      setError("Unable to connect to edge reviews catalog. Showing cached data if available.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  // Fetch student eligibility and reviews
  const fetchEligibility = useCallback(async () => {
    if (!ENABLE_AMAZE_REVIEWS) return; // Feature flag off: no identity requests
    const authId = getStudentAuthorizedId();
    if (!authId) {
      setEligibilityData(null); // Signed out: nothing to check (server enforces auth too)
      return;
    }
    setLoadingEligibility(true);
    try {
      // Identity travels ONLY in the x-authorized-id header — never in the URL
      // (URLs end up in access logs; headers do not).
      const res = await fetch(
        `${REVIEWS_API_BASE}/api/reviews/eligibility?_t=${Date.now()}`,
        {
          headers: { "x-authorized-id": authId },
          cache: "no-store",
        }
      );
      const ct = res.headers.get("content-type") || "";
      if (res.ok && ct.includes("application/json")) {
        const data = await res.json().catch(() => null);
        if (data) {
          setEligibilityData({
            teaching: Array.isArray(data.teaching) ? data.teaching : [],
            project: data.project || {
              can_review: true,
              total_allowed: 3,
              remaining_slots: 3,
              existing_reviews: [],
            },
          });

          // If teaching enrollments are empty, attempt to seed from local attendance/schedule cache
          if ((!data.teaching || data.teaching.length === 0) && typeof window !== "undefined") {
            try {
              const storedAttRaw = localStorage.getItem("attendance");
              if (storedAttRaw) {
                const storedAtt = JSON.parse(storedAttRaw);
                const items = storedAtt.attendance || storedAtt || [];
                if (Array.isArray(items) && items.length > 0) {
                  const payloadCourses = items
                    .filter((it: any) => it.courseCode && (it.faculty || it.facultyDetails))
                    .map((it: any) => ({
                      courseCode: it.courseCode,
                      facultyDetails: it.faculty || it.facultyDetails,
                      component: it.courseType || it.component || "Theory",
                      semester: it.semester || "FALL2026-27",
                    }));

                  if (payloadCourses.length > 0) {
                    await fetch(`${REVIEWS_API_BASE}/api/reviews/enrollment-snapshot`, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "x-authorized-id": authId,
                      },
                      body: JSON.stringify({
                        authorizedID: authId,
                        courses: payloadCourses,
                      }),
                    });

                    // Re-fetch after local sync snapshot (header-only identity)
                    const refetchRes = await fetch(
                      `${REVIEWS_API_BASE}/api/reviews/eligibility`,
                      { headers: { "x-authorized-id": authId } }
                    );
                    const refetchJson = await refetchRes.json().catch(() => null);
                    if (refetchJson && Array.isArray(refetchJson.teaching)) {
                      setEligibilityData({
                        teaching: refetchJson.teaching,
                        project: refetchJson.project || data.project,
                      });
                    }
                  }
                }
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn("[FacultyReviewsTab] Failed to fetch review eligibility:", err);
    } finally {
      setLoadingEligibility(false);
    }
  }, []);

  useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility, viewMode]);

  // Open initial faculty if provided in props
  useEffect(() => {
    if (initialFacultyId && facultyList.length > 0) {
      const match = facultyList.find((f) => f.id === initialFacultyId);
      if (match) {
        setSelectedFaculty(match);
      }
    }
  }, [initialFacultyId, facultyList]);

  // Filter & Search logic for Read View
  const filteredFaculty = useMemo(() => {
    let result = [...facultyList];

    // Filter by school
    if (selectedSchool !== "All") {
      result = result.filter(
        (f) =>
          f.dept &&
          f.dept.toUpperCase().includes(selectedSchool.toUpperCase())
      );
    }

    // Filter by track review presence
    if (selectedTrack === "teaching") {
      result = result.filter((f) => f.teachingGrade !== null && f.reviews > 0);
    } else if (selectedTrack === "project") {
      result = result.filter((f) => f.projectGrade !== null);
    }

    // Filter by min reviews
    if (minReviews > 0) {
      result = result.filter((f) => (f.reviews || 0) >= minReviews);
    }

    // Search query: normalized name, school, employee id
    if (searchQuery.trim()) {
      const normQuery = normalizeFacultyName(searchQuery);
      const rawQuery = searchQuery.trim().toLowerCase();

      result = result.filter((f) => {
        const facNorm = normalizeFacultyName(f.name);
        const nameMatch = facNorm.includes(normQuery) || f.name.toLowerCase().includes(rawQuery);
        const empMatch = f.employeeId && f.employeeId.toLowerCase().includes(rawQuery);
        const schoolMatch = f.dept && f.dept.toLowerCase().includes(rawQuery);
        return Boolean(nameMatch || empMatch || schoolMatch);
      });
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "rating") {
        const scoreA = a.teachingGrade ?? (a.wPct ? 1 + (a.wPct / 100) * 4 : 0);
        const scoreB = b.teachingGrade ?? (b.wPct ? 1 + (b.wPct / 100) * 4 : 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.reviews || 0) - (a.reviews || 0);
      }
      if (sortBy === "reviews") {
        return (b.reviews || 0) - (a.reviews || 0);
      }
      return a.name.localeCompare(b.name);
    });

    return result;
  }, [facultyList, selectedSchool, selectedTrack, minReviews, searchQuery, sortBy]);

  // Pagination State
  const [pageSize, setPageSize] = useState<number>(24);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSchool, selectedTrack, sortBy, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredFaculty.length / pageSize));
  const paginatedFaculty = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFaculty.slice(start, start + pageSize);
  }, [filteredFaculty, currentPage, pageSize]);

  // Aggregate student's published reviews
  const publishedReviews = useMemo(() => {
    const list: any[] = [];
    if (!eligibilityData) return list;

    // Teaching reviews from enrollments
    for (const enr of eligibilityData.teaching || []) {
      if (enr.reviewed && enr.review_details) {
        list.push({
          id: enr.review_details.id,
          track: "teaching",
          faculty: enr.faculty,
          course_code: enr.course_code,
          component: enr.component,
          semester: enr.semester,
          created_at: enr.review_details.created_at,
          can_edit: enr.review_details.can_edit,
          days_left_to_edit: enr.review_details.days_left_to_edit,
        });
      }
    }

    // Project reviews
    for (const proj of eligibilityData.project?.existing_reviews || []) {
      list.push({
        id: proj.id,
        track: "project",
        faculty: { id: proj.faculty_id, name: proj.faculty_name },
        project_term: proj.project_term,
        created_at: proj.created_at,
        can_edit: proj.details?.can_edit ?? false,
        days_left_to_edit: proj.details?.days_left_to_edit ?? 0,
      });
    }

    return list;
  }, [eligibilityData]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 animate-fadeIn pb-16">
      {/* Top Header & View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-text-heading tracking-tight">
              Faculty Reviews
            </h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Verified & Aggregated
            </span>
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Anonymous student ratings across Teaching and Project Guide tracks.
          </p>
        </div>

        {/* Two View Mode Toggle Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-secondary/70 rounded-2xl border border-border-strong self-start md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("read")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              viewMode === "read"
                ? "bg-surface text-text-heading shadow-sm border border-border"
                : "text-muted-foreground hover:text-text-heading"
            }`}
          >
            <Search className="w-4 h-4 text-indigo-500" />
            <span>Read Reviews</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("write")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              viewMode === "write"
                ? "bg-surface text-text-heading shadow-sm border border-border"
                : "text-muted-foreground hover:text-text-heading"
            }`}
          >
            <PenLine className="w-4 h-4 text-amber-500" />
            <span>Write Reviews</span>
          </button>
        </div>
      </div>

      {/* VIEW 1: READ REVIEWS */}
      {viewMode === "read" && (
        <div className="space-y-5 animate-fadeIn">
          {/* Action CTAs: Compare and Admin */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-text-muted">
              Search and view aggregated ratings for all professors across departments.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCompareModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-surface border border-border-strong hover:bg-surface-secondary text-text-heading text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Scale className="w-4 h-4 text-indigo-500" />
                <span>Compare</span>
              </button>

              {/* Admin moderation: hidden for everyone except allowlisted admin
                  IDs; the API keeps its own RBAC check as the real gate. */}
              {isReviewAdmin && (
                <button
                  onClick={() => setIsAdminModalOpen(true)}
                  title="Admin Moderation"
                  className="p-2 rounded-xl bg-surface border border-border-strong hover:bg-surface-secondary text-text-muted hover:text-indigo-500 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Degraded Network Banner */}
          {error && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={fetchCatalog}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 font-bold transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Search Bar & Filters */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search faculty by name, employee ID, or school..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`${SEARCH_FIELD} pl-10 pr-10`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-heading"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
              {/* School filter chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1.5 sm:pb-0 scrollbar-none">
                {COMMON_SCHOOLS.map((school) => {
                  const active = selectedSchool === school;
                  return (
                    <button
                      key={school}
                      onClick={() => setSelectedSchool(school)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                        active
                          ? "bg-indigo-600 text-white shadow-xs"
                          : "bg-surface-secondary text-text-muted hover:text-text-heading hover:bg-surface-secondary/80 border border-transparent"
                      }`}
                    >
                      {school}
                    </button>
                  );
                })}
              </div>

              {/* Track and Sort dropdowns */}
              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <select
                  value={selectedTrack}
                  onChange={(e: any) => setSelectedTrack(e.target.value)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-surface border border-border-strong text-text-heading focus:outline-none cursor-pointer"
                >
                  <option value="all">All Tracks</option>
                  <option value="teaching">Teaching Only</option>
                  <option value="project">Project Guide Only</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="text-xs font-bold px-3 py-1.5 rounded-xl bg-surface border border-border-strong text-text-heading focus:outline-none cursor-pointer"
                >
                  <option value="rating">Highest Rated</option>
                  <option value="reviews">Most Reviewed</option>
                  <option value="name">Name (A-Z)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Faculty Cards Grid */}
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="text-xs font-semibold text-text-muted">Loading verified faculty catalog...</p>
            </div>
          ) : filteredFaculty.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border-muted rounded-3xl p-8 space-y-3 bg-surface/30">
              <div className="w-12 h-12 rounded-2xl bg-surface-secondary flex items-center justify-center mx-auto text-text-muted">
                <Search className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-heading">Not listed yet</h3>
                <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                  Faculty are added exclusively through verified semester catalogs. Students cannot manually add faculty records.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedFaculty.map((faculty) => {
                const teachingCount = faculty.reviews || 0;
                const projectCount = faculty.projectReviews || (faculty as any).project_reviews || 0;
                const teachingGrade = faculty.teachingGrade;
                const projectGrade = faculty.projectGrade;

                return (
                  <div
                    key={faculty.id}
                    onClick={() => setSelectedFaculty(faculty)}
                    className={`${TILE_CARD} border border-border-strong p-4 flex flex-col justify-between hover:border-indigo-500/40 hover:shadow-md transition-all cursor-pointer group`}
                  >
                    <div>
                      <div className="flex items-start gap-3">
                        <FacultyAvatar
                          employeeId={faculty.employeeId}
                          name={faculty.name}
                          fallbackImageUrl={faculty.image_url}
                          size="md"
                          className="w-12 h-12 rounded-2xl shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-text-heading truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {faculty.name}
                          </h3>
                          <p className="text-xs text-text-muted truncate mt-0.5">
                            {faculty.dept ? `${faculty.dept} • ` : ""}
                            {faculty.designation || "Faculty Member"}
                          </p>
                          {faculty.employeeId && (
                            <p className="text-[10px] text-text-muted/70 font-mono mt-0.5">
                              ID: {faculty.employeeId}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Dual Track Scores Display */}
                    <div className="mt-4 pt-3 border-t border-border-muted flex items-center justify-between gap-2">
                      {/* Teaching Track Pill */}
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">
                          Teaching
                        </span>
                        <div className="mt-1 flex items-center gap-1.5">
                          {teachingCount === 0 ? (
                            <span className="text-xs text-text-muted italic">
                              No reviews yet
                            </span>
                          ) : (
                            <>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                  (teachingGrade || 0) >= 4.0
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                    : (teachingGrade || 0) >= 3.0
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                }`}
                              >
                                {(teachingGrade || 0).toFixed(1)} / 5.0
                              </span>
                              {teachingCount <= 7 && (
                                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  Early
                                </span>
                              )}
                              <span className="text-[11px] text-text-muted">
                                ({teachingCount} {teachingCount === 1 ? "review" : "reviews"})
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Project Guide Track Pill */}
                      <div className="flex-1 min-w-0 border-l border-border-muted pl-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">
                          Project Guide
                        </span>
                        <div className="mt-1 flex items-center gap-1.5">
                          {projectCount === 0 ? (
                            <span className="text-xs text-text-muted italic">
                              No reviews yet
                            </span>
                          ) : (
                            <>
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                  (projectGrade || 0) >= 4.0
                                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                    : (projectGrade || 0) >= 3.0
                                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                }`}
                              >
                                {(projectGrade || 0).toFixed(1)} / 5.0
                              </span>
                              {projectCount <= 7 && (
                                <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                  Early
                                </span>
                              )}
                              <span className="text-[11px] text-text-muted">
                                ({projectCount} {projectCount === 1 ? "review" : "reviews"})
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Controls */}
            <div className="mt-8 pt-4 border-t border-border-muted flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Left: showing count & page size */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted">
                <span>
                  Showing{" "}
                  <strong className="text-text-heading">
                    {filteredFaculty.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                  </strong>
                  –
                  <strong className="text-text-heading">
                    {Math.min(currentPage * pageSize, filteredFaculty.length)}
                  </strong>{" "}
                  of{" "}
                  <strong className="text-text-heading">
                    {filteredFaculty.length}
                  </strong>{" "}
                  faculty
                </span>
                <span className="text-border-muted hidden sm:inline">•</span>
                <div className="flex items-center gap-1.5">
                  <span>Per page:</span>
                  <div className="flex items-center gap-1 bg-surface-secondary rounded-lg p-0.5 border border-border-muted">
                    {[12, 24, 48, 96].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setPageSize(size);
                          setCurrentPage(1);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                          pageSize === size
                            ? "bg-background text-text-heading shadow-xs"
                            : "text-text-muted hover:text-text-heading"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: page navigation */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      window.scrollTo({ top: 300, behavior: "smooth" });
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-border-muted bg-surface hover:bg-surface-secondary text-xs font-semibold text-text-heading disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Prev</span>
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        if (p === 1 || p === totalPages) return true;
                        if (Math.abs(p - currentPage) <= 1) return true;
                        return false;
                      })
                      .reduce<(number | string)[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                          acc.push(`ellipsis-${p}`);
                        }
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((item) => {
                        if (typeof item === "string") {
                          return (
                            <span
                              key={item}
                              className="px-1 text-xs text-text-muted select-none"
                            >
                              …
                            </span>
                          );
                        }
                        const isActive = item === currentPage;
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => {
                              setCurrentPage(item);
                              window.scrollTo({ top: 300, behavior: "smooth" });
                            }}
                            className={`w-7 h-7 rounded-lg text-xs font-bold transition-colors ${
                              isActive
                                ? "bg-indigo-600 text-white"
                                : "text-text-muted hover:text-text-heading hover:bg-surface-secondary"
                            }`}
                          >
                            {item}
                          </button>
                        );
                      })}
                  </div>

                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      window.scrollTo({ top: 300, behavior: "smooth" });
                    }}
                    className="px-2.5 py-1.5 rounded-lg border border-border-muted bg-surface hover:bg-surface-secondary text-xs font-semibold text-text-heading disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                    aria-label="Next page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    )}

      {/* VIEW 2: WRITE REVIEWS */}
      {viewMode === "write" && (
        <div className="space-y-8 animate-fadeIn">
          {/* SECTION 1: MY PUBLISHED REVIEWS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-text-heading flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>My Published Reviews</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Reviews you have submitted. Ratings can be edited within 14 days of submission.
                </p>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-surface-secondary text-text-heading border border-border">
                {publishedReviews.length} Published
              </span>
            </div>

            {loadingEligibility ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                <span>Checking your submitted reviews…</span>
              </div>
            ) : publishedReviews.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-border-strong bg-surface/30 text-center space-y-2">
                <p className="text-sm font-semibold text-text-heading">No reviews written yet</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  You haven&apos;t written any reviews yet. Select one of your enrolled teachers below or review a project guide to help fellow students.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {publishedReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-4 rounded-2xl border border-border-strong bg-surface flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <FacultyAvatar
                          name={rev.faculty.name}
                          employeeId={rev.faculty?.employee_id || rev.faculty?.employeeId}
                          fallbackImageUrl={rev.faculty?.image_url}
                          size="sm"
                          tone="amber"
                        />
                        <div>
                          <h4 className="font-bold text-sm text-text-heading leading-tight">
                            {rev.faculty.name}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {rev.track === "teaching"
                              ? `${rev.course_code} (${rev.component}) · ${rev.semester}`
                              : rev.project_term || "Project Guide"}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          rev.track === "teaching"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                            : "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                        }`}
                      >
                        {rev.track === "teaching" ? "Teaching" : "Project Guide"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-1.5 text-xs">
                        {rev.can_edit ? (
                          <span className="text-emerald-500 font-semibold flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Edit open ({rev.days_left_to_edit} days left)</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Lock className="w-3.5 h-3.5" />
                            <span>Permanently locked</span>
                          </span>
                        )}
                      </div>

                      {rev.can_edit && (
                        <button
                          type="button"
                          onClick={() => {
                            setWriteTarget({
                              facultyId: rev.faculty.id,
                              facultyName: rev.faculty.name,
                              courseCode: rev.course_code,
                              semester: rev.semester,
                              component: rev.component,
                              track: rev.track,
                              isEditing: true,
                            });
                            setIsWriteModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Edit Review
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: REVIEW FACULTY I'VE STUDIED UNDER (TEACHING TRACK) */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-text-heading flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-500" />
                  <span>Faculty You&apos;ve Studied Under (Teaching Track)</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Verified across all attended semesters. Review windows unlock 1 month before each semester ends.
                </p>
              </div>
              {eligibilityData?.teaching && eligibilityData.teaching.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 self-start sm:self-auto">
                  {eligibilityData.teaching.length} Verified Courses
                </span>
              )}
            </div>

            {/* Semester Filter Pills */}
            {semesterGroups.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedSemesterFilter("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    selectedSemesterFilter === "all"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-surface-secondary border border-border text-muted-foreground hover:text-text-heading"
                  }`}
                >
                  All Semesters ({eligibilityData?.teaching.length ?? 0})
                </button>
                {semesterGroups.map((group) => (
                  <button
                    key={group.semesterId}
                    type="button"
                    onClick={() => setSelectedSemesterFilter(group.semesterId)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      selectedSemesterFilter === group.semesterId
                        ? "bg-blue-600 text-white shadow-xs"
                        : "bg-surface-secondary border border-border text-muted-foreground hover:text-text-heading"
                    }`}
                  >
                    <span>{group.label}</span>
                    <span className="text-[10px] opacity-75">({group.items.length})</span>
                  </button>
                ))}
              </div>
            )}

            {loadingEligibility ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                <span>Loading your verified course enrollments…</span>
              </div>
            ) : !eligibilityData?.teaching || eligibilityData.teaching.length === 0 ? (
              <div className="p-6 rounded-2xl border border-dashed border-border-strong bg-surface/30 space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-heading">No timetable enrollments detected</h3>
                  <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                    Sync your timetable from VTOP to verify your classes and unlock teacher reviews.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchEligibility}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Check & Sync Enrollments</span>
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredSemesterGroups.map((group) => {
                  const isCurrent = !group.timing.isPastSemester;
                  return (
                    <div key={group.semesterId} className="space-y-3">
                      {/* Semester Sub-header */}
                      <div className="flex items-center justify-between pb-2 border-b border-border">
                        <div className="flex items-center gap-2.5">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-text-heading">
                              {group.label}
                            </span>
                            <span className="text-[11px] font-mono text-muted-foreground bg-surface-secondary px-2 py-0.5 rounded border border-border">
                              {group.semesterId}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                                Active Term
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          {group.timing.isOpen ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              <span>Reviews Open</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                              <Lock className="w-3 h-3" />
                              <span>{group.timing.reason || "Opens 1 mo before term end"}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Cards Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {group.items.map((enr, i) => {
                          const isReviewed = Boolean(enr.reviewed);
                          const schoolLabel = formatFacultySchool(enr.faculty.school);
                          const timing = enr.timing || group.timing;
                          const canWrite = timing.isOpen;

                          return (
                            <div
                              key={i}
                              className="p-4 rounded-2xl border border-border-strong bg-surface flex flex-col justify-between space-y-3 hover:border-blue-500/30 transition-all shadow-xs"
                            >
                              <div className="flex items-start gap-3">
                                <FacultyAvatar
                                  name={enr.faculty.name}
                                  employeeId={enr.faculty?.employee_id || enr.faculty?.employeeId}
                                  fallbackImageUrl={enr.faculty?.image_url}
                                  size="md"
                                  tone="blue"
                                />
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-bold text-sm text-text-heading truncate">
                                    {enr.faculty.name}
                                  </h4>
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {schoolLabel ? `${schoolLabel} · ` : ""}
                                    {enr.course_code} ({enr.component})
                                  </p>
                                  <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    <span>Verified Enrollment</span>
                                  </div>
                                </div>
                              </div>

                              <div className="pt-2 border-t border-border flex items-center justify-between">
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  {group.label}
                                </span>

                                {isReviewed ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-1">
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Reviewed</span>
                                    </span>
                                    {enr.review_details?.can_edit && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setWriteTarget({
                                            facultyId: enr.faculty.id,
                                            facultyName: enr.faculty.name,
                                            employeeId: enr.faculty.employee_id,
                                            courseCode: enr.course_code,
                                            semester: enr.semester,
                                            component: enr.component,
                                            track: "teaching",
                                            isEditing: true,
                                          });
                                          setIsWriteModalOpen(true);
                                        }}
                                        className="px-2.5 py-1 rounded-xl border border-border text-xs font-bold text-muted-foreground hover:text-text-heading hover:bg-surface-secondary transition-colors cursor-pointer"
                                      >
                                        Edit
                                      </button>
                                    )}
                                  </div>
                                ) : canWrite ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWriteTarget({
                                        facultyId: enr.faculty.id,
                                        facultyName: enr.faculty.name,
                                        employeeId: enr.faculty.employee_id,
                                        courseCode: enr.course_code,
                                        semester: enr.semester,
                                        component: enr.component,
                                        track: "teaching",
                                        isEditing: false,
                                      });
                                      setIsWriteModalOpen(true);
                                    }}
                                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                                  >
                                    <PenLine className="w-3.5 h-3.5" />
                                    <span>Write Review</span>
                                  </button>
                                ) : (
                                  <span
                                    title={timing.reason || "Reviews open 1 month before semester ends"}
                                    className="px-3 py-1.5 rounded-xl bg-surface-secondary text-muted-foreground text-xs font-medium flex items-center gap-1.5 border border-border cursor-not-allowed"
                                  >
                                    <Lock className="w-3.5 h-3.5" />
                                    <span>Locked</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 3: REVIEW PROJECT GUIDE (PROJECT TRACK) */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-text-heading flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-purple-500" />
                  <span>Review Project Guide (Project Track)</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Review faculty members who guided your Capstone Project, Mini Project, Project I/II, or Research supervision.
                </p>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-text-heading">Project Guidance Track</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400">
                    Annual Quota: 3 / Year
                  </span>
                </div>
                <p className="text-xs text-muted-foreground max-w-lg">
                  Did a professor guide your Capstone, Mini Project, or paper? Share your experience regarding mentor responsiveness, ownership, and milestone clarity.
                </p>
                <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
                  {eligibilityData?.project?.remaining_slots ?? 3} review slot(s) remaining for this academic year.
                </p>
              </div>

              <button
                type="button"
                disabled={eligibilityData?.project && !eligibilityData.project.can_review}
                onClick={() => {
                  setWriteTarget({
                    track: "project",
                    isEditing: false,
                  });
                  setIsWriteModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Review a Project Guide</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODALS */}
      {/* 1. Read-Only Faculty Review Profile Sheet */}
      {selectedFaculty && (
        <FacultyReviewSheet
          facultyId={selectedFaculty.id}
          employeeId={selectedFaculty.employeeId}
          facultyName={selectedFaculty.name}
          open={true}
          onClose={() => setSelectedFaculty(null)}
        />
      )}

      {/* 2. Write Review Modal */}
      <WriteReviewModal
        open={isWriteModalOpen}
        onClose={() => {
          setIsWriteModalOpen(false);
          fetchCatalog();
          fetchEligibility();
        }}
        facultyId={writeTarget.facultyId}
        facultyName={writeTarget.facultyName}
        employeeId={writeTarget.employeeId}
        courseCode={writeTarget.courseCode}
        semester={writeTarget.semester}
        component={writeTarget.component}
        initialTrack={writeTarget.track || "teaching"}
        isEditing={writeTarget.isEditing}
        initialAnswers={writeTarget.initialAnswers}
        initialGreenTags={writeTarget.initialGreenTags}
        initialRedTags={writeTarget.initialRedTags}
        onSubmitted={() => {
          fetchCatalog();
          fetchEligibility();
        }}
      />

      {/* 3. Compare Modal */}
      <FacultyCompareModal
        open={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        catalogFaculty={facultyList.map((f) => ({
          id: f.id,
          name: f.name,
          school: f.dept || null,
        }))}
      />

      {/* 4. Admin Management Modal (admin-only UI; API enforces RBAC) */}
      {isReviewAdmin && (
        <AdminFacultyModal
          isOpen={isAdminModalOpen}
          onClose={() => setIsAdminModalOpen(false)}
        />
      )}
    </div>
  );
}
