"use client";

import { Share2, Check } from "lucide-react";
import { useState } from "react";
import { GHOST_BUTTON } from "@/lib/uiTokens";

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
      type="button"
      onClick={handleShare}
      className={GHOST_BUTTON}
      title="Share Trip"
    >
      {copied ? <Check className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
      <span className="text-[11px]">{copied ? "Copied" : "Share"}</span>
    </button>
  );
}
