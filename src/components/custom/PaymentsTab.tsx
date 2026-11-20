"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAtomValue } from "jotai";
import { AnimatePresence } from "framer-motion";
import { syncEngine } from "@/lib/sync-engine";
import { getTypedStorageItem, setTypedStorageItem, storage } from "@/lib/storage";
import { unifiedCampusServicesAtom } from "@/store";

const DEMO_FINANCE_ALL = {
  dues: {
    studentInfo: {
      registerNumber: "22BCE1234",
      studentName: "Demo Student",
      programme: "B.Tech Computer Science & Engineering",
      campus: "Vellore Institute of Technology, Chennai",
    },
    hasDues: false,
    message: "No pending tuition fees or hostel dues are registered for your account.",
  },
  receipts: {
    receipts: [
      { receiptNumber: "FEE-2026-90210", date: "2026-05-15", campusCode: "VITC", amount: "198000" },
      { receiptNumber: "HSTL-2026-10492", date: "2026-06-02", campusCode: "VITC", amount: "145000" },
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
  library: { books: [] },
  bank: {},
};

function applyFinanceAll(res: any) {
  const dues = res?.dues ?? null;
  const receipts = res?.receipts ?? null;
  const wallet = res?.wallet ?? null;
  const library = res?.library ?? null;
  const bank = res?.bank ?? null;
  try {
    if (dues) setTypedStorageItem("payments_dues", dues);
    if (receipts) setTypedStorageItem("payments_receipts", receipts);
    if (wallet) setTypedStorageItem("payments_wallet", wallet);
    if (library) storage.cache.set("library-due", { success: true, ...library });
    if (bank) storage.cache.set("bank-info", bank);
  } catch {}
  return {
    dues: dues as PaymentsDuesData | null,
    receipts: receipts as PaymentReceiptsData | null,
    wallet: wallet as PaymentWalletData | null,
  };
}
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
  Check,
  Copy,
} from "lucide-react";
import { Skeleton } from "@amazecontinuityprojects/amazeui";
import BottomSheet from "./shared/BottomSheet";
import { useCarouselAutoplayPolicy } from "./tasks/useCarouselAutoplayPolicy";
import {
  EmptyPanel,
  IconButton,
  InsightCarousel,
  KeyValue,
  ListRowText,
  ListSkeleton,
  PageShell,
  useCarousel,
  type InsightSlide,
} from "./shared/primitives";
import {
  BADGE_MD,
  BADGE_SM,
  FOCUS_RING,
  LIST_SHELL,
  MICRO_LABEL,
  SECTION_CHIP,
  SECTION_TITLE,
  STAT_GRID,
  TEXT_BLOCK,
  TEXT_CAPTION,
  TILE,
  TONE_BADGE as CANON_TONE_BADGE,
  TONE_TEXT as CANON_TONE_TEXT,
} from "@/lib/uiTokens";
import {
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

/* demo fixtures are provided via unified DEMO_FINANCE_ALL above */

// Five tones are byte-identical to the canonical maps; spread those and keep a
// deliberate local override for zinc (this page uses a fixed zinc step where the
// canonical map reads the semantic surface tokens). Do not "fix" the zinc entry.
const TONE_TEXT: Record<string, string> = {
  ...CANON_TONE_TEXT,
  zinc: "text-zinc-400 dark:text-zinc-500",
};

const TONE_BADGE: Record<string, string> = {
  ...CANON_TONE_BADGE,
  zinc: "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20",
};

// Hero cards use the OD-hours sizing (a touch shorter than the course page)
const CARD_BASE = `${TILE} min-h-32 sm:min-h-36`;

const LIST_ROW = "w-full flex items-center justify-between gap-3 py-3 px-4 text-left";

interface PaymentsTabProps {
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
  onBack?: () => void;
}

/** The two record sets behind the single ledger list. */
type ListMode = "wallet" | "receipts";

export default function PaymentsTab({ loginToVTOP, onBack }: PaymentsTabProps) {
  const campusServices = useAtomValue(unifiedCampusServicesAtom);

  const [duesData, setDuesData] = useState<PaymentsDuesData | null>(
    () =>
      getTypedStorageItem("payments_dues") ??
      getTypedStorageItem("cache_payments") ??
      campusServices.payments.dues ??
      null,
  );
  const [receiptsData, setReceiptsData] = useState<PaymentReceiptsData | null>(
    () =>
      getTypedStorageItem("payments_receipts") ??
      getTypedStorageItem("cache_payment-receipts") ??
      (campusServices.payments.receipts?.length ? { receipts: campusServices.payments.receipts } : null),
  );
  const [walletData, setWalletData] = useState<PaymentWalletData | null>(
    () =>
      getTypedStorageItem("payments_wallet") ??
      getTypedStorageItem("cache_wallet") ??
      campusServices.payments.wallet ??
      null,
  );

  const [loading, setLoading] = useState<Record<SubTab, boolean>>({
    dues: false,
    receipts: false,
    wallet: false,
  });
  /** When the fee state was last read, so "All clear" is not a stale claim. */
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  /** Confirming an external handoff instead of dropping the student on VTOP. */
  const [showPayHandoff, setShowPayHandoff] = useState(false);
  const [payCopied, setPayCopied] = useState(false);
  const [error, setError] = useState<Record<SubTab, string | null>>({
    dues: null,
    receipts: null,
    wallet: null,
  });

  // Per-receipt detail cache so reopening a sheet never refetches
  const [receiptDetails, setReceiptDetails] = useState<Record<string, PaymentReceiptTable[]>>({});
  const [detailLoading, setDetailLoading] = useState<Record<string, boolean>>({});
  const [openReceipt, setOpenReceipt] = useState<PaymentReceipt | null>(null);

  // One segmented control drives the single ledger list (attendance-log style)
  const [listMode, setListMode] = useState<ListMode>("wallet");

  // Carousel state for the rotating stat card

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

  /** Single call: fetch all finance data and distribute to legacy stores/UI state. */
  const fetchAllFinance = useCallback(async () => {
    setLoading({ dues: true, receipts: true, wallet: true });
    setError({ dues: null, receipts: null, wallet: null });
    try {
      const { authorizedID } = await getCreds();
      let res: any;
      if (
        authorizedID === "DEMO123" ||
        (typeof window !== "undefined" && localStorage.getItem("demoMode") === "true")
      ) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        res = DEMO_FINANCE_ALL;
      } else {
        res = await syncEngine.sync("finance", { section: "all" });
      }
      const { dues, receipts, wallet } = applyFinanceAll(res);
      if (dues) setDuesData(dues);
      if (receipts) setReceiptsData(receipts);
      if (wallet) setWalletData(wallet);
      setLastCheckedAt(new Date());
      if (res?.errors && typeof res.errors === "object") {
        const msg = (k: string) => (res.errors as Record<string, string>)[k] || null;
        setError({ dues: msg("dues"), receipts: msg("receipts"), wallet: msg("wallet") });
      }
      return res;
    } catch {
      // Raw transport errors are not student-facing copy.
      const msg = "Couldn't refresh your payment details. Check your connection and try again.";
      setError({ dues: msg, receipts: msg, wallet: msg });
      return null;
    } finally {
      setLoading({ dues: false, receipts: false, wallet: false });
    }
  }, [getCreds]);

  // One call on mount to load all finance data (instead of separate per-section calls).
  useEffect(() => {
    const missing = !duesData || !receiptsData || !walletData;
    if (missing) void fetchAllFinance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshAll = useCallback(() => {
    void fetchAllFinance();
  }, [fetchAllFinance]);

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
        headline: `${debit ? "−" : "+"}${fmtAmt(String(Math.abs(safeNum(lastTxn.entry.amount))), lastTxn.symbol)}`,
        subline: lastTxn.entry.particulars || lastTxn.entry.transactionDate || (debit ? "Debit" : "Credit"),
        badge: debit ? "Debit" : "Credit",
        tone: debit ? "red" : "emerald",
        onClick: () => setListMode("wallet"),
      });
    }
    list.push({
      id: "receipts",
      title: "Receipts",
      headline: String(receiptList.length),
      subline: receiptList.length === 1 ? "1 fee receipt logged" : `${receiptList.length} fee receipts logged`,
      badge: "Receipts",
      tone: "indigo",
      onClick: () => setListMode("receipts"),
    });

    return list;
  }, [balanceINR, balanceUSD, lastTxn, receiptList.length]);

  const autoplayMs = useCarouselAutoplayPolicy();
  const carousel = useCarousel(slides.length, autoplayMs);
  const insightSlides = useMemo<InsightSlide[]>(
    () =>
      slides.map((s) => ({
        id: s.id,
        label: s.title,
        value: s.headline,
        sub: s.subline,
        badge: s.badge,
        tone: s.tone,
        onClick: s.onClick,
      })),
    [slides],
  );

  // ── Receipt detail sheet ────────────────────────────────────────────────
  const openReceiptDetail = useCallback(
    (receipt: PaymentReceipt) => {
      setOpenReceipt(receipt);
      const key = receiptDetailKey(receipt);
      if (!key || receiptDetails[key] || detailLoading[key]) return;
      setDetailLoading((prev) => ({ ...prev, [key]: true }));
      void (async () => {
        try {
          await getCreds();
          const res = await syncEngine.sync<any>("finance", { section: "receipt", applNo: key });
          const tables = (res?.receiptDetail?.tables || res?.tables || []) as PaymentReceiptTable[];
          if (tables.length) {
            setReceiptDetails((prev) => ({ ...prev, [key]: tables }));
          }
        } finally {
          setDetailLoading((prev) => ({ ...prev, [key]: false }));
        }
      })();
    },
    [receiptDetails, detailLoading, getCreds],
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
    <ListSkeleton rows={rows} leading="dot" trailing titleWidth="w-1/3" subtitleWidth="w-1/4" />
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
    <EmptyPanel icon={icon} title={title} description={description} />
  );

  /* ───────────────────────────────────────────────────────────────────────
     RENDER
  ─────────────────────────────────────────────────────────────────────── */
  return (
    <PageShell
      syncedOps={["bulk"]}
      eyebrow="Campus · Payments"
      title="Payments & Financials"
      subtitle="Dues, wallet ledger and official fee receipts"
      onBack={onBack}
      actions={
        <IconButton
          onClick={refreshAll}
          title="Refresh payments from VTOP"
          className={`relative hit-expand ${FOCUS_RING}`}
          disabled={anyLoading}
        >
          <RefreshCcw className={`w-4 h-4 ${anyLoading ? "animate-spin text-indigo-500" : ""}`} />
        </IconButton>
      }
    >
      <div className={STAT_GRID}>
        {/* CARD 1: DUES */}
        <div className={CARD_BASE}>
          <div className="flex items-center justify-between gap-1">
            <span className={`${MICRO_LABEL} font-outfit truncate`}>Fee clearance</span>
            {/* Badge only when there is something to act on — the headline
                already states the status, so no second "all clear" chip. */}
            {loading.dues && !duesData ? (
              <span className={`${BADGE_MD} shrink-0 ${TONE_BADGE.zinc}`}>Syncing</span>
            ) : hasPendingDues ? (
              <span className={`${BADGE_MD} shrink-0 ${TONE_BADGE.red}`}>Action needed</span>
            ) : null}
          </div>

          {loading.dues && !duesData ? (
            <div className="my-auto py-2">
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          ) : error.dues && !duesData ? (
            <p className="my-auto py-1 text-xs font-bold text-red-600 dark:text-red-400 line-clamp-3">{error.dues}</p>
          ) : (
            <div className="my-auto py-1 flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${
                  hasPendingDues ? "bg-red-500" : "bg-emerald-500"
                }`}
              >
                {hasPendingDues ? <Ban className="w-4.5 h-4.5" /> : <ShieldCheck className="w-4.5 h-4.5" />}
              </div>
              <span
                className={`text-2xl sm:text-3xl font-black font-outfit tracking-tight leading-tight truncate ${TONE_TEXT[duesToneKey]}`}
              >
                {hasPendingDues ? "Pending" : "All clear"}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className={`${TEXT_CAPTION} font-medium truncate`}>
              {hasPendingDues
                ? "Outstanding payments pending on VTOP"
                : `${duesData?.message || "No outstanding fee dues"}${
                    lastCheckedAt
                      ? ` · checked ${lastCheckedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                      : ""
                  }`}
            </p>
            {hasPendingDues && (
              <button
                type="button"
                onClick={() => {
                  setPayCopied(false);
                  setShowPayHandoff(true);
                }}
                className={`relative hit-expand inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-black shrink-0 transition-colors active:scale-[0.98] ${FOCUS_RING}`}
              >
                Pay
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* CARD 2: ROTATING CAROUSEL */}
        <InsightCarousel slides={insightSlides} carousel={carousel} height="min-h-32 sm:min-h-36" interactiveDots />
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
            <h2 className={SECTION_TITLE}>{listMode === "wallet" ? "Wallet" : "Receipts"}</h2>
            <span className={SECTION_CHIP}>{listMode === "wallet" ? walletRows.length : receiptList.length}</span>
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
                className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
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

        {listMode === "wallet" ? (
          loading.wallet && !walletData ? (
            renderListSkeleton(3)
          ) : error.wallet && !walletData ? (
            renderError(error.wallet)
          ) : walletRows.length === 0 ? (
            renderEmpty(
              <Wallet className="w-7 h-7" />,
              "No wallet activity",
              "Ledger credits, debits and security refunds appear here once your data syncs from VTOP.",
            )
          ) : (
            <div className={LIST_SHELL}>
              {walletRows.map(({ entry, symbol, ledger }, idx) => {
                const amt = safeNum(entry.amount);
                const refundAmt = safeNum(entry.refundAmount);
                const isDebit = isDebitEntry(entry);
                const isRefunded = refundAmt > 0 || Boolean(entry.refundDate);

                return (
                  <div key={`${ledger}-${idx}`} className={LIST_ROW}>
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${isDebit ? "bg-rose-500" : "bg-emerald-500"}`}
                    />
                    <div className={TEXT_BLOCK}>
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-bold text-sm text-zinc-900 dark:text-white truncate font-outfit leading-tight">
                          {entry.particulars || (isDebit ? "Debit transaction" : "Credit deposit")}
                        </p>
                        {isRefunded && (
                          <span
                            className={`${BADGE_SM} border shrink-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20`}
                          >
                            Refund
                          </span>
                        )}
                      </div>
                      <p className={`tabular-nums ${TEXT_CAPTION} font-medium mt-0.5 truncate`}>
                        {[entry.transactionDate, entry.receiptNumber, ledger === "USD" ? "USD" : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        data-private
                        className={`tabular-nums font-black text-sm font-outfit leading-tight ${
                          isDebit ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {isDebit ? "−" : "+"}
                        {fmtAmt(String(Math.abs(amt)), symbol)}
                      </p>
                      {entry.bookBalanceAmount && (
                        <p data-private className="tabular-nums text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                          Bal {fmtAmt(entry.bookBalanceAmount, symbol)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : loading.receipts && !receiptsData ? (
          renderListSkeleton(3)
        ) : error.receipts && !receiptsData ? (
          renderError(error.receipts)
        ) : receiptList.length === 0 ? (
          renderEmpty(
            <Receipt className="w-7 h-7" />,
            "No receipts yet",
            "Official semester payment receipts logged on your student account show up here.",
          )
        ) : (
          <div className={LIST_SHELL}>
            {receiptList.map((r, i) => (
              <button
                key={r.receiptNumber || i}
                type="button"
                onClick={() => openReceiptDetail(r)}
                className={`${LIST_ROW} hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group`}
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-emerald-500" />
                <ListRowText title={r.receiptNumber} subtitle={[r.date, r.campusCode].filter(Boolean).join(" · ")} />

                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    <p
                      data-private
                      className="tabular-nums font-black text-sm font-outfit text-zinc-900 dark:text-white leading-tight"
                    >
                      {fmtAmt(r.amount)}
                    </p>
                    <p className="text-xs font-extrabold uppercase text-emerald-600 dark:text-emerald-400 mt-0.5">
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
            title={openReceipt.receiptNumber}
            subtitle="Official fee receipt"
            icon={<Receipt className="w-5 h-5" />}
            accent="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30"
            closeLabel="Close receipt"
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <KeyValue label="Amount" value={fmtAmt(openReceipt.amount)} />
                <KeyValue label="Date" value={openReceipt.date || "—"} />
                <KeyValue
                  label="Campus"
                  valueClassName="flex items-center gap-1.5"
                  value={
                    <>
                      <Building className="w-3.5 h-3.5 text-zinc-400" />
                      {openReceipt.campusCode || "—"}
                    </>
                  }
                />
                <KeyValue label="Status" valueClassName="text-emerald-600 dark:text-emerald-400" value="Settled" />
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
                        <h4 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                          {table.caption}
                        </h4>
                      )}
                      {table.rows?.map((row, ri) => (
                        <div
                          key={ri}
                          className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800 space-y-3"
                        >
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
                                <span className="text-xs font-bold text-zinc-400 uppercase block mb-0.5">{header}</span>
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
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium text-center py-2">
                    No invoice breakdown available for this receipt.
                  </p>
                )
              )}
            </div>
          </BottomSheet>
        )}
      </AnimatePresence>

      {/* ── External handoff: explain, carry identity, copy, return point ── */}
      {showPayHandoff && (
        <BottomSheet
          overlayId="payments-vtop-handoff"
          onClose={() => setShowPayHandoff(false)}
          title="Pay on VTOP"
          subtitle="AmazeCC shows dues; VTOP takes payment"
          maxWidth="max-w-md"
        >
          <div className="space-y-4 p-1 text-left" role="status">
            <p className={`${TEXT_CAPTION} font-medium`}>
              This opens VTOP&apos;s payments page in a new tab. Sign in there to see the exact amount and complete the
              payment — AmazeCC cannot charge you.
            </p>

            <div className="rounded-2xl border border-border-muted bg-surface-secondary p-4 space-y-2 text-xs">
              <p className={MICRO_LABEL}>Details to carry over</p>
              <div className="flex justify-between gap-3">
                <span className="text-text-muted">Register no.</span>
                <span className="font-bold text-text-primary tabular-nums text-right">
                  {duesData?.studentInfo?.registerNumber || "Not on file"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-text-muted">Student</span>
                <span className="font-bold text-text-primary text-right">
                  {duesData?.studentInfo?.studentName || "Not on file"}
                </span>
              </div>
              <p className="text-text-muted pt-1">Confirm the final amount on VTOP before paying.</p>
            </div>

            <a
              href="https://vtop.vit.ac.in"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-red-700 ${FOCUS_RING}`}
            >
              Open VTOP payments <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={async () => {
                const lines = [
                  "VTOP payments: https://vtop.vit.ac.in",
                  `Register no.: ${duesData?.studentInfo?.registerNumber || "Not on file"}`,
                  `Student: ${duesData?.studentInfo?.studentName || "Not on file"}`,
                  "Confirm the exact amount on VTOP before paying.",
                ];
                try {
                  await navigator.clipboard?.writeText(lines.join("\n"));
                  setPayCopied(true);
                } catch {
                  setPayCopied(false);
                }
              }}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-bold text-text-primary transition-colors hover:bg-surface-secondary ${FOCUS_RING}`}
            >
              {payCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {payCopied ? "Copied" : "Copy payment details"}
            </button>
            <button
              type="button"
              onClick={() => setShowPayHandoff(false)}
              className={`w-full text-center text-xs font-bold text-text-secondary hover:text-text-heading ${FOCUS_RING} rounded`}
            >
              Stay in AmazeCC
            </button>
          </div>
        </BottomSheet>
      )}
    </PageShell>
  );
}
