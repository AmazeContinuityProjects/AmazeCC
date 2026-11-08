"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/sync-engine";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

/**
 * The two read-status modals ProfilePage opens over a section: the registration
 * schedule and the bank/dayboarder submission receipts. Extracted from the
 * bottom of ProfilePage; both take their credentials as props and call `api`
 * directly, so they carry no other state from the settings shell.
 */

export function RegistrationModalContent({ creds, onClose }: { creds: any; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [hasData, setHasData] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const { cookies, authorizedID, csrf } = creds;
    api("registration-schedule", {
      method: "POST",
      body: { cookies, authorizedID, csrf },
    })
      .then((res: any) => {
        const hasContent = res?.tables?.length > 0 && res.tables.some((t: any) => t.rows?.length > 0);
        setHasData(hasContent);
        if (hasContent) {
          let foundDate = "";
          let foundTime = "";

          if (res?.keyValuePairs?.date) foundDate = res.keyValuePairs.date;
          if (res?.keyValuePairs?.fromTime) {
            const to = res.keyValuePairs.toTime ? ` - ${res.keyValuePairs.toTime}` : "";
            foundTime = res.keyValuePairs.fromTime + to;
          }

          if (!foundDate || !foundTime) {
            const rows = res.tables[0].rows || [];
            const h = res.tables[0].headers?.[0] || "Registration Details";
            for (const row of rows) {
              const label = typeof row === "object" ? row[h] || "" : "";
              const val = typeof row === "object" ? row["col1"] || "" : "";
              if (!foundDate && /date/i.test(label)) foundDate = val;
              if (!foundTime && /from.?time|to.?time|time/i.test(label)) {
                foundTime = foundTime ? `${foundTime} - ${val}` : val;
              }
            }
          }

          if (!foundDate || !foundTime) {
            const firstRow = res.tables[0].rows?.[0];
            const headers = res.tables[0].headers || [];
            if (!foundDate) {
              const idx = headers.findIndex((h: string) => /date/i.test(h));
              if (idx >= 0) {
                foundDate = String(
                  typeof firstRow === "object" ? firstRow[headers[idx]] || firstRow[idx] || "" : firstRow[idx] || "",
                );
              }
            }
            if (!foundTime) {
              const idx = headers.findIndex((h: string) => /time|session/i.test(h));
              if (idx >= 0) {
                foundTime = String(
                  typeof firstRow === "object" ? firstRow[headers[idx]] || firstRow[idx] || "" : firstRow[idx] || "",
                );
              }
            }
          }

          setDate(foundDate);
          setTime(foundTime);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [creds]);

  const handleMarkRead = () => {
    localStorage.setItem("_reg_update_read", Date.now().toString());
    onClose();
  };

  if (loading) return <Skeleton className="h-20 w-full rounded-md" />;

  if (error || !hasData) {
    return (
      <div className="flex flex-col items-center text-center py-4 space-y-3">
        <div className="p-3 rounded-full bg-warn-soft">
          <Clock className="w-8 h-8 text-warn" />
        </div>
        <p className="text-sm text-muted">No registration schedule available</p>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-md bg-surface-2 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-4 space-y-4">
      <div className="p-4 rounded-full bg-accent-soft">
        <Clock className="w-10 h-10 text-accent" />
      </div>
      <div>
        <p className="text-lg font-semibold text-ink font-outfit">Registration Scheduled</p>
        <p className="text-sm text-muted mt-1">
          {date && <span>Date: {date}</span>}
          {date && time && <span>{" • "}</span>}
          {time && <span>Time: {time}</span>}
          {!date && !time && <span>Your registration is available</span>}
        </p>
      </div>
      <button
        onClick={handleMarkRead}
        className="px-5 py-2.5 rounded-sm bg-accent hover:bg-accent/90 text-background text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Mark as Read
      </button>
    </div>
  );
}

export function BankDayStatusModal({ endpoint, title, creds }: { endpoint: string; title: string; creds: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const { cookies, authorizedID, csrf } = creds;
    api(endpoint, {
      method: "POST",
      body: { cookies, authorizedID, csrf },
    })
      .then((data: any) => setData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [creds, endpoint]);

  if (loading) return <Skeleton className="h-24 w-full rounded-md" />;

  const hasContent = data?.tables?.length > 0 || (data?.keyValuePairs && Object.keys(data.keyValuePairs).length > 0);

  return (
    <div className="flex items-center gap-4 p-4 rounded-md">
      {hasContent ? (
        <>
          <div className="p-3 rounded-full bg-ok-soft text-ok">
            <CheckCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold text-ok text-lg">{title} Filled</p>
            <p className="text-sm text-ok/70">
              Your {title.toLowerCase()} has been submitted successfully
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="p-3 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <p className="font-semibold text-zinc-700 dark:text-zinc-300 text-lg">{title} Not Filled</p>
            <p className="text-sm text-muted">No {title.toLowerCase()} found in the system</p>
          </div>
        </>
      )}
    </div>
  );
}
