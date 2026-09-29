"use client";

import { AnimatePresence } from "framer-motion";
import BottomSheet from "../shared/BottomSheet";
import { MoodleUserPassForm } from "../exams/MoodleDisplay";

/**
 * Moodle credentials.
 *
 * Pulled out of the old calendar page, where it was an inline `AnimatePresence`
 * around a `BottomSheet` that only the page could open. Now the day sheet opens
 * it too — that is the only place it makes sense to offer, because a Moodle
 * deadline is the thing the user is looking at when they realise they have not
 * connected it yet.
 *
 * `handleFetchMoodle` reloads the window on success (it is `MoodleUserPassForm`
 * behaviour, not ours), so there is no "connected" state to render here.
 */
export default function MoodleConnectSheet({
  open,
  onClose,
  handleFetchMoodle,
  IDs,
}: {
  open: boolean;
  onClose: () => void;
  handleFetchMoodle: (username: string, password: string) => void;
  IDs: any;
}) {
  return (
    <AnimatePresence>
      {open && (
        <BottomSheet onClose={onClose} overlayId="moodle-connect" maxWidth="max-w-md">
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-black text-zinc-900 dark:text-white font-outfit">
                Connect Moodle
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
                Sign in once to sync assignments into the calendar.
              </p>
            </div>
            <MoodleUserPassForm handleFetchMoodle={handleFetchMoodle} IDs={IDs} />
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
