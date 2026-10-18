"use client";

import React, { useState } from "react";
import {
  ArrowUpDown,
  ChevronRight,
  Layers,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { CoursePredictionResult } from "@/lib/marksPredictor";
import {
  ChipTabs,
  EmptyPanel,
  KeyValue,
  SectionHeader,
  StatTile,
  ToneBadge,
} from "../../shared/primitives";
import { CHIP, SEARCH_FIELD, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";
import { toneForGrade } from "@/lib/gradeHistory";

interface AllCoursesMatrixProps {
  predictions: CoursePredictionResult[];
  onSelectCourse: (courseCode: string) => void;
}

type SortField = "deficit" | "maxPossible" | "code" | "scored";

export default function AllCoursesMatrix({
  predictions,
  onSelectCourse,
}: AllCoursesMatrixProps) {
  const [sortField, setSortField] = useState<SortField>("deficit");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const filtered = predictions.filter(
    (p) =>
      p.courseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.courseTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sortField === "deficit") return b.pointsLostScaled - a.pointsLostScaled;
    if (sortField === "maxPossible") return b.maxPossibleScaled - a.maxPossibleScaled;
    if (sortField === "scored") return b.currentScoredScaled - a.currentScoredScaled;
    return a.courseCode.localeCompare(b.courseCode);
  });

  const totalPointsLostAcrossAll = predictions.reduce((s, p) => s + p.pointsLostScaled, 0);
  const avgCeiling = predictions.length > 0
    ? predictions.reduce((s, p) => s + p.maxPossibleScaled, 0) / predictions.length
    : 100;

  return (
    <div className="w-full max-w-full overflow-hidden space-y-3.5">
      {/* Overview */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4">
        <StatTile
          label="Courses tracked"
          value={predictions.length}
          badge="All time"
          tone="indigo"
          sub="across this semester"
          icon={
            <span className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.indigo}`}>
              <Layers className="h-4.5 w-4.5" />
            </span>
          }
        />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatTile
            label="Avg ceiling"
            value={`${avgCeiling.toFixed(1)}%`}
            badge="Max"
            tone="emerald"
            sub="mean max possible"
            height="h-28"
            icon={
              <span className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.emerald}`}>
                <TrendingUp className="h-4.5 w-4.5" />
              </span>
            }
          />
          <StatTile
            label="Total deficit"
            value={totalPointsLostAcrossAll > 0 ? `-${totalPointsLostAcrossAll.toFixed(1)}` : "0.0"}
            badge={totalPointsLostAcrossAll > 0 ? "Behind" : "Clean"}
            tone={totalPointsLostAcrossAll > 0 ? "red" : "emerald"}
            sub="points lost overall"
            height="h-28"
            icon={
              <span className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center ${TONE_ICON_TILE.red}`}>
                <TrendingDown className="h-4.5 w-4.5" />
              </span>
            }
          />
        </div>
      </div>

      {/* Search + Sort — stacks on mobile */}
      <div className="space-y-3">
        <SectionHeader icon={ArrowUpDown} title="All courses" count={sorted.length} />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter courses..."
          className={SEARCH_FIELD}
        />
        <ChipTabs
          value={sortField}
          onChange={setSortField}
          options={[
            { value: "deficit", label: "Highest Deficit" },
            { value: "maxPossible", label: "Max Possible" },
            { value: "scored", label: "Highest Scored" },
            { value: "code", label: "Code" },
          ]}
        />
      </div>

      {/* Single-column list on mobile — never overflows */}
      {sorted.length === 0 ? (
        <EmptyPanel
          variant="dashed"
          title="No courses match this filter"
          description="Try a different search, or add a custom subject to simulate."
        />
      ) : (
      <div className="space-y-2.5">
        {sorted.map((p) => {
          const isHighDeficit = p.pointsLostScaled > 15;
          const isModerateDeficit = p.pointsLostScaled > 5;

          return (
            <button
              key={p.courseCode}
              type="button"
              onClick={() => onSelectCourse(p.courseCode)}
              className={`${TILE_CARD} w-full max-w-full text-left cursor-pointer transition-colors hover:border-border-strong dark:hover:border-border group flex flex-col gap-3`}
            >
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <span className={CHIP}>
                    {p.courseCode}
                  </span>
                  <h4 className="text-sm font-black text-zinc-900 dark:text-white font-outfit mt-1.5 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {p.courseTitle}
                  </h4>
                  <p className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500 mt-1 truncate">
                    {p.courseType} • {p.totalCredits} Credits {p.isEmbedded ? "(Embedded)" : ""}
                  </p>
                </div>
                <ToneBadge tone={toneForGrade(p.estimatedGrade.letter)} size="lg">
                  {p.estimatedGrade.letter}
                </ToneBadge>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <KeyValue label="Max possible" value={`${p.maxPossibleScaled.toFixed(1)}%`} />
                <KeyValue
                  label="Points lost"
                  value={p.pointsLostScaled > 0 ? `-${p.pointsLostScaled.toFixed(1)}` : "0.0"}
                  valueClassName={
                    isHighDeficit
                      ? "text-red-600 dark:text-red-400"
                      : isModerateDeficit
                        ? "text-amber-600 dark:text-amber-400"
                        : undefined
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-2 min-w-0">
                <span className="text-[11px] font-bold text-zinc-400 truncate">
                  Locked: <strong className="text-zinc-700 dark:text-zinc-300">{p.currentScoredScaled.toFixed(1)} pts</strong>
                </span>
                <span className="flex items-center gap-1 font-black text-indigo-600 dark:text-indigo-400 text-xs shrink-0">
                  <span>Simulate</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}
