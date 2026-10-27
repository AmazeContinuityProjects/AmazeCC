"use client";

import { useEffect } from "react";
import { useSetAtom } from "jotai";
import { syncEngine } from "@/lib/sync-engine";
import { handleEngineProgressEvent, formatSessionMessage, useSyncSession } from "@/lib/sync-engine/sync-session";
import { messageAtom, progressBarAtom } from "@/store";

/** Bridges engine progress events into the legacy login/reload message atoms. */
export function useSyncSessionBridge() {
  const session = useSyncSession();
  const setMessage = useSetAtom(messageAtom);
  const setProgress = useSetAtom(progressBarAtom);

  useEffect(() => syncEngine.subscribe(handleEngineProgressEvent), []);

  useEffect(() => {
    setMessage(formatSessionMessage(session.lines));
    setProgress(session.progress);
  }, [session, setMessage, setProgress]);
}
