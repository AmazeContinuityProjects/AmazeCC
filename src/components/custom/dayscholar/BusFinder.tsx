"use client";
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Bus, ChevronRight, MapPin, MessageCircle, RefreshCcw, Search } from "lucide-react";
import BottomSheet from "../shared/BottomSheet";
import TransportRegistration from "./TransportRegistration";
import {
  PlacementZones,
  RouteContacts,
  RouteIdentity,
  RouteSection,
  StopsTimeline,
  routeTone,
} from "./routeParts";
import {
  EmptyPanel,
  IconButton,
  ListRowText,
  ListShell,
  ListSkeleton,
  PageShell,
  StatTile,
  ToneBadge,
} from "../shared/primitives";
import { LIST_ROW, SEARCH_FIELD, TONE_ICON_TILE } from "@/lib/uiTokens";
import type { BusRoute, TransportData } from "@/types/transport";

interface BusFinderProps {
  buses: BusRoute[];
  transportData?: TransportData | null;
  transportLoading?: boolean;
  loginToVTOP?: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
  /** Re-pulls the route list; rendered as the header's refresh action. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /**
   * Host app's back. The hub is a tab, but it is reached from a home screen or a
   * nav item, so — like the libraries, payments and free-classrooms pages — it
   * offers a way out rather than being a dead end the system back gesture has to
   * rescue.
   */
  onBack?: () => void;
}

/**
 * The transport hub.
 *
 * Routes are a list of comparable things, so they are a `ListShell` of rows
 * rather than a two-up grid of cards: a card spent 200px of width per route to
 * say a route number, a name and a stop count, and the details all lived behind
 * a tap anyway. The registration block sits above the list because "which bus is
 * *mine*" is the question most people arrive with, and the full route list is
 * the fallback.
 */
const BusFinder = ({
  buses,
  transportData,
  transportLoading,
  loginToVTOP,
  onRefresh,
  refreshing,
  onBack,
}: BusFinderProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBus, setSelectedBus] = useState<BusRoute | null>(null);

  const filteredBuses = buses.filter((bus) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      bus.route.toLowerCase().includes(query) ||
      bus.boardingPoints.some((point) => point.toLowerCase().includes(query)) ||
      (bus.driverName || "").toLowerCase().includes(query) ||
      (bus.driverPhone || "").includes(query)
    );
  });

  const acCount = buses.filter((b) => b.type === "AC").length;

  return (
    <PageShell
      eyebrow="Transport"
      title="Bus Routes"
      subtitle="Bus routes, boarding points, vehicle placements & contact info"
      onBack={onBack}
      actions={
        onRefresh ? (
          <IconButton
            onClick={onRefresh}
            title="Refresh bus data"
            disabled={refreshing}
          >
            <RefreshCcw
              className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-500" : ""}`}
            />
          </IconButton>
        ) : null
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatTile
            label="Routes running"
            value={buses.length}
            badge="Live"
            tone="neutral"
            sub="across the campus"
          />
          {/* AC is the scarce seat, so it gets its own number rather than being
              buried in the route list. */}
          <StatTile
            label="AC buses"
            value={acCount}
            badge={acCount > 0 ? "Limited seats" : "None listed"}
            tone={acCount > 0 ? "sky" : "zinc"}
            sub={`of ${buses.length} total routes`}
          />
        </div>

        <TransportRegistration
          data={transportData ?? null}
          loading={transportLoading ?? false}
          loginToVTOP={
            loginToVTOP ?? (async () => ({ cookies: [], authorizedID: "", csrf: "" }))
          }
          buses={buses}
        />

        <RouteSection
          title="All routes"
          icon={Bus}
          count={filteredBuses.length}
        >
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search route, stop or driver…"
                aria-label="Search routes"
                className={`${SEARCH_FIELD} pl-11`}
              />
            </div>

            {filteredBuses.length === 0 ? (
              <EmptyPanel
                icon={<Search className="h-7 w-7" />}
                tone="indigo"
                title="No routes found"
                description={
                  searchQuery
                    ? `Nothing matches “${searchQuery}”. Try a route number, a stop name or a driver's name.`
                    : "No bus routes have been published yet. Pull to refresh, or check back once the transport office publishes the list."
                }
                action={
                  searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-indigo-700"
                    >
                      Clear search
                    </button>
                  ) : null
                }
              />
            ) : (
              <ListShell>
                {filteredBuses.map((bus, i) => (
                  <button
                    key={`${bus.id}-${i}`}
                    type="button"
                    onClick={() => setSelectedBus(bus)}
                    className={`${LIST_ROW} cursor-pointer`}
                  >
                    <span
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border font-black text-sm font-outfit ${TONE_ICON_TILE[routeTone(bus.type)]}`}
                    >
                      {bus.id}
                    </span>
                    <ListRowText
                      title={bus.route}
                      titleTooltip={bus.route}
                      subtitle={`${bus.type} · ${bus.stops?.length || bus.boardingPoints.length} stops`}
                    />
                    <ToneBadge tone={routeTone(bus.type)}>{bus.type}</ToneBadge>
                    <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
                  </button>
                ))}
              </ListShell>
            )}
          </div>
        </RouteSection>
      </div>

      <AnimatePresence>
        {selectedBus && (
          <BusDetailSheet bus={selectedBus} onClose={() => setSelectedBus(null)} />
        )}
      </AnimatePresence>
    </PageShell>
  );
};

/** The route sheet. Stops are capped because the sheet is height-constrained. */
function BusDetailSheet({ bus, onClose }: { bus: BusRoute; onClose: () => void }) {
  const stops = bus.stops || [];
  const boardingPoints = bus.boardingPoints || [];

  return (
    <BottomSheet onClose={onClose} overlayId="bus-detail" maxWidth="max-w-lg">
      <div className="space-y-5">
        <div className="pb-4 border-b border-border-muted">
          <RouteIdentity route={bus} />
        </div>

        <RouteContacts route={bus} />

        {stops.length > 0 ? (
          <RouteSection title="Stops & pickup times" icon={MapPin} count={stops.length}>
            <StopsTimeline stops={stops} limit={5} />
            {stops.length > 5 && (
              <p className="px-1 text-[11px] font-medium text-text-muted">
                +{stops.length - 5} more stops
              </p>
            )}
          </RouteSection>
        ) : boardingPoints.length > 0 ? (
          <RouteSection title="Route path" icon={MapPin} count={boardingPoints.length}>
            <ListShell>
              {boardingPoints.map((bp, i) => (
                <div key={`${bp}-${i}`} className="flex items-center gap-2.5 py-2.5 px-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 shrink-0" />
                  <span className="text-xs font-semibold text-text-heading">{bp}</span>
                </div>
              ))}
            </ListShell>
          </RouteSection>
        ) : null}

        {bus.placements && bus.placements.length > 0 && (
          <RouteSection
            title="Placements"
            icon={Bus}
            count={bus.placements.length}
          >
            <PlacementZones placements={bus.placements} />
          </RouteSection>
        )}

        {bus.whatsappGroup && (
          <a
            href={bus.whatsappGroup}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 text-sm font-black bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Join WhatsApp Group
          </a>
        )}
      </div>
    </BottomSheet>
  );
}

export default BusFinder;
