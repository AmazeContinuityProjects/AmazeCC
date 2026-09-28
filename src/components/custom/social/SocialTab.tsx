"use client";

/**
 * Social — landing and shell.
 *
 * Rebuilt on the Libraries / Simplified Mobile Home grammar, importing the shared
 * tokens rather than hand-copying them. The previous version was 832 lines with
 * six responsibilities and not one extracted component; it defined its own
 * `TILE`/`LIST_SHELL`/`LIST_ROW`/`ICON_BUTTON` strings and had seven empty
 * states, none of which matched the house one.
 *
 * **The redundancy it removes.** The old landing had four entry points to
 * `free_now`: a pill, a "Campus Radar" banner, a carousel slide, and the tile.
 * Three of those are gone — the carousel now carries a *different* insight each
 * tick rather than re-navigating to a subpage that already has its own row.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  AlertTriangle,
  CalendarRange,
  Clock,
  Link2,
  Plus,
  Share2,
  Users,
} from "lucide-react";
import {
  CHIP,
  ICON_BUTTON,
  LIST_ROW,
  LIST_SHELL,
  TILE,
  TONE_BADGE,
  TONE_ICON_TILE,
  TONE_TEXT,
} from "@/lib/libraries/ui";
import { SectionHeader, initials } from "./rows";
import {
  InsightCarousel,
  ListRowText,
  useCarousel,
  type InsightSlide,
} from "../shared/primitives";

import PeopleSubpage from "./PeopleSubpage";
import PairsSubpage from "./PairsSubpage";
import FreeNowSubpage from "./FreeNowSubpage";
import CommonFreeGridSubpage from "./CommonFreeGridSubpage";
import ShareHandleSheet from "./ShareHandleSheet";
import AddPeerSheet from "./AddPeerSheet";
import PeerTimetableSheet from "./PeerTimetableSheet";
import { useSocialData } from "@/lib/social/useSocialData";
import { useOverlap, usePeerTimetables } from "@/lib/social/usePeerTimetables";
import { slotCoveringNow } from "@/lib/social/schedule";
import { STALE_AFTER_DAYS } from "@/lib/social/types";

type Screen = "landing" | "people" | "pairs" | "freeNow" | "grid";

export default function SocialTab({
  attendanceData,
  isDemo,
}: {
  attendanceData: any;
  isDemo?: boolean;
}) {
  const { identity, peers, grants, ownBusyMap, handle, markDirty, syncError } = useSocialData();
  const { peers: peerTimetables, loading: loadingPeers } = usePeerTimetables();
  const overlap = useOverlap(ownBusyMap, peerTimetables);

  const [screen, setScreen] = useState<Screen>("landing");
  const [shareOpen, setShareOpen] = useState(false);
  const [addPeerOpen, setAddPeerOpen] = useState(false);
  const [openPeer, setOpenPeer] = useState<string | null>(null);

  /* ── derived figures ─────────────────────────────────────────────── */

  const now = useMemo(() => new Date(), []);
  const currentSlot = useMemo(() => slotCoveringNow(now), [now]);

  const freeNowHandles = useMemo(() => {
    const out = new Set<string>();
    for (const p of peerTimetables) {
      if (p.loaded && overlap.get(p.handle)?.freeNow) out.add(p.handle);
    }
    return out;
  }, [peerTimetables, overlap]);

  const myStale = useMemo(() => {
    if (!identity?.derivedAt) return true;
    return Date.now() - new Date(identity.derivedAt).getTime() > STALE_AFTER_DAYS * 86_400_000;
  }, [identity]);

  const hasPublished = Boolean(identity && !myStale);
  const syncBadge = isDemo
    ? { label: "Demo", tone: "zinc" }
    : !identity
      ? { label: "Not synced", tone: "zinc" }
      : myStale
        ? { label: "Stale", tone: "amber" }
        : { label: "Synced", tone: "emerald" };

  const relativeSync = useMemo(() => {
    if (!identity?.derivedAt) return "Sync to publish your week";
    const mins = Math.max(0, Math.round((Date.now() - new Date(identity.derivedAt).getTime()) / 60_000));
    if (mins < 60) return `Last synced ${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `Last synced ${hours}h ago`;
    return `Last synced ${Math.round(hours / 24)}d ago`;
  }, [identity]);

  /* ── carousel ────────────────────────────────────────────────────── */

  const slides = useMemo(() => {
    const list: {
      id: string;
      title: string;
      headline: string;
      subline: string;
      badge: string;
      tone: string;
      onClick?: () => void;
    }[] = [];

    list.push({
      id: "freeNow",
      title: "Peers free now",
      headline: currentSlot ? String(freeNowHandles.size) : "—",
      subline: currentSlot
        ? `free in ${currentSlot.split(":")[0]} ${currentSlot.split(":")[1]}`
        : "outside class hours",
      badge: currentSlot ? "Now" : "Closed",
      tone: !currentSlot ? "zinc" : freeNowHandles.size > 0 ? "emerald" : "zinc",
      onClick: () => setScreen("freeNow"),
    });

    list.push({
      id: "pairs",
      title: "Pairings",
      headline: String(grants.length),
      subline: grants.length === 0 ? "pair with someone to begin" : "mutual, revocable any time",
      badge: grants.length === 0 ? "None" : "Active",
      tone: grants.length === 0 ? "amber" : "indigo",
      onClick: () => setScreen("pairs"),
    });

    list.push({
      id: "sync",
      title: "Last sync",
      headline: identity ? relativeSync.replace("Last synced ", "") : "Never",
      subline: identity ? "your week as VTOP reports it" : "run a sync to publish your week",
      badge: syncBadge.label,
      tone: myStale ? "amber" : "emerald",
    });

    return list;
  }, [currentSlot, freeNowHandles, grants.length, identity, relativeSync, syncBadge.label, myStale]);

  const carousel = useCarousel(slides.length);
  const insightSlides = useMemo<InsightSlide[]>(
    () =>
      slides.map((s) => ({
        id: s.id,
        label: s.title,
        value: s.headline,
        sub: s.subline,
        badge: s.badge,
        tone: s.tone,
        onClick: s.onClick,
      })),
    [slides]
  );

  const openPeerSheet = useCallback((h: string) => setOpenPeer(h), []);
  const peerForSheet = openPeer ? peerTimetables.find((p) => p.handle === openPeer) ?? null : null;

  /* ── chrome ──────────────────────────────────────────────────────── */

  const name = identity?.displayName || "Student";
  const myHandle = handle || "not issued yet";

  const landing = (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 px-1">
        {/* People — pinned */}
        <button
          type="button"
          onClick={() => setScreen("people")}
          className={`${TILE} h-32 sm:h-36`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
              People
            </span>
            <span
              className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 border ${TONE_BADGE[syncBadge.tone]}`}
            >
              {syncBadge.label}
            </span>
          </div>
          <div className="my-auto min-w-0">
            <span className="text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block truncate">
              {peers.length}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
              {freeNowHandles.size} free right now
            </p>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
          </div>
        </button>

        {/* Carousel — rotating insight, never a duplicate nav target */}
        <InsightCarousel
          slides={insightSlides}
          carousel={carousel}
          ariaLabel="Rotating insights"
        />
      </div>


      {/* Sections */}
      <div className="space-y-3">
        <SectionHeader icon={Users} title="Sections" count={4} />
        <div className={LIST_SHELL}>
          {(
            [
              { id: "people" as Screen, icon: Users, title: "People", desc: "Everyone you are paired with", count: peers.length, suffix: "paired", tone: "indigo" },
              { id: "pairs" as Screen, icon: Link2, title: "Pairs", desc: "Visibility and revocation", count: grants.length, suffix: "pairs", tone: "sky" },
              { id: "freeNow" as Screen, icon: Clock, title: "Free Right Now", desc: currentSlot ? `Free in ${currentSlot.split(":")[0]}` : "Outside class hours", count: freeNowHandles.size, suffix: "free", tone: "emerald" },
              { id: "grid" as Screen, icon: CalendarRange, title: "Common Free Grid", desc: "Where everyone's free", count: 0, suffix: "", tone: "amber" },
            ] as const
          ).map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setScreen(s.id)}
                className={`${LIST_ROW} cursor-pointer`}
              >
                <span className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${TONE_ICON_TILE[s.tone]}`}>
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <ListRowText title={s.title} subtitle={s.desc} />
                {s.count > 0 && <span className={`${CHIP} shrink-0`}>{s.count} {s.suffix}</span>}
                <span className="w-4 h-4 text-zinc-400 shrink-0 flex items-center justify-end">›</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
        Your timetable is derived from VTOP by the server, never uploaded from this device. Pairing is
        mutual, and either side can end it from Pairs.
      </p>
    </>
  );

  const subpage =
    screen === "people" ? (
      <PeopleSubpage
        onBack={() => setScreen("landing")}
        onOpenPeer={openPeerSheet}
        onAddPeer={() => setAddPeerOpen(true)}
      />
    ) : screen === "pairs" ? (
      <PairsSubpage onBack={() => setScreen("landing")} onAddPeer={() => setAddPeerOpen(true)} />
    ) : screen === "freeNow" ? (
      <FreeNowSubpage onBack={() => setScreen("landing")} onOpenPeer={openPeerSheet} />
    ) : (
      <CommonFreeGridSubpage onBack={() => setScreen("landing")} onOpenPeer={openPeerSheet} />
    );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 md:pb-8 animate-in fade-in duration-300 text-left select-none">
      {/*
        The social sync op swallows its own errors so a failed push cannot break
        the rest of the chain. That is right for the engine, but it left this page
        showing stale data with no explanation at all. This is the only place the
        failure surfaces, so it is deliberately above everything else.
      */}
      {syncError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3 text-sm text-amber-800 dark:text-amber-300"
        >
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold leading-tight">Social sync failed</p>
            <p className="text-xs opacity-85 break-words mt-0.5">{syncError}</p>
          </div>
        </div>
      )}
      {screen === "landing" && (
        <>
          {/* Simplified Mobile Home's identity pattern. More and Tools already own
              the back navigation, so a BackButton here would be wrong. */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black font-outfit border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
                {initials(name)}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1">
                  Campus
                </p>
                <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate">
                  Social
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                aria-label="Share your handle"
                title="Share your handle"
                className={ICON_BUTTON}
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setAddPeerOpen(true)}
                aria-label="Add a peer"
                title="Add a peer"
                className={ICON_BUTTON}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1 -mt-3 flex-wrap">
            <span className={`${CHIP} font-mono tracking-widest`}>{myHandle}</span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium truncate">
              {hasPublished ? "your handle" : "sync to publish your week"}
            </span>
          </div>
        </>
      )}

      {screen === "landing" ? landing : subpage}

      <AnimatePresence>
        {shareOpen && <ShareHandleSheet onClose={() => setShareOpen(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {addPeerOpen && (
          <AddPeerSheet
            onClose={() => setAddPeerOpen(false)}
            onPaired={() => {
              setAddPeerOpen(false);
              setScreen("people");
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {peerForSheet && (
          <PeerTimetableSheet
            peer={peerForSheet}
            ownBusyMap={ownBusyMap}
            onClose={() => setOpenPeer(null)}
          />
        )}
      </AnimatePresence>

      {loadingPeers && screen === "landing" && (
        <p className="sr-only" role="status">
          Loading peer timetables
        </p>
      )}
    </div>
  );
}

