"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../../Main";
import { Loader2, Calendar as CalendarIcon, Clock, MapPin, Users, CheckCircle2 } from "lucide-react";

export default function CreateTrip({ cabShareUser, onTripCreated }: { cabShareUser: any, onTripCreated: () => void }) {
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [hubId, setHubId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [tolerance, setTolerance] = useState("1.0");
  const [seats, setSeats] = useState("2");
  const [gender, setGender] = useState("mixed");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchHubs();
  }, []);

  const fetchHubs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/cabshare/hubs`);
      const data = await res.json();
      if (data.success) {
        setHubs(data.hubs);
        if (data.hubs.length > 0) setHubId(data.hubs[0].hub_id.toString());
      }
    } catch (e) {}
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        reg_number: cabShareUser.reg_number,
        hub_id: parseInt(hubId),
        travel_date: date,
        preferred_time: time,
        tolerance_hours: parseFloat(tolerance),
        seat_options: { requested: parseInt(seats) },
        gender_preference: gender,
        notes: notes
      };
      
      const res = await fetch(`${API_BASE}/api/cabshare/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        onTripCreated();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert("Failed to create trip");
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 p-6 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <MapPin className="w-5 h-5 text-blue-500" /> Post a Ride
      </h2>
      
      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Destination Hub</label>
            <select 
              value={hubId} 
              onChange={(e) => setHubId(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none"
            >
              {hubs.map(h => (
                <option key={h.hub_id} value={h.hub_id}>{h.hub_name}</option>
              ))}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Date</label>
              <div className="relative">
                <CalendarIcon className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                <input 
                  type="date" 
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Time</label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute left-3 top-3.5 text-gray-400" />
                <input 
                  type="time" 
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Available Seats</label>
              <select 
                value={seats} 
                onChange={(e) => setSeats(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none"
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tolerance (Hours)</label>
              <select 
                value={tolerance} 
                onChange={(e) => setTolerance(e.target.value)}
                className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none"
              >
                <option value="0.5">± 30 mins</option>
                <option value="1.0">± 1 hr</option>
                <option value="1.5">± 1.5 hrs</option>
                <option value="2.0">± 2 hrs</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Gender Preference</label>
            <div className="flex gap-4">
              {['mixed', 'boys', 'girls'].map(opt => (
                <label key={opt} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="gender" value={opt} checked={gender === opt} onChange={(e) => setGender(e.target.value)} />
                  <span className="capitalize text-sm text-gray-700 dark:text-gray-300">{opt}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Notes (Optional)</label>
            <textarea 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Bringing heavy luggage"
              className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl outline-none resize-none h-20"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors flex justify-center gap-2 items-center"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Post Ride</>}
          </button>
        </form>
      )}
    </div>
  );
}
