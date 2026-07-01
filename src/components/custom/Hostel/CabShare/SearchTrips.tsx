"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../../Main";
import { Loader2, Search, MapPin, Clock, Calendar as CalendarIcon, User, Send, Bell, Route, AlertCircle } from "lucide-react";
import EmptyState from "../../shared/EmptyState";
import { fallbackHubs, getLocalTrips, readJsonResponse, saveLocalTrips, dedupeHubs } from "./cabShareFallback";

export default function SearchTrips({ cabShareUser }: { cabShareUser: any }) {
  const [hubs, setHubs] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
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
      const res = await fetch(`${API_BASE}/api/cabshare/hubs`);
      const data = await readJsonResponse(res);
      if (data?.success) {
        const unique = dedupeHubs(data.hubs);
        setHubs(unique);
      } else {
        setHubs(fallbackHubs);
      }
    } catch (e) {
      setHubs(fallbackHubs);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (fromHubId) params.append("from_hub_id", fromHubId);
      if (hubId) params.append("hub_id", hubId);
      if (date) params.append("date", date);
      params.append("reg_number", cabShareUser.reg_number); // To exclude own trips

      const res = await fetch(`${API_BASE}/api/cabshare/trips?${params.toString()}`);
      const data = await readJsonResponse(res);
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
      const res = await fetch(`${API_BASE}/api/cabshare/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          reg_number: cabShareUser.reg_number, 
          trip_id, 
          action: "request" 
        })
      });
      const data = await readJsonResponse(res);
      if (data?.success) {
        setMessage({ type: "success", text: "Request sent successfully." });
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
        setMessage({ type: "success", text: "Request saved locally on this device." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Cab Share server is unavailable. Requests can only be saved locally right now." });
    }
  };

  const handleAlertMe = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/cabshare/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reg_number: cabShareUser.reg_number,
          hub_id: parseInt(hubId),
          travel_date: date
        })
      });
      const data = await readJsonResponse(res);
      if (data?.success) {
        setMessage({ type: "success", text: "You will be notified when a matching ride is posted." });
      } else {
        setMessage({ type: "error", text: "Cab Share alerts need the server, which is unavailable right now." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Cab Share alerts need the server, which is unavailable right now." });
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400">
            <Route className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-950 dark:text-white">Find a matching ride</h2>
            <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-400">Search by hub and date, then request to join a posted ride.</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_140px]">
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">From</label>
            <select 
              value={fromHubId} 
              onChange={(e) => setFromHubId(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            >
              <option value="">Any</option>
              {hubs.map(h => (
                <option key={`search-from-${h.hub_id}`} value={h.hub_id}>{h.hub_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">To</label>
            <select 
              value={hubId} 
              onChange={(e) => setHubId(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            >
              <option value="">Any</option>
              {hubs.map(h => (
                <option key={`search-to-${h.hub_id}`} value={h.hub_id}>{h.hub_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
            />
          </div>
          <div className="flex items-end">
            <button 
              type="submit" 
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Search</>}
            </button>
          </div>
        </form>
      </section>

      {message && (
        <div className={`flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold ${
          message.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400"
            : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400"
        }`}>
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center rounded-3xl border border-gray-200 bg-white py-16 shadow-sm dark:border-white/10 dark:bg-black">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : trips.length === 0 ? (
          searched && hubId && date ? (
            <EmptyState
              icon={<Search className="h-10 w-10" />}
              title="No active rides found"
              description="Create an alert for this hub and date so you know when someone posts a matching ride."
              className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-black"
              action={
              <button 
                onClick={handleAlertMe}
                className="inline-flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-black text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-400"
              >
                <Bell className="w-4 h-4" /> Alert Me
              </button>
              }
            />
          ) : (
            <EmptyState
              icon={<MapPin className="h-10 w-10" />}
              title="Search for available rides"
              description="Choose a hub and date to see students travelling around the same time."
              className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-black"
            />
          )
        ) : (
          trips.map(trip => (
            <article key={trip.trip_id} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-black">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black text-gray-950 dark:text-white">
                        {trip.from_hub_name || trip.from_hub_id ? `${trip.from_hub_name || `Hub #${trip.from_hub_id}`} → ` : ''}{trip.hub_name}
                      </h3>
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Hosted by {trip.name}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold text-gray-600 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 dark:border-white/10"><CalendarIcon className="w-3.5 h-3.5" /> {new Date(trip.travel_date).toLocaleDateString()}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 dark:border-white/10"><Clock className="w-3.5 h-3.5" /> {trip.preferred_time} (±{trip.tolerance_hours}h)</span>
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 dark:border-white/10"><User className="w-3.5 h-3.5" /> {trip.name}</span>
                  </div>
                  {trip.notes && (
                    <p className="text-sm font-medium leading-relaxed text-gray-500 dark:text-gray-400">{trip.notes}</p>
                  )}
                </div>
              
                <button 
                  onClick={() => handleJoinRequest(trip.trip_id)}
                  className="flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-black text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400"
                >
                  <Send className="w-4 h-4" /> Request Join
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
