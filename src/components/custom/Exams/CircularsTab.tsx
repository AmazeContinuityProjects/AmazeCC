"use client";
import { useState, useEffect, useCallback } from "react";
import { API_BASE } from "../Main";
import SubpageLayout from "../shared/SubpageLayout";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import { RefreshCcw, FileText, ChevronRight, ChevronDown, FolderOpen, File, Download, X, Bell } from "lucide-react";

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
      const res = await fetch(`${API_BASE}/api/circulars/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, circularId: id }),
      });
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
        <button onClick={() => downloadCircular(item.id!, item.title!)} className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-slate-700 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500 transition-all" title="Download">
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-slate-800/30 dark:hover:bg-gray-800/30 transition-colors text-left" style={{ paddingLeft: `${16 + depth * 20}px` }}>
        {open ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-400" />}
        <FolderOpen className="w-3.5 h-3.5 shrink-0 text-amber-500" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 " onClick={onClose} />
      <div className="relative bg-white  dark:bg-gray-950 rounded-2xl shadow-2xl border border-gray-200  dark:border-gray-800 max-w-lg w-full mx-4 max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-200  dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50  dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100">New Circulars</h3>
              <p className="text-xs text-gray-500  dark:text-gray-400">{circulars.length} new circular{circulars.length !== 1 ? "s" : ""} published</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 dark:hover:bg-gray-800 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        <div className="overflow-y-auto p-5 space-y-2 flex-1">
          {circulars.map((c, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50  dark:bg-gray-900/50">
              <FileText className="w-4 h-4 shrink-0 text-blue-500" />
              <span className="text-sm text-gray-700  dark:text-gray-300">{c.title}</span>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-gray-200  dark:border-gray-800 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CircularsTab({ loginToVTOP, onBack }: CircularsTabProps) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCirculars, setNewCirculars] = useState<CircularItem[]>([]);

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
      const res = await fetch(`${API_BASE}/api/circulars`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies, authorizedID, csrf }),
      });
      const result = await res.json();
      if (result.success === false) setError(result.error || "Failed to load");
      else {
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
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loginToVTOP().then(c => { setCreds(c); fetchData(c); }).catch(() => setLoading(false));
  }, []);

  if (!creds || loading) {
    return (
      <SubpageLayout title="Circulars" onBack={() => {}}>
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </SubpageLayout>
    );
  }

  const circulars: CircularItem[] = data?.circulars || [];

  return (
    <SubpageLayout
      title="Circulars"
      onBack={onBack || (() => {})}
      action={
        <button onClick={() => { localStorage.removeItem(LS_KEY); localStorage.removeItem(LS_SEEN_KEY); if (creds) fetchData(creds, true); }} className="p-2.5 rounded-full bg-blue-50  dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors" title="Reload">
          <RefreshCcw className="w-5 h-5" />
        </button>
      }
    >
      {newCirculars.length > 0 && (
        <NewCircularsModal circulars={newCirculars} onClose={() => setNewCirculars([])} />
      )}

      {error && (
        <div className="p-4 text-sm text-red-600  dark:text-red-500 bg-red-50  dark:bg-red-900/20 rounded-2xl mb-4">{error}</div>
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
