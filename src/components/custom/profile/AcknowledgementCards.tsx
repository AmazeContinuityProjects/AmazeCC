"use client";
import { useState, useEffect } from "react";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { API_BASE } from "../Main";
import { FileText } from "lucide-react";

const cardBase = "solid-card";

export default function AcknowledgementCards({ creds, refreshKey }: { creds: any; refreshKey: number }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (refreshKey === 0) {
      const cached = localStorage.getItem("cache_acknowledgement");
      if (cached) {
        try {
          setData(JSON.parse(cached));
          setLoading(false);
          return;
        } catch (e) {}
      }
    }

    setLoading(true);
    const { cookies, authorizedID, csrf } = creds;
    fetch(`${API_BASE}/api/acknowledgement`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies, authorizedID, csrf }),
    }).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false));
  }, [refreshKey, creds]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-36 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  const docsTable = data?.tables?.[1];
  const docs = docsTable?.rows || [];

  if (!docs.length) return null;

  return (
    <div className={cardBase}>
      <div className="p-5 border-b border-gray-100/50  dark:border-gray-800/50">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500  dark:text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider">Document Acknowledgement</h4>
        </div>
      </div>
      <div className="divide-y divide-gray-100/50  dark:divide-gray-800/50">
        {docs.map((row: any, idx: number) => {
          const docName = row[docsTable.headers[1]] || "";
          const status = row[docsTable.headers[2]] || "";
          const isSubmitted = /submitted/i.test(status);
          return (
            <div key={idx} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 dark:hover:bg-gray-800/30 transition-colors">
              <div className={`p-1.5 rounded-lg shrink-0 ${isSubmitted ? "bg-emerald-100  dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-gray-100  text-gray-400"}`}>
                <FileText className="w-3.5 h-3.5" />
              </div>
              <p className="text-sm text-gray-700  dark:text-gray-300 flex-1 min-w-0 leading-snug">{docName}</p>
              <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${isSubmitted ? "bg-emerald-100 text-emerald-700   dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-gray-100 text-gray-500   dark:bg-gray-800 dark:text-gray-400"}`}>
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
