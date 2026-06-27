"use client";

import { useEffect, useState } from "react";
import GenericApiView from "../Exams/GenericApiView";
import { Skeleton } from "@/components/ui/Skeleton";
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
        <h1 className="text-xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Hostel Counselling</h1>
        <p className="text-xs text-gray-550 dark:text-gray-400 mt-1">
          Monitor your room selection registration status, friend grouping requests, basket allocations, and leader validation OTPs.
        </p>
      </div>

      {/* Info card */}
      <div className="bg-sky-500/10 border border-sky-400/20 rounded-2xl p-5 flex items-start gap-4">
        <div className="p-3 bg-sky-500/10 text-sky-400 rounded-full shrink-0">
          <Sparkles size={20} />
        </div>
        <div className="space-y-1 text-xs">
          <h2 className="font-bold text-gray-900 dark:text-white">Room Selection Information</h2>
          <p className="text-gray-550 dark:text-gray-400 leading-relaxed">
            Ensure your group leader validates the registered OTP to complete your room basket selection. Once confirmed, your room allocation will be locked.
          </p>
        </div>
      </div>

      {/* VTOP Counselling Live Table wrapper */}
      <div className="bg-white/50 dark:bg-slate-900/50 border border-gray-200/80 dark:border-gray-800 rounded-2xl p-5 shadow-2xs">
        <GenericApiView endpoint="hostel-counselling" title="" creds={creds} refreshKey={refreshKey} />
      </div>
    </div>
  );
}
