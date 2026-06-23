import { useState, useEffect } from "react";
import { TimetableState } from "../types";

export const useTimetables = () => {
  const [timetables, setTimetables] = useState<TimetableState[]>([
    { id: "default", name: "Draft 1", courses: [] }
  ]);
  const [activeTimetableId, setActiveTimetableId] = useState<string>("default");
  const [blockedSlots, setBlockedSlots] = useState<Set<string>>(new Set());

  // Modals / UI state specific to timetables
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [selectedTimetablesToCompare, setSelectedTimetablesToCompare] = useState<string[]>([]);
  
  // Dashboard details modal state
  const [selectedDashDetails, setSelectedDashDetails] = useState<NonNullable<TimetableState['metrics']>['dashDetails'] | null>(null);
  const [selectedGapDetails, setSelectedGapDetails] = useState<NonNullable<TimetableState['metrics']>['gapDetails'] | null>(null);

  useEffect(() => {
    try {
      const savedTimetables = localStorage.getItem("ffcs_timetables");
      if (savedTimetables) setTimetables(JSON.parse(savedTimetables));
    } catch (e) {
      console.error("Failed to parse saved timetables", e);
    }
    
    try {
      const savedActive = localStorage.getItem("ffcs_activeTimetableId");
      if (savedActive) setActiveTimetableId(savedActive);
    } catch (e) {
      console.error("Failed to parse saved active timetable id", e);
    }
    
    try {
      const savedBlocked = localStorage.getItem("ffcs_blockedSlots");
      if (savedBlocked) setBlockedSlots(new Set(JSON.parse(savedBlocked)));
    } catch (e) {
      console.error("Failed to parse saved blocked slots", e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("ffcs_timetables", JSON.stringify(timetables));
    localStorage.setItem("ffcs_activeTimetableId", activeTimetableId);
    localStorage.setItem("ffcs_blockedSlots", JSON.stringify(Array.from(blockedSlots)));
  }, [timetables, activeTimetableId, blockedSlots]);

  const activeTimetable = timetables.find(t => t.id === activeTimetableId) || timetables[0];

  const updateActiveTimetable = (updates: Partial<TimetableState>) => {
    setTimetables(prev => prev.map(t => t.id === activeTimetableId ? { ...t, ...updates } : t));
  };

  const deleteTimetable = (id: string) => {
    if (timetables.length <= 1) return;
    const newTimetables = timetables.filter(t => t.id !== id);
    setTimetables(newTimetables);
    if (activeTimetableId === id) setActiveTimetableId(newTimetables[0].id);
  };

  const createTimetable = (name: string) => {
    const newId = crypto.randomUUID();
    setTimetables(prev => [...prev, { id: newId, name, courses: [], lockedCourses: [] }]);
    setActiveTimetableId(newId);
  };

  const duplicateTimetable = (id: string) => {
    const toDuplicate = timetables.find(t => t.id === id);
    if (!toDuplicate) return;
    const newId = crypto.randomUUID();
    setTimetables(prev => [...prev, { ...toDuplicate, id: newId, name: `${toDuplicate.name} (Copy)` }]);
    setActiveTimetableId(newId);
  };

  return {
    timetables,
    setTimetables,
    activeTimetableId,
    setActiveTimetableId,
    activeTimetable,
    updateActiveTimetable,
    deleteTimetable,
    createTimetable,
    duplicateTimetable,
    blockedSlots,
    setBlockedSlots,
    isEditingName,
    setIsEditingName,
    editNameValue,
    setEditNameValue,
    isCompareModalOpen,
    setIsCompareModalOpen,
    selectedTimetablesToCompare,
    setSelectedTimetablesToCompare,
    selectedDashDetails,
    setSelectedDashDetails,
    selectedGapDetails,
    setSelectedGapDetails,
  };
};
