"use client";

import React, { useState, useEffect } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@amazecontinuityprojects/amazeui";
import { Search, X, RefreshCcw, ChevronDown, ChevronRight, BookOpen, Award, GraduationCap, Layers, Download, Loader2 } from "lucide-react";
import { API_BASE } from "../Main";
import FetchButton from "../shared/FetchButton";
import SubpageLayout from "../shared/SubpageLayout";
import { storage } from "@/lib/storage";

// ── helpers ──────────────────────────────────────────────────────────
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
  S: "text-amber-500", A: "text-emerald-500", B: "text-blue-500",
  C: "text-cyan-500", D: "text-orange-500", E: "text-red-400",
  F: "text-red-600", P: "text-violet-500", N: "text-gray-400",
};

const GRADE_BG: Record<string, string> = {
  S: "bg-amber-500/10", A: "bg-emerald-500/10", B: "bg-blue-500/10",
  C: "bg-cyan-500/10", D: "bg-orange-500/10", E: "bg-red-400/10",
  F: "bg-red-600/10", P: "bg-violet-500/10", N: "bg-gray-400/10",
};

const cardBase = "solid-card";

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

// ── main component ──────────────────────────────────────────────────
export default function CurriculumPage({ allGradesData, gradesData, marksData, attendance, handleFetchGrades, setActiveSubTab, loginToVTOP }: {
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
  const [creds, setCreds] = useState<Creds | null>(null);
  const [isDownloadingCurriculum, setIsDownloadingCurriculum] = useState(false);
  const [downloadingSyllabus, setDownloadingSyllabus] = useState<string | null>(null);

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
        } catch(e) {}
      }
    }
    
    if (!loginToVTOP) return;
    loginToVTOP().then(c => {
      setCreds(c);
      return fetch(`${API_BASE}/api/curriculum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
    }).then(r => r.json()).then(result => {
      if (result.success !== false) {
        setCurricDetails(result.details || []);
        setCurricCategories(result.categories || []);
        setCurricTotal(result.totalCredits || 0);
        if (result.pageCsrf) setPageCsrf(result.pageCsrf);
        storage.curriculum.set({
            details: result.details,
            categories: result.categories,
            totalCredits: result.totalCredits,
            pageCsrf: result.pageCsrf
        });
      }
    }).catch(() => {});
  };

  useEffect(() => {
    fetchCurriculumData();
  }, []);

  const downloadSyllabus = async (courseCode: string) => {
    setDownloadingSyllabus(courseCode);
    if (!creds) {
      if (!loginToVTOP) {
        setDownloadingSyllabus(null);
        return;
      }
      try { const c = await loginToVTOP(); setCreds(c); } catch { 
        setDownloadingSyllabus(null);
        return;
      }
    }
    const c = creds || await loginToVTOP!();
    try {
      const res = await fetch(`${API_BASE}/api/curriculum/syllabus`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: c.cookies, authorizedID: c.authorizedID, csrf: pageCsrf || c.csrf, courseCode }),
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
    if (!creds) {
      if (!loginToVTOP) {
        setIsDownloadingCurriculum(false);
        return;
      }
      try { const c = await loginToVTOP(); setCreds(c); } catch { 
        setIsDownloadingCurriculum(false);
        return; 
      }
    }
    const c = creds || await loginToVTOP!();
    try {
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

  const findCurriculum = () => {
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

  const findEffectiveGrades = () => {
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

  let curriculum: CurriculumItem[] = findCurriculum();
  let effectiveGrades: EffectiveGradeItem[] = findEffectiveGrades();
  effectiveGrades = effectiveGrades.filter(eg => !isNaN(parseFloat(eg.creditsEarned)));

  // ─ totals ─
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

  // ─ category splits ─
  const specialBaskets = ["Extra curricular activities", "HSM Elective", "Foreign Language"];
  const withoutTotal = curriculum.filter(c => !(c.basketTitle || "").toLowerCase().includes("total credits"));
  const mainCategories = withoutTotal.filter(c => !specialBaskets.some(b => (c.basketTitle || "").toLowerCase().includes(b.toLowerCase())));
  const subCategories = withoutTotal.filter(c => specialBaskets.some(b => (c.basketTitle || "").toLowerCase().includes(b.toLowerCase())));

  // ─ in-progress credits from current attendance ─
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

  // ─ group effective grades by distribution type ─
  const groupedCourses = effectiveGrades.reduce<Record<string, EffectiveGradeItem[]>>((acc, eg) => {
    const key = normalizeDistributionType(eg.distributionType);
    if (!acc[key]) acc[key] = [];
    acc[key].push(eg);
    return acc;
  }, {});

  // ─ enriched basket details for display ─
  const allBaskets = curricDetails?.flatMap(d =>
    d.baskets.map(b => ({ categoryCode: d.code, categoryName: d.name, ...b }))
  ) || [];

  const hasEnriched = allBaskets.length > 0;

  // ─ empty state ─
  if (curriculum.length === 0 && effectiveGrades.length === 0 && !hasEnriched) {
    return (
      <div className="py-12 text-center">
        <GraduationCap className="w-12 h-12 mx-auto text-gray-400 mb-4" />
        <p className="text-gray-600  dark:text-gray-400 mb-4">No curriculum data available.</p>
        <FetchButton onClick={handleFetchGrades} icon={<RefreshCcw className="w-4 h-4" />} className="px-5 py-2.5 rounded-xl">
          Load Grades Data
        </FetchButton>
      </div>
    );
  }

  const earnedPct = Math.min((totalEarned / totalRequired) * 100, 100);
  const remainingCredits = Math.max(totalRequired - totalEarned - totalOngoing, 0);
  const expectedGraduation = remainingCredits <= 0 ? "Ready" : `${Math.max(Math.ceil(remainingCredits / 24), 1)} sem`;
  const donutData = [
    { name: "Earned", value: totalEarned },
    { name: "In Progress", value: Math.min(totalOngoing, totalRequired - totalEarned) },
    { name: "Remaining", value: Math.max(totalRequired - totalEarned - totalOngoing, 0) },
  ];

  // Build a map from basketTitle (from grades) to enriched baskets
  const enrichedMap = new Map<string, { categoryCode: string; categoryName: string; title: string; credits: number; items: BasketItem[] }[]>();
  for (const cat of (curricDetails || [])) {
    const key = cat.name;
    if (!enrichedMap.has(key)) enrichedMap.set(key, []);
    for (const b of cat.baskets) {
      enrichedMap.get(key)!.push({ categoryCode: cat.code, categoryName: cat.name, ...b });
    }
  }

  return (
    <SubpageLayout
      title="Curriculum Overview"
      subtitle="Track your degree progress across all credit baskets"
      onBack={() => setActiveSubTab("overview")}
      action={
        <div className="flex items-center gap-2">
          <button onClick={downloadCurriculum} disabled={isDownloadingCurriculum} className={`p-2.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors ${isDownloadingCurriculum ? "opacity-50 cursor-not-allowed" : "hover:bg-green-100 dark:hover:bg-green-900/50"}`} title="Download Curriculum">
            {isDownloadingCurriculum ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          </button>
          <FetchButton onClick={() => { handleFetchGrades(); fetchCurriculumData(true); }} icon={<RefreshCcw className="w-4 h-4" />} className="rounded-xl">
            <span className="text-sm">Reload</span>
          </FetchButton>
        </div>
      }
    >
      {/* ── Total Credits Summary ── */}
      <Card className="overflow-hidden rounded-3xl border border-zinc-200/50 dark:border-zinc-800/80 bg-gradient-to-br from-white to-zinc-55/20 dark:bg-gradient-to-br dark:from-zinc-900/60 dark:to-zinc-950/40 shadow-2xs">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:items-center">
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
                <span className="text-2xl font-black text-zinc-800 dark:text-zinc-150">{earnedPct.toFixed(0)}%</span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-550 font-black leading-none mt-0.5">Complete</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="mb-5">
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Degree Progress</p>
                <h2 className="mt-1 font-outfit text-2xl font-black text-zinc-850 dark:text-zinc-100">Credit plan overview</h2>
                <p className="mt-1 text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-normal">Earned, ongoing and remaining credits across curriculum baskets.</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {[
                  ["Earned", totalEarned.toFixed(1), "text-indigo-500"],
                  ["In Progress", totalOngoing.toFixed(1), "text-yellow-600 dark:text-yellow-400"],
                  ["Remaining", remainingCredits.toFixed(1), "text-zinc-850 dark:text-zinc-255"],
                  ["Required", totalRequired.toFixed(1), "text-zinc-850 dark:text-zinc-255"],
                  ["Graduation", expectedGraduation, "text-emerald-500"],
                ].map(([label, val, valColor]) => (
                  <div key={label} className="rounded-2xl border border-zinc-200/50 bg-white/70 p-3.5 dark:border-zinc-800/60 dark:bg-zinc-950/30 shadow-3xs min-w-0">
                    <span className="mb-1 block text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-550 truncate">{label}</span>
                    <span className={`text-xl font-black leading-none ${valColor}`}>{val}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(earnedPct, 100)}%` }} />
              </div>
              <div className="mt-3.5 flex items-center gap-4 text-[10px] font-bold text-zinc-400 dark:text-zinc-550">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>Earned</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 inline-block"></span>In Progress</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-650 inline-block"></span>Remaining</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Category Progress Cards ── */}
      <div className="mt-8">
        <h2 className="text-base font-black text-zinc-800 dark:text-zinc-100 mb-3.5 flex items-center gap-2">
          <BookOpen className="w-4.5 h-4.5 text-indigo-500" /> Credit Baskets
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mainCategories.map((c, idx) => {
            const earned = parseFloat(c.creditsEarned) || 0;
            const required = parseFloat(c.creditsRequired) || 1;
            const inProgress = ongoingCreditsByCategory[c.basketTitle] || 0;
            const enrichedBaskets = enrichedMap.get(c.basketTitle) || [];
            return (
              <ProgressCard key={idx} title={c.basketTitle} earned={earned} inProgress={inProgress} required={required}
                enrichedBaskets={enrichedBaskets} expandedBaskets={expandedBaskets} onToggleBasket={toggleBasket}
              />
            );
          })}

          {hasEnriched && mainCategories.length === 0 && (
            curricCategories.map((cat, i) => {
              const detail = curricDetails?.find(d => d.code === cat.code);
              const baskets = detail?.baskets || [];
              return (
                <div key={i} className="bg-white  dark:bg-black border border-gray-200  dark:border-gray-800 rounded-2xl shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold px-2 py-1 rounded-md bg-blue-100  dark:bg-blue-900/30 text-blue-700  dark:text-blue-400 uppercase">{cat.code}</span>
                    <h4 className="font-semibold text-gray-800  dark:text-gray-200 text-sm">{cat.name}</h4>
                  </div>
                  <div className="text-sm text-gray-500  dark:text-gray-400">{cat.credits} / {cat.maxCredits} credits</div>
                  <div className="mt-2 h-2 rounded-full bg-gray-100  dark:bg-gray-800 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all" style={{ width: `${Math.min((cat.credits / Math.max(cat.maxCredits, 1)) * 100, 100)}%` }} />
                  </div>
                  {baskets.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {baskets.map((b, bi) => (
                        <button key={bi} onClick={() => toggleBasket(`${cat.code}-${bi}`)}
                          className="w-full text-left text-xs px-3 py-1.5 rounded-lg bg-gray-50  dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
                        >
                          <span className="text-gray-600  dark:text-gray-400 truncate">{b.title}</span>
                          <span className="text-gray-400  dark:text-gray-500 flex-shrink-0 ml-2">{b.credits} cr</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Course Details by Category (styled accordion) ── */}
      {curricCategories.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900  dark:text-white mb-3 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-500" /> Course Details by Category
          </h2>

          {/* ── Search Bar ── */}
          <div className="relative mb-4.5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by course code, name, basket or category..."
              className="w-full pl-11 pr-10 py-3 rounded-2xl bg-white/60 dark:bg-zinc-950 border border-zinc-200/50 dark:border-zinc-850 text-sm text-zinc-800 dark:text-zinc-150 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-3xs focus:border-indigo-500 transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors">
                <X className="w-3.5 h-3.5 text-zinc-400" />
              </button>
            )}
          </div>

          {(() => {
            const allCourses = curricDetails?.flatMap(c =>
              c.baskets.flatMap(b =>
                b.items.map(item => ({
                  ...item,
                  categoryCode: c.code,
                  categoryName: c.name,
                  basketTitle: b.title,
                }))
              )
            ) || [];
            const q = searchQuery.toLowerCase().trim();
            const matchedCodes = q ? new Set(allCourses.filter(item =>
              item.code.toLowerCase().includes(q) ||
              item.name.toLowerCase().includes(q) ||
              item.basketTitle.toLowerCase().includes(q) ||
              item.categoryName.toLowerCase().includes(q) ||
              item.categoryCode.toLowerCase().includes(q)
            ).map(i => i.categoryCode)) : null;
            const filteredCategories = q
              ? curricCategories.filter(c => matchedCodes!.has(c.code))
              : curricCategories;
            if (q && filteredCategories.length === 0) {
              return (
                <div className="flex flex-col items-center py-12 text-gray-400  dark:text-gray-500">
                  <Search className="w-10 h-10 mb-3" />
                  <p className="text-sm font-medium">No courses match "{q}"</p>
                </div>
              );
            }
            return (
              <div className="space-y-3">
                {filteredCategories.map((cat, i) => {
                  const pct = cat.maxCredits > 0 ? Math.round((cat.credits / cat.maxCredits) * 100) : 0;
                  const isOpen = expandedCategories.has(cat.code) || (q && matchedCodes?.has(cat.code));
                  const detail = curricDetails?.find(d => d.code === cat.code);
                  const baskets = q
                    ? (detail?.baskets || []).map(b => ({
                        ...b,
                        items: b.items.filter(item =>
                          item.code.toLowerCase().includes(q) ||
                          item.name.toLowerCase().includes(q) ||
                          b.title.toLowerCase().includes(q)
                        ),
                      })).filter(b => b.items.length > 0)
                    : (detail?.baskets || []);
                  return (
                    <div key={i} className={cardBase}>
                      <button
                        onClick={() => toggleCategory(cat.code)}
                        className="w-full text-left p-5 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold px-2 py-1 rounded-md bg-blue-100  dark:bg-blue-900/30 text-blue-700  dark:text-blue-400 uppercase flex-shrink-0">{cat.code}</span>
                            <h4 className="font-semibold text-gray-900  dark:text-gray-100 text-sm truncate">{cat.name}</h4>
                            {baskets.length > 0 && (
                              <span className="text-xs text-gray-400  dark:text-gray-500 flex-shrink-0">
                                {baskets.length} basket{baskets.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm font-bold text-gray-800  dark:text-gray-200">{cat.credits} / {cat.maxCredits}</span>
                            {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                          </div>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-gray-100  dark:bg-gray-800 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </button>

                      {isOpen && baskets.length > 0 && (
                        <div className="border-t border-gray-200/50  dark:border-white/10">
                          {baskets.map((basket, bi) => (
                            <div key={bi} className="border-b border-gray-100/50  dark:border-white/5 last:border-b-0">
                              <div className="px-5 py-3 bg-gray-50/50  dark:bg-white/[0.02]">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-gray-400" />
                                  <span className="text-sm font-medium text-gray-700  dark:text-gray-300">{basket.title}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200/50  dark:bg-gray-800 text-gray-500  dark:text-gray-400">
                                    {basket.credits} cr
                                  </span>
                                </div>
                              </div>
                              {basket.items.length > 0 && (
                                <div className="divide-y divide-gray-100/50  dark:divide-white/5">
                                  {basket.items.map((item, ii) => (
                                    <div key={ii} className="px-5 py-2.5 flex items-center justify-between text-sm">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-xs font-mono text-gray-500  dark:text-gray-400 flex-shrink-0">{item.code}</span>
                                        <span className="text-gray-800  dark:text-gray-200 truncate">{item.name}</span>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <button onClick={(e) => { e.stopPropagation(); downloadSyllabus(item.code); }} disabled={downloadingSyllabus === item.code} className={`p-1 rounded transition-colors ${downloadingSyllabus === item.code ? "text-blue-500 opacity-50 cursor-not-allowed" : "hover:bg-gray-100 dark:hover:bg-slate-700 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500"}`} title="Download syllabus">
                                          {downloadingSyllabus === item.code ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                        </button>
                                        {item.type && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50  dark:bg-purple-900/20 text-purple-600  dark:text-purple-400 font-medium uppercase">{item.type}</span>
                                        )}
                                        <span className="text-xs font-medium text-gray-500  dark:text-gray-400">{item.credits} cr</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {isOpen && baskets.length === 0 && (
                        <div className="border-t border-gray-200/50  dark:border-white/10 px-5 py-4 text-sm text-gray-400  dark:text-gray-500 text-center">
                          No course details available for this category
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Sub-basket Section ── */}
      {subCategories.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900  dark:text-white mb-3 flex items-center gap-2">
            <Award className="w-5 h-5 text-violet-500" /> Basket Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {subCategories.map((c, idx) => {
              const earned = parseFloat(c.creditsEarned) || 0;
              const required = parseFloat(c.creditsRequired) || 1;
              const inProgress = ongoingCreditsByCategory[c.basketTitle] || 0;
              return (
                <ProgressCard key={idx} title={c.basketTitle} earned={earned} inProgress={inProgress} required={required} compact />
              );
            })}
          </div>
        </div>
      )}

      {/* ── Course Breakdown ── */}
      {Object.keys(groupedCourses).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-gray-900  dark:text-white mb-3 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-500" /> Courses Completed
          </h2>
          <div className="space-y-2">
            {Object.entries(groupedCourses).sort(([a], [b]) => a.localeCompare(b)).map(([type, courses]) => (
              <CourseAccordion key={type} type={type} courses={courses} />
            ))}
          </div>
        </div>
      )}
    </SubpageLayout>
  );
}

// ── ProgressCard component ──────────────────────────────────────────
function ProgressCard({ title, earned, inProgress, required, compact = false, enrichedBaskets, expandedBaskets, onToggleBasket }: {
  title: string;
  earned: number;
  inProgress: number;
  required: number;
  compact?: boolean;
  enrichedBaskets?: { title: string; credits: number; items: BasketItem[] }[];
  expandedBaskets?: Set<string>;
  onToggleBasket?: (key: string) => void;
}) {
  const isComplete = earned >= required;
  const effectiveTotal = isComplete ? earned : earned + inProgress;
  const progressEarned = Math.min((earned / required) * 100, 100);
  const progressWithOngoing = Math.min((effectiveTotal / required) * 100, 100);
  const hasDetail = enrichedBaskets && enrichedBaskets.length > 0;
  const allItems = enrichedBaskets?.flatMap(b => b.items) || [];
  const totalDetailCredits = allItems.reduce((s, i) => s + i.credits, 0);

  return (
    <Card className="bg-gradient-to-br from-white to-zinc-55/20 dark:from-zinc-900/60 dark:to-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800/80 rounded-3xl shadow-2xs hover:shadow-xs transition-all duration-300 hover:border-indigo-500/20 dark:hover:border-indigo-500/30">
      <CardContent className={compact ? "p-4" : "p-5"}>
        <div className="flex justify-between items-start mb-3">
          <div className="min-w-0 flex-1">
            <h3 className={`${compact ? "text-xs" : "text-sm"} font-black text-zinc-800 dark:text-zinc-200 leading-tight pr-2 truncate`}>
              {title}
            </h3>
            {hasDetail && (
              <p className="text-[10px] text-zinc-400 dark:text-zinc-555 font-bold mt-0.5">{allItems.length} courses · {totalDetailCredits.toFixed(1)} cr</p>
            )}
          </div>
          <span className={`flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${
            isComplete
              ? "bg-emerald-50 text-emerald-700 border-emerald-500/10 dark:bg-emerald-950/20 dark:text-emerald-400"
              : "bg-indigo-50 text-indigo-600 border-indigo-500/10 dark:bg-indigo-950/20 dark:text-indigo-400"
          }`}>
            {progressEarned.toFixed(0)}%
          </span>
        </div>

        <div className="relative h-2 rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
          {!isComplete && (
            <div className="absolute left-0 top-0 h-full bg-yellow-400/55 transition-all duration-500" style={{ width: `${progressWithOngoing}%` }} />
          )}
          <div className={`absolute left-0 top-0 h-full transition-all duration-500 ${isComplete ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${progressEarned}%` }} />
        </div>

        <div className="flex justify-between items-center mt-2.5 text-[10px] font-semibold text-zinc-450 dark:text-zinc-550 leading-none">
          <span><span className="font-bold text-zinc-700 dark:text-zinc-300">{earned.toFixed(1)}</span> earned</span>
          {inProgress > 0 && (
            <span><span className="font-bold text-yellow-600 dark:text-yellow-400">{inProgress.toFixed(1)}</span> ongoing</span>
          )}
          <span><span className="font-bold text-zinc-700 dark:text-zinc-300">{required.toFixed(1)}</span> req.</span>
        </div>

        {hasDetail && enrichedBaskets!.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-100  dark:border-gray-800 space-y-1">
            {enrichedBaskets!.map((b, bi) => {
              const key = `${title}-${bi}`;
              const isOpen = expandedBaskets?.has(key);
              return (
                <div key={bi}>
                  <button onClick={() => onToggleBasket?.(key)}
                    className="w-full text-left text-xs px-2.5 py-1.5 rounded-lg bg-gray-50  dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:bg-gray-800 transition-colors flex items-center justify-between"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {isOpen ? <ChevronDown className="w-3 h-3 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                      <span className="text-gray-600 dark:text-gray-400 truncate">{b.title}</span>
                    </span>
                    <span className="text-gray-400 flex-shrink-0 ml-2">{b.credits} cr</span>
                  </button>
                  {isOpen && (
                    <div className="ml-4 mt-1 space-y-1">
                      {b.items.map((item, ii) => (
                        <div key={ii} className="flex items-center justify-between text-xs px-2.5 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-800/30 dark:hover:bg-gray-800/30">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-gray-400 font-mono flex-shrink-0">{item.code}</span>
                            <span className="text-gray-600  dark:text-gray-400 truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {item.type && (
                              <span className="text-[10px] px-1 py-0.5 rounded bg-purple-50  dark:bg-purple-900/20 text-purple-500  dark:text-purple-400 uppercase">{item.type}</span>
                            )}
                            <span className="text-gray-400  dark:text-gray-500">{item.credits} cr</span>
                          </div>
                        </div>
                      ))}
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

// ── CourseAccordion component ────────────────────────────────────────
function CourseAccordion({ type, courses }: { type: string; courses: EffectiveGradeItem[] }) {
  const [open, setOpen] = useState(false);

  const totalCredits = courses.reduce((s, c) => s + (parseFloat(c.creditsEarned) || 0), 0);

  return (
    <Card className="bg-gradient-to-br from-white to-zinc-55/20 dark:from-zinc-900/60 dark:to-zinc-950/40 border border-zinc-200/50 dark:border-zinc-800/80 rounded-2xl shadow-2xs overflow-hidden transition-all duration-300">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4.5 text-left hover:bg-zinc-55/50 dark:hover:bg-zinc-900/40 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-black text-zinc-800 dark:text-zinc-200">{type}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-850 text-zinc-500 dark:text-zinc-400 font-bold border border-zinc-200/10">
            {courses.length} {courses.length === 1 ? "course" : "courses"} · {totalCredits.toFixed(1)} cr.
          </span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-zinc-450" /> : <ChevronRight className="w-4 h-4 text-zinc-450" />}
      </button>

      {open && (
        <div className="border-t border-zinc-150 dark:border-zinc-850 bg-white/40 dark:bg-zinc-950/10">
          {courses.map((course, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between px-4.5 py-3.5 ${
                idx !== courses.length - 1 ? "border-b border-zinc-150 dark:border-zinc-850" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-zinc-800 dark:text-zinc-200 truncate">{course.basketTitle}</p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-555 mt-1 font-bold">{course.creditsEarned} credits</p>
              </div>
              <div className={`flex-shrink-0 ml-3 px-2.5 py-1 rounded-lg text-xs font-black border border-transparent ${GRADE_COLORS[course.grade] || "text-zinc-500"} ${GRADE_BG[course.grade] || "bg-zinc-100 dark:bg-zinc-850"}`}>
                {course.grade}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
