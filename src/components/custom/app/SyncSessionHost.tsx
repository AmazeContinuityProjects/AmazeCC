"use client";

import { AnimatePresence } from "framer-motion";
import SyncNotification from "@/components/custom/shared/SyncNotification";
import { dismissSyncSession, formatSessionMessage, useSyncSession } from "@/lib/sync-engine/sync-session";
import { isReloadingAtom } from "@/store";
import { useAtom } from "jotai";

interface SyncSessionHostProps {
  activeModeId: string;
  modes: any[];
  modeLabel: string;
  onSelectMode: (modeId: string) => void;
  onOpenEditor: () => void;
  onChangePassword: () => void;
  onRetry: () => void;
}

/** Owns sync-session notification UI and its retry/dismiss interactions. */
export default function SyncSessionHost({
  activeModeId,
  modes,
  modeLabel,
  onSelectMode,
  onOpenEditor,
  onChangePassword,
  onRetry,
}: SyncSessionHostProps) {
  const session = useSyncSession();
  const [isReloading, setIsReloading] = useAtom(isReloadingAtom);

  return (
    <AnimatePresence>
      {session.open && (
        <SyncNotification
          message={formatSessionMessage(session.lines)}
          progress={session.progress}
          active={session.open}
          outcome={session.outcome}
          notice={session.notice}
          modeId={activeModeId}
          defaultModeId={activeModeId}
          modes={modes}
          modeLabel={modeLabel}
          onSelectMode={onSelectMode}
          onOpenEditor={onOpenEditor}
          onChangePassword={() => {
            dismissSyncSession();
            if (isReloading) setIsReloading(false);
            onChangePassword();
          }}
          onRetry={onRetry}
          onDismiss={() => {
            dismissSyncSession();
            if (isReloading) setIsReloading(false);
          }}
        />
      )}
    </AnimatePresence>
  );
}
