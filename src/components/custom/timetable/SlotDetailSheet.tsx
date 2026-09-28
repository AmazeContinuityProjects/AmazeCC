"use client";

/**
 * What one tapped cell in the vertical timetable actually says.
 *
 * The horizontal grid's only detail affordance is a `group-hover` tooltip, which
 * never fires on a touch device — so before this sheet, a phone user of the
 * attendance timetable could see a slot id and a colour and nothing else: no
 * course title, no faculty, no venue. This is the whole point of the cell tap.
 *
 * It is also where a run's **shadowed** courses surface. `buildBands.ts` gives
 * one cell per (day, band) and lets the lab win a collision, so a theory run
 * displaced at that band would otherwise be invisible. It is reported here
 * instead — the cell stays compact, the sheet tells the full truth.
 *
 * Modelled on the existing free-slot cell inspector in
 * `social/CommonFreeSlotsGrid.tsx`.
 */

import { useMemo } from "react";
import {
  BookOpen,
  Clock,
  Coins,
  EyeOff,
  MapPin,
  User,
} from "lucide-react";
import { cn } from "@amazecontinuityprojects/amazeui";
import BottomSheet from "../shared/BottomSheet";
import { CHIP, TONE_BADGE, TONE_TEXT } from "@/lib/libraries/ui";
// A leaf module (its only import is a campus JSON), so depending on it from a
// shared component costs nothing and avoids a third copy of the type maps.
import { defaultColor, typeColors, typeLabels } from "../exams/FFCS/constants";
import { minutesToTimeStr } from "@/lib/social/schedule";
import type { Cell } from "./buildBands";

/** What the attendance surface knows about a course that the planner does not. */
export type AttendanceTone = {
  percentage: string;
  cls: "low" | "medium" | "high";
};

const CLS_TONE: Record<AttendanceTone["cls"], string> = {
  low: TONE_TEXT.red,
  medium: TONE_TEXT.amber,
  high: TONE_TEXT.emerald,
};

function Section({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof User;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
        <Icon className="h-3.5 w-3.5 text-zinc-400" />
        {label}
      </p>
      {children}
    </div>
  );
}

export default function SlotDetailSheet({
  cell,
  dayName,
  blockedSlots,
  onToggleBlockSlot,
  attendanceByCourse,
  onClose,
}: {
  cell: Cell;
  dayName: string;
  blockedSlots?: Set<string>;
  onToggleBlockSlot?: (slot: string) => void;
  attendanceByCourse?: Record<string, AttendanceTone>;
  onClose: () => void;
}) {
  const course = cell.course;
  const attendance = course ? attendanceByCourse?.[course.code] : undefined;
  const type = course ? typeColors[course.type] ?? defaultColor : null;
  const typeLabel = course?.type ? typeLabels[course.type] ?? course.type : "";

  const timeRange = useMemo(
    () =>
      cell.endMin > cell.startMin
        ? `${minutesToTimeStr(cell.startMin)} – ${minutesToTimeStr(cell.endMin)}`
        : minutesToTimeStr(cell.startMin),
    [cell.startMin, cell.endMin]
  );

  const headerTone =
    cell.kind === "blocked"
      ? TONE_TEXT.red
      : cell.kind === "gap"
        ? TONE_TEXT.amber
        : course
          ? TONE_TEXT.indigo
          : TONE_TEXT.zinc;

  const headerCaption = cell.blocked
    ? cell.partiallyBlocked
      ? "Partly blocked"
      : "Blocked"
    : cell.inGap
      ? "Free · inside a selected gap"
      : course
        ? `${cell.bandCount > 1 ? `${cell.bandCount} consecutive slots` : cell.half === "lab" ? "Lab" : "Theory"}`
        : "Free";

  return (
    <BottomSheet
      onClose={onClose}
      overlayId="timetable-slot-detail"
      placement="center"
      // Was max-w-sm, which capped the card at 384px and left a narrow strip
      // down each side of a phone. A tapped cell is the whole context here, so
      // the card takes the width it needs and only stops growing on a desktop.
      maxWidth="max-w-md"
    >
      <div className="space-y-5 text-left">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border",
              course
                ? cn(course.color, "border-transparent text-gray-900 dark:text-gray-100")
                : TONE_BADGE[cell.kind === "gap" ? "amber" : cell.blocked ? "red" : "zinc"]
            )}
          >
            <Clock className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h3 className="font-outfit text-sm font-black leading-tight text-zinc-900 dark:text-white">
              {dayName} · {timeRange}
            </h3>
            <p className={cn("text-[11px] font-bold", headerTone)}>{headerCaption}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {cell.slots.map((slot) => (
            <span
              key={slot}
              className={cn(
                CHIP,
                blockedSlots?.has(slot)
                  ? "border-red-500/30 text-red-600 dark:text-red-400 line-through"
                  : "border-zinc-200/60"
              )}
            >
              {slot}
            </span>
          ))}
        </div>

        {!course && (
          <div className="rounded-2xl border border-dashed border-zinc-300 p-4 text-center dark:border-zinc-800">
            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
              {cell.blocked
                ? "You have ruled this slot out, so nothing is scheduled here."
                : "Nothing scheduled here — this is a free slot."}
            </p>
          </div>
        )}

        {course && (
          <>
            <div className="rounded-2xl border border-zinc-200/70 p-3.5 dark:border-zinc-800">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black text-white",
                    course.color
                  )}
                >
                  {course.code}
                </span>
                <p className="min-w-0 flex-1 font-outfit text-sm font-black leading-tight text-zinc-900 dark:text-white">
                  {course.title}
                </p>
              </div>

              <div className="mt-3 space-y-1.5">
                {typeLabel && (
                  <p className="flex items-center gap-1.5 text-[11px] font-bold">
                    <BookOpen className="h-3 w-3 shrink-0 text-zinc-400" />
                    <span
                      className={cn(
                        "rounded-md border px-1.5 py-0.5 text-[10px]",
                        type?.bg,
                        type?.text,
                        type?.border
                      )}
                    >
                      {typeLabel}
                    </span>
                  </p>
                )}
                {course.faculty && (
                  <p className="flex items-center gap-1.5 truncate text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    <User className="h-3 w-3 shrink-0 text-zinc-400" />
                    {course.faculty}
                  </p>
                )}
                <p className="flex items-center gap-1.5 truncate text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                  <MapPin className="h-3 w-3 shrink-0 text-zinc-400" />
                  {course.venue || "Venue not published"}
                </p>
                {course.credits && course.credits !== "0" && (
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                    <Coins className="h-3 w-3 shrink-0 text-zinc-400" />
                    {course.credits} credits
                  </p>
                )}
              </div>
            </div>

            {attendance && (
              <Section icon={EyeOff} label="Attendance">
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "font-outfit text-2xl font-black leading-none",
                      CLS_TONE[attendance.cls]
                    )}
                  >
                    {attendance.percentage}%
                  </p>
                  <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                    overall for this course
                  </p>
                </div>
              </Section>
            )}
          </>
        )}

        {cell.shadowed.length > 0 && (
          <Section icon={EyeOff} label="Also at this time">
            <p className="text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">
              A lab runs at this hour, so the cell shows the lab. The theory slot
              below is here so nothing goes missing.
            </p>
            {cell.shadowed.map((s, i) => (
              <div
                key={`${s.course.id}-${i}`}
                className="rounded-2xl border border-zinc-200/70 p-3 dark:border-zinc-800"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-black text-white",
                      s.course.color
                    )}
                  >
                    {s.course.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-outfit text-xs font-black text-zinc-800 dark:text-zinc-200">
                      {s.course.title}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                      {s.label}
                      {s.course.venue ? ` · ${s.course.venue}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </Section>
        )}

        {onToggleBlockSlot && cell.slots.length > 0 && (
          <Section icon={EyeOff} label="Availability">
            <div className="flex flex-wrap gap-1.5">
              {cell.slots.map((slot) => {
                const isBlocked = blockedSlots?.has(slot);
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onToggleBlockSlot(slot)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-colors cursor-pointer",
                      isBlocked
                        ? "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400"
                        : "border-zinc-200/70 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    )}
                  >
                    {isBlocked ? `Unblock ${slot}` : `Block ${slot}`}
                  </button>
                );
              })}
            </div>
          </Section>
        )}
      </div>
    </BottomSheet>
  );
}
