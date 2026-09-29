"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, clearEventHubSession, eventHubRequest } from "@/lib/sync-engine";
import { Skeleton, cn } from "@amazecontinuityprojects/amazeui";
import { EventHubEvent, EventHubPreview } from "@/types/data/eventhub";
import {
  eventDateLabel,
  eventhubImageUrl,
  daysUntil,
  isFreeEvent,
  isRegistrationPaid,
  summariseEvents,
} from "@/lib/eventhub";
import { Calendar, CalendarOff, ChevronRight, RefreshCcw, Search, SearchX, Ticket, X } from "lucide-react";
import { m } from "framer-motion";
import { SEARCH_FIELD, TILE_CARD } from "@/lib/uiTokens";
import EventHubSubpage from "./EventHubSubpage";
import TabHelpFooter from "../shared/TabHelpFooter";
import {
  ChipTabs,
  DotPill,
  EmptyPanel,
  GhostButton,
  IconButton,
  InsightCarousel,
  PageShell,
  SegmentedControl,
  SectionHeader,
  StatTile,
  ToneBadge,
  useCarousel,
  type InsightSlide,
} from "../shared/primitives";

/** Demo fixture for the registered-events view, mirroring `fetchEvents`. */
const DEMO_REGISTERED = [
  {
    eid: "evt-002",
    title: "RoboSoccer Workshop",
    eligibility: "Open to all branches",
    type: "Robotics Workshop",
    date: "2026-07-22",
    location: "MG Block Lab 202",
    price: "Paid",
    registeredDetails: {
      paymentStatus: "Paid (Online)",
      orderId: "ORD-920194",
      registrationDate: "2026-06-20",
      certificateEligible: "Yes",
      attendanceStatus: "Attended",
    },
  },
];

/** "Free", or the fee as written. A blank price is free — see `isFreeEvent`. */
function priceLabel(event: any): string {
  const price = String(event?.price ?? "").trim();
  if (!price || isFreeEvent(event)) return "Free";
  return price;
}

function countdownLabel(days: number): string {
  if (days === 0) return "Happening today";
  if (days === 1) return "Tomorrow";
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

/** Payment state of a registration. Neutral when Event Hub sent no status at all. */
function PaymentPill({ details }: { details?: any }) {
  if (!details) return null;
  const status = String(details.paymentStatus ?? "").trim();
  if (!status) return <ToneBadge tone="zinc">Registered</ToneBadge>;
  return <ToneBadge tone={isRegistrationPaid(details) ? "emerald" : "amber"}>{status}</ToneBadge>;
}

/** How soon the event is. Renders nothing when the date is unreadable. */
function DateChip({ event }: { event: any }) {
  if (event?.isPastEvent) return <ToneBadge tone="zinc">Past</ToneBadge>;
  const days = daysUntil(event?.date);
  if (days === null) return null;
  if (days < 0) return <ToneBadge tone="zinc">Ended</ToneBadge>;
  if (days === 0) return <ToneBadge tone="emerald">Today</ToneBadge>;
  if (days === 1) return <ToneBadge tone="emerald">Tomorrow</ToneBadge>;
  if (days <= 7) return <ToneBadge tone="sky">{days}d left</ToneBadge>;
  return null;
}

/** Hide a poster that 404s rather than leaving a broken-image icon in the tile. */
function hideBrokenImage(e: React.SyntheticEvent<HTMLImageElement>) {
  (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
}

/**
 * Placeholder for the event grid.
 *
 * Shaped like the cards it stands in for — a poster block over a title and a
 * line of text — because `ListSkeleton`'s text rows would resolve into cards of
 * a completely different shape the moment the data landed.
 */
function CardSkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={cn(TILE_CARD, "pointer-events-none")}>
          <Skeleton className="mb-3.5 w-full h-40 rounded-2xl" />
          <Skeleton className="h-3.5 w-4/5 rounded" />
          <Skeleton className="mt-2 h-3 w-1/2 rounded" />
          <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center gap-2">
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="h-4 w-14 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Poster-led card. The list runs down the page, so this is the only event
 * layout: one poster to a card, at whatever width the grid column gives it.
 */
function EventCard({ event, onOpen }: { event: any; onOpen: (e: any) => void }) {
  return (
    <m.div
      whileTap={{ scale: 0.99 }}
      onClick={() => onOpen(event)}
      className="h-full cursor-pointer"
    >
      <div className={cn(TILE_CARD, "h-full flex flex-col")}>
        {/* Posters vary wildly in shape, so the frame takes the poster's own
            height rather than cropping it to a fixed ratio. */}
        <div className="mb-3.5 w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800">
          <img
            src={eventhubImageUrl(event.eid)}
            alt=""
            loading="lazy"
            className="w-full h-auto object-contain"
            onError={hideBrokenImage}
          />
        </div>

        <h3
          className="font-bold text-sm text-zinc-900 dark:text-white font-outfit leading-tight line-clamp-2"
          title={event.title}
        >
          {event.title}
        </h3>

        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span className="truncate">{eventDateLabel(event.date)}</span>
          {event.time ? (
            <>
              <span className="text-zinc-300 dark:text-zinc-700 shrink-0">&bull;</span>
              <span className="truncate">{event.time}</span>
            </>
          ) : null}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <DateChip event={event} />
          <PaymentPill details={event.registeredDetails} />
          {event.type ? <DotPill tone="violet">{event.type}</DotPill> : null}
          {event.eligibility ? <DotPill tone="sky">{event.eligibility}</DotPill> : null}
        </div>

        <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 truncate">
            {priceLabel(event)}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
            Details
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </m.div>
  );
}

export default function EventHubTab({
  IDs,
  onBack,
  setIsSubpageOpen,
  registeredEvents,
  setRegisteredEvents,
}: {
  IDs: any;
  onBack?: () => void;
  setIsSubpageOpen?: (isOpen: boolean) => void;
  registeredEvents?: any[];
  setRegisteredEvents?: (events: any[]) => void;
}) {
  const [events, setEvents] = useState<EventHubEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [selectedEvent, setSelectedEvent] = useState<EventHubEvent | null>(null);
  const [previewData, setPreviewData] = useState<EventHubPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [viewMode, setViewMode] = useState<"all" | "registered">("all");

  const [loadingRegistered, setLoadingRegistered] = useState(false);
  const [registeredError, setRegisteredError] = useState("");

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    if (IDs?.VtopUsername === "demo") {
      await new Promise((resolve) => setTimeout(resolve, 300));
      setEvents([
        {
          eid: "evt-001",
          title: "DevSprint '26 Hackathon",
          eligibility: "Open to all branches",
          type: "Coding Hackathon",
          date: "2026-07-15",
          location: "Netaji Auditorium",
          price: "Free",
          registeredDetails: null
        },
        {
          eid: "evt-002",
          title: "RoboSoccer Workshop",
          eligibility: "Open to all branches",
          type: "Robotics Workshop",
          date: "2026-07-22",
          location: "MG Block Lab 202",
          price: "Paid",
          registeredDetails: {
            paymentStatus: "Paid (Online)",
            orderId: "ORD-920194",
            registrationDate: "2026-06-20",
            certificateEligible: "Yes",
            attendanceStatus: "Attended"
          }
        }
      ]);
      setLoading(false);
      return;
    }
    try {
      const data: EventHubEvent[] = (await api("events")) as EventHubEvent[];

      // Deduplicate by eid
      const uniqueEventsMap = new Map<string, EventHubEvent>();
      data.forEach(event => {
        if (!uniqueEventsMap.has(event.eid)) {
          uniqueEventsMap.set(event.eid, { ...event });
        } else {
          const existing = uniqueEventsMap.get(event.eid)!;
          // Join eligibilities if they differ
          if (event.eligibility && existing.eligibility && !existing.eligibility.includes(event.eligibility)) {
            existing.eligibility += `, ${event.eligibility}`;
          }
        }
      });
      setEvents(Array.from(uniqueEventsMap.values()));
    } catch (err: any) {
      setError(err.message || "An error occurred");
      clearEventHubSession();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (events.length > 0) {
      const pendingEventName = sessionStorage.getItem("pendingEventOpen");
      if (pendingEventName) {
        sessionStorage.removeItem("pendingEventOpen");
        const ev = events.find(e => e.title === pendingEventName);
        if (ev) {
          openPreview(ev);
        } else {
          // If not in active events, construct a past event
          const regEv = registeredEvents?.find(e => e.name === pendingEventName);
          openPreview({
            eid: regEv?.orderId || "unknown",
            title: pendingEventName,
            isPastEvent: true,
            registeredDetails: regEv
          } as any);
        }
      }
    }
  }, [events, registeredEvents]);

  const openPreview = useCallback(async (event: EventHubEvent) => {
    setSelectedEvent(event);
    setPreviewData(null);
    setPreviewError("");

    if (event.isPastEvent) {
      setPreviewError("Details are no longer available for this event since it has already concluded or its registration period has ended.");
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    if (IDs?.VtopUsername === "demo") {
      await new Promise(resolve => setTimeout(resolve, 150));
      setPreviewData({
        eid: event.eid,
        description: event.eid === "evt-001"
          ? "Build innovative products and compete for cash prizes at the annual flagship dev sprint event hosted by VIT Chennai's Coding Club."
          : "Hands-on calibration workshop for micro-controllers and servo engines to build autonomous soccer robots.",
        metaDetails: {
          "Fee": event.price,
          "Location": event.location,
          "Date": event.date
        }
      });
      setPreviewLoading(false);
      return;
    }

    try {
      const data = (await eventHubRequest(IDs, "events/preview", {
        eid: event.eid,
        username: IDs.VtopUsername,
        password: IDs.VtopPassword,
      })) as EventHubPreview;
      setPreviewData(data);
    } catch (err: any) {
      setPreviewError(err.message || "Failed to load preview");
      clearEventHubSession();
    } finally {
      setPreviewLoading(false);
    }
  }, [IDs]);

  const closePreview = () => {
    setSelectedEvent(null);
    setPreviewData(null);
  };

  /**
   * Registrations are fetched the first time the view is opened, not on every
   * visit — the sync engine already hydrates `registeredEvents` in most
   * sessions, and re-hitting `events/profile` each time the user glanced back
   * would spend an Event Hub session for nothing.
   */
  const registeredRequestedRef = useRef(false);
  useEffect(() => {
    if (viewMode !== "registered" || registeredRequestedRef.current) return;
    registeredRequestedRef.current = true;

    if (!IDs?.VtopUsername || !IDs?.VtopPassword) {
      setRegisteredError("Save your VTOP credentials in Settings to see your registrations.");
      return;
    }
    if (registeredEvents && registeredEvents.length > 0) return;

    let cancelled = false;
    setLoadingRegistered(true);
    setRegisteredError("");

    (async () => {
      if (IDs.VtopUsername === "demo") {
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (!cancelled) setRegisteredEvents?.(DEMO_REGISTERED);
        return;
      }
      try {
        const data = (await eventHubRequest(IDs, "events/profile", {
          username: IDs.VtopUsername,
          password: IDs.VtopPassword,
        })) as any;
        const list = data.events || [];
        setRegisteredEvents?.(list);
        localStorage.setItem("registeredEvents", JSON.stringify(list));
      } catch (err: any) {
        if (!cancelled) setRegisteredError(err.message || "An error occurred");
        clearEventHubSession();
      } finally {
        if (!cancelled) setLoadingRegistered(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [viewMode, IDs, registeredEvents, setRegisteredEvents]);

  const summary = useMemo(
    () => summariseEvents(events, registeredEvents ?? []),
    [events, registeredEvents]
  );

  /**
   * The rotating second hero tile, built the same way the OD hours page builds
   * its own: one measurement per slide, and a slide that has nothing to say is
   * left out rather than shown as a zero.
   */
  const insightSlides = useMemo<InsightSlide[]>(() => {
    const slides: InsightSlide[] = [
      {
        id: "live",
        label: "Open now",
        value: summary.total,
        sub: `Across ${summary.categories} ${summary.categories === 1 ? "category" : "categories"}`,
        badge: "Live",
        tone: "indigo",
      },
    ];

    if (summary.total > 0) {
      slides.push({
        id: "free",
        label: "Free to enter",
        value: summary.free,
        sub: "No entry fee",
        badge: "Free",
        tone: "emerald",
      });
    }

    // Null means no event had a date we could read, which is not the same as
    // "nothing this week" — so the slide is skipped entirely in that case.
    if (summary.thisWeek !== null) {
      slides.push({
        id: "week",
        label: "Next 7 days",
        value: summary.thisWeek,
        sub: "Starting within a week",
        badge: "7d",
        tone: "sky",
      });
    }

    if (summary.next) {
      const { event, days } = summary.next;
      slides.push({
        id: "next",
        label: "Next up",
        value: event.title,
        sub: countdownLabel(days),
        badge: event.type || "Event",
        tone: "violet",
        onClick: () => openPreview(event as EventHubEvent),
      });
    }

    if (summary.unpaid > 0) {
      slides.push({
        id: "due",
        label: "Payment due",
        value: summary.unpaid,
        sub: "Registered, not settled",
        badge: "Due",
        tone: "amber",
        onClick: () => setViewMode("registered"),
      });
    }

    return slides;
  }, [summary, openPreview]);

  const carousel = useCarousel(insightSlides.length);

  if (selectedEvent) {
    return (
      <EventHubSubpage
        selectedEvent={selectedEvent}
        previewData={previewData}
        previewLoading={previewLoading}
        previewError={previewError}
        onClose={closePreview}
        setIsSubpageOpen={setIsSubpageOpen}
        IDs={IDs}
        registeredEvents={registeredEvents}
      />
    );
  }

  const types = ["All", ...Array.from(new Set(events.map(e => e.type).filter(Boolean)))];

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "All" || event.type === selectedType;
    return matchesSearch && matchesType;
  });

  const displayEvents = viewMode === "registered"
    ? (registeredEvents || []).map(re => {
        const matched = events.find(e => e.title === re.name);
        return matched ? { ...matched, registeredDetails: re } : {
          eid: `past_${re.orderId || re.name}`, // Prefix to easily identify
          title: re.name,
          date: re.date,
          time: re.time,
          location: re.venue,
          type: "Registered",
          imageSrc: null,
          eligibility: "",
          price: "",
          registeredDetails: re,
          isPastEvent: true
        };
      })
    : filteredEvents;

  const isRegisteredView = viewMode === "registered";

  return (
    <PageShell
      onBack={onBack}
      eyebrow="Event Hub"
      title="Event Hub"
      subtitle="Clubs, chapters and technical events at VIT."
      actions={
        <IconButton title="Reload events" onClick={fetchEvents}>
          <RefreshCcw className={loading ? "animate-spin" : ""} />
        </IconButton>
      }
      selectable
    >
      {/* ── HERO STATS ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Skeleton className="h-32 sm:h-36 rounded-[24px]" />
          <Skeleton className="h-32 sm:h-36 rounded-[24px]" />
        </div>
      ) : error ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setViewMode("registered")}
              className="w-full text-left cursor-pointer transition-transform hover:scale-[1.01] active:scale-[0.98]"
              title="Show my registrations"
            >
              <StatTile
                label="Registered"
                value={(registeredEvents || []).length}
                sub={`${summary.unpaid > 0 ? `${summary.unpaid} awaiting payment` : "All payments settled"}`}
                badge={summary.unpaid > 0 ? `${summary.unpaid} due` : "Paid"}
                tone={summary.unpaid > 0 ? "amber" : "emerald"}
              />
            </button>

            <InsightCarousel
              slides={insightSlides}
              carousel={carousel}
              height="h-32 sm:h-36"
              ariaLabel="Event insights"
            />
          </div>

          <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
            A blank fee means the event is free to enter. Registration and payment run on the
            official Event Hub portal — tap any card for the full details.
          </p>
        </>
      )}

      {/* ── LIST ── */}
      {error ? (
        <EmptyPanel
          tone="red"
          icon={<CalendarOff className="w-7 h-7" />}
          title="Couldn't reach Event Hub"
          description={error}
          action={
            <GhostButton onClick={fetchEvents}>
              <RefreshCcw className="w-3.5 h-3.5" />
              Try again
            </GhostButton>
          }
        />
      ) : loading ? (
        <CardSkeletonGrid count={6} />
      ) : loadingRegistered && isRegisteredView ? (
        <CardSkeletonGrid count={3} />
      ) : registeredError && isRegisteredView ? (
        <div
          className={cn(
            TILE_CARD,
            "flex items-center gap-3 text-sm font-semibold text-red-600 dark:text-red-400 border-red-500/25"
          )}
        >
          <CalendarOff className="w-4 h-4 shrink-0" />
          <span className="min-w-0">{registeredError}</span>
        </div>
      ) : displayEvents.length === 0 ? (
        <EmptyPanel
          tone={isRegisteredView ? "sky" : "indigo"}
          icon={isRegisteredView ? <Ticket className="w-7 h-7" /> : <SearchX className="w-7 h-7" />}
          title={
            isRegisteredView
              ? "You haven't registered for anything yet"
              : "No events match your filters"
          }
          description={
            isRegisteredView
              ? "Registrations you make here or on the Event Hub portal will show up in this list, with their payment status and certificates."
              : "Try a different search term, or clear the category filter to see everything that's open."
          }
        />
      ) : (
        <div className="space-y-4">
          <SectionHeader
            icon={isRegisteredView ? Ticket : Calendar}
            title={isRegisteredView ? "My Registrations" : "All Events"}
            count={displayEvents.length}
            right={
              <SegmentedControl
                options={[
                  { value: "all" as const, label: "All" },
                  { value: "registered" as const, label: "Registered" },
                ]}
                value={viewMode}
                onChange={setViewMode}
              />
            }
          />

          {!isRegisteredView && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search events..."
                  aria-label="Search events"
                  className={cn(SEARCH_FIELD, "pl-10 pr-10")}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {types.length > 2 && (
                <ChipTabs
                  options={types.map((type) => ({ value: type, label: type }))}
                  value={selectedType}
                  onChange={setSelectedType}
                  size="sm"
                />
              )}
            </div>
          )}

          {/* One column on a phone, filling out as the window widens. The list
              always runs down the page — never sideways. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayEvents.map((event: any) => (
              <EventCard key={event.eid} event={event} onOpen={openPreview} />
            ))}
          </div>
        </div>
      )}

      <TabHelpFooter tabId="events" />
    </PageShell>
  );
}
