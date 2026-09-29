"use client";

import { useEffect, useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import { activeTabAtom } from "@/store";
import { api } from "@/lib/sync-engine";
import { Skeleton, cn } from "@amazecontinuityprojects/amazeui";
import { Search, X, LayoutGrid, Users, Layers, RefreshCcw, ChevronRight, SearchX, Rss, WifiOff } from "lucide-react";
import { LIST_ROW, SEARCH_FIELD, TONE_BADGE, TONE_ICON_TILE } from "@/lib/uiTokens";
import { getSimilarity } from "@/lib/string-similarity";
import ClubDetailsModal from "./ClubDetailsModal";
import {
  EmptyPanel,
  GhostButton,
  IconButton,
  InsightCarousel,
  ListRowText,
  ListShell,
  ListSkeleton,
  PageShell,
  ChipTabs,
  SectionHeader,
  StatTile,
  ToneBadge,
  useCarousel,
  type InsightSlide,
} from "../shared/primitives";

/**
 * The club directory.
 *
 * Two sources, and they fail independently:
 *
 *  - `club-enrollment` is VTOP's own list. It is the only source of the
 *    CLUB/CHAPTER type, but it needs live VTOP cookies, so an expired session
 *    or a captcha solve can take it down.
 *  - `clubs/details` is a public table. It carries the part a reader actually
 *    wants — logo, mission, contacts, recruitment — and needs no credentials.
 *
 * So a VTOP failure must not blank the page: the public directory stands in and
 * the UI says so. The one thing that is genuinely lost is the type, and with it
 * the type filter, because `club_details` has no type column. Showing a guessed
 * one would be worse than showing none.
 */

interface ClubEntry {
  /** VTOP's row number, or the public `club_id`. Only a display fallback. */
  id: string;
  name: string;
  /** `CLUB` / `CHAPTER` from VTOP; empty when we fell back to the public list. */
  type: string;
  detail: any | null;
}

const ROW_CAP = 50;

const DEMO_CLUBS = [
  "VOICE-IT VIT CHENNAI'S RADIO",
  "DANCE CLUB",
  "VITC DEBATE SOCIETY",
  "DRAMATICS CLUB",
  "FINE ARTS CLUB (TFAC)",
  "ACM STUDENT CHAPTER",
  "IEEE STUDENT CHAPTER",
];

/** Compare on letters and digits only, so "Fine Arts Club (TFAC)" == "fine arts club". */
const normalise = (value: string): string =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const isChapter = (type: string): boolean => /chapter/i.test(String(type ?? ""));
const toneFor = (type: string): string => (isChapter(type) ? "violet" : type ? "indigo" : "sky");
const IconFor = (type: string) => (isChapter(type) ? Layers : Users);

/**
 * Find a club's public profile.
 *
 * `syncClubs` seeds `club_id` with the club's *name* ("Temporary ID based on
 * name"), so an exact normalised comparison resolves almost every row and costs
 * a string compare. Similarity stays as the fallback for profiles an admin
 * renamed, which is what it was doing before — but it is no longer the only
 * thing standing between a club and its own logo.
 */
function matchDetail(name: string, id: string, details: any[]): any | null {
  if (details.length === 0) return null;
  const n = normalise(name);
  const i = normalise(id);
  const exact = details.find(
    (d) => (n && normalise(d.club_name) === n) || (i && normalise(d.club_id) === i)
  );
  if (exact) return exact;
  return details.find((d) => getSimilarity(name, d.club_name) > 0.8) ?? null;
}

const withDetails = (list: Omit<ClubEntry, "detail">[], details: any[]): ClubEntry[] =>
  list.map((entry) => ({ ...entry, detail: matchDetail(entry.name, entry.id, details) }));

export default function ClubHubTab({
  IDs,
  loginToVTOP,
  onBack,
}: {
  IDs: any;
  loginToVTOP?: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
  onBack?: () => void;
}) {
  const [clubs, setClubs] = useState<ClubEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** True when we are showing the public directory because VTOP's list failed. */
  const [vtopUnavailable, setVtopUnavailable] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [showAll, setShowAll] = useState(false);
  const [selectedClub, setSelectedClub] = useState<any | null>(null);

  const setActiveTab = useSetAtom(activeTabAtom);

  /**
   * VTOP's association list. Throws on anything that means "we do not have the
   * type" — the caller decides whether that is fatal or merely a downgrade.
   */
  const fetchEnrollment = async (): Promise<Omit<ClubEntry, "detail">[]> => {
    let cookies = IDs.cookies || [];
    let authorizedID = IDs.authorizedID;
    let csrf = IDs.csrf;

    if (!cookies.length || !authorizedID || !csrf) {
      if (!loginToVTOP) throw new Error("Missing VTOP credentials.");
      const creds = await loginToVTOP();
      cookies = creds.cookies;
      authorizedID = creds.authorizedID;
      csrf = creds.csrf;
    }

    const res = (await api("club-enrollment", {
      method: "POST",
      body: { cookies, authorizedID, csrf },
      parse: "raw",
    })) as Response;
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch clubs");
    if (!data.success) throw new Error("Failed to load club data from VTOP");

    const parsed: Omit<ClubEntry, "detail">[] = [];
    if (data.tables && data.tables.length > 0) {
      data.tables[0].rows.forEach((row: any) => {
        const rawName = row["Association Name (Type)"] || "";
        if (!rawName) return;
        // Usually "CLUB NAME (TYPE)"
        const typeMatch = rawName.match(/\(([^)]+)\)$/);
        parsed.push({
          id: row["#"] || "",
          name: rawName.replace(/\([^)]+\)$/, "").trim(),
          type: typeMatch ? typeMatch[1].trim() : "CLUB",
        });
      });
    }
    return parsed;
  };

  const load = async () => {
    setLoading(true);
    setError("");
    setShowAll(false);

    if (IDs?.VtopUsername === "demo") {
      await new Promise((resolve) => setTimeout(resolve, 400));
      setClubs(
        withDetails(
          DEMO_CLUBS.map((name, i) => ({ id: String(i + 1), name, type: i >= 5 ? "CHAPTER" : "CLUB" })),
          []
        )
      );
      setVtopUnavailable(false);
      setLoading(false);
      return;
    }

    const [enrolled, detailsResult] = await Promise.allSettled([
      fetchEnrollment(),
      api("clubs/details").then((data: any) => (Array.isArray(data?.clubs) ? data.clubs : [])),
    ]);

    const details = detailsResult.status === "fulfilled" ? detailsResult.value : [];
    const enrolledList = enrolled.status === "fulfilled" ? enrolled.value : [];

    if (enrolledList.length > 0) {
      setClubs(withDetails(enrolledList, details));
      setVtopUnavailable(false);
    } else if (details.length > 0) {
      // The public directory stands in. Each row is its own profile, so the
      // match is already done.
      setClubs(
        details.map((d: any) => ({ id: d.club_id || "", name: d.club_name || "", type: "", detail: d }))
      );
      setVtopUnavailable(true);
    } else {
      setClubs([]);
      setVtopUnavailable(enrolled.status === "rejected");
      setError(
        enrolled.status === "rejected"
          ? enrolled.reason?.message || "Couldn't reach VTOP or the club database."
          : "No clubs are published yet."
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    const chapters = clubs.filter((c) => isChapter(c.type)).length;
    return {
      total: clubs.length,
      chapters,
      clubs: clubs.filter((c) => c.type && !isChapter(c.type)).length,
      withLogo: clubs.filter((c) => c.detail?.logo_url).length,
      recruiting: clubs.filter((c) => c.detail?.recruitment_link || c.detail?.hiring_process).length,
      reachable: clubs.filter((c) => c.detail?.poc || c.detail?.whatsapp || c.detail?.instagram).length,
    };
  }, [clubs]);

  /**
   * One measurement per slide, and a slide with nothing to say is left out
   * rather than shown as a zero — same rule as the Event Hub and OD hero tiles.
   */
  const insightSlides = useMemo<InsightSlide[]>(() => {
    const slides: InsightSlide[] = [];
    if (summary.chapters > 0) {
      slides.push({
        id: "chapters",
        label: "Chapters",
        value: summary.chapters,
        sub: "Professional chapters",
        badge: "Chapter",
        tone: "violet",
      });
    }
    if (summary.clubs > 0) {
      slides.push({
        id: "clubs",
        label: "Clubs",
        value: summary.clubs,
        sub: "Student-run organisations",
        badge: "Club",
        tone: "indigo",
      });
    }
    if (summary.withLogo > 0) {
      slides.push({
        id: "logos",
        label: "With a logo",
        value: `${summary.withLogo}/${summary.total}`,
        sub: "Profiles with artwork",
        badge: "Profiles",
        tone: "emerald",
      });
    }
    if (summary.recruiting > 0) {
      slides.push({
        id: "hiring",
        label: "Recruiting",
        value: summary.recruiting,
        sub: "Accepting new members",
        badge: "Hiring",
        tone: "amber",
      });
    }
    if (summary.reachable > 0) {
      slides.push({
        id: "contact",
        label: "Reachable",
        value: summary.reachable,
        sub: "Have a contact or a handle",
        badge: "Contact",
        tone: "sky",
      });
    }
    return slides;
  }, [summary]);

  const carousel = useCarousel(insightSlides.length);

  // No type column in the fallback, so there is nothing honest to filter on.
  const types = useMemo(() => {
    if (vtopUnavailable) return [];
    return ["All", ...Array.from(new Set(clubs.map((c) => c.type).filter(Boolean)))];
  }, [clubs, vtopUnavailable]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return clubs.filter((club) => {
      const matchesSearch = !query || club.name.toLowerCase().includes(query);
      const matchesType = selectedType === "All" || club.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [clubs, searchQuery, selectedType]);

  const visible = showAll ? filtered : filtered.slice(0, ROW_CAP);
  const hiddenCount = filtered.length - visible.length;

  return (
    <PageShell
      onBack={onBack}
      eyebrow="Club Hub"
      title="Clubs & Chapters"
      subtitle="Every student organisation at VIT, and how to join each one."
      actions={
        <IconButton title="Reload clubs" onClick={load}>
          <RefreshCcw className={loading ? "animate-spin" : ""} />
        </IconButton>
      }
      selectable
    >
      {/* ── HERO STATS ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Skeleton className="h-32 sm:h-36 rounded-[24px]" />
          <Skeleton className="h-32 sm:h-36 rounded-[24px]" />
        </div>
      ) : error ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatTile
              label={vtopUnavailable ? "Public directory" : "Clubs"}
              value={summary.total}
              sub={`${summary.withLogo} with a published profile`}
              badge={vtopUnavailable ? "Public" : `${summary.chapters} chapters`}
              tone={vtopUnavailable ? "sky" : "indigo"}
            />
            <InsightCarousel
              slides={insightSlides}
              carousel={carousel}
              height="h-32 sm:h-36"
              ariaLabel="Club insights"
            />
          </div>

          <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
            {vtopUnavailable
              ? "VTOP's club list is unavailable, so this is the club database's own directory — every club, without the CLUB/CHAPTER split. Tap one for its mission, contacts and recruitment."
              : "Profiles are published by each club's representatives. A club with no profile here is still listed — it just hasn't written one."}
          </p>
        </>
      )}

      {/* ── DIRECTORY ── */}
      {error ? (
        <EmptyPanel
          tone="red"
          icon={<WifiOff className="w-7 h-7" />}
          title="Couldn't load the club directory"
          description={error}
          action={
            <GhostButton onClick={load}>
              <RefreshCcw className="w-3.5 h-3.5" />
              Try again
            </GhostButton>
          }
        />
      ) : loading ? (
        <ListSkeleton rows={8} />
      ) : filtered.length === 0 ? (
        <EmptyPanel
          icon={<SearchX className="w-7 h-7" />}
          title="No clubs match your filters"
          description="Try a different search term, or clear the category filter to see every club."
        />
      ) : (
        <div className="space-y-4">
          <SectionHeader
            icon={LayoutGrid}
            title="Directory"
            count={filtered.length}
            right={
              <GhostButton onClick={() => setActiveTab("community")} title="Open the community feed">
                <Rss className="w-3.5 h-3.5" />
                Feed
              </GhostButton>
            }
          />

          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clubs..."
                aria-label="Search clubs"
                className={cn(SEARCH_FIELD, "pl-10 pr-10")}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {types.length > 2 && (
              <ChipTabs
                options={types.map((type) => ({ value: type, label: type }))}
                value={selectedType}
                onChange={setSelectedType}
                size="sm"
              />
            )}
          </div>

          <ListShell>
            {visible.map((club) => {
              const tone = toneFor(club.type);
              const Icon = IconFor(club.type);
              // A row number is not an identifier, so it is only worth showing
              // when the id says something the name does not.
              const subtitle =
                club.id && normalise(club.id) !== normalise(club.name)
                  ? club.id
                  : club.detail
                  ? "Profile published"
                  : "No profile yet";

              return (
                <button
                  key={`${club.id}-${club.name}`}
                  type="button"
                  onClick={() => setSelectedClub({ ...club, club_name: club.name, ...club.detail })}
                  className={cn(LIST_ROW, "gap-3 cursor-pointer active:bg-zinc-100 dark:active:bg-zinc-800/60")}
                >
                  {club.detail?.logo_url ? (
                    <img
                      src={club.detail.logo_url}
                      alt=""
                      loading="lazy"
                      className="w-10 h-10 rounded-2xl object-cover shrink-0 border border-zinc-200/70 dark:border-zinc-800/80"
                    />
                  ) : (
                    <span
                      className={cn(
                        "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                        TONE_ICON_TILE[tone] ?? TONE_ICON_TILE.sky
                      )}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </span>
                  )}

                  <ListRowText title={club.name} subtitle={subtitle} />

                  {club.type ? (
                    <span className={cn(TONE_BADGE[tone] ?? TONE_BADGE.zinc, "shrink-0")}>
                      {club.type}
                    </span>
                  ) : null}

                  <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                </button>
              );
            })}
          </ListShell>

          {hiddenCount > 0 && (
            <div className="flex justify-center">
              <GhostButton onClick={() => setShowAll(true)}>
                Show all {filtered.length} clubs
                <ChevronRight className="w-3.5 h-3.5" />
              </GhostButton>
            </div>
          )}
        </div>
      )}

      <ClubDetailsModal
        isOpen={!!selectedClub}
        onClose={() => setSelectedClub(null)}
        club={selectedClub}
      />
    </PageShell>
  );
}
