"use client";

import type React from "react";
import type { Friend } from "@/lib/ffcsTypes";
import { Users } from "lucide-react";
import { Switch } from "../../../../shared/primitives";

/** Extracted from FFCSGuidedSelector's `renderAutoSocialCard`; markup unchanged. */
export interface AutoSocialCardProps {
  isLandscape?: boolean;
  friends: Friend[];
  autoSyncFriends: boolean;
  setAutoSyncFriends: (value: React.SetStateAction<boolean>) => void;
  autoMaximizeFreeTime: boolean;
  setAutoMaximizeFreeTime: (value: React.SetStateAction<boolean>) => void;
}

export default function AutoSocialCard({
  isLandscape = false,
  friends,
  autoSyncFriends,
  setAutoSyncFriends,
  autoMaximizeFreeTime,
  setAutoMaximizeFreeTime,
}: AutoSocialCardProps) {
  return (
    <div
      className={`p-5 sm:p-6 rounded-[28px] sm:rounded-[32px] bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-xl shadow-2xl space-y-4 text-left flex flex-col justify-between ${
        isLandscape ? "h-[74vh] max-h-[640px] w-full" : "min-h-[380px] max-h-[620px]"
      }`}
    >
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider font-outfit">
            3. Friends &amp; Peer Sync
          </h3>
          <p className="text-xs text-zinc-400">Align your generated timetable with peer schedules.</p>
        </div>

        {friends.length === 0 ? (
          <div className="p-6 rounded-2xl bg-zinc-950/60 border border-zinc-800 text-center space-y-2">
            <Users className="w-8 h-8 text-zinc-500 mx-auto" />
            <h4 className="text-sm font-bold text-white">Solo Generation Mode</h4>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              No friend timetables added yet. The solver will optimize purely for your personal preferences.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">Sync Shared Class Slots</p>
                <p className="text-[11px] text-zinc-400">Prioritize sections where your friends are enrolled</p>
              </div>
              <Switch checked={autoSyncFriends} onCheckedChange={setAutoSyncFriends} size="md" label="Sync Classes" />
            </div>

            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-white">Maximize Shared Break Times</p>
                <p className="text-[11px] text-zinc-400">Align lunch and free slots with friends</p>
              </div>
              <Switch
                checked={autoMaximizeFreeTime}
                onCheckedChange={setAutoMaximizeFreeTime}
                size="md"
                label="Maximize Breaks"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
