import { db, handleFirestoreError, OperationType } from './firebase';
import { apiUrl } from '../config/api';
import { 
  doc, 
  getDoc, 
  runTransaction, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';

export interface WalletTransactionRequest {
  userId: string;
  amount: number;
  type: 'add_money' | 'deposit' | 'transfer' | 'received_transfer' | 'withdraw' | 'telecom_recharge' | 'shop_purchase' | 'loan_repayment' | 'fee_payment' | 'samity_deposit';
  typeLabel: string;
  description: string;
  paymentMethod?: string;
  receiverUid?: string;
  receiverId?: string;
  receiverName?: string;
  charge?: number;
  transactionId?: string;
}

/**
 * Extracts and returns the true effective balance of a user object.
 */
export const getEffectiveBalance = (u: any): number => {
  if (!u) return 0;
  const numBalance = (u.balance !== undefined && u.balance !== null && u.balance !== '' && Number.isFinite(Number(u.balance)))
    ? Number(u.balance)
    : null;
  const numMainBalance = (u.mainBalance !== undefined && u.mainBalance !== null && u.mainBalance !== '' && Number.isFinite(Number(u.mainBalance)))
    ? Number(u.mainBalance)
    : null;

  if (numBalance !== null && numMainBalance !== null) {
    if (numBalance <= 0 && numMainBalance > 0) return numMainBalance;
    if (numMainBalance <= 0 && numBalance > 0) return numBalance;
    return numBalance;
  }
  if (numBalance !== null) return Math.max(0, numBalance);
  if (numMainBalance !== null) return Math.max(0, numMainBalance);
  return 0;
};

/**
 * Atomically processes a financial transaction on the backend server with single source of truth ledger rules,
 * strict idempotency checks, debit/credit invariants, and audit trails.
 */
export async function processWalletTransaction(req: WalletTransactionRequest): Promise<{ success: boolean; newBalance: number; txId: string }> {
  const txId = req.transactionId || `TXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const resp = await fetch(apiUrl('/api/wallet/transaction'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...req,
      transactionId: txId,
      idempotencyKey: txId
    })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) {
    throw new Error(data.error || 'লেনদেন প্রক্রিয়াকরণ ব্যর্থ হয়েছে।');
  }
  return {
    success: true,
    newBalance: Number(data.newBalance),
    txId: data.txId || txId
  };
}

export interface AmbTransferRequest {
  senderUid: string;
  receiverIdentifier: string; // phone, memberId, or uid
  amount: number;
  charge?: number;
  transactionId?: string;
  note?: string;
}

/**
 * Atomically processes BNB-to-BNB transfer between sender and receiver on the backend server with strict invariants.
 * Sender is debited and receiver is credited in a single atomic transaction with idempotency protection.
 */
export async function processAmbTransfer(req: AmbTransferRequest): Promise<{ success: boolean; senderNewBalance: number; receiverNewBalance: number; txId: string }> {
  const txId = req.transactionId || `BNBTXN${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const resp = await fetch(apiUrl('/api/wallet/transfer'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...req,
      transactionId: txId,
      idempotencyKey: txId
    })
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.success) {
    throw new Error(data.error || 'অর্থ স্থানান্তর ব্যর্থ হয়েছে।');
  }
  return {
    success: true,
    senderNewBalance: Number(data.senderNewBalance),
    receiverNewBalance: Number(data.receiverNewBalance),
    txId: data.txId || txId
  };
}

/**
 * Read-only ledger verification helper (never mutates user balance from the client).
 */
export async function reconcileUserLedger(userId: string): Promise<{ reconciled: boolean; correctedBalance: number; discrepancy: number }> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return { reconciled: false, correctedBalance: 0, discrepancy: 0 };
  const userData = userSnap.data();
  const currentBalance = getEffectiveBalance(userData);
  return { reconciled: false, correctedBalance: currentBalance, discrepancy: 0 };
}

export interface SendMoneyServerRequest {
  userId: string;
  channel: 'mobile_bank' | 'bank_wallet' | 'abroad' | 'bnb_to_bnb';
  amount: number;
  clientCharge?: number;
  requestId: string;
  transactionId?: string;
  method?: string;
  selectedMobileOp?: string;
  targetPhone?: string;
  selectedBankOp?: string;
  bankName?: string;
  accountTitle?: string;
  accountNumber?: string;
  branch?: string;
  routingNumber?: string;
  receiverIdentifier?: string;
}

export interface SendMoneyServerResponse {
  success: boolean;
  alreadyProcessed?: boolean;
  newBalance: number;
  transactionId: string;
  recordId: string;
  charge: number;
  totalRequired: number;
  receiverName?: string;
  receiverPhone?: string;
  receiverMemberId?: string;
  isVirtualSomitiAcc?: boolean;
}

export async function processSendMoneyServer(req: SendMoneyServerRequest): Promise<SendMoneyServerResponse> {
  let resp: Response;
  try {
    resp = await fetch(apiUrl('/api/wallet/send-money'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    });
  } catch (_networkErr) {
    throw new Error('লেনদেন সম্পন্ন হয়নি / অবস্থা অনিশ্চিত হলে লেনদেন পাতা দেখে নিন, তারপর আবার চেষ্টা করুন।');
  }

  let data: any = null;
  try {
    data = await resp.json();
  } catch (_parseErr) {
    throw new Error('লেনদেন সম্পন্ন হয়নি / অবস্থা অনিশ্চিত হলে লেনদেন পাতা দেখে নিন, তারপর আবার চেষ্টা করুন।');
  }

  if (!resp.ok || !data?.success) {
    throw new Error(data?.error || 'লেনদেন সম্পন্ন হয়নি / অবস্থা অনিশ্চিত হলে লেনদেন পাতা দেখে নিন, তারপর আবার চেষ্টা করুন।');
  }

  return {
    success: true,
    alreadyProcessed: Boolean(data.alreadyProcessed),
    newBalance: Number(data.newBalance),
    transactionId: String(data.transactionId || req.transactionId || req.requestId),
    recordId: String(data.recordId || data.transactionId || req.requestId),
    charge: Number(data.charge || 0),
    totalRequired: Number(data.totalRequired || req.amount),
    receiverName: data.receiverName,
    receiverPhone: data.receiverPhone,
    receiverMemberId: data.receiverMemberId,
    isVirtualSomitiAcc: Boolean(data.isVirtualSomitiAcc)
  };
}

