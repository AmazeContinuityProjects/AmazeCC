"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../../Main";
import { Loader2, Phone, MapPin, Clock, Calendar, Check, X, ShieldAlert } from "lucide-react";
import ShareTripButton from "./ShareTripButton";

export default function MyTrips({ cabShareUser }: { cabShareUser: any }) {
  const [myTrips, setMyTrips] = useState<any[]>([]);
  const [joinedTrips, setJoinedTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/cabshare/trips/me?reg_number=${cabShareUser.reg_number}`);
      const data = await res.json();
      if (data.success) {
        setMyTrips(data.my_trips);
        setJoinedTrips(data.joined_trips);
      }
    } catch (e) {}
    setLoading(false);
  };

  const handleMatchAction = async (match_id: number, action: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/cabshare/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          reg_number: cabShareUser.reg_number, 
          match_id, 
          action 
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchTrips();
      } else {
        alert(data.error);
      }
    } catch (e) {}
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-8">
      
      {/* Trips I Posted */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Rides I Posted</h3>
        {myTrips.length === 0 ? (
          <p className="text-sm text-gray-500">You haven't posted any rides yet.</p>
        ) : (
          <div className="space-y-4">
            {myTrips.map(trip => (
              <div key={trip.trip_id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" /> {trip.hub_name}
                    </h4>
                    <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                      <Calendar className="w-3 h-3" /> {new Date(trip.travel_date).toLocaleDateString()}
                      <Clock className="w-3 h-3 ml-2" /> {trip.preferred_time}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-bold rounded-md uppercase tracking-wider ${trip.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'}`}>
                      {trip.status}
                    </span>
                    <ShareTripButton trip={trip} />
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase mb-3">Join Requests</h5>
                  {trip.requests && trip.requests.length > 0 ? (
                    <div className="space-y-3">
                      {trip.requests.map((req: any) => (
                        <div key={req.match_id} className="flex items-center justify-between bg-gray-50 dark:bg-slate-800 p-3 rounded-xl">
                          <div>
                            <p className="font-medium text-sm text-gray-900 dark:text-white">{req.name}</p>
                            {req.status === 'accepted' && (
                              <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Phone className="w-3 h-3" /> {req.phone_number}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {req.status === 'pending' ? (
                              <>
                                <button onClick={() => handleMatchAction(req.match_id, 'accept')} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200">
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleMatchAction(req.match_id, 'reject')} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <span className={`text-xs font-semibold uppercase ${req.status === 'accepted' ? 'text-emerald-500' : 'text-gray-400'}`}>
                                {req.status}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No requests yet.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trips I Joined */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Rides I Requested</h3>
        {joinedTrips.length === 0 ? (
          <p className="text-sm text-gray-500">You haven't requested to join any rides.</p>
        ) : (
          <div className="space-y-4">
            {joinedTrips.map(trip => (
              <div key={trip.trip_id} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 p-5 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-500" /> {trip.hub_name}
                  </h4>
                  <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                    <Calendar className="w-3 h-3" /> {new Date(trip.travel_date).toLocaleDateString()}
                    <Clock className="w-3 h-3 ml-2" /> {trip.preferred_time}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    Host: <strong>{trip.owner_name}</strong>
                  </p>
                  {trip.match_status === 'accepted' && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-1">
                      <Phone className="w-4 h-4" /> {trip.owner_phone}
                    </p>
                  )}
                </div>
                
                <div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                    ${trip.match_status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' : ''}
                    ${trip.match_status === 'accepted' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : ''}
                    ${trip.match_status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : ''}
                  `}>
                    {trip.match_status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
