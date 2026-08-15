"use client";
import { useState, useEffect } from "react";
import { API_BASE } from "../Main";
import SubpageLayout from "../shared/SubpageLayout";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { RefreshCcw, BookOpen, Award, ChevronDown, ChevronRight, Layers, Download, Loader2 } from "lucide-react";
import { storage } from "@/lib/storage";

interface Creds {
  cookies: string[];
  authorizedID: string;
  csrf: string;
}

interface Category {
  code: string;
  name: string;
  credits: number;
  maxCredits: number;
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

interface CategoryDetail {
  code: string;
  name: string;
  baskets: Basket[];
}

interface CurriculumCategoriesTabProps {
  loginToVTOP: () => Promise<Creds>;
}

const cardBase = "solid-card";

export default function CurriculumCategoriesTab({ loginToVTOP }: CurriculumCategoriesTabProps) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const [data, setData] = useState<any>(null);
  const [pageCsrf, setPageCsrf] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isDownloadingCurriculum, setIsDownloadingCurriculum] = useState(false);
  const [downloadingSyllabus, setDownloadingSyllabus] = useState<string | null>(null);

  const fetchData = async (c: Creds, force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (!force) {
        const cached = storage.curriculum.get() as any;
        if (cached) {
          try {
            setData(cached);
            if (cached.pageCsrf) setPageCsrf(cached.pageCsrf);
            setLoading(false);
            return;
          } catch(e) {}
        }
      }
      const { cookies, authorizedID, csrf } = c;
      const res = await fetch(`${API_BASE}/api/curriculum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf }),
      });
      const result = await res.json();
      if (result.success === false) setError(result.error || "Failed to load");
      else {
        setData(result);
        if (result.pageCsrf) setPageCsrf(result.pageCsrf);
        storage.curriculum.set({
            details: result.details,
            categories: result.categories,
            totalCredits: result.totalCredits,
            pageCsrf: result.pageCsrf
        });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loginToVTOP().then(c => { setCreds(c); fetchData(c); }).catch(() => setLoading(false));
  }, []);

  const downloadCurriculum = async () => {
    setIsDownloadingCurriculum(true);
    if (!creds) {
      try { const c = await loginToVTOP(); setCreds(c); } catch { 
        setIsDownloadingCurriculum(false);
        return; 
      }
    }
    const c = creds || await loginToVTOP();
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

  const downloadSyllabus = async (courseCode: string) => {
    setDownloadingSyllabus(courseCode);
    if (!creds) {
      try { const c = await loginToVTOP(); setCreds(c); } catch { 
        setDownloadingSyllabus(null);
        return; 
      }
    }
    const c = creds || await loginToVTOP();
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

  const toggleCategory = (code: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  if (!creds || loading) {
    return (
      <SubpageLayout title="Curriculum Categories" onBack={() => {}}>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </SubpageLayout>
    );
  }

  const categories: Category[] = data?.categories || [];
  const details: CategoryDetail[] = data?.details || [];

  const totalCredits = data?.totalCredits || 0;

  const completedCategories = categories.filter(c => c.maxCredits > 0 && c.credits >= c.maxCredits);
  const inProgressCategories = categories.filter(c => c.maxCredits > 0 && c.credits < c.maxCredits && c.credits > 0);
  const pendingCategories = categories.filter(c => c.maxCredits === 0 || c.credits === 0);

  return (
    <SubpageLayout
      title="Curriculum Categories"
      onBack={() => {}}
      action={
        <div className="flex items-center gap-2">
          <button onClick={downloadCurriculum} disabled={isDownloadingCurriculum} className={`p-2.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 transition-colors ${isDownloadingCurriculum ? "opacity-50 cursor-not-allowed" : "hover:bg-green-100 dark:hover:bg-green-900/50"}`} title="Download Curriculum">
            {isDownloadingCurriculum ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
          </button>
          <button onClick={() => creds && fetchData(creds, true)} className="p-2.5 rounded-full bg-blue-50  dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors" title="Reload">
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>
      }
    >
      {error && (
        <div className="p-4 text-sm text-red-600  dark:text-red-500 bg-red-50  dark:bg-red-900/20 rounded-2xl mb-4">{error}</div>
      )}

      {totalCredits > 0 && (
        <div className={`${cardBase} mb-5`}>
          <div className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50  dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider">Total Credits</p>
              <p className="text-2xl font-bold text-gray-900  dark:text-gray-100">{totalCredits}</p>
            </div>
            <div className="flex gap-2 ml-auto">
              <span className="text-xs px-2 py-1 rounded-lg bg-green-50  dark:bg-green-900/20 text-green-600  dark:text-green-400 font-medium">{completedCategories.length} done</span>
              <span className="text-xs px-2 py-1 rounded-lg bg-blue-50  dark:bg-blue-900/20 text-blue-600  dark:text-blue-400 font-medium">{inProgressCategories.length} in progress</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {categories.map((cat, i) => {
          const pct = cat.maxCredits > 0 ? Math.round((cat.credits / cat.maxCredits) * 100) : 0;
          const isOpen = expanded.has(cat.code);
          const detail = details.find(d => d.code === cat.code);
          const baskets = detail?.baskets || [];
          const isOEC = cat.code === "OEC";

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

      {categories.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400  dark:text-gray-500">
          <BookOpen className="w-12 h-12 mb-3" />
          <p className="text-sm font-medium">No curriculum data found</p>
        </div>
      )}
    </SubpageLayout>
  );
}
