"use client";
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/sync-engine";
import { runPageSync } from "@/lib/sync-engine/single-sync";
import SubpageLayout from "../shared/SubpageLayout";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import BottomSheet from "../shared/BottomSheet";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, Bell, ChevronDown, ChevronRight, Download, File, FileText, FolderOpen, RefreshCcw } from "lucide-react";

interface Creds {
  cookies: string[];
  authorizedID: string;
  csrf: string;
}

interface CircularItem {
  id?: string | null;
  title?: string;
  name?: string;
  children?: CircularItem[];
}

interface CircularsTabProps {
  loginToVTOP: () => Promise<Creds>;
  onBack?: () => void;
  /** Used only as the back target when `onBack` is not supplied. */
  setActiveTab?: (tab: string) => void;
}

const LS_KEY = "uni_cc_circulars";
const LS_SEEN_KEY = "uni_cc_circulars_seen";

function flattenIds(items: CircularItem[]): string[] {
  const ids: string[] = [];
  for (const item of items) {
    if (item.id != null) ids.push(item.id);
    if (item.children) ids.push(...flattenIds(item.children));
  }
  return ids;
}

function TreeNode({ item, depth = 0, creds }: { item: CircularItem; depth?: number; creds: Creds | null }) {
  const [open, setOpen] = useState(true);
  const hasChildren = item.children && item.children.length > 0;

  const downloadCircular = useCallback(async (id: string, title: string) => {
    if (!creds) return;
    try {
      const res = await api("circulars/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, circularId: id },
        parse: "raw",
      }) as Response;
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Circular download error:", err.message);
    }
  }, [creds]);

  if (item.id != null && item.title) {
    return (
      <div className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 dark:hover:bg-gray-800/30 transition-colors group" style={{ paddingLeft: `${16 + depth * 20}px` }}>
        <File className="w-3.5 h-3.5 shrink-0 text-gray-400" />
        <p className="text-sm text-gray-700  dark:text-gray-300 flex-1 min-w-0">{item.title}</p>
        <button onClick={() => downloadCircular(item.id!, item.title!)} className="p-1.5 rounded-lg relative hit-expand opacity-0 group-hover:opacity-100 [@media(any-hover:none)]:opacity-100 hover:bg-gray-100 dark:hover:bg-slate-700 dark:hover:bg-gray-800 text-gray-400 hover:text-accent transition-all" title="Download">
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 dark:hover:bg-gray-800/30 transition-colors text-left" style={{ paddingLeft: `${16 + depth * 20}px` }}>
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />}
        <FolderOpen className="w-3.5 h-3.5 shrink-0 text-warn" />
        <span className="text-sm font-medium text-gray-800  dark:text-gray-200">{item.name}</span>
      </button>
      {open && hasChildren && (
        <div>
          {item.children!.map((child, i) => (
            <TreeNode key={i} item={child} depth={depth + 1} creds={creds} />
          ))}
        </div>
      )}
    </div>
  );
}

function NewCircularsModal({ circulars, onClose }: { circulars: CircularItem[]; onClose: () => void }) {
  return (
    <BottomSheet
      onClose={onClose}
      overlayId="new-circulars"
      maxWidth="max-w-lg"
      title="New Circulars"
      subtitle={`${circulars.length} new circular${circulars.length !== 1 ? "s" : ""} published`}
      icon={<Bell className="w-5 h-5" />}
      accent="bg-accent-soft border-accent/20 text-accent"
      closeLabel="Close circulars"
    >
      <div className="flex flex-col min-h-0 space-y-4">
        <div className="space-y-2">
          {circulars.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-3.5 rounded-md bg-surface-2 border border-zinc-200/60 dark:border-zinc-800/60">
              <FileText className="w-4 h-4 shrink-0 text-accent" />
              <span className="text-[13px] font-semibold text-zinc-700 dark:text-zinc-300">{c.title}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="px-6 py-3 rounded-sm bg-accent hover:bg-accent/90 text-background text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            Got it
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

export default function CircularsTab({ loginToVTOP, onBack, setActiveTab }: CircularsTabProps) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCirculars, setNewCirculars] = useState<CircularItem[]>([]);

  // Shared ingest: seen-tracking + persistence for both the silent mount
  // fetch and the engine-backed refresh below.
  const ingestCirculars = (result: any) => {
    setData(result);

    const seenStr = localStorage.getItem(LS_SEEN_KEY);
    const seenIds = seenStr ? JSON.parse(seenStr) as string[] : [];
    const currentIds = flattenIds(result.circulars || []);
    const newIds = currentIds.filter(id => !seenIds.includes(id));
    if (newIds.length > 0) {
      const newItems = collectByIds(result.circulars || [], new Set(newIds));
      if (newItems.length > 0) setNewCirculars(newItems);
    }

    localStorage.setItem(LS_SEEN_KEY, JSON.stringify(currentIds));
    localStorage.setItem(LS_KEY, JSON.stringify(result));
  };

  // Header reload + error retry: exactly this screen's endpoint through the
  // engine — session opens, progress hits 100, sheet closes.
  const refreshCirculars = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await runPageSync<any>({
        title: "Circulars",
        steps: [{ op: "circulars", apply: ingestCirculars }],
        doneLine: "Circulars reloaded successfully",
      });
      if (!res) return;
    } catch (e: any) {
      setError(e?.message ?? "Could not reach VTOP.");
    } finally {
      setLoading(false);
    }
  };
  const fetchData = async (c: Creds, force = false) => {
    if (!force) {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.success !== false) {
            setData(parsed);
            setLoading(false);
            return;
          }
        }
      } catch {}
    }
    setLoading(true);
    setError(null);
    try {
      const { cookies, authorizedID, csrf } = c;
      const result = await api("circulars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { cookies, authorizedID, csrf },
      }) as any;
      if (result.success === false) setError(result.error || "Failed to load");
      else ingestCirculars(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The `.catch` used to only clear `loading`, which left `creds` null — and
    // the guard below is `!creds || loading`, so a failed login pinned the
    // subpage on its skeleton forever with no way out. Record the failure and let
    // the error branch render.
    loginToVTOP()
      .then((c) => {
        setCreds(c);
        return fetchData(c);
      })
      .catch((e) => {
        console.error("Circulars fetch failed:", e);
        setError("Could not reach VTOP to load circulars. Check your connection and try again.");
        setLoading(false);
      });
  }, []);

  // `SubpageLayout` from amazeui renders its back button unconditionally — unlike
  // this repo's `PageShell`, it does not hide the control when `onBack` is
  // absent. So every branch below has to supply a real one; an empty arrow
  // function renders a button that swallows the tap and does nothing.
  const leave = onBack ?? (() => setActiveTab?.("attendance"));

  // Engine refreshes carry their own session, so data on screen is enough to
  // render even before the credentialed mount fetch resolves.
  if ((!creds && !data) || loading) {
    return (
      <SubpageLayout title="Circulars" onBack={leave}>
        {error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="h-9 w-9 text-warn" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              Could not load circulars
            </p>
            <p className="text-xs text-muted max-w-xs">{error}</p>
            <button
              onClick={() => {
                void refreshCirculars();
              }}
              className="mt-1 px-4 py-2 rounded-sm bg-accent hover:bg-accent/90 text-background text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-64 w-full rounded-md" />
          </div>
        )}
      </SubpageLayout>
    );
  }

  const circulars: CircularItem[] = data?.circulars || [];

  return (
    <SubpageLayout
      title="Circulars"
      onBack={leave}
      action={
        <button onClick={() => { void refreshCirculars(); }} className="p-2.5 rounded-full bg-accent-soft  dark:bg-slate-800 text-accent hover:bg-accent-soft dark:hover:bg-slate-700 transition-colors" title="Reload">
          <RefreshCcw className="w-5 h-5" />
        </button>
      }
    >
      <AnimatePresence>
        {newCirculars.length > 0 && (
          <NewCircularsModal circulars={newCirculars} onClose={() => setNewCirculars([])} />
        )}
      </AnimatePresence>

      {error && (
        <div className="p-4 text-sm text-danger bg-danger-soft rounded-md mb-4">{error}</div>
      )}
      {circulars.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400  dark:text-gray-500">
          <FileText className="w-12 h-12 mb-3" />
          <p className="text-sm font-medium">No circulars found</p>
        </div>
      )}
      <div className="solid-card divide-y divide-gray-100/50  dark:divide-gray-800/50">
        {circulars.map((item, i) => (
          <TreeNode key={i} item={item} creds={creds} />
        ))}
      </div>
    </SubpageLayout>
  );
}

function collectByIds(items: CircularItem[], targetIds: Set<string>): CircularItem[] {
  const result: CircularItem[] = [];
  for (const item of items) {
    if (item.id && targetIds.has(item.id)) result.push(item);
    if (item.children) result.push(...collectByIds(item.children, targetIds));
  }
  return result;
}
