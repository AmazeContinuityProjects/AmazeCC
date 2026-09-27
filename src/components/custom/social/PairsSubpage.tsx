"use client";

/**
 * Pairs — the grant list.
 *
 * Groups are gone on purpose. A group was a client-side view over the friend's
 * list, and now that pairings live on the server a second client-side grouping
 * would be a second source of truth that can disagree with the first. If
 * grouping is wanted later it should be derived from this list, not stored
 * beside it.
 *
 * Visibility is per-pair and shared: a grant is one row covering both
 * directions, so flipping it applies to you and your peer at the same time. The
 * button's tooltip says so, because that is the surprising part.
 */

import { useState } from "react";
import { Link2, Loader2, ShieldCheck } from "lucide-react";
import BackButton from "../shared/BackButton";
import { EMPTY_STATE, LIST_SHELL } from "@/lib/libraries/ui";
import { PairRow, SectionHeader } from "./rows";
import { revokeGrant, setGrantVisibility } from "@/lib/social/client";
import { useSocialData } from "@/lib/social/useSocialData";
import type { SocialVisibility } from "@/lib/social/types";

/** Confirmation instead of `confirm()`, which is blocked in some in-app browsers. */
function ConfirmRevoke({ name, onYes, onNo }: { name: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 space-y-2">
      <p className="text-xs font-bold text-red-700 dark:text-red-300">
        End the pairing with {name}?
      </p>
      <p className="text-[11px] text-red-600/80 dark:text-red-400/80 font-medium leading-relaxed">
        Both of you lose access immediately. You can pair again later, but that mints a new grant
        and the old one stays dead.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onNo}
          className="flex-1 py-2 rounded-xl bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 font-bold text-[11px] cursor-pointer"
        >
          Keep pairing
        </button>
        <button
          type="button"
          onClick={onYes}
          className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-[11px] cursor-pointer"
        >
          End pairing
        </button>
      </div>
    </div>
  );
}

export default function PairsSubpage({
  onBack,
  onAddPeer,
}: {
  onBack: () => void;
  onAddPeer: () => void;
}) {
  const { grants, peers, markDirty } = useSocialData();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const nameFor = (handle: string | null) =>
    peers.find((p) => p.handle === handle)?.name || handle || "Unknown";

  const toggle = async (grantId: string, current: SocialVisibility) => {
    setBusyId(grantId);
    setError(null);
    try {
      await setGrantVisibility(grantId, current === "full" ? "coarse" : "full");
      markDirty();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not change visibility.");
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (grantId: string, secret: string) => {
    setBusyId(grantId);
    setError(null);
    try {
      await revokeGrant(grantId, secret);
      markDirty();
      setConfirming(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not end the pairing.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <BackButton onClick={onBack} className="self-start" />
        {/* In the header slot rather than a `hidden sm:flex` button, so it is
            reachable on mobile. */}
        <button
          type="button"
          onClick={onAddPeer}
          className="px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer shrink-0"
        >
          New pair
        </button>
      </div>

      <div className="px-1">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1">
          Campus
        </p>
        <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate">
          Pairs
        </h1>
      </div>

      <SectionHeader icon={Link2} title="Active pairings" count={grants.length} />

      {error && (
        <p className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold">
          {error}
        </p>
      )}

      {grants.length === 0 ? (
        <div className={EMPTY_STATE}>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">No pairings yet</p>
          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium mt-1.5 leading-relaxed">
            A pairing is what lets two students see each other&apos;s timetable. It is mutual, and
            either side can end it.
          </p>
          <button
            type="button"
            onClick={onAddPeer}
            className="mt-4 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Pair with someone
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className={LIST_SHELL}>
            {grants.map((g) => (
              <div key={g.grantId}>
                {confirming === g.grantId ? (
                  <div className="p-3">
                    <ConfirmRevoke
                      name={nameFor(g.peerHandle)}
                      onNo={() => setConfirming(null)}
                      onYes={() => void revoke(g.grantId, g.secret)}
                    />
                  </div>
                ) : (
                  <PairRow
                    name={nameFor(g.peerHandle)}
                    handle={g.peerHandle || "—"}
                    visibility={g.visibility}
                    createdAt={g.createdAt}
                    busy={busyId === g.grantId}
                    onToggleVisibility={() => void toggle(g.grantId, g.visibility)}
                    onRevoke={() => setConfirming(g.grantId)}
                  />
                )}
              </div>
            ))}
          </div>

          <p className="px-1 -mt-1 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium flex items-start gap-1.5">
            {busyId ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin mt-px shrink-0" />
                Updating…
              </>
            ) : (
              <>
                <ShieldCheck className="w-3 h-3 mt-px shrink-0" />
                Visibility is per-pair and shared — changing it applies to both of you at once.
                Coarse hides course, venue and title; full shows them.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
