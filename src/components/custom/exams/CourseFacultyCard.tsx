"use client";

import React, { useState, useEffect } from "react";
import { Mail, Phone, MapPin, Copy, Check, CalendarDays, Star, Info, ChevronDown, ChevronUp } from "lucide-react";
import { LIST_ROW } from "@/lib/uiTokens";
import { ListShell, ListRowText, KeyValue, ToneBadge } from "../shared/primitives";
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

/** Parses faculty name, employee id, and school from raw strings like "12345 - DR. JOHN DOE - SCOPE" */
export function parseFacultyInfo(rawFaculty?: string | null) {
  if (!rawFaculty || typeof rawFaculty !== "string") {
    return { cleanName: "", employeeId: undefined, school: undefined };
  }
  let str = rawFaculty.trim();
  let employeeId: string | undefined = undefined;

  const empMatch = str.match(/^(\d{4,6})\s*[-–]\s*(.+)$/);
  if (empMatch) {
    employeeId = empMatch[1];
    str = empMatch[2].trim();
  }

  let school: string | undefined = undefined;
  const schoolMatch = str.match(/^(.+?)\s*[-–]\s*([A-Za-z]+)$/);
  if (schoolMatch) {
    str = schoolMatch[1].trim();
    school = schoolMatch[2].trim();
  }

  return { cleanName: str, employeeId, school };
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

  const { cleanName, employeeId: parsedEmpId, school: parsedSchool } = parseFacultyInfo(rawFaculty);
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
  const schoolToDisplay = dirProfile?.dept || parsedSchool || (review as any)?.school || null;

  return (
    <ListShell className="overflow-hidden">
      <div className={`${LIST_ROW} py-3.5`}>
        {/* Leading Avatar */}
        <div className="relative shrink-0">
          <FacultyAvatar
            employeeId={effectiveEmpId}
            name={cleanName || "?"}
            size="md"
            tone={scope === "Lab" ? "amber" : "blue"}
          />
        </div>

        {/* Center Text with Name + Review Pill + Subtitle */}
        <ListRowText
          titleTag="span"
          title={
            <span className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-text-heading font-outfit">{cleanName || "Faculty Assigned"}</span>
              {cleanName && (
                <VitfacReviewPill
                  employeeId={effectiveEmpId}
                  name={cleanName}
                  onClick={() => onOpenFacultyReview?.({ name: cleanName, employeeId: effectiveEmpId, courseCode })}
                />
              )}
            </span>
          }
          subtitle={
            <span className="flex items-center gap-1.5 flex-wrap">
              <ToneBadge tone={scope === "Lab" ? "emerald" : "blue"}>{scope}</ToneBadge>
              {slot && <span>Slot {slot}</span>}
              {venue && (
                <span>
                  &middot; Venue: <span className="font-semibold text-text-heading">{venue}</span>
                </span>
              )}
              {credits && <span>&middot; {credits} Credits</span>}
              {schoolToDisplay && <span>&middot; {schoolToDisplay}</span>}
            </span>
          }
        />

        {/* Right Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {cleanName && onOpenFacultySchedule && (
            <button
              type="button"
              onClick={() => onOpenFacultySchedule(cleanName, effectiveEmpId)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 transition-all active:scale-[0.98] cursor-pointer"
              title="View faculty teaching schedule and timetable"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Schedule</span>
            </button>
          )}

          {cleanName && onOpenFacultyReview && (
            <button
              type="button"
              onClick={() => onOpenFacultyReview({ name: cleanName, employeeId: effectiveEmpId, courseCode })}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 transition-all active:scale-[0.98] cursor-pointer"
              title="View Vitfac student ratings and reviews"
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">Review</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-surface-secondary dark:bg-zinc-800 text-text-secondary hover:text-text-heading border border-border-muted dark:border-zinc-700/60 transition-all active:scale-[0.98] cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Details</span>
            {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expandable Details: KeyValue grid */}
      {showDetails && (
        <div className="p-4 bg-surface-secondary/40 dark:bg-zinc-900/40 border-t border-border-muted dark:border-border/70 space-y-3 animate-in fade-in duration-200">
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
                <span className="font-mono text-text-heading">{emailToDisplay}</span>
                <button
                  type="button"
                  onClick={(e) => handleCopyEmail(emailToDisplay, e)}
                  title="Copy email address"
                  className="p-1 rounded-md text-text-muted hover:text-text-heading hover:bg-surface-hover active:scale-95 transition-all cursor-pointer"
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
    </ListShell>
  );
}
