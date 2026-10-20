"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import Link from "next/link";

/**
 * Offline fallback.
 *
 * This page is what the service worker returns when a document request fails
 * and nothing usable is cached — and it is also the way back *into* the app
 * when the shell is cached: tapping "Open dashboard" navigates to `/`, whose
 * HTML is served from the `pages` cache, so the app comes up with whatever
 * data was last synced. Worth keeping the copy honest about that.
 */
export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-black p-4">
      <div className="bg-white  dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
        <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
          <WifiOff className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          You&apos;re offline
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          We couldn&apos;t load this page from the cache. Your saved data —
          timetable, tasks, attendance, settings — is still here; open the
          dashboard to see it.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-xl transition-colors"
          >
            Open dashboard
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 font-medium px-6 py-2.5 rounded-xl transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" /> Try reconnecting
          </button>
        </div>
      </div>
    </div>
  );
}
