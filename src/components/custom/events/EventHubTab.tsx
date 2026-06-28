"use client";
import { useState, useEffect } from "react";
import { API_BASE } from "../Main";
import { Skeleton } from "@/components/ui/Skeleton";
import { EventHubEvent, EventHubPreview } from "@/types/data/eventhub";
import { Calendar, MapPin, IndianRupee, Users, Tag, X, FileText, Clock, User, Award, RefreshCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import EventHubSubpage from "./EventHubSubpage";
import SearchInput from "../shared/SearchInput";
import EmptyState from "../shared/EmptyState";
import { LoadingSpinner } from "../shared";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function EventHubTab({ IDs, setIsSubpageOpen, registeredEvents, setRegisteredEvents }: { 
  IDs: any, 
  setIsSubpageOpen?: (isOpen: boolean) => void,
  registeredEvents?: any[],
  setRegisteredEvents?: (events: any[]) => void
}) {
  const [events, setEvents] = useState<EventHubEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const [selectedEvent, setSelectedEvent] = useState<EventHubEvent | null>(null);
  const [previewData, setPreviewData] = useState<EventHubPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [previewError, setPreviewError] = useState<string>("");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [viewMode, setViewMode] = useState<"all" | "registered">("all");

  const [loadingRegistered, setLoadingRegistered] = useState(false);
  const [showRegisteredModal, setShowRegisteredModal] = useState(false);
  const [registeredError, setRegisteredError] = useState("");

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    if (IDs?.VtopUsername === "demo") {
      await new Promise(resolve => setTimeout(resolve, 300));
      setEvents([
        {
          eid: "evt-001",
          title: "DevSprint '26 Hackathon",
          eligibility: "Open to all branches",
          type: "Coding Hackathon",
          date: "2026-07-15",
          location: "Netaji Auditorium",
          price: "Free",
          registeredDetails: null
        },
        {
          eid: "evt-002",
          title: "RoboSoccer Workshop",
          eligibility: "Open to all branches",
          type: "Robotics Workshop",
          date: "2026-07-22",
          location: "MG Block Lab 202",
          price: "Paid",
          registeredDetails: {
            paymentStatus: "Paid (Online)",
            orderId: "ORD-920194",
            registrationDate: "2026-06-20",
            certificateEligible: "Yes",
            attendanceStatus: "Attended"
          }
        }
      ]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/events`);
      if (!res.ok) throw new Error("Failed to fetch events");
      const data: EventHubEvent[] = await res.json();
      
      // Deduplicate by eid
      const uniqueEventsMap = new Map<string, EventHubEvent>();
      data.forEach(event => {
        if (!uniqueEventsMap.has(event.eid)) {
          uniqueEventsMap.set(event.eid, { ...event });
        } else {
          const existing = uniqueEventsMap.get(event.eid)!;
          // Join eligibilities if they differ
          if (event.eligibility && existing.eligibility && !existing.eligibility.includes(event.eligibility)) {
            existing.eligibility += `, ${event.eligibility}`;
          }
        }
      });
      setEvents(Array.from(uniqueEventsMap.values()));
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (events.length > 0) {
      const pendingEventName = sessionStorage.getItem("pendingEventOpen");
      if (pendingEventName) {
        sessionStorage.removeItem("pendingEventOpen");
        const ev = events.find(e => e.title === pendingEventName);
        if (ev) {
          openPreview(ev);
        } else {
          // If not in active events, construct a past event
          const regEv = registeredEvents?.find(e => e.name === pendingEventName);
          openPreview({ 
            eid: regEv?.orderId || "unknown", 
            title: pendingEventName, 
            isPastEvent: true,
            registeredDetails: regEv 
          } as any);
        }
      }
    }
  }, [events, registeredEvents]);

  const openPreview = async (event: EventHubEvent) => {
    setSelectedEvent(event);
    setPreviewData(null);
    setPreviewError("");
    
    if (event.isPastEvent) {
      setPreviewError("Details are no longer available for this event since it has already concluded or its registration period has ended.");
      setPreviewLoading(false);
      return;
    }

    setPreviewLoading(true);
    if (IDs?.VtopUsername === "demo") {
      await new Promise(resolve => setTimeout(resolve, 150));
      setPreviewData({
        eid: event.eid,
        description: event.eid === "evt-001"
          ? "Build innovative products and compete for cash prizes at the annual flagship dev sprint event hosted by VIT Chennai's Coding Club."
          : "Hands-on calibration workshop for micro-controllers and servo engines to build autonomous soccer robots.",
        metaDetails: {
          "Fee": event.price,
          "Location": event.location,
          "Date": event.date
        }
      });
      setPreviewLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/events/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: IDs.VtopUsername,
          password: IDs.VtopPassword,
          eid: event.eid,
        }),
      });

      if (!res.ok) throw new Error("Failed to load event preview");
      const data = await res.json();
      setPreviewData(data);
    } catch (err: any) {
      setPreviewError(err.message || "Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setSelectedEvent(null);
    setPreviewData(null);
  };

  const fetchRegisteredEvents = async () => {
    if (viewMode === "registered") {
      setViewMode("all");
      return;
    }

    if (!IDs?.VtopUsername || !IDs?.VtopPassword) {
      setRegisteredError("Please save your VTOP credentials in the settings first.");
      setViewMode("registered");
      return;
    }
    
    if (registeredEvents && registeredEvents.length > 0) {
      setViewMode("registered");
      // Don't return, continue to fetch silently in the background for updates
    } else {
      setLoadingRegistered(true);
      setViewMode("registered");
    }

    if (IDs?.VtopUsername === "demo") {
      await new Promise(resolve => setTimeout(resolve, 300));
      const mockReg = [
        {
          eid: "evt-002",
          title: "RoboSoccer Workshop",
          eligibility: "Open to all branches",
          type: "Robotics Workshop",
          date: "2026-07-22",
          location: "MG Block Lab 202",
          price: "Paid",
          registeredDetails: {
            paymentStatus: "Paid (Online)",
            orderId: "ORD-920194",
            registrationDate: "2026-06-20",
            certificateEligible: "Yes",
            attendanceStatus: "Attended"
          }
        }
      ];
      setRegisteredEvents(mockReg);
      setLoadingRegistered(false);
      return;
    }

    setRegisteredError("");
    try {
      const res = await fetch(`${API_BASE}/api/events/profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: IDs.VtopUsername,
          password: IDs.VtopPassword,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch registered events");
      if (setRegisteredEvents) {
        setRegisteredEvents(data.events || []);
        localStorage.setItem("registeredEvents", JSON.stringify(data.events || []));
      }
    } catch (err: any) {
      setRegisteredError(err.message || "An error occurred");
    } finally {
      setLoadingRegistered(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-2xl" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 bg-red-50  dark:bg-red-900/10 text-red-600 rounded-2xl">
        <p>{error}</p>
        <button 
          onClick={fetchEvents}
          className="mt-4 px-4 py-2 bg-red-100  dark:bg-red-900/30 dark:hover:bg-red-900/50 rounded-lg hover:bg-red-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (selectedEvent) {
    return (
      <EventHubSubpage 
        selectedEvent={selectedEvent}
        previewData={previewData}
        previewLoading={previewLoading}
        previewError={previewError}
        onClose={closePreview}
        setIsSubpageOpen={setIsSubpageOpen}
        IDs={IDs}
        registeredEvents={registeredEvents}
      />
    );
  }

  const types = ["All", ...Array.from(new Set(events.map(e => e.type).filter(Boolean)))];

  const filteredEvents = events.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "All" || event.type === selectedType;
    return matchesSearch && matchesType;
  });

  const displayEvents = viewMode === "registered" 
    ? (registeredEvents || []).map(re => {
        const matched = events.find(e => e.title === re.name);
        return matched ? { ...matched, registeredDetails: re } : {
          eid: `past_${re.orderId || re.name}`, // Prefix to easily identify
          title: re.name,
          date: re.date,
          time: re.time,
          location: re.venue,
          type: "Registered",
          imageSrc: null,
          eligibility: "",
          price: "",
          registeredDetails: re,
          isPastEvent: true
        };
      })
    : filteredEvents;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900  dark:text-white leading-tight">
            {viewMode === "registered" ? "My Registered Events" : "All Events at VIT"}
          </h2>
          <p className="text-sm text-gray-500  dark:text-gray-400 mt-1">
            {viewMode === "registered" ? "Manage your registrations, payments, and certificates." : "Discover and register for clubs, chapters, and technical events."}
          </p>
        </div>
        
        <div className="flex flex-row items-center gap-3">
          <button
            onClick={fetchEvents}
            className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center cursor-pointer shrink-0"
            title="Reload Events List"
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
          
          <button
            onClick={fetchRegisteredEvents}
            className={`px-4 py-2 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 whitespace-nowrap ${
              viewMode === "registered" 
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50"
            }`}
          >
            <User className="w-4 h-4" />
            {viewMode === "registered" ? "View All Events" : "Registered Events"}
          </button>
          
          {viewMode === "all" && (
            <>
              <SearchInput placeholder="Search events..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full sm:w-64" />
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-4 py-2 bg-white  dark:bg-gray-900 border border-gray-200  dark:border-gray-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
              >
                {types.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {loadingRegistered && viewMode === "registered" ? (
        <div className="flex justify-center items-center py-24">
          <LoadingSpinner size="lg" />
        </div>
      ) : registeredError && viewMode === "registered" ? (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 rounded-xl text-center border border-red-200 dark:border-red-900/50">
          {registeredError}
        </div>
      ) : displayEvents.length === 0 ? (
        <EmptyState
          title={viewMode === "registered" ? "You haven't registered for any events yet." : "No events found matching your criteria."}
          className="py-12 bg-gray-50  dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-200  dark:border-gray-800"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayEvents.map((event: any) => (
            <motion.div
              key={event.eid}
              whileHover={{ y: -4 }}
              className="bg-white  dark:bg-black rounded-3xl p-5 shadow-sm border border-gray-100  dark:border-gray-800 cursor-pointer flex flex-col justify-between h-full"
              onClick={() => openPreview(event)}
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-lg text-gray-900  dark:text-white leading-tight">
                    {event.title}
                  </h3>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-4">
                   {event.registeredDetails ? (
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      (event.registeredDetails.paymentStatus || "").toLowerCase().includes('paid') || (event.registeredDetails.paymentStatus || "").toLowerCase().includes('free')
                        ? 'bg-green-100 text-green-800   dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-orange-100 text-orange-800   dark:bg-orange-900/40 dark:text-orange-300'
                    }`}>
                      {event.registeredDetails.paymentStatus || "Registered"}
                    </span>
                  ) : null}
                  {event.eligibility && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700   dark:bg-blue-900/20 dark:text-blue-300">
                      <Users className="w-3 h-3" /> {event.eligibility}
                    </span>
                  )}
                  {event.type && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700   dark:bg-purple-900/20 dark:text-purple-300">
                      <Tag className="w-3 h-3" /> {event.type}
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-sm text-gray-600  dark:text-gray-400">
                  {event.date && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> {event.date}
                    </div>
                  )}
                  {event.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" /> {event.location}
                    </div>
                  )}
                  {event.price && (
                    <div className="flex items-center gap-2">
                      <IndianRupee className="w-4 h-4" /> {event.price}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-5 pt-4 border-t border-gray-100  dark:border-gray-800">
                <span className="text-blue-600  dark:text-blue-400 font-medium text-sm hover:underline">
                  View Details &rarr;
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

    </motion.div>
  );
}
