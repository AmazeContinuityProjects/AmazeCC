"use client";

import { useState, useEffect, useMemo } from "react";
import { useSetAtom } from "jotai";
import { activeTabAtom } from "@/store";
import { api } from "@/lib/sync-engine";
import { Skeleton, cn } from "@amazecontinuityprojects/amazeui";
import { m } from "framer-motion";
import { ArrowUp, Calendar, MapPin, IndianRupee, ExternalLink, Rss, RefreshCcw, Building, WifiOff } from "lucide-react";
import { TILE_CARD, TONE_BADGE } from "@/lib/uiTokens";
import {
  EmptyPanel,
  GhostButton,
  IconButton,
  InsightCarousel,
  ListSkeleton,
  PageShell,
  StatTile,
  useCarousel,
  type InsightSlide,
} from "../shared/primitives";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Club announcements.
 *
 * A feed is a different shape from a directory, so the page borrows only the
 * chrome and the surfaces: same `PageShell`, same hero tiles, same `TILE_CARD`
 * for a post. The body of a post is prose written by club representatives, so it
 * keeps real Markdown rendering — `prose-zinc` for the palette, with the first
 * and last paragraph's margins flattened so a short post does not sit in a
 * column of empty space.
 */
const MARKDOWN =
  "prose prose-sm prose-zinc dark:prose-invert max-w-none text-zinc-700 dark:text-zinc-300 prose-headings:font-outfit prose-p:leading-relaxed prose-a:text-indigo-600 hover:prose-a:text-indigo-500 dark:prose-a:text-indigo-400 prose-img:rounded-xl [&>p:first-child]:mt-0 [&>p:last-child]:mb-0";

export default function CommunityFeed({
  IDs,
  loginToVTOP,
  onBack,
}: {
  IDs?: any;
  loginToVTOP?: () => Promise<any>;
  onBack?: () => void;
}) {
  const [feed, setFeed] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const setActiveTab = useSetAtom(activeTabAtom);

  const fetchFeed = async (currentVtopId?: string) => {
    try {
      setError("");
      const vtopIdParam = currentVtopId ? `?vtop_id=${currentVtopId}` : "";
      const [feedRes, eventsRes] = await Promise.all([
        (api(`club-admin/feed${vtopIdParam}`, { parse: "raw" }) as Promise<Response>).then((res) => res.ok ? res.json() : Promise.reject(new Error(`API Error: ${res.status}`))),
        (api("events", { parse: "raw" }) as Promise<Response>).then((res) => res.ok ? res.json() : []).catch(() => [])
      ]);

      if (feedRes.success) {
        setFeed(feedRes.feed || []);
      } else {
        setError(feedRes.error || "Failed to load community feed");
      }
      if (Array.isArray(eventsRes)) {
        setEvents(eventsRes);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching feed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed(IDs?.VtopUsername);
  }, [IDs?.VtopUsername]);

  const handlePromote = async (postId: string) => {
    let currentAuthID = IDs?.VtopUsername;

    if (!currentAuthID) {
      if (loginToVTOP) {
        try {
          const creds = await loginToVTOP();
          currentAuthID = creds.authorizedID;
        } catch (e) {
          alert("You must be logged into VTOP to promote posts.");
          return;
        }
      } else {
        alert("You must be logged into VTOP to promote posts.");
        return;
      }
    }

    setActionLoading(postId);
    try {
      const data = (await api("club-admin/feed/promote", {
        method: "POST",
        body: { post_id: postId, vtop_id: currentAuthID }
      })) as any;
      if (data.success) {
        setFeed(prev => prev.map(p => {
          if (p.id === postId) {
            return {
              ...p,
              has_promoted: data.promoted,
              promote_count: data.promoted ? Number(p.promote_count) + 1 : Number(p.promote_count) - 1
            };
          }
          return p;
        }));
      } else {
        alert(data.error || "Failed to promote post");
      }
    } catch (e) {
      alert("An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const summary = useMemo(() => {
    const posters = new Set(feed.map((p) => p.club_id).filter(Boolean));
    return {
      posts: feed.length,
      clubs: posters.size,
      withEvent: feed.filter((p) => p.event_id).length,
      promoted: feed.filter((p) => p.has_promoted).length,
    };
  }, [feed]);

  const insightSlides = useMemo<InsightSlide[]>(() => {
    const slides: InsightSlide[] = [];
    if (summary.clubs > 0) {
      slides.push({
        id: "clubs",
        label: "Clubs posting",
        value: summary.clubs,
        sub: "With an announcement live",
        badge: "Clubs",
        tone: "indigo",
      });
    }
    if (summary.withEvent > 0) {
      slides.push({
        id: "events",
        label: "Event posts",
        value: summary.withEvent,
        sub: "Linked to a campus event",
        badge: "Event",
        tone: "violet",
      });
    }
    if (summary.promoted > 0) {
      slides.push({
        id: "promoted",
        label: "Promoted",
        value: summary.promoted,
        sub: "You boosted these",
        badge: "Yours",
        tone: "emerald",
      });
    }
    return slides;
  }, [summary]);

  // Longer than the app default: a feed has few distinct numbers, and a card
  // that changes every five seconds is just noise.
  const carousel = useCarousel(insightSlides.length, 8000);

  return (
    <PageShell
      onBack={onBack}
      eyebrow="Community Feed"
      title="Announcements"
      subtitle="What clubs and chapters have posted, newest first."
      actions={
        <IconButton
          title="Reload feed"
          onClick={() => {
            setLoading(true);
            fetchFeed(IDs?.VtopUsername);
          }}
        >
          <RefreshCcw className={loading ? "animate-spin" : ""} />
        </IconButton>
      }
      selectable
    >
      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Skeleton className="h-32 sm:h-36 rounded-[24px]" />
            <Skeleton className="h-32 sm:h-36 rounded-[24px]" />
          </div>
          <ListSkeleton rows={3} />
        </div>
      ) : error ? (
        <EmptyPanel
          tone="red"
          icon={<WifiOff className="w-7 h-7" />}
          title="Couldn't load the feed"
          description={error}
          action={
            <GhostButton
              onClick={() => {
                setLoading(true);
                fetchFeed(IDs?.VtopUsername);
              }}
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              Try again
            </GhostButton>
          }
        />
      ) : feed.length === 0 ? (
        <EmptyPanel
          icon={<Rss className="w-7 h-7" />}
          title="Nothing posted yet"
          description="Announcements from clubs and chapters will show up here as soon as their representatives publish one."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <StatTile
              label="Posts"
              value={summary.posts}
              sub={`From ${summary.clubs} ${summary.clubs === 1 ? "club" : "clubs"}`}
              badge="Live"
              tone="indigo"
            />
            <InsightCarousel
              slides={insightSlides}
              carousel={carousel}
              height="h-32 sm:h-36"
              ariaLabel="Feed insights"
            />
          </div>

          <div className="space-y-3">
            {feed.map((post) => {
              const eventDetails = post.event_id ? events.find((e) => e.eid === post.event_id) : null;
              return (
                <m.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={post.id}
                  className={cn(TILE_CARD, "space-y-4")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight leading-tight truncate">
                        Club {post.club_id}
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5">
                        {new Date(post.created_at).toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    {post.event_id && (
                      <span className={cn(TONE_BADGE.violet, "shrink-0")}>Event</span>
                    )}
                  </div>

                  <div className={MARKDOWN}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
                  </div>

                  {post.image_urls?.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {post.image_urls.map((url: string, i: number) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="block h-36 rounded-2xl overflow-hidden border border-zinc-200/70 dark:border-zinc-800/80 group"
                        >
                          <img
                            src={url}
                            alt="Attached"
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </a>
                      ))}
                    </div>
                  )}

                  {eventDetails && (
                    <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/25 border border-indigo-200/60 dark:border-indigo-900/40 p-4 flex flex-col sm:flex-row gap-4 items-center">
                      <div className="flex-1 w-full min-w-0">
                        <span className={cn(TONE_BADGE.indigo, "mb-2 inline-block")}>Featured Event</span>
                        <h4 className="text-base font-black text-zinc-900 dark:text-white font-outfit leading-snug">
                          {eventDetails.title}
                        </h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2 text-[11px] text-zinc-600 dark:text-zinc-300 font-medium">
                          {eventDetails.date && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                              {eventDetails.date}
                            </span>
                          )}
                          {eventDetails.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                              {eventDetails.location}
                            </span>
                          )}
                          {eventDetails.price && (
                            <span className="flex items-center gap-1.5">
                              <IndianRupee className="w-3.5 h-3.5 text-indigo-500" />
                              {eventDetails.price}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          // Event Hub reads this on mount and opens the event
                          // straight away, so the tab has to be switched after
                          // the key is written, not before.
                          sessionStorage.setItem("pendingEventOpen", eventDetails.title);
                          setActiveTab("events");
                        }}
                        className="w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs active:scale-[0.98] transition-all cursor-pointer"
                      >
                        <Building className="w-3.5 h-3.5" />
                        View in Event Hub
                      </button>
                    </div>
                  )}

                  {post.links?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {post.links.map((link: any, i: number) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 px-3 py-1.5 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-950/60 transition-colors"
                        >
                          {link.title}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ))}
                    </div>
                  )}

                  <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => handlePromote(post.id)}
                      disabled={actionLoading === post.id}
                      className={cn(
                        "inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50",
                        post.has_promoted
                          ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                          : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 border border-zinc-200/70 dark:border-zinc-800/80 hover:bg-zinc-200 dark:hover:bg-zinc-800"
                      )}
                    >
                      <ArrowUp className={cn("w-4 h-4", post.has_promoted && "fill-current")} />
                      <span className="tabular-nums">{post.promote_count || 0} Promotes</span>
                    </button>
                  </div>
                </m.div>
              );
            })}
          </div>
        </>
      )}
    </PageShell>
  );
}
