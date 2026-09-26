import type {
  PaymentLedgerEntry,
  PaymentReceipt,
  PaymentWalletData,
} from "@/types/payments";

export const PAYMENTS_KEYS = {
  dues: "payments_dues",
  receipts: "payments_receipts",
  wallet: "payments_wallet",
} as const;

export const safeNum = (val: string | number | undefined | null): number => {
  if (val === undefined || val === null || val === "") return 0;
  const cleaned = String(val).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
};

export const fmtAmt = (val: string | number | undefined | null, symbol = "₹"): string => {
  if (val === undefined || val === null || val === "") return `${symbol}0`;
  const n = safeNum(val);
  return `${symbol}${n.toLocaleString("en-IN")}`;
};

/** Ledger balance = the newest entry's running book balance. */
export function latestBalance(entries?: PaymentLedgerEntry[]): string | undefined {
  return entries?.[0]?.bookBalanceAmount;
}

export function countLedgerEntries(wallet?: PaymentWalletData | null): number {
  if (!wallet) return 0;
  return (wallet.ledgerINR?.length || 0) + (wallet.ledgerUSD?.length || 0);
}

export function isDebitEntry(entry: PaymentLedgerEntry): boolean {
  const type = String(entry.transactionType || "").toUpperCase();
  if (type === "DR") return true;
  if (type === "CR") return false;
  return safeNum(entry.amount) < 0;
}

export interface LatestTransaction {
  entry: PaymentLedgerEntry;
  symbol: string;
  ledger: "INR" | "USD";
}

/** Most recent transaction across both ledgers (INR wins ties). */
export function latestTransaction(
  wallet?: PaymentWalletData | null
): LatestTransaction | null {
  if (!wallet) return null;
  const candidates: LatestTransaction[] = [];
  if (wallet.ledgerINR?.[0]) {
    candidates.push({ entry: wallet.ledgerINR[0], symbol: "₹", ledger: "INR" });
  }
  if (wallet.ledgerUSD?.[0]) {
    candidates.push({ entry: wallet.ledgerUSD[0], symbol: "$", ledger: "USD" });
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, cur) => {
    const a = latest.entry.transactionDate || "";
    const b = cur.entry.transactionDate || "";
    if (b > a) return cur;
    return latest;
  });
}

/** Stable cache key for a receipt's detail fetch. */
export function receiptDetailKey(receipt?: PaymentReceipt | null): string {
  if (!receipt) return "";
  return String(receipt.applNo || receipt.receiptNumber || "");
}

export type DuesTone = "red" | "emerald";

export function duesTone(hasDues?: boolean): DuesTone {
  return hasDues === true ? "red" : "emerald";
}
