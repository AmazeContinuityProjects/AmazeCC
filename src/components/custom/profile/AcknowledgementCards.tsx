"use client";
import { useState, useEffect } from "react";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { api, syncEngine } from "@/lib/sync-engine";
import { FileText } from "lucide-react";

export default function AcknowledgementCards({ creds, refreshKey }: { creds: any; refreshKey: number }) {
  const [ack, setAck] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!creds) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        let w: any = null;
        if (refreshKey === 0) {
          try {
            const cached = localStorage.getItem("cache_whoami");
            if (cached) w = JSON.parse(cached);
          } catch {}
        }
        if (!w || refreshKey > 0) {
          try {
            w = await syncEngine.sync("whoami");
          } catch {
            w = null;
          }
          if (!w) {
            try {
              w = await api("whoami", { method: "POST", auth: "vtop" } as any);
            } catch {}
          }
          if (w && !w.error) {
            try {
              localStorage.setItem("cache_whoami", JSON.stringify(w));
            } catch {}
          }
        }
        if (!cancelled) setAck(w?.acknowledgement ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, creds]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-36 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const docs = Array.isArray(ack?.documents) ? ack.documents : [];
  if (!docs.length) return null;

  return (
    <div className="solid-card">
      <div className="p-5 border-b border-gray-100/50  dark:border-gray-800/50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500  dark:text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider">
            {ack?.title || "Document Acknowledgement"}
          </h4>
        </div>
        {(ack?.registerNo || ack?.programme || ack?.branch) && (
          <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
            {ack.registerNo && <div>Register No: {ack.registerNo}</div>}
            {ack.programme && <div>{ack.programme}</div>}
            {ack.branch && <div>{ack.branch}</div>}
          </div>
        )}
      </div>
      <div className="divide-y divide-gray-100/50  dark:divide-gray-800/50">
        {docs.map((doc: any, idx: number) => {
          const docName = doc?.documentName || doc?.serialNo || "Document";
          const status = doc?.status || "";
          const isSubmitted = /submitted|verified|accepted/i.test(status);
          return (
            <div
              key={idx}
              className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 dark:hover:bg-gray-800/30 transition-colors"
            >
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  isSubmitted
                    ? "bg-emerald-100  dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                    : "bg-gray-100  text-gray-400"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
              </div>
              <p className="text-sm text-gray-700  dark:text-gray-300 flex-1 min-w-0 leading-snug">{docName}</p>
              <span
                className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isSubmitted
                    ? "bg-emerald-100 text-emerald-700   dark:bg-emerald-900/30 dark:text-emerald-400"
                    : "bg-gray-100 text-gray-500   dark:bg-gray-800 dark:text-gray-400"
                }`}
              >
                {status || (isSubmitted ? "Verified" : "Pending")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
