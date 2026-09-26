"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { AnimatePresence, m } from "framer-motion";
import { api } from "@/lib/sync-engine";
import {
  Wallet,
  Receipt,
  RefreshCcw,
  XCircle,
  Ban,
  ShieldCheck,
  Building,
  ExternalLink,
  FileText,
  ChevronRight,
} from "lucide-react";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import BackButton from "./shared/BackButton";
import BottomSheet from "./shared/BottomSheet";
import {
  PAYMENTS_KEYS,
  safeNum,
  fmtAmt,
  latestBalance,
  isDebitEntry,
  latestTransaction,
  receiptDetailKey,
  duesTone,
} from "@/lib/payments";
import type {
  PaymentLedgerEntry,
  PaymentReceipt,
  PaymentReceiptsData,
  PaymentReceiptTable,
  PaymentsDuesData,
  PaymentWalletData,
} from "@/types/payments";

const SUB_TABS = ["dues", "receipts", "wallet"] as const;
type SubTab = (typeof SUB_TABS)[number];

const ENDPOINT: Record<SubTab, string> = {
  dues: "payments",
  receipts: "payment-receipts",
  wallet: "wallet",
};

/** Fixtures used when VTOP hands back the demo authorised ID. */
const DEMO_FIXTURES: Record<SubTab, unknown> = {
  dues: {
    studentInfo: {
      registerNumber: "22BCE1234",
      studentName: "Demo Student",
      programme: "B.Tech Computer Science & Engineering",
      campus: "Vellore Institute of Technology, Chennai",
    },
    hasDues: false,
    message:
      "No pending tuition fees or hostel dues are registered for your account.",
  },
  receipts: {
    receipts: [
      {
        receiptNumber: "FEE-2026-90210",
        date: "2026-05-15",
        campusCode: "VITC",
        amount: "198000",
      },
      {
        receiptNumber: "HSTL-2026-10492",
        date: "2026-06-02",
        campusCode: "VITC",
        amount: "145000",
      },
    ],
  },
  wallet: {
    ledgerINR: [
      {
        amount: "5000",
        refundAmount: "0",
        transactionType: "CR",
        refundDate: null,
        particulars: "Security Deposit Refund",
        transactionDate: "2026-06-01",
        bookBalanceAmount: "5000",
      },
    ],
    ledgerUSD: [],
  },
};

const TONE_TEXT: Record<string, string> = {
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  blue: "text-blue-600 dark:text-blue-400",
  zinc: "text-zinc-400 dark:text-zinc-500",
};

const TONE_BADGE: Record<string, string> = {
  red: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  indigo:
    "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-200/50 dark:border-indigo-800/40",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  zinc: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20",
};

// Hero cards use the OD-hours sizing (a touch shorter than the course page)
const CARD_BASE =
  "p-4 sm:p-5 rounded-[24px] bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl border border-zinc-200/70 dark:border-zinc-800/80 shadow-xs flex flex-col justify-between min-h-32 sm:min-h-36 text-left relative overflow-hidden";

/** One divided container for every row, like the attendance log / OD history. */
const LIST_SHELL =
  "overflow-hidden rounded-2xl border border-zinc-200/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/70 backdrop-blur-xl shadow-xs divide-y divide-zinc-200/60 dark:divide-zinc-800/60";

const LIST_ROW =
  "w-full flex items-center justify-between gap-3 py-3 px-4 text-left";

const SECTION_CHIP =
  "text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-200/60 dark:border-zinc-700/60";

function readStored<T>(key: string, legacyKey: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(key) || localStorage.getItem(legacyKey);
    return stored ? (JSON.parse(stored) as T) : null;
  } catch {
    return null;
  }
}

interface PaymentsTabProps {
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
  onBack?: () => void;
}

/** The two record sets behind the single ledger list. */
type ListMode = "wallet" | "receipts";

export default function PaymentsTab({ loginToVTOP, onBack }: PaymentsTabProps) {
  const [duesData, setDuesData] = useState<PaymentsDuesData | null>(() =>
    readStored<PaymentsDuesData>(PAYMENTS_KEYS.dues, "payments")
  );
  const [receiptsData, setReceiptsData] = useState<PaymentReceiptsData | null>(() =>
    readStored<PaymentReceiptsData>(PAYMENTS_KEYS.receipts, "payment-receipts")
  );
  const [walletData, setWalletData] = useState<PaymentWalletData | null>(() =>
    readStored<PaymentWalletData>(PAYMENTS_KEYS.wallet, "wallet")
  );

  const [loading, setLoading] = useState<Record<SubTab, boolean>>({
    dues: false,
    receipts: false,
    wallet: false,
  });
  const [error, setError] = useState<Record<SubTab, string | null>>({
    dues: null,
    receipts: null,
    wallet: null,
  });

  // Per-receipt detail cache so reopening a sheet never refetches
  const [receiptDetails, setReceiptDetails] = useState<
    Record<string, PaymentReceiptTable[]>
  >({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [openReceipt, setOpenReceipt] = useState<PaymentReceipt | null>(null);

  // One segmented control drives the single ledger list (attendance-log style)
  const [listMode, setListMode] = useState<ListMode>("wallet");

  // Carousel state for the rotating stat card
  const [slideIndex, setSlideIndex] = useState(0);
  const [isCarouselPaused, setIsCarouselPaused] = useState(false);

  // Collapse concurrent logins into one. `loginVtop` only caches credentials
  // *after* a successful login, so parallel section loads would otherwise fire
  // several real VTOP logins (captcha solving, account-lockout backoff).
  const credsRef = useRef<ReturnType<PaymentsTabProps["loginToVTOP"]> | null>(null);
  const getCreds = useCallback(() => {
    if (!credsRef.current) {
      credsRef.current = loginToVTOP().finally(() => {
        credsRef.current = null;
      });
    }
    return credsRef.current;
  }, [loginToVTOP]);

  /** One network round-trip; returns the payload (or null on failure). */
  const requestPayments = useCallback(
    async (tab: SubTab, extra?: Record<string, string>): Promise<unknown | null> => {
      try {
        const { cookies, authorizedID, csrf } = await getCreds();

        if (authorizedID === "DEMO123") {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return DEMO_FIXTURES[tab];
        }

        const body: Record<string, unknown> = { cookies, authorizedID, csrf };
        if (extra) Object.assign(body, extra);

        return await api(ENDPOINT[tab], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch (err: any) {
        setError((prev) => ({ ...prev, [tab]: err?.message || "Fetch failed" }));
        return null;
      }
    },
    [getCreds]
  );

  /** Fetch a section, persist it, and mirror it into state. */
  const loadSection = useCallback(
    async (tab: SubTab) => {
      setLoading((prev) => ({ ...prev, [tab]: true }));
      setError((prev) => ({ ...prev, [tab]: null }));
      try {
        const data = await requestPayments(tab);
        if (data) {
          try {
            localStorage.setItem(PAYMENTS_KEYS[tab], JSON.stringify(data));
          } catch {}
          if (tab === "dues") setDuesData(data as PaymentsDuesData);
          else if (tab === "receipts") setReceiptsData(data as PaymentReceiptsData);
          else setWalletData(data as PaymentWalletData);
        }
      } finally {
        setLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [requestPayments]
  );

  // Sequential on purpose: the three endpoints are cheap, and serialising keeps
  // VTOP from seeing a burst of concurrent requests.
  const loadSections = useCallback(
    async (tabs: SubTab[]) => {
      for (const tab of tabs) {
        await loadSection(tab);
      }
    },
    [loadSection]
  );

  // The page shows every section at once, so warm whatever is missing
  const hasSection = useMemo(
    () => ({ dues: Boolean(duesData), receipts: Boolean(receiptsData), wallet: Boolean(walletData) }),
    [duesData, receiptsData, walletData]
  );
  const missingOnMount = useMemo(
    () => SUB_TABS.filter((tab) => !hasSection[tab]) as SubTab[],
    [hasSection]
  );
  useEffect(() => {
    if (missingOnMount.length > 0) void loadSections(missingOnMount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = useCallback(() => {
    void loadSections([...SUB_TABS]);
  }, [loadSections]);

  const anyLoading = loading.dues || loading.receipts || loading.wallet;

  // ── Derived data ────────────────────────────────────────────────────────
  const hasPendingDues = duesData?.hasDues === true;
  const duesToneKey = duesTone(duesData?.hasDues);

  const receiptList = receiptsData?.receipts || [];
  const ledgerINR = walletData?.ledgerINR;
  const ledgerUSD = walletData?.ledgerUSD;
  const balanceINR = latestBalance(ledgerINR);
  const balanceUSD = latestBalance(ledgerUSD);
  const lastTxn = useMemo(() => latestTransaction(walletData), [walletData]);

  // ── Rotating carousel slides (wallet balances + receipts) ───────────────
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

    if (balanceINR) {
      list.push({
        id: "inr",
        title: "Wallet",
        headline: fmtAmt(balanceINR, "₹"),
        subline: "Available INR balance",
        badge: "INR",
        tone: "emerald",
        onClick: () => setListMode("wallet"),
      });
    }
    if (balanceUSD) {
      list.push({
        id: "usd",
        title: "Wallet",
        headline: fmtAmt(balanceUSD, "$"),
        subline: "Available USD balance",
        badge: "USD",
        tone: "blue",
        onClick: () => setListMode("wallet"),
      });
    }
    if (lastTxn) {
      const debit = isDebitEntry(lastTxn.entry);
      list.push({
        id: "txn",
        title: "Last transaction",
        headline: `${debit ? "−" : "+"}${fmtAmt(
          String(Math.abs(safeNum(lastTxn.entry.amount))),
          lastTxn.symbol
        )}`,
        subline:
          lastTxn.entry.particulars ||
          lastTxn.entry.transactionDate ||
          (debit ? "Debit" : "Credit"),
        badge: debit ? "Debit" : "Credit",
        tone: debit ? "red" : "emerald",
        onClick: () => setListMode("wallet"),
      });
    }
    list.push({
      id: "receipts",
      title: "Receipts",
      headline: String(receiptList.length),
      subline:
        receiptList.length === 1
          ? "1 fee receipt logged"
          : `${receiptList.length} fee receipts logged`,
      badge: "Receipts",
      tone: "indigo",
      onClick: () => setListMode("receipts"),
    });

    return list;
  }, [balanceINR, balanceUSD, lastTxn, receiptList.length]);

  useEffect(() => {
    setSlideIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (isCarouselPaused || slides.length <= 1) return;
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isCarouselPaused, slides.length]);

  const slide = slides[slideIndex] || slides[0];

  // ── Receipt detail sheet ────────────────────────────────────────────────
  const openReceiptDetail = useCallback(
    (receipt: PaymentReceipt) => {
      setOpenReceipt(receipt);
      const key = receiptDetailKey(receipt);
      if (!key || receiptDetails[key] || detailLoading[key]) return;
      setDetailLoading((prev) => ({ ...prev, [key]: true }));
      void (async () => {
        const data = (await requestPayments("receipts", { applNo: key })) as
          | PaymentReceiptsData
          | null;
        if (data?.tables) {
          setReceiptDetails((prev) => ({ ...prev, [key]: data.tables || [] }));
        }
        setDetailLoading((prev) => ({ ...prev, [key]: false }));
      })();
    },
    [receiptDetails, detailLoading, requestPayments]
  );

  const detailKey = receiptDetailKey(openReceipt);
  const openTables = detailKey ? receiptDetails[detailKey] : undefined;
  const openDetailLoading = detailKey ? Boolean(detailLoading[detailKey]) : false;

  // ── Small render helpers ────────────────────────────────────────────────
  const renderError = (message: string) => (
    <div className="p-5 rounded-[24px] bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 flex items-center gap-3">
      <XCircle className="w-5 h-5 shrink-0" />
      <p className="text-xs font-bold">{message}</p>
    </div>
  );

  const renderListSkeleton = (rows: number) => (
    <div className={LIST_SHELL}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`${LIST_ROW} pointer-events-none`}>
          <Skeleton className="h-3 w-3 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-1/3 rounded" />
            <Skeleton className="h-2.5 w-1/4 rounded" />
          </div>
          <Skeleton className="h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );

  // One flat ledger list: INR rows then USD, each tagged with its symbol
  const walletRows = useMemo(() => {
    const rows: { entry: PaymentLedgerEntry; symbol: string; ledger: "INR" | "USD" }[] = [];
    for (const entry of walletData?.ledgerINR || []) {
      rows.push({ entry, symbol: "₹", ledger: "INR" });
    }
    for (const entry of walletData?.ledgerUSD || []) {
      rows.push({ entry, symbol: "$", ledger: "USD" });
    }
    return rows;
  }, [walletData]);

  const renderEmpty = (icon: React.ReactNode, title: string, description: string) => (
    <div className="p-10 rounded-[32px] bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200/60 dark:border-zinc-800/80 text-center space-y-4 shadow-2xs">
      <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
        {icon}
      </div>
      <div>
        <h3 className="font-black text-base text-zinc-900 dark:text-white font-outfit">{title}</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-sm mx-auto font-medium">
          {description}
        </p>
      </div>
    </div>
  );

  /* ───────────────────────────────────────────────────────────────────────
     RENDER
  ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 pt-3 sm:pt-5 pb-28 md:pb-8 animate-in fade-in duration-300 text-left select-none">
      {/* ── HEADER (OD-hours arrangement: back, eyebrow, title, subtitle) ── */}
      <div className="px-1">
        {onBack && (
          <div className="mb-5 flex">
            <BackButton onClick={onBack} className="self-start" />
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500 mb-1.5">
              Campus · Payments
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight leading-tight font-outfit">
              Payments &amp; Financials
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium mt-1">
              Dues, wallet ledger and official fee receipts
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={anyLoading}
            aria-label="Refresh payments from VTOP"
            title="Refresh payments from VTOP"
            className="p-2 rounded-full bg-white dark:bg-gray-900 shadow-sm border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-all duration-200 cursor-pointer disabled:opacity-50 shrink-0 mt-0.5"
          >
            <RefreshCcw className={`w-4 h-4 ${anyLoading ? "animate-spin text-indigo-500" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── HERO STATS: dues + rotating wallet/receipts carousel ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* CARD 1: DUES */}
        <div className={CARD_BASE}>
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
              Fee clearance
            </span>
            {/* Badge only when there is something to act on — the headline
                already states the status, so no second "all clear" chip. */}
            {loading.dues && !duesData ? (
              <span
                className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 border ${TONE_BADGE.zinc}`}
              >
                Syncing
              </span>
            ) : hasPendingDues ? (
              <span
                className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md shrink-0 border ${TONE_BADGE.red}`}
              >
                Action needed
              </span>
            ) : null}
          </div>

          {loading.dues && !duesData ? (
            <div className="my-auto py-2">
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          ) : error.dues && !duesData ? (
            <p className="my-auto py-1 text-xs font-bold text-red-600 dark:text-red-400 line-clamp-3">
              {error.dues}
            </p>
          ) : (
            <div className="my-auto py-1 flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${
                  hasPendingDues ? "bg-red-500" : "bg-emerald-500"
                }`}
              >
                {hasPendingDues ? (
                  <Ban className="w-4.5 h-4.5" />
                ) : (
                  <ShieldCheck className="w-4.5 h-4.5" />
                )}
              </div>
              <span
                className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight leading-tight truncate ${TONE_TEXT[duesToneKey]}`}
              >
                {hasPendingDues ? "Pending" : "All clear"}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-[10.5px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
              {hasPendingDues
                ? "Outstanding payments pending on VTOP"
                : duesData?.message || "No outstanding fee dues"}
            </p>
            {hasPendingDues && (
              <a
                href="https://vtop.vit.ac.in"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[10px] font-black shrink-0 transition-colors active:scale-[0.98]"
              >
                Pay
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* CARD 2: ROTATING CAROUSEL */}
        <div
          onMouseEnter={() => setIsCarouselPaused(true)}
          onMouseLeave={() => setIsCarouselPaused(false)}
          onTouchStart={() => setIsCarouselPaused(true)}
          onTouchEnd={() => setIsCarouselPaused(false)}
          onClick={() => slide.onClick()}
          className={`${CARD_BASE} transition-all hover:scale-[1.01] active:scale-[0.98] cursor-pointer`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-outfit truncate">
              {slide.title}
            </span>
            <span
              className={`text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md border shrink-0 ${TONE_BADGE[slide.tone]}`}
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
              className="my-auto py-1 min-w-0"
            >
              <span
                className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight leading-tight truncate block ${TONE_TEXT[slide.tone]}`}
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
                {slides.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSlideIndex(idx);
                    }}
                    aria-label={`Go to ${s.title}`}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      slideIndex === idx ? "w-3 bg-indigo-500" : "w-1.5 bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── LEDGER: one list, two sources (attendance-log composition) ── */}
      <div className="space-y-4">
        <div className="px-1">
          <div className="flex items-center gap-2">
            {listMode === "wallet" ? (
              <Wallet className="w-4 h-4 text-indigo-500" />
            ) : (
              <Receipt className="w-4 h-4 text-indigo-500" />
            )}
            <h2 className="text-sm font-black text-zinc-900 dark:text-white font-outfit tracking-tight">
              {listMode === "wallet" ? "Wallet" : "Receipts"}
            </h2>
            <span className={SECTION_CHIP}>
              {listMode === "wallet" ? walletRows.length : receiptList.length}
            </span>
          </div>

          <div className="flex items-center gap-1 mt-2.5 p-0.5 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
            {(
              [
                { id: "wallet", label: "Wallet" },
                { id: "receipts", label: "Receipts" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setListMode(tab.id)}
                className={`flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  listMode === tab.id
                    ? "bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {listMode === "wallet"
          ? loading.wallet && !walletData
            ? renderListSkeleton(3)
            : error.wallet && !walletData
            ? renderError(error.wallet)
            : walletRows.length === 0
            ? renderEmpty(
                <Wallet className="w-7 h-7" />,
                "No wallet activity",
                "Ledger credits, debits and security refunds appear here once your data syncs from VTOP."
              )
            : (
              <div className={LIST_SHELL}>
                {walletRows.map(({ entry, symbol, ledger }, idx) => {
                  const amt = safeNum(entry.amount);
                  const refundAmt = safeNum(entry.refundAmount);
                  const isDebit = isDebitEntry(entry);
                  const isRefunded = refundAmt > 0 || Boolean(entry.refundDate);

                  return (
                    <div key={`${ledger}-${idx}`} className={LIST_ROW}>
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isDebit ? "bg-rose-500" : "bg-emerald-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                            {entry.particulars ||
                              (isDebit ? "Debit transaction" : "Credit deposit")}
                          </p>
                          {isRefunded && (
                            <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md border shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                              Refund
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                          {[
                            entry.transactionDate,
                            entry.receiptNumber,
                            ledger === "USD" ? "USD" : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`font-black text-sm font-outfit leading-tight ${
                            isDebit
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {isDebit ? "−" : "+"}
                          {fmtAmt(String(Math.abs(amt)), symbol)}
                        </p>
                        {entry.bookBalanceAmount && (
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                            Bal {fmtAmt(entry.bookBalanceAmount, symbol)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          : loading.receipts && !receiptsData
          ? renderListSkeleton(3)
          : error.receipts && !receiptsData
          ? renderError(error.receipts)
          : receiptList.length === 0
          ? renderEmpty(
              <Receipt className="w-7 h-7" />,
              "No receipts yet",
              "Official semester payment receipts logged on your student account show up here."
            )
          : (
            <div className={LIST_SHELL}>
              {receiptList.map((r, i) => (
                <button
                  key={r.receiptNumber || i}
                  type="button"
                  onClick={() => openReceiptDetail(r)}
                  className={`${LIST_ROW} hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group`}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                      {r.receiptNumber}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mt-0.5 truncate">
                      {[r.date, r.campusCode].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right">
                      <p className="font-black text-sm font-outfit text-zinc-900 dark:text-white leading-tight">
                        {fmtAmt(r.amount)}
                      </p>
                      <p className="text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 mt-0.5">
                        Settled
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-all" />
                  </div>
                </button>
              ))}
            </div>
          )}
      </div>

      {/* ── RECEIPT DETAIL SHEET ── */}
      <AnimatePresence>
        {openReceipt && (
          <BottomSheet
            onClose={() => setOpenReceipt(null)}
            overlayId="receipt-detail"
            maxWidth="max-w-lg"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                  <Receipt className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-black font-outfit text-zinc-900 dark:text-white truncate">
                    {openReceipt.receiptNumber}
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">
                    Official fee receipt
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                    Amount
                  </span>
                  <span className="font-extrabold text-zinc-900 dark:text-white">
                    {fmtAmt(openReceipt.amount)}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                    Date
                  </span>
                  <span className="font-extrabold text-zinc-900 dark:text-white">
                    {openReceipt.date || "—"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                    Campus
                  </span>
                  <span className="font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-zinc-400" />
                    {openReceipt.campusCode || "—"}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                    Status
                  </span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    Settled
                  </span>
                </div>
              </div>

              {openDetailLoading && (
                <div className="space-y-2.5">
                  <Skeleton className="h-20 w-full rounded-2xl" />
                  <Skeleton className="h-20 w-full rounded-2xl" />
                </div>
              )}

              {!openDetailLoading && openTables?.length ? (
                <div className="space-y-4">
                  {openTables.map((table, idx) => (
                    <div key={idx} className="space-y-2.5">
                      {table.caption && (
                        <h4 className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          {table.caption}
                        </h4>
                      )}
                      {table.rows?.map((row, ri) => (
                        <div key={ri} className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                              <FileText className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-extrabold text-zinc-900 dark:text-white font-outfit">
                              Invoice particulars
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2.5 text-xs">
                            {table.headers?.map((header) => (
                              <div
                                key={header}
                                className="p-2.5 rounded-xl bg-white dark:bg-zinc-900/60 border border-zinc-200/50 dark:border-zinc-800"
                              >
                                <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-0.5">
                                  {header}
                                </span>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200 break-words">
                                  {row?.[header] || "—"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                !openDetailLoading && (
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium text-center py-2">
                    No invoice breakdown available for this receipt.
                  </p>
                )
              )}
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>
    </div>
  );
}
