"use client";

import { Share2, Check } from "lucide-react";
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
      className="flex items-center gap-1 rounded-xl bg-gray-100 px-2.5 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
      title="Share Trip"
    >
      {copied ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
      Share
    </button>
  );
}
