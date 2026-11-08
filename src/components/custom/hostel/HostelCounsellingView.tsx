"use client";

import { useEffect, useState } from "react";
import GenericApiView from "../exams/GenericApiView";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { Users, Info, ShieldAlert, Sparkles } from "lucide-react";

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
        <Skeleton className="h-10 w-64 rounded-md" />
        <Skeleton className="h-4 w-96 rounded-md" />
        <Skeleton className="h-32 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-xl md:text-3xl font-semibold text-ink tracking-tight">Hostel Counselling</h1>
        <p className="text-xs text-gray-550 dark:text-gray-400 mt-1">
          Monitor your room selection registration status, friend grouping requests, basket allocations, and leader validation OTPs.
        </p>
      </div>

      {/* Info card */}
      <div className="bg-accent-soft border border-accent/20 rounded-md p-5 flex items-start gap-4">
        <div className="p-3 bg-accent-soft text-accent rounded-full shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="space-y-1 text-xs">
          <h2 className="font-semibold text-ink">Room Selection Information</h2>
          <p className="text-gray-550 dark:text-gray-400 leading-relaxed">
            Ensure your group leader validates the registered OTP to complete your room basket selection. Once confirmed, your room allocation will be locked.
          </p>
        </div>
      </div>

      {/* VTOP Counselling Live Table wrapper */}
      <div className="bg-surface border border-line rounded-md p-5 shadow-2xs">
        <GenericApiView endpoint="hostel-counselling" title="" creds={creds} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
