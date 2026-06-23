import { useState } from "react";
import { TimetableState } from "../types";

export const useGeneratorState = () => {
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(false);
  const [generatorPreference, setGeneratorPreference] = useState<'none' | 'morning' | 'evening'>('none');
  const [generatorUniqueFaculties, setGeneratorUniqueFaculties] = useState(false);
  const [generatorNoLimit, setGeneratorNoLimit] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [stagedTimetables, setStagedTimetables] = useState<TimetableState[]>([]);
  const [selectedStagedIds, setSelectedStagedIds] = useState<Set<string>>(new Set());
  
  const [generatorMinHalfDays, setGeneratorMinHalfDays] = useState<number>(0);
  const [generatorMinStartTime, setGeneratorMinStartTime] = useState<string>("08:00");
  const [generatorMaxEndTime, setGeneratorMaxEndTime] = useState<string>("19:30");
  const [generatorSortBy, setGeneratorSortBy] = useState<"social" | "halfdays" | "compactness" | "balanced">("balanced");
  
  const [generatorPreviewTimetable, setGeneratorPreviewTimetable] = useState<TimetableState | null>(null);

  const [generatorCourseSearchQuery, setGeneratorCourseSearchQuery] = useState("");

  return {
    isGeneratorOpen,
    setIsGeneratorOpen,
    generatorPreference,
    setGeneratorPreference,
    generatorUniqueFaculties,
    setGeneratorUniqueFaculties,
    generatorNoLimit,
    setGeneratorNoLimit,
    isGenerating,
    setIsGenerating,
    stagedTimetables,
    setStagedTimetables,
    selectedStagedIds,
    setSelectedStagedIds,
    generatorMinHalfDays,
    setGeneratorMinHalfDays,
    generatorMinStartTime,
    setGeneratorMinStartTime,
    generatorMaxEndTime,
    setGeneratorMaxEndTime,
    generatorSortBy,
    setGeneratorSortBy,
    generatorPreviewTimetable,
    setGeneratorPreviewTimetable,
    generatorCourseSearchQuery,
    setGeneratorCourseSearchQuery
  };
};
