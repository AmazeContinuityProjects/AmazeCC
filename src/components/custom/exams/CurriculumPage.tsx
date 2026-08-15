"use client";

import React, { useState, useEffect, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { Card, CardContent } from "@amazecontinuityprojects/amazeui";
import {
  Search, X, RefreshCcw, ChevronDown, ChevronRight, BookOpen, Award,
  GraduationCap, Layers, Download, Loader2, Eye, EyeOff, Sparkles, Filter,
  CheckCircle2, Clock, AlertCircle, Calculator, Sliders, LayoutGrid, Check,
  BookMarked, ArrowUpRight, ShieldCheck, ListFilter
} from "lucide-react";
import { API_BASE } from "../Main";
import FetchButton from "../shared/FetchButton";
import SubpageLayout from "../shared/SubpageLayout";
import { storage } from "@/lib/storage";

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

const GRADE_POINTS: Record<string, number> = {
  S: 10, A: 9, B: 8, C: 7, D: 6, E: 5, F: 0, P: 0, N: 0
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
  lectureCredits?: number;
  tutorialCredits?: number;
  practicalCredits?: number;
  projectCredits?: number;
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

type TabView = "overview" | "catalog" | "completed" | "planner" | "all";

// ── main component ──────────────────────────────────────────────────
export default function CurriculumPage({
  allGradesData,
  gradesData,
  marksData,
  attendance,
  handleFetchGrades,
  setActiveSubTab,
  loginToVTOP
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
  const [expandedBaskets, setExpandedBaskets] = useState<Set<string>>(new Set());
  const [pageCsrf, setPageCsrf] = useState<string>("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "in_progress" | "remaining">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [activeView, setActiveView] = useState<TabView>("overview");
  const [creds, setCreds] = useState<Creds | null>(null);
  const [isDownloadingCurriculum, setIsDownloadingCurriculum] = useState(false);
  const [downloadingSyllabus, setDownloadingSyllabus] = useState<string | null>(null);

  // ─ CGPA Blur State ─
  const [isCgpaBlurred, setIsCgpaBlurred] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const savedSettings = localStorage.getItem("settings");
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (typeof parsed.CGPAHidden === "boolean") return parsed.CGPAHidden;
          if (typeof parsed.blurGrades === "boolean") return parsed.blurGrades;
        }
      } catch (e) {}
    }
    return false;
  });

  const toggleCgpaBlur = () => {
    setIsCgpaBlurred(prev => {
      const next = !prev;
      if (typeof window !== "undefined") {
        try {
          const savedSettings = localStorage.getItem("settings");
          const parsed = savedSettings ? JSON.parse(savedSettings) : {};
          localStorage.setItem("settings", JSON.stringify({ ...parsed, CGPAHidden: next }));
        } catch (e) {}
      }
      return next;
    });
  };

  // ─ Fetch Curriculum Data ─
  const fetchCurriculumData = (force = false) => {
    if (!force) {
      const cached = storage.curriculum.get() as any;
      if (cached) {
        try {
          setCurricDetails(cached.details || []);
          setCurricCategories(cached.categories || []);
          setCurricTotal(cached.totalCredits || 0);
          if (cached.pageCsrf) setPageCsrf(cached.pageCsrf);
          return;
        } catch (e) {}
      }
    }

    if (!loginToVTOP) return;
    loginToVTOP()
      .then(c => {
        setCreds(c);
        return fetch(`${API_BASE}/api/curriculum`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(c),
        });
      })
      .then(r => r.json())
      .then(result => {
        if (result.success !== false) {
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
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchCurriculumData();
  }, []);

  // ─ Syllabus & Curriculum PDF downloads ─
  const downloadSyllabus = async (courseCode: string) => {
    setDownloadingSyllabus(courseCode);
    try {
      let c = creds;
      if (!c) {
        if (!loginToVTOP) {
          setDownloadingSyllabus(null);
          return;
        }
        c = await loginToVTOP();
        setCreds(c);
      }
      const res = await fetch(`${API_BASE}/api/curriculum/syllabus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookies: c.cookies,
          authorizedID: c.authorizedID,
          csrf: pageCsrf || c.csrf,
          courseCode,
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(errBody.error || `Download failed (${res.status})`);
      }
      const ct = res.headers.get("content-type") || "";
      const filename = ct.includes("zip") ? `${courseCode}_syllabus.zip` : `${courseCode}_syllabus.pdf`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Syllabus download error:", err.message);
    } finally {
      setDownloadingSyllabus(null);
    }
  };

  const downloadCurriculum = async () => {
    setIsDownloadingCurriculum(true);
    try {
      let c = creds;
      if (!c) {
        if (!loginToVTOP) {
          setIsDownloadingCurriculum(false);
          return;
        }
        c = await loginToVTOP();
        setCreds(c);
      }
      const res = await fetch(`${API_BASE}/api/curriculum/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: c.cookies, authorizedID: c.authorizedID, csrf: pageCsrf || c.csrf }),
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
      console.error("Curriculum download error:", err.message);
    } finally {
      setIsDownloadingCurriculum(false);
    }
  };

  const toggleCategory = (code: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleBasket = (key: string) => {
    setExpandedBaskets(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ─ Data Extractors ─
  const findCurriculum = (): CurriculumItem[] => {
    const sources = [
      allGradesData?.curriculum, allGradesData?.cgpa?.curriculum, allGradesData?.grades?.curriculum, allGradesData?.data?.curriculum,
      gradesData?.curriculum, gradesData?.cgpa?.curriculum, gradesData?.grades?.curriculum, gradesData?.data?.curriculum,
      marksData?.curriculum, marksData?.cgpa?.curriculum, gradesData?.grades?.curriculum
    ];
    for (const src of sources) {
      if (Array.isArray(src) && src.length > 0) return src;
    }
    return [];
  };

  const findEffectiveGrades = (): EffectiveGradeItem[] => {
    const sources = [
      allGradesData?.effectiveGrades, allGradesData?.cgpa?.effectiveGrades, allGradesData?.grades?.effectiveGrades, allGradesData?.data?.effectiveGrades,
      gradesData?.effectiveGrades, gradesData?.cgpa?.effectiveGrades, gradesData?.grades?.effectiveGrades, gradesData?.data?.effectiveGrades,
      marksData?.effectiveGrades, marksData?.cgpa?.effectiveGrades, marksData?.grades?.effectiveGrades
    ];
    for (const src of sources) {
      if (Array.isArray(src) && src.length > 0) return src;
    }
    return [];
  };

  const curriculum: CurriculumItem[] = findCurriculum();
  let effectiveGrades: EffectiveGradeItem[] = findEffectiveGrades();
  effectiveGrades = effectiveGrades.filter(eg => !isNaN(parseFloat(eg.creditsEarned)));

  // ─ CGPA calculation & metrics ─
  const currentCgpa = useMemo(() => {
    return Number(marksData?.cgpa?.cgpa || gradesData?.cgpa?.cgpa || allGradesData?.cgpa?.cgpa || 0);
  }, [marksData, gradesData, allGradesData]);

  // ─ Totals ─
  const totalRow = curriculum.find(c => (c.basketTitle || "").toLowerCase().includes("total credits"));
  let totalRequired = totalRow ? parseFloat(totalRow.creditsRequired) : curricTotal || 160;
  let totalEarned = totalRow ? parseFloat(totalRow.creditsEarned) : 0;

  if (totalEarned === 0 && marksData?.cgpa?.creditsEarned) {
    totalEarned = parseFloat(marksData.cgpa.creditsEarned) + parseFloat(marksData.cgpa.nonGradedRequirement || "0");
    totalRequired = parseFloat(marksData.cgpa.creditsRequired) || curricTotal || 160;
  }
  if (totalEarned === 0 && effectiveGrades.length > 0) {
    totalEarned = effectiveGrades.reduce((acc, curr) => acc + (parseFloat(curr.creditsEarned) || 0), 0);
  }

  // ─ Category Splits ─
  const specialBaskets = ["Extra curricular activities", "HSM Elective", "Foreign Language"];
  const withoutTotal = curriculum.filter(c => !(c.basketTitle || "").toLowerCase().includes("total credits"));
  const mainCategories = withoutTotal.filter(c => !specialBaskets.some(b => (c.basketTitle || "").toLowerCase().includes(b.toLowerCase())));
  const subCategories = withoutTotal.filter(c => specialBaskets.some(b => (c.basketTitle || "").toLowerCase().includes(b.toLowerCase())));

  // ─ Ongoing Credits from Attendance ─
  const safeAttendance = Array.isArray(attendance) ? attendance : [];
  const ongoingCreditsByCategory = safeAttendance.reduce<Record<string, number>>((acc, item) => {
    let category = item.category || "Uncategorized";
    const credits = parseFloat(item.credits) || 0;
    if (category === "Foundation Core - Humanities, Social Sciences and Management (LANGUAGE Basket)") category = "Foreign Language";
    else if (category === "Foundation Core - Humanities, Social Sciences and Management (GENERAL Basket)") category = "HSM Elective";
    else if (category === "Foundation Core - Humanities, Social Sciences and Management (EXTRA CURRICULAR Basket)") category = "Extra curricular activities";
    acc[category] = (acc[category] || 0) + credits;
    const hssm = "Foundation Core - Humanities, Social Sciences and Management";
    const ngcr = "Non-graded Core Requirement";
    if (category === "Foreign Language" || category === "HSM Elective") acc[hssm] = (acc[hssm] || 0) + credits;
    if (category === "Extra curricular activities") acc[ngcr] = (acc[ngcr] || 0) + credits;
    return acc;
  }, {});

  const totalOngoing = Object.values(ongoingCreditsByCategory).reduce((s, v) => s + v, 0);

  // ─ Group Effective Grades by Distribution Type ─
  const groupedCourses = effectiveGrades.reduce<Record<string, EffectiveGradeItem[]>>((acc, eg) => {
    const key = normalizeDistributionType(eg.distributionType);
    if (!acc[key]) acc[key] = [];
    acc[key].push(eg);
    return acc;
  }, {});

  // Map from category title to enriched baskets
  const enrichedMap = useMemo(() => {
    const map = new Map<string, { categoryCode: string; categoryName: string; title: string; credits: number; items: BasketItem[] }[]>();
    for (const cat of curricDetails || []) {
      const key = cat.name;
      if (!map.has(key)) map.set(key, []);
      for (const b of cat.baskets) {
        map.get(key)!.push({ categoryCode: cat.code, categoryName: cat.name, ...b });
      }
    }
    return map;
  }, [curricDetails]);

  // Set of completed course codes for fast status check
  const completedCourseCodes = useMemo(() => {
    const set = new Set<string>();
    effectiveGrades.forEach(eg => {
      if (eg.courseCode) set.add(eg.courseCode.toUpperCase());
      const codeMatch = eg.basketTitle.match(/([A-Z]{3,4}\d{3,4})/);
      if (codeMatch) set.add(codeMatch[1].toUpperCase());
    });
    return set;
  }, [effectiveGrades]);

  // Set of in-progress course codes
  const ongoingCourseCodes = useMemo(() => {
    const set = new Set<string>();
    safeAttendance.forEach(a => {
      if (a.courseCode) set.add(a.courseCode.toUpperCase());
    });
    return set;
  }, [safeAttendance]);

  const earnedPct = Math.min((totalEarned / totalRequired) * 100, 100);
  const remainingCredits = Math.max(totalRequired - totalEarned - totalOngoing, 0);
  const expectedGraduation = remainingCredits <= 0 ? "Ready for Graduation" : `${Math.max(Math.ceil(remainingCredits / 24), 1)} Semesters`;

  const donutData = [
    { name: "Earned", value: totalEarned },
    { name: "In Progress", value: Math.min(totalOngoing, totalRequired - totalEarned) },
    { name: "Remaining", value: Math.max(totalRequired - totalEarned - totalOngoing, 0) },
  ];

  // ─ Empty state ─
  if (curriculum.length === 0 && effectiveGrades.length === 0 && (!curricDetails || curricDetails.length === 0)) {
    return (
      <div className="py-16 text-center animate-fadeIn">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-500 mb-4 shadow-sm">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100">No Curriculum Data Loaded</h3>
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 max-w-sm mx-auto mt-1 mb-6">
          Fetch your academic grades or connect to VTOP to view degree curriculum requirements.
        </p>
        <FetchButton onClick={handleFetchGrades} icon={<RefreshCcw className="w-4 h-4" />} className="px-6 py-2.5 rounded-xl font-bold">
          Load Grades & Curriculum
        </FetchButton>
      </div>
    );
  }

  return (
    <SubpageLayout
      title="Degree Curriculum"
      subtitle="Comprehensive view of credit baskets, syllabus downloads, and degree completion"
      onBack={() => setActiveSubTab("overview")}
      action={
        <div className="flex items-center gap-2">
          {/* CGPA Blur Toggle Button */}
          <button
            onClick={toggleCgpaBlur}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
              isCgpaBlurred
                ? "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-amber-500/20"
                : "bg-zinc-100 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-300 border-zinc-200/50 dark:border-zinc-800"
            }`}
            title={isCgpaBlurred ? "Unblur CGPA & grades" : "Blur CGPA & grades for privacy"}
          >
            {isCgpaBlurred ? <EyeOff className="w-4 h-4 text-amber-500" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">{isCgpaBlurred ? "CGPA Hidden" : "Hide CGPA"}</span>
          </button>

          {/* Download Curriculum PDF */}
          <button
            onClick={downloadCurriculum}
            disabled={isDownloadingCurriculum}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 transition-all ${
              isDownloadingCurriculum ? "opacity-50 cursor-not-allowed" : "hover:bg-emerald-100 dark:hover:bg-emerald-900/50 active:scale-[0.98]"
            }`}
            title="Download Full Curriculum Document"
          >
            {isDownloadingCurriculum ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span className="hidden md:inline">Curriculum PDF</span>
          </button>

          {/* Refresh button */}
          <FetchButton
            onClick={() => {
              handleFetchGrades();
              fetchCurriculumData(true);
            }}
            icon={<RefreshCcw className="w-4 h-4" />}
            className="rounded-xl px-3 py-2 text-xs font-bold"
          >
            <span className="hidden sm:inline">Sync</span>
          </FetchButton>
        </div>
      }
    >
      {/* ── Top Header Hero Banner & CGPA Privacy Indicator ── */}
      <Card className="overflow-hidden rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 bg-gradient-to-br from-white via-zinc-50/50 to-indigo-50/20 dark:from-zinc-900/70 dark:via-zinc-950/50 dark:to-indigo-950/20 shadow-2xs">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center">
            {/* Donut Chart */}
            <div className="relative mx-auto h-40 w-40 flex-shrink-0 lg:mx-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                    <Cell fill="#6366f1" />
                    <Cell fill="#facc15" />
                    <Cell fill="#e2e8f0" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">{earnedPct.toFixed(0)}%</span>
                <span className="text-[10px] uppercase tracking-widest text-indigo-500 font-black leading-none mt-0.5">Completed</span>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Degree Progress Audit
                  </span>
                  <h2 className="mt-0.5 font-outfit text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    Curriculum Credit Plan
                  </h2>
                </div>

                {/* CGPA Display Pill with Blur Option */}
                {currentCgpa > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-500/20 shadow-3xs">
                    <Award className="w-4 h-4 text-indigo-500" />
                    <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">CGPA:</span>
                    <span className={`text-sm font-black text-indigo-600 dark:text-indigo-400 transition-all duration-300 ${isCgpaBlurred ? "blur-[6px] select-none hover:blur-none" : ""}`}>
                      {currentCgpa.toFixed(2)}
                    </span>
                    <button onClick={toggleCgpaBlur} className="p-0.5 text-zinc-400 hover:text-indigo-500 transition-colors">
                      {isCgpaBlurred ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  ["Earned", totalEarned.toFixed(1), "text-indigo-500"],
                  ["In Progress", totalOngoing.toFixed(1), "text-amber-500"],
                  ["Remaining", remainingCredits.toFixed(1), "text-zinc-800 dark:text-zinc-200"],
                  ["Required", totalRequired.toFixed(1), "text-zinc-800 dark:text-zinc-200"],
                  ["Graduation", expectedGraduation, "text-emerald-500"],
                ].map(([label, val, valColor]) => (
                  <div key={label} className="rounded-2xl border border-zinc-200/50 bg-white/80 p-3 dark:border-zinc-800/60 dark:bg-zinc-950/40 shadow-3xs min-w-0">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-550 truncate">{label}</span>
                    <span className={`text-lg font-black leading-none ${valColor} truncate block`}>{val}</span>
                  </div>
                ))}
              </div>

              {/* Progress Bar */}
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 relative">
                {totalOngoing > 0 && (
                  <div className="absolute left-0 top-0 h-full bg-amber-400/60 transition-all duration-500" style={{ width: `${Math.min(((totalEarned + totalOngoing) / totalRequired) * 100, 100)}%` }} />
                )}
                <div className="absolute left-0 top-0 h-full rounded-full bg-indigo-500 transition-all duration-500" style={{ width: `${Math.min(earnedPct, 100)}%` }} />
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>Earned ({totalEarned.toFixed(1)})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>In Progress ({totalOngoing.toFixed(1)})</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700 inline-block"></span>Remaining ({remainingCredits.toFixed(1)})</span>
                </div>
                <span className="hidden sm:inline font-mono">{totalEarned.toFixed(1)} / {totalRequired.toFixed(1)} Cr</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── View Switcher Navigation Bar (Declutters Page into Clear Tabs) ── */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/60 dark:border-zinc-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-100/80 dark:bg-zinc-900/60 p-1.5 rounded-2xl border border-zinc-200/50 dark:border-zinc-800">
          {[
            { id: "overview", label: "Credit Baskets", icon: BookOpen, count: mainCategories.length || curricCategories.length },
            { id: "catalog", label: "Course Catalog & Syllabus", icon: Search, count: curricDetails?.flatMap(d => d.baskets.flatMap(b => b.items)).length || 0 },
            { id: "completed", label: "Completed Courses", icon: CheckCircle2, count: effectiveGrades.length },
            { id: "planner", label: "CGPA & Degree Planner", icon: Calculator },
            { id: "all", label: "Full View", icon: LayoutGrid },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as TabView)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                activeView === tab.id
                  ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-3xs"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-white/40 dark:hover:bg-zinc-850/40"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {typeof tab.count === "number" && tab.count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  activeView === tab.id
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400"
                    : "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB 1: OVERVIEW & CREDIT BASKETS ── */}
      {(activeView === "overview" || activeView === "all") && (
        <section className="mt-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" /> Credit Basket Requirements
                </h3>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                  Track your credit breakdown per basket type to stay on track for graduation
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mainCategories.map((c, idx) => {
                const earned = parseFloat(c.creditsEarned) || 0;
                const required = parseFloat(c.creditsRequired) || 1;
                const inProgress = ongoingCreditsByCategory[c.basketTitle] || 0;
                const enrichedBaskets = enrichedMap.get(c.basketTitle) || [];
                return (
                  <ProgressCard
                    key={idx}
                    title={c.basketTitle}
                    earned={earned}
                    inProgress={inProgress}
                    required={required}
                    enrichedBaskets={enrichedBaskets}
                    expandedBaskets={expandedBaskets}
                    onToggleBasket={toggleBasket}
                    downloadSyllabus={downloadSyllabus}
                    downloadingSyllabus={downloadingSyllabus}
                    completedCourseCodes={completedCourseCodes}
                    ongoingCourseCodes={ongoingCourseCodes}
                  />
                );
              })}

              {/* Fallback if mainCategories is empty but curricCategories exist */}
              {mainCategories.length === 0 && curricCategories.length > 0 && (
                curricCategories.map((cat, i) => {
                  const detail = curricDetails?.find(d => d.code === cat.code);
                  const baskets = detail?.baskets || [];
                  const pct = Math.min((cat.credits / Math.max(cat.maxCredits, 1)) * 100, 100);
                  const isDone = cat.credits >= cat.maxCredits;
                  return (
                    <Card key={i} className="bg-gradient-to-br from-white to-zinc-50/30 dark:from-zinc-900/60 dark:to-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800/80 rounded-3xl p-5 shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 uppercase border border-indigo-500/10">
                            {cat.code}
                          </span>
                          <h4 className="font-black text-zinc-800 dark:text-zinc-200 text-sm">{cat.name}</h4>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDone ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/30 dark:text-indigo-400"}`}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-bold text-zinc-400 dark:text-zinc-500 mb-2">
                        <span>{cat.credits} earned</span>
                        <span>{cat.maxCredits} required</span>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div className={`h-full rounded-full ${isDone ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
                      </div>
                      {baskets.length > 0 && (
                        <div className="mt-4 space-y-1 pt-3 border-t border-zinc-100 dark:border-zinc-850">
                          {baskets.map((b, bi) => (
                            <div key={bi} className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                              <span className="text-zinc-600 dark:text-zinc-300 font-medium truncate">{b.title}</span>
                              <span className="text-zinc-400 font-bold ml-2">{b.credits} cr</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Sub-baskets Section (Extra-curricular, HSM, Foreign Language) */}
          {subCategories.length > 0 && (
            <div className="pt-4">
              <h3 className="text-base font-black text-zinc-800 dark:text-zinc-100 mb-3.5 flex items-center gap-2">
                <Award className="w-4.5 h-4.5 text-violet-500" /> Elective & Additional Baskets
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {subCategories.map((c, idx) => {
                  const earned = parseFloat(c.creditsEarned) || 0;
                  const required = parseFloat(c.creditsRequired) || 1;
                  const inProgress = ongoingCreditsByCategory[c.basketTitle] || 0;
                  return (
                    <ProgressCard
                      key={idx}
                      title={c.basketTitle}
                      earned={earned}
                      inProgress={inProgress}
                      required={required}
                      compact
                    />
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── TAB 2: COURSE CATALOG & SYLLABUS SEARCH ── */}
      {(activeView === "catalog" || activeView === "all") && (
        <section className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <Search className="w-5 h-5 text-indigo-500" /> Course Catalog & Syllabus Finder
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                Search courses across all categories and download official course syllabi
              </p>
            </div>
          </div>

          {/* Search & Multi-Filter Control Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-white/70 dark:bg-zinc-950/40 p-3 rounded-2xl border border-zinc-200/50 dark:border-zinc-800/80 shadow-3xs">
            {/* Search Input */}
            <div className="relative sm:col-span-6">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search code (e.g. CSE1001), name, or basket..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-800 dark:text-zinc-150 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-800">
                  <X className="w-3.5 h-3.5 text-zinc-400" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-3">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed Courses</option>
                <option value="in_progress">In Progress</option>
                <option value="remaining">Remaining / Not Taken</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="sm:col-span-3">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800 text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
              >
                <option value="all">All Categories</option>
                {curricCategories.map(c => (
                  <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Catalog Accordion List */}
          {(() => {
            const allCourses = curricDetails?.flatMap(c =>
              c.baskets.flatMap(b =>
                b.items.map(item => {
                  const codeUpper = item.code.toUpperCase();
                  const isCompleted = completedCourseCodes.has(codeUpper);
                  const isOngoing = ongoingCourseCodes.has(codeUpper);
                  const status = isCompleted ? "completed" : isOngoing ? "in_progress" : "remaining";
                  return {
                    ...item,
                    categoryCode: c.code,
                    categoryName: c.name,
                    basketTitle: b.title,
                    status,
                  };
                })
              )
            ) || [];

            const q = searchQuery.toLowerCase().trim();

            const filteredCourses = allCourses.filter(item => {
              const matchesSearch = !q || (
                item.code.toLowerCase().includes(q) ||
                item.name.toLowerCase().includes(q) ||
                item.basketTitle.toLowerCase().includes(q) ||
                item.categoryName.toLowerCase().includes(q)
              );
              const matchesStatus = statusFilter === "all" || item.status === statusFilter;
              const matchesCategory = categoryFilter === "all" || item.categoryCode === categoryFilter;
              return matchesSearch && matchesStatus && matchesCategory;
            });

            if (filteredCourses.length === 0 && curricCategories.length > 0) {
              return (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-500 bg-white/40 dark:bg-zinc-950/20 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                  <Search className="w-10 h-10 mb-2 opacity-50" />
                  <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">No courses match your filter</p>
                  <p className="text-xs text-zinc-400 mt-1">Try clearing search query or changing status filters</p>
                  <button
                    onClick={() => { setSearchQuery(""); setStatusFilter("all"); setCategoryFilter("all"); }}
                    className="mt-4 px-4 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400 text-xs font-bold"
                  >
                    Reset Filters
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {curricCategories
                  .filter(cat => categoryFilter === "all" || cat.code === categoryFilter)
                  .map((cat, i) => {
                    const catCourses = filteredCourses.filter(c => c.categoryCode === cat.code);
                    if (catCourses.length === 0 && (q || statusFilter !== "all")) return null;

                    const isOpen = expandedCategories.has(cat.code) || Boolean(q || statusFilter !== "all");
                    const pct = cat.maxCredits > 0 ? Math.round((cat.credits / cat.maxCredits) * 100) : 0;

                    return (
                      <Card key={i} className="overflow-hidden rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/60">
                        <button
                          onClick={() => toggleCategory(cat.code)}
                          className="w-full text-left p-4 hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 uppercase border border-indigo-500/10 flex-shrink-0">
                              {cat.code}
                            </span>
                            <h4 className="font-black text-zinc-800 dark:text-zinc-100 text-sm truncate">{cat.name}</h4>
                            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-550 hidden sm:inline">
                              ({catCourses.length} course{catCourses.length !== 1 ? "s" : ""})
                            </span>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                              {cat.credits} / {cat.maxCredits} Cr
                            </span>
                            {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
                          </div>
                        </button>

                        {isOpen && (
                          <div className="border-t border-zinc-150 dark:border-zinc-800/60 divide-y divide-zinc-100 dark:divide-zinc-850">
                            {catCourses.map((item, ii) => (
                              <div key={ii} className="p-3.5 sm:px-5 flex items-center justify-between text-xs hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 transition-colors">
                                <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                                  <span className="font-mono text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50/70 dark:bg-indigo-950/30 px-2 py-0.5 rounded-md flex-shrink-0 border border-indigo-500/10">
                                    {item.code}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate">{item.name}</p>
                                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium truncate">{item.basketTitle}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {/* Status Pill */}
                                  {item.status === "completed" && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 flex items-center gap-1 border border-emerald-500/10">
                                      <Check className="w-3 h-3" /> Done
                                    </span>
                                  )}
                                  {item.status === "in_progress" && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400 flex items-center gap-1 border border-amber-500/10">
                                      <Clock className="w-3 h-3" /> Ongoing
                                    </span>
                                  )}

                                  {item.type && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 font-bold uppercase hidden sm:inline">
                                      {item.type}
                                    </span>
                                  )}

                                  <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 min-w-[32px] text-right">
                                    {item.credits} cr
                                  </span>

                                  {/* Syllabus Download Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadSyllabus(item.code);
                                    }}
                                    disabled={downloadingSyllabus === item.code}
                                    className={`p-1.5 rounded-lg border transition-colors ${
                                      downloadingSyllabus === item.code
                                        ? "bg-indigo-50 text-indigo-500 border-indigo-200 dark:bg-indigo-950/40 opacity-50 cursor-not-allowed"
                                        : "bg-zinc-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-zinc-850 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-400 text-zinc-500 border-zinc-200/50 dark:border-zinc-800"
                                    }`}
                                    title={`Download syllabus for ${item.code}`}
                                  >
                                    {downloadingSyllabus === item.code ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Download className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </Card>
                    );
                  })}
              </div>
            );
          })()}
        </section>
      )}

      {/* ── TAB 3: COMPLETED COURSES AUDIT ── */}
      {(activeView === "completed" || activeView === "all") && Object.keys(groupedCourses).length > 0 && (
        <section className="mt-6 space-y-4">
          <div>
            <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-emerald-500" /> Completed Courses & Grade Breakdown
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
              List of all courses completed with earned grades and credit breakdown
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {Object.entries(groupedCourses)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([type, courses]) => (
                <CourseAccordion
                  key={type}
                  type={type}
                  courses={courses}
                  isCgpaBlurred={isCgpaBlurred}
                />
              ))}
          </div>
        </section>
      )}

      {/* ── TAB 4: CGPA & DEGREE PLANNER ── */}
      {(activeView === "planner" || activeView === "all") && (
        <section className="mt-6 space-y-6">
          <div>
            <h3 className="text-lg font-black text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Calculator className="w-5 h-5 text-indigo-500" /> CGPA & Degree Requirement Simulator
            </h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
              Simulate required SGPA in remaining semesters to achieve your target graduation CGPA
            </p>
          </div>

          <DegreeCgpaPlannerCard
            currentCgpa={currentCgpa}
            totalEarned={totalEarned}
            totalRequired={totalRequired}
            remainingCredits={remainingCredits}
            isCgpaBlurred={isCgpaBlurred}
            toggleCgpaBlur={toggleCgpaBlur}
            setActiveSubTab={setActiveSubTab}
          />
        </section>
      )}
    </SubpageLayout>
  );
}

// ── ProgressCard Component ──────────────────────────────────────────
function ProgressCard({
  title,
  earned,
  inProgress,
  required,
  compact = false,
  enrichedBaskets,
  expandedBaskets,
  onToggleBasket,
  downloadSyllabus,
  downloadingSyllabus,
  completedCourseCodes,
  ongoingCourseCodes,
}: {
  title: string;
  earned: number;
  inProgress: number;
  required: number;
  compact?: boolean;
  enrichedBaskets?: { title: string; credits: number; items: BasketItem[] }[];
  expandedBaskets?: Set<string>;
  onToggleBasket?: (key: string) => void;
  downloadSyllabus?: (code: string) => void;
  downloadingSyllabus?: string | null;
  completedCourseCodes?: Set<string>;
  ongoingCourseCodes?: Set<string>;
}) {
  const isComplete = earned >= required;
  const effectiveTotal = isComplete ? earned : earned + inProgress;
  const progressEarned = Math.min((earned / required) * 100, 100);
  const progressWithOngoing = Math.min((effectiveTotal / required) * 100, 100);
  const hasDetail = enrichedBaskets && enrichedBaskets.length > 0;
  const allItems = enrichedBaskets?.flatMap(b => b.items) || [];
  const totalDetailCredits = allItems.reduce((s, i) => s + i.credits, 0);

  return (
    <Card className="bg-gradient-to-br from-white to-zinc-50/40 dark:from-zinc-900/60 dark:to-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800/80 rounded-3xl shadow-2xs hover:shadow-xs transition-all duration-300 hover:border-indigo-500/20">
      <CardContent className={compact ? "p-4" : "p-5"}>
        <div className="flex justify-between items-start mb-3">
          <div className="min-w-0 flex-1 pr-2">
            <h4 className={`${compact ? "text-xs" : "text-sm"} font-black text-zinc-800 dark:text-zinc-100 leading-tight truncate`}>
              {title}
            </h4>
            {hasDetail && (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold mt-0.5">
                {allItems.length} courses · {totalDetailCredits.toFixed(1)} cr
              </p>
            )}
          </div>
          <span
            className={`flex-shrink-0 text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
              isComplete
                ? "bg-emerald-50 text-emerald-700 border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-400"
                : "bg-indigo-50 text-indigo-600 border-indigo-500/20 dark:bg-indigo-950/30 dark:text-indigo-400"
            }`}
          >
            {progressEarned.toFixed(0)}%
          </span>
        </div>

        <div className="relative h-2.5 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {!isComplete && inProgress > 0 && (
            <div className="absolute left-0 top-0 h-full bg-amber-400/60 transition-all duration-500" style={{ width: `${progressWithOngoing}%` }} />
          )}
          <div
            className={`absolute left-0 top-0 h-full transition-all duration-500 ${isComplete ? "bg-emerald-500" : "bg-indigo-500"}`}
            style={{ width: `${progressEarned}%` }}
          />
        </div>

        <div className="flex justify-between items-center mt-2.5 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
          <span>
            <strong className="text-zinc-700 dark:text-zinc-200">{earned.toFixed(1)}</strong> earned
          </span>
          {inProgress > 0 && (
            <span>
              <strong className="text-amber-500">{inProgress.toFixed(1)}</strong> ongoing
            </span>
          )}
          <span>
            <strong className="text-zinc-700 dark:text-zinc-200">{required.toFixed(1)}</strong> req.
          </span>
        </div>

        {/* Expandable detail baskets */}
        {hasDetail && enrichedBaskets!.length > 0 && (
          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-850 space-y-1.5">
            {enrichedBaskets!.map((b, bi) => {
              const key = `${title}-${bi}`;
              const isOpen = expandedBaskets?.has(key);
              return (
                <div key={bi} className="rounded-xl border border-zinc-200/40 dark:border-zinc-800/40 overflow-hidden">
                  <button
                    onClick={() => onToggleBasket?.(key)}
                    className="w-full text-left text-xs px-3 py-2 bg-zinc-50/60 dark:bg-zinc-900/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-850/60 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 min-w-0 pr-2">
                      {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />}
                      <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate">{b.title}</span>
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 flex-shrink-0">{b.credits} cr</span>
                  </button>

                  {isOpen && (
                    <div className="p-2 space-y-1 bg-white/60 dark:bg-zinc-950/40 divide-y divide-zinc-100 dark:divide-zinc-850">
                      {b.items.map((item, ii) => {
                        const codeUpper = item.code.toUpperCase();
                        const isDone = completedCourseCodes?.has(codeUpper);
                        const isOng = ongoingCourseCodes?.has(codeUpper);
                        return (
                          <div key={ii} className="flex items-center justify-between text-xs py-1.5 px-2 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-lg gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-extrabold flex-shrink-0">{item.code}</span>
                              <span className="text-zinc-600 dark:text-zinc-300 truncate font-medium">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isDone ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20">Completed</span>
                              ) : isOng ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-500/20">In Progress</span>
                              ) : (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200/50">Remaining</span>
                              )}
                              <span className="text-[10px] font-bold text-zinc-400">{item.credits} cr</span>
                              {downloadSyllabus && (
                                <button
                                  onClick={() => downloadSyllabus(item.code)}
                                  disabled={downloadingSyllabus === item.code}
                                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-indigo-500 cursor-pointer"
                                  title={`Download syllabus for ${item.code}`}
                                >
                                  {downloadingSyllabus === item.code ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── CourseAccordion Component ────────────────────────────────────────
function CourseAccordion({
  type,
  courses,
  isCgpaBlurred,
}: {
  type: string;
  courses: EffectiveGradeItem[];
  isCgpaBlurred: boolean;
}) {
  const [open, setOpen] = useState(false);
  const totalCredits = courses.reduce((s, c) => s + (parseFloat(c.creditsEarned) || 0), 0);

  return (
    <Card className="bg-gradient-to-br from-white to-zinc-50/40 dark:from-zinc-900/60 dark:to-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800/80 rounded-2xl shadow-2xs overflow-hidden transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">{type}</span>
          <span className="text-[10px] px-2.5 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400 font-bold border border-zinc-200/10">
            {courses.length} {courses.length === 1 ? "course" : "courses"} · {totalCredits.toFixed(1)} cr.
          </span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-zinc-400" /> : <ChevronRight className="w-4 h-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="border-t border-zinc-150 dark:border-zinc-850 bg-white/40 dark:bg-zinc-950/20 divide-y divide-zinc-100 dark:divide-zinc-850">
          {courses.map((course, idx) => (
            <div key={idx} className="flex items-center justify-between p-3.5 px-5">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate">{course.basketTitle}</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 font-semibold">{course.creditsEarned} credits earned</p>
              </div>
              <div
                className={`flex-shrink-0 px-3 py-1 rounded-xl text-xs font-black border ${
                  GRADE_COLORS[course.grade] || "text-zinc-500 border-zinc-200 bg-zinc-100"
                } ${isCgpaBlurred ? "blur-[5px] select-none hover:blur-none" : ""}`}
              >
                Grade {course.grade}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── Degree & CGPA Planner Card ──────────────────────────────────────
function DegreeCgpaPlannerCard({
  currentCgpa,
  totalEarned,
  totalRequired,
  remainingCredits,
  isCgpaBlurred,
  toggleCgpaBlur,
  setActiveSubTab,
}: {
  currentCgpa: number;
  totalEarned: number;
  totalRequired: number;
  remainingCredits: number;
  isCgpaBlurred: boolean;
  toggleCgpaBlur: () => void;
  setActiveSubTab: (tab: string) => void;
}) {
  const [targetCgpa, setTargetCgpa] = useState<number>(8.5);
  const currentTotalPoints = currentCgpa * totalEarned;

  const requiredAverageGrade = useMemo(() => {
    if (remainingCredits <= 0) return 0;
    const totalDesiredPoints = targetCgpa * totalRequired;
    const pointsNeeded = totalDesiredPoints - currentTotalPoints;
    const reqSgpa = pointsNeeded / remainingCredits;
    return Math.max(0, reqSgpa);
  }, [currentCgpa, totalEarned, totalRequired, remainingCredits, targetCgpa, currentTotalPoints]);

  const isAchievable = requiredAverageGrade <= 10.0;

  return (
    <Card className="rounded-3xl border border-zinc-200/60 dark:border-zinc-800/80 bg-gradient-to-br from-white via-zinc-50/40 to-indigo-50/20 dark:from-zinc-900/70 dark:via-zinc-950/60 dark:to-indigo-950/20 p-6 shadow-2xs">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Interactive Target CGPA Calculator
            </span>
            <button
              onClick={toggleCgpaBlur}
              className="text-xs font-bold text-zinc-400 hover:text-indigo-500 flex items-center gap-1 transition-colors"
            >
              {isCgpaBlurred ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{isCgpaBlurred ? "Unblur" : "Blur"}</span>
            </button>
          </div>

          <h3 className="text-xl font-black text-zinc-900 dark:text-zinc-100">
            What average grade do you need in your remaining {remainingCredits.toFixed(1)} credits?
          </h3>

          <div className="space-y-3 bg-white/80 dark:bg-zinc-950/40 p-4 rounded-2xl border border-zinc-200/50 dark:border-zinc-800">
            <div className="flex justify-between items-center">
              <label className="text-xs font-black text-zinc-700 dark:text-zinc-300">Target Graduation CGPA:</label>
              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{targetCgpa.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="5.0"
              max="10.0"
              step="0.05"
              value={targetCgpa}
              onChange={e => setTargetCgpa(parseFloat(e.target.value))}
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

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl bg-white/70 dark:bg-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800">
              <p className="text-[9px] font-black uppercase text-zinc-400">Current CGPA</p>
              <p className={`text-base font-black text-zinc-800 dark:text-zinc-200 mt-0.5 ${isCgpaBlurred ? "blur-[5px] select-none" : ""}`}>
                {currentCgpa > 0 ? currentCgpa.toFixed(2) : "N/A"}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-white/70 dark:bg-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800">
              <p className="text-[9px] font-black uppercase text-zinc-400">Credits Completed</p>
              <p className="text-base font-black text-indigo-500 mt-0.5">{totalEarned.toFixed(1)}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/70 dark:bg-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800 col-span-2 sm:col-span-1">
              <p className="text-[9px] font-black uppercase text-zinc-400">Remaining Credits</p>
              <p className="text-base font-black text-amber-500 mt-0.5">{remainingCredits.toFixed(1)}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 flex flex-col justify-center p-5 rounded-3xl bg-indigo-600 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-indigo-200">Required Remaining Average</p>
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-black ${isCgpaBlurred ? "blur-[6px] select-none" : ""}`}>
                {requiredAverageGrade.toFixed(2)}
              </span>
              <span className="text-xs text-indigo-200 font-bold">SGPA / 10.0</span>
            </div>

            <p className="text-xs font-semibold text-indigo-100 leading-relaxed pt-2">
              {isAchievable ? (
                <>To achieve a <strong>{targetCgpa.toFixed(2)} CGPA</strong>, you must maintain an average grade of <strong>{requiredAverageGrade.toFixed(2)}</strong> across remaining courses.</>
              ) : (
                <>Targeting a <strong>{targetCgpa.toFixed(2)} CGPA</strong> requires more than 10.0 SGPA in remaining credits. Try adjusting your target.</>
              )}
            </p>

            <button
              onClick={() => setActiveSubTab("predictor")}
              className="mt-4 w-full py-2.5 px-4 rounded-2xl bg-white text-indigo-600 font-black text-xs hover:bg-indigo-50 transition-colors shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Detailed CGPA Predictor</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
