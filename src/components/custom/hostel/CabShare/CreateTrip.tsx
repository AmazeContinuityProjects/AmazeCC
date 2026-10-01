"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/sync-engine";
import { AlertCircle, Calendar as CalendarIcon, CheckCircle2, Clock, Loader2, MapPin, MessageSquareText, SlidersHorizontal, Users } from "lucide-react";
import { createLocalTrip, fallbackHubs, readJsonResponse, dedupeHubs } from "./cabShareFallback";
import SelectField from "../../shared/primitives/SelectField";
import { ListSkeleton } from "../../shared/primitives";
import { FIELD_INPUT, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";

const FIELD_LABEL =
  "block text-[10px] font-black uppercase tracking-wider text-text-muted";

/** Label + icon-led control, the one wrapper the date/time/seats/tolerance share. */
// Descendant (not `> child`) selectors: `SelectField` renders its own wrapper
// `div` around the `select`, so the control is not always a direct child.
function FieldWithIcon({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className={FIELD_LABEL}>{label}</span>
      <span className="relative block [&_input]:pl-11 [&_select]:pl-11">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
          {icon}
        </span>
        {children}
      </span>
    </label>
  );
}

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
      const res = await api("cabshare/hubs", { parse: "raw" });
      const data = await readJsonResponse(res as Response);
      if (data?.success) {
        const unique = dedupeHubs(data.hubs, fallbackHubs);
        setHubs(unique);
        if (unique.length > 0) {
          setFromHubId(unique[0].hub_id.toString());
          setHubId(unique[1]?.hub_id.toString() || unique[0].hub_id.toString());
        }
      } else {
        setHubs(fallbackHubs);
        setFromHubId(fallbackHubs[0].hub_id.toString());
        setHubId(fallbackHubs[1]?.hub_id.toString() || fallbackHubs[0].hub_id.toString());
      }
    } catch (e) {
      setHubs(fallbackHubs);
      setFromHubId(fallbackHubs[0].hub_id.toString());
      setHubId(fallbackHubs[1]?.hub_id.toString() || fallbackHubs[0].hub_id.toString());
    }
    setLoading(false);
  };

  const handleFromChange = (val: string) => {
    if (val === hubId && hubs.length > 1) {
      const next = hubs.find(h => h.hub_id.toString() !== val);
      setHubId(next ? next.hub_id.toString() : "");
    }
    setFromHubId(val);
  };

  const handleToChange = (val: string) => {
    if (val === fromHubId && hubs.length > 1) {
      const next = hubs.find(h => h.hub_id.toString() !== val);
      setFromHubId(next ? next.hub_id.toString() : "");
    }
    setHubId(val);
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
      const res = await api("cabshare/trips", {
        method: "POST",
        body: payload
      });
      const data = await readJsonResponse(res as Response);
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
    <div className={TILE_CARD}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${TONE_ICON_TILE.emerald}`}>
          <MapPin className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-black text-text-heading font-outfit tracking-tight">Post a ride</h2>
          <p className="text-[11px] text-text-secondary dark:text-text-muted font-medium leading-relaxed mt-0.5">
            Add your route and timing so others can request to share the cab.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-4">
          <ListSkeleton rows={4} />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 lg:grid-cols-2">
          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-600 dark:text-red-400 lg:col-span-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className={FIELD_LABEL}>From</span>
              <SelectField
                value={fromHubId}
                options={hubs.map(h => ({ value: h.hub_id.toString(), label: h.hub_name }))}
                onChange={handleFromChange}
              />
            </label>
            <label className="block space-y-1">
              <span className={FIELD_LABEL}>To</span>
              <SelectField
                value={hubId}
                options={hubs.map(h => ({ value: h.hub_id.toString(), label: h.hub_name }))}
                onChange={handleToChange}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldWithIcon label="Date" icon={<CalendarIcon className="h-4 w-4" />}>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={FIELD_INPUT}
              />
            </FieldWithIcon>
            <FieldWithIcon label="Time" icon={<Clock className="h-4 w-4" />}>
              <input
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={FIELD_INPUT}
              />
            </FieldWithIcon>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
            <FieldWithIcon label="Available Seats" icon={<Users className="h-4 w-4" />}>
              <select
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                className={`${FIELD_INPUT} appearance-none pr-4`}
              >
                {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </FieldWithIcon>
            <FieldWithIcon label="Tolerance" icon={<SlidersHorizontal className="h-4 w-4" />}>
              <select
                value={tolerance}
                onChange={(e) => setTolerance(e.target.value)}
                className={`${FIELD_INPUT} appearance-none pr-4`}
              >
                <option value="0.5">± 30 mins</option>
                <option value="1.0">± 1 hr</option>
                <option value="1.5">± 1.5 hrs</option>
                <option value="2.0">± 2 hrs</option>
              </select>
            </FieldWithIcon>
          </div>

          <fieldset className="lg:col-span-2">
            <legend className={`${FIELD_LABEL} mb-2`}>Gender Preference</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["mixed", "boys", "girls"] as const).map(opt => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black capitalize transition-colors ${
                    gender === opt
                      ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                      : "border-border-strong text-text-secondary dark:text-text-muted hover:bg-surface-secondary dark:hover:bg-surface-hover"
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="gender"
                    value={opt}
                    checked={gender === opt}
                    onChange={(e) => setGender(e.target.value)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block space-y-1 lg:col-span-2">
            <span className={FIELD_LABEL}>Notes</span>
            <span className="relative block">
              <MessageSquareText className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-text-muted" />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Example: Bringing heavy luggage"
                className={`${FIELD_INPUT} h-24 resize-none pl-11`}
              />
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-70 lg:col-span-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Post Ride</>}
          </button>
        </form>
      )}
    </div>
  );
}
