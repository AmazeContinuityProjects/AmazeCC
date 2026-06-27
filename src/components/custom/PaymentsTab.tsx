"use client";
import { useState, useEffect } from "react";
import { API_BASE } from "./Main";
import { Wallet, Receipt, AlertCircle, RefreshCcw, IndianRupee, DollarSign, FileText, Calendar, Hash, ArrowUpRight, ArrowDownRight, CheckCircle2, XCircle, Ban, ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

const SUB_TABS = ["dues", "receipts", "wallet"] as const;
type SubTab = (typeof SUB_TABS)[number];

const SUB_TAB_CFG: Record<SubTab, { label: string; icon: React.ReactNode }> = {
  dues: { label: "Dues", icon: <AlertCircle className="w-4 h-4" /> },
  receipts: { label: "Receipts", icon: <Receipt className="w-4 h-4" /> },
  wallet: { label: "Wallet", icon: <Wallet className="w-4 h-4" /> },
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

const CardShell = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`solid-card mb-5 ${className}`}>
    {children}
  </div>
);

const Field = ({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) => (
  <div className="flex items-start gap-2.5">
    {icon && <div className="mt-0.5 text-gray-400  dark:text-gray-500 shrink-0">{icon}</div>}
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-gray-800  dark:text-gray-200 break-words">{value || "—"}</p>
    </div>
  </div>
);

const EmptyState = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <CardShell>
    <div className="flex flex-col items-center justify-center py-12 px-6">
      <div className="p-4 rounded-full bg-gray-100  dark:bg-gray-800 text-gray-400 dark:text-gray-500 mb-4">
        {icon}
      </div>
      <p className="text-sm font-medium text-gray-500  dark:text-gray-400">{text}</p>
    </div>
  </CardShell>
);

export default function PaymentsTab({ loginToVTOP }: PaymentsTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>("dues");
  const [paymentsData, setPaymentsData] = useState<any>(null);
  const [receiptsData, setReceiptsData] = useState<any>(null);
  const [walletData, setWalletData] = useState<any>(null);
  const [receiptExtra, setReceiptExtra] = useState<Record<string, string> | undefined>(undefined);
  const [loading, setLoading] = useState<Record<SubTab, boolean>>({ dues: false, receipts: false, wallet: false });
  const [error, setError] = useState<Record<SubTab, string | null>>({ dues: null, receipts: null, wallet: null });
  const fetchData = async (tab: SubTab, extra?: Record<string, string>) => {
    setLoading(prev => ({ ...prev, [tab]: true }));
    setError(prev => ({ ...prev, [tab]: null }));
    try {
      const { cookies, authorizedID, csrf } = await loginToVTOP();
      const endpoint = tab === "dues" ? "payments" : tab === "receipts" ? "payment-receipts" : "wallet";
      const body: Record<string, any> = { cookies, authorizedID, csrf };
      const effectiveExtra = extra || (tab === "receipts" ? receiptExtra : undefined);
      if (effectiveExtra) Object.assign(body, effectiveExtra);
      const res = await fetch(`${API_BASE}/api/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (tab === "dues") setPaymentsData(data);
      else if (tab === "receipts") setReceiptsData(data);
      else setWalletData(data);
    } catch (err: any) {
      setError(prev => ({ ...prev, [tab]: err.message || "Fetch failed" }));
    } finally {
      setLoading(prev => ({ ...prev, [tab]: false }));
    }
  };

  useEffect(() => {
    if (activeSubTab === "dues" && !paymentsData) fetchData("dues");
    if (activeSubTab === "receipts" && !receiptsData) fetchData("receipts");
    if (activeSubTab === "wallet" && !walletData) fetchData("wallet");
  }, [activeSubTab]);

  const SkeletonBlock = () => (
    <div className="space-y-4">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
      <Skeleton className="h-28 w-full rounded-2xl" />
    </div>
  );

  const ErrorBlock = ({ msg }: { msg: string }) => (
    <CardShell>
      <div className="flex items-center gap-3 p-4 text-red-600  dark:text-red-500">
        <XCircle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-medium">{msg}</p>
      </div>
    </CardShell>
  );

  const renderDues = () => {
    if (loading.dues) return <SkeletonBlock />;
    if (error.dues) return <ErrorBlock msg={error.dues} />;
    if (!paymentsData) return null;

    return (
      <div className="animate-fadeIn space-y-4">
        {paymentsData.studentInfo && (
          <CardShell>
            <div className="p-5">
              <h4 className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-4">Student Info</h4>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Register No" value={paymentsData.studentInfo.registerNumber} icon={<Hash className="w-3.5 h-3.5" />} />
                <Field label="Name" value={paymentsData.studentInfo.studentName} />
                <Field label="Programme" value={paymentsData.studentInfo.programme} />
                <Field label="Campus" value={paymentsData.studentInfo.campus} />
              </div>
            </div>
          </CardShell>
        )}

        <CardShell>
          <div className="p-6 flex flex-col items-center justify-center">
            {paymentsData.hasDues ? (
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-red-100  dark:bg-red-900/30">
                  <Ban className="w-8 h-8 text-red-500" />
                </div>
                <p className="text-lg font-bold text-red-600  dark:text-red-500">You have pending dues</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 rounded-full bg-green-100  dark:bg-green-900/30">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <p className="text-lg font-bold text-green-600  dark:text-green-500">All clear — no pending dues</p>
              </div>
            )}
            {paymentsData.message && paymentsData.message.length <= 300 && (
              <p className="text-sm text-gray-500  dark:text-gray-400 mt-4 text-center leading-relaxed">
                {paymentsData.message}
              </p>
            )}
          </div>
        </CardShell>
      </div>
    );
  };

  const renderReceipts = () => {
    if (loading.receipts) return <SkeletonBlock />;
    if (error.receipts) return <ErrorBlock msg={error.receipts} />;
    if (!receiptsData) return null;

    const isDetailView = receiptExtra?.applNo && receiptsData.tables?.length > 0;

    if (isDetailView) {
      return (
        <div className="animate-fadeIn space-y-4">
          <button
            onClick={() => {
              setReceiptExtra(undefined);
              setReceiptsData(null);
              fetchData("receipts");
            }}
            className="flex items-center gap-2 text-sm font-medium text-blue-600  dark:text-blue-400 hover:underline mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to all receipts
          </button>
          {receiptsData.tables.map((table: any, idx: number) => (
            <div key={idx}>
              {table.caption && (
                <h4 className="text-sm font-semibold text-gray-500  dark:text-gray-400 uppercase tracking-wider mb-3 px-1">{table.caption}</h4>
              )}
              <div className="space-y-3">
                {table.rows?.map((row: Record<string, string>, ri: number) => (
                  <CardShell key={ri}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-blue-50  dark:bg-blue-900/20 text-blue-600  dark:text-blue-400">
                            <FileText className="w-4 h-4" />
                          </div>
                          <span className="text-sm font-semibold text-gray-900  dark:text-gray-100">Receipt Details</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        {table.headers.map((header: string) => (
                          <Field key={header} label={header} value={row[header] || ""} />
                        ))}
                      </div>
                    </div>
                  </CardShell>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    const receiptList = receiptsData.receipts;
    if (receiptList && receiptList.length > 0) {
      return (
        <div className="animate-fadeIn space-y-3">
          <p className="text-xs text-gray-400  dark:text-gray-500 uppercase tracking-wider font-semibold px-1 mb-2">
            {receiptList.length} receipt{receiptList.length !== 1 ? "s" : ""} found
          </p>
          {receiptList.map((r: any, i: number) => (
            <CardShell key={i}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-50  dark:bg-blue-900/20 text-blue-600  dark:text-blue-400 shrink-0">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900  dark:text-gray-100 truncate">{r.receiptNumber}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400  dark:text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {r.date}
                        </span>
                        <span>{r.campusCode}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900  dark:text-gray-100">{fmtAmt(r.amount)}</p>
                  </div>
                </div>
              </div>
            </CardShell>
          ))}
        </div>
      );
    }

    return <EmptyState icon={<Receipt className="w-8 h-8" />} text="No receipts found" />;
  };

  const renderWallet = () => {
    if (loading.wallet) return <SkeletonBlock />;
    if (error.wallet) return <ErrorBlock msg={error.wallet} />;
    if (!walletData) return null;

    const hasAnyLedger = (walletData.ledgerINR?.length || 0) + (walletData.ledgerUSD?.length || 0) > 0;

    const renderLedgerCards = (title: string, entries: any[], currencySymbol: string, icon: React.ReactNode, accentClass: string) => (
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          {icon}
          <h4 className="text-sm font-semibold text-gray-700  dark:text-gray-300">{title}</h4>
        </div>
        <div className="space-y-3">
          {entries.length === 0 ? (
            <CardShell>
              <div className="p-5 text-center text-sm text-gray-400  dark:text-gray-500">No transactions</div>
            </CardShell>
          ) : (
            entries.map((entry: any, idx: number) => {
              const amt = safeNum(entry.amount);
              const refundAmt = safeNum(entry.refundAmount);
              const txType = (entry.transactionType || "").toUpperCase();
              const isDebit = txType === "DR" ? true : txType === "CR" ? false : amt > 0;
              const isRefunded = refundAmt > 0 || entry.refundDate;

              return (
                <CardShell key={idx}>
                  <div className="p-4 pb-3.5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-xl ${isDebit ? 'bg-red-50  dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-green-50  dark:bg-green-900/20 text-green-600 dark:text-green-400'}`}>
                          {isDebit ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                              isDebit
                                ? 'bg-red-100 text-red-700   dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-green-100 text-green-700   dark:bg-green-900/30 dark:text-green-400'
                            }`}>
                              {isDebit ? 'Debit' : 'Credit'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400  dark:text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {entry.transactionDate}
                            </span>
                            {entry.receiptNumber && (
                              <span className="flex items-center gap-1">
                                <Hash className="w-3 h-3" />
                                {entry.receiptNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className={`text-lg font-extrabold leading-none ${isDebit ? 'text-red-600  dark:text-red-400' : 'text-green-600  dark:text-green-400'}`}>
                          {isDebit ? '-' : '+'}{fmtAmt(String(Math.abs(amt)), currencySymbol)}
                        </p>
                        {entry.bookBalanceAmount && (
                          <p className="text-[11px] text-gray-400  dark:text-gray-500 mt-1 whitespace-nowrap">
                            Balance: {fmtAmt(entry.bookBalanceAmount, currencySymbol)}
                          </p>
                        )}
                      </div>
                    </div>

                    {isRefunded && (
                      <div className="mt-3 pt-2.5 border-t border-dashed border-gray-200  dark:border-gray-700">
                        <div className="flex items-center justify-between bg-orange-50  dark:bg-orange-900/10 rounded-xl p-3">
                          <div className="flex items-center gap-2">
                            <div className="p-1 rounded-lg bg-orange-100  dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-orange-700  dark:text-orange-400">Refund Processed</p>
                              {entry.refundDate && <p className="text-[11px] text-orange-500  dark:text-orange-300">{entry.refundDate}</p>}
                            </div>
                          </div>
                          <span className="text-sm font-bold text-green-600  dark:text-green-400">
                            +{fmtAmt(entry.refundAmount, currencySymbol)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </CardShell>
              );
            })
          )}
        </div>
      </div>
    );

    const latestINR = walletData.ledgerINR?.[0]?.bookBalanceAmount;
    const latestUSD = walletData.ledgerUSD?.[0]?.bookBalanceAmount;

    return (
      <div className="animate-fadeIn space-y-6">
        {(latestINR || latestUSD) && (
          <CardShell>
            <div className="p-5">
              <p className="text-xs font-semibold text-gray-400  dark:text-gray-500 uppercase tracking-wider mb-3">Wallet Balance</p>
              <div className="flex gap-6">
                {latestINR && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-green-50  dark:bg-green-900/20 text-green-600 dark:text-green-400">
                      <IndianRupee className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400  dark:text-gray-500">INR</p>
                      <p className="text-xl font-bold text-gray-900  dark:text-gray-100">{fmtAmt(latestINR, "₹")}</p>
                    </div>
                  </div>
                )}
                {latestUSD && (
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-blue-50  dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-400  dark:text-gray-500">USD</p>
                      <p className="text-xl font-bold text-gray-900  dark:text-gray-100">{fmtAmt(latestUSD, "$")}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardShell>
        )}
        {walletData.ledgerINR && renderLedgerCards("INR Wallet", walletData.ledgerINR, "₹", <IndianRupee className="w-4 h-4" />, "bg-green-50  dark:bg-green-900/20 text-green-600 dark:text-green-400")}
        {walletData.ledgerUSD && renderLedgerCards("USD Wallet", walletData.ledgerUSD, "$", <DollarSign className="w-4 h-4" />, "bg-blue-50  dark:bg-blue-900/20 text-blue-600 dark:text-blue-400")}
        {!hasAnyLedger && <EmptyState icon={<Wallet className="w-8 h-8" />} text="No wallet transactions found" />}
      </div>
    );
  };

  return (
    <div className="w-full h-full pb-8">
      <div className="w-full max-w-3xl mx-auto py-2 md:py-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-bold text-gray-900  dark:text-gray-100">Payments</h2>
          <button
            onClick={() => fetchData(activeSubTab)}
            disabled={loading[activeSubTab]}
            className="p-2.5 rounded-full bg-blue-50  dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-slate-700 transition-colors shadow-sm disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCcw className={`w-5 h-5 ${loading[activeSubTab] ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex gap-1 bg-gray-100  dark:bg-gray-800/50 rounded-xl p-1 mb-6 overflow-x-auto">
          {(Object.entries(SUB_TAB_CFG) as [SubTab, typeof SUB_TAB_CFG[SubTab]][]).map(([tab, cfg]) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeSubTab === tab
                  ? "bg-white  dark:bg-gray-800 text-blue-600  dark:text-blue-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700  dark:hover:text-gray-200 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {cfg.icon}
              {cfg.label}
            </button>
          ))}
        </div>

        {activeSubTab === "dues" && renderDues()}
        {activeSubTab === "receipts" && renderReceipts()}
        {activeSubTab === "wallet" && renderWallet()}
      </div>
    </div>
  );
}
