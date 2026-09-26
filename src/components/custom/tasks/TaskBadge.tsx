"use client";

import React from "react";
import { Layers } from "lucide-react";
import type { ClassTaskSummary } from "@/lib/taskMatch";
import { KIND_CONFIG } from "./TaskCard";

interface TaskBadgeProps {
  summary: ClassTaskSummary;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  /** Shorten labels ("DA today") for cramped cards */
  compact?: boolean;
}

/**
 * Session-scoped badge for a timetable class card.
 * - A test/DA chunked to *this* session, or due on this calendar date, claims
 *   "<Kind> today"; test wins over digital assignment.
 * - Anything else linked to the course stays generic: "Task pending".
 * `summary.today` is zeroed for non-current days, so browsing another weekday
 * can never show a "today" claim.
 */
export default function TaskBadge({
  summary,
  onClick,
  className = "",
  compact = false,
}: TaskBadgeProps) {
  if (!summary || summary.total === 0) return null;

  const today = summary.today;
  let text: string;
  let count: number;
  let colorClass: string;
  let Icon: React.ElementType;

  if (today.total > 0 && today.tests > 0) {
    text = "Test today";
    count = today.tests;
    colorClass =
      "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200/60 dark:border-red-900/30";
    Icon = KIND_CONFIG.test.icon;
  } else if (today.total > 0 && today.das > 0) {
    text = compact ? "DA today" : "Digital assignment today";
    count = today.das;
    colorClass =
      "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200/60 dark:border-amber-900/30";
    Icon = KIND_CONFIG["digital-assignment"].icon;
  } else {
    text = "Task pending";
    count = summary.total;
    colorClass =
      "text-amber-700/90 dark:text-amber-300/90 bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/50 dark:border-amber-900/25";
    Icon = Layers;
  }

  const label = count > 1 ? `${text} · ${count}` : text;

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold border shrink-0 transition-all ${colorClass} ${className}`}
    >
      <Icon className="w-3 h-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}
