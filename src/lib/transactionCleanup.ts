import { Firestore } from "firebase/firestore";
import { Transaction } from "../types";

/**
 * Checks whether a transaction is within the active history window.
 * Always returns true to preserve full history.
 */
export function isTransactionWithin60Days(_tx: Transaction | { createdAt?: any }): boolean {
  return true;
}

/**
 * Returns the full list of transactions without removing or hiding any records.
 * Transactions are permanent and visible for the user's lifetime.
 */
export function filterTransactionsLast60Days(transactions: Transaction[]): Transaction[] {
  if (!Array.isArray(transactions)) return [];
  return transactions;
}

/**
 * Safe No-Op cleanup handler.
 * Financial records in the 'transactions' collection are permanent and must never be deleted.
 */
export async function cleanupExpiredTransactions(
  _db: Firestore,
  _userId?: string
): Promise<{ deletedCount: number; scannedCount: number }> {
  // Hard policy: Never delete any document from the transactions collection.
  return { deletedCount: 0, scannedCount: 0 };
}
