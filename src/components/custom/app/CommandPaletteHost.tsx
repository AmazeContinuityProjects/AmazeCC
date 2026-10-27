"use client";

import { memo } from "react";
import { useAtomValue } from "jotai";
import { CommandPalette } from "@/components/custom/shared";
import { credentialsAtom, demoModeAtom } from "@/store";
import { useAppCommands } from "./useAppCommands";
import type { SyncMode } from "@/lib/sync-engine/sync-modes";

interface CommandPaletteHostProps {
  isOpen: boolean;
  onClose: () => void;
  handleReloadRequest: (semesterId?: string, modeId?: string) => Promise<void>;
  handleLogOutRequest: () => void;
  setModeEditorOpen: (open: boolean) => void;
  customModes: SyncMode[];
}

function CommandPaletteHost({
  isOpen,
  onClose,
  handleReloadRequest,
  handleLogOutRequest,
  setModeEditorOpen,
  customModes,
}: CommandPaletteHostProps) {
  const IDs = useAtomValue(credentialsAtom);
  const demoMode = useAtomValue(demoModeAtom);
  const commands = useAppCommands({
    enabled: isOpen,
    handleReloadRequest,
    handleLogOutRequest,
    setModeEditorOpen,
    customModes,
  });

  return (
    <CommandPalette
      isOpen={isOpen}
      onClose={onClose}
      commands={commands}
      demoMode={demoMode || IDs.VtopUsername === "demo"}
    />
  );
}

export default memo(CommandPaletteHost);
