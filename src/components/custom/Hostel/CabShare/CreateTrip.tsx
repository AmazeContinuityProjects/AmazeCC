"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../../Main";
import { Loader2, Calendar as CalendarIcon, Clock, MapPin, Users, CheckCircle2, MessageSquareText, SlidersHorizontal, ArrowRight } from "lucide-react";
import { createLocalTrip, fallbackHubs, readJsonResponse, dedupeHubs } from "./cabShareFallback";

export default function CreateTrip({ cabShareUser, onTripCreated }: { cabShareUser: any, onTripCreated: () => void }) {
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const [fromHubId, setFromHubId] = useState("");
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
      const data = await readJsonResponse(res);
      if (data?.success) {
        const unique = dedupeHubs(data.hubs);
        setHubs(unique);
        if (unique.length > 0) {
          setFromHubId(unique[0].hub_id.toString());
          if (unique.length > 1) setHubId(unique[1].hub_id.toString());
          else setHubId(unique[0].hub_id.toString());
        }
      } else {
        setHubs(fallbackHubs);
        setFromHubId(fallbackHubs[0].hub_id.toString());
        if (fallbackHubs.length > 1) setHubId(fallbackHubs[1].hub_id.toString());
        else setHubId(fallbackHubs[0].hub_id.toString());
      }
    } catch (e) {
      setHubs(fallbackHubs);
      setFromHubId(fallbackHubs[0].hub_id.toString());
      if (fallbackHubs.length > 1) setHubId(fallbackHubs[1].hub_id.toString());
      else setHubId(fallbackHubs[0].hub_id.toString());
    }
    setLoading(false);
  };

  const toOptions = hubs.filter(h => h.hub_id.toString() !== fromHubId);
  const fromOptions = hubs.filter(h => h.hub_id.toString() !== hubId);

  const handleFromChange = (val: string) => {
    setFromHubId(val);
    if (val === hubId) {
      const next = hubs.find(h => h.hub_id.toString() !== val);
      setHubId(next ? next.hub_id.toString() : "");
    }
  };

  const handleToChange = (val: string) => {
    setHubId(val);
    if (val === fromHubId) {
      const next = hubs.find(h => h.hub_id.toString() !== val);
      setFromHubId(next ? next.hub_id.toString() : "");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fromHubId === hubId) {
      setError("From and To cannot be the same location.");
      setSubmitting(false);
      return;
    }
    setSubmitting(true);
    setError("");
    const payload = {
      reg_number: cabShareUser.reg_number,
      from_hub_id: parseInt(fromHubId),
      hub_id: parseInt(hubId),
      travel_date: date,
      preferred_time: time,
      tolerance_hours: parseFloat(tolerance),
      seat_options: { requested: parseInt(seats) },
      gender_preference: gender,
      notes: notes
    };

    try {
      const res = await fetch(`${API_BASE}/api/cabshare/trips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await readJsonResponse(res);
      if (data?.success) {
        onTripCreated();
      } else {
        createLocalTrip(payload, cabShareUser, hubs);
        onTripCreated();
      }
    } catch (e) {
      createLocalTrip(payload, cabShareUser, hubs);
      onTripCreated();
    }
    setSubmitting(false);
  };

  return (
    <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-black sm:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-gray-950 dark:text-white">Post a ride</h2>
            <p className="mt-1 text-sm font-medium leading-relaxed text-gray-500 dark:text-gray-400">
              Add your route and timing so others can request to share the cab.
            </p>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 lg:col-span-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">From</label>
              <select 
                value={fromHubId} 
                onChange={(e) => handleFromChange(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              >
                {fromOptions.map(h => (
                  <option key={`from-${h.hub_id}`} value={h.hub_id}>{h.hub_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">To</label>
              <select 
                value={hubId} 
                onChange={(e) => handleToChange(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              >
                {toOptions.map(h => (
                  <option key={`to-${h.hub_id}`} value={h.hub_id}>{h.hub_name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Date</label>
              <div className="relative">
                <CalendarIcon className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input 
                  type="date" 
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Time</label>
              <div className="relative">
                <Clock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input 
                  type="time" 
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
                />
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Available Seats</label>
              <div className="relative">
                <Users className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select 
                value={seats} 
                onChange={(e) => setSeats(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Tolerance</label>
              <div className="relative">
                <SlidersHorizontal className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select 
                value={tolerance} 
                onChange={(e) => setTolerance(e.target.value)}
                  className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              >
                <option value="0.5">± 30 mins</option>
                <option value="1.0">± 1 hr</option>
                <option value="1.5">± 1.5 hrs</option>
                <option value="2.0">± 2 hrs</option>
              </select>
              </div>
            </div>
          </div>
          
          <div className="space-y-2 lg:col-span-2">
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Gender Preference</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {['mixed', 'boys', 'girls'].map(opt => (
                <label key={opt} className={`flex cursor-pointer items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black capitalize transition-colors ${
                  gender === opt
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-400"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-400"
                }`}>
                  <input className="sr-only" type="radio" name="gender" value={opt} checked={gender === opt} onChange={(e) => setGender(e.target.value)} />
                  {opt}
                </label>
              ))}
            </div>
          </div>
          
          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-black uppercase tracking-wider text-gray-500 dark:text-gray-400">Notes</label>
            <div className="relative">
              <MessageSquareText className="absolute left-4 top-4 h-4 w-4 text-gray-400" />
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Example: Bringing heavy luggage"
                className="h-24 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 pl-11 text-sm font-semibold text-gray-900 outline-none transition-colors focus:border-blue-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              />
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 lg:col-span-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Post Ride</>}
          </button>
        </form>
      )}
    </section>
  );
}
