"use client";
import { useState, useEffect, useMemo } from "react";
import { API_BASE } from "../Main";
import SubpageLayout from "../shared/SubpageLayout";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { 
  Search, 
  User, 
  XCircle, 
  Mail, 
  Phone, 
  Loader2, 
  Building2, 
  IdCard, 
  GraduationCap, 
  ArrowLeft, 
  ChevronRight, 
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  School as SchoolIcon
} from "lucide-react";
import { m, AnimatePresence } from "framer-motion";

interface School {
  id: string;
  school_name: string;
}

interface FacultyProfile {
  id: string;
  name: string;
  designation: string;
  imageUrl: string;
  profileUrl: string;
  email: string;
  employeeId: string;
  intercom: string;
}

// Helper to parse school acronym and clean name
function parseSchoolName(fullName: string) {
  const match = fullName.match(/\(([^)]+)\)/);
  const acronym = match ? match[1] : null;
  const cleanName = fullName.replace(/\s*\([^)]*\)/, "").trim();
  return { acronym, cleanName };
}

const FacultyCard = ({
  profile,
  onDetailFetched,
}: {
  profile: FacultyProfile;
  onDetailFetched: (p: FacultyProfile) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    if (expanded && !profile.email && profile.employeeId) {
      setLoading(true);
      fetch(`/api/faculty-profile/${profile.employeeId}`)
        .then(async (r) => (r.ok ? r.json() : { success: false }))
        .then((data) => {
          if (data?.success && data.profile) {
            onDetailFetched({
              ...profile,
              designation: data.profile.designation || profile.designation,
              email: data.profile.email || "",
              intercom: data.profile.intercom || "",
            });
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [expanded, profile.email, profile.employeeId]);

  const handleCopyEmail = (e: React.MouseEvent, email: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between">
      {/* Card Header */}
      <div className="p-4 bg-gradient-to-r from-indigo-50/70 to-blue-50/50 dark:from-indigo-950/20 dark:to-blue-950/10 border-b border-gray-100 dark:border-zinc-800/80 flex items-center gap-3.5">
        {profile.imageUrl ? (
          <img
            src={profile.imageUrl}
            alt={profile.name}
            className="w-12 h-12 rounded-xl object-cover shrink-0 bg-indigo-100 dark:bg-zinc-800 border border-white/80 dark:border-zinc-700 shadow-2xs"
            onError={(e: any) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-sm">
            <User className="w-6 h-6" />
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
              {profile.profileUrl ? (
                <a
                  href={profile.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  <span className="truncate">{profile.name}</span>
                  <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                </a>
              ) : (
                profile.name
              )}
            </h3>
          </div>
          <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 truncate mt-0.5">
            {profile.designation || "Faculty Member"}
          </p>
        </div>
      </div>

      {/* Card Body */}
      <div
        className="p-4 space-y-3 bg-white dark:bg-zinc-900/40 cursor-pointer flex-1 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {profile.employeeId && (
          <div className="flex items-center gap-2.5 text-xs">
            <div className="p-1 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 shrink-0">
              <IdCard className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">ID:</span>
              <span className="font-bold text-gray-800 dark:text-gray-200 font-mono">{profile.employeeId}</span>
            </div>
          </div>
        )}

        {profile.intercom && (
          <div className="flex items-center gap-2.5 text-xs">
            <div className="p-1 rounded bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 shrink-0">
              <Phone className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">Intercom:</span>
              <span className="font-bold text-gray-800 dark:text-gray-200">{profile.intercom}</span>
            </div>
          </div>
        )}

        {profile.email && (
          <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-gray-100 dark:border-zinc-800/60">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 shrink-0">
                <Mail className="w-3.5 h-3.5" />
              </div>
              <a
                href={`mailto:${profile.email}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline truncate"
              >
                {profile.email}
              </a>
            </div>
            <button
              onClick={(e) => handleCopyEmail(e, profile.email)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
              title="Copy email"
            >
              {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        )}

        {expanded && (
          <div className="pt-2 border-t border-gray-100 dark:border-zinc-800">
            {loading ? (
              <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                <span>Fetching latest profile information...</span>
              </div>
            ) : (
              !profile.email && !profile.intercom && (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                  Additional contact details not published on public portal.
                </p>
              )
            )}
          </div>
        )}
      </div>

      {/* Card Footer toggle cue */}
      <div 
        onClick={() => setExpanded((v) => !v)}
        className="px-4 py-2 bg-gray-50/70 dark:bg-zinc-900/90 border-t border-gray-100 dark:border-zinc-800/80 text-[10px] font-bold text-gray-400 dark:text-gray-500 flex items-center justify-between cursor-pointer hover:bg-gray-100/70 dark:hover:bg-zinc-850 transition-colors"
      >
        <span>{expanded ? "Show less" : "Click to view full details"}</span>
        <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
      </div>
    </div>
  );
};

export default function FacultyInfoTab({
  loginToVTOP: _loginToVTOP,
  setActiveSubTab,
}: {
  loginToVTOP?: any;
  setActiveSubTab?: (t: string) => void;
}) {
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);

  const [selectedSchool, setSelectedSchool] = useState<string | null>(null);
  const [schoolSearchTerm, setSchoolSearchTerm] = useState("");

  const [faculties, setFaculties] = useState<FacultyProfile[]>([]);
  const [loadingFaculties, setLoadingFaculties] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch school list on mount (do NOT auto-select so user can pick from pill cards)
  useEffect(() => {
    fetch(`${API_BASE}/api/faculty/schools`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Failed to load schools: API returned ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (data.success) {
          setSchools(data.schools || []);
        } else {
          setError(data.error || "Failed to load schools list");
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSchools(false));
  }, []);

  const handleSelectSchool = async (schoolId: string) => {
    setSelectedSchool(schoolId);
    setLoadingFaculties(true);
    setError(null);
    setFaculties([]);
    setSearchTerm("");

    try {
      const res = await fetch(`${API_BASE}/api/faculty/scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch faculty list: API returned ${res.status}`);
      }
      const data = await res.json();
      if (data.success === false) {
        setError(data.error || "Failed to fetch faculty list");
      } else {
        setFaculties(data.faculties || []);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingFaculties(false);
    }
  };

  // Filter schools based on search
  const filteredSchools = useMemo(() => {
    if (!schoolSearchTerm.trim()) return schools;
    const lower = schoolSearchTerm.toLowerCase();
    return schools.filter(
      (s) =>
        s.school_name.toLowerCase().includes(lower) ||
        s.id.toLowerCase().includes(lower)
    );
  }, [schools, schoolSearchTerm]);

  // Filter faculties based on search
  const filteredFaculties = useMemo(() => {
    if (!searchTerm.trim()) return faculties;
    const lower = searchTerm.toLowerCase();
    return faculties.filter(
      (f) =>
        f.name.toLowerCase().includes(lower) ||
        f.employeeId.toLowerCase().includes(lower) ||
        f.email.toLowerCase().includes(lower) ||
        f.designation.toLowerCase().includes(lower) ||
        f.intercom.toLowerCase().includes(lower)
    );
  }, [faculties, searchTerm]);

  const selectedSchoolObj = useMemo(() => {
    return schools.find((s) => s.id === selectedSchool) || null;
  }, [schools, selectedSchool]);

  const handleBack = () => {
    if (selectedSchool) {
      setSelectedSchool(null);
      setFaculties([]);
      setSearchTerm("");
    } else if (setActiveSubTab) {
      setActiveSubTab("overview");
    }
  };

  if (loadingSchools) {
    return (
      <SubpageLayout title="Faculty Directory" onBack={handleBack}>
        <div className="space-y-4 max-w-5xl mx-auto text-left">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        </div>
      </SubpageLayout>
    );
  }

  return (
    <SubpageLayout
      title={selectedSchoolObj ? selectedSchoolObj.school_name : "Faculty Directory"}
      onBack={handleBack}
    >
      <div className="max-w-5xl mx-auto space-y-6">
        {error && (
          <div className="p-4 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between gap-3 text-left animate-fadeIn">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            {selectedSchool && (
              <button
                onClick={() => handleSelectSchool(selectedSchool)}
                className="px-3 py-1 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition-colors shrink-0 cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════
              STEP 1: SCHOOL SELECTION (COMPACT PILL CARDS GRID)
             ═══════════════════════════════════════════════════════ */}
          {!selectedSchool ? (
            <m.div
              key="school-selection-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Hero Banner */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 text-left relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md shrink-0">
                    <SchoolIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                      <Sparkles className="w-3 h-3" /> Campus Directory
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-1 font-outfit">
                      Select a School or Department
                    </h2>
                    <p className="text-xs text-gray-550 dark:text-gray-400 mt-1 max-w-xl leading-relaxed">
                      Choose your department below to load its faculty member directory, designations, employee IDs, and direct intercom details.
                    </p>
                  </div>
                </div>
              </div>

              {/* School Search Filter */}
              {schools.length > 4 && (
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={schoolSearchTerm}
                    onChange={(e) => setSchoolSearchTerm(e.target.value)}
                    placeholder="Search schools by name or acronym (e.g. SCOPE, SENSE, SAS, SMEC)..."
                    className="w-full pl-10 pr-4 py-3 text-xs sm:text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-2xs"
                  />
                  {schoolSearchTerm && (
                    <button
                      onClick={() => setSchoolSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}

              {/* Compact Pill Cards Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs px-1 text-left">
                  <span className="font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-[10px]">
                    Available Schools ({filteredSchools.length})
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                    Tap a card to view faculty list
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredSchools.map((school) => {
                    const { acronym, cleanName } = parseSchoolName(school.school_name);
                    return (
                      <button
                        key={school.id}
                        onClick={() => handleSelectSchool(school.id)}
                        className="group relative flex items-center justify-between p-4 rounded-2xl border border-gray-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/70 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 hover:border-indigo-500/50 dark:hover:border-indigo-500/40 transition-all duration-200 text-left shadow-2xs hover:shadow-md cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-center gap-3.5 min-w-0 flex-1 pr-2">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <GraduationCap className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            {acronym && (
                              <span className="inline-block px-2 py-0.5 mb-1 text-[10px] font-black uppercase tracking-wider bg-indigo-100/80 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md border border-indigo-200/60 dark:border-indigo-800/50 group-hover:border-indigo-300">
                                {acronym}
                              </span>
                            )}
                            <h4 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                              {cleanName}
                            </h4>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    );
                  })}
                </div>

                {filteredSchools.length === 0 && (
                  <div className="py-16 text-center rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30">
                    <Building2 className="w-10 h-10 mx-auto text-gray-400 opacity-50 mb-2" />
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      No schools found matching &quot;{schoolSearchTerm}&quot;
                    </p>
                    <button
                      onClick={() => setSchoolSearchTerm("")}
                      className="mt-3 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Clear search filter
                    </button>
                  </div>
                )}
              </div>
            </m.div>
          ) : (
            /* ═══════════════════════════════════════════════════════
               STEP 2: FACULTY DIRECTORY FOR SELECTED SCHOOL
               ═══════════════════════════════════════════════════════ */
            <m.div
              key="faculty-directory-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5 text-left"
            >
              {/* Navigation and School Switcher Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 shadow-2xs">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedSchool(null);
                      setFaculties([]);
                      setSearchTerm("");
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-gray-800 dark:text-gray-200 text-xs font-black transition-all cursor-pointer shrink-0 active:scale-95 shadow-2xs"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Schools</span>
                  </button>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                      Active School
                    </p>
                    <h3 className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white truncate">
                      {selectedSchoolObj?.school_name}
                    </h3>
                  </div>
                </div>

                {/* Quick switcher button to return to all schools */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                    {loadingFaculties ? "Loading..." : `${faculties.length} Members`}
                  </span>
                </div>
              </div>

              {/* Instant Search Bar */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search faculty by name, employee ID, designation, or email..."
                  disabled={loadingFaculties}
                  className="w-full pl-10 pr-10 py-3 text-xs sm:text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 shadow-2xs disabled:opacity-50"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Content Grid / Loading */}
              {loadingFaculties ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 w-full rounded-2xl" />
                  ))}
                </div>
              ) : (
                <>
                  {filteredFaculties.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 px-1">
                        <span className="font-semibold text-[11px]">
                          Showing {filteredFaculties.length} of {faculties.length} faculty profiles
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredFaculties.map((f, i) => (
                          <FacultyCard
                            key={f.id || f.employeeId || i}
                            profile={f}
                            onDetailFetched={(updated) => {
                              setFaculties((prev) =>
                                prev.map((p) =>
                                  (p.id && p.id === updated.id) ||
                                  (p.employeeId && p.employeeId === updated.employeeId)
                                    ? updated
                                    : p
                                )
                              );
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed border-gray-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/30">
                      <User className="w-12 h-12 mb-3 text-gray-400 opacity-50" />
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                        {searchTerm
                          ? `No faculty found matching "${searchTerm}"`
                          : "No faculty records available for this school"}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs">
                        Try searching with another name or ID keyword.
                      </p>
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm("")}
                          className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-all cursor-pointer shadow-sm"
                        >
                          Clear search filter
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </SubpageLayout>
  );
}
