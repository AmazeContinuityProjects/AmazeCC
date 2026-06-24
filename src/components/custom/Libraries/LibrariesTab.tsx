"use client";
import { useState, useEffect } from "react";
import GenericApiView, { clearApiCache } from "../Exams/GenericApiView";
import SubpageLayout from "../shared/SubpageLayout";
import { Skeleton } from "@/components/ui/Skeleton";
import { RefreshCcw, BookOpen } from "lucide-react";

interface LibrariesTabProps {
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
}

export default function LibrariesTab({ loginToVTOP }: LibrariesTabProps) {
  const [creds, setCreds] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { loginToVTOP().then(setCreds).catch(() => {}); }, []);
  if (!creds) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
  return (
    <SubpageLayout
      title="Libraries"
      onBack={() => {}}
      action={
        <button onClick={() => { clearApiCache(); setRefreshKey(k => k + 1); }} className="p-2.5 rounded-full bg-blue-50 dark:bg-slate-800 midnight:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors" title="Reload all">
          <RefreshCcw className="w-5 h-5" />
        </button>
      }
    >
      <div className="space-y-6">
        <GenericApiView endpoint="library-due" title="Library Dues" creds={creds} refreshKey={refreshKey} />
        <GenericApiView endpoint="library-keys" title="Library Keys" creds={creds} refreshKey={refreshKey} />
        <GenericApiView endpoint="library-scanning" title="Library Scanning" creds={creds} refreshKey={refreshKey} writable />
        <GenericApiView endpoint="book-recommendation" title="Book Recommendations" creds={creds} refreshKey={refreshKey} writable />
      </div>
    </SubpageLayout>
  );
}
