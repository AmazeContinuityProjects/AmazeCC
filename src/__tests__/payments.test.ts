import { describe, expect, it } from "vitest";
import {
  safeNum,
  fmtAmt,
  latestBalance,
  countLedgerEntries,
  isDebitEntry,
  latestTransaction,
  receiptDetailKey,
  duesTone,
} from "../lib/payments";
import type { PaymentWalletData } from "../types/payments";

const wallet: PaymentWalletData = {
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
    {
      amount: "1200",
      transactionType: "DR",
      particulars: "Mess credit",
      transactionDate: "2026-05-02",
      bookBalanceAmount: "3800",
    },
  ],
  ledgerUSD: [
    {
      amount: "120",
      transactionType: "CR",
      particulars: "Foreign deposit",
      transactionDate: "2026-07-09",
      bookBalanceAmount: "120",
    },
  ],
};

describe("payment formatting", () => {
  it("strips currency noise out of amounts", () => {
    expect(safeNum("₹ 1,20,000.50")).toBe(120000.5);
    expect(safeNum("")).toBe(0);
    expect(safeNum(undefined)).toBe(0);
    expect(safeNum("abc")).toBe(0);
  });

  it("formats with the requested symbol and Indian grouping", () => {
    expect(fmtAmt("198000")).toContain("1,98,000");
    expect(fmtAmt("120", "$")).toBe("$120");
    expect(fmtAmt(undefined, "$")).toBe("$0");
  });
});

describe("wallet helpers", () => {
  it("reads the newest book balance as the current balance", () => {
    expect(latestBalance(wallet.ledgerINR)).toBe("5000");
    expect(latestBalance(wallet.ledgerUSD)).toBe("120");
    expect(latestBalance([])).toBeUndefined();
    expect(latestBalance(undefined)).toBeUndefined();
  });

  it("counts entries across both ledgers", () => {
    expect(countLedgerEntries(wallet)).toBe(3);
    expect(countLedgerEntries({ ledgerINR: [], ledgerUSD: [] })).toBe(0);
    expect(countLedgerEntries(null)).toBe(0);
  });

  it("classifies debits and credits", () => {
    expect(isDebitEntry({ transactionType: "DR", amount: "10" })).toBe(true);
    expect(isDebitEntry({ transactionType: "CR", amount: "10" })).toBe(false);
    // Falls back to the sign when the type is missing
    expect(isDebitEntry({ amount: "-10" })).toBe(true);
    expect(isDebitEntry({ amount: "10" })).toBe(false);
  });

  it("picks the most recent transaction across ledgers", () => {
    const latest = latestTransaction(wallet);
    expect(latest?.ledger).toBe("USD");
    expect(latest?.entry.particulars).toBe("Foreign deposit");
    expect(latest?.symbol).toBe("$");
  });

  it("returns null when both ledgers are empty", () => {
    expect(latestTransaction({ ledgerINR: [], ledgerUSD: [] })).toBeNull();
    expect(latestTransaction(null)).toBeNull();
  });
});

describe("receipt detail keys", () => {
  it("prefers applNo and falls back to the receipt number", () => {
    expect(receiptDetailKey({ receiptNumber: "FEE-1", applNo: "APPL-9" })).toBe("APPL-9");
    expect(receiptDetailKey({ receiptNumber: "FEE-1" })).toBe("FEE-1");
    expect(receiptDetailKey(null)).toBe("");
  });
});

describe("dues tone", () => {
  it("is red only when dues are actually flagged", () => {
    expect(duesTone(true)).toBe("red");
    expect(duesTone(false)).toBe("emerald");
    expect(duesTone(undefined)).toBe("emerald");
  });
});
