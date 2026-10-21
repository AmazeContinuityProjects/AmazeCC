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
        <BottomSheet
          onClose={onClose}
          overlayId="moodle-connect"
          maxWidth="max-w-md"
          title="Connect Moodle"
          subtitle="Sign in once to sync assignments into the calendar."
          closeLabel="Close Moodle connection"
        >
          <div className="space-y-5">
            <MoodleUserPassForm handleFetchMoodle={handleFetchMoodle} IDs={IDs} />
          </div>
        </BottomSheet>
      )}
    </AnimatePresence>
  );
}
