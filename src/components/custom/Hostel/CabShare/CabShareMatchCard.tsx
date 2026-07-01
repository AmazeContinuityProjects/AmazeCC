"use client";

import { useState, useEffect } from "react";
import { API_BASE } from "../../Main";
import { Car, MapPin, Clock } from "lucide-react";

export default function CabShareMatchCard() {
  const [match, setMatch] = useState<any>(null);

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
            // Find an active match: either a trip I posted that has accepted requests, or a trip I joined that was accepted
            const acceptedJoin = data.joined_trips.find((t: any) => t.match_status === 'accepted');
            if (acceptedJoin) {
              setMatch({ ...acceptedJoin, role: 'passenger' });
              return;
            }
            
            const activePost = data.my_trips.find((t: any) => t.status === 'active' && t.requests && t.requests.some((r:any) => r.status === 'accepted'));
            if (activePost) {
              setMatch({ ...activePost, role: 'host' });
            }
          }
        })
        .catch(console.error);
    } catch(e) {}
  }, []);

  if (!match) return null;

  return (
    <div className="mb-6 animate-fadeIn rounded-3xl bg-blue-600 p-4 text-white shadow-sm">
      <div className="flex items-center gap-3 mb-2">
        <div className="rounded-2xl bg-white/20 p-2">
          <Car className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-lg">Upcoming Ride Match</h3>
          <p className="text-blue-100 text-xs">You have a confirmed {match.role === 'host' ? 'passenger' : 'ride'}!</p>
        </div>
      </div>
      
      <div className="mt-3 flex items-center justify-between rounded-2xl bg-white/10 p-3">
        <div>
          <p className="text-sm font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {match.hub_name}</p>
          <p className="text-xs text-blue-100 flex items-center gap-1 mt-1"><Clock className="w-3.5 h-3.5" /> {match.preferred_time}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-blue-100">Contact</p>
          <p className="text-sm font-bold">{match.role === 'host' ? match.requests.find((r:any)=>r.status==='accepted').phone_number : match.owner_phone}</p>
        </div>
      </div>
    </div>
  );
}
