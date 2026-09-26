"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  Search,
  X,
  RefreshCcw,
  ChevronDown,
  ChevronRight,
  BookOpen,
  GraduationCap,
  Download,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Calculator,
  LayoutGrid,
  ArrowUpRight,
  ListFilter,
  Award,
} from "lucide-react";
import { api } from "@/lib/sync-engine";
import BackButton from "../shared/BackButton";
import { storage } from "@/lib/storage";
import {
  buildCategoryRows,
  splitCurriculumRows,
  num,
  type CategoryRow,
} from "@/lib/curriculum";

// ── helpers & constants ──────────────────────────────────────────────
const normalizeDistributionType = (raw?: string) => {
  switch (raw?.toUpperCase()) {
    case "TH": return "Theory";
    case "LO": return "Lab Only";
    case "ETL": return "Embedded Theory & Lab";
    case "ELA": return "Embedded Lab";
    case "PJT": return "Project";
    case "SS": return "Soft Skill";
    case "OC": return "Online Course";
    default: return raw || "Other";
  }
};

const GRADE_COLORS: Record<string, string> = {
  S: "text-amber-500 border-amber-500/20 bg-amber-500/10",
  A: "text-emerald-500 border-emerald-500/20 bg-emerald-500/10",
  B: "text-blue-500 border-blue-500/20 bg-blue-500/10",
  C: "text-cyan-500 border-cyan-500/20 bg-cyan-500/10",
  D: "text-orange-500 border-orange-500/20 bg-orange-500/10",
  E: "text-red-400 border-red-400/20 bg-red-400/10",
  F: "text-red-600 border-red-600/20 bg-red-600/10",
  P: "text-violet-500 border-violet-500/20 bg-violet-500/10",
  N: "text-gray-400 border-gray-400/20 bg-gray-400/10",
};

// ── types ────────────────────────────────────────────────────────────
interface CurriculumItem {
  basketTitle: string;
  creditsRequired: string;
  creditsEarned: string;
}

interface EffectiveGradeItem {
  basketTitle: string;
  distributionType: string;
  creditsEarned: string;
  grade: string;
  courseCode?: string;
}

interface BasketItem {
  code: string;
  name: string;
  credits: number;
  type?: string;
}

interface Basket {
  title: string;
  credits: number;
  items: BasketItem[];
}

interface CurriculumCategory {
  code: string;
  name: string;
  credits: number;
  maxCredits: number;
}

interface CategoryDetail {
  code: string;
  name: string;
  baskets: Basket[];
}

interface Creds {
  cookies: string[];
  authorizedID: string;
  csrf: string;
}

type TabView = "overview" | "catalog" | "completed" | "planner";
type Screen = "landing" | TabView;
type CourseStatus = "completed" | "in_progress" | "remaining";

interface ViewMeta {
  id: TabView;
  label: string;
  title: string;
  desc: string;
  icon: React.ElementType;
  iconClass: string;
}

const VIEW_META: ViewMeta[] = [
  {
    id: "overview",
    label: "Baskets",
    title: "Credit Baskets",
    desc: "Category-wise earned, ongoing and remaining credits",
    icon: BookOpen,
    iconClass:
      "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400",
  },
  {
    id: "catalog",
    label: "Catalog",
    title: "Course Catalog",
    desc: "Every course in the programme with syllabus downloads",
    icon: Search,
    iconClass: "bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400",
  },
  {
    id: "completed",
    label: "Completed",
    title: "Completed Courses",
    desc: "Cleared courses grouped by distribution type",
    icon: CheckCircle2,
    iconClass:
      "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "planner",
    label: "Planner",
    title: "Degree Planner",
    desc: "What average grade your remaining credits need",
    icon: Calculator,
    iconClass:
      "bg-violet-500/10 border-violet-500/20 text-violet-600 dark:text-violet-400",
  },
];

// ── design tokens (shared with the courses / OD / home pages) ──────────
const TILE =
  "p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between text-left relative overflow-hidden";

const LIST_SHELL =
  "overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-xs divide-y divide-zinc-200/60 dark:divide-zinc-800/60";

const LIST_ROW =
  "w-full flex items-center gap-3 py-3 px-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/40";

const CHIP =
  "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60";

const SECTION_CHIP =
  "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60";

const ICON_BUTTON =
  "p-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0";

const SEG_ACTIVE =
  "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold";
const SEG_IDLE =
  "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200";



// ── main component ──────────────────────────────────────────────────
export default function CurriculumPage({
  allGradesData,
  gradesData,
  marksData,
  attendance,
  handleFetchGrades,
  setActiveSubTab,
  loginToVTOP,
}: {
  allGradesData?: any;
  gradesData: any;
  marksData: any;
  attendance: any;
  handleFetchGrades: () => void;
  setActiveSubTab: (tab: string) => void;
  loginToVTOP?: () => Promise<Creds>;
}) {
  const [curricDetails, setCurricDetails] = useState<CategoryDetail[] | null>(null);
  const [curricCategories, setCurricCategories] = useState<CurriculumCategory[]>([]);
  const [curricTotal, setCurricTotal] = useState(0);
  const [pageCsrf, setPageCsrf] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CourseStatus>("all");
  const [screen, setScreen] = useState<Screen>("landing");
  const [creds, setCreds] = useState<Creds | null>(null);
  const [isDownloadingCurriculum, setIsDownloadingCurriculum] = useState(false);
  const [downloadingSyllabus, setDownloadingSyllabus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Expansion sets — only ever one level open per group, all collapsed by default
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [openBaskets, setOpenBaskets] = useState<Set<string>>(new Set());

  // ─ CGPA Blur State (persisted, single source of truth in the top bar) ─
  const [isCgpaBlurred, setIsCgpaBlurred] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("settings");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.CGPAHidden === "boolean") return parsed.CGPAHidden;
          if (typeof parsed.blurGrades === "boolean") return parsed.blurGrades;
        }
      } catch {}
    }
    return false;
  });

  const toggleCgpaBlur = () => {
    setIsCgpaBlurred((prev) => {
      const next = !prev;
      try {
        const raw = localStorage.getItem("settings");
        const parsed = raw ? JSON.parse(raw) : {};
        localStorage.setItem("settings", JSON.stringify({ ...parsed, CGPAHidden: next }));
      } catch {}
      return next;
    });
  };

  // ─ Fetch Curriculum Data ─
  const fetchCurriculumData = async (force = false) => {
    if (!force) {
      const cached = storage.curriculum.get() as any;
      if (cached) {
        try {
          setCurricDetails(cached.details || []);
          setCurricCategories(cached.categories || []);
          setCurricTotal(cached.totalCredits || 0);
          if (cached.pageCsrf) setPageCsrf(cached.pageCsrf);
          return;
        } catch {}
      }
    }

    if (!loginToVTOP) return;
    try {
      const c = await loginToVTOP();
      setCreds(c);
      const result: any = await api("curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: c,
      });
      if (result && result.success !== false) {
        setCurricDetails(result.details || []);
        setCurricCategories(result.categories || []);
        setCurricTotal(result.totalCredits || 0);
        if (result.pageCsrf) setPageCsrf(result.pageCsrf);
        storage.curriculum.set({
          details: result.details,
          categories: result.categories,
          totalCredits: result.totalCredits,
          pageCsrf: result.pageCsrf,
        });
      }
    } catch {}
  };

  useEffect(() => {
    void fetchCurriculumData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSync = async () => {
    setIsSyncing(true);
    try {
      await Promise.all([handleFetchGrades(), fetchCurriculumData(true)]);
    } finally {
      setIsSyncing(false);
    }
  };

  // ─ Syllabus & Curriculum PDF downloads ─
  const withCreds = async (): Promise<Creds | null> => {
    if (creds) return creds;
    if (!loginToVTOP) return null;
    const c = await loginToVTOP();
    setCreds(c);
    return c;
  };

  const downloadSyllabus = async (courseCode: string) => {
    setDownloadingSyllabus(courseCode);
    try {
      const c = await withCreds();
      if (!c) return;
      const res = await api("curriculum/syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          cookies: c.cookies,
          authorizedID: c.authorizedID,
          csrf: pageCsrf || c.csrf,
          courseCode,
        },
        parse: "raw",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `Download failed (${res.status})`);
      }
      const ct = res.headers.get("content-type") || "";
      const filename = ct.includes("zip")
        ? `${courseCode}_syllabus.zip`
        : `${courseCode}_syllabus.pdf`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Syllabus download error:", err?.message);
    } finally {
      setDownloadingSyllabus(null);
    }
  };

  const downloadCurriculum = async () => {
    setIsDownloadingCurriculum(true);
    try {
      const c = await withCreds();
      if (!c) return;
      const res = await api("curriculum/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: {
          cookies: c.cookies,
          authorizedID: c.authorizedID,
          csrf: pageCsrf || c.csrf,
        },
        parse: "raw",
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `Download failed (${res.status})`);
      }
      const ct = res.headers.get("content-type") || "";
      const filename = ct.includes("zip") ? "curriculum.zip" : "curriculum.pdf";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Curriculum download error:", err?.message);
    } finally {
      setIsDownloadingCurriculum(false);
    }
  };

  const toggleIn = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    key: string
  ) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─ Data Extractors (unchanged probing) ─
  const findCurriculum = (): CurriculumItem[] => {
    const sources = [
      allGradesData?.curriculum,
      allGradesData?.cgpa?.curriculum,
      allGradesData?.grades?.curriculum,
      allGradesData?.data?.curriculum,
      gradesData?.curriculum,
      gradesData?.cgpa?.curriculum,
      gradesData?.grades?.curriculum,
      gradesData?.data?.curriculum,
      marksData?.curriculum,
      marksData?.cgpa?.curriculum,
      marksData?.grades?.curriculum,
    ];
    for (const src of sources) {
      if (Array.isArray(src) && src.length > 0) return src;
    }
    return [];
  };

  const findEffectiveGrades = (): EffectiveGradeItem[] => {
    const sources = [
      allGradesData?.effectiveGrades,
      allGradesData?.cgpa?.effectiveGrades,
      allGradesData?.grades?.effectiveGrades,
      allGradesData?.data?.effectiveGrades,
      gradesData?.effectiveGrades,
      gradesData?.cgpa?.effectiveGrades,
      gradesData?.grades?.effectiveGrades,
      gradesData?.data?.effectiveGrades,
      marksData?.effectiveGrades,
      marksData?.cgpa?.effectiveGrades,
      marksData?.grades?.effectiveGrades,
    ];
    for (const src of sources) {
      if (Array.isArray(src) && src.length > 0) return src;
    }
    return [];
  };

  const curriculum = findCurriculum();
  const effectiveGrades = findEffectiveGrades().filter(
    (eg) => !isNaN(parseFloat(eg.creditsEarned))
  );

  const currentCgpa = useMemo(
    () =>
      Number(
        marksData?.cgpa?.cgpa || gradesData?.cgpa?.cgpa || allGradesData?.cgpa?.cgpa || 0
      ),
    [marksData, gradesData, allGradesData]
  );

  // ─ Totals ─
  const totalRow = curriculum.find((c) =>
    (c.basketTitle || "").toLowerCase().includes("total credits")
  );
  let totalRequired = totalRow ? num(totalRow.creditsRequired) : curricTotal || 160;
  let totalEarned = totalRow ? num(totalRow.creditsEarned) : 0;

  if (totalEarned === 0 && marksData?.cgpa?.creditsEarned) {
    totalEarned =
      num(marksData.cgpa.creditsEarned) + num(marksData.cgpa.nonGradedRequirement);
    totalRequired = num(marksData.cgpa.creditsRequired) || curricTotal || 160;
  }
  if (totalEarned === 0 && effectiveGrades.length > 0) {
    totalEarned = effectiveGrades.reduce(
      (acc, curr) => acc + (num(curr.creditsEarned) || 0),
      0
    );
  }

  const safeAttendance = useMemo(
    () => (Array.isArray(attendance) ? attendance : []),
    [attendance]
  );

  // ─ Ongoing credits, keyed by the same category names the curriculum uses ─
  const ongoingCreditsByCategory = useMemo(() => {
    return safeAttendance.reduce<Record<string, number>>((acc, item) => {
      let category = item.category || "Uncategorized";
      const credits = num(item.credits);
      if (
        category ===
        "Foundation Core - Humanities, Social Sciences and Management (LANGUAGE Basket)"
      ) {
        category = "Foreign Language";
      } else if (
        category ===
        "Foundation Core - Humanities, Social Sciences and Management (GENERAL Basket)"
      ) {
        category = "HSM Elective";
      } else if (
        category ===
        "Foundation Core - Humanities, Social Sciences and Management (EXTRA CURRICULAR Basket)"
      ) {
        category = "Extra curricular activities";
      }
      acc[category] = (acc[category] || 0) + credits;
      const hssm = "Foundation Core - Humanities, Social Sciences and Management";
      const ngcr = "Non-graded Core Requirement";
      if (category === "Foreign Language" || category === "HSM Elective") {
        acc[hssm] = (acc[hssm] || 0) + credits;
      }
      if (category === "Extra curricular activities") {
        acc[ngcr] = (acc[ngcr] || 0) + credits;
      }
      return acc;
    }, {});
  }, [safeAttendance]);

  const totalOngoing = useMemo(
    () => Object.values(ongoingCreditsByCategory).reduce((s, v) => s + v, 0),
    [ongoingCreditsByCategory]
  );

  // Electives/extras are listed separately; `main` is consumed via
  // buildCategoryRows, which re-applies the same split internally.
  const { sub: subCategories } = useMemo(
    () => splitCurriculumRows(curriculum),
    [curriculum]
  );

  /**
   * One row per credit category, from whichever source has data — the flat
   * all-grades `curriculum` list, or the `categories` array from the
   * /curriculum response. Logic + tests live in src/lib/curriculum.ts.
   */
  const categoryRows = useMemo<CategoryRow[]>(
    () =>
      buildCategoryRows({
        curriculum,
        categories: curricCategories,
        details: curricDetails,
        ongoingByCategory: ongoingCreditsByCategory,
      }),
    [curriculum, curricCategories, curricDetails, ongoingCreditsByCategory]
  );



  const completedCourseCodes = useMemo(() => {
    const set = new Set<string>();
    effectiveGrades.forEach((eg) => {
      if (eg.courseCode) set.add(eg.courseCode.toUpperCase());
      const codeMatch = (eg.basketTitle || "").match(/([A-Z]{3,4}\d{3,4})/);
      if (codeMatch) set.add(codeMatch[1].toUpperCase());
    });
    return set;
  }, [effectiveGrades]);

  const ongoingCourseCodes = useMemo(() => {
    const set = new Set<string>();
    safeAttendance.forEach((a) => {
      if (a.courseCode) set.add(String(a.courseCode).toUpperCase());
    });
    return set;
  }, [safeAttendance]);

  const statusOf = (code?: string): CourseStatus => {
    const c = String(code || "").toUpperCase();
    if (c && completedCourseCodes.has(c)) return "completed";
    if (c && ongoingCourseCodes.has(c)) return "in_progress";
    return "remaining";
  };

  const earnedPct = Math.min((totalEarned / totalRequired) * 100, 100);
  const remainingCredits = Math.max(totalRequired - totalEarned - totalOngoing, 0);
  const expectedGraduation =
    remainingCredits <= 0 ? "Ready" : `${Math.max(Math.ceil(remainingCredits / 24), 1)} sem`;

  const inProgressCount = ongoingCourseCodes.size;
  const completedCount = completedCourseCodes.size;
  const totalCourses = useMemo(
    () =>
      (curricDetails || []).reduce(
        (sum, cat) => sum + (cat.baskets || []).reduce((s, b) => s + (b.items?.length || 0), 0),
        0
      ),
    [curricDetails]
  );

  // ─ Catalog: one flat course list, then filter ─
  interface CatalogCourse {
    code: string;
    name: string;
    credits: number;
    status: CourseStatus;
    category: string;
    type?: string;
  }

  const catalogCourses = useMemo<CatalogCourse[]>(() => {
    // Inlined status lookup so the memo depends on the code sets directly
    const statusFor = (code?: string): CourseStatus => {
      const c = String(code || "").toUpperCase();
      if (c && completedCourseCodes.has(c)) return "completed";
      if (c && ongoingCourseCodes.has(c)) return "in_progress";
      return "remaining";
    };
    const out: CatalogCourse[] = [];
    for (const cat of curricDetails || []) {
      for (const basket of cat.baskets || []) {
        for (const item of basket.items || []) {
          out.push({
            code: item.code,
            name: item.name,
            credits: num(item.credits),
            status: statusFor(item.code),
            category: cat.name,
            type: item.type,
          });
        }
      }
    }
    return out;
  }, [curricDetails, completedCourseCodes, ongoingCourseCodes]);

  const q = searchQuery.trim().toLowerCase();
  const catalogMatches = useMemo(() => {
    return catalogCourses.filter((c) => {
      if (q && !`${c.code} ${c.name} ${c.category}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      return true;
    });
  }, [catalogCourses, q, statusFilter]);

  // Grouped only when idle; a search returns one flat list
  const catalogGroups = useMemo(() => {
    const map = new Map<string, CatalogCourse[]>();
    for (const c of catalogMatches) {
      if (!map.has(c.category)) map.set(c.category, []);
      map.get(c.category)!.push(c);
    }
    return Array.from(map.entries());
  }, [catalogMatches]);

  // ─ Completed, grouped by distribution type ─
  const completedGroups = useMemo(() => {
    const map = new Map<string, EffectiveGradeItem[]>();
    for (const eg of effectiveGrades) {
      const key = normalizeDistributionType(eg.distributionType);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(eg);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [effectiveGrades]);

  // ─ Landing carousel slides (each one lands somewhere real) ─
  const [slideIndex, setSlideIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  const slides = useMemo(() => {
    const list: {
      id: string;
      title: string;
      headline: string;
      subline: string;
      badge: string;
      badgeClass: string;
      tone: string;
      onClick: () => void;
    }[] = [];

    if (currentCgpa > 0) {
      list.push({
        id: "cgpa",
        title: "CGPA",
        headline: currentCgpa.toFixed(2),
        subline: "Current cumulative grade",
        badge: "Semester",
        badgeClass:
          "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40",
        tone: "",
        onClick: () => setActiveSubTab("grades"),
      });
    }
    list.push({
      id: "ongoing",
      title: "In progress",
      headline: String(inProgressCount),
      subline: "courses being taken",
      badge: "Ongoing",
      badgeClass:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
      tone: "text-amber-600 dark:text-amber-400",
      onClick: () => {
        setStatusFilter("in_progress");
        setScreen("catalog");
      },
    });
    list.push({
      id: "completed",
      title: "Cleared",
      headline: String(completedCount),
      subline: "courses completed",
      badge: "Cleared",
      badgeClass:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
      tone: "text-emerald-600 dark:text-emerald-400",
      onClick: () => setScreen("completed"),
    });
    list.push({
      id: "graduation",
      title: "Graduation",
      headline: expectedGraduation,
      subline: `${remainingCredits.toFixed(1)} credits remaining`,
      badge: "ETA",
      badgeClass:
        "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border border-zinc-500/20",
      tone: "text-zinc-700 dark:text-zinc-200",
      onClick: () => setScreen("planner"),
    });
    return list;
  }, [
    currentCgpa,
    inProgressCount,
    completedCount,
    expectedGraduation,
    remainingCredits,
    setActiveSubTab,
  ]);

  useEffect(() => {
    setSlideIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (isCarouselPaused || slides.length <= 1) return;
    const t = setInterval(() => setSlideIndex((p) => (p + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [isCarouselPaused, slides.length]);

  const slide = slides[slideIndex] || slides[0];

  const hasAnyData =
    curriculum.length > 0 ||
    effectiveGrades.length > 0 ||
    curricCategories.length > 0 ||
    (curricDetails?.length || 0) > 0;

  // ─ Shared small pieces ───────────────────────────────────────────────
  const IconButton = ({
    onClick,
    title,
    children,
    disabled,
  }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`${ICON_BUTTON} disabled:opacity-50`}
    >
      {children}
    </button>
  );

  const SectionHeader = ({
    icon: Icon,
    title,
    count,
    right,
  }: {
    icon: React.ElementType;
    title: string;
    count?: number;
    right?: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
        <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight truncate">
          {title}
        </h2>
        {typeof count === "number" && <span className={SECTION_CHIP}>{count}</span>}
      </div>
      {right}
    </div>
  );

  const StatusPill = ({ status }: { status: CourseStatus }) => {
    if (status === "completed") {
      return (
        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          Done
        </span>
      );
    }
    if (status === "in_progress") {
      return (
        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          Ongoing
        </span>
      );
    }
    return (
      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border border-zinc-500/20">
        Left
      </span>
    );
  };

  const MiniBar = ({ pct, tone }: { pct: number; tone: string }) => (
    <div className="w-full h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${tone}`}
        style={{ width: `${Math.max(0, Math.min(pct, 100))}%` }}
      />
    </div>
  );

  const SyllabusButton = ({ code }: { code: string }) => {
    if (!code || !loginToVTOP) return null;
    const busy = downloadingSyllabus === code;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          void downloadSyllabus(code);
        }}
        title={`Download ${code} syllabus`}
        aria-label={`Download ${code} syllabus`}
        className="p-1.5 rounded-lg bg-zinc-100 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-950/40 text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400 transition-colors cursor-pointer shrink-0"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
      </button>
    );
  };

  // ─ BASKETS: one flat, indented tree inside a single list shell ────────
  const basketsList = (
    <div className="space-y-3">
      <SectionHeader icon={BookOpen} title="Credit baskets" count={categoryRows.length} />

      {categoryRows.length === 0 ? (
        <div className="p-8 rounded-[28px] border border-dashed border-zinc-300 dark:border-zinc-800 text-center">
          <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
            Credit baskets appear once grades sync from VTOP.
          </p>
        </div>
      ) : (
        <div className={LIST_SHELL}>
          {categoryRows.map((cat) => {
            const key = cat.key;
            const isOpen = openGroups.has(key);
            const { required, earned, ongoing, baskets } = cat;
            const pct = required > 0 ? (earned / required) * 100 : 0;

            return (
              <React.Fragment key={key}>
                <button
                  type="button"
                  onClick={() => toggleIn(setOpenGroups, key)}
                  className={`${LIST_ROW} ${baskets.length ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      pct >= 100 ? "bg-emerald-500" : pct > 0 ? "bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {cat.code && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/40 shrink-0">
                          {cat.code}
                        </span>
                      )}
                      <p className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                        {cat.title}
                      </p>
                      {ongoing > 0 && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
                          {ongoing.toFixed(0)} cr live
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                      {earned.toFixed(1)} earned · {required.toFixed(1)} required
                    </p>
                    <div className="mt-1.5 max-w-[160px]">
                      <MiniBar
                        pct={pct}
                        tone={pct >= 100 ? "bg-emerald-500" : "bg-indigo-500"}
                      />
                    </div>
                  </div>
                  {baskets.length > 0 && (
                    <ChevronRight
                      className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && baskets.length > 0 && (
                    <m.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden bg-zinc-50/60 dark:bg-zinc-950/30"
                    >
                      {baskets.map((b, bi) => {
                        const bKey = `basket:${key}:${b.title}:${bi}`;
                        const bOpen = openBaskets.has(bKey);
                        return (
                          <div key={bKey}>
                            <button
                              type="button"
                              onClick={() => toggleIn(setOpenBaskets, bKey)}
                              className="w-full flex items-center gap-2 py-2.5 pl-9 pr-4 text-left hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer"
                            >
                              <ChevronRight
                                className={`w-3.5 h-3.5 text-zinc-400 shrink-0 transition-transform ${
                                  bOpen ? "rotate-90" : ""
                                }`}
                              />
                              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate flex-1">
                                {b.title}
                              </span>
                              <span className="text-[10px] font-bold text-zinc-400 shrink-0">
                                {b.credits} cr
                              </span>
                            </button>

                            <AnimatePresence initial={false}>
                              {bOpen && (
                                <m.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2, ease: "easeOut" }}
                                  className="overflow-hidden"
                                >
                                  {(b.items || []).map((item) => (
                                    <div
                                      key={item.code}
                                      className="flex items-center gap-2 py-2 pl-14 pr-4"
                                    >
                                      <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                        {item.code}
                                      </span>
                                      <span className="text-[11px] text-zinc-600 dark:text-zinc-300 truncate flex-1">
                                        {item.name}
                                      </span>
                                      <StatusPill status={statusOf(item.code)} />
                                      <span className="text-[10px] font-bold text-zinc-400 w-8 text-right shrink-0">
                                        {num(item.credits)} cr
                                      </span>
                                      <SyllabusButton code={item.code} />
                                    </div>
                                  ))}
                                </m.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </m.div>
                  )}
                </AnimatePresence>
              </React.Fragment>
            );
          })}
        </div>
      )}

      {subCategories.length > 0 && (
        <div className="space-y-3 pt-2">
          <SectionHeader
            icon={Award}
            title="Electives & extras"
            count={subCategories.length}
          />
          <div className={LIST_SHELL}>
            {subCategories.map((cat) => {
              const required = num(cat.creditsRequired);
              const earned = num(cat.creditsEarned);
              const pct = required > 0 ? (earned / required) * 100 : 0;
              return (
                <div key={cat.basketTitle} className={LIST_ROW}>
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      pct >= 100 ? "bg-emerald-500" : "bg-violet-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                      {cat.basketTitle}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                      {earned.toFixed(1)} earned · {required.toFixed(1)} required
                    </p>
                  </div>
                  <span className="text-sm font-black font-outfit text-zinc-900 dark:text-white shrink-0">
                    {Math.round(pct)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // ─ CATALOG ───────────────────────────────────────────────────────────
  const catalogList = (
    <div className="space-y-3">
      <SectionHeader
        icon={Search}
        title="Course catalog"
        count={catalogMatches.length}
      />

      {/* Filter bar: search + status pills (attendance-log style) */}
      <div className="px-1 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search course code or name..."
            className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800 text-xs font-bold text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs overflow-x-auto hide-scrollbar">
          {(
            [
              { id: "all", label: "All" },
              { id: "completed", label: "Done" },
              { id: "in_progress", label: "Ongoing" },
              { id: "remaining", label: "Left" },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === f.id ? SEG_ACTIVE : SEG_IDLE
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {catalogMatches.length === 0 ? (
        <div className="p-8 rounded-[28px] border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-2">
          <ListFilter className="w-7 h-7 text-zinc-400 mx-auto" />
          <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
            No courses match this filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("all");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-[11px] font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
          >
            <RefreshCcw className="w-3 h-3" />
            Reset filters
          </button>
        </div>
      ) : q || statusFilter !== "all" ? (
        /* Searching: one flat list, never a forced-open accordion */
        <div className={LIST_SHELL}>
          {catalogMatches.map((c) => (
            <div key={`${c.category}-${c.code}`} className={LIST_ROW}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-zinc-300 dark:bg-zinc-700" />
              <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                {c.code}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                  {c.name}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                  {c.category}
                </p>
              </div>
              <StatusPill status={c.status} />
              <span className="text-[10px] font-bold text-zinc-400 w-8 text-right shrink-0">
                {c.credits} cr
              </span>
              <SyllabusButton code={c.code} />
            </div>
          ))}
        </div>
      ) : (
        /* Idle: grouped accordions */
        <div className="space-y-2.5">
          {catalogGroups.map(([category, courses]) => {
            const key = `cat-group:${category}`;
            const isOpen = openGroups.has(key);
            const doneCount = courses.filter((c) => c.status === "completed").length;
            return (
              <div key={key} className={LIST_SHELL}>
                <button
                  type="button"
                  onClick={() => toggleIn(setOpenGroups, key)}
                  className={`${LIST_ROW} cursor-pointer`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  <p className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight flex-1">
                    {category}
                  </p>
                  <span className={CHIP}>
                    {doneCount}/{courses.length}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <m.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      {courses.map((c) => (
                        <div key={c.code} className={LIST_ROW}>
                          <span className="w-1.5 shrink-0" />
                          <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                            {c.code}
                          </span>
                          <span className="text-xs text-zinc-700 dark:text-zinc-300 truncate flex-1">
                            {c.name}
                          </span>
                          <StatusPill status={c.status} />
                          <span className="text-[10px] font-bold text-zinc-400 w-8 text-right shrink-0">
                            {c.credits} cr
                          </span>
                          <SyllabusButton code={c.code} />
                        </div>
                      ))}
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─ COMPLETED ─────────────────────────────────────────────────────────
  const completedList = (
    <div className="space-y-3">
      <SectionHeader
        icon={CheckCircle2}
        title="Completed courses"
        count={effectiveGrades.length}
      />

      {completedGroups.length === 0 ? (
        <div className="p-8 rounded-[28px] border border-dashed border-zinc-300 dark:border-zinc-800 text-center">
          <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
            No cleared courses yet.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {completedGroups.map(([type, courses]) => {
            const key = `done:${type}`;
            const isOpen = openGroups.has(key);
            const credits = courses.reduce((s, c) => s + num(c.creditsEarned), 0);
            return (
              <div key={key} className={LIST_SHELL}>
                <button
                  type="button"
                  onClick={() => toggleIn(setOpenGroups, key)}
                  className={`${LIST_ROW} cursor-pointer`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <p className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight flex-1">
                    {type}
                  </p>
                  <span className={CHIP}>
                    {courses.length} · {credits.toFixed(0)} cr
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <m.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      {courses.map((c, i) => (
                        <div key={`${c.basketTitle}-${i}`} className={LIST_ROW}>
                          <span className="w-1.5 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                              {c.basketTitle}
                            </p>
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                              {num(c.creditsEarned).toFixed(1)} credits earned
                            </p>
                          </div>
                          <span
                            className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                              GRADE_COLORS[c.grade] || GRADE_COLORS.N
                            } ${isCgpaBlurred ? "blur-[5px] select-none" : ""}`}
                          >
                            {isCgpaBlurred ? "—" : c.grade}
                          </span>
                        </div>
                      ))}
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─ PLANNER ───────────────────────────────────────────────────────────
  const [targetCgpa, setTargetCgpa] = useState<number>(8.5);
  const currentTotalPoints = currentCgpa * totalEarned;
  const requiredAverageGrade = useMemo(() => {
    if (remainingCredits <= 0) return 0;
    const pointsNeeded = targetCgpa * totalRequired - currentTotalPoints;
    return Math.max(0, pointsNeeded / remainingCredits);
  }, [currentTotalPoints, totalRequired, remainingCredits, targetCgpa]);
  const isAchievable = requiredAverageGrade <= 10.0;

  const plannerList = (
    <div className="space-y-3">
      <SectionHeader icon={Calculator} title="Degree planner" />

      {/* Target control */}
      <div className={LIST_SHELL}>
        <div className="px-4 py-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">
              Target graduation CGPA
            </span>
            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-outfit">
              {targetCgpa.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="5"
            max="10"
            step="0.05"
            value={targetCgpa}
            onChange={(e) => setTargetCgpa(parseFloat(e.target.value))}
            className="w-full accent-indigo-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] font-bold text-zinc-400">
            <span>5.00</span>
            <span>7.50</span>
            <span>8.50</span>
            <span>9.50</span>
            <span>10.00</span>
          </div>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400">
            Credits remaining
          </span>
          <span className="text-sm font-black font-outfit text-amber-600 dark:text-amber-400">
            {remainingCredits.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Result */}
      <div className="p-5 rounded-[24px] bg-indigo-600 text-white relative overflow-hidden">
        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">
          Required remaining average
        </p>
        <div className="flex items-baseline gap-2 mt-1">
          <span
            className={`text-4xl font-black font-outfit tracking-tight ${
              isCgpaBlurred ? "blur-[6px] select-none" : ""
            }`}
          >
            {requiredAverageGrade.toFixed(2)}
          </span>
          <span className="text-xs text-indigo-200 font-bold">SGPA / 10.0</span>
        </div>
        <p className="text-xs font-semibold text-indigo-100 leading-relaxed mt-2">
          {isAchievable ? (
            <>
              To graduate with a <strong>{targetCgpa.toFixed(2)}</strong> CGPA you need an
              average of <strong>{requiredAverageGrade.toFixed(2)}</strong> across your
              remaining {remainingCredits.toFixed(1)} credits.
            </>
          ) : (
            <>
              A {targetCgpa.toFixed(2)} CGPA target needs more than a 10.0 SGPA from here —
              try a lower target.
            </>
          )}
        </p>
        <button
          type="button"
          onClick={() => setActiveSubTab("marks-predictor")}
          className="mt-4 w-full py-2.5 px-4 rounded-2xl bg-white text-indigo-600 font-black text-xs hover:bg-indigo-50 transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          Open Marks Predictor
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ─ Page chrome ───────────────────────────────────────────────────────
  // Identical on the landing and on every section page: same back slot, same
  // action buttons, same eyebrow + title. Only the back target differs.
  const TopBar = ({ inSubpage }: { inSubpage: boolean }) => (
    <>
      <div className="flex items-start justify-between gap-3 mb-4">
        <BackButton
          onClick={() =>
            inSubpage ? setScreen("landing") : setActiveSubTab("courses-simplified")
          }
          className="self-start"
        />

        <div className="flex items-center gap-2">
          <IconButton onClick={() => void onSync()} title="Sync grades & curriculum">
            <RefreshCcw
              className={`w-4 h-4 ${isSyncing ? "animate-spin text-indigo-500" : ""}`}
            />
          </IconButton>
          <IconButton
            onClick={() => void downloadCurriculum()}
            title="Download curriculum PDF"
            disabled={isDownloadingCurriculum || !loginToVTOP}
          >
            {isDownloadingCurriculum ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </IconButton>
          <IconButton onClick={toggleCgpaBlur} title="Blur grades">
            {isCgpaBlurred ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </IconButton>
        </div>
      </div>

      <div className="px-1">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1">
          Academics
        </p>
        <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate">
          Degree Curriculum
        </h1>
      </div>
    </>
  );

  // ─ Landing ───────────────────────────────────────────────────────────
  const landing = (
    <>
      {/* Two cards: credits + rotating insight carousel */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 px-1">
        <button
          type="button"
          onClick={() => setScreen("overview")}
          className={`${TILE} h-32 sm:h-36 transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
              Credits
            </span>
            <span
              className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 border ${
                earnedPct >= 100
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/40"
              }`}
            >
              {Math.round(earnedPct)}%
            </span>
          </div>
          <div className="my-auto min-w-0">
            <span className="text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block text-zinc-900 dark:text-white truncate">
              {totalEarned.toFixed(1)}
            </span>
          </div>
          {/* Same footer geometry as the carousel card so both cards align */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
              of {totalRequired.toFixed(1)} credits
            </p>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          </div>
        </button>

        {slide && (
          <div
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
            onTouchStart={() => setIsCarouselPaused(true)}
            onTouchEnd={() => setIsCarouselPaused(false)}
            onClick={() => slide.onClick()}
            className={`${TILE} h-32 sm:h-36 transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
                {slide.title}
              </span>
              <span
                className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${slide.badgeClass}`}
              >
                {slide.badge}
              </span>
            </div>
            <AnimatePresence mode="wait">
              <m.div
                key={slide.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="my-auto min-w-0"
              >
                <span
                  className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight leading-tight truncate block ${
                    slide.tone || "text-zinc-900 dark:text-white"
                  } ${slide.id === "cgpa" && isCgpaBlurred ? "blur-[5px] select-none" : ""}`}
                >
                  {slide.headline}
                </span>
              </m.div>
            </AnimatePresence>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                {slide.subline}
              </p>
              {slides.length > 1 && (
                <div className="flex items-center gap-1 shrink-0">
                  {slides.map((s, idx) => (
                    <span
                      key={s.id}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        slideIndex === idx ? "w-3 bg-indigo-500" : "w-1.5 bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Single slim credits bar — same px-1 inset as the cards above */}
      <div className="space-y-1.5 px-1">
        {(() => {
          const earnedPctRaw = totalRequired > 0 ? (totalEarned / totalRequired) * 100 : 0;
          const earnedWidth = Math.max(0, Math.min(earnedPctRaw, 100));
          const ongoingWidth = Math.max(
            0,
            Math.min(totalRequired > 0 ? (totalOngoing / totalRequired) * 100 : 0, 100 - earnedWidth)
          );
          return (
            <>
              <div className="flex h-1.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <div className="bg-emerald-500 h-full" style={{ width: `${earnedWidth}%` }} />
                <div className="bg-amber-500 h-full" style={{ width: `${ongoingWidth}%` }} />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold text-zinc-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {totalEarned.toFixed(1)} earned
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  {totalOngoing.toFixed(1)} ongoing
                </span>
                <span className="font-mono">
                  {totalEarned.toFixed(1)} / {totalRequired.toFixed(1)} Cr
                </span>
              </div>
            </>
          );
        })()}
      </div>

      {/* The four views as one joined list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
              Sections
            </h2>
            <span className={SECTION_CHIP}>{VIEW_META.length}</span>
          </div>
        </div>
        <div className={LIST_SHELL}>
          {VIEW_META.map((v) => {
            const Icon = v.icon;
            const count =
              v.id === "overview"
                ? categoryRows.length
                : v.id === "catalog"
                ? totalCourses
                : v.id === "completed"
                ? effectiveGrades.length
                : remainingCredits.toFixed(0);
            const suffix = v.id === "planner" ? "cr left" : "";
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setScreen(v.id)}
                className={`${LIST_ROW} cursor-pointer`}
              >
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${v.iconClass}`}
                >
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                    {v.title}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                    {v.desc}
                  </p>
                </div>
                <span className={CHIP}>
                  {count} {suffix}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  // ─ Subpage content ───────────────────────────────────────────────────
  const subpage =
    screen === "overview"
      ? basketsList
      : screen === "catalog"
      ? catalogList
      : screen === "completed"
      ? completedList
      : plannerList;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 pb-28 md:pb-8 animate-in fade-in duration-300 text-left select-none">
      <TopBar inSubpage={screen !== "landing"} />

      {!hasAnyData ? (
        <div className="p-10 rounded-[32px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/60 dark:border-zinc-800/80 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
            <GraduationCap className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-black text-base text-zinc-900 dark:text-white font-outfit">
              No curriculum data yet
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto font-medium">
              Sync your grades from VTOP to see credit baskets, the course catalog and your
              degree planner.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onSync()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-colors cursor-pointer"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            Load grades &amp; curriculum
          </button>
        </div>
      ) : screen === "landing" ? (
        landing
      ) : (
        subpage
      )}

      {/* Inline footnote, OD-page style */}
      {screen === "landing" && hasAnyData && (
        <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
          Credit baskets, the catalog and your planner all read from the same VTOP sync —
          one download keeps every section current.
        </p>
      )}
    </div>
  );
}


