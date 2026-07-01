"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../../Main";
import { Loader2, Phone, MapPin, Clock, Calendar, Check, X, Inbox, Send } from "lucide-react";
import ShareTripButton from "./ShareTripButton";
import EmptyState from "../../shared/EmptyState";
import { getLocalTrips, readJsonResponse, saveLocalTrips } from "./cabShareFallback";

export default function MyTrips({ cabShareUser }: { cabShareUser: any }) {
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
      const res = await fetch(`${API_BASE}/api/cabshare/trips/me?reg_number=${cabShareUser.reg_number}`);
      const data = await readJsonResponse(res);
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
      const res = await fetch(`${API_BASE}/api/cabshare/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          reg_number: cabShareUser.reg_number, 
          match_id, 
          action 
        })
      });
      const data = await readJsonResponse(res);
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

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {message && (
        <div className={`rounded-2xl border p-4 text-sm font-semibold xl:col-span-2 ${
          message.type === "success"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400"
            : "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400"
        }`}>
          {message.text}
        </div>
      )}
      
      {/* Trips I Posted */}
      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">Hosting</p>
          <h3 className="mt-1 text-lg font-black text-gray-950 dark:text-white">Rides I Posted</h3>
        </div>
        {myTrips.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-10 w-10" />}
            title="No posted rides"
            description="Post a ride when you are booking a cab and want to split the trip."
            className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-black"
          />
        ) : (
          <div className="space-y-4">
            {myTrips.map(trip => (
              <article key={trip.trip_id} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-black">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h4 className="flex items-center gap-2 text-base font-black text-gray-950 dark:text-white">
                      <MapPin className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" /> <span className="truncate">{trip.hub_name}</span>
                    </h4>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 dark:border-white/10">
                        <Calendar className="h-3.5 w-3.5" /> {new Date(trip.travel_date).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 dark:border-white/10">
                        <Clock className="h-3.5 w-3.5" /> {trip.preferred_time}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${trip.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {trip.status}
                    </span>
                    <ShareTripButton trip={trip} />
                  </div>
                </div>
                
                <div className="border-t border-gray-100 pt-4 dark:border-white/10">
                  <h5 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Join Requests</h5>
                  {trip.requests && trip.requests.length > 0 ? (
                    <div className="space-y-3">
                      {trip.requests.map((req: any) => (
                        <div key={req.match_id} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-white/10 dark:bg-white/[0.03]">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-gray-900 dark:text-white">{req.name}</p>
                            {req.status === 'accepted' && (
                              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-gray-500">
                                <Phone className="w-3 h-3" /> {req.phone_number}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {req.status === 'pending' ? (
                              <>
                                <button onClick={() => handleMatchAction(req.match_id, 'accept')} className="rounded-xl bg-emerald-100 p-1.5 text-emerald-600 hover:bg-emerald-200">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleMatchAction(req.match_id, 'reject')} className="rounded-xl bg-red-100 p-1.5 text-red-600 hover:bg-red-200">
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span className={`text-xs font-black uppercase ${req.status === 'accepted' ? 'text-emerald-500' : 'text-gray-400'}`}>
                                {req.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm font-semibold text-gray-400 dark:border-white/10 dark:bg-white/[0.03]">No requests yet.</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Trips I Joined */}
      <section className="space-y-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500">Requests</p>
          <h3 className="mt-1 text-lg font-black text-gray-950 dark:text-white">Rides I Requested</h3>
        </div>
        {joinedTrips.length === 0 ? (
          <EmptyState
            icon={<Send className="h-10 w-10" />}
            title="No ride requests"
            description="Requested rides will show their approval status and host contact details here."
            className="rounded-3xl border border-gray-200 bg-white shadow-sm dark:border-white/10 dark:bg-black"
          />
        ) : (
          <div className="space-y-4">
            {joinedTrips.map(trip => (
              <article key={trip.trip_id} className="flex flex-col gap-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-black sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h4 className="flex items-center gap-2 text-base font-black text-gray-950 dark:text-white">
                    <MapPin className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" /> <span className="truncate">{trip.hub_name}</span>
                  </h4>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 dark:border-white/10">
                      <Calendar className="h-3.5 w-3.5" /> {new Date(trip.travel_date).toLocaleDateString()}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 dark:border-white/10">
                      <Clock className="h-3.5 w-3.5" /> {trip.preferred_time}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-gray-600 dark:text-gray-400">
                    Host: <strong>{trip.owner_name}</strong>
                  </p>
                  {trip.match_status === 'accepted' && (
                    <p className="mt-1 flex items-center gap-1 text-sm font-black text-emerald-600 dark:text-emerald-400">
                      <Phone className="w-4 h-4" /> {trip.owner_phone}
                    </p>
                  )}
                </div>
                
                <div>
                  <span className={`rounded-xl px-3 py-1.5 text-xs font-black uppercase tracking-wider
                    ${trip.match_status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
                    ${trip.match_status === 'accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}
                    ${trip.match_status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
                  `}>
                    {trip.match_status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
