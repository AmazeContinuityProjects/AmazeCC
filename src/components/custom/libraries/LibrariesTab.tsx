"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Layers,
  Library,
  Loader2,
  LogOut,
  Receipt,
  RefreshCcw,
  Search,
  User,
} from "lucide-react";
import { api } from "@/lib/sync-engine";
import BackButton from "../shared/BackButton";
import CatalogSearch from "./CatalogSearch";
import DuesView from "./DuesView";
import { DEMO_PATRON_PAGES } from "@/lib/libraries/demo";
import {
  computeDuesTotals,
  hasPatronData,
  num,
  stripCheckinPrefix,
  stripKohaSuffix,
  stripSearchPrefix,
  type PatronPage,
  type PatronPages,
} from "@/lib/libraries/koha";
import {
  CHIP,
  EMPTY_STATE,
  FIELD_INPUT,
  ICON_BUTTON,
  LIST_ROW,
  LIST_SHELL,
  SECTION_CHIP,
  TILE,
  TONE_BADGE,
  TONE_ICON_TILE,
  TONE_TEXT,
} from "@/lib/libraries/ui";

interface Creds {
  cookies: string[];
  authorizedID: string;
  csrf: string;
}

interface LibrariesTabProps {
  loginToVTOP: () => Promise<Creds>;
  onBack?: () => void;
}

type Screen = "landing" | "catalog" | "account" | "dues";

interface SectionMeta {
  id: Exclude<Screen, "landing">;
  title: string;
  desc: string;
  icon: React.ElementType;
  tone: string;
}

const SECTIONS: SectionMeta[] = [
  {
    id: "catalog",
    title: "Catalog Search",
    desc: "Search the OPAC by keyword, title, author, subject or ISBN",
    icon: Search,
    tone: "sky",
  },
  {
    id: "account",
    title: "Library Account",
    desc: "Charges, checkout history and search history",
    icon: Library,
    tone: "emerald",
  },
  {
    id: "dues",
    title: "Library Dues",
    desc: "Overdue books and outstanding amounts from VTOP",
    icon: Receipt,
    tone: "amber",
  },
];

// ── shared bits ───────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  title,
  count,
  right,
}: {
  icon: React.ElementType;
  title: string;
  count?: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-1">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="w-4 h-4 text-indigo-500 shrink-0" />
        <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight truncate">
          {title}
        </h2>
        {typeof count === "number" && <span className={SECTION_CHIP}>{count}</span>}
      </div>
      {right}
    </div>
  );
}

function countRows(page?: PatronPage): number {
  return (page?.tables || []).reduce((s, t) => s + (t.rows?.length || 0), 0);
}

function cell(row: unknown[], headers: string[], label: string): string {
  const i = headers.indexOf(label);
  return i >= 0 ? String(row?.[i] ?? "") : "";
}

// ── patron sections (one implementation, used by the account subpage) ──
function PatronSections({ pages }: { pages: PatronPages }) {
  const sections: { key: string; label: string; icon: React.ElementType; tone: string }[] = [
    { key: "charges", label: "Charges & dues", icon: Receipt, tone: "red" },
    { key: "checkouts", label: "Checkout history", icon: BookOpen, tone: "sky" },
    { key: "history", label: "Search history", icon: Search, tone: "violet" },
  ];

  return (
    <div className="space-y-4">
      {sections.map((s) => {
        const page = pages?.[s.key];
        if (!page) return null;
        const rows = countRows(page);
        const Icon = s.icon;
        const isEmpty = (page.tables?.length || 0) === 0 && (page.alerts?.length || 0) === 0;

        return (
          <div key={s.key} className="space-y-2">
            <SectionHeader
              icon={Icon}
              title={page.title || s.label}
              count={rows}
              right={
                rows > 0 ? (
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${TONE_BADGE[s.tone]}`}>
                    {rows} item{rows === 1 ? "" : "s"}
                  </span>
                ) : undefined
              }
            />

            {(page.alerts || []).length > 0 && (
              <div className="space-y-1.5">
                {(page.alerts || []).map((a, i) => (
                  <p
                    key={i}
                    className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-start gap-2"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                    {a}
                  </p>
                ))}
              </div>
            )}

            {isEmpty ? (
              <div className={EMPTY_STATE}>
                <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                  Nothing in {s.label.toLowerCase()} yet
                </p>
              </div>
            ) : (
              (page.tables || [])
                .filter((t) => (t.rows?.length || 0) > 0)
                .map((table, ti) => {
                  const headers = table.headers || [];
                  return (
                    <div key={ti} className={LIST_SHELL}>
                      {table.caption && (
                        <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          {table.caption}
                        </p>
                      )}

                      {(table.rows || []).map((row, ri) => {
                        if (s.key === "charges") {
                          const type = cell(row, headers, "Type");
                          const desc = cell(row, headers, "Description");
                          const amount = cell(row, headers, "Amount");
                          const outstanding = cell(row, headers, "Amount outstanding");
                          const created = cell(row, headers, "Created");
                          const updated = cell(row, headers, "Updated");
                          const isFine = type.toLowerCase().includes("fine");
                          const paid = num(outstanding) === 0 && outstanding !== "";
                          return (
                            <div key={ri} className={LIST_ROW}>
                              <span
                                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  isFine ? "bg-red-500" : "bg-emerald-500"
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border ${
                                      isFine ? TONE_BADGE.red : TONE_BADGE.emerald
                                    }`}
                                  >
                                    {type || "Charge"}
                                  </span>
                                  {paid && (
                                    <span
                                      className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border ${TONE_BADGE.emerald}`}
                                    >
                                      Paid
                                    </span>
                                  )}
                                </div>
                                {desc && (
                                  <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-1 truncate">
                                    {desc}
                                  </p>
                                )}
                                {(created || updated) && (
                                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                                    {[created, updated !== created ? `updated ${updated}` : ""]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                {amount && (
                                  <p
                                    className={`text-sm font-black font-outfit leading-tight ${
                                      isFine && !paid
                                        ? TONE_TEXT.red
                                        : TONE_TEXT.emerald
                                    }`}
                                  >
                                    ₹{num(amount).toFixed(2)}
                                  </p>
                                )}
                                {!paid && outstanding && (
                                  <p className="text-[10px] font-bold text-red-500 dark:text-red-400">
                                    ₹{num(outstanding).toFixed(2)} due
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }

                        if (s.key === "checkouts") {
                          const title = stripKohaSuffix(cell(row, headers, "Title")) || "Untitled";
                          const author = cell(row, headers, "Author");
                          const callNumber = cell(row, headers, "Call number").replace(
                            /^Call number:\s*/i,
                            ""
                          );
                          const itemType = cell(row, headers, "Item type").replace(
                            /^Item type:\s*/i,
                            ""
                          );
                          const rawDate = cell(row, headers, "Date") || cell(row, headers, "Due");
                          const returned = rawDate.includes("Check-in")
                            ? stripCheckinPrefix(rawDate)
                            : "";
                          return (
                            <div key={ri} className={LIST_ROW}>
                              <span
                                className={`w-9 h-12 rounded-xl flex items-center justify-center shrink-0 ${TONE_ICON_TILE.sky}`}
                              >
                                <BookOpen className="w-4 h-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                                  {title}
                                </p>
                                {author && (
                                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                                    by {author}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  {callNumber && <span className={`${CHIP} font-mono`}>{callNumber}</span>}
                                  {itemType && <span className={CHIP}>{itemType}</span>}
                                  {returned && (
                                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500">
                                      Returned {returned}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        const query = stripSearchPrefix(cell(row, headers, "Search"));
                        const results = cell(row, headers, "Results");
                        const date = cell(row, headers, "Date");
                        const n = parseInt(results, 10);
                        return (
                          <div key={ri} className={LIST_ROW}>
                            <span
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TONE_ICON_TILE.violet}`}
                            >
                              <Search className="w-4 h-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                                {query || "Unknown search"}
                              </p>
                              {date && (
                                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                                  {date}
                                </p>
                              )}
                            </div>
                            {results && (
                              <span
                                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${
                                  n > 100 ? TONE_BADGE.amber : n > 0 ? TONE_BADGE.sky : TONE_BADGE.zinc
                                }`}
                              >
                                {results}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────
export default function LibrariesTab({ loginToVTOP, onBack }: LibrariesTabProps) {
  const [creds, setCreds] = useState<Creds | null>(null);
  const [screen, setScreen] = useState<Screen>("landing");
  const [refreshKey, setRefreshKey] = useState(0);

  // Catalog facts surfaced on the landing
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [catalogQuery, setCatalogQuery] = useState("");

  // Dues headline
  const [duesOutstanding, setDuesOutstanding] = useState(0);
  const [duesOverdue, setDuesOverdue] = useState(0);

  // Patron account
  const [patronPages, setPatronPages] = useState<PatronPages | null>(null);
  const [patronInfo, setPatronInfo] = useState<Record<string, string> | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [card, setCard] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    loginToVTOP()
      .then(setCreds)
      .catch(() => {});
  }, [loginToVTOP]);

  const isDemo = creds?.authorizedID === "DEMO123";

  // Cached patron snapshot so the landing has something to show before login
  useEffect(() => {
    if (isDemo) {
      setPatronPages(DEMO_PATRON_PAGES);
      return;
    }
    try {
      const raw = localStorage.getItem("koha_patron_pages");
      if (raw) setPatronPages(JSON.parse(raw));
      const savedCard = localStorage.getItem("koha_card");
      if (savedCard) setCard(savedCard);
      const savedPass = localStorage.getItem("koha_password");
      if (savedPass) setPassword(savedPass);
    } catch {}
  }, [isDemo]);

  const login = useCallback(async () => {
    if (!card.trim() || !password.trim()) return;
    setLoginBusy(true);
    setLoginError(null);
    try {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 300));
        setPatronPages(DEMO_PATRON_PAGES);
        setPatronInfo({
          name: "Demo Student",
          cardnumber: "22BCE1234",
          category: "Undergraduate",
          library: "Central Library",
        });
        setLoggedIn(true);
        return;
      }

      const res: any = await api("koha/patron", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { card: card.trim(), password },
      });

      if (res?.success === false) {
        setLoginError(res?.error || "Those credentials were not accepted");
        return;
      }

      const pages = res?.data?.pages || null;
      setPatronPages(pages);
      // Koha returns the name as `info.name`, not `patronName`
      setPatronInfo(res?.data?.info || null);
      setLoggedIn(true);
      try {
        localStorage.setItem("koha_patron_pages", JSON.stringify(pages || {}));
      } catch {}
    } catch (e: any) {
      setLoginError(e?.message || "Could not reach the library system");
    } finally {
      setLoginBusy(false);
    }
  }, [card, password, isDemo]);

  const logout = useCallback(() => {
    setLoggedIn(false);
    setPatronInfo(null);
    setPatronPages(null);
  }, []);

  // ── derived headline figures ───────────────────────────────────────
  const chargeTotals = useMemo(
    () => computeDuesTotals(patronPages?.charges),
    [patronPages]
  );
  const chargeCount = countRows(patronPages?.charges);
  const checkoutCount = countRows(patronPages?.checkouts);
  const historyCount = countRows(patronPages?.history);
  const accountConnected = hasPatronData(patronPages);

  const [slideIndex, setSlideIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  const slides = useMemo(() => {
    const list: {
      id: string;
      title: string;
      headline: string;
      subline: string;
      badge: string;
      tone: string;
      onClick: () => void;
    }[] = [];

    list.push({
      id: "account",
      title: "Library account",
      headline: accountConnected ? "Linked" : "Not linked",
      subline: accountConnected
        ? `${chargeCount} charges · ${checkoutCount} checkouts`
        : "Sign in to sync charges and history",
      badge: accountConnected ? "Synced" : "Sign in",
      tone: accountConnected ? "emerald" : "zinc",
      onClick: () => setScreen("account"),
    });

    if (chargeCount > 0) {
      list.push({
        id: "charges",
        title: "Outstanding",
        headline: `₹${chargeTotals.outstanding.toLocaleString("en-IN")}`,
        subline:
          chargeTotals.outstanding > 0
            ? `${chargeTotals.chargeCount - chargeTotals.paidCount} unpaid of ${chargeTotals.chargeCount}`
            : "all charges settled",
        badge: "Charges",
        tone: chargeTotals.outstanding > 0 ? "red" : "emerald",
        onClick: () => setScreen("account"),
      });
    }

    if (checkoutCount > 0) {
      list.push({
        id: "checkouts",
        title: "Checkouts",
        headline: String(checkoutCount),
        subline: "books currently with you",
        badge: "Out",
        tone: "sky",
        onClick: () => setScreen("account"),
      });
    }

    if (historyCount > 0) {
      list.push({
        id: "history",
        title: "Searches",
        headline: String(historyCount),
        subline: "catalog searches logged",
        badge: "History",
        tone: "violet",
        onClick: () => setScreen("account"),
      });
    }

    if (catalogTotal > 0) {
      list.push({
        id: "catalog",
        title: "Last search",
        headline: String(catalogTotal),
        subline: catalogQuery ? `results for “${catalogQuery}”` : "catalog results",
        badge: "OPAC",
        tone: "sky",
        onClick: () => setScreen("catalog"),
      });
    }

    return list;
  }, [
    accountConnected,
    chargeCount,
    chargeTotals,
    checkoutCount,
    historyCount,
    catalogTotal,
    catalogQuery,
  ]);

  useEffect(() => {
    setSlideIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (isCarouselPaused || slides.length <= 1) return;
    const t = setInterval(() => setSlideIndex((p) => (p + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [isCarouselPaused, slides.length]);

  const slide = slides[slideIndex] || slides[0];
  const slideTone = slide?.tone || "indigo";
  const duesTone = duesOverdue > 0 ? "red" : "amber";

  const onCatalogSearched = useCallback((total: number, query: string) => {
    setCatalogTotal(total);
    setCatalogQuery(query);
  }, []);

  const onDuesTotals = useCallback((outstanding: number, overdue: number) => {
    setDuesOutstanding(outstanding);
    setDuesOverdue(overdue);
  }, []);

  const reload = useCallback(() => {
    setRefreshKey((k) => k + 1);
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("cache_") || k.startsWith("uni_cc_generic_"))) keys.push(k);
      }
      for (const k of keys) {
        try {
          localStorage.removeItem(k);
        } catch {}
      }
    } catch {}
  }, []);

  const sectionCount = (id: Exclude<Screen, "landing">): number => {
    if (id === "catalog") return catalogTotal;
    if (id === "account") return chargeCount + checkoutCount + historyCount;
    return duesOverdue;
  };

  const sectionSuffix = (id: Exclude<Screen, "landing">): string => {
    if (id === "catalog") return "results";
    if (id === "account") return "items";
    return "overdue";
  };

  // ── chrome ─────────────────────────────────────────────────────────
  const TopBar = () => (
    <>
      <div className="flex items-start justify-between gap-3 mb-4">
        <BackButton
          onClick={() => (screen === "landing" ? onBack?.() : setScreen("landing"))}
          className="self-start"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reload}
            aria-label="Reload library data"
            title="Reload library data"
            className={ICON_BUTTON}
          >
            <RefreshCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="px-1">
        <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 leading-none mb-1">
          Campus
        </p>
        <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit truncate">
          Libraries
        </h1>
      </div>
    </>
  );

  // ── landing ────────────────────────────────────────────────────────
  const landing = (
    <>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 px-1">
        {/* Dues */}
        <button
          type="button"
          onClick={() => setScreen("dues")}
          className={`${TILE} h-32 sm:h-36 transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
              Dues
            </span>
            <span
              className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 border ${TONE_BADGE[duesTone]}`}
            >
              {duesOverdue > 0 ? `${duesOverdue} late` : "Clear"}
            </span>
          </div>
          <div className="my-auto min-w-0">
            <span
              className={`text-3xl sm:text-4xl font-black font-outfit tracking-tight leading-none block truncate ${
                duesOverdue > 0 ? TONE_TEXT.red : TONE_TEXT.emerald
              }`}
            >
              ₹{duesOutstanding.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
              outstanding
            </p>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          </div>
        </button>

        {/* Carousel */}
        {slide && (
          <div
            onMouseEnter={() => setIsCarouselPaused(true)}
            onMouseLeave={() => setIsCarouselPaused(false)}
            onTouchStart={() => setIsCarouselPaused(true)}
            onTouchEnd={() => setIsCarouselPaused(false)}
            onClick={() => slide.onClick()}
            className={`${TILE} h-32 sm:h-36 transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
                {slide.title}
              </span>
              <span
                className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${TONE_BADGE[slideTone]}`}
              >
                {slide.badge}
              </span>
            </div>
            <AnimatePresence mode="wait">
              <m.div
                key={slide.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="my-auto min-w-0"
              >
                <span
                  className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight leading-tight truncate block ${TONE_TEXT[slideTone]}`}
                >
                  {slide.headline}
                </span>
              </m.div>
            </AnimatePresence>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
                {slide.subline}
              </p>
              {slides.length > 1 && (
                <div className="flex items-center gap-1 shrink-0">
                  {slides.map((s, i) => (
                    <span
                      key={s.id}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        slideIndex === i ? "w-3 bg-indigo-500" : "w-1.5 bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
              Sections
            </h2>
            <span className={SECTION_CHIP}>{SECTIONS.length}</span>
          </div>
        </div>
        <div className={LIST_SHELL}>
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const count = sectionCount(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setScreen(s.id)}
                className={`${LIST_ROW} cursor-pointer`}
              >
                <span
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${TONE_ICON_TILE[s.tone]}`}
                >
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                    {s.title}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                    {s.desc}
                  </p>
                </div>
                {count > 0 && (
                  <span className={`${CHIP} shrink-0`}>
                    {count} {sectionSuffix(s.id)}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>

      <p className="px-1 -mt-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500 font-medium">
        Library keys, scanning and book recommendations are not supported.
      </p>
    </>
  );

  // ── subpages ───────────────────────────────────────────────────────
  const accountSubpage = loggedIn || accountConnected ? (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${TONE_ICON_TILE.emerald}`}
          >
            <User className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">
              {patronInfo?.name || "Library account"}
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium truncate">
              {patronInfo?.cardnumber || card || "Koha patron record"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors cursor-pointer shrink-0`}
        >
          <LogOut className="w-3.5 h-3.5" />
          Log out
        </button>
      </div>

      {patronPages ? (
        <PatronSections pages={patronPages} />
      ) : (
        <div className={EMPTY_STATE}>
          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
            Nothing cached yet — log in to load your record.
          </p>
        </div>
      )}
    </div>
  ) : (
    <div className="space-y-3">
      <SectionHeader icon={Library} title="Sign in to Koha" />
      <div className={`${TILE} space-y-3`}>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          Use your library card and password. Save them on the Profile page to skip this
          next time.
        </p>
        {loginError && (
          <p className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-xs font-bold">
            {loginError}
          </p>
        )}
        {loginBusy ? (
          <p className="flex items-center gap-2 text-xs font-bold text-zinc-500 dark:text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Signing in…
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login();
            }}
            className="space-y-2"
          >
            <input
              type="text"
              value={card}
              onChange={(e) => setCard(e.target.value)}
              placeholder="Card number"
              aria-label="Library card number"
              className={FIELD_INPUT}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Library account password"
              className={FIELD_INPUT}
            />
            <button
              type="submit"
              disabled={!card.trim() || !password.trim()}
              className="w-full px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black transition-colors cursor-pointer"
            >
              Log in
            </button>
          </form>
        )}
      </div>
    </div>
  );

  const subpage =
    screen === "catalog" ? (
      <div className="space-y-3">
        <SectionHeader
          icon={Search}
          title="Catalog search"
          count={catalogTotal || undefined}
          right={
            catalogQuery ? (
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 truncate max-w-[40%]">
                “{catalogQuery}”
              </span>
            ) : undefined
          }
        />
        <CatalogSearch
          variant="page"
          isDemo={isDemo}
          onSearched={onCatalogSearched}
        />
      </div>
    ) : screen === "account" ? (
      accountSubpage
    ) : (
      <div className="space-y-3">
        <SectionHeader
          icon={Receipt}
          title="Library dues"
          right={
            duesOverdue > 0 ? (
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${TONE_BADGE.red}`}
              >
                {duesOverdue} overdue
              </span>
            ) : (
              <span
                className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border ${TONE_BADGE.emerald}`}
              >
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                Clear
              </span>
            )
          }
        />
        <DuesView
          creds={creds}
          isDemo={isDemo}
          refreshKey={refreshKey}
          onTotals={onDuesTotals}
        />
      </div>
    );

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 pb-28 md:pb-8 animate-in fade-in duration-300 text-left select-none">
      <TopBar />
      {screen === "landing" ? landing : subpage}
    </div>
  );
}
