"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/sync-engine";
import { Calendar, Check, Clock, Inbox, MapPin, Phone, Send, X } from "lucide-react";
import ShareTripButton from "./ShareTripButton";
import { getLocalTrips, readJsonResponse, saveLocalTrips } from "./cabShareFallback";
import {
  EmptyPanel,
  IconButton,
  ListRowText,
  ListShell,
  ListSkeleton,
  SectionHeader,
  ToneBadge,
  ToneDot,
} from "../../shared/primitives";
import { LIST_ROW, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";

/** The three states a request can be in, as tone-map keys. */
const REQUEST_TONE: Record<string, string> = {
  pending: "amber",
  accepted: "emerald",
  rejected: "red",
};

const TRIP_TONE: Record<string, string> = {
  active: "emerald",
};

/** "Main Gate → Hostel Block B", or just the destination when no origin is set. */
const routeLabel = (trip: any) => {
  const from = trip.from_hub_name || (trip.from_hub_id ? `Hub #${trip.from_hub_id}` : "");
  return `${from ? `${from} → ` : ""}${trip.hub_name}`;
};

export default function MyTrips({
  cabShareUser,
  pendingCount = 0,
}: {
  cabShareUser: any;
  /** Lifted from the tab's poll so the section header can badge what is waiting. */
  pendingCount?: number;
}) {
  const [myTrips, setMyTrips] = useState<any[]>([]);
  const [joinedTrips, setJoinedTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const res = await api(`cabshare/trips/me?reg_number=${cabShareUser.reg_number}`, { parse: "raw" });
      const data = await readJsonResponse(res as Response);
      if (data?.success) {
        setMyTrips(data.my_trips);
        setJoinedTrips(data.joined_trips);
      } else {
        setMyTrips(getLocalTrips().filter((trip: any) => trip.reg_number === cabShareUser.reg_number));
        setJoinedTrips([]);
      }
    } catch (e) {
      setMyTrips(getLocalTrips().filter((trip: any) => trip.reg_number === cabShareUser.reg_number));
      setJoinedTrips([]);
    }
    setLoading(false);
  };

  const handleMatchAction = async (match_id: number, action: string) => {
    try {
      setMessage(null);
      const res = await api("cabshare/match", {
        method: "POST",
        body: {
          reg_number: cabShareUser.reg_number,
          match_id,
          action
        }
      });
      const data = await readJsonResponse(res as Response);
      if (data?.success) {
        setMessage({ type: "success", text: action === "accept" ? "Ride request accepted." : "Ride request rejected." });
        fetchTrips();
      } else {
        setMessage({ type: "error", text: data.error || "Could not update request." });
      }
    } catch (e) {
      const trips = getLocalTrips().map((trip: any) => ({
        ...trip,
        requests: (trip.requests || []).map((request: any) =>
          request.match_id === match_id ? { ...request, status: action === "accept" ? "accepted" : "rejected" } : request
        ),
      }));
      saveLocalTrips(trips);
      setMessage({ type: "success", text: action === "accept" ? "Ride request accepted locally." : "Ride request rejected locally." });
      fetchTrips();
    }
  };

  if (loading) return <ListSkeleton rows={4} leading="dot" trailing />;

  const renderTripMeta = (trip: any) => (
    <div className="mt-2 flex flex-wrap gap-2">
      <ToneBadge tone="zinc" icon={<Calendar className="h-3 w-3" />}>
        {new Date(trip.travel_date).toLocaleDateString()}
      </ToneBadge>
      <ToneBadge tone="zinc" icon={<Clock className="h-3 w-3" />}>
        {trip.preferred_time}
      </ToneBadge>
    </div>
  );

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {message && (
        <div
          className={`flex items-center gap-2 rounded-2xl border p-4 text-sm font-semibold xl:col-span-2 ${
            message.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Trips I Posted */}
      <section className="space-y-4">
        <SectionHeader
          leading={<ToneDot tone="indigo" />}
          title="Rides I Posted"
          count={myTrips.length}
          right={pendingCount > 0 ? <ToneBadge tone="amber">{pendingCount} pending</ToneBadge> : null}
        />
        {myTrips.length === 0 ? (
          <EmptyPanel
            icon={<Inbox className="h-7 w-7" />}
            tone="indigo"
            title="No posted rides"
            description="Post a ride when you are booking a cab and want to split the trip."
          />
        ) : (
          <div className="space-y-4">
            {myTrips.map(trip => {
              const requests: any[] = trip.requests || [];
              const route = routeLabel(trip);
              return (
                <article key={trip.trip_id} className={TILE_CARD}>
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON_TILE.sky}`}>
                      <MapPin className="h-5 w-5" />
                    </span>
                    <ListRowText
                      title={route}
                      titleTooltip={route}
                      titleTag="h4"
                      right={
                        <>
                          <ToneBadge tone={TRIP_TONE[trip.status] ?? "zinc"}>{trip.status}</ToneBadge>
                          <ShareTripButton trip={trip} />
                        </>
                      }
                    />
                  </div>
                  {renderTripMeta(trip)}

                  <div className="mt-4 border-t border-border-muted pt-4">
                    <SectionHeader
                      leading={<ToneDot tone={requests.some(r => r.status === "pending") ? "amber" : "zinc"} />}
                      title="Join Requests"
                      count={requests.length}
                      className="mb-3"
                    />
                    {requests.length > 0 ? (
                      <ListShell>
                        {requests.map((req: any) => (
                          <div key={req.match_id} className={LIST_ROW}>
                            <ListRowText
                              title={req.name}
                              subtitle={
                                req.status === "accepted" ? (
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" /> {req.phone_number}
                                  </span>
                                ) : undefined
                              }
                              right={
                                req.status === "pending" ? (
                                  <>
                                    <IconButton title="Accept request" onClick={() => handleMatchAction(req.match_id, "accept")} className="hover:bg-emerald-500/10">
                                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                    </IconButton>
                                    <IconButton title="Reject request" onClick={() => handleMatchAction(req.match_id, "reject")} className="hover:bg-red-500/10">
                                      <X className="h-4 w-4 text-red-600 dark:text-red-400" />
                                    </IconButton>
                                  </>
                                ) : (
                                  <ToneBadge tone={REQUEST_TONE[req.status] ?? "zinc"}>{req.status}</ToneBadge>
                                )
                              }
                            />
                          </div>
                        ))}
                      </ListShell>
                    ) : (
                      <p className="rounded-2xl border border-dashed border-border-strong px-4 py-3 text-xs font-semibold text-text-muted">
                        No requests yet.
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Trips I Joined */}
      <section className="space-y-4">
        <SectionHeader
          leading={<ToneDot tone="emerald" />}
          title="Rides I Requested"
          count={joinedTrips.length}
        />
        {joinedTrips.length === 0 ? (
          <EmptyPanel
            icon={<Send className="h-7 w-7" />}
            tone="emerald"
            title="No ride requests"
            description="Requested rides will show their approval status and host contact details here."
          />
        ) : (
          <div className="space-y-4">
            {joinedTrips.map(trip => {
              const route = routeLabel(trip);
              return (
                <article key={trip.trip_id} className={TILE_CARD}>
                  <div className="flex items-start gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON_TILE.emerald}`}>
                      <MapPin className="h-5 w-5" />
                    </span>
                    <ListRowText
                      title={route}
                      titleTooltip={route}
                      titleTag="h4"
                      right={<ToneBadge tone={REQUEST_TONE[trip.match_status] ?? "zinc"}>{trip.match_status}</ToneBadge>}
                    />
                  </div>
                  {renderTripMeta(trip)}
                  <p className="mt-3 text-xs font-semibold text-text-secondary dark:text-text-muted">
                    Host: <strong className="text-text-heading">{trip.owner_name}</strong>
                  </p>
                  {trip.match_status === "accepted" && (
                    <p className="mt-1 flex items-center gap-1 text-sm font-black text-emerald-600 dark:text-emerald-400">
                      <Phone className="h-4 w-4" /> {trip.owner_phone}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
