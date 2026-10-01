"use client";
import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/sync-engine";
import {
  Search,
  User,
  XCircle,
  Mail,
  Loader2,
  Building2,
  ChevronRight,
  GraduationCap,
  ExternalLink,
  Copy,
  Check,
  School as SchoolIcon,
} from "lucide-react";
import {
  EmptyPanel,
  KeyValue,
  ListRowText,
  ListShell,
  ListSkeleton,
  PageShell,
  SectionHeader,
  SubpageScreen,
  ToneBadge,
  useSubpageStack,
} from "../shared/primitives";
import {
  CHIP,
  LIST_ROW,
  LIST_SHELL,
  SEARCH_FIELD,
  TILE_CARD,
  TONE_ICON_TILE,
} from "@/lib/uiTokens";

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

/** Split "SCOPE - School of Computing (SCOPE)" into its acronym and its name. */
function parseSchoolName(fullName: string) {
  const match = fullName.match(/\(([^)]+)\)/);
  const acronym = match ? match[1] : null;
  const cleanName = fullName.replace(/\s*\([^)]*\)/, "").trim();
  return { acronym, cleanName };
}

/**
 * A faculty member.
 *
 * A `TILE_CARD` rather than a `ListShell` row: this is the one entry on the
 * page that is genuinely card-shaped — a photo, a name, a designation and up to
 * three contact facts — and squeezing that into a single row would either
 * truncate the facts or push them into a second tap. Expanding in place is kept
 * rather than moved to a sheet because the expansion is how a reader discovers
 * that the public portal did not publish an email, which is information, not
 * decoration.
 */
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
      api(`faculty-profile/${profile.employeeId}`, { parse: "raw" })
        .then(async (r: any) => (r.ok ? r.json() : { success: false }))
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

  const facts = [
    profile.employeeId ? ["ID", profile.employeeId] : null,
    profile.intercom ? ["Intercom", profile.intercom] : null,
  ].filter(Boolean) as [string, string][];

  return (
    <div className={TILE_CARD}>
      <div className="flex items-center gap-3.5">
        {profile.imageUrl ? (
          <img
            src={profile.imageUrl}
            alt={profile.name}
            className="w-12 h-12 rounded-2xl object-cover shrink-0 border border-border-muted"
            onError={(e: any) => {
              e.target.style.display = "none";
            }}
          />
        ) : (
          <span
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${TONE_ICON_TILE.indigo}`}
          >
            <User className="w-6 h-6" />
          </span>
        )}
        <ListRowText
          title={profile.name}
          titleTooltip={profile.name}
          titleTag="h3"
          subtitle={profile.designation || "Faculty Member"}
          right={
            profile.profileUrl ? (
              <a
                href={profile.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={`Open ${profile.name}'s public profile`}
                aria-label={`Open ${profile.name}'s public profile`}
                className="shrink-0 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            ) : null
          }
        />
      </div>

      {facts.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          {facts.map(([label, value]) => (
            <KeyValue key={label} label={label} value={value} />
          ))}
        </div>
      )}

      {profile.email && (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-border-muted pt-3">
          <a
            href={`mailto:${profile.email}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 min-w-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{profile.email}</span>
          </a>
          <button
            type="button"
            onClick={(e) => handleCopyEmail(e, profile.email)}
            className={`${CHIP} shrink-0 cursor-pointer`}
            title="Copy email"
          >
            {copiedEmail ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copiedEmail ? "Copied" : "Copy"}
          </button>
        </div>
      )}

      {/* The expansion is a real fetch, so the row that triggers it has to say so
          and has to show progress — otherwise a slow portal reads as "no data". */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="mt-3 w-full flex items-center justify-between gap-2 border-t border-border-muted pt-3 text-[10px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-text-heading transition-colors"
      >
        <span>{expanded ? "Show less" : "View full details"}</span>
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          <GraduationCap className="w-3.5 h-3.5 shrink-0" />
        )}
      </button>

      {expanded && !loading && !profile.email && !profile.intercom && (
        <p className="mt-2 text-[11px] text-text-muted">
          Additional contact details are not published on the public portal.
        </p>
      )}
    </div>
  );
};

/**
 * Two screens, one hop apart.
 *
 * `schools` is the hub and `directory` is the drilled-in list, so back from the
 * list returns to the hub rather than walking the list. `useSubpageStack` models
 * a linear stack where `back()` pops an entry, so the handler resets while
 * drilled in and only exits the page at the root.
 */
const SCREENS = ["schools", "directory"] as const;
type Screen = (typeof SCREENS)[number];

export default function FacultyInfoTab({
  loginToVTOP: _loginToVTOP,
  setActiveSubTab,
}: {
  loginToVTOP?: any;
  setActiveSubTab?: (t: string) => void;
}) {
  const stack = useSubpageStack<Screen>({
    screens: SCREENS,
    onExit: () => setActiveSubTab?.("overview"),
  });
  const { screen, isRoot } = stack;

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
    api("faculty/schools", { parse: "raw" })
      .then(async (r: any) => {
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
      const res = await api("faculty/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { schoolId },
        parse: "raw",
      }) as Response;
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

  const handleBackToSchools = () => {
    setSelectedSchool(null);
    setFaculties([]);
    setSearchTerm("");
    setError(null);
    stack.reset();
  };

  const filteredSchools = useMemo(() => {
    if (!schoolSearchTerm.trim()) return schools;
    const lower = schoolSearchTerm.toLowerCase();
    return schools.filter(
      (s) =>
        s.school_name.toLowerCase().includes(lower) ||
        s.id.toLowerCase().includes(lower)
    );
  }, [schools, schoolSearchTerm]);

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

  // ─ Hub: pick a school ─
  const schoolsScreen = (
    <div className="space-y-6">
      <div className={TILE_CARD}>
        <div className="flex items-center gap-3.5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON_TILE.indigo}`}>
            <SchoolIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-text-heading font-outfit tracking-tight">
                Select a school or department
              </h2>
              <ToneBadge tone="indigo">Directory</ToneBadge>
            </div>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-text-secondary dark:text-text-muted">
              Pick a department to load its faculty list, designations, employee IDs
              and intercom numbers.
            </p>
          </div>
        </div>
      </div>

      {/* Only worth the row once there is something to search. */}
      {schools.length > 4 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={schoolSearchTerm}
            onChange={(e) => setSchoolSearchTerm(e.target.value)}
            placeholder="Search schools by name or acronym (SCOPE, SENSE, SAS, SMEC)…"
            aria-label="Search schools"
            className={`${SEARCH_FIELD} pl-11`}
          />
        </div>
      )}

      <div className="space-y-3">
        <SectionHeader
          icon={Building2}
          title="Schools"
          count={filteredSchools.length}
        />
        {filteredSchools.length === 0 ? (
          <EmptyPanel
            icon={<SchoolIcon className="h-7 w-7" />}
            tone="indigo"
            title="No schools found"
            description={
              schoolSearchTerm
                ? `Nothing matches “${schoolSearchTerm}”. Try an acronym such as SCOPE or SENSE.`
                : "The directory came back empty. Sync and try again."
            }
            action={
              schoolSearchTerm ? (
                <button
                  type="button"
                  onClick={() => setSchoolSearchTerm("")}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-indigo-700"
                >
                  Clear search
                </button>
              ) : null
            }
          />
        ) : (
          <div className={LIST_SHELL}>
            {filteredSchools.map((school) => {
              const { acronym, cleanName } = parseSchoolName(school.school_name);
              return (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => {
                    handleSelectSchool(school.id);
                    stack.go("directory");
                  }}
                  className={`${LIST_ROW} cursor-pointer`}
                >
                  <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${TONE_ICON_TILE.sky}`}>
                    <GraduationCap className="w-4.5 h-4.5" />
                  </span>
                  <ListRowText title={cleanName} subtitle={acronym || undefined} titleTooltip={school.school_name} />
                  <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ─ Directory: one school's faculty ─
  const directoryScreen = (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader
          icon={SchoolIcon}
          title={selectedSchoolObj?.school_name || "Faculty"}
          count={faculties.length}
          right={
            <ToneBadge tone={loadingFaculties ? "zinc" : "indigo"}>
              {loadingFaculties ? "Loading" : `${faculties.length} members`}
            </ToneBadge>
          }
        />

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, employee ID, designation or email…"
            aria-label="Search faculty"
            disabled={loadingFaculties}
            className={`${SEARCH_FIELD} pl-11`}
          />
        </div>
      </div>

      {loadingFaculties ? (
        <ListSkeleton rows={5} leading="book" />
      ) : filteredFaculties.length === 0 ? (
        <EmptyPanel
          icon={<User className="h-7 w-7" />}
          tone="indigo"
          title={searchTerm ? "No faculty found" : "No faculty records"}
          description={
            searchTerm
              ? `Nothing in this school matches “${searchTerm}”. Try an employee ID or designation.`
              : "The public portal published no faculty for this school."
          }
          action={
            searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-indigo-700"
              >
                Clear search
              </button>
            ) : null
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
      )}
    </div>
  );

  return (
    <PageShell
      eyebrow="Tools"
      title="Faculty Explorer"
      /* School names are user data and routinely long; a one-line ellipsis here
         would throw away the thing the reader picked. */
      wrap
      subtitle={isRoot ? undefined : selectedSchoolObj?.school_name}
      onBack={() => (isRoot ? stack.back() : handleBackToSchools())}
    >
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-xs font-semibold text-red-600 dark:text-red-400">
          <div className="flex items-center gap-2 min-w-0">
            <XCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          {selectedSchool && (
            <button
              type="button"
              onClick={() => handleSelectSchool(selectedSchool)}
              className="shrink-0 rounded-xl bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {loadingSchools ? (
        <ListSkeleton rows={5} leading="dot" trailing />
      ) : (
        <SubpageScreen id={screen}>{isRoot ? schoolsScreen : directoryScreen}</SubpageScreen>
      )}
    </PageShell>
  );
}
