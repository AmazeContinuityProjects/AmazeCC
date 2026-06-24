"use client";
import { useState, useEffect } from "react";
import GenericApiView, { clearApiCache } from "./GenericApiView";
import SubpageLayout from "../shared/SubpageLayout";
import { Skeleton } from "@/components/ui/Skeleton";
import { RefreshCcw } from "lucide-react";

export default function WishlistTab({ loginToVTOP, setActiveSubTab }: { loginToVTOP: any; setActiveSubTab: any }) {
  const [creds, setCreds] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { loginToVTOP().then(setCreds).catch(() => {}); }, []);
  if (!creds) return <div className="space-y-4"><Skeleton className="h-8 w-48 rounded-lg" /><Skeleton className="h-32 w-full rounded-2xl" /></div>;
  return (
    <SubpageLayout
      title="Wishlist & Learning"
      onBack={() => setActiveSubTab("overview")}
      action={
        <button onClick={() => { clearApiCache(); setRefreshKey(k => k + 1); }} className="p-2.5 rounded-full bg-blue-50 dark:bg-slate-800 midnight:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors" title="Reload all">
          <RefreshCcw className="w-5 h-5" />
        </button>
      }
    >
      <div className="space-y-6">
        <GenericApiView endpoint="wishlist" title="Wishlist" creds={creds} refreshKey={refreshKey} />
        <GenericApiView endpoint="additional-learning" title="Additional Learning" creds={creds} refreshKey={refreshKey} />
      </div>
    </SubpageLayout>
  );
}
