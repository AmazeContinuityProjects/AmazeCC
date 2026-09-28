"use client";

import { useCallback, useMemo, useState } from "react";
import { FolderPlus, Users } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import BackButton from "../shared/BackButton";
import { GroupRow, SectionHeader } from "./rows";
import CommonFreeGridSubpage from "./CommonFreeGridSubpage";
import GroupMembersSheet from "./GroupMembersSheet";
import { useSocialData } from "@/lib/social/useSocialData";
import { usePeerTimetables } from "@/lib/social/usePeerTimetables";
import { useSocialGroups } from "@/lib/social/useSocialGroups";
import type { BusyMap } from "@/lib/social/types";

/**
 * Groups, and the common-free grid for each.
 *
 * The list is the entry point and the grid is a drill-down onto the same
 * `CommonFreeSlotsGrid` the "everyone" view uses, narrowed to the group's
 * members. Nothing about the grid is duplicated for groups, which is why adding
 * this surface was small.
 *
 * ## Empty groups are shown, not hidden
 *
 * A group whose members have all been revoked is still listed, disabled, and
 * says so. Hiding it would make a revoke look like a deletion and leave the user
 * wondering where their group went.
 */
export default function GroupsSubpage({ onBack }: { onBack: () => void }) {
  const { ownBusyMap } = useSocialData();
  const { peers } = usePeerTimetables();

  const busyByHandle = useMemo(() => {
    const m = new Map<string, BusyMap>();
    for (const p of peers) if (p.loaded) m.set(p.handle, p.busyMap);
    return m;
  }, [peers]);
  const known = useMemo(() => peers.map((p) => p.handle), [peers]);

  const { summaries, createGroup, deleteGroup, prune } = useSocialGroups({
    ownBusyMap,
    knownHandles: known,
    busyByHandle,
  });

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null | undefined>(undefined);

  // A pairing revoked elsewhere leaves a handle that is no longer a peer. Pruned
  // on entry so the counts on screen are already honest.
  const handlePrune = useCallback(() => prune(), [prune]);

  const open = openGroup ? summaries.find((s) => s.group.id === openGroup) ?? null : null;

  if (open) {
    return (
      <CommonFreeGridSubpage
        onBack={() => setOpenGroup(null)}
        onlyHandles={open.group.handles}
        title={open.group.name}
        subTitle={`${open.metrics.memberCount} ${open.metrics.memberCount === 1 ? "person" : "people"} · ${open.metrics.commonFreeHours}h common`}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <BackButton onClick={onBack} className="self-start" />
        <button
          type="button"
          onClick={handlePrune}
          title="Remove people you are no longer paired with"
          className="self-start p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 cursor-pointer"
        >
          <Users className="w-4 h-4" />
        </button>
      </div>

      <div className="px-1">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1">
          Campus
        </p>
        <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate">
          Groups
        </h1>
      </div>

      <SectionHeader icon={FolderPlus} title="Your groups" />

      {summaries.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No groups yet. A group collects people you are already paired with so you
            can find a slot free for all of them.
          </p>
          <button
            type="button"
            onClick={() => {
              // Seeded empty rather than created here: the sheet owns naming, so
              // there is exactly one place a group is born.
              setEditing(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
            New group
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {summaries.map((s) => (
            <GroupRow
              key={s.group.id}
              name={s.group.name}
              memberCount={s.metrics.memberCount}
              pendingCount={s.pending}
              commonFreeHours={s.empty ? undefined : s.metrics.commonFreeHours}
              matchPct={s.empty ? undefined : s.metrics.groupMatchPct}
              empty={s.empty}
              onOpen={() => setOpenGroup(s.group.id)}
              onEdit={() => setEditing(s.group.id)}
              onDelete={() => deleteGroup(s.group.id)}
            />
          ))}
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-xs font-bold py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            New group
          </button>
        </div>
      )}

      <AnimatePresence>
        {editing !== undefined && (
          <GroupMembersSheet
            groupId={editing}
            onClose={() => setEditing(undefined)}
            onOpenGrid={(id) => {
              setEditing(undefined);
              setOpenGroup(id);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
