"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import GenericApiView, { clearApiCache } from "../Exams/GenericApiView";
import SubpageLayout from "../shared/SubpageLayout";
import { LoadingSpinner } from "../shared";
import { Skeleton } from "@/components/ui/Skeleton";
import { RefreshCcw, BookOpen, Search, ChevronLeft, ChevronRight, User, LogOut, Library } from "lucide-react";
import { API_BASE } from "../Main";

interface LibrariesTabProps {
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
}

type SearchIndex = "kw" | "ti" | "au" | "su" | "nb";

const searchLabels: Record<SearchIndex, string> = { kw: "Keyword", ti: "Title", au: "Author", su: "Subject", nb: "ISBN" };

function BookSearch({ isDemo }: { isDemo?: boolean }) {
  const [query, setQuery] = useState("");
  const [idx, setIdx] = useState<SearchIndex>("kw");
  const [books, setBooks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [searched, setSearched] = useState(false);
  const [detailBook, setDetailBook] = useState<any>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string, index: SearchIndex, off: number) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setDetailBook(null);
    if (isDemo) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setBooks([
        {
          biblionumber: "10920",
          title: "Clean Code: A Handbook of Agile Software Craftsmanship",
          author: "Robert C. Martin",
          publisher: "Prentice Hall",
          isbn: "978-0132350884",
          itemtype: "Book",
          copies: "5",
          available: "3"
        },
        {
          biblionumber: "20194",
          title: "Design Patterns: Elements of Reusable Object-Oriented Software",
          author: "Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides",
          publisher: "Addison-Wesley",
          isbn: "978-0201633610",
          itemtype: "Book",
          copies: "8",
          available: "6"
        }
      ]);
      setTotal(2);
      setOffset(off);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/koha/search?q=${encodeURIComponent(q)}&idx=${index}&offset=${off}&count=20`);
      const data = await res.json();
      if (data.success) {
        setBooks(data.books || []);
        setTotal(data.total || 0);
        setOffset(off);
      } else {
        setError(data.error || "Search failed");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const openDetail = async (biblionumber: string) => {
    setLoadingDetail(biblionumber);
    setDetailError(null);
    if (isDemo) {
      await new Promise(resolve => setTimeout(resolve, 150));
      setDetailBook({
        biblionumber: biblionumber,
        title: biblionumber === "10920" ? "Clean Code: A Handbook of Agile Software Craftsmanship" : "Design Patterns: Elements of Reusable Object-Oriented Software",
        author: biblionumber === "10920" ? "Robert C. Martin" : "Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides",
        publisher: biblionumber === "10920" ? "Prentice Hall" : "Addison-Wesley",
        isbn: biblionumber === "10920" ? "978-0132350884" : "978-0201633610",
        itemtype: "Book",
        copies: "5",
        available: "3",
        summary: "Even bad code can function. But if code isn't clean, it can bring a development organization to its knees.",
        callNumber: "005.1 MAR",
        location: "Central Library - Stack Area"
      });
      setLoadingDetail(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/koha/detail?biblionumber=${biblionumber}`);
      const data = await res.json();
      if (data.success) {
        setDetailBook(data.book);
      } else {
        setDetailError(data.error || "Failed to load details");
      }
    } catch (e: any) {
      setDetailError(e.message);
    } finally {
      setLoadingDetail(null);
    }
  };

  const closeDetail = () => {
    setDetailBook(null);
    setDetailError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query, idx, 0);
  };

  const totalPages = Math.ceil(total / 20);
  const currentPage = Math.floor(offset / 20) + 1;

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <select value={idx} onChange={(e) => setIdx(e.target.value as SearchIndex)}
          className="px-3 py-2 text-sm rounded-xl border border-gray-200  dark:border-gray-700 bg-white/50  dark:bg-gray-800/50 text-gray-700  dark:text-gray-300"
        >
          {Object.entries(searchLabels).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
        </select>
        <div className="relative flex-1">
          <input ref={inputRef} type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search books..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-gray-200  dark:border-gray-700 bg-white/50  dark:bg-gray-800/50 text-gray-800  dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
        <button type="submit" disabled={loading || !query.trim()}
          className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all"
        >
          Search
        </button>
      </form>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      )}

      {error && <div className="p-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl">{error}</div>}

      {!loading && searched && books.length === 0 && !error && (
        <div className="flex flex-col items-center py-8 text-gray-400  dark:text-gray-500">
          <BookOpen className="w-10 h-10 mb-3" />
          <p className="text-sm font-medium">No books found</p>
        </div>
      )}

      {books.length > 0 && (
        <>
          <p className="text-xs text-gray-500  dark:text-gray-400">
            {total.toLocaleString()} results
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {books.map((book, i) => (
              <div key={book.biblionumber || `book-${i}`} onClick={() => openDetail(book.biblionumber)}
                className="relative flex gap-4 p-4 solid-card cursor-pointer hover:shadow-md hover:bg-white/80 dark:hover:bg-slate-900/70 transition-all"
              >
                {book.coverUrl ? (
                  <img src={book.coverUrl} alt="" className="w-16 h-24 object-cover rounded-lg shadow-sm shrink-0" />
                ) : (
                  <div className="w-16 h-24 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 flex items-center justify-center shrink-0">
                    <BookOpen className="w-6 h-6 text-gray-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900  dark:text-gray-100 line-clamp-2">{book.title}</div>
                  {book.author && <p className="text-xs text-gray-500  dark:text-gray-400 mt-0.5">{book.author}</p>}
                  {book.publisher && <p className="text-xs text-gray-400  dark:text-gray-500 mt-0.5 truncate">{book.publisher}</p>}
                  {book.isbn && <p className="text-xs text-gray-400  dark:text-gray-500 mt-0.5">ISBN: {book.isbn}</p>}
                </div>
                {loadingDetail === book.biblionumber && (
                  <div className="absolute inset-0 bg-white/60 dark:bg-slate-900/60 rounded-2xl flex items-center justify-center">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button onClick={() => doSearch(query, idx, offset - 20)} disabled={offset <= 0}
                className="p-2 rounded-xl bg-gray-100  dark:bg-gray-800 text-gray-600  dark:text-gray-400 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-gray-500  dark:text-gray-400">Page {currentPage} of {totalPages}</span>
              <button onClick={() => doSearch(query, idx, offset + 20)} disabled={offset + 20 >= total}
                className="p-2 rounded-xl bg-gray-100  dark:bg-gray-800 text-gray-600  dark:text-gray-400 disabled:opacity-30 hover:bg-gray-200 dark:hover:bg-slate-700 transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}

      {(detailBook || detailError) && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 " onClick={closeDetail}>
          <div className="relative w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white  dark:bg-gray-950 border-t sm:border border-gray-200  dark:border-gray-800 shadow-2xl p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 border-b border-gray-100  dark:border-gray-800 bg-white/90  dark:bg-gray-950/90 ">
              <h2 className="text-base font-bold text-gray-900  dark:text-gray-100 truncate pr-4">{detailBook?.title || "Book Details"}</h2>
              <button onClick={closeDetail} className="shrink-0 p-1.5 rounded-full bg-gray-100  dark:bg-gray-800 text-gray-500  dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 sm:p-6 space-y-5">
              {detailError ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{detailError}</p>
                </div>
              ) : detailBook && (
                <>
                  <div className="flex gap-5">
                    {detailBook.coverUrl && <img src={detailBook.coverUrl} alt="" className="w-24 h-36 object-cover rounded-lg shadow-md shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <h3 className="text-lg font-bold text-gray-900  dark:text-gray-100 leading-snug">{detailBook.title}</h3>
                      {detailBook.author && <p className="text-sm text-gray-600  dark:text-gray-400"><span className="text-gray-400  dark:text-gray-500">By </span>{detailBook.author}</p>}
                      {detailBook.publisher && <p className="text-sm text-gray-500  dark:text-gray-400">{detailBook.publisher}</p>}
                      {detailBook.edition && <p className="text-xs text-gray-400  dark:text-gray-500">{detailBook.edition} edition</p>}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm bg-gray-50  dark:bg-gray-900/50 rounded-xl p-4">
                    {detailBook.isbn && <><span className="text-gray-500  dark:text-gray-400">ISBN</span><span className="text-gray-900  dark:text-gray-100 font-medium text-right">{detailBook.isbn}</span></>}
                    {detailBook.ddc && <><span className="text-gray-500  dark:text-gray-400">DDC</span><span className="text-gray-900  dark:text-gray-100 font-medium text-right">{detailBook.ddc}</span></>}
                    {detailBook.subjects?.length > 0 && <><span className="text-gray-500  dark:text-gray-400">Subjects</span><span className="text-gray-900  dark:text-gray-100 text-right">{detailBook.subjects.join(", ")}</span></>}
                    {detailBook.description && <><span className="text-gray-500  dark:text-gray-400">Description</span><span className="text-gray-900  dark:text-gray-100 text-right">{detailBook.description}</span></>}
                  </div>
                  {detailBook.holdings?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700  dark:text-gray-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                        Holdings ({detailBook.holdings.length})
                      </h4>
                      <div className="space-y-2.5">
                        {detailBook.holdings.map((h: any, i: number) => (
                          <div key={i} className="p-3.5 rounded-xl bg-gray-50  dark:bg-gray-900/50 border border-gray-100  dark:border-gray-800 text-xs space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`w-2.5 h-2.5 rounded-full ${h.status === "Available" ? "bg-green-500 shadow-sm shadow-green-500/30" : h.status === "Checked out" ? "bg-yellow-500 shadow-sm shadow-yellow-500/30" : h.status?.toLowerCase().includes("not for loan") ? "bg-orange-500 shadow-sm shadow-orange-500/30" : "bg-red-500 shadow-sm shadow-red-500/30"}`} />
                              <span className="font-semibold text-gray-700  dark:text-gray-300 text-xs">{h.status}</span>
                              {h.dateDue && <span className="ml-auto text-yellow-600 dark:text-yellow-400 dark:text-yellow-400">Due: {h.dateDue}</span>}
                            </div>
                            {h.callNumber && <p className="text-gray-500  dark:text-gray-400">Call No: <span className="font-mono text-gray-700  dark:text-gray-300">{h.callNumber}</span></p>}
                            {h.shelvingLocation && <p className="text-gray-500  dark:text-gray-400">Location: <span className="text-gray-700  dark:text-gray-300">{h.shelvingLocation}</span></p>}
                            {h.currentLibrary && <p className="text-gray-500 dark:text-gray-400 dark:text-gray-400">Library: {h.currentLibrary}{h.barcode ? ` · Barcode: ${h.barcode}` : ""}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PATRON_SECTIONS: Record<string, { label: string; icon: string; color: string }> = {
  charges: { label: "Charges & Dues", icon: "💰", color: "pink" },
  checkouts: { label: "Checkout History", icon: "📚", color: "blue" },
  history: { label: "Search History", icon: "🔍", color: "purple" },
};

function KohaPatronPage({ onBack, isDemo }: { onBack: () => void; isDemo?: boolean }) {
  const [card, setCard] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [patronData, setPatronData] = useState<any>(null);
  const doLogin = useCallback(async (c: string, p: string) => {
    if (!c.trim() || !p.trim()) return;
    setLoading(true);
    if (isDemo) {
      await new Promise(resolve => setTimeout(resolve, 300));
      setPatronData({
        info: {
          name: "Demo Student",
          cardnumber: "22BCE1234",
          category: "Undergraduate",
          library: "Central Library"
        },
        pages: {
          charges: {
            title: "Account Charges",
            tables: [
              {
                headers: ["Type", "Description", "Amount", "Amount outstanding", "Created", "Updated"],
                rows: [
                  ["Fine", "Overdue Fine: Code Complete Book", "10.00", "0.00", "2026-06-15", "2026-06-20"]
                ]
              }
            ]
          },
          checkouts: {
            title: "Current Checkouts",
            tables: [
              {
                headers: ["Title", "Due", "Barcode", "Call number", "Renew"],
                rows: [
                  ["Clean Code", "2026-07-10", "BC-90184", "005.1 MAR", "Renewable"]
                ]
              }
            ]
          }
        }
      });
      setLoggedIn(true);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/koha/patron`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card: c.trim(), password: p }),
      });
      const data = await res.json();
      if (data.success) {
        setPatronData(data.data);
        setLoggedIn(true);
        const charges = data.data?.pages?.charges;
        let sum = 0;
        let cnt = 0;
        charges?.tables?.forEach((t: any) => {
          t.rows?.forEach((r: any[]) => {
            const oustandingIdx = t.headers.indexOf("Amount outstanding");
            const amountIdx = t.headers.indexOf("Amount");
            if (oustandingIdx >= 0) {
              const val = parseFloat(r[oustandingIdx]);
              if (!isNaN(val) && val > 0) { sum += val; cnt++; }
            } else if (amountIdx >= 0) {
              const val = parseFloat(r[amountIdx]);
              if (!isNaN(val) && val > 0) { sum += val; cnt++; }
            }
          });
        });
        localStorage.setItem("koha_dues_total", String(sum));
        localStorage.setItem("koha_dues_count", String(cnt));
        localStorage.setItem("koha_patron_pages", JSON.stringify(data.data?.pages || {}));
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedCard = localStorage.getItem("koha_card");
    const savedPass = localStorage.getItem("koha_password");
    if (savedCard) setCard(savedCard);
    if (savedPass) setPassword(savedPass);
  }, []);

  return (
    <SubpageLayout title="Library Account" onBack={onBack}>
      <div className="space-y-4">
        {!loggedIn ? (
          <div className="solid-card p-5 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
                <Library className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900  dark:text-gray-100 text-sm">Koha Library Account</h3>
                <p className="text-xs text-gray-400  dark:text-gray-500 mt-0.5">Enter your credentials or save them on your Profile page</p>
              </div>
            </div>
            {loading ? (
              <div className="flex items-center gap-3 text-sm text-gray-500  dark:text-gray-400">
                <LoadingSpinner size="sm" />
                Logging in with saved credentials...
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); doLogin(card, password); }} className="space-y-3">
                <input type="text" value={card} onChange={(e) => setCard(e.target.value)} placeholder="Card Number" className="w-full px-4 py-2 text-sm rounded-xl border border-gray-200  dark:border-gray-700 bg-white/50  dark:bg-gray-800/50 text-gray-800  dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-2 text-sm rounded-xl border border-gray-200  dark:border-gray-700 bg-white/50  dark:bg-gray-800/50 text-gray-800  dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                <button type="submit" disabled={!card.trim() || !password.trim()}
                  className="w-full px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white transition-all"
                >
                  Log in
                </button>
              </form>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900  dark:text-gray-100 text-sm">My Library Account</h3>
                  <p className="text-xs text-gray-400  dark:text-gray-500">{patronData?.patronName}</p>
                </div>
              </div>
              <button onClick={() => { setLoggedIn(false); setPatronData(null); }}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-100  dark:bg-gray-800 text-gray-600  dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Log out
              </button>
            </div>

            {Object.entries(PATRON_SECTIONS).map(([key, section]) => {
              const page = patronData?.pages?.[key];
              if (!page) return null;
              const rowCount = page.tables?.reduce((s: number, t: any) => s + (t.rows?.length || 0), 0) ?? 0;
              return (
                <div key={key} className="overflow-hidden rounded-2xl bg-white dark:bg-gray-800  border border-white/40  dark:border-white/10 shadow-sm">
                  <div className={`px-5 py-3.5 flex items-center gap-3 border-b ${
                    section.color === "pink"
                      ? "bg-pink-500/10  dark:bg-pink-500/20 border-pink-500/20  dark:border-pink-500/30 text-pink-700  dark:text-pink-300"
                      : section.color === "blue"
                      ? "bg-blue-500/10  dark:bg-blue-500/20 border-blue-500/20  dark:border-blue-500/30 text-blue-700  dark:text-blue-300"
                      : "bg-purple-500/10  dark:bg-purple-500/20 border-purple-500/20  dark:border-purple-500/30 text-purple-700  dark:text-purple-300"
                  }`}>
                    <span className="text-lg">{section.icon}</span>
                    <h4 className="text-sm font-bold">{page.title || section.label}</h4>
                    {rowCount > 0 && (
                      <span className={`ml-auto text-xs rounded-full px-2.5 py-0.5 ${
                        section.color === "pink"
                          ? "bg-pink-500/20 text-pink-600  dark:text-pink-300"
                          : section.color === "blue"
                          ? "bg-blue-500/20 text-blue-600  dark:text-blue-300"
                          : "bg-purple-500/20 text-purple-600  dark:text-purple-300"
                      }`}>{rowCount} item{rowCount !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    {page.alerts?.map((a: string, i: number) => (
                      <p key={i} className="text-xs text-yellow-700  dark:text-yellow-300 bg-yellow-50  dark:bg-yellow-900/30 rounded-xl px-4 py-2.5 border border-yellow-200/50  dark:border-yellow-700/30 flex items-center gap-2">
                        <span className="text-base">⚠️</span>
                        {a}
                      </p>
                    ))}
                    {page.tables?.map((table: any, ti: number) => {
                      const rows = table.rows || [];
                      if (rows.length === 0) return null;
                      return (
                        <div key={ti} className="space-y-2.5">
                          {table.caption && (
                            <p className="text-xs font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider px-1">{table.caption}</p>
                          )}
                          {key === "charges" && rows.map((row: any[], ri: number) => {
                            const m = (label: string) => {
                              const i = table.headers.indexOf(label);
                              return i >= 0 ? row[i] || "" : "";
                            };
                            const type = m("Type");
                            const desc = m("Description");
                            const amount = m("Amount");
                            const outstanding = m("Amount outstanding");
                            const created = m("Created");
                            const updated = m("Updated");
                            const isFine = type?.toLowerCase().includes("fine");
                            const isPayment = type?.toLowerCase().includes("payment");
                            const paidOff = outstanding === "0.00";
                            return (
                              <div key={ri} className="relative group">
                                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-all group-hover:w-1.5 ${
                                  isFine ? "bg-gradient-to-b from-rose-400 to-pink-500" : "bg-gradient-to-b from-emerald-400 to-teal-500"
                                }`} />
                                <div className="ml-3 p-4 rounded-xl bg-white dark:bg-gray-800  border border-white/40  dark:border-white/10 shadow-sm hover:shadow-md transition-all space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                          isFine
                                            ? "bg-rose-100 text-rose-700   dark:bg-rose-500/20 dark:text-rose-300"
                                            : isPayment
                                            ? "bg-emerald-100 text-emerald-700   dark:bg-emerald-500/20 dark:text-emerald-300"
                                            : "bg-gray-100 text-gray-600   dark:bg-gray-800 dark:text-gray-400"
                                        }`}>{type || "Charge"}</span>
                                        {paidOff && (
                                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-700   dark:bg-green-500/20 dark:text-green-300">Paid</span>
                                        )}
                                      </div>
                                    </div>
                                    {amount && (
                                      <div className="text-right shrink-0">
                                        <span className={`text-lg font-bold ${
                                          isFine && !paidOff
                                            ? "text-rose-600  dark:text-rose-400"
                                            : "text-emerald-600  dark:text-emerald-400"
                                        }`}>₹{parseFloat(amount).toFixed(2)}</span>
                                        {outstanding && outstanding !== "0.00" && (
                                          <p className="text-[10px] text-rose-500  dark:text-rose-400">₹{parseFloat(outstanding).toFixed(2)} outstanding</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {desc && (
                                    <p className="text-sm font-medium text-gray-800  dark:text-gray-200 leading-snug">{desc}</p>
                                  )}
                                  <div className="flex items-center gap-3 text-[11px] text-gray-400  dark:text-gray-500">
                                    {created && <span>🕐 {created}</span>}
                                    {updated && updated !== created && <span>Updated {updated.split(" ")[1] || updated}</span>}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {key === "checkouts" && rows.map((row: any[], ri: number) => {
                            const m = (label: string) => {
                              const i = table.headers.indexOf(label);
                              return i >= 0 ? row[i] || "" : "";
                            };
                            const title = m("Title")?.replace(/\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+.*/, "") || "Untitled";
                            const author = m("Author");
                            const callNumber = m("Call number")?.replace(/^Call number:\s*/i, "");
                            const itemType = m("Item type")?.replace(/^Item type:\s*/i, "");
                            const date = m("Date");
                            const checkin = date?.includes("Check-in") ? date.replace(/^Check-in date:\s*/i, "") : date;
                            return (
                              <div key={ri} className="group p-4 rounded-xl bg-white dark:bg-gray-800  border border-white/40  dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                                <div className="flex gap-4">
                                  <div className="shrink-0 w-10 h-14 rounded-lg bg-gradient-to-br from-blue-400/30 to-indigo-500/30   dark:from-blue-500/20 dark:to-indigo-600/20 flex items-center justify-center text-blue-600/50  dark:text-blue-400/50">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                                  </div>
                                  <div className="min-w-0 flex-1 space-y-1.5">
                                    <h5 className="text-sm font-bold text-gray-900  dark:text-gray-100 leading-snug line-clamp-2">{title}</h5>
                                    {author && <p className="text-xs text-gray-500  dark:text-gray-400 italic">by {author}</p>}
                                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400  dark:text-gray-500">
                                      {callNumber && <span className="font-mono">{callNumber}</span>}
                                      {itemType && <span>{itemType}</span>}
                                    </div>
                                    {checkin && (
                                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400  dark:text-gray-500">
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                        Returned {checkin}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {key === "history" && rows.map((row: any[], ri: number) => {
                            const m = (label: string) => {
                              const i = table.headers.indexOf(label);
                              return i >= 0 ? row[i] || "" : "";
                            };
                            const query = m("Search")?.replace(/kw,wrdl:\s*/i, "")?.replace(/,$/, "") || "";
                            const results = m("Results");
                            const date = m("Date");
                            return (
                              <div key={ri} className="group p-4 rounded-xl bg-white dark:bg-gray-800  border border-white/40  dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                                <div className="flex items-start gap-3">
                                  <div className="shrink-0 w-9 h-9 rounded-lg bg-purple-100  dark:bg-purple-500/20 flex items-center justify-center">
                                    <svg className="w-4 h-4 text-purple-600  dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                  </div>
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <p className="text-sm font-semibold text-gray-900  dark:text-gray-100 truncate">{query || "Unknown search"}</p>
                                    <div className="flex items-center gap-2.5 text-[11px] text-gray-400  dark:text-gray-500">
                                      {date && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{date}</span>}
                                      {results && (
                                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                          parseInt(results) > 100 ? "bg-amber-100 text-amber-700   dark:bg-amber-500/20 dark:text-amber-300"
                                          : parseInt(results) > 0 ? "bg-blue-100 text-blue-700   dark:bg-blue-500/20 dark:text-blue-300"
                                          : "bg-gray-100 text-gray-600   dark:bg-gray-800 dark:text-gray-400"
                                        }`}>
                                          {results} result{results !== "1" ? "s" : ""}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                    {(!page.tables?.length && !page.alerts?.length) && (
                      <div className="flex flex-col items-center py-8 text-gray-400  dark:text-gray-500">
                        <span className="text-2xl mb-2">📭</span>
                        <p className="text-sm font-medium">No data available</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </SubpageLayout>
  );
}

function KohaPatronCards({ refreshKey, isDemo }: { refreshKey: number; isDemo?: boolean }) {
  const [pages, setPages] = useState<any>(null);

  useEffect(() => {
    if (isDemo) {
      setPages({
        charges: {
          title: "Account Charges",
          tables: [
            {
              headers: ["Type", "Description", "Amount", "Amount outstanding", "Created", "Updated"],
              rows: [
                ["Fine", "Overdue Fine: Code Complete Book", "10.00", "0.00", "2026-06-15", "2026-06-20"]
              ]
            }
          ]
        },
        checkouts: {
          title: "Current Checkouts",
          tables: [
            {
              headers: ["Title", "Due", "Barcode", "Call number", "Renew"],
              rows: [
                ["Clean Code", "2026-07-10", "BC-90184", "005.1 MAR", "Renewable"]
              ]
            }
          ]
        }
      });
      return;
    }
    const raw = localStorage.getItem("koha_patron_pages");
    if (raw) {
      try { setPages(JSON.parse(raw)); } catch { setPages(null); }
    } else {
      setPages(null);
    }
  }, [refreshKey, isDemo]);

  if (!pages) return null;

  return (
    <>
      {Object.entries(PATRON_SECTIONS).map(([key, section]) => {
        const page = pages?.[key];
        if (!page) return null;
        const rowCount = page.tables?.reduce((s: number, t: any) => s + (t.rows?.length || 0), 0) ?? 0;
        return (
          <div key={key} className="overflow-hidden rounded-2xl bg-white dark:bg-gray-800  border border-white/40  dark:border-white/10 shadow-sm">
            <div className={`px-5 py-3.5 flex items-center gap-3 border-b ${
              section.color === "pink"
                ? "bg-pink-500/10  dark:bg-pink-500/20 border-pink-500/20  dark:border-pink-500/30 text-pink-700  dark:text-pink-300"
                : section.color === "blue"
                ? "bg-blue-500/10  dark:bg-blue-500/20 border-blue-500/20  dark:border-blue-500/30 text-blue-700  dark:text-blue-300"
                : "bg-purple-500/10  dark:bg-purple-500/20 border-purple-500/20  dark:border-purple-500/30 text-purple-700  dark:text-purple-300"
            }`}>
              <span className="text-lg">{section.icon}</span>
              <h4 className="text-sm font-bold">{page.title || section.label}</h4>
              {rowCount > 0 && (
                <span className={`ml-auto text-xs rounded-full px-2.5 py-0.5 ${
                  section.color === "pink"
                    ? "bg-pink-500/20 text-pink-600  dark:text-pink-300"
                    : section.color === "blue"
                    ? "bg-blue-500/20 text-blue-600  dark:text-blue-300"
                    : "bg-purple-500/20 text-purple-600  dark:text-purple-300"
                }`}>{rowCount} item{rowCount !== 1 ? "s" : ""}</span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {page.tables?.map((table: any, ti: number) => {
                const rows = table.rows || [];
                if (rows.length === 0) return null;
                return (
                  <div key={ti} className="space-y-2.5">
                    {table.caption && (
                      <p className="text-xs font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider px-1">{table.caption}</p>
                    )}
                    {key === "charges" && rows.map((row: any[], ri: number) => {
                      const m = (label: string) => { const i = table.headers.indexOf(label); return i >= 0 ? row[i] || "" : ""; };
                      const type = m("Type");
                      const desc = m("Description");
                      const amount = m("Amount");
                      const outstanding = m("Amount outstanding");
                      const created = m("Created");
                      const updated = m("Updated");
                      const isFine = type?.toLowerCase().includes("fine");
                      const isPayment = type?.toLowerCase().includes("payment");
                      const paidOff = outstanding === "0.00";
                      return (
                        <div key={ri} className="relative group">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl transition-all group-hover:w-1.5 ${
                            isFine ? "bg-gradient-to-b from-rose-400 to-pink-500" : "bg-gradient-to-b from-emerald-400 to-teal-500"
                          }`} />
                          <div className="ml-3 p-4 rounded-xl bg-white dark:bg-gray-800  border border-white/40  dark:border-white/10 shadow-sm hover:shadow-md transition-all space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                    isFine ? "bg-rose-100 text-rose-700   dark:bg-rose-500/20 dark:text-rose-300"
                                    : isPayment ? "bg-emerald-100 text-emerald-700   dark:bg-emerald-500/20 dark:text-emerald-300"
                                    : "bg-gray-100 text-gray-600   dark:bg-gray-800 dark:text-gray-400"
                                  }`}>{type || "Charge"}</span>
                                  {paidOff && <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-green-100 text-green-700   dark:bg-green-500/20 dark:text-green-300">Paid</span>}
                                </div>
                              </div>
                              {amount && (
                                <div className="text-right shrink-0">
                                  <span className={`text-lg font-bold ${isFine && !paidOff ? "text-rose-600  dark:text-rose-400" : "text-emerald-600  dark:text-emerald-400"}`}>₹{parseFloat(amount).toFixed(2)}</span>
                                  {outstanding && outstanding !== "0.00" && <p className="text-[10px] text-rose-500  dark:text-rose-400">₹{parseFloat(outstanding).toFixed(2)} outstanding</p>}
                                </div>
                              )}
                            </div>
                            {desc && <p className="text-sm font-medium text-gray-800  dark:text-gray-200 leading-snug">{desc}</p>}
                            <div className="flex items-center gap-3 text-[11px] text-gray-400  dark:text-gray-500">
                              {created && <span>🕐 {created}</span>}
                              {updated && updated !== created && <span>Updated {updated.split(" ")[1] || updated}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {key === "checkouts" && rows.map((row: any[], ri: number) => {
                      const m = (label: string) => { const i = table.headers.indexOf(label); return i >= 0 ? row[i] || "" : ""; };
                      const title = m("Title")?.replace(/\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+.*/, "") || "Untitled";
                      const author = m("Author");
                      const callNumber = m("Call number")?.replace(/^Call number:\s*/i, "");
                      const itemType = m("Item type")?.replace(/^Item type:\s*/i, "");
                      const date = m("Date");
                      const checkin = date?.includes("Check-in") ? date.replace(/^Check-in date:\s*/i, "") : date;
                      return (
                        <div key={ri} className="group p-4 rounded-xl bg-white dark:bg-gray-800  border border-white/40  dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                          <div className="flex gap-4">
                            <div className="shrink-0 w-10 h-14 rounded-lg bg-gradient-to-br from-blue-400/30 to-indigo-500/30   dark:from-blue-500/20 dark:to-indigo-600/20 flex items-center justify-center text-blue-600/50  dark:text-blue-400/50">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <h5 className="text-sm font-bold text-gray-900  dark:text-gray-100 leading-snug line-clamp-2">{title}</h5>
                              {author && <p className="text-xs text-gray-500  dark:text-gray-400 italic">by {author}</p>}
                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-400  dark:text-gray-500">
                                {callNumber && <span className="font-mono">{callNumber}</span>}
                                {itemType && <span>{itemType}</span>}
                              </div>
                              {checkin && (
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-400  dark:text-gray-500">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                                  Returned {checkin}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {key === "history" && rows.map((row: any[], ri: number) => {
                      const m = (label: string) => { const i = table.headers.indexOf(label); return i >= 0 ? row[i] || "" : ""; };
                      const query = m("Search")?.replace(/kw,wrdl:\s*/i, "")?.replace(/,$/, "") || "";
                      const results = m("Results");
                      const date = m("Date");
                      return (
                        <div key={ri} className="group p-4 rounded-xl bg-white dark:bg-gray-800  border border-white/40  dark:border-white/10 shadow-sm hover:shadow-md transition-all">
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 w-9 h-9 rounded-lg bg-purple-100  dark:bg-purple-500/20 flex items-center justify-center">
                              <svg className="w-4 h-4 text-purple-600  dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <p className="text-sm font-semibold text-gray-900  dark:text-gray-100 truncate">{query || "Unknown search"}</p>
                              <div className="flex items-center gap-2.5 text-[11px] text-gray-400  dark:text-gray-500">
                                {date && <span className="flex items-center gap-1"><svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>{date}</span>}
                                {results && (
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    parseInt(results) > 100 ? "bg-amber-100 text-amber-700   dark:bg-amber-500/20 dark:text-amber-300"
                                    : parseInt(results) > 0 ? "bg-blue-100 text-blue-700   dark:bg-blue-500/20 dark:text-blue-300"
                                    : "bg-gray-100 text-gray-600   dark:bg-gray-800 dark:text-gray-400"
                                  }`}>{results} result{results !== "1" ? "s" : ""}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {(!page.tables?.length && !page.alerts?.length) && (
                <div className="flex flex-col items-center py-8 text-gray-400  dark:text-gray-500">
                  <span className="text-2xl mb-2">📭</span>
                  <p className="text-sm font-medium">No data available</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}


export default function LibrariesTab({ loginToVTOP }: LibrariesTabProps) {
  const [creds, setCreds] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showPatron, setShowPatron] = useState(false);
  useEffect(() => { loginToVTOP().then(setCreds).catch(() => {}); }, []);
  if (!creds) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48 rounded-lg" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );

  const isDemo = creds?.authorizedID === "DEMO123";

  if (showPatron) {
    return <KohaPatronPage onBack={() => setShowPatron(false)} isDemo={isDemo} />;
  }

  return (
    <SubpageLayout
      title="Libraries"
      onBack={() => {}}
      action={
        <button onClick={() => { clearApiCache(); setRefreshKey(k => k + 1); }} className="p-2.5 rounded-full bg-blue-50  dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors" title="Reload all">
          <RefreshCcw className="w-5 h-5" />
        </button>
      }
    >
      <div className="space-y-8">
        <div>
          <h3 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-3 px-1">Book Search</h3>
          <BookSearch isDemo={isDemo} />
        </div>

        <button onClick={() => setShowPatron(true)}
          className="w-full flex items-center gap-4 p-4 solid-card hover:shadow-md hover:bg-white/80 dark:hover:bg-slate-900/70 transition-all text-left"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm shrink-0">
            <Library className="w-6 h-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900  dark:text-gray-100">Library Account</p>
            <p className="text-xs text-gray-400  dark:text-gray-500 mt-0.5">View charges, checkout history and search history</p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
        </button>

        <KohaPatronCards refreshKey={refreshKey} isDemo={isDemo} />

        <GenericApiView endpoint="library-due" title="Library Dues" creds={creds} refreshKey={refreshKey} />
        <div className="p-4 rounded-2xl bg-amber-50/80  dark:bg-amber-500/5 border border-amber-200/50  dark:border-amber-500/20 text-center">
          <span className="text-lg mb-1 block">🚧</span>
          <p className="text-xs font-medium text-amber-700  dark:text-amber-300">
            Library Keys, Library Scanning, and Book Recommendations will not be supported in the foreseeable future.
          </p>
        </div>
      </div>
    </SubpageLayout>
  );
}
