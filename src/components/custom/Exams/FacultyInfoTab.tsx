"use client";
import { useState, useEffect, useRef } from "react";
import { API_BASE } from "../Main";
import SubpageLayout from "../shared/SubpageLayout";
import { Skeleton } from "@/components/ui/Skeleton";
import { RefreshCcw, Search, User, XCircle } from "lucide-react";

interface Creds {
  cookies: string[];
  authorizedID: string;
  csrf: string;
}

const CardShell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`glass-card mb-5 ${className}`}>
    {children}
  </div>
);

function renderTables(tables: any[]) {
  if (!tables || tables.length === 0) return null;
  return tables.map((table: any, idx: number) => {
    const hasRows = table.headers?.length > 0 && table.rows?.length > 0;
    return (
      <CardShell key={idx}>
        <div className="p-5">
          {table.caption && <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase tracking-wider mb-4">{table.caption}</h4>}
          {hasRows ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 midnight:border-gray-700">
                    {table.headers.map((h: string, i: number) => (
                      <th key={i} className="text-left py-2 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 midnight:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row: any, ri: number) => (
                    <tr key={ri} className="border-b border-gray-100 dark:border-gray-800/50 midnight:border-gray-800/50 last:border-0">
                      {table.headers.map((h: string, ci: number) => (
                        <td key={ci} className="py-2.5 px-2 text-sm text-gray-800 dark:text-gray-200 midnight:text-gray-200 whitespace-nowrap">{row[h] || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500 midnight:text-gray-500">No data</p>
          )}
        </div>
      </CardShell>
    );
  });
}

function renderKeyValuePairs(kvp: Record<string, string>) {
  if (!kvp || Object.keys(kvp).length === 0) return null;
  return (
    <CardShell>
      <div className="p-5 space-y-3">
        {Object.entries(kvp).map(([key, val]) => (
          <div key={key} className="flex items-center justify-between py-1">
            <span className="text-xs font-semibold text-gray-400 dark:text-gray-500 midnight:text-gray-500 uppercase tracking-wider">{key}</span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 midnight:text-gray-200 text-right">{val || "—"}</span>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

export default function FacultyInfoTab({ loginToVTOP }: { loginToVTOP: () => Promise<Creds> }) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const [initData, setInitData] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loginToVTOP().then(c => {
      setCreds(c);
      fetch(`${API_BASE}/api/faculty-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: c.cookies, authorizedID: c.authorizedID, csrf: c.csrf }),
      }).then(r => r.json()).then(setInitData).catch(() => setError("Failed to load")).finally(() => setLoading(false));
    }).catch(() => setLoading(false));
  }, []);

  const handleSearch = async () => {
    if (!creds || !searchTerm.trim()) return;
    setSearching(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`${API_BASE}/api/faculty-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: creds.cookies, authorizedID: creds.authorizedID, csrf: creds.csrf, searchTerm: searchTerm.trim() }),
      });
      const data = await res.json();
      if (data.success === false) setError(data.error || "Search failed");
      else setResults(data.results);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  };

  if (!creds || loading) {
    return (
      <SubpageLayout title="Faculty Info" onBack={() => {}}>
        <Skeleton className="h-8 w-48 rounded-lg mb-4" />
        <Skeleton className="h-12 w-full rounded-2xl mb-4" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </SubpageLayout>
    );
  }

  return (
    <SubpageLayout title="Faculty Info" onBack={() => {}}>
      {/* Search Box */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={initData?.searchField?.placeholder || "Search by name or ID..."}
            className="w-full pl-10 pr-4 py-2.5 text-sm text-gray-800 dark:text-gray-200 midnight:text-gray-200 bg-gray-50 dark:bg-slate-800/50 midnight:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 midnight:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !searchTerm.trim()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors shrink-0"
        >
          {searching ? "Searching..." : "Search"}
        </button>
      </div>

      {error && (
        <div className="p-4 text-sm text-red-600 dark:text-red-500 midnight:text-red-500 bg-red-50 dark:bg-red-900/20 midnight:bg-red-900/20 rounded-2xl mb-4 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {searching && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      )}

      {results && !searching && (
        <>
          {results.messages && (results.messages.warning || results.messages.error) && (
            <CardShell>
              <div className={`p-4 text-sm ${results.messages.error ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"} flex items-center gap-2`}>
                <span dangerouslySetInnerHTML={{ __html: results.messages.error || results.messages.warning }} />
              </div>
            </CardShell>
          )}
          {renderKeyValuePairs(results.keyValuePairs)}
          {renderTables(results.tables)}
          {!results.tables?.length && !results.keyValuePairs && !results.messages?.error && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500 midnight:text-gray-500">
              <User className="w-12 h-12 mb-3" />
              <p className="text-sm font-medium">No faculty found for "{searchTerm}"</p>
            </div>
          )}
        </>
      )}

      {!results && !searching && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500 midnight:text-gray-500">
          <Search className="w-12 h-12 mb-3" />
          <p className="text-sm font-medium">Search for faculty by name or employee ID</p>
        </div>
      )}
    </SubpageLayout>
  );
}
