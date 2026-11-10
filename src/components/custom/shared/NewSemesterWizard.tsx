"use client";

import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";
import { CalendarClock, Loader2, X } from "lucide-react";
import config from "../../../../config.json";
import BottomSheet from "./BottomSheet";
import { formatSemesterName } from "@/lib/formatSemesterName";
import { storage } from "@/lib/storage";
import { tasksAtom } from "@/store/dataAtoms";
import { getTasks } from "@/lib/tasksStorage";
import {
  applyTaskCleanup,
  archiveSemester,
  courseCodesFrom,
  dismiss,
  isDismissed,
  newerSemester,
  OPEN_EVENT,
  planTaskCleanup,
} from "@/lib/semesterRollover";

/**
 * Offers the move to a new semester when the app's current term (see
 * semesterRollover.currentTermOf) is newer than the one the student is on,
 * and does the changeover in one step: keep a copy of last term's attendance
 * and marks, optionally clear old tasks, then switch and re-sync.
 *
 * The small prompt is dismissible per semester; the wizard can always be
 * opened from the command palette ("Start new semester").
 */
export default function NewSemesterWizard({
  enabled,
  currSemesterID,
  onSwitch,
}: {
  enabled: boolean;
  currSemesterID: string;
  onSwitch: (semesterId: string) => Promise<void>;
}) {
  const target = useMemo(() => newerSemester(currSemesterID, config.semesterIDs), [currSemesterID]);
  const [promptHidden, setPromptHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [, setTasks] = useAtom(tasksAtom);

  useEffect(() => {
    setPromptHidden(!target || isDismissed(target));
  }, [target]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  if (!enabled) return null;

  return (
    <>
      {target && !promptHidden && !open && (
        <div
          role="status"
          className="fixed inset-x-0 z-[55] flex justify-center px-3 pointer-events-none bottom-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] md:bottom-6"
        >
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-indigo-500/30 bg-white/95 px-3.5 py-2.5 text-xs shadow-lg backdrop-blur dark:bg-zinc-900/95">
            <CalendarClock className="h-5 w-5 shrink-0 text-indigo-500" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-zinc-700 dark:text-zinc-200">
              <strong className="text-zinc-900 dark:text-white">{formatSemesterName(target)}</strong> is here. Move your
              dashboard over?
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="shrink-0 rounded-lg bg-indigo-600 px-2.5 py-1.5 font-bold text-white hover:bg-indigo-700 cursor-pointer"
            >
              Set up
            </button>
            <button
              type="button"
              aria-label="Not now"
              onClick={() => {
                dismiss(target);
                setPromptHidden(true);
              }}
              className="hit-expand relative shrink-0 rounded-md p-0.5 text-zinc-400 hover:text-zinc-600 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {open && (
        <WizardSheet
          from={currSemesterID}
          to={target}
          onClose={() => setOpen(false)}
          onDone={async (to, nextTasks) => {
            if (nextTasks) {
              storage.tasks.set(nextTasks);
              setTasks(nextTasks);
            }
            dismiss(to);
            setPromptHidden(true);
            await onSwitch(to);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function WizardSheet({
  from,
  to,
  onClose,
  onDone,
}: {
  from: string;
  to: string | null;
  onClose: () => void;
  onDone: (to: string, nextTasks: ReturnType<typeof getTasks> | null) => Promise<void>;
}) {
  const attendance = useMemo(() => storage.attendance.get(), []);
  const tasks = useMemo(() => getTasks(), []);
  const plan = useMemo(() => planTaskCleanup(tasks, courseCodesFrom(attendance)), [tasks, attendance]);
  const courseCount = attendance?.attendance?.length ?? 0;
  const alreadyArchived = from ? storage.frozenAttendance.get(from) != null : false;

  const [keepCopy, setKeepCopy] = useState(courseCount > 0 && !alreadyArchived);
  const [removeDone, setRemoveDone] = useState(plan.done.length > 0);
  const [removeOldCourse, setRemoveOldCourse] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!to) return;
    setBusy(true);
    setError(null);
    try {
      if (keepCopy && from) archiveSemester(from);
      const changed = removeDone || removeOldCourse;
      const next = changed ? applyTaskCleanup(tasks, plan, { removeDone, removeOldCourse }) : null;
      await onDone(to, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't switch semesters. Try again from Settings.");
      setBusy(false);
    }
  };

  return (
    <BottomSheet
      onClose={busy ? () => {} : onClose}
      overlayId="new-semester-wizard"
      maxWidth="max-w-md"
      title={to ? `Move to ${formatSemesterName(to)}` : "Start a new semester"}
      subtitle={from ? `From ${formatSemesterName(from)}` : undefined}
      icon={<CalendarClock className="w-5 h-5" />}
      accent="bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
    >
      {!to ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          You&apos;re already on the current semester. To pick another one, use Settings &gt; Academic.
        </p>
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-zinc-600 dark:text-zinc-300">
            AmazeCC will switch to {formatSemesterName(to)} and sync it from VTOP. Choose what to do with last term
            first.
          </p>

          <fieldset className="space-y-2.5">
            <legend className="sr-only">Last term</legend>
            <Option
              id="nsw-keep"
              checked={keepCopy}
              onChange={setKeepCopy}
              disabled={courseCount === 0 || alreadyArchived}
              label={`Keep a copy of ${formatSemesterName(from)}'s attendance and marks`}
              hint={
                alreadyArchived
                  ? "Already saved."
                  : courseCount === 0
                    ? "Nothing to save on this device."
                    : `${courseCount} courses. Used by grade history and the student report.`
              }
            />
            <Option
              id="nsw-done"
              checked={removeDone}
              onChange={setRemoveDone}
              disabled={plan.done.length === 0}
              label={`Clear ${plan.done.length} finished ${plan.done.length === 1 ? "task" : "tasks"}`}
            />
            <Option
              id="nsw-old"
              checked={removeOldCourse}
              onChange={setRemoveOldCourse}
              disabled={plan.oldCourse.length === 0}
              label={`Clear ${plan.oldCourse.length} open ${plan.oldCourse.length === 1 ? "task" : "tasks"} for last term's courses`}
              hint="Leave this off if you still have work due for those courses."
            />
          </fieldset>

          {error && <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => void run()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60 cursor-pointer"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
              {busy ? "Switching…" : `Switch to ${formatSemesterName(to)}`}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function Option({
  id,
  checked,
  onChange,
  disabled,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <div className={`flex items-start gap-2.5 ${disabled ? "opacity-50" : ""}`}>
      <input
        id={id}
        type="checkbox"
        checked={checked && !disabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"
      />
      <label htmlFor={id} className="min-w-0 text-xs text-zinc-800 dark:text-zinc-200">
        <span className="font-semibold block">{label}</span>
        {hint ? <span className="text-zinc-500 dark:text-zinc-400 block mt-0.5">{hint}</span> : null}
      </label>
    </div>
  );
}
