"use client";

import { Share2, Link2, Copy, Check } from "lucide-react";
import { useState } from "react";

export default function ShareTripButton({ trip }: { trip: any }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const text = `🚕 Cab Share: ${trip.hub_name} on ${new Date(trip.travel_date).toLocaleDateString()} @ ${trip.preferred_time}\nHost: ${trip.name || 'AmazeCC User'}\nJoin me on AmazeCC!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Cab Share Ride",
          text: text,
          url: "https://amazecc.vit.ac.in",
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className="px-2 py-1 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg flex items-center gap-1 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
      title="Share Trip"
    >
      {copied ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
      Share
    </button>
  );
}
