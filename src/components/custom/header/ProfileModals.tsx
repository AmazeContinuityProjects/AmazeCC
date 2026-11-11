"use client";

import { useState, useEffect } from "react";
import { api, syncEngine } from "@/lib/sync-engine";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { AlertCircle, CheckCircle, Clock } from "lucide-react";

async function getWhoami(creds?: any): Promise<any> {
  try {
    const cached = localStorage.getItem("cache_whoami");
    if (cached) return JSON.parse(cached);
  } catch {}
  try {
    const w = (await syncEngine.sync("whoami")) as any;
    if (w && !w.error) {
      try {
        localStorage.setItem("cache_whoami", JSON.stringify(w));
      } catch {}
      return w;
    }
  } catch {}
  if (creds?.cookies) {
    try {
      const w = (await api("whoami", { method: "POST", auth: "vtop" } as any)) as any;
      if (w && !w.error) {
        try {
          localStorage.setItem("cache_whoami", JSON.stringify(w));
        } catch {}
        return w;
      }
    } catch {}
  }
  return null;
}

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
    api("ffcs", {
      method: "POST",
      body: { cookies, authorizedID, csrf, section: "registration" },
    })
      .then((raw: any) => {
        const res = raw?.registrationSchedule || raw;
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

  if (loading) return <Skeleton className="h-20 w-full rounded-xl" />;

  if (error || !hasData) {
    return (
      <div className="flex flex-col items-center text-center py-4 space-y-3">
        <div className="p-3 rounded-full bg-amber-50 dark:bg-amber-900/30">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No registration schedule available</p>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-4 space-y-4">
      <div className="p-4 rounded-full bg-blue-50 dark:bg-blue-900/30">
        <Clock className="w-10 h-10 text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 font-outfit">Registration Scheduled</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          {date && <span>Date: {date}</span>}
          {date && time && <span>{" • "}</span>}
          {time && <span>Time: {time}</span>}
          {!date && !time && <span>Your registration is available</span>}
        </p>
      </div>
      <button
        onClick={handleMarkRead}
        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors cursor-pointer"
      >
        Mark as Read
      </button>
    </div>
  );
}

function hasWhoamiBank(bank: any) {
  return !!(
    bank?.name ||
    bank?.branch ||
    bank?.address ||
    (Array.isArray(bank?.fields) && bank.fields.some((f: any) => f?.value && String(f.value).trim()))
  );
}

function hasWhoamiDayboarder(day: any) {
  return !!(
    day?.fields && Object.values(day.fields).some((f: any) => (f as any)?.value && String((f as any).value).trim())
  );
}

export function BankDayStatusModal({ endpoint, title, creds }: { endpoint: string; title: string; creds: any }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (endpoint === "bank-info" || endpoint === "dayboarder") {
          const w = await getWhoami(creds);
          if (!cancelled) setData(w);
          return;
        }
        const { cookies, authorizedID, csrf } = creds || {};
        const res = await api(endpoint, { method: "POST", body: { cookies, authorizedID, csrf } });
        if (!cancelled) setData(res);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [creds, endpoint]);

  if (loading) return <Skeleton className="h-24 w-full rounded-2xl" />;

  let hasContent = false;
  let details: Array<{ label: string; value: string }> = [];
  if (endpoint === "bank-info") {
    const bank = data?.bank;
    hasContent = hasWhoamiBank(bank);
    if (hasContent) {
      if (bank.name) details.push({ label: "Bank", value: String(bank.name) });
      if (bank.branch) details.push({ label: "Branch", value: String(bank.branch) });
      if (bank.address) details.push({ label: "Address", value: String(bank.address) });
      if (Array.isArray(bank.fields)) {
        for (const f of bank.fields)
          if (f?.label && f?.value) details.push({ label: String(f.label), value: String(f.value) });
      }
    }
  } else if (endpoint === "dayboarder") {
    const day = data?.dayboarder;
    hasContent = hasWhoamiDayboarder(day);
    if (hasContent && day?.fields) {
      for (const v of Object.values(day.fields) as any[]) {
        if (v?.label && v?.value) details.push({ label: String(v.label), value: String(v.selectedText || v.value) });
      }
    }
  } else {
    hasContent = data?.tables?.length > 0 || (data?.keyValuePairs && Object.keys(data.keyValuePairs).length > 0);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 p-4 rounded-xl">
        {hasContent ? (
          <>
            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div>
              <p className="font-semibold text-emerald-700 dark:text-emerald-300 text-lg">{title} Filled</p>
              <p className="text-sm text-emerald-600/70 dark:text-emerald-400/70">
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
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No {title.toLowerCase()} found in the system</p>
            </div>
          </>
        )}
      </div>
      {details.length > 0 && (
        <div className="rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 divide-y divide-zinc-200/60 dark:divide-zinc-800/60 overflow-hidden">
          {details.map((d, i) => (
            <div key={i} className="flex items-start justify-between gap-4 px-4 py-2.5 text-sm">
              <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{d.label}</span>
              <span className="text-zinc-900 dark:text-zinc-100 font-medium text-right break-words">{d.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
