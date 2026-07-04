"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../../Main";
import { Car, MapPin, Clock, Clock3, Users } from "lucide-react";
import { getLocalTrips } from "./cabShareFallback";

export default function CabShareMatchCard() {
  const [acceptedMatch, setAcceptedMatch] = useState<any>(null);
  const [pendingJoins, setPendingJoins] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const loadFromLocal = (user: any) => {
    const localTrips = getLocalTrips();
    const myName = user.name || user.reg_number;
    // My pending requests: trips I did NOT post that have a pending request from me
    const myLocalReqs: any[] = [];
    localTrips.forEach((trip: any) => {
      if (trip.reg_number === user.reg_number || trip.reg_number === user.username) return;
      (trip.requests || []).forEach((req: any) => {
        if (req.name === myName && req.status === 'pending') {
          myLocalReqs.push({
            trip_id: trip.trip_id,
            hub_name: trip.hub_name,
            preferred_time: trip.preferred_time,
            owner_name: trip.name,
            match_status: 'pending',
          });
        }
      });
    });
    setPendingJoins(myLocalReqs);

    // Incoming local requests: trips I posted that have pending requests from others
    const myLocalIncoming: any[] = [];
    localTrips.forEach((trip: any) => {
      if (trip.reg_number === user.reg_number || trip.reg_number === user.username) {
        (trip.requests || []).forEach((req: any) => {
          if (req.status === 'pending') {
            myLocalIncoming.push({ ...req, trip });
          }
        });
      }
    });
    setPendingRequests(myLocalIncoming);
  };

  useEffect(() => {
    const userStr = localStorage.getItem("cabshare_user");
    if (!userStr) return;
    
    try {
      const user = JSON.parse(userStr);
      if (!user || !user.reg_number) return;
      
      fetch(`${API_BASE}/api/cabshare/trips/me?reg_number=${user.reg_number}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            // Accepted match (confirmed ride)
            const acceptedJoin = data.joined_trips?.find((t: any) => t.match_status === 'accepted');
            if (acceptedJoin) {
              setAcceptedMatch({ ...acceptedJoin, role: 'passenger' });
            } else {
              const activePost = data.my_trips?.find((t: any) => t.status === 'active' && t.requests && t.requests.some((r:any) => r.status === 'accepted'));
              if (activePost) {
                setAcceptedMatch({ ...activePost, role: 'host' });
              }
            }

            // Pending join requests (I requested to join, waiting for host)
            const pendingReqs = (data.joined_trips || []).filter((t: any) => t.match_status === 'pending');
            setPendingJoins(pendingReqs);

            // Pending incoming requests (someone wants to join my ride)
            const incomingReqs: any[] = [];
            (data.my_trips || []).forEach((trip: any) => {
              (trip.requests || []).forEach((req: any) => {
                if (req.status === 'pending') {
                  incomingReqs.push({ ...req, trip });
                }
              });
            });
            setPendingRequests(incomingReqs);
          }
        })
        .catch(() => loadFromLocal(user));

      // Also try local fallback regardless (covers local_only users)
      if (user.local_only) {
        loadFromLocal(user);
      }
    } catch(e) {}
  }, []);

  if (!acceptedMatch && pendingJoins.length === 0 && pendingRequests.length === 0) return null;

  return (
    <div className="mb-6 space-y-3">
      {/* Pending - My requests waiting for host approval */}
      {pendingJoins.length > 0 && pendingJoins.map(trip => (
        <div key={trip.trip_id} className="animate-fadeIn rounded-3xl bg-amber-500 p-4 text-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-2xl bg-white/20 p-2">
              <Clock3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Approval Pending</h3>
              <p className="text-amber-100 text-xs">Your ride request is waiting for the host to respond.</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 p-3">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {trip.hub_name}</p>
              <p className="text-xs text-amber-100 flex items-center gap-1 mt-1"><Clock className="w-3.5 h-3.5" /> {trip.preferred_time}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-amber-100">Host</p>
              <p className="text-sm font-bold">{trip.owner_name}</p>
            </div>
          </div>
        </div>
      ))}

      {/* Pending - Incoming requests (host side) */}
      {pendingRequests.length > 0 && (
        <div className="animate-fadeIn rounded-3xl bg-violet-500 p-4 text-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-2xl bg-white/20 p-2">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Pending Requests</h3>
              <p className="text-violet-100 text-xs">{pendingRequests.length} student{pendingRequests.length > 1 ? 's' : ''} want{pendingRequests.length === 1 ? 's' : ''} to join your ride{pendingRequests.length > 1 ? 's' : ''}.</p>
            </div>
          </div>
          {pendingRequests.map((req, i) => (
            <div key={req.match_id || i} className="mt-2 rounded-2xl bg-white/10 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{req.name}</p>
                  <p className="text-xs text-violet-100">{req.trip?.hub_name}</p>
                </div>
                <p className="text-xs text-violet-100">{req.trip?.preferred_time}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accepted match (confirmed ride) */}
      {acceptedMatch && (
        <div className="animate-fadeIn rounded-3xl bg-blue-600 p-4 text-white shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-2xl bg-white/20 p-2">
              <Car className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Upcoming Ride Match</h3>
              <p className="text-blue-100 text-xs">You have a confirmed {acceptedMatch.role === 'host' ? 'passenger' : 'ride'}!</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 p-3">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {acceptedMatch.hub_name}</p>
              <p className="text-xs text-blue-100 flex items-center gap-1 mt-1"><Clock className="w-3.5 h-3.5" /> {acceptedMatch.preferred_time}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-blue-100">Contact</p>
              <p className="text-sm font-bold">{acceptedMatch.role === 'host' ? acceptedMatch.requests.find((r:any)=>r.status==='accepted')?.phone_number : acceptedMatch.owner_phone}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
