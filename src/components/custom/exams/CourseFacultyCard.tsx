"use client";

import React, { useState, useEffect } from "react";
import { Mail, Phone, Copy, Check, CalendarDays, Star, Info, ChevronDown, ChevronUp } from "lucide-react";
import { KeyValue, ToneBadge } from "../shared/primitives";
import { FacultyAvatar, VitfacReviewPill } from "./FFCS/components/FacultyAvatar";
import { useVitfacReview, getFacultyDirectoryProfile, type FacultyDirectoryProfile } from "@/lib/vitfacService";

export interface CourseFacultyCardProps {
  scope: "Theory" | "Lab" | "Course";
  courseComp?: any;
  attItem?: any;
  isEmbedded?: boolean;
  courseCode: string;
  onOpenFacultyReview?: (target: { name: string; employeeId?: string; courseCode?: string }) => void;
  onOpenFacultySchedule?: (facultyName: string, employeeId?: string) => void;
}

export interface ParsedFacultyInfo {
  cleanName: string;
  employeeId?: string;
  school?: string;
  department?: string;
}

const KNOWN_VIT_SCHOOLS = new Set([
  "SAS",
  "SCOPE",
  "SELECT",
  "SENSE",
  "SITE",
  "SMEC",
  "SSL",
  "VITSOL",
  "VITBS",
  "SCHEME",
  "HOT",
  "SCSE",
  "VAIAL",
  "SHSS",
  "DS",
  "SEEE",
  "SET",
  "CORE",
  "SCA",
  "CBST",
  "VFSTR",
  "CNE",
  "COE",
]);

/**
 * Parses faculty name, employee id, and department from raw strings.
 * Employee ID is the first segment of the faculty name record,
 * and department is the last segment of the faculty name record.
 * Supports both hyphen-delimited ("12345 - DR. JOHN DOE - SCOPE")
 * and space-delimited ("50772 NATHIYA N SAS") records.
 */
export function parseFacultyInfo(rawFaculty?: string | null): ParsedFacultyInfo {
  if (!rawFaculty || typeof rawFaculty !== "string") {
    return { cleanName: "", employeeId: undefined, school: undefined, department: undefined };
  }
  let str = rawFaculty.trim();
  if (!str) {
    return { cleanName: "", employeeId: undefined, school: undefined, department: undefined };
  }

  let employeeId: string | undefined = undefined;
  let department: string | undefined = undefined;

  // 1. Extract Employee ID (first segment)
  // Check if string starts with digits (e.g. "50772 NATHIYA..." or "50772 - NATHIYA..." or "12345-...")
  const startEmpMatch = str.match(/^(\d{3,7})\s*[-–—]?\s*(.*)$/);
  if (startEmpMatch) {
    employeeId = startEmpMatch[1];
    str = startEmpMatch[2].trim();
  }

  // 2. Extract Department (last segment)
  // Check if there is an explicit hyphen separator before the last segment:
  // e.g. "DR. JOHN DOE - SCOPE" or "DR. CHARLES BABBAGE - SCHOOL OF ADVANCED SCIENCES"
  const lastHyphenIdx = Math.max(str.lastIndexOf(" - "), str.lastIndexOf(" – "), str.lastIndexOf(" — "));
  if (lastHyphenIdx !== -1) {
    const after = str.slice(lastHyphenIdx + 3).trim();
    const before = str.slice(0, lastHyphenIdx).trim();
    if (after && before) {
      department = after;
      str = before;
    }
  } else if (str.includes("-")) {
    const parts = str
      .split("-")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      department = parts[parts.length - 1];
      str = parts.slice(0, -1).join(" - ").trim();
    }
  } else {
    // Space-separated segments (no hyphens remaining):
    // e.g. "NATHIYA N SAS" -> tokens: ["NATHIYA", "N", "SAS"]
    // e.g. "DR. JANE SMITH SELECT" -> tokens: ["DR.", "JANE", "SMITH", "SELECT"]
    const tokens = str.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const lastToken = tokens[tokens.length - 1];
      // When employee ID was present, the last token is unequivocally the department segment.
      // When employee ID is absent and there are no hyphens, match against known VIT school acronyms.
      const isDept = employeeId !== undefined || KNOWN_VIT_SCHOOLS.has(lastToken.toUpperCase());
      if (isDept && (lastToken.length >= 2 || (employeeId !== undefined && tokens.length > 2))) {
        department = lastToken;
        str = tokens.slice(0, -1).join(" ");
      }
    }
  }

  const cleanName = str.trim();

  return {
    cleanName,
    employeeId,
    school: department,
    department,
  };
}

export default function CourseFacultyCard({
  scope,
  courseComp,
  attItem,
  isEmbedded,
  courseCode,
  onOpenFacultyReview,
  onOpenFacultySchedule,
}: CourseFacultyCardProps) {
  const rawFaculty = courseComp?.faculty || attItem?.faculty || "";
  const venue = attItem?.slotVenue || courseComp?.venue || "";
  const slot = courseComp?.slot || attItem?.slotName || "";
  const credits =
    attItem?.credits != null ? String(attItem.credits) : courseComp?.credits != null ? String(courseComp.credits) : "";

  const {
    cleanName,
    employeeId: parsedEmpId,
    school: parsedSchool,
    department: parsedDept,
  } = parseFacultyInfo(rawFaculty);
  const { review } = useVitfacReview(parsedEmpId, cleanName);

  const effectiveEmpId = parsedEmpId || review?.employeeId || undefined;
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [dirProfile, setDirProfile] = useState<FacultyDirectoryProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (showDetails && effectiveEmpId && !dirProfile) {
      setLoadingProfile(true);
      getFacultyDirectoryProfile(effectiveEmpId)
        .then((p) => {
          if (p) setDirProfile(p);
        })
        .catch(() => {})
        .finally(() => setLoadingProfile(false));
    }
  }, [showDetails, effectiveEmpId, dirProfile]);

  const handleCopyEmail = (email: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  const emailToDisplay = dirProfile?.email || (review as any)?.email || null;
  const intercomToDisplay = dirProfile?.intercom || (review as any)?.intercom || null;
  const designationToDisplay = dirProfile?.designation || (review as any)?.designation || "Faculty";
  const schoolToDisplay = dirProfile?.dept || parsedDept || parsedSchool || (review as any)?.school || null;

  return (
    <div className="rounded-[24px] card-surface border border-border-strong dark:border-border shadow-xs p-4 sm:p-5 space-y-4">
      {/* Top Section: Prominent Faculty Picture + Identity & Meta */}
      <div className="flex items-start gap-3.5 sm:gap-4">
        {/* Prominent Faculty Avatar */}
        <div className="relative shrink-0">
          <FacultyAvatar
            employeeId={effectiveEmpId}
            name={cleanName || "?"}
            size="lg"
            tone={scope === "Lab" ? "amber" : "blue"}
            className="ring-2 ring-border-muted/80 dark:ring-border/60 shadow-xs"
          />
        </div>

        {/* Center: Faculty Identity, Designation, Department, Venue & Slot */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4
              title={cleanName || "Faculty Assigned"}
              className="font-black text-base sm:text-lg text-text-heading font-outfit tracking-tight truncate leading-tight"
            >
              {cleanName || "Faculty Assigned"}
            </h4>

            {cleanName && (
              <VitfacReviewPill
                employeeId={effectiveEmpId}
                name={cleanName}
                onClick={() => onOpenFacultyReview?.({ name: cleanName, employeeId: effectiveEmpId, courseCode })}
              />
            )}
          </div>

          <p className="text-xs text-text-muted font-medium truncate">
            {designationToDisplay}
            {schoolToDisplay ? ` · ${schoolToDisplay}` : ""}
          </p>

          <div className="flex items-center gap-2 flex-wrap text-xs pt-1">
            <ToneBadge tone={scope === "Lab" ? "emerald" : "blue"} className="shrink-0">
              {scope} Component
            </ToneBadge>
          </div>
        </div>

        {/* Details Toggle Button */}
        <button
          type="button"
          onClick={() => setShowDetails(!showDetails)}
          aria-expanded={showDetails}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-bold bg-surface-secondary/80 hover:bg-surface-secondary dark:bg-zinc-800/80 dark:hover:bg-zinc-800 text-text-secondary hover:text-text-heading border border-border-muted dark:border-zinc-700/60 shadow-2xs transition-all duration-100 ease-out active:scale-[0.97] cursor-pointer shrink-0 min-h-[36px] touch-manipulation select-none"
        >
          <Info className="w-3.5 h-3.5 text-text-muted" />
          <span>Details</span>
          {showDetails ? (
            <ChevronUp className="w-3 h-3 text-text-muted" />
          ) : (
            <ChevronDown className="w-3 h-3 text-text-muted" />
          )}
        </button>
      </div>

      {/* Two Separate, Dedicated Action Buttons: Vitfac Review & Faculty Schedule */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
        {/* Button 1: Vitfac Reviews */}
        <button
          type="button"
          onClick={() => onOpenFacultyReview?.({ name: cleanName, employeeId: effectiveEmpId, courseCode })}
          disabled={!cleanName || !onOpenFacultyReview}
          className="min-h-[44px] h-11 sm:h-12 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-amber-500/10 hover:bg-amber-500/15 active:bg-amber-500/25 text-amber-700 dark:text-amber-400 border border-amber-500/25 dark:border-amber-500/20 shadow-2xs transition-all duration-100 ease-out active:scale-[0.97] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none touch-manipulation"
          title="View Vitfac student ratings and reviews"
        >
          <Star className="w-4 h-4 fill-current text-amber-500 shrink-0" />
          <span className="truncate">Vitfac Review</span>
        </button>

        {/* Button 2: Faculty Schedule */}
        <button
          type="button"
          onClick={() => onOpenFacultySchedule?.(cleanName, effectiveEmpId)}
          disabled={!cleanName || !onOpenFacultySchedule}
          className="min-h-[44px] h-11 sm:h-12 w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-bold bg-indigo-500/10 hover:bg-indigo-500/15 active:bg-indigo-500/25 text-indigo-700 dark:text-indigo-400 border border-indigo-500/25 dark:border-indigo-500/20 shadow-2xs transition-all duration-100 ease-out active:scale-[0.97] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none touch-manipulation"
          title="View faculty teaching schedule and timetable"
        >
          <CalendarDays className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="truncate">Faculty Schedule</span>
        </button>
      </div>

      {/* Expandable Details: KeyValue grid */}
      {showDetails && (
        <div className="p-4 bg-surface-secondary/40 dark:bg-zinc-900/40 rounded-2xl border border-border-muted dark:border-border/70 space-y-3 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <KeyValue label="Employee ID" value={effectiveEmpId || "—"} />
            <KeyValue label="Class Venue" value={venue || "—"} />
            <KeyValue label="Designation" value={designationToDisplay} />
            <KeyValue label="Department" value={schoolToDisplay || "—"} />
          </div>

          {emailToDisplay && (
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-surface dark:bg-zinc-800/60 border border-border-muted dark:border-zinc-700/60 text-xs">
              <span className="text-text-muted flex items-center gap-1.5 font-medium">
                <Mail className="w-3.5 h-3.5 text-indigo-500" /> Faculty Email
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-text-heading truncate max-w-[200px] sm:max-w-none">
                  {emailToDisplay}
                </span>
                <button
                  type="button"
                  onClick={(e) => handleCopyEmail(emailToDisplay, e)}
                  title="Copy email address"
                  className="p-1 rounded-md text-text-muted hover:text-text-heading hover:bg-surface-hover active:scale-95 transition-all cursor-pointer touch-manipulation"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}

          {intercomToDisplay && (
            <div className="flex items-center justify-between text-xs text-text-muted px-1">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Intercom / Office
              </span>
              <span className="font-mono font-bold text-text-heading">{intercomToDisplay}</span>
            </div>
          )}

          {loadingProfile && (
            <p className="text-[11px] text-text-muted animate-pulse px-1">Checking faculty directory profile…</p>
          )}
        </div>
      )}
    </div>
  );
}
