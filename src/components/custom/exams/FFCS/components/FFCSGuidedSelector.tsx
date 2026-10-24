"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  ArrowLeft,
  ArrowRight,
  Check,
  AlertTriangle,
  Users,
  Sparkles,
  BookOpen,
  Clock,
  CheckCircle2,
  PlusCircle,
  RotateCcw,
} from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import { ChipTabs, SegmentedControl, Switch } from "../../../shared/primitives";
import SearchInput from "../../../shared/SearchInput";
import { FacultyAvatar, VitfacReviewPill } from "./FacultyReviewSheet";
import { ParsedCourse, AddedCourse, TimetableState } from "../types";
import { COLORS } from "../constants";
import { splitSlots, sameSlotFacultyAlternatives } from "../logic/generate";

export interface FFCSGuidedSelectorProps {
  masterCourses: ParsedCourse[];
  uniqueCourses: { code: string; title: string; types: string[]; batches: string[] }[];
  courses: AddedCourse[];
  activeTimetable: TimetableState;
  onAddCourse: (newCourse: AddedCourse) => void;
  checkClashes: (slots: string[]) => string | null;
  isGroupingEnabled: boolean;
  setIsGroupingEnabled: (enabled: boolean) => void;
  renderTypeChips: (types: string[] | string, size?: 'sm' | 'md') => React.ReactNode;
  getBatchColorClass: (batch: string) => string;
  courseAlternativesPool: ParsedCourse[];
  onOpenFacultyReview: (target: { name: string; employeeId?: string; courseCode?: string }) => void;
  onOpenPasteRegistered: () => void;
  onOpenManualLinker: () => void;
  onViewTimetable?: () => void;
}

type GuidedStep = 1 | 2 | 3;

export default function FFCSGuidedSelector({
  masterCourses,
  uniqueCourses,
  courses,
  activeTimetable,
  onAddCourse,
  checkClashes,
  isGroupingEnabled,
  setIsGroupingEnabled,
  renderTypeChips,
  getBatchColorClass,
  courseAlternativesPool,
  onOpenFacultyReview,
  onOpenPasteRegistered,
  onOpenManualLinker,
  onViewTimetable,
}: FFCSGuidedSelectorProps) {
  const [currentStep, setCurrentStep] = useState<GuidedStep>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedCourseCode, setSelectedCourseCode] = useState<string>("");
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<string>("-1");
  const [slotFilter, setSlotFilter] = useState<string>("all");
  const [addedJustNow, setAddedJustNow] = useState<string | null>(null);

  // Available offerings for selected course with grouping logic
  const availableOfferings = useMemo(() => {
    if (!selectedCourseCode) return [];
    let slots = masterCourses.filter((c) => c.CODE === selectedCourseCode);

    if (isGroupingEnabled) {
      const hasCombined = slots.some((c) => {
        const parts = splitSlots(c.SLOT);
        return parts.some((s) => !s.startsWith("L") && s !== "NIL") && parts.some((s) => s.startsWith("L"));
      });
      if (hasCombined) {
        slots = slots.filter((c) => {
          const parts = splitSlots(c.SLOT);
          const isCombined = parts.some((s) => !s.startsWith("L") && s !== "NIL") && parts.some((s) => s.startsWith("L"));
          if (isCombined) return true;

          const facNorm = (c.FACULTY || "").trim().toLowerCase();
          const isSubset = slots.some((other) => {
            if (other === c) return false;
            const otherParts = splitSlots(other.SLOT);
            const otherIsCombined = otherParts.some((s) => !s.startsWith("L") && s !== "NIL") && otherParts.some((s) => s.startsWith("L"));
            if (!otherIsCombined) return false;
            const otherFacNorm = (other.FACULTY || "").trim().toLowerCase();
            const facMatches = otherFacNorm.includes(facNorm) || facNorm.includes(otherFacNorm);
            return facMatches && parts.every((s) => otherParts.includes(s));
          });

          return !isSubset;
        });

        const combinedOnly = slots.filter((c) => {
          const parts = splitSlots(c.SLOT);
          return parts.some((s) => !s.startsWith("L") && s !== "NIL") && parts.some((s) => s.startsWith("L"));
        });
        if (combinedOnly.length > 0) {
          slots = combinedOnly;
        }
      }
    }

    return slots;
  }, [masterCourses, selectedCourseCode, isGroupingEnabled]);

  // Filtered offerings by morning/evening
  const filteredOfferings = useMemo(() => {
    return availableOfferings.filter((row) => {
      const parts = splitSlots(row.SLOT);
      const isLabOnly = parts.every((s) => s.startsWith("L"));
      const isTheoryOnly = parts.every((s) => !s.startsWith("L"));

      if (slotFilter === "all") return true;

      if (slotFilter === "morning_session") {
        const theoryMorning = parts.some((s) => !s.startsWith("L") && s.endsWith("1"));
        const labMorning = parts.some((s) => {
          if (!s.startsWith("L")) return false;
          const num = parseInt(s.replace("L", ""), 10);
          return !isNaN(num) && num <= 30;
        });
        return theoryMorning || labMorning;
      }

      if (slotFilter === "evening_session") {
        const theoryEvening = parts.some((s) => !s.startsWith("L") && s.endsWith("2"));
        const labEvening = parts.some((s) => {
          if (!s.startsWith("L")) return false;
          const num = parseInt(s.replace("L", ""), 10);
          return !isNaN(num) && num > 30;
        });
        return theoryEvening || labEvening;
      }

      if (slotFilter === "morning") {
        return parts.some((s) => !s.startsWith("L") && s.endsWith("1"));
      }
      if (slotFilter === "evening") {
        return parts.some((s) => !s.startsWith("L") && s.endsWith("2"));
      }

      if (slotFilter === "morning_lab") {
        return parts.some((s) => {
          if (!s.startsWith("L")) return false;
          const num = parseInt(s.replace("L", ""), 10);
          return !isNaN(num) && num <= 30;
        });
      }
      if (slotFilter === "evening_lab") {
        return parts.some((s) => {
          if (!s.startsWith("L")) return false;
          const num = parseInt(s.replace("L", ""), 10);
          return !isNaN(num) && num > 30;
        });
      }

      return true;
    });
  }, [availableOfferings, slotFilter]);

  // Selected course metadata
  const selectedCourseMeta = useMemo(() => {
    return uniqueCourses.find((c) => c.code === selectedCourseCode);
  }, [uniqueCourses, selectedCourseCode]);

  // Selected offering row
  const selectedOffering = useMemo(() => {
    const idx = parseInt(selectedSlotIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= availableOfferings.length) return null;
    return availableOfferings[idx];
  }, [availableOfferings, selectedSlotIndex]);

  // Filtered course catalog
  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return uniqueCourses.filter((c) => {
      if (typeFilter !== "all") {
        const matchesType = c.types.some((t) => t.toLowerCase().includes(typeFilter.toLowerCase()));
        if (!matchesType) return false;
      }
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        (c.batches || []).some((b) => b.toLowerCase().includes(q))
      );
    });
  }, [uniqueCourses, searchQuery, typeFilter]);

  const handleSelectCourse = (code: string) => {
    setSelectedCourseCode(code);
    setSelectedSlotIndex("-1");
    setSlotFilter("all");
    setCurrentStep(2);
  };

  const handleSelectOffering = (originalIndex: number) => {
    setSelectedSlotIndex(String(originalIndex));
    setCurrentStep(3);
  };

  const handleConfirmAdd = () => {
    if (!selectedOffering || !selectedCourseMeta) return;

    const slotsArray = splitSlots(selectedOffering.SLOT);
    const newCourse: AddedCourse = {
      id: Math.random().toString(36).substr(2, 9),
      code: selectedOffering.CODE,
      title: selectedOffering.TITLE,
      slots: slotsArray,
      faculty: selectedOffering.FACULTY,
      employeeId: selectedOffering.ERP_ID,
      venue: selectedOffering.ROOM || "TBA",
      credits: selectedOffering.CREDITS || "0",
      type: selectedOffering.TYPE || "Theory",
      color: COLORS[courses.length % COLORS.length],
      batch: selectedOffering.BATCH,
    };

    onAddCourse(newCourse);
    setAddedJustNow(newCourse.code);
    setTimeout(() => setAddedJustNow(null), 4000);
  };

  const handleAddAnother = () => {
    handleConfirmAdd();
    setSelectedCourseCode("");
    setSelectedSlotIndex("-1");
    setCurrentStep(1);
  };

  const isCourseInTimetable = (code: string) => {
    return courses.some((c) => c.code === code);
  };

  return (
    <div className="w-full bg-surface border border-border-strong rounded-3xl p-4 sm:p-6 shadow-sm flex flex-col gap-5">
      {/* ── GUIDED STEPPER HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-strong/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">
            {currentStep}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-text-heading flex items-center gap-2">
              {currentStep === 1 && "Step 1: Choose a Course"}
              {currentStep === 2 && `Step 2: Pick Faculty & Slot`}
              {currentStep === 3 && "Step 3: Review & Place"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {currentStep === 1 && "Search the master course catalogue or browse by type."}
              {currentStep === 2 && `Select an offering for ${selectedCourseCode} with live clash check.`}
              {currentStep === 3 && `Confirm schedule placement into ${activeTimetable.name}.`}
            </p>
          </div>
        </div>

        {/* Stepper Pills */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto bg-surface-secondary/40 p-1 rounded-2xl border border-border-strong/50">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              currentStep === 1
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-text-heading hover:bg-surface-secondary"
            }`}
          >
            1. Course
          </button>
          <button
            type="button"
            disabled={!selectedCourseCode}
            onClick={() => selectedCourseCode && setCurrentStep(2)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              currentStep === 2
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-text-heading hover:bg-surface-secondary"
            }`}
          >
            2. Slot & Prof
          </button>
          <button
            type="button"
            disabled={!selectedOffering}
            onClick={() => selectedOffering && setCurrentStep(3)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              currentStep === 3
                ? "bg-indigo-600 text-white shadow-xs"
                : "text-muted-foreground hover:text-text-heading hover:bg-surface-secondary"
            }`}
          >
            3. Confirm
          </button>
        </div>
      </div>

      {/* ── SUCCESS NOTIFICATION ── */}
      {addedJustNow && (
        <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center justify-between animate-in fade-in duration-200">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Successfully added <strong>{addedJustNow}</strong> to <strong>{activeTimetable.name}</strong>!
          </span>
          {onViewTimetable && (
            <button
              type="button"
              onClick={onViewTimetable}
              className="underline font-semibold hover:text-emerald-700 dark:hover:text-emerald-300 ml-2"
            >
              View Grid
            </button>
          )}
        </div>
      )}

      {/* ── STEP 1: COURSE DISCOVERY ── */}
      {currentStep === 1 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1">
              <SearchInput
                placeholder="Search code (e.g. BCSE101), title, or batch..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
              <ChipTabs
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { value: "all", label: "All Types" },
                  { value: "th", label: "Theory" },
                  { value: "eth", label: "Embedded" },
                  { value: "la", label: "Lab" },
                  { value: "ss", label: "Soft Skills" },
                ]}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>Showing {filteredCourses.length} courses</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenPasteRegistered}
                className="text-purple-600 dark:text-purple-400 font-semibold hover:underline"
              >
                Paste VTOP
              </button>
              <span>·</span>
              <button
                type="button"
                onClick={onOpenManualLinker}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                Advanced Linker
              </button>
            </div>
          </div>

          {filteredCourses.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground bg-surface-secondary/20 rounded-2xl border border-dashed border-border-strong">
              No courses matching "{searchQuery}". Try searching for another code or reset the filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
              {filteredCourses.map((c) => {
                const inTimetable = isCourseInTimetable(c.code);
                const isSelected = selectedCourseCode === c.code;

                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleSelectCourse(c.code)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 group ${
                      isSelected
                        ? "bg-indigo-500/10 border-indigo-500 shadow-xs"
                        : inTimetable
                        ? "bg-surface hover:bg-surface-secondary/40 border-emerald-500/30"
                        : "bg-surface hover:bg-surface-secondary/40 border-border-strong hover:border-indigo-500/40"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-sm text-text-heading tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {c.code}
                        </span>
                        {inTimetable ? (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Added
                          </span>
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium line-clamp-2 leading-relaxed">
                        {c.title}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-strong/40 text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {renderTypeChips(c.types, 'sm')}
                      </div>
                      {(c.batches || []).length > 0 && (
                        <div className="flex items-center gap-1">
                          {c.batches.slice(0, 2).map((b) => (
                            <span key={b} className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getBatchColorClass(b)}`}>
                              {b}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: SLOT & FACULTY SELECTION ── */}
      {currentStep === 2 && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Selected Course Context Strip */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-surface-secondary/40 border border-border-strong">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="p-1.5 rounded-xl bg-surface hover:bg-surface-secondary border border-border-strong text-muted-foreground hover:text-text-heading transition-colors"
                title="Change Course"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-text-heading">{selectedCourseCode}</span>
                  {selectedCourseMeta && renderTypeChips(selectedCourseMeta.types, 'sm')}
                </div>
                <p className="text-xs text-muted-foreground">{selectedCourseMeta?.title}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-auto">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text-heading">
                <span>Group Embedded</span>
                <Switch
                  checked={isGroupingEnabled}
                  onCheckedChange={setIsGroupingEnabled}
                  label="Group Embedded Courses"
                />
              </label>
            </div>
          </div>

          {/* Session Filters */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto scrollbar-none py-1">
            <ChipTabs
              value={slotFilter}
              onChange={setSlotFilter}
              options={[
                { value: "all", label: "All Sessions" },
                { value: "morning_session", label: "Morning" },
                { value: "evening_session", label: "Evening" },
              ]}
            />
            <span className="text-xs text-muted-foreground shrink-0">
              {filteredOfferings.length} offering{filteredOfferings.length === 1 ? "" : "s"}
            </span>
          </div>

          {filteredOfferings.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground bg-surface-secondary/20 rounded-2xl border border-dashed border-border-strong">
              No offerings found matching this session filter. Try selecting "All Sessions".
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto pr-1 custom-scrollbar">
              {filteredOfferings.map((offering) => {
                const originalIndex = availableOfferings.indexOf(offering);
                const slotsArray = splitSlots(offering.SLOT);
                const clash = checkClashes(slotsArray);
                const isSelected = selectedSlotIndex === String(originalIndex);

                // Alternatives count
                const facultyAlts = sameSlotFacultyAlternatives(
                  selectedCourseCode,
                  slotsArray,
                  { faculty: offering.FACULTY, employeeId: offering.ERP_ID },
                  courseAlternativesPool
                );
                const facultyCount = 1 + facultyAlts.length;

                return (
                  <button
                    key={`${offering.SLOT}-${offering.FACULTY}-${originalIndex}`}
                    type="button"
                    onClick={() => handleSelectOffering(originalIndex)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group relative ${
                      isSelected
                        ? "bg-indigo-500/10 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20"
                        : clash
                        ? "bg-surface hover:bg-surface-secondary/30 border-red-500/30"
                        : "bg-surface hover:bg-surface-secondary/40 border-border-strong hover:border-indigo-500/40"
                    }`}
                  >
                    <div>
                      {/* Top Row: Slot Badge & Clash Status */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-xl bg-surface-secondary border border-border-strong text-text-heading">
                          {offering.SLOT}
                        </span>
                        {clash ? (
                          <span
                            className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full flex items-center gap-1"
                            title={clash}
                          >
                            <AlertTriangle className="w-2.5 h-2.5" /> Clashes
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Conflict-free
                          </span>
                        )}
                      </div>

                      {/* Middle: Faculty & Venue */}
                      <div className="flex items-center gap-2.5">
                        <FacultyAvatar
                          employeeId={offering.ERP_ID}
                          name={offering.FACULTY}
                          size="sm"
                          tone="indigo"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-bold text-text-heading truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {offering.FACULTY}
                          </p>
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                            <span>{offering.ROOM || "TBA"}</span>
                            {offering.ERP_ID && <span>· ERP {offering.ERP_ID}</span>}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Faculty reviews & alternatives */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border-strong/40 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <VitfacReviewPill
                          employeeId={offering.ERP_ID}
                          name={offering.FACULTY}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenFacultyReview({
                              name: offering.FACULTY,
                              employeeId: offering.ERP_ID,
                              courseCode: selectedCourseCode,
                            });
                          }}
                        />
                        {facultyCount > 1 && (
                          <span className="text-[10px] text-muted-foreground bg-surface-secondary px-1.5 py-0.5 rounded-md border border-border-strong/60 flex items-center gap-1">
                            <Users className="w-2.5 h-2.5" /> {facultyCount} profs
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                        Choose <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: REVIEW & PLACE ── */}
      {currentStep === 3 && selectedOffering && selectedCourseMeta && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 sm:p-5 rounded-2xl bg-surface-secondary/40 border border-border-strong space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border-strong/60">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 tracking-wider uppercase">
                  Ready to Add
                </span>
                <h4 className="text-lg font-black text-text-heading">
                  {selectedCourseMeta.code} - {selectedCourseMeta.title}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                {renderTypeChips(selectedCourseMeta.types, 'md')}
                <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400">
                  {selectedOffering.CREDITS || "0"} Credits
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                  Faculty
                </span>
                <div className="flex items-center gap-2">
                  <FacultyAvatar
                    employeeId={selectedOffering.ERP_ID}
                    name={selectedOffering.FACULTY}
                    size="sm"
                    tone="indigo"
                  />
                  <div>
                    <p className="font-bold text-text-heading text-sm">{selectedOffering.FACULTY}</p>
                    <p className="text-muted-foreground">{selectedOffering.ROOM || "TBA"}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">
                  Allocated Slots
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {splitSlots(selectedOffering.SLOT).map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 rounded-lg bg-surface border border-border-strong font-mono font-bold text-text-heading text-xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Clash Check Banner */}
            {(() => {
              const clash = checkClashes(splitSlots(selectedOffering.SLOT));
              if (clash) {
                return (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span><strong>Warning:</strong> {clash}</span>
                  </div>
                );
              }
              return (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span><strong>Conflict-free:</strong> This course fits cleanly into your timetable!</span>
                </div>
              );
            })()}
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border-strong bg-surface hover:bg-surface-secondary text-text-heading text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Offerings
            </button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleAddAnother}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Add & Pick Another
              </button>

              <button
                type="button"
                onClick={handleConfirmAdd}
                className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check className="w-4 h-4" /> Add to {activeTimetable.name}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
