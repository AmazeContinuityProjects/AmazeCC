"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../../Main";
import { Loader2, Search, MapPin, Clock, Calendar as CalendarIcon, User, Send, Bell } from "lucide-react";

export default function SearchTrips({ cabShareUser }: { cabShareUser: any }) {
  const [hubs, setHubs] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  
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
      const data = await res.json();
      if (data.success) {
        setHubs(data.hubs);
        if (data.hubs.length > 0) setHubId(data.hubs[0].hub_id.toString());
      }
    } catch (e) {}
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (hubId) params.append("hub_id", hubId);
      if (date) params.append("date", date);
      params.append("reg_number", cabShareUser.reg_number); // To exclude own trips

      const res = await fetch(`${API_BASE}/api/cabshare/trips?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setTrips(data.trips);
      }
      setSearched(true);
    } catch (e) {}
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
      const data = await res.json();
      if (data.success) {
        alert("Request sent successfully!");
        handleSearch({ preventDefault: () => {} } as React.FormEvent);
      } else {
        alert(data.error);
      }
    } catch (e) {}
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
      const data = await res.json();
      if (data.success) {
        alert("You will be notified when a matching ride is posted!");
      } else {
        alert(data.error);
      }
    } catch (e) {}
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSearch} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Hub</label>
            <select 
              value={hubId} 
              onChange={(e) => setHubId(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none"
            >
              <option value="">Any Hub</option>
              {hubs.map(h => (
                <option key={h.hub_id} value={h.hub_id}>{h.hub_name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none"
            />
          </div>
          <div className="flex items-end">
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-xl transition-colors flex justify-center gap-2 items-center h-10"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Search className="w-4 h-4" /> Search</>}
            </button>
          </div>
        </div>
      </form>

      <div className="space-y-4">
        {trips.length === 0 && !loading ? (
          searched && hubId && date ? (
            <div className="text-center py-10 text-gray-500 space-y-4">
              <p>No active rides found for this criteria.</p>
              <button 
                onClick={handleAlertMe}
                className="bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 px-6 py-2 rounded-xl font-medium transition-colors inline-flex items-center gap-2"
              >
                <Bell className="w-4 h-4" /> Alert Me
              </button>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-500">
              Enter search criteria and click search.
            </div>
          )
        ) : (
          trips.map(trip => (
            <div key={trip.trip_id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                  <MapPin className="w-5 h-5 text-emerald-500" /> {trip.hub_name}
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-1"><CalendarIcon className="w-4 h-4" /> {new Date(trip.travel_date).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {trip.preferred_time} (±{trip.tolerance_hours}h)</span>
                  <span className="flex items-center gap-1"><User className="w-4 h-4" /> {trip.name}</span>
                </div>
                {trip.notes && (
                  <p className="text-sm text-gray-500 italic mt-2 text-balance">"{trip.notes}"</p>
                )}
              </div>
              
              <button 
                onClick={() => handleJoinRequest(trip.trip_id)}
                className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 px-6 py-2 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" /> Request Join
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
