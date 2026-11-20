"use client";

import { useEffect, useState } from "react";
import GenericApiView from "../exams/GenericApiView";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { Sparkles } from "lucide-react";
import { ICON_WELL, SECTION_TITLE, TEXT_CAPTION, TILE_CARD, TONE_ICON_TILE } from "@/lib/uiTokens";

interface CounsellingProps {
  loginToVTOP: () => Promise<any>;
  refreshKey: number;
}

export default function HostelCounsellingView({ loginToVTOP, refreshKey }: CounsellingProps) {
  const [creds, setCreds] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    loginToVTOP()
      .then(setCreds)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey, loginToVTOP]);

  if (loading || !creds) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-4 w-96 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-xl md:text-3xl font-black font-outfit tracking-tight text-text-heading">
          Hostel Counselling
        </h1>
        <p className={`${TEXT_CAPTION} font-medium mt-1`}>
          Monitor your room selection registration status, friend grouping requests, basket allocations, and leader
          validation OTPs.
        </p>
      </div>

      {/* Info card */}
      <div className={`${TILE_CARD} flex items-start gap-4`}>
        <span className={`${ICON_WELL} ${TONE_ICON_TILE.sky}`}>
          <Sparkles size={20} />
        </span>
        <div className="space-y-1 text-xs">
          <h2 className={SECTION_TITLE}>Room Selection Information</h2>
          <p className={`${TEXT_CAPTION} text-pretty leading-relaxed`}>
            Ensure your group leader validates the registered OTP to complete your room basket selection. Once
            confirmed, your room allocation will be locked.
          </p>
        </div>
      </div>

      {/* VTOP Counselling Live Table wrapper */}
      <div className={TILE_CARD}>
        <GenericApiView endpoint="hostel-counselling" title="" creds={creds} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
