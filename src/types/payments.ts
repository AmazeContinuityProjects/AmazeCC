export type PaymentTransactionType = "CR" | "DR";

export interface PaymentStudentInfo {
  registerNumber?: string;
  studentName?: string;
  programme?: string;
  campus?: string;
}

/** VTOP `payments` endpoint. */
export interface PaymentsDuesData {
  studentInfo?: PaymentStudentInfo;
  hasDues?: boolean;
  message?: string;
}

export interface PaymentReceipt {
  receiptNumber: string;
  date?: string;
  campusCode?: string;
  amount?: string;
  /** Sent as `applNo` to fetch the invoice field table. */
  applNo?: string;
}

export interface PaymentReceiptTable {
  caption?: string;
  headers?: string[];
  rows?: Record<string, string>[];
}

/** VTOP `payment-receipts` endpoint (list + per-receipt detail tables). */
export interface PaymentReceiptsData {
  receipts?: PaymentReceipt[];
  tables?: PaymentReceiptTable[];
}

export interface PaymentLedgerEntry {
  amount?: string;
  refundAmount?: string;
  transactionType?: PaymentTransactionType | string;
  refundDate?: string | null;
  particulars?: string;
  transactionDate?: string;
  bookBalanceAmount?: string;
  receiptNumber?: string;
}

/** VTOP `wallet` endpoint. */
export interface PaymentWalletData {
  ledgerINR?: PaymentLedgerEntry[];
  ledgerUSD?: PaymentLedgerEntry[];
}
