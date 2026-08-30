"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "@/lib/sync-engine";
import {
  Wallet,
  Receipt,
  AlertCircle,
  RefreshCcw,
  IndianRupee,
  DollarSign,
  FileText,
  Calendar,
  Hash,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Ban,
  ArrowLeft,
  Building,
  CreditCard,
  User,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Card, Skeleton, EmptyState, Badge, Button } from "@amazecontinuityprojects/amazeui";
import PageHeader from "./shared/PageHeader";

const SUB_TABS = ["dues", "receipts", "wallet"] as const;
type SubTab = (typeof SUB_TABS)[number];

const SUB_TAB_CFG: Record<SubTab, { label: string; icon: React.ReactNode; desc: string }> = {
  dues: {
    label: "Pending Dues",
    icon: <AlertCircle className="w-4 h-4" />,
    desc: "Tuition, hostel, mess, and exam dues",
  },
  receipts: {
    label: "Fee Receipts",
    icon: <Receipt className="w-4 h-4" />,
    desc: "Official semester payment receipts & invoices",
  },
  wallet: {
    label: "Student Wallet",
    icon: <Wallet className="w-4 h-4" />,
    desc: "Ledger balances, credits, and security refunds",
  },
};

interface PaymentsTabProps {
  loginToVTOP: () => Promise<{ cookies: string[]; authorizedID: string; csrf: string }>;
}

const safeNum = (val: string | undefined | null) => {
  if (!val) return 0;
  const cleaned = val.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

const fmtAmt = (val: string | undefined | null, symbol: string = "₹") => {
  if (!val) return `${symbol}0`;
  const cleaned = val.replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return `${symbol}0`;
  return `${symbol}${n.toLocaleString("en-IN")}`;
};

export default function PaymentsTab({ loginToVTOP }: PaymentsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("dues");

  // Initialize from stored localStorage data to prevent unnecessary VTOP re-fetches
  const [paymentsData, setPaymentsData] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("payments_dues") || localStorage.getItem("payments");
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [receiptsData, setReceiptsData] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("payments_receipts") || localStorage.getItem("payment-receipts");
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [walletData, setWalletData] = useState<any>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("payments_wallet") || localStorage.getItem("wallet");
        return stored ? JSON.parse(stored) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [receiptExtra, setReceiptExtra] = useState<Record<string, string> | undefined>(undefined);
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

  const fetchData = useCallback(
    async (tab: SubTab, extra?: Record<string, string>, isManual = false) => {
      setLoading((prev) => ({ ...prev, [tab]: true }));
      setError((prev) => ({ ...prev, [tab]: null }));
      try {
        const { cookies, authorizedID, csrf } = await loginToVTOP();

        if (authorizedID === "DEMO123") {
          await new Promise((resolve) => setTimeout(resolve, 300));
          let data: any = null;
          if (tab === "dues") {
            data = {
              studentInfo: {
                registerNumber: "22BCE1234",
                studentName: "Demo Student",
                programme: "B.Tech Computer Science & Engineering",
                campus: "Vellore Institute of Technology, Chennai",
              },
              hasDues: false,
              message: "No pending tuition fees or hostel dues are registered for your account.",
            };
            setPaymentsData(data);
            localStorage.setItem("payments_dues", JSON.stringify(data));
          } else if (tab === "receipts") {
            data = {
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
            };
            setReceiptsData(data);
            localStorage.setItem("payments_receipts", JSON.stringify(data));
          } else if (tab === "wallet") {
            data = {
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
            };
            setWalletData(data);
            localStorage.setItem("payments_wallet", JSON.stringify(data));
          }
          return;
        }

        const endpoint =
          tab === "dues" ? "payments" : tab === "receipts" ? "payment-receipts" : "wallet";
        const body: Record<string, any> = { cookies, authorizedID, csrf };
        const effectiveExtra = extra || (tab === "receipts" ? receiptExtra : undefined);
        if (effectiveExtra) Object.assign(body, effectiveExtra);

        const data = await api(`${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (tab === "dues") {
          setPaymentsData(data);
          localStorage.setItem("payments_dues", JSON.stringify(data));
        } else if (tab === "receipts") {
          setReceiptsData(data);
          if (!effectiveExtra) {
            localStorage.setItem("payments_receipts", JSON.stringify(data));
          }
        } else {
          setWalletData(data);
          localStorage.setItem("payments_wallet", JSON.stringify(data));
        }
      } catch (err: any) {
        setError((prev) => ({ ...prev, [tab]: err.message || "Fetch failed" }));
      } finally {
        setLoading((prev) => ({ ...prev, [tab]: false }));
      }
    },
    [loginToVTOP, receiptExtra]
  );

  // Only fetch on mount if stored version is completely missing
  useEffect(() => {
    if (activeSubTab === "dues" && !paymentsData) fetchData("dues");
    if (activeSubTab === "receipts" && !receiptsData) fetchData("receipts");
    if (activeSubTab === "wallet" && !walletData) fetchData("wallet");
  }, [activeSubTab, paymentsData, receiptsData, walletData, fetchData]);

  const hasPendingDues = paymentsData?.hasDues === true;

  /* ─────────────────────────────────────────────────────────────
     RENDER: DUES VIEW
  ───────────────────────────────────────────────────────────── */
  const renderDues = () => {
    if (loading.dues && !paymentsData) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-3xl" />
          <Skeleton className="h-44 w-full rounded-3xl" />
        </div>
      );
    }

    if (error.dues && !paymentsData) {
      return (
        <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 flex items-center gap-3.5">
          <XCircle className="w-5 h-5 shrink-0" />
          <p className="text-xs font-bold">{error.dues}</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 animate-fadeIn">
        {/* Dues Status Hero Card */}
        <div
          className={`p-6 sm:p-7 rounded-3xl border transition-all shadow-xs ${
            hasPendingDues
              ? "bg-gradient-to-br from-red-50/90 to-rose-50/60 dark:from-red-950/40 dark:to-zinc-900/80 border-red-200 dark:border-red-900/50 text-red-900 dark:text-red-200"
              : "bg-gradient-to-br from-emerald-50/90 to-teal-50/60 dark:from-emerald-950/40 dark:to-zinc-900/80 border-emerald-200/80 dark:border-emerald-900/50 text-emerald-900 dark:text-emerald-200"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                  hasPendingDues
                    ? "bg-red-500 text-white"
                    : "bg-emerald-500 text-white"
                }`}
              >
                {hasPendingDues ? <Ban className="w-7 h-7" /> : <ShieldCheck className="w-7 h-7" />}
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 block mb-0.5">
                  Fee Clearance Status
                </span>
                <h3 className="text-lg sm:text-xl font-black font-outfit">
                  {hasPendingDues ? "Pending University Dues" : "All Clear — No Pending Dues"}
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                  {paymentsData?.message ||
                    (hasPendingDues
                      ? "Outstanding tuition or hostel payments are pending clearance on VTOP."
                      : "Your account is in good standing with zero outstanding fee dues.")}
                </p>
              </div>
            </div>

            {hasPendingDues && (
              <a
                href="https://vtop.vit.ac.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-red-600 text-white text-xs font-black shadow-xs hover:bg-red-700 active:scale-[0.98] transition-all shrink-0"
              >
                <span>Pay on VTOP</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* Student Account Metadata Card */}
        {paymentsData?.studentInfo && (
          <div className="bg-white/80 dark:bg-zinc-900/80 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 p-5 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800/60 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-outfit">
                  Account Registration
                </h4>
              </div>
              <span className="text-[10px] font-bold text-zinc-400 font-mono">
                {paymentsData.studentInfo.registerNumber}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Student Name
                </span>
                <span className="font-extrabold text-zinc-900 dark:text-white block truncate">
                  {paymentsData.studentInfo.studentName || "—"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Enrolled Programme
                </span>
                <span className="font-extrabold text-zinc-900 dark:text-white block truncate">
                  {paymentsData.studentInfo.programme || "—"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-850 sm:col-span-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-0.5">
                  Campus Centre
                </span>
                <span className="font-extrabold text-zinc-900 dark:text-white block truncate">
                  {paymentsData.studentInfo.campus || "Vellore Institute of Technology"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     RENDER: RECEIPTS VIEW
  ───────────────────────────────────────────────────────────── */
  const renderReceipts = () => {
    if (loading.receipts && !receiptsData) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      );
    }

    if (error.receipts && !receiptsData) {
      return (
        <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 flex items-center gap-3.5">
          <XCircle className="w-5 h-5 shrink-0" />
          <p className="text-xs font-bold">{error.receipts}</p>
        </div>
      );
    }

    const isDetailView = receiptExtra?.applNo && receiptsData?.tables?.length > 0;

    if (isDetailView) {
      return (
        <div className="space-y-4 animate-fadeIn">
          <button
            onClick={() => {
              setReceiptExtra(undefined);
              setReceiptsData(null);
              fetchData("receipts", undefined, true);
            }}
            className="flex items-center gap-2 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer px-1 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Invoices & Receipts</span>
          </button>

          {receiptsData.tables.map((table: any, idx: number) => (
            <div key={idx} className="space-y-3">
              {table.caption && (
                <h4 className="text-xs font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-1">
                  {table.caption}
                </h4>
              )}
              <div className="space-y-2.5">
                {table.rows?.map((row: Record<string, string>, ri: number) => (
                  <div
                    key={ri}
                    className="p-5 rounded-3xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-extrabold text-zinc-900 dark:text-white font-outfit">
                        Invoice Particulars
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      {table.headers?.map((header: string) => (
                        <div key={header} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/50 dark:border-zinc-850">
                          <span className="text-[10px] font-bold text-zinc-400 uppercase block mb-0.5">
                            {header}
                          </span>
                          <span className="font-bold text-zinc-800 dark:text-zinc-200 break-words">
                            {row[header] || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    const receiptList = receiptsData?.receipts;

    if (receiptList && receiptList.length > 0) {
      return (
        <div className="space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              {receiptList.length} Recorded {receiptList.length === 1 ? "Receipt" : "Receipts"}
            </span>
          </div>

          <div className="space-y-2.5">
            {receiptList.map((r: any, i: number) => (
              <div
                key={i}
                className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 hover:border-indigo-400 shadow-2xs transition-all flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30 shrink-0">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-black font-outfit text-zinc-900 dark:text-white truncate">
                      {r.receiptNumber}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        {r.date || "Date Logged"}
                      </span>
                      {r.campusCode && (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                          {r.campusCode}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base sm:text-lg font-black font-outfit text-zinc-900 dark:text-white block">
                    {fmtAmt(r.amount)}
                  </span>
                  <span className="text-[10px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-900/40 inline-block mt-0.5">
                    Settled
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="p-8 rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 text-center space-y-2">
        <Receipt className="w-8 h-8 text-zinc-400 mx-auto" />
        <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
          No payment receipts logged on your student account yet.
        </p>
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     RENDER: WALLET VIEW
  ───────────────────────────────────────────────────────────── */
  const renderWallet = () => {
    if (loading.wallet && !walletData) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-32 w-full rounded-3xl" />
        </div>
      );
    }

    if (error.wallet && !walletData) {
      return (
        <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 flex items-center gap-3.5">
          <XCircle className="w-5 h-5 shrink-0" />
          <p className="text-xs font-bold">{error.wallet}</p>
        </div>
      );
    }

    const latestINR = walletData?.ledgerINR?.[0]?.bookBalanceAmount;
    const latestUSD = walletData?.ledgerUSD?.[0]?.bookBalanceAmount;

    const renderLedgerList = (title: string, entries: any[], currencySymbol: string) => (
      <div className="space-y-3">
        <h4 className="text-xs font-black uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1">
          {title} ({entries.length})
        </h4>

        {entries.length === 0 ? (
          <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-850 text-center text-xs font-bold text-zinc-400">
            No transactions recorded in this ledger
          </div>
        ) : (
          <div className="space-y-2.5">
            {entries.map((entry: any, idx: number) => {
              const amt = safeNum(entry.amount);
              const refundAmt = safeNum(entry.refundAmount);
              const txType = (entry.transactionType || "").toUpperCase();
              const isDebit = txType === "DR" ? true : txType === "CR" ? false : amt < 0;
              const isRefunded = refundAmt > 0 || entry.refundDate;

              return (
                <div
                  key={idx}
                  className="p-4 sm:p-5 rounded-3xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 shadow-2xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`p-3 rounded-2xl shrink-0 ${
                          isDebit
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        }`}
                      >
                        {isDebit ? (
                          <ArrowDownRight className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-extrabold text-zinc-900 dark:text-white truncate">
                          {entry.particulars || (isDebit ? "Debit Transaction" : "Credit Deposit")}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                          {entry.transactionDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {entry.transactionDate}
                            </span>
                          )}
                          {entry.receiptNumber && (
                            <span className="flex items-center gap-1 font-mono">
                              <Hash className="w-3 h-3" />
                              {entry.receiptNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={`text-base sm:text-lg font-black font-outfit leading-none ${
                          isDebit
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {isDebit ? "-" : "+"}
                        {fmtAmt(String(Math.abs(amt)), currencySymbol)}
                      </p>
                      {entry.bookBalanceAmount && (
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                          Balance: {fmtAmt(entry.bookBalanceAmount, currencySymbol)}
                        </p>
                      )}
                    </div>
                  </div>

                  {isRefunded && (
                    <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                      <span className="text-amber-600 dark:text-amber-400 font-bold">
                        Refund Processed {entry.refundDate ? `(${entry.refundDate})` : ""}
                      </span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 font-outfit">
                        +{fmtAmt(String(refundAmt), currencySymbol)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );

    return (
      <div className="space-y-6 animate-fadeIn">
        {/* Balances Banner Card */}
        {(latestINR || latestUSD) && (
          <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent dark:from-indigo-950/40 dark:via-zinc-900/60 dark:to-zinc-900/80 border border-indigo-200/60 dark:border-indigo-900/40 shadow-xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 block mb-2 font-outfit">
              Available Wallet Balance
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {latestINR && (
                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <IndianRupee className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                      INR Balance
                    </span>
                    <span className="text-xl font-black font-outfit text-zinc-900 dark:text-white">
                      {fmtAmt(latestINR, "₹")}
                    </span>
                  </div>
                </div>
              )}
              {latestUSD && (
                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                      USD Balance
                    </span>
                    <span className="text-xl font-black font-outfit text-zinc-900 dark:text-white">
                      {fmtAmt(latestUSD, "$")}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {walletData?.ledgerINR && renderLedgerList("Indian Rupee (INR) Ledger", walletData.ledgerINR, "₹")}
        {walletData?.ledgerUSD && renderLedgerList("US Dollar (USD) Ledger", walletData.ledgerUSD, "$")}
      </div>
    );
  };

  /* ─────────────────────────────────────────────────────────────
     MAIN COMPONENT RENDER
  ───────────────────────────────────────────────────────────── */
  return (
    <div className="w-full max-w-4xl mx-auto space-y-5 pb-16 px-3 sm:px-4 text-left select-none animate-in fade-in duration-200">
      {/* AmazeHeader / PageHeader */}
      <PageHeader
        icon={<IndianRupee className="w-5.5 h-5.5 text-indigo-600 dark:text-indigo-400" />}
        title="Payments & Financials"
        meta={
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-1 rounded-lg border font-mono ${
              hasPendingDues
                ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50"
                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
            }`}
          >
            {hasPendingDues ? "Pending Dues" : "All Clear"}
          </span>
        }
        actions={
          <button
            onClick={() => fetchData(activeSubTab, undefined, true)}
            disabled={loading[activeSubTab]}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-bold transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-50"
            title="Refresh payments from VTOP"
          >
            <RefreshCcw
              className={`w-3.5 h-3.5 ${loading[activeSubTab] ? "animate-spin text-indigo-600" : ""}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        }
      />

      {/* Subtabs Segmented Strip */}
      <div className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/70 dark:border-zinc-800/70 shadow-2xs">
        {(Object.entries(SUB_TAB_CFG) as [SubTab, (typeof SUB_TAB_CFG)[SubTab]][]).map(
          ([tab, cfg]) => {
            const isActive = activeSubTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all cursor-pointer truncate ${
                  isActive
                    ? "bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-black"
                    : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                }`}
              >
                {cfg.icon}
                <span className="truncate">{cfg.label}</span>
              </button>
            );
          }
        )}
      </div>

      {/* Tab Contents */}
      <div className="pt-1">
        {activeSubTab === "dues" && renderDues()}
        {activeSubTab === "receipts" && renderReceipts()}
        {activeSubTab === "wallet" && renderWallet()}
      </div>
    </div>
  );
}
