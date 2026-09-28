"use client";

/**
 * The three row shapes the Social surfaces share.
 *
 * These exist because the same "avatar + name + meta + chevron" block was
 * written out four times in `SocialTab.tsx`, each copy drifting. The house
 * grammar is `LIST_ROW`: icon well, then a `min-w-0 flex-1` text block, then an
 * optional count chip, then `ChevronRight`.
 *
 * Colour discipline, as in Libraries: colour appears only in the icon well, the
 * status dot, or a tone-mapped number. Everything else is zinc.
 */

import React from "react";
import { ChevronRight, Eye, EyeOff, Pencil, Trash2, Users } from "lucide-react";
import {
  CHIP,
  LIST_ROW,
  SECTION_CHIP,
  TONE_BADGE,
  TONE_ICON_TILE,
  TONE_TEXT,
} from "@/lib/libraries/ui";
import { STALE_AFTER_DAYS, type SocialVisibility } from "@/lib/social/types";
import { relativePublished, type PeerTimetable } from "@/lib/social/usePeerTimetables";
import type { OverlapMetrics } from "@/lib/social/schedule";

export function initials(name: string): string {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .join("")
      .substring(0, 2)
      .toUpperCase() || "AM"
  );
}

/**
 * The 1.5px status dot. Green means the peer is free in the slot covering right
 * now, which is the only live signal on the row.
 */
function StatusDot({ freeNow, known }: { freeNow: boolean; known: boolean }) {
  return (
    <span
      aria-label={known ? (freeNow ? "Free right now" : "In class right now") : "Status unknown"}
      title={known ? (freeNow ? "Free right now" : "In class right now") : "Status unknown"}
      className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-900 ${
        !known ? "bg-zinc-300 dark:bg-zinc-700" : freeNow ? "bg-emerald-500" : "bg-amber-500"
      }`}
    />
  );
}

function Avatar({
  name,
  tone = "indigo",
  children,
}: {
  name: string;
  tone?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className="relative shrink-0">
      <span
        className={`w-10 h-10 rounded-2xl flex items-center justify-center text-[11px] font-black font-outfit border ${TONE_ICON_TILE[tone] ?? TONE_ICON_TILE.indigo}`}
      >
        {initials(name)}
      </span>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * People
 * ------------------------------------------------------------------ */

export function PeopleRow({
  peer,
  metrics,
  onOpen,
  right,
}: {
  peer: PeerTimetable;
  metrics?: OverlapMetrics;
  onOpen?: () => void;
  right?: React.ReactNode;
}) {
  const isStale =
    peer.stale ||
    (peer.publishedAt
      ? Date.now() - new Date(peer.publishedAt).getTime() > STALE_AFTER_DAYS * 86_400_000
      : false);

  // Real meta, never a placeholder. A peer who has not published must read as
  // absent rather than as a row of zeroes.
  const meta = (() => {
    if (peer.noGrant) return "not paired — no access";
    if (peer.error) return "could not be read";
    if (!peer.publishedAt) return "not published for this term";
    if (!peer.loaded) return "loading…";
    const common = metrics ? `${metrics.commonFreeSlots} common free slots` : "";
    return [common, `published ${relativePublished(peer.publishedAt)}`]
      .filter(Boolean)
      .join(" · ");
  })();

  const body = (
    <>
      <Avatar name={peer.name}>
        <StatusDot freeNow={metrics?.freeNow ?? true} known={Boolean(metrics)} />
      </Avatar>
      <ListRowText title={peer.name} subtitle={meta} />
      {isStale && <span className={`${CHIP} shrink-0 border-amber-500/20 text-amber-600 dark:text-amber-400`}>Stale</span>}
      {right}
      {onOpen && <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />}
    </>
  );

  // A <div> with an inner <button>, not a <button> with a nested <button>. The
  // old row nested a visibility toggle inside the row button, which is invalid
  // HTML and dropped clicks unpredictably.
  if (!right) {
    return (
      <button type="button" onClick={onOpen} className={`${LIST_ROW} cursor-pointer`}>
        {body}
      </button>
    );
  }
  return (
    <div className={`${LIST_ROW} cursor-default`}>
      {body}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pairs
 * ------------------------------------------------------------------ */

export function PairRow({
  name,
  handle,
  visibility,
  createdAt,
  onToggleVisibility,
  onRevoke,
  busy,
}: {
  name: string;
  handle: string;
  visibility: SocialVisibility;
  createdAt: string;
  onToggleVisibility: () => void;
  onRevoke: () => void;
  busy?: boolean;
}) {
  return (
    <div className={`${LIST_ROW} cursor-default`}>
      <Avatar name={name} tone={visibility === "full" ? "emerald" : "indigo"}>
        <span
          className={`w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-900 ${
            visibility === "full" ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        />
      </Avatar>
      <ListRowText title={name} subtitle={`${handle} · paired ${relativePublished(createdAt)}`} />
      <span
        className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
          visibility === "full" ? TONE_BADGE.emerald : TONE_BADGE.zinc
        }`}
      >
        {visibility === "full" ? "Full" : "Coarse"}
      </span>
      <button
        type="button"
        onClick={onToggleVisibility}
        disabled={busy}
        title={
          visibility === "full"
            ? "Switch to coarse: hide course, venue and title"
            : "Switch to full: share course, venue and title"
        }
        aria-label={visibility === "full" ? "Switch to coarse visibility" : "Switch to full visibility"}
        className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
      >
        {visibility === "full" ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </button>
      <button
        type="button"
        onClick={onRevoke}
        disabled={busy}
        title="End this pairing"
        aria-label={`End pairing with ${name}`}
        className="p-2 rounded-xl bg-zinc-100 hover:bg-red-50 dark:bg-zinc-900 dark:hover:bg-red-950/40 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 transition-all active:scale-95 cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Free right now
 * ------------------------------------------------------------------ */

export function FreeNowRow({
  peer,
  slotLabel,
  venue,
  onOpen,
}: {
  peer: PeerTimetable;
  /** Human label for the slot covering now, e.g. "MON · A1". */
  slotLabel: string | null;
  /** Only present when the grant is `full`; a coarse grant has no venue. */
  venue?: string | null;
  onOpen?: () => void;
}) {
  return (
    <button type="button" onClick={onOpen} className={`${LIST_ROW} cursor-pointer`}>
      <Avatar name={peer.name} tone="emerald">
        <span className="w-3.5 h-3.5 rounded-full border-2 border-white dark:border-zinc-900 bg-emerald-500" />
      </Avatar>
      <ListRowText
        title={peer.name}
        subtitle={
          venue ? `${slotLabel ?? "Free"} · ${venue}` : slotLabel ?? "Free for the rest of the slot"
        }
      />
      <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Group
 * ------------------------------------------------------------------ */

/**
 * One group, with its common-free headline.
 *
 * The count is the figure that matters, so it is tone-mapped: a group you have
 * never met in person scores worse than one you see often, which is the whole
 * point of grouping people.
 */
export function GroupRow({
  name,
  memberCount,
  pendingCount,
  commonFreeHours,
  matchPct,
  empty,
  onOpen,
  onEdit,
  onDelete,
}: {
  name: string;
  memberCount: number;
  /** Members still loading, so the figures are provisional. */
  pendingCount?: number;
  commonFreeHours?: number;
  matchPct?: number;
  empty?: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const tone = empty ? "zinc" : matchPct === undefined ? "zinc" : matchPct >= 70 ? "emerald" : matchPct >= 40 ? "amber" : "red";

  return (
    <div className={LIST_ROW}>
      <button
        type="button"
        onClick={onOpen}
        disabled={empty}
        className="contents text-left disabled:cursor-default"
      >
        <Avatar name={name} tone={tone}>
          <Users className="w-4 h-4" />
        </Avatar>
        <ListRowText
          title={name}
          subtitle={
            empty
              ? "no members left"
              : `${memberCount} ${memberCount === 1 ? "person" : "people"}${
                  pendingCount ? ` · ${pendingCount} loading` : ""
                }`
          }
        />
        {!empty && commonFreeHours !== undefined && (
          <span className="text-right shrink-0">
            <span className={`block text-sm font-black font-outfit ${TONE_TEXT[tone] ?? ""}`}>
              {commonFreeHours}h
            </span>
            <span className="block text-[9px] font-extrabold uppercase text-zinc-400 dark:text-zinc-500 leading-none">
              common
            </span>
          </span>
        )}
        <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
      </button>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          title="Choose members"
          aria-label={`Choose members of ${name}`}
          className="p-2 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all active:scale-95 cursor-pointer shadow-2xs"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete this group"
          aria-label={`Delete group ${name}`}
          className="p-2 rounded-xl bg-zinc-100 hover:bg-red-50 dark:bg-zinc-900 dark:hover:bg-red-950/40 border border-zinc-200/80 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 transition-all active:scale-95 cursor-pointer shadow-2xs"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Small shared bits
 * ------------------------------------------------------------------ */

/**
 * Re-exported so the social screens keep importing their section header from
 * this barrel. The component itself now lives in the shared primitives (it was
 * a byte-identical third copy).
 *
 * Imported from the leaf module rather than the `primitives` barrel on purpose:
 * the barrel reaches amazeui, whose dist bundle pulls in a .css import that
 * vitest cannot resolve — which would make this (test-imported) module
 * untestable.
 */
export { SectionHeader } from "@/components/custom/shared/primitives/Surfaces";
import { ListRowText } from "@/components/custom/shared/primitives/Surfaces";

/** A count in a tone colour, for carousel headlines. */
export function ToneNumber({
  value,
  tone,
  className = "",
}: {
  value: React.ReactNode;
  tone: string;
  className?: string;
}) {
  return (
    <span className={`block truncate font-black font-outfit tracking-tight leading-none ${TONE_TEXT[tone] ?? TONE_TEXT.zinc} ${className}`}>
      {value}
    </span>
  );
}
