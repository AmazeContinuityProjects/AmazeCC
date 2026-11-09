"use client";

/**
 * "Share timetable": where the old Social tab used to be.
 *
 * Friend timetables used to mean handles, QR pairing and timetables stored on
 * our server. They are now just links: this card turns the student's
 * registered timetable into an FFCS shape link (see `@/lib/timetableShareLink`)
 * that anyone can open, and points to the planner for everything social —
 * adding friends' links, scoring plans against them, and finding classmates.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarRange, Check, ChevronRight, Copy, ExternalLink, Info, Share2, Users, UsersRound } from "lucide-react";
import type { attendanceRes } from "@/types/data/attendance";
import { buildRegisteredShareLink } from "@/lib/timetableShareLink";
import { FFCS_PLANNER_PATH } from "@/lib/ffcsNavigation";
import { GHOST_BUTTON, LIST_ROW, LIST_SHELL, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";
import { ListRowText } from "../shared/primitives";

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-5 py-3 text-sm shadow-lg shadow-indigo-500/20 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500";

export default function TimetableShareCard({
  attendanceData,
  isDemo = false,
}: {
  attendanceData: attendanceRes | null | undefined;
  isDemo?: boolean;
}) {
  // `window` only exists after mount; the link needs the page's origin.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const link = useMemo(
    () => (origin ? buildRegisteredShareLink(attendanceData, origin) : null),
    [attendanceData, origin],
  );
  const [copied, setCopied] = useState(false);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the link is still selectable in the preview below.
    }
  };
  const share = async () => {
    if (!link) return;
    try {
      await navigator.share({ title: "My timetable", text: "My timetable on AmazeCC", url: link.url });
    } catch {
      // Share sheet dismissed.
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-start gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
        <Info className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary dark:text-text-muted leading-relaxed">
          Friend timetables are now shared as links. There&apos;s nothing to pair or sync: send your link, and open
          friends&apos; links in the FFCS planner.
        </p>
      </div>

      <section className={`${TILE_CARD} space-y-4`}>
        <div className="flex items-start gap-3">
          <span
            className={`w-11 h-11 rounded-2xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE.indigo}`}
          >
            <CalendarRange className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-black font-outfit tracking-tight text-text-heading">
              Share your timetable
            </h3>
            <p className="text-sm text-muted-foreground">
              A link to your registered timetable. Anyone can open it, without signing in. It shows your classes and
              nothing else.
            </p>
          </div>
        </div>

        {isDemo ? (
          <p className="text-sm text-muted-foreground rounded-2xl bg-surface-secondary/60 px-4 py-3">
            The demo account has no real timetable to share. Sign in with your own account to get your link.
          </p>
        ) : link ? (
          <>
            <div className="rounded-2xl border border-border-strong dark:border-border bg-surface px-3 py-2.5 text-xs font-mono text-text-secondary dark:text-text-muted break-all select-all">
              {link.url}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {canNativeShare ? (
                <button type="button" className={`${PRIMARY_BUTTON} sm:flex-1`} onClick={() => void share()}>
                  <Share2 className="w-4 h-4" /> Share link
                </button>
              ) : null}
              <button
                type="button"
                className={
                  canNativeShare
                    ? `${GHOST_BUTTON} justify-center py-3 text-sm font-bold`
                    : `${PRIMARY_BUTTON} sm:flex-1`
                }
                onClick={() => void copy()}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${GHOST_BUTTON} justify-center py-3 text-sm font-bold`}
              >
                <ExternalLink className="w-4 h-4" /> Preview
              </a>
            </div>
            <p className="text-xs text-muted-foreground">
              {link.classCount} {link.classCount === 1 ? "class" : "classes"}
              {link.skipped.length ? ` · left out (no class id): ${link.skipped.join(", ")}` : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground rounded-2xl bg-surface-secondary/60 px-4 py-3">
            Your link appears once your timetable has synced from VTOP. Sync, then come back here.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Plan with friends</h3>
        <div className={LIST_SHELL}>
          <Link href={FFCS_PLANNER_PATH} className={LIST_ROW}>
            <span
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE.violet}`}
            >
              <Users className="w-4 h-4" />
            </span>
            <ListRowText
              title="Friends in the FFCS planner"
              subtitle="Paste friends' links to view their timetables and plan around them"
              titleTag="span"
            />
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
          <Link href="/?open=friend-finder" className={LIST_ROW}>
            <span
              className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${TONE_ICON_TILE.amber}`}
            >
              <UsersRound className="w-4 h-4" />
            </span>
            <ListRowText title="Find classmates" subtitle="See who shares your classes" titleTag="span" />
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
          </Link>
        </div>
      </section>
    </div>
  );
}
