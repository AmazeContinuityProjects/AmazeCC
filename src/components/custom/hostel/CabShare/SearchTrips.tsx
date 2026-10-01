"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/sync-engine";
import { AlertCircle, Bell, Calendar as CalendarIcon, Clock, Clock3, Loader2, MapPin, Route, Search, Send, User } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import BottomSheet from "../../shared/BottomSheet";
import { fallbackHubs, getLocalTrips, readJsonResponse, saveLocalTrips, dedupeHubs } from "./cabShareFallback";
import SelectField from "../../shared/primitives/SelectField";
import { EmptyPanel, ListRowText, ListSkeleton, SectionHeader, ToneBadge } from "../../shared/primitives";
import { FIELD_INPUT, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";

const FIELD_LABEL =
  "block text-[10px] font-black uppercase tracking-wider text-text-muted mb-1";

export default function SearchTrips({ cabShareUser }: { cabShareUser: any }) {
  const [hubs, setHubs] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPendingModal, setShowPendingModal] = useState(false);

  const [fromHubId, setFromHubId] = useState("");
  const [hubId, setHubId] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    fetchHubs();
    // Default search for today's date
    const today = new Date().toISOString().split('T')[0];
    setDate(today);
  }, []);

  const fetchHubs = async () => {
    try {
      const res = await api("cabshare/hubs", { parse: "raw" });
      const data = await readJsonResponse(res as Response);
      if (data?.success) {
        const unique = dedupeHubs(data.hubs, fallbackHubs);
        setHubs(unique);
      } else {
        setHubs(fallbackHubs);
      }
    } catch (e) {
      setHubs(fallbackHubs);
    }
  };

  const handleFromChange = (val: string) => {
    if (val && val === hubId && hubs.length > 1) {
      const next = hubs.find(h => h.hub_id.toString() !== val);
      setHubId(next ? next.hub_id.toString() : "");
    }
    setFromHubId(val);
  };

  const handleToChange = (val: string) => {
    if (val && val === fromHubId && hubs.length > 1) {
      const next = hubs.find(h => h.hub_id.toString() !== val);
      setFromHubId(next ? next.hub_id.toString() : "");
    }
    setHubId(val);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromHubId && hubId && fromHubId === hubId) {
      setMessage({ type: "error", text: "From and To cannot be the same location." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (fromHubId) params.append("from_hub_id", fromHubId);
      if (hubId) params.append("hub_id", hubId);
      if (date) params.append("date", date);
      params.append("reg_number", cabShareUser.reg_number); // To exclude own trips

      const res = await api(`cabshare/trips?${params.toString()}`, { parse: "raw" });
      const data = await readJsonResponse(res as Response);
      if (data?.success) {
        setTrips(data.trips);
      } else {
        const localTrips = getLocalTrips().filter((trip: any) => {
          const matchesFrom = !fromHubId || Number(trip.from_hub_id) === Number(fromHubId);
          const matchesHub = !hubId || Number(trip.hub_id) === Number(hubId);
          const matchesDate = !date || trip.travel_date === date;
          const notMine = trip.reg_number !== cabShareUser.reg_number;
          return matchesFrom && matchesHub && matchesDate && notMine;
        });
        setTrips(localTrips);
        if (localTrips.length === 0) {
          setMessage({ type: "error", text: "Cab Share server is unavailable. Showing local rides saved on this device." });
        }
      }
      setSearched(true);
    } catch (e) {
      setTrips(getLocalTrips().filter((trip: any) => trip.reg_number !== cabShareUser.reg_number));
      setSearched(true);
      setMessage({ type: "error", text: "Cab Share server is unavailable. Showing local rides saved on this device." });
    }
    setLoading(false);
  };

  const handleJoinRequest = async (trip_id: number) => {
    try {
      const res = await api("cabshare/match", {
        method: "POST",
        body: {
          reg_number: cabShareUser.reg_number,
          trip_id,
          action: "request"
        }
      });
      const data = await readJsonResponse(res as Response);
      if (data?.success) {
        setShowPendingModal(true);
        handleSearch({ preventDefault: () => {} } as React.FormEvent);
      } else {
        const trips = getLocalTrips().map((trip: any) =>
          trip.trip_id === trip_id
            ? {
                ...trip,
                requests: [
                  ...(trip.requests || []),
                  {
                    match_id: Date.now(),
                    name: cabShareUser.name || cabShareUser.reg_number,
                    phone_number: cabShareUser.phone_number,
                    status: "pending",
                  },
                ],
              }
            : trip
        );
        saveLocalTrips(trips);
        setShowPendingModal(true);
      }
    } catch (e) {
      setMessage({ type: "error", text: "Cab Share server is unavailable. Requests can only be saved locally right now." });
    }
  };

  const handleAlertMe = async () => {
    try {
      const res = await api("cabshare/waitlist", {
        method: "POST",
        body: {
          reg_number: cabShareUser.reg_number,
          hub_id: parseInt(hubId),
          travel_date: date
        }
      });
      const data = await readJsonResponse(res as Response);
      if (data?.success) {
        setMessage({ type: "success", text: "You will be notified when a matching ride is posted." });
      } else {
        setMessage({ type: "error", text: "Cab Share alerts need the server, which is unavailable right now." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Cab Share alerts need the server, which is unavailable right now." });
    }
  };

  const hubName = (hub: any) => hub?.hub_name || (hub?.hub_id ? `Hub #${hub.hub_id}` : "");
  const routeLabel = (trip: any) => {
    const from = trip.from_hub_name || hubName({ hub_id: trip.from_hub_id });
    return `${from ? `${from} → ` : ""}${trip.hub_name}`;
  };

  return (
    <div className="space-y-6">
      <div className={TILE_CARD}>
        <div className="flex items-center gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON_TILE.indigo}`}>
            <Route className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black text-text-heading font-outfit tracking-tight">Find a matching ride</h2>
            <p className="text-[11px] text-text-secondary dark:text-text-muted font-medium mt-0.5">
              Search by hub and date, then request to join a posted ride.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSearch}
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_140px]"
        >
          <label className="block">
            <span className={FIELD_LABEL}>From</span>
            <SelectField
              value={fromHubId}
              options={[
                { value: "", label: "Any" },
                ...hubs.map((h) => ({ value: h.hub_id.toString(), label: h.hub_name })),
              ]}
              onChange={handleFromChange}
            />
          </label>

          <label className="block">
            <span className={FIELD_LABEL}>To</span>
            <SelectField
              value={hubId}
              options={[
                { value: "", label: "Any" },
                ...hubs.map((h) => ({ value: h.hub_id.toString(), label: h.hub_name })),
              ]}
              onChange={handleToChange}
            />
          </label>

          <label className="block">
            <span className={FIELD_LABEL}>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={FIELD_INPUT}
            />
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Search</>}
            </button>
          </div>
        </form>
      </div>

      {message && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold ${
            message.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
          }`}
        >
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={3} leading="dot" trailing />
      ) : trips.length === 0 ? (
        searched && hubId && date ? (
          <EmptyPanel
            icon={<Search className="h-7 w-7" />}
            title="No active rides found"
            description="Create an alert for this hub and date so you know when someone posts a matching ride."
            action={
              <button
                type="button"
                onClick={handleAlertMe}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-indigo-700"
              >
                <Bell className="w-4 h-4" /> Alert Me
              </button>
            }
          />
        ) : (
          <EmptyPanel
            icon={<MapPin className="h-7 w-7" />}
            tone="emerald"
            title="Search for available rides"
            description="Choose a hub and date to see students travelling around the same time."
          />
        )
      ) : (
        <div className="space-y-3">
          <SectionHeader
            icon={Route}
            title="Matching rides"
            count={trips.length}
            right={<ToneBadge tone="emerald">Open</ToneBadge>}
          />
          {trips.map(trip => (
            <article key={trip.trip_id} className={TILE_CARD}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON_TILE.emerald}`}>
                      <MapPin className="h-5 w-5" />
                    </span>
                    <ListRowText
                      title={routeLabel(trip)}
                      titleTooltip={routeLabel(trip)}
                      subtitle={`Hosted by ${trip.name}`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ToneBadge tone="zinc" icon={<CalendarIcon className="h-3 w-3" />}>
                      {new Date(trip.travel_date).toLocaleDateString()}
                    </ToneBadge>
                    <ToneBadge tone="zinc" icon={<Clock className="h-3 w-3" />}>
                      {trip.preferred_time} (±{trip.tolerance_hours}h)
                    </ToneBadge>
                    <ToneBadge tone="zinc" icon={<User className="h-3 w-3" />}>
                      {trip.name}
                    </ToneBadge>
                  </div>
                  {trip.notes && (
                    <p className="text-xs font-medium leading-relaxed text-text-secondary dark:text-text-muted">
                      {trip.notes}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => handleJoinRequest(trip.trip_id)}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700"
                >
                  <Send className="w-4 h-4" /> Request Join
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <AnimatePresence>
      {showPendingModal && (
        <BottomSheet onClose={() => setShowPendingModal(false)} overlayId="cabshare-pending" maxWidth="max-w-sm">
          <div className="flex flex-col items-center text-center py-2">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
              <Clock3 className="h-8 w-8" />
            </span>
            <h3 className="mt-5 text-xl font-black text-text-heading font-outfit">Request Pending</h3>
            <p className="mt-2 text-sm font-medium leading-relaxed text-text-secondary dark:text-text-muted">
              The host will see your request and respond soon. You can check the status in My Trips.
            </p>
            <button
              type="button"
              onClick={() => setShowPendingModal(false)}
              className="mt-6 w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 cursor-pointer active:scale-[0.98]"
            >
              Got it
            </button>
          </div>
        </BottomSheet>
      )}
      </AnimatePresence>
    </div>
  );
}
