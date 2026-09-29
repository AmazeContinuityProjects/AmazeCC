"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Skeleton, cn } from "@amazecontinuityprojects/amazeui";
import { OptionPicker } from "@amazecontinuityprojects/amazeui";
import { m } from "framer-motion";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  DoorOpen,
  RefreshCcw,
  Search,
  X,
  Zap,
} from "lucide-react";

import { LIST_ROW, SEARCH_FIELD, TILE_CARD, TONE_BADGE } from "@/lib/uiTokens";
import {
  DAYS_OF_WEEK,
  DAY_LABELS,
  bestPeriod,
  blockAvailability,
  buildDayIndex,
  buildPeriodSlots,
  freeRoomsForPeriod,
  freeRoomsForRun,
  positionLabel,
  parseCourseRows,
  resolveNow,
  resolvePeriods,
  type DayId,
  type DayIndex,
  type FreeRoomCourse,
  type FreeRooms,
  type PeriodOption,
} from "@/lib/freeClassrooms";
import BottomSheet from "../shared/BottomSheet";
import {
  ChipTabs,
  DotPill,
  EmptyPanel,
  GhostButton,
  IconButton,
  InsightCarousel,
  ListRowText,
  ListShell,
  ListSkeleton,
  PageShell,
  SectionHeader,
  SegmentedControl,
  StatTile,
  ToneBadge,
  useCarousel,
  type InsightSlide,
} from "../shared/primitives";

import chennaiSchema from "@/data/campus/chennai.json";

/**
 * Free Classrooms.
 *
 * The answers all come from `lib/freeClassrooms.ts`; this is the surface. Three
 * things are worth saying about how it is arranged.
 *
 * **One accent.** Emerald means free, everywhere. Indigo marks a classroom and
 * cyan a lab, and only ever as small badges or chip tints. The page used to run
 * emerald, teal, indigo, cyan and rose across four separate control strips, plus
 * a gradient header with a blurred blob behind it.
 *
 * **Two questions, two sections.** "When" is day and period. "Rooms" is what
 * came back. They are separate because they fail separately and are used
 * separately — nobody changes the day while hunting for a room number.
 *
 * **The block is the unit, not the room.** There are 239 rooms and 65 of them
 * are in AB3. A block card shows its occupancy bar and the first dozen rooms,
 * then a count for the rest, because a card listing all 65 is a wall rather
 * than a list.
 */

const SCHEMA = chennaiSchema as any;

/** Rooms shown per block before the rest are hidden behind a count. */
const ROW_CAP = 12;

/** How many consecutive periods the "free for the next N" answer spans. */
const RUN_LENGTH = 3;

const roomNumber = (code: string) => {
  const dash = code.indexOf("-");
  return dash >= 0 ? code.slice(dash + 1) : code;
};

/**
 * A room chip with two targets.
 *
 * The number copies, the chevron opens the schedule. They are separate buttons
 * rather than one because the two intents are genuinely different — you copy a
 * code to walk there, you open a schedule to check whether it stays free — and
 * folding them into one gesture makes the common one a guess.
 */
function RoomChip({
  code,
  kind,
  onCopy,
  onInspect,
  copied,
}: {
  code: string;
  kind: "theory" | "lab";
  onCopy: (code: string) => void;
  onInspect: (code: string) => void;
  copied: boolean;
}) {
  const lab = kind === "lab";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-xl border overflow-hidden transition-colors",
        lab
          ? "bg-cyan-500/5 border-cyan-500/20 hover:border-cyan-400/40"
          : "bg-indigo-500/5 border-indigo-500/20 hover:border-indigo-400/40"
      )}
    >
      <button
        type="button"
        onClick={() => onCopy(code)}
        title={`Copy ${code}`}
        className={cn(
          "px-2.5 py-1.5 text-xs font-bold font-outfit tabular-nums transition-colors cursor-pointer inline-flex items-center gap-1",
          lab
            ? "text-cyan-700 dark:text-cyan-300"
            : "text-indigo-700 dark:text-indigo-300"
        )}
      >
        {roomNumber(code)}
        {copied && <Check className="w-3 h-3 text-emerald-500" />}
      </button>
      <button
        type="button"
        onClick={() => onInspect(code)}
        title={`Schedule for ${code}`}
        aria-label={`View the schedule for ${code}`}
        className={cn(
          "px-1.5 py-1.5 border-l cursor-pointer transition-colors",
          lab
            ? "border-cyan-500/20 text-cyan-500/70 hover:text-cyan-600 hover:bg-cyan-500/10"
            : "border-indigo-500/20 text-indigo-500/70 hover:text-indigo-600 hover:bg-indigo-500/10"
        )}
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

/**
 * The five weekdays.
 *
 * Shared by the page and the room inspector, because the two answer the same
 * question at different scopes and should not be able to disagree about it —
 * including about which day is today, which is why `today` is passed in rather
 * than recomputed.
 */
function DayPicker({
  value,
  onChange,
  today,
  compact = false,
}: {
  value: DayId;
  onChange: (d: DayId) => void;
  today: DayId;
  compact?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label="Day of week"
      className="grid grid-cols-5 gap-1.5 p-1.5 rounded-2xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/70 dark:border-zinc-800/70"
    >
      {DAYS_OF_WEEK.map((d) => {
        const selected = value === d;
        const isToday = today === d;
        return (
          <button
            key={d}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(d)}
            title={`${DAY_LABELS[d].full}${isToday ? " — today" : ""}`}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer",
              compact ? "gap-0 py-1.5 px-1" : "gap-0.5 py-2 px-1",
              selected
                ? "bg-white dark:bg-zinc-800 shadow-xs"
                : "hover:bg-white/60 dark:hover:bg-zinc-800/50"
            )}
          >
            <span
              className={cn(
                "font-black uppercase tracking-wide",
                compact ? "text-[10px]" : "text-[11px]",
                selected
                  ? "text-indigo-600 dark:text-indigo-300"
                  : isToday
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              {DAY_LABELS[d].short}
            </span>
            {isToday && (
              <span
                className={cn(
                  "rounded-full",
                  compact ? "w-1 h-1" : "w-1.5 h-1.5",
                  selected ? "bg-emerald-500" : "bg-emerald-500/70"
                )}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function FreeClassroomsTab({ onBack }: { onBack?: () => void }) {
  const [courses, setCourses] = useState<FreeRoomCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [day, setDay] = useState<DayId>("mon");
  const [periodKey, setPeriodKey] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "theory" | "lab">("all");
  const [blockFilter, setBlockFilter] = useState("All");
  const [query, setQuery] = useState("");
  /** When set, the list is narrowed to rooms free across a run of periods. */
  const [runOnly, setRunOnly] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [inspectedRoom, setInspectedRoom] = useState<string | null>(null);
  const [inspectDay, setInspectDay] = useState<DayId>("mon");
  const [copied, setCopied] = useState<string | null>(null);

  // Ticks so "Free right now" cannot sit there claiming to be live hours after
  // the fact. A minute is the finest granularity that means anything here.
  const [tick, setTick] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTick(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  /* ── data ─────────────────────────────────────────────────────────────── */

  const load = useCallback(async (forceReload = false) => {
    setLoading(true);
    setError(null);

    if (!forceReload) {
      try {
        const cached = localStorage.getItem("ffcs_raw_courses");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.length) {
            setCourses(parsed);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }

    try {
      const XLSX = await import("xlsx");
      const response = await fetch("/ffcs/ffcsReport.csv");
      if (!response.ok) throw new Error("Failed to load campus timetable records");
      const workbook = XLSX.read(new Uint8Array(await response.arrayBuffer()), { type: "array" });
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
        workbook.Sheets[workbook.SheetNames[0]]
      );

      // Header normalisation (the BOM, the CODE/VENUE aliases) lives in the
      // lib and is tested there. Doing it inline here once shipped a mangled
      // byte-order mark that silently dropped every course in the report.
      const parsed = parseCourseRows(rows);

      setCourses(parsed);
      try {
        localStorage.setItem("ffcs_raw_courses", JSON.stringify(parsed));
      } catch {}
    } catch (err: any) {
      setError(err.message || "Failed to load timetable data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* ── the day ──────────────────────────────────────────────────────────── */

  /**
   * Every weekday indexed, built together.
   *
   * One index per day rather than one for the day on screen, because the room
   * inspector browses the week: "is AB1-101 free on Thursday?" is a fair
   * question to ask of a room you just tapped, and rebuilding 2,357 rows for
   * every day the finger passes over is not.
   *
   * Five passes over the report is a few thousand operations, once, when the
   * data arrives. After that a day switch is a map read.
   */
  const week = useMemo(() => {
    const map = new Map<
      DayId,
      { periods: PeriodOption[]; slots: Map<string, Set<string>>; index: DayIndex }
    >();
    for (const d of DAYS_OF_WEEK) {
      const periods = resolvePeriods(SCHEMA, d);
      const slots = buildPeriodSlots(periods);
      map.set(d, { periods, slots, index: buildDayIndex(courses, periods, slots) });
    }
    return map;
  }, [courses]);

  // Falls back rather than asserting: a bad `day` should not blank the page.
  const shown = week.get(day) ?? week.get("mon")!;
  const periods = shown.periods;
  const periodSlots = shown.slots;
  const index = shown.index;

  const now = useMemo(() => resolveNow(periods, tick), [periods, tick]);

  /**
   * What the picker is actually showing.
   *
   * The effect below is what normally settles `periodKey`, but it runs after
   * paint — so on the first frame of the page `periodKey` is still `""` and the
   * dropdown would flash its "Select…" placeholder. Reading through this keeps
   * that frame honest without waiting for an effect.
   */
  const activePeriodKey = periodKey || periods[0]?.key || "";

  const periodIndex = Math.max(
    0,
    periods.findIndex((p) => p.key === activePeriodKey)
  );

  /**
   * Read out of the memo rather than off `now` directly, so the effect below
   * can depend on a string. `now` is rebuilt on every clock tick, and a
   * dependency on the object would re-run that effect once a minute for no
   * reason.
   */
  const livePeriodKey = now.period?.key ?? "";

  // Land on something real: today's period when it is live, otherwise the
  // first period of the day rather than an empty list.
  useEffect(() => {
    const next = now.isLive && livePeriodKey ? livePeriodKey : periods[0]?.key || "";
    setPeriodKey((current) => (periods.some((p) => p.key === current) ? current : next));
    setRunOnly(false);
    setExpanded({});
  }, [periods, now.isLive, livePeriodKey]);

  /**
   * The run of periods the "free for the next N" answer covers. It starts at
   * the live period when there is one, because that is the question a person
   * standing in a corridor is actually asking.
   */
  const runKeys = useMemo(() => {
    const liveNow = now.isLive && day === now.day && !!livePeriodKey;
    const from = liveNow
      ? periods.find((p) => p.key === livePeriodKey)?.startMinutes ?? 0
      : periods[periodIndex]?.startMinutes ?? 0;
    return periods
      .filter((p) => p.startMinutes >= from)
      .slice(0, RUN_LENGTH)
      .map((p) => p.key);
  }, [periods, periodIndex, now, day, livePeriodKey]);

  const runFree = useMemo(
    () => freeRoomsForRun(index, runKeys),
    [index, runKeys]
  );

  const free: FreeRooms = useMemo(
    () => (runOnly ? runFree : freeRoomsForPeriod(index, activePeriodKey)),
    [runOnly, runFree, index, activePeriodKey]
  );

  const metrics = useMemo(
    () => ({
      total: free.rooms.length,
      theory: free.theory.length,
      lab: free.lab.length,
      blocks: blockAvailability(index, free).length,
    }),
    [free, index]
  );

  /* ── hero ─────────────────────────────────────────────────────────────── */

  const insightSlides = useMemo<InsightSlide[]>(() => {
    const slides: InsightSlide[] = [];
    if (metrics.theory > 0) {
      slides.push({
        id: "theory",
        label: "Classrooms",
        value: metrics.theory,
        sub: "Lecture halls free now",
        badge: "Rooms",
        tone: "indigo",
      });
    }
    if (metrics.lab > 0) {
      slides.push({
        id: "lab",
        label: "Laboratories",
        value: metrics.lab,
        sub: "With benches free now",
        badge: "Labs",
        tone: "sky",
      });
    }
    const best = bestPeriod(index);
    if (best) {
      slides.push({
        id: "best",
        label: "Emptiest period",
        value: best.free,
        sub: best.period.label,
        badge: "Best",
        tone: "violet",
        onClick: () => {
          setRunOnly(false);
          setPeriodKey(best.period.key);
        },
      });
    }
    if (runFree.rooms.length > 0) {
      slides.push({
        id: "run",
        label: `Free for ${RUN_LENGTH} periods`,
        value: runFree.rooms.length,
        sub: `From ${periods[periodIndex]?.label ?? "now"} onward`,
        badge: "Stay",
        tone: "emerald",
        onClick: () => {
          setRunOnly((v) => !v);
          setBlockFilter("All");
          setQuery("");
        },
      });
    }
    return slides;
  }, [metrics, index, runFree, periods, periodIndex]);

  const carousel = useCarousel(insightSlides.length, 8000);

  /* ── list ─────────────────────────────────────────────────────────────── */

  const visibleBlocks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return blockAvailability(index, free)
      .filter((b) => blockFilter === "All" || b.block === blockFilter)
      .map((b) => {
        const match = (code: string) => !q || code.toLowerCase().includes(q);
        const theory = b.freeTheory.filter(match);
        const lab = b.freeLab.filter(match);
        return { ...b, theory, lab, free: theory.length + lab.length };
      })
      .filter((b) => b.free > 0);
  }, [index, free, blockFilter, query]);

  const blockTabs = useMemo(
    () => [
      { value: "All", label: "All blocks" },
      ...blockAvailability(index, free).map((b) => ({
        value: b.block,
        label: `${b.block} · ${b.free}`,
      })),
    ],
    [index, free]
  );

  const handleCopy = useCallback((code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
  }, []);

  const jumpToNow = useCallback(() => {
    const target = now.isLive && now.period ? now.period : periods[0];
    if (!target) return;
    setDay(now.day);
    setPeriodKey(target.key);
    setRunOnly(false);
  }, [now, periods]);

  /* ── inspector ────────────────────────────────────────────────────────── */

  /**
   * The timeline for the room, on the day the *sheet* is looking at.
   *
   * `inspectDay` is the sheet's own day, deliberately not the page's: checking
   * whether a room is free on Thursday is a question about the room, and
   * answering it should not yank the free-room list out from under you. It
   * re-syncs whenever the sheet opens, so it always starts on the day you are
   * actually looking at.
   */
  const inspect = week.get(inspectDay) ?? shown;
  const timeline = useMemo(() => {
    if (!inspectedRoom) return [];
    const inRoom = inspect.index.courses.get(inspectedRoom) ?? [];
    return inspect.periods.map((p) => {
      const slots = inspect.slots.get(p.key) ?? new Set<string>();
      const occupying = inRoom.find((c) =>
        String(c.SLOT ?? "")
          .split("+")
          .map((s) => s.trim().toUpperCase())
          .some((s) => slots.has(s))
      );
      return {
        period: p,
        course: occupying ?? null,
        // Only meaningful on the day the page is also showing, so browsing the
        // week does not claim a period is "selected" that the list is not on.
        isSelected: inspectDay === day && p.key === activePeriodKey,
      };
    });
  }, [inspectedRoom, inspect, inspectDay, day, activePeriodKey]);

  // Re-sync the sheet's day to the page's whenever the sheet opens, so it
  // never starts on a day you did not choose.
  useEffect(() => {
    if (inspectedRoom) setInspectDay(day);
  }, [inspectedRoom, day]);

  const isLiveSlot = now.isLive && day === now.day && activePeriodKey === livePeriodKey;

  /* ── render ───────────────────────────────────────────────────────────── */

  return (
    <PageShell
      onBack={onBack}
      eyebrow="Free Classrooms"
      title="Find an empty room"
      subtitle="Every room on campus, checked against the FFCS timetable."
      actions={
        <IconButton title="Reload timetable" onClick={() => load(true)}>
          <RefreshCcw className={loading ? "animate-spin" : ""} />
        </IconButton>
      }
      selectable
    >
      {/* ── HERO ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Skeleton className="h-32 sm:h-36 rounded-[24px]" />
          <Skeleton className="h-32 sm:h-36 rounded-[24px]" />
        </div>
      ) : error ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={jumpToNow}
              title="Jump to the current period"
              className="w-full text-left cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.98]"
            >
              <StatTile
                label="Free now"
                value={metrics.total}
                sub={`${metrics.blocks} ${metrics.blocks === 1 ? "block" : "blocks"} with space`}
                badge={isLiveSlot ? "Live" : "Selected"}
                tone={isLiveSlot ? "emerald" : "indigo"}
              />
            </button>
            <InsightCarousel
              slides={insightSlides}
              carousel={carousel}
              height="h-32 sm:h-36"
              ariaLabel="Availability insights"
            />
          </div>

          <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
            {isLiveSlot
              ? "Live: this is the period running now. A room is free when no course is booked into it for this slot — tap any room number to copy it, or its arrow to see the whole day."
              : "Not the current period, so these are the rooms free for the time you picked. Tap the headline to jump back to now."}
          </p>
        </>
      )}

      {/* ── WHEN ── */}
      {!loading && !error && (
        <div className="space-y-4">
          <SectionHeader
            icon={Clock}
            title="When"
            right={
              isLiveSlot ? (
                <ToneBadge tone="emerald">Right now</ToneBadge>
              ) : (
                <GhostButton onClick={jumpToNow} title="Jump to the current period">
                  <Zap className="w-3.5 h-3.5" />
                  Now
                </GhostButton>
              )
            }
          />

          {/* Day. Five short options, so a segmented control; today is ringed
              and emerald because "today" is a different fact from "selected". */}
          <DayPicker value={day} onChange={setDay} today={now.day} />

          {/* Period. A stepper for stepping and the amazeui dropdown for jumping —
              twelve periods is too many to scan and too many to scroll. */}
          <div className="flex items-center gap-2">
            <IconButton
              title="Previous period"
              onClick={() => setPeriodKey(periods[Math.max(0, periodIndex - 1)]?.key ?? activePeriodKey)}
              className={cn(periodIndex === 0 && "opacity-40 pointer-events-none")}
            >
              <ChevronLeft />
            </IconButton>

            <OptionPicker
              value={activePeriodKey}
              onChange={setPeriodKey}
              options={periods.map((p) => ({ value: p.key, label: p.label }))}
              searchable={false}
              // amazeui hard-codes the trigger's own chrome, so the size is
              // corrected through the wrapper — react-native-web renders it as
              // the wrapper's first child, and pinning to `:first-child` keeps a
              // change off the mobile modal, which is also a child div.
              className="flex-1 [&>div:first-child]:h-11 [&>div:first-child]:rounded-xl [&>div:first-child]:px-3.5 [&>div:first-child]:text-sm [&>div:first-child]:font-bold [&>div:first-child]:font-outfit"
            />

            <IconButton
              title="Next period"
              onClick={() =>
                setPeriodKey(periods[Math.min(periods.length - 1, periodIndex + 1)]?.key ?? activePeriodKey)
              }
              className={cn(
                periodIndex === periods.length - 1 && "opacity-40 pointer-events-none"
              )}
            >
              <ChevronRight />
            </IconButton>

            <span className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 tabular-nums shrink-0 hidden xs:inline">
              {positionLabel(periodIndex, periods.length)}
            </span>
          </div>
        </div>
      )}

      {/* ── ROOMS ── */}
      {error ? (
        <EmptyPanel
          tone="red"
          icon={<DoorOpen className="w-7 h-7" />}
          title="Couldn't load the timetable"
          description={error}
          action={
            <GhostButton onClick={() => load(true)}>
              <RefreshCcw className="w-3.5 h-3.5" />
              Try again
            </GhostButton>
          }
        />
      ) : loading ? (
        <ListSkeleton rows={6} leading="dot" />
      ) : (
        <div className="space-y-4">
          <SectionHeader
            icon={Building2}
            title="Rooms"
            count={visibleBlocks.reduce((n, b) => n + b.free, 0)}
            right={
              <SegmentedControl
                options={[
                  { value: "all" as const, label: `All (${metrics.total})` },
                  { value: "theory" as const, label: `Rooms (${metrics.theory})` },
                  { value: "lab" as const, label: `Labs (${metrics.lab})` },
                ]}
                value={kindFilter}
                onChange={setKindFilter}
              />
            }
          />

          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter rooms, e.g. 208 or AB5…"
                aria-label="Filter rooms"
                className={cn(SEARCH_FIELD, "pl-10 pr-10")}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear filter"
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {runOnly && (
                <button
                  type="button"
                  onClick={() => setRunOnly(false)}
                  className={cn(TONE_BADGE.emerald, "cursor-pointer hover:opacity-80")}
                  title="Stop filtering to the multi-period run"
                >
                  Free for {RUN_LENGTH} periods ✕
                </button>
              )}
            </div>

            {blockTabs.length > 2 && (
              <ChipTabs
                options={blockTabs}
                value={blockFilter}
                onChange={setBlockFilter}
                size="sm"
              />
            )}
          </div>

          {visibleBlocks.length === 0 ? (
            <EmptyPanel
              icon={<DoorOpen className="w-7 h-7" />}
              title="Nothing free here"
              description={
                blockFilter === "All"
                  ? "Every room on campus is taken for this period. Try another time — the emptiest period of the day is on the tile above."
                  : `No rooms free in ${blockFilter} for this period. Try "All blocks", or another time.`
              }
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  {blockFilter !== "All" && (
                    <GhostButton onClick={() => setBlockFilter("All")}>All blocks</GhostButton>
                  )}
                  <GhostButton onClick={jumpToNow}>
                    <Zap className="w-3.5 h-3.5" />
                    Jump to now
                  </GhostButton>
                </div>
              }
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {visibleBlocks.map((block) => {
                const rooms = [
                  ...(kindFilter === "lab" ? [] : block.theory),
                  ...(kindFilter === "theory" ? [] : block.lab),
                ];
                const shown = expanded[block.block] ? rooms : rooms.slice(0, ROW_CAP);
                const hidden = rooms.length - shown.length;
                const pct = block.total > 0 ? Math.round((block.free / block.total) * 100) : 0;

                return (
                  <div key={block.block} className={cn(TILE_CARD, "space-y-3.5")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                          <Building2 className="w-4.5 h-4.5" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight truncate">
                            {block.block} Block
                          </h3>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium tabular-nums">
                            {block.free} of {block.total} free
                          </p>
                        </div>
                      </div>
                      <ToneBadge tone={block.free >= 20 ? "emerald" : block.free >= 5 ? "amber" : "zinc"}>
                        {pct}%
                      </ToneBadge>
                    </div>

                    {/* How empty the block is — the question you pick a block by. */}
                    <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <m.div
                        className="h-full rounded-full bg-emerald-500"
                        initial={false}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {shown.map((code) => (
                        <RoomChip
                          key={code}
                          code={code}
                          kind={index.rooms.get(code)?.kind ?? "theory"}
                          onCopy={handleCopy}
                          onInspect={setInspectedRoom}
                          copied={copied === code}
                        />
                      ))}
                    </div>

                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [block.block]: true }))}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                      >
                        +{hidden} more in {block.block}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {expanded[block.block] && rooms.length > ROW_CAP && (
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [block.block]: false }))}
                        className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 hover:underline cursor-pointer"
                      >
                        Show fewer
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── ROOM INSPECTOR ── */}
      {inspectedRoom && (
        <BottomSheet
          onClose={() => setInspectedRoom(null)}
          overlayId="room-inspector"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-left">
            <div className={cn(TILE_CARD, "flex items-center justify-between gap-3")}>
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <DoorOpen className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-black text-zinc-900 dark:text-white font-outfit tracking-tight truncate">
                    {inspectedRoom}
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    {DAY_LABELS[inspectDay].full} ·{" "}
                    {timeline.filter((t) => !t.course).length}/{timeline.length} free
                  </p>
                </div>
              </div>
              <GhostButton
                onClick={() => handleCopy(inspectedRoom)}
                title="Copy room code"
                className="shrink-0"
              >
                {copied === inspectedRoom ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </GhostButton>
            </div>

            {/* The room's own week. Scoped to the sheet: browsing days here
                answers "when is this room free?" without moving the list. */}
            <DayPicker value={inspectDay} onChange={setInspectDay} today={now.day} compact />

            {inspectDay !== day && (
              <button
                type="button"
                onClick={() => setDay(inspectDay)}
                className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Show {DAY_LABELS[inspectDay].full} in the list
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            <ListShell>
              {timeline.map(({ period, course, isSelected }) => (
                <ListRow
                  key={`${inspectDay}-${period.key}`}
                  icon={<Clock className="w-4 h-4" />}
                  title={period.label}
                  subtitle={
                    course
                      ? `${course.TITLE || course.CODE}${course.FACULTY ? ` · ${course.FACULTY}` : ""}`
                      : "Free and available"
                  }
                  tone={course ? "zinc" : "emerald"}
                  badge={course ? "Taken" : "Free"}
                  selected={isSelected}
                  // Takes the list to this day and period together, so
                  // "it's free Thursday 2 PM" turns into the list of rooms
                  // that are free Thursday 2 PM.
                  onClick={() => {
                    setDay(inspectDay);
                    setPeriodKey(period.key);
                  }}
                />
              ))}
            </ListShell>
          </div>
        </BottomSheet>
      )}
    </PageShell>
  );
}

/** One line of the room's day, in the course-subpage row shape. */
function ListRow({
  icon,
  title,
  subtitle,
  tone,
  badge,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tone: string;
  badge: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        LIST_ROW,
        "gap-3 cursor-pointer",
        selected && "bg-indigo-50/60 dark:bg-indigo-950/20"
      )}
    >
      <span
        className={cn(
          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
          tone === "emerald"
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200/60 dark:border-zinc-700/60 text-zinc-500 dark:text-zinc-400"
        )}
      >
        {icon}
      </span>
      <ListRowText title={title} subtitle={subtitle} />
      {selected && <DotPill tone="indigo">Selected</DotPill>}
      <ToneBadge tone={tone}>{badge}</ToneBadge>
    </button>
  );
}
