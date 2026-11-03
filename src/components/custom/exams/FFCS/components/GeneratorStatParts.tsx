"use client";

/**
 * The generator's stat-and-results furniture: the responsive KPI strip (measure
 * the row, keep as many 280px tiles as fit, rotate the rest through
 * InsightCarousel) and the staged result card that pauses a long list behind a
 * "Show more". Extracted verbatim from FFCSGeneratorSubpage; the shared tile-fit
 * helpers stay in FFCSDashboardHeader, which this module imports.
 */

import React, { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, Users } from "lucide-react";
import { StatTile, InsightCarousel, useCarousel, type InsightSlide } from "../../../shared/primitives";
import { getFittingStatTileCount, STAT_TILE_MIN_WIDTH } from "./FFCSDashboardHeader";
import type { TimetableState } from "@/lib/ffcsTypes";
import { getTimetableSchema } from "@/lib/campusSchema";
import { DAYS_OF_WEEK } from "@/lib/slots";
import { dayOccupancy, formatHours } from "@/lib/timetableMetrics";

export type GeneratorStatTile = {
  id: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  badge?: ReactNode;
  tone: string;
  icon?: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  focusRingClass?: string;
};

/**
 * Same fit → overflow → InsightCarousel behaviour as the planner dashboard
 * strip: measure the row, keep as many 280px tiles as fit, and rotate the rest.
 */
export function ResponsiveStatStrip({
  tiles,
  preferredId,
  ariaLabel,
  carouselAriaLabel,
  testId,
}: {
  tiles: GeneratorStatTile[];
  preferredId: string;
  ariaLabel: string;
  carouselAriaLabel: string;
  testId?: string;
}) {
  const statsContainerRef = useRef<HTMLDivElement>(null);
  const [statTileCount, setStatTileCount] = useState(4);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      const updateViewport = () => setIsMobileViewport(window.innerWidth < 768);
      updateViewport();
      window.addEventListener("resize", updateViewport);
      return () => window.removeEventListener("resize", updateViewport);
    }
    const media = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobileViewport(media.matches);
    updateViewport();
    media.addEventListener("change", updateViewport);
    return () => media.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    const container = statsContainerRef.current;
    if (!container) return;

    const updateCount = (width: number) => {
      if (width > 0) setStatTileCount(getFittingStatTileCount(width));
    };

    updateCount(container.getBoundingClientRect().width);
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(([entry]) => updateCount(entry.contentRect.width));
      observer.observe(container);
      return () => observer.disconnect();
    }

    const handleResize = () => updateCount(container.getBoundingClientRect().width);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const statSlides = useMemo<InsightSlide[]>(
    () =>
      tiles.map((tile) => ({
        id: tile.id,
        label: tile.label,
        value: tile.value,
        sub: tile.sub,
        badge: tile.badge,
        tone: tile.tone,
        onClick: tile.onClick,
        valueClassName: "text-xl sm:text-2xl leading-tight whitespace-normal break-words",
      })),
    [tiles],
  );

  const hasStatOverflow = tiles.length > statTileCount;
  const directTileCount = hasStatOverflow ? Math.max(0, statTileCount - 1) : tiles.length;
  const preferredTile = tiles.find((tile) => tile.id === preferredId);
  const desktopDirectTiles = hasStatOverflow
    ? [
        ...(directTileCount > 0 && preferredTile ? [preferredTile] : []),
        ...tiles
          .filter((tile) => tile.id !== preferredId)
          .slice(0, directTileCount - (directTileCount > 0 && preferredTile ? 1 : 0)),
      ]
    : tiles;
  const mobileDirectTiles = [
    ...(preferredTile ? [preferredTile] : []),
    ...tiles.filter((tile) => tile.id !== preferredId),
  ].slice(0, 1);
  const directTiles = isMobileViewport ? mobileDirectTiles : desktopDirectTiles;
  const directStatIds = new Set(directTiles.map((tile) => tile.id));
  const overflowSlides = statSlides.filter((slide) => !directStatIds.has(slide.id));
  const statCarousel = useCarousel(overflowSlides.length);
  const statColumnCount = isMobileViewport ? 2 : Math.max(1, directTiles.length + (overflowSlides.length > 0 ? 1 : 0));

  if (tiles.length === 0) return null;

  return (
    <div
      ref={statsContainerRef}
      data-testid={testId}
      aria-label={ariaLabel}
      className="grid gap-3"
      style={{
        gridTemplateColumns: isMobileViewport
          ? "repeat(2, minmax(0, 1fr))"
          : `repeat(${statColumnCount}, minmax(min(100%, ${STAT_TILE_MIN_WIDTH}px), ${STAT_TILE_MIN_WIDTH}px))`,
      }}
    >
      {directTiles.map((tile) => {
        const statTile = (
          <StatTile
            label={tile.label}
            value={tile.value}
            sub={tile.sub}
            badge={tile.badge}
            icon={tile.icon}
            tone={tile.tone}
            height="h-28 sm:h-32"
            className={tile.onClick ? "" : (tile.className ?? "")}
          />
        );
        if (!tile.onClick) {
          return <React.Fragment key={tile.id}>{statTile}</React.Fragment>;
        }
        return (
          <button
            key={tile.id}
            type="button"
            onClick={tile.onClick}
            aria-label={tile.ariaLabel ?? tile.label}
            className={`min-w-0 text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 ${
              tile.focusRingClass ?? "focus-visible:ring-indigo-500"
            }`}
          >
            {statTile}
          </button>
        );
      })}
      {overflowSlides.length > 0 && (
        <InsightCarousel
          slides={overflowSlides}
          carousel={statCarousel}
          height="h-28 sm:h-32"
          ariaLabel={carouselAriaLabel}
          className="min-w-0"
        />
      )}
    </div>
  );
}

/**
 * A single staged option card.
 *
 * Extracted from the grid's inline map as the render-side half of the
 * streaming freeze fix, alongside the render window: a watched run moved the
 * progress line and the option list many times a second, and the inline map
 * re-diffed every card on every tick — reading thousands of subtrees for
 * content that had not changed.
 *
 * Its props are chosen so that streaming re-renders cannot reach here at all:
 * the timetable object is replaced only when a run settles or a faculty swap
 * writes back into it, the selection set and compare set are replaced only
 * when the student clicks, and the state setters are stable — so a batch or
 * progress tick re-renders nothing, while a click still lands on exactly the
 * cards whose selection it changed.
 */
interface StagedCardProps {
  tt: TimetableState;
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  compareIds: string[];
  setCompareIds: React.Dispatch<React.SetStateAction<string[]>>;
  /** `generatorMaximizeFreeTimeFriends.length > 0`, flattened to a boolean so
   * the array's identity cannot mark the card dirty. */
  socialOn: boolean;
  onPreview: (tt: TimetableState) => void;
}

export const StagedCard = memo(function StagedCard({
  tt,
  selectedIds,
  setSelectedIds,
  compareIds,
  setCompareIds,
  socialOn,
  onPreview,
}: StagedCardProps) {
  const optionSchema = getTimetableSchema();
  const occupancyByDay = DAYS_OF_WEEK.map((day) => dayOccupancy(tt.courses, optionSchema, day));
  const occupiedClasses = occupancyByDay.flatMap((occupancy) => occupancy.classes);
  const latestEnd = occupiedClasses.slice().sort((a, b) => b.endMin - a.endMin)[0]?.end;
  const wPct = tt.facultySummary?.averageWPct;
  const wRatingTone =
    wPct == null
      ? "text-muted-foreground"
      : wPct >= 70
        ? "text-green-600 dark:text-green-400"
        : wPct >= 50
          ? "text-yellow-600 dark:text-yellow-400"
          : "text-red-600 dark:text-red-400";
  return (
    <div
      className={`relative flex flex-col bg-surface rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${selectedIds.has(tt.id) ? "border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]" : "border-border-strong hover:border-amber-500/50 hover:shadow-lg"}`}
      onClick={() => {
        const newSet = new Set(selectedIds);
        if (newSet.has(tt.id)) {
          newSet.delete(tt.id);
          if (tt.variants) tt.variants.forEach((v) => newSet.delete(v.id));
        } else {
          newSet.add(tt.id);
          if (tt.variants) tt.variants.forEach((v) => newSet.add(v.id));
        }
        setSelectedIds(newSet);
      }}
      onDoubleClick={(e) => {
        e.preventDefault();
        onPreview(tt);
      }}
    >
      <div className="p-3 sm:p-5 flex-1 flex flex-col">
        <div className="flex justify-between items-center gap-2 mb-2 sm:mb-4">
          <h3 className="font-bold text-sm sm:text-lg text-text-heading">{tt.name}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCompareIds((prev) => {
                  if (prev.includes(tt.id)) return prev.filter((id) => id !== tt.id);
                  if (prev.length >= 3) return prev; // max 3
                  return [...prev, tt.id];
                });
              }}
              className={`hidden sm:inline-flex min-h-10 sm:min-h-0 text-[10px] uppercase font-bold px-2 py-1 rounded-md border transition-colors ${compareIds.includes(tt.id) ? "bg-purple-500 text-white border-purple-500" : "bg-transparent text-muted-foreground border-border-strong hover:border-purple-500/50"}`}
            >
              Compare
            </button>
            <div className="flex items-center gap-2 text-right">
              {tt.rankingScore !== undefined && (
                <span className="font-mono text-xs font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
                  {tt.rankingScore.toFixed(0)} pts
                </span>
              )}
              {tt.facultySummary && (
                <span className={`font-mono text-xs font-bold tabular-nums ${wRatingTone}`}>
                  W {wPct == null ? "—" : `${wPct.toFixed(0)}%`}
                </span>
              )}
            </div>
            <div
              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${selectedIds.has(tt.id) ? "bg-amber-500 border-amber-500 text-white" : "border-muted-foreground/30"}`}
            >
              {selectedIds.has(tt.id) && <Check className="w-4 h-4" />}
            </div>
          </div>
        </div>

        <div className="sm:hidden mb-2 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-surface-secondary px-2 py-1 text-[10px] font-semibold text-text-secondary">
            {tt.metrics?.halfDays ?? 0} free half-days
          </span>
          <span className="rounded-md bg-surface-secondary px-2 py-1 text-[10px] font-semibold text-text-secondary">
            {formatHours(tt.metrics?.gaps ?? 0)}h gaps
          </span>
          <span className="rounded-md bg-surface-secondary px-2 py-1 text-[10px] font-semibold text-text-secondary">
            {occupancyByDay.filter((occupancy) => occupancy.classes.length > 0).length} class days
          </span>
          {latestEnd && (
            <span className="rounded-md bg-surface-secondary px-2 py-1 text-[10px] font-semibold text-text-secondary">
              ends {latestEnd}
            </span>
          )}
          {socialOn && (
            <span className="rounded-md bg-pink-500/10 px-2 py-1 text-[10px] font-semibold text-pink-600 dark:text-pink-400">
              Social {tt.metrics?.socialScore ?? 0}
            </span>
          )}
          {tt.metrics?.isLongWeekend && (
            <span className="rounded-md bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-600 dark:text-green-400">
              Long weekend
            </span>
          )}
        </div>

        <div className="hidden sm:grid grid-cols-2 gap-3 mb-4 flex-1 content-start">
          <div className="bg-surface-secondary/30 rounded-xl p-3 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-black text-text-heading">{tt.metrics?.halfDays}</span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Free Half-Days</span>
          </div>
          <div className="bg-surface-secondary/30 rounded-xl p-3 flex flex-col items-center justify-center text-center group relative">
            <span className="text-2xl font-black text-text-heading">{formatHours(tt.metrics?.gaps ?? 0)}h</span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Gaps</span>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[200px] bg-slate-900 text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 active:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl grid grid-cols-2 gap-x-3 gap-y-1">
              {Object.entries(tt.metrics?.gapsPerDay || {}).map(([day, gap]) => (
                <div key={day} className="flex justify-between gap-3">
                  <span className="font-bold text-slate-400 uppercase">{day}</span>
                  <span>{formatHours(gap)}h</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {tt.facultySummary && (
          <div className="hidden sm:block mb-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-indigo-600 dark:text-indigo-300">Faculty reviews</span>
              <span className="font-semibold text-text-heading">
                {tt.facultySummary.averageWPct == null
                  ? "No ratings"
                  : `${tt.facultySummary.averageWPct.toFixed(1)}% W`}
              </span>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {tt.facultySummary.ratedFacultyCount} reviewed · {tt.facultySummary.unratedFacultyCount} unrated
            </p>
          </div>
        )}

        {tt.metrics?.isLongWeekend && (
          <div className="hidden sm:flex bg-green-500/10 text-green-500 text-xs font-bold px-3 py-2 rounded-xl w-full mb-3 items-center justify-center gap-1.5">
            Long Weekend!
          </div>
        )}
        {(tt.metrics?.buildingDashes ?? 0) > 0 && (
          <div className="hidden sm:flex bg-red-500/10 text-red-500 text-xs font-bold px-3 py-2 rounded-xl w-full mb-3 items-center justify-center gap-1.5">
            {tt.metrics?.buildingDashes} Block Dash{(tt.metrics?.buildingDashes ?? 0) > 1 ? "es" : ""}
          </div>
        )}

        {socialOn && (
          <div className="hidden sm:block bg-pink-500/5 border border-pink-500/20 rounded-xl p-3 mt-auto mb-3">
            <div className="text-xs font-bold text-pink-500 mb-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Social Score: {tt.metrics?.socialScore}
            </div>
            <div
              className="text-[10px] text-muted-foreground truncate"
              title={tt.metrics?.bestFriendMatches.join(", ")}
            >
              Matches best with:{" "}
              <span className="font-medium text-text-heading">
                {tt.metrics?.bestFriendMatches.join(", ") || "None"}
              </span>
            </div>
          </div>
        )}

        <div className="sm:hidden mt-auto flex gap-2 border-t border-border-strong/50 pt-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPreview(tt);
            }}
            aria-label={`Preview ${tt.name}`}
            className="min-h-10 flex-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 text-xs font-bold text-indigo-700 dark:text-indigo-300"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setCompareIds((prev) => {
                if (prev.includes(tt.id)) return prev.filter((id) => id !== tt.id);
                if (prev.length >= 3) return prev;
                return [...prev, tt.id];
              });
            }}
            aria-pressed={compareIds.includes(tt.id)}
            className={`min-h-10 flex-1 rounded-lg border px-3 text-xs font-bold ${
              compareIds.includes(tt.id)
                ? "border-purple-500 bg-purple-500 text-white"
                : "border-border-strong bg-surface text-muted-foreground"
            }`}
          >
            {compareIds.includes(tt.id) ? "Comparing" : "Compare"}
          </button>
        </div>

        {tt.variants && tt.variants.length > 1 && (
          <div className="hidden sm:block mt-auto pt-4 border-t border-border-strong/50">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase">Faculty Variants</span>
              <span className="text-[10px] bg-surface-secondary px-2 py-0.5 rounded-full">
                {tt.variants.length} available
              </span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
              {tt.variants.slice(0, 50).map((v, vIdx) => {
                const isSelected = selectedIds.has(v.id);
                return (
                  <div
                    key={v.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSet = new Set(selectedIds);
                      if (isSelected) newSet.delete(v.id);
                      else newSet.add(v.id);

                      if (isSelected && newSet.has(tt.id)) newSet.delete(tt.id);
                      if (!isSelected && !newSet.has(tt.id)) newSet.add(tt.id);

                      setSelectedIds(newSet);
                    }}
                    className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${isSelected ? "bg-amber-500/10 border-amber-500/50 text-text-heading" : "bg-surface border-border-strong text-muted-foreground hover:border-amber-500/30"}`}
                  >
                    <span className="font-medium">Variant {vIdx + 1}</span>
                    <div
                      className={`w-4 h-4 rounded-sm border flex items-center justify-center ${isSelected ? "bg-amber-500 border-amber-500 text-white" : "border-muted-foreground/30"}`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                  </div>
                );
              })}
              {tt.variants.length > 50 && (
                <div className="p-2 text-xs text-center text-muted-foreground bg-surface-secondary/20 rounded-lg">
                  + {tt.variants.length - 50} more variations
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
